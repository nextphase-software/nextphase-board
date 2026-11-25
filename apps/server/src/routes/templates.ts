// SPDX-License-Identifier: Apache-2.0
import { RoomError, type Person } from "nextphase-board-room/protocol.ts";
import { isMedia } from "nextphase-board-rules/objects/registry.ts";
import { labelOf } from "nextphase-board-room/tickets.ts";
import type { Runtime } from "../runtime.ts";
import { templateDetails, templateObjects } from "../templates.ts";
import { body, id, shape, uuid, type ServerApp } from "./common.ts";

function uploadId(input: Record<string, unknown>, keys: string[]) {
  const value = input?.upload;
  shape(input, Object.hasOwn(input ?? {}, "upload") ? [...keys, "upload"] : keys);
  if (value !== undefined && (typeof value !== "string" || !uuid.test(value))) throw new RoomError(400, "bad_request");
  return value;
}

async function removeStore(runtime: Runtime, store: string | null | undefined) {
  if (store) {
    try { await runtime.removeTemplateMedia(store); }
    catch { console.warn("Template media cleanup failed"); }
  }
}

async function changeContent<T>(runtime: Runtime, workspace: string, person: Person, objects: unknown, upload: string | undefined,
  write: (content: ReturnType<typeof templateObjects>) => Promise<T>) {
  if (!upload) return write(templateObjects(objects));
  if (!Array.isArray(objects) || !objects.some(object => object && isMedia(object))) throw new RoomError(400, "bad_request");
  const entries = await runtime.templateMedia(upload).commit(person, workspace);
  let content;
  try { content = templateObjects(objects, new Map(entries.map(entry => [entry.hash, entry]))); }
  catch (error) { await removeStore(runtime, upload); throw error; }
  try { return await write(content); }
  catch (error) {
    if (error instanceof RoomError && ["not_found", "bad_request", "template_limit", "role_too_low"].includes(error.message)) {
      await removeStore(runtime, upload);
    }
    throw error;
  }
}

export function templateRoutes(app: ServerApp, runtime: Runtime) {
  const path = "/workspaces/:workspace/templates";
  app.get(path, async c => c.json(await runtime.db.listTemplates(c.get("person").id, id(c, "workspace"))));
  app.get(path + "/:template", async c => {
    const workspace = id(c, "workspace"), template = id(c, "template");
    const detail = await runtime.db.getTemplate(c.get("person").id, workspace, template);
    const media = detail.store ? await runtime.templateMedia(detail.store).inventory() : [];
    return c.json({ ...detail.template, media });
  });
  app.post(path, async c => {
    const workspace = id(c, "workspace"), value = await body(c);
    const upload = uploadId(value, ["name", "description", "sourceBoard", "objects"]);
    const details = templateDetails(value.name, value.description);
    if (typeof value.sourceBoard !== "string" || !uuid.test(value.sourceBoard)) throw new RoomError(400, "bad_request");
    const source = value.sourceBoard, person = c.get("person");
    return c.json(await changeContent(runtime, workspace, person, value.objects, upload, content =>
      runtime.db.saveTemplate(person.id, workspace, source, details, content, labelOf(person.email), upload)), 201);
  });
  app.patch(path + "/:template", async c => {
    const workspace = id(c, "workspace"), template = id(c, "template"), value = await body(c), person = c.get("person");
    if (value && Object.hasOwn(value, "name")) {
      shape(value, ["name", "description"]);
      return c.json(await runtime.db.updateTemplateDetails(person.id, workspace, template, templateDetails(value.name, value.description)));
    }
    const upload = uploadId(value, ["sourceBoard", "objects"]);
    if (typeof value.sourceBoard !== "string" || !uuid.test(value.sourceBoard)) throw new RoomError(400, "bad_request");
    const source = value.sourceBoard;
    const result = await changeContent(runtime, workspace, person, value.objects, upload, content =>
      runtime.db.replaceTemplate(person.id, workspace, template, source, content, upload));
    await removeStore(runtime, result.previousStore);
    return c.json(result.template);
  });
  app.delete(path + "/:template", async c => {
    const workspace = id(c, "workspace"), template = id(c, "template");
    await removeStore(runtime, await runtime.db.deleteTemplate(c.get("person").id, workspace, template));
    return c.body(null, 204);
  });
}
