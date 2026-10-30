// SPDX-License-Identifier: Apache-2.0
import { RoomError } from "nextphase-board-room/protocol.ts";
import { fanout } from "../fanout.ts";
import { invitationDetails } from "../supabase.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, body, id, role, shape, type ServerApp } from "./common.ts";
export function invitations(app: ServerApp, runtime: Runtime) {
  for (const level of ["workspace", "board"] as const) {
    app.post(level === "board" ? "/boards/:board/invitations" : "/workspaces/:workspace/invitations", async (c) => {
      const target = id(c, level), person = c.get("person");
      await authorize(runtime, person.id, target, level, "owner");
      const value = await body(c); shape(value, ["email", "role"]);
      if (typeof value.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) throw new RoomError(400, "bad_request");
      const offered = role(value.role, level === "board");
      const workspace = level === "workspace" ? target : (await runtime.db.board(target))!.workspaceId;
      const row = await runtime.db.rpc("create_invitation", { workspace, board: level === "board" ? target : null,
        email: value.email.toLowerCase(), role: offered, by: person.id });
      let accountCreated = true;
      try { await runtime.db.account(value.email.toLowerCase()); } catch { accountCreated = false; }
      return c.json({ ...invitationDetails(row), accountCreated }, 201);
    });
  }
  app.delete("/invitations/:invitation", async (c) => {
    const invitation = id(c, "invitation");
    const row = (await runtime.db.rows("invitations", { id: invitation }))[0];
    if (!row) throw new RoomError(404, "not_found");
    await authorize(runtime, c.get("person").id, row.board_id ?? row.workspace_id, row.board_id ? "board" : "workspace", "owner");
    await runtime.db.rpc("cancel_invitation", { invitation });
    return c.body(null, 204);
  });
  app.post("/invitations/:invitation/accept", async (c) => {
    const invitation = id(c, "invitation"), person = c.get("person");
    const result = await runtime.db.rpc("accept_invitation", { invitation, person: person.id, email: person.email });
    await fanout(runtime, result.workspaceId, result.boardId);
    return c.json(result);
  });
}
