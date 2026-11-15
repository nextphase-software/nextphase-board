// SPDX-License-Identifier: Apache-2.0
import { validate, validText, type BoardV12, type ItemV12 } from "nextphase-board-rules/document.ts";
import { isImage } from "nextphase-board-rules/objects/registry.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import { validTitle } from "./cursor.ts";

type Copied<T> = T extends ItemV12 ? Omit<T, "generation" | "order"> : never;
export type TemplateObjects = Copied<ItemV12>[];
export function templateDetails(name: unknown, description: unknown): { name: string; description: string } {
  if (!validTitle(name) || typeof description !== "string" || !validText(description, 300) || description.includes("\u0000")) {
    throw new RoomError(400, "bad_request");
  }
  return { name, description };
}
function containsNul(value: unknown): boolean {
  return typeof value === "string" ? value.includes("\u0000")
    : !!value && typeof value === "object" && Object.entries(value).some(([k, v]) => k.includes("\u0000") || containsNul(v));
}
export function templateObjects(value: unknown): { objects: TemplateObjects; objectCount: number; contentBytes: number } {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > 250 || containsNul(value) ||
      value.some(o => !o || typeof o !== "object" || Array.isArray(o) || "generation" in o || "order" in o || isImage(o))) throw Error();
    validate({ schemaVersion: 12, boardId: crypto.randomUUID(), title: "Template", retiredGenerations: [],
      objects: value.map((o, order) => ({ ...o, order, generation: crypto.randomUUID() })) }) as BoardV12;
  } catch { throw new RoomError(400, "bad_request"); }
  const contentBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (contentBytes > 262144) throw new RoomError(413, "template_too_large");
  return { objects: value as TemplateObjects, objectCount: (value as unknown[]).length, contentBytes };
}
