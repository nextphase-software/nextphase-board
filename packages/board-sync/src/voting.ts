// SPDX-License-Identifier: Apache-2.0
import { timerInteger as integer, timerUuid as uuid, timerRecord as record, timerKeys as keys } from './timer.ts';
export { timerBudget as voteBudget } from './timer.ts';
export const VOTE_REQUEST_LIMIT = 4096, VOTE_RESPONSE_LIMIT = 65536, VOTE_BALLOT_LIMIT = 4096, VOTE_VOTERS = 50;
export const voteColours = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2','#db2777','#4f46e5'];
export type VoteTarget = [string,string,number];
export type BallotTarget = [string,string];
export type VoteSession = {status:'idle'|'running'|'revealed';sessionId:string|null;sessionVersion:number;prompt:string;budget:number;targets:VoteTarget[];totals:number[]|null};
export type VoteOwn = {ballotVersion:number;colour:string;targets:BallotTarget[];remaining:number};
export type VoteProjection = {session:VoteSession;own:VoteOwn|null|{limited:true}};
export type VoteAction = 'start'|'vote'|'unvote'|'reveal'|'clear';
export type VoteCause = VoteAction|'prune'|'targets'|'reset';
export const voteCauses:VoteCause[] = ['start','vote','unvote','reveal','clear','prune','targets','reset'];
export const voteReasons = ['vote_bad_message','vote_message_too_large','vote_rate_limited','vote_stale_session','vote_stale_ballot','vote_state','vote_bounds','vote_ineligible','vote_budget_spent','vote_already_voted','vote_not_voted','vote_voter_limit','vote_unavailable','vote_access_changed'] as const;
export type VoteReason = typeof voteReasons[number];
type VoteBase = {kind:'vote_command';requestId:string;epoch:number;restoreGeneration:number;sessionId:string|null;expectedSessionVersion:number};
export type VoteCommand = VoteBase & ({action:'start';prompt:string;budget:number}|{action:'vote'|'unvote';objectId:string;objectGeneration:string;expectedBallotVersion:number}|{action:'reveal'}|{action:'clear'});
export type VoteRead = {kind:'vote_read';requestId:string;epoch:number;restoreGeneration:number};
type Stamp = {voting:VoteProjection;restoreGeneration:number};
export type VoteFrame = Stamp & ({kind:'vote_result';requestId:string;cause:VoteCause}|{kind:'vote_snapshot';requestId:string}|{kind:'vote_state';cause:VoteCause}) |
  ({kind:'vote_refused';requestId:string|null;reason:VoteReason}&Partial<Stamp>);
