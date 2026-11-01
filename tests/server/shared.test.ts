// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
import { BoardSession, type Transport, type PresenceInput } from "../../packages/board-sync/src/session.ts";
import { canonical, add, type BoardV10 } from "../../packages/board-rules/src/document.ts";
import { defaultConnectorStyle } from "../../packages/board-rules/src/objects/connector.ts";

const context = inject<Context & { docker: boolean }>("board");
const runner = context.docker ? "docker" : inject<string>("runner");
type Fixture = { workspace: string; a: string; b: string; people: Context["people"] };
type Client = Awaited<ReturnType<typeof join>>;
let driver: Driver, f: Fixture, pass = 0, fail = 0;
const clients: Client[] = [], measures: Record<string, unknown> = {};
const presence = (): PresenceInput => ({ cursor: { x: 10, y: 20 }, selection: [], view: { x: 0, y: 0, width: 100, height: 100 }, active: true });
const clock = { now: Date.now, after(ms: number, run: () => void) { const timer = setTimeout(run, ms); return () => clearTimeout(timer); } };
beforeAll(async () => { if (runner !== "docker") driver = await makeDriver(context); });
afterEach(async () => {
  if (!driver) return;
  for (const client of clients.splice(0)) { client.session.close(); for (const peer of client.peers) await peer.close(); }
  await driver.control({ fixedNow: null });
});
afterAll(async () => {
  if (!driver) return;
  await driver.close();
  console.log("SUMMARY-SHARED " + JSON.stringify({ runner, checks: pass + fail, pass, fail, measures }));
});
function check(id: number, name: string, run: () => Promise<void>) {
  test.skipIf(runner === "docker")(`S${id} ${name}`, async () => {
    try { f = await helper("shared-fixture"); await run(); pass++; console.log(`PASS: S${id} ${name}`); }
    catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
  });
}
async function helper(action: string, value: unknown = {}): Promise<any> {
  const response = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  const result = await response.json() as any;
  assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
async function request(path: string, name = "owner", method = "GET", value?: unknown) {
  return driver.request(path, { method, headers: { Authorization: "Bearer " + f.people[name].token,
    Origin: context.origin, "Content-Type": "application/json" }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
}
async function success(path: string, name = "owner", method = "GET", value?: unknown, status = 200): Promise<any> {
  const response = await request(path, name, method, value);
  assert.equal(response.status, status, await response.clone().text()); return response.json();
}
const ticket = (board = f.a, name = "editor") => success(`/boards/${board}/join-tickets`, name, "POST", undefined, 201);
const exported = () => request(`/boards/${f.a}/export`).then((r) => r.text());
async function until(read: () => any | Promise<any>, accepts: (value: any) => boolean) {
  const deadline = Date.now() + 5000; let value;
  do { value = await read(); if (accepts(value)) return value; await new Promise((resolve) => setTimeout(resolve, 5)); } while (Date.now() < deadline);
  assert.fail("Condition not reached in five seconds: " + JSON.stringify(value));
}
async function join(name = "editor", board = f.a, clientId = name === "editor" ? 100 : name === "granted" ? 200 : 300) {
  const peers: Peer[] = [], events: any[] = [], out: string[] = [], incoming: string[] = [];
  let heldOut = false, heldIn = false, handlers: Parameters<Transport["listen"]>[0], current!: Peer;
  const session = await BoardSession.join({ clock, clientId, ticket: () => ticket(board, name),
    open: async (issued) => {
      current = await driver.connect(`/boards/${board}/join?ticket=${issued.ticket}`); peers.push(current);
      const opened = current;
      return { send: (text) => { if (heldOut) out.push(text); else opened.send(text); }, close: () => { void opened.close(); },
        listen: (next) => { handlers = next; opened.listen({ message: (text) => {
          if (heldIn) incoming.push(text); else next.message(text);
        }, close: (code) => next.close(code) }); } };
    } });
  session.subscribe((event) => events.push(event));
  const client = { session, peers, events, out, incoming, get peer() { return current; },
    holdOut: (hold = true) => { heldOut = hold; }, holdIn: (hold = true) => { heldIn = hold; },
    releaseOut() { heldOut = false; for (const text of out.splice(0)) current.send(text); },
    releaseIn() { heldIn = false; for (const text of incoming.splice(0)) handlers.message(text); },
    raw: (value: unknown) => current.send(value) };
  clients.push(client); return client;
}
async function all() {
  const people = [await join("editor"), await join("granted"), await join("viewer")] as const;
  await until(() => people.every((p) => p.session.present.size === 2), Boolean);
  return people;
}
async function saved(client: Client, id: string) {
  await until(() => client.session.requests.get(id), (r) => r?.state === "saved" || r?.state === "refused");
  assert.equal(client.session.requests.get(id)?.state, "saved", JSON.stringify(client.session.requests.get(id)));
  return client.peer.messages.find((m) => m.kind === "saved" && m.requestId === id)!;
}
async function edit(client: Client, change: (board: BoardV10) => BoardV10) {
  const id = client.session.edit(change(client.session.board)); await saved(client, id); return id;
}
const patch = (b: BoardV10, value: object, index = 0): BoardV10 => ({ ...b, objects: b.objects.map((o, i) => i === index ? { ...o, ...value } : o) });
function remove(b: BoardV10, ids: string[]): BoardV10 {
  const set = new Set(ids);
  return { ...b, objects: b.objects.filter((o) => !set.has(o.id)).map((o, order) => ({ ...o, order,
    section: o.section && set.has(o.section) ? null : o.section })),
    retiredGenerations: [...b.retiredGenerations, ...b.objects.filter((o) => set.has(o.id)).map((o) => o.generation)].sort() };
}
function link(b: BoardV10, from = b.objects[0].id, to = b.objects[1].id): BoardV10 {
  return { ...b, objects: [...b.objects, { id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "connector", text: "", marks: [],
    order: b.objects.length, group: null, section: null, color: "neutral", textSize: "medium", align: "center", ...defaultConnectorStyle(),
    from: { object: from, anchor: "auto" }, to: { object: to, anchor: "auto" } }] };
}
async function equal(people: readonly Client[]) {
  const json = await exported();
  await until(() => people.map((p) => canonical(p.session.board)), (values) => values.every((value: string) => value === json));
  return JSON.parse(json) as BoardV10;
}
async function seed(a: Client, text = "abcd", count = 1) {
  await edit(a, (b) => {
    for (let i = 0; i < count; i++) b = add(b, "sticky", i * 300, 0);
    return patch(b, { text });
  });
}
async function concurrent(a: Client, b: Client, changes: [(b: BoardV10) => BoardV10, (b: BoardV10) => BoardV10], reverse: boolean) {
  a.holdIn(); b.holdIn(); a.holdOut(); b.holdOut();
  const ids = [a.session.edit(changes[0](a.session.board)), b.session.edit(changes[1](b.session.board))];
  const order = reverse ? [b, a] : [a, b], replies: any[] = [];
  for (const client of order) {
    client.releaseOut(); const id = ids[client === a ? 0 : 1];
    await until(() => client.peer.messages.find((m) => ["saved", "refused"].includes(m.kind) && m.requestId === id), Boolean);
    replies.push(client.peer.messages.find((m) => ["saved", "refused"].includes(m.kind) && m.requestId === id));
  }
  a.releaseIn(); b.releaseIn();
  return replies;
}
async function closeCode(client: Client, code: number) { await until(() => client.peer.closed, (value) => value !== null); assert.equal(client.peer.closed, code); }
async function evict() { if (runner === "workerd") await driver.wake(f.a); }

check(94, "stamped join and relayed presence never disclose account identity", async () => {
  const [a, b, c] = await all();
  const joined = [a, b, c].map((p) => p.peer.messages[0]);
  for (const [index, name] of ["editor", "granted", "viewer"].entries()) {
    const self = joined[index].self, email = f.people[name].email;
    assert.match(self.connection, /^[0-9a-f-]{36}$/); assert.match(self.person, /^[0-9a-f]{32}$/);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`presence:${f.a}:${f.people[name].id}`));
    assert.equal(self.person, [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("").slice(0, 32));
    assert.equal(self.label, email.slice(0, email.lastIndexOf("@"))); assert.equal(self.role, index === 2 ? "viewer" : "editor");
    assert.equal(self.active, false); assert.deepEqual(self.selection, []); assert.equal(self.cursor, null);
    assert.deepEqual(self.view, { x: 0, y: 0, width: 1, height: 1 }); assert.equal(joined[index].present.length, index);
  }
  const id = crypto.randomUUID(), other = crypto.randomUUID(), start = a.peer.messages.length;
  a.raw({ kind: "presence", ...presence(), selection: [id, other, id, other] });
  await until(() => b.session.present.get(a.session.self!.connection)?.selection.length, (n) => n === 2);
  await until(() => c.session.present.get(a.session.self!.connection)?.selection.length, (n) => n === 2);
  assert.deepEqual(b.session.present.get(a.session.self!.connection)?.selection, [id, other]); assert.equal(a.peer.messages.length, start);
  c.raw({ kind: "presence", ...presence() }); await until(() => a.session.present.get(c.session.self!.connection)?.active, Boolean);
  assert.equal(a.session.present.get(c.session.self!.connection)?.role, "viewer");
  const tab = await join(), elsewhere = await join("editor", f.b);
  assert.notEqual(tab.session.self!.connection, a.session.self!.connection); assert.notEqual(tab.session.self!.colour, a.session.self!.colour);
  assert.equal(tab.session.self!.person, a.session.self!.person); assert.notEqual(elsewhere.session.self!.person, a.session.self!.person);
  for (const client of [a, b, c]) for (const message of client.peer.messages.filter((m) => ["present", "joined"].includes(m.kind))) {
    assert(!JSON.stringify(message).includes(f.people.editor.id)); assert(!JSON.stringify(message).includes(f.people.editor.email));
  }
});

check(95, "presence changes neither revision nor exported board", async () => {
  const [a, b, c] = await all(), before = await exported(), revision = a.session.revision;
  const now = Date.now(); await driver.control({ fixedNow: now });
  for (let i = 0; i < 20; i++) {
    await driver.control({ fixedNow: now + i * 100 });
    for (const client of [a, b, c]) client.raw({ kind: "presence", ...presence(), cursor: { x: i, y: 0 } });
    await until(() => b.session.present.get(a.session.self!.connection)?.cursor?.x, (x) => x === i);
  }
  const d = await join(); assert.equal(d.session.revision, revision); assert.equal(await exported(), before);
  for (const p of [a, b, c]) assert(!p.peer.messages.some((m) => ["received", "saved", "update"].includes(m.kind)));
});

check(96, "presence rejects forged fields and preserves server stamps", async () => {
  const [a, b] = await all(), start = b.peer.messages.length;
  for (const field of ["label", "person", "role", "colour", "connection", "update"]) {
    a.raw({ kind: "presence", ...presence(), [field]: "spoof" }); assert.equal((await a.peer.next("refused")).reason, "presence_fields");
  }
  assert.equal(b.peer.messages.length, start); a.raw({ kind: "presence", ...presence() });
  await until(() => b.session.present.get(a.session.self!.connection)?.active, Boolean);
  assert.equal(b.session.present.get(a.session.self!.connection)?.label, a.session.self!.label);
});

check(97, "presence bounds and sliding window survive hibernation", async () => {
  const [a, b] = await all(), now = Date.now(); await driver.control({ fixedNow: now });
  const start = b.peer.messages.filter((m) => m.kind === "present").length;
  for (let i = 0; i < 11; i++) {
    if (i === 5) await evict(); a.raw({ kind: "presence", ...presence(), cursor: { x: i, y: 0 } });
    if (i < 10) await until(() => b.session.present.get(a.session.self!.connection)?.cursor?.x, (n) => n === i);
  }
  // A protocol round trip on the same socket is a barrier after the dropped frame.
  a.raw({ kind: "renew", token: f.people.editor.token }); await a.peer.next("renewed");
  assert.equal(b.peer.messages.filter((m) => m.kind === "present").length - start, 10);
  assert(!a.peer.messages.some((m) => m.kind === "refused"));
  await driver.control({ fixedNow: now + 1000 });
  const large = JSON.stringify({ kind: "presence", ...presence(), selection: Array.from({ length: 250 }, () => crypto.randomUUID()) });
  a.raw(large + " ".repeat(12288 - new TextEncoder().encode(large).length));
  await until(() => b.session.present.get(a.session.self!.connection)?.selection.length, (n) => n === 250);
  for (const [value, reason] of [[large + " ".repeat(12289 - new TextEncoder().encode(large).length), "presence_too_large"],
    [{ kind: "presence", ...presence(), selection: Array(251).fill(crypto.randomUUID()) }, "presence_selection_limit"],
    [JSON.stringify({ kind: "presence", ...presence(), update: "x" }) + " ".repeat(12289), "presence_too_large"],
    [{ kind: "presence", ...presence(), view: { x: 0, y: 0, width: 0, height: 1 } }, "bad_presence"],
    [{ kind: "presence", ...presence(), cursor: { x: 1000001, y: 0 } }, "bad_presence"],
    [{ kind: "presence", ...presence(), selection: ["AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"] }, "bad_presence"],
    [{ kind: "presence", ...presence(), active: "yes" }, "bad_presence"]] as const) {
    a.raw(value); assert.equal((await a.peer.next("refused")).reason, reason);
  }
});

check(98, "fifty connections consume tickets before refusing the next upgrade", async () => {
  const people = [...await all()]; while (people.length < 50) people.push(await join());
  const colours = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#4f46e5"];
  assert.deepEqual(people.slice(0, 9).map((p) => p.session.self!.colour), [...colours, colours[0]]);
  const issued = await ticket(), path = `/boards/${f.a}/join?ticket=${issued.ticket}`;
  for (const [status, reason] of [[429, "room_full"], [401, "ticket_invalid"]] as const) {
    const response = await driver.request(path, { headers: { Origin: context.origin } });
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: { reason } });
  }
  const old = people[0].session.self!.connection; people[0].session.close(); await people[0].peer.close();
  await until(() => people[1].session.present.has(old), (value) => !value); await join();
});

