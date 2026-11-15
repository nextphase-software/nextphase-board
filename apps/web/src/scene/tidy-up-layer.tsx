// SPDX-License-Identifier: Apache-2.0
import type { TidyUI, TidyPosition } from '../ui/tidy-up-bar';
export function TidyUpLayer({tidy,pos,view}:{tidy:TidyUI}&Pick<TidyPosition,'pos'|'view'>) {
  if(!tidy.open||!tidy.grid)return null;
  const {bounds,handles}=tidy.grid;
  return <><div className="tidy-grid" aria-hidden="true" style={{...pos(bounds),width:bounds.width*view.z+2,height:bounds.height*view.z+2}} />
    {handles.map(handle=>{const active=tidy.drag?.id===handle.id;
      return <div key={handle.id} className={'tidy-handle '+(handle.axis==='x'?'vertical':'horizontal')+(active?' dragging':'')} style={pos(handle)}
        onPointerDown={e=>tidy.beginHandle(e,handle,view.z)} onPointerMove={tidy.moveHandle} onPointerUp={tidy.endHandle} onPointerCancel={tidy.endHandle} onLostPointerCapture={tidy.endHandle}>
        <span className="tidy-handle-line" /><span className="tidy-handle-circle" />{active&&<span className="tidy-spacing-label">{tidy.spacing}</span>}
      </div>;
    })}</>;
}
