// SPDX-License-Identifier: Apache-2.0
import { canonical, upgrade, validate, type BoardV14 } from "nextphase-board-rules/document.ts";
import { assetsOf } from "nextphase-board-rules/objects/registry.ts";
import { validTitle } from "../cursor.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import { boardDetails } from "../supabase.ts";
import type { Runtime } from "../runtime.ts";
import type { Person } from "nextphase-board-room/protocol.ts";
import { authorize, body, id, shape, uuid, type ServerApp } from "./common.ts";

async function finishImport(runtime: Runtime, workspace: string, board: string, person: Person, document: BoardV14) {
  const room = runtime.room(board);
  const token = await room.claimImport(person, workspace, document);
  const cleanup = async () => {
    try {
      // Keep the finishing mark available to the expiry alarm until SQL cleanup succeeds.
      await runtime.db.discardImport(board, workspace);
      await runtime.removeRoom(board);
    } catch {
      throw new RoomError(503, "creation_cleanup_failed");
    }
  };
  let details;
  try {
    details = boardDetails(await runtime.db.rpc("create_board", { workspace, person: person.id, title: document.title, board }));
  } catch (error) {
    if (error instanceof RoomError && ["not_found", "role_too_low", "import_in_progress"].includes(error.message)) {
      await room.releaseImport(token).catch(() => {});
      throw error;
    }
    await cleanup();
    throw new RoomError(503, "service_unavailable");
  }
  try { await room.create(document, person, token); }
  catch (error) {
    await cleanup();
    if (error instanceof RoomError && ["room_exists", "upload_expired"].includes(error.message)) throw error;
    throw new RoomError(503, "service_unavailable");
  }
  return details;
}
export function boards(app: ServerApp, runtime: Runtime) {
  app.post("/workspaces/:workspace/boards", async (c) => {
    const workspace = id(c, "workspace"), person = c.get("person");
    await authorize(runtime, person.id, workspace, "workspace", "editor");
    const value = await body(c, 13631488);
    const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
    const imported = keys.includes("document");
    const staged = imported && keys.includes("import");
    shape(value, staged ? ["title", "document", "import"] : imported ? ["title", "document"] : keys.length ? ["title"] : []);
    const title = keys.length ? value.title : "Untitled";
    if (!validTitle(title)) throw new RoomError(400, "bad_request");
    const importId = value.import;
    if (staged && (typeof importId !== "string" || !uuid.test(importId))) throw new RoomError(400, "bad_request");
    let document: BoardV14 | undefined;
    if (imported) {
      try {
        const board = validate(value.document);
        if (board.schemaVersion !== 13 && board.schemaVersion !== 14 && board.schemaVersion !== 15 && board.schemaVersion !== 16) throw Error();
        document = upgrade(board);
      } catch { throw new RoomError(400, "invalid_document"); }
      if (staged && typeof importId === "string") {
        const normalized = { ...document, boardId: importId, title };
        try { canonical(normalized); } catch { throw new RoomError(400, "document_too_large"); }
        return c.json(await finishImport(runtime, workspace, importId, person, normalized), 201);
      }
      try {
        canonical(document);
        // UUIDs have the same byte length; check the stored title before creating a row.
        canonical({ ...document, title });
      } catch { throw new RoomError(400, "document_too_large"); }
      if (document.objects.some(o => assetsOf(o).length)) throw new RoomError(400, "images_not_supported");
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
