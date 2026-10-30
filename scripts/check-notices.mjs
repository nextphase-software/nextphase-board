// SPDX-License-Identifier: Apache-2.0
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));
assert.equal(await read("package-lock.json"), await read("docs/architecture/0001-dependency-lock-v4.json"),
  "Dependency lock differs from accepted contract");
const inventory = await json("docs/architecture/0001-dependency-inventory-v4.json");
const webNotices = await read("docs/architecture/0001-runtime-notices-v1.txt");
const runtimeNotices = await read("docs/architecture/0001-runtime-notices-v2.txt");
const trim = (text) => text.replace(/(?:\n[ \t]*)+$/, "");

function packages(meta, artifact) {
  const entries = new Map();
  for (const input of Object.keys(meta.inputs)) {
    if (!input.includes("node_modules/")) continue;
    const absolute = resolve(root, input);
    const entry = inventory.entries.find((entry) =>
      absolute.startsWith(resolve(root, entry.path) + "/"));
    assert(entry?.artifacts.includes(artifact), "Unreviewed bundle input: " + input);
    entries.set(entry.path, entry);
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export async function serverNotices(meta, artifact) {
  let output = `Third-party notices for ${artifact.toUpperCase()}\n\n`;
  for (const entry of packages(meta, artifact)) {
    const folder = resolve(root, entry.path);
    const files = (await readdir(folder)).filter((file) => /^(?:licen[sc]e|copying)(?:\.|$)/i.test(file)).sort();
    assert(files.length, "Bundled package has no licence file: " + entry.name);
    output += `===== ${entry.name} ${entry.version} =====\nDeclared licence: ${entry.declaredLicense}\n`;
    for (const file of files) {
      const bytes = await readFile(resolve(folder, file));
      const accepted = entry.licenseFiles.find((item) => item.file === file);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), accepted?.sha256,
        "Licence text differs from inventory: " + entry.name);
      output += bytes.toString("utf8").replace(/\r\n?/g, "\n") + "\n";
    }
    output += "\n";
  }
  return output;
}

export async function checkBundle(meta, out) {
  // Older builds used the app folder as their working directory. New builds
  // record paths relative to the workspace root.
  packages(meta, "web");
  assert.equal(await readFile(resolve(out, "THIRD_PARTY_NOTICES.txt"), "utf8"), webNotices,
    "Distributed web notices differ");
}

export async function checkServerBundle(meta, out, artifact) {
  const file = resolve(out, artifact.toUpperCase() + "_NOTICES.txt");
  const generated = await serverNotices(meta, artifact);
  assert.equal(trim(await readFile(file, "utf8")), trim(generated), "Server notices differ from bundle");
  const header = `Third-party notices for ${artifact.toUpperCase()}`;
  const section = runtimeNotices.slice(runtimeNotices.indexOf(header)).split(/\n(?=Third-party notices for )/)[0];
  assert.equal(trim(generated), trim(section), "Server notices differ from accepted runtime notices");
}

export async function auditArtifacts() {
  for (const artifact of ["web", "node", "worker"]) {
    const out = resolve(root, artifact === "web" ? "apps/web/dist" : "apps/server/dist");
    try {
      const meta = JSON.parse(await readFile(resolve(out, artifact === "web" ? "meta.json" : artifact + ".meta.json"), "utf8"));
      if (artifact === "web") await checkBundle(meta, out);
      else await checkServerBundle(meta, out, artifact);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  console.log("Accepted lock, runtime inventory and complete distributed notices verified.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await auditArtifacts();
