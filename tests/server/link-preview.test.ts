// SPDX-License-Identifier: Apache-2.0
import { afterAll, afterEach, beforeAll, inject, test } from "vitest";
import assert from "node:assert/strict";
import { makeDriver } from "board-test-driver";
import { fixturePng, sprintDescription, sprintTitle } from "./link-preview-fixtures.ts";
import type { Context, Driver } from "./driver-types.ts";

const context = inject<Context>("board"), runner = inject<string>("runner");
const register = test.skipIf(context.docker || runner === "docker");
const minute = 60_000, day = 86_400_000;
const start = Math.ceil(Date.now() / day) * day;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let driver: Driver;
let fixture: { workspace: string; a: string; b: string; people: Context["people"] };
let passed = 0, failed = 0;

beforeAll(async () => { if (!context.docker) driver = await makeDriver(context); });
afterEach(async () => {
  if (driver) await driver.control({ linkNow: null, failLinkLimits: false, delayLinkLimits: false, dohCase: "" });
});
afterAll(async () => {
  await driver?.close();
  console.log("SUMMARY-LINK-PREVIEWS " + JSON.stringify({ runner, checks: passed + failed, pass: passed, fail: failed }));
});
function check(id: number, title: string, execute: () => Promise<void>, needsBoard = true) {
  register(`S${id} ${title}`, async () => {
    try {
      if (needsBoard) {
        const response = await fetch(context.helperUrl + "/removal-fixture", { method: "POST", body: "{}" });
        assert.equal(response.status, 200);
        fixture = await response.json() as typeof fixture;
      }
      await execute();
      passed++; console.log(`PASS: S${id} ${title}`);
    } catch (error) {
      failed++; console.log(`FAIL: S${id} ${title}`);
      throw error;
    }
  });
}
function request(path: string, method: string, value?: unknown, person?: string, extra?: HeadersInit) {
  const headers = new Headers(extra), binary = value instanceof Uint8Array;
  if (person) headers.set("Authorization", "Bearer " + fixture.people[person].token);
  if (value !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", binary ? "application/octet-stream" : "application/json");
  const body = binary ? new Uint8Array(value).buffer : value === undefined ? undefined : JSON.stringify(value);
  return driver.request(path, { method, headers, body });
}
const teamPath = (board = fixture.a) => `/boards/${board}/link-preview`;
const team = (url: string, person = "editor", board = fixture.a) => request(teamPath(board), "POST", { url }, person);
const publicRequest = (url: string, ip = "2001:db8:2:3::4", origin = context.linkPreviewOrigin) =>
  request("/link-preview", "POST", { url }, undefined, { Origin: origin, "CF-Connecting-IP": ip });
async function responseOf(answer: Promise<Response>, status: number) {
  const response = await answer;
  assert.equal(response.status, status, response.ok ? undefined : await response.clone().text());
  return response;
}
async function json(answer: Promise<Response>, status: number): Promise<any> {
  return (await responseOf(answer, status)).json();
}
async function reason(answer: Promise<Response>, status: number, code?: string, needed?: "editor") {
  const response = await responseOf(answer, status);
  if (code) assert.deepEqual(await response.json(), { error: { reason: code, ...(needed ? { needed } : {}) } });
}
type PageRequest = { name: string; path: string; host?: string; sni?: string; bytes: number };
async function observed(name?: string): Promise<PageRequest[]> {
  const suffix = name ? "?name=" + encodeURIComponent(name) : "";
  const response = await fetch(`http://127.0.0.1:${context.linkFixtures.http}/__requests${suffix}`);
  assert.equal(response.status, 200);
  return response.json() as Promise<PageRequest[]>;
}
const bad = "http://127.0.0.1/";
const covers = () => fixturePng().toString("base64");
const fixtureUrl = "https://fieldnotes.test/sprint";

check(468, "team route for an editor", async () => {
  const before = (await observed("fieldnotes.test")).length;
  const answer = await responseOf(team(fixtureUrl), 200);
  assert.equal(answer.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await answer.json(), { url: fixtureUrl, title: sprintTitle, description: sprintDescription, site: "fieldnotes.test",
    picture: { type: "image/png", bytes: covers() } });
  const page = (await observed("fieldnotes.test")).slice(before);
  assert.deepEqual(page.map(row => row.path), ["/sprint", "/cover.png"]);
  assert.equal((await json(team("https://hall.test/visit"), 200)).picture, null);
  if (runner === "node") {
    assert(page.every(row => row.host === "fieldnotes.test" && row.sni === "fieldnotes.test"));
    const { sockets } = await driver.control({ linkRecords: true });
    assert.deepEqual(sockets.slice(0, 2), Array(2).fill({
      vetted: "192.0.2.10", remoteAddress: "127.0.0.1", remotePort: context.linkFixtures.https, servername: "fieldnotes.test",
    }));
    await reason(team("https://wrongca.test/"), 502, "preview_failed");
  }
});

check(469, "address rules", async () => {
  const before = await observed();
  for (const url of [bad, "http://[::1]/", "http://0x7f.1/", "http://localhost/", "http://intranet/", "ftp://fieldnotes.test/",
    "http://user:pw@fieldnotes.test/", "http://fieldnotes.test:22/", "https://hall.test/".padEnd(2049, "x")]) {
    await reason(team(url), 422, "address_refused");
  }
  assert.deepEqual(await observed(), before);
});
check(470, "rights", async () => {
  const before = await observed();
  await reason(team(fixtureUrl, "viewer"), 403, "role_too_low", "editor");
  await reason(team(fixtureUrl, "outsider"), 404, "not_found");
  await reason(request(teamPath(), "POST", { url: fixtureUrl }), 401);
  await json(request(`/boards/${fixture.a}/trash`, "POST", { requestId: crypto.randomUUID(), expectedCycle: 0 }, "owner"), 200);
  await reason(team(fixtureUrl), 404, "not_found");
  assert.deepEqual(await observed(), before);
});
check(471, "address policy, pinning and DoH", async () => {
  const before = await observed();
  const hostnames = ["private", "cgnat", "mapped", "mapped-hex", "nat64", "nat64-local", "six-to-four", "teredo", "documentation", "ula", "unlisted", "mixed", "rebinding"];
  for (const host of hostnames) await reason(team(`http://${host}.test/`), 422, "address_refused");
  const pages = (await observed()).slice(before.length);
  assert.deepEqual(pages.map(({ name, path }) => [name, path]), [["rebinding.test", "/"]]);
  const records = await driver.control({ linkRecords: true });
  for (const host of hostnames) assert.deepEqual(records.resolutions.filter((r: any) => r.host === host + ".test").map((r: any) => r.family),
    host === "rebinding" ? ["A", "AAAA", "A", "AAAA"] : ["A", "AAAA"]);

  if (runner === "node") {
    assert.equal((await json(team("http://v4only.test/"), 200)).picture, null);
    await reason(team("http://both-fail.test/"), 502, "preview_failed");
    const at = performance.now();
    await reason(team("http://never.test/"), 502, "preview_failed");
    assert(performance.now() - at < 2500);
    await pause(400);
    assert.equal((await observed("never.test")).length, 0);
    const before = await driver.control({ linkRecords: true });
    assert.equal(await driver.control({ linkPin: true }), 200);
    assert.deepEqual((await driver.control({ linkRecords: true })).resolutions, before.resolutions);
  } else {
    for (const dohCase of ["redirect", "large", "status", "data", "late", "aaaa-reject"]) {
      await driver.control({ dohCase });
      await reason(team("http://bad-doh.test/"), 502, "preview_failed");
    }
    assert.equal((await observed("bad-doh.test")).length, 0);
  }
});
check(472, "redirects and picture hops", async () => {
  await json(team("http://chain.test/0?max=3"), 200);
  await reason(team("http://hops.test/0"), 422, "preview_unavailable");
  assert.deepEqual((await observed("hops.test")).map(row => row.path.split("?")[0]), ["/0", "/1", "/2", "/3"]);
  const redirect = (location: string, status = 302) =>
    `http://relative.test/from?location=${encodeURIComponent(location)}&status=${status}`;
  await json(team(redirect("/next")), 200);
  for (const [target, status] of [["missing", 302], ["http://[", 302], ["/next", 300]] as const) {
    await reason(team(redirect(target, status)), 422, "preview_unavailable");
  }
  const requests = await observed();
  for (const target of [bad, "ftp://fieldnotes.test/", "http://fieldnotes.test:22/"]) {
    await reason(team(redirect(target)), 422, "address_refused");
  }
  assert((await observed()).slice(requests.length).every(row => row.name === "relative.test"));
  for (const image of ["http://private.test/image.png", "/redirect", "http://[", "ftp://fieldnotes.test/a.png"]) {
    const count = (await observed()).length;
    const answer = await json(team(`http://pictures.test/?image=${encodeURIComponent(image)}`), 200);
    assert.equal(answer.picture, null);
    assert((await observed()).slice(count).every(row => row.name === "pictures.test"));
  }
});
check(473, "page and picture limits and the 12 s ceiling", async () => {
  await reason(team("http://large.test/"), 422, "preview_unavailable");
  assert.equal((await json(team("http://styles.test/early"), 200)).title, "Early");
  assert.equal((await json(team("http://styles.test/comment"), 200)).title, "Real");
  await reason(team("http://reset.test/"), 422, "preview_unavailable");
  await reason(team("http://styles.test/encoding"), 422, "preview_unavailable");
  assert.equal((await json(team("http://styles.test/charset"), 200)).title, "Café");
  const started = performance.now();
  await reason(team("http://slow.test/"), 422, "preview_unavailable");
  assert(performance.now() - started < 5500);
  await reason(team("http://styles.test/plain"), 422, "preview_unavailable");
  for (const image of ["/large", "/svg"]) {
    assert.equal((await json(team(`http://pictures.test/?image=${image}`), 200)).picture, null);
  }
  // The counted suites cover the ceiling with the unit's fake clock. The server-only run measures real time.
});
check(474, "the public route and CORS", async () => {
  await driver.control({ linkNow: start + day });
  const origin = context.linkPreviewOrigin, allowed = { Origin: origin };
  const cors = (response: Response) => {
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Vary"), "Origin");
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  };
  cors(await responseOf(publicRequest("http://hall.test/"), 200));
  for (const value of ["http://127.0.0.1:4175", undefined, "null", context.origin]) {
    const response = await responseOf(request("/link-preview", "POST", { url: fixtureUrl }, undefined, value ? { Origin: value } : undefined), 404);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
  await driver.control({ linkOrigins: [] });
  assert.equal((await responseOf(publicRequest(fixtureUrl), 404)).headers.get("Access-Control-Allow-Origin"), null);
  await driver.control({ linkOrigins: [origin], linkNow: start + day });
  const preflight = await responseOf(request("/link-preview", "OPTIONS", undefined, undefined, allowed), 204);
  cors(preflight);
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  await reason(request("/link-preview", "OPTIONS", undefined, undefined, { Origin: context.origin }), 404, "not_found");
  for (const method of ["GET", "PUT"]) cors(await responseOf(request("/link-preview", method, undefined, undefined, allowed), 404));
  const badBodies = [[undefined, undefined, 400], ["text/plain", "{}", 400], ["application/json", "not json", 400],
    ["application/json", '{"url":1}', 400], ["application/json", '{"url":"https://hall.test/","x":1}', 400],
    ["application/json", " ".repeat(1_048_577), 413]] as const;
  for (const [type, body, status] of badBodies) {
    const response = await responseOf(driver.request("/link-preview", { method: "POST",
      headers: { ...allowed, ...(type ? { "Content-Type": type } : {}) }, body }), status);
    cors(response);
    assert.equal((await response.json() as any).error.reason, status === 413 ? "body_too_large" : "bad_request");
  }
  cors(await responseOf(publicRequest(bad), 422));
  await reason(request(teamPath(), "POST", { url: fixtureUrl }, "editor", { "Content-Type": "text/plain" }), 400, "bad_request");
  const pages = await observed();
  for (const path of ["/link-preview/", "/link-preview/x", "/LINK-PREVIEW", "/link%2Dpreview", "/%6Cink-preview"]) {
    const answer = await responseOf(request(path, "POST", { url: fixtureUrl }, undefined, allowed), 401);
    assert.equal(answer.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.deepEqual(await observed(), pages);
  await responseOf(request("/workspaces", "GET"), 401);
  const existing = await responseOf(request("/workspaces", "OPTIONS", undefined, undefined, { Origin: context.origin }), 204);
  assert.equal(existing.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
});
check(475, "rate limits", async () => {
  const before = await observed(), ip = "2001:db8:5:6::1";
  const changeTime = (at: number) => driver.control({ linkNow: at });
  const ask = (address = ip) => publicRequest(bad, address);
  const date = start + day * 3;
  await changeTime(date);
  for (let n = 0; n < 10; n++) await reason(ask(), 422, "address_refused");
  await reason(ask(runner === "workerd" ? "2001:db8:5:6::2" : ip), 429, "rate_limited");
  if (runner === "workerd") await reason(ask("2001:db8:5:7::1"), 422, "address_refused");
  await changeTime(date + minute);
  const concurrent = await Promise.all(Array.from({ length: 12 }, () => ask()));
  assert.equal(concurrent.filter(r => r.status === 422).length, 10);
  assert.equal(concurrent.filter(r => r.status === 429).length, 2);
  for (const response of concurrent) await response.arrayBuffer();
  if (runner === "workerd") await driver.control({ linkAlarm: "address:2001:db8:5:6::/64" });
  await reason(ask(), 429, "rate_limited");

  for (let m = 0; m < 20; m++) {
    await changeTime(date + day + m * minute);
    for (let n = 0; n < 10; n++) await reason(ask(), 422, "address_refused");
  }
  await changeTime(date + day + 20 * minute);
  await reason(ask(), 429, "rate_limited");
  await changeTime(date + 2 * day);
  await reason(ask(), 422, "address_refused");
  for (let n = 0; n < 20; n++) await reason(team(bad), 422, "address_refused");
  await reason(team(bad), 429, "rate_limited");
  await reason(team(bad, "editor", fixture.b), 422, "address_refused");

  for (const control of ["failLinkLimits", "delayLinkLimits"]) {
    await driver.control({ [control]: true });
    for (const send of [() => publicRequest(fixtureUrl), () => team(fixtureUrl, "editor", fixture.b)]) {
      const started = performance.now();
      const response = await responseOf(send(), 503);
      assert.equal((await response.json() as any).error.reason, "service_unavailable");
      assert(performance.now() - started < 1500);
    }
    await driver.control({ [control]: false });
  }
  assert.deepEqual(await observed(), before);
});
check(476, "nothing kept", async () => {
  const unknown = crypto.randomUUID();
  const inventory = async () => runner === "node" ? driver.control({ linkInventory: true }) : Promise.all(
    [fixture.a, unknown].flatMap(id => [undefined, "template" as const].flatMap(store =>
      ["meta", "pictures", "picture_parts"].map(table => driver.rows(id, table, store)))));
  const before = await inventory(), logs = (await driver.control({ linkLogs: true })).length;
  const url = "https://clean.test/sprint", result = await json(team(url), 200);
  assert.equal(result.picture.bytes, covers()); assert.deepEqual(await inventory(), before);
  const output = (await driver.control({ linkLogs: true })).slice(logs).join("\n");
  for (const value of [url, "clean.test", sprintTitle, sprintDescription, result.picture.bytes]) assert(!output.includes(value));
});
check(477, "card media in imports and templates", async () => {
  const { empty, canonical } = await import("../../packages/board-rules/src/document.ts");
  const { Adapter } = await import("../../packages/board-sync/src/document-adapter.ts");
  const { encode, decode } = await import("../../packages/board-sync/src/session.ts");
  const { readBoard } = await import("../../packages/board-sync/src/codec.ts");
  const Y = await import("yjs"), png = new Uint8Array(fixturePng(2, 2));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", png)), byte => byte.toString(16).padStart(2, "0")).join("");
  const entry = { hash, type: "image/png", bytes: png.byteLength };
  const board = empty();
  const card = { id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "link" as const, page: board.boardId, group: null,
    section: null, url: fixtureUrl, title: "Card in a file", description: "", site: "fieldnotes.test", asset: hash,
    layout: "vertical" as const, state: "ready" as const, requestedAt: 0, x: 0, y: 0, width: 306, height: 230, order: 0 };
  const document = { ...board, title: "File", objects: [card] };
  const workspace = `/workspaces/${fixture.workspace}`, boards = workspace + "/boards";
  await reason(request(boards, "POST", { title: "Without staging", document }, "owner"), 400, "images_not_supported");
  const imported = (await json(request(workspace + "/imports", "POST", { assets: [entry] }, "owner"), 201)).import;
  await json(request(workspace + "/imports/" + imported + "/assets/" + hash, "PUT", png, "owner"), 201);
  await json(request(boards, "POST", { title: "Imported", import: imported, document }, "owner"), 201);
  const exported = await responseOf(request(`/boards/${imported}/export`, "GET", undefined, "owner"), 200);
  assert.equal(await exported.text(), canonical({ ...document, boardId: imported, title: "Imported" }));
  async function imageAt(path: string) {
    return new Uint8Array(await (await responseOf(request(path + "/assets/" + hash, "GET", undefined, "viewer"), 200)).arrayBuffer());
  }
  assert.deepEqual(await imageAt(`/boards/${imported}`), png);
  const upload = (await json(request(workspace + "/template-uploads", "POST", { assets: [entry] }, "owner"), 201)).upload;
  await json(request(workspace + "/template-uploads/" + upload + "/assets/" + hash, "PUT", png, "owner"), 201);
  const { generation: _generation, order: _order, page: _page, ...saved } = card;
  const template = (await json(request(workspace + "/templates", "POST", { name: "Card template", description: "",
    sourceBoard: imported, objects: [saved], upload }, "owner"), 201)).id;
  const fromTemplate = await imageAt(workspace + "/templates/" + template);
  assert.deepEqual(fromTemplate, png);
  const target = `/boards/${fixture.a}`;
  await json(request(target + "/assets/" + hash, "PUT", fromTemplate, "editor"), 201);
  const ticket = (await json(request(target + "/join-tickets", "POST", undefined, "editor"), 201)).ticket;
  const peer = await driver.connect(target + "/join?ticket=" + ticket), adapter = new Adapter();
  try {
    const joined = await peer.next("joined");
    Y.applyUpdate(adapter.doc, decode(joined.update));
    const before = readBoard(adapter.doc) as ReturnType<typeof empty>, vector = Y.encodeStateVector(adapter.doc);
    const inserted = { ...card, id: crypto.randomUUID(), generation: crypto.randomUUID(), page: before.pages[0].id };
    adapter.set({ ...before, objects: [inserted] });
    const requestId = crypto.randomUUID();
    peer.send({ kind: "edit", requestId, update: encode(Y.encodeStateAsUpdate(adapter.doc, vector)),
      epoch: joined.epoch, restoreGeneration: joined.restoreGeneration });
    assert.equal((await peer.next("saved")).requestId, requestId);
    assert.deepEqual(await imageAt(target), png);
    assert.deepEqual((await json(request(target + "/export", "GET", undefined, "viewer"), 200)).objects, [inserted]);
  } finally { adapter.destroy(); await peer.close(); }
});
check(478, "manual redirects in the production configuration", async () => {
  const before = await observed("direct");
  assert.deepEqual(await driver.control({ linkManual: true }), { status: 302, location: "/manual-target" });
  assert.deepEqual((await observed("direct")).slice(before.length).map(row => row.path), ["/manual"]);
}, false);
