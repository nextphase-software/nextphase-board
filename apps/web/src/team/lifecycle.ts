// SPDX-License-Identifier: Apache-2.0
import { api,ApiError } from './api';
import { lifecycleRequest,uniqueTrash,type LifecycleResult,type TrashRow } from './lifecycle-rules';
export const lifecycleNavigation:{unavailable?:boolean;restoredBoard?:string;focusWorkspace?:string}={};
export type LifecycleTarget={boardId:string;workspaceId:string;title:string;workspace:string;cycle:number};
export type RowOperation={kind:'restoring'|'failed'|'uncertain'|'restored'|'pending';target:LifecycleTarget;request?:ReturnType<typeof lifecycleRequest>;path:string};
export class BoardLifecycle {
  rows:TrashRow[]=[];
  state:'loading'|'ready'|'failed'|'denied'|'deleted'='loading';
  dialog:'confirm'|'moving'|'move-failed'|'move-uncertain'|'delete-confirm'|'deleting'|null=null;
  target?:LifecycleTarget;
  operation?:{path:string;body:ReturnType<typeof lifecycleRequest>};
  rowOperations=new Map<string,RowOperation>();
  private epoch=0;
  private listeners=new Set<()=>void>();
  private opener?:()=>void;
  private returnFocus?:()=>void;
  subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
  private emit(){for(const fn of this.listeners)fn();}
  clear(){this.epoch++;this.rows=[];this.target=undefined;this.operation=undefined;this.dialog=null;this.rowOperations.clear();this.opener=undefined;this.returnFocus=undefined;}
  deny(){this.clear();this.state='denied';this.emit();}
  async load(workspace:string) {
    const epoch=++this.epoch;this.rows=[];this.rowOperations.clear();this.state='loading';this.emit();
    try {
      const rows:TrashRow[]=[];let cursor:string|null=null;const cursors=new Set<string>();
      do {
        const reply:{boards:TrashRow[];nextCursor:string|null}=await api<{boards:TrashRow[];nextCursor:string|null}>(`/workspaces/${workspace}/trash${cursor?'?cursor='+encodeURIComponent(cursor):''}`);
        if(epoch!==this.epoch)return;
        rows.push(...reply.boards);cursor=reply.nextCursor;
        if(cursor&&cursors.has(cursor))throw Error('Repeated Trash page');if(cursor)cursors.add(cursor);
      } while(cursor);
      this.rows=uniqueTrash(rows);this.state='ready';this.emit();
    }catch(error){if(epoch!==this.epoch)return;this.rows=[];this.state=error instanceof ApiError&&[401,403,404].includes(error.status)?'denied':'failed';this.emit();}
  }
  async move(target:Omit<LifecycleTarget,'cycle'>,opener:()=>void) {
    const epoch=++this.epoch;
    try {
      const current=await api<LifecycleResult>(`/boards/${target.boardId}/lifecycle`);
      if(epoch!==this.epoch)return;
      this.target={...target,cycle:current.cycle!};this.opener=opener;
      this.operation={path:`/boards/${target.boardId}/trash`,body:lifecycleRequest(current.cycle!)};
      this.dialog='confirm';this.emit();
    }catch(error){if(epoch!==this.epoch)return;if(error instanceof ApiError&&[401,403,404].includes(error.status))this.deny();else{this.state='failed';this.emit();}}
  }
  cancel(){if(this.dialog!=='confirm'&&this.dialog!=='delete-confirm'&&this.dialog!=='move-failed')return;this.returnFocus=this.opener;this.dialog=null;this.emit();}
  restoreFocus(){const focus=this.returnFocus;this.returnFocus=undefined;focus?.();}
  async confirmMove(done:(workspace:string,board:string)=>void) {
    if(!this.operation||!this.target||this.dialog==='moving')return;
    const epoch=this.epoch,op=this.operation,target=this.target;
    this.dialog='moving';this.emit();
    try {
      const result=await api<LifecycleResult>(op.path,'POST',op.body);if(epoch!==this.epoch)return;
      if(result.state==='trashed'||result.state==='purging'||result.state==='deleted'){
        this.dialog=null;this.target=undefined;done(target.workspaceId,target.boardId);
      }else this.dialog='move-uncertain';
    }catch(error){if(epoch!==this.epoch)return;
      if(error instanceof ApiError&&[401,403,404].includes(error.status)){this.deny();return;}
      this.dialog=error instanceof ApiError&&error.reason==='move_failed'?'move-failed':'move-uncertain';
    }this.emit();
  }
  async restore(row:TrashRow,workspace:string) {
    if(row.state!=='trashed')return;
    const old=this.rowOperations.get(row.boardId);
    const operation:RowOperation=old&&['failed','uncertain'].includes(old.kind)?old:{kind:'restoring',target:{boardId:row.boardId,workspaceId:row.workspaceId,title:row.title,workspace,cycle:row.cycle},request:lifecycleRequest(row.cycle),path:`/workspaces/${row.workspaceId}/trash/${row.boardId}/restore`};
    const epoch=this.epoch;operation.kind='restoring';this.rowOperations.set(row.boardId,operation);this.emit();
    try {
      const result=await api<LifecycleResult>(operation.path,'POST',operation.request);if(epoch!==this.epoch)return;
      this.apply(result,operation);
    }catch(error){if(epoch!==this.epoch)return;if(error instanceof ApiError&&[401,403,404].includes(error.status)){this.deny();return;}
      operation.kind=error instanceof ApiError&&error.reason==='restore_failed'?'failed':'uncertain';
    }this.emit();
  }
  private apply(result:LifecycleResult,operation?:RowOperation) {
    if(result.state==='active') {
      const target=operation?.target??{boardId:result.boardId,workspaceId:result.workspaceId,title:'',workspace:'',cycle:result.cycle!};
      this.rowOperations.set(result.boardId,{kind:'restored',target,request:operation?.request,path:''});
      this.rows=this.rows.filter(row=>row.boardId!==result.boardId);
    } else if(result.state==='deleted'){this.rows=this.rows.filter(row=>row.boardId!==result.boardId);this.rowOperations.delete(result.boardId);this.state='deleted';}
    else if(result.state==='purging'){this.rows=this.rows.filter(row=>row.boardId!==result.boardId);this.rowOperations.set(result.boardId,{kind:'pending',target:{boardId:result.boardId,workspaceId:result.workspaceId,title:'',workspace:'',cycle:result.cycle!},request:operation?.request,path:''});}
    else if(operation)operation.kind='uncertain';
  }
  delete(row:TrashRow,workspace:string,opener:()=>void){
    if(row.state!=='trashed')return;this.target={boardId:row.boardId,workspaceId:row.workspaceId,title:row.title,workspace,cycle:row.cycle};
    this.operation={path:`/workspaces/${row.workspaceId}/trash/${row.boardId}/delete`,body:lifecycleRequest(row.cycle)};
    this.opener=opener;this.dialog='delete-confirm';this.emit();
  }
  async confirmDelete(){
    if(!this.operation||!this.target||this.dialog==='deleting')return;
    const epoch=this.epoch,target=this.target,op=this.operation;
    this.rows=this.rows.filter(row=>row.boardId!==target.boardId);
    this.rowOperations.set(target.boardId,{kind:'pending',target:{...target,title:''},request:op.body,path:''});
    this.target={...target,title:''};this.dialog='deleting';this.emit();
    try{const result=await api<LifecycleResult>(op.path,'POST',op.body);if(epoch!==this.epoch)return;this.apply(result);}
    catch(error){if(epoch!==this.epoch)return;if(error instanceof ApiError&&[401,403,404].includes(error.status)){this.deny();return;}}
    this.dialog=null;this.target=undefined;this.emit();
  }
  async refresh(workspace:string,board:string){
    const epoch=this.epoch,op=this.rowOperations.get(board);
    try{const result=await api<LifecycleResult>(`/workspaces/${workspace}/trash/${board}/status`);if(epoch!==this.epoch)return;
      if(result.state==='active'||result.state==='deleted'||result.state==='purging'){this.apply(result,op);this.emit();}
      else await this.load(workspace);
    }catch(error){if(epoch!==this.epoch)return;if(error instanceof ApiError&&[401,403,404].includes(error.status))this.deny();}
  }
}
