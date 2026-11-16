// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
const load = path => import(new URL('../' + path, import.meta.url));
const check = (id, name, run) => test(`P3-U${String(id).padStart(2,'0')} ${name}`, run);
async function subjects() {
  return {...await load('packages/board-sync/src/order-keys.ts'), ...await load('packages/board-sync/src/document-adapter.ts'),
    ...await load('packages/board-sync/src/codec.ts'), ...await load('packages/board-sync/src/undo.ts'),
    ...await load('apps/web/src/pages.ts'), ...await load('packages/board-rules/src/document.ts')};
}
async function fixture() {
  const s=await subjects();let b={...s.empty(),title:"Team pages"};b=s.renamePage(b,b.boardId,'Agenda');b=s.add(b,'sticky',0,0,b.boardId);
  b=s.addPage(b).board;b=s.renamePage(b,b.pages[1].id,'Ideas');b=s.add(b,'sticky',0,0,b.pages[1].id);
  b=s.addPage(b).board;b=s.renamePage(b,b.pages[2].id,'Retro');return {s,b};
}
check(1,'between is shortest, deterministic, bounded and handles absent, adjacent and equal bounds',async()=>{
  const {between,validOrderKey}=await subjects();
  for(const [low,high,expected]of [[undefined,undefined,'U'],['A','A1','A0V'],[undefined,'1','0U'],['z',undefined,'zV'],['A','A',undefined],['z'.repeat(64),undefined,undefined]]){
    const key=between(low,high);assert.equal(key,expected);assert.equal(between(low,high),key);
    if(key){assert(validOrderKey(key));assert(low===undefined||key>low);assert(high===undefined||key<high);}
  }
  assert.equal(between(undefined,'0'.repeat(63)+'1'),undefined);
});
check(2,'LIS keeps lexicographically first positions; moved keys, equal-key no-op and rebalance',async()=>{
  const {orderWrites,increasingPositions,rebalance}=await subjects();
  assert.deepEqual(increasingPositions(['B','A','C']),[0,2]);assert.deepEqual(increasingPositions(['B','C','A','D']),[0,1,3]);
  const stored=new Map([['a','A'],['b','B'],['c','C']]);assert.deepEqual([...orderWrites(['b','a','c'],stored,['b']).keys()],['b']);
  assert.deepEqual([...orderWrites(['a','b','c'],stored)],[]);assert.deepEqual([...orderWrites(['a','b'],new Map([['a','A'],['b','A']]))],[]);
  const ids=['b','a'];assert.deepEqual(orderWrites(ids,new Map([['a','0'.repeat(63)+'1']]),['b']),rebalance(ids));
});
check(3,'codec rejects old/live and malformed page maps, adapter writes only the changed entry or key',async()=>{
  const {s,b}=await fixture(),Y=await import('yjs'),a=new s.Adapter();a.set(b);assert.deepEqual(s.readBoard(a.doc),b);
  const pages=a.doc.getMap('board').get('pageMap'),events=[];pages.observeDeep(es=>events.push(...es.map(e=>[e.path,[...e.keysChanged]])));
  a.set(structuredClone(b));assert.deepEqual(events,[]);
  a.set(s.renamePage(b,b.pages[1].id,'New'));assert.deepEqual(events,[[[b.pages[1].id],['name']]]);events.length=0;
  const renamed=s.readBoard(a.doc);a.set(s.movePage(renamed,b.pages[1].id,0),[b.pages[1].id]);assert.deepEqual(events,[[[b.pages[1].id],['order']]]);events.length=0;
  const added=s.addPage(s.readBoard(a.doc));a.set(added.board,[added.page.id]);assert.equal(events.length,1);assert.deepEqual(events[0],[[],[added.page.id]]);events.length=0;
  a.set(s.deletePage(s.readBoard(a.doc),added.page.id,b.boardId).board);assert.deepEqual(events,[[[],[added.page.id]]]);
  for(const mutate of [d=>d.getMap('board').set('pages',b.pages),d=>d.getMap('board').set('other',true),d=>d.getMap('board').get('pageMap').set('bad',new Y.Map([['name','X'],['order','A']])),d=>d.getMap('board').get('pageMap').set(b.boardId,{}),d=>d.getMap('board').get('pageMap').get(b.boardId).set('order','A0'),d=>d.getMap('board').get('pageMap').get(b.boardId).set('name',2),d=>d.getMap('board').get('pageMap').get(b.boardId).set('extra',1)]){
    const d=new Y.Doc();Y.applyUpdate(d,Y.encodeStateAsUpdate(a.doc));mutate(d);assert.throws(()=>s.readBoard(d),/invalid_update/);d.destroy();
  }a.destroy();
});
for(const mode of ['adds','renames','rename-delete','same-gap','delete-object','move-rename'])check(4+['adds','renames','rename-delete','same-gap','delete-object','move-rename'].indexOf(mode),`arrival-order merge ${mode} in both orders`,async()=>{
  const {s,b}=await fixture(),Y=await import('yjs'),{evaluate}=await load('packages/board-room/src/edits.ts'),{NodeStorage}=await load('apps/server/src/node-storage.ts'),{initialize}=await load('packages/board-room/src/storage.ts');
  for(const reverse of [false,true]){
    const seed=new s.Adapter();seed.set(b);const clients=[new s.Adapter(),new s.Adapter()],storage=new NodeStorage(':memory:');initialize(storage);
    const updates=clients.map((a,i)=>{Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(seed.doc));const v=Y.encodeStateVector(a.doc);let next=b,moved;
      if(mode==='adds'||mode==='same-gap'){const result=s.addPage(b);next=result.board;if(mode==='same-gap')next=s.movePage(next,result.page.id,1);moved=[result.page.id];}
      if(mode==='renames')next=s.renamePage(b,b.pages[i].id,'Name '+i);
      if(mode==='rename-delete')next=i?s.deletePage(b,b.pages[1].id,b.boardId).board:s.renamePage(b,b.pages[1].id,'Gone');
      if(mode==='delete-object')next=i?s.add(b,'sticky',100,100,b.pages[1].id):s.deletePage(b,b.pages[1].id,b.boardId).board;
      if(mode==='move-rename'){next=i?s.renamePage(b,b.pages[1].id,'Renamed'):s.movePage(b,b.pages[2].id,0);moved=i?undefined:[b.pages[2].id];}
      a.set(next,moved);return Y.encodeStateAsUpdate(a.doc,v);});
    let doc=seed.doc,board=b;const results=[];
    for(const i of reverse?[1,0]:[0,1]){const r=evaluate(doc,board,updates[i],storage);results.push(r.kind);if(r.kind==='complete'){if(doc!==seed.doc)doc.destroy();doc=r.doc;board=r.board;}}
    if(mode==='delete-object'){assert(results.includes('refused'));assert(board.objects.every(o=>board.pages.some(p=>p.id===o.page)));}
    else {assert.deepEqual(results,['complete','complete']);if(mode==='adds'||mode==='same-gap'){assert.equal(board.pages.length,5);if(mode==='same-gap'){const added=board.pages.slice(1,3);assert(added[0].id<added[1].id);}}if(mode==='renames'){assert.equal(board.pages[0].name,'Name 0');assert.equal(board.pages[1].name,'Name 1');}if(mode==='rename-delete')assert(!board.pages.some(p=>p.id===b.pages[1].id));if(mode==='move-rename'){assert.equal(board.pages[0].id,b.pages[2].id);assert.equal(board.pages.find(p=>p.id===b.pages[1].id).name,'Renamed');}}
    if(doc!==seed.doc)doc.destroy();seed.destroy();clients.forEach(a=>a.destroy());storage.close();
  }
});
check(10,'hosted Undo page units restore deleted objects with fresh identities and preserve per-value guards',async()=>{
  const {s,b}=await fixture(),Y=await import('yjs');
  for(const action of ['add','delete','rename','move','move-objects']){
    const a=new s.Adapter();a.set(b);const h=new s.SharedUndo(),before=s.capture(a.doc),page=b.pages[1].id;
    const next=action==='add'?s.addPage(b).board:action==='delete'?s.deletePage(b,page,page).board:action==='rename'?s.renamePage(b,page,'New'):action==='move'?s.movePage(b,page,0):s.moveToPage(b,new Set([b.objects[1].id]),b.boardId).board;
    a.set(next,action==='move'?[page]:undefined);h.record(before,s.capture(a.doc),undefined,undefined,page);assert.equal(h.past.length,1);
    const undone=h.take(s.capture(a.doc),'undo');assert.equal(typeof undone,'object');assert.equal(h.page,page);assert.deepEqual(undone.pages,b.pages);
    if(action==='delete'){assert.notEqual(undone.objects[1].id,b.objects[1].id);assert.notEqual(undone.objects[1].generation,b.objects[1].generation);assert.equal(undone.objects[1].page,page);}else assert.deepEqual(undone.objects,b.objects);
    const state=s.capture(a.doc);a.set(undone,undefined,h.pageOrders);h.record(state,s.capture(a.doc),'undo',undefined,page);const redone=h.take(s.capture(a.doc),'redo');assert.deepEqual(redone.pages,next.pages);a.destroy();
  }
  const a=new s.Adapter();a.set(b);const h=new s.SharedUndo(),before=s.capture(a.doc);a.set(s.renamePage(b,b.boardId,'Changed'));h.record(before,s.capture(a.doc));const prior=s.capture(a.doc);
  a.doc.getMap('board').get('pageMap').get(b.boardId).set('name','Changed');h.observe(prior,s.capture(a.doc),false);assert.equal(h.take(s.capture(a.doc),'undo'),'changed_by_others');a.destroy();
});
check(11,'six-key presence validates page, keeps redacted page and drops stale room pages',async()=>{
  const {checkPresence}=await load('packages/board-sync/src/session.ts'),{b}=await fixture(),page=b.pages[0].id;
  const p={kind:'presence',cursor:null,selection:[],view:{x:0,y:0,width:1,height:1},active:true,page};
  assert.equal(checkPresence(p,200,true).page,page);const {page:_,...missing}=p;assert.equal(checkPresence(missing,200,true),'bad_presence');
  assert.equal(checkPresence({...p,extra:1},200,true),'presence_fields');assert.equal(checkPresence({...p,page:'x'},200,true),'bad_presence');
  const f=await roomFixture(b);try{const a=await f.open(),other=await f.open();await f.room.message(a,JSON.stringify(p));assert.equal(other.messages.at(-1).page,page);
    const previous=a.attachment().presence,n=other.messages.length;await f.room.message(a,JSON.stringify({...p,page:crypto.randomUUID()}));assert.equal(other.messages.length,n);assert.deepEqual(a.attachment().presence,previous);
    f.room.presence.clearSpatial();await new Promise(r=>setImmediate(r));assert.equal(other.messages.at(-1).page,page);assert.deepEqual(other.messages.at(-1).selection,[]);
  }finally{f.close();}
});
check(12,'page rules group avatars, filter drawings, name locations and choose the preceding page by origin',async()=>{
  const r=await load('apps/web/src/team/page-presence.ts'),{b}=await fixture(),[a,i,c]=b.pages;
  const self={person:'self',page:a.id,label:'ana'},people=Array.from({length:5},(_,n)=>({person:String(n),connection:String(n),label:'P'+n,page:i.id,colour:'#2563eb'}));
  const p=r.pagePeople(self,[...people,{...people[0],connection:'tab'},{...self,connection:'self-tab'}],i.id);assert.equal(p.shown.length,3);assert.equal(p.overflow,2);assert.equal(p.name,'P0, P1, P2, P3, P4 on this page');
  assert(!r.onPage(undefined,a.id));assert(!r.onPage(people[0],a.id));assert(r.onPage(people[0],i.id));
  assert.equal(r.peoplePageWords('can edit',people[0],a.id,b.pages),'can edit · on Ideas');assert.equal(r.peoplePageWords('can edit',people[0],i.id,b.pages),'can edit · this page');assert.equal(r.followNotice('ben','Ideas'),'Following ben to “Ideas”.');
  const next={...b,pages:b.pages.slice(0,2)},before={...b};
  assert.equal(r.removedPage(before,next,c.id,{origin:'remote',connection:'0'},people).notice,'P0 deleted page “Retro”. You are now on “Ideas”.');
  assert.equal(r.removedPage(before,next,c.id,{origin:'reload'},people).notice,'');assert.equal(r.removedPage(before,next,c.id,{origin:'own'},people).notice,'');
  const t={anchor:{page:i.id,pageName:i.name,objectId:null,detached:false}};
  assert(r.threadOnPage(t,b,i.id));assert(!r.threadOnPage(t,b,a.id));assert.equal(r.commentLocation(t,b,a.id,'On the board'),'On the board · page Ideas');assert.equal(r.commentLocation(t,{...b,pages:[a,c]},a.id,'On the board'),'On deleted page “Ideas”');
  const vote={status:'running',page:i.id};assert.equal(r.votingPageLine(vote,b.pages),'This vote is on page “Ideas”.');assert.equal(r.votingPageReason(vote,i.id),'A vote is running on this page');assert.equal(r.votingPageReason(vote,a.id),'');
});
check(13,'anchors hit-test only the open page and retain page names through move, rename, deletion and restore',async()=>{
  const {s,b}=await fixture(),{anchorAt,detachAnchor}=await load('packages/board-sync/src/comments.ts'),page=b.pages[1].id;
  const anchor=anchorAt(b,{x:20,y:20},false,page);assert.equal(anchor.objectId,b.objects[1].id);assert.equal(anchor.page,page);
  const point=anchorAt({...b,objects:[]},{x:900,y:800},false,page),renamed=s.renamePage(b,page,'Ideas 2');assert.equal(detachAnchor(point,b,renamed).pageName,'Ideas 2');
  const moved=s.moveToPage(b,new Set([b.objects[1].id]),b.boardId).board;assert.equal(detachAnchor(anchor,b,moved).page,b.boardId);
  const named=detachAnchor(anchor,b,renamed),gone=s.deletePage(renamed,page,page).board,detached=detachAnchor(named,renamed,gone);assert(detached.detached);assert.equal(detached.page,page);assert.equal(detached.pageName,'Ideas 2');assert.equal(detachAnchor(detached,gone,renamed).pageName,'Ideas 2');
});
check(14,'template source and vote scope name and use only the open page',async()=>{
  const {b}=await fixture(),t=await load('apps/web/src/team/templates-rules.ts'),v=await load('apps/web/src/team/voting-rules.ts');
  const result=t.templateSnapshot(b,new Set(),[],b.pages[1].id);assert.equal(result.pageName,'Ideas');assert.deepEqual(result.snapshot.objects.map(o=>o.id),[b.objects[1].id]);assert(result.snapshot.objects.every(o=>!('page'in o)));
  assert.equal(t.saveLabel(false,true),'Save page as template');assert.equal(t.saveLabel(false,false),'Save board as template');assert.equal(v.voteScope(b.pages,b.pages[1].id),'All eligible objects on this page (“Ideas”)');
});
async function roomFixture(board) {
  const {Room}=await load('packages/board-room/src/room.ts'),{NodeStorage}=await load('apps/server/src/node-storage.ts'),{createHash}=await import('node:crypto');
  const storage=new NodeStorage(':memory:'),connections=[];let now=100000,generation=0;
  const env={storage,lifecycle:{lifecycle:async()=>({state:'active',generation:0})},access:{board:async()=>({id:board.boardId,title:board.title,createdAt:new Date(now).toISOString()}),role:async()=> 'editor',changes:async()=>({changes:[],latest:0,lowestKept:1})},
    now:()=>now,fence:async()=>generation,raiseFence:async()=>++generation,hash:async v=>createHash('sha256').update(v).digest('hex'),randomId:()=>crypto.randomUUID(),randomTicket:()=>crypto.randomUUID(),connections:()=>connections,schedule:async()=>{},backupLimit:16777216};
  const room=new Room(board.boardId,env);await room.create(board);
  async function open(){const ticket=await room.ticket({id:crypto.randomUUID(),email:'person@example.test',expiresAt:99999999});let attachment=await room.join(ticket.ticket);const messages=[];
    const p={messages,attachment:()=>attachment,attach:v=>{attachment=v;},send:t=>messages.push(JSON.parse(t)),close:()=>{}};connections.push(p);await room.connected(p);return p;}
  return {room,storage,env,open,advance:()=>{now+=1001;},close(){room.doc.destroy();storage.close();}};
}
check(15,'storage-7 old-shape room converts once to 8 with idle vote and no edit, receipt, revision or history change',async()=>{
  const {s,b}=await fixture(),f=await roomFixture(b),{storedBoardUpdate}=await load('tests/import-fixture.mjs'),{setMeta,meta}=await load('packages/board-room/src/storage.ts');
  try{
    const current=()=>['edits','receipts','versions','version_chunks'].map(table=>f.storage.all('SELECT * FROM '+table));const before=current();
    f.storage.exec('DROP TABLE workshop_vote');f.storage.exec('CREATE TABLE workshop_vote (singleton INTEGER PRIMARY KEY,status TEXT,session_id TEXT,session_version INTEGER,prompt TEXT,budget INTEGER,targets TEXT,totals TEXT)');
    f.storage.exec("INSERT INTO workshop_vote VALUES (1,'running',?,1,'Legacy vote',3,'[]',NULL)",crypto.randomUUID());
    f.storage.exec('DELETE FROM snapshot_chunks');
    f.storage.exec("INSERT INTO snapshot_chunks VALUES (0,'yjs',0,?)",storedBoardUpdate(b,true));f.storage.exec("INSERT INTO snapshot_chunks VALUES (0,'json',0,?)",new TextEncoder().encode(s.canonical(b)));setMeta(f.storage,'storage_version',7);
    f.room.initialized=false;await f.room.load();assert.equal(meta(f.storage,'storage_version'),8);assert.equal(f.room.doc.getMap('board').has('pages'),false);assert(f.room.doc.getMap('board')._map.has('pages'));assert.deepEqual(f.room.board,b);assert.equal(f.room.voting.snapshot().status,'idle');assert.deepEqual(f.storage.all('SELECT * FROM workshop_vote_ballots'),[]);assert.deepEqual(current(),before);assert.equal(meta(f.storage,'revision'),0);
    f.room.initialized=false;await f.room.load();assert.deepEqual(f.room.board,b);assert.deepEqual(current(),before);
  }finally{f.close();}
});
check(16,'session reports own, remote connection and reload origins, and sends page changes within its ten-frame budget',async()=>{
  const {s,b}=await fixture(),Y=await import('yjs'),{BoardSession,encode}=await load('packages/board-sync/src/session.ts'),seed=new s.Adapter();seed.set(b);
  let handler,now=0,n=0;const sent=[],tasks=new Map(),clock={now:()=>now,after:(ms,fn)=>{const id=++n;tasks.set(id,{at:now+ms,fn});return()=>tasks.delete(id);}};
  const session=await BoardSession.join({ticket:async()=>'',clock,open:async()=>({send:t=>sent.push(JSON.parse(t)),close(){},listen:h=>{handler=h;h.message(JSON.stringify({kind:'joined',role:'editor',epoch:0,restoreGeneration:0,revision:0,self:{},present:[],update:encode(Y.encodeStateAsUpdate(seed.doc))}));}})});
  try{
    assert.equal(session.change.origin,'reload');session.edit({...b,title:'Own'},undefined,undefined,b.pages[1].id);assert.equal(session.change.origin,'own');
    const remote=new s.Adapter();Y.applyUpdate(remote.doc,Y.encodeStateAsUpdate(session.doc));const v=Y.encodeStateVector(remote.doc);remote.set({...session.board,title:'Remote'});const connection=crypto.randomUUID();handler.message(JSON.stringify({kind:'update',connection,revision:1,update:encode(Y.encodeStateAsUpdate(remote.doc,v))}));assert.deepEqual(session.change,{origin:'remote',connection});remote.destroy();
    handler.message(JSON.stringify({kind:'resync',stateVector:encode(Y.encodeStateVector(session.doc))}));assert.equal(session.change.origin,'reload');
    const p={cursor:null,selection:[],view:{x:0,y:0,width:100,height:100},active:true,page:b.boardId};for(let i=0;i<11;i++)session.setPresence({...p,page:b.pages[i%2].id});
    assert.equal(sent.filter(m=>m.kind==='presence').length,10);assert.equal(sent.at(-1).page,b.pages[1].id);
    now=1000;for(const [id,t]of [...tasks])if(t.at<=now){tasks.delete(id);t.fn();}assert.equal(sent.filter(m=>m.kind==='presence').length,11);assert.equal(sent.at(-1).page,b.boardId);
  }finally{session.close();seed.destroy();}
});
async function pagesHarness(board) {
  const {build}=await import('esbuild'),rules=await load('apps/web/src/team/page-presence.ts');
  const runtime=`let slots=[],cursor=0,tasks=[],dirty=false;export const begin=()=>{cursor=0;tasks=[];dirty=false;};export const flush=()=>tasks.forEach(f=>f());export const changed=()=>dirty;export const dispose=()=>slots.forEach(s=>s?.cleanup?.());
export function useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});}export function useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],f=>{const n=typeof f==='function'?f(slots[i]):f;if(n!==slots[i]){slots[i]=n;dirty=true;}}];}export function useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps||deps.some((d,j)=>d!==old.deps[j]))tasks.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}`;
  const built=await build({stdin:{contents:'export {usePages} from "./apps/web/src/state/use-pages.ts";export * from "test-react";',resolveDir:new URL('../',import.meta.url).pathname},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^(react|test-react)$/},()=>({path:'runtime',namespace:'hooks'}));b.onLoad({filter:/.*/,namespace:'hooks'},()=>({contents:runtime}));}}]});
  const m=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const keys=['document','window','localStorage'],old=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),values=new Map();
  globalThis.window={innerWidth:1440,innerHeight:900};globalThis.document={activeElement:null,querySelector:()=>null,addEventListener(){},removeEventListener(){}};globalThis.localStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const h={board,canEdit:true,model:{current:board},messages:[],commits:[],view:{x:0,y:0,z:1},stops:0,follows:0};
  const team={presence:{self:{person:'own'},others:[{person:'ben',connection:'ben',label:'ben'}]},subscribePresence:()=>()=>{},stopFollowing:()=>h.stops++,pageChanged(){},pagePeople:()=>({shown:[],overflow:0,name:''}),votePageReason:()=>'',removedPage:(...args)=>rules.removedPage(...args,team.presence.others)};
  h.refresh=()=>{for(let n=0;n<10;n++){m.begin();h.pages=m.usePages({board:h.board,model:h.model,stepPage:{current:undefined},hosted:true,canEdit:h.canEdit,team,commit:(next,...args)=>{h.commits.push(args);h.model.current=next;h.board=next;},finishTextSession(){},select(){},setMessage:x=>h.messages.push(x),getView:()=>h.view,setView:(v,following)=>{h.view=v;if(following)h.follows++;},getObjects:()=>h.board.objects,openingReason:()=>'',editingReason:()=>''});m.flush();if(!m.changed())return;}throw Error('Unsettled page hook');};
  h.close=()=>{m.dispose();keys.forEach((k,i)=>{if(old[i])Object.defineProperty(globalThis,k,old[i]);else delete globalThis[k];});};h.team=team;h.refresh();return h;
}
check(17,'hosted page owner hides every viewer step, remembers open pages and forwards only moved page ids',async()=>{
  const {b}=await fixture(),h=await pagesHarness(b);
  try{h.canEdit=false;h.refresh();h.pages.toggle();h.refresh();assert(h.pages.open);assert(h.pages.local);h.pages.add();h.pages.rename(b.boardId);h.pages.beginDrag(b.boardId,20);h.refresh();assert.equal(h.commits.length,0);assert.equal(h.pages.editing,'');assert.equal(h.pages.drag,null);
    h.pages.openPage(b.pages[1].id);h.refresh();assert.equal(h.pages.id,b.pages[1].id);
    h.canEdit=true;h.refresh();h.pages.add();h.refresh();assert.equal(h.commits.length,1);assert.deepEqual(h.commits[0][3],[h.pages.id]);h.canEdit=false;h.refresh();assert.equal(h.pages.editing,'');assert.equal(h.pages.menu,'');
  }finally{h.close();}
});
check(18,'page owner distinguishes remote delete, silent reload, preview return and followed view changes',async()=>{
  const {s,b}=await fixture(),h=await pagesHarness(b);
  try{
    h.pages.openPage(b.pages[1].id);h.refresh();const deleted=s.deletePage(b,b.pages[1].id,b.pages[1].id).board;h.model.current=deleted;h.pages.changed(b,deleted,{origin:'remote',connection:'ben'});h.board=deleted;h.refresh();assert.equal(h.pages.id,b.boardId);assert.equal(h.messages.at(-1),'ben deleted page “Ideas”. You are now on “Agenda”.');
    h.model.current=b;h.board=b;h.refresh();h.pages.openPage(b.pages[1].id);h.refresh();const n=h.messages.length;h.model.current=deleted;h.pages.changed(b,deleted,{origin:'reload'});h.board=deleted;h.refresh();assert.equal(h.messages.length,n);
    h.model.current=b;h.board=b;h.refresh();h.pages.openPage(b.pages[2].id);h.refresh();h.model.current=deleted;h.pages.changed(b,deleted,{origin:'reload'},true);h.board=deleted;h.refresh();assert.equal(h.pages.id,b.pages[2].id);h.pages.openPage(b.boardId);h.refresh();h.model.current=b;h.pages.changed(deleted,b,{origin:'reload'},false);h.board=b;h.refresh();assert.equal(h.pages.id,b.pages[2].id);
    const stops=h.stops;h.team.openPage(b.pages[1].id,true);h.refresh();assert.equal(h.stops,stops);assert(h.follows>0);
  }finally{h.close();}
});
async function roomEdit(f,c,next) {
  const {Adapter}=await load('packages/board-sync/src/document-adapter.ts'),Y=await import('yjs');const a=new Adapter();Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(f.room.doc));const vector=Y.encodeStateVector(a.doc);a.set(next);
  const requestId=crypto.randomUUID();await f.room.message(c,JSON.stringify({kind:'edit',requestId,epoch:c.attachment().epoch,restoreGeneration:c.attachment().restoreGeneration,update:Buffer.from(Y.encodeStateAsUpdate(a.doc,vector)).toString('base64')}));a.destroy();const reply=c.messages.find(m=>m.requestId===requestId&&['saved','refused'].includes(m.kind));assert.equal(reply?.kind,'saved',JSON.stringify(reply));return reply;
}
check(19,'room comments retain all deleted-page anchors, send only that deletion and keep authoritative last names',async()=>{
  const {s,b}=await fixture(),f=await roomFixture(b);try{
    const c=await f.open(),page=b.pages[1].id;let board=s.add(b,'sticky',400,0,page);await roomEdit(f,c,board);
    const start=async(anchor)=>{const op={action:'start',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),anchor,text:'Synthetic'};const requestId=crypto.randomUUID();await f.room.message(c,JSON.stringify({kind:'comment',requestId,epoch:c.attachment().epoch,restoreGeneration:0,operation:op}));assert.equal(c.messages.find(m=>m.requestId===requestId)?.kind,'comment_saved');return op.threadId;};
    const ids=[await start({x:800,y:800,u:0,v:0,objectId:null,page}),await start({x:20,y:20,u:.2,v:.2,objectId:board.objects[1].id,page}),await start({x:410,y:20,u:.2,v:.2,objectId:board.objects.at(-1).id,page})];
    const gone=board.objects.at(-1);board={...board,objects:board.objects.filter(o=>o.id!==gone.id),retiredGenerations:[gone.generation]};await roomEdit(f,c,board);
    board=s.renamePage(board,page,'Ideas 2');await roomEdit(f,c,board);const at=c.messages.length;board=s.deletePage(board,page,page).board;await roomEdit(f,c,board);
    const changed=c.messages.slice(at).filter(m=>m.kind==='comment_changed');assert.deepEqual(changed.map(m=>m.threadId).sort(),ids.sort());for(const frame of changed){assert.equal(frame.thread.anchor.page,page);assert.equal(frame.thread.anchor.pageName,'Ideas 2');}
    const n=c.messages.filter(m=>m.kind==='comment_changed').length;await roomEdit(f,c,{...board,title:'Unrelated title'});assert.equal(c.messages.filter(m=>m.kind==='comment_changed').length,n);
  }finally{f.close();}
});
check(20,'room voting filters start targets to its page, refunds a moved target and keeps a deleted-page round running',async()=>{
  const {s,b}=await fixture(),f=await roomFixture(b);try{
    const c=await f.open(),page=b.pages[1].id;const command=async(action,extra={})=>{f.advance();const state=f.room.voting.snapshot(),requestId=crypto.randomUUID();await f.room.message(c,JSON.stringify({kind:'vote_command',requestId,epoch:c.attachment().epoch,restoreGeneration:0,sessionId:state.sessionId,expectedSessionVersion:state.sessionVersion,action,...extra}));return c.messages.find(m=>m.requestId===requestId);};
    assert.equal((await command('start',{prompt:'Q',budget:3,page:crypto.randomUUID()})).reason,'vote_ineligible');const started=await command('start',{prompt:'Q',budget:3,page});assert.equal(started.kind,'vote_result');assert.equal(started.voting.session.page,page);assert.deepEqual(started.voting.session.targets.map(t=>t[0]),[b.objects[1].id]);
    assert.equal((await command('vote',{objectId:b.objects[1].id,objectGeneration:b.objects[1].generation,expectedBallotVersion:0})).voting.own.remaining,2);
    let next=s.moveToPage(b,new Set([b.objects[1].id]),b.boardId).board;await roomEdit(f,c,next);assert.equal(f.room.voting.snapshot().targets.length,0);assert.deepEqual(JSON.parse(f.storage.all('SELECT * FROM workshop_vote_ballots')[0].targets),[]);
    next=s.deletePage(next,page,b.boardId).board;await roomEdit(f,c,next);assert.equal(f.room.voting.snapshot().status,'running');
  }finally{f.close();}
});
check(21,'history and storage-8 and legacy-7 backups restore every page',async()=>{
  const {s,b}=await fixture(),f=await roomFixture(b);try{
    const person={id:crypto.randomUUID(),email:'owner@example.test',expiresAt:9999999};const version=(await f.room.versions(person)).versions[0];await f.room.restoreVersion(person,version.id,{requestId:crypto.randomUUID(),expectedRevision:0,expectedGeneration:0});assert.deepEqual(f.room.board.pages,b.pages);
    const backup=await f.room.backup();assert.equal(backup.tables.meta.find(r=>r.key==='storage_version').value,8);await f.room.restore(backup);assert.deepEqual(JSON.parse(await f.room.export(person)).pages,b.pages);
    const old=structuredClone(backup),{storedBoardUpdate}=await load('tests/import-fixture.mjs'),revision=old.tables.meta.find(r=>r.key==='revision').value;old.tables.meta.find(r=>r.key==='storage_version').value=7;old.tables.edits=[];
    old.tables.snapshot_chunks=[{snapshot_revision:revision,kind:'json',chunk_index:0,bytes:Buffer.from(s.canonical(f.room.board)).toString('base64')},{snapshot_revision:revision,kind:'yjs',chunk_index:0,bytes:Buffer.from(storedBoardUpdate(f.room.board,true)).toString('base64')}];
    await f.room.restore(old);assert.deepEqual(JSON.parse(await f.room.export(person)).pages,b.pages);assert.equal((await f.room.backup()).tables.meta.find(r=>r.key==='storage_version').value,8);
    for(const version of [6,9]){const bad=structuredClone(backup);bad.tables.meta.find(r=>r.key==='storage_version').value=version;await assert.rejects(f.room.restore(bad));}
  }finally{f.close();}
});
check(22,'Undo of a first-page move writes only its guarded order value',async()=>{
  const {s,b}=await fixture(),a=new s.Adapter();a.set(b);const history=new s.SharedUndo(),before=s.capture(a.doc);a.set(s.movePage(b,b.boardId,1),[b.boardId]);history.record(before,s.capture(a.doc));
  const next=history.take(s.capture(a.doc),'undo'),events=[];a.doc.getMap('board').get('pageMap').observeDeep(es=>events.push(...es.map(e=>[e.path,[...e.keysChanged]])));a.set(next,undefined,history.pageOrders);
  assert.deepEqual(events,[[[b.boardId],['order']]]);assert.deepEqual(s.readBoard(a.doc).pages,b.pages);a.destroy();
});
