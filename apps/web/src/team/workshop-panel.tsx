// SPDX-License-Identifier: Apache-2.0
import type { ReactNode, RefObject, CSSProperties, FocusEventHandler, KeyboardEventHandler } from 'react';
// A neutral shell. Controllers and their logical focus identities stay in each card.
export function workshopPanel({panel,top,className,onFocusCapture,onBlurCapture,onKeyDown,timer,voting,close}:{
  panel:RefObject<HTMLDivElement|null>;top:number;className:string;onFocusCapture:FocusEventHandler<HTMLDivElement>;
  onBlurCapture:FocusEventHandler<HTMLDivElement>;onKeyDown:KeyboardEventHandler<HTMLDivElement>;timer:ReactNode;voting?:ReactNode;close:ReactNode;
}) {
  return <div ref={panel} id="w1-panel" role="dialog" aria-labelledby="w1-title" className={className} style={{'--w1-top':`${top}px`} as CSSProperties}
    onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture} onKeyDown={onKeyDown}>
    <div className="w1-head"><h2 id="w1-title">Timer and voting</h2></div>
    <h3 className="timer-label" data-timer="heading" tabIndex={-1}>Timer</h3>
    {timer}{voting&&<><div className="vote-separator"/>{voting}</>}{close}
  </div>;
}
