// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
const info = {
  apiUrl: status.API_URL, anonKey: status.ANON_KEY, serviceRoleKey: status.SERVICE_ROLE_KEY,
  jwtSecret: status.JWT_SECRET, mailUrl: status.INBUCKET_URL ?? status.MAILPIT_URL,
  dbContainer: "supabase_db_nextphase-board-test",
  signingKeyPath: fileURLToPath(new URL("supabase/signing_keys.json", root)),
};
for (const [name, value] of Object.entries(info)) if (typeof value !== "string" || !value) throw Error("Missing stack setting: " + name);
await writeFile(new URL(".stack.json", import.meta.url), JSON.stringify(info, null, 2) + "\n", { mode: 0o600 });
console.log("Wrote local stack settings (credentials omitted)");
