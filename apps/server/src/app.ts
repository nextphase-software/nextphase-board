// SPDX-License-Identifier: Apache-2.0
import { Hono } from "hono";
import { errorBody, RoomError } from "nextphase-board-room/protocol.ts";
import type { Runtime, AppVariables } from "./runtime.ts";
import { accessRoutes } from "./routes/access.ts";
import { boards } from "./routes/boards.ts";
import { invitations } from "./routes/invitations.ts";
import { operators } from "./routes/operator.ts";
export function createApp(runtime: Runtime) {
  const app = new Hono<{ Variables: AppVariables }>();
  app.onError((error, c) => {
    const failure = error instanceof RoomError ? error : new RoomError(503, "service_unavailable");
    return c.json(errorBody(failure), failure.status as 400);
  });
  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (origin === runtime.allowedOrigin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }
    if (c.req.method === "OPTIONS" && origin === runtime.allowedOrigin) {
      c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
      return c.body(null, 204);
    }
    const upgrade = c.req.method === "GET" && /^\/boards\/[^/]+\/join$/.test(c.req.path);
    if (!upgrade && !c.req.path.startsWith("/operator/")) c.set("person", await runtime.auth.bearer(c.req.header("Authorization")));
    await next();
  });
  boards(app, runtime);
  accessRoutes(app, runtime);
  invitations(app, runtime);
  operators(app, runtime);
  app.notFound((c) => c.json({ error: { reason: "not_found" } }, 404));
  return app;
}
