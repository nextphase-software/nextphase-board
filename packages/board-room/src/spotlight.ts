// SPDX-License-Identifier: Apache-2.0
import { checkSpotlightRequest, idleSpotlight, spotlightBudget, spotlightBytes, spotlightKey, spotlightProjection, spotlightSession, SPOTLIGHT_GRACE, SPOTLIGHT_MAX, terminalSpotlightClose, type SpotlightCause, type SpotlightProjection, type SpotlightReason, type SpotlightSession } from 'nextphase-board-sync/spotlight.ts';
import { timerInteger, timerKeys, timerUuid } from 'nextphase-board-sync/timer.ts';
import { meta } from './storage.ts';
import { bytes, MESSAGE_LIMIT, RoomError, send, type Attachment, type Connection } from './protocol.ts';
import type { Room } from './room.ts';
export type SpotlightMember = { sessionId:string; membershipVersion:number; following:boolean; finalized:boolean };
export type SpotlightAttachment = { session:SpotlightSession; key:string; hasHadFollower:boolean; fresh:boolean };
export function validSpotlightAttachment(a:Attachment) {
  const m=a.spotlightMember,p=a.spotlightPresenter;
  if(m!==undefined&&(!timerKeys(m,['sessionId','membershipVersion','following','finalized'])||!timerUuid(m.sessionId)||!timerInteger(m.membershipVersion)||typeof m.following!=='boolean'||typeof m.finalized!=='boolean'||m.finalized&&m.following||m.membershipVersion>SPOTLIGHT_MAX-(m.finalized?0:m.following?2:1)))return false;
  if(p!==undefined&&(!timerKeys(p,['session','key','hasHadFollower','fresh'])||!spotlightSession(p.session)||p.session.phase==='idle'||p.session.presenter?.connection!==a.connectionId||!spotlightKey(p.key)||typeof p.hasHadFollower!=='boolean'||typeof p.fresh!=='boolean'))return false;
  return spotlightBytes({...(m?{spotlightMember:m}:{}),...(p?{spotlightPresenter:p}:{})})<=1024&&[a.spotlightTimes,a.spotlightReadTimes].every(v=>v===undefined||Array.isArray(v)&&v.length<=5&&v.every(timerInteger)&&spotlightBytes(v)<=1024);
}
const key = () => [...(crypto as typeof crypto & {getRandomValues<T extends Uint8Array>(value:T):T}).getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
// Only this class owns ephemeral room state. It never writes the room database.
export class Spotlight {
  session:SpotlightSession;
  private capability?:string;
  private identity?:{id:string;epoch:number;generation:number};
  private had=false;
  private fresh=false;
  private recovered=false;
  private pending?:SpotlightCause;
  private pendingMember?:Connection;
  private host:Room;
  constructor(host:Room){this.host=host;this.session=idleSpotlight(host.env.randomId());}
  private peers(){return this.host.env.connections();}
  private presenter(){return this.peers().find(c=>c.attachment().connectionId===this.session.presenter?.connection);}
  private member(c:Connection){const m=c.attachment().spotlightMember;return m?.sessionId===this.session.sessionId?m:undefined;}
  private attach(c:Connection, patch:Partial<Attachment>){const next={...c.attachment(),...patch};if(!validSpotlightAttachment(next)||spotlightBytes(next)>16384)throw Error('Spotlight attachment bounds');c.attach(next);}
  private keepPresenter(){const c=this.presenter();if(c&&this.capability)this.attach(c,{spotlightPresenter:{session:this.session,key:this.capability,hasHadFollower:this.had,fresh:this.fresh}});}
  private finalize(c:Connection){const m=this.member(c);if(m&&!m.finalized)this.attach(c,{spotlightMember:{...m,following:false,finalized:true,membershipVersion:m.membershipVersion+1}});}
  private cleanup(c:Connection){const a=c.attachment();if(![a.spotlightMember,a.spotlightPresenter,a.spotlightTimes,a.spotlightReadTimes].some(v=>v!==undefined))return;this.attach(c,{spotlightPresenter:undefined,spotlightMember:undefined,spotlightTimes:undefined,spotlightReadTimes:undefined});}
  end(cause:SpotlightCause) {
    if(this.session.phase==='idle')return;
    for(const c of this.peers()){this.finalize(c);this.attach(c,{spotlightPresenter:undefined});}
    this.session=idleSpotlight(this.session.authorityId,this.session.controlVersion+1);
    this.capability=undefined;this.identity=undefined;this.had=false;this.fresh=false;this.pending=cause;this.pendingMember=undefined;
  }
  closed(c:Connection,code=1006,_reason='') {
    const presenter=this.session.presenter?.connection===c.attachment().connectionId;
    if(presenter){
      if(terminalSpotlightClose(code))this.end(code===4423?'recovery':code===4403?'lifecycle':'left');
      else if(this.session.phase==='active'){
        this.session={...this.session,phase:'reconnecting',controlVersion:this.session.controlVersion+1,graceDeadline:this.host.env.now()+SPOTLIGHT_GRACE};
        this.fresh=false;this.pendingMember=undefined;this.pending='reconnecting';this.keepPresenter();
      }
    }else if(this.member(c)?.following){this.finalize(c);this.pending='leave';this.pendingMember=c;}
    this.cleanup(c);
    if(!this.peers().some(p=>p.attachment().connectionId!==c.attachment().connectionId))this.end('left');
  }
  expired(c:Connection) {
    if(this.session.presenter?.connection===c.attachment().connectionId)this.closed(c,1006);
    else if(this.member(c)?.following){this.finalize(c);this.pending='leave';this.pendingMember=c;this.attach(c,{spotlightTimes:undefined,spotlightReadTimes:undefined});}
  }
  deadline(){return this.session.graceDeadline;}
  async expire(){if(this.session.phase==='reconnecting'&&this.host.env.now()>=this.session.graceDeadline!)this.end('left');await this.flush();}
  async authority(c?:Connection){
    try{
      const generation=await this.host.voting.authority(c),presenter=this.presenter();
      if(presenter&&presenter!==c)await this.host.voting.authority(presenter);
      else if(!presenter&&this.identity&&this.session.phase!=='idle'){
        const role=await this.host.env.access.role(this.identity.id,this.host.boardId);await this.host.access.replay(this.host.boardId,generation);
        const grant=this.host.access.get(this.identity.id);if(!role||!grant||grant.epoch!==this.identity.epoch||role!==grant.role)this.end('left');
      }
      return generation;
    }catch(error){if(error instanceof RoomError&&error.status===403)throw new RoomError(403,'spotlight_access_changed');throw error;}
  }
  async recover(){
    if(this.recovered)return;
    await this.authority();
    const candidates=this.peers().filter(c=>c.attachment().spotlightPresenter);
    // No socket can elect itself from follower metadata. Absent-presenter grace is lost.
    if(candidates.length===1&&!this.host.voting.running()){
      const c=candidates[0],a=c.attachment(),p=a.spotlightPresenter!;
      if(validSpotlightAttachment(a)&&p.session.phase==='active'&&p.session.presenter?.connection===a.connectionId&&p.session.presenter.label===a.label&&p.session.presenter.person===a.presence?.person&&p.session.presenter.colour===a.presence?.colour&&a.presence&&a.presenceAt!+30000>this.host.env.now()){
        await this.authority(c);this.session=p.session;this.capability=p.key;this.had=p.hasHadFollower;this.fresh=p.fresh;this.identity={id:a.id,epoch:a.epoch,generation:a.restoreGeneration!};
        for(const peer of this.peers()){try{await this.authority(peer);}catch(error){if(error instanceof RoomError&&error.status===403)this.cleanup(peer);else throw error;}}
        this.recovered=true;return;
      }
    }
    if(this.peers().some(c=>c.attachment().spotlightMember||c.attachment().spotlightPresenter))this.pending='left';
    for(const c of this.peers())this.cleanup(c);
    this.recovered=true;
  }
  projection(c:Connection):SpotlightProjection {
    const a=c.attachment(),m=a.spotlightMember;
    const own=m?{membershipVersion:m.membershipVersion,following:m.sessionId===this.session.sessionId&&m.following}:{membershipVersion:0,following:false};
    const people=new Set(this.peers().filter(p=>this.member(p)?.following&&p.attachment().id!==this.identity?.id).map(p=>p.attachment().id));
    const projection={session:this.session,own,presenting:this.session.presenter?.connection===a.connectionId?{followers:people.size,hasHadFollower:this.had}:null};
    if(!spotlightProjection(projection))throw Error('Spotlight projection bounds');return projection;
  }
  async stamp(c:Connection){const restoreGeneration=await this.authority(c);return {spotlight:this.projection(c),restoreGeneration};}
  private send(c:Connection,frame:object){if(spotlightBytes(frame)>4096)throw Error('Spotlight frame bounds');send(c,frame);}
  async publish(cause:SpotlightCause,member?:Connection){
    const ids=member?new Set([member.attachment().connectionId,this.session.presenter?.connection]):null;
    for(const c of this.peers())if(!ids||ids.has(c.attachment().connectionId))try{this.send(c,{kind:'spotlight_state',...await this.stamp(c),cause});}catch{/* Failed current authority exposes no cached state. */}
  }
  async flush(){const cause=this.pending,member=this.pendingMember;this.pending=undefined;this.pendingMember=undefined;if(cause)await this.publish(cause,member);}
  async relayTo(from:Connection,to:Connection){if(from.attachment().connectionId!==this.session.presenter?.connection)return true;try{await this.authority(to);return this.session.presenter?.connection===from.attachment().connectionId&&this.session.phase==='active'&&this.fresh;}catch{return false;}}
  // The presenter's ordinary coordinates have the same strict gate as commands.
  async spatial(c:Connection,accepted=false){
    if(this.session.presenter?.connection!==c.attachment().connectionId)return true;
    try{
      await this.authority(c);
      if(this.host.voting.running()){this.end('voting');return false;}
      if(accepted&&this.session.phase==='active'){this.fresh=true;this.keepPresenter();}
      return this.session.phase==='active'&&this.fresh;
    }catch{return false;}
  }
  visible(connection:string){return connection!==this.session.presenter?.connection||this.session.phase==='active'&&this.fresh;}
  refuseLoadFailure(c:Connection,text:string,error:unknown){
    if(error instanceof RoomError&&error.status!==503||bytes(text).length>MESSAGE_LIMIT)return false;
    let v;try{v=JSON.parse(text);}catch{return false;}
    if(v?.kind!=='spotlight_read'&&v?.kind!=='spotlight_command')return false;
    if(c.attachment().expiresAt<=this.host.env.now()){this.closed(c,4401);c.close(4401);return true;}
    this.send(c,{kind:'spotlight_refused',requestId:timerUuid(v.requestId)?v.requestId:null,reason:'spotlight_unavailable'});return true;
  }
  async handle(c:Connection,value:any,size:number){
    const requestId=timerUuid(value?.requestId)?value.requestId:null;
    let admitted=false;
    const refuse=async(reason:SpotlightReason)=>this.send(c,{kind:'spotlight_refused',requestId,reason,...(admitted?await this.stamp(c):{})});
    try{
      const a=c.attachment(),field=value.kind==='spotlight_read'?'spotlightReadTimes':'spotlightTimes',budget=spotlightBudget(a[field],this.host.env.now());
      if(budget)this.attach(c,{[field]:budget});
      await this.authority(c);await this.recover();await this.expire();await this.authority(c);admitted=true;
      if(!budget){await refuse('spotlight_rate_limited');return;}
      const v=checkSpotlightRequest(value,size);if(typeof v==='string'){await refuse(v);return;}
      if(v.epoch!==a.epoch||v.restoreGeneration!==a.restoreGeneration){admitted=false;await refuse('spotlight_access_changed');const code=v.restoreGeneration!==a.restoreGeneration?4423:4403;this.closed(c,code);c.close(code);return;}
      if(v.kind==='spotlight_read'){this.send(c,{kind:'spotlight_snapshot',requestId,...await this.stamp(c)});return;}
      const action=v.action,t=this.session;
      if(this.host.voting.running()&&['start','take_over','follow','resume'].includes(action)){await refuse('spotlight_voting');return;}
      if(v.authorityId!==t.authorityId||v.sessionId!==t.sessionId||'expectedControlVersion'in v&&v.expectedControlVersion!==t.controlVersion){await refuse('spotlight_stale_session');return;}
      const m=this.member(c),version=m?.membershipVersion??0;
      if('expectedMembershipVersion'in v&&v.expectedMembershipVersion!==version){await refuse('spotlight_stale_member');return;}
      const isPresenter=t.presenter?.connection===a.connectionId;
      if(action==='stop'&&!isPresenter){await refuse('spotlight_not_presenter');return;}
      if(action==='start'&&t.phase!=='idle'||action==='take_over'&&(t.phase==='idle'||isPresenter)||action==='stop'&&t.phase==='idle'||action==='follow'&&(t.phase!=='active'||a.id===this.identity?.id||m?.following||m?.finalized||!this.fresh)||action==='leave'&&(t.phase==='idle'||!m?.following)||action==='resume'&&(t.phase!=='reconnecting'||this.host.env.now()>=t.graceDeadline!||!('resumeKey'in v)||v.resumeKey!==this.capability||a.id!==this.identity?.id||a.epoch!==this.identity.epoch||a.restoreGeneration!==this.identity.generation||!a.presence||!a.presenceReal)){
        await refuse('spotlight_state');return;
      }
      if(['start','take_over','resume'].includes(action)&&t.controlVersion>SPOTLIGHT_MAX-3||action==='follow'&&version>SPOTLIGHT_MAX-3){await refuse('spotlight_version_exhausted');return;}
      const resumeMembers:Connection[]=[];
      if(action==='resume'){
        for(const peer of this.peers())if(this.member(peer)?.following)try{await this.authority(peer);resumeMembers.push(peer);}catch(error){if(!(error instanceof RoomError&&error.status===403))throw error;/* Terminal denial already removes this member. */}
        await this.authority(c);
        if(this.session!==t){await refuse('spotlight_stale_session');return;}
        if(this.host.env.now()>=t.graceDeadline!){this.end('left');await refuse('spotlight_stale_session');return;}
      }
      let resumeKey:string|undefined;
      if(action==='start'||action==='take_over'||action==='resume'){
        const presence=a.presence;if(!presence){await refuse('spotlight_state');return;}
        resumeKey=key();
        const next:SpotlightSession={authorityId:t.authorityId,sessionId:action==='resume'?t.sessionId:this.host.env.randomId(),controlVersion:t.controlVersion+1,phase:'active',presenter:{connection:a.connectionId,person:presence.person,label:presence.label,colour:presence.colour},graceDeadline:null};
        const metadata={session:next,key:resumeKey,hasHadFollower:action==='resume'?this.had:false,fresh:action==='resume'};
        // Validate maximal encoding before invalidating any previous session.
        const trial={...a,spotlightPresenter:metadata,spotlightMember:undefined};
        if(!validSpotlightAttachment(trial)||spotlightBytes(trial)>16384){await refuse('spotlight_message_too_large');return;}
        if(action!=='resume')for(const peer of this.peers()){this.finalize(peer);this.attach(peer,{spotlightMember:undefined,spotlightPresenter:undefined});}
        else {for(const peer of this.peers())this.attach(peer,{spotlightPresenter:undefined});}
        this.session=next;this.capability=resumeKey;this.identity={id:a.id,epoch:a.epoch,generation:a.restoreGeneration!};this.fresh=action==='resume';if(action!=='resume')this.had=false;
        this.keepPresenter();
        if(action==='resume')for(const peer of resumeMembers){
          const old=this.member(peer);if(!old?.following)continue;
          if(old.membershipVersion>SPOTLIGHT_MAX-3){this.attach(peer,{spotlightMember:{...old,following:false,membershipVersion:old.membershipVersion+1}});this.send(peer,{kind:'spotlight_refused',requestId:null,reason:'spotlight_version_exhausted',spotlight:this.projection(peer),restoreGeneration:a.restoreGeneration});}
          else this.attach(peer,{spotlightMember:{...old,membershipVersion:old.membershipVersion+1}});
        }
      }else if(action==='stop')this.end('stop');
      else {
        this.attach(c,{spotlightMember:{sessionId:t.sessionId!,membershipVersion:version+1,following:action==='follow',finalized:false}});
        if(action==='follow'){this.had=true;this.keepPresenter();}
      }
      this.send(c,{kind:'spotlight_result',requestId,spotlight:this.projection(c),restoreGeneration:a.restoreGeneration,cause:action,...(resumeKey?{resumeKey}:{})});
      this.pending=undefined;this.pendingMember=undefined;await this.publish(action,action==='follow'||action==='leave'?c:undefined);
      await this.host.scheduleSpotlight();
    }catch(error){admitted=false;try{await refuse(error instanceof RoomError&&error.message==='spotlight_access_changed'?'spotlight_access_changed':'spotlight_unavailable');}catch{/* Socket already ended. */}}
  }
}
