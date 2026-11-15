// SPDX-License-Identifier: Apache-2.0
import { clamp, type BoardV12 as Board } from 'nextphase-board-rules/document.ts';
import { hasRectangle, isContainer, isMindNode, type Rectangle } from 'nextphase-board-rules/objects/registry.ts';
import { editingCommandReason } from './commands.ts';
import type { DisplayObject, Point } from './selection.ts';
import { whole } from './tape.ts';
export type TidyItem = Rectangle & { id: string; ids: string[] };
export type SpacingHandle = Point & { id: string; axis: 'x' | 'y' };
export const TIDY_WAIT = 'Apply or cancel Tidy up first.';
const boundsOf = (boxes: readonly Rectangle[]): Rectangle => {
  const x=Math.min(...boxes.map(o=>o.x)),y=Math.min(...boxes.map(o=>o.y));
  return {x,y,width:Math.max(...boxes.map(o=>o.x+o.width))-x,height:Math.max(...boxes.map(o=>o.y+o.height))-y};
};
export function placeableItems(board: Board, selected: ReadonlySet<string>, displayed: readonly DisplayObject[]=[]): TidyItem[] {
  const rectangles=board.objects.filter(hasRectangle), chosen=rectangles.filter(o=>selected.has(o.id));
  const sections=new Set(chosen.filter(isContainer).map(o=>o.id)),groups=new Set(chosen.filter(o=>o.group!==null).map(o=>o.group!));
  const used=new Set<string>(),items:TidyItem[]=[];
  const box=(o: typeof rectangles[number])=>({...o,height:displayed.find(d=>d.id===o.id)?.displayHeight??o.height});
  // Containers own their contents before groups or separately selected members.
  for(const section of chosen.filter(isContainer)) {
    const members=rectangles.filter(o=>o.id===section.id||o.section===section.id);
    members.forEach(o=>used.add(o.id)); items.push({...box(section),id:section.id,ids:members.map(o=>o.id)});
  }
  for(const group of groups) {
    const members=rectangles.filter(o=>o.group===group&&!used.has(o.id)&&!sections.has(o.section!));
    if(!members.length) continue;
    members.forEach(o=>used.add(o.id));items.push({...boundsOf(members.map(box)),id:group,ids:members.map(o=>o.id)});
  }
  for(const o of chosen) if(!used.has(o.id)) items.push({...box(o),id:o.id,ids:[o.id]});
  return items;
}
export function readingOrder(items: readonly TidyItem[]): TidyItem[] {
  let left=[...items].sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id,'en'));
  const ordered:TidyItem[]=[];
  while(left.length) {
    const seed=left[0],row=left.filter(o=>o===seed||o.y+o.height/2>=seed.y&&o.y+o.height/2<=seed.y+seed.height),ids=new Set(row.map(o=>o.id));
    row.sort((a,b)=>a.x+a.width/2-b.x-b.width/2||a.id.localeCompare(b.id,'en'));
    ordered.push(...row);left=left.filter(o=>!ids.has(o.id));
  }
  return ordered;
}
export function tidyReason(board: Board, selected: ReadonlySet<string>, state: Parameters<typeof editingCommandReason>[0]): string {
  const reason=editingCommandReason(state);if(reason) return reason;
  if(board.objects.some(o=>selected.has(o.id)&&isMindNode(o))) return 'Mind map nodes are placed by their map.';
  return placeableItems(board,selected).length>=3?'':'Select three or more objects to tidy up.';
}
export function tidyGrid(input: readonly TidyItem[], columns=Math.ceil(Math.sqrt(input.length)), spacing=24) {
  const items=readingOrder(input),n=items.length;
  columns=clamp(Number.isFinite(columns)?whole(columns):Math.ceil(Math.sqrt(n)),1,Math.max(1,n));
  spacing=clamp(Number.isFinite(spacing)?whole(spacing):24,0,400);
  const rows=Math.ceil(n/columns),widths=Array.from({length:columns},()=>0),heights=Array.from({length:rows},()=>0);
  items.forEach((o,i)=>{widths[i%columns]=Math.max(widths[i%columns],o.width);heights[Math.floor(i/columns)]=Math.max(heights[Math.floor(i/columns)],o.height);});
  const old=n?boundsOf(items):{x:0,y:0,width:0,height:0},width=widths.reduce((a,b)=>a+b,0)+(columns-1)*spacing,height=heights.reduce((a,b)=>a+b,0)+Math.max(0,rows-1)*spacing;
  const bounds={x:clamp(whole(old.x+(old.width-width)/2),-1e6,1e6-width),y:clamp(whole(old.y+(old.height-height)/2),-1e6,1e6-height),width,height};
  const starts=(sizes:number[],start:number)=>sizes.map((_,i)=>start+sizes.slice(0,i).reduce((a,b)=>a+b,0)+i*spacing);
  const xs=starts(widths,bounds.x),ys=starts(heights,bounds.y),offsets=new Map<string,Point>();
  items.forEach((o,i)=>{const c=i%columns,r=Math.floor(i/columns);offsets.set(o.id,{x:whole(xs[c]+(widths[c]-o.width)/2-o.x),y:whole(ys[r]+(heights[r]-o.height)/2-o.y)});});
  const handles:SpacingHandle[]=[];
  for(let r=0;r<rows;r++) for(let c=0;c<columns-1;c++) if(items[r*columns+c+1]) handles.push({id:`v-${r}-${c}`,axis:'x',x:xs[c]+widths[c]+spacing/2,y:ys[r]+heights[r]/2});
  for(let r=0;r<rows-1;r++) for(let c=0;c<columns;c++) if(items[(r+1)*columns+c]) handles.push({id:`h-${r}-${c}`,axis:'y',x:xs[c]+widths[c]/2,y:ys[r]+heights[r]+spacing/2});
  return {items,columns,spacing,bounds,widths,heights,offsets,handles};
}
export type TidyGrid = ReturnType<typeof tidyGrid>;
export function applyTidy(board: Board, grid: TidyGrid): Board {
  const offsets=new Map(grid.items.flatMap(o=>o.ids.map(id=>[id,grid.offsets.get(o.id)!] as const)));
  return {...board,objects:board.objects.map(o=>{const d=offsets.get(o.id);return d&&hasRectangle(o)?{...o,x:o.x+d.x,y:o.y+d.y}:o;})};
}
export function placedChanged(before: Board, after: Board, items: readonly TidyItem[]): boolean {
  const ids=new Set(items.flatMap(o=>o.ids));
  if([...ids].some(id=>JSON.stringify(before.objects.find(o=>o.id===id))!==JSON.stringify(after.objects.find(o=>o.id===id)))) return true;
  // A new group/section member changes the placed item too.
  const sections=new Set(before.objects.filter(o=>ids.has(o.id)&&isContainer(o)).map(o=>o.id));
  const groups=new Set(before.objects.filter(o=>ids.has(o.id)&&o.group!==null).map(o=>o.group));
  return after.objects.some(o=>!ids.has(o.id)&&(sections.has(o.section!)||o.group!==null&&groups.has(o.group)));
}
// Shared action seam; DOM and state ownership stay in the state hook.
export type TidyActions = {
  open: boolean;
  measure: (objects: readonly DisplayObject[]) => void;
  reason: (state: Parameters<typeof editingCommandReason>[0]) => string;
  start: (state: Parameters<typeof editingCommandReason>[0]) => void;
  cancel: (announce?: boolean) => void;
  apply: () => void;
};
