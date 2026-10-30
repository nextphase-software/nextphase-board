// SPDX-License-Identifier: Apache-2.0
import type { Connection, Person, Role } from "./protocol.ts";
import type { Storage } from "./storage.ts";
export type BoardDetails = { id: string; workspaceId: string; title: string; createdAt: string };
export type AccessChange = { number: number; personId: string };
export type AccessPage = { changes: AccessChange[]; latest: number; lowestKept: number };
export interface AccessSource {
  board(id: string): Promise<BoardDetails | null>;
  role(person: string, board: string): Promise<Role | null>;
  changes(board: string, after: number): Promise<AccessPage>;
}
export interface RoomEnvironment {
  storage: Storage;
  access: AccessSource;
  now(): number;
  fence(): Promise<number>;
  raiseFence(): Promise<number>;
  hash(bytes: Uint8Array): Promise<string>;
  randomTicket(): string;
  randomId(): string;
  verify(token: string): Promise<Person>;
  connections(): Connection[];
  schedule(at: number | null): Promise<void>;
  backupLimit: number;
}
