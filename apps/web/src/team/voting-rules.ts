// SPDX-License-Identifier: Apache-2.0
import { eligibleVote, hasText, isImage, objectType, usesShapePaint, voteTextAnchor } from 'nextphase-board-rules/objects/registry.ts';
import type { ItemV12 } from 'nextphase-board-rules/document.ts';
import type { VoteProjection, VoteOwn, VoteTarget } from './hosted-board';
export { eligibleVote, voteTextAnchor };
export const validQuestion=(v:string)=>!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)&&[...v.trim()].length>=1&&[...v.trim()].length<=240;
export const validBudget=(n:number)=>Number.isSafeInteger(n)&&n>=1&&n<=20;
export const targetMatches=(target:readonly unknown[],o:{id:string;generation:string})=>target[0]===o.id&&target[1]===o.generation;
export const ownBallot=(p?:VoteProjection):VoteOwn|undefined=>p?.own&&'ballotVersion'in p.own?p.own:undefined;
export const remainingWords=(p:VoteProjection)=>`${ownBallot(p)?.remaining??0} of ${p.session.budget} votes remaining`;
export function voteLabel(o?:ItemV12) {
  if(!o)return 'Removed object';
  if(hasText(o)&&o.text.trim())return o.text.trim();
  if(isImage(o)&&o.description.trim())return o.description.trim();
  if(usesShapePaint(o))return o.shape![0].toUpperCase()+o.shape!.slice(1);
  return objectType(o.type).label;
}
export function rankedResults(p:VoteProjection,objects:readonly ItemV12[]) {
  return p.session.targets.map((target,i)=>({target,count:p.session.totals?.[i]??0,object:objects.find(o=>targetMatches(target,o))}))
    .sort((a,b)=>b.count-a.count||a.target[2]-b.target[2]||a.target[0].localeCompare(b.target[0]));
}
export const eligibleTargets=(targets:VoteTarget[],objects:readonly ItemV12[])=>targets.flatMap(t=>{const o=objects.find(o=>targetMatches(t,o));return o?[o]:[];});
export type MarkerBox={left:number;top:number;width:number;height:number};
export type FirstLine={right:number;centerY:number};
export function markerPosition(box:MarkerBox,line:FirstLine|undefined,width:number,height:number,dot:boolean) {
  return line?{left:Math.min(line.right+(dot?6:8),box.left+box.width-8-width),top:line.centerY-height/2}:
    {left:box.left+box.width-8-width,top:box.top+8};
}
export type VoteKey={key:string;repeat?:boolean;isComposing?:boolean;altKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;shiftKey?:boolean};
export const voteKey=(e:VoteKey)=>!e.repeat&&!e.isComposing&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.key==='Enter';
export function hoverWords(p:VoteProjection,o?:ItemV12) {
  if(!o||!eligibleVote(o)||!p.session.targets.some(t=>targetMatches(t,o)))return 'Not eligible for this vote';
  const own=ownBallot(p);if(own?.targets.some(t=>targetMatches(t,o)))return 'Remove vote';
  return own?.remaining?'Add vote':'No votes remaining';
}
