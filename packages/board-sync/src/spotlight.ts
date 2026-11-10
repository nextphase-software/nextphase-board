// SPDX-License-Identifier: Apache-2.0
import { timerInteger as integer, timerUuid as uuid, timerRecord as record, timerKeys as keys, timerBudget } from './timer.ts';
export const SPOTLIGHT_REQUEST_LIMIT = 1024, SPOTLIGHT_RESPONSE_LIMIT = 4096, SPOTLIGHT_METADATA_LIMIT = 1024;
export const SPOTLIGHT_GRACE = 5000, SPOTLIGHT_MAX = Number.MAX_SAFE_INTEGER;
export const spotlightBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
export const spotlightKey = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export const spotlightColours = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#0891b2','#db2777','#4f46e5'];
export type SpotlightPresenter = { connection: string; person: string; label: string; colour: string };
export type SpotlightSession = { authorityId: string; sessionId: string|null; controlVersion: number; phase: 'idle'|'active'|'reconnecting'; presenter: SpotlightPresenter|null; graceDeadline: number|null };
export type SpotlightOwn = { membershipVersion: number; following: boolean };
export type SpotlightProjection = { session: SpotlightSession; own: SpotlightOwn; presenting: { followers: number; hasHadFollower: boolean }|null };
export type SpotlightAction = 'start'|'take_over'|'stop'|'follow'|'leave'|'resume';
export type SpotlightCause = SpotlightAction|'reconnecting'|'left'|'voting'|'preview'|'lifecycle'|'recovery';
export const spotlightCauses: SpotlightCause[] = ['start','take_over','stop','follow','leave','resume','reconnecting','left','voting','preview','lifecycle','recovery'];
export const spotlightReasons = ['spotlight_bad_message','spotlight_message_too_large','spotlight_rate_limited','spotlight_stale_session','spotlight_stale_member','spotlight_state','spotlight_not_presenter','spotlight_voting','spotlight_version_exhausted','spotlight_access_changed','spotlight_unavailable'] as const;
export type SpotlightReason = typeof spotlightReasons[number];
type Base = { kind: 'spotlight_command'; requestId: string; epoch: number; restoreGeneration: number; authorityId: string; sessionId: string|null };
export type SpotlightCommand = Base & ({action:'start'|'take_over'|'stop';expectedControlVersion:number}|{action:'resume';expectedControlVersion:number;resumeKey:string}|{action:'follow'|'leave';expectedMembershipVersion:number});
export type SpotlightRead = {kind:'spotlight_read';requestId:string;epoch:number;restoreGeneration:number};
type Stamp = {spotlight:SpotlightProjection;restoreGeneration:number};
export type SpotlightFrame = Stamp & ({kind:'spotlight_result';requestId:string;cause:SpotlightCause;resumeKey?:string}|{kind:'spotlight_state';cause:SpotlightCause}|{kind:'spotlight_snapshot';requestId:string}) |
  ({kind:'spotlight_refused';requestId:string|null;reason:SpotlightReason}&Partial<Stamp>);
