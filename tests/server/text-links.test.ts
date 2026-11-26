// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { afterAll, beforeAll, inject, test } from "vitest";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
import type { Board, Item } from "../../packages/board-rules/src/document.ts";

const context = inject<Context>("board"), runner = inject<string>("runner");
let driver: Driver;
beforeAll(async () => { driver = await makeDriver(context); });
afterAll(async () => { await driver?.close(); });

const address = "https://example.com/";
const next = "http://localhost:5173/agenda";
const hex = (bytes: Uint8Array) => "x'" + Buffer.from(bytes).toString("hex") + "'";

async function answer(peer: Peer, id: string) {
  const deadline = Date.now() + 10_000;
  do {
    const message = peer.messages.find(value => value.requestId === id && ["saved", "refused"].includes(value.kind));
    if (message) return message;
    await new Promise(resolve => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  assert.fail("An edit receipt did not arrive");
}

test("S479 text links pass through room edits, validation, import, templates and history", async () => {
  const peers: Peer[] = [], docs: Y.Doc[] = [];
  try {
    const links = await import("../../packages/board-rules/src/text-link.ts");
    const rules = await import("../../packages/board-rules/src/document.ts");
    const { createConnector } = await import("../../apps/web/src/connectors.ts");
    const { templateSnapshot } = await import("../../apps/web/src/team/templates-rules.ts");
    const { importBoard } = await import("../../apps/web/src/team/import.ts");
    const { writeBoardFile } = await import("../../apps/web/src/board-file.ts");
    const { readLiveBoard } = await import("../../packages/board-sync/src/codec.ts");
    const { encode, decode } = await import("../../packages/board-sync/src/session.ts");
    const { storedBoardUpdate } = await import("../import-fixture.mjs");
    const fixture = await fetch(`${context.helperUrl}/removal-fixture`, { method: "POST", body: "{}" });
    assert.equal(fixture.status, 200);
    const f = await fixture.json() as { workspace: string; people: Context["people"] };
    async function request(path: string, role = "owner", method = "GET", body?: unknown, status = 200) {
      const result = await driver.request(path, { method, headers: { Authorization: `Bearer ${f.people[role].token}`,
        Origin: context.origin, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      assert.equal(result.status, status, await result.clone().text());
      return result.json();
    }
    const create = (title: string, document?: Board) => request(`/workspaces/${f.workspace}/boards`, "owner", "POST", { title, document }, 201);
    const exported = (id: string) => request(`/boards/${id}/export`);
    const versions = (id: string) => request(`/boards/${id}/versions`);
    async function join(board: string, role: string) {
      const ticket = await request(`/boards/${board}/join-tickets`, role, "POST", undefined, 201);
      const peer = await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`); peers.push(peer);
      const joined = await peer.next("joined"), doc = new Y.Doc(); docs.push(doc);
      Y.applyUpdate(doc, decode(joined.update));
      return { peer, doc, joined };
    }
    async function edit(client: Awaited<ReturnType<typeof join>>, change: (draft: Y.Doc) => void) {
      const draft = new Y.Doc();
      try {
        Y.applyUpdate(draft, Y.encodeStateAsUpdate(client.doc));
        const vector = Y.encodeStateVector(draft), id = crypto.randomUUID();
        change(draft);
        client.peer.send({ kind: "edit", epoch: client.joined.epoch, requestId: id, restoreGeneration: client.joined.restoreGeneration,
          update: encode(Y.encodeStateAsUpdate(draft, vector)) });
        const result = await answer(client.peer, id);
        if (result.kind === "saved") {
          Y.applyUpdate(client.doc, Y.encodeStateAsUpdate(draft, vector));
          if (result.update) Y.applyUpdate(client.doc, decode(result.update));
        }
        return result;
      } finally { draft.destroy(); }
    }

    let document = rules.add(rules.add({ ...rules.empty(), title: "Linked notes" }, "sticky", 0, 0), "shape", 300, 0);
    const source = document.objects[0];
    assert(source.type === "sticky");
    source.text = "abcd";
    source.marks = links.setLink([], source.text, 0, 2, address);
    document = createConnector(document, source.id, document.objects[1].id).board;
    const connector = document.objects.find(o => o.type === "connector")!;
    assert(connector.type === "connector");
    connector.text = "label";
    const created = await create(document.title, document), id = created.id as string;
    const saved = await exported(id);
    assert.equal(saved.schemaVersion, 17);
    assert.deepEqual(saved.objects.find((o: { id: string }) => o.id === source.id).marks, source.marks);

    const editor = await join(id, "editor"), observer = await join(id, "owner");
    const set = (object: string, marks: unknown) => (draft: Y.Doc) => draft.getMap<Y.Map<unknown>>("objects").get(object)!.set("marks", marks);
    const before = (await versions(id)).head.revision;
    const accepted = await edit(editor, set(source.id, [{ start: 0, end: 2, link: next }, { start: 2, end: 4, link: next }]));
    assert.equal(accepted.kind, "saved");
    const broadcast = await observer.peer.next("update");
    assert.equal(broadcast.revision, before + 1);
    Y.applyUpdate(observer.doc, decode(broadcast.update));
    const repaired = [{ start: 0, end: 4, link: next }];
    const actual = (board: Board) => board.objects.find(o => o.id === source.id)!.marks;
    assert.deepEqual(actual(readLiveBoard(editor.doc)), repaired);
    assert.deepEqual(actual(readLiveBoard(observer.doc)), repaired);
    assert.deepEqual(actual(await exported(id)), repaired);

    for (const link of ["javascript:alert(1)", "https://user@example.com/", address.padEnd(2049, "x"), "example.com"]) {
      const refused = await edit(editor, set(source.id, [{ start: 0, end: 1, link }]));
      assert.equal(refused.kind, "refused"); assert.equal(refused.reason, "invalid_update");
    }
    const invalid = [{ start: 0, end: 1, link: address }];
    assert.throws(() => rules.validate({ ...saved, objects: saved.objects.map((o: Item) => o.id === connector.id ? { ...o, marks: invalid } : o) }), /Invalid object paint/);
    const refused = await edit(editor, set(connector.id, invalid));
    assert.equal(refused.kind, "refused"); assert.equal(refused.reason, "invalid_document");
    assert.equal((await versions(id)).head.revision, before + 1);

    const current = readLiveBoard(editor.doc), raw = await writeBoardFile(current);
    const bytes = new TextEncoder().encode(raw);
    const imported = await importBoard({ size: bytes.length, arrayBuffer: async () => bytes.buffer as ArrayBuffer }, body => create(body.title, body.document));
    assert.deepEqual(actual(await exported(imported.id)), repaired);
    const snapshot = templateSnapshot(current, new Set([source.id]), current.objects.map(o => ({ ...o, displayHeight: o.height ?? 0, x: o.x ?? 0, y: o.y ?? 0, width: o.width ?? 0 }))).snapshot!;
    const templates = `/workspaces/${f.workspace}/templates`;
    const body = { name: "Notes with links", description: "", sourceBoard: id, objects: snapshot.objects };
    const template = await request(templates, "owner", "POST", body, 201);
    const detail = await request(`${templates}/${template.id}`);
    assert.deepEqual(detail.objects[0].marks, repaired);
    assert.deepEqual(detail.media, []);
    const invalidTemplate = { ...body, objects: [{ ...body.objects[0], marks: [{ start: 0, end: 1, link: "example.com" }] }] };
    assert.deepEqual(await request(templates, "owner", "POST", invalidTemplate, 400), { error: { reason: "bad_request" } });

    const { id: oldId } = await create("Schema 16 history");
    const legacy = { schemaVersion: 16 as const, boardId: oldId, pages: [{ id: oldId, name: "Page 1" }],
      title: "Schema 16 history", objects: [], retiredGenerations: [] };
    const old = (await versions(oldId)).versions[0];
    const json = new TextEncoder().encode(rules.canonical(legacy)), yjs = storedBoardUpdate(legacy);
    const fingerprint = Buffer.from(await crypto.subtle.digest("SHA-256", json)).toString("hex");
    await driver.control({ board: oldId, roomSQL: [
      { sql: `UPDATE snapshot_chunks SET bytes=${hex(json)} WHERE kind='json'` },
      { sql: `UPDATE snapshot_chunks SET bytes=${hex(yjs)} WHERE kind='yjs'` },
      { sql: `UPDATE version_chunks SET bytes=${hex(json)} WHERE version_id=?`, bindings: [old.id] },
      { sql: "UPDATE meta SET value=? WHERE key='history_capture_sha256'", bindings: [fingerprint] },
      { sql: "UPDATE meta SET value=? WHERE key='history_capture_bytes'", bindings: [json.length] },
    ] });
    await driver.wake(oldId);
    assert.equal((await exported(oldId)).schemaVersion, 17);
    assert.equal((await request(`/boards/${oldId}/versions/${old.id}`)).document.schemaVersion, 16);
    const history = await versions(oldId);
    await driver.control({ fixedNow: Date.now() + 5_400_001 });
    await driver.control({ board: oldId, alarm: true });
    assert.deepEqual(await versions(oldId), history);
    console.log(`PASS: S479 text links (${runner})`);
  } catch (error) {
    console.log(`FAIL: S479 text links (${runner})`);
    throw error;
  } finally {
    await Promise.all(peers.map(peer => peer.close()));
    for (const doc of docs) doc.destroy();
    await driver.control({ fixedNow: null });
  }
});
