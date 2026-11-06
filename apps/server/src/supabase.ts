// SPDX-License-Identifier: Apache-2.0
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RoomError, type Role } from "nextphase-board-room/protocol.ts";
import type { AccessPage, AccessSource, BoardDetails, BoardRows, SavedBoard } from "nextphase-board-room/interfaces.ts";
import type { Cursor, Sort, Order } from "./cursor.ts";
export type RecordRow = Record<string, any>;
import { duplicateSuffixes } from "nextphase-board-sync/mentions.ts";
import { labelOf } from "nextphase-board-room/tickets.ts";
export class Supabase implements AccessSource, BoardRows {
  client: SupabaseClient;
  constructor(url: string, serviceKey: string, fetcher = fetch) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (url, init) => fetcher(url, { ...init, signal: AbortSignal.timeout(3000) }) },
    });
  }
  async rpc<T = any>(name: string, parameters: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.schema("nextphase_board").rpc(name, parameters);
    if (error) {
      const statuses: Record<string, number> = { owner_row_immutable: 409, guest_has_grants: 409,
        account_disabled: 403, person_not_found: 404,
        not_found: 404, invitation_email_mismatch: 403, invitation_expired: 410, invitation_used: 410,
        invitation_cancelled: 410, bad_request: 400 };
      if (statuses[error.message]) throw new RoomError(statuses[error.message], error.message);
      throw new RoomError(503, "service_unavailable");
    }
    return data as T;
  }
  async rows(table: string, filters: Record<string, string> = {}): Promise<RecordRow[]> {
    let query = this.client.schema("nextphase_board").from(table).select("*");
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const { data, error } = await query;
    if (error) throw new RoomError(503, "service_unavailable");
    return data ?? [];
  }
  async deleteBoard(id: string): Promise<void> {
    const { error } = await this.client.schema("nextphase_board").from("boards").delete().eq("id", id);
    if (error) throw new RoomError(503, "service_unavailable");
  }
  async board(id: string): Promise<BoardDetails | null> {
    const row = (await this.rows("boards", { id }))[0];
    return row ? boardDetails(row) : null;
  }
  role(person: string, board: string): Promise<Role | null> { return this.rpc("board_role", { person, board }); }
  changes(board: string, after: number): Promise<AccessPage> { return this.rpc("access_changes_after", { board, after }); }
  async workspaceRole(person: string, workspace: string): Promise<string | null> {
    return (await this.workspaces(person)).find((row) => row.id === workspace)?.role ?? null;
  }
  async copy(saved: Omit<SavedBoard, "editedAt"> & { editedAt: number | null }): Promise<void> {
    await this.rpc("copy_saved_board", { board: saved.boardId, title: saved.title,
      edited_at: saved.editedAt === null ? null : new Date(saved.editedAt).toISOString(),
      generation: saved.generation, revision: saved.revision });
  }
  async opened(person: string, board: string, at: number): Promise<void> {
    await this.rpc("record_board_open", { person, board, opened_at: new Date(at).toISOString() });
  }
  workspaces(person: string): Promise<RecordRow[]> { return this.rpc("list_workspaces", { person }); }
  boards(person: string, workspace: string, sort: Sort, direction: Order, after?: Cursor): Promise<RecordRow[]> {
    return this.rpc("list_boards", { person, workspace, sort, direction, after_key: after?.key ?? null, after_id: after?.id ?? null });
  }
  recentBoards(person: string): Promise<RecordRow[]> { return this.rpc("list_recent_boards", { person }); }
  validTargets(board: string, targets: object[]): Promise<string[]> { return this.rpc("valid_mention_targets", { board, targets }); }
  async roster(board: string, caller: string) {
    const rows = await this.rpc<RecordRow[]>("mention_roster", { board, caller });
    const people = await Promise.all(rows.map(async row => {
      let label: string; try { label = labelOf(row.email); } catch { return null; }
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`presence:${board}:${row.id}`));
      const person = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("").slice(0,32);
      return { id: String(row.id), lease: String(row.lease), person, label };
    }));
    return duplicateSuffixes(people.filter((p): p is NonNullable<typeof p> => p !== null));
  }
  async project(board: string, generation: number, order: number, active: object[], creates: object[]) {
    await this.rpc("project_mentions", { board, generation, source_order: order, active, creates });
  }
  async documentGeneration(board: string): Promise<number> {
    const row = (await this.rows("boards", { id: board }))[0];
    if (!row) throw new RoomError(503, "service_unavailable");
    return checkpointGeneration(row.document_generation);
  }
  async mentionGeneration(board: string): Promise<number> {
    const row = (await this.rows("mention_delivery", { board_id: board }))[0];
    return row ? checkpointGeneration(row.generation) : 0;
  }
  async clearNotices(board: string, generation: number) { await this.rpc("clear_board_mentions", { board, generation }); }
  async account(email: string) {
    for (let page = 1; ; page++) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new RoomError(503, "service_unavailable");
      const person = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
      if (person) {
        await this.rpc("remember_person", { person: person.id, email: person.email });
        return person;
      }
      if (data.users.length < 1000) break;
    }
    const { data, error } = await this.client.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw new RoomError(503, "service_unavailable");
    await this.rpc("remember_person", { person: data.user.id, email: data.user.email });
    return data.user;
  }
}
export function boardDetails(row: RecordRow): BoardDetails {
  return { id: row.id, workspaceId: row.workspace_id, title: row.title, createdAt: new Date(row.created_at).toISOString() };
}
export function invitationDetails(row: RecordRow) {
  return { id: row.id, workspaceId: row.workspace_id, boardId: row.board_id, email: row.email,
    role: row.role, expiresAt: new Date(row.expires_at).toISOString() };
}

function checkpointGeneration(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new RoomError(503, "service_unavailable");
  return value;
}
