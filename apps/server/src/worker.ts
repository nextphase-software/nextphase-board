// SPDX-License-Identifier: Apache-2.0
import { createApp } from "./app.ts";
import { WorkerRoom } from "./worker-room.ts";
import { workerRuntime, type WorkerEnv } from "./worker-runtime.ts";
export class BoardRoom extends WorkerRoom {}
export class RestoreFence {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS fence (id INTEGER PRIMARY KEY CHECK (id = 1), generation INTEGER NOT NULL)");
  }
  async fetch(request: Request) {
    if (new URL(request.url).pathname === "/raise") this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec("INSERT INTO fence VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET generation = generation + 1");
    });
    const row = this.state.storage.sql.exec<{ generation: number }>("SELECT generation FROM fence WHERE id = 1").toArray()[0];
    return Response.json({ generation: row?.generation ?? 0 });
  }
}
export default { fetch(request: Request, env: WorkerEnv) { return createApp(workerRuntime(env)).fetch(request); } };
