// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const path='../packages/board-sync/src/timer.ts';
async function fixture(){
  const {Room}=await import('../packages/board-room/src/room.ts');
  const {NodeStorage}=await import('../apps/server/src/node-storage.ts');
  const s=new NodeStorage(':memory:'),board=randomUUID(),person=randomUUID(),peers=[];
  let now=100000,generation=0,offline=false,role='editor',latest=0,life='active';
  const env={storage:s,now:()=>now,access:{board:async()=>({title:'Timer board',createdAt:new Date(now).toISOString()}),
    role:async()=>role,changes:async(_b,after)=>{if(offline)throw Error('authority');return {latest,lowestKept:1,changes:after<latest?[{personId:person,number:latest}]:[]};}},
    lifecycle:{lifecycle:async()=>({state:life,generation})},fence:async()=>generation,raiseFence:async(min=0)=>generation=Math.max(generation,min)+1,
    hash:async v=>createHash('sha256').update(v).digest('hex'),randomId:randomUUID,randomTicket:randomUUID,
    verify:async()=>({id:person,email:'synthetic@example.test',expiresAt:999999999}),connections:()=>peers,schedule:async()=>{},backupLimit:16777216};
  let room=new Room(board,env);
  async function open(){const ticket=await room.ticket(await env.verify());let a=await room.join(ticket.ticket);const messages=[];let closed;
    const c={attachment:()=>a,attach:v=>{a=v;},send:text=>messages.push(JSON.parse(text)),close:code=>{closed=code;const i=peers.indexOf(c);if(i>=0)peers.splice(i,1);}};
    peers.push(c);await room.connected(c);return {c,messages,get closed(){return closed;}};}
  async function send(client,action,extra={}){const t=room.timer.snapshot();const m={kind:'timer_command',requestId:randomUUID(),epoch:client.c.attachment().epoch,restoreGeneration:client.c.attachment().restoreGeneration,timerId:t.timerId,expectedVersion:t.version,action,...(action==='start'?{durationMs:180000}:{}),...extra};await room.message(client.c,JSON.stringify(m));return client.messages.findLast(x=>x.requestId===m.requestId);}
  return {s,env,board,person,get room(){return room;},open,send,now:v=>{now=v;},advance:v=>{now+=v;},offline:v=>{offline=v;},role:v=>{role=v;latest++;},life:v=>{life=v;},restart:()=>{room=new Room(board,env);},close:()=>s.close()};
}
const unit=(id,name,fn)=>test(`W1-U${String(id).padStart(2,'0')} ${name}`,fn);
unit(1,'exact actor-free snapshot and strict request keys',async()=>{const t=await import(path),idle=t.idleTimer();assert(t.timerSnapshot(idle));assert(!t.timerSnapshot({...idle,lastActor:randomUUID()}));const base={kind:'timer_command',requestId:randomUUID(),epoch:0,restoreGeneration:0,timerId:null,expectedVersion:0,action:'start',durationMs:1000};assert.equal(t.checkTimerRequest(base,1024).action,'start');for(const key of ['actor','role','remainingMs','endsAtServerMs','now'])assert.equal(t.checkTimerRequest({...base,[key]:1},200),'timer_bad_message');assert.equal(t.checkTimerRequest(base,1025),'timer_message_too_large');});
unit(2,'duration bounds are distinct from malformed shape',async()=>{const t=await import(path);for(const n of [0,-1,1,1001,6000000,Number.MAX_SAFE_INTEGER+1])assert.equal(t.checkTimerRequest({kind:'timer_command',requestId:randomUUID(),epoch:0,restoreGeneration:0,timerId:null,expectedVersion:0,action:'start',durationMs:n},200),'timer_bounds');for(const durationMs of ['1000',null,true])assert.equal(t.checkTimerRequest({kind:'timer_command',requestId:randomUUID(),epoch:0,restoreGeneration:0,timerId:null,expectedVersion:0,action:'start',durationMs},200),'timer_bad_message');});
unit(3,'cause is strict, actor-free, and mandatory only on committed transitions',async()=>{const t=await import(path),stamp={timer:t.idleTimer(),serverNowMs:0,restoreGeneration:0},v={kind:'timer_state',...stamp,cause:'end'};assert(t.checkTimerFrame(v,300));for(const cause of [null,'finished','ana@example.test',undefined])assert(!t.checkTimerFrame({...v,cause},300));assert(!t.checkTimerFrame({...v,actor:randomUUID()},300));assert(t.checkTimerFrame({kind:'timer_sample',requestId:randomUUID(),...stamp},300));assert(!t.checkTimerFrame({kind:'timer_sample',requestId:randomUUID(),...stamp,cause:'end'},300));});
unit(4,'capped independent rolling windows count invalid attempts and age exact boundary',async()=>{const {timerBudget}=await import(path);let times;for(let i=0;i<5;i++)times=timerBudget(times,100);assert.equal(timerBudget(times,1099),null);assert.deepEqual(timerBudget(times,1100),[1100]);assert.equal(timerBudget(Array(6).fill(0),1100),null);assert.equal(timerBudget([200],100),null);});
unit(5,'input draft validation, padding, arrows and cap',async()=>{const r=await import('../apps/web/src/team/timer-rules.ts');assert.equal(r.draftMs(r.defaultDraft()),180000);for(const d of [{minutes:'',seconds:'00'},{minutes:'-1',seconds:'00'},{minutes:'01',seconds:'60'},{minutes:'x',seconds:'00'}])assert.equal(r.draftMs(d),null);assert.equal(r.draftMs({minutes:'00',seconds:'00'}),0);assert.deepEqual(r.padDraft({minutes:'1',seconds:'2'}),{minutes:'01',seconds:'02'});assert.deepEqual(r.shiftDraft(r.defaultDraft(),-300000),{minutes:'00',seconds:'00'});assert.deepEqual(r.shiftDraft({minutes:'99',seconds:'40'},60000),{minutes:'99',seconds:'59'});});
unit(6,'monotonic midpoint tolerates skew and wall jumps',async()=>{const r=await import('../apps/web/src/team/timer-rules.ts'),a=r.sampleAnchor(100000,10,30),b=r.sampleAnchor(100000,10010,10030);assert.equal(r.serverTime(a,1020),r.serverTime(b,11020));assert.equal(r.sampleAnchor(0,30,10),null);const t={status:'running',endsAtServerMs:102000};assert.equal(r.remainingMs(t,r.serverTime(a,1020)),1000);assert.deepEqual(r.timeParts(1),{minutes:'00',seconds:'01'});});
unit(7,'cause speech deduplicates result/broadcast, rejects conflict, suppresses join and reset',async()=>{const {transitionSpeech}=await import('../apps/web/src/team/timer-rules.ts');let mark={baseline:4,version:4,cause:null};assert.equal(transitionSpeech(mark,4,'start').text,'');let v=transitionSpeech(mark,5,'end');assert.equal(v.text,'Timer stopped');assert.equal(transitionSpeech(v.mark,5,'end').text,'');assert.equal(transitionSpeech(v.mark,5,'expire').conflict,true);assert.equal(transitionSpeech(v.mark,4,'expire').text,'');assert.equal(transitionSpeech(v.mark,6,'reset').text,'');assert.equal(transitionSpeech(v.mark,6,'expire').text,'Timer finished');});
for(const role of ['owner','editor','viewer'])unit(8+['owner','editor','viewer'].indexOf(role),`${role} controls without document edits`,async()=>{const f=await fixture();try{f.role(role);const c=await f.open(),before=await f.room.export(c.c.attachment());for(const action of ['start','pause','resume','extend','end']){f.advance(1001);assert.equal((await f.send(c,action)).kind,'timer_result');}assert.equal(await f.room.export(c.c.attachment()),before);assert.equal(f.s.all("SELECT value FROM meta WHERE key='revision'")[0].value,0);assert.equal(f.s.all('SELECT * FROM receipts').length,0);}finally{f.close();}});
unit(11,'one queue chooses the first simultaneous Start and one extend',async()=>{const f=await fixture();try{const a=await f.open(),b=await f.open();const shape={timerId:null,expectedVersion:0};const [first,second]=await Promise.all([f.send(a,'start',shape),f.send(b,'start',shape)]);assert.equal(first.kind,'timer_result');assert.equal(second.reason,'timer_stale');f.advance(1001);const t=f.room.timer.snapshot(),extra={timerId:t.timerId,expectedVersion:t.version};const replies=await Promise.all([f.send(b,'extend',extra),f.send(a,'extend',extra)]);assert.equal(replies[0].kind,'timer_result');assert.equal(replies[1].reason,'timer_stale');assert.equal(f.room.timer.snapshot().durationMs,240000);}finally{f.close();}});
unit(12,'awaited access cannot allow a later command to overtake',async()=>{const f=await fixture();try{const a=await f.open(),b=await f.open();let entered,release;const start=new Promise(r=>entered=r);const original=f.env.access.role;let first=true;f.env.access.role=async(...args)=>{if(first){first=false;entered();await new Promise(r=>release=r);}return original(...args);};const shape={timerId:null,expectedVersion:0},one=f.send(a,'start',shape);await start;const two=f.send(b,'start',shape);release();assert.equal((await one).kind,'timer_result');assert.equal((await two).reason,'timer_stale');}finally{f.close();}});
unit(13,'pause/resume retain identity and exact remaining',async()=>{const f=await fixture();try{const c=await f.open();await f.send(c,'start');const initial=f.room.timer.snapshot();f.advance(1234);await f.send(c,'pause');const paused=f.room.timer.snapshot();assert.equal(paused.remainingMs,178766);f.advance(100000);await f.send(c,'resume');assert.equal(f.room.timer.snapshot().endsAtServerMs,initial.endsAtServerMs+100000);}finally{f.close();}});
unit(14,'cap accepts only remaining delta and safe cumulative budget',async()=>{const f=await fixture();try{const c=await f.open();await f.send(c,'start',{durationMs:5999000});assert.equal((await f.send(c,'extend')).reason,'timer_bounds');f.advance(10000);await f.send(c,'extend');assert.equal(f.room.timer.snapshot().durationMs,6009000);f.advance(1001);f.s.exec('UPDATE workshop_timer SET duration_ms=?',Number.MAX_SAFE_INTEGER);const before=f.room.timer.snapshot();assert.equal((await f.send(c,'extend')).reason,'timer_bounds');assert.deepEqual(f.room.timer.snapshot(),before);}finally{f.close();}});
unit(15,'zero window only End; late normalization is once and carries expire',async()=>{const f=await fixture();try{const c=await f.open();await f.send(c,'start',{durationMs:1000});f.advance(1000);assert.equal((await f.send(c,'pause')).reason,'timer_state');assert.equal((await f.send(c,'extend')).reason,'timer_state');f.advance(2499);assert.equal(f.room.timer.snapshot().status,'running');await f.room.alarm();assert.equal(f.room.timer.snapshot().status,'running');f.advance(1);await f.room.alarm();assert.equal(f.room.timer.snapshot().status,'idle');assert.equal(c.messages.findLast(x=>x.kind==='timer_state').cause,'expire');const v=f.room.timer.snapshot().version;await f.room.alarm();assert.equal(f.room.timer.snapshot().version,v);}finally{f.close();}});
unit(16,'End leaves a server UUID actor but no client actor and replacement resists stale delivery',async()=>{const f=await fixture();try{const c=await f.open();await f.send(c,'start');const old=f.room.timer.snapshot();await f.send(c,'end');f.advance(1001);await f.send(c,'start');assert.equal((await f.send(c,'end',{timerId:old.timerId,expectedVersion:old.version})).reason,'timer_stale');assert.equal(f.s.all('SELECT * FROM workshop_timer')[0].last_actor,f.person);for(const m of c.messages.filter(m=>m.kind.startsWith('timer_')))assert.doesNotMatch(JSON.stringify(m),/last_actor|lastActor|email|synthetic/);}finally{f.close();}});
unit(17,'strict replay failure prevents joins and timer replies while cached document export remains',async()=>{const f=await fixture();try{const c=await f.open();f.offline(true);assert.equal((await f.send(c,'start')).reason,'timer_unavailable');assert(!('timer'in c.messages.at(-1)));await assert.rejects(f.open());assert.equal(JSON.parse(await f.room.export(c.c.attachment())).title,'Timer board');}finally{f.close();}});
unit(18,'transaction failure publishes no success and deliberate retry works',async()=>{const f=await fixture();try{const c=await f.open(),before=f.room.timer.snapshot(),exec=f.s.exec.bind(f.s);f.s.exec=(sql,...args)=>{if(sql.startsWith('INSERT INTO workshop_timer'))throw Error('storage');exec(sql,...args);};assert.equal((await f.send(c,'start')).reason,'timer_unavailable');assert.deepEqual(f.room.timer.snapshot(),before);assert(!c.messages.some(m=>m.kind==='timer_state'));f.s.exec=exec;assert.equal((await f.send(c,'start')).kind,'timer_result');}finally{f.close();}});
unit(19,'ordinary reconstruction preserves running/paused singleton and rate attachment',async()=>{const f=await fixture();try{const c=await f.open();await f.send(c,'start');const t=f.room.timer.snapshot();f.advance(1001);f.restart();await f.room.load();assert.deepEqual(f.room.timer.snapshot(),t);await f.send(c,'pause');const paused=f.room.timer.snapshot();f.advance(100000);f.restart();await f.room.load();assert.deepEqual(f.room.timer.snapshot(),paused);assert(c.c.attachment().timerTimes.length<=5);}finally{f.close();}});
unit(20,'logical backup excludes timer and rejects injections before fence or writes',async()=>{const f=await fixture();try{const c=await f.open();await f.send(c,'start');const backup=await f.room.backup();assert(!('workshop_timer'in backup.tables));assert.equal(backup.tables.meta.find(r=>r.key==='storage_version').value,8);for(const mutate of [b=>b.timer={},b=>b.tables.workshop_timer=[],b=>b.tables.meta.push({key:'timer',value:1}),b=>b.tables.meta.push({key:'explicit_recovery_pending',value:1}),b=>b.tables.meta.push({key:'explicit_recovery_generation',value:1}),b=>b.tables.meta[0].timer=1]){const b=structuredClone(backup);mutate(b);const before=f.room.timer.snapshot(),fence=await f.env.fence();await assert.rejects(f.room.restore(b));assert.deepEqual(f.room.timer.snapshot(),before);assert.equal(await f.env.fence(),fence);}}finally{f.close();}});
unit(21,'logical operator restore resets without embedding a timer',async()=>{const f=await fixture();try{const c=await f.open(),b=await f.room.backup();await f.send(c,'start');await f.room.restore(b);await f.room.export(await f.env.verify());assert.equal(f.room.timer.snapshot().status,'idle');assert.equal(f.room.timer.snapshot().version,0);}finally{f.close();}});
unit(22,'explicit marker reserves/reset once and malformed reservation fails closed',async()=>{const f=await fixture();try{const {markExplicitRecovery}=await import('../packages/board-room/src/timer.ts');const c=await f.open();await f.send(c,'start');markExplicitRecovery(f.s);await f.room.timer.recover();assert.equal(f.room.timer.snapshot().status,'idle');const row=f.s.all("SELECT value FROM meta WHERE key='explicit_recovery_generation'")[0];assert(row.value>0);await f.room.timer.recover();assert.equal(f.s.all("SELECT value FROM meta WHERE key='explicit_recovery_generation'")[0].value,row.value);f.s.exec("DELETE FROM meta WHERE key='explicit_recovery_pending'");await assert.rejects(f.room.timer.recover(),/Invalid recovery marker/);}finally{f.close();}});
unit(23,'maximal legal encoded row, frames and marker rows remain bounded',async()=>{const t=await import(path),{NodeStorage}=await import('../apps/server/src/node-storage.ts'),{initialize}=await import('../packages/board-room/src/storage.ts'),{writeTimer,timerRow}=await import('../packages/board-room/src/timer.ts');const s=new NodeStorage(':memory:');try{initialize(s);const n=Number.MAX_SAFE_INTEGER,timer={status:'running',durationMs:n,endsAtServerMs:n-2500,remainingMs:null,version:n,timerId:randomUUID()};writeTimer(s,timer,randomUUID());const measure={row:Buffer.byteLength(JSON.stringify(timerRow(s)))};const stamp={timer:{...timer,endsAtServerMs:n},serverNowMs:n,restoreGeneration:n};for(const frame of [{kind:'timer_result',requestId:randomUUID(),...stamp,cause:'extend'},{kind:'timer_state',...stamp,cause:'expire'},{kind:'timer_sample',requestId:randomUUID(),...stamp},{kind:'timer_refused',requestId:randomUUID(),reason:'timer_message_too_large',...stamp}]){assert(t.checkTimerFrame(frame,Buffer.byteLength(JSON.stringify(frame))));measure[frame.kind]=Buffer.byteLength(JSON.stringify(frame));}for(const key of ['explicit_recovery_pending','explicit_recovery_generation']){s.exec('INSERT INTO meta VALUES (?,?)',key,key.endsWith('generation')?n:1);measure[key]=Buffer.byteLength(JSON.stringify(s.all('SELECT * FROM meta WHERE key=?',key)[0]));}for(const field of ['timerTimes','timerReadTimes'])measure[field]=Buffer.byteLength(JSON.stringify({[field]:Array.from({length:5},(_,i)=>n-4+i)}));for(const value of Object.values(measure))assert(value<=1024);console.log('TIMER ENCODED SIZES '+JSON.stringify(measure));}finally{s.close();}});
unit(24,'ordinary accepted history intent restart preserves the running/paused timer',async()=>{for(const pause of [false,true]){const f=await fixture();try{const c=await f.open();await f.send(c,'start');if(pause)await f.send(c,'pause');const t=f.room.timer.snapshot(),person=await f.env.verify(),v=(await f.room.versions(person)).versions[0];const raise=f.env.raiseFence;f.env.raiseFence=async()=>{throw Error('held intent');};await assert.rejects(f.room.restoreVersion(person,v.id,{requestId:randomUUID(),expectedRevision:0,expectedGeneration:0}),/restore_pending/);assert(f.room.history.active());f.env.raiseFence=raise;f.restart();await f.room.export(person);assert.deepEqual(f.room.timer.snapshot(),t);assert.equal(f.s.all('SELECT * FROM history_intent_chunks').length,0);}finally{f.close();}}});
unit(25,'explicit marker beats real intent before resume, persists reset reservation and never resets twice',async()=>{const f=await fixture();try{const {markExplicitRecovery}=await import('../packages/board-room/src/timer.ts');const c=await f.open();await f.send(c,'start');const person=await f.env.verify(),v=(await f.room.versions(person)).versions[0];const raise=f.env.raiseFence;f.env.raiseFence=async()=>{throw Error('held intent');};await assert.rejects(f.room.restoreVersion(person,v.id,{requestId:randomUUID(),expectedRevision:0,expectedGeneration:0}),/restore_pending/);f.env.raiseFence=raise;markExplicitRecovery(f.s);let resets=0;const exec=f.s.exec.bind(f.s);f.s.exec=(sql,...args)=>{if(sql.startsWith('INSERT INTO workshop_timer'))resets++;if(sql.startsWith('INSERT INTO versions')&&args[5]==='before_restore')throw Error('after reset');exec(sql,...args);};f.restart();await assert.rejects(f.room.export(person));assert.equal(f.room.timer.snapshot().status,'idle');assert.equal(resets,1);assert(f.s.all("SELECT * FROM meta WHERE key='explicit_recovery_generation'").length);assert(f.room.history.active());await assert.rejects(f.room.export(person));assert.equal(resets,1);f.s.exec=exec;await f.room.export(person);assert.equal(f.room.timer.snapshot().status,'idle');assert.equal(f.room.history.active(),undefined);assert.equal(f.s.all("SELECT * FROM meta WHERE key LIKE 'explicit_recovery_%'").length,0);}finally{f.close();}});
unit(26,'controller freezes pending input, reads after 2s without replay and ignores tick time for speech',async()=>{const {BoardTimer}=await import('../apps/web/src/team/timer.ts');const {idleTimer}=await import(path);const old=globalThis.document,clock=controlledTimerClock();globalThis.document={visibilityState:'visible',title:'NextPhase Board',addEventListener(){},removeEventListener(){}};const reads=[],commands=[],host={snapshot:{connected:true},hideTimerPeers(){},readTimer(id){reads.push(id);return true;},sendTimer(...args){commands.push(args);return true;}};const t=new BoardTimer(host,clock.now);try{t.joined(idleTimer(),0);clock.advance(20);t.receive({kind:'timer_sample',requestId:reads[0],timer:idleTimer(),serverNowMs:100000,restoreGeneration:0});assert.equal(t.health,'ready');t.command('start');assert.equal(t.health,'checking');assert.equal(document.title,'NextPhase Board');clock.advance(2020);t.tick();assert.equal(reads.length,2);assert.equal(commands.length,1);const active={status:'running',durationMs:1000,endsAtServerMs:101000,remainingMs:null,version:1,timerId:randomUUID()};t.receive({kind:'timer_sample',requestId:reads[1],timer:active,serverNowMs:100500,restoreGeneration:0});assert.equal(t.announcement,'');clock.advance(clock.now()+2000);t.tick();assert.equal(t.announcement,'');t.receive({kind:'timer_state',timer:idleTimer(2),serverNowMs:110000,restoreGeneration:0,cause:'end'});assert.equal(t.announcement,'Timer stopped');t.receive({kind:'timer_result',requestId:commands[0][0],timer:idleTimer(2),serverNowMs:110100,restoreGeneration:0,cause:'end'});assert.equal(t.announcement,'Timer stopped');assert.equal(commands.length,1);t.disconnect();assert.equal(document.title,'NextPhase Board');t.joined(idleTimer(2),0);t.receive({kind:'timer_sample',requestId:reads.at(-1),timer:idleTimer(2),serverNowMs:110200,restoreGeneration:0});assert.equal(t.announcement,'Timer reconnected');t.receive({kind:'timer_state',timer:idleTimer(2),serverNowMs:110300,restoreGeneration:0,cause:'end'});assert.equal(t.announcement,'Timer reconnected');}finally{t.clear();clock.restore();globalThis.document=old;}});
unit(27,'late malformed timer refusal carries normalized idle state before replying',async()=>{const f=await fixture();try{const c=await f.open();await f.send(c,'start',{durationMs:1000});f.advance(3500);const r=await f.send(c,'start',{unexpected:true});assert.equal(r.reason,'timer_bad_message');assert.equal(r.timer.status,'idle');assert.equal(r.timer.version,2);assert.equal(c.messages.findLast(m=>m.kind==='timer_state').cause,'expire');}finally{f.close();}});
unit(28,'real stopped-volume marking script writes the distinct marker atomically and preserves reservation on repeat',async()=>{const {mkdtemp,mkdir,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFileSync}=await import('node:child_process');const {NodeStorage}=await import('../apps/server/src/node-storage.ts');const {initialize,setMeta}=await import('../packages/board-room/src/storage.ts');const folder=await mkdtemp(join(tmpdir(),'board-timer-marker-'));try{await mkdir(join(folder,'boards'));const file=join(folder,'boards',randomUUID()+'.sqlite'),s=new NodeStorage(file);initialize(s);setMeta(s,'restore_pending',1);setMeta(s,'explicit_recovery_generation',37);s.close();const script=new URL('../apps/server/scripts/mark-restored-volume.mjs',import.meta.url);for(let i=0;i<2;i++)execFileSync(process.execPath,[script.pathname,folder],{stdio:'pipe'});const reopened=new NodeStorage(file);try{const rows=reopened.all('SELECT * FROM meta'),value=key=>rows.find(r=>r.key===key)?.value;assert.equal(value('explicit_recovery_pending'),1);assert.equal(value('restore_pending'),1);assert.equal(value('explicit_recovery_generation'),37);}finally{reopened.close();}}finally{await rm(folder,{recursive:true,force:true});}});
unit(29,'timer deadlines share the earliest scheduler with existing presence and history work',async()=>{const f=await fixture();try{let next;f.env.schedule=async at=>{next=at;};const c=await f.open();await f.send(c,'start');assert.equal(next,130000);await f.send(c,'end');f.advance(1001);await f.send(c,'start',{durationMs:1000});const end=f.room.timer.snapshot().endsAtServerMs;assert.equal(next,end);f.now(end);await f.room.alarm();assert.equal(next,end+2500);f.now(end+2500);await f.room.alarm();assert.equal(f.room.timer.snapshot().status,'idle');}finally{f.close();}});
unit(30,'joining before expiry cues the future zero once; joining at zero never replays motion',async()=>{const {BoardTimer}=await import('../apps/web/src/team/timer.ts');const old=globalThis.document;globalThis.document={visibilityState:'visible',title:'NextPhase Board',addEventListener(){},removeEventListener(){}};try{for(const late of [false,true]){let mono=0;const reads=[],host={snapshot:{connected:true},readTimer(id){reads.push(id);return true;},sendTimer(){return true;},hideTimerPeers(){}};const t=new BoardTimer(host,()=>mono),snapshot={status:'running',durationMs:1000,endsAtServerMs:101000,remainingMs:null,version:1,timerId:randomUUID()};try{t.joined(snapshot,0);t.receive({kind:'timer_sample',requestId:reads[0],timer:snapshot,serverNowMs:late?101000:100000,restoreGeneration:0});mono=1000;t.tick();assert.equal(t.shake,late?0:1);t.tick();assert.equal(t.shake,late?0:1);}finally{t.clear();}}}finally{globalThis.document=old;}});

