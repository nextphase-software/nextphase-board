// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { Adapter, add, canonical, empty, upgrade, validate } from "../apps/web/src/document.ts";
import { addImages, landingSize, scaledPixels, imageRow, importReason, refusalNotice, prepareImage, decodePicture, IMAGE_REASONS, nativePasteKey, descriptionDraft, describeImage } from "../apps/web/src/images.ts";
import { signature, pictureHash, validPicture, assetKey, pictureBytes, readPictures, storePicture, PICTURE_LIMIT, tabPictures } from "../apps/web/src/image-assets.ts";
import { objectKeys, isImage, hasRectangle, hasText, hasPoints, imageType, eligibleIdea, defaultDrawingStyle } from "../apps/web/src/objects/registry.ts";
import { record, emptyHistory, undo, redo, duplicate } from "../apps/web/src/history.ts";
import { groupObjects, groupNumbers } from "../apps/web/src/group.ts";
import { objectLabel } from "../apps/web/src/sections.ts";
import { createConnector, connectReason } from "../apps/web/src/connectors.ts";
import { buildSnapshot, buildPaste, plainText, PASTE_PICTURES_REASON } from "../apps/web/src/clipboard.ts";
import { resizeWithStrokes, changeOrdinaryColor, makeStroke } from "../apps/web/src/strokes.ts";
const board = () => ({ ...empty(), title: "Synthetic images" });
const png = Uint8Array.from([137,80,78,71,13,10,26,10,0]).buffer;
const picture = (bytes = png, width = 300, height = 200) => ({ bytes, mime: signature(bytes), pixelWidth: width, pixelHeight: height });
const prepared = async (bytes = png, width = 300, height = 200) => ({ hash: await pictureHash(bytes), picture: picture(bytes, width, height), ...landingSize(width, height) });
const image = await prepared();
const withImage = (b = board(), value = image) => addImages(b, [value], { x: 0, y: 0 });
const selected = (b) => new Set(b.objects.map((o) => o.id));
const drawn = (b) => b.objects.map((o) => ({ ...o, displayHeight: o.height }));

test("v10 image keys, order, canonical bytes and every field boundary", () => {
  const b = withImage(), o = b.objects[0];
  assert.equal(b.schemaVersion, 10);
  assert.deepEqual(Object.keys(JSON.parse(canonical(b)).objects[0]), ["id","generation","type","group","section","asset","pixelWidth","pixelHeight","description","x","y","width","height","order"]);
  assert.equal(canonical(validate(JSON.parse(canonical(b)))), canonical(b));
  for (const key of ["pixelWidth", "pixelHeight"]) {
    for (const value of [1,4096]) assert.doesNotThrow(() => canonical({ ...b, objects: [{ ...o, [key]: value }] }));
    for (const value of [0,4097,1.5, "1"]) assert.throws(() => canonical({ ...b, objects: [{ ...o, [key]: value }] }));
  }
  for (const key of ["width", "height"]) {
    for (const value of [1,20000]) assert.doesNotThrow(() => canonical({ ...b, objects: [{ ...o, [key]: value }] }));
    for (const value of [.5,20001,NaN]) assert.throws(() => canonical({ ...b, objects: [{ ...o, [key]: value }] }));
  }
  assert.doesNotThrow(() => canonical({ ...b, objects: [{ ...o, asset: "abcdef0123456789".repeat(4), description: "🧭".repeat(1000) }] }));
  for (const asset of ["A".repeat(64), "a".repeat(63), "g".repeat(64)]) assert.throws(() => canonical({ ...b, objects: [{ ...o, asset }] }));
  for (const description of ["🧭".repeat(1001), "\ud800", null]) assert.throws(() => canonical({ ...b, objects: [{ ...o, description }] }));
  for (const key of objectKeys(imageType().type, 10)) { const copy = { ...o }; delete copy[key]; assert.throws(() => canonical({ ...b, objects: [copy] }), key); }
  for (const key of ["text","color","textSize","align","marks","shape","fill","border","kind","points","from"]) assert.throws(() => canonical({ ...b, objects: [{ ...o, [key]: "extra" }] }), key);
  const sticky = add(board(), "sticky", 0, 0);
  for (const key of ["asset","pixelWidth","pixelHeight","description"]) assert.throws(() => canonical({ ...sticky, objects: [{ ...sticky.objects[0], [key]: o[key] }] }));
  for (let version = 1; version <= 9; version++) assert.throws(() => canonical({ ...b, schemaVersion: version }));
});

