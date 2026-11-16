// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';

// All implementation imports are inside the named checks (including helpers).
const load = path => import(new URL('../' + path, import.meta.url));
async function subjects() {
  const pages = await load('apps/web/src/pages.ts');
  const rules = await load('packages/board-rules/src/document.ts');
  return { ...pages, ...rules };
}
const ids = objects => new Set(objects.map(o => o.id));
const drawn = board => board.objects.map(o => ({ ...o, x: o.x ?? 0, y: o.y ?? 0, width: o.width ?? 0, height: o.height ?? 0, displayHeight: o.height ?? 0 }));
async function fixture() {
  const s = await subjects(); let board = { ...s.empty(), title: 'Synthetic pages' };
  board = s.add(board, 'sticky', 0, 0, board.pages[0].id);
  const second = s.addPage(board); board = second.board;
  board = s.add(board, 'sticky', 500, 200, second.page.id);
  return { s, board, first: board.pages[0].id, second: second.page.id };
}
const check = (id, name, run) => test(`P2-U${String(id).padStart(2, '0')} ${name}`, run);
check(1, 'version 13 exact document keys, default page and every page identity/name boundary', async () => {
  const { s, board } = await fixture(); s.validate(board);
  assert.deepEqual(Object.keys(JSON.parse(s.canonical(board))), ['schemaVersion','boardId','title','pages','objects','retiredGenerations']);
  assert.deepEqual(JSON.parse(s.canonical(board)).pages.map(Object.keys), [['id','name'],['id','name']]);
  assert.equal(s.empty().schemaVersion, 13);
  for (const mutate of [b => delete b.pages, b => b.pages = [], b => b.pages = Array.from({length:51}, () => ({id:crypto.randomUUID(),name:'P'})),
    b => b.pages[1].id = b.pages[0].id, b => b.pages[0].id = b.objects[0].id, b => b.pages[0].id = b.objects[0].generation,
    b => b.pages[0].id = 'bad', b => b.pages[0].extra = true, b => b.pages[0].name = '', b => b.pages[0].name = ' x ',
    b => b.pages[0].name = '😀'.repeat(61), b => b.pages[0].name = 'x\ty', b => b.pages[0].name = '\ud800',
    b => b.objects[0].page = crypto.randomUUID(), b => delete b.objects[0].page]) {
    const bad = structuredClone(board); mutate(bad); assert.throws(() => s.validate(bad));
  }
  const retired = crypto.randomUUID();
  s.validate({ ...board, retiredGenerations: [retired], pages: [...board.pages, {id:retired,name:'Retired id permitted'}] });
  s.validate({ ...board, pages: board.pages.map(p => ({ ...p, name:'Same name' })) });
});
check(2, 'all four cross-page references reject without repair', async () => {
  const {s,board,first,second}=await fixture(), {createConnector}=await load('apps/web/src/connectors.ts'), {starterMap}=await load('apps/web/src/mind-map.ts');
  let b=s.add(board,'sticky',300,0,first), a=b.objects.filter(o=>o.page===first);
  b=createConnector(b,a[0].id,a[1].id,undefined,first).board;
  b=s.add(b,'section',0,0,first); const section=b.objects.at(-1).id;
  b=starterMap(b,{x:0,y:500},()=>({width:100,height:40}),first).board;
  const node=b.objects.find(o=>o.type==='mindNode'&&o.parent!==null), connector=b.objects.find(o=>o.type==='connector');
  for (const patch of [x=>x.objects.find(o=>o.id===connector.id).page=second,
    x=>x.objects.find(o=>o.page===second).section=section,
    x=>{const group=crypto.randomUUID();x.objects.filter(o=>o.type==='sticky').forEach(o=>o.group=group);},
    x=>x.objects.find(o=>o.id===node.id).page=second]) {
    const bad=structuredClone(b);patch(bad);const before=structuredClone(bad);assert.throws(()=>s.validate(bad));assert.deepEqual(bad,before);
  }
});
check(3, 'versions 7, 11 and 12 upgrade deterministically without mutation or an edit', async () => {
  const s=await subjects(), {withoutPages}=await load('tests/import-fixture.mjs'), {record,emptyHistory}=await load('apps/web/src/history.ts');
  const current=s.add({...s.empty(),title:'Legacy'},'sticky',0,0);
  for(const version of [7,11,12]) {
    const old={...withoutPages(current),schemaVersion:version}, bytes=s.canonical(old), before=structuredClone(old), next=s.upgrade(old);
    assert.equal(next.schemaVersion,13);assert.deepEqual(next.pages,[{id:old.boardId,name:'Page 1'}]);
    assert(next.objects.every(o=>o.page===old.boardId));assert.deepEqual(old,before);assert.equal(s.canonical(old),bytes);
    assert.deepEqual(record(emptyHistory(),next,s.upgrade(old)),emptyHistory());assert.equal(s.upgrade(next),next);
  }
  const older={...withoutPages(current),schemaVersion:12,retiredGenerations:[current.boardId]};s.validate(s.upgrade(older));
});
check(4, 'every type places page immediately after type and adapter pageMap rename changes only one name', async () => {
  const s=await subjects(), {richBoard}=await load('tests/import-fixture.mjs'), {makeTape}=await load('apps/web/src/tape.ts'),
    {starterMap}=await load('apps/web/src/mind-map.ts'), {addImages}=await load('apps/web/src/images.ts'), {Adapter}=await load('packages/board-sync/src/document-adapter.ts'), {readBoard}=await load('packages/board-sync/src/codec.ts');
  let b=richBoard(); b={...b,objects:[...b.objects,makeTape(b,{x:0,y:0},{x:100,y:0},'stripes',false,b.boardId)]};
  b=starterMap(b,{x:0,y:400},()=>({width:100,height:40}),b.boardId).board;
  b=addImages(b,[{hash:'0'.repeat(64),width:1,height:1,picture:{pixelWidth:1,pixelHeight:1}}],{x:0,y:0},b.boardId);
  const second=s.addPage(b);b=second.board;
  const payload=JSON.parse(s.canonical(b));
  assert.equal(new Set(payload.objects.map(o=>o.type)).size,9);
  for(const o of payload.objects) assert.equal(Object.keys(o)[Object.keys(o).indexOf('type')+1],'page');
  const a=new Adapter();a.set(b);const events=[];a.doc.getMap('board').observe(e=>events.push([...e.keysChanged]));
  const stored=a.doc.getMap('board').get('pageMap');stored.observeDeep(es=>events.push(...es.map(e=>[...e.keysChanged])));a.set(structuredClone(b));assert.equal(a.doc.getMap('board').get('pageMap'),stored);assert.deepEqual(events,[]);
  b=s.renamePage(b,second.page.id,'Ideas');a.set(b);assert.deepEqual(events,[['name']]);assert.equal(s.canonical(readBoard(a.doc)),s.canonical(b));
  const recreated=new Adapter();recreated.set(readBoard(a.doc));assert.equal(s.canonical(readBoard(recreated.doc)),s.canonical(b));a.destroy();recreated.destroy();
});
check(5, 'maximum-size version 12 payload upgrades and all limit checks ignore only page metadata', async () => {
  const s=await subjects(), {sizedBoard}=await load('tests/import-fixture.mjs'), old=sizedBoard(2097152,12), next=s.upgrade(old);
  assert.equal(s.payloadBytes(s.canonical(next)),2097152);assert(Buffer.byteLength(s.canonical(next))>2097152);
  const too=s.upgrade(sizedBoard(2097153,12));assert.throws(()=>s.canonical(too),/too large/);
  const current=sizedBoard();assert.equal(s.payloadBytes(s.canonical(current)),2097152);
  assert.equal(Buffer.byteLength(s.canonical(current)),2104400);assert.throws(()=>s.canonical(sizedBoard(2097153)),/too large/);
  const {writeBoardFile,readBoardFile}=await load('apps/web/src/board-file.ts'), raw=await writeBoardFile(next);
  assert.deepEqual(await readBoardFile({size:Buffer.byteLength(raw),arrayBuffer:async()=>new TextEncoder().encode(raw).buffer}),next);
  const {decode,digest}=await load('apps/web/src/storage.ts'),payload=s.canonical(next),wrapped=JSON.stringify({formatVersion:1,storageRevision:1,payload,sha256:await digest(payload)});
  assert.deepEqual((await decode(wrapped)).board,next);
  const {documentBytes}=await load('packages/board-room/src/history.ts'),bytes=new TextEncoder().encode(payload);
  assert.deepEqual(documentBytes(Array.from({length:Math.ceil(bytes.length/1048576)},(_,i)=>({chunk_index:i,bytes:bytes.slice(i*1048576,(i+1)*1048576)})),next.boardId).board,next);
});
check(6, 'naming, Unicode rename trim/cut/trim and invalid no-op keep the prior board', async () => {
  const {s,board,first}=await fixture();assert.equal(s.nextPageName(board),'Page 3');
  let b=s.renamePage(board,first,'Ideas');assert.equal(s.nextPageName(b),'Page 1');
  b=s.renamePage(b,first,'  '+'😀'.repeat(59)+' '+'z  ');assert.equal(b.pages[0].name,'😀'.repeat(59));
  for(const text of ['', '   ', 'x\ty', b.pages[0].name]) assert.equal(s.renamePage(b,first,text),b);
  const added=s.addPage(b);assert.equal(added.page.name,'Page 1');assert.equal(added.board.pages.at(-1).id,added.page.id);
});
check(7, 'move up/down/index preserves ids and no-op board identity', async () => {
  const {s,board,first,second}=await fixture(),third=s.addPage(board);let b=third.board;
  assert.equal(s.movePageUp(b,first),b);assert.equal(s.movePageDown(b,third.page.id),b);
  b=s.movePageUp(b,second);assert.deepEqual(b.pages.map(p=>p.id),[second,first,third.page.id]);
  b=s.movePageDown(b,second);b=s.movePage(b,third.page.id,0);assert.deepEqual(b.pages.map(p=>p.id),[third.page.id,first,second]);
  assert.deepEqual(b.objects,board.objects);
});
check(8, 'duplicate remaps every identity and reference with exact positions and page limits', async () => {
  const s=await subjects(),{richBoard}=await load('tests/import-fixture.mjs'),{starterMap}=await load('apps/web/src/mind-map.ts');
  let b=richBoard();b=starterMap(b,{x:0,y:500},()=>({width:100,height:40}),b.boardId).board;b=s.renamePage(b,b.boardId,'😀'.repeat(60));
  const result=s.duplicatePage(b,b.boardId), copies=s.pageObjects(result.board,result.page.id);s.validate(result.board);
  assert.equal(result.page.name,'😀'.repeat(60));assert.equal(copies.length,b.objects.length);
  const used=new Set(b.objects.flatMap(o=>[o.id,o.generation,o.group]));for(const o of copies){assert(!used.has(o.id));assert(!used.has(o.generation));if(o.group)assert(!used.has(o.group));}
  const remap=new Map(b.objects.map((o,i)=>[o.id,copies[i].id]));
  b.objects.forEach((o,i)=>{const c=copies[i];for(const k of ['x','y','width','height','text','asset'])assert.deepEqual(c[k],o[k]);if(o.section)assert.equal(c.section,remap.get(o.section));if(o.from){assert.equal(c.from.object,remap.get(o.from.object));assert.equal(c.to.object,remap.get(o.to.object));}if(o.parent)assert.equal(c.parent,remap.get(o.parent));});
  const full={...b,pages:Array.from({length:50},(_,i)=>i?{id:crypto.randomUUID(),name:'P'}:b.pages[0])};assert.throws(()=>s.addPage(full),/50 pages/);assert.throws(()=>s.duplicatePage(full,b.boardId),/50 pages/);
  const many={...b,objects:Array(251-b.objects.length).fill(b.objects[0])};assert.throws(()=>s.duplicatePage(many,b.boardId),/250 objects/);
});
check(9, 'delete retires exactly the page objects and chooses the preceding or first page', async () => {
  const {s,board,first,second}=await fixture(), third=s.addPage(board);let b=third.board;
  const result=s.deletePage(b,second,second);assert.equal(result.open,first);assert(result.board.retiredGenerations.includes(board.objects[1].generation));s.validate(result.board);
  assert.equal(s.deletePage(b,first,first).open,second);assert.equal(s.deletePage(b,second,third.page.id).open,third.page.id);
  assert.throws(()=>s.deletePage({...b,pages:[b.pages[0]],objects:[b.objects[0]]},first,first),/at least one/);
});
check(10, 'moved set closes whole maps, groups, sections and both-ended connectors and excludes half connectors', async () => {
  const {s,board,first,second}=await fixture(),{starterMap}=await load('apps/web/src/mind-map.ts'),{createConnector}=await load('apps/web/src/connectors.ts');
  let b=starterMap(board,{x:0,y:700},()=>({width:100,height:40}),first).board;
  b=s.add(b,'sticky',300,0,first);b=s.add(b,'section',0,0,first);const section=b.objects.at(-1),a=b.objects[0],extra=b.objects.at(-2);a.section=section.id;
  b=createConnector(b,a.id,extra.id,undefined,first).board;const link=b.objects.find(o=>o.type==='connector');
  assert.equal(s.movedSet(b,new Set([link.id])).size,0);
  let set=s.movedSet(b,new Set([section.id]));assert(set.has(a.id));assert(!set.has(link.id));
  const group=crypto.randomUUID();b.objects.filter(o=>[a.id,extra.id].includes(o.id)).forEach(o=>o.group=group);set=s.movedSet(b,new Set([a.id]));assert(set.has(extra.id));assert(set.has(link.id));
  const node=b.objects.find(o=>o.type==='mindNode'&&o.parent!==null),map=s.movedSet(b,new Set([node.id]));assert.equal([...map].length,4);
  const moved=s.moveToPage(b,new Set([a.id]),second);assert.equal(moved.count,3);s.validate(moved.board);assert.equal(moved.board.objects.find(o=>o.id===a.id).section,null);
  assert.deepEqual(s.moveToPage(b,new Set(),second),{board:b,count:0,removed:0,notice:''});
});
check(11, 'move keeps ids positions and order, deletes one-ended connectors, and leaves other pages identical', async () => {
  const {s,board,first,second}=await fixture(),{createConnector}=await load('apps/web/src/connectors.ts');
  let b=s.add(board,'sticky',300,0,first);const a=b.objects[0],other=b.objects.at(-1);b=createConnector(b,a.id,other.id,undefined,first).board;
  const link=b.objects.find(o=>o.type==='connector'),result=s.moveToPage(b,new Set([a.id]),second);assert.equal(result.removed,1);assert.equal(result.count,1);s.validate(result.board);
  assert(result.board.retiredGenerations.includes(link.generation));assert(!result.board.objects.some(o=>o.id===link.id));
  const moved=result.board.objects.find(o=>o.id===a.id);assert.deepEqual({...moved,page:a.page,order:a.order},a);
  assert.deepEqual(result.board.objects.filter(o=>o.id!==a.id).map(({order,...o})=>o),b.objects.filter(o=>o.id!==a.id&&o.id!==link.id).map(({order,...o})=>o));
});
check(12, 'every notice uses the contracted singular, plural, empty and removed-connector words', async () => {
  const {s,board}=await fixture();assert.equal(s.duplicatePageNotice('Ideas','Ideas copy'),'Duplicated page “Ideas” as “Ideas copy”.');
  assert.equal(s.deletePageNotice('Ideas',0),'Deleted page “Ideas”. Undo restores it.');
  assert.equal(s.deletePageNotice('Ideas',1,'Agenda'),'Deleted page “Ideas” and its 1 object. Undo restores it. Now on “Agenda”.');
  assert.equal(s.deletePageNotice('Ideas',5),'Deleted page “Ideas” and its 5 objects. Undo restores it.');
  const one=ids([board.objects[0]]),{commandObjectLabel}=await load('apps/web/src/sections.ts');
  assert.equal(s.moveNotice(board,one,'Ideas',1),`Moved ${commandObjectLabel(board,board.objects[0])} to “Ideas”. Undo moves it back. 1 connector to an object left on this page was removed.`);
  assert.equal(s.moveNotice(board,ids(board.objects),'Ideas',2),'Moved 2 objects to “Ideas”. Undo moves them back. 2 connectors to objects left on this page were removed.');
});
check(13, 'history records page-only changes and each step page, and restores logical object ids', async () => {
  const {s,board,first,second}=await fixture(),h=await load('apps/web/src/history.ts');
  const renamed=s.renamePage(board,second,'Ideas');let history=h.record(h.emptyHistory(),board,renamed,undefined,first);
  assert.equal(history.past.length,1);assert.equal(history.past[0].changes.length,0);assert.equal(history.past[0].page,first);
  let result=h.undo(renamed,history);assert.deepEqual(result.board.pages,board.pages);assert.equal(result.page,first);
  result=h.redo(result.board,result.history);assert.deepEqual(result.board.pages,renamed.pages);assert.equal(result.page,first);
  const deleted=s.deletePage(renamed,second,second).board;history=h.record(result.history,renamed,deleted,undefined,second);result=h.undo(deleted,history);s.validate(result.board);
  assert.equal(result.page,second);assert.equal(result.board.objects[1].id,board.objects[1].id);assert.notEqual(result.board.objects[1].generation,board.objects[1].generation);
  result=h.redo(result.board,result.history);s.validate(result.board);assert.equal(result.board.pages.length,1);
});

