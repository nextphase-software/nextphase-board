// SPDX-License-Identifier: Apache-2.0
import { Group, Line, Circle, Rect } from 'react-konva';
import type { TapeItem } from 'nextphase-board-rules/document.ts';
import { bandPolygon, tapeFrame } from '../tape';
import { patternTile } from "../ui/tape-controls";
export function TapeBody({object:o,selected=false,zoom}: {object: Pick<TapeItem,'x'|'y'|'points'|'pattern'>;selected?:boolean;zoom:number}) {
  const {a,length,angle}=tapeFrame(o),points=bandPolygon(length).flatMap(p=>[p.x,p.y]);
  return <Group x={a.x} y={a.y} rotation={angle*180/Math.PI}>
    <Line points={points} closed ref={node=>{if(node)node.fillPatternImage(patternTile(o.pattern));}} fillPatternRotation={o.pattern==='stripes'?45:0} opacity={.9} stroke="rgba(0,0,0,.08)" strokeWidth={1} />
    {selected && <><Rect x={-4/zoom} y={-14-4/zoom} width={length+8/zoom} height={28+8/zoom} stroke="#518de0" strokeWidth={1.5/zoom} />
      {[0,length].map((x,i)=><Circle key={i} x={x} y={0} radius={5/zoom} fill="white" stroke="#518de0" strokeWidth={1.5/zoom} />)}</>}
  </Group>;
}
