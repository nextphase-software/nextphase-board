// SPDX-License-Identifier: Apache-2.0
// Local team mode on one computer: a local Supabase stack, the Board server and the
// web app, with three test people. Commands: start, code <person>, stop [--wipe].
// Everything it creates lives in .local/team/ (git-ignored) and in the Docker
// containers and volumes of one Supabase project ID. It never prints keys.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const home = resolve(root, ".local/team");
const paths = {
  config: resolve(home, "supabase/config.toml"),
  template: resolve(home, "supabase/templates/magic-link.html"),
  keys: resolve(home, "supabase/signing_keys.json"),
  settings: resolve(home, "server-settings.json"),
  processes: resolve(home, "processes.json"),
  data: resolve(home, "data"),
  logs: resolve(home, "logs"),
};
const project = "nextphase-board-local";
const database = "supabase_db_" + project;
const app = "http://127.0.0.1:4173", server = "http://127.0.0.1:8788", inbox = "http://127.0.0.1:55324";
const workspaceName = "Example team", boardTitle = "Team test board";
const people = {
  ana: { email: "ana@example.com", role: "owner" },
  ben: { email: "ben@example.com", role: "editor" },
  mia: { email: "mia@example.com", role: "viewer" },
};
const supabaseCli = resolve(root, "node_modules/.bin/supabase");

class Stop extends Error {}
const fail = (message) => { throw new Stop(message); };
const say = (message) => console.log(message);
const step = (message) => console.log("· " + message);

function run(command, args, { input, env, log, quiet = false, cwd = root } = {}) {
  const result = spawnSync(command, args, { cwd, input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env }, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
  if (log) writeFileSync(resolve(paths.logs, log), `$ ${[command, ...args].join(" ")}\n${quiet ? "(output not kept: it contains local keys)\n" : result.stdout ?? ""}${result.stderr ?? ""}\n`, { flag: "a" });
  return result;
}
function tail(text, lines = 12) { return String(text ?? "").trim().split("\n").slice(-lines).join("\n"); }

// ---------- checks ----------
function checkToolchain() {
  const node = process.versions.node;
  const npm = /\bnpm\/(\S+)/.exec(process.env.npm_config_user_agent ?? "")?.[1]
    ?? run("npm", ["--version"]).stdout?.trim();
  if (node !== "26.13.0" || npm !== "11.20.0") {
    fail(`Board needs Node 26.13.0 and npm 11.20.0; this terminal has Node ${node} and npm ${npm || "unknown"}.\n` +
      "Install Node 26.13.0 (it includes npm 11.20.0), for example with a Node version manager, then run the command again.");
  }
  const docker = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (docker.error) fail("Docker is not installed. Install Docker Desktop, start it, then run the command again.");
  if (docker.status !== 0) fail("Docker is not running. Start Docker Desktop, wait until it says it is running, then run the command again.");
}
function checkInstall() {
  if (!existsSync(resolve(root, "node_modules/.package-lock.json"))) {
    step("Installing dependencies (npm ci, first run only)");
    const install = run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { log: "install.log" });
    if (install.status !== 0) fail("npm ci failed:\n" + tail(install.stderr));
  }
  if (run(supabaseCli, ["--version"]).status !== 0) {
    // The pinned supabase package downloads its CLI program in its install script.
    step("Installing the Supabase command-line tool (first run only)");
    const rebuild = run("npm", ["rebuild", "supabase", "--ignore-scripts=false"], { log: "install.log" });
    if (rebuild.status !== 0 || run(supabaseCli, ["--version"]).status !== 0) {
      fail("Could not install the Supabase command-line tool:\n" + tail(rebuild.stderr));
    }
  }
}
function portOpen(port) {
  return new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); done(true); });
    socket.once("error", () => done(false));
    socket.setTimeout(1000, () => { socket.destroy(); done(false); });
  });
}
function containersOnPort(port) {
  return run("docker", ["ps", "--filter", "publish=" + port, "--format", "{{.Names}}"]).stdout?.trim().split("\n").filter(Boolean) ?? [];
}

// ---------- files ----------
function writeStackFiles() {
  mkdirSync(resolve(home, "supabase/templates"), { recursive: true });
  mkdirSync(paths.logs, { recursive: true });
  // The committed config with only its project ID changed, so this stack's containers
  // and volumes never clash with the test stack's.
  const committed = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
  const config = committed.replace(/^project_id = ".*"$/m, `project_id = "${project}"`);
  if (config === committed && !committed.includes(project)) fail("supabase/config.toml has no project_id line");
  writeFileSync(paths.config, config);
  copyFileSync(resolve(root, "supabase/templates/magic-link.html"), paths.template);
  if (!existsSync(paths.keys)) {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const key = { ...privateKey.export({ format: "jwk" }), kid: randomUUID(), alg: "ES256", use: "sig", key_ops: ["sign", "verify"] };
    writeFileSync(paths.keys, JSON.stringify([key], null, 2) + "\n", { mode: 0o600 });
    step("Created a signing key for sign-in tokens");
  }
}
function readJson(path) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } }

