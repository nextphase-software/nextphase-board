// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import * as Y from 'yjs';
async function fixture() {
  const { Room } = await import('../packages/board-room/src/room.ts');
  const { NodeStorage } = await import('../apps/server/src/node-storage.ts');
  const storage = new NodeStorage(':memory:'), board = randomUUID(), person = { id: randomUUID(), email:'ana@example.com', expiresAt:9000000000000 };
  let now = 1793955600000, generation = 0, role = 'editor', failCarry = false;
  const peers = [], messages = [], carries = [];
  const env = { storage, now:()=>now, connections:()=>peers, schedule:async()=>{}, backupLimit:16777216,
    access:{board:async()=>({id:board,title:'A',createdAt:new Date(now).toISOString()}),role:async()=>role,changes:async()=>({changes:[],latest:0,lowestKept:1})},
    fence:async()=>generation, raiseFence:async(min=0)=>generation=Math.max(generation,min)+1,
    hash:async data=>createHash('sha256').update(data).digest('hex'), randomId:randomUUID,randomTicket:randomUUID,verify:async()=>person,
    mentions:{documentGeneration:async()=>generation,mentionGeneration:async()=>generation,validTargets:async(_b,targets)=>targets.map(t=>t.occurrence),clearNotices:async()=>{},
      carryNotices:async(...args)=>{if(failCarry)throw Error('carry');carries.push(args);}} };
  let room = new Room(board,env); await room.load();
  return { get room(){return room;}, env, storage, person, messages, peers,carries,
    now:()=>now, advance:ms=>{now+=ms;}, role:v=>{role=v;}, carryFail:v=>{failCarry=v;}, restart:async()=>{room=new Room(board,env);await room.load();},
    head:async()=> (await room.versions(person)).head, list:async()=> (await room.versions(person)).versions,
    save:(name='')=>room.saveVersion(person,{requestId:randomUUID(),name,description:''}),
    rename:title=>room.rename(person,title), close:()=>{room.doc.destroy();storage.close();} };
}
test('H-U01 initial capture, manual equality and immutable named metadata use canonical confirmed documents',async()=>{
  const {versionHeading}=await import('../packages/board-sync/src/history.ts');const f=await fixture();try{
    const initial=(await f.list())[0];assert.equal(initial.reason,'initial');assert.equal(initial.revision,0);assert.equal(versionHeading(initial),'Initial version');
    const {version}=await f.save('Ready');assert.equal((await f.list()).length,2);
    const before=await f.room.version(f.person,version.id);await f.room.nameVersion(f.person,version.id,{name:'😀'.repeat(100),description:'😀'.repeat(500)});
    const after=await f.room.version(f.person,version.id);assert.equal(after.version.capturedAt,before.version.capturedAt);assert.equal(after.version.ordinal,before.version.ordinal);assert.deepEqual(after.document,before.document);
    await f.restart();assert.equal((await f.list()).length,2);
  }finally{f.close();}
});
test('H-U02 capture SHA-256 survives complete expiry, changed revisions and snapshot pruning',async()=>{
  await import('../packages/board-room/src/history.ts');const f=await fixture();try{
    const fp=f.storage.all("SELECT * FROM meta WHERE key IN ('history_capture_sha256','history_capture_bytes')");
    await f.rename('B');await f.rename('A');f.advance(2592000000);await f.room.alarm();assert.equal((await f.list()).length,0);
    assert.deepEqual(f.storage.all("SELECT * FROM meta WHERE key IN ('history_capture_sha256','history_capture_bytes')"),fp);
    await f.restart();await f.room.history.automatic('last_close');assert.equal((await f.list()).length,0);
    await f.rename('C');await f.room.history.automatic('last_close');assert.equal((await f.list()).length,1);assert.notDeepEqual(f.storage.all("SELECT * FROM meta WHERE key IN ('history_capture_sha256','history_capture_bytes')"),fp);
    await f.save();assert.equal((await f.list()).length,2);
  }finally{f.close();}
});
test('H-U03 failed capture transaction preserves deadline and fingerprint then retries once',async()=>{
  await import('../packages/board-room/src/history.ts');const f=await fixture();try{
    await f.rename('B');f.advance(1800000);const before=f.storage.all('SELECT * FROM meta');const exec=f.storage.exec.bind(f.storage);
    f.storage.exec=(sql,...args)=>{if(sql.startsWith('INSERT INTO version_chunks'))throw Error('capture failure');exec(sql,...args);};
    await assert.rejects(f.room.alarm(),/capture failure/);assert.deepEqual(f.storage.all('SELECT * FROM meta'),before);f.storage.exec=exec;
    await f.restart();await f.room.alarm();assert.equal((await f.list()).length,2);await f.room.alarm();assert.equal((await f.list()).length,2);
  }finally{f.close();}
});
test('H-U04 retention is newest 50 and exact elapsed 30 days; naming renews nothing',async()=>{
  const {HISTORY_AGE}=await import('../packages/board-sync/src/history.ts');const f=await fixture();try{
    const first=(await f.list())[0];for(let i=0;i<50;i++)await f.save('N'+i);
    const list=await f.list();assert.equal(list.length,50);assert.equal(list[0].ordinal,51);assert.equal(f.storage.all('SELECT * FROM version_chunks WHERE version_id = ?',first.id).length,0);
    const selected=list[0];f.advance(HISTORY_AGE-1);await f.room.nameVersion(f.person,selected.id,{name:'Still old',description:''});await f.room.version(f.person,selected.id);
    f.advance(1);await assert.rejects(f.room.version(f.person,selected.id),/not_found/);assert.equal((await f.list()).length,0);assert.equal(JSON.parse(await f.room.export(f.person)).title,'A');
  }finally{f.close();}
});
test('H-U05 metadata rejects controls, malformed Unicode and over-limit code points atomically',async()=>{
  const {metadataValid}=await import('../packages/board-sync/src/history.ts');assert(metadataValid('😀'.repeat(100),100));const f=await fixture();try{
    for(const [name,description]of[['😀'.repeat(101),''],['','x'.repeat(501)],['\ud800',''],['\0','']])await assert.rejects(f.room.saveVersion(f.person,{requestId:randomUUID(),name,description}),/bad_request/);
    assert.equal((await f.list()).length,1);await f.save('');assert.equal((await f.list()).length,2);
  }finally{f.close();}
});
test('H-U06 restore keeps same board and before state, consecutive ordinals and durable original result',async()=>{
  await import('../packages/board-room/src/history.ts');const f=await fixture();try{
    const selected=(await f.list())[0];await f.rename('B');const head=await f.head(),request={requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation};
    const result=await f.room.restoreVersion(f.person,selected.id,request);assert.equal(f.room.board.title,'A');assert.equal(f.room.board.boardId,f.room.boardId);assert.equal(result.revision,head.revision+1);assert(result.generation>head.generation);
    const list=await f.list();assert.equal(list[0].reason,'restored');assert.equal(list[1].reason,'before_restore');assert.equal(list[0].ordinal,list[1].ordinal+1);assert.equal((await f.room.version(f.person,list[1].id)).document.title,'B');
    assert.equal(f.storage.all('SELECT * FROM history_intent_chunks').length,0);await f.restart();f.advance(2592000000);assert.deepEqual(await f.room.restoreVersion(f.person,selected.id,request),result);
    await assert.rejects(f.room.restoreVersion(f.person,selected.id,{...request,expectedRevision:99}),/request_id_reused/);
  }finally{f.close();}
});
test('H-U07 stale confirmation refuses without capture; explicit fresh confirmation succeeds',async()=>{
  await import('../packages/board-room/src/history.ts');const f=await fixture();try{
    const selected=(await f.list())[0],head=await f.head();await f.rename('B');
    await assert.rejects(f.room.restoreVersion(f.person,selected.id,{requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation}),/head_changed/);assert.equal((await f.list()).length,1);
    const fresh=await f.head();await f.room.restoreVersion(f.person,selected.id,{requestId:randomUUID(),expectedRevision:fresh.revision,expectedGeneration:fresh.generation});assert.equal((await f.list()).length,3);
  }finally{f.close();}
});
test('H-U08 pending carry stays locked with chunk references; terminal result, cleanup and unlock are atomic',async()=>{
  await import('../packages/board-room/src/history.ts');const f=await fixture();try{
    const selected=(await f.list())[0];await f.rename('B');const head=await f.head(),req={requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation};
    f.carryFail(true);await assert.rejects(f.room.restoreVersion(f.person,selected.id,req),/restore_pending/);
    const row=f.storage.all('SELECT * FROM history_requests')[0],intent=JSON.parse(row.result);assert.equal(intent.phase,'replaced');assert(!row.result.includes('objects'));assert.equal(f.storage.all('SELECT * FROM history_intent_chunks').length,2);
    await assert.rejects(f.room.backup(),/restore_pending/);await f.restart();assert(f.room.access.locked);f.carryFail(false);
    const exec=f.storage.exec.bind(f.storage);f.storage.exec=(sql,...args)=>{if(sql.startsWith('DELETE FROM history_intent_chunks'))throw Error('cleanup');exec(sql,...args);};
    await assert.rejects(f.room.restoreVersion(f.person,selected.id,req),/restore_pending/);assert.equal(JSON.parse(f.storage.all('SELECT * FROM history_requests')[0].result).phase,'replaced');assert.equal(f.storage.all('SELECT * FROM history_intent_chunks').length,2);assert(f.room.access.locked);
    f.storage.exec=exec;await f.room.restoreVersion(f.person,selected.id,req);assert.equal(f.storage.all('SELECT * FROM history_intent_chunks').length,0);assert.equal(f.room.access.locked,false);assert.equal((await f.list()).length,3);
  }finally{f.close();}
});
test('H-U09 intent creation rollback leaves no journal/chunks/head/history changes',async()=>{
  await import('../packages/board-room/src/history.ts');const f=await fixture();try{
    const selected=(await f.list())[0],head=await f.head(),before=await f.room.backup(),exec=f.storage.exec.bind(f.storage);
    f.storage.exec=(sql,...args)=>{if(sql.startsWith('INSERT INTO history_requests'))throw Error('intent');exec(sql,...args);};
    await assert.rejects(f.room.restoreVersion(f.person,selected.id,{requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation}),/restore_failed/);f.storage.exec=exec;
    assert.deepEqual((await f.room.backup()).tables,before.tables);assert.equal(f.storage.all('SELECT * FROM history_intent_chunks').length,0);
  }finally{f.close();}
});
test('H-U10 current backup validates required fingerprint including expiry and refuses aggregate overflow',async()=>{
  const {validateHistoryBackup}=await import('../packages/board-room/src/history.ts');const {decodeBackup}=await import('../packages/board-room/src/backups.ts');const f=await fixture();try{
    const envelope=await f.room.backup();let raises=0;const raise=f.env.raiseFence;f.env.raiseFence=async v=>{raises++;return raise(v);};
    for(const mutate of [b=>b.tables.meta.splice(b.tables.meta.findIndex(r=>r.key==='history_capture_sha256'),1),b=>b.tables.meta.find(r=>r.key==='history_capture_bytes').value=0,b=>b.tables.meta.find(r=>r.key==='history_capture_sha256').value='0'.repeat(64),b=>b.tables.history_intent_chunks.push({person_id:randomUUID(),request_id:randomUUID(),kind:'selected',chunk_index:0,bytes:'YQ=='})]){
      const bad=structuredClone(envelope);mutate(bad);await assert.rejects(f.room.restore(bad),/bad_request/);assert.equal(raises,0);
    }
    f.advance(2592000000);await f.room.alarm();await f.rename('Uncaptured');const expired=await f.room.backup();await validateHistoryBackup(f.env,decodeBackup(expired,f.room.boardId).tables,f.room.boardId);
    f.env.backupLimit=10;await assert.rejects(f.room.backup(),/backup_too_large/);
  }finally{f.close();}
});
test('H-U11 confirmation author uses namedBy before actor and omits both-null separator',async()=>{
  const {confirmationAuthor}=await import('../packages/board-sync/src/history.ts');
  assert.equal(confirmationAuthor({namedBy:'ana',actor:'ben'}),'ana');assert.equal(confirmationAuthor({namedBy:'ana',actor:null}),'ana');assert.equal(confirmationAuthor({namedBy:null,actor:'ben'}),'ben');assert.equal(confirmationAuthor({namedBy:null,actor:null}),null);
});
test('H-U12 viewer-local formatting and Pan handoff rules are explicit without altering ordinary tools',async()=>{
  const {historyTime,historyTool}=await import('../apps/web/src/team/history-rules.ts');const at=Date.parse('2026-11-06T10:00Z');
  assert.equal(historyTime(at),new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(at));
  assert.equal(historyTool(true,false,'Select'),'Pan');assert.equal(historyTool(false,true,'Comment'),'Pan');assert.equal(historyTool(false,false,'Comment'),'Comment');
});
test('H-U13 immutable edit envelope captures generation once and stale work cannot read a saved receipt',async()=>{
  const {BoardSession,encode}=await import('../packages/board-sync/src/session.ts');const {Adapter}=await import('../packages/board-sync/src/document-adapter.ts');const f=await fixture();try{
    const adapter=new Adapter();adapter.set(f.room.board);let handlers;const wires=[];
    const session=await BoardSession.join({ticket:async()=>'',clock:{now:()=>0,after:()=>()=>{}},open:async()=>({send:v=>wires.push(v),close:()=>{},listen:h=>{handlers=h;h.message(JSON.stringify({kind:'joined',role:'editor',epoch:2,restoreGeneration:3,revision:0,update:encode(Y.encodeStateAsUpdate(adapter.doc)),present:[]}));}})});
    session.edit({...session.board,title:'B'});const first=wires[0];assert.deepEqual(Object.keys(JSON.parse(first)),['kind','epoch','requestId','update','restoreGeneration']);assert.equal(JSON.parse(first).restoreGeneration,3);
    session.restoreGeneration=9;session.sendRequest(JSON.parse(first).requestId);assert.equal(wires[1],first);session.close();adapter.destroy();
    const ticket=await f.room.ticket(f.person),attachment=await f.room.join(ticket.ticket);const peer={attachment:()=>attachment,attach:v=>Object.assign(attachment,v),send:v=>f.messages.push(JSON.parse(v)),close:()=>{}};f.peers.push(peer);await f.room.connected(peer);
    const update=Buffer.from(Y.encodeStateAsUpdate(f.room.doc)).toString('base64'),id=randomUUID();await f.room.message(peer,JSON.stringify({kind:'edit',epoch:attachment.epoch,requestId:id,update,restoreGeneration:0}));assert.equal(f.messages.at(-1).kind,'saved');
    f.storage.exec("UPDATE meta SET value=1 WHERE key='restore_generation'");await f.room.message(peer,JSON.stringify({kind:'edit',epoch:attachment.epoch,requestId:id,update,restoreGeneration:0}));assert.equal(f.messages.at(-1).reason,'restore_changed');
  }finally{f.close();}
});
async function webHarness(hook = false) {
  const {build}=await import('esbuild'),{mkdtemp,writeFile,rm}=await import('node:fs/promises'),{join}=await import('node:path'),{tmpdir}=await import('node:os'),{pathToFileURL,fileURLToPath}=await import('node:url');
  const result=await build({stdin:{contents:`export {HostedBoard} from './apps/web/src/team/hosted-board.ts'; export {setRequest,ApiError} from './apps/web/src/team/api.ts'; ${hook ? "export {useHostedBoard} from './apps/web/src/state/use-hosted-board.ts';" : "export {HistoryPanel} from './apps/web/src/team/history-panel.tsx'; export {renderToStaticMarkup} from 'react-dom/server'; export {createElement} from 'react';"}`,resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},plugins:[{name:'history-unit-ports',setup(b){
    b.onLoad({filter:/\/team\/api\.ts$/},()=>({contents:`let request; export function setRequest(next){request=next;} export function api(...args){return request(...args);} export class ApiError extends Error {constructor(status,reason){super(reason);this.status=status;this.reason=reason;}}`,loader:'js'}));
    b.onLoad({filter:/\/team\/auth\.ts$/},()=>({contents:'export const auth={};',loader:'js'}));
    b.onLoad({filter:/\/team\/config\.ts$/},()=>({contents:`export const socketOrigin='ws://127.0.0.1';`,loader:'js'}));
    if(hook)b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'history-hooks'}));
    if(hook)b.onLoad({filter:/.*/,namespace:'history-hooks'},()=>({contents:'export const useEffect = callback => callback();',loader:'js'}));
  }}]});
  const folder=await mkdtemp(join(tmpdir(),'board-history-unit-'));try{const path=join(folder,'test.mjs');await writeFile(path,result.outputFiles[0].text);return await import(pathToFileURL(path).href);}finally{await rm(folder,{recursive:true,force:true});}
}
function readyHost(HostedBoard) {
  const board={schemaVersion:10,boardId:randomUUID(),title:'Live',objects:[],retiredGenerations:[]},host=new HostedBoard({kind:'board',board:board.boardId},()=>{});
  host.snapshot={...host.snapshot,board,role:'editor',connected:true};host.session={requests:new Map(),commentRequests:new Map(),threads:new Map(),history:{past:[],future:[]},commentsReady:true,discard(){},close(){}};
  return host;
}
test('H-U14 actual hosted hook activates Pan before preview request and preserves every current/restore handoff',async()=>{
  await import('../apps/web/src/team/history-rules.ts');const {HostedBoard,useHostedBoard,setRequest}=await webHarness(true);
  const host=readyHost(HostedBoard),model={current:host.snapshot.board};let tool='Select',inline=true;const tools=[];
  const setTool=value=>{tool=typeof value==='function'?value(tool):value;tools.push(tool);};
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>0;
  try{
    const hookInput={hosted:host,model,load:b=>{model.current=b;},setBoard:b=>{model.current=b;},setTitle(){},setReadOnly(){},setDrafts(){},setInline:v=>{inline=v;},setTool,select(){},paste(){},composing:false};
    useHostedBoard(hookInput);
    const selected={id:randomUUID(),ordinal:1,capturedAt:1,revision:0,generation:0,reason:'manual',name:'Selected',description:'',actor:'ana',namedBy:null,sourceName:''};
    const held=[];setRequest(()=>{assert.equal(tool,'Pan','must activate before starting HTTP');return new Promise(resolve=>held.push(resolve));});
    const first=host.history.select(selected);assert.equal(tool,'Pan');assert.equal(inline,false);held.shift()({version:selected,document:{...model.current,title:'Historical'}});await first;setTool('Select');useHostedBoard(hookInput);assert.equal(tool,'Pan','passive handoff follows canvas cancellation');assert.equal(model.current.title,'Historical');assert.equal(host.snapshot.board.title,'Live');
    host.snapshot.board={...host.snapshot.board,title:'Latest'};host.history.current();assert.equal(model.current.title,'Latest');assert.equal(tool,'Pan');
    setTool('Comment');host.historyChanged();assert.equal(tool,'Comment','explicit later tool works');
    const second=host.history.select(selected);held.shift()({version:selected,document:{...host.snapshot.board,title:'History'}});await second;host.snapshot.connected=false;host.history.restoring('ana');host.history.current();assert.equal(tool,'Pan');host.historyChanged();assert.equal(tool,'Pan');
    host.snapshot.connected=true;host.history.rejoined(true);host.history.panEpoch++;host.panReturning=false;host.historyChanged();assert.equal(tool,'Pan');assert(tools.includes('Pan'));host.snapshot.role='viewer';const third=host.history.select(selected);held.shift()({version:selected,document:{...host.snapshot.board,title:'Viewer preview'}});await third;host.history.current();host.historyChanged();assert.equal(tool,'Pan','viewer current return keeps Pan');
  }finally{globalThis.requestAnimationFrame=previous;}
});
test('H-U15 actual confirmation rendering attributes namedBy first and has no null-author separator',async()=>{
  await import('../apps/web/src/team/history-rules.ts');const {HostedBoard,HistoryPanel,renderToStaticMarkup,createElement}=await webHarness();const host=readyHost(HostedBoard);
  const base={id:randomUUID(),ordinal:1,capturedAt:Date.parse('2026-11-06T10:00Z'),revision:0,generation:0,reason:'manual',name:'Ready',description:'',sourceName:''};
  const {historyTime}=await import('../apps/web/src/team/history-rules.ts');
  for(const [namedBy,actor,expected] of [['ana','ben','ana'],['ana',null,'ana'],[null,'ben','ben'],[null,null,null]]){
    host.history.selected={...base,namedBy,actor};host.history.dialog='confirm';const html=renderToStaticMarkup(createElement(HistoryPanel,{hosted:host}));
    const line=html.match(/<br\s*\/>([^<]*)/)[1];assert.equal(line,historyTime(base.capturedAt)+(expected===null?'':' · '+expected));
  }
});
test('H-U16 two maximal intent documents use four raw chunks and a bounded metadata-only journal',async()=>{
  await import('../packages/board-room/src/history.ts');const {add,canonical}=await import('../packages/board-rules/src/document.ts');const f=await fixture();try{
    let board={...f.room.board,title:'Large'};
    for(let i=0;i<120;i++)board.objects.push({id:randomUUID(),generation:randomUUID(),type:'stroke',kind:'marker',color:'black',weight:'thin',group:null,section:null,x:0,y:0,width:1000000,height:1000000,points:[[2,2],...Array.from({length:999},()=>[999998,999998])],order:i});
    for(let i=0;i<80;i++)board=add(board,'sticky',i,0);
    let left=2097152-Buffer.byteLength(canonical(board));for(const object of board.objects){if(!('text'in object))continue;const escaped=Math.min(1000,Math.floor(left/6));object.text='\0'.repeat(escaped);left-=escaped*6;const ascii=Math.min(1000-escaped,left);object.text+='x'.repeat(ascii);left-=ascii;}
    assert.equal(Buffer.byteLength(canonical(board)),2097152);
    const {Adapter}=await import('../packages/board-sync/src/document-adapter.ts'),{snapshot}=await import('../packages/board-room/src/snapshots.ts');const adapter=new Adapter();adapter.set(board);
    f.storage.transaction(()=>{snapshot(f.storage,adapter.doc,board,1);f.storage.exec("UPDATE meta SET value=1 WHERE key='revision'");for(const o of board.objects)f.storage.exec('INSERT INTO identifiers VALUES (?, ?, 1)',o.id,o.generation);});f.room.doc.destroy();f.room.doc=adapter.doc;f.room.board=board;
    const selected=(await f.save()).version;await f.rename('Other');const head=await f.head(),request={requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation};f.carryFail(true);
    await assert.rejects(f.room.restoreVersion(f.person,selected.id,request),/restore_pending/);const chunks=f.storage.all('SELECT * FROM history_intent_chunks');assert.equal(chunks.length,4);assert(chunks.every(r=>r.bytes.length===1048576));
    const journal=f.storage.all('SELECT result FROM history_requests WHERE request_id=?',request.requestId)[0].result;assert(Buffer.byteLength(journal)<=65536);assert(!journal.includes('objects'));assert(!journal.includes('界'));
    console.log('H-MEASURE '+JSON.stringify({intentDocuments:[2097152,2097152],rawChunkBytes:chunks.map(r=>r.bytes.length),journalBytes:Buffer.byteLength(journal)}));
    f.carryFail(false);await f.room.restoreVersion(f.person,selected.id,request);assert.equal(f.storage.all('SELECT * FROM history_intent_chunks').length,0);
  }finally{f.close();}
});
async function confirmedFixture(f,board,revision) {
  const {Adapter}=await import('../packages/board-sync/src/document-adapter.ts'),{snapshot}=await import('../packages/board-room/src/snapshots.ts');
  const adapter=new Adapter();adapter.set(board);f.storage.transaction(()=>{snapshot(f.storage,adapter.doc,board,revision);f.storage.exec("UPDATE meta SET value=? WHERE key='revision'",revision);for(const o of board.objects)f.storage.exec('INSERT OR IGNORE INTO identifiers VALUES (?, ?, ?)',o.id,o.generation,revision);});f.room.doc.destroy();f.room.doc=adapter.doc;f.room.board=board;
}
test('H-U17 user restore reconciles attached/missing/detached pins and retains current discussion exactly',async()=>{
  await import('../packages/board-room/src/history.ts');const {add}=await import('../packages/board-rules/src/document.ts');const f=await fixture();try{
    let selected=add(f.room.board,'sticky',0,0);await confirmedFixture(f,selected,1);const version=(await f.save()).version;
    let current=add({...selected,objects:selected.objects.map(o=>({...o,x:100,y:100}))},'sticky',500,600);await confirmedFixture(f,current,2);
    const [a,c]=current.objects,anchors=[{objectId:a.id,u:.5,v:.5,x:220,y:220,detached:false,objectLabel:'Match',objectType:'sticky'},
      {objectId:c.id,u:.5,v:.5,x:620,y:720,detached:false,objectLabel:'Missing',objectType:'sticky'},
      {objectId:a.id,u:.5,v:.5,x:777,y:888,detached:true,objectLabel:'Detached',objectType:'sticky'}];
    for(const anchor of anchors){const thread=randomUUID(),comment=randomUUID();f.storage.exec('INSERT INTO threads VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',thread,f.person.id,'a'.repeat(32),'ana',JSON.stringify(anchor),f.now(),f.now(),1,comment);f.storage.exec('INSERT INTO comments VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',comment,thread,f.person.id,'a'.repeat(32),'ana','Current',f.now(),1,'[]');}
    const comments=f.storage.all('SELECT * FROM comments'),head=await f.head();await f.room.restoreVersion(f.person,version.id,{requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});
    assert.deepEqual(f.storage.all('SELECT * FROM comments'),comments);const actual=f.storage.all('SELECT anchor FROM threads').map(r=>JSON.parse(r.anchor));
    assert.equal(actual[0].x,selected.objects[0].x+120);assert.equal(actual[0].y,selected.objects[0].y+120);assert.equal(actual[0].detached,false);assert.equal(actual[1].detached,true);assert.equal(actual[1].x,c.x+120);assert.equal(actual[1].y,c.y+120);assert.deepEqual(actual[2],anchors[2]);
  }finally{f.close();}
});
test('H-U18 historical replacement retains later identifiers and ordinary reuse remains refused',async()=>{
  await import('../packages/board-room/src/history.ts');const {add}=await import('../packages/board-rules/src/document.ts'),{Adapter}=await import('../packages/board-sync/src/document-adapter.ts'),{evaluate}=await import('../packages/board-room/src/edits.ts');const f=await fixture();try{
    const original=add(f.room.board,'sticky',0,0);await confirmedFixture(f,original,1);const version=(await f.save()).version;
    const later=add(original,'sticky',300,0);await confirmedFixture(f,later,2);const head=await f.head();await f.room.restoreVersion(f.person,version.id,{requestId:randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});
    assert.equal(f.storage.all('SELECT * FROM identifiers').length,2);const adapter=new Adapter();Y.applyUpdate(adapter.doc,Y.encodeStateAsUpdate(f.room.doc));const vector=Y.encodeStateVector(adapter.doc);adapter.set({...later,title:f.room.board.title});
    const result=evaluate(f.room.doc,f.room.board,Y.encodeStateAsUpdate(adapter.doc,vector),f.storage);assert.equal(result.kind,'refused');assert.equal(result.reason,'identifier_reused');adapter.destroy();
  }finally{f.close();}
});
test('H-U19 obsolete preview/access responses cannot repaint; confirmed-write refresh retries only GET',async()=>{
  await import('../apps/web/src/team/history-rules.ts');const {HostedBoard,setRequest}=await webHarness(true),host=readyHost(HostedBoard),h=host.history;
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>0;
  try{
    const v={id:randomUUID(),ordinal:1,capturedAt:1,revision:0,generation:0,reason:'manual',name:'One',description:'',actor:null,namedBy:null,sourceName:''},other={...v,id:randomUUID(),name:'Two'},pending=[];
    setRequest(()=>new Promise(resolve=>pending.push(resolve)));const first=h.select(v),second=h.select(other);pending[1]({version:other,document:{...host.snapshot.board,title:'Two'}});await second;pending[0]({version:v,document:{...host.snapshot.board,title:'One'}});await first;assert.equal(h.document.title,'Two');
    const late=h.select(v);h.clear();pending[2]({version:v,document:{...host.snapshot.board,title:'Secret'}});await late;assert.equal(h.document,undefined);assert.equal(h.selected,undefined);
    const calls=[];setRequest(async(path,method,body)=>{calls.push({path,method,body});if(method==='POST')return {version:v};throw Error('refresh failed');});h.begin('save',{focus(){}});await h.write();assert.equal(h.dialog,null);assert.equal(h.state,'failed');assert.equal(calls.filter(c=>c.method==='POST').length,1);
    setRequest(async(path,method)=>{calls.push({path,method});return {versions:[v],head:{revision:0,generation:0}};});await h.refresh();assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.equal(h.state,'ready');
  }finally{globalThis.requestAnimationFrame=previous;}
});
