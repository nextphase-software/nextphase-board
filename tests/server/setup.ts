// SPDX-License-Identifier: Apache-2.0
// Vitest global setup runs in Node for both pools. It never starts or stops a stack.
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Supabase } from "../../apps/server/src/supabase.ts";
import { badTokens, token } from "./tokens.ts";
const root = new URL("../../", import.meta.url);
export default async function setup(project: any) {
  const stackPath = process.env.BOARD_TEST_STACK ?? fileURLToPath(new URL(".stack.json", import.meta.url));
  const stack = JSON.parse(await readFile(stackPath, "utf8"));
  const health = await fetch(stack.apiUrl + "/auth/v1/health", { headers: { apikey: stack.anonKey } });
  if (!health.ok) throw Error("The configured local Supabase stack is not up");
  function sql(text: string) {
    return execFileSync("docker", ["exec", "-i", stack.dbContainer, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
      { input: text, encoding: "utf8", maxBuffer: 8388608, stdio: ["pipe", "pipe", "pipe"] });
  }
  const schema = await readFile(new URL("apps/server/supabase/nextphase_board.sql", root), "utf8");
  sql(schema);
  sql(schema); // Verify that the plain SQL can be applied again without widening access.
  // Exposure comes strictly after successful schema/privilege installation.
  sql("ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, nextphase_board'; NOTIFY pgrst, 'reload config'; NOTIFY pgrst, 'reload schema';");
  const db = new Supabase(stack.apiUrl, stack.serviceRoleKey);
  for (let tries = 0; ; tries++) {
    try { await db.rows("workspaces"); break; }
    catch (error) { if (tries >= 30) throw error; await new Promise((r) => setTimeout(r, 100)); }
  }
  const run = randomUUID();
  const roles = ["owner", "editor", "viewer", "granted", "plain", "outsider"];
  const people: Record<string, any> = {};
  const auth = createClient(stack.apiUrl, stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const name of roles) {
    const email = `w1-${run}-${name}@example.test`, password = randomUUID() + randomUUID();
    const result = await db.client.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw Error("Cannot create independent test identity");
    const login = await auth.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.session) throw Error("Cannot sign in independent test identity");
    people[name] = { id: result.data.user.id, email, token: login.data.session.access_token };
    await db.rpc("remember_person", { person: result.data.user.id, email });
  }
  const keys = JSON.parse(await readFile(stack.signingKeyPath, "utf8"));
  const key = Array.isArray(keys) ? keys[0] : keys;
  const jwks = await (await fetch(stack.apiUrl + "/auth/v1/.well-known/jwks.json")).json();
  const issuer = stack.apiUrl + "/auth/v1";
  const bad = await badTokens(key, issuer, people.owner, stack.jwtSecret);
  let offline = false;
  // All server Supabase and key-endpoint calls pass through this proxy. Test
  // administration uses the stack directly, leaving its containers untouched.
  const proxy = createServer(async (req, res) => {
    if (offline) { req.socket.destroy(); return; }
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (value && name !== "host") headers.set(name, Array.isArray(value) ? value.join(",") : value);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const response = await fetch(stack.apiUrl + req.url, { method: req.method, headers,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(502); res.end(); }
  });
  await new Promise<void>((resolve) => proxy.listen(0, "0.0.0.0", resolve));
  const proxyUrl = `http://127.0.0.1:${(proxy.address() as any).port}`;
  let caseNumber = 0;
  const createdWorkspaces: string[] = [], invitedIds: string[] = [];
  async function fixture() {
    const workspace = await db.rpc<string>("bootstrap_workspace", { name: `W1 ${run} ${++caseNumber}`, owner_id: people.owner.id, owner_email: people.owner.email });
    createdWorkspaces.push(workspace);
    for (const [name, offered] of [["editor", "editor"], ["viewer", "viewer"], ["granted", "guest"], ["plain", "guest"]]) {
      const invitation = await db.rpc("create_invitation", { workspace, board: null, email: people[name].email, role: offered, by: people.owner.id });
      await db.rpc("accept_invitation", { invitation: invitation.id, person: people[name].id, email: people[name].email });
    }
    const a = await db.rpc("create_board", { workspace, person: people.owner.id, title: "Synthetic board A" });
    const b = await db.rpc("create_board", { workspace, person: people.owner.id, title: "Synthetic board B" });
    await db.rpc("write_board_grant", { board: a.id, person: people.granted.id, role: "editor" });
    return { workspace, a: a.id, b: b.id };
  }
  const helper = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const value = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      let result: any;
      switch (req.url) {
        case "/fixture": result = await fixture(); break;
        case "/proxy": offline = value.offline; result = {}; break;
        case "/rpc":
          result = await db.rpc(value.name, value.parameters);
          if (value.name === "bootstrap_workspace") createdWorkspaces.push(result);
          break;
        case "/rows": result = await db.rows(value.table, value.filters); break;
        case "/sql": result = sql(value.sql); break;
        case "/token": result = await token(key, issuer, value.person ?? people.owner, value.options); break;
        case "/rls": {
          const client = createClient(stack.apiUrl, stack.anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + value.token } } });
          if (value.rpc) { const reply = await client.schema("nextphase_board").rpc(value.rpc, value.parameters); result = { data: reply.data, error: !!reply.error }; }
          else if (value.write) { const reply = await client.schema("nextphase_board").from(value.table).insert(value.write); result = { error: !!reply.error }; }
          else { const reply = await client.schema("nextphase_board").from(value.table).select("*"); result = { data: reply.data, error: !!reply.error }; }
          break;
        }
        case "/account-login": {
          const { data, error } = await db.client.auth.admin.listUsers({ perPage: 1000 });
          if (error) throw error;
          const person = data.users.find((p) => p.email === value.email);
          if (person) invitedIds.push(person.id);
          result = { exists: !!person, confirmed: !!person?.email_confirmed_at };
          const before = await fetch(stack.mailUrl + "/api/v1/messages").then((r) => r.json());
          result.mailBefore = before;
          const otp = await auth.auth.signInWithOtp({ email: value.email, options: { shouldCreateUser: false } });
          result.otpError = !!otp.error;
          if (value.unknown) break;
          let message: any;
          for (let attempt = 0; attempt < 50; attempt++) {
            const messages = await fetch(stack.mailUrl + "/api/v1/messages").then((r) => r.json()) as any;
            const summary = messages.messages?.find((m: any) => JSON.stringify(m.To).includes(value.email));
            if (summary) { message = await fetch(stack.mailUrl + "/api/v1/message/" + summary.ID).then((r) => r.json()); break; }
            await new Promise((r) => setTimeout(r, 100));
          }
          const match = /[?&]token=([^&"\s<>]+)/.exec(JSON.stringify(message));
          if (!match) throw Error("No one-time sign-in token in the mail catcher");
          const verified = await auth.auth.verifyOtp({ token_hash: decodeURIComponent(match[1]), type: "magiclink" });
          if (verified.error || !verified.data.session) throw Error("One-time sign-in failed");
          result.token = verified.data.session.access_token;
          break;
        }
        case "/setup-script": {
          const name = value.name ?? `Setup ${run}`;
          const output = execFileSync(process.execPath, ["apps/server/scripts/setup-workspace.mjs"], { cwd: root, encoding: "utf8",
            env: { ...process.env, SUPABASE_URL: stack.apiUrl, SUPABASE_SERVICE_KEY: stack.serviceRoleKey,
              BOARD_OWNER_EMAIL: people.owner.email, BOARD_WORKSPACE_NAME: name }, stdio: ["ignore", "pipe", "pipe"] });
          const record = JSON.parse(output.trim()); createdWorkspaces.push(record.workspaceId); result = record; break;
        }
        default: throw Error("Unknown test helper action");
      }
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(result));
    } catch (error) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Test helper failed", detail: (error as Error).message.slice(0, 300) })); }
  });
  await new Promise<void>((resolve) => helper.listen(0, "127.0.0.1", resolve));
  const context = { docker: process.env.BOARD_TEST_TARGET === "docker", people, bad, jwks, issuer, proxyUrl, helperUrl: `http://127.0.0.1:${(helper.address() as any).port}`,
    origin: "http://127.0.0.1:4173", operatorKey: randomUUID(), stack: { apiUrl: stack.apiUrl }, serviceKey: stack.serviceRoleKey };
  project.provide("board", context);
  return async () => {
    offline = false;
    for (const workspace of createdWorkspaces) sql(`BEGIN;
      DELETE FROM nextphase_board.invitations WHERE workspace_id='${workspace}';
      DELETE FROM nextphase_board.access_changes WHERE workspace_id='${workspace}';
      DELETE FROM nextphase_board.board_grants WHERE board_id IN (SELECT id FROM nextphase_board.boards WHERE workspace_id='${workspace}');
      DELETE FROM nextphase_board.boards WHERE workspace_id='${workspace}';
      DELETE FROM nextphase_board.workspace_members WHERE workspace_id='${workspace}';
      DELETE FROM nextphase_board.access_log_floor WHERE workspace_id='${workspace}';
      DELETE FROM nextphase_board.workspaces WHERE id='${workspace}'; COMMIT;`);
    for (const person of [...Object.values(people), ...invitedIds.map((id) => ({ id }))]) {
      await db.client.schema("nextphase_board").from("people").delete().eq("id", person.id);
      await db.client.auth.admin.deleteUser(person.id);
    }
    for (const server of [helper, proxy]) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  };
}