test("versions 1 to 9 preserve exact payload and upgrade without mutating the saved board", () => {
  const current = add(board(), "sticky", 0, 0);
  for (let version = 1; version <= 9; version++) {
    const o = { ...current.objects[0] };
    if (version < 2) for (const key of ["color","textSize","align"]) delete o[key];
    if (version < 3) delete o.group; if (version < 4) delete o.marks; if (version < 5) delete o.section;
    const old = { ...current, schemaVersion: version, objects: [o] }, bytes = canonical(old), copy = structuredClone(old);
    const read = validate(JSON.parse(bytes)), upgraded = upgrade(read);
    assert.equal(canonical(read), bytes); assert.deepEqual(old, copy); assert.equal(upgraded.schemaVersion, 10);
    assert.equal(record(emptyHistory(), upgraded, upgraded).past.length, 0);
  }
});

test("adapter holds image plain values whole; projection, recreation, add/describe/resize Undo and Redo", () => {
  const start = board(), added = withImage(start), o = added.objects[0], adapter = new Adapter();
  adapter.set(added);
  const m = adapter.doc.getMap("objects").get(o.id);
  for (const key of ["asset","pixelWidth","pixelHeight","description"]) assert.deepEqual(m.get(key), o[key]);
  for (const key of ["text","style","marks","kind","points","ends","connectorStyle"]) assert.equal(m.has(key), false);
  const { generation, type, group, section, order, geometry, ...values } = m.toJSON();
  const projected = { ...added, objects: [{ id: o.id, generation, type, group, section, ...values, ...geometry, order }] };
  assert.equal(canonical(projected), canonical(added));
  const recreated = new Adapter(); recreated.set(validate(JSON.parse(canonical(projected))));
  assert.deepEqual(recreated.doc.getMap("objects").get(o.id).toJSON(), m.toJSON());
  const described = describeImage(added, added.boardId, o.id, o.generation, "Synthetic 🧭"), resized = { ...described, objects: [{ ...described.objects[0], width: 600, height: 400 }] };
  let b = resized, history = record(record(record(emptyHistory(), start, added), added, described), described, resized);
  assert.equal(history.past.length, 3);
  for (let i = 0; i < 3; i++) { const r = undo(b, history); b = r.board; history = r.history; }
  assert.equal(b.objects.length, 0);
  for (let i = 0; i < 3; i++) { const r = redo(b, history); b = r.board; history = r.history; }
  assert.deepEqual({ ...b.objects[0], generation: o.generation }, resized.objects[0]); assert.notEqual(b.objects[0].generation, o.generation);
  adapter.destroy(); recreated.destroy();
});

test("content signatures accept PNG/JPEG/GIF87a/GIF89a/WebP and reject truncated or other bytes", () => {
  const ascii = (s) => new TextEncoder().encode(s).buffer;
  for (const [bytes, mime] of [[png,"image/png"],[Uint8Array.from([255,216,255]).buffer,"image/jpeg"],[ascii("GIF87a"),"image/gif"],[ascii("GIF89a"),"image/gif"],[ascii("RIFF0000WEBP"),"image/webp"]]) assert.equal(signature(bytes), mime);
  for (const bytes of [new ArrayBuffer(0), png.slice(0,7), ascii("RIFF0000NOPE"), ascii("text")]) assert.equal(signature(bytes), null);
});

test("landing sizes use original pixels; stored long side, tall images and excessive width", () => {
  for (const [w,h,width,height] of [[300,200,300,200],[800,600,640,480],[6000,1000,2880,480],[600,3000,96,480]]) assert.deepEqual(landingSize(w,h), { width,height });
  assert.deepEqual(scaledPixels(6000,1000), { pixelWidth:4096,pixelHeight:683 });
  assert.deepEqual(scaledPixels(1000,6000), { pixelWidth:683,pixelHeight:4096 });
  assert.throws(() => landingSize(20001,1), { message: IMAGE_REASONS.size });
});

test("row has 16-unit gaps, bottom alignment, centred bounds and independent edge clamps", () => {
  assert.deepEqual(imageRow([{ width:320,height:480 },{ width:420,height:280 }], { x:100,y:40 }), [{ x:-278,y:-200,width:320,height:480 },{ x:58,y:0,width:420,height:280 }]);
  const row = imageRow([{ width:30,height:20 },{ width:40,height:50 },{ width:60,height:10 }], { x:10,y:20 });
  assert.deepEqual(row.map((r) => r.y+r.height), [45,45,45]); assert.equal(row[1].x-row[0].x-row[0].width,16); assert.equal(row[2].x-row[1].x-row[1].width,16);
  assert.equal((row[0].x+row[2].x+row[2].width)/2,10);
  for (const edge of [-1e6,1e6]) for (const r of imageRow([image,image], { x:edge,y:edge })) assert(r.x>=-1e6 && r.y>=-1e6 && r.x+r.width<=1e6 && r.y+r.height<=1e6);
});

