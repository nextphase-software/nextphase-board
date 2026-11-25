// SPDX-License-Identifier: Apache-2.0
import { PICTURE_BYTES, pictureSignature, videoType } from "nextphase-board-room/pictures.ts";
import { RoomError } from "nextphase-board-room/protocol.ts";
import type { Runtime } from "../runtime.ts";
import { authorize, body, bytes, hashId, id, shape, type ServerApp } from "./common.ts";
import { assetList } from "./imports.ts";
import { checkedPicture, verifyAsset } from "./pictures.ts";

export function templateMediaRoutes(app: ServerApp, runtime: Runtime) {
  const path = "/workspaces/:workspace/template-uploads";
  app.post(path, async c => {
    const workspace = id(c, "workspace"), person = c.get("person");
    await authorize(runtime, person.id, workspace, "workspace", "editor");
    const input = await body(c);
    shape(input, ["assets"]);
    const assets = assetList(input.assets);
    if (assets.reduce((sum, asset) => sum + asset.bytes, 0) > PICTURE_BYTES) throw new RoomError(413, "template_too_large");
    const upload = crypto.randomUUID();
    await runtime.templateMedia(upload).open(person, workspace, assets);
    return c.json({ upload }, 201);
  });
  app.put(path + "/:upload/assets/:hash", async c => {
    const workspace = id(c, "workspace"), upload = id(c, "upload"), hash = hashId(c), person = c.get("person");
    await authorize(runtime, person.id, workspace, "workspace", "editor");
    const store = runtime.templateMedia(upload);
    const token = await store.begin(person, workspace, hash);
    let answered = false;
    try {
      const data = await bytes(c, PICTURE_BYTES), head = data.subarray(0, 64);
      const video = !pictureSignature(head) && videoType(head);
      const { type, width, height } = video ? { type: video, width: 0, height: 0 } : checkedPicture(data);
      await verifyAsset(hash, data);
      const result = await store.stage(person, workspace, token, hash, type, data, width, height);
      answered = true;
      return c.json({ asset: hash, type, bytes: data.length }, result === "created" ? 201 : 200);
    } finally {
      if (!answered) await store.end(person, workspace, token).catch(() => {});
    }
  });
  app.get("/workspaces/:workspace/templates/:template/assets/:hash", async c => {
    const workspace = id(c, "workspace"), template = id(c, "template"), hash = hashId(c);
    const { store } = await runtime.db.getTemplate(c.get("person").id, workspace, template);
    const asset = store ? await runtime.templateMedia(store).read(hash) : null;
    if (!asset) throw new RoomError(404, "not_found");
    return c.body(asset.bytes, 200, {
      "Content-Type": asset.type, "Content-Length": String(asset.bytes.length),
      "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    });
  });
}
