// SPDX-License-Identifier: Apache-2.0
import { Group, Rect, Text } from "react-konva";
import type { MindNodeItem } from "nextphase-board-rules/document.ts";
import { objectType, fontSize } from "nextphase-board-rules/objects/registry.ts";
import { TEXT_LAYOUT } from "../geometry";
import { MIND_MAP } from "../mind-map";
import type { ObjectLayout } from "./note-body";

// One node: its text in the node look (a root bold), the placeholder of an
// empty node and the selection outline. A node has no fill and no border.
export function MindNodeBody({ o, layout, editing, outline, faded, zoom }: {
  o: MindNodeItem & { x: number; y: number; width: number; height: number };
  layout: ObjectLayout; editing: boolean; outline: boolean; faded: boolean; zoom: number;
}) {
  const size = fontSize(o), lineHeight = size * TEXT_LAYOUT.lineHeight;
  return (
    <Group opacity={faded ? 0.6 : 1}>
      {!editing && (layout.runs ?? []).map((line, i) => <Text
        key={i}
        x={o.x + MIND_MAP.padX}
        y={o.y + MIND_MAP.padY + i * lineHeight}
        text={line.pieces.map((piece) => piece.text).join("")}
        fontFamily={TEXT_LAYOUT.fontFamily}
        fontSize={size}
        fontStyle={o.parent === null ? "bold" : "normal"}
        lineHeight={TEXT_LAYOUT.lineHeight}
        wrap="none"
        fill={o.text ? objectType(o.type).textColor(o) : "#79737f"}
      />)}
      {outline && <Rect x={o.x} y={o.y} width={o.width} height={o.height} stroke="#518de0" strokeWidth={2 / zoom} />}
    </Group>
  );
}
