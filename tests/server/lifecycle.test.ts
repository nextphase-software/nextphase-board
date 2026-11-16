// SPDX-License-Identifier: Apache-2.0
import {test,beforeAll,afterAll,afterEach,inject} from 'vitest';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {makeDriver} from 'board-test-driver';
import {encode,decode} from '../../packages/board-sync/src/session.ts';
import {canonical,empty,add,type BoardV13} from '../../packages/board-rules/src/document.ts';
import type {Context,Driver,Peer} from './driver-types.ts';
const context=inject<Context>('board'),runner=inject<string>('runner');
let driver:Driver,f:any,pass=0,fail=0;const peers:Peer[]=[],docs:Y.Doc[]=[],measure:Record<string,unknown>={};
const controls=['admit_lifecycle','lifecycle_value','lifecycle_step','lifecycle_delivery_clear','lifecycle_cleanup','lifecycle_tick','lifecycle_due','board_role','copy_saved_board','project_mentions','carry_board_mentions','revoke_unavailable_board_grant'];
beforeAll(async()=>{driver=await makeDriver(context);});
afterEach(async()=>{for(const rpc of controls)await helper('proxy',{rpc,release:rpc,fail:false,failAfter:false,hold:false,holdBefore:false});await driver.control({releaseRoom:true,holdRoom:'',failLifecycle:'',failHistory:'',failCheckpoint:'',fixedNow:null});for(const peer of peers.splice(0))await peer.close();for(const doc of docs.splice(0))doc.destroy();});
afterAll(async()=>{await driver.close();console.log('SUMMARY-LIFECYCLE '+JSON.stringify({runner,pass,fail,measure}));});
async function helper(action:string,value:unknown={}):Promise<any>{const response=await fetch(context.helperUrl+'/'+action,{method:'POST',body:JSON.stringify(value)});assert.equal(response.status,200,await response.clone().text());return response.json();}
const rpc=(name:string,parameters:object)=>helper('rpc',{name,parameters});
const sql=(sql:string)=>helper('sql',{sql});
const dbRows=(table:string,filters:object={board_id:f.a})=>helper('rows',{table,filters});
const rows=(table:string)=>driver.rows(f.a,table);
async function req(path:string,who='owner',method='GET',body?:unknown){return driver.request(path,{method,headers:{Authorization:'Bearer '+(f.people[who]?.token??who),Origin:context.origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});}
async function ok(path:string,who='owner',method='GET',body?:unknown,status=200):Promise<any>{const response=await req(path,who,method,body);assert.equal(response.status,status,await response.clone().text());return response.json();}
async function refused(response:Response,status:number,reason:string){assert.equal(response.status,status,await response.clone().text());assert.equal((await response.json() as any).error.reason,reason);}
const statusPath=(board=f.a,workspace=f.workspace)=>`/workspaces/${workspace}/trash/${board}/status`;
const mutatePath=(kind:string,board=f.a)=>kind==='move'?`/boards/${board}/trash`:`/workspaces/${f.workspace}/trash/${board}/${kind}`;
const identity=(cycle:number)=>({requestId:crypto.randomUUID(),expectedCycle:cycle});
const move=(cycle=0,request=identity(cycle))=>ok(mutatePath('move'),'owner','POST',request);
const restore=(cycle=1,request=identity(cycle))=>ok(mutatePath('restore'),'owner','POST',request);
const purge=(cycle=1,request=identity(cycle))=>ok(mutatePath('delete'),'owner','POST',request);
async function pending(kind:string,cycle:number){const result=await req(mutatePath(kind),'owner','POST',identity(cycle));assert.equal(result.status,202,await result.clone().text());return result.json() as Promise<any>;}
async function until(read:()=>any,predicate=(v:any)=>!!v){let result;const end=Date.now()+10000;do{result=await read();if(predicate(result))return result;await new Promise(r=>setTimeout(r,10));}while(Date.now()<end);assert.fail('Condition timed out '+JSON.stringify(result));}
async function fresh(at=Date.now()){for(const person of Object.values(f.people) as any[])person.token=await helper('token',{person,options:{now:at,exp:Math.floor(at/1000)+4000000}});}
async function join(who='editor',board=f.a){const ticket=await ok(`/boards/${board}/join-tickets`,who,'POST',undefined,201);const peer=await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`);peers.push(peer);const joined=await peer.next('joined'),doc=new Y.Doc();docs.push(doc);Y.applyUpdate(doc,decode(joined.update));await until(()=>peer.messages.some(m=>m.kind==='comments_snapshot'&&m.done));return {peer,joined,doc};}
async function edit(c:Awaited<ReturnType<typeof join>>,title:string,wait=true){const vector=Y.encodeStateVector(c.doc);c.doc.getMap('board').set('title',title);const message={kind:'edit',epoch:c.joined.epoch,requestId:crypto.randomUUID(),restoreGeneration:c.joined.restoreGeneration,update:encode(Y.encodeStateAsUpdate(c.doc,vector))};c.peer.send(message);if(wait)await c.peer.next('saved');return message;}
async function comment(c:Awaited<ReturnType<typeof join>>,text='Saved discussion',mentions:any[]=[]){const operation={action:'start',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),text,mentions,anchor:{page:f.a,objectId:null,x:12,y:34,u:0,v:0}};const requestId=crypto.randomUUID();c.peer.send({kind:'comment',epoch:c.joined.epoch,requestId,restoreGeneration:c.joined.restoreGeneration,operation});const result=await until(()=>c.peer.messages.find(m=>m.requestId===requestId));assert.equal(result.kind,'comment_saved',JSON.stringify(result));return operation;}
async function operator(action:string,body?:unknown,board=f.a){return driver.request(`/operator/boards/${board}/${action}`,{method:'POST',headers:{'Board-Operator-Key':context.operatorKey,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function backup(){const r=await operator('backup');assert.equal(r.status,200,await r.clone().text());return r.json() as Promise<any>;}
async function versions(){return ok(`/boards/${f.a}/versions`);}
async function save(){return ok(`/boards/${f.a}/versions`,'owner','POST',{requestId:crypto.randomUUID(),name:'Retained',description:''});}
async function gone(){assert.equal((await req(`/boards/${f.a}`)).status,404);assert.equal((await req(`/boards/${f.a}/export`)).status,404);}
async function inventory(){const value=await driver.control({board:f.a,inventory:true});if(runner==='node'){assert.deepEqual(value.files,[]);assert.equal(value.loaded,false);assert.equal(value.timer,false);}else{assert.deepEqual(value.tables,[]);assert.equal(value.alarm,null);}}
const check=(id:number,name:string,run:()=>Promise<void>)=>test(`S${id} ${name}`,async()=>{try{f=await helper('removal-fixture');await run();pass++;console.log(`PASS: S${id} ${name}`);}catch(error){fail++;console.log(`FAIL: S${id} ${name}`);throw error;}});

check(195,'six owner routes, live refusals, exact envelopes and generic lookups',async()=>{
  const paths=[['GET',`/boards/${f.a}/lifecycle`],['GET',`/workspaces/${f.workspace}/trash`],['GET',statusPath()],['POST',mutatePath('move')],['POST',mutatePath('restore')],['POST',mutatePath('delete')]];
  for(const [method,path] of paths){for(const who of ['editor','viewer','granted'])await refused(await req(path,who,method,method==='POST'?identity(0):undefined),403,'role_too_low');await refused(await req(path,'outsider',method,method==='POST'?identity(0):undefined),404,'not_found');await refused(await req(path,'invalid',method,method==='POST'?identity(0):undefined),401,'token_malformed');}
  const initial=await ok(`/boards/${f.a}/lifecycle`);assert.equal(initial.cycle,0);assert.deepEqual((await ok(`/workspaces/${f.workspace}/trash`)).boards,[]);assert.equal((await ok(statusPath())).state,'active');
  for(const body of [{requestId:crypto.randomUUID(),expectedCycle:0,extra:true},{requestId:'bad',expectedCycle:0},{requestId:crypto.randomUUID(),expectedCycle:'0'}])assert.equal((await req(mutatePath('move'),'owner','POST',body)).status,400);
  assert.equal((await req(mutatePath('move'),'owner','POST',' '.repeat(65537))).status,413);assert.equal((await req(`/boards/${f.a}/lifecycle?extra=1`)).status,400);
  const moved=await move();assert.equal(moved.state,'trashed');assert.equal((await restore()).state,'active');await move(1);assert.equal((await purge(2)).state,'deleted');
  const foreign=await rpc('bootstrap_workspace',{name:'Cross '+crypto.randomUUID(),owner_id:f.people.owner.id,owner_email:f.people.owner.email});
  assert.equal((await req(`/workspaces/${foreign}/trash/${f.a}/status`)).status,404);
});
check(196,'ordinary/imported atomic authority and never-opened Move without capture',async()=>{
  const authority=await dbRows('board_lifecycle');assert.equal(authority[0].state,'active');assert.equal(authority[0].cycle,0);
  const moved=await move();assert.equal(moved.restoreBefore-moved.deletedAt,2592000000);assert.equal((await rows('versions')).length,0);
  const imported=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:'Imported',document:{...empty(),title:'Source'}},201);
  assert.equal((await dbRows('board_lifecycle',{board_id:imported.id}))[0].state,'active');assert.equal((await driver.rows(imported.id,'versions')).length,1);
});
check(197,'fence blocks held edits/old tickets and role-change 4403 still reconnects',async()=>{
  const c=await join(),ticket=await ok(`/boards/${f.a}/join-tickets`,'owner','POST',undefined,201);const before=await backup();await driver.control({holdRoom:'message'});const message=await edit(c,'Held private change',false);await move();await driver.control({releaseRoom:true});await until(()=>c.peer.closed===4403);
  assert(!c.peer.messages.some(m=>m.requestId===message.requestId&&m.kind==='saved'));assert.equal((await rows('meta')).find(r=>r.key==='revision').value,before.tables.meta.find((r:any)=>r.key==='revision').value);assert.deepEqual(await rows('versions'),before.tables.versions);
  assert.equal((await driver.request(`/boards/${f.a}/join?ticket=${ticket.ticket}`,{headers:{Origin:context.origin}})).status,401);
  const other=await join('editor',f.b);await rpc('write_member_role',{workspace:f.workspace,person:f.people.editor.id,role:'viewer'});await driver.control({scheduled:true});await until(()=>other.peer.closed===4403);const viewer=await join('editor',f.b);assert.equal(viewer.joined.role,'viewer');
});
check(198,'accepted history intents settle before admission; reverse ordering denies history',async()=>{
  for(const failure of ['fence','local','cleanup']){
    if(failure!=='fence')f=await helper('removal-fixture');const v=(await versions()).versions[0],head=(await versions()).head;await driver.control({failHistory:failure});
    const request={requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation};assert.equal((await req(`/boards/${f.a}/versions/${v.id}/restore`,'owner','POST',request)).status,503);
    const intent=await rows('history_intent_chunks');assert(intent.length>0);await refused(await req(mutatePath('move'),'owner','POST',identity(0)),503,'restore_pending');assert.deepEqual(await rows('history_intent_chunks'),intent);
    await driver.control({failHistory:''});await ok(`/boards/${f.a}/versions/${v.id}/restore`,'owner','POST',request);await move();assert.equal((await req(`/boards/${f.a}/versions`)).status,404);
  }
});
check(199,'all unavailable states are filtered before paging and Trash cursors stay bounded',async()=>{
  await versions();await move();for(const suffix of ['', '/export','/participants','/versions','/versions/'+crypto.randomUUID()])assert.equal((await req(`/boards/${f.a}${suffix}`)).status,404);
  const all=await ok(`/workspaces/${f.workspace}/boards`);assert(!all.boards.some((r:any)=>r.id===f.a));assert(!(await ok('/recent-boards')).boards.some((r:any)=>r.id===f.a));
  for(let i=0;i<51;i++){const board=await rpc('create_board',{workspace:f.workspace,person:f.people.owner.id,title:'Synthetic '+i});await sql(`UPDATE nextphase_board.board_lifecycle SET state='trashed',cycle=1,generation=1,deleted_at=100000,restore_before=2592100000 WHERE board_id='${board.id}'`);}
  const first=await ok(`/workspaces/${f.workspace}/trash`);assert.equal(first.boards.length,50);assert(first.nextCursor.length<=512);assert.equal('total'in first,false);const second=await ok(`/workspaces/${f.workspace}/trash?cursor=${first.nextCursor}`);assert.equal(second.boards.length,2);assert.equal(new Set([...first.boards,...second.boards].map(r=>r.boardId)).size,52);
  const pendingIds=(await sql(`SELECT board_id FROM nextphase_board.board_lifecycle WHERE workspace_id='${f.workspace}' AND board_id<>'${f.a}' AND state='trashed' ORDER BY board_id`)).trim().split('\n');
  await sql(`UPDATE nextphase_board.board_lifecycle l SET state='moving',generation=2,operation_id=gen_random_uuid(),phase='admitted',next_attempt_at=100000,deleted_at=x.pending_time,restore_before=x.pending_time+2592000000 FROM (SELECT board_id,100000+row_number() OVER (ORDER BY board_id) AS pending_time FROM nextphase_board.board_lifecycle WHERE workspace_id='${f.workspace}' AND board_id<>'${f.a}' AND state='trashed') x WHERE l.board_id=x.board_id`);
  const pendingFirst=await ok(`/workspaces/${f.workspace}/trash`);assert.deepEqual(pendingFirst.boards.map((r:any)=>r.boardId),pendingIds.slice(0,50));
  const pendingSecond=await ok(`/workspaces/${f.workspace}/trash?cursor=${pendingFirst.nextCursor}`);assert.deepEqual(pendingSecond.boards.map((r:any)=>r.boardId),[pendingIds[50],f.a]);assert.equal(pendingSecond.nextCursor,null);
  assert.equal((await req(`/workspaces/${f.workspace}/trash?cursor=invalid`)).status,400);const foreign=await rpc('bootstrap_workspace',{name:'Other '+crypto.randomUUID(),owner_id:f.people.owner.id,owner_email:f.people.owner.email});assert.equal((await req(`/workspaces/${foreign}/trash?cursor=${first.nextCursor}`)).status,400);
});
check(200,'Trash retains confirmed document/discussion/history fingerprint without capture',async()=>{
  await fresh();const c=await join();await comment(c);await edit(c,'Confirmed');const old=await backup(),moved=await move();await driver.control({fixedNow:moved.deletedAt+2592000000-1});assert.equal((await req(`/boards/${f.a}/versions`)).status,404);assert.equal((await operator('restore',old)).status,404);
  assert.deepEqual(await rows('versions'),old.tables.versions);assert.deepEqual(await rows('comments'),old.tables.comments);assert.deepEqual(await rows('identifiers'),old.tables.identifiers);assert.equal((await rows('meta')).find(r=>r.key==='history_capture_sha256').value,old.tables.meta.find((r:any)=>r.key==='history_capture_sha256').value);
});
check(201,'higher-fence mention source/projection cleanup rejects held creation batches',async()=>{
  const c=await join(),roster=await rpc('mention_roster',{board:f.a,caller:f.people.editor.id});const target=roster.find((r:any)=>r.id===f.people.viewer.id);const person=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`presence:${f.a}:${target.id}`));const key=[...new Uint8Array(person)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32),label=target.email.split('@')[0];
  await comment(c,'@'+label,[{start:0,end:label.length+1,person:key,label}]);await until(()=>dbRows('mention_inbox'),r=>r.length>0);const source=await rows('comments'),checkpoint=(await dbRows('mention_delivery'))[0];await move();
  assert.deepEqual(await rows('comments'),source);assert.deepEqual(await rows('mention_targets'),[]);assert.deepEqual(await rows('mention_pending'),[]);assert.deepEqual(await dbRows('mention_inbox'),[]);assert.deepEqual(await dbRows('mention_leases'),[]);assert((await dbRows('mention_delivery'))[0].generation>checkpoint.generation);
  const response=await req(`/boards/${f.a}/participants`,'viewer');assert.equal(response.status,404);
});
check(202,'pre-admission failure versus durable moving phases survive restart',async()=>{
  await driver.control({failLifecycle:'before'});const request=identity(0);await refused(await req(mutatePath('move'),'owner','POST',request),503,'move_failed');assert.equal((await dbRows('board_lifecycle'))[0].state,'active');await driver.control({failLifecycle:'room'});const result=await ok(mutatePath('move'),'owner','POST',request,202);assert.equal(result.state,'moving');await gone();const old=(await dbRows('board_lifecycle'))[0];
  await driver.wake(f.a);await driver.control({failLifecycle:''});const done=await ok(mutatePath('move'),'owner','POST',request);assert.equal(done.state,'trashed');assert.equal(done.deletedAt,old.deleted_at);assert.equal(done.cycle,1);
});
check(203,'same-board restoration and actual unavailable grant revocation use current ownership',async()=>{
  const c=await join();await comment(c);await edit(c,'Current');const old=await backup();const moved=await move();
  const revoked=await ok(`/boards/${f.a}/grants/${f.people.granted.id}`,'owner','DELETE');assert.deepEqual(Object.keys(revoked).sort(),['boardId','personId','removal']);assert.equal((await dbRows('board_grants')).some((r:any)=>r.person_id===f.people.granted.id),false);
  assert.equal((await req(`/boards/${f.a}/grants/${f.people.viewer.id}`,'editor','DELETE')).status,403);assert.equal((await req(`/boards/${f.a}/grants/${f.people.viewer.id}`,'outsider','DELETE')).status,404);assert.equal((await req(`/boards/${f.a}/grants/${f.people.viewer.id}`,'invalid','DELETE')).status,401);assert.equal((await req(`/boards/${f.a}/grants/${f.people.viewer.id}`,'owner','PUT',{role:'editor'})).status,404);
  const restored=await restore();assert.equal(restored.boardId,f.a);assert.equal(restored.workspaceId,f.workspace);assert(restored.generation>moved.generation);assert.equal(restored.deletedAt,null);assert.equal(restored.restoreBefore,null);assert.equal((await req(`/boards/${f.a}`,'granted')).status,404);assert.deepEqual((await backup()).tables.comments,old.tables.comments);assert.deepEqual((await backup()).tables.versions,old.tables.versions);const next=await join();await comment(next,'Fresh');await edit(next,'Fresh edit');
});
check(204,'strict server deadline minus-one/equality/plus-one and admitted completion',async()=>{
  await fresh();let moved=await move();await driver.control({fixedNow:moved.restoreBefore-1});assert.equal((await restore()).state,'active');
  await driver.control({fixedNow:moved.restoreBefore});moved=await move(1);await driver.control({fixedNow:moved.restoreBefore,failLifecycle:'discard'});await fresh(moved.restoreBefore);await refused(await req(mutatePath('restore'),'owner','POST',identity(2)),409,'trash_expired');await driver.control({fixedNow:moved.restoreBefore+1});await refused(await req(mutatePath('restore'),'owner','POST',identity(2)),409,'trash_expired');
});
check(205,'restore/expiry and restore/purge admissions have one locked winner',async()=>{
  await fresh();const moved=await move();await driver.control({failLifecycle:'room',fixedNow:moved.restoreBefore-1});const request=identity(1);assert.equal((await pending('restore',1)).state,'restoring');await driver.control({fixedNow:moved.restoreBefore+1});await driver.control({scheduled:true});assert.equal((await dbRows('board_lifecycle'))[0].state,'restoring');await driver.control({failLifecycle:''});assert.equal((await ok(statusPath())).state,'active');
  await move(1);const outcomes=await Promise.all([req(mutatePath('restore'),'owner','POST',identity(2)),req(mutatePath('delete'),'owner','POST',identity(2))]);assert(outcomes.some(r=>r.status===200||r.status===202));const end=await ok(statusPath());assert(['active','deleted'].includes(end.state));assert.equal((await dbRows('deleted_board_ids')).length,end.state==='deleted'?1:0);void request;
});
check(206,'lost answers use cycle-bound identical receipts and stale requests cannot act later',async()=>{
  const request=identity(0);await helper('proxy',{rpc:'admit_lifecycle',failAfter:true});assert.equal((await req(mutatePath('move'),'owner','POST',request)).status,503);await helper('proxy',{rpc:'admit_lifecycle',failAfter:false});await driver.wake(f.a);const moved=await ok(mutatePath('move'),'owner','POST',request);assert.equal(moved.cycle,1);
  const receipt=(await dbRows('board_lifecycle_requests'))[0];
  assert.deepEqual(await rpc('lifecycle_recovery_request',{board:f.a,operation:receipt.operation_id}),receipt);
  assert.equal(await rpc('lifecycle_recovery_request',{board:f.b,operation:receipt.operation_id}),null);
  assert.equal(await rpc('lifecycle_recovery_request',{board:f.a,operation:crypto.randomUUID()}),null);
  await refused(await req(mutatePath('move'),'owner','POST',{...request,expectedCycle:1}),409,'request_id_reused');await restore();
  assert.equal((await dbRows('board_lifecycle_requests')).length,2);
  assert.deepEqual(await rpc('lifecycle_recovery_request',{board:f.a,operation:receipt.operation_id}),
    (await dbRows('board_lifecycle_requests')).find((row:any)=>row.operation_id===receipt.operation_id));
  assert.equal((await ok(mutatePath('move'),'owner','POST',request)).state,'active');await move(1);await refused(await req(mutatePath('move'),'owner','POST',request),409,'lifecycle_changed');await purge(2);assert.equal((await ok(mutatePath('move'),'owner','POST',request)).state,'deleted');assert.deepEqual(await dbRows('board_lifecycle_requests'),[]);
});
check(207,'live owner replacement rejects confirmation/status/receipt metadata',async()=>{
  await move();await sql(`UPDATE nextphase_board.workspace_members SET role='editor' WHERE workspace_id='${f.workspace}' AND person_id='${f.people.owner.id}';UPDATE nextphase_board.workspace_members SET role='owner' WHERE workspace_id='${f.workspace}' AND person_id='${f.people.editor.id}';`);
  await refused(await req(statusPath()),403,'role_too_low');await refused(await req(`/workspaces/${f.workspace}/trash`),403,'role_too_low');const value=await ok(statusPath(),'editor');assert.equal(value.state,'trashed');assert.equal((await ok(mutatePath('restore'),'editor','POST',identity(1))).state,'active');
});
check(208,'Trash restore never carries old notices; fresh occurrences can deliver once',async()=>{
  const c=await join();await comment(c);await driver.control({board:f.a,deliverMentions:true});await move();await restore();assert.deepEqual(await dbRows('mention_inbox'),[]);assert.deepEqual(await rows('mention_targets'),[]);assert.deepEqual(await rows('mention_pending'),[]);const next=await join();await comment(next,'Fresh explicit discussion');assert.equal((await rows('comments')).length,2);assert.deepEqual(await dbRows('mention_inbox'),[]);
});
check(209,'restoration preserves capture ages/cap/fingerprint and overdue schedule',async()=>{
  await fresh();await versions();const before=await rows('meta'),initial=await rows('versions'),moved=await move();await driver.control({fixedNow:moved.deletedAt+3600000});await restore();assert.deepEqual(await rows('versions'),initial);for(const key of ['history_capture_sha256','history_capture_bytes','history_next_at'])assert.equal((await rows('meta')).find(r=>r.key===key).value,before.find(r=>r.key===key).value);await driver.control({board:f.a,alarm:true});assert.deepEqual(await rows('versions'),initial);
  const c=await join();await edit(c,'Changed');await driver.control({fixedNow:moved.deletedAt+7200000,board:f.a,alarm:true});assert.equal((await versions()).versions.length,2);
});
check(210,'complete purge removes room inventory/files/alarms and all board-dependent SQL',async()=>{
  const c=await join();await comment(c);await save();await move();await purge();await inventory();for(const table of ['boards','board_grants','invitations','board_opens','mention_inbox','mention_leases','mention_delivery','access_changes','access_deliveries','board_lifecycle','board_lifecycle_requests'])assert.deepEqual(await dbRows(table,table==='boards'?{id:f.a}:{board_id:f.a}),[],table);const marker=(await dbRows('deleted_board_ids'))[0];assert.deepEqual(Object.keys(marker).sort(),['board_id','generation','workspace_id']);
});
check(211,'every purge phase failure remains denied and restart resumes exact durable work',async()=>{
  for(const phase of ['discard','sql','final']){if(phase!=='discard')f=await helper('removal-fixture');await versions();await move();if(phase==='discard')await driver.control({failLifecycle:'discard'});else await helper('proxy',{rpc:phase==='sql'?'lifecycle_cleanup':'lifecycle_step',fail:true});const result=await pending('delete',1);assert.equal(result.state,'purging');await gone();const progress=(await dbRows('board_lifecycle'))[0];assert(progress.operation_id);assert.equal(progress.deleted_at,null);assert.equal(progress.restore_before,null);await driver.wake(f.a);await driver.control({failLifecycle:''});for(const name of ['lifecycle_cleanup','lifecycle_step'])await helper('proxy',{rpc:name,fail:false});assert.equal((await ok(statusPath())).state,'deleted');await inventory();}
});
check(212,'minute discovery expires never-opened Trash in bounded batches without renewal',async()=>{
  await fresh();const moved=await move();await driver.control({fixedNow:moved.restoreBefore,failLifecycle:'discard'});await driver.control({scheduled:true});assert.equal((await dbRows('board_lifecycle'))[0].state,'purging');await gone();await driver.wake(f.a);await driver.control({fixedNow:moved.restoreBefore+60001,failLifecycle:''});await driver.control({scheduled:true});assert.equal((await ok(statusPath())).state,'deleted');assert.deepEqual(await dbRows('board_lifecycle'),[]);
});
check(213,'discard drains held callbacks and confirms absence with no timer/row recreation',async()=>{
  const c=await join();await driver.control({holdRoom:'message'});const message=await edit(c,'Late callback',false);await move();await purge();await driver.control({releaseRoom:true});await inventory();assert(!c.peer.messages.some(m=>m.requestId===message.requestId&&m.kind==='saved'));await gone();await inventory();
});
check(214,'logical backup/recovery checks independent authority before any protected write',async()=>{
  await versions();const saved=await backup();await move();assert.equal((await operator('restore',saved)).status,404);await purge();await driver.wake(f.a);assert.equal((await operator('restore',saved)).status,404);await gone();await inventory();
  const other=await operator('backup',undefined,f.b);assert.equal(other.status,200);assert.equal((await operator('restore',await other.json(),f.b)).status,200);
});
check(215,'runner snapshot rewind stays denied; marked-volume physical subcase is Node-only',async()=>{
  await versions();const saved=await backup();if(runner==='node'){assert(driver.volumeCopy);await driver.volumeCopy!(f.a,async()=>{await move();await purge();});measure.S215Physical='Node marked-volume recovery executed';}else{await move();await purge();measure.S215Physical='Node-only physical subcase excluded on workerd';}
  await driver.restoreFile(f.a,saved,false);await gone();assert.equal((await ok(statusPath())).state,'deleted');await inventory();
});
check(216,'SQL rewind fails closed until latest independent register/ledger is reapplied',async()=>{
  const directory=(await dbRows('boards',{id:f.a}))[0];await versions();await move();await purge();const marker=(await dbRows('deleted_board_ids'))[0];await sql(`DELETE FROM nextphase_board.deleted_board_ids WHERE board_id='${f.a}';INSERT INTO nextphase_board.boards SELECT * FROM jsonb_populate_record(NULL::nextphase_board.boards,'${JSON.stringify(directory).replaceAll("'","''")}'::jsonb);INSERT INTO nextphase_board.board_lifecycle VALUES('${f.a}','${f.workspace}','active',0,0,NULL,NULL,NULL,'idle',NULL) ON CONFLICT(board_id) DO NOTHING;`);
  await driver.wake(f.a);assert.equal((await req(`/boards/${f.a}`)).status,503);await rpc('reapply_lifecycle',{record:{boardId:f.a,workspaceId:f.workspace,generation:marker.generation}});assert.equal((await ok(statusPath())).state,'deleted');await inventory();await gone();
});
check(217,'stale directory copy and held initialization cannot recreate a deleted ID',async()=>{
  await versions();await move();await purge();await rpc('copy_saved_board',{board:f.a,title:'Stale private title',edited_at:new Date().toISOString(),generation:0,revision:999});assert.deepEqual(await dbRows('boards',{id:f.a}),[]);assert.equal((await req(`/boards/${f.a}/join-tickets`,'owner','POST')).status,404);assert.equal((await operator('backup')).status,404);await inventory();
});
check(218,'authority/independent ledger outages return 503 and never cached success',async()=>{
  await versions();await helper('proxy',{rpc:'lifecycle_value',fail:true});assert.equal((await req(`/boards/${f.a}/versions`)).status,503);await helper('proxy',{rpc:'lifecycle_value',fail:false});await driver.control({failLifecycle:'ledger'});assert.equal((await req(`/boards/${f.a}/join-tickets`,'owner','POST')).status,503);await driver.control({failLifecycle:''});assert.equal((await versions()).versions.length,1);
  await driver.control({failLifecycle:'room'});const request=identity(0);assert.equal((await ok(mutatePath('move'),'owner','POST',request,202)).state,'moving');await driver.control({failLifecycle:''});assert.equal((await ok(mutatePath('move'),'owner','POST',request)).state,'trashed');
});
function maximalBoard():BoardV13{let board:BoardV13={...empty(),title:'Large'};for(let i=0;i<120;i++)board.objects.push({id:crypto.randomUUID(),generation:crypto.randomUUID(),type:'stroke',page:board.boardId,kind:'marker',color:'black',weight:'thin',group:null,section:null,x:0,y:0,width:1000000,height:1000000,points:[[2,2],...Array.from({length:999},()=>[999998,999998] as [number,number])],order:i});for(let i=0;i<80;i++)board=add(board,'sticky',i,0);let left=2097152-new TextEncoder().encode(canonical(board)).length;for(const o of board.objects){if(!('text'in o))continue;const escaped=Math.min(1000,Math.floor(left/6));o.text='\0'.repeat(escaped);left-=escaped*6;const ascii=Math.min(1000-escaped,left);o.text+='x'.repeat(ascii);left-=ascii;}assert.equal(new TextEncoder().encode(canonical(board)).length,2097152);return board;}
check(219,'actual maximal canonical chunks and every new encoded row meet separate budgets',async()=>{
  const document=maximalBoard(),created=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:document.title,document},201);const chunks=await driver.rows(created.id,'version_chunks');assert(chunks.length>=2);assert(chunks.every(r=>r.bytes.bytes<=1048576));await versions();await driver.control({failLifecycle:'room'});await pending('move',0);const stored:any[]=[];for(const table of ['board_lifecycle','board_lifecycle_requests','deleted_board_ids'])for(const row of await dbRows(table)){const bytes=new TextEncoder().encode(JSON.stringify(row)).length;assert(bytes<131072);if(row.result)assert(new TextEncoder().encode(row.result).length<=65536);stored.push({table,bytes});}measure.S219={canonicalBytes:2097152,chunks:chunks.map(r=>r.bytes.bytes),rows:stored};
  assert.equal((await req(`/workspaces/${f.workspace}/trash?cursor=${'x'.repeat(513)}`)).status,400);
});
check(220,'small history-bearing backup after access restore preserves original ages and fingerprint',async()=>{
  await fresh();const original=(await versions()).versions[0],before=await backup();await move();await restore();const after=await backup();assert.deepEqual(after.tables.versions,before.tables.versions);await operator('restore',after);await versions();assert.equal((await versions()).versions[0].capturedAt,original.capturedAt);await driver.control({fixedNow:original.capturedAt+2592000000,board:f.a,alarm:true});assert.equal((await versions()).versions.length,0);await driver.control({backupLimit:1});assert.equal((await operator('backup')).status,413);
});
check(221,'seventeen RLS service tables and fixed-path lifecycle functions have no client privileges',async()=>{
  const inventory=await sql("SELECT count(*),bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nextphase_board' AND c.relkind='r';SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nextphase_board' AND p.proname IN ('lifecycle_value','lifecycle_owner','admit_lifecycle','lifecycle_step','lifecycle_due','lifecycle_tick','reapply_lifecycle','revoke_unavailable_board_grant') AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute') OR NOT p.proconfig @> ARRAY['search_path=\"\"']);");assert.match(inventory,/17\|t/);assert.match(inventory,/\n0\n/);
  for(const table of ['board_lifecycle','board_lifecycle_requests','deleted_board_ids']){const result=await helper('rls',{token:f.people.owner.token,table});assert(result.error||result.data.length===0);assert((await helper('rls',{token:f.people.owner.token,table,write:{board_id:f.a}})).error);}
});
check(222,'concurrent purge identities converge on one content-free terminal marker',async()=>{
  await move();const requests=[identity(1),identity(1)];const results=await Promise.all(requests.map(request=>req(mutatePath('delete'),'owner','POST',request)));assert(results.some(r=>[200,202].includes(r.status)));assert(results.every(r=>[200,202,503].includes(r.status)));const end=await ok(statusPath());assert.equal(end.state,'deleted');assert.equal(end.cycle,null);assert.equal(end.deletedAt,null);assert.equal(end.restoreBefore,null);assert.equal((await dbRows('deleted_board_ids')).length,1);assert.deepEqual(await dbRows('board_lifecycle_requests'),[]);assert.equal((await req(statusPath(),'outsider')).status,404);assert.equal((await ok(mutatePath('delete'),'owner','POST',requests[0])).state,'deleted');
});
check(223,'target cleanup preserves unrelated SQL rows and workspace-wide access history byte-for-byte',async()=>{
  await versions();const snapshot:any={};for(const table of ['workspace_members','access_log_floor'])snapshot[table]=await dbRows(table,{workspace_id:f.workspace});snapshot.board=await dbRows('boards',{id:f.b});snapshot.wide=await sql(`SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY number),'[]') FROM nextphase_board.access_changes c WHERE workspace_id='${f.workspace}' AND board_id IS NULL;`);await move();await restore();await move(1);await purge(2);for(const table of ['workspace_members','access_log_floor'])assert.deepEqual(await dbRows(table,{workspace_id:f.workspace}),snapshot[table]);assert.deepEqual(await dbRows('boards',{id:f.b}),snapshot.board);assert.equal(await sql(`SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY number),'[]') FROM nextphase_board.access_changes c WHERE workspace_id='${f.workspace}' AND board_id IS NULL;`),snapshot.wide);
});
check(224,'restart in every nonterminal lifecycle state preserves denial and exact accepted phase',async()=>{
  await versions();for(const kind of ['move','restore','delete']){
    await driver.control({failLifecycle:kind==='delete'?'discard':'room'});const cycle=kind==='move'?0:kind==='delete'?2:1,request=identity(cycle);assert.equal((await ok(mutatePath(kind),'owner','POST',request,202)).state,kind==='move'?'moving':kind==='restore'?'restoring':'purging');const before=(await dbRows('board_lifecycle'))[0];await gone();await driver.wake(f.a);await driver.control({failLifecycle:''});const result=await ok(mutatePath(kind),'owner','POST',request);assert.equal(result.generation,before.generation);assert.equal(result.state,kind==='move'?'trashed':kind==='restore'?'active':'deleted');if(kind==='restore')await move(1);
  }
  assert.equal((await ok(statusPath())).state,'deleted');assert.deepEqual(await dbRows('board_lifecycle'),[]);
});
