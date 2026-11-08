// SPDX-License-Identifier: Apache-2.0
import type { HostedBoard, TimerSnapshot, TimerAction, TimerFrame } from './hosted-board';
import { defaultDraft, draftMs, padDraft, shiftDraft, timeParts, remainingMs, sampleAnchor, serverTime, transitionSpeech,
  type TimerAnchor, type TimerDraft, type SpeechWatermark, MAX_TIME } from './timer-rules.ts';
type Health='connecting'|'ready'|'checking'|'disconnected';
type Deadline='mutation'|'read'|'sample'|'health'|'zero';
export class BoardTimer {
  open=false; draft=defaultDraft(); snapshot?:TimerSnapshot; health:Health='connecting';
  generation=0; announcement=''; announcementId=0; shake=0; confirmation:{timerId:string|null;version:number}|null=null;
  private anchor?:TimerAnchor; private frozen='--:--';private lastDisplay='--:--'; private frozenTitle='NextPhase Board';
  private pending?:{id:string;at:number;readback?:boolean}; private read?:{id:string;sent:number};
  private lastSample=-Infinity;private lastSampleSent=-Infinity;
  private loss=false;private everJoined=false;private disposed=false;private zeroVersion=-1;private zeroRead=-1;
  private speech:SpeechWatermark={baseline:-1,version:-1,cause:null};
  private interval?:ReturnType<typeof setInterval>;private listeners=new Set<()=>void>();
  private deadlines=new Map<Deadline,ReturnType<typeof setTimeout>>();
  private host:HostedBoard; private monotonic:()=>number;
  constructor(host:HostedBoard,monotonic:()=>number=()=>performance.now()) { this.host=host;this.monotonic=monotonic; }
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  private speak(text:string){if(text){this.announcement=text;this.announcementId++;}}
  private emit(){if(typeof document!=='undefined')document.title=this.title;for(const listener of this.listeners)listener();}
  private cancelDeadline(name:Deadline){clearTimeout(this.deadlines.get(name));this.deadlines.delete(name);}
  private at(name:Deadline,time:number,run:()=>void){
    this.cancelDeadline(name);
    const timer=setTimeout(()=>{if(this.deadlines.get(name)!==timer)return;this.deadlines.delete(name);if(!this.disposed)run();},Math.max(0,time-this.monotonic()));
    this.deadlines.set(name,timer);
  }
  private clearDeadlines(){for(const name of this.deadlines.keys())this.cancelDeadline(name);}
  private scheduleZero(){
    this.cancelDeadline('zero');
    if(this.health!=='ready'||this.snapshot?.status!=='running'||!this.anchor)return;
    const end=this.anchor.midpoint+this.snapshot.endsAtServerMs!-this.anchor.serverMs;
    if(this.monotonic()<end)this.at('zero',end,()=>{this.tick();this.scheduleZero();});
    else if(this.zeroRead!==this.snapshot.version)this.at('zero',end+2500,()=>{this.zeroRead=this.snapshot!.version;this.sample();});
  }
  get now(){return this.anchor?serverTime(this.anchor,this.monotonic()):0;}
  get remaining(){return this.snapshot?remainingMs(this.snapshot,this.now):0;}
  get zero(){return this.snapshot?.status==='running'&&this.remaining===0;}
  get active(){return this.health!=='ready'||this.snapshot?.status!=='idle';}
  get editable(){return this.health==='ready'&&this.snapshot?.status==='idle';}
  get canMutate(){return this.health==='ready'&&!!this.snapshot;}
  get canAdd(){return this.canMutate&&(this.editable||!this.zero&&this.remaining<MAX_TIME);}
  get display(){
    if(this.health!=='ready')return this.frozen;
    if(!this.snapshot)return '--:--';
    if(this.snapshot.status==='idle')return `${this.draft.minutes}:${this.draft.seconds}`;
    const parts=timeParts(this.remaining);return `${parts.minutes}:${parts.seconds}`;
  }
  get state(){return this.health==='connecting'?'Connecting timer':this.health==='checking'?'checking':this.health==='disconnected'?'disconnected':this.zero?'finished':this.snapshot?.status??'Connecting timer';}
  get status(){return this.health==='connecting'?'Connecting timer…':this.health==='checking'?'Checking timer…':this.health==='disconnected'?'Timer disconnected. Reconnecting…':this.zero?'Timer finished':this.snapshot?.status==='paused'?'Paused':'';}
  get title(){if(this.health==='checking')return this.frozenTitle;return this.health==='disconnected'||this.health==='connecting'||!this.active?'NextPhase Board':`${this.display} – NextPhase Board`;}
  setDraft(field:keyof TimerDraft,value:string){if(!this.editable)return;this.draft={...this.draft,[field]:value};this.emit();}
  blur(){this.draft=padDraft(this.draft);this.emit();}
  shift(delta:number){if(!this.editable)return;this.draft=shiftDraft(this.draft,delta);this.emit();}
  add(){if(!this.canAdd)return;if(this.editable)this.shift(60000);else this.command('extend');}
  show(){this.host.hideTimerPeers();this.open=true;this.confirmation=null;this.emit();}
  hide(){this.open=false;this.confirmation=null;this.emit();}
  confirm(){if(!this.canMutate||this.editable)return;this.confirmation={timerId:this.snapshot!.timerId,version:this.snapshot!.version};this.emit();}
  cancel(){this.confirmation=null;this.emit();}
  stop(){if(!this.confirmation||!this.snapshot||this.confirmation.timerId!==this.snapshot.timerId||this.confirmation.version!==this.snapshot.version){this.cancel();return;}this.command('end');}
  command(action:TimerAction){
    if(!this.canMutate||this.pending)return;
    const duration=draftMs(this.draft);if(action==='start'&&(!duration||!this.editable))return;
    const id=crypto.randomUUID();this.frozenTitle=this.title;this.frozen=this.display;this.pending={id,at:this.monotonic()};this.health='checking';this.confirmation=null;
    this.cancelDeadline('zero');
    this.at('mutation',this.pending.at+2000,()=>{if(this.pending?.id===id){this.pending.readback=true;this.sample();}});
    this.emit();if(!this.host.sendTimer(id,action,this.snapshot!,duration??undefined))this.disconnect();
  }
  private sample(){
    if(this.disposed||this.read||!this.host.snapshot.connected)return;
    const id=crypto.randomUUID();this.read={id,sent:this.monotonic()};
    this.at('read',this.read.sent+2000,()=>{if(this.read?.id===id)this.disconnect();});
    this.at('sample',this.read.sent+15000,()=>this.sample());
    if(!this.host.readTimer(id)){this.read=undefined;this.disconnect();}
  }
  private foreground=()=>{if(document.visibilityState==='visible'){if(this.zero)this.zeroVersion=this.snapshot?.version??-1;this.sample();}};
  joined(snapshot:TimerSnapshot|undefined,generation:number){
    this.clearDeadlines();this.lastSample=-Infinity;this.lastSampleSent=-Infinity;
    this.disposed=false;this.snapshot=snapshot;this.generation=generation;this.pending=undefined;this.read=undefined;this.anchor=undefined;
    this.confirmation=null;this.health=this.loss?'disconnected':'connecting';this.zeroVersion=-1;
    this.speech={baseline:snapshot?.version??-1,version:snapshot?.version??-1,cause:null};
    if(!this.interval){this.interval=setInterval(()=>this.tick(),1000);document.addEventListener('visibilitychange',this.foreground);}
    this.everJoined=true;this.sample();this.emit();
  }
  receive(frame:TimerFrame|{kind:'timer_invalid'}|{kind:'timer_closed'}){
    if(this.disposed)return;
    if(frame.kind==='timer_closed'){this.disconnect();return;}
    if(frame.kind==='timer_invalid'){this.sample();return;}
    if(frame.restoreGeneration!==undefined&&frame.restoreGeneration!==this.generation)return;
    if(frame.kind==='timer_refused'&&(!frame.timer||frame.reason==='timer_unavailable'||frame.reason==='timer_access_changed')){this.disconnect();return;}
    const snapshot=frame.timer;if(!snapshot)return;
    if(this.snapshot&&snapshot.version<this.snapshot.version)return;
    const was=this.snapshot;
    this.snapshot=snapshot;
    if(this.confirmation&&(this.confirmation.version!==snapshot.version||this.confirmation.timerId!==snapshot.timerId))this.confirmation=null;
    if((frame.kind==='timer_state'||frame.kind==='timer_result')&&!this.loss){
      const speech=transitionSpeech(this.speech,snapshot.version,frame.cause);
      if(speech.conflict){this.sample();return;}
      this.speech=speech.mark;this.speak(speech.text);
      if(frame.cause==='start')this.zeroVersion=-1;
    }
    if(frame.kind==='timer_sample'&&this.read?.id===frame.requestId){
      const {sent}=this.read;this.read=undefined;this.cancelDeadline('read');
      if(sent>=this.lastSampleSent){
        const anchor=sampleAnchor(frame.serverNowMs,sent,this.monotonic());
        if(anchor){const freshClock=!this.anchor||this.loss;this.anchor=anchor;
          if(freshClock&&snapshot.status==='running'&&serverTime(anchor,anchor.received)>=snapshot.endsAtServerMs!)this.zeroVersion=snapshot.version;this.lastSample=anchor.received;this.lastSampleSent=sent;
          this.at('health',this.lastSample+30000,()=>this.disconnect());
          if(!this.pending||sent>=this.pending.at)this.pending=undefined;
          if(this.loss){this.speak('Timer reconnected');this.loss=false;this.speech={baseline:snapshot.version,version:snapshot.version,cause:null};}
          this.health=this.pending?'checking':'ready';
          if(this.pending?.readback&&sent<this.pending.at)this.sample();}
      }
    }else if((frame.kind==='timer_result'||frame.kind==='timer_refused')&&this.pending?.id===frame.requestId){this.pending=undefined;if(this.anchor)this.health='ready';else this.sample();}
    if(!this.pending)this.cancelDeadline('mutation');
    if(was?.timerId!==snapshot.timerId)this.zeroRead=-1;
    this.tick();this.scheduleZero();this.emit();
  }
  disconnect(){
    if(this.disposed)return;
    if(this.health==='ready')this.frozen=this.display;
    this.health=this.everJoined?'disconnected':'connecting';this.pending=undefined;this.read=undefined;this.confirmation=null;
    for(const name of ['mutation','read','health','zero'] as const)this.cancelDeadline(name);
    if(this.everJoined&&!this.loss){this.loss=true;this.speak('Timer disconnected. Reconnecting…');}
    this.emit();
  }
  private tick(){
    if(this.health==='ready'&&this.zero&&this.zeroVersion!==this.snapshot!.version){
      this.zeroVersion=this.snapshot!.version;
      if(document.visibilityState==='visible'&&this.now-this.snapshot!.endsAtServerMs!<300)this.shake++;
    }
    const display=this.display;if(display!==this.lastDisplay){this.lastDisplay=display;this.emit();}
    document.title=this.title;
  }
  clear(){
    this.disposed=true;this.clearDeadlines();clearInterval(this.interval);this.interval=undefined;if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.foreground);
    this.open=false;this.draft=defaultDraft();this.snapshot=undefined;this.anchor=undefined;this.pending=undefined;this.read=undefined;this.confirmation=null;
    this.frozen='--:--';this.health='connecting';this.announcement='';this.loss=false;this.everJoined=false;this.lastSample=-Infinity;this.lastSampleSent=-Infinity;
    this.speech={baseline:-1,version:-1,cause:null};if(typeof document!=='undefined')document.title='NextPhase Board';this.emit();
  }
}
