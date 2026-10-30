// SPDX-License-Identifier: Apache-2.0
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const target = new URL("../../supabase/signing_keys.json", import.meta.url);
await mkdir(new URL("../../supabase/", import.meta.url), { recursive: true });
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const key = { ...privateKey.export({ format: "jwk" }), kid: randomUUID(), alg: "ES256", use: "sig", key_ops: ["sign", "verify"] };
try {
  await writeFile(target, JSON.stringify([key], null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("Created the local stack signing key");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Kept the existing local stack signing key");
}
