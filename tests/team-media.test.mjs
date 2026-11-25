// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { richBoard, imageBoard } from "./import-fixture.mjs";

const png = { hash: "a".repeat(64), type: "image/png", bytes: 8 };
const jpg = { hash: "b".repeat(64), type: "image/jpeg", bytes: 4 };
const mp4 = { hash: "c".repeat(64), type: "video/mp4", bytes: 8 };
const image = { type: "image", asset: png.hash };
const video = { type: "video", poster: jpg.hash, asset: mp4.hash };
const assets = [png, jpg, mp4];
const blob = ({ bytes, type }) => new Blob([new Uint8Array(bytes)], { type });
const files = assets.map(asset => ({ ...asset, blob: blob(asset) }));
const ok = { kind: "ok", id: "staging" }, accept = async () => ok, noop = () => {};
const unloaded = "a picture on this board couldn't be loaded";
const notAccepted = "the server did not accept it";
const stopped = "the upload stopped", offline = "you are offline";
const bytesFile = raw => { const data = new TextEncoder().encode(raw); return { size: data.length, arrayBuffer: async () => data.buffer }; };
let bundled;
async function mediaModule() {
  bundled ??= (async () => {
    const { build } = await import("esbuild");
    const result = await build({
      stdin: {
        contents: "export * from './apps/web/src/team/media-transfer.ts'; export { ApiError } from './apps/web/src/team/api.ts';",
        resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "ts",
      },
      bundle: true, write: false, format: "esm", platform: "node",
      plugins: [{ name: "transfer-test", setup(build) {
        build.onLoad({ filter: /\/team\/api\.ts$/ }, () => ({
          contents: "export const api = () => { throw Error('Unexpected API'); }; export class ApiError extends Error { constructor(status, reason) { super(reason); this.status = status; this.reason = reason; } }",
          loader: "js",
        }));
        build.onLoad({ filter: /\/team\/auth\.ts$/ }, () => ({
          contents: "export const auth = { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }) };",
          loader: "js",
        }));
      } }],
      define: { BOARD_TEAM_SETTINGS: JSON.stringify({ serverUrl: "https://board.example.test", supabaseUrl: "https://auth.example.test", anonKey: "synthetic" }) },
    });
    return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
  })();
  return bundled;
}
test("X9-U00 media-free imports keep the original single request and body", async () => {
  const { importBoard } = await import("../apps/web/src/team/import.ts");
  const { writeBoardFile } = await import("../apps/web/src/board-file.ts");
  const board = richBoard(), calls = [];
  assert.deepEqual(await importBoard(bytesFile(await writeBoardFile(board)), async body => { calls.push(body); return ok; }), ok);
  assert.deepEqual(calls, [{ title: board.title, document: board }]);
});
test("X9-U01 media order and kinds, validation of poster type and duplicate hashes", async () => {
  const { mediaOf, checkedSizes } = await mediaModule();
  assert.deepEqual(mediaOf([video, image, video]), [
    { hash: jpg.hash, kind: "picture" }, { hash: mp4.hash, kind: "video" }, { hash: png.hash, kind: "picture" },
  ]);
  assert.deepEqual(checkedSizes([video, image], assets), [jpg, mp4, png]);
  assert.equal(checkedSizes([video], [mp4, { ...png, hash: jpg.hash }]), null);
  assert.equal(checkedSizes([video], [jpg]), null);
});
test("X9-U02 rounded progress is monotonic and capped at 99 while the last response is pending", async () => {
  const { percent, Progress } = await mediaModule();
  assert.deepEqual([percent(-1, 4), percent(2, 3), percent(5, 4), percent(0, 0)], [0, 66, 100, 0]);
  const progress = new Progress(20);
  assert.deepEqual([progress.report(10), progress.report(9), progress.report(20), progress.report(20, true)], [50, 50, 99, 100]);
});
test("X9-U03 watchdog re-arms on progress and can stop cleanly", async t => {
  const { watchdog } = await mediaModule();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let stalls = 0;
  const timer = watchdog(60_000, () => stalls++);
  t.mock.timers.tick(59_999); timer.poke(); t.mock.timers.tick(59_999);
  assert.equal(stalls, 0); t.mock.timers.tick(1); assert.equal(stalls, 1);
  timer.poke(); timer.stop(); t.mock.timers.tick(100_000); assert.equal(stalls, 1);
});
test("X9-U04 picture line counts and MiB rounding", async () => {
  const { mib, mibUp, pictureLine } = await import("../apps/web/src/team/templates-rules.ts");
  assert.equal(mib(320_000), "0.3");
  assert.equal(mibUp(27_900_000), "27");
  assert.equal(pictureLine({ pictures: 1, videos: 0 }, 320_000), "Includes 1 picture (0.3 MiB of the 20 MiB a template can hold).");
  assert.equal(pictureLine({ pictures: 2, videos: 1 }), "Includes 2 pictures and 1 video.");
  assert.equal(pictureLine({ pictures: 3, videos: 0 }, 27_900_000), "Includes 3 pictures (27 MiB of the 20 MiB a template can hold).");
  assert.equal(pictureLine({ pictures: 0, videos: 0 }), "");
});
test("X9-U05 import opens, uploads one by one and only then finishes at 100%", async () => {
  const { runImport } = await mediaModule(), events = [], counts = [];
  const result = await runImport(files, {
    open: async entries => { assert.deepEqual(entries, assets); events.push("open"); return ok; },
    stage: async (id, hash, payload, progress) => {
      assert.equal(id, ok.id); events.push(hash);
      progress(payload.size, payload.size); progress(0, payload.size);
      if (hash === mp4.hash) assert.equal(counts.at(-1), 99);
      return "ok";
    },
    finish: async id => { assert.equal(id, ok.id); assert.equal(counts.at(-1), 100); events.push("finish"); return "board"; },
  }, value => counts.push(value));
  assert.deepEqual(result, { ok: true, value: "board" });
  assert.deepEqual(events, ["open", ...assets.map(asset => asset.hash), "finish"]);
  assert.equal(counts[0], 0);
  assert.deepEqual(counts, counts.toSorted((a, b) => a - b));
});
test("X9-U06 import failure reasons stop the sequence before the finish", async () => {
  const { runImport, ApiError } = await mediaModule();
  const cases = [["expired", stopped], ["network", offline], ["gone", "you can no longer add boards here"], ["refused", notAccepted]];
  for (const [kind, reason] of cases) {
    const sent = await runImport(files, { open: accept, stage: async () => kind, finish: () => assert.fail("Finished") }, noop);
    assert.deepEqual(sent, { ok: false, reason });
  }
  for (const [error, reason] of [[new ApiError(0, "no_answer"), offline], [new ApiError(410, "upload_expired"), stopped],
    [new ApiError(404, "not_found"), "you can no longer add boards here"], [new ApiError(400, "bad_request"), notAccepted]]) {
    assert.deepEqual(await runImport(files, { open: accept, stage: async () => "ok", finish: async () => { throw error; } }, noop),
      { ok: false, reason });
  }
});
test("X9-U07 watchdog wins over an upload's own abort, and a parent abort prevents the finish", async t => {
  const { runImport } = await mediaModule();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = runImport(files, {
    open: accept, stage: (_, _hash, _blob, progress, signal) => new Promise(resolve => {
      signal.addEventListener("abort", () => resolve("refused")); started(progress);
    }), finish: () => assert.fail("Finished"),
  }, noop);
  const progress = await ready;
  t.mock.timers.tick(59_999); progress(1, 8); t.mock.timers.tick(60_000);
  assert.deepEqual(await pending, { ok: false, reason: stopped });
  const parent = new AbortController();
  await runImport(files, {
    open: accept, stage: async () => { parent.abort(); return "ok"; }, finish: () => assert.fail("Finished"),
  }, noop, parent.signal);
});
const download = async (entry, progress) => { progress(entry.bytes, entry.bytes); return { kind: "ok", blob: blob(entry) }; };
test("X9-U08 template save downloads and stages each file, with the mutation last", async () => {
  const { runTemplateSave } = await mediaModule(), events = [], counts = [];
  const result = await runTemplateSave([png, mp4], {
    open: accept, download: async (entry, emit) => { events.push("get " + entry.hash); return download(entry, emit); },
    stage: async (id, hash, bytes, emit) => { assert.equal(id, ok.id); events.push("put " + hash); emit(bytes.size, bytes.size); return "ok"; },
    save: async () => { events.push("save"); return 1; },
  }, value => counts.push(value));
  assert.deepEqual(events, ["get " + png.hash, "put " + png.hash, "get " + mp4.hash, "put " + mp4.hash, "save"]);
  assert.deepEqual([...new Set(counts)], [0, 25, 50, 75, 99, 100]);
  assert.deepEqual(result, { ok: true, value: 1 });
});
test("X9-U09 saving keeps exact media reasons and preserves the template limit result", async () => {
  const { runTemplateSave, ApiError } = await mediaModule();
  const base = { open: accept, download, stage: async () => "ok", save: () => assert.fail("Saved") };
  for (const kind of ["network", "refused"]) {
    assert.equal((await runTemplateSave([jpg], { ...base, download: async () => ({ kind }) }, noop)).reason, unloaded);
  }
  for (const [kind, reason] of [["expired", stopped], ["network", offline], ["gone", notAccepted], ["refused", notAccepted]]) {
    assert.equal((await runTemplateSave([jpg], { ...base, stage: async () => kind }, noop)).reason, reason);
  }
  for (const [status, code, reason, limit] of [[409, "template_limit", notAccepted, true], [410, "upload_expired", stopped, false],
    [0, "no_answer", offline, false], [403, "role_too_low", notAccepted, false]]) {
    const result = await runTemplateSave([jpg], { ...base, save: async () => { throw new ApiError(status, code); } }, noop);
    assert.deepEqual(result, { ok: false, reason, limit });
  }
});
test("X9-U10 template add inserts once after every upload and maps each failure", async () => {
  const { runTemplateAdd } = await mediaModule(), counts = [], uploaded = [];
  let inserts = 0;
  const base = { download, upload: async (asset, bytes, emit) => { uploaded.push(asset.hash); emit(bytes.size, bytes.size); return "ok"; },
    insert: () => { assert.deepEqual(uploaded, [jpg.hash, mp4.hash, png.hash]); inserts++; } };
  assert.deepEqual(await runTemplateAdd([video, image], assets, base, value => counts.push(value)), { ok: true });
  assert.equal(inserts, 1);
  assert.equal(counts.at(-2), 99); assert.equal(counts.at(-1), 100);
  const guarded = { ...base, insert: () => assert.fail("Inserted") };
  for (const [answer, reason] of [["offline", offline], ["network", offline], ["full", "this board already holds 50 MiB of pictures"],
    ["videos_full", "this board already holds 100 MiB of videos"], ["refused", notAccepted]]) {
    assert.equal((await runTemplateAdd([video], assets, { ...guarded, upload: async () => answer }, noop)).reason, reason);
  }
  assert.equal((await runTemplateAdd([video], [mp4], guarded, noop)).reason, "its pictures could not be loaded");
  assert.equal((await runTemplateAdd([video], assets, { ...guarded, download: async () => ({ kind: "network" }) }, noop)).reason, "its pictures could not be loaded");
});
test("X9-U11 template detail adds media only on the detail, with strict entries", async () => {
  const { parseTemplate, parseTemplateDetail, templateBoard } = await import("../apps/web/src/team/templates-rules.ts");
  const { templateObjects } = await import("../apps/server/src/templates.ts");
  const objects = imageBoard(png.hash).objects.map(({ generation, order, page, ...object }) => object);
  const detail = { id: crypto.randomUUID(), name: "Pictures", description: "", creatorLabel: "Owner", sourceTitle: "Board",
    objectCount: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), canManage: true, objects };
  assert.equal(templateBoard(objects).objects[0].type, "image");
  assert.throws(() => templateObjects(objects), { status: 400, message: "bad_request" });
  assert.deepEqual(parseTemplateDetail({ ...detail, media: [png] }), { ...detail, media: [png] });
  assert.throws(() => parseTemplate({ ...detail, media: [png] }));
  assert.throws(() => parseTemplateDetail({ ...detail, media: [mp4, png] }));
  assert.throws(() => parseTemplateDetail({ ...detail, media: [{ ...png, bytes: 0 }] }));
});
test("X9-U12 the board add runner survives the panel and re-sends progress", async t => {
  const { templateAdds } = await mediaModule(), notices = [], changes = [];
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  let respond, uploading;
  const reached = new Promise(resolve => { uploading = resolve; });
  t.mock.method(globalThis, "fetch", async () => new Response(blob(png), {
    headers: { "Content-Length": String(png.bytes), "Content-Type": png.type },
  }));
  const hosted = { snapshot: { workspaceId: "workspace" }, toast: text => notices.push(text),
    pictures: { upload: async () => new Promise(resolve => { respond = resolve; uploading(); }) } };
  const runner = templateAdds(hosted), off = runner.subscribe(() => changes.push(runner.adding));
  let inserted = 0;
  const action = runner.add({ name: "Kit", id: "template", objects: [image], media: [png] }, off, () => inserted++);
  assert.equal(templateAdds(hosted).adding, true);
  await reached;
  const previous = notices.length;
  t.mock.timers.tick(2_000);
  assert.equal(notices.length, previous + 1);
  respond({ ok: true }); await action;
  assert.deepEqual(changes, [true]); assert.equal(inserted, 1); assert.equal(runner.adding, false);
});
test("X9-U13 save and add watchdog failures take precedence over download refusals", async t => {
  const { runTemplateAdd, runTemplateSave } = await mediaModule();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const run of [
    task => runTemplateSave([png], { open: accept, download: task, stage: () => assert.fail("Staged"), save: () => assert.fail("Saved") }, noop),
    task => runTemplateAdd([image], [png], { download: task, upload: () => assert.fail("Uploaded"), insert: () => assert.fail("Inserted") }, noop),
  ]) {
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const result = run((_entry, _progress, signal) => new Promise(resolve => {
      signal.addEventListener("abort", () => resolve({ kind: "network" })); started();
    }));
    await ready;
    t.mock.timers.tick(60_000);
    assert.deepEqual(await result, { ok: false, reason: stopped });
  }
});
