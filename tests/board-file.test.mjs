// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, canonical, empty, upgrade } from "../apps/web/src/document.ts";
import { createConnector } from "../apps/web/src/connectors.ts";
import { digest } from "../apps/web/src/storage.ts";
import { boardFileName, FILE_LIMIT, readBoardFile, writeBoardFile } from "../apps/web/src/board-file.ts";

const file = (raw) => {
  const bytes = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;
  return { size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};
const envelope = async (payload, changes = {}) => JSON.stringify({ format: "nextphase-board", fileVersion: 1, payload, sha256: await digest(payload), ...changes });
function versionBoard(version) {
  let board = { ...empty(), title: "Synthetic 你好 🧭" };
  board = add(add(board, "sticky", 0, 0), "text", 400, 0);
  board.objects[0].text = "Formatted\n你好 🧭";
  board.retiredGenerations = [crypto.randomUUID(), crypto.randomUUID()].sort();
  if (version >= 3) {
    const group = crypto.randomUUID(); board.objects.forEach((o) => { o.group = group; });
  }
  if (version >= 4) board.objects[0].marks = [{ start: 0, end: 3, bold: true, italic: true, strike: true }];
  if (version >= 5) {
    board = add(board, "section", 0, 0);
    board.objects.slice(0, 2).forEach((o) => { o.section = board.objects[2].id; });
  }
  if (version >= 6) {
    board = add(board, "shape", 800, 0);
    board.objects.at(-1).shape = "circle";
  }
  if (version >= 7) board = createConnector(board, board.objects[0].id, board.objects[1].id).board;
  return { ...board, schemaVersion: version, objects: board.objects.map((object) => {
    const o = { ...object };
    if (version < 9) for (const key of ["lineColor", "lineWeight", "lineDash", "startHead", "endHead", "lineShape"]) delete o[key];
    if (version < 2) { delete o.color; delete o.textSize; delete o.align; }
    if (version < 3) delete o.group;
    if (version < 4) delete o.marks;
    if (version < 5) delete o.section;
    return o;
  }) };
}
for (let version = 1; version <= 10; version++) test(`version ${version} file round-trip preserves exact payload and identities`, async () => {
  const board = versionBoard(version), before = structuredClone(board), payload = canonical(board);
  const raw = await writeBoardFile(board), parsed = JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed), ["format", "fileVersion", "payload", "sha256"]);
  assert.equal(parsed.fileVersion, 2);
  assert.deepEqual(JSON.parse(parsed.payload), { document: payload, assets: [] }); assert.equal(parsed.sha256, await digest(parsed.payload));
  assert.equal(raw, JSON.stringify(parsed));
  const restored = await readBoardFile(file(raw));
  assert.deepEqual(restored, board); assert.equal(canonical(restored), payload); assert.deepEqual(board, before);
  const shown = upgrade(board);
  assert.equal(JSON.parse(JSON.parse(await writeBoardFile(shown, board)).payload).document, payload);
  const edited = { ...shown, title: "Edited unsaved title" };
  assert.equal(JSON.parse(JSON.parse(await writeBoardFile(edited)).payload).document, canonical(edited));
  assert.equal(JSON.parse(JSON.parse(JSON.parse(await writeBoardFile(edited)).payload).document).schemaVersion, 10);
});

