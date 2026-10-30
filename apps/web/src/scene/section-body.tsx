// SPDX-License-Identifier: Apache-2.0
import Konva from "konva";
import { Group, Rect, Text } from "react-konva";
import type { ItemV6 as Item, ImageItem, StrokeItem } from "nextphase-board-rules/document.ts";
import { TEXT_LAYOUT } from "../geometry";
import { objectType } from "nextphase-board-rules/objects/registry.ts";

export function SectionBody({ o, selected, inline, dropTarget }: {
  o: Item; selected: Set<string>; inline: boolean; dropTarget: boolean;
}) {
  const type = objectType(o.type), active = selected.has(o.id) || dropTarget;
  return <Group>
    <Rect x={o.x} y={o.y} width={o.width} height={o.height}
      fill={dropTarget ? "#e6eefb" : type.fill(o)} opacity={0.55} cornerRadius={8} />
    <Rect x={o.x} y={o.y} width={o.width} height={o.height}
      stroke={active ? "#518de0" : type.edge(o)} strokeWidth={active ? 2 : 1}
      cornerRadius={8} dash={dropTarget ? [6, 4] : undefined} />
    {!(inline && selected.has(o.id)) && <Text x={o.x + 2} y={o.y - 26}
      width={o.width - 2} height={26} text={o.text.replace(/\r\n|[\r\n]/g, " ")}
      fontFamily={TEXT_LAYOUT.fontFamily} fontSize={18} fontStyle="600"
      fill={active ? "#518de0" : type.textColor(o)} wrap="none" ellipsis />}
  </Group>;
}

export function SectionDropHint({ section, ideas }: {
  section: Item; ideas: ((Item | StrokeItem | ImageItem) & { displayHeight: number })[];
}) {
  const text = "Joins " + (section.text.replace(/\r\n|[\r\n]/g, " ") || "section");
  const measurement = new Konva.Text({ text, fontFamily: TEXT_LAYOUT.fontFamily, fontSize: 16, fontStyle: "500" });
  const width = Math.max(220, Math.min(600, measurement.measureSize(text).width + 32));
  measurement.destroy();
  const x = Math.max(...ideas.map((o) => o.x + o.width)) - 90;
  const y = Math.max(...ideas.map((o) => o.y + o.displayHeight)) + 10;
  return <Group>
    <Rect x={x} y={y} width={width} height={34} fill="#29272e" cornerRadius={17} />
    <Text x={x + 16} y={y} width={width - 32} height={34} text={text}
      fontFamily={TEXT_LAYOUT.fontFamily} fontSize={16} fontStyle="500" fill="white"
      verticalAlign="middle" wrap="none" ellipsis />
  </Group>;
}
