// SPDX-License-Identifier: Apache-2.0
import {test,beforeAll,afterAll,afterEach,inject} from 'vitest';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {makeDriver} from 'board-test-driver';
import {Adapter} from '../../packages/board-sync/src/document-adapter.ts';
import {readBoard} from '../../packages/board-sync/src/codec.ts';
import {add,canonical} from '../../packages/board-rules/src/document.ts';
import {encode,decode} from '../../packages/board-sync/src/session.ts';
import type {Context,Driver,Peer} from './driver-types.ts';
declare module 'vitest' { export interface ProvidedContext { board:Context; runner:string; } }
const context=inject('board'),runner=inject('runner');
let driver:Driver,f:any,at=Date.now(),pass=0,fail=0;
const peers:Peer[]=[],docs:Y.Doc[]=[],measure:Record<string,unknown>={};
const sources=['board_role','access_changes_after','lifecycle_value','carry_board_mentions','copy_saved_board'];
beforeAll(async()=>{driver=await makeDriver(context);});
async function resetControls(){
  for(const rpc of sources)await helper('proxy',{rpc,release:rpc,fail:false,failAfter:false,hold:false,holdBefore:false});
  // Node's fence-permission control returns without forwarding other fields to IPC.
  await driver.control({fenceUnreadable:false});
  await driver.control({releaseRoom:true,holdRoom:'',failVoting:'',failTimer:'',failHistory:'',failCheckpoint:'',fixedNow:null});
}
afterEach(async()=>{await resetControls();for(const p of peers.splice(0))await p.close();for(const d of docs.splice(0))d.destroy();});
afterAll(async()=>{await driver.close();console.log('SUMMARY-REACTIONS '+JSON.stringify({runner,checks:pass+fail,pass,fail,measure}));});
async function helper(action:string,value:unknown={}):Promise<any>{const r=await fetch(context.helperUrl+'/'+action,{method:'POST',body:JSON.stringify(value)}),v=await r.json();assert(r.ok,JSON.stringify(v));return v;}
const rpc=(name:string,parameters:unknown)=>helper('rpc',{name,parameters});
async function req(path:string,who='owner',method='GET',body?:unknown){return driver.request(path,{method,headers:{Authorization:'Bearer '+f.people[who].token,Origin:context.origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function ok(path:string,who='owner',method='GET',body?:unknown,status=200):Promise<any>{const r=await req(path,who,method,body);assert.equal(r.status,status,await r.clone().text());return r.json();}
async function until<T>(read:()=>T|Promise<T>,accepts:(v:T)=>boolean=v=>!!v):Promise<NonNullable<T>>{const end=Date.now()+10000;for(;;){const v=await read();if(accepts(v))return v as NonNullable<T>;if(Date.now()>=end)throw Error('Reaction condition timeout');await new Promise(r=>setTimeout(r,10));}}
async function clock(value:number){at=value;await driver.control({fixedNow:at});}
async function advance(ms=1001){await clock(at+ms);}
async function tokens(){for(const p of Object.values(f.people) as any[])p.token=await helper('token',{person:p,options:{now:at,exp:Math.floor(at/1000)+86400}});}
async function join(who='owner',board=f.a){const ticket=await ok(`/boards/${board}/join-tickets`,who,'POST',undefined,201),p=await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`);peers.push(p);const j=await p.next('joined'),doc=new Y.Doc();docs.push(doc);Y.applyUpdate(doc,decode(j.update));assert(!Object.hasOwn(j,'reactions'),'joined has no stored reactions');return {p,j,doc,who};}
type Client=Awaited<ReturnType<typeof join>>;
const projection=(c:Client)=>[...c.p.messages].reverse().find(v=>v.spotlight)?.spotlight;
async function info(extra:any={}){return driver.control({board:f.a,spotlight:extra});}
async function message(c:Client,action:string,extra:any={},pace=true){if(pace)await advance();const s=(await info()).session,own=projection(c)?.own;return {kind:'spotlight_command',requestId:crypto.randomUUID(),epoch:c.j.epoch,restoreGeneration:c.j.restoreGeneration,authorityId:s.authorityId,sessionId:s.sessionId,action,...(['follow','leave'].includes(action)?{expectedMembershipVersion:own?.membershipVersion??0}:{expectedControlVersion:s.controlVersion}),...extra};}
async function answer(c:Client,m:any,raw?:string){c.p.send(raw??m);return until(()=>c.p.messages.find(v=>v.requestId===m.requestId&&['spotlight_result','spotlight_refused','spotlight_snapshot'].includes(v.kind)));}
async function command(c:Client,action:string,extra:any={},pace=true){return answer(c,await message(c,action,extra,pace));}
async function accepted(c:Client,action:string,extra:any={},pace=true){const v=await command(c,action,extra,pace);assert.equal(v.kind,'spotlight_result',JSON.stringify(v));return v;}
async function read(c:Client,pace=true){if(pace)await advance();return answer(c,{kind:'spotlight_read',requestId:crypto.randomUUID(),epoch:c.j.epoch,restoreGeneration:c.j.restoreGeneration});}
async function presence(c:Client){c.p.send({kind:'presence',page:f.a,cursor:{x:42,y:22},selection:[],view:{x:10,y:20,width:800,height:600},active:false});await driver.control({board:f.a,settled:true});}
async function started(){const a=await join(),b=await join('editor'),r=await accepted(a,'start');await presence(a);await until(async()=>{await read(b);return b.p.messages.some(m=>m.kind==='present'&&m.connection===a.j.self.connection&&m.view.width===800);});return {a,b,r};}
async function closedAs(c:Client,code:number){await until(()=>c.p.closed!==null);assert.equal(c.p.closed,code);}
async function write(c:Client,board:any){const adapter=new Adapter();adapter.doc=c.doc;const vector=Y.encodeStateVector(c.doc);adapter.set(board);const m={kind:'edit',requestId:crypto.randomUUID(),epoch:c.j.epoch,restoreGeneration:c.j.restoreGeneration,update:encode(Y.encodeStateAsUpdate(c.doc,vector))};c.p.send(m);const result=await until(()=>c.p.messages.find(v=>v.requestId===m.requestId&&['saved','refused'].includes(v.kind)));assert.equal(result.kind,'saved',JSON.stringify(result));return result;}
async function seed(c:Client,count=4){let b=readBoard(c.doc);for(let i=0;i<count;i++)b=add(b,'sticky',i*260,0);await write(c,b);return b;}
async function operator(action:string,body?:unknown){return driver.request(`/operator/boards/${f.a}/${action}`,{method:'POST',headers:{'Board-Operator-Key':context.operatorKey,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function backup(){const r=await operator('backup');assert.equal(r.status,200,await r.clone().text());return r.json() as Promise<any>;}
async function fresh(){await resetControls();for(const p of peers.splice(0))await p.close();for(const d of docs.splice(0))d.destroy();f=await helper('removal-fixture');await clock(Date.now());await tokens();}
async function vote(c:Client,action='start',extra:any={}){await advance();const row=(await driver.rows(f.a,'workshop_vote'))[0],m={kind:'vote_command',requestId:crypto.randomUUID(),epoch:c.j.epoch,restoreGeneration:c.j.restoreGeneration,sessionId:row.session_id,expectedSessionVersion:row.session_version,action,...(action==='start'?{page:f.a,prompt:'Choose',budget:3}:{}),...extra};c.p.send(m);return until(()=>c.p.messages.find(v=>v.requestId===m.requestId&&v.kind.startsWith('vote_')));}
async function accountState(who:string,action:'disable'|'enable'){
  const response=await driver.request(`/operator/people/${f.people[who].id}/${action}`,{method:'POST',headers:{'Board-Operator-Key':context.operatorKey}});
  assert.equal(response.status,200);const result=await response.json() as any;assert.equal(result.removal,'done');return result;
}
const check=(id:number,name:string,fn:()=>Promise<void>)=>test(`S${id} ${name}`,async()=>{
  try { await import('../../packages/board-sync/src/reactions.ts'); await fresh(); await fn(); pass++; console.log(`PASS: S${id} ${name}`); }
  catch(error){fail++;console.log(`FAIL: S${id} ${name}`);throw error;}
}, id === 377 ? 300000 : undefined);
const reaction=(id='heart',x=42,y=22)=>({kind:'react',reaction:id,x,y});
const bursts=(c:Client)=>c.p.messages.filter(m=>m.kind==='reacted');
const byteLength=(v:any)=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v)).length;
async function reactionInfo(extra:any={}){return driver.control({board:f.a,reactions:extra});}
// A renewal on the same socket is an ordered, independent barrier. It neither
// consumes a reaction budget nor introduces document/presence/voting state.
async function barrier(c:Client){c.p.send({kind:'renew',token:f.people[c.who].token});await c.p.next('renewed');}
async function emit(c:Client,value:any=reaction(),raw?:string){c.p.send(raw??value);await barrier(c);}
async function delivered(c:Client,count:number){await until(()=>bursts(c).length>=count);assert.equal(bursts(c).length,count);}
async function deniedLater(c:Client,send:Client,before:number){await emit(send);await barrier(send);await new Promise(r=>setTimeout(r,30));assert.equal(bursts(c).length,before);}
check(356,'owner editor viewer relay all eight exact frames without echo',async()=>{
  const {REACTIONS}=await import('../../packages/board-sync/src/reactions.ts');
  const clients=await Promise.all(['owner','editor','viewer'].map(w=>join(w)));
  for(const c of clients)for(const [id] of REACTIONS){await advance();const counts=clients.map(p=>bursts(p).length);await emit(c,reaction(id));for(const [i,p] of clients.entries()){if(p===c)assert.equal(bursts(p).length,counts[i]);else{await delivered(p,counts[i]+1);assert.deepEqual(bursts(p).at(-1),{kind:'reacted',connection:c.j.self.connection,reaction:id,x:42,y:22});}}}
});
check(357,'board-granted guests send and receive; ungranted outsider removed disabled denied',async()=>{
  const a=await join('owner');for(const role of ['editor','viewer']){await ok(`/boards/${f.a}/grants/${f.people.granted.id}`,'owner','PUT',{role});const g=await join('granted');const n=bursts(a).length;await emit(g);await delivered(a,n+1);const m=bursts(g).length;await emit(a);await delivered(g,m+1);await g.p.close();}
  for(const who of ['plain','outsider'])assert.equal((await req(`/boards/${f.a}/join-tickets`,who,'POST')).status,404);
  const g=await join('granted');await ok(`/boards/${f.a}/grants/${f.people.granted.id}`,'owner','DELETE');await closedAs(g,4403);await deniedLater(g,a,bursts(g).length);
  const b=await join('editor');await accountState('editor','disable');await closedAs(b,4403);await deniedLater(b,a,bursts(b).length);assert.equal((await req(`/boards/${f.a}/join-tickets`,'editor','POST')).status,404);
});
check(358,'same person second tab receives while sending tab does not',async()=>{const a=await join('editor'),b=await join('editor'),c=await join('viewer');await emit(a);await delivered(b,1);await delivered(c,1);assert.equal(bursts(a).length,0);assert.equal(bursts(b)[0].connection,a.j.self.connection);});
check(359,'parsed malformed reactions refuse bad_reaction; generic parse failures unchanged',async()=>{
  const a=await join(),b=await join('viewer');
  const bad=[{kind:'react',reaction:'heart',x:1},{...reaction(),extra:1},{kind:'react',reactions:'heart',x:1,y:2},reaction('unknown'),{...reaction(),reaction:1},reaction('heart',1000001),reaction('heart',-1000001),reaction('heart',0,1000001),reaction('heart',0,-1000001)];
  for(const v of bad){await advance();await emit(a,v);assert.equal((await a.p.next('refused')).reason,'bad_reaction');}
  await advance();await emit(a,{},'{"kind":"react","reaction":"heart","x":1e309,"y":0}');assert.equal((await a.p.next('refused')).reason,'bad_reaction');
  for(const raw of ['null','"react"','not json','{"kind":"unknown"}']){await emit(a,{},raw);assert.equal((await a.p.next('refused')).reason,'bad_message');}
  assert.equal(bursts(b).length,0);
});
check(360,'256-byte whitespace frame relays 257 refuses and legal downstream stays under 512',async()=>{
  const a=await join(),b=await join('viewer'),text=JSON.stringify(reaction('thumbs-down',-1000000,1000000));const raw=text+' '.repeat(256-byteLength(text));assert.equal(byteLength(raw),256);await emit(a,{},raw);await delivered(b,1);assert(byteLength(bursts(b)[0])<=512);await emit(a,{},raw+' ');assert.equal((await a.p.next('refused')).reason,'reaction_too_large');assert.equal(bursts(b).length,1);
});
check(361,'five-attempt rolling budget silently drops sixth and expires at exact 1000ms boundary',async()=>{
  const a=await join(),b=await join('viewer');for(let i=0;i<4;i++)await emit(a);await emit(a,{...reaction(),extra:1});assert.equal((await a.p.next('refused')).reason,'bad_reaction');await delivered(b,4);const n=a.p.messages.filter(m=>m.kind==='refused').length;await emit(a);assert.equal(bursts(b).length,4);assert.equal(a.p.messages.filter(m=>m.kind==='refused').length,n);await advance(999);await emit(a);assert.equal(bursts(b).length,4);await advance(1);await emit(a);await delivered(b,5);
});
check(362,'ten presence frames and five reactions have independent budgets',async()=>{
  const a=await join(),b=await join('viewer');for(let i=0;i<10;i++)a.p.send({kind:'presence',page:f.a,cursor:{x:i,y:2},selection:[],view:{x:0,y:0,width:800,height:600},active:false});await barrier(a);for(let i=0;i<5;i++)await emit(a);await delivered(b,5);const v=(await reactionInfo()).attachments.find((v:any)=>v.connectionId===a.j.self.connection);assert.equal(v.presenceTimes.length,10);assert.equal(v.reactionTimes.length,5);
});
check(363,'maximal full attachment and five timestamp budget stay bounded on runner',async()=>{
  const a=await join();for(let i=0;i<20;i++)await emit(a);let data=await reactionInfo();assert.equal(data.attachments[0].reactionTimes.length,5);await reactionInfo({connection:a.j.self.connection,maximal:true});data=await reactionInfo();for(const v of data.attachments){assert.equal(v.reactionTimes.length,5);assert(byteLength(v)<=16384);}measure.maximalAttachment=Math.max(...data.attachments.map(byteLength));
});
check(364,'running vote refuses all reactions; reveal and clear permit again',async()=>{
  const a=await join(),b=await join('viewer');await seed(a);assert.equal((await vote(a)).kind,'vote_result');for(const c of [a,b]){await emit(c);assert.equal((await c.p.next('refused')).reason,'reactions_voting');}assert.equal(bursts(a).length+bursts(b).length,0);await vote(a,'reveal');await emit(b);await delivered(a,1);await vote(a,'clear');await emit(b);await delivered(a,2);
});
check(365,'reaction before Start delivers first; reaction after Start refuses',async()=>{
  const a=await join(),b=await join('viewer');await seed(a);await emit(a);await delivered(b,1);await vote(a);await until(()=>b.p.messages.some(m=>m.kind==='vote_state'&&m.voting?.session.status==='running'));const started=b.p.messages.find(m=>m.kind==='vote_state'&&m.voting?.session.status==='running')!;assert(bursts(b)[0].observed<started.observed);await emit(a);assert.equal((await a.p.next('refused')).reason,'reactions_voting');assert.equal(bursts(b).length,1);
});
check(366,'sender removed or disabled behind held ordered operation relays nothing',async()=>{
  for(const disabled of [false,true]){await fresh();const a=await join('editor'),b=await join('viewer');await helper('proxy',{rpc:'access_changes_after',holdBefore:true,clearLog:true,parameters:{board:f.a}});a.p.send(reaction());await until(async()=>(await helper('proxy')).some((r:any)=>r.name==='access_changes_after'&&r.heldAt));if(disabled)await rpc('disable_person',{person:f.people.editor.id});else await rpc('remove_member',{workspace:f.workspace,person:f.people.editor.id});await helper('proxy',{release:'access_changes_after'});await closedAs(a,4403);await barrier(b);assert.equal(bursts(b).length,0);}
});
check(367,'removed expired role-changed epoch-changed recipients skipped while others receive',async()=>{
  for(const change of ['removed','expired','role','epoch']){await fresh();const a=await join(),b=await join('editor'),c=await join('viewer');if(change==='removed')await rpc('remove_member',{workspace:f.workspace,person:f.people.editor.id});if(change==='expired')await reactionInfo({connection:b.j.self.connection,patch:{expiresAt:at}});if(change==='role')await rpc('write_member_role',{workspace:f.workspace,person:f.people.editor.id,role:'viewer'});if(change==='epoch')await reactionInfo({connection:b.j.self.connection,patch:{epoch:b.j.epoch+1}});await emit(a);await delivered(c,1);assert.equal(bursts(b).length,0,change);await until(()=>b.p.closed!==null);}
});
check(368,'sender required-source outage drops all; recipient outage skips only it without retry',async()=>{
  const a=await join(),b=await join('editor'),c=await join('viewer');
  await helper('proxy',{rpc:'access_changes_after',fail:true,parameters:{board:f.a}});await emit(a);assert.equal(bursts(b).length+bursts(c).length,0);
  await helper('proxy',{rpc:'access_changes_after',fail:false});
  // After the single fresh replay, the recipient's required source is its
  // synchronous admission read. Fail that read on c only, after b's delivery.
  await reactionInfo({failAdmission:f.people.viewer.id});await emit(a);await delivered(b,1);assert.equal(bursts(c).length,0);
  await reactionInfo({failAdmission:null});await barrier(a);assert.equal(bursts(c).length,0);await emit(a);await delivered(b,2);await delivered(c,1);
});
check(369,'lock Trash and lifecycle close admit no later reaction',async()=>{
  for(const ending of ['lock','trash']){
    await fresh();const a=await join(),b=await join('viewer');
    const ticket=await ok(`/boards/${f.a}/join-tickets`,'viewer','POST',undefined,201);
    // Hold real received reaction frames until the room has closed, then release
    // them. A late frame must not be admitted by an old connection attachment.
    await driver.control({holdRoom:'reactions-closure'});a.p.send(reaction('heart'));b.p.send(reaction('star'));
    await until(()=>driver.control({heldRoomCount:true}),count=>count===2);
    if(ending==='lock')await driver.control({board:f.a,raiseFence:true});else await ok(`/boards/${f.a}/trash`,'owner','POST',{requestId:crypto.randomUUID(),expectedCycle:0});
    await driver.control({releaseRoom:true});await driver.control({board:f.a,settled:true});
    await closedAs(a,ending==='lock'?4423:4403);await closedAs(b,ending==='lock'?4423:4403);
    // Attempt a fresh socket with an unused pre-closure ticket. A later ticket
    // request may complete recovery, so its HTTP status is not admission proof.
    let late:Peer|undefined;
    try{late=await driver.connect(`/boards/${f.a}/join?ticket=${ticket.ticket}`);}catch(error){assert.match(String(error),/401|403|404|409|423|503/);}
    if(late){peers.push(late);await until(()=>late!.closed!==null);assert(!late.messages.some(m=>m.kind==='joined'||m.kind==='reacted'));}
    assert.equal(bursts(a).length,0);assert.equal(bursts(b).length,0);
  }
});
check(370,'late join reconnect reload and snapshots contain no earlier reaction',async()=>{
  const a=await join(),b=await join('viewer');await emit(a);await delivered(b,1);await b.p.close();const next=await join('viewer');await barrier(next);assert.equal(bursts(next).length,0);assert(!Object.keys(next.j).some(k=>/react/i.test(k)));const late=await join('editor');await barrier(late);assert.equal(bursts(late).length,0);await emit(a);await delivered(next,1);await delivered(late,1);
});
check(371,'document revision edited-at history file export and logical backup are byte-stable',async()=>{
  const a=await join(),b=await join('viewer');await seed(a);await emit(a);await advance();const documentBefore=canonical(readBoard(a.doc)),updateBefore=encode(Y.encodeStateAsUpdate(a.doc));const before={backup:await backup(),versions:await ok(`/boards/${f.a}/versions`),file:await ok(`/boards/${f.a}/export`),meta:(await reactionInfo()).meta};for(let i=0;i<5;i++)await emit(a);const after={backup:await backup(),versions:await ok(`/boards/${f.a}/versions`),file:await ok(`/boards/${f.a}/export`),meta:(await reactionInfo()).meta};assert.deepEqual(after,before);assert.equal(canonical(readBoard(a.doc)),documentBefore);assert.equal(encode(Y.encodeStateAsUpdate(a.doc)),updateBefore);assert.equal(bursts(b).length,6);
});
check(372,'no reaction SQLite table row meta journal or Supabase row is created',async()=>{
  const a=await join(),b=await join('viewer');await emit(a);await advance();const before=await reactionInfo(),tables=before.tables.map((t:any)=>t.name);const rows=await Promise.all(tables.map((t:string)=>driver.rows(f.a,t)));const service=await helper('sql',{sql:"SELECT table_name FROM information_schema.tables WHERE table_schema='nextphase_board' AND table_type='BASE TABLE' ORDER BY table_name"});assert.equal(service.trim().split('\n').length,17);const supa=await helper('sql',{sql:"SELECT jsonb_object_agg(t, n) FROM (SELECT table_name t, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) c FROM nextphase_board.%I', table_name), false, true, '')))[1]::text n FROM information_schema.tables WHERE table_schema='nextphase_board' AND table_type='BASE TABLE') x"});for(let i=0;i<5;i++)await emit(a);assert.deepEqual((await reactionInfo()).tables,before.tables);assert.deepEqual((await reactionInfo()).meta,before.meta);assert.deepEqual(await Promise.all(tables.map((t:string)=>driver.rows(f.a,t))),rows);assert.equal(await helper('sql',{sql:"SELECT jsonb_object_agg(t, n) FROM (SELECT table_name t, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) c FROM nextphase_board.%I', table_name), false, true, '')))[1]::text n FROM information_schema.tables WHERE table_schema='nextphase_board' AND table_type='BASE TABLE') x"}),supa);assert.equal(bursts(b).length,6);
});
check(373,'reactions preserve timer voting spotlight projections and following',async()=>{
  const {a,b}=await started();await accepted(b,'follow');const before={spotlight:(await read(b)).spotlight,timer:await driver.rows(f.a,'workshop_timer'),vote:await driver.rows(f.a,'workshop_vote')};await emit(a);await delivered(b,1);const after={spotlight:(await read(b)).spotlight,timer:await driver.rows(f.a,'workshop_timer'),vote:await driver.rows(f.a,'workshop_vote')};assert.deepEqual(after,before);assert.equal(after.spotlight.own.following,true);
});
check(374,'three refusals are plain sender-only frames without requestId or document recovery',async()=>{
  const a=await join(),b=await join('viewer');await emit(a,reaction('unknown'));assert.deepEqual(await a.p.next('refused'),{kind:'refused',reason:'bad_reaction'});await emit(a,{},JSON.stringify(reaction())+' '.repeat(257));assert.deepEqual(await a.p.next('refused'),{kind:'refused',reason:'reaction_too_large'});await seed(a);await vote(a);await emit(a);assert.deepEqual(await a.p.next('refused'),{kind:'refused',reason:'reactions_voting'});assert(!b.p.messages.some(m=>m.kind==='refused'));assert.equal(bursts(b).length,0);
});
check(375,'held earlier room operation orders reactions and rechecks current admission',async()=>{
  const a=await join(),b=await join('editor'),c=await join('viewer');await helper('proxy',{rpc:'board_role',holdBefore:true,clearLog:true,parameters:{board:f.a,person:f.people.owner.id}});const pending=read(a);await until(async()=>(await helper('proxy')).some((r:any)=>r.name==='board_role'&&r.heldAt));b.p.send(reaction('star'));c.p.send(reaction('heart'));await rpc('remove_member',{workspace:f.workspace,person:f.people.editor.id});await helper('proxy',{release:'board_role'});await pending;await barrier(c);await delivered(a,1);assert.equal(bursts(a)[0].connection,c.j.self.connection);assert(!bursts(a).some(m=>m.connection===b.j.self.connection));
});
check(376,'live attachment reconstruction keeps budget and relays no old frame; restart has no replay',async()=>{
  const a=await join(),b=await join('viewer');for(let i=0;i<5;i++)await emit(a);await delivered(b,5);await reactionInfo({reconstruct:true});assert.equal((await reactionInfo()).attachments.find((v:any)=>v.connectionId===a.j.self.connection).reactionTimes.length,5);await emit(a);assert.equal(bursts(b).length,5);await advance(1000);await emit(a);await delivered(b,6);if(runner==='node'){await driver.wake(f.a);const next=await join('viewer');await barrier(next);assert.equal(bursts(next).length,0);}
});
check(377,'fifty connections at budget relay bounded frames and remove closed connection budgets',async()=>{
  const clients:Client[]=[];for(let i=0;i<50;i++)clients.push(await join(i%2?'viewer':'editor'));
  const relayStarted=performance.now();
  for(const c of clients){for(let i=0;i<5;i++)c.p.send(reaction());await barrier(c);}
  for(const c of clients){await delivered(c,245);assert(bursts(c).every(v=>byteLength(v)<=512));const groups=new Map<string,number>();for(const v of bursts(c))groups.set(v.connection,(groups.get(v.connection)??0)+1);assert.equal(groups.size,49);assert([...groups.values()].every(n=>n===5));}
  measure.fiftyRelayMs=performance.now()-relayStarted;
  const full=await reactionInfo();assert.equal(full.attachments.length,50);assert(full.attachments.every((a:any)=>a.reactionTimes.length===5&&byteLength(a)<=16384));const ids=new Set(clients.map(c=>c.j.self.connection));for(const c of clients)await c.p.close();await until(()=>reactionInfo(),v=>v.attachments.every((a:any)=>!ids.has(a.connectionId)));measure.fiftyRelays=50*49*5;
});
