// SPDX-License-Identifier: Apache-2.0
import { removal } from "../delivery.ts";
import type { Runtime } from "../runtime.ts";
import type { RecordRow } from "../supabase.ts";

export async function accessList(runtime: Runtime, workspace: string, kind: "members" | "grants") {
  let rows: RecordRow[];
  if (kind === "members") rows = await runtime.db.rows("workspace_members", { workspace_id: workspace });
  else {
    const boards = await runtime.db.rows("boards", { workspace_id: workspace });
    rows = (await Promise.all(boards.map((board) => runtime.db.rows("board_grants", { board_id: board.id })))).flat();
  }
  const changes = await runtime.db.rows("access_changes", { workspace_id: workspace });
  const latest = new Map<string, RecordRow>();
  const key = (row: RecordRow) => row.person_id + (kind === "grants" ? "/" + row.board_id : "");
  for (const change of changes) {
    if (change.kind !== (kind === "members" ? "member" : "grant")) continue;
    if (Number(change.number) > Number(latest.get(key(change))?.number ?? 0)) latest.set(key(change), change);
  }
  const present = new Set(rows.map(key));
  // A deleted row remains visible to the owner until its scope has receipts.
  for (const [id, change] of latest) if (!present.has(id) && change.role === null) rows.push(change);
  const people = await runtime.db.rows("people");
  const result = await Promise.all(rows.map(async (row) => {
    const status = await removal(runtime, row.person_id, workspace, kind === "grants" ? row.board_id : null);
    if (row.role === null && status === "done") return null;
    return { ...(kind === "grants" ? { boardId: row.board_id } : {}), personId: row.person_id,
      email: people.find((person) => person.id === row.person_id)?.email, role: row.role, removal: status };
  }));
  return result.filter((row) => row !== null);
}