test("import limits count unique available bytes, unavailable references and accepted objects in order", () => {
  let b = board(); for (let i=0;i<249;i++) b=add(b,"sticky",0,0);
  assert.equal(importReason(b,[],image,new Map()), ""); assert.equal(importReason(b,[image],image,new Map()),IMAGE_REASONS.objects);
  const huge = { ...image, picture:{ ...image.picture, bytes:new ArrayBuffer(PICTURE_LIMIT) } };
  assert.equal(importReason(board(),[],huge,new Map()), "");
  assert.equal(importReason(board(),[],{ ...huge,picture:{ ...huge.picture,bytes:new ArrayBuffer(PICTURE_LIMIT+1) } },new Map()),IMAGE_REASONS.bytes);
  const ten = { ...image,hash:"b".repeat(64),picture:{ ...image.picture,bytes:new ArrayBuffer(10*1024*1024) } };
  const fortyFive = { ...image,picture:{ ...image.picture,bytes:new ArrayBuffer(45*1024*1024) } };
  const refs = addImages(board(),[fortyFive,ten],{ x:0,y:0 }), cache = new Map([[image.hash,fortyFive.picture]]);
  assert.equal(pictureBytes(refs,cache),45*1024*1024);
  assert.equal(importReason(refs,[],ten,cache),IMAGE_REASONS.bytes);
  assert.equal(importReason(withImage(),[],image,new Map([[image.hash,image.picture]])), "");
  assert.equal(importReason(board(),[huge],huge,new Map()), "");
});

test("refusal notices keep three names, the remainder, empty-name fallback and distinct ordered reasons", () => {
  const r=(name,reason="first")=>({name,reason});
  assert.equal(refusalNotice([r("")]),"Could not add Clipboard image: first.");
  assert.equal(refusalNotice([r("a"),r("b")]),"Could not add a and b: first.");
  assert.equal(refusalNotice([r("a"),r("b","second"),r("c")]),"Could not add a, b and c: first; second.");
  assert.equal(refusalNotice([r("a"),r("b"),r("c"),r("d","second"),r("e","third")]),"Could not add a, b and c and 2 more: first; second; third.");
});

test("picture records require exact keys, digest, MIME/signature, bounded pixels and bytes", async () => {
  assert.equal(await validPicture(assetKey(image.hash),image.picture),true);
  for (const value of [{ ...image.picture,extra:1 },{ ...image.picture,mime:"image/jpeg" },{ ...image.picture,pixelWidth:0 },{ ...image.picture,pixelHeight:4097 },{ ...image.picture,pixelWidth:1.5 },{ ...image.picture,bytes:new Uint8Array(png) },{ ...image.picture,bytes:new ArrayBuffer(0) }]) assert.equal(await validPicture(assetKey(image.hash),value),false);
  assert.equal(await validPicture(assetKey("a".repeat(64)),image.picture),false);
  const invalid=picture(new Uint8Array([1,2,3]).buffer); assert.equal(await validPicture(assetKey(await pictureHash(invalid.bytes)),invalid),false);
  assert.equal(await validPicture("asset/"+image.hash.toUpperCase(),image.picture),false);
});

test("missing/invalid reads stay unavailable and are not rewritten; bitmap dimensions must match", async (t) => {
  const reads=[],records=new Map([[assetKey(image.hash),{ ...image.picture,mime:"image/jpeg" }]]), cache=new Map();
  const db={ transaction(){ const tx={ objectStore(){ return { get(key){ reads.push(key); const r={}; queueMicrotask(()=>{ r.result=records.get(key); }); return r; } }; } }; setImmediate(()=>tx.oncomplete()); return tx; } };
  await readPictures(db,[image.hash,"a".repeat(64)],cache); assert.equal(cache.size,0); assert.equal(records.size,1);
  records.set(assetKey(image.hash),image.picture); await readPictures(db,[image.hash],cache); assert.equal(cache.size,1);
  const count=reads.length; await readPictures(db,[image.hash],cache); assert.equal(reads.length,count);
  let closed=0;
  const original=globalThis.createImageBitmap; t.after(()=>{globalThis.createImageBitmap=original;});
  globalThis.createImageBitmap=async()=>({ width:301,height:200,close(){closed++;} });
  await assert.rejects(decodePicture(image.picture),/unavailable/); assert.equal(closed,1);
});

