// SPDX-License-Identifier: Apache-2.0
import { boundedJournal, type Lifecycle, type LifecycleRequest } from 'nextphase-board-room/lifecycle.ts';
import { RoomError } from 'nextphase-board-room/protocol.ts';
import type { Runtime } from './runtime.ts';
export function operationResult(row:Lifecycle) {
  return { boardId:row.boardId,workspaceId:row.workspaceId,state:row.state,cycle:row.cycle,generation:row.generation,
    deletedAt:row.deletedAt,restoreBefore:row.restoreBefore };
}
export async function owner(runtime:Pick<Runtime,'db'>, caller:string, workspace:string|null, board:string|null) {
  return runtime.db.rpc<string>('lifecycle_owner',{caller,workspace,board});
}
export async function active(runtime:Pick<Runtime,'db'>,board:string,ticket=false) {
  const row=await runtime.db.lifecycle(board);
  if (!row || row.state!=='active') throw new RoomError(ticket?401:404,ticket?'ticket_invalid':'not_found');
  return row;
}
const work = new WeakMap<Runtime['db'],Map<string,Promise<Lifecycle>>>();
export function continueLifecycle(runtime:Runtime,board:string):Promise<Lifecycle> {
  let pending=work.get(runtime.db);if(!pending){pending=new Map();work.set(runtime.db,pending);}
  const old=pending.get(board);if(old)return old;
  const task=advance(runtime,board).finally(()=>pending!.delete(board));pending.set(board,task);return task;
}
async function advance(runtime:Runtime,board:string):Promise<Lifecycle> {
  await runtime.db.lifecycle(board);
  let row=await runtime.db.rpc<Lifecycle>('lifecycle_tick',{board,at_ms:runtime.now()});
  if (!row) throw new RoomError(404,'not_found');
  if(row.state==='deleted') {
    await runtime.removeRoom(board,row.generation);
    await runtime.db.rpc('cleanup_recovered_deleted',{board});
    return row;
  }
  try {
    while (row.operationId && ['moving','restoring','purging'].includes(row.state)) {
      const independent=await runtime.fenceGeneration(board);
      if(independent>row.generation) {
        row=await runtime.db.rpc<Lifecycle>('lifecycle_raise',{board,operation:row.operationId,minimum:independent});
        await runtime.db.lifecycle(board);
        if(row.state!=='purging'){
          await runtime.room(board).fenceLifecycle(row,row.state==='restoring');
          await runtime.db.rpc('lifecycle_delivery_clear',{board,operation:row.operationId,generation:row.generation});
        }
      }
      const parameters={board,operation:row.operationId,generation:row.generation};
      let next:string;
      if (row.state==='purging') {
        if (row.phase==='admitted') { await runtime.removeRoom(board,row.generation);next='room_removed'; }
        else if (row.phase==='room_removed') { await runtime.db.rpc('lifecycle_cleanup',parameters);next='sql_removed'; }
        else if(row.phase==='sql_removed') next='deleted';
        else throw Error('Invalid lifecycle phase');
      } else if (row.phase==='admitted') { await runtime.room(board).fenceLifecycle(row);next='room_fenced'; }
      else if(row.state==='moving' && row.phase==='room_fenced') {
        await runtime.db.rpc('lifecycle_delivery_clear',parameters);next='delivery_cleared';
      } else if(row.state==='restoring' && row.phase==='room_fenced') {
        await runtime.room(board).fenceLifecycle(row,true);
        await runtime.db.rpc('lifecycle_delivery_clear',parameters);
        const page=await runtime.db.changes(board,0);
        await runtime.db.rpc('record_access_receipt',{board,through:page.latest});next='access_ready';
      } else if(row.phase==='delivery_cleared'||row.phase==='access_ready') next='idle';
      else throw Error('Invalid lifecycle phase');
      row=await runtime.db.rpc<Lifecycle>('lifecycle_step',{...parameters,before_phase:row.phase,after_phase:next,at_ms:runtime.now()});
      if (!row) throw Error('Missing lifecycle authority');
      await runtime.db.lifecycle(board);
    }
    return row;
  } catch(error) {
    await runtime.db.rpc('lifecycle_retry',{board,operation:row.operationId,at_ms:runtime.now()});
    // A phase failure keeps the accepted operation denied and resumable.
    const current=await runtime.db.lifecycle(board);
    if (!current) throw error;
    return current;
  }
}
export async function mutateLifecycle(runtime:Runtime,board:string,request:LifecycleRequest) {
  const row=await runtime.db.lifecycle(board);
  if(row?.state==='deleted') {
    if(request.operation==='restore')throw new RoomError(409,'trash_expired');
    return row;
  }
  const accepted=await runtime.db.rpc<Lifecycle|null>('lifecycle_request_status',{board,caller:request.person,request:request.requestId,digest:request.digest,operation:request.operation,expected_cycle:request.expectedCycle});
  if (!accepted) {
    if(row?.state==='active' && request.operation==='move')await runtime.room(board).admitLifecycle(request);
    else await runtime.db.admitLifecycle(board,request,runtime.now(),await runtime.fenceGeneration(board));
  }
  return continueLifecycle(runtime,board);
}
export async function discoverLifecycle(runtime:Runtime) {
  const at=runtime.now();
  const seen=new Set<string>();
  for (;;) {
    const batch=await runtime.db.rpc<string[]>('lifecycle_due',{at_ms:at});
    if(!batch.length || batch.every(board=>seen.has(board)))return;
    for(const board of batch) {
      if(seen.has(board))continue;seen.add(board);
      try { await continueLifecycle(runtime,board); }
      catch { /* Required source outage is not successful cleanup. */ }
      // Even a failed source read cannot spin forever on one due batch.
      await runtime.db.rpc('lifecycle_retry',{board,operation:(await runtime.db.lifecycle(board))?.operationId??null,at_ms:at});
    }
  }
}