check(99, "normal and forced departures carry left and the declared close code", async () => {
  const [a, b, c] = await all(); const old = a.session.self!.connection;
  a.session.close(); await a.peer.close();
  await until(() => [b, c].every((p) => !p.session.present.has(old)), Boolean);
  const renewed = await join(); renewed.raw({ kind: "renew", token: f.people.granted.token }); await closeCode(renewed, 4401);
  await until(() => !b.session.present.has(renewed.session.self!.connection), Boolean);
  const removed = await join();
  await success(`/workspaces/${f.workspace}/members/${f.people.editor.id}`, "owner", "DELETE"); await closeCode(removed, 4403);
  await success(`/workspaces/${f.workspace}/members/${f.people.granted.id}`, "owner", "PUT", { role: "viewer" }); await closeCode(b, 4403);
  await success(`/workspaces/${f.workspace}/members/${f.people.viewer.id}`, "owner", "PUT", { role: "editor" }); await closeCode(c, 4409);
  const d = await join("granted"), e = await join("viewer");
  const headers = { "Board-Operator-Key": context.operatorKey, "Content-Type": "application/json" };
  const backup = await driver.request(`/operator/boards/${f.a}/backup`, { method: "POST", headers }).then((r) => r.json());
  assert.equal((await driver.request(`/operator/boards/${f.a}/restore`, { method: "POST", headers, body: JSON.stringify(backup) })).status, 200);
  await closeCode(d, 4423); await closeCode(e, 4423);
  assert(d.peer.messages.some((m) => m.kind === "left" && m.connection === e.session.self!.connection));
  assert(e.peer.messages.some((m) => m.kind === "left" && m.connection === d.session.self!.connection));
});