// Exercise the production Worker entry/guard against two independent SQLite
// stores. This is adapter unit proof, not hosted provider PITR execution.
async function workerRecoveryFixture() {
  const {BoardRoom,RestoreFence}=await import('../apps/server/src/worker.ts');
  const {NodeStorage}=await import('../apps/server/src/node-storage.ts');
  const f=await fixture(),independent=new NodeStorage(':memory:');
  independent.exec('CREATE TABLE test_kv (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const fault={kv:false,read:false};
  const storage={
    sql:{exec(sql,...bindings){const rows=/^\s*(SELECT|PRAGMA)\b/i.test(sql)?independent.all(sql,...bindings):(independent.exec(sql,...bindings),[]);return {toArray:()=>rows};}},
    kv:{get(key){const row=independent.all('SELECT value FROM test_kv WHERE key=?',key)[0];return row?JSON.parse(row.value):undefined;},put(key,value){if(fault.kv)throw Error('signal write');independent.exec('INSERT INTO test_kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value));}},
    transactionSync:run=>independent.transaction(run),
  };
  let fence=new RestoreFence({storage});
  const call=async(path='read')=>{if(fault.read)throw Error('fence read');return fence.fetch(new Request('http://fence/'+path,{method:'POST'}));};
  const read=async()=>{const response=await call();assert.equal(response.status,200);return response.json();};
  f.env.fence=async()=>(await read()).generation;
  f.env.raiseFence=async(minimum=0)=>{let value;do{const response=await call('raise');assert.equal(response.status,200);value=(await response.json()).generation;}while(value<=minimum);return value;};
  const env={FENCES:{idFromName:board=>board,get:()=>({fetch:(url,init)=>call(new URL(url).pathname.slice(1))})}};
  const roomStorage={sql:{exec(sql,...bindings){return {toArray:()=>f.s.all(sql,...bindings)};}}};
  class Adapter extends BoardRoom {environment(){return f.env;}}
  const adapter=()=>new Adapter({storage:roomStorage},env);
  return {...f,independent,storage,roomStorage,fault,call,read,adapter,reopenFence(){fence=new RestoreFence({storage});},close(){f.close();independent.close();}};
}
unit(31,'independent Worker fence atomically retains only explicit recovery generations and refuses overflow',async()=>{
  const f=await workerRecoveryFixture();try{
    assert.deepEqual(await f.read(),{generation:0,recoveryGeneration:0});
    assert.equal((await f.call('raise')).status,200);assert.deepEqual(await f.read(),{generation:1,recoveryGeneration:0});
    f.fault.kv=true;assert.equal((await f.call('recover')).status,503);f.fault.kv=false;
    assert.deepEqual(await f.read(),{generation:1,recoveryGeneration:0});
    assert.equal((await f.call('recover')).status,200);f.reopenFence();assert.deepEqual(await f.read(),{generation:2,recoveryGeneration:2});
    await f.call('raise');assert.deepEqual(await f.read(),{generation:3,recoveryGeneration:2});
    f.independent.exec('UPDATE fence SET generation=?',Number.MAX_SAFE_INTEGER);
    for(const path of ['raise','recover'])assert.equal((await f.call(path)).status,503);
    assert.deepEqual(await f.read(),{generation:Number.MAX_SAFE_INTEGER,recoveryGeneration:2});
    f.storage.kv.put('time_recovery_generation',null);assert.equal((await f.call()).status,503);
  }finally{f.close();}
});
for(const paused of [false,true])unit(paused?33:32,`Worker startup detects retained recovery before ${paused?'paused':'running'} timer/history resume and retries without another reset`,async()=>{
  const f=await workerRecoveryFixture();try{
    const c=await f.open();await f.send(c,'start');if(paused)await f.send(c,'pause');
    const person=await f.env.verify(),version=(await f.room.versions(person)).versions[0],raise=f.env.raiseFence;
    f.env.raiseFence=async()=>{throw Error('held intent');};
    await assert.rejects(f.room.restoreVersion(person,version.id,{requestId:randomUUID(),expectedRevision:0,expectedGeneration:0}),/restore_pending/);
    f.env.raiseFence=raise;
    const intentBefore=f.room.history.active(),chunks=f.s.all('SELECT * FROM history_intent_chunks');assert(chunks.length);
    // The room copy has no marker: only the independent object survives rewind.
    assert.equal(f.s.all("SELECT * FROM meta WHERE key='explicit_recovery_pending'").length,0);
    const signal=await(await f.call('recover')).json();f.reopenFence();
    f.env.mentions={documentGeneration:async()=>7,mentionGeneration:async()=>9,carryNotices:async()=>{},clearNotices:async()=>{},project:async()=>{},roster:async()=>[],validTargets:async()=>[]};
    let resets=0,failLocal=true;const execute=f.s.exec.bind(f.s);
    f.s.exec=(sql,...args)=>{if(sql.startsWith('INSERT INTO workshop_timer'))resets++;if(failLocal&&sql.startsWith('INSERT INTO versions')&&args[5]==='before_restore')throw Error('after reservation');execute(sql,...args);};
    const first=await f.adapter().getRoom(f.board);
    assert.equal(JSON.parse(first.history.active().result).phase,'intent');assert.equal(first.history.active().result,intentBefore.result);
    assert.equal(f.s.all("SELECT value FROM meta WHERE key='explicit_recovery_pending'")[0].value,1);
    await assert.rejects(first.export(person));assert.equal(first.timer.snapshot().status,'idle');assert.equal(resets,1);
    assert.deepEqual(f.s.all('SELECT * FROM history_intent_chunks'),chunks);
    const reserved=Number(f.s.all("SELECT value FROM meta WHERE key='explicit_recovery_generation'")[0].value);
    assert(reserved>Math.max(signal.generation,7,9));assert(first.access.locked);
    const retry=await f.adapter().getRoom(f.board);await assert.rejects(retry.export(person));assert.equal(resets,1);
    failLocal=false;f.offline(true);await assert.rejects(retry.export(person));assert.equal(resets,1);
    assert(retry.access.locked);assert(f.s.all("SELECT * FROM meta WHERE key='explicit_recovery_pending'").length);
    f.offline(false);const completed=await f.adapter().getRoom(f.board);await completed.export(person);
    assert.equal(completed.timer.snapshot().status,'idle');assert.equal(completed.timer.snapshot().version,0);assert.equal(resets,1);
    assert.equal(completed.history.active(),undefined);assert.equal(f.s.all('SELECT * FROM history_intent_chunks').length,0);
    assert.equal(f.s.all("SELECT * FROM meta WHERE key LIKE 'explicit_recovery_%'").length,0);
    assert.equal(f.s.all('SELECT * FROM versions').length,3);
  }finally{f.close();}
});
unit(34,'ordinary Worker fence raise with an accepted history intent preserves its live timer',async()=>{
  const f=await workerRecoveryFixture();try{
    const c=await f.open();await f.send(c,'start');await f.send(c,'pause');const timer=f.room.timer.snapshot();
    const person=await f.env.verify(),version=(await f.room.versions(person)).versions[0],raise=f.env.raiseFence;
    f.env.raiseFence=async()=>{throw Error('intent');};await assert.rejects(f.room.restoreVersion(person,version.id,{requestId:randomUUID(),expectedRevision:0,expectedGeneration:0}),/restore_pending/);f.env.raiseFence=raise;
    await f.call('raise');const room=await f.adapter().getRoom(f.board);await room.export(person);
    assert.deepEqual(room.timer.snapshot(),timer);assert.equal((await f.read()).recoveryGeneration,0);
  }finally{f.close();}
});
unit(35,'Worker time entry persists the independent signal before provider scheduling and acknowledged signals do not reset new timers',async()=>{
  const f=await workerRecoveryFixture();try{
    await f.open();let scheduled=false;
    f.roomStorage.onNextSessionRestoreBookmark=async bookmark=>{assert.equal(bookmark,'synthetic-bookmark');const signal=await f.read();assert(signal.recoveryGeneration>0);assert.equal(f.s.all("SELECT value FROM meta WHERE key='explicit_recovery_pending'")[0].value,1);scheduled=true;return 'synthetic-undo';};
    const adapter=f.adapter(),response=await adapter.fetch(new Request('http://room/restore-to-time',{method:'POST',body:JSON.stringify({board:f.board,value:'synthetic-bookmark'})}));
    assert.equal(response.status,200);assert(scheduled);const result=await response.json();assert.equal(result.undoBookmark,'synthetic-undo');
    const room=await adapter.getRoom(f.board);await room.export(await f.env.verify());
    const {writeTimer}=await import('../packages/board-room/src/timer.ts');
    const next={status:'paused',durationMs:180000,endsAtServerMs:null,remainingMs:123456,version:17,timerId:randomUUID()};writeTimer(f.s,next,null);
    const reopened=await f.adapter().getRoom(f.board);await reopened.export(await f.env.verify());assert.deepEqual(reopened.timer.snapshot(),next);
  }finally{f.close();}
});

function controlledTimerClock() {
  const saved=Object.fromEntries(['setTimeout','clearTimeout','setInterval','clearInterval','document'].map(key=>[key,globalThis[key]]));
  let now=0,sequence=0;const tasks=new Map();
  const after=(run,delay,interval=0)=>{const id=++sequence;tasks.set(id,{run,at:now+delay,interval});return id;};
  globalThis.setTimeout=(run,delay)=>after(run,delay);
  globalThis.setInterval=(run,delay)=>after(run,delay,delay);
  globalThis.clearTimeout=globalThis.clearInterval=id=>tasks.delete(id);
  globalThis.document={visibilityState:'visible',title:'NextPhase Board',body:{},addEventListener(){},removeEventListener(){}};
  return {now:()=>now,tasks,advance(to){
    assert(to>=now);
    for(;;){const next=[...tasks].filter(([,task])=>task.at<=to).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;
      const [id,task]=next;now=task.at;if(task.interval)task.at+=task.interval;else tasks.delete(id);task.run();}
    now=to;
  },restore(){Object.assign(globalThis,saved);}};
}
unit(36,'unanswered mutation reads at exactly 2000ms off the display cadence and never replays',async()=>{
  const {BoardTimer}=await import('../apps/web/src/team/timer.ts'),{idleTimer}=await import(path),clock=controlledTimerClock();
  const reads=[],commands=[],host={snapshot:{connected:true},hideTimerPeers(){},readTimer(id){reads.push({id,at:clock.now()});return true;},sendTimer(...args){commands.push(args);return true;}};
  const t=new BoardTimer(host,clock.now);
  try{
    t.joined(idleTimer(),0);clock.advance(13);t.receive({kind:'timer_sample',requestId:reads[0].id,timer:idleTimer(),serverNowMs:100000,restoreGeneration:0});
    clock.advance(60);t.command('start');clock.advance(2059);assert.equal(reads.length,1);assert.equal(t.health,'checking');
    clock.advance(2060);assert.equal(reads.length,2);assert.equal(reads[1].at,2060);assert.equal(commands.length,1);
    clock.advance(2080);t.receive({kind:'timer_sample',requestId:reads[1].id,timer:idleTimer(),serverNowMs:102000,restoreGeneration:0});
    assert.equal(t.health,'ready');clock.advance(5000);assert.equal(reads.length,2);assert.equal(commands.length,1);
    t.command('start');clock.advance(6999);assert.equal(reads.length,2);clock.advance(7000);assert.equal(reads.length,3);
    clock.advance(8999);assert.equal(t.health,'checking');clock.advance(9000);assert.equal(t.health,'disconnected');assert.equal(commands.length,2);
    t.clear();assert.equal(clock.tasks.size,0);
  }finally{t.clear();clock.restore();}
});
unit(37,'sample cadence and clock-health deadline are scheduled exactly and cancelled on clear',async()=>{
  const {BoardTimer}=await import('../apps/web/src/team/timer.ts'),{idleTimer}=await import(path),clock=controlledTimerClock();
  const reads=[],host={snapshot:{connected:true},hideTimerPeers(){},readTimer(id){reads.push({id,at:clock.now()});return true;},sendTimer(){return true;}};
  const t=new BoardTimer(host,clock.now);
  try{
    t.joined(idleTimer(),0);clock.advance(13);t.receive({kind:'timer_sample',requestId:reads[0].id,timer:idleTimer(),serverNowMs:100000,restoreGeneration:0});
    clock.advance(14999);assert.equal(reads.length,1);clock.advance(15000);assert.equal(reads[1].at,15000);
    clock.advance(15017);t.receive({kind:'timer_sample',requestId:reads[1].id,timer:idleTimer(),serverNowMs:115000,restoreGeneration:0});
    host.snapshot.connected=false;clock.advance(45016);assert.equal(t.health,'ready');clock.advance(45017);assert.equal(t.health,'disconnected');
    t.clear();assert.equal(clock.tasks.size,0);clock.advance(100000);assert.equal(reads.length,2);
  }finally{t.clear();clock.restore();}
});

// Drive the real component's layout effects and native props at the DOM seam.
// Reuse a focused Cancel button as +1, as React may do for the unkeyed card rows.
async function timerPanelHarness() {
  const {build}=await import('esbuild'),{fileURLToPath,pathToFileURL}=await import('node:url');
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
  const result=await build({stdin:{contents:"export {TimerControl} from './apps/web/src/team/timer-panel.tsx';export {render,commit} from 'timer-focus-hooks';",resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{name:'timer-focus-ports',setup(b){
    b.onResolve({filter:/^(react|timer-focus-hooks)$/},args=>args.path==='timer-focus-hooks'||args.importer.endsWith('/team/timer-panel.tsx')?{path:'hooks',namespace:'timer-focus'}:undefined);
    b.onLoad({filter:/.*/,namespace:'timer-focus'},()=>({contents:`let refs=[],index=0,effects=[];export const useRef=value=>refs[index++]??=( {current:value} );export const useState=value=>[value,()=>{}];export const useEffect=()=>{};export const useLayoutEffect=run=>effects.push(run);export function render(component,props){index=0;effects=[];return component(props);}export function commit(){for(const run of effects)run();}`,loader:'js'}));
  }}]});
  const folder=await mkdtemp(join(tmpdir(),'board-timer-focus-')),file=join(folder,'panel.mjs');await writeFile(file,result.outputFiles[0].text);
  const mod=await import(pathToFileURL(file).href),doc=globalThis.document;
  let tree,nodes=[],elements=[],pool=new Map(),panel;
  const walk=(node)=>Array.isArray(node)?node.flatMap(walk):node&&typeof node==='object'&&node.props?[node,...walk(node.props.children)]:[];
  const key=node=>node.props['data-timer']??node.props['aria-label']??node.props.id;
  const control=(element)=>({props:element.props,tagName:element.type.toUpperCase(),isConnected:true,disabled:!!element.props.disabled,tabIndex:element.props.tabIndex??0,
    getAttribute(name){return this.props[name]??null;},closest(){return null;},focus(){doc.activeElement=this;panel?.props.onFocusCapture({target:this});}});
  const root={contains:node=>nodes.includes(node),querySelector(selector){return nodes.find(n=>selector==='[data-timer="heading"]'?n.props['data-timer']==='heading':selector==='[data-timer="toggle"]'?n.props['data-timer']==='toggle':selector==='[data-timer="cancel"]'?n.props['data-timer']==='cancel':selector==='[aria-label="Minutes"]'?n.props['aria-label']==='Minutes':n.props['aria-label']==='End timer');}};
  return {render(timer,{reuseCancel=false,voting}={}){
    const cancel=pool.get('cancel'),activeWasControl=nodes.includes(doc.activeElement);for(const node of nodes)node.isConnected=false;
    tree=mod.render(mod.TimerControl,{timer,voting});elements=walk(tree);panel=elements.find(n=>n.props.id==='w1-panel');
    nodes=elements.filter(n=>['button','input','h2','h3'].includes(n.type)).map(element=>{
      const id=key(element)??(element.props.className==='w1-add'?'add':element.props.children==='Stop timer'?'stop':undefined);
      const node=reuseCancel&&element.props.className==='w1-add'?cancel:pool.get(id)??control(element);
      Object.assign(node,{props:element.props,isConnected:true,disabled:!!element.props.disabled,tabIndex:element.props.tabIndex??0});pool.set(id,node);if(element.props.ref)element.props.ref.current=node;return node;
    });
    if(panel)panel.props.ref.current=root;
    if(activeWasControl&&!nodes.includes(doc.activeElement))doc.activeElement=doc.body;
    mod.commit();return elements;
  },get(label){return nodes.find(n=>n.props['aria-label']===label||n.props['data-timer']===label||n.props.children===label||n.props['data-timer']==='heading'&&label==='heading');},
  outside(node){panel.props.onBlurCapture({relatedTarget:node,currentTarget:root});doc.activeElement=node;},async close(){await rm(folder,{recursive:true,force:true});}};
}
unit(38,'joined with its first sample held shows Connecting timer, heading focus and only Close enabled',async()=>{
  const {BoardTimer}=await import('../apps/web/src/team/timer.ts'),{idleTimer}=await import(path),clock=controlledTimerClock();
  const reads=[],host={snapshot:{connected:true},hideTimerPeers(){},readTimer(id){reads.push(id);return true;},sendTimer(){throw Error('No mutation before sample');}};
  const t=new BoardTimer(host,clock.now),h=await timerPanelHarness();
  try{
    t.joined(idleTimer(),0);t.show();const elements=h.render(t);
    assert.equal(t.display,'--:--');assert.equal(t.status,'Connecting timer…');assert.equal(document.title,'NextPhase Board');
    assert.equal(h.get('Timer and voting, Connecting timer').props['aria-expanded'],true);assert.equal(document.activeElement,h.get('heading'));
    const panel=elements.find(n=>n.props.id==='w1-panel'),inside=elements.slice(elements.indexOf(panel)+1);
    assert.deepEqual(inside.filter(n=>n.type==='button'&&!n.props.disabled).map(n=>n.props['aria-label']),['Close Timer and voting']);
    for(const input of inside.filter(n=>n.type==='input')){assert.equal(input.props.readOnly,true);assert.equal(input.props.tabIndex,-1);assert.equal(input.props.value,'--');}
    t.command('start');clock.advance(23);t.receive({kind:'timer_sample',requestId:reads[0],timer:idleTimer(),serverNowMs:100000,restoreGeneration:0});h.render(t);
    assert.equal(t.health,'ready');assert.equal(t.display,'03:00');assert.equal(document.activeElement,h.get('heading'));
  }finally{t.clear();await h.close();clock.restore();}
});
unit(39,'remote confirmation changes fall back from reused Cancel or removed Stop, preserve matching controls and leave canvas focus alone',async()=>{
  const {BoardTimer}=await import('../apps/web/src/team/timer.ts'),{idleTimer}=await import(path),clock=controlledTimerClock();
  const reads=[],host={snapshot:{connected:true},hideTimerPeers(){},readTimer(id){reads.push(id);return true;},sendTimer(){throw Error('Remote transitions send no command');}};
  const t=new BoardTimer(host,clock.now),h=await timerPanelHarness(),running={status:'running',durationMs:180000,endsAtServerMs:280000,remainingMs:null,version:1,timerId:randomUUID()};
  try{
    for(const cause of ['pause','extend','end','start']){
      t.clear();h.render(t);t.joined(running,0);t.receive({kind:'timer_sample',requestId:reads.at(-1),timer:running,serverNowMs:100000,restoreGeneration:0});t.show();h.render(t);t.confirm();h.render(t);
      const cancel=h.get('cancel');assert.equal(document.activeElement,cancel);
      const next=cause==='end'?idleTimer(2):{...running,version:2,...(cause==='pause'?{status:'paused',endsAtServerMs:null,remainingMs:180000}:cause==='start'?{timerId:randomUUID()}:{endsAtServerMs:340000})};
      t.receive({kind:'timer_state',timer:next,serverNowMs:100000,restoreGeneration:0,cause});assert.equal(t.confirmation,null);h.render(t,{reuseCancel:true});
      assert.equal(cancel.isConnected,true);assert.equal(cancel.props.className,'w1-add');assert.equal(document.activeElement,h.get('heading'),cause+' must not retain Cancel as +1');
    }
    t.receive({kind:'timer_state',timer:{...running,version:3},serverNowMs:100000,restoreGeneration:0,cause:'start'});h.render(t);t.confirm();h.render(t);
    const stop=h.get('Stop timer');stop.focus(); // A removed confirmation control falls to the heading too.
    t.receive({kind:'timer_state',timer:{...running,version:4},serverNowMs:100000,restoreGeneration:0,cause:'extend'});h.render(t);assert.equal(document.activeElement,h.get('heading'));
    const close=h.get('Close Timer and voting');close.focus();t.receive({kind:'timer_state',timer:{...running,version:5},serverNowMs:100000,restoreGeneration:0,cause:'extend'});h.render(t);assert.equal(document.activeElement,close);
    const toggle=h.get('Pause timer');toggle.focus();t.receive({kind:'timer_state',timer:{...running,status:'paused',endsAtServerMs:null,remainingMs:180000,version:6},serverNowMs:100000,restoreGeneration:0,cause:'pause'});h.render(t);assert.equal(document.activeElement,toggle);assert.equal(toggle.props['aria-label'],'Resume timer');
    const canvas={};h.outside(canvas);t.receive({kind:'timer_state',timer:idleTimer(7),serverNowMs:100000,restoreGeneration:0,cause:'end'});h.render(t);assert.equal(document.activeElement,canvas);
  }finally{t.clear();await h.close();clock.restore();}
});
unit(40,'zero and zero-window read use their monotonic deadlines independently of display ticks',async()=>{
  const {BoardTimer}=await import('../apps/web/src/team/timer.ts'),clock=controlledTimerClock();
  const reads=[],host={snapshot:{connected:true},hideTimerPeers(){},readTimer(id){reads.push({id,at:clock.now()});return true;},sendTimer(){return true;}};
  const t=new BoardTimer(host,clock.now),running={status:'running',durationMs:1000,endsAtServerMs:101000,remainingMs:null,version:1,timerId:randomUUID()};
  try{
    t.joined(running,0);clock.advance(26);t.receive({kind:'timer_sample',requestId:reads[0].id,timer:running,serverNowMs:100000,restoreGeneration:0});
    clock.advance(1012);assert.equal(t.shake,0);clock.advance(1013);assert.equal(t.shake,1);assert.equal(t.display,'00:00');
    clock.advance(3512);assert.equal(reads.length,1);clock.advance(3513);assert.equal(reads[1].at,3513);assert.equal(t.announcement,'');
    t.receive({kind:'timer_sample',requestId:reads[1].id,timer:{...running,status:'paused',endsAtServerMs:null,remainingMs:1000,version:2},serverNowMs:103500,restoreGeneration:0});
    clock.advance(10000);assert.equal(reads.length,2);assert.equal(t.shake,1);t.clear();assert.equal(clock.tasks.size,0);
  }finally{t.clear();clock.restore();}
});
unit(41,'shared-panel repaints keep extension disabled throughout displayed 99:59 without changing idle clamp',async()=>{
  const {BoardTimer}=await import('../apps/web/src/team/timer.ts'),{idleTimer}=await import(path),clock=controlledTimerClock();
  const reads=[],commands=[],host={snapshot:{connected:true},hideTimerPeers(){},readTimer(id){reads.push(id);return true;},sendTimer(...args){commands.push(args);return true;}};
  const timer=new BoardTimer(host,clock.now),h=await timerPanelHarness(),voting={running:false,announcement:'',announcementId:0};
  const running={status:'running',durationMs:5999000,endsAtServerMs:6099000,remainingMs:null,version:1,timerId:randomUUID()};
  try{
    timer.joined(running,0);timer.receive({kind:'timer_sample',requestId:reads[0],timer:running,serverNowMs:100000,restoreGeneration:0});timer.show();
    for(const elapsed of [0,1,500,999]){
      clock.advance(elapsed);voting.running=!voting.running;h.render(timer,{voting});
      assert.equal(h.get('Minutes').props.value,'99');assert.equal(h.get('Seconds').props.value,'59');
      assert.equal(h.get('add').disabled,true,`voting repaint at ${elapsed}ms must retain the visible cap`);
      assert.equal(h.get('Pause timer').disabled,false);assert.equal(h.get('End timer').disabled,false);
      assert.deepEqual(timer.snapshot,running);assert.equal(timer.remaining,5999000-elapsed);
    }
    clock.advance(1000);h.render(timer,{voting});assert.equal(h.get('Seconds').props.value,'58');assert.equal(h.get('add').disabled,false);
    const paused={...running,status:'paused',endsAtServerMs:null,remainingMs:5998500,version:2};
    timer.receive({kind:'timer_state',timer:paused,serverNowMs:101000,restoreGeneration:0,cause:'pause'});h.render(timer,{voting});
    assert.equal(h.get('Seconds').props.value,'59');assert.equal(h.get('add').disabled,true);assert.equal(h.get('Resume timer').disabled,false);
    timer.receive({kind:'timer_state',timer:idleTimer(3),serverNowMs:101000,restoreGeneration:0,cause:'end'});
    timer.setDraft('minutes','99');timer.setDraft('seconds','30');h.render(timer,{voting});
    assert.equal(h.get('add').disabled,false);h.get('add').props.onClick();h.render(timer,{voting});
    assert.deepEqual(timer.draft,{minutes:'99',seconds:'59'});assert.equal(h.get('add').disabled,false);assert.equal(commands.length,0);
  }finally{timer.clear();await h.close();clock.restore();}
});
