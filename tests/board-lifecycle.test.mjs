// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const board=randomUUID(),workspace=randomUUID();
test('L-U01 exact Trash route is a bounded TeamLink and preserves prior meanings',async()=>{
  const {parseLink}=await import('../apps/web/src/team/links.ts');
  assert.deepEqual(parseLink(`#/files/${workspace}/trash`),{kind:'trash',workspace});
  for(const fragment of ['#/files/trash','#/files//trash',`#/files/${workspace.toUpperCase()}/trash`,`#/files/${workspace}/trash/`,`#/files/${workspace}/trash?x=1`,`#/files/${workspace}/trash/extra`,'#/files/invalid/trash'])assert.deepEqual(parseLink(fragment),{kind:'bad'},fragment);
  assert.deepEqual(parseLink('#/files'),{kind:'home',workspace:undefined});assert.deepEqual(parseLink(`#/files/${workspace}`),{kind:'home',workspace});
  assert.deepEqual(parseLink(`#/b/${board}`),{kind:'board',board});assert.equal(parseLink('').kind,'local');
  assert.deepEqual(parseLink(`#/invite/${board}?board=${workspace}`),{kind:'invite',invitation:board,board:workspace});
});
test('L-U02 deadline helpers use strict elapsed milliseconds and viewer local time',async()=>{
  const {TRASH_AGE,restoreAllowed,lifecycleTime,resumedLabel,restoredNote}=await import('../apps/web/src/team/lifecycle-rules.ts');
  assert.equal(TRASH_AGE,2592000000);assert.equal(restoreAllowed(100,99),true);assert.equal(restoreAllowed(100,100),false);assert.equal(restoreAllowed(100,101),false);
  const at=Date.parse('2026-12-06T15:00:00Z');assert.equal(lifecycleTime(at),new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(at));
  assert.equal(resumedLabel('moving'),'Moving to trash…');assert.equal(resumedLabel('restoring'),'Restoring…');assert.equal(resumedLabel('purging'),'Deletion pending');assert.match(restoredNote,/Some older versions may have expired\.$/);
});
test('L-U03 mutation cycle/request identities are immutable and journals are bounded in UTF-8',async()=>{
  const {lifecycleRequest}=await import('../apps/web/src/team/lifecycle-rules.ts');const {boundedJournal,safeInteger}=await import('../packages/board-room/src/lifecycle.ts');
  const request=lifecycleRequest(7,board);assert(Object.isFrozen(request));assert.deepEqual(request,{requestId:board,expectedCycle:7});
  for(const n of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'0']){assert.equal(safeInteger(n),false);assert.throws(()=>lifecycleRequest(n));}
  const maximum={phase:'admitted',metadata:'x'.repeat(65502)};assert(new TextEncoder().encode(boundedJournal(maximum)).length<=65536);
  assert.throws(()=>boundedJournal({metadata:'😀'.repeat(16384)}));assert.throws(()=>boundedJournal({identifiers:[board]}));assert.throws(()=>boundedJournal({generation:1.5}));
});
async function fixture(){
  const {Room}=await import('../packages/board-room/src/room.ts');const {NodeStorage}=await import('../apps/server/src/node-storage.ts');
  const storage=new NodeStorage(':memory:'),peers=[],closed=[];let now=100000,unreadable=false,fence=0;
  let authority={boardId:board,workspaceId:workspace,state:'active',cycle:0,generation:0,deletedAt:null,restoreBefore:null,phase:'idle',operationId:null};
  const source={async lifecycle(){if(unreadable)throw Error('authority');return authority;},async admitLifecycle(_board,request,at,floor){assert.equal(request.expectedCycle,authority.cycle);authority={...authority,state:'moving',cycle:authority.cycle+1,generation:floor+1,operationId:randomUUID(),phase:'admitted',deletedAt:at,restoreBefore:at+2592000000};return authority;}};
  const env={storage,lifecycle:source,now:()=>now,access:{board:async()=>({id:board,workspaceId:workspace,title:'Current',createdAt:new Date(now).toISOString()}),changes:async()=>({latest:0,lowestKept:1,changes:[]}),role:async()=>'owner'},fence:async()=>fence,raiseFence:async(min=0)=>fence=Math.max(min,fence)+1,hash:async value=>createHash('sha256').update(value).digest('hex'),randomTicket:randomUUID,randomId:randomUUID,verify:async()=>({id:board,email:'ana@example.test',expiresAt:9000000000000}),connections:()=>peers,schedule:async()=>{},backupLimit:16777216};
  const room=new Room(board,env),person=await env.verify();
  return {room,env,storage,peers,closed,person,get authority(){return authority;},set authority(v){authority=v;},unreadable(v){unreadable=v;},advance(v){now+=v;},close(){storage.close();}};
}
const request=()=>({person:board,requestId:randomUUID(),expectedCycle:0,operation:'move',workspace:null,digest:'a'.repeat(64)});
test('L-U04 ordered Move preserves confirmed canonical head and history fingerprints with no close capture',async()=>{
  const f=await fixture();try{
    await f.room.load();const before=await f.room.backup();
    f.peers.push({attachment:()=>({connectionId:'peer'}),send(){},close(code){f.closed.push(code);f.peers.splice(0); }});
    const row=await f.room.admitLifecycle(request());await f.room.fenceLifecycle(row);
    assert.equal(row.restoreBefore-row.deletedAt,2592000000);assert.deepEqual(f.closed,[4403]);
    assert.deepEqual(f.storage.all('SELECT * FROM versions').map(r=>({...r})),before.tables.versions);
    for(const table of ['snapshot_chunks','identifiers','history_requests'])assert.equal(f.storage.all(`SELECT * FROM ${table}`).length,before.tables[table].length);
    assert.equal(f.storage.all("SELECT value FROM meta WHERE key='history_capture_sha256'")[0].value,before.tables.meta.find(r=>r.key==='history_capture_sha256').value);
    await assert.rejects(f.room.versions(f.person),/not_found/);await assert.rejects(f.room.backup(),/not_found/);
    assert.equal(f.storage.all('SELECT * FROM waiting').length,0);assert.equal(f.storage.all('SELECT * FROM tickets').length,0);
  }finally{f.close();}
});
test('L-U05 accepted history intent prevents Move admission and unavailable authority fails closed',async()=>{
  const f=await fixture();try{
    await f.room.load();f.storage.exec("INSERT INTO history_requests VALUES (?, ?, ?, 'restore', ?)",board,workspace,'a'.repeat(64),JSON.stringify({phase:'intent'}));
    await assert.rejects(f.room.admitLifecycle(request()),/restore_pending/);assert.equal(f.authority.state,'active');
    f.storage.exec('DELETE FROM history_requests');f.unreadable(true);await assert.rejects(f.room.export(f.person),/service_unavailable/);assert.equal(f.room.access.locked,true);
  }finally{f.close();}
});
test('L-U06 discarded room rejects queued work without reinitializing or recapturing',async()=>{
  const f=await fixture();try{await f.room.load();const before=f.storage.all('SELECT * FROM versions');await f.room.discardLifecycle();await assert.rejects(f.room.alarm(),/not_found/);assert.deepEqual(f.storage.all('SELECT * FROM versions'),before);assert.equal(f.room.lifecycle.discarded,true);}finally{f.close();}
});
test('L-U07 independent ledger refuses generation rollback, lost registers and reversed phases',async()=>{
  const {checkLedger,ledgerRecord}=await import('../apps/server/src/lifecycle.ts');
  const row={boardId:board,workspaceId:workspace,generation:10,cycle:1,state:'purging',phase:'room_removed',operationId:board,deletedAt:null,restoreBefore:null};
  const old=ledgerRecord(row,null);assert.throws(()=>checkLedger(old,{...row,generation:9}));assert.throws(()=>checkLedger(old,{...row,phase:'admitted'}));assert.throws(()=>checkLedger(old,{...row,state:'active',phase:'idle',operationId:null}));assert.throws(()=>checkLedger(old,null));
  const marker=ledgerRecord({...row,state:'deleted',cycle:null},null);assert.deepEqual(Object.keys(marker).sort(),['boardId','generation','workspaceId']);assert.throws(()=>checkLedger(marker,{...row,state:'active'}));assert.doesNotThrow(()=>checkLedger(marker,{...row,state:'deleted',cycle:null}));assert(new TextEncoder().encode(JSON.stringify(marker)).length<131072);
});
let harness;
async function controller(){
  if(!harness){const {build}=await import('esbuild'),{mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{fileURLToPath,pathToFileURL}=await import('node:url');
    const output=await build({stdin:{contents:`export {BoardLifecycle} from './apps/web/src/team/lifecycle.ts';export {setRequest,ApiError} from './apps/web/src/team/api.ts';`,resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'lifecycle-test-port',setup(b){b.onLoad({filter:/\/team\/api\.ts$/},()=>({contents:`let request;export function setRequest(next){request=next;}export function api(...args){return request(...args);}export class ApiError extends Error{constructor(status,reason){super(reason);this.status=status;this.reason=reason;}}`,loader:'js'}));}}]});
    const folder=await mkdtemp(join(tmpdir(),'board-lifecycle-'));try{const file=join(folder,'controller.mjs');await writeFile(file,output.outputFiles[0].text);harness=await import(pathToFileURL(file).href);}finally{await rm(folder,{recursive:true,force:true});}}
  return {...harness,c:new harness.BoardLifecycle()};
}
test('L-U08 lost mutation answer retries identical identity and owner invalidation blocks late paint',async()=>{
  const {c,setRequest,ApiError}=await controller();const calls=[];
  setRequest(async(path,method,body)=>{calls.push({path,method,body});if(!method)return {state:'active',cycle:0};throw new ApiError(503,'service_unavailable');});
  await c.move({boardId:board,workspaceId:workspace,title:'Private',workspace:'Synthetic'},()=>{});await c.confirmMove(()=>assert.fail());await c.confirmMove(()=>assert.fail());assert.equal(c.dialog,'move-uncertain');assert.deepEqual(calls[1],calls[2]);
  let release;setRequest(()=>new Promise(r=>release=r));const pending=c.load(workspace);c.deny();release({boards:[{boardId:board,title:'Private'}],nextCursor:null});await pending;assert.equal(c.state,'denied');assert.deepEqual(c.rows,[]);assert.equal(c.target,undefined);
});
test('L-U09 resumed rows refresh through GET only, without creating a mutation request',async()=>{
  const {c,setRequest}=await controller();const calls=[];
  setRequest(async(path,method,body)=>{calls.push({path,method,body});if(path.endsWith('/status'))return {boardId:board,workspaceId:workspace,state:'active',cycle:1,generation:2,deletedAt:null,restoreBefore:null};return {boards:[{boardId:board,workspaceId:workspace,state:'restoring',cycle:1,generation:2}],nextCursor:null};});
  await c.load(workspace);await c.refresh(workspace,board);assert.equal(c.rowOperations.get(board).kind,'restored');assert.equal(c.rowOperations.get(board).request,undefined);assert(calls.every(call=>!call.method&&!call.body));
});
test('L-U10 confirmed unavailability terminally clears requests and ignores late wire data; 4403 alone keeps drafts',async()=>{
  const {BoardSession,encode}=await import('../packages/board-sync/src/session.ts');const {Adapter}=await import('../packages/board-sync/src/document-adapter.ts');const Y=await import('yjs');
  const adapter=new Adapter();adapter.set({schemaVersion:10,boardId:board,title:'Protected',objects:[],retiredGenerations:[]});let handlers;
  const session=await BoardSession.join({ticket:async()=>'',open:async()=>({send(){},close(){},listen(h){handlers=h;h.message(JSON.stringify({kind:'joined',role:'editor',epoch:1,revision:0,restoreGeneration:0,update:encode(Y.encodeStateAsUpdate(adapter.doc)),present:[]}));}}),clock:{now:Date.now,after(){return()=>{};}}});
  session.commentRequests.set('draft',{state:'unconfirmed',text:'protected',epoch:1,restoreGeneration:0});handlers.close(4403);assert.equal(session.commentRequests.size,1);session.unavailable();assert.doesNotMatch(JSON.stringify(session.doc.toJSON()),/Protected/);assert.equal(session.commentRequests.size,0);assert.equal(session.requests.size,0);handlers.message(JSON.stringify({kind:'comments_snapshot',done:true}));assert.equal(session.commentsReady,false);adapter.destroy();
});

