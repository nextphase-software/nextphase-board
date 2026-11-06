// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
const key='a'.repeat(32), mention={start:2,end:6,person:key,label:'ben'};
test('M-U01 code-point ranges validate exact spans after non-BMP characters and reject forged shapes',async()=>{
 const {mentionProblem}=await import('../packages/board-sync/src/mentions.ts');
 assert.equal(mentionProblem('😀 @ben',[mention]),null);
 assert.equal(mentionProblem('x',null),'bad_mentions');
 const twenty=Array.from({length:20},(_,i)=>({...mention,start:i*5,end:i*5+4}));assert.equal(mentionProblem(Array(20).fill('@ben').join(' '),twenty),null);
 assert.equal(mentionProblem('@\ud800',[{start:0,end:2,person:key,label:'\ud800'}]),'bad_mentions');
 for(const ranges of [[{...mention,start:3}],[{...mention,end:7}],[mention,mention],[{...mention,account:'secret'}],[{...mention,person:'hidden'}]])assert(mentionProblem('😀 @ben',ranges));
 assert.equal(mentionProblem('x',Array(21).fill(mention)),'mention_limit');
 const label='😀'.repeat(64);assert.equal(mentionProblem('@'+label,[{start:0,end:65,person:key,label}]),null);
 assert(mentionProblem('@'+label+'😀',[{start:0,end:66,person:key,label:label+'😀'}]));
});
test('M-U02 replacement, insertion inside chips and range shifts preserve only unaffected mentions',async()=>{
 const {replaceRange,changedText}=await import('../packages/board-sync/src/mentions.ts');const d={text:'😀 @ben ok',mentions:[mention]};
 assert.deepEqual(replaceRange(d,0,1,'Hello').mentions,[{...mention,start:6,end:10}]);
 assert.deepEqual(replaceRange(d,4,4,'x').mentions,[]);assert.deepEqual(replaceRange(d,2,6,'').mentions,[]);
 assert.deepEqual(changedText(d,'😀 @bxen ok').mentions,[]);
 assert.deepEqual(replaceRange(d,6,6,',').mentions,[mention]);
});
test('M-U03 trigger boundary, case-insensitive substring, complete pages and extended duplicate suffixes',async()=>{
 const {triggerAt,candidatePage,duplicateSuffixes}=await import('../packages/board-sync/src/mentions.ts');
 for(const text of ['@','Hi @be','\n@be'])assert(triggerAt({text},[...text].length));
 for(const text of ['x@be','@be hi'])assert.equal(triggerAt({text},[...text].length),null);
 assert.equal(triggerAt({text:'😀 @ben',mentions:[mention]},6),null);
 const all=Array.from({length:41},(_,i)=>({label:'ben'+String(i).padStart(2,'0'),person:String(i).padStart(32,'0')}));
 assert.equal(candidatePage(all,'BEN',0).candidates.length,20);assert.equal(candidatePage(all,'ben',1).more,true);assert.equal(candidatePage(all,'',2).candidates.length,1);
 const dup=duplicateSuffixes([{label:'alex',person:'aaaaaaaa1'+'0'.repeat(23)},{label:'alex',person:'aaaaaaaa2'+'0'.repeat(23)}]);assert.deepEqual(dup.map(p=>p.suffix),['aaaaaaaa1','aaaaaaaa2']);
});
test('M-U04 actual mention save leaves canonical board, file bytes and local saved pair unchanged',async()=>{
 const {mentionProblem}=await import('../packages/board-sync/src/mentions.ts');assert.equal(mentionProblem('😀 @ben',[mention]),null);
 const f=await mentionRoom();
 try {
  const {canonical}=await import('../packages/board-rules/src/document.ts');
  const {writeBoardFile}=await import('../apps/web/src/board-file.ts');
  const {digest,readPair}=await import('../apps/web/src/storage.ts');
  const json=canonical(f.room.board),file=await writeBoardFile(f.room.board);
  const local=JSON.stringify({formatVersion:1,storageRevision:1,payload:json,sha256:await digest(json)}),pair=[local,undefined];
  const before=JSON.stringify({board:f.room.doc.toJSON(),meta:f.storage.all("SELECT * FROM meta WHERE key IN ('revision','last_edit_at')"),edits:f.storage.all('SELECT * FROM edits')});
  await f.save('😀 @ben',[mention]);
  assert.equal(canonical(f.room.board),json);assert.equal(await writeBoardFile(f.room.board),file);
  assert.equal(canonical((await readPair(pair)).board),json);assert.equal(pair[0],local);
  assert.equal(JSON.stringify({board:f.room.doc.toJSON(),meta:f.storage.all("SELECT * FROM meta WHERE key IN ('revision','last_edit_at')"),edits:f.storage.all('SELECT * FROM edits')}),before);
 } finally {f.storage.close();}
});
test('M-U05 current initialization rollback, idempotence and future-layout refusal',async()=>{
 const {initialize,meta,setMeta}=await import('../packages/board-room/src/storage.ts');const {NodeStorage}=await import('../apps/server/src/node-storage.ts');
 const s=new NodeStorage(':memory:'),execute=s.exec.bind(s);
 try {
  s.exec=(sql,...args)=>{if(sql.includes('CREATE TABLE IF NOT EXISTS mention_pending'))throw Error('initialization rollback');execute(sql,...args);};
  assert.throws(()=>initialize(s),/initialization rollback/);assert.deepEqual(s.all("SELECT name FROM sqlite_master WHERE type='table'"),[]);
  s.exec=execute;initialize(s);assert.equal(meta(s,'storage_version'),0);setMeta(s,'storage_version',4);
  const before=s.all('SELECT * FROM sqlite_master ORDER BY name');initialize(s);assert.deepEqual(s.all('SELECT * FROM sqlite_master ORDER BY name'),before);
  setMeta(s,'storage_version',5);assert.throws(()=>initialize(s),/storage_unsupported/);
 } finally{s.close();}
});
test('M-U06 shared scheduler enumerates all board IDs and retains delivery concurrency and access pass',async()=>{
 const {deliver}=await import('../apps/server/src/delivery.ts');const boards=Array.from({length:23},(_,i)=>String(i));let active=0,max=0,visited=0,access=0;
 const db={rpc:async name=>name==='mention_boards'?boards:name==='pending_access_boards'?['access']:[]};
 await deliver({db,room:()=>({deliverNotices:async()=>{active++;max=Math.max(max,active);await new Promise(r=>setImmediate(r));visited++;active--;},changed:async()=>{assert.equal(visited,23);assert.equal(active,0);access++;return 0;}})});
 assert.equal(visited,23);assert.equal(max,10);assert.equal(access,1);
});