test("batch images have fresh identities/generations, empty descriptions, section membership, final idea order and one history step", () => {
  let b=add(board(),"section",0,0); b=add(b,"sticky",0,0);
  const next=addImages(b,[image,image],{x:0,y:0}), added=next.objects.slice(2);
  assert.equal(added.length,2); assert(added.every(o=>o.description===""&&o.group===null&&o.section===b.objects[0].id));
  assert.equal(new Set(next.objects.flatMap(o=>[o.id,o.generation])).size,8);
  assert.equal(record(emptyHistory(),b,next).past.length,1); validate(next);
});

test("image proportional resizing respects floor, ceiling, board edges and mixed sticky limits", () => {
  const b=withImage(), o=b.objects[0], start=[{object:o,rectangle:o}];
  const grown=resizeWithStrokes("se",start,{x:10,y:0},()=>0)[0]; assert(Math.abs(grown.width-310)<1e-10); assert(Math.abs(grown.height-200*310/300)<1e-10);
  const tiny=resizeWithStrokes("se",start,{x:-999,y:-999},()=>0)[0]; assert(tiny.width>=1&&tiny.height>=1); assert(Math.abs(tiny.width/tiny.height-1.5)<1e-10);
  const max=resizeWithStrokes("se",start,{x:1e8,y:1e8},()=>0)[0]; assert(max.width<=20000&&max.height<=20000);
  const edge={...o,x:1e6-o.width,y:1e6-o.height}; const bounded=resizeWithStrokes("se",[{object:edge,rectangle:edge}],{x:100,y:100},()=>0)[0]; assert(bounded.x+bounded.width<=1e6 && bounded.y+bounded.height<=1e6); assert(Math.abs(bounded.width-edge.width)<1e-8);
  const mixed=add(b,"sticky",500,0).objects.map(o=>({object:o,rectangle:o}));
  const small=resizeWithStrokes("se",mixed,{x:-1e5,y:-1e5},()=>0); assert(small.find(o=>!isImage(o)).width>=80); assert(isImage(small[0]));
});

test("Objects numbering/description/group/section labels and connector eligibility", () => {
  let b=add(board(),"section",0,0); b=add(b,"sticky",0,0); b=withImage(b); const o=b.objects.at(-1);
  assert.equal(objectLabel(b,o,groupNumbers(b.objects)),"image 2 · No description · in Section");
  b=groupObjects(b,new Set(b.objects.slice(1).map(o=>o.id))); b=describeImage(b,b.boardId,o.id,o.generation,"a".repeat(40));
  assert.equal(objectLabel(b,b.objects.at(-1),groupNumbers(b.objects)),"image 2 · Group 1 · "+"a".repeat(36)+" · in Section");
  assert.equal(eligibleIdea(o),false); assert.equal(connectReason(b,new Set(b.objects.slice(1).map(o=>o.id)),{readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false}),"Select exactly two ideas to connect.");
  assert.throws(()=>createConnector(b,b.objects[1].id,o.id),/ends/);
  const ideas=add(add(board(),"sticky",0,0),"sticky",400,0);
  const joined=createConnector(ideas,ideas.objects[0].id,ideas.objects[1].id).board;
  const invalid=withImage(joined); invalid.objects.find(o=>o.type==="connector").to.object=invalid.objects.at(-1).id;
  assert.throws(()=>validate(invalid),/ends/);
});

test("copies share asset, keep pixels/description, remap sections/groups, omit text, and oversized Paste is atomic", () => {
  let b=add(board(),"section",0,0); b=add(b,"text",0,0); b.objects[1].text="A"; b=withImage(b);
  const o=b.objects.at(-1); o.description="Synthetic"; b=groupObjects(b,new Set(b.objects.slice(1).map(o=>o.id)));
  const snapshot=buildSnapshot(b,selected(b),drawn(b)); assert.equal(plainText(buildSnapshot(b,new Set([o.id]),drawn(b))),"");
  const pasted=buildPaste(b,snapshot,{centerX:0,centerY:0,zoom:1,width:2000,height:2000},new Map([[image.hash,image.picture]])).board;
  const copies=pasted.objects.filter(o=>!selected(b).has(o.id)), copy=copies.find(isImage);
  for(const key of ["asset","pixelWidth","pixelHeight","description"]) assert.equal(copy[key],o[key]);
  assert.notEqual(copy.group,o.group); assert.equal(copy.section,copies.find(o=>o.type==="section").id); assert.equal(plainText(snapshot),"Section\n\nA");
  assert.equal(pictureBytes(pasted,new Map([[image.hash,image.picture]])),png.byteLength);
  assert.equal(duplicate(b,emptyHistory(),b.objects).board.objects.filter(isImage).length,2);
  const cache=new Map([[image.hash,{...image.picture,bytes:new ArrayBuffer(PICTURE_LIMIT+1)}]]), target=board(), before=canonical(target);
  assert.throws(()=>buildPaste(target,snapshot,{centerX:0,centerY:0,zoom:1,width:1000,height:1000},cache),{message:PASTE_PICTURES_REASON}); assert.equal(canonical(target),before);
});

