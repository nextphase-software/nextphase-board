// SPDX-License-Identifier: Apache-2.0
import { Group, Line, Rect } from "react-konva";
import { inkColor, inkInfo, inkWidth, type StrokeKeys, type Rectangle } from "../objects/registry";

export function StrokeBody({ object: o, selected = false, zoom }: {
  object: Rectangle & StrokeKeys; selected?: boolean; zoom: number;
}) {
  const round = inkInfo(o).round;
  return <Group>
    <Line x={o.x} y={o.y} points={o.points.flat()} stroke={inkColor(o)} strokeWidth={inkWidth(o)}
      lineCap={round ? "round" : "butt"} lineJoin="round" globalCompositeOperation={round ? "source-over" : "multiply"} />
    {selected && <Rect x={o.x} y={o.y} width={o.width} height={o.height} stroke="#518de0" strokeWidth={2.5 / zoom} />}
  </Group>;
}
