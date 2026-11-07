// SPDX-License-Identifier: Apache-2.0
import { checkLedger, type RecoveryRecord } from "./lifecycle.ts";
import { createApp } from "./app.ts";
import { WorkerRoom } from "./worker-room.ts";
import { workerRuntime, type WorkerEnv } from "./worker-runtime.ts";
import { deliver } from "./delivery.ts";
export class BoardRoom extends WorkerRoom {}
export class RestoreFence {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS lifecycle_ledger (board_id TEXT PRIMARY KEY, record TEXT NOT NULL)");
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS fence (id INTEGER PRIMARY KEY CHECK (id = 1), generation INTEGER NOT NULL)");
  }
  async fetch(request: Request) {
    if(new URL(request.url).pathname === "/ledger") {
      try {
        const {board,row,record}=await request.json() as any;
        const old=this.state.storage.sql.exec<{record:string}>("SELECT record FROM lifecycle_ledger WHERE board_id=?",board).toArray()[0];
        checkLedger(old?JSON.parse(old.record) as RecoveryRecord:null,row);
        if(record && !(row.state === "active" && row.cycle === 0))this.state.storage.sql.exec("INSERT INTO lifecycle_ledger VALUES (?,?) ON CONFLICT(board_id) DO UPDATE SET record=excluded.record",board,JSON.stringify(record));
        return Response.json({});
      } catch {return Response.json({error:{reason:"service_unavailable"}},{status:503});}
    }
    if (new URL(request.url).pathname === "/raise") this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec("INSERT INTO fence VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET generation = generation + 1");
    });
    const row = this.state.storage.sql.exec<{ generation: number }>("SELECT generation FROM fence WHERE id = 1").toArray()[0];
    return Response.json({ generation: row?.generation ?? 0 });
  }
}
export default {
  fetch(request: Request, env: WorkerEnv) { return createApp(workerRuntime(env)).fetch(request); },
  scheduled(_controller: ScheduledController, env: WorkerEnv, context: ExecutionContext) {
    context.waitUntil(deliver(workerRuntime(env)));
  },
};
