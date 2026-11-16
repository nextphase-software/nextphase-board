// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import type { BoardV13, ItemV13 } from "nextphase-board-rules/document.ts";
import { hasEnds, hasRectangle, hasText, objectType } from "nextphase-board-rules/objects/registry.ts";

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Y.AbstractType ||
    Object.keys(value).some((key) => !keys.includes(key))) throw Error("invalid_update");
  return value as Record<string, unknown>;
}

function map(value: unknown, keys: readonly string[]): Y.Map<unknown> {
  if (!(value instanceof Y.Map) || [...value._map.keys()].some((key) => !keys.includes(key))) {
    throw Error("invalid_update");
  }
  return value;
}

// Check the complete mapping before projecting it. Silently discarding an
// unknown field here would allow hidden data to live in an otherwise valid board.
export function readBoard(doc: Y.Doc): BoardV13 {
  if ([...doc.share.keys()].some((key) => !["board", "objects", "retired"].includes(key))) {
    throw Error("invalid_update");
  }
  const board = map(doc.getMap("board"), ["schemaVersion", "boardId", "title", "pages"]);
  const paged = board.get("schemaVersion") === 13;
  const objects = doc.getMap("objects");
  const retired = doc.getMap("retired");
  if ([...retired.values()].some((value) => value !== true)) throw Error("invalid_update");
  const items = [...objects.entries()].map(([id, value]) => {
    if (!(value instanceof Y.Map) || typeof value.get("type") !== "string") throw Error("invalid_update");
    const type = value.get("type") as ItemV13["type"];
    let record;
    try { record = objectType(type); } catch { throw Error("invalid_update"); }
    const object = { type };
    const keys = ["generation", "type", "order", "group", "section", ...(paged ? ["page"] : []), ...record.extraKeys];
    if (hasEnds(object)) {
      // The adapter groups ends and connector style into atomic values.
      keys.splice(paged ? 6 : 5);
      keys.push("ends", "connectorStyle");
    }
    if (hasRectangle(object)) keys.push("geometry");
    if (hasText(object)) keys.push("text", "style", "marks");
    const mapped = map(value, keys);
    const result: Record<string, unknown> = { id };
    for (const key of ["generation", "type", "order", "group", "section", ...(paged ? ["page"] : [])]) result[key] = mapped.get(key);
    if (hasEnds(object)) {
      const ends = exact(mapped.get("ends"), ["from", "to"]);
      result.from = exact(ends.from, ["object", "anchor"]);
      result.to = exact(ends.to, ["object", "anchor"]);
      Object.assign(result, exact(mapped.get("connectorStyle"), record.extraKeys.filter((key) => !["from", "to"].includes(key))));
    } else for (const key of record.extraKeys) result[key] = mapped.get(key);
    if (hasRectangle(object)) Object.assign(result, exact(mapped.get("geometry"), ["x", "y", "width", "height"]));
    if (hasText(object)) {
      const text = mapped.get("text");
      if (!(text instanceof Y.Text) || text.toDelta().some((part: { attributes?: unknown; insert?: unknown }) => part.attributes || typeof part.insert !== "string")) {
        throw Error("invalid_update");
      }
      result.text = text.toString();
      Object.assign(result, exact(mapped.get("style"), ["color", "textSize", "align"]));
      const marks = mapped.get("marks");
      if (!Array.isArray(marks)) throw Error("invalid_update");
      result.marks = marks.map((mark) => exact(mark, ["start", "end", "bold", "italic", "strike"]));
    }
    for (const key of ["fill", "border"] as const) {
      if (key in result) exact(result[key], key === "fill" ? ["mode", "color"] : ["style", "color"]);
    }
    return result as ItemV13;
  });
  return {
    schemaVersion: board.get("schemaVersion") as 13,
    boardId: board.get("boardId") as string,
    title: board.get("title") as string,
    ...(paged ? { pages: board.get("pages") as BoardV13["pages"] } : {}),
    objects: items.sort((a, b) => a.order - b.order),
    retiredGenerations: [...retired.keys()].sort(),
  } as BoardV13;
}
