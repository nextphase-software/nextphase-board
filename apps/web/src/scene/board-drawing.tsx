// SPDX-License-Identifier: Apache-2.0
import { Layer, Stage } from "react-konva";
import type { BoardV3 as Board } from "../document";
import type { View } from "../view";
import { NoteBody, type ObjectLayout } from "./note-body";

type Props = {
  size: { w: number; h: number };
  view: View;
  board: Board;
  objectLayouts: Map<string, ObjectLayout>;
  selected: Set<string>;
  inline: boolean;
};

export function BoardDrawing({ size, view, board, objectLayouts, selected, inline }: Props) {
  return (
    <Stage width={size.w} height={size.h} listening={false}>
      <Layer
        x={size.w / 2 - view.x * view.z}
        y={size.h / 2 - view.y * view.z}
        scaleX={view.z}
        scaleY={view.z}
      >
        {board.objects.map((o) => {
          const layout = objectLayouts.get(o.id)!;
          return (
            <NoteBody key={o.id} o={o} layout={layout} selected={selected} inline={inline} view={view} />
          );
        })}
      </Layer>
    </Stage>
  );
}
