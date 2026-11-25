// SPDX-License-Identifier: Apache-2.0
import { teamSettings } from "./team-settings.mjs";
import { checkBundle } from "./check-notices.mjs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
const root = fileURLToPath(new URL("../", import.meta.url)),
  app = resolve(root, "apps/web"),
  require = createRequire(resolve(app, "package.json"));
const { build } = require("esbuild");
const fixture = process.argv.includes("--fixtures"),
  out = resolve(app, fixture ? "dist-fixtures" : "dist");
const team = fixture ? null : teamSettings(process.env);
const previewOrigin = fixture ? null : process.env.BOARD_LINK_PREVIEW_URL || null;
if (previewOrigin) {
  const url = URL.parse(previewOrigin);
  if (!url || url.origin !== previewOrigin || (url.protocol !== "https:" &&
      !(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port))) {
    throw Error("BOARD_LINK_PREVIEW_URL must be an HTTPS origin or a loopback HTTP origin with a port.");
  }
}
const defines = {
  "process.env.NODE_ENV": '"production"',
  BOARD_TEAM_FEATURES: JSON.stringify(!!team),
  BOARD_TEAM_SETTINGS: JSON.stringify(team),
  BOARD_LINK_PREVIEW_URL: JSON.stringify(previewOrigin),
};
await mkdir(out, { recursive: true });
const result = await build({
  absWorkingDir: root,
  nodePaths: [resolve(root, "node_modules")],
  entryPoints: [
    resolve(
      root,
      fixture ? "tests/browser/fixtures.ts" : "apps/web/src/main.tsx",
    ),
  ],
  outfile: resolve(out, "app.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "eof",
  metafile: true,
  define: defines,
});
await writeFile(
  resolve(out, "meta.json"),
  JSON.stringify(result.metafile, null, 2),
);
const index = await readFile(resolve(app, "index.html"), "utf8");
const origins = team ? [team.supabaseUrl, team.serverUrl, team.serverUrl.replace(/^http/, "ws")] : [];
if (previewOrigin && !origins.includes(previewOrigin)) origins.push(previewOrigin);
await writeFile(resolve(out, "index.html"), origins.length
  ? index.replace("connect-src 'none'", `connect-src ${origins.join(" ")}`) : index);
await copyFile(resolve(app, "style.css"), resolve(out, "style.css"));
await copyFile(
  resolve(root, `docs/architecture/0001-runtime-notices-v${team ? 3 : 1}.txt`),
  resolve(out, "THIRD_PARTY_NOTICES.txt"),
);
await checkBundle(result.metafile, out);
if (fixture) {
  const regressions = await build({
    entryPoints: [resolve(root, "tests/browser/app-regressions.mjs")],
    outfile: resolve(out, "regressions.js"), bundle: true, platform: "browser",
    format: "esm", target: "es2022", minify: true, legalComments: "eof", metafile: true,
    absWorkingDir: root, nodePaths: [resolve(root, "node_modules")], jsx: "automatic",
    define: defines,
  });
  await checkBundle(regressions.metafile, out);
  const { readFile } = await import("node:fs/promises");
  await writeFile(resolve(out, "regressions.html"),
    (await readFile(resolve(app, "index.html"), "utf8"))
      .replace('src="/app.js"', 'src="/regressions.js"'));
}
console.log("Built", fixture ? "disposable fixtures" : "application");