test("ordered file checks refuse each malformed input with its exact first reason", async () => {
  const payload = canonical(versionBoard(7)), good = await envelope(payload), e = JSON.parse(good);
  const cases = [
    ["not JSON", "it is not a Board file"],
    ["null", "it is not a Board file"],
    ["[]", "it is not a Board file"],
    [JSON.stringify({ fileVersion: 1, format: e.format, payload, sha256: e.sha256 }), "it is not a Board file"],
    [JSON.stringify({ ...e, extra: 1 }), "it is not a Board file"],
    [JSON.stringify(e, null, 2), "it is not a Board file"],
    ["\ufeff" + good, "it is not a Board file"],
    [new Uint8Array([0xc3, 0x28]), "it is not a Board file"],
    [await envelope(payload, { format: "other" }), "it is not a Board file"],
    [await envelope(payload, { fileVersion: 3 }), "it was made by a newer version of Board"],
    [await envelope(payload, { fileVersion: "1" }), "it is not a Board file"],
    [await envelope(payload, { fileVersion: 0 }), "it is not a Board file"],
    [await envelope(payload, { payload: {} }), "it is not a Board file"],
    [await envelope(payload, { sha256: null }), "it is not a Board file"],
    [await envelope(payload, { sha256: e.sha256.toUpperCase() }), "it is damaged"],
    [await envelope(payload, { sha256: "0".repeat(64) }), "it is damaged"],
    [await envelope("not JSON"), "it is not a valid board"],
    [await envelope(JSON.stringify({ schemaVersion: 11 })), "it was made by a newer version of Board"],
    [await envelope(JSON.stringify({ schemaVersion: 7 })), "it is not a valid board"],
    [await envelope(payload.replace('"title":', '"title" :')), "it is not a valid board"],
    [await envelope(JSON.stringify({ ...versionBoard(1), objects: versionBoard(2).objects })), "it is not a valid board"],
    // Earlier checks take precedence over all later failures.
    [await envelope("bad", { format: "other", fileVersion: 2 }), "it is not a Board file"],
    [await envelope("bad", { fileVersion: 3, sha256: 1 }), "it was made by a newer version of Board"],
    [await envelope("bad", { sha256: "0".repeat(64) }), "it is damaged"],
  ];
  for (const [raw, reason] of cases) await assert.rejects(readBoardFile(file(raw)), { message: reason });
});

test("the byte limit is checked before reading, including the exact boundary", async () => {
  let read = false;
  await assert.rejects(readBoardFile({ size: FILE_LIMIT + 1, arrayBuffer() { read = true; throw Error(); } }), { message: "it is larger than 72 MiB" });
  assert.equal(read, false);
  await assert.rejects(readBoardFile(file(" ".repeat(FILE_LIMIT))), { message: "it is not a Board file" });
  await assert.rejects(readBoardFile(file(" ".repeat(FILE_LIMIT + 1))), { message: "it is larger than 72 MiB" });
});

test("file names replace each forbidden character and keep other Unicode", () => {
  for (const c of '<>:"/\\|?*' + Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join("") + "\x7f") {
    assert.equal(boardFileName(`a${c}b`), "a_b.nextboard");
  }
  for (const suffix of [".", " ", " . .  "]) assert.equal(boardFileName("Board" + suffix), "Board_.nextboard");
  for (const device of ["CON", "PRN", "AUX", "NUL", ...Array.from({ length: 10 }, (_, i) => `COM${i}`), ...Array.from({ length: 10 }, (_, i) => `LPT${i}`)]) {
    for (const name of [device, device.toLowerCase(), device + ".txt", device.toLowerCase() + ".json"]) assert.equal(boardFileName(name), "_" + name + ".nextboard");
  }
  assert.equal(boardFileName(""), "Untitled board.nextboard");
  assert.equal(boardFileName("你好 🧭 café"), "你好 🧭 café.nextboard");
  assert.equal(boardFileName("CONNECTION"), "CONNECTION.nextboard");
});

const { addImages } = await import("../apps/web/src/images.ts");
const { assetKey, pictureHash, pictureBytes, PICTURE_LIMIT } = await import("../apps/web/src/image-assets.ts");
const { readBoardBundle, pictureBase64 } = await import("../apps/web/src/board-file.ts");
const pngBytes=Uint8Array.from([137,80,78,71,13,10,26,10,1]).buffer;
const pictureEntry=async(bytes=pngBytes)=>({hash:await pictureHash(bytes),picture:{bytes,mime:"image/png",pixelWidth:2,pixelHeight:2},width:2,height:2});
const p1=await pictureEntry(),p2=await pictureEntry(Uint8Array.from([137,80,78,71,13,10,26,10,2]).buffer);
const withPictures=(items=[p1,p2,p1])=>addImages({...empty(),title:"Synthetic portable images"},items,{x:0,y:0});
const v2=async(bundle)=>envelope(typeof bundle==="string"?bundle:JSON.stringify(bundle),{fileVersion:2});

