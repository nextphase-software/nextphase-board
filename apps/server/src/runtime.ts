// SPDX-License-Identifier: Apache-2.0
import type { Person } from "nextphase-board-room/protocol.ts";
import type { Room } from "nextphase-board-room/room.ts";
import type { TemplateStore } from "nextphase-board-room/template-store.ts";
import type { AssetEntry } from "nextphase-board-room/pictures.ts";
import type { Auth } from "./auth.ts";
import type { Supabase } from "./supabase.ts";
import type { LinkPreview } from "./link-preview/fetcher.ts";
import type { LinkLimitsClient } from "./link-preview/limits.ts";
import type { ServerContext } from "./routes/common.ts";
export type LinkPreviewRuntime = {
  preview(url: string, startedAt: number): Promise<LinkPreview>;
  limits: LinkLimitsClient;
  clientAddress(context: ServerContext): string;
};
export type TeamTemplate = {
  id: string; name: string; description: string; creatorLabel: string; sourceTitle: string;
  objectCount: number; createdAt: string; updatedAt: string; canManage: boolean;
  objects: import("./templates.ts").TemplateObjects;
};
type ImportRoom = Pick<Room, "openImport" | "beginImport" | "endImport" | "stageImportPicture" |
  "stageImportVideo" | "claimImport" | "releaseImport" | "create" | "assetSizes">;
export type TemplateMediaClient = Pick<TemplateStore, "open" | "begin" | "end" | "stage" | "commit" | "read"> & {
  inventory(): Promise<AssetEntry[]>;
};
export interface RoomClient extends ImportRoom {
  admitLifecycle(request: import("nextphase-board-room/lifecycle.ts").LifecycleRequest): Promise<import("nextphase-board-room/lifecycle.ts").Lifecycle>;
  fenceLifecycle(row: import("nextphase-board-room/lifecycle.ts").Lifecycle, ready?: boolean): Promise<void>;
  versions(person: Person): Promise<any>;
  version(person: Person, id: string): Promise<any>;
  saveVersion(person: Person, value: import("nextphase-board-sync/history.ts").SaveVersion): Promise<any>;
  nameVersion(person: Person, id: string, value: { name: string; description: string }): Promise<any>;
  restoreVersion(person: Person, id: string, value: import("nextphase-board-sync/history.ts").RestoreVersion): Promise<any>;
  ticket(person: Person): Promise<{ ticket: string; expiresAt: number }>;
  rename(person: Person, title: string): Promise<{ id: string; title: string; revision: number }>;
  storePicture(person: Person, hash: string, bytes: Uint8Array, type: import("nextphase-board-room/pictures.ts").PictureType, width: number, height: number): Promise<"created" | "exists" | "full">;
  storeVideo: import("nextphase-board-room/room.ts").Room["storeVideo"];
  readVideo: import("nextphase-board-room/room.ts").Room["readVideo"];
  readPicture(person: Person, hash: string): Promise<{ type: string; bytes: Uint8Array<ArrayBuffer> } | null>;
  export(person: Person): Promise<string>;
  deliverNotices(): Promise<void>;
  discussion(person: Person, commentId: string, occurrence?: string): Promise<any>;
  changed(): Promise<number>;
  backup(): Promise<unknown>;
  restore(value: unknown): Promise<unknown>;
  restoreToTime?(bookmark: string): Promise<unknown>;
}
export interface Runtime {
  backupLimit: number;
  now(): number;
  fenceGeneration(board:string):Promise<number>;
  auth: Auth;
  db: Supabase;
  allowedOrigin: string;
  linkPreviewOrigins: readonly string[];
  linkPreview: LinkPreviewRuntime;
  operatorKey?: string;
  room(board: string): RoomClient;
  removeRoom(board: string, generation?: number): Promise<void>;
  templateMedia(upload: string): TemplateMediaClient;
  removeTemplateMedia(upload: string): Promise<void>;
  upgrade(board: string, ticket: string, request: Request): Promise<Response>;
}
export type AppVariables = { person: Person };
