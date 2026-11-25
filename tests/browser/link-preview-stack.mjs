// SPDX-License-Identifier: Apache-2.0
import { readFile, rm } from "node:fs/promises";
import { checkSettings } from "../../apps/server/src/settings.ts";
import { startNode } from "../../apps/server/src/start-node.ts";
import { browserAllow, fixtureDial, nodeResolver, startLinkFixtures } from "../server/link-preview-fixtures.ts";
import { makeLinkPreviewTls } from "../server/link-preview-tls.ts";

if (!process.env.BOARD_SETTINGS) throw Error("Set BOARD_SETTINGS to a server settings file");
const settings = checkSettings(JSON.parse(await readFile(process.env.BOARD_SETTINGS, "utf8")));
const tls = await makeLinkPreviewTls();
let fixtures;
async function closeFixtures() {
  try { await fixtures?.close(); }
  finally { await rm(tls.dir, { recursive: true, force: true }); }
}
try {
  fixtures = await startLinkFixtures(tls, { http: 8797, https: 8798, hold: ["fieldnotes.test/sprint"] });
  const server = await startNode(settings, { linkTransport: {
    resolver: nodeResolver([], true),
    testAllow: browserAllow,
    testDial: fixtureDial(fixtures.http, fixtures.https),
    ca: tls.ca,
  } });
  const stop = () => { void Promise.all([server.close(), closeFixtures()]).then(() => process.exit(0)); };
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, stop);
  console.log("Link preview test server listening on port " + server.port);
} catch (error) {
  await closeFixtures();
  throw error;
}
