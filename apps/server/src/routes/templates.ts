// SPDX-License-Identifier: Apache-2.0
import { RoomError } from "nextphase-board-room/protocol.ts";
import { labelOf } from "nextphase-board-room/tickets.ts";
import type { Runtime } from "../runtime.ts";
import { templateDetails, templateObjects } from "../templates.ts";
import { body, id, shape, uuid, type ServerApp } from "./common.ts";

export function templateRoutes(app: ServerApp, runtime: Runtime) {
  const path = "/workspaces/:workspace/templates";
  app.get(path, async c => c.json(await runtime.db.listTemplates(c.get("person").id, id(c, "workspace"))));
  app.get(path + "/:template", async c => {
    const workspace = id(c, "workspace"), template = id(c, "template");
    return c.json(await runtime.db.getTemplate(c.get("person").id, workspace, template));
  });
  app.post(path, async c => {
    const workspace = id(c, "workspace"), value = await body(c);
    shape(value, ["name", "description", "sourceBoard", "objects"]);
    const details = templateDetails(value.name, value.description);
    if (typeof value.sourceBoard !== "string" || !uuid.test(value.sourceBoard)) throw new RoomError(400, "bad_request");
    const content = templateObjects(value.objects), person = c.get("person");
    return c.json(await runtime.db.saveTemplate(person.id, workspace, value.sourceBoard, details, content, labelOf(person.email)), 201);
  });
  app.patch(path + "/:template", async c => {
    const workspace = id(c, "workspace"), template = id(c, "template"), value = await body(c), person = c.get("person").id;
    if (value && Object.hasOwn(value, "name")) {
      shape(value, ["name", "description"]);
      return c.json(await runtime.db.updateTemplateDetails(person, workspace, template, templateDetails(value.name, value.description)));
    }
    shape(value, ["sourceBoard", "objects"]);
    if (typeof value.sourceBoard !== "string" || !uuid.test(value.sourceBoard)) throw new RoomError(400, "bad_request");
    return c.json(await runtime.db.replaceTemplate(person, workspace, template, value.sourceBoard, templateObjects(value.objects)));
  });
  app.delete(path + "/:template", async c => {
    const workspace = id(c, "workspace"), template = id(c, "template");
    await runtime.db.deleteTemplate(c.get("person").id, workspace, template);
    return c.body(null, 204);
  });
}
