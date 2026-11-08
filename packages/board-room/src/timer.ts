// SPDX-License-Identifier: Apache-2.0
import { checkTimerRequest, idleTimer, timerBudget, timerInteger, timerSnapshot, timerUuid, TIMER_MAX, TIMER_ZERO,
  type TimerSnapshot, type TimerCause, type TimerReason, type TimerCommand } from 'nextphase-board-sync/timer.ts';
import { meta, setMeta, type Storage, type Row } from './storage.ts';
import { bytes, RoomError, send, type Connection } from './protocol.ts';
import { closeCode } from './access.ts';
import type { Room } from './room.ts';
export const timerColumns = ['singleton','status','duration_ms','ends_at_server_ms','remaining_ms','version','timer_id','last_actor'];
export function timerRow(s:Storage): Row {
  const rows = s.all('SELECT * FROM workshop_timer');
  const row = rows[0];
  if (rows.length !== 1 || row.singleton !== 1 || !timerSnapshot(snapshotOf(row)) || row.last_actor !== null && !timerUuid(row.last_actor) || bytes(JSON.stringify(row)).length > 1024) throw Error('Invalid timer row');
  return row;
}
export function snapshotOf(row:Row): TimerSnapshot { return {status:row.status as TimerSnapshot['status'],durationMs:Number(row.duration_ms),endsAtServerMs:row.ends_at_server_ms as number|null,remainingMs:row.remaining_ms as number|null,version:Number(row.version),timerId:row.timer_id as string|null}; }
export function writeTimer(s:Storage, timer:TimerSnapshot, actor:string|null) {
  if (!timerSnapshot(timer) || actor !== null && !timerUuid(actor)) throw Error('Invalid timer state');
  s.exec('INSERT INTO workshop_timer VALUES (1,?,?,?,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET status=excluded.status,duration_ms=excluded.duration_ms,ends_at_server_ms=excluded.ends_at_server_ms,remaining_ms=excluded.remaining_ms,version=excluded.version,timer_id=excluded.timer_id,last_actor=excluded.last_actor',timer.status,timer.durationMs,timer.endsAtServerMs,timer.remainingMs,timer.version,timer.timerId,actor);
}
export function resetTimer(s:Storage) { writeTimer(s,idleTimer(),null); }
export function markExplicitRecovery(s:Storage) { s.transaction(()=>{setMeta(s,'explicit_recovery_pending',1);setMeta(s,'restore_pending',1);}); }
export class WorkshopTimer {
  private host: Room;
  constructor(host:Room) { this.host=host; }
  get env() { return this.host.env; }
  get s() { return this.env.storage; }
  snapshot() { return snapshotOf(timerRow(this.s)); }
  deadline() { const t=this.snapshot(); if(t.status!=='running')return null;return this.env.now()<t.endsAtServerMs! ? t.endsAtServerMs : t.endsAtServerMs!+TIMER_ZERO; }
  // Must run before any history-intent shortcut. The reservation proves the reset
  // committed, even when subsequent history completion/replay fails.
  async recover() {
    const pending=this.s.all("SELECT value FROM meta WHERE key='explicit_recovery_pending'")[0];
    const reserved=this.s.all("SELECT value FROM meta WHERE key='explicit_recovery_generation'")[0];
    if(!pending) { if(reserved)throw Error('Invalid recovery marker');return false; }
    if(pending.value!==1 || reserved && (!timerInteger(reserved.value)||reserved.value<1))throw Error('Invalid recovery marker');
    const life=await this.host.lifecycle.active();
    if(this.env.mentions && (!this.env.mentions.documentGeneration || !this.env.mentions.mentionGeneration))throw Error("Missing recovery checkpoint");
    const intent=this.host.history.active(), data=intent?JSON.parse(String(intent.result)):null;
    const floors=[await this.env.fence(),meta(this.s,'restore_generation'),life.generation,
      await this.env.mentions?.documentGeneration?.(this.host.boardId)??0,await this.env.mentions?.mentionGeneration?.(this.host.boardId)??0,
      ...(data?[data.oldGeneration,data.generation,data.version?.generation,...(data.carryGeneration===undefined?[]:[data.carryGeneration])]:[])];
    if(!floors.every(timerInteger) || Math.max(...floors)>=Number.MAX_SAFE_INTEGER)throw Error('Invalid recovery floor');
    const reservation=reserved?Number(reserved.value):0;
    if(reservation){const row=timerRow(this.s);if(row.status!=="idle" || row.version!==0 || row.last_actor!==null)throw Error("Invalid reset reservation");}
    if(!reservation || Math.max(...floors)>reservation) {
      const next=await this.env.raiseFence(Math.max(...floors));
      if(!timerInteger(next)||next<=Math.max(...floors))throw Error('Invalid recovery fence');
      await this.host.lifecycle.active();
      this.s.transaction(()=>{if(!reservation)resetTimer(this.s);setMeta(this.s,'explicit_recovery_generation',next);setMeta(this.s,'restore_generation',next);setMeta(this.s,'restore_pending',1);});
    }
    this.host.access.locked=true;
    return true;
  }
  async completeRecovery() {
    if(!meta(this.s,'explicit_recovery_pending'))return;
    if(this.host.history.active())throw Error('History still pending');
    await this.host.lifecycle.active();
    await this.host.access.replay(this.host.boardId,this.host.generation,true);
    if(this.host.access.reason==='access_log_pruned')throw Error('Access replay incomplete');
    this.s.transaction(()=>{this.s.exec("DELETE FROM meta WHERE key IN ('explicit_recovery_pending','explicit_recovery_generation')");setMeta(this.s,'restore_pending',0);});
    this.host.access.locked=false;
  }
  private denied(connection:Connection,code:number,requestId?:string|null):never {
    if(requestId!==undefined)send(connection,{kind:'timer_refused',requestId,reason:'timer_access_changed'});
    connection.close(code);throw new RoomError(403,'timer_access_changed');
  }
  async authority(connection?:Connection,requestId?:string|null) {
    await this.host.lifecycle.active();
    if(this.host.lifecycle.discarded || meta(this.s,'explicit_recovery_pending') || this.host.history.active() || meta(this.s,'restore_pending'))throw Error('Timer unavailable');
    const generation=await this.env.fence();
    if(!timerInteger(generation))throw Error('Invalid timer generation');
    if(generation!==meta(this.s,'restore_generation')){if(connection)this.denied(connection,4423,requestId);throw Error('Timer generation changed');}
    await this.host.access.replay(this.host.boardId,generation);
    if(this.host.access.locked)throw Error('Timer access unavailable');
    if(connection) {
      const a=connection.attachment();
      const role=await this.env.access.role(a.id,this.host.boardId);
      await this.host.access.replay(this.host.boardId,generation);
      const grant=this.host.access.get(a.id);
      if(a.expiresAt<=this.env.now() || !role || !grant || grant.epoch!==a.epoch || role!==grant.role || a.restoreGeneration!==generation) {
        const code=a.expiresAt<=this.env.now()?4401:a.restoreGeneration!==generation?4423:closeCode(role,a.role);
        this.denied(connection,code,requestId);
      }
      if(!this.env.connections().some(p=>p.attachment().connectionId===a.connectionId))throw new RoomError(403,'timer_access_changed');
    }
    await this.host.lifecycle.active();
    if(await this.env.fence()!==generation || meta(this.s,'restore_generation')!==generation){if(connection)this.denied(connection,4423,requestId);throw Error('Timer boundary changed');}
    if(meta(this.s,'explicit_recovery_pending') || this.host.access.locked)throw Error('Timer boundary unavailable');
    if(connection && connection.attachment().expiresAt<=this.env.now())this.denied(connection,4401,requestId);
    this.host.generation=generation;
    return generation;
  }
  stamp() { const now=this.env.now();if(!timerInteger(now))throw Error('Invalid server clock');return {timer:this.snapshot(),serverNowMs:now,restoreGeneration:meta(this.s,'restore_generation')}; }
  async publish(cause:TimerCause) {
    for(const peer of this.env.connections()) {
      try {await this.authority(peer);send(peer,{kind:'timer_state',...this.stamp(),cause});} catch { /* Required authority failure cannot expose a cached snapshot. */ }
    }
  }
  async normalize() {
    const row=timerRow(this.s), t=snapshotOf(row), now=this.env.now();
    if(t.status!=='running'||now<t.endsAtServerMs!+TIMER_ZERO)return false;
    if(!timerInteger(now)||t.version>=Number.MAX_SAFE_INTEGER)throw Error('Timer bounds');
    await this.authority();
    this.s.transaction(()=>writeTimer(this.s,idleTimer(t.version+1),row.last_actor as string|null));
    await this.publish('expire');return true;
  }
  private transition(t:TimerSnapshot, command:TimerCommand):TimerSnapshot|TimerReason {
    if(t.timerId!==command.timerId || t.version!==command.expectedVersion)return 'timer_stale';
    if(t.version>=Number.MAX_SAFE_INTEGER)return 'timer_bounds';
    const now=this.env.now();if(!timerInteger(now))return 'timer_bounds';
    const remaining=t.status==='paused'?t.remainingMs!:t.status==='running'?Math.max(0,t.endsAtServerMs!-now):0;
    const next={...t,version:t.version+1};
    if(command.action==='start') {
      if(t.status!=='idle')return 'timer_state';
      return {...next,status:'running',durationMs:command.durationMs!,endsAtServerMs:now+command.durationMs!,remainingMs:null,timerId:this.env.randomId()};
    }
    if(t.status==='idle')return 'timer_state';
    if(command.action==='end')return idleTimer(next.version);
    if(!remaining)return 'timer_state';
    if(command.action==='pause' && t.status==='running')return {...next,status:'paused',endsAtServerMs:null,remainingMs:remaining};
    if(command.action==='resume' && t.status==='paused')return {...next,status:'running',endsAtServerMs:now+remaining,remainingMs:null};
    if(command.action==='extend') {
      const delta=Math.min(60000,TIMER_MAX-remaining);if(delta<=0)return 'timer_bounds';
      return {...next,durationMs:t.durationMs+delta,...(t.status==='paused'?{remainingMs:remaining+delta}:{endsAtServerMs:t.endsAtServerMs!+delta})};
    }
    return 'timer_state';
  }
  async handle(connection:Connection,message:unknown,size:number) {
    const value=message as any, requestId=timerUuid(value?.requestId)?value.requestId:null;
    let admitted=false;
    const refuse=(reason:TimerReason)=>send(connection,{kind:'timer_refused',requestId,reason,...(admitted?this.stamp():{})});
    try {
      const a=connection.attachment(), field=value?.kind==='timer_command'?'timerTimes':'timerReadTimes';
      const budget=timerBudget(a[field],this.env.now());
      if(!budget){refuse('timer_rate_limited');return;}
      connection.attach({...a,[field]:budget});
      await this.authority(connection,requestId);
      await this.normalize();
      await this.authority(connection,requestId);admitted=true;
      const checked=checkTimerRequest(value,size);
      if(typeof checked==='string'){refuse(checked);return;}
      if(checked.epoch!==a.epoch || checked.restoreGeneration!==a.restoreGeneration){admitted=false;send(connection,{kind:'timer_refused',requestId,reason:'timer_access_changed'});connection.close(checked.restoreGeneration!==a.restoreGeneration?4423:4403);return;}
      if(checked.kind==='timer_read'){send(connection,{kind:'timer_sample',requestId,...this.stamp()});return;}
      const next=this.transition(this.snapshot(),checked);
      if(typeof next==='string'){refuse(next);return;}
      if(!timerSnapshot(next) || next.status==='running' && (!timerInteger(next.endsAtServerMs!+TIMER_ZERO))) {refuse('timer_bounds');return;}
      this.s.transaction(()=>writeTimer(this.s,next,a.id));
      await this.authority(connection,requestId);
      send(connection,{kind:'timer_result',requestId,...this.stamp(),cause:checked.action});
      await this.publish(checked.action);
    } catch(error) {
      if(error instanceof RoomError && error.message==='timer_access_changed')return;
      admitted=false;refuse('timer_unavailable');
    }
  }
}
