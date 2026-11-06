// SPDX-License-Identifier: Apache-2.0
import { test,beforeAll,afterAll,afterEach,inject } from 'vitest';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { makeDriver } from 'board-test-driver';
import { Adapter } from '../../packages/board-sync/src/document-adapter.ts';
import { readBoard } from '../../packages/board-sync/src/codec.ts';
import { add, canonical, type BoardV10 } from '../../packages/board-rules/src/document.ts';
import { encode,decode } from '../../packages/board-sync/src/session.ts';
import type { Context,Driver,Peer } from './driver-types.ts';
const context=inject<Context>('board'),runner=inject<string>('runner');let driver:Driver,f:any,pass=0,fail=0;
const peers:Peer[]=[],docs:Y.Doc[]=[],measure:Record<string,unknown>={};
beforeAll(async()=>{driver=await makeDriver(context);});
afterEach(async()=>{
  await driver.control({failHistory:'',failCheckpoint:'',fixedNow:null});
  for(const rpc of ['carry_board_mentions','board_role','project_mentions','access_changes_after'])await helper('proxy',{rpc,release:rpc,fail:false,failAfter:false,hold:false,holdBefore:false});
  for(const p of peers.splice(0))await p.close();for(const doc of docs.splice(0))doc.destroy();
});
afterAll(async()=>{await driver.close();console.log('SUMMARY-HISTORY '+JSON.stringify({runner,pass,fail,measure}));});
async function helper(action:string,value:unknown={}):Promise<any>{const r=await fetch(context.helperUrl+'/'+action,{method:'POST',body:JSON.stringify(value)});assert.equal(r.status,200,await r.clone().text());return r.json();}
const rpc=(name:string,parameters:object)=>helper('rpc',{name,parameters});
async function req(path:string,name='owner',method='GET',body?:unknown){return driver.request(path,{method,headers:{Authorization:'Bearer '+f.people[name].token,Origin:context.origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function ok(path:string,name='owner',method='GET',body?:unknown,status=200):Promise<any>{const r=await req(path,name,method,body);assert.equal(r.status,status,await r.clone().text());return status===204?null:r.json();}
const path=(id='')=>`/boards/${f.a}/versions${id?'/'+id:''}`;
const list=()=>ok(path());
const save=(name='',requestId=crypto.randomUUID())=>ok(path(),'owner','POST',{requestId,name,description:''});
async function op(action:string,value?:unknown){return driver.request(`/operator/boards/${f.a}/${action}`,{method:'POST',headers:{'Board-Operator-Key':context.operatorKey,'Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});}
async function backup(){const r=await op('backup');assert.equal(r.status,200,await r.clone().text());return r.json() as Promise<any>;}
const rows=(table:string)=>driver.rows(f.a,table);
async function until(read:()=>any,predicate=(v:any)=>!!v){let result;const end=Date.now()+10000;do{result=await read();if(predicate(result))return result;await new Promise(r=>setTimeout(r,10));}while(Date.now()<end);assert.fail('Condition timed out '+JSON.stringify(result));}
async function join(name='editor',board=f.a){const ticket=await ok(`/boards/${board}/join-tickets`,name,'POST',undefined,201),p=await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`);peers.push(p);const joined=await p.next('joined'),doc=new Y.Doc();docs.push(doc);Y.applyUpdate(doc,decode(joined.update));await until(()=>p.messages.some(m=>m.kind==='comments_snapshot'&&m.done));return {p,joined,doc};}
async function write(c:Awaited<ReturnType<typeof join>>,title:string,id=crypto.randomUUID()){
  const vector=Y.encodeStateVector(c.doc);c.doc.getMap('board').set('title',title);const message={kind:'edit',epoch:c.joined.epoch,requestId:id,update:encode(Y.encodeStateAsUpdate(c.doc,vector)),restoreGeneration:c.joined.restoreGeneration};
  c.p.send(message);const result=await until(()=>c.p.messages.find(m=>m.requestId===id&&['saved','refused'].includes(m.kind)));assert.equal(result.kind,'saved',JSON.stringify(result));return message;
}
async function restore(id:string,request?:any){const head=(await list()).head;return ok(path(id)+'/restore','owner','POST',request??{requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});}
const check=(id:number,name:string,run:()=>Promise<void>)=>test(`S${id} ${name}`,async()=>{try{f=await helper('removal-fixture');await run();pass++;console.log(`PASS: S${id} ${name}`);}catch(e){fail++;console.log(`FAIL: S${id} ${name}`);throw e;}});
async function sourceSnapshot(){const result:any={};for(const table of ['threads','comments','comment_ids','comment_counts','mention_targets','mention_pending'])result[table]=await rows(table);return result;}
function start(text='Current discussion',mentions:any[]=[]){return {action:'start',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),text,mentions,anchor:{objectId:null,x:12,y:34,u:0,v:0}};}
async function comment(c:Awaited<ReturnType<typeof join>>,operation:any,id=crypto.randomUUID(),generation=c.joined.restoreGeneration){c.p.send({kind:'comment',epoch:c.joined.epoch,requestId:id,operation,restoreGeneration:generation});return until(()=>c.p.messages.find(m=>m.requestId===id&&['comment_saved','comment_refused'].includes(m.kind)));}
async function sql(items:any[]){await driver.control({board:f.a,roomSQL:items});}
async function freshTokens(){for(const person of Object.values(f.people) as any[])person.token=await helper('token',{person,options:{now:Date.now(),exp:Math.floor(Date.now()/1000)+4000000}});}
function maximalBoard(): BoardV10 {
  let board:BoardV10={schemaVersion:10,boardId:crypto.randomUUID(),title:'Large',objects:[],retiredGenerations:[]};
  for(let i=0;i<120;i++)board.objects.push({id:crypto.randomUUID(),generation:crypto.randomUUID(),type:'stroke',kind:'marker',color:'black',weight:'thin',group:null,section:null,x:0,y:0,width:1000000,height:1000000,points:[[2,2],...Array.from({length:999},()=>[999998,999998] as [number,number])],order:i});
  for(let i=0;i<80;i++)board=add(board,'sticky',i,0);
  let left=2097152-new TextEncoder().encode(canonical(board)).length;
  for(const object of board.objects){if(!('text'in object))continue;const escaped=Math.min(1000,Math.floor(left/6));object.text='\0'.repeat(escaped);left-=escaped*6;const ascii=Math.min(1000-escaped,left);object.text+='x'.repeat(ascii);left-=ascii;}
  assert.equal(new TextEncoder().encode(canonical(board)).length,2097152);return board;
}

check(169,'atomic initial/imported capture and idempotent current-layout restart',async()=>{
  let value=await list();assert.equal(value.versions.length,1);assert.equal(value.versions[0].reason,'initial');assert.equal(value.versions[0].revision,0);assert.equal((await rows('meta')).find(r=>r.key==='storage_version').value,5);
  await driver.wake(f.a);assert.deepEqual((await list()).versions,value.versions);
  const document={schemaVersion:10,boardId:crypto.randomUUID(),title:'Import',objects:[],retiredGenerations:[]};
  const imported=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:'Import',document},201);
  value=await ok(`/boards/${imported.id}/versions`);assert.equal(value.versions.length,1);assert.equal(value.versions[0].revision,0);
  const before=await backup();await driver.control({failHistory:'capture'});assert.equal((await req(`/boards/${f.b}/versions`)).status,503);assert.equal((await driver.rows(f.b,'meta')).length,0);assert.equal((await driver.rows(f.b,'versions')).length,0);assert.deepEqual((await rows('versions')).map(r=>r.id),before.tables.versions.map((r:any)=>r.id));
});
check(170,'persisted checkpoints, rollback and expiry-surviving canonical fingerprint',async()=>{
  await freshTokens();const c=await join(),initial=await list(),at=initial.versions[0].capturedAt;
  await write(c,'Changed');await driver.control({fixedNow:at+1800000});await driver.control({board:f.a,alarm:true});assert.equal((await list()).versions.length,2);
  const fingerprint=(await rows('meta')).filter(r=>r.key.startsWith('history_capture_'));
  await driver.control({fixedNow:at+3600000});await driver.control({board:f.a,alarm:true});assert.equal((await list()).versions.length,2);
  await write(c,'Later');await driver.control({fixedNow:at+5400000,failHistory:'capture'});await assert.rejects(driver.control({board:f.a,alarm:true}));assert.deepEqual((await rows('meta')).filter(r=>r.key.startsWith('history_capture_')),fingerprint);
  await driver.control({failHistory:''});await driver.wake(f.a);await driver.control({board:f.a,alarm:true});assert.equal((await list()).versions.length,3);
  const n=await join();await write(n,'Changed');await save();const saved=(await rows('meta')).filter(r=>r.key.startsWith('history_capture_'));await write(n,'B');await write(n,'Changed');
  await driver.control({fixedNow:at+2592000000+5400001});await driver.control({board:f.a,alarm:true});assert.equal((await list()).versions.length,0);await driver.wake(f.a);await driver.control({board:f.a,alarm:true});assert.deepEqual((await rows('meta')).filter(r=>r.key.startsWith('history_capture_')),saved);
});
check(171,'last viewer close and manual equality capture confirmed content only',async()=>{
  const c=await join(),viewer=await join('viewer');await write(c,'Confirmed');await c.p.close();assert.equal((await list()).versions.length,1);await viewer.p.close();await until(list,v=>v.versions.length===2);
  const n=await join('viewer');await n.p.close();assert.equal((await list()).versions.length,2);await save();assert.equal((await list()).versions.length,3);
});
check(172,'100/500 Unicode code-point metadata and exact request shape',async()=>{
  await list();const body={requestId:crypto.randomUUID(),name:'😀'.repeat(100),description:'😀'.repeat(500)},saved=await ok(path(),'owner','POST',body);
  for(const change of [{name:'😀'.repeat(101)},{description:'x'.repeat(501)},{name:'\ud800'},{name:'\0'},{extra:true},{name:1}])assert.equal((await req(path(),'owner','POST',{...body,requestId:crypto.randomUUID(),...change})).status,400);
  const named=await ok(path(saved.version.id),'owner','PATCH',{name:'',description:''});assert.equal(named.version.capturedAt,saved.version.capturedAt);assert.equal(named.version.ordinal,saved.version.ordinal);assert.equal((await list()).versions.length,2);
});
check(173,'all kinds share newest-50 cap and restore selection is copied before eviction',async()=>{
  await list();for(let i=0;i<50;i++)await save('N'+i);const value=await list(),oldest=value.versions.at(-1);assert.equal(value.versions.length,50);await restore(oldest.id);const after=await list();assert.equal(after.versions.length,50);assert.equal(after.versions[0].reason,'restored');assert.equal(after.versions[1].reason,'before_restore');assert.equal((await rows('version_chunks')).length,50);
});
check(174,'exact elapsed expiry gates list preview naming and restore without expiring live content',async()=>{
  await freshTokens();const v=(await list()).versions[0];await driver.control({fixedNow:v.capturedAt+2592000000-1});await ok(path(v.id));await ok(path(v.id),'owner','PATCH',{name:'Old',description:''});
  const head=(await list()).head;await driver.control({fixedNow:v.capturedAt+2592000000});assert.equal((await req(path(v.id))).status,404);assert.equal((await req(path(v.id),'owner','PATCH',{name:'',description:''})).status,404);assert.equal((await req(path(v.id)+'/restore','owner','POST',{requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation})).status,404);assert.equal((await list()).versions.length,0);await ok(`/boards/${f.a}/export`);
});
check(175,'every route enforces live effective role and generic authentication/access refusals',async()=>{
  const v=(await list()).versions[0];for(const who of ['owner','editor','viewer','granted']){await ok(path(),who);await ok(path(v.id),who);}
  for(const who of ['viewer'])for(const [url,method,body]of [[path(),'POST',{requestId:crypto.randomUUID(),name:'',description:''}],[path(v.id),'PATCH',{name:'',description:''}],[path(v.id)+'/restore','POST',{requestId:crypto.randomUUID(),expectedRevision:0,expectedGeneration:0}]])assert.equal((await req(String(url),who,String(method),body)).status,403);
  await rpc('write_board_grant',{board:f.a,person:f.people.granted.id,role:'viewer'});await ok(path(),'granted');assert.equal((await req(path(),'granted','POST',{requestId:crypto.randomUUID(),name:'',description:''})).status,403);
  for(const who of ['plain','outsider'])assert.deepEqual(await (await req(path(),who)).json(),{error:{reason:'not_found'}});
  await rpc('disable_person',{person:f.people.editor.id});assert.equal((await req(path(),'editor')).status,404);
  assert.equal((await driver.request('/boards/malformed/versions',{headers:{Authorization:'Bearer invalid'}})).status,401);
});
check(176,'held authorization revocation and cross-board guesses reveal no history',async()=>{
  const v=(await list()).versions[0];await helper('proxy',{rpc:'board_role',holdBefore:true,parameters:{person:f.people.granted.id,board:f.a},clearLog:true});
  const pending=req(path(v.id),'granted');await until(()=>helper('proxy'),r=>r.some((r:any)=>r.name==='board_role'&&r.heldAt));await rpc('remove_grant',{board:f.a,person:f.people.granted.id});await helper('proxy',{release:'board_role'});assert.equal((await pending).status,404);
  await rpc('write_board_grant',{board:f.a,person:f.people.granted.id,role:'editor'});
  const head=(await list()).head,request={requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation};
  await helper('proxy',{rpc:'board_role',holdBefore:true,parameters:{person:f.people.granted.id,board:f.a},clearLog:true});
  const heldRestore=req(path(v.id)+'/restore','granted','POST',request);await until(()=>helper('proxy'),r=>r.some((r:any)=>r.name==='board_role'&&r.heldAt));await rpc('remove_grant',{board:f.a,person:f.people.granted.id});await helper('proxy',{release:'board_role'});assert.equal((await heldRestore).status,404);assert.equal((await list()).versions.length,1);
  assert.equal((await req(`/boards/${f.b}/versions/${v.id}`)).status,404);await rpc('write_board_grant',{board:f.a,person:f.people.viewer.id,role:'editor'});await rpc('remove_grant',{board:f.a,person:f.people.viewer.id});await ok(path(),'viewer');
});
check(177,'access/room/checkpoint failures remain retryable and distinct from empty success',async()=>{
  await list();await helper('proxy',{rpc:'access_changes_after',fail:true});assert.equal((await req(path())).status,503);await helper('proxy',{rpc:'access_changes_after',fail:false});assert.equal((await list()).versions.length,1);
  const selected=(await list()).versions[0];for(const checkpoint of ['document','mention']){
    const head=(await list()).head,request={requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation};await driver.control({failCheckpoint:checkpoint});
    assert.equal((await req(path(selected.id)+'/restore','owner','POST',request)).status,503);assert.equal((await op('backup')).status,503);
    await driver.control({failCheckpoint:''});await ok(path(selected.id)+'/restore','owner','POST',request);
  }
  await sql([{sql:'DELETE FROM versions'},{sql:'DELETE FROM version_chunks'}]);assert.deepEqual((await list()).versions,[]);
});
check(178,'preview returns exact selected canonical document without changing live head',async()=>{
  const c=await join(),v=(await save('Selected')).version,before=await ok(path(v.id));await write(c,'Live');const head=(await list()).head;
  assert.deepEqual((await ok(path(v.id))).document,before.document);assert.deepEqual((await list()).head,head);assert.equal(JSON.parse(await (await req(`/boards/${f.a}/export`)).text()).title,'Live');
  await sql([{sql:"UPDATE version_chunks SET bytes=x'7b' WHERE version_id=?",bindings:[v.id]}]);const fence=await driver.control({board:f.a,fences:true});assert.equal((await req(path(v.id)+'/restore','owner','POST',{requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation})).status,503);assert.equal(await driver.control({board:f.a,fences:true}),fence);
});
check(179,'same-ID restore preserves replaced state at consecutive ordinals and higher revision/generation',async()=>{
  const c=await join(),selected=(await list()).versions[0],old=await ok(path(selected.id));await write(c,'Newer');const head=(await list()).head,result=await restore(selected.id),after=await list();
  assert.equal(result.revision,head.revision+1);assert(result.generation>head.generation);assert.equal(after.versions[0].ordinal,after.versions[1].ordinal+1);assert.equal((await ok(path(result.beforeVersionId))).document.title,'Newer');assert.deepEqual((await ok(path(result.restoredVersionId))).document,old.document);
});
check(180,'stale revision or generation requires explicit fresh confirmation',async()=>{
  const c=await join(),v=(await list()).versions[0],head=(await list()).head;await write(c,'Concurrent');for(const stale of [head,{revision:1,generation:99}])assert.equal((await req(path(v.id)+'/restore','owner','POST',{requestId:crypto.randomUUID(),expectedRevision:stale.revision,expectedGeneration:stale.generation})).status,409);assert.equal((await list()).versions.length,1);await restore(v.id);assert.equal((await list()).versions.length,3);
});
check(181,'durable retry identities survive restart/selection expiry and refuse reused body/path',async()=>{
  await freshTokens();const id=crypto.randomUUID(),saved=await save('Retry',id);await driver.wake(f.a);assert.deepEqual(await save('Retry',id),saved);const head=(await list()).head,request={requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation},result=await restore(saved.version.id,request);
  await driver.wake(f.a);await driver.control({fixedNow:saved.version.capturedAt+2592000000});assert.deepEqual(await ok(path(saved.version.id)+'/restore','owner','POST',request),result);assert.equal((await req(path(crypto.randomUUID())+'/restore','owner','POST',request)).status,409);await rpc('write_member_role',{workspace:f.workspace,person:f.people.editor.id,role:'guest'});assert.equal((await req(path(),'editor')).status,404);
});
check(182,'intent rollback, durable pending phases and atomic terminal chunk cleanup',async()=>{
  const document=maximalBoard(),created=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:'Large',document},201);f.a=created.id;
  const c=await join(),v=(await list()).versions[0];await write(c,'Other');const head=(await list()).head,request={requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation},before=await backup();
  await driver.control({failHistory:'intent'});let response=await req(path(v.id)+'/restore','owner','POST',request);assert.equal(response.status,503);assert.equal((await response.json() as any).error.reason,'restore_failed');assert.deepEqual((await backup()).tables,before.tables);
  for(const failure of ['fence','after-fence']){await driver.control({failHistory:failure});const pending=await req(path(v.id)+'/restore','owner','POST',request);assert.equal((await pending.json() as any).error.reason,'restore_pending');assert.equal((await rows('history_intent_chunks')).length,4);}
  await driver.control({failHistory:'local'});response=await req(path(v.id)+'/restore','owner','POST',request);assert.equal((await response.json() as any).error.reason,'restore_pending');assert.equal((await op('backup')).status,503);assert.equal((await rows('history_intent_chunks')).length,4);for(const chunk of await rows('history_intent_chunks'))assert(chunk.bytes.bytes<=1048576);measure.intentCanonicalBytes=[2097152,2097152];
  await driver.control({failHistory:'cleanup'});await driver.wake(f.a);assert.equal((await req(path(v.id)+'/restore','owner','POST',request)).status,503);const journals=await rows('history_requests');assert(JSON.parse(journals[0].result).phase);assert(!journals[0].result.includes('objects'));assert(new TextEncoder().encode(journals[0].result).length<=65536);assert.equal((await rows('meta')).find(r=>r.key==='restore_pending').value,1);
  await driver.control({failHistory:''});await ok(path(v.id)+'/restore','owner','POST',request);assert.equal((await rows('history_intent_chunks')).length,0);assert.equal((await rows('meta')).find(r=>r.key==='restore_pending').value,0);assert.equal((await list()).versions.length,3);
});
check(183,'restored identities keep the union and ordinary edits cannot resurrect removed pairs',async()=>{
  let board:BoardV10={schemaVersion:10,boardId:crypto.randomUUID(),title:'Identity',objects:[],retiredGenerations:[]};board=add(board,'sticky',0,0);const created=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:board.title,document:board},201);f.a=created.id;
  const c=await join(),selected=(await list()).versions[0],object=board.objects[0],adapter=new Adapter();adapter.set({...readBoard(c.doc),objects:[],retiredGenerations:[object.generation]});
  // Use the joined CRDT for a real ordinary removal.
  const vector=Y.encodeStateVector(c.doc);c.doc.getMap('objects').delete(object.id);c.doc.getMap('retired').set(object.generation,true);const id=crypto.randomUUID();c.p.send({kind:'edit',epoch:c.joined.epoch,requestId:id,update:encode(Y.encodeStateAsUpdate(c.doc,vector)),restoreGeneration:c.joined.restoreGeneration});assert.equal((await c.p.next('saved')).kind,'saved');
  await restore(selected.id);const current=await ok(path((await list()).versions[0].id));assert.equal(current.document.objects[0].id,object.id);assert((await rows('identifiers')).some(r=>r.object_id===object.id));adapter.destroy();
});
check(184,'current discussion IDs/text/ranges/deletions survive document restore',async()=>{
  const c=await join(),v=(await list()).versions[0],root=start();await comment(c,root);const reply={action:'reply',threadId:root.threadId,commentId:crypto.randomUUID(),text:'Current reply',mentions:[]};await comment(c,reply);await comment(c,{action:'delete_comment',threadId:root.threadId,commentId:reply.commentId});const before=await sourceSnapshot();await restore(v.id);const after=await sourceSnapshot();assert.deepEqual(after,before);assert(!after.comments.some((r:any)=>r.id===reply.commentId));
});
check(185,'notice carry preserves read state, dismissed/evicted cutoff and pending creation against held old work',async()=>{
  const c=await join(),v=(await list()).versions[0],roster=await ok(`/boards/${f.a}/participants`),viewer=(await join('viewer')).joined.self.person,target=roster.candidates.find((p:any)=>p.person===viewer),text='@'+target.label;
  const range=[{start:0,end:[...text].length,person:target.person,label:target.label}];
  const first=start(text,range);await comment(c,first);await driver.control({board:f.a,deliverMentions:true});
  const original=(await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}}))[0];
  // Each action is inside the source's normal limits; deterministic spacing avoids rate coupling.
  const at=Date.now();for(let i=0;i<51;i++){await driver.control({fixedNow:at+(i+1)*250});await comment(c,start(text,range));await driver.control({board:f.a,deliverMentions:true});}
  let inbox=await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}});assert.equal(inbox.length,50);assert(!inbox.some((n:any)=>n.id===original.id));
  const read=inbox[0],dismissed=inbox[1];await ok('/notifications/actions','viewer','POST',{action:'read',seen:[{id:read.id,version:read.state_version}]},204);await ok('/notifications/actions','viewer','POST',{action:'dismiss',seen:[{id:dismissed.id,version:dismissed.state_version}]},204);
  await helper('proxy',{rpc:'project_mentions',fail:true});await driver.control({fixedNow:at+14000});const pending=start(text,range);await comment(c,pending);const source=await rows('mention_targets');assert((await rows('mention_pending')).length>0);
  const before=await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}}),head=(await list()).head,request={requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation};
  await helper('proxy',{rpc:'carry_board_mentions',failAfter:true});assert.equal((await req(path(v.id)+'/restore','owner','POST',request)).status,503);
  await helper('proxy',{rpc:'carry_board_mentions',failAfter:false});await ok(path(v.id)+'/restore','owner','POST',request);
  const carried=await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}});assert.equal(carried.length,before.length);
  for(const n of before){const after=carried.find((p:any)=>p.id===n.id);assert(after);for(const key of ['is_read','state_version','delivered_order','created_at','source_order'])assert.equal(after[key],n[key]);assert(after.generation>n.generation);}
  await helper('proxy',{rpc:'project_mentions',fail:false});await driver.control({board:f.a,deliverMentions:true});await driver.control({board:f.a,deliverMentions:true});
  inbox=await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}});assert.equal(inbox.filter((n:any)=>n.comment_id===pending.commentId).length,1);assert(!inbox.some((n:any)=>n.id===original.id||n.id===dismissed.id));assert.equal(inbox.find((n:any)=>n.id===read.id).is_read,true);
  await rpc('project_mentions',{board:f.a,generation:head.generation,source_order:99999,active:source,creates:source});assert.deepEqual(await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}}),inbox);
});
check(186,'stale edit/comment generation precedes receipts and rejoined fresh work saves',async()=>{
  const c=await join(),v=(await list()).versions[0],message=await write(c,'Before'),operation=start(),saved=await comment(c,operation);await restore(v.id);const n=await join();n.p.send({...message,epoch:n.joined.epoch});assert.equal((await n.p.next('refused')).reason,'restore_changed');assert.equal((await comment(n,operation,saved.requestId,c.joined.restoreGeneration)).reason,'restore_changed');await write(n,'Fresh');assert.equal((await comment(n,start('Fresh comment'))).kind,'comment_saved');
});
check(187,'connected peers see restoring actor before 4423 and higher joined generation',async()=>{
  const a=await join(),b=await join('viewer'),v=(await list()).versions[0];await restore(v.id);for(const c of [a,b]){await until(()=>c.p.closed,v=>v!==null);assert.equal(c.p.closed,4423);assert(c.p.messages.some(m=>m.kind==='history_restoring'&&typeof m.actor==='string'));}const n=await join();assert(n.joined.restoreGeneration>a.joined.restoreGeneration);assert.equal((await rows('tickets')).length,0);assert.equal((await rows('waiting')).length,0);
});
check(188,'restart preserves capture metadata/fingerprints/results and restored directory title',async()=>{
  const c=await join(),v=(await save('Named')).version;await write(c,'Later');const result=await restore(v.id),before=await rows('versions'),fingerprint=(await rows('meta')).filter(r=>r.key.startsWith('history_'));await driver.wake(f.a);await list();assert.deepEqual(await rows('versions'),before);assert.deepEqual((await rows('meta')).filter(r=>r.key.startsWith('history_')),fingerprint);assert.equal((await list()).head.generation,result.generation);
});
check(189,'current logical backup keeps history but operator restore clears mention projection',async()=>{
  const c=await join();await comment(c,start());await save('Backup');const envelope=await backup();assert.equal((await op('restore',envelope)).status,200);await join();assert.deepEqual(await rows('versions'),envelope.tables.versions);assert.equal((await rows('mention_targets')).length,0);assert.equal((await rows('mention_pending')).length,0);assert.equal((await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}})).length,0);
});
check(190,'malformed current backup/history/fingerprint refuses before advancing any fence',async()=>{
  await list();const envelope=await backup(),fence=await driver.control({board:f.a,fences:true});
  const mutations=[(b:any)=>delete b.tables.versions,(b:any)=>delete b.tables.history_intent_chunks,(b:any)=>b.tables.versions[0].reason='trash',(b:any)=>b.tables.versions.push({...b.tables.versions[0],id:crypto.randomUUID()}),(b:any)=>b.tables.version_chunks[0].chunk_index=1,(b:any)=>b.tables.meta.find((r:any)=>r.key==='history_capture_sha256').value='0'.repeat(64),(b:any)=>b.tables.meta.find((r:any)=>r.key==='history_capture_bytes').value=0,(b:any)=>b.tables.history_requests.push({person_id:f.people.owner.id,request_id:crypto.randomUUID(),digest:'0'.repeat(64),operation:'restore',result:JSON.stringify({document:{objects:[]}})})];
  for(const change of mutations){const bad=structuredClone(envelope);change(bad);assert.equal((await op('restore',bad)).status,400);assert.equal(await driver.control({board:f.a,fences:true}),fence);}
  assert.equal((await op('restore',envelope)).status,200);
});
check(191,'whole serialized backup counts base64/metadata and explicitly refuses above 16 MiB',async()=>{
  await list();const small=await backup();measure.smallBackupBytes=new TextEncoder().encode(JSON.stringify(small)).length;
  const board=maximalBoard();const created=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:'Large',document:board},201);f.a=created.id;
  for(let i=0;i<6;i++)await save();const result=await op('backup');assert.equal(result.status,413);assert.equal((await result.json() as any).error.reason,'backup_too_large');measure.largeDocuments=7;measure.documentBytes=2097152;measure.chunkBytes=(await rows('version_chunks')).map(r=>r.bytes.bytes);console.log('MEASURE-S191 '+JSON.stringify(measure));
  const response=await driver.request(`/operator/boards/${f.a}/restore`,{method:'POST',headers:{'Board-Operator-Key':context.operatorKey,'Content-Type':'application/json'},body:' '.repeat(16777217)});assert.equal(response.status,413);
});
check(192,'inventory reports every room/history row and independent fence without global bound claim',async()=>{
  await list();await save();const tables:any={};for(const table of ['meta','edits','receipts','waiting','snapshot_chunks','grants','identifiers','threads','comments','comment_ids','comment_counts','mention_targets','mention_pending','tickets','versions','version_chunks','history_requests','history_intent_chunks']){
    const all=await rows(table);const serializedRowBytes=all.map(row=>{
      let binaryBytes=0;const serial=Object.fromEntries(Object.entries(row).map(([key,value]:[string,any])=>{
        if(value&&typeof value==='object'&&typeof value.bytes==='number'){binaryBytes+=4*Math.ceil(value.bytes/3);return[key,''];}return[key,value];
      }));return new TextEncoder().encode(JSON.stringify(serial)).length+binaryBytes;
    });tables[table]={rows:all.length,serializedRowBytes,serializedBytes:serializedRowBytes.reduce((n,v)=>n+v,0)};assert(serializedRowBytes.every(n=>n<2000000));for(const row of all)for(const value of Object.values(row))if(value&&typeof value==='object'&&'bytes'in value)assert(Number(value.bytes)<=1048576);
  }
  const count=await helper('sql',{sql:"SELECT count(*) FROM pg_tables WHERE schemaname='nextphase_board'"});assert.equal(Number(String(count).trim()),13);measure.inventory={tables,fence:await driver.control({board:f.a,fences:true}),serviceTables:13,globallyBounded:false};console.log('MEASURE-S192 '+JSON.stringify(measure.inventory));
  await freshTokens();const version=(await list()).versions[0];await driver.control({fixedNow:version.capturedAt+2592000000});await driver.control({board:f.a,alarm:true});assert.equal((await rows('versions')).length,0);assert.equal((await rows('version_chunks')).length,0);assert.equal((await rows('history_intent_chunks')).length,0);
});
check(193,'carry is service-only, idempotent at target and rejects conflicting checkpoints',async()=>{
  await list();for(const token of [f.people.owner.token,'']){const result=await helper('rls',{token,rpc:'carry_board_mentions',parameters:{board:f.a,from_generation:0,to_generation:1}});assert(result.error);}
  const privilege=await helper('sql',{sql:"SELECT has_function_privilege('anon','nextphase_board.carry_board_mentions(uuid,bigint,bigint)','EXECUTE'),has_function_privilege('authenticated','nextphase_board.carry_board_mentions(uuid,bigint,bigint)','EXECUTE')"});assert.equal(String(privilege).trim(),'f|f');
  await rpc('carry_board_mentions',{board:f.a,from_generation:0,to_generation:1});const before=await helper('rows',{table:'mention_delivery',filters:{board_id:f.a}});await rpc('carry_board_mentions',{board:f.a,from_generation:0,to_generation:1});assert.deepEqual(await helper('rows',{table:'mention_delivery',filters:{board_id:f.a}}),before);
  const conflict=await fetch(context.helperUrl+'/rpc',{method:'POST',body:JSON.stringify({name:'carry_board_mentions',parameters:{board:f.a,from_generation:0,to_generation:2}})});assert.equal(conflict.status,500);assert.deepEqual(await helper('rows',{table:'mention_delivery',filters:{board_id:f.a}}),before);
  const result=await helper('sql',{sql:`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nextphase_board' AND c.relkind='r' AND c.relrowsecurity`});assert.equal(Number(String(result).trim()),13);
});
check(194,'actual HTTP adapters enforce exact keys/body limits/export boundaries without deletion',async()=>{
  const v=(await list()).versions[0];assert.deepEqual(Object.keys(v),['id','ordinal','capturedAt','revision','generation','reason','name','description','actor','namedBy','sourceName']);assert.deepEqual(Object.keys(await list()),['versions','head']);assert.deepEqual(Object.keys(await ok(path(v.id))),['version','document']);
  for(const url of [path()+'?unknown=1',path(v.id)+'?unknown=1'])assert.equal((await req(url)).status,400);assert.equal((await req(path(),'owner','POST',{requestId:crypto.randomUUID(),name:'',description:'',actor:'forged'})).status,400);assert.equal((await req(path(v.id),'owner','DELETE')).status,404);
  const r=await driver.request(path(),{method:'POST',headers:{Authorization:'Bearer '+f.people.owner.token,'Content-Type':'application/json'},body:' '.repeat(1048577)});assert.equal(r.status,413);const before=await (await req(`/boards/${f.a}/export`)).text();await ok(path(v.id));assert.equal(await (await req(`/boards/${f.a}/export`)).text(),before);assert(!before.includes('versions'));
});