test("native paste key is only trusted platform modifier without Shift/Alt", () => {
  const event={isTrusted:true,key:"v",metaKey:true,ctrlKey:false,altKey:false,shiftKey:false};
  for(const platform of ["MacIntel","iPhone","iPad","iPod"]) assert(nativePasteKey(event,platform));
  assert(!nativePasteKey(event,"Linux")); assert(nativePasteKey({...event,metaKey:false,ctrlKey:true},"Win32"));
  for(const extra of [{isTrusted:false},{shiftKey:true},{altKey:true},{ctrlKey:true}]) assert(!nativePasteKey({...event,...extra},"MacIntel"));
});

test("Description draft truncates code points, refuses malformed Unicode, commits once and cannot cross boards", () => {
  assert.equal(descriptionDraft("🧭".repeat(1001)),"🧭".repeat(1000)); assert.equal(descriptionDraft("\ud800"),null);
  const b=withImage(),o=b.objects[0],next=describeImage(b,b.boardId,o.id,o.generation,"hello"),h=record(emptyHistory(),b,next);
  assert.equal(h.past.length,1); assert.equal(describeImage(next,b.boardId,o.id,o.generation,"hello"),next);
  assert.equal(describeImage(b,crypto.randomUUID(),o.id,o.generation,"wrong board"),b);
  assert.equal(describeImage(b,b.boardId,o.id,crypto.randomUUID(),"stale generation"),b);
});

// Server-rendered hooks exercise commands and draft transactions using synthetic
// surfaces only. They do not claim browser event, focus, IME or pixel evidence.
const { build } = await import("../apps/web/node_modules/esbuild/lib/main.js");
const reactURL = new URL("../apps/web/node_modules/react/index.js", import.meta.url);
const { createElement } = await import(reactURL.href);
const { renderToStaticMarkup } = await import("../apps/web/node_modules/react-dom/server.node.js");
const compiled=await build({stdin:{contents:`
 export {useSelection} from "./state/use-selection.ts";
 export {useEditingCommands} from "./state/use-editing-commands.ts";
 export {useGeometryEdits} from "./state/use-geometry-edits.ts";
 export {usePageKeys} from "./state/use-page-keys.ts";
 export {useImages} from "./state/use-images.ts";
 export {tabPictures} from "./image-assets.ts";
 export {ImageButton, DescriptionField} from "./ui/image-controls.tsx";
`,resolveDir:new URL("../apps/web/src/",import.meta.url).pathname,loader:"ts"},bundle:true,write:false,platform:"node",format:"esm",
 plugins:[{name:"shared-react",setup(build){build.onResolve({filter:/^(react(?:\/.*)?|yjs)$/},args=>({path:args.path==="react"?reactURL.href:new URL(args.path==="yjs"?"../apps/web/node_modules/yjs/dist/yjs.mjs":"../apps/web/node_modules/"+args.path+".js",import.meta.url).href,external:true}));}}]});
const hooks=await import("data:text/javascript;base64,"+Buffer.from(compiled.outputFiles[0].text).toString("base64"));
function renderHook(fn){let result;renderToStaticMarkup(createElement(function Harness(){result=fn();return null;}));return result;}
const editingState={readOnly:false,composing:false,pointerGesture:false,invalidObjectText:false};
function commandHarness(b,ids=selected(b)) {
 const model={current:b},history={current:emptyHistory()},messages=[];
 const props={model,selected:ids,readOnly:false,busy:false,composing:false,finishTextSession(){},beginTextSession(){},setDrafts(){},setMessage(v){messages.push(v);},commit(next,semantic){if(semantic)history.current=record(history.current,model.current,next);model.current=next;},
   select(){},setTool(){},setPanel(){},setInline(){},setStatus(){},item:b.objects[0],objectLayouts:new Map(b.objects.map(o=>[o.id,{height:o.height}])),editor:{current:null},lineCount:()=>1,shapeSession:{paint:{current:{}},update(){}},
   tool:"Select",growHeight:0,growAvailable:false,historyRef:history,updateHistory(v){history.current=v;},messageSequence:{current:0},alive:{current:true},scene:{current:{clientWidth:1280,clientHeight:800,focus(){}}},view:{x:0,y:0,z:1},setView(){},displayedObjects:drawn(b),commandReason:"",selectionReason:"",clipboardState:editingState,editingState,arrangementMembers:drawn(b),connectorStyle:{current:{}}};
 return {model,history,messages,props,commands:()=>renderHook(()=>hooks.useEditingCommands(props)),geometry:()=>renderHook(()=>hooks.useGeometryEdits(props))};
}

