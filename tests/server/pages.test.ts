// SPDX-License-Identifier: Apache-2.0
// 0010-W2 server checks S411–S416 on both runners. Subjects load dynamically
// inside each check, so a missing feature fails its check by name.
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
const context = inject<Context>("board"), runner = inject<string>("runner");
let driver: Driver, f: any, pass = 0, fail = 0;
const peers: Peer[] = [], docs: Y.Doc[] = [];
beforeAll(async () => { driver = await makeDriver(context); });
afterEach(async () => { for (const p of peers.splice(0)) await p.close(); for (const doc of docs.splice(0)) doc.destroy(); });
afterAll(async () => { await driver.close(); console.log("SUMMARY-PAGES " + JSON.stringify({ runner, checks: pass + fail, pass, fail })); });
const modules = async () => ({
  pages: await import("../../apps/web/src/pages.ts"),
  rules: await import("../../packages/board-rules/src/document.ts"),
  tape: await import("../../apps/web/src/tape.ts"),
  registry: await import("../../packages/board-rules/src/objects/registry.ts"),
  adapter: await import("../../packages/board-sync/src/document-adapter.ts"),
  codec: await import("../../packages/board-sync/src/codec.ts"),
  session: await import("../../packages/board-sync/src/session.ts"),
});
async function helper(action: string, value: unknown = {}): Promise<any> {
  const r = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  assert.equal(r.status, 200, await r.clone().text()); return r.json();
}
async function req(path: string, name = "owner", method = "GET", body?: unknown) {
  return driver.request(path, { method, headers: { Authorization: "Bearer " + f.people[name].token, Origin: context.origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function ok(path: string, name = "owner", method = "GET", body?: unknown, status = 200): Promise<any> {
  const r = await req(path, name, method, body); assert.equal(r.status, status, await r.clone().text()); return status === 204 ? null : r.json();
}
const exported = async (board = f.a) => JSON.parse(await (await req(`/boards/${board}/export`)).text());
const rows = (table: string, board = f.a) => driver.rows(board, table);
const versions = (board = f.a) => ok(`/boards/${board}/versions`);
const sql = (items: { sql: string; bindings?: unknown[] }[], board = f.a) => driver.control({ board, roomSQL: items });
const hex = (bytes: Uint8Array) => "x'" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "'";
async function sha256(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join(""); }
async function until<T>(read: () => T | Promise<T>, predicate = (v: T) => !!v): Promise<T> {
  const end = Date.now() + 10000; let result: T;
  do { result = await read(); if (predicate(result)) return result; await new Promise((r) => setTimeout(r, 10)); } while (Date.now() < end);
  assert.fail("Condition timed out " + JSON.stringify(result));
}
async function join(name = "editor", board = f.a) {
  const { session } = await modules();
  const ticket = await ok(`/boards/${board}/join-tickets`, name, "POST", undefined, 201), p = await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`);
  peers.push(p); const joined = await p.next("joined"), doc = new Y.Doc(); docs.push(doc); Y.applyUpdate(doc, session.decode(joined.update));
  await until(() => p.messages.some((m) => m.kind === "comments_snapshot" && m.done));
  return { p, joined, doc };
}
type Client = Awaited<ReturnType<typeof join>>;
// Writes a whole-board change through an adapter bound to the client's document.
async function send(c: Client, change: (board: any) => any, raw?: (doc: Y.Doc) => void) {
  const { adapter, codec, session } = await modules();
  const vector = Y.encodeStateVector(c.doc);
  if (raw) raw(c.doc);
  else { const a = new adapter.Adapter(); a.doc.destroy(); a.doc = c.doc; a.set(change(codec.readBoard(c.doc))); }
  const id = crypto.randomUUID();
  c.p.send({ kind: "edit", epoch: c.joined.epoch, requestId: id, update: session.encode(Y.encodeStateAsUpdate(c.doc, vector)), restoreGeneration: c.joined.restoreGeneration });
  return id;
}
async function answer(c: Client, id: string) {
  const { session } = await modules();
  const result = await until(() => c.p.messages.find((m) => m.requestId === id && ["saved", "refused"].includes(m.kind)));
  if (result!.kind === "saved" && result!.update) Y.applyUpdate(c.doc, session.decode(result!.update));
  return result!;
}
const check = (id: number, name: string, run: () => Promise<void>) => test(`S${id} ${name}`, async () => {
  try { f = await helper("removal-fixture"); await run(); pass++; console.log(`PASS: S${id} ${name}`); }
  catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
});
async function seedStored(board: any) {
  const {rules}=await modules(),{storedBoardUpdate}=await import('../import-fixture.mjs');
  board={...board,boardId:f.a};
  const json=new TextEncoder().encode(rules.canonical(board)),yjs=storedBoardUpdate(board);
  const head=(await versions()).head;
  const writes:any[]=[{sql:'DELETE FROM snapshot_chunks'},{sql:'DELETE FROM edits'}];
  // Hex doubles the SQL text; 32 KiB rows stay below workerd's statement limit.
  // Stored readers concatenate ordered chunks and allow rows smaller than 1 MiB.
  const chunkBytes=32768;
  for(const [kind,data]of [['json',json],['yjs',yjs]] as const)for(let at=0,index=0;at<data.length;at+=chunkBytes,index++)
    writes.push({sql:`INSERT INTO snapshot_chunks VALUES (?, ?, ?, ${hex(data.slice(at,at+chunkBytes))})`,bindings:[head.revision,kind,index]});
  for(const o of board.objects)writes.push({sql:'INSERT OR IGNORE INTO identifiers VALUES (?, ?, 0)',bindings:[o.id,o.generation]});
  writes.push({sql:"UPDATE meta SET value = ? WHERE key = 'history_capture_sha256'",bindings:[await sha256(json)]},
    {sql:"UPDATE meta SET value = ? WHERE key = 'history_capture_bytes'",bindings:[json.length]});
  await sql(writes);await driver.wake(f.a);return board;
}
check(411,'new hosted boards have version 13 and exactly the default page',async()=>{
  const b=await exported();assert.equal(b.schemaVersion,18);assert.deepEqual(b.pages,[{id:f.a,name:'Page 1'}]);assert.deepEqual(b.objects,[]);
});
check(412,'stored 11 and 12 including maximum payload upgrade without an edit receipt revision or history version',async()=>{
  const {rules}=await modules(),{sizedBoard,withoutPages}=await import('../import-fixture.mjs');
  await versions();const count=(await versions()).versions.length;
  for(const old of [{...withoutPages(rules.add({...rules.empty(),title:'Stored 11'},'sticky',0,0)),schemaVersion:11},
    {...withoutPages(rules.add({...rules.empty(),title:'Stored 12'},'sticky',0,0)),schemaVersion:12},sizedBoard(2097152,12)]){
    const before=(await versions()).head,receipts=await rows('receipts');const stored=await seedStored(old),served=await exported();
    assert.equal(served.schemaVersion,18);assert.deepEqual(served.pages,[{id:f.a,name:'Page 1'}]);assert(served.objects.every((o:any)=>o.page===f.a));
    assert.deepEqual(served.objects.map(({page,...o}:any)=>o),stored.objects);assert.deepEqual(await rows('edits'),[]);assert.deepEqual(await rows('receipts'),receipts);
    assert.deepEqual((await versions()).head,before);assert.equal((await versions()).versions.length,count);
    await driver.wake(f.a);assert.equal((await exported()).schemaVersion,18);
  }
});
check(413,'page additions renames reorder deletes and existing object page changes save; missing page refuses',async()=>{
  const {rules,pages}=await modules();
  for(const mutate of [(b:any)=>pages.addPage(b).board,(b:any)=>pages.renamePage(b,b.pages[0].id,'Renamed'),
    (b:any)=>pages.movePage(b,b.pages[1].id,0),(b:any)=>pages.moveToPage(b,new Set([b.objects[0].id]),b.pages[1].id).board,
    (b:any)=>pages.deletePage(b,b.pages[1].id,b.pages[0].id).board]){
    const c=await join(),board=await exported();let base=board;if(base.pages.length<2)base=pages.addPage(base).board;if(!base.objects.length)base=rules.add(base,'sticky',0,0,base.pages[0].id);
    assert.equal((await answer(c,await send(c,()=>base))).kind,'saved');assert.equal((await answer(c,await send(c,mutate))).kind,'saved');await c.p.close();
  }
  const c=await join();if(!(await exported()).objects.length)assert.equal((await answer(c,await send(c,b=>rules.add(b,'sticky',0,0,b.pages[0].id)))).kind,'saved');
  assert.equal((await answer(c,await send(c,b=>({...b,objects:b.objects.map(o=>({...o,page:crypto.randomUUID()}))})))).reason,'invalid_document');
});
check(414,'create/import accept two pages and refuse 51 pages, missing object pages and version 12',async()=>{
  const {rules,pages}=await modules(),{withoutPages}=await import('../import-fixture.mjs');const b={...rules.empty(),title:'Import'},two=pages.addPage(b).board;
  for(const document of [b,two]){const accepted=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:b.title,document},201);assert.deepEqual((await exported(accepted.id)).pages,document.pages);}
  for(const document of [{...b,pages:Array.from({length:51},()=>({id:crypto.randomUUID(),name:'P'}))},
    {...rules.add(b,'sticky',0,0),objects:rules.add(b,'sticky',0,0).objects.map(o=>({...o,page:crypto.randomUUID()}))},{...withoutPages(b),schemaVersion:12}]){
    const response=await req(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:b.title,document});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{reason:'invalid_document'}});
  }
});
check(415,'stored version 12 history restores as 13 and a current snapshot round trips',async()=>{
  const {rules}=await modules(),initial=(await versions()).versions[0],old={schemaVersion:12 as const,boardId:f.a,title:'Stored history',objects:[],retiredGenerations:[]};
  const json=new TextEncoder().encode(rules.canonical(old));await sql([{sql:'DELETE FROM version_chunks WHERE version_id=?',bindings:[initial.id]},
    {sql:`INSERT INTO version_chunks VALUES (?,0,${hex(json)})`,bindings:[initial.id]}]);
  const restore=async(id:string)=>{const head=(await versions()).head;return ok(`/boards/${f.a}/versions/${id}/restore`,'owner','POST',{requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});};
  await restore(initial.id);let b=await exported();assert.equal(b.schemaVersion,18);assert.deepEqual(b.pages,[{id:f.a,name:'Page 1'}]);assert.equal(b.title,old.title);
  const saved=await ok(`/boards/${f.a}/versions`,'owner','POST',{requestId:crypto.randomUUID(),name:'Current',description:''});await restore(saved.version.id);assert.deepEqual(await exported(),b);
});
check(416,'templates refuse stored page fields and insert valid version 13 objects',async()=>{
  const {rules}=await modules(),{buildSnapshot}=await import('../../apps/web/src/clipboard.ts'),{templateObjects}=await import('../../apps/server/src/templates.ts'),
    {templateBoard}=await import('../../apps/web/src/team/templates-rules.ts'),{insertActivity}=await import('../../apps/web/src/activities.ts');
  const b=rules.add({...rules.empty(),title:'Template'},'sticky',0,0),objects=buildSnapshot(b,new Set(b.objects.map(o=>o.id)),b.objects.map(o=>({...o,displayHeight:'height'in o?o.height:0})))!.objects;
  assert.throws(()=>templateObjects([{...objects[0],page:b.boardId}]),(e:any)=>e.message==='bad_request');
  const response=await req(`/workspaces/${f.workspace}/templates`,'owner','POST',{name:'Invalid',description:'',sourceBoard:f.a,objects:[{...objects[0],page:b.boardId}]});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{reason:'bad_request'}});
  const next=insertActivity(await exported(),templateBoard(objects),{x:0,y:0,z:1},{w:1440,h:900},f.a).board;rules.validate(next);assert(next.objects.every(o=>o.page===f.a));
});
