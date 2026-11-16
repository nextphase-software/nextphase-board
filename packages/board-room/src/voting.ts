// SPDX-License-Identifier: Apache-2.0
import { checkVoteRequest, idleVoting, sameTarget, voteBudget, voteBytes, voteColours, voteOwn, voteProjection, voteSession,
  VOTE_BALLOT_LIMIT, VOTE_RESPONSE_LIMIT, VOTE_VOTERS, type VoteSession, type VoteOwn, type VoteProjection, type VoteReason, type VoteCause, type VoteCommand } from 'nextphase-board-sync/voting.ts';
import { timerInteger, timerKeys, timerUuid } from 'nextphase-board-sync/timer.ts';
import { eligibleVote } from 'nextphase-board-rules/objects/registry.ts';
import { meta, type Storage, type Row } from './storage.ts';
import { bytes, MESSAGE_LIMIT, rank, RoomError, send, type Connection } from './protocol.ts';
import { closeCode } from './access.ts';
import type { Room } from './room.ts';
export const voteColumns=['singleton','status','session_id','session_version','prompt','budget','targets','page','totals'];
export const ballotColumns=['person_id','session_id','version','colour','targets'];
export function sessionOf(row:Row):VoteSession {
  return {status:row.status as VoteSession['status'],sessionId:row.session_id as string|null,sessionVersion:row.session_version as number,prompt:row.prompt as string,budget:row.budget as number,targets:JSON.parse(String(row.targets)),page:row.page as string|null,totals:row.totals===null?null:JSON.parse(String(row.totals))};
}
export function votingRow(s:Storage):Row {
  const rows=s.all('SELECT * FROM workshop_vote'),row=rows[0];
  if(rows.length!==1||!timerKeys(row,voteColumns)||row.singleton!==1||!voteSession(sessionOf(row))||voteBytes(row)>65536)throw Error('Invalid voting row');
  return row;
}
export function ballotOf(row:Row,session:VoteSession):VoteOwn {
  const targets=JSON.parse(String(row.targets));
  const own={ballotVersion:row.version as number,colour:row.colour as string,targets,remaining:session.budget-targets.length};
  if(!timerKeys(row,ballotColumns)||!timerUuid(row.person_id)||row.session_id!==session.sessionId||session.status!=='running'||!voteOwn(own,session)||voteBytes(row)>VOTE_BALLOT_LIMIT)throw Error('Invalid ballot row');
  return own;
}
export function writeVoting(s:Storage,t:VoteSession) {
  const row={singleton:1,status:t.status,session_id:t.sessionId,session_version:t.sessionVersion,prompt:t.prompt,budget:t.budget,targets:JSON.stringify(t.targets),page:t.page,totals:t.totals===null?null:JSON.stringify(t.totals)};
  if(!voteSession(t)||voteBytes(row)>65536)throw Error('Voting bounds');
  s.exec('INSERT INTO workshop_vote (singleton,status,session_id,session_version,prompt,budget,targets,page,totals) VALUES (1,?,?,?,?,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET status=excluded.status,session_id=excluded.session_id,session_version=excluded.session_version,prompt=excluded.prompt,budget=excluded.budget,targets=excluded.targets,page=excluded.page,totals=excluded.totals',t.status,t.sessionId,t.sessionVersion,t.prompt,t.budget,row.targets,t.page,row.totals);
}
export function writeBallot(s:Storage,person:string,t:VoteSession,own:VoteOwn) {
  const row={person_id:person,session_id:t.sessionId,version:own.ballotVersion,colour:own.colour,targets:JSON.stringify(own.targets)};
  ballotOf(row,t);
  s.exec('INSERT INTO workshop_vote_ballots VALUES (?,?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET session_id=excluded.session_id,version=excluded.version,colour=excluded.colour,targets=excluded.targets',person,t.sessionId,own.ballotVersion,own.colour,row.targets);
}
export function resetVoting(s:Storage) { s.exec('DELETE FROM workshop_vote_ballots');writeVoting(s,idleVoting()); }
export function pruneVoter(s:Storage,person:string,force=false) {
  const row=s.all('SELECT * FROM workshop_vote_ballots WHERE person_id=?',person)[0];if(!row)return false;
  const t=sessionOf(votingRow(s)),own=ballotOf(row,t);
  if(!own.targets.length&&!force)return false;
  if(own.ballotVersion===Number.MAX_SAFE_INTEGER)throw Error('Voting version bounds');
  writeBallot(s,person,t,{...own,targets:[],remaining:t.budget,ballotVersion:own.ballotVersion+1});return true;
}
export class WorkshopVoting {
  private targetsChanged=false;
  private host:Room;
  constructor(host:Room) {this.host=host;}
  get s(){return this.host.env.storage;}
  snapshot(){return sessionOf(votingRow(this.s));}
  validate() {
    const t=this.snapshot(),rows=this.s.all('SELECT * FROM workshop_vote_ballots');
    if(rows.length>VOTE_VOTERS||t.status!=='running'&&rows.length)throw Error('Invalid voting rows');
    for(const row of rows)ballotOf(row,t);
    if(voteBytes(votingRow(this.s))+rows.reduce((sum,row)=>sum+voteBytes(row),0)>270336)throw Error('Voting storage bounds');
    return t;
  }
  running(){return !!meta(this.s,'storage_version')&&this.snapshot().status==='running';}
  private denied(c:Connection,code:number):never {this.host.spotlight.closed(c,code);c.close(code);throw new RoomError(403,'vote_access_changed');}
  async authority(c?:Connection) {
    // The same strict gate as Timer, without ever emitting a timer refusal.
    const generation=await this.host.timer.authority();
    if(c){
      const a=c.attachment(),role=await this.host.env.access.role(a.id,this.host.boardId);
      await this.host.access.replay(this.host.boardId,generation);
      const grant=this.host.access.get(a.id);
      if(a.expiresAt<=this.host.env.now())this.denied(c,4401);
      if(a.restoreGeneration!==generation)this.denied(c,4423);
      if(!role||!grant||grant.epoch!==a.epoch||role!==grant.role||role!==a.role)this.denied(c,closeCode(role,a.role));
      if(!this.host.env.connections().some(p=>p.attachment().connectionId===a.connectionId))throw new RoomError(403,'vote_access_changed');
    }
    await this.host.timer.authority();
    if(c&&c.attachment().expiresAt<=this.host.env.now())this.denied(c,4401);
    return generation;
  }
  // Stage the entire target/refund update before opening the synchronous transaction.
  reconcileTargets() {
    const t=this.validate();if(t.status!=='running')return false;
    const targets=t.targets.filter(p=>this.host.board.objects.some(o=>sameTarget(p,[o.id,o.generation])&&o.page===t.page&&eligibleVote(o)));
    if(targets.length===t.targets.length)return false;
    const next={...t,targets},rows=this.s.all('SELECT * FROM workshop_vote_ballots');
    const changed=rows.map(row=>{
      const own=ballotOf(row,t),kept=own.targets.filter(p=>targets.some(q=>sameTarget(p,q)));
      if(kept.length===own.targets.length)return null;
      if(own.ballotVersion===Number.MAX_SAFE_INTEGER)throw Error('Voting version bounds');
      return {person:String(row.person_id),own:{...own,targets:kept,remaining:t.budget-kept.length,ballotVersion:own.ballotVersion+1}};
    }).filter(v=>v!==null);
    this.s.transaction(()=>{writeVoting(this.s,next);for(const row of changed)writeBallot(this.s,row.person,next,row.own);});this.targetsChanged=true;return true;
  }
  async flushTargets(){if(this.targetsChanged){this.targetsChanged=false;await this.publish('targets');}}
  async reconcileVoters() {
    const t=this.validate();if(t.status!=='running')return;
    const lost:string[]=[];
    for(const row of this.s.all('SELECT * FROM workshop_vote_ballots')) {
      const role=await this.host.env.access.role(String(row.person_id),this.host.boardId);
      if(rank(role)<rank('editor'))lost.push(String(row.person_id));
    }
    await this.authority();
    this.s.transaction(()=>{for(const person of lost)pruneVoter(this.s,person);});
  }
  projection(c:Connection):VoteProjection {
    const session=this.validate(),a=c.attachment();let own:VoteProjection['own']=null;
    if(session.status==='running'&&rank(a.role)>=rank('editor')) {
      let row=this.s.all('SELECT * FROM workshop_vote_ballots WHERE person_id=?',a.id)[0];
      if(!row&&this.s.all('SELECT person_id FROM workshop_vote_ballots').length<VOTE_VOTERS) {
        const colour=a.presence?.colour??voteColours[(a.ordinal??0)%8];
        this.s.transaction(()=>writeBallot(this.s,a.id,session,{ballotVersion:0,colour,targets:[],remaining:session.budget}));
        row=this.s.all('SELECT * FROM workshop_vote_ballots WHERE person_id=?',a.id)[0];
      }
      own=row?ballotOf(row,session):{limited:true};
    }
    const projection={session,own};if(!voteProjection(projection))throw Error('Voting projection bounds');return projection;
  }
  private send(c:Connection,frame:object){if(voteBytes(frame)>VOTE_RESPONSE_LIMIT)throw Error('Voting frame bounds');send(c,frame);}
  // Room loading checks lifecycle before dispatch. Required-source/storage failure
  // there still owes a recognized voting request its projection-free refusal.
  refuseLoadFailure(c:Connection,text:string,error:unknown) {
    if(error instanceof RoomError&&error.status!==503||bytes(text).length>MESSAGE_LIMIT)return false;
    let value;try{value=JSON.parse(text);}catch{return false;}
    if(value?.kind!=='vote_read'&&value?.kind!=='vote_command')return false;
    if(!this.host.env.connections().some(p=>p.attachment().connectionId===c.attachment().connectionId))return true;
    if(c.attachment().expiresAt<=this.host.env.now()){c.close(4401);return true;}
    this.send(c,{kind:'vote_refused',requestId:timerUuid(value.requestId)?value.requestId:null,reason:'vote_unavailable'});
    return true;
  }
  async stamp(c:Connection) {const restoreGeneration=await this.authority(c);this.reconcileTargets();return {voting:this.projection(c),restoreGeneration};}
  async publish(cause:VoteCause,person?:string) {
    for(const peer of this.host.env.connections()) {
      if(person!==undefined&&peer.attachment().id!==person)continue;
      try {this.send(peer,{kind:'vote_state',...await this.stamp(peer),cause});}catch{/* No cached/private projection on failed live authority. */}
    }
  }
  private transition(command:VoteCommand,c:Connection):VoteReason|VoteSession {
    const t=this.snapshot();
    if(t.sessionId!==command.sessionId||t.sessionVersion!==command.expectedSessionVersion)return 'vote_stale_session';
    if(command.action==='start') {
      if(t.status!=='idle')return 'vote_state';
      if(t.sessionVersion===Number.MAX_SAFE_INTEGER)return 'vote_bounds';
      if(!this.host.board.pages.some(p=>p.id===command.page))return 'vote_ineligible';
      const targets=this.host.board.objects.filter(o=>o.page===command.page&&eligibleVote(o)).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).map((o,i)=>[o.id,o.generation,i] as [string,string,number]);
      if(!targets.length||targets.length>250)return 'vote_ineligible';
      return {status:'running',sessionId:this.host.env.randomId(),sessionVersion:t.sessionVersion+1,prompt:command.prompt.trim(),budget:command.budget,page:command.page,targets,totals:null};
    }
    if(command.action==='clear'||command.action==='reveal') {
      if(t.status!==(command.action==='clear'?'revealed':'running'))return 'vote_state';
      if(t.sessionVersion===Number.MAX_SAFE_INTEGER)return 'vote_bounds';
      if(command.action==='clear')return idleVoting(t.sessionVersion+1);
      const ballots=this.s.all('SELECT * FROM workshop_vote_ballots').map(row=>ballotOf(row,t));
      return {...t,status:'revealed',sessionVersion:t.sessionVersion+1,totals:t.targets.map(p=>ballots.reduce((n,b)=>n+Number(b.targets.some(q=>sameTarget(p,q))),0))};
    }
    if(t.status!=='running')return 'vote_state';
    const row=this.s.all('SELECT * FROM workshop_vote_ballots WHERE person_id=?',c.attachment().id)[0];
    if(!row)return 'vote_voter_limit';
    const own=ballotOf(row,t);
    if(command.expectedBallotVersion!==own.ballotVersion)return 'vote_stale_ballot';
    if(own.ballotVersion===Number.MAX_SAFE_INTEGER)return 'vote_bounds';
    const target:[string,string]=[command.objectId,command.objectGeneration];
    if(!t.targets.some(p=>sameTarget(p,target)))return 'vote_ineligible';
    const voted=own.targets.some(p=>sameTarget(p,target));
    if(command.action==='vote'&&voted)return 'vote_already_voted';
    if(command.action==='unvote'&&!voted)return 'vote_not_voted';
    if(command.action==='vote'&&!own.remaining)return 'vote_budget_spent';
    const targets=command.action==='vote'?[...own.targets,target]:own.targets.filter(p=>!sameTarget(p,target));
    this.s.transaction(()=>writeBallot(this.s,c.attachment().id,t,{...own,targets,remaining:t.budget-targets.length,ballotVersion:own.ballotVersion+1}));return t;
  }
  async handle(c:Connection,message:unknown,size:number) {
    const value=message as any,requestId=timerUuid(value?.requestId)?value.requestId:null;
    const refuse=async(reason:VoteReason,admitted=false)=>this.send(c,{kind:'vote_refused',requestId,reason,...(admitted?await this.stamp(c):{})});
    try {
      const a=c.attachment(),field=value.kind==='vote_read'?'voteReadTimes':'voteTimes',budget=voteBudget(a[field],this.host.env.now());
      // Recognized invalid attempts count, but never disclose state before admission.
      if(budget){const next={...a,[field]:budget};if(bytes(JSON.stringify(next)).length>16384)throw Error('Attachment bounds');c.attach(next);}
      await this.authority(c);
      if(value.kind==='vote_command'&&rank(a.role)<rank('editor')){await refuse('vote_access_changed');return;}
      if(!budget){await refuse('vote_rate_limited',true);return;}
      const checked=checkVoteRequest(value,size);
      if(typeof checked==='string'){await refuse(checked,true);return;}
      if(checked.epoch!==a.epoch||checked.restoreGeneration!==a.restoreGeneration){await refuse('vote_access_changed');c.close(checked.restoreGeneration!==a.restoreGeneration?4423:4403);return;}
      if(checked.kind==='vote_command'&&checked.action==='reveal')await this.reconcileVoters();
      this.reconcileTargets();
      await this.authority(c);
      // Reserve a stable empty row before checking an own version.
      this.projection(c);
      if(checked.kind==='vote_read'){this.send(c,{kind:'vote_snapshot',requestId,...await this.stamp(c)});await this.flushTargets();return;}
      const next=this.transition(checked,c);
      if(typeof next==='string'){await refuse(next,true);return;}
      if(checked.action==='start'||checked.action==='reveal'||checked.action==='clear') {
        this.s.transaction(()=>{writeVoting(this.s,next);this.s.exec('DELETE FROM workshop_vote_ballots');});
        if(checked.action==='start')this.host.spotlight.end('voting');
        this.targetsChanged=false;
        // Discard retained spatial presence at both edges; only fresh input returns.
        this.host.presence.clearSpatial(false);
      }
      await this.host.spotlight.flush();
      this.send(c,{kind:'vote_result',requestId,...await this.stamp(c),cause:checked.action});
      await this.flushTargets();
      await this.publish(checked.action,checked.action==='vote'||checked.action==='unvote'?a.id:undefined);
      if(['start','reveal','clear'].includes(checked.action))for(const peer of this.host.env.connections())await this.host.presence.relay(peer);
    }catch(error){if(!this.host.env.connections().some(p=>p.attachment().connectionId===c.attachment().connectionId))return;await refuse(error instanceof RoomError&&error.message==='vote_access_changed'?'vote_access_changed':'vote_unavailable');}
  }
}
