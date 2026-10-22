// SPDX-License-Identifier: Apache-2.0
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, resolve } from "node:path";
const fixture = process.argv.includes("--fixtures"),
  port = fixture ? 4174 : 4173,
  base = fileURLToPath(
    new URL(
      "../apps/web/" + (fixture ? "dist-fixtures/" : "dist/"),
      import.meta.url,
    ),
  );
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
createServer(async (req, res) => {
  if (req.headers.host !== `127.0.0.1:${port}` || req.method !== "GET") {
    res.writeHead(403).end();
    return;
  }
  try {
    const name = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    if (name.includes("..") || name.includes("\\")) throw Error();
    const f = resolve(base, "." + (name === "/" ? "/index.html" : name));
    if (!f.startsWith(base) || !types[extname(f)]) throw Error();
    res.writeHead(200, {
      "Content-Type": types[extname(f)],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    }).end(await readFile(f));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}`));
