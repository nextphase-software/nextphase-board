// SPDX-License-Identifier: Apache-2.0
import { MAX_SIDE, PICTURE_BYTES, pictureHeader, pictureSignature, videoType } from "nextphase-board-room/pictures.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, head, streamBytes, hashId, id, type ServerApp } from "./common.ts";

export function pictureRoutes(app: ServerApp, runtime: Runtime) {
  const path = "/boards/:board/assets/:hash";
  app.put(path, async c => {
    const board = id(c, "board"), hash = hashId(c), person = c.get("person");
    await authorize(runtime, person.id, board, "board", "editor");
    const replay = await head(c, 64), room = runtime.room(board);
    const video = !pictureSignature(replay.head) && videoType(replay.head);
    if (video) {
      try {
        const { result, type, bytes } = await room.storeVideo(person, hash, video, replay.body);
        if (result === "full") throw new RoomError(409, "board_videos_full");
        return c.json({ asset: hash, type, bytes }, result === "created" ? 201 : 200);
      } finally { if (!replay.body.locked) void replay.body.cancel().catch(() => {}); }
    }
    const data = await streamBytes(replay.body, PICTURE_BYTES), header = pictureHeader(data);
    if (!header) throw new RoomError(400, "unsupported_picture");
    const { type, width, height } = header;
    if (Math.max(width, height) > MAX_SIDE) throw new RoomError(400, "picture_too_large");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    if (Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("") !== hash) throw new RoomError(400, "picture_hash_mismatch");
    const result = await runtime.room(board).storePicture(person, hash, data, type, width, height);
    if (result === "full") throw new RoomError(409, "board_pictures_full");
    return c.json({ asset: hash, type, bytes: data.length }, result === "exists" ? 200 : 201);
  });
  app.get(path, async c => {
    const board = id(c, "board"), hash = hashId(c), person = c.get("person");
    await authorize(runtime, person.id, board, "board");
    const picture = await runtime.room(board).readPicture(person, hash);
    if (!picture) {
      const video = await runtime.room(board).readVideo(person, hash);
      if (!video) throw new RoomError(404, "not_found");
      return c.body(video.body, 200, {
        "Content-Type": video.type, "Content-Length": String(video.bytes),
        "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
      });
    }
    return c.body(picture.bytes, 200, {
      "Content-Type": picture.type, "Content-Length": String(picture.bytes.length),
      "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    });
  });
}
