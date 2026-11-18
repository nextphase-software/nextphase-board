// SPDX-License-Identifier: Apache-2.0
import { Group, Line, Rect, Text } from "react-konva";
import type { TableItem } from "nextphase-board-rules/document.ts";
import { cellKey, COLUMN_WIDTH, ROW_HEIGHT } from "nextphase-board-rules/objects/registry.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";
import { cellBox, TABLE_LEVEL, cellLineHeight, selectionBox, tableBorders, TABLE_INSET,
  type TableLayout, type TableSelection, type TableBorder, type TableGhost, type CellSelection } from "../table";

const grid = "#d9dfe7";
const selectionInk = "#518de0";

export function TableBody({ object, layout, selection, editing, border, zoom, selected }: {
  object: TableItem; layout: TableLayout; selection?: TableSelection; editing?: CellSelection;
  border?: TableBorder; zoom: number; selected: boolean;
}) {
  const { box } = layout;
  const fontSize = textUnits(object.textSize), textLine = cellLineHeight(fontSize);
  const outline = selection ? selectionBox(object, layout, selection) : selected ? box : undefined;
  const size = selection && selection.kind !== TABLE_LEVEL ? 2 : 1;
  const editingKey = editing?.id === object.id ? cellKey(editing) : "";
  return <Group>
    <Rect {...box} cornerRadius={12} fill="#ffffff" stroke={grid} strokeWidth={1} />
    {tableBorders(object, layout).filter(b => b.index < (b.axis === "row" ? object.rows.length : object.columns.length) - 1).map(b =>
      <Line key={b.id} points={b.axis === "row" ? [box.x, b.edge, box.x + box.width, b.edge] :
        [b.edge, box.y, b.edge, box.y + box.height]} stroke={grid} strokeWidth={1} />)}
    {object.cells.filter(cell => cellKey(cell) !== editingKey).map(cell => {
      const b = cellBox(object, layout, cell)!;
      return <Text key={cellKey(cell)} x={b.x + TABLE_INSET} y={b.y + TABLE_INSET}
        width={b.width - TABLE_INSET * 2} fontFamily="system-ui" fontSize={fontSize} lineHeight={textLine / fontSize}
        fill="#28272c" wrap="word" text={cell.text} />;
    })}
    {outline && <Rect {...outline} stroke={editingKey ? "#7051cf" : selectionInk} strokeWidth={size / zoom} />}
    {border && <Line points={border.axis === "row" ? [box.x - 6 / zoom, border.edge, box.x + box.width + 6 / zoom, border.edge] :
      [border.edge, box.y - 6 / zoom, border.edge, box.y + box.height + 6 / zoom]} stroke={selectionInk} strokeWidth={2 / zoom} />}
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
