// SPDX-License-Identifier: Apache-2.0
import { RoomError } from 'nextphase-board-room/protocol.ts';
import { safeInteger } from 'nextphase-board-room/lifecycle.ts';
import { continueLifecycle,mutateLifecycle,operationResult,owner } from '../lifecycle.ts';
import type { Runtime } from '../runtime.ts';
import { body,id,shape,uuid,type ServerApp,type ServerContext } from './common.ts';
function query(c:ServerContext,allowed:string[]=[]) {
  const keys=[...new URL(c.req.url).searchParams.keys()];
  if(keys.some(k=>!allowed.includes(k)) || new Set(keys).size!==keys.length)throw new RoomError(400,'bad_request');
}
export function lifecycleRoutes(app:ServerApp,runtime:Runtime) {
  app.get('/boards/:board/lifecycle',async c=>{
    const board=id(c,'board');await owner(runtime,c.get('person').id,null,board);query(c);
    const row=await runtime.db.lifecycle(board);
    if(!row||row.state!=='active')throw new RoomError(404,'not_found');
    return c.json({boardId:board,workspaceId:row.workspaceId,state:'active',cycle:row.cycle,generation:row.generation});
  });
  app.get('/workspaces/:workspace/trash',async c=>{
    const workspace=id(c,'workspace'),caller=c.get('person').id;await owner(runtime,caller,workspace,null);query(c,['cursor']);
    const encoded=c.req.query('cursor');let cursor:any=null;
    if(encoded!==undefined) {
      try {
        if(!encoded.length||encoded.length>512||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error();
        cursor=JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')));
        if(Object.keys(cursor).sort().join()!=='boardId,deletedAt,pending,workspace' || cursor.workspace!==workspace || !uuid.test(cursor.boardId)||
          typeof cursor.pending!=='boolean'||!(cursor.deletedAt===null||safeInteger(cursor.deletedAt)) || cursor.pending!==(cursor.deletedAt===null))throw Error();
      } catch {throw new RoomError(400,'bad_request');}
    }
    const rows=await runtime.db.rpc<any[]>('trash_page',{caller,workspace,pending:cursor?.pending??null,deleted_at:cursor?.deletedAt??null,after_id:cursor?.boardId??null});
    const selected=rows.slice(0,50),last=selected.at(-1);
    const boards=(await Promise.all(selected.map(async row=>{
      const current=await runtime.db.lifecycle(row.boardId);
      if(!current || current.state==='active'||current.state==='deleted')return null;
      if(current.state==='trashed' && current.cycle===row.cycle && row.state==='trashed')return row;
      return {boardId:current.boardId,workspaceId:current.workspaceId,state:current.state,cycle:current.cycle,generation:current.generation};
    }))).filter(row=>row!==null);
    const nextCursor=rows.length>50?btoa(JSON.stringify({workspace,boardId:last.boardId,pending:last.state!=='trashed',deletedAt:last.deletedAt??null})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''):null;
    await owner(runtime,caller,workspace,null);
    return c.json({boards,nextCursor});
  });
  app.get('/workspaces/:workspace/trash/:board/status',async c=>{
    const board=id(c,'board'),workspace=id(c,'workspace'),caller=c.get('person').id;
    await owner(runtime,caller,workspace,board);query(c);
    const row=await continueLifecycle(runtime,board);
    await owner(runtime,caller,workspace,board);return c.json(operationResult((await runtime.db.lifecycle(board)) ?? row));
  });
  for(const operation of ['move','restore','purge'] as const) {
    const path=operation==='move'?'/boards/:board/trash':`/workspaces/:workspace/trash/:board/${operation==='purge'?'delete':'restore'}`;
    app.post(path,async c=>{
      const board=id(c,'board'),workspace=operation==='move'?null:id(c,'workspace'),caller=c.get('person').id;
      await owner(runtime,caller,workspace,board);query(c);
      const value=await body(c,65536);shape(value,['requestId','expectedCycle']);
      if(typeof value.requestId!=='string'||!uuid.test(value.requestId)||!safeInteger(value.expectedCycle))throw new RoomError(400,'bad_request');
      const raw=new TextEncoder().encode(JSON.stringify([operation,workspace,board,value.requestId,value.expectedCycle]));
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(b=>b.toString(16).padStart(2,'0')).join('');
      const row=await mutateLifecycle(runtime,board,{person:caller,workspace,operation,requestId:value.requestId,expectedCycle:value.expectedCycle,digest});
      await owner(runtime,caller,workspace,board);
      const current=(await runtime.db.lifecycle(board)) ?? row;
      return c.json(operationResult(current),['moving','restoring','purging'].includes(current.state)?202:200);
    });
  }
}
