// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
const unit = (id, name, fn) => test(`R4-U${String(id).padStart(2, '0')} ${name}`, fn);
async function fixture(count=4){
  const {Room}=await import('../packages/board-room/src/room.ts');
  const {NodeStorage}=await import('../apps/server/src/node-storage.ts');
  const {add}=await import('../packages/board-rules/src/document.ts');
  const storage=new NodeStorage(':memory:'),id=randomUUID(),people=new Map(),connections=[];
  let at=100000,generation=0,latest=0,offline=false,life='active',held;
  const changes=[];
  const env={storage,now:()=>at,access:{board:async()=>({id,title:'Reactions board',createdAt:new Date(at).toISOString()}),
    role:async(person)=>{if(held){const wait=held;held=undefined;await wait;}if(offline)throw Error('Authority unavailable');return people.get(person)??null;},
    changes:async(_board,after)=>{if(offline)throw Error('Replay unavailable');return {latest,lowestKept:1,changes:changes.filter(c=>c.number>after)};}},
    lifecycle:{lifecycle:async()=>({state:life,generation})},fence:async()=>generation,raiseFence:async(min=0)=>generation=Math.max(generation,min)+1,
    hash:async v=>createHash('sha256').update(v).digest('hex'),randomId:randomUUID,randomTicket:randomUUID,verify:async()=>{},connections:()=>[...connections],schedule:async()=>{},backupLimit:16777216};
  let room=new Room(id,env),board={schemaVersion:11,boardId:id,title:'Reactions board',objects:[],retiredGenerations:[]};
  for(let i=0;i<count;i++)board=add(board,'sticky',i*260,0);
  await room.create(board);
  async function open(role='editor',person=randomUUID(),label='synthetic'){
    if(!people.has(person))people.set(person,role);
    const ticket=await room.ticket({id:person,email:label+'@example.test',expiresAt:999999999});
    let a=await room.join(ticket.ticket);const frames=[];let closed;
    const c={attachment:()=>a,attach:value=>{a=value;},send:text=>frames.push(JSON.parse(text)),close:code=>{closed=code;const i=connections.indexOf(c);if(i>=0)connections.splice(i,1);}};
    connections.push(c);await room.connected(c);
    return {c,frames,person,get closed(){return closed;},get projection(){return [...frames].reverse().find(f=>f.spotlight)?.spotlight;}};
  }
  function command(c,action,extra={}){const s=room.spotlight.session,m=room.spotlight.projection(c.c).own;return {kind:'spotlight_command',requestId:randomUUID(),epoch:c.c.attachment().epoch,restoreGeneration:c.c.attachment().restoreGeneration,authorityId:s.authorityId,sessionId:s.sessionId,action,...(action==='follow'||action==='leave'?{expectedMembershipVersion:m.membershipVersion}:{expectedControlVersion:s.controlVersion}),...extra};}
  async function answer(c,m,raw){await room.message(c.c,raw??JSON.stringify(m));return c.frames.findLast(f=>f.requestId===m.requestId);}
  async function send(c,action,extra={}){at+=1001;return answer(c,command(c,action,extra));}
  async function read(c){at+=1001;return answer(c,{kind:'spotlight_read',requestId:randomUUID(),epoch:c.c.attachment().epoch,restoreGeneration:c.c.attachment().restoreGeneration});}
  async function presence(c,active=false){at+=101;await room.message(c.c,JSON.stringify({kind:'presence',cursor:{x:42,y:22},selection:[],view:{x:10,y:20,width:800,height:600},active}));}
  async function depart(c,code=1006,reason=''){c.c.close(code);await room.closed(c.c,code,reason);}
  return {storage,env,open,send,read,command,answer,presence,depart,get room(){return room;},get board(){return room.board;},advance:ms=>{at+=ms;},offline:v=>{offline=v;},role:(c,role)=>{people.set(c.person,role);changes.push({personId:c.person,number:++latest});},hold:()=>{let release;held=new Promise(r=>release=r);return()=>release();},life:v=>{life=v;},restart:async()=>{room=new Room(id,env);await room.ordered(()=>room.load());},close:()=>storage.close()};
}
const withRoom=fn=>async()=>{const f=await fixture();try{await fn(f);}finally{f.close();}};