test("mixed sticky/image commands show and change rich text while strokes still hide it, and Colour leaves images whole",(t)=>{
 const oldDocument=globalThis.document;globalThis.document={activeElement:{}};t.after(()=>{globalThis.document=oldDocument;});
 const original=add(board(),"sticky",0,0);original.objects[0].text="Synthetic";const b=withImage(original),imageBefore=structuredClone(b.objects[1]);
 const h=commandHarness(b),commands=h.commands();
 commands.changeStyle("textSize","large"); commands.changeStyle("align","right"); commands.toggleFormat("bold"); commands.changeStyle("color","blue");
 assert.equal(h.model.current.objects[0].textSize,"large");assert.equal(h.model.current.objects[0].align,"right");assert.deepEqual(h.model.current.objects[0].marks,[{start:0,end:9,bold:true}]);assert.equal(h.model.current.objects[0].color,"blue");assert.deepEqual(h.model.current.objects[1],imageBefore);
 const selectionFor=(b)=>renderHook(()=>{const value=hooks.useSelection({board:b,drafts:{},textSelection:null});if(value.selected.size!==b.objects.length)value.setSelected(selected(b));return value;});
 assert.equal(selectionFor(b).richText,true);
 assert.equal(selectionFor(withImage()).richText,false);
 const stroke=makeStroke(b,[{x:0,y:0},{x:10,y:10}],{kind:"marker",color:"black",weight:"thin"},true);
 const ink={...b,objects:[...b.objects,stroke]};assert.equal(selectionFor(ink).richText,false);
 const blocked=commandHarness(ink);blocked.commands().changeStyle("textSize","extra-large");assert.deepEqual(blocked.model.current,ink);
});

test("actual geometry commands keep image proportions with/without Shift and with Objects size buttons",()=>{
 for(const shift of [false,true]) {
  const h=commandHarness(withImage()),g=h.geometry(),start=g.resizeStart(),next=g.resizedBoard("se",start,60,10,shift);
  assert(Math.abs(next.objects[0].width/next.objects[0].height-1.5)<1e-10);assert.equal(next.objects[0].width,360);
 }
 for(const [dx,dy] of [[10,0],[-10,0],[0,10],[0,-10]]) {
  const h=commandHarness(withImage());h.geometry().resizeBy(dx,dy);const o=h.model.current.objects[0];assert(Math.abs(o.width/o.height-1.5)<1e-10);assert.equal(h.history.current.past.length,1);
 }
});

test("actual paste shortcut routing lets trusted platform Paste through; script and other modifiers run object Paste",()=>{
 const previousElement=globalThis.Element;globalThis.Element=class {};const surface={};const calls=[];
 try {
  const page=renderHook(()=>hooks.usePageKeys({scene:{current:surface},command(){},clipboardCommand(v){calls.push(v);},toggleFormat(){},model:{current:board()},cancel(){},busy:false,composing:false,select(){},setInline(){},panel:"",setPanel(){},chooseImages(){calls.push("picker");}}));
  const mac=/Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const event={target:surface,key:"v",ctrlKey:!mac,metaKey:mac,shiftKey:false,altKey:false,preventDefault(){this.prevented=true;},nativeEvent:{isTrusted:true,isComposing:false,key:"v",ctrlKey:!mac,metaKey:mac,shiftKey:false,altKey:false}};
  page.pageKeyDown(event);assert.equal(event.prevented,undefined);assert.deepEqual(calls,[]);
  page.pageKeyDown({...event,nativeEvent:{...event.nativeEvent,isTrusted:false}});assert.deepEqual(calls,["Paste"]);
  page.pageKeyDown({...event,ctrlKey:mac,metaKey:!mac,nativeEvent:{...event.nativeEvent,ctrlKey:mac,metaKey:!mac}});assert.deepEqual(calls,["Paste","Paste"]);
  page.pageKeyDown({...event,key:"K",shiftKey:true});assert.equal(calls.at(-1),"picker");
 } finally {globalThis.Element=previousElement;}
});

