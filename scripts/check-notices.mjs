// SPDX-License-Identifier: Apache-2.0
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const json = async (path) =>
  JSON.parse(await readFile(resolve(root, path), "utf8"));
const lock = await json("apps/web/package-lock.json");
const accepted = await json("docs/architecture/0001-dependency-lock-v2.json");
const inventory = await json(
  "docs/architecture/0001-dependency-inventory-v2.json",
);
assert.deepEqual(
  lock,
  accepted,
  "Dependency lock differs from accepted contract",
);
const notices = await readFile(
  resolve(root, "docs/architecture/0001-runtime-notices-v1.txt"),
  "utf8",
);
for (const name of inventory.bundlePackages) {
  const entries = inventory.packages.filter((p) => p.name === name);
  assert(entries.length, "Missing inventory package: " + name);
  for (const entry of entries) {
    assert(
      notices.includes(`===== ${name} ${entry.version} =====`),
      "Missing notice: " + name,
    );
  }
}
// Build calls this with its in-memory metafile; audit also checks a prior output
// when present. A clean checkout can audit the accepted sources before building.
export async function checkBundle(meta, out) {
  for (const input of Object.keys(meta.inputs)) {
    if (!input.includes("node_modules/")) continue;
    const packagePath = input.split("node_modules/").at(-1);
    const name = packagePath.startsWith("@")
      ? packagePath.split("/").slice(0, 2).join("/")
      : packagePath.split("/")[0];
    assert(
      inventory.bundlePackages.includes(name),
      "Unreviewed browser package: " + name,
    );
    const entry = lock.packages["node_modules/" + name];
    assert(
      entry && notices.includes(`===== ${name} ${entry.version} =====`),
      "Uncovered browser package: " + name,
    );
  }
  assert.equal(
    await readFile(resolve(out, "THIRD_PARTY_NOTICES.txt"), "utf8"),
    notices,
    "Distributed notices differ",
  );
}
try {
  const meta = await json("apps/web/dist/meta.json");
  await checkBundle(meta, resolve(root, "apps/web/dist"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
console.log(
  "Accepted lock, runtime inventory and complete distributed notices verified.",
);
