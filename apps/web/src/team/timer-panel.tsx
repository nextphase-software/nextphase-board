// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { workshopPanel } from './workshop-panel';
import { VotingCard } from './voting-card';
import type { BoardVoting } from './voting';
import type { ItemV10 } from 'nextphase-board-rules/document.ts';
import type { BoardTimer } from './timer';
import { draftMs } from './timer-rules';
function Glyph({name}:{name:'timer'|'play'|'pause'|'stop'|'close'}) {
  return <svg aria-hidden="true" width={name==='close'?24:16} height={name==='close'?24:16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {name==='timer'?<><circle cx="10" cy="11" r="6"/><path d="M8 2h4m-2 0v3m0 3v4l2 1"/></>:name==='play'?<path d="M7 4L15 10L7 16Z" fill="currentColor" stroke="none"/>:name==='pause'?<path d="M7 4v12m6-12v12"/>:name==='stop'?<rect x="5" y="5" width="10" height="10" rx="1" fill="currentColor" stroke="none"/>:<path d="M5 5L15 15M15 5L5 15"/>}
  </svg>;
}
const focusKey=(node:HTMLElement)=>node.getAttribute('data-timer')??node.getAttribute('aria-label');
export function TimerControl({timer,voting,objects=[],preview=false}:{timer:BoardTimer;voting?:BoardVoting;objects?:ItemV10[];preview?:boolean}) {
  const [,redraw]=useState(0),[top,setTop]=useState(72);
  const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),wasOpen=useRef(false);
  const focused=useRef<{node:HTMLElement;key:string|null}|null>(null),lastMode=useRef('');
  useEffect(()=>timer.subscribe(()=>redraw(v=>v+1)),[timer]);
  useEffect(()=>voting?.subscribe(()=>redraw(v=>v+1)),[voting]);
  useLayoutEffect(()=>{
    const bar=trigger.current?.closest('.actions');if(!bar)return;
    const measure=()=>setTop(bar.getBoundingClientRect().bottom+12);measure();
    const observer=new ResizeObserver(measure);observer.observe(bar);window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[timer.open,timer.active]);
  useLayoutEffect(()=>{
    const button=trigger.current;if(!button||!timer.shake)return;
    button.classList.remove('w1-shake');void button.offsetWidth;button.classList.add('w1-shake');
  },[timer.shake]);
  const mode=timer.confirmation?'confirmation':timer.health!=='ready'?'uncertain':timer.editable?'idle':timer.zero?'zero':timer.snapshot?.status;
  useLayoutEffect(()=>{
    const node=panel.current;
    if(!timer.open){wasOpen.current=false;focused.current=null;lastMode.current='';return;}
    if(!node)return;
    const selector=mode==='confirmation'?'[data-timer="cancel"]':mode==='idle'?'[aria-label="Minutes"]':mode==='zero'?'[aria-label="End timer"]':mode==='uncertain'?'[data-timer="heading"]':'[data-timer="toggle"]';
    const opening=!wasOpen.current,inside=!!focused.current&&(node.contains(document.activeElement)||document.activeElement===document.body);
    if(opening||mode==='confirmation'&&lastMode.current!=='confirmation')node.querySelector<HTMLElement>(selector)?.focus();
    // React can reuse Cancel's DOM button as +1. Preserve the control's meaning,
    // not just its connected/enabled DOM node, across a remote card change.
    else if(inside && (!focused.current!.node.isConnected || (focused.current!.node as HTMLButtonElement).disabled || focusKey(focused.current!.node)!==focused.current!.key || focused.current!.node.tabIndex<0&&focused.current!.node.tagName==='INPUT'))node.querySelector<HTMLElement>('[data-timer="heading"]')?.focus();
    wasOpen.current=true;lastMode.current=mode??'';
  });
  const close=()=>{timer.hide();trigger.current?.focus();};
  const cancel=()=>{timer.cancel();requestAnimationFrame(()=>panel.current?.querySelector<HTMLElement>('[aria-label="End timer"]')?.focus());};
  const uncertain=timer.health!=='ready',parts=timer.display.split(':'),idle=timer.editable;
  const paused=timer.snapshot?.status==='paused';
  const fields=idle?timer.draft:{minutes:parts[0]??'--',seconds:parts[1]??'--'};
  const action=(name:string,glyph:'play'|'pause'|'stop',run:()=>void,disabled=false,primary=false)=><button type="button" className={'w1-hit'+(primary?' primary':'')} aria-label={name} data-timer={name==='Pause timer'||name==='Resume timer'?'toggle':undefined} disabled={disabled} onClick={run}><span className="w1-disc"><Glyph name={glyph}/></span></button>;
  return <>
    <button ref={trigger} type="button" className={'w1-trigger'+(timer.active?' active':'')+(paused?' paused':'')+(uncertain?' uncertain':'')} aria-label={(timer.state==='Connecting timer'?'Timer and voting, Connecting timer':`Timer and voting, ${timer.state}, ${timer.display}`)+(voting?.running?', Voting in progress':'')} aria-haspopup="dialog" aria-expanded={timer.open} aria-controls="w1-panel" onClick={()=>timer.open?close():timer.show()}>
      {!timer.active&&<Glyph name="timer"/>}<span>{timer.display}</span>
    </button>
    {timer.open&&workshopPanel({panel,top,className:'w1-panel'+(paused?' paused':'')+(uncertain?' uncertain':''),
      onFocusCapture:e=>{const node=e.target as HTMLElement;focused.current=node.closest('.vote-card')?null:{node,key:focusKey(node)};},
      onBlurCapture:e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget as Node))focused.current=null;},
      onKeyDown:e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();if(timer.confirmation)cancel();else close();}},
      timer:<>
      {timer.confirmation?<><h3>Stop the timer?</h3><p className="w1-confirm-copy">This stops the timer for everyone, not just you.</p><div className="w1-confirm-row"><button data-timer="cancel" onClick={cancel}>Cancel</button><button data-timer="stop" className="primary" onClick={()=>timer.stop()}>Stop timer</button></div></>:<>
        <div className="w1-fields">{(['minutes','seconds'] as const).map((field,index)=><span key={field} className="w1-field-slot">{index===1&&<span className="w1-colon" aria-hidden="true">:</span>}<label>{field==='minutes'?'Minutes':'Seconds'}<input aria-label={field==='minutes'?'Minutes':'Seconds'} type="text" inputMode="numeric" value={fields[field]} readOnly={!idle} tabIndex={idle?0:-1} onChange={e=>timer.setDraft(field,e.target.value)} onBlur={()=>{if(idle)timer.blur();}} onKeyDown={e=>{
          if(!idle||e.nativeEvent.isComposing)return;
          if(e.key==='Enter'){e.preventDefault();timer.command('start');}
          if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();timer.shift((e.key==='ArrowUp'?1:-1)*(e.shiftKey?300000:60000));}
        }}/></label></span>)}</div>
        {timer.status&&<p className="w1-status">{timer.status}</p>}
        <div className="w1-row"><button data-timer="add" className="w1-add" disabled={!timer.canAdd} onClick={()=>timer.add()}><span>+ 1 min</span></button>
          {idle?action('Start timer','play',()=>timer.command('start'),!draftMs(timer.draft),true):<>{action('End timer','stop',()=>timer.confirm(),!timer.canMutate)}{action(paused?'Resume timer':'Pause timer',paused?'play':'pause',()=>timer.command(paused?'resume':'pause'),!timer.canMutate||timer.zero,true)}</>}
        </div>
      </>}
      </>,voting:voting?<VotingCard voting={voting} objects={objects} preview={preview}/>:undefined,
      close:<button className="w1-close" aria-label="Close Timer and voting" onClick={close}><Glyph name="close"/></button>
    })}
    <span className="sr-only" data-workshop-status="timer" role="status" aria-live="polite" aria-atomic="true"><span key={timer.announcementId}>{timer.announcement}</span></span>
    {voting&&<span className="sr-only" data-workshop-status="voting" role="status" aria-live="polite" aria-atomic="true"><span key={voting.announcementId}>{voting.announcement}</span></span>}
  </>;
}
