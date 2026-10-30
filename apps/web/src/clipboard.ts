// SPDX-License-Identifier: Apache-2.0
import { freshIdentifier, type BoardV10, type ItemV10 } from "nextphase-board-rules/document.ts";
import { hasRectangle, hasText } from "nextphase-board-rules/objects/registry.ts";
import { editingCommandReason } from "./commands.ts";
import { wholeGroups } from "./group.ts";
import { bandOrder, remapSection } from "./sections.ts";
import type { DisplayObject } from "./selection.ts";

import { copiedSet, copiedSetReason, remapEnds } from "./connectors.ts";

import { pictureBytes, PICTURE_LIMIT, tabPictures, type Picture } from "./image-assets.ts";
export const PASTE_PICTURES_REASON = "Could not paste: the pictures would exceed the 50 MiB board limit.";
type CopiedItem<T> = T extends ItemV10 ? Omit<T, "generation" | "order"> : never;
export type ClipboardCommand = "Copy" | "Cut" | "Paste";
export type Snapshot = {
  objects: CopiedItem<ItemV10>[];
  sourceBox: { left: number; top: number; right: number; bottom: number };
  sourceIdentifiers: string[];
  pasteCount: number;
};
type EditingState = Parameters<typeof editingCommandReason>[0];
type PasteView = { centerX: number; centerY: number; zoom: number; width: number; height: number };

export function clipboardReason(command: ClipboardCommand, selected: ReadonlySet<string>,
  snapshot: Snapshot | null, state: EditingState, objects?: readonly ItemV10[]): string {
  const reason = editingCommandReason(command === "Copy" ? { ...state, readOnly: false } : state);
  if (reason) return reason;
  if (command !== "Paste" && objects && copiedSetReason(objects, selected)) return copiedSetReason(objects, selected);
  return command === "Paste" ? snapshot ? "" : "Nothing to paste."
    : selected.size ? "" : "Select an object to " + command.toLowerCase() + ".";
}

export function buildSnapshot(board: BoardV10, selected: ReadonlySet<string>,
  drawn: readonly DisplayObject[]): Snapshot | null {
  const copied = copiedSet(board.objects, selected);
  const objects = board.objects.filter((o) => copied.has(o.id)).sort((a, b) => a.order - b.order);
  if (!objects.length) return null;
  const groups = wholeGroups(board.objects, copied);
  const rectangles = new Map(drawn.map((o) => [o.id, o]));
  return {
    objects: objects.map((o) => {
      const { generation: _generation, order: _order, ...saved } = o;
      return {
        ...structuredClone(saved), section: o.section && copied.has(o.section) ? o.section : null,
        group: o.group !== null && groups.has(o.group) ? o.group : null,
      };
    }),
    sourceBox: {
      left: Math.min(...objects.map((o) => rectangles.get(o.id)!.x)),
      top: Math.min(...objects.map((o) => rectangles.get(o.id)!.y)),
      right: Math.max(...objects.map((o) => {
        const r = rectangles.get(o.id)!;
        return r.x + r.width;
      })),
      bottom: Math.max(...objects.map((o) => {
        const r = rectangles.get(o.id)!;
        return r.y + r.displayHeight;
      })),
    },
    sourceIdentifiers: [...new Set([...objects.flatMap((o) => [o.id, o.generation]), ...groups.keys()])],
    pasteCount: 0,
  };
}

export function plainText(snapshot: Snapshot): string {
  return snapshot.objects.filter(hasText).map((o) => o.text).filter((text) => text !== "").join("\n\n");
}

function bounded(position: number, length: number): number {
  let result = Math.max(-1e6, Math.min(position, 1e6 - length));
  if (result + length > 1e6) {
    // Here result is positive and near the upper board edge. Move one double
    // down at a time until the saved rectangle fits, without rounding to units.
    const bits = new DataView(new ArrayBuffer(8));
    do {
      bits.setFloat64(0, result);
      bits.setBigUint64(0, bits.getBigUint64(0) - 1n);
      result = bits.getFloat64(0);
    } while (result + length > 1e6);
  }
  return result;
}

export function buildPaste(board: BoardV10, snapshot: Snapshot, view: PasteView, pictures: ReadonlyMap<string, Picture> = tabPictures): {
  board: BoardV10; pasteCount: number;
} {
  if (board.objects.length + snapshot.objects.length > 250) throw Error("250 object limit reached");
  const pasteCount = snapshot.pasteCount + 1;
  const { left, right, top, bottom } = snapshot.sourceBox;
  const inView = view.centerX - view.width / (2 * view.zoom) <= left &&
    right <= view.centerX + view.width / (2 * view.zoom) &&
    view.centerY - view.height / (2 * view.zoom) <= top &&
    bottom <= view.centerY + view.height / (2 * view.zoom);
  const dx = inView ? 24 * pasteCount : view.centerX - (left + right) / 2;
  const dy = inView ? 24 * pasteCount : view.centerY - (top + bottom) / 2;
  const next = copyObjects(board, snapshot, dx, dy);
  if (pictureBytes(next, pictures) > PICTURE_LIMIT) throw Error(PASTE_PICTURES_REASON);
  return { board: next, pasteCount };
}

export function copyObjects(board: BoardV10, snapshot: Pick<Snapshot, "objects" | "sourceIdentifiers">,
  dx: number, dy: number): BoardV10 {
  if (board.objects.length + snapshot.objects.length > 250) throw Error("250 object limit reached");
  const reserved = [...snapshot.sourceIdentifiers];
  const fresh = () => {
    const id = freshIdentifier(board, reserved);
    reserved.push(id);
    return id;
  };
  const groups = new Map<string, string>();
  const ids = new Map(snapshot.objects.map((o) => [o.id, fresh()]));
  const copies = snapshot.objects.map((o, index) => {
    if (o.group !== null && !groups.has(o.group)) groups.set(o.group, fresh());
    return {
      ...remapEnds(o, ids), id: ids.get(o.id)!, generation: fresh(), section: remapSection(o.section, ids),
      group: o.group === null ? null : groups.get(o.group)!,
      ...(hasRectangle(o) ? { x: bounded(o.x + dx, o.width), y: bounded(o.y + dy, o.height) } : {}),
      order: board.objects.length + index,
    };
  });
  return { ...board, objects: bandOrder([...board.objects, ...copies]).map((o, order) => ({ ...o, order })) };
}
