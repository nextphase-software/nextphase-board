// SPDX-License-Identifier: Apache-2.0
import { RoomError } from './protocol.ts';
import type { Room } from './room.ts';
import { meta, setMeta } from './storage.ts';
export const TRASH_AGE = 2592000000;
export type LifecycleState = 'active'|'moving'|'trashed'|'restoring'|'purging'|'deleted';
export type Lifecycle = { boardId:string; workspaceId:string; state:LifecycleState; cycle:number|null; generation:number;
  deletedAt:number|null; restoreBefore:number|null; operationId?:string|null; phase?:string; nextAttemptAt?:number|null };
export type LifecycleRequest = { person:string; requestId:string; expectedCycle:number; operation:'move'|'restore'|'purge'; workspace:string|null; digest:string };
export interface LifecycleSource {
  lifecycle(board:string):Promise<Lifecycle|null>;
  admitLifecycle(board:string, request:LifecycleRequest, now:number, floor:number):Promise<Lifecycle>;
}
export const safeInteger = (n:unknown): n is number => typeof n==='number' && Number.isSafeInteger(n) && n>=0;
export function boundedJournal(value:unknown) {
  const metadata=(entry:unknown):boolean => entry===null || typeof entry==='string' || typeof entry==='boolean' || safeInteger(entry) ||
    !!entry && typeof entry==='object' && !Array.isArray(entry) && Object.values(entry).every(metadata);
  if(!metadata(value))throw new RoomError(400,'bad_request');
  const text=JSON.stringify(value);
  if (typeof text!=='string' || new TextEncoder().encode(text).length>65536) throw new RoomError(400,'bad_request');
  return text;
}
export async function requireActive(env:import('./interfaces.ts').RoomEnvironment,board:string) {
  const row=await env.lifecycle.lifecycle(board);
  if (!row || row.state!=='active') throw new RoomError(404,'not_found');
  return row;
}
// This bridge always runs inside Room.ordered. It does not own another queue.
export class RoomLifecycle {
  discarded=false;
  private host:Room;
  constructor(host:Room) { this.host=host; }
  async active() {
    if (this.discarded) throw new RoomError(404,'not_found');
    let row:Lifecycle|null;
    try { row=await this.host.env.lifecycle.lifecycle(this.host.boardId); }
    catch { this.host.access.locked=true; throw new RoomError(503,'service_unavailable'); }
    if (!row || row.state!=='active') {
      this.freeze();
      throw new RoomError(404,'not_found');
    }
    return row;
  }
  freeze() {
    this.host.access.locked=true;
    this.host.lifecyclePause();
  }
  async admit(request:LifecycleRequest) {
    // Do not load/replay an intent here: an already accepted restore must settle first.
    if (request.operation==='move' && this.host.history.active()) throw new RoomError(503,'restore_pending');
    const floor=Math.max(await this.host.env.fence(),meta(this.host.env.storage,'restore_generation'));
    let result:Lifecycle;
    try { result=await this.host.env.lifecycle.admitLifecycle(this.host.boardId,request,this.host.env.now(),floor); }
    catch(error) {
      if (error instanceof RoomError && error.status!==503 || request.operation==='purge') throw error;
      const current=await this.host.env.lifecycle.lifecycle(this.host.boardId);
      if (current?.cycle===request.expectedCycle && current.state===(request.operation==='move'?'active':'trashed')) throw new RoomError(503,request.operation==='move'?'move_failed':'restore_failed');
      throw error;
    }
    if (result.state!=='active') this.freeze();
    return result;
  }
  async fence(row:Lifecycle) {
    this.freeze();
    const current=await this.host.env.lifecycle.lifecycle(this.host.boardId);
    if (!current || current.operationId!==row.operationId || current.generation!==row.generation) throw new RoomError(503,'lifecycle_pending');
    const s=this.host.env.storage;
    const generation=await this.host.env.fence();
    if (Math.max(generation,meta(s,'restore_generation'))>row.generation) throw new RoomError(503,'service_unavailable');
    if (generation<row.generation) {
      const raised=await this.host.env.raiseFence(row.generation-1);
      if (raised!==row.generation) throw new RoomError(503,'service_unavailable');
    }
    this.host.generation=row.generation;
    s.transaction(()=>{
      s.exec('DELETE FROM tickets');s.exec('DELETE FROM waiting');
      s.exec('DELETE FROM mention_pending');s.exec('DELETE FROM mention_targets');
      setMeta(s,'mention_cleanup',0);
      // Keep original history schedule/fingerprint and the delivery cutoff.
      setMeta(s,'restore_generation',row.generation);
    });
    this.host.history.prune();
    await this.host.env.schedule(null);
  }
  async accessReady(row:Lifecycle) {
    await this.fence(row);
    // Rebuild grants from live authority on the next active join; no permission snapshot.
    this.host.env.storage.exec('DELETE FROM grants');
    this.host.initialized=false;
  }
}
