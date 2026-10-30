// SPDX-License-Identifier: Apache-2.0
import { RoomError } from "nextphase-board-room/protocol.ts";
import type { Runtime } from "../runtime.ts";
import { body, id, shape, type ServerApp } from "./common.ts";
export function operators(app: ServerApp, runtime: Runtime) {
  app.use("/operator/*", async (c, next) => {
    if (!runtime.operatorKey) throw new RoomError(404, "not_found");
    if (c.req.header("Board-Operator-Key") !== runtime.operatorKey) throw new RoomError(401, "operator_key_invalid");
    await next();
  });
  app.post("/operator/boards/:board/backup", async (c) => c.json(await runtime.room(id(c, "board")).backup()));
  app.post("/operator/boards/:board/restore", async (c) => c.json(await runtime.room(id(c, "board")).restore(await body(c, 16777216))));
  app.post("/operator/boards/:board/restore-to-time", async (c) => {
    const room = runtime.room(id(c, "board"));
    if (!room.restoreToTime) throw new RoomError(404, "not_found");
    const value = await body(c); shape(value, ["bookmark"]);
    if (typeof value.bookmark !== "string" || !value.bookmark) throw new RoomError(400, "bad_request");
    return c.json(await room.restoreToTime(value.bookmark), 202);
  });
}
