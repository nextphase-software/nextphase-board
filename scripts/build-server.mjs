// SPDX-License-Identifier: Apache-2.0
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { serverNotices, checkServerBundle } from "./check-notices.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "apps/server/dist");
await mkdir(out, { recursive: true });
for (const artifact of ["node", "worker"]) {
  const result = await build({ absWorkingDir: root, entryPoints: [`apps/server/src/${artifact}.ts`],
    outfile: resolve(out, artifact + ".mjs"), bundle: true, format: "esm", target: "es2022",
    platform: artifact === "node" ? "node" : "browser", conditions: artifact === "worker" ? ["workerd", "worker", "browser"] : ["node"],
    external: ["node:*"], metafile: true, legalComments: "eof",
    ...(artifact === "node" ? { banner: { js: 'import { createRequire as boardCreateRequire } from "node:module"; const require = boardCreateRequire(import.meta.url);' } } : {}),
  });
  await writeFile(resolve(out, artifact + ".meta.json"), JSON.stringify(result.metafile, null, 2));
  await writeFile(resolve(out, artifact.toUpperCase() + "_NOTICES.txt"), await serverNotices(result.metafile, artifact));
  await checkServerBundle(result.metafile, out, artifact);
}
console.log("Built Node and Worker servers with verified notices");
