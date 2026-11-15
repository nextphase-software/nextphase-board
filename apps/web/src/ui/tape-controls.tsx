// SPDX-License-Identifier: Apache-2.0
import type { TapeItem } from 'nextphase-board-rules/document.ts';
import { TAPE_PATTERNS, type TapePattern } from 'nextphase-board-rules/objects/registry.ts';
import { Icon } from '../icons';
const tiles = new Map<TapePattern, HTMLCanvasElement>();
export function patternTile(pattern: TapePattern): HTMLCanvasElement {
  const existing=tiles.get(pattern);if(existing) return existing;
  const canvas=document.createElement('canvas');
  const size=pattern==='grid'?[8,8]:pattern==='zigzag'?[12,8]:pattern==='checks'?[12,12]:pattern==='kraft'?[6,6]:[10,10];
  [canvas.width,canvas.height]=size;
  const ctx=canvas.getContext('2d')!;
  const colors={stripes:['#fbe1d8','#f19c86'],dots:['#d7e7fb','#5b93d6'],grid:['#d9f1e3','#66b88b'],zigzag:['#fcefc0','#e0b52c'],checks:['#ebe4fa','#b9a6ea'],kraft:['#dcc3a1','#c9ab84']}[pattern];
  ctx.fillStyle=colors[0];ctx.fillRect(0,0,...size as [number,number]);ctx.fillStyle=colors[1];ctx.strokeStyle=colors[1];
  const dot=(x:number,y:number,r:number)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  if(pattern==='stripes') ctx.fillRect(0,0,5,10);
  if(pattern==='dots') dot(5,5,2);
  if(pattern==='grid') {ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(0,0);ctx.lineTo(0,8);ctx.stroke();}
  if(pattern==='zigzag') {ctx.lineWidth=1.5;ctx.beginPath();[[0,6],[3,2],[6,6],[9,2],[12,6]].forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  if(pattern==='checks') {ctx.fillRect(0,0,6,6);ctx.fillRect(6,6,6,6);}
  if(pattern==='kraft') {dot(1,2,.6);dot(4,5,.5);}
  tiles.set(pattern,canvas);return canvas;
}
export function paintSwatch(canvas: HTMLCanvasElement, pattern: TapePattern) {
  const ctx=canvas.getContext('2d')!,fill=ctx.createPattern(patternTile(pattern),'repeat')!;
  if(pattern==='stripes') fill.setTransform(new DOMMatrix().rotate(45));
  ctx.clearRect(0,0,22,22);ctx.fillStyle=fill;ctx.fillRect(0,0,22,22);
}
export type TapeSelection = { objects: TapeItem[]; only: boolean };
export type TapeCommands = { pattern: (value: TapePattern) => void };
export function TapeSwatch({pattern}: {pattern:TapePattern}) { return <canvas className="tape-swatch" width={22} height={22} aria-hidden="true" ref={canvas=>{if(canvas) paintSwatch(canvas,pattern);}} />; }
export function TapeControls({selection:s,commands:c,reason}: {selection:TapeSelection;commands:TapeCommands;reason:string}) {
  const first=s.objects[0];if(!first)return null;
  const name=s.objects.every(o=>o.pattern===first.pattern)?TAPE_PATTERNS.find(p=>p.value===first.pattern)!.name:'Mixed';
  const close=(el:HTMLElement)=>{const details=el.closest('details');if(details){details.open=false;details.querySelector('summary')?.focus();}};
  return <><span className="tape-label">{s.objects.length===1?'Washi tape':s.objects.length+' tapes'}</span><span className="divider" aria-hidden="true" />
    <details className="stroke-control tape-control" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(e.target as HTMLElement);}}}>
      <summary role="button" aria-label={'Pattern: '+name} title={reason||'Pattern: '+name} aria-disabled={!!reason} tabIndex={reason?-1:0} onClick={e=>{if(reason)e.preventDefault();}}><TapeSwatch pattern={first.pattern} /><Icon name="chevron" /></summary>
      <div className="ink-menu" role="group" aria-label="Pattern">{TAPE_PATTERNS.map(p=><button key={p.value} disabled={!!reason} aria-pressed={s.objects.every(o=>o.pattern===p.value)} onClick={e=>{c.pattern(p.value);close(e.currentTarget);}}><TapeSwatch pattern={p.value} />{p.name}</button>)}</div>
    </details><span className="divider" aria-hidden="true" /></>;
}
export function TapeFields({selection:s,commands:c,reason}: {selection:TapeSelection;commands:TapeCommands;reason:string}) {
  if(!s.objects.length)return null;const value=s.objects.every(o=>o.pattern===s.objects[0].pattern)?s.objects[0].pattern:'';
  return <div className="object-styles"><label htmlFor="tape-pattern">Pattern</label><select id="tape-pattern" value={value} disabled={!!reason} title={reason||'Pattern'} onChange={e=>c.pattern(e.target.value as TapePattern)}>{!value&&<option value="" disabled>Mixed</option>}{TAPE_PATTERNS.map(p=><option key={p.value} value={p.value}>{p.name}</option>)}</select></div>;
}
