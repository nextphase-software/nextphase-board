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
  async function open(id=crypto.randomUUID()){const ticket=await room.ticket({id,email:'person@example.test',expiresAt:99999999});let attachment=await room.join(ticket.ticket);const messages=[];
    const p={messages,attachment:()=>attachment,attach:v=>{attachment=v;},send:t=>messages.push(JSON.parse(t)),close:()=>{}};connections.push(p);await room.connected(p);return p;}
  return {room,storage,env,open,advance:()=>{now+=1001;},close(){room.doc.destroy();storage.close();}};
}
check(15,'storage-7 old-shape room converts once to 8 with idle vote and no edit, receipt, revision or history change',async()=>{
  const {s,b}=await fixture(),f=await roomFixture(b),{storedBoardUpdate,version13Board}=await load('tests/import-fixture.mjs'),{setMeta,meta}=await load('packages/board-room/src/storage.ts');
  try{
    const current=()=>['edits','receipts','versions','version_chunks'].map(table=>f.storage.all('SELECT * FROM '+table));const before=current();
    f.storage.exec('DROP TABLE workshop_vote');f.storage.exec('CREATE TABLE workshop_vote (singleton INTEGER PRIMARY KEY,status TEXT,session_id TEXT,session_version INTEGER,prompt TEXT,budget INTEGER,targets TEXT,totals TEXT)');
    f.storage.exec("INSERT INTO workshop_vote VALUES (1,'running',?,1,'Legacy vote',3,'[]',NULL)",crypto.randomUUID());
    f.storage.exec('DELETE FROM snapshot_chunks');
    f.storage.exec("INSERT INTO snapshot_chunks VALUES (0,'yjs',0,?)",storedBoardUpdate(version13Board(b),true));f.storage.exec("INSERT INTO snapshot_chunks VALUES (0,'json',0,?)",new TextEncoder().encode(s.canonical(version13Board(b))));setMeta(f.storage,'storage_version',7);
    f.room.initialized=false;await f.room.load();assert.equal(meta(f.storage,'storage_version'),9);assert.equal(f.room.doc.getMap('board').has('pages'),false);assert(f.room.doc.getMap('board')._map.has('pages'));assert.deepEqual(f.room.board,b);assert.equal(f.room.voting.snapshot().status,'idle');assert.deepEqual(f.storage.all('SELECT * FROM workshop_vote_ballots'),[]);assert.deepEqual(current(),before);assert.equal(meta(f.storage,'revision'),0);
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
async function pagesHarness(board, { remembered, hosted = true } = {}) {
  const {build}=await import('esbuild'),rules=await load('apps/web/src/team/page-presence.ts');
  const runtime=`let slots=[],cursor=0,tasks=[],dirty=false;export const begin=()=>{cursor=0;tasks=[];dirty=false;};export const flush=()=>tasks.forEach(f=>f());export const changed=()=>dirty;export const dispose=()=>slots.forEach(s=>s?.cleanup?.());
export function useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});}export function useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],f=>{const n=typeof f==='function'?f(slots[i]):f;if(n!==slots[i]){slots[i]=n;dirty=true;}}];}export function useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps||deps.some((d,j)=>d!==old.deps[j]))tasks.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}`;
  const built=await build({stdin:{contents:'export {usePages} from "./apps/web/src/state/use-pages.ts";export * from "test-react";',resolveDir:new URL('../',import.meta.url).pathname},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^(react|test-react)$/},()=>({path:'runtime',namespace:'hooks'}));b.onLoad({filter:/.*/,namespace:'hooks'},()=>({contents:runtime}));}}]});
  const m=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const keys=['document','window','localStorage','location','history'],old=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),values=new Map();
  if(remembered)values.set('nextphase-board/page/v1/'+remembered.board,remembered.page);
  globalThis.window={innerWidth:1440,innerHeight:900};globalThis.document={activeElement:null,querySelector:()=>null,addEventListener(){},removeEventListener(){}};globalThis.localStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const replacements=[];
  globalThis.location=new URL('https://example.test/?board=original');
  globalThis.history={replaceState(_state,_title,url){replacements.push(String(url));location.href=url;}};
  const h={board,canEdit:true,model:{current:board},messages:[],commits:[],view:{x:0,y:0,z:1},stops:0,follows:0};
  const team={presence:{self:{person:'own'},others:[{person:'ben',connection:'ben',label:'ben'}]},subscribePresence:()=>()=>{},stopFollowing:()=>h.stops++,pageChanged(){},pagePeople:()=>({shown:[],overflow:0,name:''}),votePageReason:()=>'',removedPage:(...args)=>rules.removedPage(...args,team.presence.others)};
  h.refresh=()=>{for(let n=0;n<10;n++){m.begin();h.pages=m.usePages({board:h.board,model:h.model,stepPage:{current:undefined},hosted,canEdit:h.canEdit,team:hosted?team:undefined,commit:(next,...args)=>{h.commits.push(args);h.model.current=next;h.board=next;},finishTextSession(){},select(){},setMessage:x=>h.messages.push(x),getView:()=>h.view,setView:(v,following)=>{h.view=v;if(following)h.follows++;},getObjects:()=>h.board.objects,openingReason:()=>'',editingReason:()=>''});m.flush();if(!m.changed())return;}throw Error('Unsettled page hook');};
  h.close=()=>{m.dispose();keys.forEach((k,i)=>{if(old[i])Object.defineProperty(globalThis,k,old[i]);else delete globalThis[k];});};h.team=team;h.values=values;h.refresh();return h;
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
    const backup=await f.room.backup();assert.equal(backup.tables.meta.find(r=>r.key==='storage_version').value,9);await f.room.restore(backup);assert.deepEqual(JSON.parse(await f.room.export(person)).pages,b.pages);
    const old=structuredClone(backup),{storedBoardUpdate,version13Board}=await load('tests/import-fixture.mjs'),revision=old.tables.meta.find(r=>r.key==='revision').value;old.tables.meta.find(r=>r.key==='storage_version').value=7;old.tables.edits=[];
    old.tables.snapshot_chunks=[{snapshot_revision:revision,kind:'json',chunk_index:0,bytes:Buffer.from(s.canonical(version13Board(f.room.board))).toString('base64')},{snapshot_revision:revision,kind:'yjs',chunk_index:0,bytes:Buffer.from(storedBoardUpdate(version13Board(f.room.board),true)).toString('base64')}];
    await f.room.restore(old);assert.deepEqual(JSON.parse(await f.room.export(person)).pages,b.pages);assert.equal((await f.room.backup()).tables.meta.find(r=>r.key==='storage_version').value,9);
    for(const version of [6,10]){const bad=structuredClone(backup);bad.tables.meta.find(r=>r.key==='storage_version').value=version;await assert.rejects(f.room.restore(bad));}
  }finally{f.close();}
});
check(22,'Undo of a first-page move writes only its guarded order value',async()=>{
  const {s,b}=await fixture(),a=new s.Adapter();a.set(b);const history=new s.SharedUndo(),before=s.capture(a.doc);a.set(s.movePage(b,b.boardId,1),[b.boardId]);history.record(before,s.capture(a.doc));
  const next=history.take(s.capture(a.doc),'undo'),events=[];a.doc.getMap('board').get('pageMap').observeDeep(es=>events.push(...es.map(e=>[e.path,[...e.keysChanged]])));a.set(next,undefined,history.pageOrders);
  assert.deepEqual(events,[[[b.boardId],['order']]]);assert.deepEqual(s.readBoard(a.doc).pages,b.pages);a.destroy();
});
check(23,'vote-start relays distinguish the retained seed connection from the page sender',async()=>{
  const {b}=await fixture(),f=await roomFixture(b);
  try {
    const seed=await f.open(),sender=await f.open(seed.attachment().id),receiver=await f.open(),page=b.pages[1].id;
    const p={kind:'presence',cursor:{x:1,y:2},selection:[b.objects[1].id],view:{x:0,y:0,width:100,height:100},active:true,page};
    await f.room.message(sender,JSON.stringify(p));
    assert.equal(seed.attachment().presence.person,sender.attachment().presence.person);
    const retained=structuredClone(sender.attachment().presence),before=receiver.messages.length,sent=sender.messages.length,times=sender.attachment().presenceTimes.length;
    await f.room.message(sender,JSON.stringify({...p,page:crypto.randomUUID()}));
    assert.deepEqual(sender.attachment().presence,retained);assert.equal(receiver.messages.length,before);
    assert.equal(sender.messages.length,sent);assert.equal(sender.attachment().presenceTimes.length,times+1);
    const requestId=crypto.randomUUID();
    await f.room.message(sender,JSON.stringify({kind:'vote_command',requestId,epoch:sender.attachment().epoch,restoreGeneration:0,
      sessionId:null,expectedSessionVersion:0,action:'start',prompt:'Choose',budget:3,page}));
    assert.equal(sender.messages.find(m=>m.requestId===requestId).kind,'vote_result');
    const frames=receiver.messages.slice(before).filter(m=>m.kind==='present');
    // The old S421 selector can choose this legitimate first-page placeholder.
    assert.equal(frames[0].connection,seed.attachment().connectionId);assert.equal(frames[0].page,b.pages[0].id);
    const redacted=frames.find(m=>m.connection===sender.attachment().connectionId);
    assert.equal(redacted.page,page);assert.equal(redacted.cursor,null);assert.deepEqual(redacted.selection,[]);
    assert.deepEqual(redacted.view,{x:0,y:0,width:1,height:1});assert.equal(sender.attachment().presence.page,page);
    f.advance();const count=receiver.messages.length;await f.room.message(sender,JSON.stringify(p));
    assert.equal(receiver.messages.slice(count).find(m=>m.kind==='present'&&m.connection===redacted.connection).page,page);
  } finally { f.close(); }
});
check(24,'server page-check helpers reset a frozen clock before fresh fixture tokens and after a check',async()=>{
  const {build}=await import('esbuild'),{readFile,mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{pathToFileURL}=await import('node:url');
  const runtime=`export const checks=new Map(),before=[],after=[];let driver;
export const configure=value=>{driver=value;};export const makeDriver=async()=>driver;
export const test=(name,run)=>checks.set(name,run);export const beforeAll=run=>before.push(run);
export const afterEach=run=>after.push(run);export const afterAll=()=>{};
export const inject=name=>name==='board'?{helperUrl:'http://helpers.example.test',origin:'http://board.example.test'}:'node';`;
  const source=await readFile(new URL('server/team-pages.test.ts',import.meta.url),'utf8');
  const built=await build({stdin:{contents:source+'\nexport {check,req};export {checks,before,after,configure} from "test-server-runtime";',
    resolveDir:new URL('server/',import.meta.url).pathname,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',
    plugins:[{name:'server-helpers',setup(b){b.onResolve({filter:/^(vitest|board-test-driver|test-server-runtime)$/},()=>({path:'runtime',namespace:'helpers'}));
      b.onResolve({filter:/^yjs$/},()=>({path:import.meta.resolve('yjs'),external:true}));
      b.onResolve({filter:/^\.\.?\//},args=>({path:new URL(args.path,new URL('server/',import.meta.url)).href,external:true}));
      b.onLoad({filter:/.*/,namespace:'helpers'},()=>({contents:runtime}));}}]});
  const folder=await mkdtemp(tmpdir()+'/board-pages-helpers-'),file=folder+'/helpers.mjs';await writeFile(file,built.outputFiles[0].text);
  const m=await import(pathToFileURL(file).href);
  const {generateKeyPair,exportJWK}=await import('jose'),{token}=await load('tests/server/tokens.ts'),{Auth}=await load('apps/server/src/auth.ts');
  const pair=await generateKeyPair('ES256',{extractable:true}),key={...await exportJWK(pair.privateKey),kid:'page-clock-test'},
    publicKey={...await exportJWK(pair.publicKey),kid:key.kid},issuer='http://auth.example.test/auth/v1';
  const person={id:crypto.randomUUID(),email:'person@example.test'},realFetch=globalThis.fetch;
  let fixedNow=Date.now()-60000,offset=0,fixtureRequests=0;
  const now=()=>fixedNow??Date.now()+offset,auth=new Auth({supabaseUrl:'http://auth.example.test',issuer,jwks:{keys:[publicKey]}},now);
  const freshToken=()=>token(key,issuer,person);
  try {
    // This is the reported 401: a fresh, valid token has iat after the frozen clock.
    await assert.rejects(auth.verify(await freshToken()),error=>error.status===401&&error.message==='token_malformed');
    globalThis.fetch=async url=>{
      assert.equal(url,'http://helpers.example.test/removal-fixture');fixtureRequests++;
      return Response.json({people:{owner:{...person,token:await freshToken()}}});
    };
    m.configure({control:async value=>{if(value.fixedNow!==undefined)fixedNow=value.fixedNow;if(value.offset!==undefined)offset=value.offset;},
      request:async(_path,init)=>{await auth.bearer(init.headers.Authorization);return Response.json({ok:true});}});
    for(const hook of m.before)await hook();
    m.check(0,'synthetic helper clock regression',async()=>{assert.equal((await m.req('/probe')).status,200);});
    for(let n=0;n<2;n++) {
      fixedNow=Date.now()-60000;offset=60000;
      await m.checks.get('S0 synthetic helper clock regression')();
      assert.equal(fixedNow,null);assert.equal(offset,0);
      fixedNow=Date.now()+2000;offset=60000;
      for(const hook of m.after)await hook();
      assert.equal(fixedNow,null);assert.equal(offset,0);
    }
    assert.equal(fixtureRequests,2);
  } finally { globalThis.fetch=realFetch;await rm(folder,{recursive:true,force:true}); }
});
check(25,'version-8 access delivery closes warm and reconstructed rooms without page conversion or backup work',async t=>{
  const {b}=await fixture(),measurements=[];
  for(const cold of [false,true]) {
    const f=await roomFixture(b);
    try {
      const peer=await f.open(),person=peer.attachment().id,codes=[],calls=[],queries=[];
      peer.close=code=>{codes.push(code);f.env.connections().splice(0,1);};
      f.env.access.changes=async(_board,after)=>{calls.push('changes');return {changes:after<1?[{number:1,personId:person}]:[],latest:1,lowestKept:1};};
      f.env.access.role=async()=>{calls.push('role');return null;};
      f.room.backup=()=>assert.fail('access delivery must not take a backup');
      const before=f.storage.all('SELECT * FROM snapshot_chunks'),exec=f.storage.exec.bind(f.storage),all=f.storage.all.bind(f.storage);
      f.storage.exec=(sql,...args)=>{queries.push(sql);return exec(sql,...args);};
      f.storage.all=(sql,...args)=>{queries.push(sql);return all(sql,...args);};
      if(cold)f.room.initialized=false;
      assert.equal(await f.room.changed(),1);assert.deepEqual(codes,[4403]);assert.equal(peer.attachment().presence,null);
      assert.deepEqual(f.storage.all('SELECT * FROM snapshot_chunks'),before);
      assert(!queries.some(sql=>/ALTER TABLE|(?:INSERT INTO|DELETE FROM) (?:snapshot_chunks|edits|workshop_vote)/.test(sql)));
      assert.deepEqual(calls,cold?['changes','role','changes']:['changes','role']);
      measurements.push({cold,accessCalls:calls.length,conversions:0,backups:0,closes:codes.length});
      await f.room.closed(peer,4403);
    } finally { f.close(); }
  }
  t.diagnostic(JSON.stringify(measurements));
});
async function reviewHarness() {
  const {build}=await import('esbuild'),{mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{pathToFileURL}=await import('node:url');
  const runtime=`const frames=new Map();let cells,cursor,jobs=[],dirty=false,requester;
export const begin=name=>{if(!frames.has(name))frames.set(name,[]);cells=frames.get(name);cursor=0;jobs=[];dirty=false;};
export const changed=()=>dirty;export const flush=()=>{const pending=jobs;jobs=[];pending.forEach(f=>f());};
export const dispose=()=>{for(const frame of frames.values())for(const cell of frame)cell?.cleanup?.();};
export function useRef(value){const i=cursor++;return cells[i]??(cells[i]={current:value});}
export function useState(value){const cell=useRef(typeof value==='function'?value():value);return[cell.current,next=>{const v=typeof next==='function'?next(cell.current):next;if(v!==cell.current){cell.current=v;dirty=true;}}];}
export function useEffect(fn,deps){const cell=useRef();if(!cell.current||!deps||deps.some((d,i)=>d!==cell.current[i]))jobs.push(()=>{cell.cleanup?.();cell.current=deps;cell.cleanup=fn();});}
export const useLayoutEffect=useEffect;export const useId=()=>useRef('id-'+cursor).current;
export const Fragment=Symbol('fragment');export const jsx=(type,props)=>({type,props});export const jsxs=jsx;
export const createPortal=node=>node;export const configure=fn=>{requester=fn;};export const request=(...args)=>requester(...args);
export class ApiError extends Error{}export const api=(...args)=>request(...args);`;
  const contents=`export {TemplatesSection} from './apps/web/src/team/templates-section.tsx';
export {Notice} from './apps/web/src/ui/notice.tsx';export {useMessages} from './apps/web/src/state/use-messages.ts';
export {usePages} from './apps/web/src/state/use-pages.ts';export {usePanelLayout} from './apps/web/src/state/use-panel-layout.ts';export * from 'test-react';`;
  const built=await build({stdin:{contents,resolveDir:new URL('../',import.meta.url).pathname},bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',
    plugins:[{name:'review-components',setup(b){
      b.onResolve({filter:/^(react|react\/jsx-runtime|react-dom|test-react)$/},()=>({path:'runtime',namespace:'review'}));
      b.onResolve({filter:/^\.\/templates\.ts$/},args=>args.importer.endsWith('/templates-section.tsx')?{path:'templates',namespace:'review'}:undefined);
      b.onResolve({filter:/^\.\/api\.ts$/},args=>args.importer.endsWith('/templates.ts')?{path:'runtime',namespace:'review'}:undefined);
      b.onResolve({filter:/^original-templates$/},()=>({path:new URL('../apps/web/src/team/templates.ts',import.meta.url).pathname}));
      b.onLoad({filter:/.*/,namespace:'review'},args=>({contents:args.path==='runtime'?runtime:`import {Templates as Original} from 'original-templates';import {request} from 'test-react';
export class Templates extends Original {constructor(...args){super(...args,request);this.visible=true;this.canSave=true;this.status='ready';}async open(){}}`}));
    }}]});
  const folder=await mkdtemp(tmpdir()+'/board-pages-review-'),file=folder+'/components.mjs';await writeFile(file,built.outputFiles[0].text);
  const m=await import(pathToFileURL(file).href);
  return {...m,render(name,component,props){m.begin(name);return component(props);},async close(){m.dispose();await rm(folder,{recursive:true,force:true});}};
}
function elements(node) {
  if(Array.isArray(node))return node.flatMap(elements);
  if(!node||typeof node!=='object')return [];
  return [node,...elements(node.props?.children)];
}
const words=node=>Array.isArray(node)?node.map(words).join(''):node&&typeof node==='object'?words(node.props?.children):node==null||typeof node==='boolean'?'':String(node);
const noticeProps=pages=>({pages,hosted:true,showNotice:false,visibleMessage:'',invalidFields:[],busy:false,tool:'Select',readOnly:false,snapshots:[],
  reopen(){},composing:false,adopt(){},setReadOnly(){},setMessage(){}});
check(26,'F1 page template with a connector opens its dialog, previews and saves only that page without page fields',async()=>{
  const {s}=await fixture(),{createConnector}=await load('apps/web/src/connectors.ts');
  let b={...s.empty(),title:'Template source'};b=s.add(b,'section',0,0);for(let n=0;n<3;n++)b=s.add(b,'sticky',n*300,20);
  b=createConnector(b,b.objects[1].id,b.objects[2].id).board;b=s.renamePage(b,b.boardId,'Agenda');b=s.addPage(b).board;b=s.add(b,'sticky',0,0,b.pages[1].id);
  const h=await reviewHarness(),oldRaf=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>0;let stored;
  try {
    h.configure(async(_path,method,body)=>{
      if(method==='POST')stored={id:crypto.randomUUID(),...body,creatorLabel:'ana',sourceTitle:b.title,objectCount:body.objects.length,
        createdAt:'2026-11-16T12:00:00.000Z',updatedAt:'2026-11-16T12:00:00.000Z',canManage:true};
      if(method==='POST'){const {sourceBoard,...value}=stored;return value;}
      return {templates:[],limit:25,canSave:true};
    });
    const props={hosted:{snapshot:{workspaceId:crypto.randomUUID(),workspace:'Example team',board:b},boardId:b.boardId,page:b.boardId,toast(){}},
      commands:{selected:false,objectCount:b.objects.length,commandReason:'',snapshot(){assert.fail('page source must be scoped before capture');}},disabled:false};
    let tree=h.render('section',h.TemplatesSection,props);
    const save=elements(tree).find(n=>n.props?.className==='team-template-save');assert.equal(words(save),'Save page as template');
    assert.equal(save.props.tip,'Nothing is selected, so all 5 objects on this page are saved');save.props.onClick();
    tree=h.render('section',h.TemplatesSection,props);const dialog=elements(tree).find(n=>n.type.name==='TemplateDialog');assert(dialog);
    let form=h.render('dialog',dialog.type,dialog.props);assert.equal(form.type,'dialog');
    assert(words(form).includes('All 5 objects on “Agenda” of Template source'));
    const preview=elements(form).find(n=>n.type.name==='PreviewImage'),svg=h.render('preview',preview.type,preview.props);
    assert.equal(elements(svg).filter(n=>n.type==='rect').length,4);assert.equal(elements(svg).filter(n=>n.type==='line').length,1);
    elements(form).find(n=>n.type==='input').props.onChange({target:{value:'Agenda template'}});
    form=h.render('dialog',dialog.type,dialog.props);assert.equal(elements(form).find(n=>n.props?.type==='submit').props.disabled,false);
    elements(form).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));
    assert.equal(stored.objectCount,5);assert.deepEqual(stored.objects.map(o=>o.id),b.objects.filter(o=>o.page===b.boardId).map(o=>o.id));
    assert(stored.objects.every(o=>!('page'in o)&&!('order'in o)&&!('generation'in o)));s.validate((await load('apps/web/src/team/templates-rules.ts')).templateBoard(stored.objects));
  } finally { globalThis.requestAnimationFrame=oldRaf;await h.close(); }
});
check(27,'F2 first hosted arrival honors a remembered page after either placeholder and subsequent reload uses the live page',async()=>{
  const {s,b}=await fixture(),page=b.pages[1].id,key='nextphase-board/page/v1/'+b.boardId;
  for(const placeholder of [s.empty(),{...b,pages:[b.pages[0]],objects:[]}]) {
    const h=await pagesHarness(placeholder,{remembered:{board:b.boardId,page}});
    try {
      h.model.current=b;h.pages.changed(placeholder,b,{origin:'reload'});h.board=b;h.refresh();
      assert.equal(h.pages.id,page);assert.equal(h.values.get(key),page);
      h.pages.openPage(b.pages[2].id);h.refresh();const next=s.deletePage(b,b.pages[2].id,b.pages[2].id).board;
      h.model.current=next;h.pages.changed(b,next,{origin:'reload'});h.board=next;h.refresh();assert.equal(h.pages.id,page);
      assert(!h.messages.some(message=>message.includes('deleted page')));
    } finally { h.close(); }
  }
  for(const hosted of [false,true]) {
    const h=await pagesHarness(b,{hosted,remembered:{board:b.boardId,page}});
    try { assert.equal(h.pages.id,page); } finally { h.close(); }
  }
});
check(28,'F3 hosted notices obey showNotice and retain Move to page navigation and page messages',async()=>{
  const h=await reviewHarness(),{b}=await fixture(),opened=[],page=b.pages[1];
  try {
    const message='Moved 1 object to “Ideas”.',pages={list:b.pages,go:{id:page.id,text:message},openingReason:'',openPage:id=>opened.push(id)};
    const props={...noticeProps(pages),visibleMessage:message};
    assert.equal(h.Notice(props).props.hidden,true);
    let tree=h.Notice({...props,showNotice:true});const go=elements(tree).find(n=>n.type==='button'&&words(n)==='Go to Ideas');assert(go);go.props.onClick();assert.deepEqual(opened,[page.id]);
    tree=h.Notice({...props,showNotice:true,pages:{...pages,openingReason:'Busy'}});assert.equal(elements(tree).find(n=>n.type==='button').props.disabled,true);
    for(const text of ['Following ben to “Ideas”.','ben deleted page “Retro”. You are now on “Ideas”.']) {
      tree=h.Notice({...props,showNotice:true,visibleMessage:text});assert.equal(tree.props.hidden,false);assert(words(tree).includes(text));
    }
  } finally { await h.close(); }
});
check(29,'F4 hosted startup leaves board-details layout at its baseline position before and during a solo spotlight',async()=>{
  const h=await reviewHarness(),{b}=await fixture(),keys=['document','window','localStorage','ResizeObserver','location','history'],old=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
  const bars={getBoundingClientRect:()=>({bottom:60})};let committedNotice=null;
  globalThis.document={activeElement:null,addEventListener(){},removeEventListener(){},querySelector:selector=>selector==='.notice'?committedNotice:selector==='.file'||selector==='.actions'?bars:null};
  globalThis.window={innerWidth:1280,innerHeight:800,addEventListener(){},removeEventListener(){}};
  globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  const replacements=[];
  globalThis.location=new URL('https://example.test/');
  globalThis.history={replaceState(_state,_title,url){replacements.push(String(url));location.href=url;}};
  const input={board:b,model:{current:b},stepPage:{current:undefined},hosted:true,canEdit:false,commit(){},finishTextSession(){},select(){},
    getView:()=>({x:0,y:0,z:1}),setView(){},getObjects:()=>b.objects,openingReason:()=>'',editingReason:()=>''};
  const frame=()=>{
    const messages=h.useMessages(),pages=h.usePages({...input,setMessage:messages.setMessage}),layout=h.usePanelLayout({current:{getBoundingClientRect:()=>({top:0})}});
    return {messages,pages,layout,notice:messages.visibleMessage?h.Notice({...noticeProps(pages),visibleMessage:messages.visibleMessage,showNotice:true}):null};
  };
  const refresh=()=>{for(let n=0;n<10;n++){
    const state=h.render('chrome',frame);if(h.changed())continue;
    committedNotice=state.notice?{hidden:!!state.notice.props.hidden,getBoundingClientRect:()=>({height:40})}:null;
    h.flush();if(!h.changed())return state;
  }throw Error('Unsettled chrome');};
  try {
    let state=refresh();assert.deepEqual(state.layout,{notice:68,panel:68},'hosted startup must not displace board details into the spotlight');assert.equal(state.messages.visibleMessage,'');assert.equal(state.notice,null);
    state.messages.setMessage('Read-only: editing commands are unavailable.');state=refresh();
    assert.deepEqual(state.layout,{notice:68,panel:68},'same captured layout inputs as the pre-milestone hosted screen');
    const {spotlightGeometry}=await load('apps/web/src/team/spotlight-rules.ts');
    assert.deepEqual(spotlightGeometry(1280,800,[60,118],[]),{top:130,maxWidth:400,width:'max-content',maxHeight:658});
  } finally { await h.close();keys.forEach((k,i)=>{if(old[i])Object.defineProperty(globalThis,k,old[i]);else delete globalThis[k];}); }
});
