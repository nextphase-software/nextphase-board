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

check(116, "joined restore generation fences a waiting edit across a restore", async () => {
  const a = await join();
  assert.equal(a.peer.messages[0].restoreGeneration, 0);
  await driver.wake(f.a);
  await a.session.reconnect();
  assert.equal(a.peer.messages[0].restoreGeneration, 0);
  const headers = { "Board-Operator-Key": context.operatorKey, "Content-Type": "application/json" };
  const backup = await driver.request(`/operator/boards/${f.a}/backup`, { method: "POST", headers }).then((reply) => reply.json());
  a.holdOut();
  const id = a.session.edit(add(a.session.board, "sticky", 0, 0)), object = a.session.board.objects[0].id;
  assert.equal((await driver.request(`/operator/boards/${f.a}/restore`, {
    method: "POST", headers, body: JSON.stringify(backup),
  })).status, 200);
  await closeCode(a, 4423);
  assert.equal(a.session.requests.get(id)?.state, "waiting");
  a.out.length = 0; a.holdOut(false);
  await a.session.reconnect();
  assert.notEqual(a.peer.messages[0].restoreGeneration, 0);
  assert.equal(a.session.requests.get(id)?.state, "dropped");
  assert.equal(a.session.requests.get(id)?.reason, "board_restored");
  assert(!a.session.board.objects.some((item) => item.id === object));
  assert(!JSON.parse(await exported()).objects.some((item: { id: string }) => item.id === object));
  assert(!(await driver.rows(f.a, "receipts")).some((row) => row.request_id === id));
});

check(117, "a saved edit with its answer lost recovers through its receipt once", async () => {
  const [a, b, c] = await all(), revision = a.session.revision;
  a.holdIn();
  const id = a.session.edit(add(a.session.board, "sticky", 0, 0));
  const update = a.session.requests.get(id)!.update;
  await until(() => a.peer.messages.find((message) => message.kind === "saved" && message.requestId === id), Boolean);
  await a.peer.close();
  await until(() => a.session.requests.get(id)?.state, (state) => state === "waiting");
  a.incoming.length = 0; a.holdIn(false); a.holdOut();
  await a.session.reconnect();
  assert.equal(a.out.length, 1);
  assert.deepEqual(JSON.parse(a.out[0]), { kind: "edit", epoch: a.session.epoch, requestId: id, update });
  a.releaseOut();
  const reply = await saved(a, id);
  assert.equal(reply.revision, revision + 1); assert.equal(typeof reply.update, "string");
  assert.equal((await equal([a, b, c])).objects.length, 1);
  assert.equal(a.session.revision, revision + 1);
  assert.equal((await driver.rows(f.a, "receipts")).filter((row) => row.request_id === id).length, 1);
  assert.equal((await driver.rows(f.a, "edits")).length, 1);
});

check(118, "an edit retried with an old epoch is refused without storing anything", async () => {
  const [a, b, c] = await all();
  a.holdOut();
  const epoch = a.session.epoch, id = a.session.edit(add(a.session.board, "sticky", 0, 0));
  const update = a.session.requests.get(id)!.update;
  await success(`/workspaces/${f.workspace}/members/${f.people.editor.id}`, "owner", "PUT", { role: "viewer" });
  await closeCode(a, 4403);
  await success(`/workspaces/${f.workspace}/members/${f.people.editor.id}`, "owner", "PUT", { role: "editor" });
  const retry = await join("editor");
  assert.notEqual(retry.session.epoch, epoch);
  const before = await exported(), receipts = await driver.rows(f.a, "receipts"), edits = await driver.rows(f.a, "edits");
  retry.raw({ kind: "edit", epoch, requestId: id, update });
  assert.equal((await retry.peer.next("refused")).reason, "epoch_changed");
  assert.equal(await exported(), before);
  assert.deepEqual(await driver.rows(f.a, "receipts"), receipts);
  assert.deepEqual(await driver.rows(f.a, "edits"), edits);
  await equal([retry, b, c]);
});