check(100, "expiry leaves editing open and only accepted presence renews the deadline", async () => {
  const [a, b, c] = await all(), now = Date.now(); await driver.control({ fixedNow: now });
  for (const p of [a, b, c]) p.raw({ kind: "presence", ...presence() });
  await until(() => b.session.present.get(a.session.self!.connection)?.active, Boolean); await evict();
  await driver.control({ fixedNow: now + 10000 }); await edit(a, (b) => ({ ...b, title: "Still editing" }));
  a.raw({ kind: "renew", token: f.people.editor.token }); await a.peer.next("renewed");
  await driver.control({ board: f.a, fixedNow: now + 29999, alarm: true }); assert(b.session.present.has(a.session.self!.connection));
  await driver.control({ board: f.a, fixedNow: now + 30000, alarm: true });
  await until(() => [b, c].every((p) => !p.session.present.has(a.session.self!.connection)), Boolean);
  assert.equal(a.peer.closed, null); await edit(a, (b) => ({ ...b, title: "After expiry" }));
  a.raw({ kind: "presence", ...presence() }); await until(() => b.session.present.has(a.session.self!.connection), Boolean);
});

check(101, "hibernation retains stamps and the latest presence", async () => {
  const [a, b] = await all(); a.raw({ kind: "presence", ...presence() });
  await until(() => b.session.present.get(a.session.self!.connection)?.active, Boolean); await evict();
  a.raw({ kind: "presence", ...presence(), cursor: { x: 123, y: 456 } });
  await until(() => b.session.present.get(a.session.self!.connection)?.cursor?.x, (x) => x === 123);
  const d = await join(), present = d.session.present.get(a.session.self!.connection)!;
  assert.equal(present.label, a.session.self!.label); assert.equal(present.colour, a.session.self!.colour); assert.equal(present.person, a.session.self!.person);
  assert.deepEqual(present.cursor, { x: 123, y: 456 });
});

