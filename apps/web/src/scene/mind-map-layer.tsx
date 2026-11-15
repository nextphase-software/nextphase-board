// SPDX-License-Identifier: Apache-2.0
import { Group, Line, Rect } from "react-konva";
import type { ItemV12 as Item } from "nextphase-board-rules/document.ts";
import { isMindNode, type Rectangle } from "nextphase-board-rules/objects/registry.ts";
import { mapOf, outerSides } from "../mind-map";
import type { MapDrag } from "../gesture";
import type { View } from "../view";

type Box = Rectangle;
// A branch: the cubic curve from the middle of the parent's edge on the child's
// side to the middle of the child's facing edge, control points halfway across.
function curve(from: Box, to: Box, right: boolean): number[] {
  const x0 = right ? from.x + from.width : from.x, y0 = from.y + from.height / 2;
  const x1 = right ? to.x : to.x + to.width, y1 = to.y + to.height / 2, dx = (x1 - x0) / 2;
  return [x0, y0, x0 + dx, y0, x1 - dx, y1, x1, y1];
}

// Branch lines in the connectors' band ("lines"); the map frame, the drop
// outline and the dashed preview curve above the nodes ("over").
export function MindMapLayer({ pass, objects, hidden, selected, drag, view, size }: {
  pass: "lines" | "over"; objects: readonly Item[]; hidden: ReadonlySet<string>; selected: ReadonlySet<string>;
  drag?: MapDrag; view: View; size: { w: number; h: number };
}) {
  const nodes = new Map(objects.filter(isMindNode).filter((o) => !hidden.has(o.id)).map((o) => [o.id, o]));
  if (pass === "lines") {
    const sides = outerSides(objects);
    return <Group>{[...nodes.values()].flatMap((node) => {
      const parent = node.parent === null ? undefined : nodes.get(node.parent);
      if (!parent || drag && !drag.root && drag.node === node.id) return [];
      return [<Line key={node.id} points={curve(parent, node, sides.get(node.id) !== "left")} bezier
        stroke="#6b6b6b" strokeWidth={3.5} lineCap="round" listening={false} />];
    })}</Group>;
  }
  const z = view.z, left = size.w / 2 - view.x * z, top = size.h / 2 - view.y * z;
  // The frame's edges sit on half pixels, 16 px outside the map's visible boxes.
  const crisp = (value: number, origin: number) => (Math.floor(origin + value) + 0.5 - origin) / z;
  const roots = drag ? drag.root ? [drag.node] : [] : [...selected].filter((id) => nodes.get(id)?.parent === null);
  const target = drag?.target ? nodes.get(drag.target) : undefined, dragged = drag ? nodes.get(drag.node) : undefined;
  return <Group>
    {roots.map((id) => {
      const boxes = mapOf(objects, id).filter((o) => nodes.has(o.id));
      const x = crisp(Math.min(...boxes.map((o) => o.x)) * z - 16, left), y = crisp(Math.min(...boxes.map((o) => o.y)) * z - 16, top);
      const right = crisp(Math.max(...boxes.map((o) => o.x + o.width)) * z + 16, left), bottom = crisp(Math.max(...boxes.map((o) => o.y + o.height)) * z + 16, top);
      return <Rect key={id} x={x} y={y} width={right - x} height={bottom - y} stroke="#8fbdf5" strokeWidth={1 / z} listening={false} />;
    })}
    {target && <Rect x={target.x - 1.5 / z} y={target.y - 1.5 / z} width={target.width + 3 / z} height={target.height + 3 / z}
      stroke="#518de0" strokeWidth={3 / z} cornerRadius={2 / z} listening={false} />}
    {target && dragged && <Line points={curve(target, dragged, drag!.side !== "left")} bezier stroke="#518de0"
      strokeWidth={2 / z} dash={[6 / z, 4 / z]} lineCap="round" listening={false} />}
  </Group>;
}
