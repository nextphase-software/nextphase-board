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
export type SavedBoard = { boardId: string; title: string; editedAt: number; generation: number; revision: number };
export interface BoardRows {
  copy(saved: Omit<SavedBoard, "editedAt"> & { editedAt: number | null }): Promise<void>;
  opened(person: string, board: string, at: number): Promise<void>;
}
export interface Background { run(task: Promise<void>): void }
export type MentionPerson = { id: string; person: string; label: string; lease: string; suffix: string };
export interface MentionSource {
  validTargets(board: string, targets: object[]): Promise<string[]>;
  roster(board: string, caller: string): Promise<MentionPerson[]>;
  project(board: string, generation: number, order: number, active: object[], creates: object[]): Promise<void>;
  documentGeneration?(board: string): Promise<number>;
  mentionGeneration?(board: string): Promise<number>;
  carryNotices?(board: string, from: number, to: number): Promise<void>;
  clearNotices(board: string, generation: number): Promise<void>;
}
export interface RoomEnvironment {
  mentions?: MentionSource;
  rows?: BoardRows;
  background?: Background;
  storage: Storage;
  access: AccessSource;
  now(): number;
  fence(): Promise<number>;
  raiseFence(minimum?: number): Promise<number>;
  hash(bytes: Uint8Array): Promise<string>;
  randomTicket(): string;
  randomId(): string;
  verify(token: string): Promise<Person>;
  connections(): Connection[];
  schedule(at: number | null): Promise<void>;
  backupLimit: number;
}
