// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { setImmediate as turn } from "node:timers/promises";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let compiled;
function modules(){
  return compiled??=build({stdin:{resolveDir:new URL("../apps/web/src/",import.meta.url).pathname,loader:"ts",contents:
    'export * from "./state/use-video-playback.ts";export * from "./scene/video-player.tsx";export * from "./image-assets.ts";export {render,dispose} from "react";'},
    bundle:true,write:false,platform:"node",format:"esm",jsx:"automatic",plugins:[{name:"hook",setup(p){
      p.onResolve({filter:/^react$/},()=>({path:"react",namespace:"stub"}));
      p.onResolve({filter:/^react\/jsx-runtime$/},arg=>({path:import.meta.resolve(arg.path),external:true}));
      p.onLoad({filter:/.*/,namespace:"stub"},()=>({contents:`
        let slots,index,jobs;
        export function render(state,fn,commit){
          slots=state;index=0;jobs=[];
          const result=fn();for(const job of jobs)job.cell.cleanup?.();commit(result);
          for(const job of jobs){job.cell.deps=job.deps;job.cell.cleanup=job.fn();}return result;
        }
        export function dispose(state){for(const cell of state)cell.cleanup?.();}
        export function useRef(value){return slots[index++]??={current:value};}
        export function useState(value){const cell=useRef(value);return [cell.current,next=>{cell.current=typeof next==="function"?next(cell.current):next;}];}
        export function useEffect(fn,deps){const cell=useRef();if(!cell.deps||deps.some((v,i)=>!Object.is(v,cell.deps[i])))jobs.push({cell,fn,deps});}
      `}));
    }}]}).then(result=>import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].text).toString("base64")));
}
async function settled(check){
  for(let i=0;i<400;i++){if(check())return;await turn();}assert.fail("Playback did not settle");
}
async function fixture(t,hosted=false){
  const m=await modules(), win=new EventTarget(), doc=new EventTarget(),slots=[],messages=[],created=[],revoked=[];
  const originalWindow=globalThis.window,originalDocument=globalThis.document;
  globalThis.window=win;globalThis.document=doc;
  t.after(()=>{globalThis.window=originalWindow;globalThis.document=originalDocument;});
  const bytes=new TextEncoder().encode("0000ftypisom"+randomUUID()).buffer,asset=createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
  const poster="f".repeat(64),video={type:"video",id:randomUUID(),asset,poster,pixelWidth:2,pixelHeight:3,x:0,y:0,width:300,height:200,durationMs:42000,name:"demo.mp4"};
  const record={bytes,mime:"video/mp4",durationMs:42000}, blob=new Blob([bytes],{type:"video/mp4"});
  m.tabPictures.set(poster,{mime:"image/jpeg"});if(!hosted)m.holdVideo(asset,record);
  const calls=[],el={muted:false,currentTime:0,src:"",plays:0,pauses:0,focused:0,controls:false,buttonFocus:0,canvasFocus:0,
    closest:()=>({focus(){el.canvasFocus++;}}),parentElement:{querySelector:()=>({focus(){el.buttonFocus++;}})},
    focus(){this.focused++;},pause(){this.pauses++;},async play(){this.plays++;},removeAttribute(){this.src="";},load(){},
    async requestFullscreen(){doc.fullscreenElement=this;doc.dispatchEvent(new Event("fullscreenchange"));}};
  doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.dispatchEvent(new Event("fullscreenchange"));};
  t.mock.method(URL,"createObjectURL",()=>{const url="blob:"+randomUUID();created.push(url);return url;});
  t.mock.method(URL,"revokeObjectURL",url=>revoked.push(url));
  const input={opening:{},boardId:randomUUID(),objects:[video],selected:new Set([video.id]),bitmaps:new Map([[poster,{width:2,height:3}]]),
    hidden:false,setMessage:text=>messages.push(text),hosted:hosted?{pictures:{downloadVideo(hash,progress,signal){
      const gate=Promise.withResolvers();calls.push({hash,progress,signal,...gate});return gate.promise;}}}:undefined};
  let attached,last,disposed=false;
  const render=()=>{const {player}=m.render(slots,()=>m.useVideoPlayback(input),({player})=>{
    if(player?.ref!==attached){attached?.(null);attached=player?.ref;attached?.(el);}
  });last=player;return player;};
  const dispose=()=>{if(!disposed){m.dispose(slots);disposed=true;}};
  t.after(()=>{globalThis.document=doc;globalThis.window=win;dispose();m.tabVideos.delete(asset);globalThis.document=originalDocument;globalThis.window=originalWindow;});
  render();return {m,input,el,calls,messages,video,blob,record,render,dispose,win,doc,created,revoked,asset,
    deselect(){input.selected=new Set();return render();},select(){input.selected=new Set([video.id]);return render();},
    held:()=>m.tabVideos.has(asset)};
}
test("X8-U20 local selection attaches without play, latches a press and keeps time after deselect or end",async t=>{
  const h=await fixture(t);let p=h.render();assert.equal(p.state,"paused");assert.equal(h.el.plays,0);assert.equal(h.created.length,1);
  p.onLoadedMetadata();p=h.render();assert(p.hasData);assert(!p.shown);p.play();assert.equal(h.el.plays,1);
  p=h.render();p.onPlaying();h.el.currentTime=12;p.onTimeUpdate();p=h.render();assert.equal(p.timeMs,12000);assert(p.shown);
  const pauses=h.el.pauses;h.input.hidden=true;assert(h.render().hidden);assert(!h.render().shown);assert.equal(h.el.pauses,pauses);h.input.hidden=false;assert(h.render().shown);
  assert.equal(h.deselect(),undefined);assert.equal(h.el.pauses,pauses+1);h.select();p=h.render();assert.equal(p.state,"paused");p.onLoadedMetadata();p.onLoadedData();
  assert.equal(h.el.currentTime,12);assert.equal(h.el.plays,1);assert(h.render().shown);p.onEnded();h.render().play();assert.equal(h.el.currentTime,0);
  h.deselect();h.input.pressedPlay={id:h.video.id,sequence:1};h.select();p=h.render();p.onLoadedMetadata();assert.equal(h.el.plays,3);
  h.deselect();h.select();h.render().onLoadedMetadata();assert.equal(h.el.plays,3);assert.equal(h.created.length,1);
});
test("X8-U21 token ignores stale metadata and rejected play; fullscreen, seek and mute stay local",async t=>{
  const h=await fixture(t);let p=h.render();p.onLoadedMetadata();p=h.render();p.seek(12000);h.render().seekKey("ArrowLeft");assert.equal(h.el.currentTime,7);
  h.render().seekKey("Home");assert.equal(h.el.currentTime,0);h.render().seekKey("End");assert.equal(h.el.currentTime,42);
  p.toggleMute();assert.equal(h.el.muted,true);h.render().toggleMute();assert.equal(h.el.muted,false);
  p.enterFullScreen();assert(h.render().fullScreen);assert(h.el.controls);assert.equal(h.el.focused,1);
  const html=()=>renderToStaticMarkup(createElement(h.m.VideoPlayer,{player:h.render(),pos:()=>({left:0,top:0}),zoom:1}));
  assert.match(html(),/<video[^>]*controls/);assert.doesNotMatch(html(),/<video[^>]*aria-hidden/);
  await h.doc.exitFullscreen();assert.equal(h.el.buttonFocus,1);assert.match(html(),/<video[^>]*aria-hidden="true"/);
  p=h.render();p.enterFullScreen();const gate=Promise.withResolvers();h.el.play=()=>gate.promise;p.play();h.deselect();h.select();
  h.el.currentTime=3;p.onLoadedMetadata();gate.reject(Error("decoder"));await turn();assert.equal(h.el.currentTime,3);assert.deepEqual(h.messages,[]);
  assert.equal(h.doc.fullscreenElement,null);assert.equal(h.el.canvasFocus,1);
  h.input.selected.add(randomUUID());assert.equal(h.render(),undefined);
});
test("X8-U22 hosted downloads join by hash, verify progress and cache after deselect without autoplay",async t=>{
  const h=await fixture(t,true);assert.equal(h.calls.length,0);h.render().play();assert.equal(h.calls.length,1);
  let p=h.render();assert.equal(p.state,"loading");h.calls[0].progress(10,0);assert.equal(h.render().percent,0);
  h.calls[0].progress(99,99);assert.equal(h.render().percent,99);p.play();assert.equal(h.calls.length,1);
  h.deselect();h.calls[0].resolve({kind:"ok",blob:h.blob});await settled(h.held);h.select();p=h.render();p.onLoadedMetadata();assert.equal(h.el.plays,0);
  h.render().play();assert.equal(h.el.plays,1);assert.equal(h.calls.length,1);
});
test("X8-U23 opening, pagehide and unmount abort downloads and revoke URLs even with the same board ID",async t=>{
  for(const action of ["reopen","pagehide","unmount"]){
    const h=await fixture(t,true);h.render().play();const stale=h.calls[0];
    if(action==="reopen"){h.input.opening={};h.render();}else if(action==="pagehide")h.win.dispatchEvent(new Event("pagehide"));else h.dispose();
    assert(stale.signal.aborted);stale.progress(1,2);stale.resolve({kind:"ok",blob:h.blob});await turn();await turn();
    assert(!h.held());assert.equal(h.el.plays,0);assert.deepEqual(h.messages,[]);
  }
  const h=await fixture(t);const first=h.created[0];h.input.opening={};h.render();assert.deepEqual(h.revoked,[first]);assert.equal(h.created.length,2);
});
test("X8-U24 rejected autoplay stays paused, decoder failure warns once per hash",async t=>{
  const h=await fixture(t,true);h.el.play=async()=>{h.el.plays++;throw new DOMException("blocked","NotAllowedError");};
  h.render().play();h.calls[0].resolve({kind:"ok",blob:h.blob});await settled(h.held);h.render().onLoadedMetadata();await turn();
  assert.equal(h.el.plays,1);assert.equal(h.render().state,"paused");assert.deepEqual(h.messages,[]);
  h.el.play=async()=>{throw Error("decode");};h.render().play();await turn();assert(!h.render().shown);
  h.render().onError();assert.deepEqual(h.messages,["This video can't play in this browser."]);
});
test("X8-U25 bad blobs retry at one and two seconds, joined press receives one failure, pending timers cancel",async t=>{
  const h=await fixture(t,true),timers=new Map();let serial=0;
  t.mock.method(globalThis,"setTimeout",(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;});
  t.mock.method(globalThis,"clearTimeout",id=>timers.delete(id));
  async function retry(ms){await settled(()=>timers.size>0);const [id,entry]=[...timers][0];assert.equal(entry.ms,ms);timers.delete(id);entry.fn();await turn();}
  h.render().play();h.deselect();h.select();h.render().play();assert.equal(h.calls.length,1);
  h.calls[0].resolve({kind:"ok",blob:new Blob([])});await retry(1000);
  h.calls[1].resolve({kind:"ok",blob:{size:52428801,arrayBuffer:()=>assert.fail("oversize blob was read")}});await retry(2000);
  h.calls[2].resolve({kind:"ok",blob:new Blob([h.record.bytes],{type:"video/webm"})});await settled(()=>h.messages.length>0);
  assert.deepEqual(h.messages,["Could not load demo.mp4. Press play to try again."]);assert(!h.held());assert.equal(h.render().state,"paused");
  h.render().play();h.calls[3].resolve({kind:"network"});await settled(()=>timers.size>0);h.input.opening={};h.render();
  assert.equal(timers.size,0);assert(h.calls[3].signal.aborted);assert.equal(h.messages.length,1);
});
test("X8-U26 strip markup, 240 px boundary, loading controls, narrow fit and absent target",async t=>{
  const h=await fixture(t,true),markup=(player,zoom)=>renderToStaticMarkup(createElement(h.m.VideoPlayer,{player,zoom,pos:()=>({left:0,top:0})}));
  assert.equal(markup(undefined,1),"");let html=markup(h.render(),.8);
  for(const name of ["Video controls","Play","Seek","Mute","Full screen"])assert(html.includes('aria-label="'+name+'"'));
  assert.match(html,/width:224px/);assert.doesNotMatch(html,/video-strip narrow/);
  html=markup(h.render(),.3);assert.match(html,/video-strip narrow/);assert.match(html,/width:120px/);assert.doesNotMatch(html,/aria-label="Seek"|aria-label="Mute"/);
  h.render().play();html=markup(h.render(),1);assert.match(html,/Loading video… 0%/);assert.doesNotMatch(html,/<input/);assert.match(html,/aria-label="Full screen" disabled/);
});
