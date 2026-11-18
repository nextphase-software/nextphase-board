// SPDX-License-Identifier: Apache-2.0
// 0010-W3 server checks S417–S424 on both runners. Subjects load dynamically
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
afterEach(async () => {
  try { for (const p of peers.splice(0)) await p.close(); for (const doc of docs.splice(0)) doc.destroy(); }
  finally { await driver.control({ fixedNow: null, offset: 0 }); }
});
afterAll(async () => { await driver.close(); console.log("SUMMARY-TEAM-PAGES " + JSON.stringify({ runner, checks: pass + fail, pass, fail })); });
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
async function send(c: Client, change: (board: any) => any, raw?: (doc: Y.Doc) => void, moved?: string[]) {
  const { adapter, codec, session } = await modules();
  const vector = Y.encodeStateVector(c.doc);
  if (raw) raw(c.doc);
  else { const a = new adapter.Adapter(); a.doc.destroy(); a.doc = c.doc; a.set(change(codec.readBoard(c.doc)), moved); }
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
  try { await driver.control({ fixedNow: null, offset: 0 }); f = await helper("removal-fixture"); await run(); pass++; console.log(`PASS: S${id} ${name}`); }
  catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
});
async function seed() {
  const {pages,rules}=await modules(),c=await join();let b=await exported();
  b={...b,pages:[{id:b.boardId,name:'Agenda'}],objects:[],retiredGenerations:[...new Set([...b.retiredGenerations,...b.objects.map(o=>o.generation)])].sort()};
  b=pages.addPage(b).board;b=pages.renamePage(b,b.pages[1].id,'Ideas');b=pages.addPage(b).board;b=pages.renamePage(b,b.pages[2].id,'Retro');
  for(const page of b.pages)b=rules.add(b,'sticky',0,0,page.id);
  assert.equal((await answer(c,await send(c,()=>b))).kind,'saved');return b;
}
check(417,'three-page create/import retains order; 51 pages and missing page refuse',async()=>{
  const {rules,pages}=await modules();let b={...rules.empty(),title:'Team pages'};for(let n=0;n<2;n++)b=pages.addPage(b).board;
  const row=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:b.title,document:b},201);assert.deepEqual((await exported(row.id)).pages,b.pages);
  const c=await join();assert.equal((await answer(c,await send(c,()=>({...b,boardId:f.a})))).kind,'saved');assert.deepEqual((await exported()).pages,b.pages);
  for(const document of [{...b,pages:Array.from({length:51},()=>({id:crypto.randomUUID(),name:'P'}))}, {...rules.add(b,'sticky',0,0,b.pages[0].id),objects:rules.add(b,'sticky',0,0,b.pages[0].id).objects.map(o=>({...o,page:crypto.randomUUID()}))}]){
    const r=await req(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:b.title,document});assert.equal(r.status,400);assert.equal((await r.json() as any).error.reason,'invalid_document');
  }
});
check(418,'editor page steps relay to a second editor; every viewer page step refuses role_too_low',async()=>{
  const b=await seed(),{pages}=await modules(),other=await join('owner');
  const changes=[(x:any)=>pages.addPage(x).board,(x:any)=>pages.renamePage(x,x.pages[1].id,'New'),(x:any)=>pages.movePage(x,x.pages[1].id,0),
    (x:any)=>pages.moveToPage(x,new Set([x.objects[1].id]),x.pages[0].id).board,(x:any)=>pages.deletePage(x,x.pages[1].id,x.pages[0].id).board];
  for(const mutate of changes){const c=await join();const revision=(await answer(c,await send(c,mutate))).revision;assert(revision);await until(()=>other.p.messages.find(m=>m.kind==='update'&&m.revision===revision));await c.p.close();}
  for(const mutate of changes){const c=await join('viewer'),id=await send(c,()=>mutate(b));assert.equal((await answer(c,id)).reason,'role_too_low');await c.p.close();}
});
check(419,'all six concurrent page cases merge in both arrival orders',async()=>{
  const {pages,rules,adapter,session}=await modules();
  for(const mode of ['adds','renames','rename-delete','same-gap','delete-object','move-rename'])for(const reverse of [false,true]){
    const b=await seed(),a=await join(),c=await join('owner');
    const messages=[a,c].map((client,i)=>{
      let next=b,moved:string[]|undefined;
      if(mode==='adds'||mode==='same-gap'){const r=pages.addPage(b);next=mode==='same-gap'?pages.movePage(r.board,r.page.id,1):r.board;moved=[r.page.id];}
      if(mode==='renames')next=pages.renamePage(b,b.pages[i].id,'Name '+i);
      if(mode==='rename-delete')next=i?pages.deletePage(b,b.pages[1].id,b.boardId).board:pages.renamePage(b,b.pages[1].id,'Gone');
      if(mode==='delete-object')next=i?rules.add(b,'sticky',200,200,b.pages[1].id):pages.deletePage(b,b.pages[1].id,b.boardId).board;
      if(mode==='move-rename'){next=i?pages.renamePage(b,b.pages[1].id,'Changed'):pages.movePage(b,b.pages[2].id,0);moved=i?undefined:[b.pages[2].id];}
      const v=Y.encodeStateVector(client.doc),ad=new adapter.Adapter();ad.doc.destroy();ad.doc=client.doc;ad.set(next,moved);
      return {kind:'edit',requestId:crypto.randomUUID(),epoch:client.joined.epoch,restoreGeneration:client.joined.restoreGeneration,update:session.encode(Y.encodeStateAsUpdate(client.doc,v))};
    });
    const results=[];for(const i of reverse?[1,0]:[0,1]){const client=[a,c][i];client.p.send(messages[i]);results.push(await answer(client,messages[i].requestId));}
    if(mode==='delete-object')assert.equal(results[1].reason,'invalid_document');else assert(results.every(r=>r.kind==='saved'),JSON.stringify(results));
    const out=await exported();rules.validate(out);
    if(mode==='adds'||mode==='same-gap'){assert.equal(out.pages.length,5);if(mode==='same-gap')assert(out.pages[1].id<out.pages[2].id);}
    if(mode==='renames'){assert.equal(out.pages[0].name,'Name 0');assert.equal(out.pages[1].name,'Name 1');}
    if(mode==='rename-delete')assert(!out.pages.some(p=>p.id===b.pages[1].id));
    if(mode==='move-rename'){assert.equal(out.pages[0].id,b.pages[2].id);assert.equal(out.pages.find(p=>p.id===b.pages[1].id).name,'Changed');}
    await a.p.close();await c.p.close();
  }
});
async function legacySeed(b:any) {
  const {storedBoardUpdate,version13Board}=await import('../import-fixture.mjs'),{rules}=await modules(),revision=(await versions()).head.revision;
  const writes:any[]=[{sql:'DELETE FROM snapshot_chunks'},{sql:'DELETE FROM edits'}];
  for(const [kind,data]of [['json',new TextEncoder().encode(rules.canonical(version13Board(b)))],['yjs',storedBoardUpdate(version13Board(b),true)]] as const)for(let at=0,index=0;at<data.length;at+=32768,index++)writes.push({sql:`INSERT INTO snapshot_chunks VALUES (?,?,?,${hex(data.slice(at,at+32768))})`,bindings:[revision,kind,index]});
  writes.push({sql:"UPDATE meta SET value=7 WHERE key='storage_version'"}, {sql:'DROP TABLE workshop_vote'},
    {sql:'CREATE TABLE workshop_vote (singleton INTEGER PRIMARY KEY,status TEXT,session_id TEXT,session_version INTEGER,prompt TEXT,budget INTEGER,targets TEXT,totals TEXT)'},
    {sql:"INSERT INTO workshop_vote VALUES (1,'running',?,1,'Legacy vote',3,?,NULL)",bindings:[crypto.randomUUID(),JSON.stringify([[b.objects[0].id,b.objects[0].generation,0]])]});
  await sql(writes);await driver.wake(f.a);
}
check(420,'storage-7 old shared map and vote convert once without edit metadata',async()=>{
  const b=await seed(),before=await versions(),receipts=await rows('receipts');await legacySeed(b);
  const c=await join(),{codec}=await modules();assert.deepEqual(codec.readBoard(c.doc),await exported());assert(!c.doc.getMap('board').has('pages'));assert(c.doc.getMap('board')._map.has('pages'));
  assert.equal((await rows('meta')).find(r=>r.key==='storage_version').value,8);assert.equal((await rows('workshop_vote'))[0].status,'idle');assert.deepEqual(await rows('workshop_vote_ballots'),[]);assert.deepEqual(await rows('edits'),[]);assert.deepEqual(await rows('receipts'),receipts);assert.deepEqual(await versions(),before);
  await driver.wake(f.a);assert.deepEqual((await exported()).pages,b.pages);
  const fresh=await join();assert.equal((await answer(fresh,await send(fresh,x=>x,d=>d.getMap('board').set('pages',b.pages)))).reason,'invalid_update');
});
check(421,'six-key presence relay, refusals, stale-page drop and voting redaction keep page',async()=>{
  const b=await seed(),a=await join(),other=await join('owner'),page=b.pages[1].id,connection=a.joined.self.connection;
  const p={kind:'presence',cursor:{x:1,y:2},selection:[b.objects[1].id],view:{x:0,y:0,width:100,height:100},active:true,page};a.p.send(p);await until(()=>other.p.messages.findLast(m=>m.kind==='present'&&m.connection===connection&&m.page===page));
  for(const value of [(()=>{const {page,...missing}=p;return missing;})(),{...p,extra:1},{...p,page:'bad'}]){const n=a.p.messages.length;a.p.send(value);const r=await until(()=>a.p.messages.slice(n).find(m=>m.kind==='refused'));assert.equal(r.reason,'extra'in value?'presence_fields':'bad_presence');}
  const n=other.p.messages.length;a.p.send({...p,page:crypto.randomUUID()});await driver.control({board:f.a,settled:true});assert.equal(other.p.messages.slice(n).filter(m=>m.kind==='present'&&m.connection===connection).length,0);
  a.p.send({kind:'vote_command',requestId:crypto.randomUUID(),epoch:a.joined.epoch,restoreGeneration:a.joined.restoreGeneration,sessionId:null,expectedSessionVersion:0,action:'start',prompt:'Choose',budget:3,page});await a.p.next('vote_result');
  await driver.control({fixedNow:Date.now()+2000});const count=other.p.messages.length;a.p.send(p);const redacted=await until(()=>other.p.messages.slice(count).find(m=>m.kind==='present'&&m.connection===connection));assert.equal(redacted.page,page);assert.equal(redacted.cursor,null);assert.deepEqual(redacted.selection,[]);
});
async function comment(c:Client,anchor:any) {
  const requestId=crypto.randomUUID(),op={action:'start',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),anchor,text:'Synthetic comment'};
  c.p.send({kind:'comment',requestId,epoch:c.joined.epoch,restoreGeneration:c.joined.restoreGeneration,operation:op});const result=await until(()=>c.p.messages.find(m=>m.requestId===requestId&&m.kind.startsWith('comment_')));return {op,result};
}
check(422,'comment pages validate, follow objects and publish every deleted-page anchor with its last name',async()=>{
  const b=await seed(),c=await join(),page=b.pages[1].id,point={objectId:null,x:20,y:20,u:0,v:0};
  for(const anchor of [point,{...point,page:crypto.randomUUID()},{...point,page,objectId:b.objects[0].id}])assert.equal((await comment(c,anchor)).result.reason,'bad_anchor');
  const a=await comment(c,{...point,page}),attached=await comment(c,{...point,page,objectId:b.objects[1].id});assert.equal(a.result.kind,'comment_saved');
  let rowsNow=await rows('threads');assert.equal(JSON.parse(String(rowsNow[0].anchor)).pageName,'Ideas');
  const {pages}=await modules();assert.equal((await answer(c,await send(c,x=>pages.moveToPage(x,new Set([b.objects[1].id]),b.boardId).board))).kind,'saved');
  assert.equal(JSON.parse(String((await rows('threads')).find(r=>r.id===attached.op.threadId).anchor)).page,b.boardId);
  await answer(c,await send(c,x=>pages.renamePage(x,page,'Ideas 2')));const count=c.p.messages.length;await answer(c,await send(c,x=>pages.deletePage(x,page,b.boardId).board));
  const changed=c.p.messages.slice(count).find(m=>m.kind==='comment_changed'&&m.threadId===a.op.threadId);assert(changed);assert.equal(changed.thread.anchor.pageName,'Ideas 2');assert.equal(changed.thread.anchor.page,page);
  const stored=JSON.parse(String((await rows('threads')).find(r=>r.id===attached.op.threadId).anchor));delete stored.page;delete stored.pageName;await sql([{sql:'UPDATE threads SET anchor=? WHERE id=?',bindings:[JSON.stringify(stored),attached.op.threadId]}]);
  const fresh=await join();const legacy=fresh.p.messages.find(m=>m.thread?.id===attached.op.threadId);assert.equal(legacy.thread.anchor.page,(await exported()).pages[0].id);
});
check(423,'vote targets belong to start page, moves refund and deleting page leaves running empty round',async()=>{
  const b=await seed(),c=await join(),page=b.pages[1].id,{pages}=await modules();let requestId=crypto.randomUUID();
  const start=(target:string)=>({kind:'vote_command',requestId:crypto.randomUUID(),epoch:c.joined.epoch,restoreGeneration:c.joined.restoreGeneration,sessionId:null,expectedSessionVersion:0,action:'start',prompt:'Choose',budget:3,page:target});
  const invalid=start(crypto.randomUUID());c.p.send(invalid);assert.equal((await until(()=>c.p.messages.find(m=>m.requestId===invalid.requestId))).reason,'vote_ineligible');
  const valid=start(page);c.p.send(valid);const result=await until(()=>c.p.messages.find(m=>m.requestId===valid.requestId));assert.equal(result.voting.session.page,page);assert.deepEqual(result.voting.session.targets.map(t=>t[0]),[b.objects[1].id]);
  await until(()=>c.p.messages.find(m=>m.kind==='vote_state'&&m.voting.session.page===page));
  const s=result.voting.session;requestId=crypto.randomUUID();c.p.send({kind:'vote_command',requestId,epoch:c.joined.epoch,restoreGeneration:c.joined.restoreGeneration,sessionId:s.sessionId,expectedSessionVersion:s.sessionVersion,action:'vote',objectId:b.objects[1].id,objectGeneration:b.objects[1].generation,expectedBallotVersion:0});await until(()=>c.p.messages.find(m=>m.requestId===requestId));
  await answer(c,await send(c,x=>pages.moveToPage(x,new Set([b.objects[1].id]),b.boardId).board));assert.equal(JSON.parse(String((await rows('workshop_vote'))[0].targets)).length,0);assert.deepEqual(JSON.parse(String((await rows('workshop_vote_ballots'))[0].targets)),[]);
  await answer(c,await send(c,x=>pages.deletePage(x,page,b.boardId).board));assert.equal((await rows('workshop_vote'))[0].status,'running');
});
check(424,'history and backups retain all pages; storage-7 backup upgrades and 6/9 refuse',async()=>{
  const b=await seed(),saved=await ok(`/boards/${f.a}/versions`,'owner','POST',{requestId:crypto.randomUUID(),name:'Three pages',description:''});
  const c=await join(),{pages,rules}=await modules();await answer(c,await send(c,x=>pages.renamePage(x,x.pages[1].id,'Changed')));
  const head=(await versions()).head;await ok(`/boards/${f.a}/versions/${saved.version.id}/restore`,'owner','POST',{requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});assert.deepEqual((await exported()).pages,b.pages);
  const operator=async(action:string,value?:unknown)=>driver.request(`/operator/boards/${f.a}/${action}`,{method:'POST',headers:{'Board-Operator-Key':context.operatorKey,'Content-Type':'application/json'},...(value?{body:JSON.stringify(value)}:{})});
  const backup=await (await operator('backup')).json() as any;assert.equal(backup.tables.meta.find(r=>r.key==='storage_version').value,8);assert.equal((await operator('restore',backup)).status,200);await exported();
  const legacy=structuredClone(backup),{storedBoardUpdate,version13Board}=await import('../import-fixture.mjs');legacy.tables.meta.find(r=>r.key==='storage_version').value=7;
  const rev=legacy.tables.meta.find(r=>r.key==='revision').value;legacy.tables.snapshot_chunks=[];
  for(const [kind,data]of [['json',new TextEncoder().encode(rules.canonical(version13Board(await exported())))],['yjs',storedBoardUpdate(version13Board(await exported()),true)]] as const)for(let at=0,index=0;at<data.length;at+=32768,index++)legacy.tables.snapshot_chunks.push({snapshot_revision:rev,kind,chunk_index:index,bytes:Buffer.from(data.slice(at,at+32768)).toString('base64')});
  legacy.tables.edits=[];assert.equal((await operator('restore',legacy)).status,200);assert.deepEqual((await exported()).pages,b.pages);assert.equal((await rows('meta')).find(r=>r.key==='storage_version').value,8);
  for(const version of [6,9]){const invalid=structuredClone(backup);invalid.tables.meta.find(r=>r.key==='storage_version').value=version;assert.equal((await operator('restore',invalid)).status,400);}
});