export const idleSpotlight = (authorityId:string, controlVersion=0):SpotlightSession => ({authorityId,sessionId:null,controlVersion,phase:'idle',presenter:null,graceDeadline:null});
export function spotlightPresenter(v:unknown):v is SpotlightPresenter {
  return record(v)&&keys(v,['connection','person','label','colour'])&&uuid(v.connection)&&typeof v.person==='string'&&/^[0-9a-f]{32}$/.test(v.person)&&
    typeof v.label==='string'&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v.label)&&[...v.label].length>=1&&new TextEncoder().encode(v.label).length<=256&&spotlightColours.includes(v.colour);
}
export function spotlightSession(v:unknown):v is SpotlightSession {
  if(!record(v)||!keys(v,['authorityId','sessionId','controlVersion','phase','presenter','graceDeadline'])||!uuid(v.authorityId)||!integer(v.controlVersion))return false;
  if(v.phase==='idle')return v.sessionId===null&&v.presenter===null&&v.graceDeadline===null;
  if(!uuid(v.sessionId)||!spotlightPresenter(v.presenter))return false;
  return v.phase==='active'?v.graceDeadline===null&&v.controlVersion<=SPOTLIGHT_MAX-2:
    v.phase==='reconnecting'&&integer(v.graceDeadline)&&v.controlVersion<=SPOTLIGHT_MAX-1;
}
export function spotlightProjection(v:unknown):v is SpotlightProjection {
  if(!record(v)||!keys(v,['session','own','presenting'])||!spotlightSession(v.session)||!record(v.own)||!keys(v.own,['membershipVersion','following'])||!integer(v.own.membershipVersion)||typeof v.own.following!=='boolean'||spotlightBytes(v)>SPOTLIGHT_RESPONSE_LIMIT)return false;
  if(v.own.following&&(v.session.phase==='idle'||v.own.membershipVersion>SPOTLIGHT_MAX-2))return false;
  return v.presenting===null||v.session.phase!=='idle'&&record(v.presenting)&&keys(v.presenting,['followers','hasHadFollower'])&&integer(v.presenting.followers)&&v.presenting.followers<=49&&typeof v.presenting.hasHadFollower==='boolean'&&(!v.presenting.followers||v.presenting.hasHadFollower);
}
export function checkSpotlightRequest(v:unknown,size:number):SpotlightCommand|SpotlightRead|SpotlightReason {
  if(size>SPOTLIGHT_REQUEST_LIMIT)return 'spotlight_message_too_large';
  if(!record(v)||!uuid(v.requestId)||!integer(v.epoch)||!integer(v.restoreGeneration))return 'spotlight_bad_message';
  const common=['kind','requestId','epoch','restoreGeneration'];
  if(v.kind==='spotlight_read')return keys(v,common)?v as SpotlightRead:'spotlight_bad_message';
  if(v.kind!=='spotlight_command'||!['start','take_over','stop','follow','leave','resume'].includes(v.action)||!uuid(v.authorityId)||v.sessionId!==null&&!uuid(v.sessionId))return 'spotlight_bad_message';
  const member=v.action==='follow'||v.action==='leave',version=member?'expectedMembershipVersion':'expectedControlVersion';
  if(!integer(v[version])||!keys(v,[...common,'authorityId','sessionId','action',version,...(v.action==='resume'?['resumeKey']:[])])||v.action==='resume'&&!spotlightKey(v.resumeKey))return 'spotlight_bad_message';
  return v as SpotlightCommand;
}
export function checkSpotlightFrame(v:unknown,size:number):v is SpotlightFrame {
  if(size>SPOTLIGHT_RESPONSE_LIMIT||!record(v))return false;
  const stamp=['spotlight','restoreGeneration'],valid=()=>spotlightProjection(v.spotlight)&&integer(v.restoreGeneration);
  if(v.kind==='spotlight_refused')return (v.requestId===null||uuid(v.requestId))&&spotlightReasons.includes(v.reason)&&
    (keys(v,['kind','requestId','reason'])||keys(v,['kind','requestId','reason',...stamp])&&valid());
  if(!valid())return false;
  if(v.kind==='spotlight_snapshot')return uuid(v.requestId)&&keys(v,['kind','requestId',...stamp]);
  if(!spotlightCauses.includes(v.cause))return false;
  if(v.kind==='spotlight_state')return keys(v,['kind','cause',...stamp]);
  return v.kind==='spotlight_result'&&uuid(v.requestId)&&keys(v,['kind','requestId','cause',...stamp,...(v.resumeKey===undefined?[]:['resumeKey'])])&&
    (v.resumeKey===undefined||['start','take_over','resume'].includes(v.cause)&&v.spotlight.presenting!==null&&spotlightKey(v.resumeKey));
}
export const spotlightBudget = timerBudget;
export const retryClose = { code:4410, reason:'retry_recovery' } as const;
export const terminalSpotlightClose = (code:number) => [1000,1001,4401,4403,4409,4423].includes(code);
