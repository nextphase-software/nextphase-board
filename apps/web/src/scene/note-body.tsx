// SPDX-License-Identifier: Apache-2.0
import { Group, Line, Rect, Text } from "react-konva";
import type { RectangleItem as Item } from "nextphase-board-rules/document.ts";
import { TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { objectType } from "nextphase-board-rules/objects/registry.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";
import { lineOffset, type LinkSpan, type RunLine } from "../text-runs";
import type { View } from "../view";

export type ObjectLayout = {
  connector?: import("../connectors").ConnectorLayout;
  height: number;
  runs: RunLine[] | null;
  links: LinkSpan[];
  limited: boolean;
  fadeStart: number;
  fadeEnd: number;
};

type Props = {
  o: Item;
  layout: ObjectLayout;
  selected: Set<string>;
  inline: boolean;
  view: View;
  pixelScale: number;
};

export function NoteBody({ o, layout, selected, inline, view, pixelScale }: Props) {
  const font = textUnits(o.textSize), thickness = Math.max(1, Math.round(font * pixelScale / 16)) / pixelScale;
  return (
    <Group>
      <Rect
        x={o.x}
        y={o.y}
        width={o.width}
        height={layout.height}
        fill={objectType(o.type).fill(o)}
        stroke={selected.has(o.id)
          ? "#518de0"
          : objectType(o.type).edge(o)}
        strokeWidth={selected.has(o.id) ? 2 / view.z : 1}
      />
      {!(inline && selected.has(o.id)) && layout.height > 2 * TEXT_INSET &&
        o.width > 2 * TEXT_INSET && (
        <Group
          clipX={o.x + TEXT_INSET}
          clipY={o.y + TEXT_INSET}
          clipWidth={o.width - 2 * TEXT_INSET}
          clipHeight={layout.height - 2 * TEXT_INSET}
        >
          {layout.runs === null ? <Text
            {...TEXT_LAYOUT}
            fontSize={textUnits(o.textSize)}
            align={o.align}
            x={o.x + TEXT_INSET}
            y={o.y + TEXT_INSET}
            width={o.width - 2 * TEXT_INSET}
            height={layout.height - 2 * TEXT_INSET}
            text={o.text}
            fill={objectType(o.type).textColor(o)}
            fillPriority={layout.limited ? "linear-gradient" : "color"}
            fillLinearGradientStartPoint={{ x: 0, y: layout.fadeStart }}
            fillLinearGradientEndPoint={{ x: 0, y: layout.fadeEnd }}
            fillLinearGradientColorStops={[0, objectType(o.type).textColor(o), 1, objectType(o.type).textColor(o) + "00"]}
          /> : layout.runs.map((line, i) => line.pieces.map((piece, j) => <Text
            key={i + ":" + j}
            fontFamily={TEXT_LAYOUT.fontFamily}
            lineHeight={TEXT_LAYOUT.lineHeight}
            fontSize={textUnits(o.textSize)}
            fontStyle={piece.style.italic ? piece.style.bold ? "italic bold" : "italic" : piece.style.bold ? "bold" : "normal"}
            textDecoration={piece.style.strike ? "line-through" : ""}
            x={o.x + TEXT_INSET + lineOffset(o.align, o.width - 2 * TEXT_INSET, line.width) + piece.x}
            y={o.y + TEXT_INSET + i * textUnits(o.textSize) * TEXT_LAYOUT.lineHeight}
            text={piece.text}
            fill={objectType(o.type).textColor(o)}
            fillPriority={layout.limited ? "linear-gradient" : "color"}
            fillLinearGradientStartPoint={{ x: 0, y: layout.fadeStart - i * textUnits(o.textSize) * TEXT_LAYOUT.lineHeight }}
            fillLinearGradientEndPoint={{ x: 0, y: layout.fadeEnd - i * textUnits(o.textSize) * TEXT_LAYOUT.lineHeight }}
            fillLinearGradientColorStops={[0, objectType(o.type).textColor(o), 1, objectType(o.type).textColor(o) + "00"]}
          />))}
          {layout.links.map(span => {
            const x = o.x + TEXT_INSET + lineOffset(o.align, o.width - 2 * TEXT_INSET, span.lineWidth) + span.x;
            const lineTop = o.y + TEXT_INSET + span.line * font * TEXT_LAYOUT.lineHeight;
            const y = lineTop + font * 1.45 / 2 + 0.47 * font + thickness / 2;
            return <Line key={`${span.line}:${span.start}`} points={[x, y, x + span.width, y]}
              stroke={objectType(o.type).textColor(o)} strokeWidth={thickness} lineCap="butt" listening={false} />;
          })}
        </Group>
      )}
    </Group>
  );
}