check(102, "viewer raw and local edit undo redo cannot write", async () => {
  const [a, b, c] = await all(), before = await exported(), start = c.peer.messages.length;
  for (const result of [c.session.edit(c.session.board), c.session.undo(), c.session.redo()]) assert.equal(result, "role_too_low");
  assert.equal(c.peer.messages.length, start); c.raw({ kind: "edit", epoch: c.session.epoch, requestId: "viewer", update: "AAA=" });
  const reply = await c.peer.next("refused"); assert.equal(reply.reason, "role_too_low"); assert.equal(reply.needed, "editor");
  assert.equal(await exported(), before); assert(![a, b].some((p) => p.peer.messages.some((m) => m.kind === "update")));
});

check(103, "concurrent text keeps both insertions in every save order", async () => {
  const [a, b, c] = await all(); await seed(a); await equal([a, b, c]);
  for (const reverse of [false, true]) for (const [old, left, right, expected] of [
    ["abcd", "Xabcd", "abcdY", "XabcdY"], ["abcd", "abXcd", "abcYd", "abXcYd"], ["abcd", "abXcd", "abYcd", "abXYcd"],
    ["a😀b", "a😀Xb", "a😀b🚀", "a😀Xb🚀"], ["e\u0301x", "Ae\u0301x", "e\u0301xB", "Ae\u0301xB"]]) {
    await edit(a, (b) => patch(b, { text: old })); await equal([a, b, c]);
    const replies = await concurrent(a, b, [(b) => patch(b, { text: left }), (b) => patch(b, { text: right })], reverse);
    assert(replies.every((m) => m.kind === "saved")); assert.equal((await equal([a, b, c])).objects[0].text, expected);
  }
});

