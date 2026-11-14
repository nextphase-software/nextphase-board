// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const unit=(id,name,fn)=>test(`P1-U${String(id).padStart(2,'0')} ${name}`,fn);
async function fixture(count=4){
  const {Room}=await import('../packages/board-room/src/room.ts');
  const {NodeStorage}=await import('../apps/server/src/node-storage.ts');
  const {add}=await import('../packages/board-rules/src/document.ts');
  const storage=new NodeStorage(':memory:'),id=randomUUID(),people=new Map(),connections=[];
  let at=100000,generation=0,latest=0,offline=false,life='active',held;
  const changes=[];
  const env={storage,now:()=>at,access:{board:async()=>({id,title:'Spotlight board',createdAt:new Date(at).toISOString()}),
    role:async(person)=>{if(held){const wait=held;held=undefined;await wait;}if(offline)throw Error('Authority unavailable');return people.get(person)??null;},
    changes:async(_board,after)=>{if(offline)throw Error('Replay unavailable');return {latest,lowestKept:1,changes:changes.filter(c=>c.number>after)};}},
    lifecycle:{lifecycle:async()=>({state:life,generation})},fence:async()=>generation,raiseFence:async(min=0)=>generation=Math.max(generation,min)+1,
    hash:async v=>createHash('sha256').update(v).digest('hex'),randomId:randomUUID,randomTicket:randomUUID,verify:async()=>{},connections:()=>connections,schedule:async()=>{},backupLimit:16777216};
  let room=new Room(id,env),board={schemaVersion:10,boardId:id,title:'Spotlight board',objects:[],retiredGenerations:[]};
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
const started=async f=>{const a=await f.open(),b=await f.open('viewer'),r=await f.send(a,'start');assert.equal(r.kind,'spotlight_result');await f.presence(a);return {a,b,r};};
unit(1,'wire exact actions, projection, response and UTF-8 limits',async()=>{const v=await import('../packages/board-sync/src/spotlight.ts');const base={kind:'spotlight_command',requestId:randomUUID(),epoch:0,restoreGeneration:0,authorityId:randomUUID(),sessionId:null,action:'start',expectedControlVersion:0};assert.equal(v.checkSpotlightRequest(base,1024).action,'start');assert.equal(v.checkSpotlightRequest(base,1025),'spotlight_message_too_large');for(const k of ['role','person','colour','presenter','followers','resumeKey'])assert.equal(v.checkSpotlightRequest({...base,[k]:1},500),'spotlight_bad_message');const p={session:v.idleSpotlight(base.authorityId),own:{membershipVersion:0,following:false},presenting:null};assert(v.spotlightProjection(p));assert(!v.spotlightProjection({...p,key:'secret'}));for(const frame of [{kind:'spotlight_result',requestId:base.requestId,cause:'start'},{kind:'spotlight_state',cause:'left'},{kind:'spotlight_snapshot',requestId:base.requestId},{kind:'spotlight_refused',requestId:null,reason:'spotlight_state'}]){const f={...frame,spotlight:p,restoreGeneration:0};assert(v.checkSpotlightFrame(f,4096));assert(!v.checkSpotlightFrame(f,4097));assert(!v.checkSpotlightFrame({...f,actor:base.requestId},500));}});
for(const [i,role] of ['owner','editor','viewer'].entries())unit(2+i,`${role} may present, read and cancel`,withRoom(async f=>{const a=await f.open(role),r=await f.send(a,'start');assert.equal(r.kind,'spotlight_result');assert.match(r.resumeKey,/^[0-9a-f]{64}$/);assert.equal(r.spotlight.session.presenter.connection,a.c.attachment().connectionId);assert.deepEqual((await f.read(a)).spotlight,r.spotlight);assert.equal((await f.send(a,'stop')).spotlight.session.phase,'idle');}));
unit(5,'first valid simultaneous Start wins in both receipt orders',withRoom(async f=>{for(const reverse of [false,true]){const a=await f.open(),b=await f.open(),x=f.command(a,'start'),y=f.command(b,'start');f.advance(1001);const r=reverse?await Promise.all([f.answer(b,y),f.answer(a,x)]):await Promise.all([f.answer(a,x),f.answer(b,y)]);assert.equal(r[0].kind,'spotlight_result');assert.equal(r[1].reason,'spotlight_stale_session');await f.send(reverse?b:a,'stop');}}));
unit(6,'takeover invalidates capability and memberships in a single increment',withRoom(async f=>{const {a,b,r}=await started(f);await f.send(b,'follow');const old=f.command(a,'stop'),next=await f.send(b,'take_over');assert.equal(next.spotlight.session.controlVersion,2);assert.notEqual(next.spotlight.session.sessionId,r.spotlight.session.sessionId);assert.equal((await f.answer(a,old)).reason,'spotlight_stale_session');assert.equal(next.spotlight.own.following,false);}));
unit(7,'same account other tab cannot Stop but can take over',withRoom(async f=>{const {a}=await started(f),tab=await f.open('editor',a.person);assert.equal((await f.send(tab,'stop')).reason,'spotlight_not_presenter');assert.equal((await f.send(tab,'follow')).reason,'spotlight_state');assert.equal((await f.send(tab,'take_over')).kind,'spotlight_result');}));
unit(8,'fresh real active=false presence is required after Start',withRoom(async f=>{const a=await f.open(),b=await f.open();await f.send(a,'start');assert.equal((await f.send(b,'follow')).reason,'spotlight_state');await f.presence(a,false);assert.equal((await f.send(b,'follow')).kind,'spotlight_result');}));
unit(9,'distinct people and independent tab leaves count correctly',withRoom(async f=>{const {a,b}=await started(f),tab=await f.open('viewer',b.person),c=await f.open();for(const peer of [b,tab,c])await f.send(peer,'follow');assert.equal((await f.read(a)).spotlight.presenting.followers,2);await f.send(b,'leave');assert.equal((await f.read(a)).spotlight.presenting.followers,2);await f.send(tab,'leave');await f.send(c,'leave');assert.deepEqual((await f.read(a)).spotlight.presenting,{followers:0,hasHadFollower:true});}));
unit(10,'membership publication has only own flag and presenter count',withRoom(async f=>{const {a,b}=await started(f),observer=await f.open(),before=observer.frames.length;await f.send(b,'follow');assert.equal(observer.frames.length,before);assert.equal(b.projection.presenting,null);assert.equal(a.projection.presenting.followers,1);assert(!JSON.stringify(observer.frames).includes('resumeKey'));}));
unit(11,'independent members do not contend; stale delayed Leave cannot undo rejoin',withRoom(async f=>{const {b}=await started(f),c=await f.open();await Promise.all([f.send(b,'follow'),f.send(c,'follow')]);const old=f.command(b,'leave');await f.send(b,'leave');await f.send(b,'follow');assert.equal((await f.answer(b,old)).reason,'spotlight_stale_member');assert.equal(b.projection.own.following,true);}));
unit(12,'authority await cannot be overtaken by a second Start',withRoom(async f=>{const a=await f.open(),b=await f.open(),release=f.hold(),one=f.answer(a,f.command(a,'start'));await new Promise(r=>setImmediate(r));const two=f.answer(b,f.command(b,'start'));assert.equal(f.room.spotlight.session.phase,'idle');release();assert.equal((await one).kind,'spotlight_result');assert.equal((await two).reason,'spotlight_stale_session');}));
unit(13,'rolling budgets include malformed recognized attempts and exact boundaries',withRoom(async f=>{const c=await f.open(),m=f.command(c,'start',{forged:true});for(let i=0;i<5;i++){m.requestId=randomUUID();assert.equal((await f.answer(c,m)).reason,'spotlight_bad_message');}m.requestId=randomUUID();assert.equal((await f.answer(c,m)).reason,'spotlight_rate_limited');assert.equal(c.c.attachment().spotlightTimes.length,5);assert.equal((await f.read(c)).kind,'spotlight_snapshot');f.advance(1000);assert.equal((await f.answer(c,{...f.command(c,'start')})).kind,'spotlight_result');}));
unit(14,'wire whitespace limit refuses without partial session',withRoom(async f=>{const c=await f.open(),m=f.command(c,'start'),text=JSON.stringify(m);assert.equal((await f.answer(c,m,text+' '.repeat(1025-Buffer.byteLength(text)))).reason,'spotlight_message_too_large');assert.equal(f.room.spotlight.session.phase,'idle');const exact={...m,requestId:randomUUID()},raw=JSON.stringify(exact);assert.equal((await f.answer(c,exact,raw+' '.repeat(1024-Buffer.byteLength(raw)))).kind,'spotlight_result');}));
unit(15,'required source outage withholds projection, key and coordinates',withRoom(async f=>{const {a,b}=await started(f),before=b.frames.length,s=f.room.spotlight.session;f.offline(true);await f.presence(a);assert.equal(b.frames.length,before);const r=await f.read(b);assert.equal(r.reason,'spotlight_unavailable');assert(!('spotlight'in r));assert.equal(f.room.spotlight.session,s);f.offline(false);await f.presence(a);assert.equal(b.frames.at(-1).kind,'present');}));
for(const [i,code] of [1000,1001,4401,4403,4409,4423].entries())unit(16+i,`terminal ${code} overrides an earlier recovery signal`,withRoom(async f=>{const {a,b}=await started(f);await f.send(b,'follow');await f.room.closed(a.c,1011,'error');assert.equal(f.room.spotlight.session.phase,'reconnecting');const version=f.room.spotlight.session.controlVersion;await f.room.closed(a.c,code,'retry_recovery');assert.equal(f.room.spotlight.session.phase,'idle');assert.equal(f.room.spotlight.session.controlVersion,version+1);await f.room.closed(a.c,code);assert.equal(f.room.spotlight.session.controlVersion,version+1);}));
unit(22,'4410/1006 suspend once for exactly five seconds',withRoom(async f=>{const {a,b}=await started(f);await f.send(b,'follow');await f.depart(a,4410,'retry_recovery');const deadline=f.room.spotlight.session.graceDeadline;f.advance(4999);await f.room.closed(a.c,1006);assert.equal(f.room.spotlight.session.graceDeadline,deadline);await f.room.spotlight.expire();assert.equal(f.room.spotlight.session.phase,'reconnecting');f.advance(1);await f.room.spotlight.expire();assert.equal(f.room.spotlight.session.phase,'idle');}));
unit(23,'fresh same-page rebind rotates key and resumes connected members only',withRoom(async f=>{const {a,b,r}=await started(f),left=await f.open();await f.send(b,'follow');await f.send(left,'follow');await f.send(left,'leave');await f.depart(a,4410);const next=await f.open('editor',a.person);await f.presence(next);const rebound=await f.send(next,'resume',{resumeKey:r.resumeKey});assert.equal(rebound.kind,'spotlight_result');assert.notEqual(rebound.resumeKey,r.resumeKey);assert.equal(rebound.spotlight.session.sessionId,r.spotlight.session.sessionId);assert.equal((await f.read(b)).spotlight.own.following,true);assert.equal((await f.read(left)).spotlight.own.following,false);}));
unit(24,'wrong capability/account and either exact-deadline expiry order cannot rebind',async()=>{
  for(const expireFirst of [false,true]){
    const f=await fixture();try{
      const {a,r}=await started(f);await f.depart(a);const other=await f.open();await f.presence(other);assert.equal((await f.send(other,'resume',{resumeKey:r.resumeKey})).reason,'spotlight_state');
      const next=await f.open('editor',a.person);await f.presence(next);assert.equal((await f.send(next,'resume',{resumeKey:'0'.repeat(64)})).reason,'spotlight_state');
      const resume=f.command(next,'resume',{resumeKey:r.resumeKey}),deadline=f.room.spotlight.deadline();assert(deadline>f.env.now());f.advance(deadline-f.env.now());
      if(expireFirst)await f.room.alarm();assert.equal((await f.answer(next,resume)).reason,'spotlight_stale_session');assert.equal(f.room.spotlight.session.phase,'idle');assert.equal(f.room.spotlight.session.graceDeadline,null);
    }finally{f.close();}
  }
});
unit(25,'follower fresh admission starts version zero and never follows by read',withRoom(async f=>{const {a,b}=await started(f);await f.send(b,'follow');await f.depart(b);const fresh=await f.open('viewer',b.person);assert.deepEqual(fresh.projection.own,{membershipVersion:0,following:false});assert.equal((await f.read(a)).spotlight.presenting.followers,0);assert.equal((await f.read(fresh)).spotlight.own.following,false);}));
unit(26,'presenter revoke and role change terminate before protected close',withRoom(async f=>{const {a,b}=await started(f);await f.send(b,'follow');f.role(a,'viewer');await f.room.changed();assert.equal(a.closed,4403);assert.equal(f.room.spotlight.session.phase,'idle');assert.equal(b.projection.session.phase,'idle');const next=await f.open('viewer',a.person);assert.equal(next.projection.session.phase,'idle');}));
unit(27,'follower revoke removes count while presenter remains',withRoom(async f=>{const {a,b}=await started(f);await f.send(b,'follow');f.role(b,null);await f.room.changed();assert.equal(b.closed,4403);assert.equal((await f.read(a)).spotlight.presenting.followers,0);assert.equal(f.room.spotlight.session.phase,'active');}));
unit(28,'presence expiry suspends presenter and removes expired members',withRoom(async f=>{const {a,b}=await started(f);await f.send(b,'follow');f.advance(30000);await f.room.alarm();assert.equal(f.room.spotlight.session.phase,'reconnecting');assert.equal(f.room.spotlight.projection(b.c).own.following,false);f.advance(5000);await f.room.alarm();assert.equal(f.room.spotlight.session.phase,'idle');}));
unit(29,'live attachment reconstruction retains authority/key and missing presenter never elects follower',withRoom(async f=>{const {a,b,r}=await started(f);await f.send(b,'follow');const old=f.room.spotlight.session;await f.restart();assert.deepEqual((await f.read(a)).spotlight.session,old);assert.equal(a.c.attachment().spotlightPresenter.key,r.resumeKey);await f.depart(a);await f.restart();assert.equal((await f.read(b)).spotlight.session.phase,'idle');assert.notEqual(f.room.spotlight.session.authorityId,old.authorityId);}));
unit(30,'voting rejected before commit preserves; committed start ends even if later stamp fails',withRoom(async f=>{const {a}=await started(f);const send=async extra=>{const m={kind:'vote_command',requestId:randomUUID(),epoch:a.c.attachment().epoch,restoreGeneration:0,sessionId:null,expectedSessionVersion:0,action:'start',prompt:'Choose',budget:3,...extra};await f.room.message(a.c,JSON.stringify(m));return a.frames.findLast(v=>v.requestId===m.requestId);};assert.equal((await send({budget:0})).kind,'vote_refused');assert.equal(f.room.spotlight.session.phase,'active');f.advance(1001);f.room.voting.stamp=async()=>{throw Error('After committed Start');};await send({});assert.equal(f.room.voting.running(),true);assert.equal(f.room.spotlight.session.phase,'idle');assert.equal((await f.send(a,'start')).reason,'spotlight_voting');}));
unit(31,'spotlight-only cycle writes zero document/storage/history/backup bytes',withRoom(async f=>{const a=await f.open(),b=await f.open(),before=JSON.stringify((await f.room.backup()).tables),revision=f.storage.all("SELECT value FROM meta WHERE key='revision'");await f.send(a,'start');await f.presence(a);await f.send(b,'follow');await f.read(a);await f.send(b,'leave');await f.send(a,'stop');assert.equal(JSON.stringify((await f.room.backup()).tables),before);assert.deepEqual(f.storage.all("SELECT value FROM meta WHERE key='revision'"),revision);assert(!f.storage.all("SELECT name FROM sqlite_master WHERE type='table'").some(r=>String(r.name).includes('spotlight')));}));
unit(32,'control entry reserves suspension and terminal headroom without wrap',withRoom(async f=>{const a=await f.open(),M=Number.MAX_SAFE_INTEGER;f.room.spotlight.session.controlVersion=M-3;const r=await f.send(a,'start');assert.equal(r.spotlight.session.controlVersion,M-2);assert.equal((await f.send(await f.open(),'take_over')).reason,'spotlight_version_exhausted');await f.room.closed(a.c,1011);assert.equal(f.room.spotlight.session.controlVersion,M-1);f.room.spotlight.end('recovery');assert.equal(f.room.spotlight.session.controlVersion,M);f.room.spotlight.end('recovery');assert.equal(f.room.spotlight.session.controlVersion,M);assert.equal((await f.send(a,'start')).reason,'spotlight_version_exhausted');}));
unit(33,'membership headroom preserves Leave and finalized cleanup fence',withRoom(async f=>{const {a,b}=await started(f),M=Number.MAX_SAFE_INTEGER,sessionId=f.room.spotlight.session.sessionId;const seed=(v,following=false)=>b.c.attach({...b.c.attachment(),spotlightMember:{sessionId,membershipVersion:v,following,finalized:false}});seed(M-3);assert.equal((await f.send(b,'follow')).spotlight.own.membershipVersion,M-2);assert.equal((await f.send(b,'leave')).spotlight.own.membershipVersion,M-1);assert.equal((await f.send(b,'follow')).reason,'spotlight_version_exhausted');await f.send(a,'stop');assert.equal(b.c.attachment().spotlightMember.membershipVersion,M);assert.equal(b.c.attachment().spotlightMember.finalized,true);f.room.spotlight.end('stop');assert.equal(b.c.attachment().spotlightMember.membershipVersion,M);}));
unit(34,'resume-follow exhaustion safely leaves only exhausted member',withRoom(async f=>{const {a,b,r}=await started(f),c=await f.open();await f.send(b,'follow');await f.send(c,'follow');b.c.attach({...b.c.attachment(),spotlightMember:{...b.c.attachment().spotlightMember,membershipVersion:Number.MAX_SAFE_INTEGER-2}});await f.depart(a,4410);const next=await f.open('editor',a.person);await f.presence(next);assert.equal((await f.send(next,'resume',{resumeKey:r.resumeKey})).kind,'spotlight_result');assert.equal((await f.read(b)).spotlight.own.following,false);assert.equal(b.c.attachment().spotlightMember.membershipVersion,Number.MAX_SAFE_INTEGER-1);assert(b.frames.some(m=>m.kind==='spotlight_refused'&&m.requestId===null&&m.reason==='spotlight_version_exhausted'));assert.equal((await f.read(c)).spotlight.own.following,true);}));
unit(35,'actual serialized metadata, budgets and full attachment remain bounded',withRoom(async f=>{const {a,b}=await started(f);await f.send(b,'follow');const {spotlightBytes}=await import('../packages/board-sync/src/spotlight.ts');for(const c of [a,b]){const v=c.c.attachment();assert(spotlightBytes({presenter:v.spotlightPresenter,member:v.spotlightMember})<=1024);assert(spotlightBytes(v)<=16384);assert(spotlightBytes(v.spotlightTimes)<=1024);}console.log('MEASURE-P1-U35',JSON.stringify({presenter:spotlightBytes(a.c.attachment()),member:spotlightBytes(b.c.attachment()),projection:spotlightBytes(a.projection)}));}));
unit(36,'notice-aware geometry covers desktop cap, narrow rows and 240px fallback',async()=>{const {spotlightGeometry:g}=await import('../apps/web/src/team/spotlight-rules.ts');assert.deepEqual(g(900,700,[64,132+55],[]),{top:199,maxWidth:400,width:'max-content',maxHeight:489});assert.equal(g(375,812,[188+90],[]).width,351);assert.equal(g(900,700,[64],[{left:260,right:888,top:70,bottom:400}]).maxWidth,240);assert.deepEqual(g(900,700,[64],[{left:259.5,right:888,top:70,bottom:400}]),{top:408,maxWidth:876,width:876,maxHeight:280});});
function clock(){let at=0,next=0;const tasks=new Map(),old={setTimeout,clearTimeout,setInterval,clearInterval,now:Date.now};globalThis.setTimeout=(fn,delay)=>{tasks.set(++next,{at:at+delay,fn});return next;};globalThis.setInterval=(fn,delay)=>{tasks.set(++next,{at:at+delay,fn,repeat:delay});return next;};globalThis.clearTimeout=globalThis.clearInterval=id=>tasks.delete(id);Date.now=()=>at;return {tasks,advance(to){for(;;){const found=[...tasks].filter(([,v])=>v.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!found)break;at=found[1].at;if(found[1].repeat)found[1].at+=found[1].repeat;else tasks.delete(found[0]);found[1].fn();}at=to;},restore(){Date.now=old.now;delete old.now;Object.assign(globalThis,old);}};}
async function controller(){const {BoardSpotlight}=await import('../apps/web/src/team/spotlight.ts');const time=clock(),commands=[],reads=[],host={snapshot:{connected:true},presence:{self:{person:'b'.repeat(32)},others:[]},voting:{running:false},history:{previewing:false},spotlightChanged(){},readSpotlight:id=>{reads.push(id);return true;},sendSpotlight:c=>{commands.push(c);return true;},clearManualFollow(){},toast(){}};const s=new BoardSpotlight(host),projection={session:{authorityId:randomUUID(),sessionId:randomUUID(),controlVersion:1,phase:'active',presenter:{connection:randomUUID(),person:'a'.repeat(32),label:'ana',colour:'#2563eb'},graceDeadline:null},own:{membershipVersion:0,following:false},presenting:null};host.presence.others=[projection.session.presenter];return {s,time,host,commands,reads,p:projection,close(){s.clear();time.restore();}};}
unit(37,'full 3000ms fresh offer commits only an acknowledged membership',async()=>{const f=await controller();try{f.s.joined(f.p);f.time.advance(2999);assert.equal(f.commands.length,0);assert.equal(f.s.motion,false);f.time.advance(3000);assert.equal(f.commands[0].action,'follow');assert.equal(f.s.motion,false);f.s.receive({kind:'spotlight_result',requestId:f.commands[0].requestId,cause:'follow',spotlight:{...f.p,own:{membershipVersion:1,following:true}},restoreGeneration:0});assert.equal(f.s.motion,true);}finally{f.close();}});
unit(38,'hidden/editor/IME/gesture/preview reset and defer a full offer',async()=>{for(const key of ['visible','editing','composing','gesture','preview']){const f=await controller();try{f.s.joined(f.p);f.time.advance(2000);f.s.safetyChanged({[key]:key==='visible'?false:true});f.time.advance(10000);assert.equal(f.commands.length,0);f.s.safetyChanged({[key]:key==='visible'?true:false});f.time.advance(12999);assert.equal(f.commands.length,0);f.time.advance(13000);assert.equal(f.commands.length,1);f.s.joined({...f.p,own:{membershipVersion:1,following:true}});assert.equal(f.s.motion,true);f.s.safetyChanged({[key]:key==='visible'?false:true});assert.equal(f.s.motion,false,key);}finally{f.close();}}});
unit(39,'follower fresh join forgets offline leave and dismissal for same session',async()=>{const f=await controller();try{f.s.joined({...f.p,own:{membershipVersion:1,following:true}});f.s.disconnect();f.host.snapshot.connected=false;f.s.dismiss();f.host.snapshot.connected=true;f.s.joined(f.p);assert.equal(f.s.mode,'offer');assert.equal(f.s.seconds,3);f.time.advance(2999);assert.equal(f.commands.length,0);f.time.advance(3000);assert.equal(f.commands.at(-1).action,'follow');}finally{f.close();}});
unit(40,'own work freezes motion before acknowledged leave and ignores stale snapshots',async()=>{const f=await controller();try{const following={...f.p,own:{membershipVersion:1,following:true}};f.s.joined(following);assert.equal(f.s.motion,true);f.s.localAction();assert.equal(f.s.motion,false);assert.equal(f.commands[0].action,'leave');f.s.receive({kind:'spotlight_snapshot',requestId:randomUUID(),spotlight:f.p,restoreGeneration:0});assert.equal(f.s.projection.own.membershipVersion,1);assert.equal(f.s.motion,false);f.s.receive({kind:'spotlight_result',requestId:f.commands[0].requestId,cause:'leave',spotlight:{...f.p,own:{membershipVersion:2,following:false}},restoreGeneration:0});assert.equal(f.s.following,false);}finally{f.close();}});
unit(41,'single health read and 30000ms stale freeze are independent of timer',async()=>{const f=await controller();try{f.s.joined({...f.p,own:{membershipVersion:1,following:true}});assert.equal(f.reads.length,1);f.time.advance(14999);assert.equal(f.reads.length,1);f.time.advance(30000);assert.equal(f.s.mode,'uncertain');assert.equal(f.s.motion,false);f.s.receive({kind:'spotlight_snapshot',requestId:f.reads[0],spotlight:{...f.p,own:{membershipVersion:1,following:true}},restoreGeneration:0});assert.equal(f.s.mode,'ready');assert.equal(f.s.motion,false);f.s.presence(f.p.session.presenter.connection);assert.equal(f.s.motion,true);}finally{f.close();}});
unit(42,'pending two-second readback never retries a mutation',async()=>{const f=await controller();try{f.s.joined(f.p);f.s.command('follow');f.time.advance(2000);assert.equal(f.s.mode,'uncertain');assert.equal(f.commands.length,1);assert.equal(f.s.motion,false);}finally{f.close();}});
unit(43,'initial snapshots and duplicate live notifications do not repeat speech',async()=>{const f=await controller();try{f.host.presence.others=[];f.s.joined(f.p);assert.equal(f.s.speech,'');const following={...f.p,own:{membershipVersion:1,following:true}},event={kind:'spotlight_state',cause:'follow',spotlight:following,restoreGeneration:0};f.s.receive(event);assert.equal(f.s.speech,'Following ana');f.s.receive(event);assert.equal(f.s.speech,'Following ana');f.s.receive({kind:'spotlight_state',cause:'leave',spotlight:{...f.p,own:{membershipVersion:2,following:false}},restoreGeneration:0});assert.equal(f.s.speech,'Stopped following ana');}finally{f.close();}});
unit(44,'preview stops presenters, leaves followers and disables new starts',async()=>{const f=await controller();try{f.s.joined({...f.p,presenting:{followers:0,hasHadFollower:false}});f.host.history.previewing=true;f.s.preview();assert.equal(f.commands[0].action,'stop');assert.equal(f.s.disabledReason,'Back to current board to present');}finally{f.close();}});
unit(45,'dedicated focus/status and notice observers retain native surfaces',async()=>{const {readFile}=await import('node:fs/promises');const s=await readFile(new URL('../apps/web/src/team/spotlight-layer.tsx',import.meta.url),'utf8'),css=await readFile(new URL('../apps/web/style.css',import.meta.url),'utf8');assert(s.includes('data-workshop-status="spotlight" role="status" aria-live="polite" aria-atomic="true"'));assert(s.includes('.team-notice-column'));assert(s.includes('ResizeObserver'));assert(s.includes('[role=dialog],input,textarea,select,[contenteditable=true]'));assert(css.includes('main:has(.presence-follow-banner) > .team-notice-column { top: 188px; }'));assert(css.includes('gap: 8px;'));assert(!s.includes(' · '));});
unit(46,'every retrying session path sends 4410/retry_recovery and terminal paths stay clean',async()=>{
  const Y=await import('yjs');
  const {BoardSession,encode}=await import('../packages/board-sync/src/session.ts'),{Adapter}=await import('../packages/board-sync/src/document-adapter.ts');
  const seed=new Adapter();seed.set({schemaVersion:10,boardId:randomUUID(),title:'Recovery fixture',objects:[],retiredGenerations:[]});
  try{for(const action of ['interrupt','reconnect','deadline','send_failure','discard','unavailable','close',1000,1006,4410,4401,4403,4409,4423]){
    let now=0;const tasks=new Set(),wires=[],events=[];
    const session=await BoardSession.join({ticket:async()=>'',clock:{now:()=>now,after:(ms,run)=>{const t={at:now+ms,run};tasks.add(t);return()=>tasks.delete(t);}},open:async()=>{
      const wire={sent:[],closes:[],fail:false,send(text){if(this.fail)throw Error('send');this.sent.push(JSON.parse(text));},close(code,reason){this.closes.push({code,reason});},listen(h){this.h=h;h.message(JSON.stringify({kind:'joined',role:'editor',epoch:0,restoreGeneration:0,revision:0,update:encode(Y.encodeStateAsUpdate(seed.doc)),self:{},present:[]}));}};wires.push(wire);return wire;
    }});session.subscribe(e=>events.push(e));const wire=wires[0];
    let id;
    if(action==='deadline'||action==='send_failure'){wire.fail=action==='send_failure';id=session.edit({...session.board,title:'Unconfirmed work'});if(action==='deadline'){now=10000;for(const t of [...tasks])if(t.at<=now){tasks.delete(t);t.run();}}assert.equal(session.requests.get(id).state,'waiting');assert.equal(events.at(-1).code,action==='deadline'?4000:1006);if(action==='deadline')assert.equal(events.at(-1).reason,'answer_deadline');}
    else if(typeof action==='number')wire.h.close(action);
    else if(action==='discard')session.discard('chosen_reason');
    else await session[action]();
    const terminal=['discard','unavailable','close',1000,4401,4403,4409,4423].includes(action);
    assert.deepEqual(wire.closes,[{code:terminal?1000:4410,reason:terminal?undefined:'retry_recovery'}],String(action));
    if(action==='interrupt')assert.equal(events.length,0);
    session.close();
  }}finally{seed.destroy();}
});
unit(47,'maximal verified labels, selections and budgets are bounded before transition',withRoom(async f=>{
  const {spotlightBytes}=await import('../packages/board-sync/src/spotlight.ts'),{validSpotlightAttachment}=await import('../packages/board-room/src/spotlight.ts');
  const a=await f.open('editor',randomUUID(),'"'.repeat(256)),b=await f.open();
  assert.equal((await f.send(a,'start')).kind,'spotlight_result');
  const a0=a.c.attachment(),p={...a0.presence,selection:Array.from({length:250},randomUUID),cursor:{x:-1000000,y:1000000},view:{x:-1000000,y:1000000,width:1000000,height:1000000}};
  const full={...a0,presence:p,reactionTimes:Array(5).fill(Number.MAX_SAFE_INTEGER),timerTimes:Array(5).fill(Number.MAX_SAFE_INTEGER),timerReadTimes:Array(5).fill(Number.MAX_SAFE_INTEGER),voteTimes:Array(5).fill(Number.MAX_SAFE_INTEGER),voteReadTimes:Array(5).fill(Number.MAX_SAFE_INTEGER),spotlightTimes:Array(5).fill(Number.MAX_SAFE_INTEGER),spotlightReadTimes:Array(5).fill(Number.MAX_SAFE_INTEGER)};
  assert(validSpotlightAttachment(full));assert(spotlightBytes(full)<=16384);const metadata=spotlightBytes({spotlightPresenter:full.spotlightPresenter});assert(metadata<=1024);
  await f.send(a,'stop');const oversized=await f.open('editor',randomUUID(),'\u0000'.repeat(256)),before=structuredClone(f.room.spotlight.session);
  assert.equal((await f.send(oversized,'start')).reason,'spotlight_message_too_large');assert.deepEqual(f.room.spotlight.session,before);assert.equal((await f.read(b)).spotlight.session.phase,'idle');
  console.log('MEASURE-P1-U47',JSON.stringify({metadataBytes:metadata,fullAttachmentBytes:spotlightBytes(full),rateBytes:spotlightBytes(full.spotlightTimes)}));
}));
unit(48,'all forced endings use reserved terminal control/member increments',async()=>{
  for(const cause of ['stop','voting','revocation','grace_expiry','lifecycle','recovery','last_leave']){
    const f=await fixture();try{
      const {a,b}=await started(f);await f.send(b,'follow');const M=Number.MAX_SAFE_INTEGER;
      f.room.spotlight.session.controlVersion=M-2;b.c.attach({...b.c.attachment(),spotlightMember:{...b.c.attachment().spotlightMember,membershipVersion:M-2}});
      await f.room.closed(a.c,1011);assert.equal(f.room.spotlight.session.controlVersion,M-1);
      if(cause==='stop')await f.send(a,'stop');
      if(cause==='voting'){const m={kind:'vote_command',requestId:randomUUID(),epoch:a.c.attachment().epoch,restoreGeneration:0,sessionId:null,expectedSessionVersion:0,action:'start',prompt:'Choose',budget:3};await f.room.message(a.c,JSON.stringify(m));}
      if(cause==='revocation'){f.role(a,'viewer');await f.room.changed();}
      if(cause==='grace_expiry'){f.advance(5000);await f.room.spotlight.expire();}
      if(cause==='lifecycle'){f.life('trashed');await assert.rejects(f.room.changed());}
      if(cause==='recovery')await f.room.lock();
      if(cause==='last_leave'){await f.depart(a);await f.depart(b);}
      assert.equal(f.room.spotlight.session.phase,'idle',cause);assert.equal(f.room.spotlight.session.controlVersion,M,cause);assert.equal(f.room.spotlight.deadline(),null,cause);
      if(b.closed===undefined)assert.equal(b.c.attachment().spotlightMember.membershipVersion,M-1,cause);
      const final=f.room.spotlight.session;f.room.spotlight.end('recovery');assert.equal(f.room.spotlight.session,final,cause);
    }finally{f.close();}
  }
});
unit(49,'Worker adapter forwards original close code/reason before separate normalization',async()=>{
  const {WorkerRoom}=await import('../apps/server/src/worker-room.ts');const calls=[],instance=new WorkerRoom({},{});
  instance.getRoom=async()=>({closed:async(c,code,reason)=>{calls.push({kind:'room',code,reason});assert.equal(c.attachment().connectionId,'fixture');}});
  const socket={deserializeAttachment:()=>({connectionId:'fixture'}),close:code=>calls.push({kind:'socket',code})};
  await instance.webSocketClose(socket,1006,'no frame');assert.deepEqual(calls,[{kind:'room',code:1006,reason:'no frame'},{kind:'socket',code:1001}]);calls.length=0;
  await instance.webSocketError(socket);assert.deepEqual(calls,[{kind:'room',code:1011,reason:'error'},{kind:'socket',code:1011}]);
});
unit(50,'local pending Escape freezes late follow success and sends only a fresh-version Leave',async()=>{const f=await controller();try{f.s.joined(f.p);f.s.command('follow');const request=f.commands[0];f.s.escape();assert.equal(f.s.motion,false);f.s.receive({kind:'spotlight_result',requestId:request.requestId,cause:'follow',spotlight:{...f.p,own:{membershipVersion:1,following:true}},restoreGeneration:0});assert.equal(f.s.motion,false);assert.equal(f.commands.length,2);assert.equal(f.commands[1].action,'leave');assert.equal(f.commands[1].expectedMembershipVersion,1);}finally{f.close();}});
unit(51,'Start requests a real presence update and foreground admission refreshes health',async()=>{const f=await controller();try{let requested=0;f.host.requestFreshPresence=()=>requested++;const idle={...f.p,session:{...f.p.session,sessionId:null,controlVersion:0,phase:'idle',presenter:null}};f.s.joined(idle);f.s.command('start');f.s.receive({kind:'spotlight_result',requestId:f.commands[0].requestId,cause:'start',resumeKey:'a'.repeat(64),spotlight:{...f.p,presenting:{followers:0,hasHadFollower:false}},restoreGeneration:0});assert.equal(requested,1);f.s.safetyChanged({visible:false});f.time.advance(40000);assert.equal(f.reads.length,1);f.s.safetyChanged({visible:true});assert.equal(f.reads.length,2);assert.equal(f.s.mode,'uncertain');}finally{f.close();}});
unit(52,'temporary member authority outage cannot erase attachment membership or partially resume',withRoom(async f=>{
  const {a,b,r}=await started(f);await f.send(b,'follow');const role=f.env.access.role;
  f.env.access.role=async(person,...rest)=>{if(person===b.person)throw Error('Member authority unavailable');return role(person,...rest);};
  await f.restart();await assert.rejects(()=>f.room.spotlight.recover());assert.equal(b.c.attachment().spotlightMember.following,true);
  f.env.access.role=role;assert.equal((await f.read(b)).spotlight.own.following,true);
  await f.depart(a,4410);const next=await f.open('editor',a.person);await f.presence(next);const before=structuredClone(f.room.spotlight.session),member=structuredClone(b.c.attachment().spotlightMember);
  f.env.access.role=async(person,...rest)=>{if(person===b.person)throw Error('Member authority unavailable');return role(person,...rest);};
  assert.equal((await f.send(next,'resume',{resumeKey:r.resumeKey})).reason,'spotlight_unavailable');assert.deepEqual(f.room.spotlight.session,before);assert.deepEqual(b.c.attachment().spotlightMember,member);
  f.env.access.role=role;assert.equal((await f.send(next,'resume',{resumeKey:r.resumeKey})).kind,'spotlight_result');
}));
unit(53,'new room authority retires prior results and terminal transport fences ignore late frames',withRoom(async f=>{
  const {BoardSession}=await import('../packages/board-sync/src/session.ts');const a=await f.open(),joined=a.frames.find(v=>v.kind==='joined');let handlers;
  const session=await BoardSession.join({ticket:async()=>'',open:async()=>({send(){},close(){},listen(h){handlers=h;h.message(JSON.stringify(joined));}}),clock:{now:()=>0,after:()=>()=>{}}});
  try{const original=joined.spotlight,replacement={...original,session:{...original.session,authorityId:randomUUID()}},emit=p=>handlers.message(JSON.stringify({kind:'spotlight_snapshot',requestId:randomUUID(),restoreGeneration:joined.restoreGeneration,spotlight:p}));emit(replacement);emit(original);assert.deepEqual(session.spotlightSnapshot,replacement);session.unavailable();emit(original);assert.equal(session.spotlightSnapshot,undefined);}finally{session.close();}
}));
unit(54,'voting freezes lost spotlight state but retains a working controller after reveal',async()=>{const f=await controller();try{
  f.s.joined({...f.p,own:{membershipVersion:1,following:true}});f.host.voting.running=true;f.s.workshopChanged();assert.equal(f.s.motion,false);assert.equal(f.s.mode,'uncertain');
  const idle={...f.p,session:{...f.p.session,controlVersion:2,phase:'idle',sessionId:null,presenter:null},own:{membershipVersion:2,following:false}};f.s.receive({kind:'spotlight_snapshot',requestId:f.reads.at(-1),spotlight:idle,restoreGeneration:0});f.host.voting.running=false;f.s.workshopChanged();assert.equal(f.s.mode,'ready');assert.equal(f.s.command('start'),true);assert.equal(f.commands.at(-1).action,'start');
}finally{f.close();}});
unit(55,'Worker normalization cleanup preserves original grace while real terminal closes win',async()=>{
  const {WorkerRoom}=await import('../apps/server/src/worker-room.ts');
  for(const first of [1006,1011])for(const terminal of [1000,1001,4401,4403,4409,4423]){
    const f=await fixture();try{
      const {a,b}=await started(f);await f.send(b,'follow');const original=f.room.spotlight.session.controlVersion,callbacks=[];
      const instance=new WorkerRoom({},{});instance.getRoom=async()=>f.room;
      const socket={deserializeAttachment:()=>a.c.attachment(),serializeAttachment:v=>a.c.attach(v),send:text=>a.frames.push(JSON.parse(text)),close(code){
        const peers=f.env.connections(),i=peers.indexOf(a.c);if(i>=0)peers.splice(i,1);
        callbacks.push(()=>instance.webSocketClose(socket,code,''));
      }};
      if(first===1006)await instance.webSocketClose(socket,first,'no frame');else await instance.webSocketError(socket);
      const grace=f.room.spotlight.session.graceDeadline;assert.equal(f.room.spotlight.session.phase,'reconnecting');assert.equal(grace,f.env.now()+5000);
      // Deliver the adapter's own physical cleanup callback, once, like workerd.
      await callbacks.shift()();assert.equal(f.room.spotlight.session.phase,'reconnecting');assert.equal(f.room.spotlight.session.graceDeadline,grace);assert.equal(f.room.spotlight.session.controlVersion,original+1);
      if(first===1006&&terminal===1001)continue; // This socket's 1001 is known normalization; real 1001 follows the error path above.
      await instance.webSocketClose(socket,terminal,'terminal');assert.equal(f.room.spotlight.session.phase,'idle');assert.equal(f.room.spotlight.session.graceDeadline,null);assert.equal(f.room.spotlight.session.controlVersion,original+2);assert.equal(b.c.attachment().spotlightMember.following,false);
      await instance.webSocketError(socket);assert.equal(f.room.spotlight.session.controlVersion,original+2);
    }finally{f.close();}
  }
});
unit(56,'banner top measures only top bars, context and notices, never the bottom tool palette',async()=>{const {readFile}=await import('node:fs/promises');const s=await readFile(new URL('../apps/web/src/team/spotlight-layer.tsx',import.meta.url),'utf8');const m=s.match(/visible\('([^']*)'\)\.map\(n=>n\.getBoundingClientRect\(\)\.bottom\)/);assert(m,'bottom selector found');const parts=m[1].split(',').map(x=>x.trim());for(const want of ['.file','.actions','.context','.context-bar','.team-banner','.team-notice-column'])assert(parts.includes(want),want);assert(!parts.includes('.palette'),'bottom palette must not set the banner top');const {spotlightGeometry:g}=await import('../apps/web/src/team/spotlight-rules.ts');const r=g(1280,800,[56,60],[]);assert.equal(r.top,72);assert(r.maxHeight>600);});

let hostedModule;
async function hostedController() {
  // Bundle the existing extensionless web imports; replace only browser I/O ports.
  hostedModule ??= (async () => {
    const {build}=await import('esbuild');
    const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
    const {join}=await import('node:path'),{tmpdir}=await import('node:os');
    const {fileURLToPath,pathToFileURL}=await import('node:url');
    const result=await build({entryPoints:[fileURLToPath(new URL('../apps/web/src/team/hosted-board.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'spotlight-unit-ports',setup(b){
      b.onLoad({filter:/\/team\/api\.ts$/},()=>({contents:"export function api(){throw Error('Unexpected HTTP request');} export class ApiError extends Error {}",loader:'js'}));
      b.onLoad({filter:/\/team\/auth\.ts$/},()=>({contents:'export const auth={};',loader:'js'}));
      b.onLoad({filter:/\/team\/config\.ts$/},()=>({contents:"export const socketOrigin='ws://127.0.0.1';",loader:'js'}));
    }}]});
    const folder=await mkdtemp(join(tmpdir(),'board-spotlight-unit-'));
    try { const path=join(folder,'host.mjs');await writeFile(path,result.outputFiles[0].text);return await import(pathToFileURL(path).href); }
    finally { await rm(folder,{recursive:true,force:true}); }
  })();
  const {HostedBoard}=await hostedModule,f=await controller();
  const host=new HostedBoard({kind:'board',board:randomUUID()},()=>{}),s=host.spotlight;
  host.snapshot={...host.snapshot,connected:true,role:'editor'};
  host.presence={...host.presence,...f.host.presence};
  host.readSpotlight=id=>{f.reads.push(id);return true;};
  host.sendSpotlight=c=>{f.commands.push(c);return true;};
  return {...f,host,s,close(){s.clear();f.close();}};
}
function idleProjection(p,controlVersion=0) {
  return {...p,session:{...p.session,sessionId:null,controlVersion,phase:'idle',presenter:null},own:{membershipVersion:0,following:false}};
}
function spotlightState(f,p,cause='start') {
  f.s.receive({kind:'spotlight_state',cause,spotlight:p,restoreGeneration:0});
}
function confirmFollow(f) {
  f.s.receive({kind:'spotlight_result',requestId:f.commands.at(-1).requestId,cause:'follow',spotlight:{...f.p,own:{membershipVersion:1,following:true}},restoreGeneration:0});
}
unit(57,'NB-110 preview history emits preserve a new deferred offer until current board and full window',async()=>{
  const f=await hostedController();try {
    f.s.joined(idleProjection(f.p));
    f.host.history.previewing=true;f.host.historyChanged();
    spotlightState(f,f.p);f.s.presence(f.p.session.presenter.connection);
    for(const at of [500,1000,2000]) { f.time.advance(at);f.host.historyChanged(); }
    f.time.advance(6000);
    assert.equal(f.commands.length,0);assert.equal(f.s.motion,false);
    f.host.history.previewing=false;f.host.historyChanged();
    f.s.presence(f.p.session.presenter.connection);
    f.time.advance(8999);assert.equal(f.commands.length,0);
    f.time.advance(9000);assert.deepEqual(f.commands.map(c=>c.action),['follow']);
    confirmFollow(f);f.time.advance(12000);assert.equal(f.commands.length,1);
  } finally { f.close(); }
});
unit(58,'NB-110 hidden return follows exactly at the full safe deadline despite late presence and readback',async()=>{
  const f=await controller();try {
    f.s.joined(idleProjection(f.p));f.s.safetyChanged({visible:false});
    spotlightState(f,f.p);f.s.presence(f.p.session.presenter.connection);
    f.time.advance(6000);assert.equal(f.commands.length,0);assert.equal(f.s.motion,false);
    f.s.safetyChanged({visible:true});
    // Foreground readback and real active=false presence may arrive off the tick grid.
    f.time.advance(8100);f.s.receive({kind:'spotlight_snapshot',requestId:f.reads.at(-1),spotlight:f.p,restoreGeneration:0});
    f.time.advance(8780);f.s.presence(f.p.session.presenter.connection);
    f.time.advance(8999);assert.equal(f.commands.length,0);
    f.time.advance(9000);assert.deepEqual(f.commands.map(c=>c.action),['follow']);
    confirmFollow(f);f.time.advance(12000);assert.equal(f.commands.length,1);
  } finally { f.close(); }
});
unit(59,'NB-111 People hides comment surfaces and keeps drafts clock and spotlight on reopening',async()=>{
  const f=await hostedController();try {
    const {host}=f,thread=randomUUID(),draft={reply:{text:'Unposted handoff reply'},editing:{id:randomUUID(),draft:{text:'Unposted edit'}}};
    // Exercise the layer's actual state gate without mounting React or a DOM.
    const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
    const layer=await readFile(new URL('../apps/web/src/team/comments/layer.tsx',import.meta.url),'utf8');
    const gate=layer.match(/const surfaceHidden = ([^;]+);/);assert(gate);
    const surfacesHidden=()=>runInNewContext(gate[1],{hosted:host});
    host.commentDrafts.set(thread,draft);
    host.timer.snapshot={status:'running',durationMs:134000,endsAtServerMs:134000,remainingMs:null,version:1,timerId:randomUUID()};
    host.timer.draft={minutes:'01',seconds:'15'};
    let tool='Comment';host.hideComments=()=>{tool='Select';};
    f.s.joined({...f.p,own:{membershipVersion:1,following:true}});
    const projection=structuredClone(f.s.projection),timer=structuredClone(host.timer.snapshot),timerDraft=structuredClone(host.timer.draft);
    host.showSurface('comments');host.showSurface('people');
    assert.equal(surfacesHidden(),true,'People suppresses both the open card and panel');
    assert.equal(tool,'Select');assert.equal(host.surface,'people');
    assert.equal(host.commentDrafts.get(thread),draft);
    tool='Comment';host.showSurface('comments');
    assert.equal(surfacesHidden(),false);assert.equal(tool,'Comment');
    assert.deepEqual(host.commentDrafts.get(thread),draft);
    assert.deepEqual(host.timer.snapshot,timer);
    assert.deepEqual(host.timer.draft,timerDraft);
    assert.deepEqual(f.s.projection,projection);assert.equal(f.s.following,true);
    assert.equal(f.s.motion,true);assert.equal(host.presence.followed,null);assert.deepEqual(f.commands,[]);
  } finally { f.close(); }
});
for(const confirmed of [false,true])unit(confirmed?61:60,`NB-112 presenter Stop clears banner and manual follow ${confirmed?'right after confirmation':'while follow is pending'}`,async()=>{
  const f=await hostedController();try {
    f.s.joined(f.p);
    f.host.follow(f.p.session.presenter.person);
    assert.deepEqual(f.commands.map(c=>c.action),['follow']);
    if(confirmed)confirmFollow(f);
    assert.equal(f.s.visible,true);
    spotlightState(f,idleProjection(f.p,2),'stop');
    assert.equal(f.s.visible,false);assert.equal(f.s.following,false);assert.equal(f.s.motion,false);
    assert.equal(f.host.presence.followed,null);
    assert.equal(f.s.mode,'ready');
    f.time.advance(6000);assert.equal(f.s.visible,false);assert.equal(f.commands.length,1);
  } finally { f.close(); }
});
unit(62,'NB-113 narrow spotlight status explicitly occupies its own flex row',async()=>{
  const {readFile}=await import('node:fs/promises');
  const css=await readFile(new URL('../apps/web/style.css',import.meta.url),'utf8');
  const narrow=[...css.matchAll(/@media\s*\(max-width:\s*599\.98px\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(m=>m[1]).join('\n');
  assert.equal(/\.spotlight-banner\s*>\s*\.spotlight-status\s*\{[^}]*flex-basis:\s*100%;/.test(narrow),true,'status has flex-basis:100% below 600px');
  assert.match(css,/\.spotlight-banner\s*>\s*\.spotlight-status\s*\{\s*flex:\s*0 1 auto;/);
});

async function commentInputState(host,options={}) {
  // Execute the production capture callbacks against state ports, without a DOM.
  const {readFile}=await import('node:fs/promises'),{createContext,runInContext}=await import('node:vm');
  const {transform}=await import('esbuild'),rules=await import('../apps/web/src/team/comments/rules.ts');
  const source=await readFile(new URL('../apps/web/src/team/comments/layer.tsx',import.meta.url),'utf8');
  const close=source.slice(source.indexOf('  function closeCard()'),source.indexOf('  function open('));
  const place=source.slice(source.indexOf('  function place('),source.indexOf('  useEffect(() => {\n    const canvas = scene.current;'));
  const callbacks=source.slice(source.indexOf('    const keys ='),source.indexOf('    window.addEventListener("keydown", keys'));
  assert(close&&place&&callbacks);
  const thread=randomUUID(),kept={reply:{text:'Unposted spotlight handoff draft.'},editing:null};
  host.commentDrafts.set(thread,kept);
  const canvas={focus(){state.focused++;},closest(){return null;}};
  const state={...rules,hosted:host,canvas,scene:{current:canvas},pins:{current:new Map()},landing:undefined,
    opened:{id:thread},composer:null,draft:{text:'Unposted composer draft'},mode:false,focused:0,
    spaceHeld:{current:false},point:()=>({x:1,y:2}),anchor:p=>p,view:{x:0,y:0},
    setOpened(value){state.opened=value;},setComposer(value){state.composer=value;},setDraft(value){state.draft=value;},
    setTool(value){state.mode=value==='Comment';},setHidden(){},setHover(){},
    requestAnimationFrame(run){run();},...options};
  const js=await transform(close+place+callbacks+'\nglobalThis.handlers={keys,down,move};',{loader:'ts'});
  runInContext(js.code,createContext(state));
  return {state,thread,kept,event(target=canvas,key='Escape'){
    return {target,key,code:key===' '?'Space':key,button:0,isComposing:false,prevented:false,stopped:false,
      preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
  }};
}
unit(63,'NB-111 hidden comment inputs preserve card and composer drafts until Comments reopens',async()=>{
  const f=await hostedController();try {
    for(const surface of ['people','timer','share','history'])for(const composer of [false,true]) {
      f.host.history.open=surface==='history';f.host.showSurface(surface);
      const c=await commentInputState(f.host,composer?{opened:null,composer:{x:1,y:2},mode:true}:{});
      const opened=c.state.opened,anchor=c.state.composer,draft=c.state.draft;
      const other={closest(){return null;}};
      for(const key of ['Escape','c','C','Enter',' ']) {
        const event=c.event(other,key);c.state.handlers.keys(event);
        assert.equal(c.state.opened,opened,`${surface}: ${key} must not close a hidden card`);
        assert.equal(c.state.composer,anchor,`${surface}: ${key} must not cancel a hidden composer`);
        assert.equal(c.state.draft,draft);assert.equal(f.host.commentDrafts.get(c.thread),c.kept);
        assert.equal(event.prevented,false);assert.equal(event.stopped,false);
      }
      c.state.handlers.down(c.event());
      assert.equal(c.state.opened,opened);assert.equal(c.state.composer,anchor);assert.equal(c.state.draft,draft);
      assert.equal(f.host.commentDrafts.get(c.thread),c.kept);assert.equal(c.state.focused,0);
      f.host.showSurface('comments');c.state.mode=true;
      assert.equal(f.host.commentDrafts.get(c.thread).reply.text,'Unposted spotlight handoff draft.');
      const escape=c.event();c.state.handlers.keys(escape);
      assert.equal(c.state.composer,null);assert.equal(c.state.opened,null);
      assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);
      if(composer)assert.equal(c.state.draft.text,'');else assert.equal(f.host.commentDrafts.has(c.thread),false);
    }
  } finally { f.close(); }
});
