// SPDX-License-Identifier: Apache-2.0
import type { TimerSnapshot, TimerCause } from './hosted-board';
export const MAX_TIME = 5999000;
export type TimerDraft = { minutes:string; seconds:string };
export const defaultDraft = ():TimerDraft => ({minutes:'03',seconds:'00'});
export function draftMs(d:TimerDraft):number|null {
  if(!/^\d{1,2}$/.test(d.minutes)||!/^\d{1,2}$/.test(d.seconds))return null;
  const m=Number(d.minutes),s=Number(d.seconds);return m<=99&&s<=59?(m*60+s)*1000:null;
}
export function timeParts(ms:number):TimerDraft {const n=Math.ceil(Math.max(0,ms)/1000);return {minutes:String(Math.floor(n/60)).padStart(2,'0'),seconds:String(n%60).padStart(2,'0')};}
export function shiftDraft(d:TimerDraft,delta:number):TimerDraft {return timeParts(Math.max(0,Math.min(MAX_TIME,(draftMs(d)??0)+delta)));}
export function padDraft(d:TimerDraft):TimerDraft {return draftMs(d)===null?d:timeParts(draftMs(d)!);}
export type TimerAnchor={serverMs:number;midpoint:number;received:number;sent:number};
export function sampleAnchor(serverMs:number,sent:number,received:number):TimerAnchor|null {
  return [serverMs,sent,received].every(Number.isFinite)&&received>=sent&&serverMs>=0?{serverMs,midpoint:(sent+received)/2,received,sent}:null;
}
export const serverTime=(a:TimerAnchor,monotonic:number)=>a.serverMs+monotonic-a.midpoint;
export function remainingMs(t:TimerSnapshot,now:number) {return t.status==='paused'?t.remainingMs!:t.status==='running'?Math.max(0,t.endsAtServerMs!-now):0;}
export const transitionWords:Record<TimerCause,string>={start:'Timer started',pause:'Timer paused',resume:'Timer resumed',extend:'Timer extended',end:'Timer stopped',expire:'Timer finished',reset:''};
// One high-water mark, bounded independently of the number of workshop actions.
export type SpeechWatermark={baseline:number;version:number;cause:TimerCause|null};
export function transitionSpeech(mark:SpeechWatermark,version:number,cause:TimerCause):{mark:SpeechWatermark;text:string;conflict:boolean} {
  if(version<=mark.baseline || version<mark.version)return {mark,text:'',conflict:false};
  if(version===mark.version)return {mark,text:'',conflict:mark.cause!==cause};
  return {mark:{...mark,version,cause},text:transitionWords[cause],conflict:false};
}