test('Worker purge consumes success and failure response bodies before allowing eviction',async()=>{
  const {workerRuntime}=await import('../apps/server/src/worker-runtime.ts');
  for(const status of [200,503]){
    const response=Response.json(status===200?{}:{error:{reason:'service_unavailable'}},{status});
    const binding={idFromName:id=>id,get:()=>({fetch:async()=>response})};
    const runtime=workerRuntime({ROOMS:binding,FENCES:binding,SUPABASE_URL:'http://127.0.0.1',SUPABASE_SERVICE_KEY:'synthetic',JWKS:'{"keys":[]}',ALLOWED_ORIGIN:'http://127.0.0.1'});
    if(status===200)await runtime.removeRoom(board,1);else await assert.rejects(runtime.removeRoom(board,1),/service_unavailable/);
    assert.equal(response.bodyUsed,true,'the internal discard response must release its body reference');
  }
});

test('lifecycle Cancel restores focus only at the post-unmount boundary and invalidation cancels it',async()=>{
  const {c}=await controller();let focused=0;
  const row={boardId:board,workspaceId:workspace,title:'Synthetic',cycle:1,state:'trashed'};
  c.delete(row,'Workspace',()=>focused++);c.cancel();assert.equal(c.dialog,null);assert.equal(focused,0);
  c.restoreFocus();assert.equal(focused,1);c.restoreFocus();assert.equal(focused,1);
  c.delete(row,'Workspace',()=>focused++);c.cancel();c.clear();c.restoreFocus();assert.equal(focused,1);
});

test('Worker discarded rooms drop late socket callbacks without reopening storage',async()=>{
  const {WorkerRoom}=await import('../apps/server/src/worker-room.ts');
  const room=new WorkerRoom({},{}),closed=[];room.discarded=true;
  await room.webSocketMessage({close:code=>closed.push(code)},'{}');
  assert.deepEqual(closed,[4403]);assert.equal(room.room,undefined);
});