for (const [index,path] of ['place','paste','duplicate','template','activity','image','stroke','tape','connector','mind node','wrap in section','Tidy up Apply'].entries()) check(14+index, `${path} edits the whole board and isolates every other page including interleaved order`, async () => {
  const s=await subjects(),{richBoard}=await load('tests/import-fixture.mjs'),sections=await load('apps/web/src/sections.ts');
  let b=richBoard();b.objects=b.objects.reverse().map((o,order)=>({...o,order}));
  const added=s.addPage(b),page=added.page.id;b=added.board;
  for(let i=0;i<3;i++)b=sections.placeObject(b,s.add(b,'sticky',i*300,500,page).objects.at(-1));
  const selected=ids(s.pageObjects(b,page)),before=structuredClone(b),existing=new Set(b.objects.map(o=>o.id));let next;
  const clipboard=await load('apps/web/src/clipboard.ts'), snapshot=clipboard.buildSnapshot(b,selected,drawn(b));
  switch(path){
    case 'place':next=sections.placeObject(b,s.add(b,'section',0,500,page).objects.at(-1));break;
    case 'paste':next=clipboard.buildPaste(b,snapshot,{centerX:0,centerY:0,zoom:1,width:1440,height:900},undefined,page).board;break;
    case 'duplicate':next=(await load('apps/web/src/history.ts')).duplicate(b,{past:[],future:[]},s.pageObjects(b,page)).board;break;
    case 'template':{const wrapper=(await load('apps/web/src/team/templates-rules.ts')).templateBoard(snapshot.objects);next=(await load('apps/web/src/activities.ts')).insertActivity(b,wrapper,{x:0,y:0,z:1},{w:1440,h:900},page).board;break;}
    case 'activity':{const {withoutPages}=await load('tests/import-fixture.mjs');const old={...withoutPages({...b,objects:s.pageObjects(b,page).map((o,order)=>({...o,order}))}),schemaVersion:7};next=(await load('apps/web/src/activities.ts')).insertActivity(b,old,{x:0,y:0,z:1},{w:1440,h:900},page).board;break;}
    case 'image':next=(await load('apps/web/src/images.ts')).addImages(b,[{hash:'0'.repeat(64),width:100,height:100,picture:{pixelWidth:1,pixelHeight:1}}],{x:0,y:0},page);break;
    case 'stroke':{const o=(await load('apps/web/src/strokes.ts')).makeStroke(b,[{x:0,y:0},{x:100,y:100}],{kind:'marker',color:'black',weight:'thin'},true,false,page);next=sections.placeObject(b,o);break;}
    case 'tape':next=sections.placeObject(b,(await load('apps/web/src/tape.ts')).makeTape(b,{x:0,y:0},{x:100,y:0},'stripes',false,page));break;
    case 'connector':{const [a,z]=s.pageObjects(b,page);next=(await load('apps/web/src/connectors.ts')).createConnector(b,a.id,z.id,undefined,page).board;break;}
    case 'mind node':{const maps=await load('apps/web/src/mind-map.ts'),root=maps.starterMap(b,{x:0,y:0},()=>({width:100,height:40}),page);next=maps.addChild(root.board,root.id,()=>({width:100,height:40})).board;break;}
    case 'wrap in section':next=sections.wrapSelection(b,selected,drawn(b),page).board;break;
    case 'Tidy up Apply':{const t=await load('apps/web/src/tidy-up.ts'),items=t.placeableItems(s.pageBoard(b,page),selected,drawn(b));next=t.applyTidy(b,t.tidyGrid(items,2,24));break;}
  }
  s.validate(next);assert.equal(next.pages.length,2);
  const untouched=board=>board.objects.filter(o=>o.page!==page).map(({order,...o})=>o);
  assert.deepEqual(untouched(next),untouched(before));assert.deepEqual(b,before);
  for(const o of next.objects.filter(o=>!existing.has(o.id)))assert.equal(o.page,page);
  assert.equal(s.pageObjects(next,page).length,next.objects.length-untouched(before).length);
});
check(26, 'cross-page find uses page order, current-page first, wrapping and the removed-page rule', async () => {
  const {s,board,first,second}=await fixture(),find=await load('apps/web/src/find.ts');
  let b=s.add(board,'sticky',800,-800,second);b.objects.forEach(o=>o.text='budget');b=s.renamePage(b,second,'Ideas');
  const results=s.pageFindResults(b,drawn(b),'budget');assert.deepEqual(results.map(r=>r.page),[first,second,second]);
  let cursor=s.firstPageResult(results,second);assert.equal(cursor.current.id,results[1].id);assert.equal(s.resultPageLine(b,cursor),'On page “Ideas”');
  cursor=s.stepPageResult(b,results,cursor,second,-1);assert.equal(cursor.current.page,first);
  cursor=s.stepPageResult(b,results,cursor,first,-1);assert.equal(cursor.current.id,results.at(-1).id);
  const third=s.addPage(b);assert.equal(s.firstPageResult(results,third.page.id).current,null);
  assert.equal(s.stepPageResult(third.board,results,{current:null,removed:null},third.page.id,1).current.page,first);
  assert.equal(s.stepPageResult(third.board,results,{current:null,removed:null},third.page.id,-1).current.id,results.at(-1).id);
  const moved={...results[1],page:first};assert.equal(find.reconcileCursor([results[0],moved,results[2]],{current:results[1],removed:null}).current.page,first);
  const removed={current:null,removed:results[1]},without=s.deletePage(b,second,first).board;
  assert.equal(s.stepPageResult(without,[results[0]],removed,first,1).current.id,results[0].id);
  assert.equal(s.resultPageLine(without,{current:results[0],removed:null}),'');
  const faded=find.fadedIds(drawn(b).filter(o=>o.page===first),results,new Set());assert.equal(faded.size,0);
});
check(27, 'storage and board files accept 13, classify 14 as newer, and preserve all pages', async () => {
  const {s,board}=await fixture(),{writeBoardFile,readBoardFile}=await load('apps/web/src/board-file.ts'),{decode,digest}=await load('apps/web/src/storage.ts');
  const file=raw=>({size:Buffer.byteLength(raw),arrayBuffer:async()=>new TextEncoder().encode(raw).buffer});
  assert.deepEqual(await readBoardFile(file(await writeBoardFile(board))),board);
  const payload=JSON.stringify({...board,schemaVersion:14}),sha256=await digest(payload);
  await assert.rejects(decode(JSON.stringify({formatVersion:1,storageRevision:1,payload,sha256})),/newer|Unsupported|unknown/i);
  await assert.rejects(readBoardFile(file(JSON.stringify({format:'nextphase-board',fileVersion:1,payload,sha256}))),/newer version/);
  assert.equal(s.validate(board).schemaVersion,13);
});

