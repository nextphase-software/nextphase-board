// SPDX-License-Identifier: Apache-2.0
import { canonical, validate, type BoardV10 } from "nextphase-board-rules/document.ts";
import { validTitle } from "../cursor.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import { boardDetails } from "../supabase.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, body, id, shape, type ServerApp } from "./common.ts";
export function boards(app: ServerApp, runtime: Runtime) {
  app.post("/workspaces/:workspace/boards", async (c) => {
    const workspace = id(c, "workspace"), person = c.get("person");
    await authorize(runtime, person.id, workspace, "workspace", "editor");
    const value = await body(c, 13631488);
    const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
    const imported = keys.includes("document");
    shape(value, imported ? ["title", "document"] : keys.length ? ["title"] : []);
    const title = keys.length ? value.title : "Untitled";
    if (!validTitle(title)) throw new RoomError(400, "bad_request");
    let document: BoardV10 | undefined;
    if (imported) {
      try {
        const board = validate(value.document);
        if (board.schemaVersion !== 10) throw Error();
        document = board as BoardV10;
      } catch { throw new RoomError(400, "invalid_document"); }
      try {
        canonical(document);
        // UUIDs have the same byte length; check the stored title before creating a row.
        canonical({ ...document, title });
      } catch { throw new RoomError(400, "document_too_large"); }
      if (document.objects.some((object) => object.type === "image")) throw new RoomError(400, "images_not_supported");
    }
    const row = await runtime.db.rpc("create_board", { workspace, person: person.id, title });
    const details = boardDetails(row);
    if (document) {
      try { await runtime.room(details.id).create({ ...document, boardId: details.id, title }); }
      catch (error) {
        // Both compensations run even when the other one fails.
        const cleanup = await Promise.allSettled([
          runtime.db.deleteBoard(details.id), runtime.removeRoom(details.id),
        ]);
        if (cleanup.some((result) => result.status === "rejected")) throw new RoomError(503, "creation_cleanup_failed");
        if (error instanceof RoomError && error.status === 409 && error.message === "room_exists") throw error;
        throw new RoomError(503, "service_unavailable");
      }
    }
    return c.json(details, 201);
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
