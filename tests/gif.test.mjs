// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
const decoder = () => import("../apps/web/src/gif.ts");
const word = n => [n & 255, n >> 8];
const colors = [255,0,0,0,255,0,0,0,255,255,255,0];
const pixel = index => index === null ? [0,0,0,0] : [...colors.slice(index*3,index*3+3),255];
function pack(codes,min=2) {
  const bytes=[]; let width=min+1,next=(1<<min)+2,previous=false, bits=0,count=0;
  for(const code of codes) {
    bits |= code << count;count+=width;
    while(count>=8){bytes.push(bits&255);bits>>>=8;count-=8;}
    if(code===1<<min){next=code+2;width=min+1;previous=false;}
    else if(code!==(1<<min)+1){if(previous && next<4096 && ++next===1<<width && width<12)width++;previous=true;}
  }
  if(count)bytes.push(bits);
  return bytes;
}
function blocks(bytes, part=255) {
  const out=[];for(let at=0;at<bytes.length;at+=part){const chunk=bytes.slice(at,at+part);out.push(chunk.length,...chunk);}
  return [...out,0];
}
function frame(indices,{x=0,y=0,w=indices.length,h=1,local=false,interlace=false,min=2,codes,part}={}) {
  return [44,...word(x),...word(y),...word(w),...word(h),(local?129:0)|(interlace?64:0),...(local?colors:[]),min,
    ...blocks(pack(codes??[1<<min,...indices,(1<<min)+1],min),part)];
}
const control=(delay=0,disposal=0,transparent)=>[33,249,4,disposal<<2|Number(transparent!==undefined),...word(delay),transparent??0,0];
function gif(w,h,body,{global=true,header="GIF89a",trailer=true}={}) {
  return Uint8Array.from([...Buffer.from(header),...word(w),...word(h),global?129:0,0,0,...(global?colors:[]),...body,...(trailer?[59]:[])]);
}
const flatten = indexes=>indexes.flatMap(pixel);
test("X7-U01 info counts descriptors without unpacking and rejects malformed screens",async()=>{
  const {gifInfo}=await decoder();
  for(const header of ["GIF87a","GIF89a"]){
    assert.deepEqual(gifInfo(gif(3,2,frame([0]),{header})),{width:3,height:2,frames:1,area:1});
    assert.deepEqual(gifInfo(gif(3,2,[...frame([0]),...frame([1],{w:5,h:8})],{header})),{width:3,height:2,frames:2,area:41});
  }
  for(const data of [gif(0,2,[]),gif(1,0,[]),gif(1,1,[]).slice(0,12),gif(1,1,[]).with(0,0)])assert.equal(gifInfo(data),null);
  const data=gif(1,1,frame([1]));assert.equal(gifInfo(data.slice(0,35)).frames,0);assert.equal(gifInfo(data.slice(0,36)).frames,1);
});
test("X7-U02 extensions, transparency, GCE scope, disposal including reserved values and clipping",async()=>{
  const {decodeGif}=await decoder();
  const plain=[33,1,12,...Array(12).fill(0),1,65,0],comment=[33,254,2,65,66,0],application=[33,255,11,...Buffer.from("NETSCAPE2.0"),3,1,1,0,0];
  const data=gif(2,1,[...control(5),...comment,...application,...frame([0,1]),
    ...control(1,3,1),...frame([2,1]),...control(0,2),...frame([3,3],{x:1}),
    ...control(9,1,1),...plain,...frame([1],{x:0,local:true})]);
  const frames=decodeGif(data,100).frames;assert.deepEqual(frames.map(f=>f.delay),[50,100,100,100]);
  assert.deepEqual(frames.map(f=>[...f.rgba]),[[0,1],[2,1],[0,3],[1,null]].map(flatten));
  for(const disposal of [0,1,4,5,6,7]){
    const out=decodeGif(gif(2,1,[...control(2,disposal),...frame([0,1]),...frame([2])]),100).frames;
    assert.deepEqual([...out[1].rgba],flatten([2,1]));assert.equal(out[0].delay,20);
  }
});
test("X7-U03 local colour tables and interlaced row order",async()=>{
  const {decodeGif}=await decoder();
  const data=gif(1,8,frame([0,1,2,3,1,2,3,0],{local:true,interlace:true,w:1,h:8}),{global:false});
  assert.deepEqual([...decodeGif(data,8).frames[0].rgba],flatten([0,1,2,2,1,3,3,0]));
});
test("X7-U04 LZW widths through 12 bits, full dictionaries, clear and next-entry special case",async()=>{
  const {decodeGif}=await decoder();
  for(const min of [2,8]){
    const ids=Array.from({length:5300},(_,i)=>i%4),clear=1<<min;
    const codes=[clear,...ids,clear,1,clear+2,clear+1],data=gif(5303,1,frame([],{w:5303,min,codes,part:7}));
    assert.deepEqual([...decodeGif(data,10000).frames[0].rgba],flatten([...ids,1,1,1]));
  }
});
test("X7-U05 early dictionary end, invalid codes, short sub-blocks, missing later table and out-of-palette indices",async()=>{
  const {decodeGif}=await decoder();
  for(const codes of [[4,1,5],[4,1,7]]){
    const data=gif(2,1,[...frame([],{w:2,codes}),...frame([3,3])]);
    const frames=decodeGif(data,20).frames;assert.equal(frames.length,1);assert.deepEqual([...frames[0].rgba],flatten([1,null]));
  }
  const truncated=gif(4,1,frame([],{w:4,codes:[4,1,4,2,4,3,5]})).slice(0,-4);
  const out=decodeGif(truncated,20);assert.equal(out.frames.length,1);assert.deepEqual([...out.frames[0].rgba].slice(0,4),pixel(1));
  const later=gif(2,1,[...frame([1,2],{local:true}),...frame([0,0]),...frame([3,3],{local:true})],{global:false});
  assert.deepEqual(decodeGif(later,20).frames.map(f=>[...f.rgba]),[flatten([1,2]),flatten([1,2])]);
  assert.deepEqual([...decodeGif(gif(1,1,frame([7],{min:8})),20).frames[0].rgba],pixel(null));
  for(const tail of [[],[33,254,10,1,2],[44,0]])assert.equal(decodeGif(gif(1,1,[...frame([1]),...tail],{trailer:false}),2).frames.length,1);
});
test("X7-U06 both decoded pixel limits precede decoding and invalid first images fail",async()=>{
  const {decodeGif}=await decoder();
  for(const data of [gif(100,100,[...frame([]),...frame([])]),gif(1,1,frame([],{w:65535,h:65535}))]) {
    assert.throws(()=>decodeGif(data,16),{message:"gif_too_large"});
  }
  for(const data of [new Uint8Array(),gif(1,1,[]),gif(1,1,frame([1]),{global:false}),gif(1,1,frame([],{w:1})),
    gif(1,1,frame([1])).with(35,1),gif(1,1,frame([1])).with(35,9)])assert.throws(()=>decodeGif(data,100),{message:"gif_invalid"});
});
