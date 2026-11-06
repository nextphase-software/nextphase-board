// SPDX-License-Identifier: Apache-2.0
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import type { Person } from "nextphase-board-room/protocol.ts";
import type { Auth } from "./auth.ts";
import type { Supabase } from "./supabase.ts";
export interface RoomClient {
  versions(person: Person): Promise<any>;
  version(person: Person, id: string): Promise<any>;
  saveVersion(person: Person, value: import("nextphase-board-sync/history.ts").SaveVersion): Promise<any>;
  nameVersion(person: Person, id: string, value: { name: string; description: string }): Promise<any>;
  restoreVersion(person: Person, id: string, value: import("nextphase-board-sync/history.ts").RestoreVersion): Promise<any>;
  create(document: BoardV10): Promise<void>;
  ticket(person: Person): Promise<{ ticket: string; expiresAt: number }>;
  rename(person: Person, title: string): Promise<{ id: string; title: string; revision: number }>;
  export(person: Person): Promise<string>;
  deliverNotices(): Promise<void>;
  discussion(person: Person, commentId: string, occurrence?: string): Promise<any>;
  changed(): Promise<number>;
  backup(): Promise<unknown>;
  restore(value: unknown): Promise<unknown>;
  restoreToTime?(bookmark: string): Promise<unknown>;
}
export interface Runtime {
  auth: Auth;
  db: Supabase;
  allowedOrigin: string;
  operatorKey?: string;
  room(board: string): RoomClient;
  removeRoom(board: string): Promise<void>;
  upgrade(board: string, ticket: string, request: Request): Promise<Response>;
}
export type AppVariables = { person: Person };
