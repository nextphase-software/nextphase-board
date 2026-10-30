// SPDX-License-Identifier: Apache-2.0
import { validText } from "nextphase-board-rules/document.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import { uuid } from "./routes/common.ts";
export type Sort = "edited" | "created" | "title";
export type Order = "asc" | "desc";
export type Cursor = { v: 1; workspace: string; sort: Sort; order: Order; id: string; key: string };
export function titleOrderKey(title: string) {
  return title.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}
export function validTitle(title: unknown): title is string {
  return typeof title === "string" && validText(title, 120, true) && !title.includes("\u0000");
}
export function listOrder(sort = "edited", order = "desc"): { sort: Sort; order: Order } {
  if (!["edited", "created", "title"].includes(sort) || !["asc", "desc"].includes(order)) throw new RoomError(400, "bad_request");
  return { sort: sort as Sort, order: order as Order };
}
export function encodeCursor(value: Cursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function validTime(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\+00$/.exec(key);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, fraction] = match;
  if (year === "0000" || fraction !== undefined && !/[1-9]/.test(fraction)) return false;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}
export function decodeCursor(text: string, workspace: string, sort: Sort, order: Order): Cursor {
  try {
    if (!text.length || text.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(text)) throw Error();
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join() !== "id,key,order,sort,v,workspace" || value.v !== 1 ||
      value.workspace !== workspace || value.sort !== sort || value.order !== order ||
      typeof value.id !== "string" || !uuid.test(value.id) || typeof value.key !== "string" ||
      !(sort === "title" ? validTitle(value.key) : validTime(value.key))) throw Error();
    // Reject noncanonical base64url encodings, including unused trailing bits.
    if (btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== text) throw Error();
    return value as Cursor;
  } catch { throw new RoomError(400, "bad_request"); }
}
