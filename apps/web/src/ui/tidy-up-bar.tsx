// SPDX-License-Identifier: Apache-2.0
import type { PointerEvent } from 'react';
import type { TidyActions, TidyGrid, SpacingHandle } from '../tidy-up';
import type { View } from '../view';
import { contextBarPosition } from '../context-bar-position';
export type TidyUI = TidyActions & {
  grid:TidyGrid|null;columns:number;spacing:number;width:number;
  drag:{id:string}|null;barRef:(element:HTMLElement|null)=>void|(()=>void);
  changeColumns:(value:number)=>void;changeSpacing:(value:number)=>void;
  beginHandle:(e:PointerEvent<HTMLElement>,handle:SpacingHandle,zoom:number)=>void;
  moveHandle:(e:PointerEvent<HTMLElement>)=>void;endHandle:(e:PointerEvent<HTMLElement>)=>void;
};
export type TidyPosition = {pos:(o:{x:number;y:number})=>{left:number;top:number};view:View;size:{w:number;h:number};layout:{notice:number;panel:number}};
export function TidyUpBar({tidy,...position}:{tidy:TidyUI}&TidyPosition) {
  if(!tidy.open||!tidy.grid)return null;
  const placed=contextBarPosition({...position,bounds:tidy.grid.bounds,contextWidth:tidy.width,inline:false,item:undefined,itemHeight:0});
  const field=(name:'Columns'|'Spacing',value:number,change:(value:number)=>void,max:number)=><input key={name+value} type="text" inputMode="numeric" aria-label={name} defaultValue={value}
    onBlur={e=>{const text=e.currentTarget.value.trim(),next=/^\d+$/.test(text)?Number(text):NaN;if(Number.isInteger(next)&&next>=(name==='Columns'?1:0)&&next<=max)change(next);else e.currentTarget.value=String(value);}}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();const text=e.currentTarget.value.trim(),next=/^\d+$/.test(text)?Number(text):NaN;if(Number.isInteger(next)&&next>=(name==='Columns'?1:0)&&next<=max)change(next);else e.currentTarget.value=String(value);}}} />;
  return <section className="context tidy-bar" aria-label="Tidy up" ref={tidy.barRef} style={{left:placed.contextLeft,top:placed.contextTop,visibility:placed.contextFits?'visible':'hidden'}}
    onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();tidy.cancel(true);}}}>
    <span className="tidy-label">Tidy up</span><span className="divider" aria-hidden="true" />
    <span className="tidy-field">Columns <button className="tidy-step" aria-label="Fewer columns" disabled={tidy.columns===1} onClick={()=>tidy.changeColumns(tidy.columns-1)}>−</button>
      {field('Columns',tidy.columns,tidy.changeColumns,tidy.grid.items.length)}<button className="tidy-step" aria-label="More columns" disabled={tidy.columns===tidy.grid.items.length} onClick={()=>tidy.changeColumns(tidy.columns+1)}>+</button></span>
    <span className="tidy-field">Spacing {field('Spacing',tidy.spacing,tidy.changeSpacing,400)}</span><span className="divider" aria-hidden="true" />
    <button className="tidy-cancel" onClick={()=>tidy.cancel(true)}>Cancel</button><button className="tidy-apply" onClick={tidy.apply}>Apply</button>
  </section>;
}
