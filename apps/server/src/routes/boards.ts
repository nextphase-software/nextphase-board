// SPDX-License-Identifier: Apache-2.0
import { validTitle } from "../cursor.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import { boardDetails } from "../supabase.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, body, id, shape, type ServerApp } from "./common.ts";
export function boards(app: ServerApp, runtime: Runtime) {
  app.post("/workspaces/:workspace/boards", async (c) => {
    const workspace = id(c, "workspace"), person = c.get("person");
    await authorize(runtime, person.id, workspace, "workspace", "editor");
    const value = await body(c);
    shape(value, value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0 ? [] : ["title"]);
    const title = Object.keys(value).length ? value.title : "Untitled";
    if (!validTitle(title)) throw new RoomError(400, "bad_request");
    const row = await runtime.db.rpc("create_board", { workspace, person: person.id, title });
    return c.json(boardDetails(row), 201);
  });
  app.get("/boards/:board", async (c) => {
    const board = id(c, "board");
    const role = await authorize(runtime, c.get("person").id, board, "board");
    const details = await runtime.db.board(board);
    if (!details) throw new RoomError(404, "not_found");
    return c.json({ ...details, role });
  });
  app.post("/boards/:board/join-tickets", async (c) => c.json(await runtime.room(id(c, "board")).ticket(c.get("person")), 201));
  app.get("/boards/:board/join", async (c) => {
    const board = id(c, "board");
    if (c.req.header("Origin") !== runtime.allowedOrigin) throw new RoomError(403, "origin_not_allowed");
    return runtime.upgrade(board, c.req.query("ticket") ?? "", c.req.raw);
  });
  app.get("/boards/:board/export", async (c) => {
    const board = id(c, "board");
    const json = await runtime.room(board).export(c.get("person"));
    return new Response(json, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="board-${board}.json"` } });
  });
}