// A synthetic hook scheduler executes production state owners and handlers, never a browser.
async function harness(board) {
  await subjects();const {build}=await import('esbuild');
  const runtime=`let slots=[],cursor=0,pending=[],changed=false;
export const begin=()=>{cursor=0;pending=[];changed=false;};export const dirty=()=>changed;export const flush=()=>pending.splice(0).forEach(fn=>fn());export const dispose=()=>slots.forEach(s=>s?.cleanup?.());
export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{const value=typeof next==='function'?next(slots[i]):next;if(!Object.is(value,slots[i])){slots[i]=value;changed=true;}}];}
export function useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});}
export function useCallback(fn){cursor++;return fn;}
export function useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps||deps.some((x,j)=>!Object.is(x,old.deps?.[j])))pending.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}`;
  const built=await build({stdin:{contents:'export {usePages} from "./state/use-pages.ts";export {useBoardDocument} from "./state/use-board-document.ts";export {useGeometryEdits} from "./state/use-geometry-edits.ts";export {useEditingCommands} from "./state/use-editing-commands.ts";export {usePageKeys} from "./state/use-page-keys.ts";export {useFind} from "./state/use-find.ts";export {useTidyUp} from "./state/use-tidy-up.ts";export {begin,dirty,flush,dispose} from "test-react";',resolveDir:new URL('../apps/web/src/',import.meta.url).pathname,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'scheduler',setup(b){b.onResolve({filter:/^(react|test-react)$/},()=>({path:'runtime',namespace:'scheduler'}));b.onLoad({filter:/.*/,namespace:'scheduler'},()=>({contents:runtime,loader:'js'}));}}]});
  const m=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64')+'#'+crypto.randomUUID());
  const originals=Object.fromEntries(['window','document','localStorage','navigator','Element','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),values=new Map(),listeners=new Map();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{platform:'MacIntel'}});
  globalThis.Element=class {};globalThis.HTMLInputElement=class extends Element {};globalThis.HTMLTextAreaElement=class extends Element {};globalThis.HTMLSelectElement=class extends Element {};
  globalThis.window={innerWidth:1440,innerHeight:900,addEventListener(){},removeEventListener(){}};
  globalThis.document={activeElement:null,querySelector:()=>null,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const h={m,values,listeners,selected:new Set(),view:{x:0,y:0,z:1},messages:[],statuses:[],locked:'',hosted:false,extra:()=>{},events:[]};
  const select=value=>{h.selected=new Set(typeof value==='string'?value?[value]:[]:value);h.events.push('select');};
  const scene=h.scene={current:{clientWidth:1440,clientHeight:900,getBoundingClientRect:()=>({left:0,top:0}),focus(){}}};
  h.refresh=()=>{for(let n=0;n<20;n++){
    m.begin();h.doc=m.useBoardDocument({readOnly:false,setStatus:x=>h.statuses.push(x)});let ready=false;
    h.pages=m.usePages({board:h.doc.board,model:h.doc.model,stepPage:h.doc.stepPage,hosted:h.hosted,commit:h.doc.commit,finishTextSession:h.doc.finishTextSession,select,setMessage:x=>h.messages.push(x),getView:()=>h.view,setView:v=>h.view=v,getObjects:()=>drawn(h.doc.model.current),openingReason:()=>{assert(ready,'opening gate evaluated before composition completed');return h.locked;},editingReason:()=>{assert(ready,'editing gate evaluated before composition completed');return h.locked;}});
    ready=true;
    const common={pages:h.pages,page:h.pages.id,model:h.doc.model,commit:h.doc.commit,historyRef:h.doc.historyRef,updateHistory:h.doc.updateHistory,shapeSession:h.doc.shapeSession,connectorStyle:h.doc.connectorStyle,finishTextSession:h.doc.finishTextSession,beginTextSession:h.doc.beginTextSession,setDrafts:h.doc.setDrafts,setMessage:x=>h.messages.push(x),setStatus:x=>h.statuses.push(x),messageSequence:{current:0},alive:{current:true},selected:h.selected,select,objectLayouts:new Map(),readOnly:false,busy:false,composing:false,setTool(){},setPanel(){},setInline(){},editor:{current:null},lineCount:()=>1,measureNode:()=>({width:100,height:40}),scene,view:h.view,setView:v=>h.view=typeof v==='function'?v(h.view):v,displayedObjects:drawn(h.doc.model.current).filter(o=>o.page===h.pages.id),commandReason:'',selectionReason:'',clipboardState:{readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false},editingState:{readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false},arrangementMembers:[],tool:'Select'};
    h.geometry=m.useGeometryEdits(common);h.commands=m.useEditingCommands(common);h.keys=m.usePageKeys({...common,cancel(){}});
    h.find=m.useFind({...common,board:h.doc.board,boardId:h.doc.board.boardId,allDisplayedObjects:drawn(h.doc.board),size:{w:1440,h:900},tidy:{open:false}});
    h.extra(common);const dirty=m.dirty();m.flush();if(!dirty&&!m.dirty())return;
  }throw Error('Page state did not settle');};
  h.close=()=>{m.dispose();h.doc.adapter.current?.destroy();for(const[k,v]of Object.entries(originals))if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];};
  h.refresh();h.doc.load(board);h.refresh();return h;
}
check(28, 'page owner remembers pages and per-tab views, closes selection and never edits on open', async () => {
  const {board,first,second}=await fixture(),h=await harness(board);
  try{const revision=h.doc.revision.current,bytes=JSON.stringify(h.doc.model.current);h.view={x:20,y:10,z:.8};h.pages.openPage(second);h.refresh();
    assert.equal(h.pages.id,second);assert.equal(h.selected.size,0);const fit=h.view;h.view={...fit,x:fit.x+100};h.pages.openPage(first);h.refresh();assert.deepEqual(h.view,{x:20,y:10,z:.8});
    h.pages.openPage(second);h.refresh();assert.equal(h.view.x,fit.x+100);assert.equal(h.values.get('nextphase-board/page/v1/'+board.boardId),second);
    assert.equal(JSON.stringify(h.doc.model.current),bytes);assert.equal(h.doc.revision.current,revision);assert.equal(h.doc.history.past.length,0);
    h.locked='Gesture in progress';h.pages.openPage(first);h.refresh();assert.equal(h.pages.id,second);
    h.locked='';globalThis.localStorage={getItem(){throw Error();},setItem(){throw Error();}};h.pages.openPage(first);h.refresh();assert.equal(h.pages.id,first);
  }finally{h.close();}
});
check(29, 'actual add/rename/delete/move steps and Undo/Redo apply before opening the step page', async () => {
  const {board,first,second}=await fixture(),h=await harness(board);
  try{h.pages.add();h.refresh();const added=h.pages.id;assert.equal(h.doc.history.past.length,1);assert.equal(h.pages.editing,added);h.pages.changeName('Notes');h.refresh();h.pages.finishName(true);h.refresh();assert.equal(h.doc.history.past.length,2);
    h.commands.command('Undo');h.refresh();assert.equal(h.pages.id,added);h.commands.command('Undo');h.refresh();assert.equal(h.pages.id,first);assert(!h.doc.board.pages.some(p=>p.id===added));
    h.pages.openPage(second);h.refresh();h.pages.choose('Delete page',second);h.refresh();assert.equal(h.pages.id,first);h.commands.command('Undo');h.refresh();assert.equal(h.pages.id,second);
    h.commands.command('Redo');h.refresh();assert.equal(h.pages.id,first);h.commands.command('Undo');h.refresh();
    h.selected=ids(h.doc.board.objects.filter(o=>o.page===second));h.refresh();h.pages.move(first,h.selected);h.refresh();assert.equal(h.selected.size,0);assert(h.pages.go.text.startsWith('Moved '));h.commands.command('Undo');h.refresh();assert.equal(h.pages.id,second);
  }finally{h.close();}
});
check(30, 'actual creation, template/paste dispatch, Select all Delete and find keep other pages intact', async () => {
  const {board,first,second}=await fixture(),h=await harness(board);
  try{h.pages.openPage(second);h.refresh();const untouched=structuredClone(h.doc.board.objects.filter(o=>o.page===first));
    h.geometry.create('Sticky',800,500);h.refresh();assert.equal(h.doc.board.objects.at(-1).page,second);
    h.commands.clipboardCommand('Copy');h.refresh();h.commands.clipboardCommand('Paste');h.refresh();assert.equal(h.doc.board.objects.length,4);
    const clip=await load('apps/web/src/clipboard.ts'),template=await load('apps/web/src/team/templates-rules.ts');const stored=template.templateBoard(clip.buildSnapshot(h.doc.board,h.selected,drawn(h.doc.board)).objects);h.commands.templateCommands.insertStored('Synthetic template',stored);h.refresh();assert.equal(h.doc.board.objects.length,5);assert.equal(h.doc.board.objects.at(-1).page,second);
    h.keys.pageKeyDown({key:'a',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,target:h.scene.current,preventDefault(){},nativeEvent:{}});
    assert.deepEqual([...h.selected],h.doc.board.objects.filter(o=>o.page===second).map(o=>o.id));h.refresh();h.commands.command('Delete');h.refresh();
    assert.deepEqual(h.doc.board.objects.map(({order,...o})=>o),untouched.map(({order,...o})=>o));h.commands.command('Undo');h.refresh();
    h.doc.model.current.objects.forEach(o=>o.text=o.page===first?'budget':'other');h.doc.setBoard(h.doc.model.current);h.refresh();h.find.show();h.refresh();h.find.changeQuery('budget');h.refresh();assert.equal(h.find.counter,'– of 1');h.find.step(1);h.refresh();assert.equal(h.pages.id,first);assert.equal(h.find.pageLine,'On page “Page 1”');h.pages.openPage(second);h.refresh();assert.equal(h.find.cursor.current.page,first);h.find.close();h.refresh();assert.equal(h.selected.size,0);
  }finally{h.close();}
});
check(31, 'actual Tidy up Apply commits the whole board and one current-page history step', async () => {
  const {s,board,first,second}=await fixture();let b=board;for(let n=0;n<2;n++)b=s.add(b,'sticky',n*400,800,second);
  const h=await harness(b);try{h.pages.openPage(second);h.refresh();h.selected=ids(s.pageObjects(h.doc.board,second));
    h.extra=common=>h.tidy=h.m.useTidyUp({...common,board:h.doc.board,objects:h.pages.objects()});h.refresh();h.tidy.measure(drawn(h.doc.board));
    const before=structuredClone(h.doc.board.objects.filter(o=>o.page===first));h.tidy.start({readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false});h.refresh();assert(h.tidy.open);h.tidy.apply();h.refresh();
    assert.equal(h.doc.history.past.length,1);assert.equal(h.doc.history.past[0].page,second);assert.deepEqual(h.doc.board.objects.filter(o=>o.page===first).map(({order,...o})=>o),before.map(({order,...o})=>o));s.validate(h.doc.board);
  }finally{h.close();}
});
check(32, 'drag threshold/cancel, invalid rename, remembered reload and hosted controls use the one page owner', async () => {
  const {s,board,first,second}=await fixture(),h=await harness(board);try{
    for(const [i,p]of board.pages.entries())h.pages.names.current.set(p.id,{getBoundingClientRect:()=>({top:100+i*38,height:36}),focus(){}});
    h.pages.beginDrag(second,156);h.refresh();h.pages.dragTo(153);h.refresh();assert.equal(h.pages.drag.active,false);h.pages.endDrag();h.refresh();assert.equal(h.doc.history.past.length,0);
    h.pages.beginDrag(second,156);h.refresh();h.pages.dragTo(90);h.refresh();assert(h.pages.drag.active);h.pages.endDrag(true);h.refresh();assert.deepEqual(h.doc.board.pages,board.pages);
    h.pages.beginDrag(second,156);h.refresh();h.pages.dragTo(90);h.refresh();h.pages.endDrag();h.refresh();assert.equal(h.doc.board.pages[0].id,second);assert.equal(h.pages.id,first);
    h.pages.rename(second);h.refresh();h.pages.changeName('x\ty');h.refresh();h.pages.finishName(true);h.refresh();assert.equal(h.doc.history.past.length,1);
    h.pages.openPage(second);h.refresh();const other={...s.empty(),title:'Other'};h.doc.load(other);h.refresh();h.doc.load(board);h.refresh();assert.equal(h.pages.id,second);
    h.hosted=true;h.refresh();assert.equal(h.pages.local,true);assert.equal(h.pages.open,false);
  }finally{h.close();}
});
check(33, 'room evaluation accepts pages changes and refuses only missing-page objects and permits an ordinary edit', async () => {
  const {s,board,first}=await fixture(),{Adapter}=await load('packages/board-sync/src/document-adapter.ts'),{readBoard}=await load('packages/board-sync/src/codec.ts'),{evaluate}=await load('packages/board-room/src/edits.ts'),{NodeStorage}=await load('apps/server/src/node-storage.ts'),{initialize}=await load('packages/board-room/src/storage.ts'),Y=await import('yjs');
  const single=s.deletePage(board,board.pages[1].id,first).board,seed=new Adapter();seed.set(single);const storage=new NodeStorage(':memory:');initialize(storage);
  try{for(const [index,mutation] of [b=>s.addPage(b).board,b=>s.renamePage(b,first,'Renamed'),b=>{const id=crypto.randomUUID();return {...b,pages:[{id,name:'Other'}],objects:b.objects.map(o=>({...o,page:id}))};},b=>({...b,objects:b.objects.map(o=>({...o,page:crypto.randomUUID()}))})].entries()){
    const client=new Adapter();Y.applyUpdate(client.doc,Y.encodeStateAsUpdate(seed.doc));const vector=Y.encodeStateVector(client.doc);client.set(mutation(readBoard(client.doc)));const result=evaluate(seed.doc,single,Y.encodeStateAsUpdate(client.doc,vector),storage);if(result.kind==='complete')result.doc.destroy();else assert.deepEqual(result,{kind:'refused',reason:'invalid_document'});assert.equal(result.kind,index===3?'refused':'complete');client.destroy();
  }
  const client=new Adapter();Y.applyUpdate(client.doc,Y.encodeStateAsUpdate(seed.doc));const vector=Y.encodeStateVector(client.doc);client.set({...single,title:'Edited'});const result=evaluate(seed.doc,single,Y.encodeStateAsUpdate(client.doc,vector),storage);assert.equal(result.kind,'complete');result.doc.destroy();client.destroy();
  }finally{seed.destroy();storage.close();}
});
check(34, 'both template wrappers reject stored page and put inserted objects on the explicit page', async () => {
  const {board,second}=await fixture(),{buildSnapshot}=await load('apps/web/src/clipboard.ts'),{templateObjects}=await load('apps/server/src/templates.ts'),{templateBoard}=await load('apps/web/src/team/templates-rules.ts'),{insertActivity}=await load('apps/web/src/activities.ts'),s=await subjects();
  const snapshot=buildSnapshot(board,ids(board.objects),drawn(board));assert(snapshot.objects.every(o=>!('page'in o)));
  const invalid=snapshot.objects.map(o=>({...o,page:second}));assert.throws(()=>templateBoard(invalid));assert.throws(()=>templateObjects(invalid),e=>e.message==='bad_request');
  const wrapper=templateBoard(snapshot.objects);assert.equal(wrapper.schemaVersion,13);assert.deepEqual(wrapper.pages,[{id:wrapper.boardId,name:'Page 1'}]);
  const next=insertActivity(board,wrapper,{x:0,y:0,z:1},{w:1440,h:900},second).board;s.validate(next);assert(next.objects.slice(board.objects.length).every(o=>o.page===second));
});
check(35, 'closing menus preserves their explicit return focus instead of focusing the current page name', async () => {
  const {board,first,second}=await fixture(),h=await harness(board),focus=[];
  try{h.pages.names.current.set(first,{focus:()=>focus.push('current name')});h.pages.options.current.set(second,{focus:()=>focus.push('other options')});
    h.pages.pageMenu.current={querySelector:()=>({focus:()=>focus.push('menu item')})};h.pages.moveMenu.current={querySelector:()=>({focus:()=>focus.push('move item')})};h.pages.moveButton.current={focus:()=>focus.push('move button')};
    h.pages.toggle();h.refresh();assert.equal(focus.at(-1),'current name');h.pages.showMenu(second);h.refresh();assert.equal(focus.at(-1),'menu item');
    h.pages.closeMenu();h.refresh();assert.equal(focus.at(-1),'other options');h.pages.toggleMove();h.refresh();assert.equal(focus.at(-1),'move item');h.pages.closeMove();h.refresh();assert.equal(focus.at(-1),'move button');
  }finally{h.close();}
});

test('0010-W2 F1 page control states outrank shared hover without changing shared button CSS', async () => {
  const {readFile}=await import('node:fs/promises'),{execFileSync}=await import('node:child_process');
  const css=await readFile(new URL('../apps/web/style.css',import.meta.url),'utf8');
  const base=execFileSync('git',['show','2a1ad32:apps/web/style.css'],{encoding:'utf8'});
  assert.equal(css.split('/* Pages:')[0],base.split('/* Pages:')[0]);
  const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([,selectors,body],order)=>selectors.split(',').map(selector=>({selector:selector.trim(),body,order})));
  const rule=selector=>{const found=rules.find(r=>r.selector===selector);assert(found,`Missing state selector: ${selector}`);return found;};
  // These selectors use only classes, attributes, type selectors and simple :not/:has.
  const specificity=selector=>{
    const simple=selector.replace(/:(?:not|has)\(([^()]*)\)/g,'$1'),parts=/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g;
    return (simple.match(parts)??[]).length*100+(simple.replace(parts,'').match(/[a-z][\w-]*/gi)??[]).length;
  };
  function wins(selector,over,fill,colour) {
    const state=rule(selector),other=rule(over);
    assert(specificity(selector)>specificity(over)||specificity(selector)===specificity(over)&&state.order>other.order,`${selector} must outrank ${over}`);
    assert(state.body.includes(`background: var(--np-${fill})`));
    if(colour)assert(state.body.includes(`color: var(--np-${colour})`));
  }
  for(const [token,value]of [['sunken','#eef1f5'],['line','#d9dfe7'],['accent-soft','#dceafb'],['accent','#1665d8']])assert(css.includes(`--np-${token}: ${value};`));
  const enabled=':not(:disabled):not([aria-disabled=true])',shared='button:hover:not(:disabled):not([aria-disabled=true])';
  const hover='.pages-button:hover'+enabled,open='.pages-button.page-active'+enabled;
  const iconHover='.pages-panel .page-icon:hover'+enabled,pressed='.pages-panel .page-icon:active'+enabled;
  const options='.pages-panel .page-row.menu-open .page-options'+enabled;
  wins(hover,shared,'sunken');wins(open,shared,'accent-soft','accent');wins(open,hover,'accent-soft','accent');
  wins(iconHover,shared,'sunken');wins(pressed,shared,'line');wins(pressed,iconHover,'line');
  wins(options,iconHover,'line');wins(options,pressed,'line');
  wins('.pages-panel .page-row.menu-open','.page-row.current','sunken');
  wins('.pages-panel .page-row.menu-open','.page-row:not(.current):hover','sunken');
  const move='.context .move-page-button.page-active'+enabled;
  wins(move,shared,'accent-soft','accent');wins(move,'.context button:hover:not(:disabled)','accent-soft','accent');
});