check(104, "separate objects and property units keep both edits", async () => {
  const [a, b, c] = await all(); await seed(a, "abcd", 2); await equal([a, b, c]);
  for (const reverse of [false, true]) for (const changes of [
    [(b: BoardV10) => patch(b, { x: reverse ? 20 : 10 }), (b: BoardV10) => patch(b, { text: reverse ? "right" : "left" })],
    [(b: BoardV10) => patch(b, { color: reverse ? "blue" : "yellow" }), (b: BoardV10) => patch(b, { x: reverse ? 30 : 40 })],
    [(b: BoardV10) => patch(b, { text: reverse ? "one" : "two" }), (b: BoardV10) => patch(b, { text: reverse ? "three" : "four" }, 1)]
  ] as [(b: BoardV10) => BoardV10, (b: BoardV10) => BoardV10][]) {
    const start = a.session.board, expected = changes[1](changes[0](start));
    await concurrent(a, b, changes, reverse); assert.equal(canonical(await equal([a, b, c])), canonical(expected));
  }
});

check(105, "later saved geometry and title beat Yjs client ordering", async () => {
  const [a, b, c] = await all(); await seed(a); await equal([a, b, c]);
  for (const reverse of [false, true]) {
    for (const [left, right] of [[{ x: 10 }, { x: 20 }], [{ x: 30 }, { width: 300 }]]) {
      await edit(a, (b) => patch(b, { x: 0, width: 240 })); await equal([a, b, c]);
      const start = a.session.board, expected = patch(start, reverse ? left : right);
      await concurrent(a, b, [(b) => patch(b, left), (b) => patch(b, right)], reverse);
      assert.deepEqual((await equal([a, b, c])).objects[0], expected.objects[0]);
    }
    await edit(a, (b) => ({ ...b, title: "Base" })); await equal([a, b, c]);
    await concurrent(a, b, [(b) => ({ ...b, title: "Left" }), (b) => ({ ...b, title: "Right" })], reverse);
    assert.equal((await equal([a, b, c])).title, reverse ? "Left" : "Right");
  }
});

