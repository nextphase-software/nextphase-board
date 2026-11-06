// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { HomeMenu, type MenuPosition } from './home-menu';
import { CommentIcon } from './comments/icons';
import { MentionText } from './comments/mention-editor';
import { authorColour, timeWords, type Comment } from './comments/rules';
import { notificationNavigation } from './notification-navigation';
type Notice = { id:string; version:number; read:boolean; boardId:string; title:string; workspace:string; threadId:string; comment:Comment; createdAt:number };
type Action = { action:'read'|'unread'|'dismiss';seen:{id:string;version:number}[] };
export function Notifications({ account, unavailable }: { account: string; unavailable: () => void }) {
  const [open,setOpen]=useState(!!notificationNavigation.returnNotice),[state,setState]=useState<'loading'|'ready'|'failed'|'unavailable'|'openFailed'>('loading');
  const [rows,setRows]=useState<Notice[]>([]),[unread,setUnread]=useState(false),[menu,setMenu]=useState<(MenuPosition&{row:Notice})|null>(null);
  const [pending,setPending]=useState<{body:Action;state:'sending'|'failed';all:boolean;confirmed?:boolean}|null>(null);
  const bell=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),alive=useRef(true),epoch=useRef(0),opening=useRef<Notice|null>(null);
  const lastRows=useRef<Notice[]>([]), pendingRef=useRef(pending); pendingRef.current=pending;
  async function refresh() {
    if(document.visibilityState!=='visible'||pendingRef.current)return;
    const revision=++epoch.current;setState('loading');setRows([]);
    try{const r=await api<{notices:Notice[]}>('/notifications');if(!alive.current||revision!==epoch.current)return;lastRows.current=r.notices;setRows(r.notices);setUnread(r.notices.some(n=>!n.read));setState('ready');}
    catch{if(alive.current&&revision===epoch.current){setRows([]);setState('failed');}}
  }
  useEffect(()=>{alive.current=true;setUnread(false);setRows([]);setPending(null);void refresh();const focus=()=>{void refresh();},visibility=()=>{if(document.visibilityState==='visible')void refresh();};
    const timer=setInterval(focus,30000);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
    return()=>{alive.current=false;++epoch.current;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);lastRows.current=[];};
  },[account]);
  useEffect(()=>{if(open&&state==='ready'&&notificationNavigation.returnNotice){panel.current?.querySelector<HTMLButtonElement>(`[data-notice="${notificationNavigation.returnNotice}"]`)?.focus();delete notificationNavigation.returnNotice;}},[open,state]);
  async function act(body:Action,all=false,posted=false){++epoch.current;setPending({body,state:'sending',all,confirmed:posted});
    try{if(!posted){await api('/notifications/actions','POST',body);posted=true;}const confirmed=await api<{notices:Notice[]}>('/notifications');if(!alive.current)return;setPending(null);
      setRows(confirmed.notices);lastRows.current=confirmed.notices;setUnread(confirmed.notices.some(n=>!n.read));setState('ready');
    }catch{if(alive.current){setPending({body,state:'failed',all,confirmed:posted});if(posted){setRows([]);setState('failed');}}}

  }
  async function target(row:Notice){++epoch.current;opening.current=row;setState('loading');setRows([]);
    try{const r=await api<{boardId:string;threadId:string;comment:Comment}>(`/notifications/${row.id}/open`);if(!alive.current)return;
      notificationNavigation.target={boardId:r.boardId,threadId:r.threadId,commentId:r.comment.id,noticeId:row.id,source:location.hash};location.hash='#/b/'+r.boardId;
    }catch(error){if(!alive.current)return;setRows([]);if(error instanceof ApiError&&error.status===404){setState('unavailable');lastRows.current=lastRows.current.filter(n=>n.id!==row.id);setUnread(lastRows.current.some(n=>!n.read));unavailable();}else setState('openFailed');}
  }
  const failure=(row?:Notice)=>pending&&(!row?pending.all:!pending.all&&pending.body.seen.some(n=>n.id===row.id));
  const note=pending?.body.action==='dismiss'?'Dismissal not saved. Retry when you’re online.':'Read status not saved. Retry when you’re online.';
  function retry(){if(pending)void act(pending.body,pending.all,pending.confirmed);}
  return <><button ref={bell} className="w2-bell" aria-label="Notifications" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void refresh();}}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.7 16.3a2.4 2.4 0 0 0 4.6 0M4 13.8h12l-1.5-2.3V8a4.5 4.5 0 0 0-9 0v3.5L4 13.8Z"/></svg>
    {unread&&<span className="w2-bell-dot" aria-label="Unread mentions"/>}
  </button>
  {open&&<div ref={panel} className="w2-inbox" role="region" aria-label="Notifications" onKeyDown={e=>{if(e.key==='Escape'&&!menu){e.preventDefault();setOpen(false);bell.current?.focus();}}}>
    <div className="w2-inbox-head"><strong>Notifications</strong><button className="w2-mark-all" disabled={state!=='ready'||!rows.some(n=>!n.read)||!!pending} onClick={()=>void act({action:'read',seen:rows.map(n=>({id:n.id,version:n.version}))},true)}>{pending?.all&&pending.state==='sending'?'Marking…':'Mark all as read'}</button><button className="comment-icon" aria-label="Close notifications" onClick={()=>{setOpen(false);bell.current?.focus();}}><CommentIcon name="close"/></button></div>
    <div className="w2-limit">Latest 50 mentions · All workspaces</div>
    {pending?.all&&<div className="comment-note amber w2-short-note" role="status">{pending.state==='sending'?'Marking the retained list as read…':<>{note}<button onClick={retry}>Retry</button></>}</div>}
    {state==='ready'&&rows.map(row=><div key={row.id} className={'w2-notice'+(!row.read?' unread':'')}>
      <span className="comment-avatar" style={{background:authorColour(row.comment.person)}}>{row.comment.label[0]?.toUpperCase()}</span>
      <button className="w2-notice-open" data-notice={row.id} onClick={()=>void target(row)}><span><strong>{row.comment.label}</strong> mentioned you{!row.read&&<span className="w2-unread-dot"/>}</span><small>{row.title} · {row.workspace}</small><span className="w2-preview"><MentionText text={row.comment.text} mentions={row.comment.mentions}/></span><small>{timeWords(row.createdAt)}</small></button>
      <button className="comment-icon" aria-label={`Actions for notification from ${row.comment.label}`} disabled={!!pending} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setMenu({opener:e.currentTarget,point:{x:Math.max(12,r.right-208),y:r.bottom+6},row});}}><CommentIcon name="more"/></button>
      {failure(row)&&<div className="w2-notice-status" role="status">{pending?.state==='sending'?'Saving…':<>{note}<button onClick={retry}>Retry</button></>}</div>}
    </div>)}
    {(state!=='ready'||!rows.length)&&<div className={'w2-inbox-state'+(['failed','openFailed'].includes(state)?' error':'')} role={state==='failed'||state==='openFailed'?'alert':'status'}>
      <strong>{state==='loading'?'Loading notifications…':state==='failed'?"Couldn't load notifications":state==='openFailed'?"Couldn't open this discussion":state==='unavailable'?'This discussion is no longer available.':'No mentions yet'}</strong>
      {state==='ready'&&<p>When someone mentions you in a board discussion, it will appear here.</p>}
      {(state==='failed'||state==='openFailed')&&<><p>Board’s server didn’t answer. Try again.</p><button onClick={()=>state==='openFailed'&&opening.current?void target(opening.current):pending?retry():void refresh()}>Retry</button></>}
    </div>}
  </div>}
  {menu&&<HomeMenu className="w2-action-menu" position={menu} close={()=>setMenu(null)} entries={[{kind:'item',text:menu.row.read?'Mark as unread':'Mark as read',run:()=>void act({action:menu.row.read?'unread':'read',seen:[{id:menu.row.id,version:menu.row.version}]})},{kind:'item',text:'Dismiss notification',run:()=>void act({action:'dismiss',seen:[{id:menu.row.id,version:menu.row.version}]})}]}/>}
  </>;
}
