// SPDX-License-Identifier: Apache-2.0
import { useEffect,useLayoutEffect,useRef,useState } from 'react';
import { BoardLifecycle,lifecycleNavigation,type RowOperation } from './lifecycle';
import { lifecycleTime,restoreAllowed,resumedLabel,restoredNote,TRASH_AGE,type TrashRow } from './lifecycle-rules';
export function LifecycleDialog({controller:c,moved}:{controller:BoardLifecycle;moved:(workspace:string,board:string)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),kind=c.dialog,target=c.target;
  useLayoutEffect(()=>{
    if(!kind)return;const node=dialog.current!;node.showModal();
    (node.querySelector<HTMLElement>('button:not([disabled])')??node).focus();return()=>node.close();
  },[kind]);
  if(!kind)return null;
  const cancel=()=>c.cancel();
  const title=kind==='confirm'?'Move to trash?':kind==='moving'?'Moving to Trash…':kind==='move-failed'?'Couldn’t move board':kind==='move-uncertain'?'Move not confirmed':kind==='delete-confirm'?'Permanently delete?':'Permanently deleting…';
  return <dialog key={kind} ref={dialog} tabIndex={-1} className="team-dialog history-dialog w4-modal" aria-label={title}
    onCancel={e=>{e.preventDefault();cancel();}} onKeyDown={e=>{
      e.stopPropagation();if(e.key==='Escape'){e.preventDefault();cancel();}
      if(e.key==='Tab'){
        const controls=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
        const first=controls[0],last=controls.at(-1);
        if(!first){e.preventDefault();e.currentTarget.focus();}
        else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last!.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }}><h1>{title}</h1>
    {kind==='confirm'&&<><p><strong>{target?.title}</strong> · {target?.workspace}</p><p>Everyone will lose access, including people with this board open.</p><p>The current board, comments, permissions and unexpired history stay in Trash for 30 elapsed days. History keeps its original expiry dates.</p><p>If moved now, restore before <strong>{lifecycleTime(Date.now()+TRASH_AGE)}</strong>. The server confirms the exact deadline.</p></>}
    {kind==='moving'&&<p>Wait for Board to confirm. Everyone’s access is ending.</p>}
    {kind==='move-failed'&&<><p className="comment-note error" role="alert">The board was not moved. Everyone still has their current access.</p><p>Try again when Board’s server is available.</p></>}
    {kind==='move-uncertain'&&<><p className="comment-note amber" role="alert">Board has not confirmed whether the move completed. Do not assume the board is available.</p><p>Retry checks the same move request. It will not move the board twice.</p></>}
    {kind==='delete-confirm'&&<><p><strong>{target?.title}</strong> · {target?.workspace}</p><p>This cannot be undone. Everyone’s access has ended. Board will remove this board, its comments, history and Board-managed backup copies.</p><p>Downloaded files and provider recovery copies are not erased by this action.</p></>}
    {kind==='deleting'&&<p>Access has ended. Wait for Board to confirm deletion.</p>}
    <div className="history-dialog-actions">
      {['confirm','move-failed','delete-confirm'].includes(kind)&&<button onClick={cancel}>Cancel</button>}
      {kind==='moving'||kind==='deleting'?<button disabled>{kind==='moving'?'Moving…':'Deleting…'}</button>:
        <button className={kind==='move-uncertain'?'primary':'w4-destructive'} onClick={()=>void(kind==='delete-confirm'?c.confirmDelete():c.confirmMove(moved))}>
          {kind==='confirm'?'Move to trash':kind==='delete-confirm'?'Permanently delete':'Retry'}</button>}
    </div></dialog>;
}
const explanation='Only workspace owners can open Trash. Boards stay here for 30 elapsed days. Nobody can open them until restored. History keeps its original expiry dates; old mention notices do not return.';
export function Trash({controller:c,workspaceId,workspace}:{controller:BoardLifecycle;workspaceId:string;workspace:string}) {
  const [clock,setClock]=useState(0);
  const heading=useRef<HTMLHeadingElement>(null),stateHeading=useRef<HTMLElement>(null),list=useRef<HTMLDivElement>(null);
  useEffect(()=>{void c.load(workspaceId);return()=>c.clear();},[workspaceId]);
  useEffect(()=>{
    const deadlines=c.rows.filter((row):row is Extract<TrashRow,{state:'trashed'}>=>row.state==='trashed').map(row=>row.restoreBefore).filter(at=>at>Date.now());
    if(!deadlines.length)return;
    const timer=setTimeout(()=>setClock(value=>value+1),Math.min(2147483647,Math.max(1,Math.min(...deadlines)-Date.now())));
    return()=>clearTimeout(timer);
  },[c.rows,clock]);
  const focusKey=[c.state,c.rows.map(row=>row.state).join(),...[...c.rowOperations.values()].map(op=>op.kind),c.dialog].join(':');
  useLayoutEffect(()=>{
    if(c.dialog)return;
    if(c.state!=='ready'||!c.rows.length&&!c.rowOperations.size)stateHeading.current?.focus();
    else if([...c.rowOperations.values()].some(op=>op.kind==='restoring'))heading.current?.focus();
    else if([...c.rowOperations.values()].some(op=>op.kind==='restored'))list.current?.querySelector<HTMLElement>('[data-restored]')?.focus();
    else if([...c.rowOperations.values()].some(op=>['failed','uncertain'].includes(op.kind)))list.current?.querySelector<HTMLElement>('[data-lifecycle-retry]')?.focus();
    else if([...c.rowOperations.values()].some(op=>op.kind==='pending')||c.rows.some(row=>row.state!=='trashed'))list.current?.querySelector<HTMLElement>('[data-lifecycle-refresh]')?.focus();
    else heading.current?.focus();
  },[focusKey]);
  const refresh=(board:string)=>void c.refresh(workspaceId,board);
  const back=()=>{location.hash='#/files/'+workspaceId;};
  function pending(board:string,state:'moving'|'restoring'|'purging'='purging',standalone=false){return <div className="w4-row" key={board} role="status"><div className="w4-meta"><strong>{resumedLabel(state)}</strong>{state==='purging'&&<small>Access has ended. Stored data is still being removed.</small>}</div><div className="w4-row-actions"><button data-lifecycle-refresh onClick={()=>refresh(board)}>Refresh status</button></div>{standalone&&<p className="w4-message w4-row-state">Deletion will continue automatically. Refresh checks progress; it does not start another deletion.</p>}</div>;}
  function receipt(id:string,op:RowOperation){
    if(op.kind==='pending')return pending(id,'purging',true);
    if(op.kind!=='restored')return null;
    return <div key={id} className="w4-row" role="status"><div className="w4-meta"><strong>{op.target.title?op.target.title+' · ':''}Board restored</strong><small>Restored to {op.target.workspace||workspace} · Same board and link</small></div><div className="w4-row-actions"><button data-restored className="primary" onClick={()=>{lifecycleNavigation.restoredBoard=id;location.hash='#/b/'+id;}}>Open board</button></div><p className="w4-success w4-row-state">{restoredNote}</p></div>;
  }
  function row(row:TrashRow){
    if(row.state!=='trashed')return pending(row.boardId,row.state);
    const op=c.rowOperations.get(row.boardId),expired=!restoreAllowed(row.restoreBefore),busy=op?.kind==='restoring';
    const standaloneExpired=expired&&c.rows.length===1&&!c.rowOperations.size;
    return <div key={row.boardId} className="w4-row" role={op?.kind==='failed'||op?.kind==='uncertain'?'alert':undefined}>
      <div className="w4-meta"><strong>{row.title}</strong>{!standaloneExpired&&<small>Deleted {lifecycleTime(row.deletedAt)}</small>}<small>{expired?'Restore deadline passed':'Restore before'} {lifecycleTime(row.restoreBefore)}</small></div>
      <div className="w4-row-actions">{busy?<button disabled>Restoring…</button>:expired?<>{standaloneExpired&&<button disabled>Restore</button>}<button data-lifecycle-refresh onClick={()=>refresh(row.boardId)}>Refresh status</button></>:<>
        <button data-lifecycle-retry={op?.kind==='failed'||op?.kind==='uncertain'?true:undefined} className="primary" onClick={()=>void c.restore(row,workspace)}>{op?.kind==='failed'||op?.kind==='uncertain'?'Retry':'Restore'}</button>
        <button className="w4-danger" disabled={op?.kind==='uncertain'} onClick={e=>{const opener=e.currentTarget;c.delete(row,workspace,()=>opener.focus());}}>Permanently delete…</button>
      </>}</div>
      {expired&&<p className="w4-message w4-row-state">Restore deadline passed. Deletion pending.{standaloneExpired?' This board cannot be restored.':''}</p>}
      {op?.kind==='failed'&&<p className="w4-message w4-row-state">The board is still in Trash. Nothing was restored. Retry when Board’s server is available.</p>}
      {op?.kind==='uncertain'&&<p className="w4-message w4-row-state">Board has not confirmed the result. Retry checks the same restore request; it will not restore twice.</p>}
    </div>;
  }
  const empty=c.state==='ready'&&!c.rows.length&&!c.rowOperations.size;
  const state=c.state==='loading'?'Loading Trash…':c.state==='failed'?'Couldn’t load Trash':c.state==='denied'?'Trash is not available':c.state==='deleted'?'Board permanently deleted':'Trash is empty';
  const message=c.state==='failed'?'Board’s server didn’t answer. No cached boards are shown.':c.state==='denied'?'Only the current workspace owner can open Trash.':c.state==='deleted'?'Deletion is complete. This board cannot be restored.':empty?'Boards you move to Trash appear here.':'';
  return <><div className="w4-title"><h2 ref={heading} tabIndex={-1}>Trash</h2>{c.state!=='denied'&&<span className="home-chip">{workspace}</span>}</div>
    {c.state!=='denied'&&<p className="w4-explain">{explanation}</p>}
    {c.state==='ready'&&!empty?<div className="w4-list" ref={list}>{c.rows.map(row)}{[...c.rowOperations].map(([id,op])=>receipt(id,op))}</div>:
      <div className={'w4-state'+(c.state==='failed'?' error':'')} role={c.state==='failed'?'alert':'status'}><strong ref={stateHeading} tabIndex={-1}>{state}</strong>{message&&<p>{message}</p>}{c.state==='failed'?<button onClick={()=>void c.load(workspaceId)}>Retry</button>:['denied','deleted'].includes(c.state)&&<button onClick={back}>Back to workspace</button>}</div>}
    <LifecycleDialog controller={c} moved={()=>void c.load(workspaceId)}/></>;
}
