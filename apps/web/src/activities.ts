// SPDX-License-Identifier: Apache-2.0
import { readBoardFile } from "./board-file.ts";
import { upgrade, type BoardV7, type ItemV7, type BoardV10, type ItemV10 } from "nextphase-board-rules/document.ts";
import { copyObjects } from "./clipboard.ts";
import { hasEnds, hasRectangle, isContainer, rectangleType } from "nextphase-board-rules/objects/registry.ts";
import type { View } from "./view.ts";

export type Activity = { name: string; file: string };
export type Box = { left: number; top: number; right: number; bottom: number };
type Size = { w: number; h: number };
export type Preview = {
  viewBox: string; preserveAspectRatio: "xMidYMid meet";
  rectangles: { id: string; x: number; y: number; width: number; height: number; fill: string; stroke: string }[];
  lines: { id: string; x1: number; y1: number; x2: number; y2: number; stroke: string }[];
};

export async function readActivity(entry: Activity): Promise<BoardV7> {
  const bytes = new TextEncoder().encode(entry.file);
  const board = await readBoardFile({ size: bytes.byteLength, arrayBuffer: async () => bytes.buffer });
  if (board.schemaVersion !== 7 || board.objects.length < 1 || board.objects.length > 40 || board.title !== entry.name) {
    throw Error("it is not a valid board");
  }
  return board as BoardV7;
}

export function activityBox(objects: readonly (ItemV7 | ItemV10)[]): Box | null {
  const rectangles = objects.filter(hasRectangle);
  return rectangles.length ? {
    left: Math.min(...rectangles.map((o) => o.x)), top: Math.min(...rectangles.map((o) => o.y)),
    right: Math.max(...rectangles.map((o) => o.x + o.width)), bottom: Math.max(...rectangles.map((o) => o.y + o.height)),
  } : null;
}

export function activityView(box: Box, current: View, size: Size): View {
  const fits = (zoom: number) => (box.right - box.left) * zoom + 96 <= size.w &&
    (box.bottom - box.top) * zoom + 96 <= size.h;
  let z = current.z;
  if (!fits(z)) {
    z = .5;
    for (let step = 1.75; step >= .5; step -= .25) {
      if (step < current.z && fits(step)) { z = step; break; }
    }
  }
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2, z };
}

export function insertActivity(board: BoardV10, activity: BoardV7, view: View, size: Size) {
  const box = activityBox(activity.objects)!, existing = activityBox(board.objects);
  const dx = existing ? existing.right + 120 - box.left : view.x - (box.left + box.right) / 2;
  const dy = existing ? existing.top - box.top : view.y - (box.top + box.bottom) / 2;
  const next = copyObjects(board, {
    objects: upgrade(activity).objects.map(({ generation: _generation, order: _order, ...o }) => ({
      ...structuredClone(o),
    })),
    sourceIdentifiers: [activity.boardId, ...activity.retiredGenerations,
      ...activity.objects.flatMap((o) => [o.id, o.generation, ...(o.group ? [o.group] : [])])],
  }, dx, dy);
  const existingIds = new Set(board.objects.map((o) => o.id));
  const added = next.objects.filter((o) => !existingIds.has(o.id));
  return { board: next, ids: added.map((o) => o.id), view: activityView(activityBox(added)!, view, size) };
}

export function activityPreview(objects: readonly ItemV7[]): Preview {
  const box = activityBox(objects)!;
  const rectangles = objects.filter(hasRectangle);
  return {
    viewBox: `${box.left - 40} ${box.top - 40} ${box.right - box.left + 80} ${box.bottom - box.top + 80}`,
    preserveAspectRatio: "xMidYMid meet",
    rectangles: rectangles.map((o) => {
      const style = rectangleType(o.type), fill = style.fill(o), edge = style.edge(o);
      return { id: o.id, x: o.x, y: o.y, width: o.width, height: o.height,
        fill: isContainer(o) ? "#f0eff3" : fill ?? "none",
        stroke: isContainer(o) ? "#dbd9df" : fill ? "none" : edge ?? "#dedede" };
    }),
    lines: objects.filter(hasEnds).map((o) => {
      const from = rectangles.find((r) => r.id === o.from.object)!, to = rectangles.find((r) => r.id === o.to.object)!;
      return { id: o.id, x1: from.x + from.width / 2, y1: from.y + from.height / 2,
        x2: to.x + to.width / 2, y2: to.y + to.height / 2, stroke: "#6b6b6b" };
    }),
  };
}
