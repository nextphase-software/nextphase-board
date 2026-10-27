// SPDX-License-Identifier: Apache-2.0
import { Layer, Stage } from "react-konva";
import type { BoardV6 as Board } from "../document";
import type { View } from "../view";
import { bandOrder, dropTargets } from "../sections";
import { objectType } from "../objects/registry";
import { ShapeBody } from "./shape-body";
import { SectionBody, SectionDropHint } from "./section-body";
import { NoteBody, type ObjectLayout } from "./note-body";

type Props = {
  size: { w: number; h: number };
  view: View;
  board: Board;
  objectLayouts: Map<string, ObjectLayout>;
  selected: Set<string>;
  inline: boolean;
  movingIds: readonly string[];
};

export function BoardDrawing({ size, view, board, objectLayouts, selected, inline, movingIds }: Props) {
  const targets = dropTargets(board, new Set(movingIds), true);
  const sections = new Set([...targets.values()].filter((id) => id !== null));
  return (
    <Stage width={size.w} height={size.h} listening={false}>
      <Layer
        x={size.w / 2 - view.x * view.z}
        y={size.h / 2 - view.y * view.z}
        scaleX={view.z}
        scaleY={view.z}
      >
        {bandOrder(board.objects).map((o) => {
          const layout = objectLayouts.get(o.id)!;
          return (
            objectType(o.type).shapePaint ? <ShapeBody key={o.id} o={o} layout={layout} selected={selected} inline={inline} view={view} /> : objectType(o.type).body === "note" ? <NoteBody key={o.id} o={o} layout={layout} selected={selected} inline={inline} view={view} />
              : <SectionBody key={o.id} o={o} selected={selected} inline={inline} dropTarget={sections.has(o.id)} />
          );
        })}
        {[...sections].map((id) => <SectionDropHint key={id}
          section={board.objects.find((o) => o.id === id)!}
          ideas={board.objects.filter((o) => targets.get(o.id) === id).map((o) =>
            ({ ...o, displayHeight: objectLayouts.get(o.id)!.height }))} />)}
      </Layer>
    </Stage>
  );
}
