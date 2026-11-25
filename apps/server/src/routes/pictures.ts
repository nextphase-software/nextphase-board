// SPDX-License-Identifier: Apache-2.0
import { MAX_SIDE, PICTURE_BYTES, pictureHeader, pictureSignature, videoType, type PictureType, type VideoType } from "nextphase-board-room/pictures.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import type { RoomClient, Runtime } from "../runtime.ts";
import { authorize, body, head, streamBytes, hashId, id, shape, type ServerApp, type ServerContext } from "./common.ts";

export async function verifyAsset(hash: string, data: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  if (Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("") !== hash) throw new RoomError(400, "picture_hash_mismatch");
}
export function checkedPicture(data: Uint8Array) {
  const header = pictureHeader(data);
  if (!header) throw new RoomError(400, "unsupported_picture");
  if (Math.max(header.width, header.height) > MAX_SIDE) throw new RoomError(400, "picture_too_large");
  return header;
}
export async function putAsset(c: ServerContext, hash: string, storePicture: (data: Uint8Array, type: PictureType, width: number, height: number) => ReturnType<RoomClient["storePicture"]>,
  storeVideo: (type: VideoType, body: ReadableStream<Uint8Array>) => ReturnType<RoomClient["storeVideo"]>) {
  const replay = await head(c, 64);
  const video = !pictureSignature(replay.head) && videoType(replay.head);
  if (video) {
    try {
      const { result, type, bytes } = await storeVideo(video, replay.body);
      if (result === "full") throw new RoomError(409, "board_videos_full");
      return c.json({ asset: hash, type, bytes }, result === "created" ? 201 : 200);
    } finally { if (!replay.body.locked) void replay.body.cancel().catch(() => {}); }
  }
  const data = await streamBytes(replay.body, PICTURE_BYTES);
  const { type, width, height } = checkedPicture(data);
  await verifyAsset(hash, data);
  const result = await storePicture(data, type, width, height);
  if (result === "full") throw new RoomError(409, "board_pictures_full");
  return c.json({ asset: hash, type, bytes: data.length }, result === "exists" ? 200 : 201);
}

export function pictureRoutes(app: ServerApp, runtime: Runtime) {
  const path = "/boards/:board/assets/:hash";
  app.put(path, async c => {
    const board = id(c, "board"), hash = hashId(c), person = c.get("person");
    await authorize(runtime, person.id, board, "board", "editor");
    let room: RoomClient | undefined;
    const target = () => room ??= runtime.room(board);
    return putAsset(c, hash, (data, type, width, height) => target().storePicture(person, hash, data, type, width, height),
      (type, stream) => target().storeVideo(person, hash, type, stream));
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

export function assetSizeRoutes(app: ServerApp, runtime: Runtime) {
  app.post("/boards/:board/asset-sizes", async c => {
    const board = id(c, "board"), person = c.get("person");
    await authorize(runtime, person.id, board, "board");
    const input = await body(c);
    shape(input, ["hashes"]);
    const hashes = input.hashes;
    if (!Array.isArray(hashes) || hashes.length < 1 || hashes.length > 1000 ||
      hashes.some(hash => typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) || new Set(hashes).size !== hashes.length) {
      throw new RoomError(400, "bad_request");
    }
    return c.json({ assets: await runtime.room(board).assetSizes(person, hashes) });
  });
}