check(119, "eighty interrupted edits recover serially without a room waiting queue", async () => {
  const [a, b, c] = await all(), revision = a.session.revision;
  a.holdOut();
  const ids = Array.from({ length: 80 }, (_, index) => a.session.edit({ ...a.session.board, title: `Edit ${index + 1}` }));
  const originals = a.out.splice(0);
  await a.peer.close();
  await until(() => ids.every((id) => a.session.requests.get(id)?.state === "waiting"), Boolean);
  await a.session.reconnect();
  for (const [index, id] of ids.entries()) {
    assert.equal(a.out.length, 1, "only the next request may be sent");
    assert.equal(a.out[0], originals[index], "request ID and update bytes are unchanged");
    a.raw(a.out.shift()!);
    assert.equal((await saved(a, id)).revision, revision + index + 1);
  }
  assert.equal(a.out.length, 0);
  assert(!a.peer.messages.some((message) => message.kind === "resync"));
  assert.equal((await driver.rows(f.a, "waiting")).length, 0);
  assert.deepEqual(a.peer.messages.filter((message) => message.kind === "saved").map((message) => message.requestId), ids);
  assert.equal((await equal([a, b, c])).title, "Edit 80");
  assert.equal(a.session.recovering, false);
});

check(120, "delete last-saved units and character merges survive all three drop phases", async () => {
  const [a, b, c] = await all();
  for (const phase of ["before_received", "after_received", "answer_lost"]) {
    for (const scenario of ["delete", "geometry", "text"]) {
      await edit(b, (board) => remove(board, board.objects.map((object) => object.id)));
      await seed(b); await equal([a, b, c]);
      const old = a.session.board.objects[0];
      a.holdOut();
      // The second update depends on this first, withheld client clock. Sending
      // only the second makes the room acknowledge it as received, not saved.
      const dependency = a.session.edit({ ...a.session.board, title: `${phase} ${scenario}` });
      const id = a.session.edit(patch(a.session.board, scenario === "text" ? { text: "Xabcd" } : { x: 10 }));
      if (phase === "after_received") {
        a.raw(a.out[1]);
        await until(() => a.session.requests.get(id)?.state, (state) => state === "received");
      } else if (phase === "answer_lost") {
        a.holdIn(); a.releaseOut();
        await until(() => a.peer.messages.find((message) => message.kind === "saved" && message.requestId === id), Boolean);
        await until(() => (b.session.board.objects[0] as { text: string }).text, (text) => scenario !== "text" || text === "Xabcd");
      }
      await a.peer.close();
      await until(() => a.session.requests.get(id)?.state, (state) => state === "waiting");
      if (scenario === "delete") await edit(b, (board) => remove(board, [old.id]));
      else if (scenario === "geometry") await edit(b, (board) => patch(board, { x: 20 }));
      else await edit(b, (board) => patch(board, { text: (board.objects[0] as { text: string }).text + "Y" }));
      const lastRevision = b.session.revision;
      a.out.length = 0; a.incoming.length = 0; a.holdIn(false); a.holdOut(false);
      await a.session.reconnect(); await saved(a, dependency); await saved(a, id);
      const board = await equal([a, b, c]);
      if (scenario === "delete") {
        assert(!board.objects.some((object) => object.id === old.id));
        assert.equal(a.session.requests.get(id)?.notKept, true);
      } else if (scenario === "geometry") {
        // An answered receipt is not a new save: B remains last in answer_lost.
        assert.equal((board.objects[0] as { x: number }).x, phase === "answer_lost" ? 20 : 10);
      } else assert.equal((board.objects[0] as { text: string }).text, "XabcdY");
      assert.equal(a.session.revision, lastRevision + (phase === "answer_lost" ? 0 : 2));
      assert.equal(a.session.requests.get(id)?.state, "saved");
      assert.equal((await driver.rows(f.a, "waiting")).length, 0);
    }
  }
});

// Comment checks use the same held transports and fixed room clock as shared edits.
type DiscussionClient = { session: BoardSession; peer: Peer; peers: Peer[]; out: string[]; incoming: string[];
  events: { kind: string; [key: string]: unknown }[]; holdOut(hold?: boolean): void; holdIn(hold?: boolean): void;
  releaseOut(): void; releaseIn(): void; raw(value: unknown): void };
