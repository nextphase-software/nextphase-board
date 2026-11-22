// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { HostedBoard } from './hosted-board';
import { spotlightGeometry, spotlightStatus } from './spotlight-rules';
export function SpotlightLayer({hosted}:{hosted:HostedBoard}){
  const s=hosted.spotlight;
  useSyncExternalStore(s.subscribe,s.getSnapshot);
  const manual=hosted.presence.others.find(p=>p.connection===hosted.presence.followed);
  const shown=!hosted.voting.running&&(s.visible||!!manual);
  const banner=useRef<HTMLDivElement>(null);
  const [geometry,setGeometry]=useState(()=>spotlightGeometry(innerWidth,innerHeight,[],[]));
  const wasFocused=useRef(false);
  useLayoutEffect(()=>{
    const measure=()=>{
      const visible=(selector:string)=>[...document.querySelectorAll<HTMLElement>(selector)].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');
      const bottoms=visible('.file, .actions, .context, .context-bar, .team-banner, .team-notice-column').map(n=>n.getBoundingClientRect().bottom);
      const rects=visible('.presence-menu, .w1-panel, .history-shell, .comment-panel, .team-share, .team-dialog').map(n=>n.getBoundingClientRect());
      const next=spotlightGeometry(innerWidth,innerHeight,bottoms,rects);
      setGeometry(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
    };
    measure();const resize=new ResizeObserver(measure);
    for(const n of document.querySelectorAll('.file, .actions, .context, .context-bar, .team-banner, .team-notice-column, .presence-menu, .w1-panel, .history-shell, .comment-panel, .team-dialog'))resize.observe(n);
    const observer=new MutationObserver(records=>{if(records.some(r=>!(r.target instanceof Element&&r.target.closest('.spotlight-banner'))))measure();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style']});
    window.addEventListener('resize',measure);
    return()=>{resize.disconnect();observer.disconnect();window.removeEventListener('resize',measure);};
  },[shown,hosted.surface]);
  useEffect(()=>{
    let gesture=false,composing=false;
    const editor=()=>document.activeElement instanceof Element&&!!document.activeElement.closest('input,textarea,select,[contenteditable=true],.inline');
    const safety=()=>s.safetyChanged({visible:document.visibilityState==='visible',editing:editor(),composing,gesture,preview:hosted.history.previewing});
    const down=(e:PointerEvent)=>{if(hosted.reactions.ownsEvent(e))return;if(e.target instanceof Element&&e.target.closest('.scene,.inline,.palette,.context')){s.localAction();gesture=true;safety();}};
    const up=()=>{gesture=false;safety();};
    const start=()=>{composing=true;safety();};const end=()=>{composing=false;safety();};
    const key=(e:KeyboardEvent)=>{
      if (e.target instanceof Element && e.target.closest(".export-dialog")) return;
      if (e.target instanceof Element && e.target.closest('.find-bar')) return;
      if(hosted.reactions.ownsEvent(e))return;
      if(e.isComposing||e.target instanceof Element&&e.target.closest('.team-dialog,[role=menu],[role=dialog],input,textarea,select,[contenteditable=true],.inline,.context'))return;
      if(e.key==='Escape'&&s.visible){e.preventDefault();e.stopPropagation();s.escape();}
      else if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.length===1)s.localAction();
    };
    document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
    document.addEventListener('compositionstart',start,true);document.addEventListener('compositionend',end,true);
    document.addEventListener('focusin',safety);document.addEventListener('focusout',safety);document.addEventListener('visibilitychange',safety);document.addEventListener('keydown',key,true);safety();
    return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);document.removeEventListener('compositionstart',start,true);document.removeEventListener('compositionend',end,true);document.removeEventListener('focusin',safety);document.removeEventListener('focusout',safety);document.removeEventListener('visibilitychange',safety);document.removeEventListener('keydown',key,true);};
  },[hosted]);
  useLayoutEffect(()=>{
    if(wasFocused.current&&(!shown||!banner.current?.contains(document.activeElement))&&(document.activeElement===document.body||!document.activeElement?.isConnected))document.querySelector<HTMLButtonElement>('.presence-avatar[title$=" (you)"]')?.focus();
    wasFocused.current=!!banner.current?.contains(document.activeElement);
  });
  const p=s.projection,colour=(s.visible?s.target?.colour:manual?.colour)??'#7051cf';
  const status=manual&&!s.visible?`Following ${manual.label}`:spotlightStatus(p,s.mode,s.target?.label??'',s.seconds);
  const leave=()=>manual&&!s.visible?hosted.stopFollowing():s.leave();
  const pending=s.mode==='pending';
  return <>
    {(s.frame||!!manual&&!s.visible)&&!hosted.voting.running&&<div className="presence-frame spotlight-frame" aria-hidden="true" style={{borderColor:colour}}/>}
    {shown&&<div ref={banner} className="presence-follow-banner spotlight-banner" role="group" aria-label={manual&&!s.visible?"Following":"Spotlight"} style={{...geometry,'--spotlight-colour':colour} as CSSProperties}
      onFocusCapture={()=>{wasFocused.current=true;}}>
      <span className="spotlight-status">{status}</span><div className="spotlight-actions">
        {manual&&!s.visible?<button onClick={leave}>Stop following</button>:s.mode==='uncertain'||pending?<>{s.following&&<button onClick={s.leave}>Stop following</button>}<button className="spotlight-dismiss" aria-label="Dismiss spotlight offer" onClick={s.dismiss}>×</button></>:s.presenting?<button disabled={pending} onClick={()=>s.command('stop')}>{p?.presenting?.hasHadFollower?'Stop':'Cancel'}</button>:<>
          {s.following?<button onClick={leave}>Stop following</button>:s.mode==='uncertain'||pending?null:<button className="spotlight-primary" disabled={!!s.disabledReason||!s.canFollow} onPointerDown={e=>e.preventDefault()} onClick={()=>s.command('follow')}>Follow</button>}
          {!s.following&&['offer','deferred'].includes(s.mode)?<button onClick={s.decline}>Not now</button>:!s.following||s.mode==='uncertain'?<button className="spotlight-dismiss" aria-label="Dismiss spotlight offer" onClick={s.dismiss}>×</button>:null}
        </>}
      </div>
    </div>}
    <span className="sr-only" data-workshop-status="spotlight" role="status" aria-live="polite" aria-atomic="true">{s.speech}</span>
  </>;
}
