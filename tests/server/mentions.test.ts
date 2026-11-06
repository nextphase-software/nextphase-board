// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from 'vitest';
import assert from 'node:assert/strict';
import { makeDriver } from 'board-test-driver';
import type { Context,Driver,Peer } from './driver-types.ts';
const context=inject<Context>('board'),runner=inject<string>('runner');let driver:Driver,f:any,pass=0,fail=0;const peers:Peer[]=[],measures:any={};
beforeAll(async()=>{driver=await makeDriver(context);});
afterEach(async()=>{for(const p of peers.splice(0))await p.close();await helper('proxy',{rpc:'project_mentions',fail:false,failAfter:false,hold:false,holdBefore:false,release:'project_mentions'});await driver.control({fixedNow:null});await driver.control({fenceUnreadable:false});if(runner==='node')await driver.control({failCheckpoint:''});await helper('proxy',{rpc:'clear_board_mentions',release:'clear_board_mentions'});await helper('proxy',{rpc:'copy_saved_board',fail:false});});
afterAll(async()=>{await driver.close();console.log('SUMMARY-MENTIONS '+JSON.stringify({runner,pass,fail,measures}));});
async function helper(action:string,value:unknown={}):Promise<any>{const r=await fetch(context.helperUrl+'/'+action,{method:'POST',body:JSON.stringify(value)});assert.equal(r.status,200,await r.clone().text());return r.json();}
const rpc=(name:string,parameters:object)=>helper('rpc',{name,parameters});
async function req(path:string,name='owner',method='GET',body?:unknown){return driver.request(path,{method,headers:{Authorization:'Bearer '+f.people[name].token,Origin:context.origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function ok(path:string,name='owner',method='GET',body?:unknown,status=200){const r=await req(path,name,method,body);assert.equal(r.status,status,await r.clone().text());return status===204?null:r.json() as Promise<any>;}
async function until(fn:()=>any,predicate=(v:any)=>!!v,ms=10000){const end=Date.now()+ms;let value;do{value=await fn();if(predicate(value))return value;await new Promise(r=>setTimeout(r,10));}while(Date.now()<end);assert.fail('Condition timed out '+JSON.stringify(value));}
const check=(id:number,name:string,run:()=>Promise<void>)=>test.skipIf(id===168&&runner!=='node')(`S${id} ${name}`,async()=>{try{f=await helper('removal-fixture');await run();pass++;console.log(`PASS: S${id} ${name}`);}catch(e){fail++;console.log(`FAIL: S${id} ${name}`);throw e;}});
async function roster(name='owner'){return(await ok(`/boards/${f.a}/participants`,name)).candidates;}
async function peer(name='editor',board=f.a){const t=await ok(`/boards/${board}/join-tickets`,name,'POST',undefined,201);const p=await driver.connect(`/boards/${board}/join?ticket=${t.ticket}`);peers.push(p);const joined=await p.next('joined');await until(()=>p.messages.some(m=>m.kind==='comments_snapshot'&&m.done));return {p,joined,name};}
const start=(text='Plain',mentions:any[]=[])=>({action:'start',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),anchor:{objectId:null,u:0,v:0,x:0,y:0},text,mentions});
async function action(c:Awaited<ReturnType<typeof peer>>,operation:any,reason?:string,id=crypto.randomUUID()){
 const offset=c.p.messages.length;const message={kind:'comment',epoch:c.joined.epoch,restoreGeneration:c.joined.restoreGeneration,requestId:id,operation};c.p.send(message);
 const answer=await until(()=>c.p.messages.slice(offset).find(m=>m.requestId===id&&['comment_saved','comment_refused'].includes(m.kind)));
 assert.equal(answer.kind,reason?'comment_refused':'comment_saved',JSON.stringify(answer));if(reason)assert.equal(answer.reason,reason);return {id,message,answer};
}
async function mention(name='editor',labelName='viewer') {const people=await roster(name),person=await personKey(f.a,f.people[labelName].id),target=people.find((p:any)=>p.person===person);assert(target,'permitted target');const text='@'+target.label;return{text,mentions:[{start:0,end:[...text].length,person:target.person,label:target.label}]};}
async function personKey(board:string,id:string){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`presence:${board}:${id}`));
 return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('').slice(0,32);
}
async function notices(name='viewer'){return(await ok('/notifications',name)).notices;}
async function deliver(){await driver.control({board:f.a,deliverMentions:true});}
async function rows(table:string){return driver.rows(f.a,table);}
async function snapshot(){const source:any={};for(const table of ['threads','comments','receipts','comment_counts','comment_ids','mention_targets','mention_pending'])source[table]=await rows(table);source.sequence=(await rows('meta')).find(r=>r.key==='comment_sequence');source.inbox=await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}});return JSON.stringify(source);}
const operator=(path:string,body?:any)=>driver.request(`/operator/boards/${f.a}/${path}`,{method:'POST',headers:{'Board-Operator-Key':context.operatorKey,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
check(143,'effective-role roster includes offline people, excludes guests/pending/disabled/outsiders and pages every candidate',async()=>{
 await rpc('write_board_grant',{board:f.a,person:f.people.plain.id,role:'viewer'});
 assert.equal((await roster()).length,5);const guest=await roster('granted');assert.equal(guest.length,4);assert(!guest.some((p:any)=>p.label===f.people.plain.email.split('@')[0]));
 assert.equal((await req(`/boards/${f.a}/participants`,'outsider')).status,404);
 for(const name of ['owner','editor','viewer','granted']){const c=await peer(name);assert.equal(typeof c.joined.restoreGeneration,'number');assert(!Object.hasOwn(c.joined,'capabilities'));}
 const extras:any[]=[];for(let i=0;i<3;i++)extras.push(...Object.values((await helper('removal-fixture')).people));
 for(const person of extras.slice(0,17))await rpc('write_board_grant',{board:f.a,person:person.id,role:'viewer'});
 await rpc('disable_person',{person:extras[16].id});await rpc('create_invitation',{workspace:f.workspace,board:null,email:extras[17].email,role:'viewer',by:f.people.owner.id});
 const first=await ok(`/boards/${f.a}/participants`),second=await ok(`/boards/${f.a}/participants?page=1`),all=[...first.candidates,...second.candidates];assert.equal(first.candidates.length,20);assert.equal(first.more,true);assert.equal(second.candidates.length,1);assert.equal(second.more,false);assert.equal(new Set(all.map(p=>p.person)).size,21);
 for(const p of all)assert.deepEqual(Object.keys(p).sort(),['label','person','suffix']);
 assert(!JSON.stringify(all).includes('@'));assert(!JSON.stringify(all).includes(f.people.viewer.id));assert.equal((await roster('granted')).length,4);
});
check(144,'registered labels, duplicate suffixes and 256-byte exclusion do not disclose accounts',async()=>{
 for(const name of ['editor','viewer'])await rpc('remember_person',{person:f.people[name].id,email:`alex@${name}.example.com`});
 const candidates=await roster();const dup=candidates.filter((p:any)=>p.label==='alex');assert.equal(dup.length,2);assert(dup.every((p:any)=>p.suffix.length>=8));assert.notEqual(dup[0].suffix,dup[1].suffix);assert(dup.every((p:any)=>p.suffix===p.person.slice(0,p.suffix.length)));assert.deepEqual((await ok(`/boards/${f.a}/participants?q=ALEx`)).candidates,dup);
 await rpc('remember_person',{person:f.people.viewer.id,email:'x'.repeat(257)+'@example.com'});assert(!(await roster()).some((p:any)=>p.label.length===257));await rpc('remember_person',{person:f.people.viewer.id,email:'@example.test'});assert(!(await roster()).some((p:any)=>p.label===''));await rpc('remember_person',{person:f.people.viewer.id,email:'é'.repeat(128)+'@example.test'});assert((await roster()).some((p:any)=>p.label==='é'.repeat(128)));
});
check(145,'stale new targets refuse start/reply/edit atomically; historical ranges remain allowed',async()=>{
 const c=await peer(),m=await mention(),plain=start('Plain root');await action(c,plain);
 await rpc('write_member_role',{workspace:f.workspace,person:f.people.viewer.id,role:'guest'});const before=await snapshot();
 for(const operation of [start(m.text,m.mentions),{action:'reply',threadId:plain.threadId,commentId:crypto.randomUUID(),...m},{action:'edit',threadId:plain.threadId,commentId:plain.commentId,...m}]){await action(c,operation,'mention_unavailable');assert.equal(await snapshot(),before);}
 const hidden=start('@hidden',[{start:0,end:7,person:'f'.repeat(32),label:'hidden'}]);await action(c,hidden,'mention_unavailable');assert.equal(await snapshot(),before);
 await rpc('write_board_grant',{board:f.a,person:f.people.viewer.id,role:'viewer'});const historical=start(m.text,m.mentions);await action(c,historical);await deliver();await rpc('remove_grant',{board:f.a,person:f.people.viewer.id});
 await action(c,{action:'edit',threadId:historical.threadId,commentId:historical.commentId,text:'😀 '+m.text,mentions:m.mentions.map((r:any)=>({...r,start:r.start+2,end:r.end+2}))});await deliver();assert.equal((await notices()).length,0);
});
check(146,'current wire, non-BMP ranges and persisted JSON remain exact across restart',async()=>{
 await rpc('remember_person',{person:f.people.viewer.id,email:'ben@example.test'});
 const c=await peer(),other=await peer('viewer'),m=await mention(),op=start('😀 '+m.text,m.mentions.map((r:any)=>({...r,start:2,end:r.end+2})));await action(c,op);await deliver();
 assert.equal(op.mentions[0].start,2);assert.equal(op.mentions[0].end,6);
 assert.deepEqual(JSON.parse(String((await rows('comments'))[0].mentions)),op.mentions);
 for(const client of [c,other])assert.deepEqual(client.p.messages.find(m=>m.commentId===op.commentId)?.comment.mentions,op.mentions);
 await driver.wake(f.a);const reopened=await peer();assert.deepEqual(reopened.p.messages.find(m=>m.commentId===op.commentId)?.comment.mentions,op.mentions);
 const plain=start('Plain');delete (plain as any).mentions;await action(reopened,plain);assert.deepEqual(JSON.parse(String((await rows('comments')).find(r=>r.id===plain.commentId).mentions)),[]);
});
check(147,'current protocol exposes ranges without negotiation and rejects null or malformed metadata',async()=>{
 const c=await peer(),m=await mention();assert(!Object.hasOwn(c.joined,'capabilities'));await action(c,start(m.text,m.mentions));
 for(const mentions of [null,{},[{...m.mentions[0],extra:true}]])await action(c,{...start(m.text),mentions},'bad_mentions');
 const reopened=await peer('viewer');assert.deepEqual(reopened.p.messages.find(m=>m.comment)?.comment.mentions,m.mentions);
});
check(148,'overlapping refusals preserve access, restore, receipt, text, author, mention and anchor order',async()=>{
 const c=await peer(),m=await mention(),op=start('Root');const saved=await action(c,op);
 const malformed={...start(m.text),mentions:null,anchor:{x:Infinity}};
 await action({...c,joined:{...c.joined,epoch:c.joined.epoch+1}},malformed,'epoch_changed');
 await action({...c,joined:{...c.joined,restoreGeneration:c.joined.restoreGeneration+1}},malformed,'restore_changed');
 await action(c,malformed,'request_id_reused',saved.id);
 await action(c,{...malformed,text:' '},'empty_text');
 await action(c,{action:'edit',threadId:crypto.randomUUID(),commentId:crypto.randomUUID(),text:m.text,mentions:null},'thread_deleted');
 const other=await peer('viewer');await action(other,{action:'edit',threadId:op.threadId,commentId:op.commentId,text:m.text,mentions:null},'not_author');
 await action(c,{...malformed,mentions:Array(21).fill({})},'mention_limit');await action(c,malformed,'bad_mentions');
 const forged={...m.mentions[0],label:'forged',start:0,end:7};await action(c,{...malformed,text:'@forged',mentions:[forged]},'mention_unavailable');
 await action(c,{...malformed,mentions:[]},'bad_anchor');
 await action(c,start('😀 '+m.text,m.mentions.map((p:any)=>({...p,start:2,end:p.end+2}))));await deliver();assert.equal((await notices()).length,1);
});
check(149,'self/distinct recipient occurrences and edit retention, addition, removal and re-add',async()=>{
 const c=await peer(),m=await mention();const op=start(m.text+' '+m.text,[m.mentions[0],{...m.mentions[0],start:m.mentions[0].end+1,end:2*m.mentions[0].end+1}]);await action(c,op);await deliver();let inbox=await notices();assert.equal(inbox.length,1);const first=inbox[0];
 await ok('/notifications/actions','viewer','POST',{action:'read',seen:[{id:first.id,version:first.version}]},204);
 await action(c,{action:'edit',threadId:op.threadId,commentId:op.commentId,text:m.text+' changed',mentions:m.mentions});await deliver();inbox=await notices();assert.equal(inbox[0].id,first.id);assert.equal(inbox[0].read,true);assert.equal(inbox[0].createdAt,first.createdAt);
 await action(c,{action:'edit',threadId:op.threadId,commentId:op.commentId,text:'removed',mentions:[]});await deliver();assert.equal((await notices()).length,0);
 await action(c,{action:'edit',threadId:op.threadId,commentId:op.commentId,...m});await deliver();inbox=await notices();assert.equal(inbox.length,1);assert.notEqual(inbox[0].id,first.id);assert.equal(inbox[0].read,false);
 const self=await mention('editor','editor');await action(c,start(self.text,self.mentions));await deliver();assert.equal((await notices('editor')).length,0);
});
check(150,'retention 50, no backfill, permanent eviction/dismissal and compare-and-set read retry',async()=>{
 const c=await peer(),m=await mention();let op=start(m.text,m.mentions);await action(c,op);await deliver();const first=(await notices())[0];
 for(let i=0;i<50;i++){await driver.control({fixedNow:Date.now()+i*110});if(i===49){const workspace=await rpc('bootstrap_workspace',{name:'Inbox cross-workspace '+crypto.randomUUID(),owner_id:f.people.owner.id,owner_email:f.people.owner.email});const board=(await rpc('create_board',{workspace,person:f.people.owner.id,title:'Another workspace'})).id;await rpc('write_board_grant',{board,person:f.people.editor.id,role:'editor'});await rpc('write_member_role',{workspace,person:f.people.editor.id,role:'editor'});await rpc('write_board_grant',{board,person:f.people.viewer.id,role:'viewer'});const other=await peer('editor',board),candidate=(await ok(`/boards/${board}/participants`,'editor')).candidates.find((p:any)=>p.label===f.people.viewer.email.split('@')[0]),text='@'+candidate.label;await action(other,start(text,[{start:0,end:[...text].length,person:candidate.person,label:candidate.label}]));await driver.control({board,deliverMentions:true});}else{await action(c,start(m.text,m.mentions));await deliver();}}
 const raw=await helper('rows',{table:'mention_inbox',filters:{recipient:f.people.viewer.id}});assert.equal(raw.length,50);assert(!raw.some((r:any)=>r.id===first.id));assert.equal(new Set(raw.map((r:any)=>r.board_id)).size,2);
 const kept=raw[0];await rpc('act_mentions',{person:f.people.viewer.id,action:'dismiss',seen:[{id:kept.id,version:0}]});const active=await rows('mention_targets');const order=Math.max(...active.map(t=>Number(t.source_order)));await rpc('project_mentions',{board:f.a,generation:0,source_order:order,active,creates:active});assert.equal((await helper('rows',{table:'mention_inbox',filters:{recipient:f.people.viewer.id}})).length,49);

 measures.accountCap=50;measures.evictedReplayRows=49;
});
check(151,'pending cap is 1000 creation pairs; cleanup and plain saves work at cap',async()=>{
 const c=await peer(),m=await mention();await helper('proxy',{rpc:'project_mentions',fail:true});
 const lease=(await helper('rows',{table:'mention_leases',filters:{board_id:f.a,person_id:f.people.viewer.id}}))[0].lease;const operations:any[]=[];const root=crypto.randomUUID();let first='';for(let i=0;i<1000;i++){const id=crypto.randomUUID();if(!i)first=id;operations.push({sql:'INSERT INTO comments VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',bindings:[id,root,f.people.editor.id,c.joined.self.person,c.joined.self.label,m.text,Date.now(),i+1,JSON.stringify(m.mentions)]},{sql:'INSERT INTO mention_pending VALUES (?, ?, ?)',bindings:[id,f.people.viewer.id,i+1]},{sql:'INSERT INTO mention_targets VALUES (?, ?, ?, ?, ?, ?, ?, ?)',bindings:[id,f.people.viewer.id,m.mentions[0].person,lease,crypto.randomUUID(),i+1,root,Date.now()]},{sql:"INSERT INTO comment_ids VALUES (?, 'comment', ?)",bindings:[id,i+1]});}
 operations.push({sql:'INSERT INTO threads VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',bindings:[root,f.people.editor.id,c.joined.self.person,c.joined.self.label,JSON.stringify({objectId:null,u:0,v:0,x:0,y:0,detached:false,objectLabel:'',objectType:''}),Date.now(),Date.now(),1,first]},{sql:"INSERT INTO comment_ids VALUES (?, 'thread', 1)",bindings:[root]},{sql:"INSERT OR REPLACE INTO meta VALUES ('comment_sequence',1000)"},{sql:"INSERT OR REPLACE INTO meta VALUES ('mention_order',1000)"},{sql:"INSERT OR REPLACE INTO meta VALUES ('mention_cleanup',1)"});await driver.control({board:f.a,roomSQL:operations});
 const before=await rows('receipts');await action(c,start(m.text,m.mentions),'mention_pending_limit');assert.deepEqual(await rows('receipts'),before);assert.equal((await rows('mention_pending')).length,1000);
 const plain=start('Plain at cap');await action(c,plain);await action(c,{action:'delete_thread',threadId:root});assert.equal((await rows('mention_pending')).length,0);
 const meta=await rows('meta');assert.equal(meta.filter(r=>r.key==='mention_cleanup').length,1);assert.equal(meta.find(r=>r.key==='mention_cleanup').value,1);measures.pendingCap=1000;measures.cleanupMarkers=1;
});
check(152,'reply/root/thread deletion clears pending/read notices; resolve/reopen retains',async()=>{
 const c=await peer(),m=await mention(),op=start(m.text,m.mentions);await action(c,op);await deliver();const id=(await notices())[0].id;
 await action(c,{action:'resolve',threadId:op.threadId});await action(c,{action:'reopen',threadId:op.threadId});await deliver();assert.equal((await notices())[0].id,id);
 const reply={action:'reply',threadId:op.threadId,commentId:crypto.randomUUID(),...m};await action(c,reply);await deliver();assert.equal((await notices()).length,2);await action(c,{action:'delete_comment',threadId:op.threadId,commentId:reply.commentId});await deliver();assert.equal((await notices()).length,1);
 await action(c,{action:'delete_comment',threadId:op.threadId,commentId:op.commentId});await deliver();assert.equal((await notices()).length,0);assert.equal((await rows('mention_targets')).length,0);
});
check(153,'lost delivery acknowledgement and saved comment retry cannot duplicate or resurrect dismissed work',async()=>{
 const c=await peer(),m=await mention();await helper('proxy',{rpc:'project_mentions',failAfter:true});const op=start(m.text,m.mentions),saved=await action(c,op);await until(async()=>(await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}})).length);
 const row=(await notices())[0];await ok('/notifications/actions','viewer','POST',{action:'dismiss',seen:[{id:row.id,version:row.version}]},204);
 await driver.wake(f.a);const restarted=await peer();await helper('proxy',{rpc:'project_mentions',failAfter:false});const owner=await mention('editor','owner');await action(restarted,{action:'edit',threadId:op.threadId,commentId:op.commentId,text:m.text+' '+owner.text,mentions:[m.mentions[0],{...owner.mentions[0],start:[...m.text].length+1,end:[...m.text].length+1+owner.mentions[0].end}]});await deliver();restarted.p.send(saved.message);await new Promise(r=>setTimeout(r,50));assert.equal((await rows('comments')).length,1);assert.equal((await notices()).length,0);assert.equal((await rows('mention_pending')).length,0);
});
check(154,'highest role retains, final role purges, regrant never revives and author removal keeps discussion',async()=>{
 const c=await peer(),m=await mention();await action(c,start(m.text,m.mentions));await deliver();const first=(await notices())[0].id;
 await rpc('write_board_grant',{board:f.a,person:f.people.viewer.id,role:'viewer'});await rpc('remove_member',{workspace:f.workspace,person:f.people.viewer.id});assert.equal((await notices())[0].id,first);
 const old=await rows('mention_targets');await rpc('remove_grant',{board:f.a,person:f.people.viewer.id});assert.equal((await req(`/notifications/${first}/open`,'viewer')).status,404);
 await rpc('write_board_grant',{board:f.a,person:f.people.viewer.id,role:'viewer'});await rpc('project_mentions',{board:f.a,generation:0,source_order:100,active:old,creates:old});assert.equal((await notices()).length,0);
 await rpc('disable_person',{person:f.people.viewer.id});assert.equal((await roster()).some((p:any)=>p.label===f.people.viewer.email.split('@')[0]),false);
});
check(155,'RLS and guessed notice IDs reveal nothing; service errors are distinct from denial',async()=>{
 const c=await peer(),m=await mention();await action(c,start(m.text,m.mentions));await deliver();const row=(await notices())[0];assert.equal((await req(`/notifications/${row.id}/open`,'outsider')).status,404);
 for(const table of ['mention_inbox','mention_delivery','mention_leases']){const r=await helper('rls',{token:f.people.viewer.token,table});assert.equal(r.error,false);assert.deepEqual(r.data,[]);}
 await helper('proxy',{rpc:'list_mentions',fail:true});assert.equal((await req('/notifications','viewer')).status,503);await helper('proxy',{rpc:'list_mentions',fail:false});
});
check(156,'actual UTF-8 range/frame/backup bounds expose the maximal-label envelope boundary',async()=>{
 const c=await peer(),label='"'.repeat(172)+'😀'.repeat(21);
 await rpc('remember_person',{person:f.people.viewer.id,email:label+'@example.com'});
 const candidate=(await roster()).find((p:any)=>p.label===label);assert(candidate);
 const text=Array(20).fill('@'+label).join(' '),mentions=Array.from({length:20},(_,i)=>({start:i*195,end:i*195+194,person:candidate.person,label}));
 const op=start(text,mentions),saved=await action(c,op);await deliver();
 const envelope=await(await operator('backup')).json() as any,sample=envelope.tables.comments[0];
 const frame=c.p.messages.find(m=>m.commentId===op.commentId&&m.comment);
 measures.actualMentionRequestBytes=new TextEncoder().encode(JSON.stringify(saved.message)).length;
 measures.actualMentionFrameBytes=new TextEncoder().encode(JSON.stringify(frame)).length;
 assert(!JSON.stringify(frame).includes('author_id'));
 measures.maxLabelBytes=new TextEncoder().encode(label).length;measures.twentyRangeTextBytes=new TextEncoder().encode(text).length;measures.twentyRangesAll2000TextBytes=measures.twentyRangeTextBytes*2000;
 const rows=[];let remaining=4194304;for(let i=0;i<2000;i++){const t=i<812?text:'x'.repeat(Math.min(4000,Math.floor(remaining/(2000-i))));remaining-=new TextEncoder().encode(t).length;rows.push({...sample,id:i?crypto.randomUUID():sample.id,sequence:i+1,text:t,mentions:JSON.stringify(i<812?mentions:[])});}assert.equal(remaining,0);
 envelope.tables.comments=rows;
 envelope.tables.comment_ids=[...envelope.tables.comment_ids.filter((r:any)=>r.kind==='thread'),...rows.map(r=>({id:r.id,kind:'comment',sequence:r.sequence}))];envelope.tables.meta.find((r:any)=>r.key==='comment_sequence').value=2000;
 measures.legalBoardCommentTextBytes=rows.reduce((n,r)=>n+new TextEncoder().encode(r.text).length,0);measures.rangeFrameBytes=measures.actualMentionFrameBytes;measures.legalBoardEnvelopeBytes=new TextEncoder().encode(JSON.stringify(envelope)).length;
 const legal=[];for(const row of rows)legal.push({sql:'INSERT INTO comments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',bindings:[row.id,row.thread_id,row.author_id,row.person,row.label,row.text,row.created_at,row.edited_at,row.sequence,row.mentions]},{sql:"INSERT INTO comment_ids VALUES (?, 'comment', ?)",bindings:[row.id,row.sequence]});
 await driver.control({board:f.a,roomSQL:[{sql:'DELETE FROM comments'},{sql:"DELETE FROM comment_ids WHERE kind='comment'"},{sql:"UPDATE meta SET value=2000 WHERE key='comment_sequence'"},...legal]});
 const actual=await operator('backup');measures.actualMaximalBackupStatus=actual.status;measures.actualMaximalBackupReason=actual.status===413?(await actual.json() as any).error.reason:'accepted';
 assert(measures.legalBoardEnvelopeBytes>16777216);assert.equal(actual.status,413);assert.equal(measures.actualMaximalBackupReason,'backup_too_large');assert.equal(measures.twentyRangesAll2000TextBytes,10318000);
 assert.equal(measures.legalBoardCommentTextBytes,4194304);assert(measures.rangeFrameBytes<1048576);assert(measures.twentyRangesAll2000TextBytes>4194304);console.log('MEASURE-S156 '+JSON.stringify(measures));
});
check(157,'list/open do not read; Mark all and displayed comments use account-owned versioned targets',async()=>{
 const c=await peer(),m=await mention(),first=start(m.text,m.mentions);await action(c,first);await deliver();const seen=await notices();assert.equal(seen[0].read,false);
 assert.equal((await req(`/notifications/${seen[0].id}/open`,'viewer')).status,200);assert.equal((await notices())[0].read,false);
 const second=start(m.text,m.mentions);await action(c,second);await deliver();await ok('/notifications/actions','viewer','POST',{action:'read',seen:seen.map((n:any)=>({id:n.id,version:n.version}))},204);
 let all=await notices();assert.equal(all.filter((n:any)=>n.read).length,1);assert.equal(all.filter((n:any)=>!n.read).length,1);
 await ok('/notifications/actions','viewer','POST',{action:'unread',seen:seen.map((n:any)=>({id:n.id,version:n.version}))},204);assert.equal((await notices()).filter((n:any)=>n.read).length,1,'obsolete CAS must not reverse the newer read');
 const read=all.find((n:any)=>n.read);await ok('/notifications/actions','viewer','POST',{action:'unread',seen:[{id:read.id,version:read.version}]},204);all=await notices();assert.equal(all.filter((n:any)=>n.read).length,0);
 await ok(`/boards/${f.a}/mentions/displayed`,'viewer','POST',{comments:[second.commentId]},204);all=await notices();assert.equal(all.find((n:any)=>n.comment.id===first.commentId).read,false);assert.equal(all.find((n:any)=>n.comment.id===second.commentId).read,true);
 await ok('/notifications/actions','outsider','POST',{action:'read',seen:all.map((n:any)=>({id:n.id,version:n.version}))},204);assert.deepEqual(await notices(),all);
});
check(158,'restart and restore fence reject held old work and restore historical mentions without replay',async()=>{
 const c=await peer(),m=await mention();await helper('proxy',{rpc:'project_mentions',holdBefore:true,parameters:{board:f.a},clearLog:true});await action(c,start(m.text,m.mentions));
 await until(async()=>(await helper('proxy')).some((r:any)=>r.name==='project_mentions'&&r.parameters.board===f.a&&r.heldAt));
 const old=await rows('mention_targets'),envelope=await(await operator('backup')).json();await driver.wake(f.a);
 const restored=await operator('restore',envelope);assert.equal(restored.status,200);await ok(`/boards/${f.a}/join-tickets`,'editor','POST',undefined,201);await helper('proxy',{release:'project_mentions'});await new Promise(r=>setTimeout(r,80));assert.equal((await notices()).length,0);
 await rpc('project_mentions',{board:f.a,generation:0,source_order:10000,active:old,creates:old});assert.equal((await notices()).length,0);assert.equal(JSON.parse(String((await rows('comments'))[0].mentions)).length,1);assert.equal((await rows('mention_targets')).length,0);
 await helper('proxy',{rpc:'clear_board_mentions',fail:true});assert.equal((await operator('restore',envelope)).status,200);assert.equal((await req(`/boards/${f.a}/join-tickets`,'editor','POST')).status,503);assert.equal((await rows('meta')).find(r=>r.key==='restore_pending').value,1);await helper('proxy',{rpc:'clear_board_mentions',fail:false});await peer();assert.equal((await notices()).length,0);
});
check(159,'current initialization rollback and current backup validation precede every restore fence',async()=>{
 const c=await peer(),m=await mention();await action(c,start(m.text,m.mentions));await deliver();
 const envelope=await(await operator('backup')).json() as any,before=await snapshot();
 for(const mutate of [(b:any)=>{b.tables.comments[0].mentions='null';},(b:any)=>{b.tables.comments[0].mentions='[{}]';},(b:any)=>{delete b.tables.mention_pending;},(b:any)=>{delete b.tables.comments;}]){
  const malformed=structuredClone(envelope);mutate(malformed);await helper('proxy',{clearLog:true});assert.equal((await operator('restore',malformed)).status,400);assert.equal(await snapshot(),before);
  assert(!(await helper('proxy')).some((r:any)=>r.name==='clear_board_mentions'));
 }
 const meta=await rows('meta');await assert.rejects(driver.control({board:f.a,failInitialization:true}),/initialization rollback/);assert.deepEqual(await rows('meta'),meta);
 await driver.wake(f.a);const reopened=await peer();assert.equal((await rows('meta')).find(r=>r.key==='storage_version').value,5);
 assert.equal((await operator('restore',envelope)).status,200);await peer();assert.deepEqual(JSON.parse(String((await rows('comments'))[0].mentions)),m.mentions);assert.equal((await rows('mention_targets')).length,0);assert.equal((await notices()).length,0);
});
check(160,'inventory measures every current store and identifies lifetime-growing history separately',async()=>{
 const c=await peer(),m=await mention();await action(c,start(m.text,m.mentions));await deliver();
 const envelope=await(await operator('backup')).json() as any;measures.tables={};
 for(const table of ['meta','edits','receipts','waiting','snapshot_chunks','grants','identifiers','threads','comments','comment_ids','comment_counts','tickets','mention_targets','mention_pending']){
  const data=envelope.tables[table]??await rows(table);measures.tables[table]={rows:data,serializedBytes:new TextEncoder().encode(JSON.stringify(data)).length};
 }
 const generation=await driver.control({board:f.a,fences:true}),fence=[{board_id:f.a,generation}];measures.tables.runner_fence={rows:fence,serializedBytes:new TextEncoder().encode(JSON.stringify(fence)).length};
 for(const table of ['mention_inbox','mention_delivery','mention_leases']){const data=await helper('rows',{table,filters:{board_id:f.a}});measures.tables[table]={rows:data,serializedBytes:new TextEncoder().encode(JSON.stringify(data)).length};}
 assert.equal(measures.tables.mention_delivery.rows.length,1);assert(measures.tables.mention_targets.rows.length<=40000);assert(measures.tables.mention_pending.rows.length<=1000);assert(measures.tables.mention_inbox.rows.length<=50);
 assert.equal(measures.tables.meta.rows.filter((r:any)=>r.key==='mention_cleanup').length,1);
 const leases=measures.tables.mention_leases.rows;assert.equal(leases.length,(await roster()).length);
 measures.lifetimeGrowing=['receipts','comment_ids','identifiers','access_changes (Supabase)','edits/snapshot_chunks Yjs history'];console.log('MEASURE-S160 '+JSON.stringify({tables:measures.tables,bounds:{currentPairs:40000,pendingPairs:1000,cleanupMarkers:1,inboxPerAccount:50,checkpointPerLiveBoard:1},lifetimeGrowing:measures.lifetimeGrowing,globallyBounded:false}));
});
check(161,'author loss retains saved discussion; service-only functions deny direct authenticated calls',async()=>{
 const c=await peer(),m=await mention(),op=start(m.text,m.mentions);await action(c,op);await deliver();const first=(await notices())[0];
 await rpc('write_member_role',{workspace:f.workspace,person:f.people.editor.id,role:'guest'});await driver.control({board:f.a,deliverMentions:true});assert.equal((await notices())[0].id,first.id);assert.equal((await notices())[0].comment.text,m.text);
 for(const [name,parameters]of [['list_mentions',{person:f.people.viewer.id}],['mention_roster',{board:f.a,caller:f.people.viewer.id}],['act_mentions',{person:f.people.viewer.id,action:'dismiss',seen:[{id:first.id,version:0}]}],['clear_board_mentions',{board:f.a,generation:99}],['valid_mention_targets',{board:f.a,targets:[]}],['refresh_mention_leases',{board:f.a}],['mention_access_changed',{}],['project_mentions',{board:f.a,generation:99,source_order:1,active:[],creates:[]}],['mention_boards',{}]]){
  const response=await helper('rls',{token:f.people.viewer.token,rpc:name,parameters});assert.equal(response.error,true);
 }
 assert.equal((await notices())[0].id,first.id);
});
check(162,'final-role and disabled cleanup removes durable pending pairs at room replay, regrant stays historical',async()=>{
 const c=await peer(),m=await mention();await helper('proxy',{rpc:'project_mentions',fail:true});await action(c,start(m.text,m.mentions));await until(async()=>(await rows('mention_pending')).length);
 await rpc('write_member_role',{workspace:f.workspace,person:f.people.viewer.id,role:'guest'});await ok(`/boards/${f.a}/join-tickets`,'editor','POST',undefined,201);
 assert.equal((await rows('mention_pending')).length,0);assert.equal((await rows('mention_targets')).length,0);assert.equal((await notices()).length,0);
 await rpc('write_board_grant',{board:f.a,person:f.people.viewer.id,role:'viewer'});await helper('proxy',{rpc:'project_mentions',fail:false});await deliver();assert.equal((await notices()).length,0);
 const next=await mention();await action(c,start(next.text,next.mentions));await helper('proxy',{rpc:'project_mentions',fail:true});await rpc('disable_person',{person:f.people.viewer.id});await ok(`/boards/${f.a}/join-tickets`,'editor','POST',undefined,201);assert.equal((await rows('mention_pending')).length,0);assert.equal((await rows('mention_targets')).length,0);
});
check(163,'failed authorized target room read is Retry-worthy service failure and never deletes its inbox reference',async()=>{
 const c=await peer(),m=await mention();await action(c,start(m.text,m.mentions));await deliver();const row=(await notices())[0];await driver.control({fenceUnreadable:true});
 const response=await req(`/notifications/${row.id}/open`,'viewer');assert.equal(response.status,503);assert.equal((await req('/notifications','viewer')).status,503);assert.deepEqual(Object.keys(await response.json()),['error']);const indexed=await helper('rows',{table:'mention_inbox',filters:{board_id:f.a}});assert(indexed.some((n:any)=>n.id===row.id));await driver.control({fenceUnreadable:false});
 assert.equal((await req(`/notifications/${row.id}/open`,'viewer')).status,200);assert.equal((await req('/notifications','viewer')).status,200);
});
check(164,'reordered old creation cannot survive removal or regain read/dismissed state',async()=>{
 const c=await peer(),m=await mention(),op=start(m.text,m.mentions);await action(c,op);await deliver();const old=await rows('mention_targets');
 await action(c,{action:'edit',threadId:op.threadId,commentId:op.commentId,text:'removed',mentions:[]});await deliver();
 await rpc('project_mentions',{board:f.a,generation:0,source_order:1,active:old,creates:old});assert.equal((await notices()).length,0);
 await action(c,{action:'edit',threadId:op.threadId,commentId:op.commentId,...m});await deliver();const current=(await notices())[0];await ok('/notifications/actions','viewer','POST',{action:'read',seen:[{id:current.id,version:current.version}]},204);
 await rpc('project_mentions',{board:f.a,generation:0,source_order:1,active:old,creates:old});assert.equal((await notices())[0].id,current.id);assert.equal((await notices())[0].read,true);
});
check(165,'shared minute retry discovers durable pending notices after a runner restart',async()=>{
 const c=await peer(),m=await mention();await helper('proxy',{rpc:'project_mentions',fail:true});await action(c,start(m.text,m.mentions));await until(async()=>(await rows('mention_pending')).length);
 await driver.wake(f.a);await helper('proxy',{rpc:'project_mentions',fail:false});const begun=Date.now();
 if(runner==='node'){await driver.control({deliveryIntervalMs:60000});await until(async()=>(await notices()).length,n=>n===1,75000);await driver.control({deliveryIntervalMs:0});}
 else{const config=await helper('server-config');assert(config.triggers.crons.includes('* * * * *'));await driver.control({scheduled:true});await until(async()=>(await notices()).length,n=>n===1);}
 measures.sharedRetryWaitMs=Date.now()-begun;assert.equal((await rows('mention_pending')).length,0);console.log('MEASURE-S165 '+JSON.stringify({runner,waitMs:measures.sharedRetryWaitMs}));
});
check(166,'object deletion and board Undo keep the mention occurrence, read state and detached point',async()=>{
 const {BoardSession}=await import('../../packages/board-sync/src/session.ts');const{add}=await import('../../packages/board-rules/src/document.ts');
 const session=await BoardSession.join({ticket:()=>ok(`/boards/${f.a}/join-tickets?mentions=1`,'editor','POST',undefined,201),clock:{now:Date.now,after:(ms:number,fn:()=>void)=>{const timer=setTimeout(fn,ms);return()=>clearTimeout(timer);}},open:async issued=>{const p=await driver.connect(`/boards/${f.a}/join?ticket=${issued.ticket}`);peers.push(p);return{send:(text:string)=>p.send(text),close:()=>{void p.close();},listen:(h:any)=>p.listen(h)};}});
 try{const save=async(id:string)=>{await until(()=>session.requests.get(id)?.state==='saved');};await save(session.edit(add(session.board,'sticky',100,200)));const object=session.board.objects[0],c=await peer(),m=await mention(),op={...start(m.text,m.mentions),anchor:{objectId:object.id,u:.25,v:.75,x:0,y:0}};
 await action(c,op);await deliver();const first=(await notices())[0];await ok('/notifications/actions','viewer','POST',{action:'read',seen:[{id:first.id,version:first.version}]},204);
 await save(session.edit({...session.board,objects:session.board.objects.map(o=>o.id===object.id?{...o,x:o.x+300}:o)}));await deliver();const moved=(await notices())[0];assert.equal(moved.id,first.id);assert.equal(moved.read,true);assert.equal(moved.anchor.x,object.x+300+object.width*.25);assert.equal(moved.anchor.y,object.y+object.height*.75);
 await save(session.edit({...session.board,objects:[],retiredGenerations:[...session.board.retiredGenerations,object.generation].sort()}));await deliver();let current=(await notices())[0];assert.equal(current.id,first.id);assert.equal(current.read,true);assert.equal(current.anchor.detached,true);const point={x:current.anchor.x,y:current.anchor.y};
 await save(session.undo());await deliver();current=(await notices())[0];assert.equal(current.id,first.id);assert.equal(current.read,true);assert.equal(current.anchor.detached,true);assert.deepEqual({x:current.anchor.x,y:current.anchor.y},point);
 await save(session.redo());await deliver();current=(await notices())[0];assert.equal(current.id,first.id);assert.equal(current.read,true);assert.equal(current.anchor.detached,true);assert.deepEqual({x:current.anchor.x,y:current.anchor.y},point);
 }finally{session.close();}
});
check(167,'4000-code-point UTF-8 text and twenty exact 256-byte ranges fit current requests and frames',async()=>{
 const c=await peer(),label='😀'.repeat(64);await rpc('remember_person',{person:f.people.viewer.id,email:label+'@example.test'});const target=(await roster()).find((p:any)=>p.label===label);assert(target);
 const prefix='😀'.repeat(2677)+'"\\\n ',text=prefix+Array(20).fill('@'+label).join(' '),mentions=Array.from({length:20},(_,i)=>({start:2681+i*66,end:2681+i*66+65,person:target.person,label}));assert.equal([...text].length,4000);
 const before=await(await req(`/boards/${f.a}/export`)).text(),op=start(text,mentions),saved=await action(c,op);await deliver();const frame=c.p.messages.find(m=>m.commentId===op.commentId&&m.comment);assert(frame);
 assert.deepEqual(frame.comment.mentions,mentions);assert.deepEqual(JSON.parse(String((await rows('comments'))[0].mentions)),mentions);assert.equal(await(await req(`/boards/${f.a}/export`)).text(),before);
 measures.maxUnicodeFrameFixture={codePoints:4000,labelBytes:new TextEncoder().encode(label).length,textBytes:new TextEncoder().encode(text).length,requestBytes:new TextEncoder().encode(JSON.stringify(saved.message)).length,frameBytes:new TextEncoder().encode(JSON.stringify(frame)).length};assert(measures.maxUnicodeFrameFixture.frameBytes<1048576);assert(measures.maxUnicodeFrameFixture.requestBytes<1048576);console.log('MEASURE-S167 '+JSON.stringify(measures.maxUnicodeFrameFixture));
});
check(168,'Node marked-volume recovery advances above both live checkpoints and restored generations, failing closed on each read',async()=>{
 assert(driver.volumeCopy,'physical data-folder rewind control');
 const c=await peer(),m=await mention();await action(c,start(m.text,m.mentions));await deliver();
 const source=await rows('mention_targets'),envelope=await(await operator('backup')).json(),restoredRoom=Number((await rows('meta')).find(r=>r.key==='restore_generation').value),restoredFence=await driver.control({board:f.a,fences:true});
 const oldGeneration=restoredRoom,oldOrder=Number((await rows('meta')).find(r=>r.key==='mention_order').value);
 let liveDocument=0,liveMention=0;
 await driver.volumeCopy!(f.a,async()=>{
  await helper('proxy',{rpc:'copy_saved_board',fail:true});
  assert.equal((await operator('restore',envelope)).status,200);await peer();
  liveDocument=Number((await helper('rows',{table:'boards',filters:{id:f.a}}))[0].document_generation);
  liveMention=Number((await helper('rows',{table:'mention_delivery',filters:{board_id:f.a}}))[0].generation);
  assert(liveMention>liveDocument,'mention clearing must be ahead of delayed/failed document copying before rewind');
 });
 await helper('proxy',{rpc:'copy_saved_board',fail:false});
 // No read failure may clear projection or unlock the marked restored room.
 for(const failure of ['document','mention']){
  await driver.control({failCheckpoint:failure});await helper('proxy',{clearLog:true});
  const checkpoint=await helper('rows',{table:'mention_delivery',filters:{board_id:f.a}}),fence=await driver.control({board:f.a,fences:true});
  assert.equal((await req(`/boards/${f.a}/join-tickets`,'editor','POST')).status,503);
  assert.equal((await rows('meta')).find(r=>r.key==='restore_pending').value,1);assert.equal(await driver.control({board:f.a,fences:true}),fence);
  assert.deepEqual(await helper('rows',{table:'mention_delivery',filters:{board_id:f.a}}),checkpoint);assert(!(await helper('proxy')).some((r:any)=>r.name==='clear_board_mentions'));
 }
 await driver.control({failCheckpoint:''});
 await helper('proxy',{rpc:'project_mentions',holdBefore:true,parameters:{board:f.a,generation:oldGeneration},clearLog:true});
 const held=fetch(context.proxyUrl+'/rest/v1/rpc/project_mentions',{method:'POST',headers:{apikey:context.serviceKey,Authorization:'Bearer '+context.serviceKey,'Content-Type':'application/json','Content-Profile':'nextphase_board'},body:JSON.stringify({board:f.a,generation:oldGeneration,source_order:oldOrder,active:source,creates:source})});
 try{
  await until(async()=>(await helper('proxy')).some((r:any)=>r.name==='project_mentions'&&r.heldAt));
  await helper('proxy',{rpc:'clear_board_mentions',holdBefore:true,parameters:{board:f.a}});
  const reopening=req(`/boards/${f.a}/join-tickets`,'editor','POST');
  await until(async()=>(await helper('proxy')).some((r:any)=>r.name==='clear_board_mentions'&&r.heldAt));
  const advanced=await driver.control({board:f.a,fences:true});assert(advanced>Math.max(liveDocument,liveMention,restoredRoom,restoredFence));
  assert.equal((await rows('meta')).find(r=>r.key==='restore_pending').value,1);
  await helper('proxy',{release:'clear_board_mentions'});assert.equal((await reopening).status,201);
  const cleared=(await helper('rows',{table:'mention_delivery',filters:{board_id:f.a}}))[0];assert.equal(Number(cleared.generation),advanced);assert.equal(Number(cleared.source_order),-1);assert.equal((await notices()).length,0);
  const fresh=await peer(),next=start(m.text,m.mentions);await action(fresh,next);await deliver();const notice=(await notices())[0];assert.equal(notice.comment.id,next.commentId);
  await helper('proxy',{release:'project_mentions'});assert((await held).ok);assert.deepEqual((await notices()).map((n:any)=>n.id),[notice.id]);
  measures.nodeVolumeFloor={liveDocument,liveMention,restoredRoom,restoredFence,advanced,clearedGeneration:Number(cleared.generation)};console.log('MEASURE-S168 '+JSON.stringify(measures.nodeVolumeFloor));
 }finally{await helper('proxy',{release:'clear_board_mentions'});await helper('proxy',{release:'project_mentions'});await held;await driver.control({failCheckpoint:''});}
});