test('0010-W2 F2 rings show only the open page while counters, page lines and stepping search every page', async () => {
  const s=await subjects(),{findCounter}=await load('apps/web/src/find.ts'),{build}=await import('esbuild');
  const built=await build({stdin:{contents:'export {FindRings} from "./scene/find-rings.tsx";',resolveDir:new URL('../apps/web/src/',import.meta.url).pathname,loader:'tsx'},
    bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic'});
  const {FindRings}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  let board={...s.empty(),title:'Find pages'};board=s.renamePage(board,board.boardId,'Agenda');
  const agenda=board.boardId;
  for(const [text,x]of [['welcome budget',0],['budget',300]]){board=s.add(board,'sticky',x,0,agenda);board.objects.at(-1).text=text;}
  const second=s.addPage(board);board=s.renamePage(second.board,second.page.id,'Ideas');board=s.add(board,'sticky',0,0,second.page.id);board.objects.at(-1).text='budget';
  const third=s.addPage(board);board=s.renamePage(third.board,third.page.id,'Retro');board=s.add(board,'sticky',0,0,third.page.id);board.objects.at(-1).text='budget';
  const before=s.canonical(board),[a,b,i,r]=board.objects.map(o=>o.id);let open=third.page.id;
  const find={open:true,query:'welcome',results:s.pageFindResults(board,drawn(board),'welcome'),cursor:{current:null,removed:null}};
  find.cursor=s.firstPageResult(find.results,open);
  const rings=()=>FindRings({find,page:open,pos:o=>({left:o.x,top:o.y}),zoom:1})?.props.children??[];
  const counter=()=>findCounter(find.query,find.results,find.cursor);
  const step=direction=>{find.cursor=s.stepPageResult(board,find.results,find.cursor,open,direction);open=find.cursor.current.page;};
  assert.equal(counter(),'– of 1');assert.deepEqual(rings(),[]);
  step(1);assert.equal(open,agenda);assert.equal(s.resultPageLine(board,find.cursor),'On page “Agenda”');
  assert.deepEqual(rings().map(r=>r.key),[a]);assert.equal(rings()[0].props.className,'find-ring current');
  find.query='budget';find.results=s.pageFindResults(board,drawn(board),find.query);find.cursor=s.firstPageResult(find.results,open);
  assert.equal(counter(),'1 of 4');assert.deepEqual(rings().map(r=>r.key),[a,b]);assert.equal(rings()[1].props.className,'find-ring');
  step(1);step(1);assert.equal(open,second.page.id);assert.equal(counter(),'3 of 4');
  assert.equal(s.resultPageLine(board,find.cursor),'On page “Ideas”');assert.deepEqual(rings().map(r=>r.key),[i]);
  open=third.page.id;assert.deepEqual(rings().map(r=>r.key),[r]);assert.equal(rings()[0].props.className,'find-ring');
  assert.equal(counter(),'3 of 4');assert.equal(s.resultPageLine(board,find.cursor),'On page “Ideas”');
  step(-1);assert.equal(open,agenda);assert.equal(counter(),'2 of 4');assert.deepEqual(rings().map(r=>r.key),[a,b]);assert.equal(rings()[1].props.className,'find-ring current');
  find.open=false;assert.equal(FindRings({find,page:open,pos:o=>({left:o.x,top:o.y}),zoom:1}),null);
  assert.equal(s.canonical(board),before);
});

test('0010-W2 F1b name buttons stay transparent and menu states beat hover without losing focus or disabled looks', async () => {
  const {readFile}=await import('node:fs/promises'),{execFileSync}=await import('node:child_process');
  const css=await readFile(new URL('../apps/web/style.css',import.meta.url),'utf8');
  const base=execFileSync('git',['show','7d5e618:apps/web/style.css'],{encoding:'utf8'});
  const parse=text=>[...text.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([,selectors,body],order)=>selectors.split(',').map(selector=>({selector:selector.trim(),body,order})));
  const rules=parse(css),prior=parse(base),rule=(selector,list=rules)=>list.find(r=>r.selector===selector);
  const specificity=selector=>{
    const simple=selector.replace(/:(?:not|has)\(([^()]*)\)/g,'$1'),parts=/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g;
    return (simple.match(parts)??[]).length*100+(simple.replace(parts,'').match(/[a-z][\w-]*/gi)??[]).length;
  };
  const faults=[];
  function wins(label,selectors,competitors,declaration) {
    const state=selectors.map(s=>rule(s)).find(Boolean);assert(state,label);assert(state.body.includes(declaration),label);
    for(const selector of competitors){const other=rule(selector);assert(other,selector);
      if(!(specificity(state.selector)>specificity(selector)||specificity(state.selector)===specificity(selector)&&state.order>other.order))faults.push(`${label} loses to ${selector}`);
    }
  }
  wins('transparent name in every state',['.pages-panel .page-row button.page-name','.pages-panel button'],
    ['button:hover:not(:disabled):not([aria-disabled=true])'],'background: transparent;');
  if(rule('.pages-panel .page-row button.page-name'))assert.equal(rule('.pages-panel .page-row button.page-name').body.trim(),'background: transparent;');
  wins('pressed Page options item',['.page-menu button:active:not(:disabled)'],
    ['.page-menu button:hover:not(:disabled)','.page-menu button:focus:not(:disabled)'],'background: var(--np-line);');
  wins('pressed Move menu item',['.context .page-menu button:active:not(:disabled)','.page-menu button:active:not(:disabled)'],
    ['.context .page-menu button:hover:not(:disabled)','.page-menu button:focus:not(:disabled)'],'background: var(--np-line);');
  wins('Delete page colour',['.page-menu button.page-danger:not(:disabled)','.page-menu button.page-danger'],
    ['.page-menu button:hover:not(:disabled)','.page-menu button:focus:not(:disabled)'],'color: var(--np-critical);');
  for(const selector of ['.page-menu button:hover:not(:disabled)','.page-menu button:focus:not(:disabled)','.context .page-menu button:hover:not(:disabled)']){
    assert(rule(selector).body.includes('background: var(--np-sunken);'));
    const state=rule(selector),shared=rule('button:hover:not(:disabled):not([aria-disabled=true])');
    assert(specificity(selector)>specificity(shared.selector)||specificity(selector)===specificity(shared.selector)&&state.order>shared.order);
  }
  // Keep row-owned fills, Add/options states, font weights, focus and disabled styles exactly as before.
  for(const selector of ['.pages-panel button','.pages-panel .page-name','.page-row.current','.page-row.current .page-name',
    '.page-row:not(.current):hover','.page-row:has(.page-name:active)',
    '.pages-panel .page-icon:hover:not(:disabled):not([aria-disabled=true])','.pages-panel .page-icon:active:not(:disabled):not([aria-disabled=true])',
    '.pages-panel .page-row.menu-open','.pages-panel .page-row.menu-open .page-options:not(:disabled):not([aria-disabled=true])',
    '.pages-panel button:focus-visible','.page-menu button:focus-visible','.page-menu button:disabled','.context .page-menu button:disabled']){
    assert.equal(rule(selector)?.body,rule(selector,prior)?.body,selector);
  }
  assert.equal(css.split('/* Pages:')[0],base.split('/* Pages:')[0]);
  assert.deepEqual(faults,[]);
});