function imageHarness(b=withImage(),extra={}) {
 const h=commandHarness(b),messages=[],writes=[];let active=true;
 const db={transaction(){const t={objectStore(){return{put(value,key){writes.push([key,value]);}}}};queueMicrotask(()=>t.oncomplete?.());return t;}};
 const store={db,active:true,transactions:new Set()};
 const props={...h.props,board:b,selected:selected(b),invalidObjectText:false,pending:{current:{busy:false,composing:false,invalid:false}},setComposing(){},getView:()=>({x:100,y:40,z:1}),getStore:()=>store,isAlive:()=>active,barVisible:()=>true,setMessage(v){messages.push(v);},...extra};
 const result=renderHook(()=>hooks.useImages(props));return{...h,result,props,messages,writes,store,close(){active=false;}};
}

test("actual Description handlers commit a draft once, defer composition and never cross board identity",()=>{
 const h=imageHarness(),o=h.model.current.objects[0],d=h.result.description;
 d.change("🧭".repeat(1001));d.commit();assert.equal(h.model.current.objects[0].description,"🧭".repeat(1000));assert.equal(h.history.current.past.length,1);
 d.commit();assert.equal(h.history.current.past.length,1);
 d.change("\ud800");d.commit();assert.equal(h.history.current.past.length,1);
 d.startComposition();d.change("composed");d.commit();assert.equal(h.history.current.past.length,1);d.endComposition("composed");assert.equal(h.history.current.past.length,2);
 d.change("different board");h.model.current={...h.model.current,boardId:crypto.randomUUID()};d.commit();assert.equal(h.history.current.past.length,2);assert.equal(h.model.current.objects[0].description,"composed");
});

test("prepare uses content not name/type, retains bytes, closes bitmaps, scales with alpha and JPEG .90",async(t)=>{
 const bitmapOriginal=globalThis.createImageBitmap,canvasOriginal=globalThis.OffscreenCanvas;let closed=0,dimensions=[300,200],alpha=255,encoding;
 t.after(()=>{globalThis.createImageBitmap=bitmapOriginal;globalThis.OffscreenCanvas=canvasOriginal;});
 globalThis.createImageBitmap=async(blob)=>{assert.equal(blob.type,"image/png");return{width:dimensions[0],height:dimensions[1],close(){closed++;}};};
 globalThis.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return{drawImage(){},getImageData(){return{data:new Uint8ClampedArray([0,0,0,alpha])};}};}async convertToBlob(options){encoding=options;return new Blob([options.type==="image/png"?png:Uint8Array.from([255,216,255,99])]);}};
 const f={name:"renamed.txt",type:"text/plain",size:png.byteLength,arrayBuffer:async()=>png};const original=await prepareImage(f);assert.deepEqual(original.picture.bytes,png);assert.equal(closed,1);
 dimensions=[6000,1000];let scaled=await prepareImage(f);assert.deepEqual([scaled.width,scaled.height],[2880,480]);assert.deepEqual([scaled.picture.pixelWidth,scaled.picture.pixelHeight],[4096,683]);assert.deepEqual(encoding,{type:"image/jpeg",quality:.90});
 alpha=128;scaled=await prepareImage(f);assert.equal(scaled.picture.mime,"image/png");assert.equal(scaled.hash,await pictureHash(scaled.picture.bytes));assert.equal(closed,3);
 await assert.rejects(prepareImage({...f,size:20971521}),{message:IMAGE_REASONS.file});
 await assert.rejects(prepareImage({...f,arrayBuffer:async()=>new ArrayBuffer(1)}),{message:IMAGE_REASONS.type});
 dimensions=[20001,1];await assert.rejects(prepareImage(f),{message:IMAGE_REASONS.size});assert.equal(closed,4);
});

