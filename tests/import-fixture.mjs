// SPDX-License-Identifier: Apache-2.0
import { add, canonical, empty } from "../packages/board-rules/src/document.ts";
import { defaultConnectorStyle } from "../packages/board-rules/src/objects/connector.ts";

export function richBoard() {
  let board = { ...empty(), title: "Launch plan", retiredGenerations: [crypto.randomUUID()] };
  board = add(board, "section", 400, 250);
  board.objects[0].text = "Release";
  for (const type of ["sticky", "text", "shape"]) board = add(board, type, board.objects.length * 250, 250);
  const group = crypto.randomUUID(), section = board.objects[0].id;
  for (const object of board.objects.slice(1)) { object.group = group; object.section = section; }
  board.objects[1].text = "Customer interviews";
  board.objects[2].text = "Line one\nLine two 😀";
  board.objects.push({ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "connector", text: "Next",
    color: "neutral", textSize: "medium", align: "center", group: null, marks: [], section: null,
    from: { object: board.objects[1].id, anchor: "right" }, to: { object: board.objects[3].id, anchor: "left" },
    ...defaultConnectorStyle(), order: board.objects.length });
  board.objects.push({ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "stroke", kind: "marker",
    color: "black", weight: "thin", group: null, section: null, x: 0, y: 500, width: 104, height: 54,
    points: [[2, 2], [102, 52]], order: board.objects.length });
  return JSON.parse(canonical(board));
}

// Long drawing coordinates reach the canonical byte boundary within 250 objects.
// Canonicalize the small skeleton first, so an over-limit fixture can still be serialized.
export function sizedBoard(bytes = 2097152, version = 10) {
  let board = richBoard();
  board.title = "Sized";
  board.objects[2].text = "";
  for (let index = 0; index < 150; index++) {
    board.objects.push({ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "stroke", kind: "marker",
      color: "black", weight: "thin", group: null, section: null, x: 0, y: 0, width: 1000000, height: 1000000,
      points: [...Array.from({ length: 999 }, () => [2, 2]), [999998, 999998]], order: board.objects.length });
  }
  board.schemaVersion = version;
  if (version === 8) {
    const connector = board.objects.find((object) => object.type === "connector");
    for (const key of ["lineColor", "lineWeight", "lineDash", "startHead", "endHead", "lineShape"]) delete connector[key];
    connector.from.anchor = "auto"; connector.to.anchor = "auto";
  }
  board = JSON.parse(canonical(board));
  let remaining = bytes - new TextEncoder().encode(JSON.stringify(board)).length;
  for (const object of board.objects.slice(6)) for (const point of object.points.slice(1, -1)) {
    for (const axis of [0, 1]) if (remaining >= 5) { point[axis] = 999998; remaining -= 5; }
  }
  board.objects[2].text = "x".repeat(remaining);
  if (new TextEncoder().encode(JSON.stringify(board)).length !== bytes) throw Error("Cannot make the requested fixture size");
  return board;
}

export function imageBoard(asset = "0".repeat(64)) {
  return { ...empty(), title: "Mood photos", objects: [{ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "image",
    group: null, section: null, asset, pixelWidth: 2, pixelHeight: 2, description: "Synthetic picture",
    x: 0, y: 0, width: 2, height: 2, order: 0 }] };
}
