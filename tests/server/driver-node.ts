// SPDX-License-Identifier: Apache-2.0
import { fork, execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm, cp, chmod, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { NodeStorage } from "../../apps/server/src/node-storage.ts";
import { initialize } from "../../packages/board-room/src/storage.ts";
import { decodeBackup, replace } from "../../packages/board-room/src/backups.ts";
import { peer } from "./peer.ts";
import type { Context, Driver } from "./driver-types.ts";
const require = createRequire(new URL("../../apps/server/package.json", import.meta.url));
const { WebSocket } = require("ws");
const root = fileURLToPath(new URL("../../", import.meta.url));
export async function makeDriver(context: Context): Promise<Driver> {
  const docker = process.env.BOARD_TEST_TARGET === "docker";
  const folder = await mkdtemp(resolve(tmpdir(), "board-server-")), dataDir = resolve(folder, "data");
  await mkdir(dataDir); await chmod(dataDir, 0o777);
  const settingsFile = resolve(folder, "settings.json");
  const settings = { supabaseUrl: context.proxyUrl, issuer: context.issuer, serviceKey: context.serviceKey, jwks: context.jwks,
    allowedOrigin: context.origin, operatorKey: context.operatorKey, port: 0, dataDir };
  let child: ReturnType<typeof fork> | undefined, url = "", sequence = 0, container = "";
  let image = "", volume = "";
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  async function start() {
    await writeFile(settingsFile, JSON.stringify(settings), { mode: 0o600 });
    child = fork(resolve(root, "tests/server/node-test.ts"), [], { env: { ...process.env, BOARD_SETTINGS: settingsFile },
      stdio: ["ignore", "pipe", "pipe", "ipc"] });
    let errors = "";
    child.stderr?.on("data", (value) => { errors += value; });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Node test server did not start: " + errors.slice(-500))), 15000);
      child!.once("exit", (code) => { clearTimeout(timer); if (code) reject(Error("Node test server exited: " + errors.slice(-500))); });
      child!.on("message", (message: any) => {
        if (message.ready) { url = `http://127.0.0.1:${message.port}`; clearTimeout(timer); resolve(); }
        else {
          const request = pending.get(message.id); pending.delete(message.id);
          if (message.error) request?.reject(Error(message.error)); else request?.resolve(message.result);
        }
      });
    });
  }
  function ipc(value: any): Promise<any> {
    const id = ++sequence;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); child!.send({ id, value }); });
  }
  async function stop() { if (child?.connected) { const old = child; await ipc({ shutdown: true }); await new Promise<void>((r) => old.exitCode !== null ? r() : old.once("exit", () => r())); } }
  async function runDocker() {
    image = "nextphase-board-w1-" + crypto.randomUUID();
    execFileSync("docker", ["build", "--pull=false", "-f", "apps/server/Dockerfile", "-t", image, "."], { cwd: root, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16777216 });
    const config = { ...settings, supabaseUrl: context.proxyUrl.replace("127.0.0.1", "host.docker.internal"), port: 8788, dataDir: "/data" };
    await writeFile(settingsFile, JSON.stringify(config), { mode: 0o644 }); await chmod(folder, 0o755);
    volume = image + "-data";
    execFileSync("docker", ["volume", "create", volume], { stdio: "pipe" });
    container = execFileSync("docker", ["create", "-p", "127.0.0.1::8788", "-v", volume + ":/data",
      "-e", "BOARD_SETTINGS=/app/settings.json", image], { encoding: "utf8" }).trim();
    // docker cp sends the local temporary file to the daemon; a bind mount
    // would require the daemon to share the client's system temporary folder.
    execFileSync("docker", ["cp", settingsFile, container + ":/app/settings.json"], { stdio: "pipe" });
    execFileSync("docker", ["start", container], { stdio: "pipe" });
    const mapping = execFileSync("docker", ["port", container, "8788/tcp"], { encoding: "utf8" }).trim();
    url = "http://" + mapping;
    await ready();
  }
  async function ready() {
    if (container) url = "http://" + execFileSync("docker", ["port", container, "8788/tcp"], { encoding: "utf8" }).trim();
    for (let n = 0; n < 100; n++) {
      try { await fetch(url + "/probe"); return; }
      catch {
        if (container && execFileSync("docker", ["inspect", "--format", "{{.State.Status}}", container], { encoding: "utf8" }).trim() === "exited") break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw Error("Server did not become ready");
  }
  try { if (docker) await runDocker(); else await start(); }
  catch (error) {
    if (container) {
      const logs = spawnSync("docker", ["logs", container], { encoding: "utf8" });
      console.error("Container startup log: " + (logs.stdout + logs.stderr).slice(-3000));
      execFileSync("docker", ["rm", "-f", container]);
    } if (volume) execFileSync("docker", ["volume", "rm", volume], { stdio: "pipe" });
    if (image) execFileSync("docker", ["image", "rm", image]); await rm(folder, { recursive: true, force: true }); throw error; }
  return {
    runner: docker ? "docker" : "node",
    request: (path, init) => fetch(url + path, init),
    async connect(path, origin = context.origin) {
      const socket = new WebSocket(url.replace("http:", "ws:") + path, { origin, maxPayload: 8 * 1048576 });
      const result = peer(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("open", resolve); socket.once("error", reject);
        socket.once("unexpected-response", (_req: any, response: any) => { response.resume(); reject(Error("Upgrade refused " + response.statusCode)); });
      });
      return result;
    },
    async control(value) {
      if (docker) {
        if (value.restart) { execFileSync("docker", ["restart", container], { stdio: "pipe" }); await ready(); }
        return {};
      }
      if (value.restart) { await stop(); await start(); return {}; }
      if (value.noOperator !== undefined) { await stop(); settings.operatorKey = value.noOperator ? undefined as any : context.operatorKey; await start(); return {}; }
      if (value.fenceUnreadable !== undefined) { await chmod(resolve(dataDir, "restore-fences.sqlite"), value.fenceUnreadable ? 0 : 0o600); return {}; }
      return ipc(value);
    },
    async wake(board) { if (docker) { execFileSync("docker", ["restart", container], { stdio: "pipe" }); await ready(); } else { await stop(); await start(); } },
    async restoreFile(board, envelope, fenced) {
      const file = resolve(folder, "rewind.sqlite");
      await rm(file, { force: true });
      if (fenced) await ipc({ board, raiseFence: true });
      await stop();
      const storage = new NodeStorage(file);
      initialize(storage);
      replace({ storage } as any, decodeBackup(envelope, board));
      storage.close();
      await cp(file, resolve(dataDir, "boards", board + ".sqlite")); await start();
    },
    async volumeCopy(board) {
      await stop();
      const copy = resolve(folder, "volume"); await cp(dataDir, copy, { recursive: true });
      await start();
      await ipc({ board, raiseFence: true }); // Make both the board and fence newer than the copy.
      await stop();
      await rm(dataDir, { recursive: true }); await cp(copy, dataDir, { recursive: true });
      execFileSync(process.execPath, ["apps/server/scripts/mark-restored-volume.mjs", dataDir], { cwd: root, stdio: "pipe" });
      await start();
    },
    async rows(board, table) { return ipc({ board, rows: table }); },
    async close() {
      if (docker) { execFileSync("docker", ["rm", "-f", container], { stdio: "pipe" }); execFileSync("docker", ["volume", "rm", volume], { stdio: "pipe" }); execFileSync("docker", ["image", "rm", image], { stdio: "pipe" }); }
      else { await chmod(resolve(dataDir, "restore-fences.sqlite"), 0o600).catch(() => {}); await stop(); }
      await rm(folder, { recursive: true, force: true });
    },
  };
}