export const voteBytes = (v:unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
export const sameTarget = (a:readonly unknown[],b:readonly unknown[]) => a[0]===b[0]&&a[1]===b[1];
export const idleVoting = (sessionVersion=0):VoteSession => ({status:'idle',sessionId:null,sessionVersion,prompt:'',budget:0,targets:[],totals:null});
export function validVotePrompt(v:unknown):v is string {
  return typeof v==='string' && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v) && [...v.trim()].length>=1 && [...v.trim()].length<=240;
}
export const validVoteBudget = (v:unknown):v is number => integer(v)&&v>=1&&v<=20;
function targets(v:unknown,ordered:boolean,max:number):v is VoteTarget[]|BallotTarget[] {
  if(!Array.isArray(v)||v.length>max)return false;
  const seen=new Set<string>(),orders=new Set<number>();
  return v.every(t=>{
    if(!Array.isArray(t)||t.length!==(ordered?3:2)||!uuid(t[0])||!uuid(t[1])||seen.has(t[0]))return false;
    seen.add(t[0]);
    if(ordered){if(!integer(t[2])||t[2]>249||orders.has(t[2]))return false;orders.add(t[2]);}
    return true;
  });
}
export function voteSession(v:unknown):v is VoteSession {
  if(!record(v)||!keys(v,['status','sessionId','sessionVersion','prompt','budget','targets','totals'])||!integer(v.sessionVersion)||!targets(v.targets,true,250))return false;
  if(v.status==='idle')return v.sessionId===null&&v.prompt===''&&v.budget===0&&v.targets.length===0&&v.totals===null;
  if(!uuid(v.sessionId)||!validVotePrompt(v.prompt)||v.prompt!==v.prompt.trim()||!validVoteBudget(v.budget)||(v.targets as VoteTarget[]).some((t,i)=>i>0&&t[2]<=v.targets[i-1][2]))return false;
  return v.status==='running'?v.totals===null:v.status==='revealed'&&Array.isArray(v.totals)&&v.totals.length===v.targets.length&&v.totals.every(n=>integer(n)&&n<=50);
}
export function voteOwn(v:unknown,s:VoteSession):v is VoteOwn {
  return record(v)&&keys(v,['ballotVersion','colour','targets','remaining'])&&integer(v.ballotVersion)&&voteColours.includes(v.colour)&&targets(v.targets,false,20)&&
    (v.targets as BallotTarget[]).every(t=>s.targets.some(p=>sameTarget(p,t)))&&v.remaining===s.budget-v.targets.length&&integer(v.remaining);
}
export function voteProjection(v:unknown):v is VoteProjection {
  return record(v)&&keys(v,['session','own'])&&voteSession(v.session)&&voteBytes(v)<=VOTE_RESPONSE_LIMIT&&
    (v.own===null||v.session.status==='running'&&(record(v.own)&&keys(v.own,['limited'])&&v.own.limited===true||voteOwn(v.own,v.session)));
}
export function checkVoteRequest(v:unknown,size:number):VoteCommand|VoteRead|VoteReason {
  if(size>VOTE_REQUEST_LIMIT)return 'vote_message_too_large';
  if(!record(v)||!uuid(v.requestId)||!integer(v.epoch)||!integer(v.restoreGeneration))return 'vote_bad_message';
  const common=['kind','requestId','epoch','restoreGeneration'];
  if(v.kind==='vote_read')return keys(v,common)?v as VoteRead:'vote_bad_message';
  if(v.kind!=='vote_command'||!voteCauses.slice(0,5).includes(v.action)||!integer(v.expectedSessionVersion)||v.sessionId!==null&&!uuid(v.sessionId))return 'vote_bad_message';
  const extra=v.action==='start'?['prompt','budget']:v.action==='vote'||v.action==='unvote'?['objectId','objectGeneration','expectedBallotVersion']:[];
  if(!keys(v,[...common,'sessionId','expectedSessionVersion','action',...extra]))return 'vote_bad_message';
  if(v.action==='start') {
    if(typeof v.prompt!=='string'||typeof v.budget!=='number')return 'vote_bad_message';
    if(!validVotePrompt(v.prompt)||!validVoteBudget(v.budget))return 'vote_bounds';
  }
  if((v.action==='vote'||v.action==='unvote')&&(!uuid(v.objectId)||!uuid(v.objectGeneration)||!integer(v.expectedBallotVersion)))return 'vote_bad_message';
  return v as VoteCommand;
}
export function checkVoteFrame(v:unknown,size:number):v is VoteFrame {
  if(size>VOTE_RESPONSE_LIMIT||!record(v))return false;
  const stamp=['voting','restoreGeneration'],valid=()=>voteProjection(v.voting)&&integer(v.restoreGeneration);
  if(v.kind==='vote_refused')return (v.requestId===null||uuid(v.requestId))&&voteReasons.includes(v.reason)&&
    (keys(v,['kind','requestId','reason'])||keys(v,['kind','requestId','reason',...stamp])&&valid());
  if(!valid())return false;
  if(v.kind==='vote_snapshot')return uuid(v.requestId)&&keys(v,['kind','requestId',...stamp]);
  return (v.kind==='vote_result'||v.kind==='vote_state')&&voteCauses.includes(v.cause)&&keys(v,['kind',...stamp,'cause',...(v.kind==='vote_result'?['requestId']:[])])&&(v.kind==='vote_state'||uuid(v.requestId));
}
