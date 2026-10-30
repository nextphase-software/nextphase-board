// SPDX-License-Identifier: Apache-2.0
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RoomError, type Role } from "nextphase-board-room/protocol.ts";
import type { AccessPage, AccessSource, BoardDetails, BoardRows, SavedBoard } from "nextphase-board-room/interfaces.ts";
import type { Cursor, Sort, Order } from "./cursor.ts";
export type RecordRow = Record<string, any>;
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
      const statuses: Record<string, number> = { lowering_not_offered: 409, person_not_found: 404,
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
  async board(id: string): Promise<BoardDetails | null> {
    const row = (await this.rows("boards", { id }))[0];
    return row ? boardDetails(row) : null;
  }
  role(person: string, board: string): Promise<Role | null> { return this.rpc("board_role", { person, board }); }
  changes(board: string, after: number): Promise<AccessPage> { return this.rpc("access_changes_after", { board, after }); }
  async workspaceRole(person: string, workspace: string): Promise<string | null> {
    const member = (await this.rows("workspace_members", { workspace_id: workspace, person_id: person }))[0];
    if (member?.role !== "guest") return member?.role ?? null;
    const boards = await this.rows("boards", { workspace_id: workspace });
    const granted = await this.rows("board_grants", { person_id: person });
    return granted.some((grant) => boards.some((board) => board.id === grant.board_id)) ? "guest" : null;
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
