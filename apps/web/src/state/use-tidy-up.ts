// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import type { BoardV12 as Board } from 'nextphase-board-rules/document.ts';
import { applyTidy, placeableItems, placedChanged, tidyGrid, tidyReason, type TidyItem, type SpacingHandle } from '../tidy-up';
import { whole } from '../tape';
import type { DisplayObject } from '../selection';
import type { HostedBoard } from '../team/hosted-board';
type Session = { before: Board; items: TidyItem[]; tool: string; selection: string; columns: number; spacing: number };
type HandleDrag = { id: string; axis: 'x'|'y'; start: number; spacing: number; zoom: number };
export function useTidyUp({board,selected,commit,tool,setMessage,hosted,scene,readOnly=false}: {
  readOnly?:boolean;board:Board;selected:Set<string>;commit:(board:Board,recordObject?:boolean)=>void;tool:string;
  setMessage:(value:string)=>void;hosted?:HostedBoard;scene:RefObject<HTMLDivElement|null>;
}) {
  const [session,setSession]=useState<Session|null>(null),[drag,setDrag]=useState<HandleDrag|null>(null),[width,setWidth]=useState(0);
  const displayed=useRef<readonly DisplayObject[]>([]),latest=useRef({board,selected,tool,session});
  latest.current={board,selected,tool,session};
  const focus=()=>scene.current?.focus();
  function cancel(announce=false) {setSession(null);setDrag(null);focus();if(announce)setMessage('Tidy up cancelled.');}
  const selection=JSON.stringify([...selected].sort());
  useEffect(()=>{
    if(!session)return;
    if(readOnly||session.tool!==tool||session.selection!==selection) {cancel();return;}
    if(placedChanged(session.before,board,session.items)) {
      cancel();if(hosted)hosted.toast('Tidy up was cancelled because the objects changed.');
    }
  },[board,selection,tool,session,readOnly]);
  useEffect(()=>{
    const resize=()=>{if(window.innerWidth<768&&latest.current.session)cancel();};
    window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
  },[]);
  const grid=session?tidyGrid(session.items,session.columns,session.spacing):null;
  function reason(state: Parameters<typeof tidyReason>[2]) {return tidyReason(board,selected,state);}
  function start(state: Parameters<typeof tidyReason>[2]) {
    if(readOnly||window.innerWidth<768||reason(state))return;
    const items=placeableItems(board,selected,displayed.current);
    setSession({before:board,items,tool,selection,columns:Math.ceil(Math.sqrt(items.length)),spacing:24});setDrag(null);focus();
  }
  function apply() {
    if(readOnly||!session||!grid)return;
    if(placedChanged(session.before,board,session.items)){cancel();return;}
    setSession(null);setDrag(null);commit(applyTidy(board,grid),true);focus();
    setMessage(`Tidied ${grid.items.length} objects into ${grid.columns} columns.`);
  }
  const changeColumns=(value:number)=>{if(session&&Number.isInteger(value)&&value>=1&&value<=session.items.length)setSession({...session,columns:value});};
  const changeSpacing=(value:number)=>{if(session&&Number.isInteger(value)&&value>=0&&value<=400)setSession({...session,spacing:value});};
  const barRef=(element:HTMLElement|null)=>{
    if(!element)return;
    const measure=()=>setWidth(element.getBoundingClientRect().width);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  };
  function beginHandle(e:PointerEvent<HTMLElement>,handle:SpacingHandle,zoom:number) {
    if(e.button!==0||!session)return;e.preventDefault();e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);setDrag({id:handle.id,axis:handle.axis,start:handle.axis==='x'?e.clientX:e.clientY,spacing:session.spacing,zoom});
  }
  function moveHandle(e:PointerEvent<HTMLElement>) {
    if(!drag)return;e.stopPropagation();
    changeSpacing(Math.max(0,Math.min(400,whole(drag.spacing+((drag.axis==='x'?e.clientX:e.clientY)-drag.start)/drag.zoom))));
  }
  function endHandle(e:PointerEvent<HTMLElement>) {e.stopPropagation();setDrag(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  return {open:!!session,board:session&&grid?applyTidy(board,grid):board,selected:session?new Set<string>():selected,
    grid,columns:session?.columns??0,spacing:session?.spacing??24,drag,width,barRef,changeColumns,changeSpacing,
    measure:(objects:readonly DisplayObject[])=>{displayed.current=objects;},reason,start,cancel,apply,beginHandle,moveHandle,endHandle};
}