// Independent runner ledger: one bounded metadata record per board, never a room backup.
export type RecoveryRecord = {boardId:string;workspaceId:string;generation:number} | {authority:Lifecycle;request:Record<string,unknown>|null};
export function ledgerRecord(row:Lifecycle,request:Record<string,unknown>|null):RecoveryRecord {
  const record=row.state==='deleted'?{boardId:row.boardId,workspaceId:row.workspaceId,generation:row.generation}:{authority:row,request};
  let journal:string;try{journal=boundedJournal(record);}catch{throw new RoomError(503,'service_unavailable');}
  if(new TextEncoder().encode(JSON.stringify({board_id:row.boardId,record:journal})).length>=131072)throw new RoomError(503,'service_unavailable');
  return record;
}
export function checkLedger(previous:RecoveryRecord|null,row:Lifecycle|null) {
  if(!previous)return;
  const old='authority'in previous?previous.authority:null;
  const generation=old?.generation??('generation'in previous?previous.generation:NaN);
  if(!row||!Number.isSafeInteger(generation)||generation>row.generation)throw new RoomError(503,'service_unavailable');
  if(!old){if(row.state!=='deleted')throw new RoomError(503,'service_unavailable');return;}
  if(old.workspaceId!==row.workspaceId||old.cycle!==null&&row.cycle!==null&&old.cycle>row.cycle)throw new RoomError(503,'service_unavailable');
  if(generation===row.generation){
    const phases=['admitted','room_fenced','delivery_cleared','access_ready','room_removed','sql_removed'];
    if(row.operationId===old.operationId && phases.indexOf(row.phase??'')<phases.indexOf(old.phase??''))throw new RoomError(503,'service_unavailable');
    if(old.state==='purging'&&row.state!=='purging'&&row.state!=='deleted')throw new RoomError(503,'service_unavailable');
    if(old.state==='moving'&&row.state==='active'||old.state==='restoring'&&row.state==='trashed')throw new RoomError(503,'service_unavailable');
  }
}
