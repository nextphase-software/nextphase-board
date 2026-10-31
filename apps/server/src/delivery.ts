// SPDX-License-Identifier: Apache-2.0
import type { Runtime } from "./runtime.ts";

type DeliveryRuntime = Pick<Runtime, "db" | "room">;
const deliveries = new WeakMap<Runtime["db"], Promise<void>>();

async function attempt(runtime: DeliveryRuntime) {
  let boards: string[];
  try { boards = await runtime.db.rpc("pending_access_boards", {}); }
  catch { return; }
  for (let offset = 0; offset < boards.length; offset += 10) {
    await Promise.allSettled(boards.slice(offset, offset + 10).map(async (board) => {
      const watermark = await runtime.room(board).changed();
      if (!Number.isSafeInteger(watermark) || watermark < 0) return;
      await runtime.db.rpc("record_access_receipt", { board, through: watermark });
    }));
  }
}

// The database client belongs to one process/isolate. Sharing its queue also
// serializes delivery when a caller wraps the runtime's room factory.
export function deliver(runtime: DeliveryRuntime): Promise<void> {
  const previous = deliveries.get(runtime.db) ?? Promise.resolve();
  const task = previous.then(() => attempt(runtime));
  deliveries.set(runtime.db, task.catch(() => {}));
  return task;
}

export async function removal(runtime: Pick<Runtime, "db">, person: string,
  workspace: string | null = null, board: string | null = null): Promise<"done" | "pending"> {
  try {
    const pending = await runtime.db.rpc<unknown[]>("pending_deliveries", { person, workspace, board });
    return pending.length ? "pending" : "done";
  } catch { return "pending"; }
}
