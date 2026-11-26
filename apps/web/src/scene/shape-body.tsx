// SPDX-License-Identifier: Apache-2.0
import { Ellipse, Group, Rect, Text, Line } from "react-konva";
import type { ItemV6 as Item } from "nextphase-board-rules/document.ts";
import { objectType, textBox, kindInfo } from "nextphase-board-rules/objects/registry.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";
import { lineOffset } from "../text-runs";
import type { View } from "../view";
import type { ObjectLayout } from "./note-body";

export function ShapeBody({ o, layout, selected, inline, view, pixelScale }: {
  o: Item; layout: ObjectLayout; selected: Set<string>; inline: boolean; view: View; pixelScale: number;
}) {
  const record = objectType(o.type), box = textBox(o), round = kindInfo(o).round;
  const body = { stroke: record.edge(o), strokeWidth: 4,
    dash: o.border?.style === "dashed" ? [14, 9] : undefined };
  const fill = { fill: record.fill(o), opacity: o.fill?.mode === "transparent" ? .45 : 1 };
  const ellipse = { x: o.x + o.width / 2, y: o.y + o.height / 2, radiusX: o.width / 2, radiusY: o.height / 2 };
  const rect = { x: o.x, y: o.y, width: o.width, height: o.height, cornerRadius: kindInfo(o).kind === "rounded-rectangle" ? Math.min(o.width,o.height)*.18 : 6 };
  const outline = kindInfo(o).outline, polygon = Array.isArray(outline) ? outline.flatMap(([x,y]) => [o.x+x*o.width,o.y+y*o.height]) : null;
  const lines = layout.runs ?? [], lineHeight = textUnits(o.textSize) * 1.45;
  const font = textUnits(o.textSize), thickness = Math.max(1, Math.round(font * pixelScale / 16)) / pixelScale;
  return <Group>
    {polygon ? <Line points={polygon} closed lineJoin="round" {...fill} /> : round ? <Ellipse {...ellipse} {...fill} /> : <Rect {...rect} {...fill} />}
    {polygon ? <Line points={polygon} closed lineJoin="round" {...body} /> : round ? <Ellipse {...ellipse} {...body} /> : <Rect {...rect} {...body} />}
    {!(inline && selected.has(o.id)) && lines.map((line, i) => line.pieces.map((p, j) => <Text key={i + ":" + j}
      fontFamily="system-ui" fontSize={textUnits(o.textSize)} lineHeight={1.45}
      fontStyle={p.style.italic ? p.style.bold ? "italic bold" : "italic" : p.style.bold ? "bold" : "normal"}
      textDecoration={p.style.strike ? "line-through" : ""} text={p.text} fill={record.textColor(o)}
      x={box.x + lineOffset(o.align, box.width, line.width) + p.x}
      y={box.y + Math.max(0, (box.height - lines.length * lineHeight) / 2) + i * lineHeight} />))}
    {!(inline && selected.has(o.id)) && layout.links.map(span => {
      const x = box.x + lineOffset(o.align, box.width, span.lineWidth) + span.x;
      const lineTop = box.y + Math.max(0, (box.height - lines.length * lineHeight) / 2) + span.line * lineHeight;
      const y = lineTop + lineHeight / 2 + 0.47 * font + thickness / 2;
      return <Line key={`${span.line}:${span.start}`} points={[x, y, x + span.width, y]}
        stroke={record.textColor(o)} strokeWidth={thickness} lineCap="butt" listening={false} />;
    })}
    {selected.has(o.id) && <Rect x={o.x} y={o.y} width={o.width} height={o.height}
      stroke="#518de0" strokeWidth={(inline ? 1.5 : 2.5) / view.z} />}
  </Group>;
}
