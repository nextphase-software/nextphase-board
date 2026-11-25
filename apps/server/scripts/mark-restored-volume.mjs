// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";
import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
const folder = process.argv[2];
if (!folder) throw Error("Usage: node apps/server/scripts/mark-restored-volume.mjs <data folder>; stop the server first");
let count = 0;
for (const name of await readdir(resolve(folder, "boards"))) {
  if (!/^[0-9a-f-]{36}\.sqlite$/.test(name)) continue;
  const path = resolve(folder, "boards", name), probe = new DatabaseSync(path, { readOnly: true });
  let rows;
  try { rows = probe.prepare("SELECT key,value FROM meta WHERE key IN ('import','storage_version')").all(); }
  finally { probe.close(); }
  const staging = rows.find(row => row.key === "import");
  if (staging && !rows.some(row => row.key === "storage_version")) {
    if (!JSON.parse(staging.value).finishing) {
      for (const suffix of ["", "-wal", "-shm"]) await rm(path + suffix, { force: true });
    }
    continue;
  }
  const db = new DatabaseSync(path);
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO meta(key,value) VALUES ('explicit_recovery_pending',1) ON CONFLICT(key) DO UPDATE SET value=1").run();
    db.prepare("INSERT INTO meta(key,value) VALUES ('restore_pending',1) ON CONFLICT(key) DO UPDATE SET value=1").run();
    db.exec("COMMIT");
    count++;
  } finally { db.close(); }
}
console.log("Marked " + count + " restored board files");
