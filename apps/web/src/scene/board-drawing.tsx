// SPDX-License-Identifier: Apache-2.0
import type { ConnectionDrag } from "../connection-drag";
import { reconnectPreview } from "../connectors";
import { Group, Layer, Stage } from "react-konva";
import type { Ref } from "react";
import type Konva from "konva";
import type { BoardV12 as Board } from "nextphase-board-rules/document.ts";
import type { View } from "../view";
import { bandOrder, dropTargets } from "../sections";
import { isTape, isTable, type TapeKeys, isImage, objectType, hasRectangle, hasText, hasPoints, type StrokeKeys, type Rectangle, hasEnds, orderBand, isMindNode } from "nextphase-board-rules/objects/registry.ts";
import { hiddenIds } from "../mind-map";
import type { MapDrag } from "../gesture";
import { MindNodeBody } from "./mind-node-body";
import { MindMapLayer } from "./mind-map-layer";
import { TapeBody } from "./tape-body";
import { StrokeBody } from "./stroke-body";
import { ConnectorBody } from "./connector-body";
import { ShapeBody } from "./shape-body";
import { SectionBody, SectionDropHint } from "./section-body";
import { NoteBody, type ObjectLayout } from "./note-body";

import { ImageBody } from "./image-body";

import { TableBody, TableGhostBody } from "./table-body";
import type { CellSelection, TableSelection, TableGhost, TableBorder, TableLayout } from "../table";

type Props = {
  stageRef?: Ref<Konva.Stage>;
  only?: ReadonlySet<string>;
  tableGesture: { ghost: TableGhost | null; border?: TableBorder };
  tableSelection?: TableSelection;
  tableCell?: CellSelection;
  faded: ReadonlySet<string>;
  bitmaps: ReadonlyMap<string, ImageBitmap>;
  connection?: ConnectionDrag;
  preview: (Rectangle & StrokeKeys) | (Rectangle & TapeKeys) | { mapDrag: MapDrag } | null;
  size: { w: number; h: number };
  view: View;
  board: Board;
  objectLayouts: Map<string, ObjectLayout & { table?: TableLayout }>;
  selected: Set<string>;
  inline: boolean;
  movingIds: readonly string[];
};

export function BoardDrawing({ tableGesture, tableSelection, tableCell, faded, bitmaps, connection, preview, size, view, board, objectLayouts, selected, inline, movingIds, stageRef, only }: Props) {
  const rectangles = new Map(board.objects.filter(hasRectangle).map((o) => [o.id, { ...o, displayHeight: objectLayouts.get(o.id)!.height }]));
  const targets = dropTargets(board, new Set(movingIds), true, objectLayouts);
  const sections = new Set([...targets.values()].filter((id) => id !== null));
  const hidden = hiddenIds(board.objects), drag = preview && "mapDrag" in preview ? preview.mapDrag : undefined;
  const map = (pass: "lines" | "over") => <MindMapLayer only={only} key={pass} pass={pass} objects={board.objects} hidden={hidden} selected={selected} drag={drag} view={view} size={size} />;
  return (
    <Stage ref={stageRef} width={size.w} height={size.h} listening={false}>
      <Layer
        x={size.w / 2 - view.x * view.z}
        y={size.h / 2 - view.y * view.z}
        scaleX={view.z}
        scaleY={view.z}
      >
        {[0, 1, 1, 2].flatMap((band, pass) => [...pass === 3 ? [map("lines")] : [], ...bandOrder(board.objects).filter((o) => orderBand(o) === band && !hidden.has(o.id) && (!only || only.has(o.id))).map((o) => {
          const layout = objectLayouts.get(o.id)!;
          const fade = (body: React.ReactNode) => faded.has(o.id) ? <Group key={o.id + pass} opacity={0.4}>{body}</Group> : body;
          if (hasEnds(o)) return fade(<ConnectorBody key={o.id + pass} object={o} layout={connection?.reconnect?.id === o.id ? reconnectPreview(o, connection.reconnect.end, connection.pointer, connection.side ?? "auto", rectangles, () => layout.connector!.labelBox.width - 24) : layout.connector!}
            selected={selected.has(o.id)} inline={inline} zoom={view.z} pass={pass === 1 ? "line" : "label"} />);
          if (isImage(o)) return fade(<ImageBody key={o.id} object={o} bitmap={bitmaps.get(o.asset)} selected={selected.has(o.id)} zoom={view.z} />);
          if (isTable(o)) return fade(<TableBody key={o.id} object={o} layout={layout.table!}
            selection={tableSelection?.id === o.id ? tableSelection : undefined} editing={tableCell}
            border={tableSelection?.id === o.id ? tableGesture.border : undefined} zoom={view.z} selected={selected.has(o.id)} />);
          if (isTape(o)) return fade(<TapeBody key={o.id} object={o} selected={selected.has(o.id)} zoom={view.z} />);
          if (hasPoints(o)) return fade(<StrokeBody key={o.id} object={o} selected={selected.has(o.id)} zoom={view.z} />);
          if (!hasRectangle(o)) return null;
          if (isMindNode(o)) return fade(<MindNodeBody key={o.id} o={o} layout={layout} editing={inline && selected.has(o.id)} zoom={view.z}
            outline={selected.has(o.id) && !drag?.branch.includes(o.id)} faded={!!drag?.branch.includes(o.id)} />);
          return fade(
            objectType(o.type).shapePaint ? <ShapeBody key={o.id} o={o} layout={layout} selected={selected} inline={inline} view={view} /> : objectType(o.type).body === "note" ? <NoteBody key={o.id} o={o} layout={layout} selected={selected} inline={inline} view={view} />
              : <SectionBody key={o.id} o={o} selected={selected} inline={inline} dropTarget={sections.has(o.id)} />
          );
        })])}
        {map("over")}
        {tableGesture.ghost && <TableGhostBody ghost={tableGesture.ghost} />}
        {[...sections].map((id) => <SectionDropHint key={id}
          section={board.objects.filter(hasRectangle).filter(hasText).find((o) => o.id === id)!}
          ideas={board.objects.filter(hasRectangle).filter((o) => targets.get(o.id) === id).map((o) =>
            ({ ...o, displayHeight: objectLayouts.get(o.id)!.height })) as Parameters<typeof SectionDropHint>[0]["ideas"]} />)}
        {preview && !("mapDrag" in preview) && ("pattern" in preview ? <TapeBody object={preview} zoom={view.z} /> : <StrokeBody object={preview} zoom={view.z} />)}
      </Layer>
    </Stage>
  );
}