// ---------- Supabase ----------
function supabase(args, options) { return run(supabaseCli, [...args, "--workdir", home], options); }
function stackStatus() {
  const status = supabase(["status", "-o", "json"]);
  if (status.status !== 0) return null;
  try { return JSON.parse(status.stdout.slice(status.stdout.indexOf("{"))); } catch { return null; }
}
async function startSupabase() {
  let status = stackStatus();
  if (status?.API_URL) { step("Local Supabase is already running; reusing it"); return status; }
  for (const port of [55321, 55322, 55324]) {
    if (await portOpen(port)) {
      const owners = containersOnPort(port).filter((name) => !name.endsWith(project));
      fail(`Port ${port} is already in use${owners.length ? " by " + owners.join(", ") : ""}. ` +
        "Another local Supabase stack (such as the test stack) is probably running. Stop it, then run the command again.");
    }
  }
  step("Starting local Supabase in Docker (the first time, downloading its images takes a few minutes)");
  const started = supabase(["start"], { log: "supabase.log", quiet: true });
  if (started.status !== 0) fail("Supabase did not start:\n" + tail(started.stderr) + `\nFull log: ${resolve(paths.logs, "supabase.log")}`);
  status = stackStatus();
  if (!status?.API_URL || !status.SERVICE_ROLE_KEY || !status.ANON_KEY) fail("Supabase started but did not report its address and keys");
  return status;
}
function applySchema() {
  step("Applying the Board database schema");
  const schema = readFileSync(resolve(root, "apps/server/supabase/nextphase_board.sql"), "utf8");
  const psql = ["exec", "-i", database, "psql", "-q", "-U", "postgres", "-v", "ON_ERROR_STOP=1"];
  let result = run("docker", psql, { input: schema, log: "schema.log" });
  if (result.status !== 0) fail("The database schema did not apply:\n" + tail(result.stderr));
  // Expose the schema through the Data API only after it applied completely.
  result = run("docker", psql, { log: "schema.log", input: "ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, nextphase_board';\nNOTIFY pgrst, 'reload config';\nNOTIFY pgrst, 'reload schema';\n" });
  if (result.status !== 0) fail("Could not expose the Board schema:\n" + tail(result.stderr));
}

// ---------- HTTP helpers ----------
async function request(url, { method = "GET", headers = {}, body, expect } = {}) {
  const response = await fetch(url, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
  const text = await response.text();
  const value = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (expect && !expect.includes(response.status)) {
    const detail = typeof value === "object" && value ? value.error ?? value.code ?? value.msg ?? "" : "";
    const code = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Stop(`${method} ${new URL(url).pathname} answered ${response.status} ${code}`.trim());
  }
  return { status: response.status, value };
}
async function until(check, what, seconds = 60) {
  const end = Date.now() + seconds * 1000;
  for (;;) {
    try { const value = await check(); if (value) return value; } catch { /* retry */ }
    if (Date.now() > end) fail(`Timed out waiting for ${what}`);
    await new Promise((done) => setTimeout(done, 500));
  }
}
function service(stack) {
  const headers = { apikey: stack.serviceKey, Authorization: "Bearer " + stack.serviceKey };
  return {
    rest: (path) => request(stack.supabaseUrl + "/rest/v1/" + path, { headers: { ...headers, "Accept-Profile": "nextphase_board" }, expect: [200] }),
    admin: (path, body) => request(stack.supabaseUrl + "/auth/v1/admin/" + path, { method: body ? "POST" : "GET", headers, body, expect: [200, 201] }),
  };
}
async function findAccount(stack, email) {
  for (let page = 1; ; page++) {
    const { value } = await service(stack).admin(`users?page=${page}&per_page=1000`);
    const found = value.users.find((user) => user.email?.toLowerCase() === email);
    if (found || value.users.length < 1000) return found ?? null;
  }
}
async function freshCode(stack, email) {
  const { value } = await service(stack).admin("generate_link", { type: "magiclink", email });
  const code = value.email_otp ?? value.properties?.email_otp, hash = value.hashed_token ?? value.properties?.hashed_token;
  if (!/^\d{6}$/.test(code ?? "")) fail("Supabase did not return a 6-digit code");
  return { code, hash };
}
async function signIn(stack, email) {
  const { hash } = await freshCode(stack, email);
  const { value } = await request(stack.supabaseUrl + "/auth/v1/verify", { method: "POST",
    headers: { apikey: stack.anonKey }, body: { type: "magiclink", token_hash: hash }, expect: [200] });
  if (!value?.access_token) fail("Could not sign in " + email);
  // The server refuses a token issued "in the future". Docker's clock can run a moment
  // ahead of this computer's, so wait until the token's issue time has passed here.
  const issued = JSON.parse(Buffer.from(value.access_token.split(".")[1], "base64url")).iat * 1000;
  if (issued > Date.now()) await new Promise((done) => setTimeout(done, issued - Date.now() + 50));
  return value.access_token;
}
function api(token) {
  return (path, method = "GET", body, expect = [200, 201]) =>
    request(server + path, { method, body, expect, headers: { Authorization: "Bearer " + token, Origin: app } }).then((r) => r.value);
}

// ---------- processes ----------
function ours(pid) {
  if (!pid) return false;
  const command = run("ps", ["-p", String(pid), "-o", "command="]).stdout?.trim() ?? "";
  return command.includes(resolve(root, "apps/server/dist/node.mjs")) || command.includes(resolve(root, "scripts/serve-web.mjs"));
}
async function stopProcesses() {
  const saved = readJson(paths.processes) ?? {};
  for (const [name, pid] of Object.entries(saved)) {
    if (!ours(pid)) continue;
    try { process.kill(pid, "SIGTERM"); } catch { continue; }
    await until(() => !ours(pid), `the ${name} process to stop`, 15).catch(() => { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } });
    step(`Stopped the ${name === "web" ? "web app" : "Board server"}`);
  }
  rmSync(paths.processes, { force: true });
}
function launch(name, args, env) {
  const log = openSync(resolve(paths.logs, name + ".log"), "a");
  const child = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ["ignore", log, log], env: { ...process.env, ...env } });
  child.unref();
  return child.pid;
}

