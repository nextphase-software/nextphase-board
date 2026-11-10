// SPDX-License-Identifier: Apache-2.0
import type { HostedBoard, SpotlightAction, SpotlightCommand, SpotlightFrame, SpotlightProjection } from './hosted-board';
import { acceptSpotlight, safeOffer, type Safety } from './spotlight-rules.ts';
export class BoardSpotlight {
  projection?:SpotlightProjection;
  mode='connecting';
  seconds=3;
  speech='';
  private revision=0;
  private listeners=new Set<()=>void>();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.revision;
  private changed(){this.revision++;for(const listener of this.listeners)listener();this.host.spotlightChanged();}
  private capability?:string;
  private pending?:{id:string;action:SpotlightAction};
  private timer?:ReturnType<typeof setTimeout>;
  private deadline?:number;
  private fresh=false;
  private suppressed=false;
  private intent:'new'|'declined'|'left'|'dismissed'='new';
  private safety:Safety={visible:true,editing:false,composing:false,gesture:false,preview:false};
  private announced='';
  private health?:ReturnType<typeof setInterval>;
  private sampleAt=0;
  private reading?:string;
  private readAt=0;
  private resumeReady=false;
  private host:HostedBoard;
  constructor(host:HostedBoard){this.host=host;}
  get presenting(){return !!this.projection?.presenting;}
  get following(){return !!this.projection?.own.following&&!this.suppressed;}
  get target(){return this.projection?.session.presenter;}
  get motion(){return this.following&&this.mode!=='uncertain'&&this.mode!=='pending'&&this.projection?.session.phase==='active'&&safeOffer(this.safety,this.fresh);}
  get frame(){return (this.presenting||this.motion)&&this.mode!=='uncertain'&&this.projection?.session.phase==='active';}
  get visible(){return this.intent!=='dismissed'&&(this.mode==='uncertain'||this.mode==='pending'||this.mode==='connecting'&&this.host.snapshot.connected||!!this.projection&&this.projection.session.phase!=='idle'&&(this.presenting||this.target?.person!==this.host.presence.self?.person));}
  get canFollow(){return this.fresh&&!this.safety.composing&&!this.safety.gesture&&!this.safety.preview;}
  get disabledReason(){return this.host.voting.running?'Spotlight is unavailable while voting':this.host.history.previewing?'Back to current board to present':!this.host.snapshot.connected||this.mode==='uncertain'?'Spotlight disconnected. Reconnecting…':this.mode==='pending'?'Checking spotlight…':this.mode==='connecting'?'Connecting spotlight…':'';}
  get followReason(){return this.disabledReason||(this.presenting?'Stop presenting to follow someone':'');}
  private say(text:string,stamp:string){if(stamp!==this.announced){this.announced=stamp;this.speech=text;}}
  joined(p:SpotlightProjection|undefined){
    clearTimeout(this.timer);this.pending=undefined;this.deadline=undefined;this.intent='new';this.suppressed=false;this.resumeReady=false;
    const previous=this.projection;this.projection=p;this.mode=p?'ready':'connecting';
    this.fresh=!!p?.session.presenter&&this.host.presence.others.some(x=>x.connection===p.session.presenter?.connection);
    if(!p||p.session.phase==='idle'||previous?.session.sessionId!==p.session.sessionId)this.capability=undefined;
    this.sampleAt=Date.now();this.reading=undefined;clearInterval(this.health);
    this.health=setInterval(()=>{if(!this.safety.visible)return;if(Date.now()-this.sampleAt>=30000)this.uncertain();if(!this.reading&&Date.now()-this.readAt>=15000)this.read();},1000);
    this.read();this.offer();this.changed();
  }
  private read(){if(this.reading||!this.host.snapshot.connected)return;this.reading=crypto.randomUUID();this.readAt=Date.now();if(!this.host.readSpotlight(this.reading))this.reading=undefined;}
  localPresenceSent(){this.resumeReady=true;const p=this.projection;if(this.capability&&p?.session.phase==='reconnecting'&&!this.pending)this.command('resume');}
  presence(connection:string){if(connection===this.target?.connection&&this.projection?.session.phase==='active'){this.fresh=true;this.offer();this.changed();}}
  receive(event:SpotlightFrame|{kind:'spotlight_closed'|'spotlight_invalid';recover?:boolean}){
    if(event.kind==='spotlight_closed'){this.disconnect(event.recover!==false);return;}
    if(event.kind==='spotlight_invalid'){this.uncertain();return;}
    const old=this.projection,p='spotlight'in event?event.spotlight:undefined;
    if(p&&!acceptSpotlight(old,p))return;
    if(p){
      this.sampleAt=Date.now();
      if(event.kind==='spotlight_snapshot'||event.kind==='spotlight_refused')this.reading=undefined;
      const replacement=old?.session.sessionId!==p.session.sessionId;
      if(replacement){this.intent='new';this.suppressed=false;this.fresh=false;this.deadline=undefined;this.capability=undefined;}
      if(old?.session.controlVersion!==p.session.controlVersion&&['active','reconnecting'].includes(p.session.phase)){this.fresh=false;this.deadline=undefined;}
      this.projection=p;
    }
    if(event.kind==='spotlight_result'&&event.requestId===this.pending?.id){
      const action=this.pending.action;this.pending=undefined;clearTimeout(this.timer);this.mode='ready';
      if('resumeKey'in event)this.capability=event.resumeKey;
      if(action==='follow')this.suppressed=false;
      if(action==='start'||action==='take_over'){this.host.clearManualFollow();this.intent='new';this.host.requestFreshPresence();}
      if(action==='resume')this.fresh=true;
    }else if(event.kind==='spotlight_refused'){
      if(event.requestId===this.pending?.id){this.pending=undefined;clearTimeout(this.timer);}
      this.mode=p?'ready':'uncertain';if(event.reason==='spotlight_access_changed')this.clear();
      if(event.reason==='spotlight_version_exhausted'&&p&&!p.own.following){this.intent='left';this.suppressed=true;}
    }else if(event.kind==='spotlight_snapshot'){this.mode='ready';}
    else if(event.kind==='spotlight_state'&&!this.pending){this.mode='ready';}
    const cause='cause'in event?event.cause:undefined;
    if(p&&cause&&old){
      const stamp=`${p.session.authorityId}:${p.session.controlVersion}:${cause}:${p.own.membershipVersion}`;
      if(cause==='start'||cause==='take_over')this.say('Spotlight started',stamp);
      else if(cause==='follow'&&p.own.following&&!old.own.following)this.say(`Following ${p.session.presenter?.label}`,stamp);
      else if(cause==='leave'&&!p.own.following&&old.own.following)this.say(`Stopped following ${old.session.presenter?.label}`,stamp);
      else if(cause==='reconnecting')this.say('Presenter reconnecting',stamp);
      else if(cause==='resume')this.say('Spotlight reconnected',stamp);
      else if(cause==='left'&&old.session.phase!=='idle'&&p.session.phase==='idle'){this.say('The presenter left the spotlight',stamp);this.host.toast('The presenter left the spotlight');}
      else if(p.session.phase==='idle'&&old.session.phase!=='idle')this.say('Spotlight stopped',stamp);
    }
    if(p?.session.phase==='idle'){this.capability=undefined;this.deadline=undefined;this.pending=undefined;clearTimeout(this.timer);this.mode='ready';}
    if(this.capability&&p?.session.phase==='reconnecting'&&this.resumeReady&&!this.pending)this.command('resume');
    if(p?.own.following)this.host.clearManualFollow();
    if(p?.own.following&&this.suppressed&&this.pending?.action!=='leave'){this.pending=undefined;this.command('leave');}
    this.offer();this.changed();
  }
  private offer(){
    const p=this.projection;if(!p||p.session.phase!=='active'||p.presenting||p.own.following||p.session.presenter?.person===this.host.presence.self?.person||this.intent!=='new'||this.pending||this.mode==='uncertain')return;
    if(this.fresh)this.say(`Spotlight on ${this.target?.label}. Choose Not now to stay here.`,`offer:${p.session.authorityId}:${p.session.sessionId}`);
    const safe=safeOffer(this.safety,this.fresh);
    if(!safe){this.deadline=undefined;this.mode='deferred';this.seconds=3;return;}
    this.mode='offer';this.deadline??=Date.now()+3000;
    this.seconds=Math.max(1,Math.ceil((this.deadline-Date.now())/1000));
    if(Date.now()>=this.deadline){this.command('follow');return;}
    clearTimeout(this.timer);this.timer=setTimeout(()=>{this.offer();this.changed();},100);
  }
  safetyChanged(change:Partial<Safety>){const foreground=!this.safety.visible&&change.visible===true;this.safety={...this.safety,...change};if(foreground){if(Date.now()-this.sampleAt>=30000)this.uncertain();if(this.reading&&Date.now()-this.readAt>=15000)this.reading=undefined;this.read();}this.offer();this.changed();}
  command(action:SpotlightAction){
    const p=this.projection;if(!p||this.pending||!this.host.snapshot.connected)return false;
    if(['start','take_over','follow'].includes(action)&&this.disabledReason)return false;
    if(action==='follow'&&(this.safety.composing||this.safety.gesture||this.safety.preview||!this.fresh))return false;
    if(action==='follow'&&this.safety.editing){this.mode='deferred';this.deadline=undefined;this.changed();return false;}
    const requestId=crypto.randomUUID();
    const base={requestId,action,authorityId:p.session.authorityId,sessionId:p.session.sessionId};
    const command={...base,...(action==='follow'||action==='leave'?{expectedMembershipVersion:p.own.membershipVersion}:{expectedControlVersion:p.session.controlVersion}),...(action==='resume'?{resumeKey:this.capability}:{})} as Omit<SpotlightCommand,'kind'|'epoch'|'restoreGeneration'>;
    if(action==='follow'){this.intent='new';this.suppressed=false;}
    this.pending={id:requestId,action};this.mode='pending';this.deadline=undefined;clearTimeout(this.timer);
    if(!this.host.sendSpotlight(command)){this.uncertain();return false;}
    this.timer=setTimeout(()=>this.uncertain(),2000);this.changed();return true;
  }
  leave=()=>{if(this.pending?.action==='follow'){this.pending=undefined;clearTimeout(this.timer);this.mode='ready';}this.intent='left';this.suppressed=true;this.deadline=undefined;if(this.projection?.own.following){this.pending=undefined;this.command('leave');}this.changed();};
  decline=()=>{this.intent='declined';this.deadline=undefined;clearTimeout(this.timer);this.mode='ready';this.changed();};
  dismiss=()=>{if(this.following||this.pending?.action==='follow')this.leave();this.intent='dismissed';this.changed();};
  localAction(){if(!this.presenting&&(this.following||this.mode==='offer'||this.mode==='deferred'))this.following?this.leave():this.decline();}
  workshopChanged(){this.capability=undefined;this.suppressed=true;this.deadline=undefined;this.pending=undefined;clearTimeout(this.timer);if(this.projection?.session.phase!=='idle'){this.reading=undefined;this.uncertain();}}
  preview(){if(this.host.history.previewing){if(this.presenting)this.command('stop');else this.localAction();}this.safetyChanged({preview:this.host.history.previewing});}
  escape(){if(this.pending){this.following||this.pending.action==='follow'?this.leave():this.dismiss();return;}if(this.presenting)this.command('stop');else if(this.following)this.leave();else if(this.visible)this.decline();}
  private uncertain(){clearTimeout(this.timer);this.pending=undefined;this.mode='uncertain';this.deadline=undefined;this.fresh=false;this.changed();if(this.reading&&Date.now()-this.readAt>=15000)this.reading=undefined;this.read();}
  disconnect(recover=true){clearInterval(this.health);this.reading=undefined;clearTimeout(this.timer);this.pending=undefined;this.deadline=undefined;this.resumeReady=false;this.fresh=false;if(!recover){this.clear();return;}this.mode='uncertain';this.changed();}
  clear(){clearInterval(this.health);this.reading=undefined;clearTimeout(this.timer);this.capability=undefined;this.projection=undefined;this.pending=undefined;this.deadline=undefined;this.intent='dismissed';this.mode='ready';this.fresh=false;this.suppressed=true;this.changed();}
}
