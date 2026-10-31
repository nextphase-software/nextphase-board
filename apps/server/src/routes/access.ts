// SPDX-License-Identifier: Apache-2.0
import { deliver, removal } from "../delivery.ts";
import type { Runtime } from "../runtime.ts";
import { accessList } from "./access-lists.ts";
import { authorize, body, id, role, shape, type ServerApp } from "./common.ts";
export function accessRoutes(app: ServerApp, runtime: Runtime) {
  for (const collection of ["members", "grants", "invitations"] as const) {
    app.get(`/workspaces/:workspace/${collection}`, async (c) => {
      const workspace = id(c, "workspace");
      await authorize(runtime, c.get("person").id, workspace, "workspace", "owner");
      if (collection !== "invitations") return c.json({ [collection]: await accessList(runtime, workspace, collection) });
      const rows = await runtime.db.rows("invitations", { workspace_id: workspace });
      return c.json({ invitations: rows.map((row) => ({
        id: row.id, boardId: row.board_id, email: row.email, role: row.role,
        createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(),
        acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
        cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
      })) });
    });
  }
  app.put("/workspaces/:workspace/members/:person", async (c) => {
    const workspace = id(c, "workspace"), person = id(c, "person");
    await authorize(runtime, c.get("person").id, workspace, "workspace", "owner");
    const value = await body(c); shape(value, ["role"]);
    const offered = role(value.role, false);
    await runtime.db.rpc("write_member_role", { workspace, person, role: offered });
    await deliver(runtime);
    return c.json({ personId: person, role: offered, removal: await removal(runtime, person, workspace) });
  });
  app.put("/boards/:board/grants/:person", async (c) => {
    const board = id(c, "board"), person = id(c, "person");
    await authorize(runtime, c.get("person").id, board, "board", "owner");
    const value = await body(c); shape(value, ["role"]);
    const offered = role(value.role, true);
    await runtime.db.rpc("write_board_grant", { board, person, role: offered });
    await deliver(runtime);
    return c.json({ boardId: board, personId: person, role: offered, removal: await removal(runtime, person, null, board) });
  });
  app.delete("/workspaces/:workspace/members/:person", async (c) => {
    const workspace = id(c, "workspace"), person = id(c, "person");
    await authorize(runtime, c.get("person").id, workspace, "workspace", "owner");
    await runtime.db.rpc("remove_member", { workspace, person });
    await deliver(runtime);
    return c.json({ personId: person, removal: await removal(runtime, person, workspace) });
  });
  app.delete("/boards/:board/grants/:person", async (c) => {
    const board = id(c, "board"), person = id(c, "person");
    await authorize(runtime, c.get("person").id, board, "board", "owner");
    await runtime.db.rpc("remove_grant", { board, person });
    await deliver(runtime);
    return c.json({ boardId: board, personId: person, removal: await removal(runtime, person, null, board) });
  });
}
