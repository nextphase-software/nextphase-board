// SPDX-License-Identifier: Apache-2.0
import { clamp, freshIdentifier, type BoardV14, type TapeItem } from 'nextphase-board-rules/document.ts';
import { tapeType, TAPE_PAD, TAPE_MIN, TAPE_MAX, type TapePattern } from 'nextphase-board-rules/objects/registry.ts';
import { pointSegmentDistance, strokeInBox } from './strokes.ts';
import type { Point } from './selection.ts';
export const whole = (n: number) => Math.sign(n) * Math.round(Math.abs(n));
export function tapeGeometry(start: Point, end: Point, origin: Point = {x:0,y:0}) {
  // Clamp both endpoints inside the board before applying the length rule.
  const low = {x:Math.ceil(-1e6+TAPE_PAD-origin.x),y:Math.ceil(-1e6+TAPE_PAD-origin.y)},
    high = {x:Math.floor(1e6-TAPE_PAD-origin.x),y:Math.floor(1e6-TAPE_PAD-origin.y)};
  const edge = (n: number, axis: keyof Point) => clamp(whole(n), low[axis], high[axis]);
  const a = { x: edge(start.x,"x"), y: edge(start.y,"y") };
  let dx = end.x-start.x, dy = end.y-start.y;
  const length = Math.hypot(dx,dy);
  if (!length) { dx=1; dy=0; }
  const scale = clamp(length,TAPE_MIN,TAPE_MAX) / (length || 1);
  const b = { x: edge(start.x+dx*scale,"x"), y: edge(start.y+dy*scale,"y") };
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y', sign = Math.sign(axis === 'x' ? dx : dy) || 1;
  while (Math.hypot(b.x-a.x,b.y-a.y) < TAPE_MIN) {
    // At a board edge the available inward direction keeps the strip valid.
    const step = a[axis]+sign*TAPE_MIN < low[axis] || a[axis]+sign*TAPE_MIN > high[axis] ? -sign : sign;
    b[axis] += step;
  }
  while (Math.hypot(b.x-a.x,b.y-a.y) > TAPE_MAX) b[axis] -= sign;
  const x=Math.min(a.x,b.x)-TAPE_PAD, y=Math.min(a.y,b.y)-TAPE_PAD;
  return {x,y,width:Math.max(a.x,b.x)+TAPE_PAD-x,height:Math.max(a.y,b.y)+TAPE_PAD-y,
    points:[[a.x-x,a.y-y],[b.x-x,b.y-y]] as [number,number][]};
}
export const clickTape = (p: Point) => tapeGeometry({x:p.x-80,y:p.y},{x:p.x+80,y:p.y});
export function makeTape(board: BoardV14, start: Point, end: Point, pattern: TapePattern, click=false, page = board.boardId): TapeItem & { page: string } {
  if(board.objects.length>=250) throw Error('250 object limit reached');
  const id=freshIdentifier(board);
  return {id,generation:freshIdentifier(board,[id]),type:tapeType().type,page,pattern,group:null,section:null,
    ...(click ? clickTape(start) : tapeGeometry(start,end)),order:board.objects.length};
}
export const tapeEnds = (o: Pick<TapeItem,'x'|'y'|'points'>): Point[] => o.points.map(([x,y]) => ({x:o.x+x,y:o.y+y}));
export function moveTapeEnd<T extends TapeItem>(o: T, end: number, pointer: Point): T {
  const ends=tapeEnds(o), fixed=ends[1-end];
  // The fixed endpoint may be fractional after a move. Round relative to it so
  // its position stays fixed and the saved relative points stay whole.
  const origin={x:fixed.x-whole(fixed.x),y:fixed.y-whole(fixed.y)};
  const g=tapeGeometry({x:fixed.x-origin.x,y:fixed.y-origin.y},{x:pointer.x-origin.x,y:pointer.y-origin.y},origin);
  return {...o,...g,x:g.x+origin.x,y:g.y+origin.y,points:end===1?g.points:[g.points[1],g.points[0]]};
}
export function bandPolygon(length: number): Point[] {
  return [...Array.from({length:7},(_,i)=>({x:i%2?3:0,y:-TAPE_PAD+28*i/6})),
    ...Array.from({length:7},(_,i)=>({x:length-((6-i)%2?3:0),y:TAPE_PAD-28*i/6}))];
}
export function tapeFrame(o: Pick<TapeItem,'x'|'y'|'points'>) {
  const [a,b]=tapeEnds(o),length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);
  const project=(p:Point)=>({x:a.x+p.x*Math.cos(angle)-p.y*Math.sin(angle),y:a.y+p.x*Math.sin(angle)+p.y*Math.cos(angle)});
  return {a,b,length,angle,project};
}
export function tapeOutline(o: Pick<TapeItem,'x'|'y'|'points'>, zoom: number) {
  const {length,project}=tapeFrame(o),d=4/zoom;
  return [{x:-d,y:-TAPE_PAD-d},{x:length+d,y:-TAPE_PAD-d},{x:length+d,y:TAPE_PAD+d},{x:-d,y:TAPE_PAD+d}].map(project);
}
export function tapeHit(o: Pick<TapeItem,'x'|'y'|'points'>, p: Point, zoom: number): boolean {
  const {length,angle,a}=tapeFrame(o),dx=p.x-a.x,dy=p.y-a.y;
  const local={x:dx*Math.cos(angle)+dy*Math.sin(angle),y:-dx*Math.sin(angle)+dy*Math.cos(angle)},vertices=bandPolygon(length);
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++) {
    const a=vertices[i],b=vertices[j];
    if((a.y>local.y)!==(b.y>local.y)&&local.x<(b.x-a.x)*(local.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
    if(pointSegmentDistance(local,a,b)<=4/zoom) return true;
  }
  return inside;
}
export const tapeInBox = strokeInBox;
