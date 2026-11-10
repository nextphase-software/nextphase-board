// SPDX-License-Identifier: Apache-2.0
import type { SpotlightProjection } from './hosted-board';
export type Safety={visible:boolean;editing:boolean;composing:boolean;gesture:boolean;preview:boolean};
export const safeOffer=(s:Safety,fresh:boolean)=>s.visible&&!s.editing&&!s.composing&&!s.gesture&&!s.preview&&fresh;
export function acceptSpotlight(old:SpotlightProjection|undefined,next:SpotlightProjection){return !old||old.session.authorityId!==next.session.authorityId||next.session.controlVersion>old.session.controlVersion||next.session.controlVersion===old.session.controlVersion&&next.own.membershipVersion>=old.own.membershipVersion;}
export type Rectangle={left:number;right:number;top:number;bottom:number};
// All inputs are measured CSS rectangles. Notice positions are never changed here.
export function spotlightGeometry(width:number,height:number,bottoms:number[],obstructions:Rectangle[]){
  let top=Math.max(0,...bottoms)+12,cap=Math.min(400,width-24),full=width<600;
  const right=obstructions.filter(r=>r.right>width/2&&r.bottom>top);
  if(right.length){const column=Math.min(...right.map(r=>r.left))-8-12;if(column<240){top=Math.max(top,...right.map(r=>r.bottom+8));full=true;}else cap=Math.min(cap,column);}
  return {top,maxWidth:full?width-24:cap,width:full?width-24:'max-content',maxHeight:Math.max(0,height-top-12)};
}
export function spotlightStatus(p:SpotlightProjection|undefined,mode:string,name:string,seconds:number){
  if(mode==='uncertain')return 'Spotlight disconnected. Reconnecting…';
  if(mode==='pending')return 'Checking spotlight…';
  if(!p)return 'Connecting spotlight…';
  if(p.presenting)return p.presenting.hasHadFollower?`${p.presenting.followers} follower${p.presenting.followers===1?'':'s'}`:'Waiting for followers…';
  if(p.session.phase==='reconnecting')return 'Presenter reconnecting…';
  return `Spotlight on ${name}${mode==='offer'?`. Following in ${seconds}…`:''}`;
}
