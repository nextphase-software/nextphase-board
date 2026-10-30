// SPDX-License-Identifier: Apache-2.0
import { RoomError } from "nextphase-board-room/protocol.ts";
import { decodeCursor, encodeCursor, listOrder, validTitle } from "../cursor.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, body, id, shape, type ServerApp } from "./common.ts";
export function lists(app: ServerApp, runtime: Runtime) {
  app.get("/workspaces", async (c) => c.json({ workspaces: await runtime.db.workspaces(c.get("person").id) }));
  app.get("/recent-boards", async (c) => c.json({ boards: await runtime.db.recentBoards(c.get("person").id) }));
  app.get("/workspaces/:workspace/boards", async (c) => {
    const workspace = id(c, "workspace"), person = c.get("person").id;
    await authorize(runtime, person, workspace, "workspace");
    const { sort, order } = listOrder(c.req.query("sort"), c.req.query("order"));
    const text = c.req.query("cursor");
    const after = text === undefined ? undefined : decodeCursor(text, workspace, sort, order);
    const rows = await runtime.db.boards(person, workspace, sort, order, after);
    const page = rows.slice(0, 100), last = page[page.length - 1];
    return c.json({ boards: page.map(({ cursorKey, ...row }) => row),
      nextCursor: rows.length > 100 ? encodeCursor({ v: 1, workspace, sort, order, id: last.id, key: last.cursorKey }) : null });
  });
  app.patch("/boards/:board", async (c) => {
    const board = id(c, "board"), value = await body(c);
    shape(value, ["title"]);
    if (!validTitle(value.title)) throw new RoomError(400, "bad_request");
    return c.json(await runtime.room(board).rename(c.get("person"), value.title));
  });
}
