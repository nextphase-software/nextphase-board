// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import * as Y from "yjs";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";
import { add } from "../packages/board-rules/src/document.ts";
import { version13Board, storedBoardUpdate } from "./import-fixture.mjs";

const digest = data => createHash("sha256").update(data).digest("hex");
function gif(n = 10, tag = 0) {
  const data = new Uint8Array(n);
  data.set([71,73,70,56,57,97,2,0,3,0]); if (n > 10) data[10] = tag;
  return data;
}
async function fixture(t, load = true) {
  const { Room } = await import("../packages/board-room/src/room.ts");
  const { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const s = new NodeStorage(":memory:"), board = randomUUID();
  let time = 1794000000000, fence = 0;
  const env = { storage: s, now: () => time, access: { board: async () => ({ title: "Pictures", createdAt: new Date(time).toISOString() }),
    role: async () => "editor", changes: async () => ({ changes: [], latest: 0, lowestKept: 1 }) },
    lifecycle: { lifecycle: async () => ({ state: "active", generation: 0 }) }, connections: () => [],
    randomId: randomUUID, randomTicket: randomUUID, fence: async () => fence, raiseFence: async (min = 0) => fence = Math.max(min, fence) + 1,
    hash: async data => digest(data), schedule: async () => {}, backupLimit: 100663296 };
  const room = new Room(board, env), person = { id: randomUUID(), email: "editor@example.test", expiresAt: Number.MAX_SAFE_INTEGER };
  t.after(() => { room.doc.destroy(); s.close(); });
  if (load) await room.load();
  return { s, room, board, env, person, advance: n => { time += n; }, fence: () => fence,
    put: data => room.storePicture(person, digest(data), data, "image/gif", 2, 3), get: hash => room.readPicture(person, hash),
    save: () => room.saveVersion(person, { requestId: randomUUID(), name: "", description: "" }) };
}
function image(board, hash) {
  return { id: randomUUID(), generation: randomUUID(), type: "image", page: board.pages[0].id, group: null, section: null,
    order: board.objects.length, x: 0, y: 0, width: 2, height: 3, pixelWidth: 2, pixelHeight: 3, description: "", asset: hash };
}
async function candidate(room, board) {
  const { evaluate } = await import("../packages/board-room/src/edits.ts");
  const adapter = new Adapter();
  try {
    Y.applyUpdate(adapter.doc, Y.encodeStateAsUpdate(room.doc));
    const vector = Y.encodeStateVector(adapter.doc); adapter.set(board);
    return evaluate(room.doc, room.board, Y.encodeStateAsUpdate(adapter.doc, vector), room.env.storage);
  } finally { adapter.destroy(); }
}
test("X7-U20 picture header sizes and unreadable headers", async () => {
  const { pictureHeader } = await import("../packages/board-room/src/pictures.ts");
  const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]); png.set(Buffer.from("IHDR"),12); png[19]=99; png[23]=51;
  assert.deepEqual(pictureHeader(png), { type:"image/png",width:99,height:51 });
  assert.deepEqual(pictureHeader(gif()), { type:"image/gif",width:2,height:3 });
  const jpeg = marker => Uint8Array.from([255,216,255,224,0,3,9,255,255,1,255,211,255,marker,0,8,8,0,20,0,45,0]);
  for (const marker of [192,194]) assert.deepEqual(pictureHeader(jpeg(marker)),{type:"image/jpeg",width:45,height:20});
  const webp = chunk => { const d = new Uint8Array(30); d.set(Buffer.from("RIFF")); d.set(Buffer.from("WEBP"+chunk),8); return d; };
  const vp8 = webp("VP8 "); vp8.set([2,192,3,128],26);
  const vp8l = webp("VP8L"); vp8l[20] = 47; new DataView(vp8l.buffer).setUint32(21,(2 << 14) + 1,true);
  const vp8x = webp("VP8X"); vp8x.set([1,0,0,2,0,0],24);
  for (const data of [vp8,vp8l,vp8x]) assert.deepEqual(pictureHeader(data),{type:"image/webp",width:2,height:3});
  for (const data of [[],[1],[255,216,255,217],[255,216,255,218],[255,216,255,224,0,1],[255,216,255,224,0,8],
    [255,216,255,1,42],jpeg(196),jpeg(200),jpeg(204),jpeg(192).slice(0,-1),jpeg(192).with(15,6),
    gif().slice(0,9),gif().with(6,0),png.with(12,0),png.slice(0,23),vp8.slice(0,29),vp8l.with(20,0),vp8l.slice(0,24),vp8x.slice(0,29),webp("NONE")]) {
    assert.equal(pictureHeader(Uint8Array.from(data)),null);
  }
});
test("X7-U21 layout 9 creation, legacy backups and version gates", async t => {
  const { room, s, person } = await fixture(t);
  const { meta, initialize, setMeta } = await import("../packages/board-room/src/storage.ts");
  const { decodeBackup } = await import("../packages/board-room/src/backups.ts");
  const backup = await room.backup(); assert.equal(meta(s,"storage_version"),9);
  const inventory = () => ["versions","receipts","edits","identifiers","comments"].map(n => s.all("SELECT * FROM "+n));
  const before = inventory();
  const transactions = [], commit = s.transaction.bind(s), exec = s.exec.bind(s);
  let writes;
  s.transaction = operation => commit(() => {
    writes = []; transactions.push(writes);
    try { return operation(); } finally { writes = undefined; }
  });
  s.exec = (sql,...args) => { writes?.push([sql,...args]); return exec(sql,...args); };
  for (const version of [7,8]) for (const keep of [true,false]) {
    const old = structuredClone(backup); old.tables.meta.find(r=>r.key==="storage_version").value=version;
    if (version===7) {
      const b=version13Board(room.board), {canonical}=await import("../packages/board-rules/src/document.ts");
      old.tables.snapshot_chunks.find(r=>r.kind==="yjs").bytes=Buffer.from(storedBoardUpdate(b,true)).toString("base64");
      old.tables.snapshot_chunks.find(r=>r.kind==="json").bytes=Buffer.from(canonical(b)).toString("base64");
    }
    if (!keep) { delete old.tables.pictures; delete old.tables.picture_parts; }
    transactions.length = 0;
    await room.restore(old); await room.export(person);
    const upgrades = transactions.filter(group => group.some(([,key,value]) => key === "storage_version" && value === 9));
    assert.equal(upgrades.length,1); assert.equal(upgrades[0].length,1); assert.equal(meta(s,"storage_version"),9); assert.deepEqual(inventory(),before);
    const bad=structuredClone(old); bad.tables.pictures=[{}]; assert.throws(()=>decodeBackup(bad,room.boardId));
  }
  setMeta(s,"storage_version",10); assert.throws(()=>initialize(s),/storage_unsupported/);
});
test("X7-U22 complete parts, idempotence, refresh and transactional rollback", async t => {
  const f=await fixture(t), { held, PART_BYTES }=await import("../packages/board-room/src/pictures.ts");
  const data=gif(PART_BYTES+10), hash=digest(data); assert.equal(await f.put(data),"created");
  f.advance(17); assert.equal(await f.put(data),"exists"); assert.equal(held(f.s,hash).uploaded_at,f.env.now());
  assert.deepEqual((await f.get(hash)).bytes,data);
  for(const change of ["UPDATE picture_parts SET part=1.1 WHERE part=1","DELETE FROM picture_parts WHERE part=0",
    "UPDATE picture_parts SET data=zeroblob(2) WHERE part=0","UPDATE picture_parts SET data=zeroblob(1) WHERE part=1",
    "INSERT INTO picture_parts SELECT hash,4,data FROM picture_parts WHERE part=1"]) {
    f.s.exec(change); assert.equal(held(f.s,hash),undefined); assert.equal(await f.get(hash),null); assert.equal(await f.put(data),"created");
  }
  const other=gif(PART_BYTES+11), exec=f.s.exec.bind(f.s); f.s.exec=(sql,...args)=>{
    if(sql.startsWith("INSERT INTO picture_parts") && args[1]===1) throw Error("part write");
    exec(sql,...args);
  };
  await assert.rejects(f.put(other),/part write/); f.s.exec=exec;
  assert.deepEqual(f.s.all("SELECT * FROM pictures WHERE hash=?",digest(other)),[]);
  assert.deepEqual(f.s.all("SELECT part FROM picture_parts WHERE hash=?",digest(other)),[]);
});
test("X7-U23 board limit serializes concurrent stores, keeps refusal cleanup, fits the Node backup limit", async t => {
  const f=await fixture(t),{ BOARD_BYTES,PICTURE_BYTES,RECENT_UPLOAD }=await import("../packages/board-room/src/pictures.ts");
  const images=[gif(PICTURE_BYTES,1),gif(PICTURE_BYTES,2),gif(BOARD_BYTES-2*PICTURE_BYTES-1000,3)];
  for(const data of images) assert.equal(await f.put(data),"created");
  const small=[gif(1000,4),gif(1000,5)]; assert.deepEqual(await Promise.all(small.map(f.put)),["created","full"]);
  assert.equal((await f.get(digest(images[0]))).bytes.length,PICTURE_BYTES);
  const backup=await f.room.backup();assert.equal(backup.tables.picture_parts.length,51);
  const size=Buffer.byteLength(JSON.stringify(backup));assert(size<100663296);t.diagnostic("Full board backup bytes "+size);
  await f.room.restore(backup); assert.deepEqual((await f.get(digest(images[0]))).bytes,images[0]);
  const before=f.fence(), extra=digest(small[1]);
  backup.tables.pictures.push({...backup.tables.pictures.find(row=>row.hash===digest(small[0])),hash:extra});
  backup.tables.picture_parts.push({hash:extra,part:0,data:Buffer.from(small[1]).toString("base64")});
  await assert.rejects(f.room.restore(backup),/bad_request/);assert.equal(f.fence(),before);
  f.s.exec("INSERT INTO picture_parts VALUES ('orphan',0,zeroblob(1))");
  f.s.exec("UPDATE pictures SET uploaded_at=? WHERE hash=?",f.env.now()-RECENT_UPLOAD-1,digest(small[0]));
  assert.equal(await f.put(gif(1001,6)),"full"); assert.equal(await f.get(digest(small[0])),null);
  assert.equal(f.s.all("SELECT COUNT(*) AS n FROM picture_parts WHERE hash='orphan'")[0].n,0);
});
test("X7-U24 backup refuses after recovery gates and before any payload row", async t => {
  const f=await fixture(t), {backup}=await import("../packages/board-room/src/backups.ts");
  const {setMeta}=await import("../packages/board-room/src/storage.ts");await f.put(gif()); f.env.backupLimit=10;
  const queries=[], all=f.s.all.bind(f.s); f.s.all=(sql,...args)=>{queries.push(sql);return all(sql,...args);};
  for(const key of ["restore_pending","explicit_recovery_pending"]){
    setMeta(f.s,key,1);assert.throws(()=>backup(f.env,f.board),/restore_pending/);assert(!queries.some(q=>q.includes("picture_parts")));setMeta(f.s,key,0);
  }
  queries.length=0;assert.throws(()=>backup(f.env,f.board),/backup_too_large/);
  assert.match(queries.at(-1),/SUM\(length\(data\)\)/);assert(!queries.some(q=>q.includes("SELECT *")));
});
test("X7-U25 cleanup on upload and skipped checkpoint respects every keep rule and the fence",async t=>{
  const f=await fixture(t),{ RECENT_UPLOAD,cleanPictures }=await import("../packages/board-room/src/pictures.ts");
  const data=Array.from({length:5},(_,i)=>gif(15,i)), keys=data.map(digest);
  for(const d of data) await f.put(d);
  f.advance(RECENT_UPLOAD);await f.room.history.automatic("last_close");assert.equal(f.s.all("SELECT hash FROM pictures").length,5);
  const second=randomUUID(), board={...f.room.board,pages:[...f.room.board.pages,{id:second,name:"Second"}]};
  board.objects=[{...image(board,keys[0]),page:second}];f.room.board=board;
  const version=(await f.save()).version;assert.equal(f.s.all("SELECT captured_ordinal FROM pictures WHERE hash=?",keys[0])[0].captured_ordinal,version.ordinal);
  f.s.exec("UPDATE pictures SET captured_ordinal=? WHERE hash=?",version.ordinal,keys[1]);
  f.s.exec("UPDATE pictures SET captured_ordinal=1 WHERE hash=?",keys[2]);
  f.s.exec("DELETE FROM versions WHERE ordinal=1");f.advance(1);
  await f.room.history.automatic("last_close");
  assert.deepEqual(f.s.all("SELECT hash FROM pictures ORDER BY hash").map(r=>r.hash),keys.slice(0,2).sort());
  f.s.exec("DELETE FROM versions");cleanPictures(f.s,board,f.env.now());assert.equal(await f.get(keys[1]),null);assert(await f.get(keys[0]));
  await f.put(data[3]);f.advance(RECENT_UPLOAD+1);await f.room.lifecycle.fence({state:"moving",generation:0});
  assert(f.s.all("SELECT hash FROM pictures WHERE hash=?",keys[3]).length);
  await f.put(data[4]);assert.equal(await f.get(keys[3]),null);
});
test("X7-U26 image edits, preview, restore, marks and a missing picture in a restored head",async t=>{
  const f=await fixture(t),hash=digest(gif()), original=f.room.board;
  const board=add(original,"sticky",10,20);board.objects.push(image(board,hash));
  assert.equal((await candidate(f.room,board)).reason,"asset_missing");
  await f.put(gif());const edit=await candidate(f.room,board);assert.equal(edit.kind,"complete");edit.doc.destroy();
  // Install a head through creation so its ledger, stored CRDT and initial version agree.
  const g=await fixture(t,false), base={...board,boardId:g.board,pages:[{id:g.board,name:"Page 1"}],objects:board.objects.map(o=>({...o,page:g.board}))};
  const {storePicture}=await import("../packages/board-room/src/pictures.ts");
  storePicture(g.s,base,g.env.now(),hash,gif(),"image/gif",2,3);
  await g.room.create(base);const initial=(await g.room.versions(g.person)).versions[0];assert.equal(g.s.all("SELECT captured_ordinal FROM pictures")[0].captured_ordinal,initial.ordinal);
  assert.deepEqual((await g.room.version(g.person,initial.id)).document,base);
  const changed=structuredClone(base);changed.objects.at(-1).asset="b".repeat(64);assert.equal((await candidate(g.room,changed)).reason,"asset_missing");
  g.s.exec("DELETE FROM picture_parts");g.s.exec("DELETE FROM pictures");
  await g.room.rename(g.person,"Changed");
  const head=(await g.room.versions(g.person)).head;
  await g.room.restoreVersion(g.person,initial.id,{requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});
  assert.equal(g.room.board.objects.at(-1).asset,hash);assert.equal(await g.get(hash),null);
  const moved=structuredClone(g.room.board);moved.objects[0].x+=30;const move=await candidate(g.room,moved);assert.equal(move.kind,"complete");move.doc.destroy();
  const backup=await g.room.backup();await g.room.restore(backup);assert.equal(JSON.parse(await g.room.export(g.person)).objects.at(-1).asset,hash);
  for(const value of [7,8]){const legacy=structuredClone(backup);legacy.tables.meta.find(r=>r.key==="storage_version").value=value;
    const fence=g.fence();await assert.rejects(g.room.restore(legacy),/bad_request/);assert.equal(g.fence(),fence);}
  await g.put(gif());assert.equal(g.s.all("SELECT captured_ordinal FROM pictures")[0].captured_ordinal,null);
});
test("X7-U27 malformed picture backup rows are refused before any fence or replacement",async t=>{
  const f=await fixture(t);await f.put(gif(1048577));
  const backup=await f.room.backup(), before=f.fence();
  for(const change of [
    t=>t.pictures.push({...t.pictures[0]}),t=>t.pictures[0].hash="bad",t=>t.pictures[0].type="text/plain",
    ...[["bytes",0],["bytes",20971521],["parts",1],["width",0],["height",4097],["width",1.5],["uploaded_at",0.1],["captured_ordinal",0]].map(([k,v])=>t=>t.pictures[0][k]=v),
    t=>t.picture_parts[1].part=0,t=>t.picture_parts[1].part=2,t=>t.picture_parts[1].part=0.5,
    t=>t.picture_parts.pop(),t=>t.picture_parts[0].data="AA==",t=>t.picture_parts[1].data="AQ==",
    t=>t.picture_parts[1].hash="a".repeat(64),t=>t.picture_parts[1].data="AAAA",
  ]){const bad=structuredClone(backup);change(bad.tables);await assert.rejects(f.room.restore(bad),/bad_request/);assert.equal(f.fence(),before);}
  assert.deepEqual((await f.room.backup()).tables,backup.tables);
});
test("X7-U28 each restore capture marks its own head, with one cleanup after replacement",async t=>{
  const f = await fixture(t,false);
  const { RECENT_UPLOAD, storePicture } = await import("../packages/board-room/src/pictures.ts");
  const { empty } = await import("../packages/board-rules/src/document.ts");
  const a = gif(15,1), b = gif(15,2), extra = gif(15,3);
  const board = {...empty(),title:"Pictures",boardId:f.board,pages:[{id:f.board,name:"Page 1"}]};
  board.objects = [image(board,digest(a))];
  storePicture(f.s,board,f.env.now(),digest(a),a,"image/gif",2,3);
  await f.room.create(board);
  const initial = (await f.room.versions(f.person)).versions[0];
  await f.put(b); await f.put(extra);
  f.room.board = {...board,objects:[{...board.objects[0],asset:digest(b)}]};
  f.advance(RECENT_UPLOAD+1);
  const exec = f.s.exec.bind(f.s), operations=[];
  f.s.exec = (sql,...args) => {
    if (sql.startsWith("UPDATE pictures SET captured_ordinal")) operations.push(["mark",...args]);
    if (sql.startsWith("DELETE FROM picture_parts WHERE NOT EXISTS")) operations.push(["cleanup"]);
    return exec(sql,...args);
  };
  const {head} = await f.room.versions(f.person);
  await f.room.restoreVersion(f.person,initial.id,{requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});
  const [restored,before] = (await f.room.versions(f.person)).versions;
  assert.equal(restored.reason,"restored"); assert.equal(before.reason,"before_restore");
  assert.deepEqual(operations,[["mark",before.ordinal,digest(b)],["mark",restored.ordinal,digest(a)],["cleanup"]]);
  assert(await f.get(digest(a))); assert(await f.get(digest(b))); assert.equal(await f.get(digest(extra)),null);

  // Simulate a backward clock across captures. Prune the middle ordinal first.
  f.s.exec("UPDATE versions SET captured_at=0 WHERE id=?",before.id);
  await f.room.history.automatic("last_close");
  assert.deepEqual((await f.room.versions(f.person)).versions.map(v=>v.ordinal),[restored.ordinal,initial.ordinal]);
  assert(await f.get(digest(b)));
  f.s.exec("UPDATE versions SET captured_at=0 WHERE id=?",initial.id);
  await f.room.history.automatic("last_close");
  assert.equal(await f.get(digest(b)),null); assert(await f.get(digest(a)));
});
test("X7-U29 raw Worker room calls preserve bytes, caller, access errors and the empty response",async t=>{
  const {workerRuntime} = await import("../apps/server/src/worker-runtime.ts");
  const {WorkerRoom} = await import("../apps/server/src/worker-room.ts");
  const f = await fixture(t), endpoint = new WorkerRoom({},{}), requests=[];
  endpoint.room = f.room;
  const binding = { idFromName: id => id, get: id => ({ async fetch(url, init) {
    assert.equal(id,f.board);
    const req = new Request(url,init);
    req.json = () => assert.fail("picture request was parsed as JSON");
    requests.push(req);
    return endpoint.fetch(req);
  } }) };
  const runtime = workerRuntime({ROOMS:binding,SUPABASE_SERVICE_KEY:"synthetic",JWKS:'{"keys":[]}',SUPABASE_URL:"https://board.example"});
  const client = runtime.room(f.board), person={...f.person,email:"é@example.test"}, data=gif(1048577,7), hash=digest(data);
  assert.equal(runtime.backupLimit,16777216);
  assert.equal(await client.readPicture(person,hash),null);
  assert.equal(await client.storePicture(person,hash,data,"image/gif",2,3),"created");
  const upload = requests.at(-1);
  assert.equal(new URL(upload.url).pathname,"/picture-store");
  assert.deepEqual(JSON.parse(Buffer.from(upload.headers.get("x-person"),"base64url").toString()),person);
  assert.deepEqual((await client.readPicture(person,hash)).bytes,data);
  assert.deepEqual(f.s.all("SELECT length(data) AS n FROM picture_parts ORDER BY part").map(row=>row.n),[1048576,1]);
  f.env.access.role = async () => "viewer";
  const viewer={...person,id:randomUUID()};
  await assert.rejects(client.storePicture(viewer,hash,data,"image/gif",2,3),e=>e.status===403 && e.needed==="editor");
  f.env.access.role = async () => null;
  await assert.rejects(client.readPicture({...person,id:randomUUID()},hash),e=>e.status===404);
});
