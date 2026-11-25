// SPDX-License-Identifier: Apache-2.0
import { BOARD_BYTES, BOARD_VIDEO_BYTES, PICTURE_BYTES, VIDEO_BYTES, isPictureType, isVideoType, type AssetEntry } from "nextphase-board-room/pictures.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, body, hashId, id, shape, type ServerApp } from "./common.ts";
import { putAsset } from "./pictures.ts";

export function assetList(value: unknown): AssetEntry[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1_000) throw new RoomError(400, "bad_request");
  const hashes = new Set<string>();
  for (const entry of value) {
    shape(entry, ["hash", "type", "bytes"]);
    if (typeof entry.hash !== "string" || !/^[0-9a-f]{64}$/.test(entry.hash) || hashes.has(entry.hash) ||
      (!isPictureType(entry.type) && !isVideoType(entry.type)) || !Number.isInteger(entry.bytes) ||
      entry.bytes < 1 || entry.bytes > (isPictureType(entry.type) ? PICTURE_BYTES : VIDEO_BYTES)) {
      throw new RoomError(400, "bad_request");
    }
    hashes.add(entry.hash);
  }
  return value;
}

export function importRoutes(app: ServerApp, runtime: Runtime) {
  const path = "/workspaces/:workspace/imports";
  app.post(path, async c => {
    const workspace = id(c, "workspace"), person = c.get("person");
    await authorize(runtime, person.id, workspace, "workspace", "editor");
    const input = await body(c);
    shape(input, ["assets"]);
    const assets = assetList(input.assets);
    let pictures = 0, videos = 0;
    for (const entry of assets) {
      if (isPictureType(entry.type)) pictures += entry.bytes;
      else videos += entry.bytes;
    }
    if (pictures > BOARD_BYTES) throw new RoomError(409, "board_pictures_full");
    if (videos > BOARD_VIDEO_BYTES) throw new RoomError(409, "board_videos_full");
    const upload = crypto.randomUUID();
    await runtime.room(upload).openImport(person, workspace, assets);
    return c.json({ import: upload }, 201);
  });
  app.put(path + "/:import/assets/:hash", async c => {
    const workspace = id(c, "workspace"), upload = id(c, "import"), hash = hashId(c), person = c.get("person");
    await authorize(runtime, person.id, workspace, "workspace", "editor");
    const room = runtime.room(upload);
    const token = await room.beginImport(person, workspace, hash);
    let answered = false;
    try {
      const reply = await putAsset(c, hash,
        (data, type, width, height) => room.stageImportPicture(person, workspace, token, hash, data, type, width, height),
        (type, stream) => room.stageImportVideo(person, workspace, token, hash, type, stream));
      answered = true;
      return reply;
    } finally {
      if (!answered) await room.endImport(person, workspace, token).catch(() => {});
    }
  });
}
