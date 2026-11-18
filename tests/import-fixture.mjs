// SPDX-License-Identifier: Apache-2.0
import { add, canonical, empty, payloadBytes } from "../packages/board-rules/src/document.ts";
import { defaultConnectorStyle } from "../packages/board-rules/src/objects/connector.ts";
import * as Y from "yjs";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";

export function withoutPages({ pages: _pages, ...board }) {
  return { ...board, objects: board.objects.map(({ page: _page, ...object }) => object) };
}
export function version13Board({ boardId, title, pages, objects, retiredGenerations }) {
  return { schemaVersion: 13, boardId, title, pages, objects, retiredGenerations };
}
export function storedBoardUpdate(board, legacyPages = board.schemaVersion < 13) {
  if (!legacyPages && board.schemaVersion !== 13) {
    const current = new Adapter();
    try { current.set(board); return Y.encodeStateAsUpdate(current.doc); }
    finally { current.destroy(); }
  }
  if (legacyPages && board.schemaVersion === 14) throw Error("Storage 7 cannot hold schema 14");
  const adapter = new Adapter(), doc = new Y.Doc();
  try {
    adapter.set(board);
    // A legacy snapshot never had page keys. Deleting them from a current map
    // leaves tombstones that the exact legacy codec correctly rejects on load.
    for (const [key, value] of adapter.doc.getMap("board")) if (!["pages", "pageMap"].includes(key)) {
      doc.getMap("board").set(key, key === "schemaVersion" ? board.schemaVersion : structuredClone(value));
    }
    if (board.schemaVersion === 13) {
      if (legacyPages) doc.getMap("board").set("pages", board.pages.map(p => ({ ...p })));
      else doc.getMap("board").set("pageMap", adapter.doc.getMap("board").get("pageMap").clone());
    }
    for (const [id, object] of adapter.doc.getMap("objects")) {
      doc.getMap("objects").set(id, new Y.Map([...object].filter(([key]) => board.schemaVersion === 13 || key !== "page")
        .map(([key, value]) => [key, value instanceof Y.Text ? value.clone() : structuredClone(value)])));
    }
    for (const [id, value] of adapter.doc.getMap("retired")) doc.getMap("retired").set(id, value);
    return Y.encodeStateAsUpdate(doc);
  } finally { adapter.destroy(); doc.destroy(); }
}

// The hosted chunking/rename checks need rich text whose Yjs form spans chunks.
export function largeTextBoard(boardId) {
  let board = { ...empty(), boardId, pages: [{ id: boardId, name: "Page 1" }], title: "Large" };
  for (let index = 0; index < 250; index++) board = add(board, "text", 0, 0);
  for (const object of board.objects) object.text = "x".repeat(1000);
  function marks(total) {
    board.objects.forEach((object, index) => {
      object.marks = Array.from({ length: Math.min(1000, Math.max(0, total - index * 1000)) }, (_, i) =>
        ({ start: i, end: i + 1, ...(i % 2 ? { italic: true } : { bold: true }) }));
    });
  }
  const size = () => new TextEncoder().encode(JSON.stringify(withoutPages(board))).length;
  let low = 0, high = 250000;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2); marks(middle);
    if (size() <= 2097152) low = middle; else high = middle - 1;
  }
  marks(low);
  const padding = 2097152 - size();
  if (padding < 0 || padding >= 1000) throw Error("Cannot pad the large text fixture");
  board.objects[249].text = "é".repeat(padding) + "x".repeat(1000 - padding);
  if (payloadBytes(canonical(board)) !== 2097152) throw Error("Cannot make the large text fixture size");
  return board;
}
export function richBoard() {
  let board = { ...empty(), title: "Launch plan", retiredGenerations: [crypto.randomUUID()] };
  board = add(board, "section", 400, 250);
  board.objects[0].text = "Release";
  for (const type of ["sticky", "text", "shape"]) board = add(board, type, board.objects.length * 250, 250);
  const group = crypto.randomUUID(), section = board.objects[0].id;
  for (const object of board.objects.slice(1)) { object.group = group; object.section = section; }
  board.objects[1].text = "Customer interviews";
  board.objects[2].text = "Line one\nLine two 😀";
  board.objects.push({ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "connector", page: board.boardId, text: "Next",
    color: "neutral", textSize: "medium", align: "center", group: null, marks: [], section: null,
    from: { object: board.objects[1].id, anchor: "right" }, to: { object: board.objects[3].id, anchor: "left" },
    ...defaultConnectorStyle(), order: board.objects.length });
  board.objects.push({ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "stroke", page: board.boardId, kind: "marker",
    color: "black", weight: "thin", group: null, section: null, x: 0, y: 500, width: 104, height: 54,
    points: [[2, 2], [102, 52]], order: board.objects.length });
  return JSON.parse(canonical(board));
}

// Long drawing coordinates reach the canonical byte boundary within 250 objects.
// Canonicalize the small skeleton first, so an over-limit fixture can still be serialized.
export function sizedBoard(bytes = 2097152, version = 14) {
  let board = richBoard();
  board.title = "Sized";
  board.objects[2].text = "";
  for (let index = 0; index < 150; index++) {
    board.objects.push({ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "stroke", page: board.boardId, kind: "marker",
      color: "black", weight: "thin", group: null, section: null, x: 0, y: 0, width: 1000000, height: 1000000,
      points: [...Array.from({ length: 999 }, () => [2, 2]), [999998, 999998]], order: board.objects.length });
  }
  if (version < 13) board = withoutPages(board);
  board.schemaVersion = version;
  if (version === 8) {
    const connector = board.objects.find((object) => object.type === "connector");
    for (const key of ["lineColor", "lineWeight", "lineDash", "startHead", "endHead", "lineShape"]) delete connector[key];
    connector.from.anchor = "auto"; connector.to.anchor = "auto";
  }
  board = JSON.parse(canonical(board));
  const measured = () => new TextEncoder().encode(JSON.stringify(version >= 13 ? withoutPages(board) : board)).length;
  let remaining = bytes - measured();
  for (const object of board.objects.slice(6)) for (const point of object.points.slice(1, -1)) {
    for (const axis of [0, 1]) if (remaining >= 5) { point[axis] = 999998; remaining -= 5; }
  }
  board.objects[2].text = "x".repeat(remaining);
  if (measured() !== bytes) throw Error("Cannot make the requested fixture size");
  return board;
}

export function imageBoard(asset = "0".repeat(64)) {
  const board = empty();
  return { ...board, title: "Mood photos", objects: [{ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "image", page: board.boardId,
    group: null, section: null, asset, pixelWidth: 2, pixelHeight: 2, description: "Synthetic picture",
    x: 0, y: 0, width: 2, height: 2, order: 0 }] };
}