check(106, "delete dominates concurrent text and undo restores a new incarnation", async () => {
  const [a, b, c] = await all();
  for (const reverse of [false, true]) {
    if (!a.session.board.objects.length) { await seed(a); await equal([a, b, c]); }
    const old = a.session.board.objects[0];
    assert((await concurrent(a, b, [(b) => remove(b, [old.id]), (b) => patch(b, { text: "concurrent" })], reverse)).every((m) => m.kind === "saved"));
    assert.equal((await equal([a, b, c])).objects.length, 0); await saved(a, a.session.undo());
    const restored = (await equal([a, b, c])).objects[0]; assert.notEqual(restored.id, old.id); assert.notEqual(restored.generation, old.generation); assert.equal(restored.text, old.text);
  }
});

check(107, "repairs are saved with the room update only when changed", async () => {
  const [a, b, c] = await all();
  for (const reverse of [false, true]) for (const scenario of ["order", "marks", "connector", "section", "cascade"]) {
    await edit(a, (b) => remove(b, b.objects.map((o) => o.id))); await seed(a, "abcdef", 2);
    if (scenario === "section") await edit(a, (b) => add(b, "section", 0, 0));
    if (scenario === "cascade") await edit(a, (b) => link(b));
    await equal([a, b, c]); const start = a.session.board, n = start.objects[0].id, section = start.objects.at(-1)!.id;
    let changes: [(b: BoardV10) => BoardV10, (b: BoardV10) => BoardV10];
    if (scenario === "order") changes = [(b) => add(b, "sticky", 1, 1), (b) => add(b, "sticky", 2, 2)];
    else if (scenario === "marks") changes = [(b) => patch(b, { text: "ab" }), (b) => patch(b, { marks: [{ start: 3, end: 5, bold: true }] })];
    else if (scenario === "connector") changes = [(b) => remove(b, [n]), (b) => link(b)];
    else if (scenario === "section") changes = [(b) => remove(b, [section]), (b) => patch(b, { section })];
    else changes = [(b) => remove(b, [n, section]), (b) => patch(b, { lineColor: "#ff0000" }, 2)];
    const replies = await concurrent(a, b, changes, reverse); assert(replies.every((m) => m.kind === "saved"), JSON.stringify(replies));
    assert.equal("update" in replies[0], false, scenario); assert.equal("update" in replies[1], scenario !== "cascade", scenario);
    const final = await equal([a, b, c]);
    if (scenario === "order") assert.equal(final.objects.length, 4);
    if (scenario === "marks") assert.deepEqual(final.objects[0].marks, []);
    if (scenario === "connector" || scenario === "cascade") assert(!final.objects.some((o) => o.type === "connector"));
    if (scenario === "section") assert.equal(final.objects[0].section, null);
  }
});