async function mentionRoom() {
 const {Room}=await import('../packages/board-room/src/room.ts');const {NodeStorage}=await import('../apps/server/src/node-storage.ts');const {createHash}=await import('node:crypto');
 const storage=new NodeStorage(':memory:'),board=crypto.randomUUID(),peers=[];
 const recipient={id:crypto.randomUUID(),person:key,label:'ben',suffix:'',lease:crypto.randomUUID()};
 const env={storage,access:{board:async()=>({id:board,title:'Synthetic',createdAt:new Date(0).toISOString()}),changes:async()=>({changes:[],latest:0,lowestKept:1}),role:async()=> 'editor'},
  mentions:{roster:async()=>[recipient],validTargets:async(_b,targets)=>targets.map(t=>t.occurrence),project:async()=>{},clearNotices:async()=>{}},
  now:()=>10000,fence:async()=>0,raiseFence:async()=>1,hash:async value=>createHash('sha256').update(value).digest('hex'),randomId:()=>crypto.randomUUID(),randomTicket:()=>crypto.randomUUID(),
  connections:()=>peers,schedule:async()=>{},backupLimit:16777216};
 const room=new Room(board,env),ticket=await room.ticket({id:crypto.randomUUID(),email:'ana@example.test',expiresAt:100000});let attachment=await room.join(ticket.ticket);
 const messages=[],peer={attachment:()=>attachment,attach:a=>{attachment=a;},send:s=>messages.push(JSON.parse(s)),close:()=>{}};peers.push(peer);await room.connected(peer);
 async function save(text,mentions){const op={action:'start',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),anchor:{objectId:null,u:0,v:0,x:0,y:0},text,mentions};await room.message(peer,JSON.stringify({kind:'comment',requestId:crypto.randomUUID(),epoch:attachment.epoch,restoreGeneration:0,operation:op}));assert.equal(messages.at(-1).kind,'comment_saved');return op;}
 return {room,storage,env,save,messages};
}
test('M-U07 immutable normalized comment retries capture ranges, epoch and restore generation without replay or board Undo',async()=>{
 const {BoardSession,encode}=await import('../packages/board-sync/src/session.ts');const {mentionProblem}=await import('../packages/board-sync/src/mentions.ts');
 const {Adapter}=await import('../packages/board-sync/src/document-adapter.ts');const {empty,upgrade}=await import('../packages/board-rules/src/document.ts');const Y=await import('yjs');
 const adapter=new Adapter();adapter.set(upgrade(empty()));let handler,epoch=2,generation=7;const sent=[];
 const joined=()=>({kind:'joined',epoch,restoreGeneration:generation,role:'editor',revision:0,update:encode(Y.encodeStateAsUpdate(adapter.doc)),self:{},present:[]});
 const session=await BoardSession.join({ticket:async()=>'',clock:{now:()=>0,after:()=>()=>{}},open:async()=>({send:s=>sent.push(s),close:()=>{},listen:h=>{handler=h;h.message(JSON.stringify(joined()));h.message(JSON.stringify({kind:'comments_snapshot',done:true}));}})});
 try{
  const operation={action:'reply',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),text:'😀 @ben\r\n',mentions:[{...mention}]};
  const history=structuredClone(session.history.past),id=session.comment(operation),wire=sent.at(-1),body=JSON.parse(wire);
  assert.equal(body.restoreGeneration,7);assert.equal(body.epoch,2);assert.equal(body.operation.text,'😀 @ben\n');assert.equal(mentionProblem(body.operation.text,body.operation.mentions),null);
  operation.mentions[0].label='mutated';operation.text='mutated';assert.equal(session.commentRequests.get(id).text,wire);assert.deepEqual(session.history.past,history);
  session.interrupt();const before=sent.length;await session.reconnect();assert.equal(sent.slice(before).filter(s=>JSON.parse(s).kind==='comment').length,0);
  assert.equal(session.retryComment(id),id);assert.equal(sent.at(-1),wire);
  session.interrupt();generation++;await session.reconnect();assert.equal(session.retryComment(id),'access_changed');
  session.interrupt();epoch++;await session.reconnect();assert.equal(session.retryComment(id),'access_changed');
 } finally {session.close();adapter.destroy();}
});
test('M-U08 current backup validates range JSON and all tables before changing any fence or room data',async()=>{
 const {mentionProblem}=await import('../packages/board-sync/src/mentions.ts');assert.equal(mentionProblem('x',null),'bad_mentions');
 const {decodeBackup}=await import('../packages/board-room/src/backups.ts');const f=await mentionRoom();
 try{
  await f.save('😀 @ben',[mention]);const envelope=await f.room.backup(),before=JSON.stringify(envelope.tables);let fences=0;f.env.raiseFence=async()=>++fences;
  for(const mutate of [b=>{delete b.tables.mention_pending;},b=>{delete b.tables.mention_targets;},b=>{b.tables.comments[0].mentions='null';},b=>{b.tables.comments[0].mentions='[{}]';},b=>{b.tables.comments[0].mentions='broken';}]){
   const bad=structuredClone(envelope);mutate(bad);await assert.rejects(f.room.restore(bad),/bad_request/);assert.equal(fences,0);assert.equal(JSON.stringify((await f.room.backup()).tables),before);
  }
  assert.deepEqual(decodeBackup(envelope,f.room.boardId).tables.comments,envelope.tables.comments);
 }finally{f.storage.close();}
});
test('M-U09 chip replacement and plain paste support local undo without retaining pasted recipients',async()=>{
 const {replaceRange,changedText}=await import('../packages/board-sync/src/mentions.ts');
 const original={text:'😀 @ben ok',mentions:[mention]},past=[structuredClone(original)];
 const cut=replaceRange(original,2,6,'');assert.equal(cut.text,'😀  ok');assert.deepEqual(cut.mentions,[]);
 const paste=replaceRange(cut,2,2,'@ben');assert.equal(paste.text,original.text);assert.deepEqual(paste.mentions,[]);
 const undo=past.pop();assert.deepEqual(undo,original);assert.deepEqual(changedText(original,'😀 @ben\n ok').mentions,[mention]);
});
for(const failing of ['document','mention','fence'])test(`M-U10 marked-volume floor fails closed on ${failing} read/write and retries explicitly`,async()=>{
 const {recoveryGeneration}=await import('../apps/server/src/start-node.ts');const {NodeStorage}=await import('../apps/server/src/node-storage.ts');const {initialize,setMeta}=await import('../packages/board-room/src/storage.ts');
 const s=new NodeStorage(':memory:');initialize(s);setMeta(s,'restore_pending',1);setMeta(s,'restore_generation',12);let failure=failing,writes=0;
 const db={documentGeneration:async()=>{if(failure==='document')throw Error('checkpoint failed');return 9;},mentionGeneration:async()=>{if(failure==='mention')throw Error('checkpoint failed');return 23;}};
 const fences={read:async()=>15,raise:async(_board,floor)=>{writes++;if(failure==='fence')throw Error('fence failed');return floor+1;}};
 try{await assert.rejects(recoveryGeneration('board',s,db,fences),/failed/);assert.equal(writes,failing==='fence'?1:0);failure='';assert.equal(await recoveryGeneration('board',s,db,fences),24);}finally{s.close();}
});
test('M-U11 generation floor validates both checkpoints and absent versus unreadable mention state',async()=>{
 const {Supabase}=await import('../apps/server/src/supabase.ts');const {recoveryGeneration}=await import('../apps/server/src/start-node.ts');const {NodeStorage}=await import('../apps/server/src/node-storage.ts');const {initialize,setMeta}=await import('../packages/board-room/src/storage.ts');
 const db=new Supabase('http://127.0.0.1','synthetic');db.rows=async table=>table==='boards'?[{document_generation:4}]:[];
 assert.equal(await db.mentionGeneration('b'),0);assert.equal(await db.documentGeneration('b'),4);
 for(const value of [null,-1,NaN,Infinity,'7',Number.MAX_SAFE_INTEGER+1]){db.rows=async()=>[{document_generation:value,generation:value}];await assert.rejects(db.documentGeneration('b'));await assert.rejects(db.mentionGeneration('b'));}
 db.rows=async()=>[];await assert.rejects(db.documentGeneration('b'));db.rows=async()=>{throw Error('unavailable');};await assert.rejects(db.mentionGeneration('b'));
 const s=new NodeStorage(':memory:');initialize(s);setMeta(s,'restore_pending',1);
 try{for(const values of [[30,2,3,4],[2,30,3,4],[2,3,30,4],[2,3,4,30]]){
  const [fence,restored,document,mention]=values;setMeta(s,'restore_generation',restored);let floor;
  const result=await recoveryGeneration('b',s,{documentGeneration:async()=>document,mentionGeneration:async()=>mention},{read:async()=>fence,raise:async(_b,n)=>{floor=n;return n+1;}});assert.equal(floor,30);assert.equal(result,31);
 }}finally{s.close();}
});
test('M-U12 same-board notification navigation retains drafts, chips and immutable unconfirmed requests only in tab memory',async()=>{
 const {notificationDrafts,notificationRequests,notificationNavigation,clearNotificationMemory}=await import('../apps/web/src/team/notification-navigation.ts');
 clearNotificationMemory();const first=notificationDrafts('board');first.set('one',{reply:{text:'😀 @ben',mentions:[mention]},editing:null});
 notificationRequests('board').set('request',{state:'unconfirmed',text:'immutable body',epoch:2,restoreGeneration:7});
 notificationNavigation.target={boardId:'board',threadId:'two',commentId:'comment',noticeId:'notice',source:'#/files'};
 assert.equal(notificationDrafts('board'),first);assert.equal(notificationDrafts('board').get('one').reply.mentions.length,1);
 assert.equal(notificationRequests('board').get('request').text,'immutable body');assert.equal(notificationNavigation.target.threadId,'two');
 notificationDrafts('another-board');assert.equal(first.size,0);assert.equal(notificationRequests('another-board').size,0);
 clearNotificationMemory();assert.equal(notificationDrafts('board').size,0);assert.equal(notificationNavigation.target,undefined);
 clearNotificationMemory();
});
test('M-U13 retained historical person-label pairs can shift; a new pair must revalidate its current label',async()=>{
 const {mentionProblem}=await import('../packages/board-sync/src/mentions.ts');assert.equal(mentionProblem('😀 @ben',[mention]),null);
 const f=await mentionRoom();
 try{
  const op=await f.save('😀 @ben',[mention]),previous=f.storage.all('SELECT * FROM comments WHERE id=?',op.commentId)[0],service=f.room.comments.mentions;
  f.env.mentions.roster=async()=>[];
  const shifted={...mention,start:0,end:4};assert.deepEqual(await service.prepare('author','@ben',[shifted],previous),{targets:[],removed:[]});
  await assert.rejects(service.prepare('author','@new',[{...shifted,label:'new'}],previous),/mention_unavailable/);
  const target=f.storage.all('SELECT * FROM mention_targets')[0];f.env.mentions.roster=async()=>[{id:target.recipient,person:key,label:'new',lease:target.lease,suffix:''}];
  assert.deepEqual(await service.prepare('author','@new',[{...shifted,label:'new'}],previous),{targets:[],removed:[]});
 }finally{f.storage.close();}
});
