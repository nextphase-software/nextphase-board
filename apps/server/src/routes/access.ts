// SPDX-License-Identifier: Apache-2.0
import { fanout } from "../fanout.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, body, id, role, shape, type ServerApp } from "./common.ts";
export function accessRoutes(app: ServerApp, runtime: Runtime) {
  for (const collection of ["members", "grants", "invitations"] as const) {
    app.get(`/workspaces/:workspace/${collection}`, async (c) => {
      const workspace = id(c, "workspace");
      await authorize(runtime, c.get("person").id, workspace, "workspace", "owner");
      let rows;
      if (collection === "grants") {
        const boards = await runtime.db.rows("boards", { workspace_id: workspace });
        rows = (await Promise.all(boards.map((board) => runtime.db.rows("board_grants", { board_id: board.id })))).flat();
      } else rows = await runtime.db.rows(collection === "members" ? "workspace_members" : "invitations", { workspace_id: workspace });
      const people = collection === "invitations" ? [] : await runtime.db.rows("people");
      return c.json({ [collection]: rows.map((row) => collection === "invitations" ? {
        id: row.id, boardId: row.board_id, email: row.email, role: row.role,
        createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(),
        acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
        cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
      } : { ...(collection === "grants" ? { boardId: row.board_id } : {}),
        personId: row.person_id, email: people.find((person) => person.id === row.person_id)?.email, role: row.role }) });
    });
  }
  app.put("/workspaces/:workspace/members/:person", async (c) => {
    const workspace = id(c, "workspace"), person = id(c, "person");
    await authorize(runtime, c.get("person").id, workspace, "workspace", "owner");
    const value = await body(c); shape(value, ["role"]);
    const offered = role(value.role, false);
    await runtime.db.rpc("write_member_role", { workspace, person, role: offered });
    await fanout(runtime, workspace, null);
    return c.json({ personId: person, role: offered });
  });
  app.put("/boards/:board/grants/:person", async (c) => {
    const board = id(c, "board"), person = id(c, "person");
    await authorize(runtime, c.get("person").id, board, "board", "owner");
    const value = await body(c); shape(value, ["role"]);
    const offered = role(value.role, true);
    await runtime.db.rpc("write_board_grant", { board, person, role: offered });
    await fanout(runtime, (await runtime.db.board(board))!.workspaceId, board);
    return c.json({ boardId: board, personId: person, role: offered });
  });
}