const frame = (reaction='heart',x=42,y=22) => ({kind:'react',reaction,x,y});
const reacted = c => c.frames.filter(m=>m.kind==='reacted');
const react = (f,c,value=frame(),raw) => f.room.message(c.c,raw??JSON.stringify(value));
async function controller() {
  const {BoardReactions}=await import('../apps/web/src/team/reactions.ts');
  const sent=[],tools=[],host={snapshot:{connected:true},history:{locked:false,previewing:false},voting:{running:false},presence:{self:{connection:randomUUID(),label:'ana',colour:'#2563eb'},others:[{connection:randomUUID(),label:'ben',colour:'#dc2626'}]},sendReaction:(...args)=>{sent.push(args);return true;}};
  const r=new BoardReactions(host);r.sync();r.bindTool(t=>tools.push(t));return {r,host,sent,tools};
}
unit(1,'fixed ids and names agree between neutral wire and pure client rules',async()=>{
  const wire=await import('../packages/board-sync/src/reactions.ts'),rules=await import('../apps/web/src/team/reactions-rules.ts');
  assert.deepEqual(wire.REACTIONS,rules.REACTIONS);assert.deepEqual(wire.REACTIONS.map(v=>v[0]),['thumbs-up','plus-one','star','question','thumbs-down','dot','me','heart']);
});
unit(2,'strict up/down shapes, invalid values and inclusive coordinate bounds',async()=>{
  const {checkReaction:c,checkReacted:d}=await import('../packages/board-sync/src/reactions.ts');
  assert.equal(c(frame('star',-1000000,1000000),256).reaction,'star');
  for(const v of [null,'react',[],{...frame(),extra:1},{kind:'react',reaction:'heart',x:0},{...frame(),reaction:'unknown'},{...frame(),reaction:3},...[-1000001,1000001,NaN,Infinity,-Infinity].map(x=>frame('star',x,0))])assert.equal(c(v,200),'bad_reaction');
  const down={...frame(),kind:'reacted',connection:randomUUID()};assert(d(down,512));assert(!d({...down,person:'fake'},200));assert(!d({...down,connection:'fake'},200));assert(!d(down,513));
});
unit(3,'UTF-8 limits include whitespace at 256 and 257 bytes',async()=>{
  const {checkReaction,reactionBytes}=await import('../packages/board-sync/src/reactions.ts');const text=JSON.stringify(frame()),raw=text+' '.repeat(256-new TextEncoder().encode(text).length);
  assert.equal(new TextEncoder().encode(raw).length,256);assert.equal(checkReaction(JSON.parse(raw),256).reaction,'heart');assert.equal(checkReaction(JSON.parse(raw),257),'reaction_too_large');assert(reactionBytes({...frame(),kind:'reacted',connection:randomUUID()})<512);
});
for(const [i,role] of ['owner','editor','viewer'].entries())unit(4+i,`${role} sends eight ids, no sender echo, stamped connection`,withRoom(async f=>{
  const {REACTIONS}=await import('../packages/board-sync/src/reactions.ts');const a=await f.open(role),b=await f.open('viewer');
  for(const [id] of REACTIONS){f.advance(1001);await react(f,a,frame(id));assert.deepEqual(reacted(b).at(-1),{kind:'reacted',reaction:id,x:42,y:22,connection:a.c.attachment().connectionId});}assert.equal(reacted(a).length,0);assert.equal(reacted(b).length,8);
}));
unit(7,'same-person second connection receives once',withRoom(async f=>{const a=await f.open(),b=await f.open('editor',a.person);await react(f,a);assert.equal(reacted(a).length,0);assert.equal(reacted(b).length,1);}));
unit(8,'invalid attempts count; sixth silently drops and exact oldest boundary expires',withRoom(async f=>{
  const a=await f.open(),b=await f.open();for(let i=0;i<5;i++)await react(f,a,{...frame(),extra:1});const n=a.frames.length;await react(f,a);assert.equal(a.frames.length,n);assert.equal(reacted(b).length,0);assert.equal(a.c.attachment().reactionTimes.length,5);f.advance(1000);await react(f,a);assert.equal(reacted(b).length,1);assert.equal(a.c.attachment().reactionTimes.length,1);
}));
unit(9,'presence and reaction budgets remain independent',withRoom(async f=>{const a=await f.open(),b=await f.open();for(let i=0;i<10;i++)await f.room.message(a.c,JSON.stringify({kind:'presence',cursor:{x:1,y:2},view:{x:0,y:0,width:800,height:600},selection:[],active:false}));for(let i=0;i<5;i++)await react(f,a);assert.equal(a.c.attachment().presenceTimes.length,10);assert.equal(reacted(b).length,5);}));
unit(10,'running vote refuses; revealed and cleared rounds permit again',withRoom(async f=>{const a=await f.open('owner'),b=await f.open('viewer');
  const vote=async action=>{const t=f.room.voting.snapshot();await f.room.message(a.c,JSON.stringify({kind:'vote_command',requestId:randomUUID(),epoch:a.c.attachment().epoch,restoreGeneration:0,sessionId:t.sessionId,expectedSessionVersion:t.sessionVersion,action,...(action==='start'?{prompt:'Choose',budget:3}:{})}));};
  await vote('start');assert(f.room.voting.running());await react(f,b);assert.deepEqual(b.frames.at(-1),{kind:'refused',reason:'reactions_voting'});assert.equal(reacted(a).length,0);await vote('reveal');await react(f,b);assert.equal(reacted(a).length,1);await vote('clear');await react(f,b);assert.equal(reacted(a).length,2);
}));
unit(11,'sender and recipient current authority are checked independently',withRoom(async f=>{const a=await f.open(),b=await f.open('viewer'),c=await f.open();f.role(b,null);await react(f,a);assert.equal(reacted(b).length,0);assert.equal(reacted(c).length,1);f.role(a,null);await react(f,a);assert.equal(reacted(c).length,1);}));
unit(12,'sender outage suppresses all; recipient outage only skips that recipient',withRoom(async f=>{const a=await f.open(),b=await f.open(),c=await f.open();const admitted=f.room.reactions.admitted.bind(f.room.reactions);f.room.reactions.admitted=(peer,generation)=>{if(peer.attachment().id===b.person)throw Error('Required admission read unavailable');return admitted(peer,generation);};await react(f,a);assert.equal(reacted(b).length,0);assert.equal(reacted(c).length,1);f.env.access.changes=async()=>{throw Error('Required replay unavailable');};await react(f,a);assert.equal(reacted(c).length,1);}));
unit(13,'room queue orders held reaction behind authority; later revocation drops it',withRoom(async f=>{const a=await f.open(),b=await f.open();const release=f.hold();const pending=react(f,a);await Promise.resolve();f.role(a,null);release();await pending;assert.equal(reacted(b).length,0);}));
unit(14,'maximal bounded reaction attachment validates reconstruction; bad budgets fail',withRoom(async f=>{const {currentAttachment}=await import('../packages/board-room/src/presence.ts');const a=await f.open();const base={...a.c.attachment(),reactionTimes:Array(5).fill(Number.MAX_SAFE_INTEGER)};assert(currentAttachment(base));for(const reactionTimes of [Array(6).fill(1),[-1],[NaN],[1.5],'bad'])assert(!currentAttachment({...base,reactionTimes}));await react(f,a);await f.restart();const b=await f.open();assert.equal(reacted(b).length,0);assert(!Object.hasOwn(b.frames.find(v=>v.kind==='joined'),'reactions'));}));
unit(15,'activity leaves document, revision, stored rows, history and backup identical',withRoom(async f=>{const a=await f.open(),b=await f.open();const backup=JSON.stringify(await f.room.backup()),board=JSON.stringify(f.room.board),tables=f.storage.all("SELECT name FROM sqlite_master WHERE type='table'");const rows=tables.map(t=>[t.name,f.storage.all(`SELECT * FROM "${t.name}"`)]),before=JSON.stringify(rows);for(let i=0;i<5;i++)await react(f,a);assert.equal(JSON.stringify(f.room.board),board);assert.equal(JSON.stringify(await f.room.backup()),backup);assert.equal(JSON.stringify(tables.map(t=>[t.name,f.storage.all(`SELECT * FROM "${t.name}"`)])),before);assert.equal(reacted(b).length,5);}));
unit(16,'locked and trashed rooms never relay',async()=>{for(const ending of ['lock','trash']){const f=await fixture();try{const a=await f.open(),b=await f.open();if(ending==='lock')await f.room.lock();else{f.life('trashed');await assert.rejects(f.room.changed());}if(ending==='trash')await assert.rejects(react(f,a));else await react(f,a);assert.equal(reacted(b).length,0);}finally{f.close();}}});
unit(17,'client throttle draws four and ignored fifth draws none; boundary reopens',async()=>{const {r,sent}=await controller();r.arm('heart');for(let i=0;i<5;i++)r.send(1,2,1000);assert.equal(sent.length,4);assert.equal(r.bursts.length,4);assert(r.send(1,2,2000));assert.equal(sent.length,5);});
unit(18,'uncertain send draws no burst and is never retried',async()=>{const {r,host,sent}=await controller();r.arm('heart');host.sendReaction=()=>false;assert(!r.send(1,2,1));assert.equal(r.bursts.length,0);host.sendReaction=(...v)=>{sent.push(v);return true;};r.sync();assert.equal(sent.length,0);});
unit(19,'incoming known presence only, me uses sender identity, duplicates have no echo',async()=>{const {r,host}=await controller();const f={kind:'reacted',connection:host.presence.others[0].connection,reaction:'me',x:1,y:2};r.receive({...f,connection:randomUUID()},1);assert.equal(r.bursts.length,0);r.receive(f,1);assert.equal(r.bursts[0].label,'ben');assert.equal(r.bursts[0].colour,'#dc2626');r.receive({...f,connection:host.presence.self.connection},1);assert.equal(r.bursts.length,1);});
unit(20,'clear on session ending, connection/board change, lock, preview and vote',async()=>{for(const cause of ['session','connection','lock','preview','vote','access']){const {r,host}=await controller();r.arm('star');r.send(1,2,1);r.open({left:1,top:2});if(cause==='session')r.receive({kind:'reactions_clear'});else{if(cause==='connection')host.presence.self.connection=randomUUID();if(cause==='lock')host.history.locked=true;if(cause==='preview')host.history.previewing=true;if(cause==='vote')host.voting.running=true;if(cause==='access')host.snapshot.connected=false;r.sync();}assert.equal(r.bursts.length,0,cause);assert.equal(r.armed,undefined,cause);assert.equal(r.wheel,undefined,cause);}});
unit(21,'twenty live bursts cap drops oldest; age expires all by 1600ms',async()=>{const {r,host}=await controller();for(let i=0;i<21;i++)r.receive({kind:'reacted',connection:host.presence.others[0].connection,reaction:'heart',x:i,y:0},1000);assert.equal(r.bursts.length,20);assert.equal(r.bursts[0].x,1);r.expire(2599);assert.equal(r.bursts.length,20);r.expire(2600);assert.equal(r.bursts.length,0);});
unit(22,'exact wheel placement, pointer fallback and four edge clamps',async()=>{const {wheelPlacement:p}=await import('../apps/web/src/team/reactions-rules.ts');const b={left:778.5,width:40};assert.deepEqual(p(1280,800,b,732),{left:686.5,top:496});assert.deepEqual(p(1280,800,b,732,{x:640,y:400}),{left:528,top:288});assert.deepEqual(p(375,812,b,744,{x:0,y:0}),{left:12,top:12});assert.deepEqual(p(375,812,b,744,{x:375,y:812}),{left:139,top:576});});
unit(23,'eight slot centres include border origin and radius 80 clockwise',async()=>{const {slotPosition:p}=await import('../apps/web/src/team/reactions-rules.ts');for(let i=0;i<8;i++){const v=p(i),a=-Math.PI/2+i*Math.PI/4;assert(Math.abs(v.left+25-(113+80*Math.cos(a)))<1e-10);assert(Math.abs(v.top+25-(113+80*Math.sin(a)))<1e-10);}});
unit(24,'seven-copy positions and opacity at 80 600 and 1200ms plus lifetime',async()=>{const {burstCopies:b,BURST_COPIES:c}=await import('../apps/web/src/team/reactions-rules.ts');assert.deepEqual(c,[[32,-2,0],[26,14,40],[22,-16,80],[18,6,110],[16,-10,140],[14,20,170],[12,-22,200]]);for(const t of [80,600,1200]){const copies=b({x:900,y:560},t);assert.equal(copies.length,t===80?3:7);copies.forEach((v,i)=>{const [size,side,delay]=c[i],p=(t-delay)/1400,e=1-(1-p)**2;assert.equal(v.left,900+side*1.1*e-size/2);assert.equal(v.top,560-8-160*e-size/2);assert.equal(v.opacity,Math.min(1,(1-p)*1.6));});}assert.equal(b({x:0,y:0},-1).length,0);assert.equal(b({x:0,y:0},1600).length,0);});
unit(25,'reduced motion is one 32px fading copy with no rise',async()=>{const {burstCopies:b}=await import('../apps/web/src/team/reactions-rules.ts');assert.deepEqual(b({x:100,y:100},700,true),[{size:32,left:84,top:76,opacity:.5}]);assert.deepEqual(b({x:0,y:0},1400,true),[]);});
unit(26,'four disabled reasons in exact precedence, joined viewers enabled',async()=>{const {reactionDisabled:d}=await import('../apps/web/src/team/reactions-rules.ts');assert.equal(d(true,false,true,true),'Reactions are off while the board is being restored');assert.equal(d(false,false,true,true),'Reactions are off until the board reconnects');assert.equal(d(false,true,true,true),'Reactions are off while viewing history');assert.equal(d(false,true,false,true),'Reactions are off while voting');assert.equal(d(false,true,false,false),'');});
unit(27,'tool changes close and disarm through the single palette setter',async()=>{const {r,tools}=await controller();r.arm('heart');assert.deepEqual(tools,['Reactions']);r.open({left:1,top:2});r.toolChanged('Pan');assert.equal(r.armed,undefined);assert.equal(r.wheel,undefined);r.arm('star');r.disarm();assert.equal(tools.at(-1),'Select');});
unit(28,'session routes fire-and-forget separately, no recovery on reaction refusals',withRoom(async f=>{
  const {BoardSession}=await import('../packages/board-sync/src/session.ts');const a=await f.open(),b=await f.open();const joined={...a.frames.find(m=>m.kind==='joined'),present:[b.c.attachment().presence]};let h;const sent=[],events=[];
  const session=await BoardSession.join({ticket:async()=>'',open:async()=>({send:t=>sent.push(JSON.parse(t)),close(){},listen:v=>{h=v;v.message(JSON.stringify(joined));}}),clock:{now:()=>0,after:()=>()=>{}}});
  try{session.subscribeReactions(e=>events.push(e));assert(session.react('heart',1,2));assert.deepEqual(sent,[frame('heart',1,2)]);for(const reason of ['bad_reaction','reaction_too_large','reactions_voting'])h.message(JSON.stringify({kind:'refused',reason}));assert(session.react('star',2,3));assert.equal(session.recovering,false);h.message(JSON.stringify({kind:'reacted',reaction:'heart',x:1,y:2,connection:b.c.attachment().connectionId}));assert.equal(events.length,1);h.message(JSON.stringify({kind:'reacted',reaction:'heart',x:1,y:2,connection:randomUUID()}));assert.equal(events.length,1);session.interrupt();assert.equal(events.at(-1).kind,'reactions_clear');assert(!session.react('heart',1,2));const n=events.length;h.message(JSON.stringify({kind:'reacted',reaction:'heart',x:1,y:2,connection:b.c.attachment().connectionId}));assert.equal(events.length,n);}finally{session.close();}
}));
unit(29,'reaction palette, artwork, capture and stacking remain confined to named seams',async()=>{
  const {readFile}=await import('node:fs/promises');const read=n=>readFile(new URL('../'+n,import.meta.url),'utf8');
  const palette=await read('apps/web/src/ui/palette.tsx'),presence=await read('apps/web/src/team/presence-layer.tsx'),layer=await read('apps/web/src/team/reactions-layer.tsx'),spotlight=await read('apps/web/src/team/spotlight-layer.tsx');
  assert(palette.indexOf('<team.reactionTool')<palette.indexOf('<team.commentTool'));assert(presence.indexOf('<ReactionsLayer')<presence.indexOf('</div>\n    <SpotlightLayer'));
  assert(layer.includes("window.addEventListener('keydown', key, true)"));assert(layer.includes("canvas.addEventListener('pointerdown', down, true)"));assert(layer.includes("stopImmediatePropagation"));assert(layer.includes('aria-pressed={!!r.armed}'));assert(layer.includes('role="menuitemradio"'));assert(layer.includes('aria-describedby'));assert(spotlight.includes('hosted.reactions.ownsEvent(e)'));assert(!layer.includes('aria-live'));
});
unit(30,'E allowed only on canvas/body, never in composition or excluded controls',async()=>{
  const {reactionKeyAllowed:a}=await import('../apps/web/src/team/reactions-rules.ts');
  const canvas={closest:()=>null},body={closest:()=>null};assert(a(canvas,canvas,body,false));assert(a(body,canvas,body,false));assert(!a(canvas,canvas,body,true));
  for(const name of ['input','textarea','select','editor','dialog','alertdialog']){const node={closest:()=>({name})};assert(!a(node,canvas,body,false));assert(!a(node,node,body,false));}
});
unit(31,'session drops incoming during voting and clears existing bursts before reporting vote',withRoom(async f=>{
  const {BoardSession}=await import('../packages/board-sync/src/session.ts');const a=await f.open(),b=await f.open();let h;const joined={...a.frames.find(m=>m.kind==='joined'),present:[b.c.attachment().presence]},events=[];
  const session=await BoardSession.join({ticket:async()=>'',open:async()=>({send(){},close(){},listen:v=>{h=v;h.message(JSON.stringify(joined));}}),clock:{now:()=>0,after:()=>()=>{}}});
  try{session.subscribeReactions(e=>events.push(e));const reaction={...frame(),kind:'reacted',connection:b.c.attachment().connectionId};h.message(JSON.stringify(reaction));assert.equal(events.length,1);
    const t=f.room.voting.snapshot();await f.room.message(a.c,JSON.stringify({kind:'vote_command',requestId:randomUUID(),epoch:a.c.attachment().epoch,restoreGeneration:0,sessionId:t.sessionId,expectedSessionVersion:t.sessionVersion,action:'start',prompt:'Choose',budget:3}));
    const event=a.frames.findLast(m=>m.voting?.session.status==='running');assert(event);h.message(JSON.stringify(event));assert.equal(events.at(-1).kind,'reactions_clear');const count=events.length;h.message(JSON.stringify(reaction));assert.equal(events.length,count);assert(!session.react('heart',1,2));
  }finally{session.close();}
}));
unit(32,'refusals and incoming reactions leave document bytes undo redo and revision alone',withRoom(async f=>{
  const {BoardSession}=await import('../packages/board-sync/src/session.ts'),Y=await import('yjs');const a=await f.open(),b=await f.open();let h;const joined={...a.frames.find(m=>m.kind==='joined'),present:[b.c.attachment().presence]};
  const session=await BoardSession.join({ticket:async()=>'',open:async()=>({send(){},close(){},listen:v=>{h=v;h.message(JSON.stringify(joined));}}),clock:{now:()=>0,after:()=>()=>{}}});
  try{const bytes=Y.encodeStateAsUpdate(session.doc),past=[...session.history.past],future=[...session.history.future],revision=session.revision;session.react('heart',1,2);h.message(JSON.stringify({...frame(),kind:'reacted',connection:b.c.attachment().connectionId}));for(const reason of ['bad_reaction','reaction_too_large','reactions_voting'])h.message(JSON.stringify({kind:'refused',reason}));assert.deepEqual(Y.encodeStateAsUpdate(session.doc),bytes);assert.deepEqual(session.history.past,past);assert.deepEqual(session.history.future,future);assert.equal(session.revision,revision);}
  finally{session.close();}
}));
unit(33,'spotlight exempts reaction button wheel E armed sends and Escape only',async()=>{
  const original=globalThis.Element;
  class Target { constructor(kind){this.kind=kind;} matches(selector){return selector.split(',').some(s=>s.trim()===(this.kind==='body'?'body':'.'+this.kind));} closest(selector){if(this.kind==='input'&&selector.includes('input'))return this;if(this.kind==='reactions-tool'&&selector.includes('.reactions-tool'))return this;if(this.kind==='reactions-wheel'&&selector.includes('.reactions-wheel'))return this;if(this.kind==='scene'&&selector.includes('.scene'))return this;return null;} }
  globalThis.Element=Target;
  try{const {r}=await controller(),scene=new Target('scene'),tool=new Target('reactions-tool'),wheel=new Target('reactions-wheel');
    for(const target of [tool,wheel])assert(r.ownsEvent({type:'pointerdown',target,button:0}));
    assert(r.ownsEvent({type:'keydown',key:'e',target:scene}));assert(!r.ownsEvent({type:'keydown',key:'x',target:scene}));assert(!r.ownsEvent({type:'keydown',key:'e',target:new Target('input')}));assert(!r.ownsEvent({type:'keydown',key:'e',target:scene,isComposing:true}));
    r.arm('heart');for(const key of ['Enter','Escape'])assert(r.ownsEvent({type:'keydown',key,target:scene}));assert(r.ownsEvent({type:'pointerdown',target:scene,button:0}));r.spaceHeld=true;assert(!r.ownsEvent({type:'pointerdown',target:scene,button:0}));r.disarm();assert(!r.ownsEvent({type:'keydown',key:'Escape',target:scene}));
  }finally{if(original===undefined)delete globalThis.Element;else globalThis.Element=original;}
});
unit(34,'each reaction relays after one fresh access replay independent of peer count',withRoom(async f=>{
  const peers=[];for(let i=0;i<50;i++)peers.push(await f.open(i%2?'viewer':'editor'));
  const calls={changes:0,role:0,lifecycle:0,fence:0},wrap=(object,key,count)=>{const original=object[key];object[key]=async(...args)=>{calls[count]++;return original(...args);};};
  wrap(f.env.access,'changes','changes');wrap(f.env.access,'role','role');wrap(f.env.lifecycle,'lifecycle','lifecycle');wrap(f.env,'fence','fence');
  const begin=performance.now();await f.room.ordered(()=>f.room.reactions.receive(peers[0].c,frame(),64));
  console.log('MEASURE-R4-U34',JSON.stringify({...calls,milliseconds:performance.now()-begin}));
  assert.equal(reacted(peers[0]).length,0);for(const peer of peers.slice(1))assert.equal(reacted(peer).length,1);
  assert.equal(calls.changes,1,'one fresh strict access replay per reaction');
  assert.equal(calls.role,0,'fresh replayed grants need no role I/O for unchanged recipients');
}));
unit(35,'both runner inventories exclude protected runtime tables and retain unknown app tables',async()=>{
  const {NodeStorage}=await import('../apps/server/src/node-storage.ts'),{readFile}=await import('node:fs/promises');const storage=new NodeStorage(':memory:');
  try{storage.exec('CREATE TABLE _cf_METADATA (key TEXT)');storage.exec('CREATE TABLE meta (key TEXT)');storage.exec('CREATE TABLE reaction_unexpected (value TEXT)');
    for(const file of ['node-test.ts','driver-workerd.ts']){const source=await readFile(new URL('./server/'+file,import.meta.url),'utf8'),query=source.match(/tables: [\w.]+\.all\("([^"]+)"\)/)?.[1];assert(query,file);const tables=storage.all(query).map(v=>v.name);assert(!tables.includes('_cf_METADATA'),file+' protected runtime table');assert(tables.includes('meta'));assert(tables.includes('reaction_unexpected'),'no allowlist can hide a new reaction table');}
  }finally{storage.close();}
});
unit(36,'closure invalidates pending socket admission and later reactions reach nobody',async()=>{
  for(const ending of ['lock','trash']){const f=await fixture();try{const a=await f.open('owner'),b=await f.open('viewer'),ticket=await f.room.ticket({id:b.person,email:'viewer@example.test',expiresAt:999999999});
    if(ending==='lock')await f.room.lock();else{f.life('trashed');await assert.rejects(f.room.changed());}
    assert.equal(a.closed,ending==='lock'?4423:4403);assert.equal(b.closed,ending==='lock'?4423:4403);
    await assert.rejects(f.room.join(ticket.ticket));for(const peer of [a,b]){try{await react(f,peer);}catch(error){assert.equal(error.message,'not_found');}}assert.equal(reacted(a).length,0);assert.equal(reacted(b).length,0);
  }finally{f.close();}}
});
unit(37,'recipient admission reads use the fresh frame context without storage or service I/O',withRoom(async f=>{
  const a=await f.open(),b=await f.open('viewer'),r=f.room.reactions,admitted=r.admitted.bind(r),all=f.storage.all.bind(f.storage);
  let checked=0;
  r.admitted=(peer,context)=>{const previous=f.storage.all;f.storage.all=()=>{throw Error('Admission must not perform storage I/O');};try{checked++;return admitted(peer,context);}finally{f.storage.all=previous;}};
  await react(f,a);assert.equal(reacted(b).length,1);assert.equal(reacted(a).length,0);assert(checked>=3);f.storage.all=all;
}));
unit(38,'S377 unit harness relays all 12250 bounded frames and removes closed budgets',withRoom(async f=>{
  const clients=[];for(let i=0;i<50;i++)clients.push(await f.open(i%2?'viewer':'editor'));
  const changes=f.env.access.changes;let replays=0;f.env.access.changes=async(...args)=>{replays++;return changes(...args);};
  const started=performance.now();for(const c of clients)for(let i=0;i<5;i++)await react(f,c);
  const milliseconds=performance.now()-started;
  for(const c of clients){const frames=reacted(c);assert.equal(frames.length,245);const senders=new Map();for(const value of frames){assert(new TextEncoder().encode(JSON.stringify(value)).length<=512);assert.notEqual(value.connection,c.c.attachment().connectionId);senders.set(value.connection,(senders.get(value.connection)??0)+1);}assert.equal(senders.size,49);assert([...senders.values()].every(n=>n===5));assert.equal(c.c.attachment().reactionTimes.length,5);}
  assert.equal(replays,250);for(const c of clients)await f.depart(c,1000);assert.equal(f.env.connections().length,0);
  console.log('MEASURE-S377-UNIT',JSON.stringify({milliseconds,connections:50,frames:250,relays:12250,replays,closedBudgets:50}));
}));
unit(39,'sender read failure stops relay and failed recipient never rolls back earlier delivery or retries',withRoom(async f=>{
  const a=await f.open(),b=await f.open('viewer'),c=await f.open(),r=f.room.reactions,read=r.admitted.bind(r);let failed=a.person;
  r.admitted=(peer,context)=>{if(peer.attachment().id===failed)throw Error('Required admission read unavailable');return read(peer,context);};
  await react(f,a);assert.equal(reacted(b).length+reacted(c).length,0);
  failed=c.person;await react(f,a);assert.equal(reacted(b).length,1);assert.equal(reacted(c).length,0);
  failed=null;assert.equal(reacted(c).length,0);await react(f,a);assert.equal(reacted(b).length,2);assert.equal(reacted(c).length,1);
}));
unit(40,'sender and recipients recheck expiry role epoch and generation after the strict await',async()=>{
  for(const sender of [false,true])for(const [patch,code] of [[{expiresAt:0},4401],[{role:'viewer'},4409],[{epoch:900},4403],[{restoreGeneration:900},4423]]){
    const f=await fixture();try{const a=await f.open(),b=await f.open(),c=await f.open('viewer'),target=sender?a:b,authority=f.room.timer.authority.bind(f.room.timer);
      f.room.timer.authority=async()=>{const generation=await authority();target.c.attach({...target.c.attachment(),...patch});return generation;};
      await react(f,a);assert.equal(target.closed,code);assert.equal(reacted(target).length,0);assert.equal(reacted(c).length,sender?0:1);assert.equal(reacted(a).length,0);
    }finally{f.close();}
  }
});
