// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
const folder = process.argv[2];
if (!folder) throw Error("Usage: node apps/server/scripts/mark-restored-volume.mjs <data folder>; stop the server first");
let count = 0;
for (const name of await readdir(resolve(folder, "boards"))) {
  if (!/^[0-9a-f-]{36}\.sqlite$/.test(name)) continue;
  const db = new DatabaseSync(resolve(folder, "boards", name));
  try {
    db.prepare("INSERT INTO meta(key,value) VALUES ('restore_pending',1) ON CONFLICT(key) DO UPDATE SET value=1").run();
    count++;
  } finally { db.close(); }
}
console.log("Marked " + count + " restored board files");
