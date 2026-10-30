// SPDX-License-Identifier: Apache-2.0
import { fromBase64, toBase64 } from "lib0/buffer";
export const MESSAGE_LIMIT = 1048576;
export const BACKUP_LIMIT = 16777216;
export type Role = "owner" | "editor" | "viewer";
export type Person = { id: string; email: string; expiresAt: number };
export type Attachment = Person & { connectionId: string; epoch: number };
export interface Connection {
  attachment(): Attachment;
  attach(value: Attachment): void;
  send(message: string): void;
  close(code: number): void;
}
export class RoomError extends Error {
  status: number;
  needed?: string;
  constructor(status: number, reason: string, needed?: string) {
    super(reason);
    this.status = status;
    this.needed = needed;
  }
}
export function errorBody(error: RoomError) {
  return { error: { reason: error.message, ...(error.needed ? { needed: error.needed } : {}) } };
}
export const bytes = (value: string) => new TextEncoder().encode(value);
export const base64 = (value: Uint8Array) => toBase64(value);
export function unbase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw Error("invalid_update");
  }
  const result = fromBase64(value);
  if (toBase64(result) !== value) throw Error("invalid_update");
  return result;
}
export function send(connection: Connection, message: object) {
  connection.send(JSON.stringify(message));
}
export const rank = (role: Role | null) => role === "owner" ? 3 : role === "editor" ? 2 : role === "viewer" ? 1 : 0;
