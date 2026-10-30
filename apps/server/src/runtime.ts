// SPDX-License-Identifier: Apache-2.0
import type { Person } from "nextphase-board-room/protocol.ts";
import type { Auth } from "./auth.ts";
import type { Supabase } from "./supabase.ts";
export interface RoomClient {
  ticket(person: Person): Promise<{ ticket: string; expiresAt: number }>;
  export(person: Person): Promise<string>;
  changed(): Promise<void>;
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
  upgrade(board: string, ticket: string, request: Request): Promise<Response>;
}
export type AppVariables = { person: Person };