check(108, "invalid text merge refuses then rejoins and drops unsaved work", async () => {
  const [a, b, c] = await all();
  for (const reverse of [false, true]) {
    if (!a.session.board.objects.length) await seed(a, "");
    await edit(a, (b) => patch(b, { text: "" })); await equal([a, b, c]);
    const late = reverse ? a : b, peerCount = late.peers.length;
    const replies = await concurrent(a, b, [(b) => patch(b, { text: "a".repeat(600) }), (b) => patch(b, { text: "b".repeat(600) })], reverse);
    assert.equal(replies[1].reason, "invalid_document");
    await until(() => late.peers.length, (n) => n === peerCount + 1); await equal([a, b, c]);
    assert.equal(late.session.requests.get(replies[1].requestId)?.state, "refused"); assert.equal(late.session.undo(), "nothing_to_undo");
    assert.equal(a.session.board.objects[0].text.length, 600);
  }
});

check(109, "receipt retry returns the whole board and rejects reused IDs", async () => {
  const [a, b, c] = await all(); await seed(a); await equal([a, b, c]);
  const id = await edit(a, (b) => patch(b, { x: 10 })), update = a.session.requests.get(id)!.update;
  const revision = a.session.revision, before = await exported(), edits = (await driver.rows(f.a, "edits")).length;
  a.raw({ kind: "edit", epoch: a.session.epoch, requestId: id, update });
  await until(() => a.peer.messages.filter((m) => m.kind === "saved" && m.requestId === id).length, (n) => n === 2);
  const reply = a.peer.messages.filter((m) => m.kind === "saved" && m.requestId === id).at(-1)!; assert.equal(reply.revision, revision); assert.equal(typeof reply.update, "string");
  assert.equal((await driver.rows(f.a, "edits")).length, edits); assert.equal(await exported(), before);
  a.raw({ kind: "edit", epoch: a.session.epoch, requestId: id, update: "AAA=" }); assert.equal((await a.peer.next("refused")).reason, "request_id_reused");
});

check(110, "undo redo geometry preserves another writer's text", async () => {
  const [a, b, c] = await all(); await seed(a); await equal([a, b, c]); const x = a.session.board.objects[0].x;
  await edit(a, (b) => patch(b, { x: 10 })); await equal([a, b, c]); await edit(b, (b) => patch(b, { text: "kept" })); await equal([a, b, c]);
  await saved(a, a.session.undo()); let final = await equal([a, b, c]); assert.equal(final.objects[0].x, x); assert.equal(final.objects[0].text, "kept");
  await saved(a, a.session.redo()); final = await equal([a, b, c]); assert.equal(final.objects[0].x, 10); assert.equal(final.objects[0].text, "kept");
});