// ---------- commands ----------
async function start() {
  checkToolchain();
  mkdirSync(paths.logs, { recursive: true });
  checkInstall();
  writeStackFiles();
  const status = await startSupabase();
  applySchema();
  const previous = readJson(paths.settings) ?? {};
  const stack = { supabaseUrl: new URL(status.API_URL).origin, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY };
  await until(() => service(stack).rest("workspaces?select=id&limit=1"), "the Board schema to be served", 30);
  const jwks = (await request(stack.supabaseUrl + "/auth/v1/.well-known/jwks.json", { expect: [200] })).value;
  if (!jwks?.keys?.length) fail("Supabase did not publish its sign-in keys");
  const settings = { supabaseUrl: stack.supabaseUrl, issuer: stack.supabaseUrl + "/auth/v1", serviceKey: stack.serviceKey, jwks,
    allowedOrigin: app, operatorKey: previous.operatorKey ?? randomBytes(32).toString("base64url"), dataDir: paths.data, port: 8788 };
  mkdirSync(paths.data, { recursive: true });
  writeFileSync(paths.settings, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
  step("Wrote the server settings to .local/team/server-settings.json");

  await stopProcesses();
  for (const port of [8788, 4173]) if (await portOpen(port)) fail(`Port ${port} is already in use by another program. Stop it, then run the command again.`);
  step("Building the server and the web app with team features on");
  const builds = [["build-server", [resolve(root, "scripts/build-server.mjs")], {}],
    ["build-web", [resolve(root, "scripts/build-web.mjs")], { BOARD_TEAM_FEATURES: "on", BOARD_SUPABASE_URL: stack.supabaseUrl,
      BOARD_SUPABASE_ANON_KEY: stack.anonKey, BOARD_SERVER_URL: server }]];
  for (const [name, args, env] of builds) {
    const result = run(process.execPath, args, { env, log: "build.log" });
    if (result.status !== 0) fail(`The ${name.replace("build-", "")} build failed:\n` + tail(result.stderr || result.stdout));
  }
  // Same programs as `npm run build:server` / `node apps/server/dist/node.mjs` and
  // `npm --prefix apps/web run serve`, started directly so `team:stop` can find them.
  const processes = {
    server: launch("server", [resolve(root, "apps/server/dist/node.mjs")], { BOARD_SETTINGS: paths.settings }),
    web: launch("web", [resolve(root, "scripts/serve-web.mjs")], {}),
  };
  writeFileSync(paths.processes, JSON.stringify(processes) + "\n");
  await until(async () => (await request(server + "/workspaces")).status === 401, "the Board server (see .local/team/logs/server.log)", 30);
  await until(async () => (await request(app + "/")).status === 200, "the web app (see .local/team/logs/web.log)", 30);
  step("Board server and web app are running");

  await setUpPeople(stack);
  say(`
NextPhase Board team mode is running.

  App:          ${app}
  Local inbox:  ${inbox}  (catches the sign-in emails)

  Ana  ${people.ana.email}  owner of "${workspaceName}"
  Ben  ${people.ben.email}  editor
  Mia  ${people.mia.email}  viewer

To sign in: open the app, choose Sign in (top right), enter an email and choose
"Continue with email". Then run
  npm run team:code ana      (or ben, mia)
and type the 6-digit code it prints. To reach the shared boards, click the board name
(upper left), choose Back to files, then Example team.

When you are done:  npm run team:stop       (keeps your boards)
                    npm run team:stop -- --wipe  (deletes everything)`);
}

async function setUpPeople(stack) {
  const db = service(stack);
  let workspace = (await db.rest(`workspaces?select=id&name=eq.${encodeURIComponent(workspaceName)}`)).value[0]?.id;
  if (!workspace) {
    const result = run(process.execPath, [resolve(root, "apps/server/scripts/setup-workspace.mjs")], { log: "setup.log", env: {
      SUPABASE_URL: stack.supabaseUrl, SUPABASE_SERVICE_KEY: stack.serviceKey, BOARD_OWNER_EMAIL: people.ana.email, BOARD_WORKSPACE_NAME: workspaceName } });
    if (result.status !== 0) fail("Workspace setup failed:\n" + tail(result.stderr));
    workspace = JSON.parse(result.stdout.trim().split("\n").at(-1)).workspaceId;
    step(`Created the workspace "${workspaceName}" with Ana as owner`);
  }
  const ana = api(await signIn(stack, people.ana.email));
  const members = (await ana(`/workspaces/${workspace}/members`)).members;
  for (const name of ["ben", "mia"]) {
    const { email, role } = people[name];
    if (members.some((member) => member.email === email && member.role)) continue;
    // The owner invites through the server, as the Share dialog does; the person accepts.
    const invitation = await ana(`/workspaces/${workspace}/invitations`, "POST", { email, role });
    await api(await signIn(stack, email))(`/invitations/${invitation.id}/accept`, "POST");
    step(`Invited ${name[0].toUpperCase() + name.slice(1)} as ${role} and accepted the invitation`);
  }
  if (!(await ana(`/workspaces/${workspace}/boards`)).boards.length) {
    await ana(`/workspaces/${workspace}/boards`, "POST", { title: boardTitle });
    step(`Created the board "${boardTitle}"`);
  }
}

async function code(who) {
  if (!who) fail("Say who to sign in: npm run team:code ana   (or ben, mia, or an invited email address)");
  const email = (people[who.toLowerCase()]?.email ?? who).toLowerCase();
  const settings = readJson(paths.settings);
  if (!settings) fail("Team mode is not set up yet. Run npm run team:start first.");
  const stack = { supabaseUrl: settings.supabaseUrl, serviceKey: settings.serviceKey };
  try { await request(stack.supabaseUrl + "/auth/v1/health", { headers: { apikey: stack.serviceKey }, expect: [200] }); }
  catch { fail("Local Supabase is not running. Run npm run team:start first."); }
  if (!(await findAccount(stack, email))) fail(`There is no account for ${email}. Invite them from Share first, or use ana, ben or mia.`);
  const { code } = await freshCode(stack, email);
  say(`Sign-in code for ${email}:  ${code}

Type it in the app within the hour. Ask for it after choosing "Continue with email":
each new code replaces the previous one. No email is needed. The app's own email, with
the older code, still lands in the local inbox at ${inbox}.`);
}

async function stop(wipe) {
  if (!existsSync(paths.config)) { say("Team mode is not set up here; there is nothing to stop."); return; }
  await stopProcesses();
  step(wipe ? "Stopping local Supabase and deleting its data" : "Stopping local Supabase (data is kept)");
  const stopped = supabase(wipe ? ["stop", "--no-backup"] : ["stop"], { log: "supabase.log" });
  if (stopped.status !== 0) fail("Supabase did not stop:\n" + tail(stopped.stderr));
  if (wipe) {
    rmSync(home, { recursive: true, force: true });
    say("Team mode stopped. All local team data was deleted; npm run team:start begins from scratch.");
  } else say("Team mode stopped. Your boards and people are kept; npm run team:start brings them back.");
}

const [command, ...rest] = process.argv.slice(2);
const wipe = rest.includes("--wipe") || process.env.npm_config_wipe === "true";
try {
  if (command === "start") await start();
  else if (command === "code") await code(rest[0]);
  else if (command === "stop") await stop(wipe);
  else fail("Usage: node scripts/team-local.mjs start | code <ana|ben|mia|email> | stop [--wipe]");
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error("\n" + error.message);
  process.exitCode = 1;
}
