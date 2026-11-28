// SPDX-License-Identifier: Apache-2.0
import { Group, Line, Rect, Text } from "react-konva";
import type { TableItem } from "nextphase-board-rules/document.ts";
import { cellKey, COLUMN_WIDTH, ROW_HEIGHT } from "nextphase-board-rules/objects/registry.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";
import { cellBox, TABLE_LEVEL, cellLineHeight, selectionOutlines, tableGridLines, TABLE_INSET,
  type TableLayout, type TableSelection, type TableBorder, type TableGhost, type CellSelection } from "../table";

import { dropLine, type TableDragDrawing } from "../table-arrange";

const grid = "#d9dfe7";
const selectionInk = "#518de0";

function cellTexts(object: TableItem, layout: TableLayout, keep: (cell: TableItem["cells"][number]) => boolean) {
  const fontSize = textUnits(object.textSize), textLine = cellLineHeight(fontSize);
  return object.cells.filter(keep).map(cell => {
    const b = cellBox(object, layout, cell)!;
    return <Text key={cellKey(cell)} x={b.x + TABLE_INSET} y={b.y + TABLE_INSET}
      width={b.width - TABLE_INSET * 2} fontFamily="system-ui" fontSize={fontSize} lineHeight={textLine / fontSize}
      fill="#28272c" wrap="word" text={cell.text} />;
  });
}

function runBox(object: TableItem, layout: TableLayout, drag: TableDragDrawing) {
  const selection: TableSelection = drag.axis === "row" ? { kind: "rows", id: object.id, rows: drag.ids, start: drag.ids[0] }
    : { kind: "columns", id: object.id, columns: drag.ids, start: drag.ids[0] };
  return selectionOutlines(object, layout, selection).boxes[0];
}

export function TableBody({ object, layout, selection, editing, border, zoom, selected, drag }: {
  object: TableItem; layout: TableLayout; selection?: TableSelection; editing?: CellSelection;
  border?: TableBorder; zoom: number; selected: boolean; drag?: TableDragDrawing;
}) {
  const { box } = layout, lines = tableGridLines(object, layout);
  const outlines = selection ? selectionOutlines(object, layout, selection) : { boxes: selected ? [box] : [], inner: [] };
  const size = selection && selection.kind !== TABLE_LEVEL ? 2 : 1;
  const editingKey = editing?.id === object.id ? cellKey(editing) : "";
  const faded = drag && runBox(object, layout, drag);
  const highlight = border && resizeLines(border, object, layout, lines, zoom);
  return <Group>
    <Rect {...box} cornerRadius={12} fill="#ffffff" stroke={grid} strokeWidth={1} />
    {lines.map(line => <Line key={line.id} points={line.points} stroke={grid} strokeWidth={1} />)}
    {cellTexts(object, layout, cell => cellKey(cell) !== editingKey)}
    {faded && <Rect x={faded.x + 1 / zoom} y={faded.y + 1 / zoom} width={faded.width - 2 / zoom} height={faded.height - 2 / zoom} fill="rgba(245,247,250,0.85)" />}
    {outlines.boxes.map(b => <Rect key={b.x + ":" + b.y} {...b} stroke={editingKey ? "#7051cf" : selectionInk} strokeWidth={size / zoom} />)}
    {outlines.inner.map((points, i) => <Line key={i} points={points} stroke="#8fbdf5" strokeWidth={1 / zoom} />)}
    {highlight?.map((points, i) => <Line key={i} points={points} stroke={selectionInk} strokeWidth={2 / zoom} />)}
    {drag && drag.gap !== undefined && <Line points={dropLine(object, layout, drag.axis, drag.gap, zoom)} stroke={selectionInk} strokeWidth={2 / zoom} />}
  </Group>;
}

function resizeLines(border: TableBorder, object: TableItem, layout: TableLayout, lines: ReturnType<typeof tableGridLines>, zoom: number) {
  const { x, y, width, height } = layout.box, row = border.axis === "row";
  const start = row ? x : y, end = row ? x + width : y + height, edge = border.edge;
  const line = (a: number, b: number) => row ? [a, edge, b, edge] : [edge, a, edge, b];
  const outer = border.index === (row ? object.rows.length : object.columns.length) - 1;
  if (outer) return [line(start - 6 / zoom, end + 6 / zoom)];
  return [line(start - 6 / zoom, start), ...lines.filter(l => l.id === border.id || l.id.startsWith(border.id + ":")).map(l => l.points),
    line(end, end + 6 / zoom)];
}

export function TableDragGhost({ object, layout, drag, zoom }: {
  object: TableItem; layout: TableLayout; drag: TableDragDrawing; zoom: number;
}) {
  const { x, y, width, height } = drag.ghost, source = runBox(object, layout, drag);
  return <Group x={x} y={y}>
    <Rect width={width} height={height} fill="rgba(255,255,255,0.92)" stroke={grid} strokeWidth={1 / zoom}
      shadowColor="rgb(20,18,26)" shadowOpacity={0.18} shadowBlur={24 / zoom} shadowOffsetY={8 / zoom} />
    <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      <Group x={-source.x} y={-source.y}>
        {tableGridLines(object, layout).map(line => <Line key={line.id} points={line.points} stroke={grid} strokeWidth={1 / zoom} />)}
        {cellTexts(object, layout, cell => drag.ids.includes(cell[drag.axis]))}
      </Group>
    </Group>
  </Group>;
}

export function TableGhostBody({ ghost }: { ghost: TableGhost }) {
  const { x, y, width, height, columns, rows } = ghost;
  return <Group opacity={0.55}>
    <Rect x={x} y={y} width={width} height={height} cornerRadius={12} fill="#ffffff" stroke={grid} strokeWidth={1} />
    {Array.from({ length: columns - 1 }, (_, i) => x + (i + 1) * COLUMN_WIDTH).map(edge =>
      <Line key={edge} points={[edge, y, edge, y + height]} stroke={grid} strokeWidth={1} />)}
    {Array.from({ length: rows - 1 }, (_, i) => y + (i + 1) * ROW_HEIGHT).map(edge =>
      <Line key={edge} points={[x, edge, x + width, edge]} stroke={grid} strokeWidth={1} />)}
  </Group>;
}