check(111, "partial undo and redo skip another writer's later geometry", async () => {
  const [a, b, c] = await all(); await seed(a); await equal([a, b, c]); const colour = a.session.board.objects[0].color;
  await edit(a, (b) => patch(b, { x: 10, color: "yellow" })); await equal([a, b, c]); await edit(b, (b) => patch(b, { x: 20 })); await equal([a, b, c]);
  await saved(a, a.session.undo()); let final = await equal([a, b, c]); assert.equal(final.objects[0].x, 20); assert.equal(final.objects[0].color, colour);
  await saved(a, a.session.redo()); final = await equal([a, b, c]); assert.equal(final.objects[0].x, 20); assert.equal(final.objects[0].color, "yellow");
});

check(112, "delete undo restores fresh linked IDs and redo preserves the present", async () => {
  const [a, b, c] = await all(); await seed(a, "note", 2); await edit(a, (b) => link(b)); await equal([a, b, c]);
  const old = a.session.board.objects[0], connector = a.session.board.objects[2];
  await edit(a, (b) => remove(b, [old.id, connector.id])); await equal([a, b, c]); await edit(b, (b) => patch(b, { text: "kept" }));
  const before = await equal([a, b, c]); await saved(a, a.session.undo()); const restored = await equal([a, b, c]);
  const n = restored.objects.find((o) => o.type === "sticky" && o.id !== before.objects[0].id)!, k = restored.objects.find((o) => o.type === "connector")!;
  assert.notEqual(n.id, old.id); assert.notEqual(n.generation, old.generation); assert.notEqual(k.id, connector.id); assert.notEqual(k.generation, connector.generation);
  assert.equal((k as any).from.object, n.id); assert.equal(restored.objects.find((o) => o.id === before.objects[0].id)!.text, "kept");
  await saved(a, a.session.redo()); assert.deepEqual((await equal([a, b, c])).objects, before.objects);
  await saved(a, a.session.undo()); assert(!(await equal([a, b, c])).objects.some((o) => o.id === n.id || o.id === k.id));
});

check(113, "a later equal-valued assignment kills the first writer's guard", async () => {
  const [a, b, c] = await all(); await seed(a); await equal([a, b, c]);
  const replies = await concurrent(a, b, [(b) => patch(b, { x: 10 }), (b) => patch(b, { x: 10 })], false);
  assert(replies.every((m) => m.kind === "saved")); await equal([a, b, c]);
  const count = a.session.requests.size; assert.equal(a.session.undo(), "changed_by_others"); assert.equal(a.session.requests.size, count); assert.equal(a.session.board.objects[0].x, 10);
});

check(114, "undo add preserves an object another writer edited", async () => {
  const [a, b, c] = await all(); await seed(a); await equal([a, b, c]); await edit(b, (b) => patch(b, { text: "kept" })); await equal([a, b, c]);
  const count = a.session.requests.size; assert.equal(a.session.undo(), "changed_by_others"); assert.equal(a.session.requests.size, count); assert.equal(a.session.board.objects[0].text, "kept");
});

check(115, "viewer edit forged presence and unknown kind never update a board", async () => {
  const [a, b, c] = await all(), before = await exported(), revision = a.session.revision;
  for (const [value, reason] of [[{ kind: "edit", epoch: c.session.epoch, requestId: "viewer", update: "AAA=" }, "role_too_low"],
    [{ kind: "presence", ...presence(), update: "AAA=" }, "presence_fields"], [{ kind: "unknown", update: "AAA=" }, "bad_message"]] as const) {
    c.raw(value); assert.equal((await c.peer.next("refused")).reason, reason);
  }
  assert.equal(await exported(), before); assert.equal((await join()).session.revision, revision);
  for (const p of [a, b]) assert(!p.peer.messages.some((m) => m.kind === "update"));
});
