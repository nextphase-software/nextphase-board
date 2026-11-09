// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useState } from 'react';
import type { HostedBoard } from './hosted-board';
import type { ResolvedItem } from '../geometry';
import { screenPoint, type View } from '../view';
import { markerPosition, ownBallot, rankedResults, remainingWords, targetMatches, hoverWords, voteTextAnchor } from './voting-rules';
type Props={hosted:HostedBoard;objects:ResolvedItem[];view:View;size:{w:number;h:number};finishTextSession:()=>void;cancel:()=>void;setInline:(v:boolean)=>void;setTool:(v:string)=>void;select:(id:string)=>void;setView:(v:View)=>void};
export function VotingOverlay({hosted,objects,view,size,finishTextSession,cancel,setInline,setTool,select,setView}:Props) {
  const v=hosted.voting,[,redraw]=useState(0),[layout,setLayout]=useState({top:72,width:0}),[badgeWidths,setBadgeWidths]=useState<Record<string,number>>({});
  useEffect(()=>{const a=v.subscribe(()=>redraw(n=>n+1)),b=hosted.timer.subscribe(()=>redraw(n=>n+1));return()=>{a();b();};},[v,hosted]);
  useLayoutEffect(()=>{
    v.onEnter=()=>{cancel();finishTextSession();setInline(false);setTool('Select');};
    v.onNavigate=id=>{const o=objects.find(o=>o.id===id);if(!o)return;select(id);setView({x:o.x+o.width/2,y:o.y+o.displayHeight/2,z:view.z});};
    const measure=()=>{
      const context=document.querySelector('.context'),bars=[...document.querySelectorAll('.file,.actions')];
      const box=context&&context.getClientRects().length?context.getBoundingClientRect():undefined;
      const top=box?box.bottom+8:Math.max(0,...bars.map(b=>b.getBoundingClientRect().bottom))+12;
      const panel=document.querySelector('.w1-panel')?.getBoundingClientRect();
      const width=size.w<600?(panel?Math.min(size.w-24,panel.left-20):size.w-24):0;
      setLayout(old=>old.top===top&&old.width===width?old:{top,width});
      setBadgeWidths(old=>{
        const next={...old};let changed=false;
        for(const node of document.querySelectorAll<HTMLElement>('.vote-badge[data-vote-count]')){
          const key=node.dataset.voteCount!,width=node.getBoundingClientRect().width;
          if(width>0&&next[key]!==width){next[key]=width;changed=true;}
        }
        return changed?next:old;
      });
    };measure();
    const observer=new ResizeObserver(measure);for(const node of document.querySelectorAll('.file,.actions,.context,.w1-panel'))observer.observe(node);
    window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  });
  if(hosted.history.previewing||!v.projection)return null;
  const p=v.projection,own=ownBallot(p),hover=v.mode?objects.find(o=>o.id===v.hover):undefined;
  const bounds=(o:ResolvedItem)=>({...screenPoint(o,view,size),width:o.width*view.z,height:o.displayHeight*view.z});
  const marker=(o:ResolvedItem,width:number,height:number,dot:boolean)=>{
    const line=voteTextAnchor(o)?o.firstLine:undefined;
    const displayed=line?{right:screenPoint({x:line.right,y:line.centerY},view,size).left,centerY:screenPoint({x:line.right,y:line.centerY},view,size).top}:undefined;
    return markerPosition(bounds(o),displayed,width,height,dot);
  };
  const explanation=hover?hoverWords(p,hover):'';
  return <>
    {p.session.status==='running'&&own&&own.targets.map(t=>{
      const o=objects.find(o=>targetMatches(t,o));return o?<span aria-hidden="true" key={o.id} className="vote-dot" style={{...marker(o,12,12,true),background:own.colour,opacity:v.uncertain ? .45 : 1}}/>:null;
    })}
    {p.session.status==='revealed'&&rankedResults(p,objects).map(({object,count})=>{
      const o=object&&objects.find(o=>o.id===object.id);return o?<span aria-hidden="true" key={o.id} className="vote-count vote-badge" data-vote-count={count} style={marker(o,badgeWidths[count]??24,24,false)}>{count}</span>:null;
    })}
    {v.mode&&own&&v.running&&<div className={'vote-strip'+(hosted.timer.open?' vote-panel-open':'')} onKeyDown={e=>e.stopPropagation()} style={{top:layout.top,...(layout.width?{width:layout.width}:{})}}>
      <span>Voting ·</span><span>{remainingWords(p)} ·</span><button disabled={!v.canInput} onClick={()=>{v.toggleMode();document.querySelector<HTMLElement>('.scene')?.focus();}}>Done voting</button>
    </div>}
    {hover&&v.canInput&&<>
      {explanation!=='Not eligible for this vote'&&<span aria-hidden="true" className="vote-hover" style={bounds(hover)}/>}
      <span className={'vote-tooltip'+(explanation==='Not eligible for this vote'?' ineligible':'')} style={{left:bounds(hover).left,top:bounds(hover).top+bounds(hover).height+8}}>{explanation}</span>
    </>}
  </>;
}
