// SPDX-License-Identifier: Apache-2.0
import type { HostedBoard, VoteProjection, VoteFrame, VoteCommand } from './hosted-board';
import type { ItemV10 } from 'nextphase-board-rules/document.ts';
import { ownBallot, remainingWords, targetMatches, validQuestion, validBudget, voteKey, eligibleVote } from './voting-rules.ts';
type Health='connecting'|'ready'|'checking'|'disconnected';
type CommandInput={action:'start';prompt:string;budget:number}|{action:'vote'|'unvote';objectId:string;objectGeneration:string;expectedBallotVersion:number}|{action:'reveal'|'clear'};
export class BoardVoting {
  projection?:VoteProjection;health:Health='connecting';generation=0;mode=false;setup=false;question='';budget=3;selected='';hover='';
  confirmation:{sessionId:string|null;sessionVersion:number;action:'reveal'|'clear'}|null=null;
  announcement='';announcementId=0;error='';onEnter?:()=>void;onNavigate?:(id:string)=>void;
  private sequence=0;private pending?:{id:string;at:number;sequence:number};private read?:{id:string;at:number;sequence:number};private lastRead=-Infinity;private loss=false;private admitted=false;private disposed=false;
  private speechSession=-1;private speechBallot=-1;private speechId:string|null=null;
  private deadlines=new Map<string,ReturnType<typeof setTimeout>>();private listeners=new Set<()=>void>();
  private press?:{id:string;x:number;y:number;pointer:number};
  private host:HostedBoard;private now:()=>number;
  constructor(host:HostedBoard,now:()=>number=()=>performance.now()){this.host=host;this.now=now;}
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  private emit(){for(const fn of this.listeners)fn();}
  private speak(text:string){if(text){this.cancel('speech');this.announcement=text;this.announcementId++;}}
  private speakOwn(text:string){this.at('speech',100,()=>{if(!this.loss){this.speak(text);this.emit();}});}
  private at(name:string,ms:number,run:()=>void){this.cancel(name);this.deadlines.set(name,setTimeout(()=>{this.deadlines.delete(name);if(!this.disposed)run();},ms));}
  private cancel(name:string){clearTimeout(this.deadlines.get(name));this.deadlines.delete(name);}
  private clearTimers(){for(const name of this.deadlines.keys())this.cancel(name);}
  get running(){return this.projection?.session.status==='running';}
  get canManage(){return this.host.snapshot.role==='owner'||this.host.snapshot.role==='editor';}
  get ready(){return this.health==='ready'&&!!this.projection&&this.host.snapshot.connected;}
  get canInput(){return this.ready&&this.canManage&&this.running&&!!ownBallot(this.projection)&&!this.host.history.previewing&&!this.host.history.locked&&!this.host.history.rejoining;}
  get status(){return this.health==='connecting'?'Connecting voting…':this.health==='checking'?'Checking vote…':this.health==='disconnected'?'Voting disconnected. Reconnecting…':'';}
  get uncertain(){return this.health!=='ready';}
  setDraft(question:string,budget=this.budget){this.question=question;this.budget=budget;this.emit();}
  expand(){if(!this.ready||!this.canManage||this.host.history.previewing)return;this.setup=true;this.emit();}
  cancelSetup(){this.setup=false;this.emit();}
  choose(id:string){this.selected=id;this.emit();}
  toggleMode(){if(!this.canInput)return;if(!this.mode)this.onEnter?.();this.mode=!this.mode;this.hover='';this.press=undefined;this.emit();}
  exit(){if(this.health!=='ready')return;this.mode=false;this.hover='';this.press=undefined;this.emit();}
  preview(){if(this.host.history.previewing){this.mode=false;this.hover='';this.press=undefined;this.emit();}}
  confirm(action:'reveal'|'clear'){if(!this.ready||!this.canManage||this.projection?.session.status!==(action==='reveal'?'running':'revealed'))return;const s=this.projection!.session;this.confirmation={sessionId:s.sessionId,sessionVersion:s.sessionVersion,action};this.emit();}
  cancelConfirm(){this.confirmation=null;this.emit();}
  confirmCommand(){const c=this.confirmation,s=this.projection?.session;if(!c||!s||c.sessionId!==s.sessionId||c.sessionVersion!==s.sessionVersion){this.cancelConfirm();return;}this.command({action:c.action});}
  start(){if(!this.host.history.previewing&&this.projection?.session.status==='idle'&&validQuestion(this.question)&&validBudget(this.budget))this.command({action:'start',prompt:this.question,budget:this.budget});}
  toggleTarget(o?:ItemV10,remove?:boolean){
    const own=ownBallot(this.projection);if(!this.canInput||!o||!own||!eligibleVote(o)||!this.projection!.session.targets.some(t=>targetMatches(t,o)))return;
    const voted=own.targets.some(t=>targetMatches(t,o));if(remove===true&&!voted||remove===false&&(voted||!own.remaining))return;
    this.command({action:remove===undefined?voted?'unvote':'vote':remove?'unvote':'vote',objectId:o.id,objectGeneration:o.generation,expectedBallotVersion:own.ballotVersion});
  }
  private command(input:CommandInput){
    if(!this.ready||!this.canManage||this.pending)return;
    const s=this.projection!.session,id=crypto.randomUUID();this.pending={id,at:this.now(),sequence:++this.sequence};this.health='checking';this.error='';this.confirmation=null;
    this.at('mutation',2000,()=>{if(this.pending?.id===id)this.sample();});this.emit();
    if(!this.host.sendVote({...input,requestId:id,sessionId:s.sessionId,expectedSessionVersion:s.sessionVersion} as Omit<VoteCommand,'kind'|'epoch'|'restoreGeneration'>))this.disconnect();
  }
  private sample(){
    if(this.disposed||this.read||!this.host.snapshot.connected)return;
    const id=crypto.randomUUID();this.read={id,at:this.now(),sequence:++this.sequence};this.at('read',2000,()=>this.disconnect());this.at('sample',15000,()=>this.sample());
    if(!this.host.readVote(id))this.disconnect();
  }
  private foreground=()=>{if(document.visibilityState==='visible')this.sample();};
  joined(projection:VoteProjection|undefined,generation:number){
    this.clearTimers();this.disposed=false;this.generation=generation;this.projection=projection;this.pending=undefined;this.read=undefined;this.confirmation=null;
    this.health=projection?'ready':'connecting';this.admitted=true;this.lastRead=this.now();this.seed();
    if(!this.canManage||!ownBallot(projection)){this.mode=false;this.setup=false;}
    if(this.loss&&projection){this.loss=false;this.speak('Voting reconnected');}
    if(typeof document!=='undefined'){document.removeEventListener('visibilitychange',this.foreground);document.addEventListener('visibilitychange',this.foreground);}
    this.sample();this.emit();
  }
  private seed(){this.speechSession=this.projection?.session.sessionVersion??-1;this.speechBallot=ownBallot(this.projection)?.ballotVersion??-1;this.speechId=this.projection?.session.sessionId??null;}
  receive(frame:VoteFrame|{kind:'vote_invalid'}|{kind:'vote_closed'}) {
    if(this.disposed)return;
    if(frame.kind==='vote_closed'){this.disconnect();return;}
    if(frame.kind==='vote_invalid'){this.sample();return;}
    if(frame.restoreGeneration!==undefined&&frame.restoreGeneration!==this.generation)return;
    if(frame.kind==='vote_refused'&&(!frame.voting||frame.reason==='vote_unavailable'||frame.reason==='vote_access_changed')){this.disconnect();return;}
    const next=frame.voting;if(!next)return;
    const old=this.projection,oldOwn=ownBallot(old),nextOwn=ownBallot(next);
    if(old&&(next.session.sessionVersion<old.session.sessionVersion||next.session.sessionVersion===old.session.sessionVersion&&next.session.sessionId===old.session.sessionId&&oldOwn&&nextOwn&&nextOwn.ballotVersion<oldOwn.ballotVersion))return;
    this.projection=next;
    if(this.confirmation&&(this.confirmation.sessionId!==next.session.sessionId||this.confirmation.sessionVersion!==next.session.sessionVersion))this.confirmation=null;
    if(!this.running||!this.canManage||!nextOwn){this.mode=false;this.hover='';this.press=undefined;}
    if(next.session.status!=='idle')this.setup=false;
    if((frame.kind==='vote_state'||frame.kind==='vote_result')&&!this.loss){
      if(next.session.sessionVersion>this.speechSession){
        this.speak(frame.cause==='start'?'Voting started. Open Timer and voting to participate.':frame.cause==='reveal'?'Voting ended. Results revealed.':frame.cause==='clear'?'Voting results cleared.':'');
        this.speechSession=next.session.sessionVersion;this.speechId=next.session.sessionId;this.speechBallot=nextOwn?.ballotVersion??-1;
      }else if(next.session.sessionId===this.speechId&&nextOwn&&nextOwn.ballotVersion>this.speechBallot){this.speechBallot=nextOwn.ballotVersion;if(frame.cause==='vote'||frame.cause==='unvote')this.speakOwn(remainingWords(next));}
    }
    if(frame.kind==='vote_snapshot'&&this.read?.id===frame.requestId){
      const sent=this.read.sequence;this.read=undefined;this.cancel('read');this.lastRead=this.now();this.at('health',30000,()=>this.disconnect());
      if(!this.pending||sent>this.pending.sequence)this.pending=undefined;
      if(this.loss){this.loss=false;this.speak('Voting reconnected');this.seed();}this.health=this.pending?'checking':'ready';
    }else if((frame.kind==='vote_result'||frame.kind==='vote_refused')&&this.pending?.id===frame.requestId){
      this.pending=undefined;this.health='ready';
      if(frame.kind==='vote_refused'){this.error=frame.reason==='vote_voter_limit'?'This voting round has reached its participant limit.':frame.reason==='vote_budget_spent'?'No votes remaining':'Voting could not be updated. Try again.';this.speak(this.error);}
    }
    if(frame.kind==='vote_snapshot'||frame.kind==='vote_refused')this.seed();
    if(!this.pending)this.cancel('mutation');
    if(this.now()-this.lastRead>=30000)this.disconnect();else this.emit();
    this.host.votingChanged(old?.session.status!==next.session.status);
  }
  accessChanged(){this.clear();this.disposed=false;this.admitted=true;this.loss=true;this.health='disconnected';this.emit();}
  disconnect(){if(this.disposed)return;this.clearTimers();this.health=this.admitted?'disconnected':'connecting';this.pending=undefined;this.read=undefined;this.confirmation=null;this.press=undefined;if(this.admitted&&!this.loss){this.loss=true;this.speak('Voting disconnected. Reconnecting…');}if(this.host.snapshot.connected)this.at('sample',15000,()=>this.sample());this.emit();}
  key(e:{key:string;repeat?:boolean;altKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;shiftKey?:boolean;nativeEvent:{isComposing?:boolean};preventDefault():void;stopPropagation():void},selected:Iterable<string>){
    if(!this.mode)return false;
    if(e.key==='Escape'&&!e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();this.exit();return true;}
    if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(voteKey({...e,isComposing:e.nativeEvent.isComposing})){const ids=[...selected];const id=ids.length===1?ids[0]:undefined;this.toggleTarget(this.host.snapshot.board?.objects.find(o=>o.id===id));}return true;}
    return e.key!==' ';
  }
  pointerDown(e:{clientX:number;clientY:number;pointerId:number;isPrimary:boolean;altKey:boolean;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean},o?:ItemV10){
    if(!this.mode)return false;this.press=undefined;
    if(this.canInput&&e.isPrimary&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&o)this.press={id:o.id,x:e.clientX,y:e.clientY,pointer:e.pointerId};return true;
  }
  pointerMove(e:{clientX:number;clientY:number},o?:ItemV10){if(!this.mode)return false;if(this.press&&Math.hypot(e.clientX-this.press.x,e.clientY-this.press.y)>=3)this.press=undefined;const id=o?.id??'';if(id!==this.hover){this.hover=id;this.emit();}return true;}
  pointerUp(e:{clientX:number;clientY:number;pointerId:number},o?:ItemV10){if(!this.mode)return false;const p=this.press;this.press=undefined;if(p&&p.pointer===e.pointerId&&p.id===o?.id&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<3)this.toggleTarget(o);return true;}
  cancelPointer(){this.press=undefined;this.hover='';this.emit();}
  clear(){this.disposed=true;this.clearTimers();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.foreground);this.projection=undefined;this.health='connecting';this.mode=false;this.setup=false;this.question='';this.budget=3;this.selected='';this.hover='';this.confirmation=null;this.announcement='';this.error='';this.onEnter=undefined;this.onNavigate=undefined;this.sequence=0;this.pending=undefined;this.read=undefined;this.loss=false;this.admitted=false;this.press=undefined;this.seed();this.emit();}
}