test("v2 bundle keeps one sorted entry per distinct picture, exact document and digest over bundle",async()=>{
  const b=withPictures(),cache=new Map([[p1.hash,p1.picture],[p2.hash,p2.picture]]),raw=await writeBoardFile(b,undefined,cache),outer=JSON.parse(raw),bundle=JSON.parse(outer.payload);
  assert.deepEqual(Object.keys(bundle),["document","assets"]); assert.equal(bundle.document,canonical(b));
  assert.equal(outer.sha256,await digest(outer.payload)); assert.deepEqual(bundle.assets.map(p=>p.sha256),[p1.hash,p2.hash].sort());
  for(const entry of bundle.assets){ assert.deepEqual(Object.keys(entry),["sha256","mime","pixelWidth","pixelHeight","base64"]); assert.deepEqual(Buffer.from(entry.base64,"base64"),Buffer.from(cache.get(entry.sha256).bytes)); }
  const read=await readBoardBundle(file(raw)); assert.deepEqual(read.board,b); assert.deepEqual(read.pictures, new Map([...cache].sort(([a],[b])=>a<b?-1:1)));
  assert.deepEqual(await readBoardFile(file(await envelope(canonical(b)))),b);
});

test("v2 ordered bundle/document checks precede picture checks and reject malformed canonical forms",async()=>{
  const b=withPictures(),cache=new Map([[p1.hash,p1.picture],[p2.hash,p2.picture]]),bundle=JSON.parse(JSON.parse(await writeBoardFile(b,undefined,cache)).payload);
  const cases=[
    ["bad","it is damaged"],
    [{assets:[],document:bundle.document},"it is damaged"],
    [{...bundle,extra:1},"it is damaged"],
    [{...bundle,document:3},"it is damaged"],
    [JSON.stringify(bundle,null,2),"it is damaged"],
    [{document:"bad",assets:null},"it is not a valid board"],
    [{document:JSON.stringify({schemaVersion:11}),assets:null},"it was made by a newer version of Board"],
    [{...bundle,document:bundle.document+" "},"it is not a valid board"],
  ];
  for(const [bundle,reason] of cases) await assert.rejects(readBoardBundle(file(await v2(bundle))),{message:reason});
});

test("v2 rejects every damaged picture case: entries, base64, digest, MIME, size, completeness and pixel mismatch",async()=>{
  const b=withPictures(),cache=new Map([[p1.hash,p1.picture],[p2.hash,p2.picture]]),bundle=JSON.parse(JSON.parse(await writeBoardFile(b,undefined,cache)).payload),first=bundle.assets[0];
  const mutateEntry=(changes)=>({...bundle,assets:[{...first,...changes},bundle.assets[1]]});
  const cases=[{...bundle,assets:{}},{...bundle,assets:[...bundle.assets].reverse()},{...bundle,assets:[first,first]},
    {...bundle,assets:[first]}, {...bundle,assets:[]},
    {...bundle,assets:[Object.fromEntries(Object.entries(first).reverse()),bundle.assets[1]]},
    mutateEntry({extra:1}),mutateEntry({sha256:"A".repeat(64)}),mutateEntry({mime:"image/jpeg"}),mutateEntry({pixelWidth:0}),mutateEntry({pixelHeight:4097}),mutateEntry({pixelWidth:3}),
    ...[first.base64+"\n",first.base64.replace(/=+$/,""),"!!!=","A===", "AA=A",pictureBase64(new Uint8Array([1,2,3]).buffer)].map(base64=>mutateEntry({base64})),
    mutateEntry({base64:pictureBase64(Uint8Array.from([137,80,78,71,13,10,26,10,99]).buffer)}),
  ];
  // This buffer's length is divisible by three; test missing padding with one extra byte.
  const padded=await pictureEntry(Uint8Array.from([137,80,78,71,13,10,26,10]).buffer),paddedBoard=withPictures([padded]);
  const paddedBundle=JSON.parse(JSON.parse(await writeBoardFile(paddedBoard,undefined,new Map([[padded.hash,padded.picture]]))).payload);
  paddedBundle.assets[0].base64=paddedBundle.assets[0].base64.replace(/=+$/,""); cases.push(paddedBundle);
  for(const value of cases.filter(value=>JSON.stringify(value)!==JSON.stringify(bundle))) await assert.rejects(readBoardBundle(file(await v2(value))),{message:"it is damaged"});
  const extra=withPictures([p1]),single=JSON.parse(JSON.parse(await writeBoardFile(extra,undefined,cache)).payload); single.assets=bundle.assets;
  await assert.rejects(readBoardBundle(file(await v2(single))),{message:"it is damaged"});
});

