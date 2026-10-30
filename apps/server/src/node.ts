// SPDX-License-Identifier: Apache-2.0
import { readFile } from "node:fs/promises";
import { checkSettings } from "./settings.ts";
import { startNode } from "./start-node.ts";
if (!process.env.BOARD_SETTINGS) throw Error("Set BOARD_SETTINGS to a server settings file");
const settings = checkSettings(JSON.parse(await readFile(process.env.BOARD_SETTINGS, "utf8")));
const server = await startNode(settings);
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { void server.close().then(() => process.exit(0)); });
console.log("Board server listening on port " + server.port);
