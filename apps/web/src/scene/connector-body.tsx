// SPDX-License-Identifier: Apache-2.0
import { Circle, Group, Line, Path, Rect, Text } from "react-konva";
import type { ConnectorItem } from "../document";
import type { ConnectorLayout } from "../connectors";
import { objectType } from "../objects/registry";
import { TEXT_LAYOUT } from "../geometry";

export function ConnectorBody({ object, layout, selected, inline, zoom, pass }: {
  object: ConnectorItem; layout: ConnectorLayout; selected: boolean; inline: boolean; zoom: number; pass: "line" | "label";
}) {
  const type = objectType(object.type), box = layout.labelBox;
  if (pass === "line") return <Group>
    <Path data={layout.path} stroke={type.edge(object)} strokeWidth={3.5} lineCap="round" lineJoin="round" />
    <Line points={layout.arrow.flatMap((p) => [p.x, p.y])} stroke={type.edge(object)} strokeWidth={3.5} lineCap="round" lineJoin="round" />
  </Group>;
  return <Group>
    {!!object.text && !(selected && inline) && <>
      <Rect {...box} fill="#fafafa" />
      <Text {...TEXT_LAYOUT} fontSize={18} align="center" verticalAlign="middle" wrap="none"
        {...box} text={object.text.replace(/\r\n|[\r\n]/g, "\n")} fill={type.textColor(object)} />
    </>}
    {selected && [layout.from, layout.to].map((p, i) => <Circle key={i} x={p.x} y={p.y}
      radius={9} fill="white" stroke="#518de0" strokeWidth={3 / zoom} />)}
  </Group>;
}