test("writing refuses unavailable and mismatched pictures, and total bytes above 50 MiB",async()=>{
  const b=withPictures([p1]);
  for(const cache of [new Map(),new Map([[p1.hash,{...p1.picture,pixelWidth:3}]])]) await assert.rejects(writeBoardFile(b,undefined,cache),{message:"a picture is unavailable"});
  const bytesA=new Uint8Array(30*1024*1024); bytesA.set(new Uint8Array(pngBytes));
  const bytesB=new Uint8Array(21*1024*1024); bytesB.set(new Uint8Array(pngBytes));
  const a=await pictureEntry(bytesA.buffer),c=await pictureEntry(bytesB.buffer),cache=new Map([[a.hash,a.picture],[c.hash,c.picture]]);
  await assert.rejects(writeBoardFile(withPictures([a,c]),undefined,cache),{message:"pictures exceed the 50 MiB board limit"});
});

test("20 MiB picture writes and reads intact; decoded byte overflow fails even when claimed size is small",async()=>{
  const bytes=new Uint8Array(20*1024*1024);bytes.set(new Uint8Array(pngBytes));const p=await pictureEntry(bytes.buffer),b=withPictures([p]);
  const raw=await writeBoardFile(b,undefined,new Map([[p.hash,p.picture]])),restored=await readBoardBundle(file(raw));
  assert.deepEqual(restored.pictures.get(p.hash).bytes,p.picture.bytes);assert.equal(canonical(restored.board),canonical(b));
  await assert.rejects(readBoardBundle({size:1,arrayBuffer:async()=>new ArrayBuffer(FILE_LIMIT+1)}),{message:"it is larger than 72 MiB"});
});

test("v1 image document resolves existing pictures and refuses resolved bytes above 50 MiB",async()=>{
 const b=withPictures([p1]),raw=await envelope(canonical(b));
 assert.deepEqual(await readBoardFile(file(raw),new Map([[p1.hash,p1.picture]])),b);
 await assert.rejects(readBoardFile(file(raw),new Map([[p1.hash,{...p1.picture,bytes:new ArrayBuffer(PICTURE_LIMIT+1)}]])),{message:"its pictures exceed the 50 MiB board limit"});
 assert.deepEqual(await readBoardFile(file(raw),new Map()),b);
});

test("v2 refuses combined pictures above 50 MiB while each entry is valid",async()=>{
 const bytesA=new Uint8Array(26*1024*1024);bytesA.set(new Uint8Array(pngBytes));
 const bytesB=new Uint8Array(25*1024*1024);bytesB.set(new Uint8Array(pngBytes));
 const a=await pictureEntry(bytesA.buffer),b=await pictureEntry(bytesB.buffer),entries=[a,b].sort((a,b)=>a.hash<b.hash?-1:1).map(p=>({sha256:p.hash,mime:p.picture.mime,pixelWidth:2,pixelHeight:2,base64:pictureBase64(p.picture.bytes)}));
 const raw=await v2({document:canonical(withPictures([a,b])),assets:entries});
 assert(new TextEncoder().encode(raw).length<=FILE_LIMIT);
 await assert.rejects(readBoardBundle(file(raw)),{message:"it is damaged"});
});