async function discussionJoin(name = "editor"): Promise<DiscussionClient> { return join(name); }
async function discussionAll(): Promise<readonly [DiscussionClient, DiscussionClient, DiscussionClient]> { return all(); }
type CommentOperation = import("../../packages/board-sync/src/comments.ts").CommentOperation;
const boardAnchor = (x = 20, y = 30) => ({ objectId: null, u: 0, v: 0, x, y });
const startComment = (text = "Pick the launch date"): Extract<CommentOperation, { action: "start" }> => ({
  action: "start", threadId: crypto.randomUUID(), commentId: crypto.randomUUID(), anchor: boardAnchor(), text,
});
async function commentsReady(client: DiscussionClient) { await until(() => client.session.commentsReady, Boolean); }
async function commentResult(client: DiscussionClient, operation: CommentOperation, reason?: string) {
  await commentsReady(client);
  const id = client.session.comment(operation);
  assert(client.session.commentRequests.has(id), id);
  await until(() => client.session.commentRequests.get(id)?.state, (state) => state === "saved" || state === "refused");
  const result = client.session.commentRequests.get(id)!;
  assert.equal(result.state, reason ? "refused" : "saved", JSON.stringify(result));
  if (reason) assert.equal(result.reason, reason);
  return { id, sequence: result.sequence! };
}
async function rawComment(client: DiscussionClient, operation: unknown, reason: string,
  epoch = client.session.epoch, requestId: string = crypto.randomUUID(), existingEditReceipt = false) {
  const receipts = existingEditReceipt ? await driver.rows(f.a, "receipts") : undefined;
  const sequence = existingEditReceipt
    ? (await driver.rows(f.a, "meta")).find((row) => row.key === "comment_sequence") : undefined;
  if (receipts) assert(receipts.some((row) => row.request_id === requestId && row.kind === "edit"));
  client.raw({ kind: "comment", epoch, requestId, operation });
  await until(() => client.peer.messages.find((message) => message.kind === "comment_refused" && message.requestId === requestId), Boolean);
  assert.equal(client.peer.messages.find((message) => message.kind === "comment_refused" && message.requestId === requestId)!.reason, reason);
  if (existingEditReceipt) {
    // A refused reuse preserves the original edit's kind, digest and revision.
    assert.deepEqual(await driver.rows(f.a, "receipts"), receipts);
    assert.deepEqual((await driver.rows(f.a, "meta")).find((row) => row.key === "comment_sequence"), sequence);
  } else assert(!(await driver.rows(f.a, "receipts")).some((row) => row.request_id === requestId));
}
async function commentsEqual(people: readonly DiscussionClient[]) {
  const rows = await driver.rows(f.a, "threads");
  await until(() => people.every((person) => person.session.commentsReady && person.session.threads.size === rows.length), Boolean);
  const expected = JSON.stringify([...people[0].session.threads.values()].sort((a, b) => a.sequence - b.sequence));
  await until(() => people.every((person) => JSON.stringify([...person.session.threads.values()].sort((a, b) => a.sequence - b.sequence)) === expected), Boolean);
}
const operatorHeaders = () => ({ "Board-Operator-Key": context.operatorKey, "Content-Type": "application/json" });
async function backupComments() {
  const response = await driver.request(`/operator/boards/${f.a}/backup`, { method: "POST", headers: operatorHeaders() });
  assert.equal(response.status, 200); return response.json() as Promise<any>;
}
async function restoreComments(envelope: unknown, status = 200) {
  const response = await driver.request(`/operator/boards/${f.a}/restore`, {
    method: "POST", headers: operatorHeaders(), body: JSON.stringify(envelope),
  });
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}
async function longCommentTokens() {
  const now = Date.now();
  for (const person of Object.values(f.people)) {
    person.token = await helper("token", { person, options: { now, exp: Math.floor(now / 1000) + 172800 } });
  }
}
check(121, "storage version 3 migrates old layouts and operator backups without losing edits", async () => {
  const a = await discussionJoin(); await commentsReady(a); await seed(a);
  assert.equal((await driver.rows(f.a, "meta")).find((row) => row.key === "storage_version").value, 3);
  const before = await exported(), edits = await driver.rows(f.a, "edits"), receipts = await driver.rows(f.a, "receipts");
  const legacy = await backupComments();
  legacy.tables.meta.find((row: any) => row.key === "storage_version").value = 2;
  for (const table of ["threads", "comments", "comment_ids", "comment_counts"]) delete legacy.tables[table];
  legacy.tables.receipts.forEach((row: any) => { delete row.kind; });
  await a.peer.close();
  for (const version of [2, 0, 1]) {
    await driver.control({ board: f.a, legacyStorage: version }); await driver.wake(f.a);
    const reopened = await discussionJoin(); await commentsReady(reopened);
    assert.equal((await driver.rows(f.a, "meta")).find((row) => row.key === "storage_version").value, 3);
    assert.equal(await exported(), before); assert.deepEqual(await driver.rows(f.a, "edits"), edits);
    assert.deepEqual(await driver.rows(f.a, "receipts"), receipts);
    assert((await driver.rows(f.a, "receipts")).every((row) => row.kind === "edit"));
    await reopened.peer.close();
  }
  const once = await driver.rows(f.a, "meta"); await driver.wake(f.a); await ticket();
  assert.deepEqual(await driver.rows(f.a, "meta"), once);
  await restoreComments(legacy); const restored = await discussionJoin(); await commentsReady(restored);
  assert.equal(await exported(), before); assert.equal(restored.session.threads.size, 0);
  assert.equal((await driver.rows(f.a, "meta")).find((row) => row.key === "storage_version").value, 3);
});
check(122, "every comment action broadcasts once before its answer and leaves board edits alone", async () => {
  const [a, b, c] = await discussionAll(); await Promise.all([a, b, c].map(commentsReady)); await seed(a); await equal([a, b, c]);
  const revision = a.session.revision, edits = await driver.rows(f.a, "edits"), last = (await driver.rows(f.a, "meta")).find((row) => row.key === "last_edit_at");
  const history = a.session.history.past.length, start = startComment(), replyId = crypto.randomUUID();
  const operations: CommentOperation[] = [start, { action: "reply", threadId: start.threadId, commentId: replyId, text: "Reply" },
    { action: "edit", threadId: start.threadId, commentId: start.commentId, text: "Edited" }, { action: "resolve", threadId: start.threadId },
    { action: "reopen", threadId: start.threadId }, { action: "move", threadId: start.threadId, anchor: boardAnchor(40, 50) },
    { action: "delete_comment", threadId: start.threadId, commentId: replyId }, { action: "delete_thread", threadId: start.threadId }];
  let first = "";
  for (const [index, operation] of operations.entries()) {
    const { id, sequence } = await commentResult(a, operation); if (!index) first = id;
    assert.equal(sequence, index + 1);
    for (const client of [a, b, c]) {
      await until(() => client.peer.messages.filter((message) => message.kind === "comment_changed" && message.sequence === sequence).length, (count) => count === 1);
      assert.equal(client.peer.messages.find((message) => message.kind === "comment_changed" && message.sequence === sequence)!.by, a.session.self!.label);
    }
    assert(a.peer.messages.findIndex((message) => message.kind === "comment_changed" && message.sequence === sequence) <
      a.peer.messages.findIndex((message) => message.kind === "comment_saved" && message.requestId === id));
  }
  assert.equal(a.session.revision, revision); assert.deepEqual(await driver.rows(f.a, "edits"), edits);
  assert.deepEqual((await driver.rows(f.a, "meta")).find((row) => row.key === "last_edit_at"), last); assert.equal(a.session.history.past.length, history);
  const receipts = await driver.rows(f.a, "receipts"), sequence = (await driver.rows(f.a, "meta")).find((row) => row.key === "comment_sequence");
  a.raw(a.session.commentRequests.get(first)!.text);
  await until(() => a.peer.messages.filter((message) => message.kind === "comment_saved" && message.requestId === first).length, (count) => count === 2);
  assert.equal(a.peer.messages.filter((message) => message.kind === "comment_saved" && message.requestId === first).at(-1)!.sequence, 1);
  await until(() => a.peer.messages.filter((message) => message.kind === "comments_snapshot" && message.done).length, (count) => count === 2);
  assert.deepEqual(await driver.rows(f.a, "receipts"), receipts); assert.deepEqual((await driver.rows(f.a, "meta")).find((row) => row.key === "comment_sequence"), sequence);
});
check(123, "viewers comment while only authors can edit delete or move discussion", async () => {
  const [a, b, c] = await discussionAll(), owner = await discussionJoin("owner"), start = startComment();
  await commentResult(c, start);
  await commentResult(c, { action: "reply", threadId: start.threadId, commentId: crypto.randomUUID(), text: "Viewer reply" });
  await commentResult(c, { action: "resolve", threadId: start.threadId }); await commentResult(c, { action: "reopen", threadId: start.threadId });
  const before = await exported(); c.raw({ kind: "edit", epoch: c.session.epoch, requestId: "viewer-comment-check", update: "AAA=" });
  assert.equal((await c.peer.next("refused")).reason, "role_too_low"); assert.equal(await exported(), before);
  const own = startComment(); await commentResult(a, own);
  for (const person of [b, owner]) for (const operation of [
    { action: "edit", threadId: own.threadId, commentId: own.commentId, text: "Forbidden" },
    { action: "delete_comment", threadId: own.threadId, commentId: own.commentId },
    { action: "delete_thread", threadId: own.threadId }, { action: "move", threadId: own.threadId, anchor: boardAnchor() },
  ] as CommentOperation[]) await commentResult(person, operation, "not_author");
  for (const person of [b, c]) await commentResult(person, { action: "reply", threadId: own.threadId, commentId: crypto.randomUUID(), text: "Kept until author deletes" });
  await commentResult(a, { action: "delete_comment", threadId: own.threadId, commentId: own.commentId });
  await commentsEqual([a, b, c, owner]); assert(!a.session.threads.has(own.threadId));
  assert(!(await driver.rows(f.a, "comments")).some((row) => row.thread_id === own.threadId));
});
check(124, "simultaneous replies and resolve reopen converge in saved order", async () => {
  const [a, b, c] = await discussionAll(), start = startComment(); await commentResult(a, start); await commentsEqual([a, b, c]);
  a.holdOut(); b.holdOut();
  const ids = [a.session.comment({ action: "reply", threadId: start.threadId, commentId: crypto.randomUUID(), text: "A" }),
    b.session.comment({ action: "reply", threadId: start.threadId, commentId: crypto.randomUUID(), text: "B" })];
  a.releaseOut(); b.releaseOut();
  await until(() => [a, b].every((client, index) => client.session.commentRequests.get(ids[index])?.state === "saved"), Boolean);
  await commentsEqual([a, b, c]); assert.equal(a.session.threads.get(start.threadId)!.comments.length, 3);
  a.holdOut(); b.holdOut(); const resolve = a.session.comment({ action: "resolve", threadId: start.threadId }), reopen = b.session.comment({ action: "reopen", threadId: start.threadId });
  b.releaseOut(); a.releaseOut();
  await until(() => a.session.commentRequests.get(resolve)?.state === "saved" && b.session.commentRequests.get(reopen)?.state === "saved", Boolean);
  await commentsEqual([a, b, c]); assert.equal(a.session.threads.get(start.threadId)!.resolved, a.session.commentRequests.get(resolve)!.sequence! > b.session.commentRequests.get(reopen)!.sequence!);
  await commentResult(a, { action: "resolve", threadId: start.threadId });
  await commentResult(b, { action: "reply", threadId: start.threadId, commentId: crypto.randomUUID(), text: "Reopens" });
  await commentsEqual([a, b, c]); assert.equal(c.session.threads.get(start.threadId)!.resolved, false);
});
check(125, "deleted-thread and deleted-comment refusals preserve outstanding edit requests", async () => {
  const [a, b, c] = await discussionAll(), start = startComment(); await commentResult(b, start); await commentsEqual([a, b, c]);
  const reply = crypto.randomUUID(); await commentResult(b, { action: "reply", threadId: start.threadId, commentId: reply, text: "Soon gone" });
  await commentResult(b, { action: "delete_comment", threadId: start.threadId, commentId: reply });
  a.holdOut(); const editId = a.session.edit({ ...a.session.board, title: "Still waiting" });
  const requests = JSON.stringify([...a.session.requests]), joins = a.peers.length;
  await rawComment(a, { action: "edit", threadId: start.threadId, commentId: reply, text: "Kept" }, "comment_deleted");
  await commentResult(b, { action: "delete_thread", threadId: start.threadId });
  await rawComment(a, { action: "reply", threadId: start.threadId, commentId: crypto.randomUUID(), text: "Kept" }, "thread_deleted");
  assert.equal(JSON.stringify([...a.session.requests]), requests); assert.equal(a.session.requests.get(editId)!.state, "sent"); assert.equal(a.peers.length, joins);
});
check(126, "old epochs refuse new and retried comments and removed people receive no snapshot", async () => {
  const [a, b, c] = await discussionAll(), start = startComment(); const saved = await commentResult(b, start), oldEpoch = b.session.epoch;
  await success(`/workspaces/${f.workspace}/members/${f.people.granted.id}`, "owner", "PUT", { role: "viewer" }); await closeCode(b, 4403);
  await success(`/workspaces/${f.workspace}/members/${f.people.granted.id}`, "owner", "PUT", { role: "editor" });
  const retry = await discussionJoin("granted"); await commentsReady(retry); assert.notEqual(retry.session.epoch, oldEpoch);
  await rawComment(retry, startComment(), "epoch_changed", oldEpoch);
  const before = await driver.rows(f.a, "receipts");
  retry.raw({ kind: "comment", epoch: oldEpoch, requestId: saved.id, operation: start });
  assert.equal((await retry.peer.next("comment_refused")).reason, "epoch_changed"); assert.deepEqual(await driver.rows(f.a, "receipts"), before);
  await success(`/workspaces/${f.workspace}/members/${f.people.granted.id}`, "owner", "DELETE"); await closeCode(retry, 4403);
  for (const name of ["granted", "outsider"]) {
    const response = await request(`/boards/${f.a}/join-tickets`, name, "POST"); assert.equal(response.status, 404);
  }
  await commentsEqual([a, c]);
});
check(127, "snapshots are contiguous ordered durable and restored with counts and anchors", async () => {
  const a = await discussionJoin(), first = startComment(), second = startComment("Second"); await commentResult(a, first); await commentResult(a, second);
  await commentResult(a, { action: "resolve", threadId: first.threadId });
  const envelope = await backupComments(); await driver.wake(f.a);
  const b = await discussionJoin("granted"); await commentsReady(b);
  const messages = b.peer.messages, done = messages.findIndex((message) => message.kind === "comments_snapshot" && message.done);
  assert.equal(messages[0].kind, "joined"); assert.equal(messages[1].reset, true); assert.equal(messages[1].sequence, 3);
  const rows = messages.slice(2, done); assert.equal(rows.length, 4);
  assert(rows.slice(0, 2).every((row) => row.thread && row.sequence === undefined)); assert(rows.slice(2).every((row) => row.comment && row.sequence === undefined));
  assert.deepEqual(rows.slice(0, 2).map((row) => row.thread.sequence), [1, 2]);
  const later = startComment("After backup"); await commentResult(b, later); await restoreComments(envelope);
  const restored = await discussionJoin(); await commentsReady(restored); assert.equal(restored.session.threads.size, 2); assert(!restored.session.threads.has(later.threadId));
  assert.equal(restored.session.threads.get(first.threadId)!.resolved, true);
  for (const table of ["threads", "comments", "comment_ids", "comment_counts", "receipts"]) {
    assert.deepEqual(await driver.rows(f.a, table), envelope.tables[table]);
  }
});
check(128, "anchors move in edit transactions and deletion detaches once without undo reattachment", async () => {
  const [a, b, c] = await discussionAll(); await seed(b); await equal([a, b, c]);
  const object = b.session.board.objects[0], start = { ...startComment(), anchor: { objectId: object.id, u: .25, v: .75, x: 0, y: 0 } };
  await commentResult(a, start); await commentsEqual([a, b, c]);
  const counts = [a, b, c].map((client) => client.peer.messages.filter((message) => message.kind === "comment_changed").length);
  await edit(b, (board) => patch(board, { x: 50, y: 60, width: 400, height: 200, text: "New label" })); await equal([a, b, c]);
  const moved = JSON.parse((await driver.rows(f.a, "threads"))[0].anchor); assert.equal(moved.x, 150); assert.equal(moved.y, 210);
  [a, b, c].forEach((client, index) => assert.equal(client.peer.messages.filter((message) => message.kind === "comment_changed").length, counts[index]));
  const deletion = await edit(b, (board) => remove(board, [object.id])); await equal([a, b, c]);
  await until(() => [a, b, c].every((client) => client.session.threads.get(start.threadId)?.anchor.detached), Boolean);
  for (const [index, client] of [a, b, c].entries()) {
    const frames = client.peer.messages.filter((message) => message.kind === "comment_changed").slice(counts[index]); assert.equal(frames.length, 1); assert.equal(frames[0].sequence, undefined);
    const anchor = frames[0].thread.anchor; assert.equal(anchor.x, 150); assert.equal(anchor.y, 210); assert.equal(anchor.objectLabel, "New label"); assert.equal(anchor.objectType, "sticky");
    const editFrame = client.peer.messages.findIndex((message) => client === b ? message.kind === "saved" && message.requestId === deletion : message.kind === "update" && message.revision === b.session.revision);
    assert(client.peer.messages.indexOf(frames[0]) > editFrame);
  }
  await saved(b, b.session.undo()); await equal([a, b, c]); assert.notEqual(b.session.board.objects[0].id, object.id);
  await commentResult(a, { action: "move", threadId: start.threadId, anchor: { objectId: b.session.board.objects[0].id, u: .5, v: .5, x: 700, y: 800 } });
  assert.equal(JSON.parse((await driver.rows(f.a, "threads"))[0].anchor).detached, true);
  await commentResult(a, { action: "reopen", threadId: start.threadId });
  await rawComment(a, { ...startComment(), anchor: start.anchor }, "anchor_deleted");
  // Undoing an addition and deleting a section with its member use the same edit transaction.
  for (const section of [false, true]) {
    await edit(b, (board) => add(board, "sticky", 500, 500)); await equal([a, b, c]);
    const added = b.session.board.objects.at(-1)!;
    let sectionId = "";
    if (section) {
      await edit(b, (board) => add(board, "section", 400, 400)); sectionId = b.session.board.objects.at(-1)!.id;
      await edit(b, (board) => patch(board, { section: sectionId }, board.objects.findIndex((object) => object.id === added.id)));
      await equal([a, b, c]);
    }
    const attached = { ...startComment(), anchor: { objectId: added.id, u: .5, v: .5, x: 0, y: 0 } }; await commentResult(a, attached);
    if (section) await edit(b, (board) => remove(board, [sectionId, added.id])); else await saved(b, b.session.undo());
    await until(() => a.session.threads.get(attached.threadId)?.anchor.detached, Boolean);
  }
});
check(129, "text enforces Unicode code points controls and exact whitespace preservation", async () => {
  const a = await discussionJoin();
  await rawComment(a, startComment(" \t\n"), "empty_text"); await rawComment(a, startComment("a".repeat(4000) + "😀"), "too_long");
  await rawComment(a, startComment("bad\u0001"), "bad_message");
  const astral = startComment("a".repeat(3999) + "😀"); await commentResult(a, astral);
  const spaced = startComment("  Line one\n\tLine two\n"); await commentResult(a, spaced);
  assert.equal((await driver.rows(f.a, "comments")).find((row) => row.id === spaced.commentId).text, spaced.text);
});
check(130, "comments bypass waiting edits and receipts cannot cross request kinds", async () => {
  const a = await discussionJoin(); await commentsReady(a); a.holdOut();
  const first = a.session.edit({ ...a.session.board, title: "Dependency" }), second = a.session.edit({ ...a.session.board, title: "Waiting" });
  a.raw(a.out[1]); await until(() => a.session.requests.get(second)?.state, (state) => state === "received");
  const start = startComment(), requestId = crypto.randomUUID();
  a.raw({ kind: "comment", epoch: a.session.epoch, requestId, operation: start });
  await until(() => a.peer.messages.find((message) => message.kind === "comment_saved" && message.requestId === requestId), Boolean);
  assert.equal((await driver.rows(f.a, "waiting")).length, 1); a.releaseOut(); await saved(a, first); await saved(a, second);
  await rawComment(a, startComment(), "request_id_reused", a.session.epoch, first, true);
  a.raw({ kind: "edit", epoch: a.session.epoch, requestId, update: a.session.requests.get(first)!.update });
  assert.equal((await a.peer.next("refused")).reason, "request_id_reused");
});
check(131, "hourly counts span connections and prune old hours; connection windows count only saves", async () => {
  await longCommentTokens();
  const a = await discussionJoin(), other = await discussionJoin(), now = Date.now(), hour = Math.floor(now / 3600000) * 3600000;
  await driver.control({ fixedNow: hour + 1000 });
  for (let index = 0; index < 100; index++) {
    if (index % 10 === 0) await driver.control({ fixedNow: hour + 1000 + index * 200 });
    await commentResult(index % 2 ? other : a, startComment(String(index)));
  }
  const before = await driver.rows(f.a, "comment_counts"); await rawComment(a, startComment("101"), "rate_limited");
  assert.deepEqual(await driver.rows(f.a, "comment_counts"), before);
  await driver.control({ fixedNow: hour + 3600000 + 1000 });
  const next = await discussionJoin(); await commentResult(next, startComment("Next hour"));
  assert((await driver.rows(f.a, "comment_counts")).every((row) => row.hour === Math.floor((hour + 3600000) / 3600000)));
  const threadId = [...next.session.threads.keys()][0];
  for (let index = 0; index < 600; index++) {
    await driver.control({ fixedNow: hour + 3600000 + 2000 + index * 110 });
    await commentResult(next, { action: index % 2 ? "resolve" : "reopen", threadId });
  }
  await rawComment(next, { action: "resolve", threadId }, "rate_limited");
  // Another person has a fresh hourly count and isolates the connection window.
  const b = await discussionJoin("granted"); await driver.control({ fixedNow: hour + 3600000 + 70000 });
  for (let index = 0; index < 10; index++) await commentResult(b, startComment());
  await rawComment(b, startComment(), "rate_limited");
  const bCounts = await driver.rows(f.a, "comment_counts");
  await rawComment(b, { ...startComment(), text: "" }, "empty_text"); assert.deepEqual(await driver.rows(f.a, "comment_counts"), bCounts);
});
check(132, "malformed comment shapes and anchors follow refusal order without receipts", async () => {
  const a = await discussionJoin(), good = startComment();
  for (const operation of [{ ...good, action: "unknown" }, { ...good, threadId: undefined }, { ...good, threadId: good.threadId.toUpperCase() },
    { ...good, text: 3 }, { ...good, anchor: null }]) await rawComment(a, operation, "bad_message");
  for (const anchor of [{ ...good.anchor, u: 1.1 }, { ...good.anchor, x: 1000001 }, { ...good.anchor, y: "1" }, { ...good.anchor, objectId: "bad" }]) {
    await rawComment(a, { ...good, anchor }, "bad_anchor");
  }
  await rawComment(a, { ...good, text: "", anchor: { ...good.anchor, u: 2 } }, "empty_text");
  await commentResult(a, good); await rawComment(a, { ...good, anchor: { ...good.anchor, u: 2 } }, "identifier_reused");
});
check(133, "board comment limits bound the backup and reject mixed envelope shapes", async () => {
  await longCommentTokens();
  const [a, b, c] = await discussionAll(); await seed(a, "Launch", 3); await equal([a, b, c]);
  const people = [a, b, c], threads: string[] = []; let now = Date.now(), bytes = 0;
  // Every comment is escaped to twice its byte size; distribute posts across hours and people.
  for (let index = 0; index < 2000; index++) {
    now += index % 90 === 0 ? 3600000 : 110;
    await driver.control({ fixedNow: now });
    const client = people[index % 3];
    const length = index < 304 ? 2098 : 2097; // exactly 4,194,304 UTF-8 bytes across 2,000 rows
    const text = ('"\n'.repeat(Math.ceil(length / 2))).slice(0, length); bytes += length;
    const operation = index < 200 ? startComment(text) : { action: "reply" as const, threadId: threads[index % 200], commentId: crypto.randomUUID(), text };
    if (operation.action === "start") threads.push(operation.threadId);
    await commentResult(client, operation);
  }
  assert.equal(bytes, 4194304);
  await rawComment(a, startComment("One more"), "comment_limit");
  const own = [...a.session.threads.values()].flatMap((thread) => thread.comments).find((comment) => comment.person === a.session.self!.person)!;
  await rawComment(a, { action: "edit", threadId: own.threadId, commentId: own.id, text: own.text + "x" }, "comment_limit");
  const envelope = await backupComments(), size = new TextEncoder().encode(JSON.stringify(envelope)).length;
  measures.commentBackupBytes = size; console.log("MEASURE-S133 " + JSON.stringify({ bytes: size })); assert(size < 16777216);
  const missing = structuredClone(envelope); delete missing.tables.comments; await restoreComments(missing, 400);
  const mixed = structuredClone(envelope); mixed.tables.meta.find((row: any) => row.key === "storage_version").value = 2;
  for (const row of mixed.tables.receipts) delete row.kind;
  for (const table of ["comments", "comment_ids", "comment_counts"]) delete mixed.tables[table];
  await restoreComments(mixed, 400);
});
