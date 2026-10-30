// SPDX-License-Identifier: Apache-2.0
import type { Runtime } from "./runtime.ts";
// A committed write is successful even when one of its rooms is unavailable.
// Join replay will catch up any missed room without rolling the write back.
export async function fanout(runtime: Runtime, workspace: string, board: string | null) {
  const ids = board ? [board] : (await runtime.db.rows("boards", { workspace_id: workspace })).map((row) => row.id as string);
  for (let offset = 0; offset < ids.length; offset += 10) {
    await Promise.allSettled(ids.slice(offset, offset + 10).map((id) => runtime.room(id).changed()));
  }
}