test("actual drop imports valid files beside refusals as one step only after picture writes, and suppresses a closed session",async(t)=>{
 const original=globalThis.createImageBitmap;t.after(()=>{globalThis.createImageBitmap=original;});globalThis.createImageBitmap=async()=>({width:300,height:200,close(){}});
 const f=(name,bytes=png)=>({name,type:"image/png",size:bytes.byteLength,arrayBuffer:async()=>bytes});
 const h=imageHarness(board()),surface={getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})};
 let prevented=false;await h.result.drop({currentTarget:surface,clientX:500,clientY:400,preventDefault(){prevented=true;},dataTransfer:{files:[f("a"),f("bad",new ArrayBuffer(2)),f("b")]}});
 assert(prevented);assert.equal(h.model.current.objects.length,2);assert.equal(h.history.current.past.length,1);assert.equal(h.writes.length,2);assert.equal(h.messages[0],"Could not add bad: "+IMAGE_REASONS.type+".");validate(h.model.current);
 const closed=imageHarness(board());let release;globalThis.createImageBitmap=()=>new Promise(resolve=>{release=()=>resolve({width:300,height:200,close(){}});});
 const task=closed.result.drop({currentTarget:surface,clientX:500,clientY:400,preventDefault(){},dataTransfer:{files:[f("cancelled")]}});await new Promise(setImmediate);closed.close();release();await task;assert.equal(closed.model.current.objects.length,0);assert.deepEqual(closed.messages,[]);
});

test("actual paste imports signature-bearing files, falls back to object Paste and preserves field/default-handled events",async(t)=>{
 const old=globalThis.createImageBitmap;t.after(()=>{globalThis.createImageBitmap=old;});globalThis.createImageBitmap=async()=>({width:300,height:200,close(){}});
 const scene={},f=(bytes,type="")=>({name:"clipboard",type,size:bytes.byteLength,arrayBuffer:async()=>bytes,slice:()=>({arrayBuffer:async()=>bytes.slice(0,16)})});
 const h=imageHarness(board()),calls=[];const pasted=h.result.paste(()=>calls.push("object"));
 const event=(files,extra={})=>({target:scene,currentTarget:scene,defaultPrevented:false,preventDefault(){this.prevented=true;},clipboardData:{files},...extra});
 await pasted(event([f(png)]));assert.equal(h.model.current.objects.length,1);assert.deepEqual(calls,[]);
 await pasted(event([]));await pasted(event([f(new ArrayBuffer(2))]));assert.deepEqual(calls,["object","object"]);
 const native=event([],{target:{}});await pasted(native);assert.equal(native.prevented,undefined);
 const handled=event([],{defaultPrevented:true});await pasted(handled);assert.equal(handled.prevented,undefined);
});

test("failed picture store or unavailable import changes no board and refuses with the contracted notice",async(t)=>{
 const old=globalThis.createImageBitmap;t.after(()=>{globalThis.createImageBitmap=old;});globalThis.createImageBitmap=async()=>({width:300,height:200,close(){}});
 const h=imageHarness(board());h.store.db={transaction(){const tx={error:Error("quota"),objectStore(){return{put(){}}}};queueMicrotask(()=>tx.onabort());return tx;}};
 const surface={getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})},event={currentTarget:surface,clientX:500,clientY:400,preventDefault(){},dataTransfer:{files:[{name:"quota.png",size:png.byteLength,arrayBuffer:async()=>png}]}};
 await h.result.drop(event);assert.equal(h.model.current.objects.length,0);assert.equal(h.history.current.past.length,0);assert.deepEqual(h.messages,["Could not add quota.png: "+IMAGE_REASONS.store+"."]);
 for(const extra of [{readOnly:true},{busy:true},{composing:true},{invalidObjectText:true}]){const refused=imageHarness(board(),extra);await refused.result.drop(event);assert.deepEqual(refused.messages,[]);assert.equal(refused.writes.length,0);assert.equal(refused.result.picker.disabled,true);}
});

test("picker exists only while opening, accepts multiple named types, and Image tooltip follows platform",(t)=>{
 const original=globalThis.document;t.after(()=>{globalThis.document=original;});let input,attached=false;const handlers={};
 globalThis.document={createElement(){input={setAttribute(k,v){this[k]=v;},addEventListener(k,fn){handlers[k]=fn;},remove(){attached=false;},click(){}};return input;},body:{append(){attached=true;}}};
 const h=imageHarness(board());h.result.chooseImages();assert(attached);assert.equal(input.type,"file");assert.equal(input.multiple,true);assert.equal(input.accept,"image/png,image/jpeg,image/gif,image/webp");assert.equal(input["aria-label"],"Choose images");handlers.cancel();assert.equal(attached,false);
 for(const mac of [true,false]){const markup=renderToStaticMarkup(createElement(hooks.ImageButton,{picker:{disabled:false,mac,choose(){}}}));assert.match(markup,/aria-label="Image"/);assert(markup.includes(mac?"Image ⇧⌘K":"Image Ctrl+Shift+K"));}
});
