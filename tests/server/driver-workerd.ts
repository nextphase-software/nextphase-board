// SPDX-License-Identifier: Apache-2.0
import { env, SELF, evictDurableObject, runInDurableObject, createExecutionContext,
  createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import worker from "./worker-test.ts";
import { peer } from "./peer.ts";
import type { Context, Driver } from "./driver-types.ts";
import { decodeBackup, replace } from "../../packages/board-room/src/backups.ts";
const bindings = env as any;
export async function makeDriver(context: Context): Promise<Driver> {
  const rooms = new Set<string>();
  const roomStub = (board: string) => { rooms.add(board); return bindings.ROOMS.get(bindings.ROOMS.idFromName(board)); };
  return {
    runner: "workerd",
    request: (path, init) => {
      const match = /\/boards\/([0-9a-f-]{36})/.exec(path);
      if (match) rooms.add(match[1]);
      return SELF.fetch("http://board" + path, init);
    },
    async connect(path, origin = context.origin) {
      const response = await SELF.fetch("http://board" + path, { headers: { Upgrade: "websocket", Origin: origin } });
      if (response.status !== 101 || !response.webSocket) throw Error("Upgrade refused " + response.status);
      const socket = response.webSocket;
      const result = peer(socket);
      socket.accept();
      return result;
    },
    async control(value) {
      if (value.heldRoomCount) return runInDurableObject(bindings.CONTROLS.get(bindings.CONTROLS.idFromName('controls')), (instance:any) => instance.held.size);
      if (value.board && value.reactions) return runInDurableObject(roomStub(String(value.board)), async (instance:any) => {
        const v = value.reactions as any;
        if (v.reconstruct) instance.room = undefined;
        const room = await instance.getRoom(String(value.board));
        return room.ordered(async () => {
          await instance.refreshControls(); await room.load();
          if (Object.hasOwn(v, 'failAdmission')) {
            const reactions = room.reactions, target = reactions as any;
            target.readAdmission ??= reactions.admitted.bind(reactions);
            reactions.admitted = (c:any, admission:Parameters<typeof reactions.admitted>[1]) => {
              if (c.attachment().id === v.failAdmission) throw Error('Required current admission read unavailable');
              return target.readAdmission(c, admission);
            };
          }
          for (const c of room.env.connections()) {
            if (v.connection && c.attachment().connectionId !== v.connection) continue;
            const a = c.attachment();
            if (v.patch) c.attach({ ...a, ...v.patch });
            if (v.maximal) c.attach({ ...a, label: '"'.repeat(256), presence: { ...a.presence, label: '"'.repeat(256), selection: Array.from({length:250}, () => crypto.randomUUID()) },
              ...Object.fromEntries(['presenceTimes','timerTimes','timerReadTimes','voteTimes','voteReadTimes','spotlightTimes','spotlightReadTimes','reactionTimes'].map(k => [k, Array(k === 'presenceTimes' ? 10 : 5).fill(Number.MAX_SAFE_INTEGER)])) });
          }
          return { attachments: room.env.connections().map((c:any) => c.attachment()), tables: room.env.storage.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB '_cf_*' AND name NOT GLOB 'sqlite_*' ORDER BY name"), meta: room.env.storage.all('SELECT * FROM meta ORDER BY key') };
        });
      });
      if(value.board&&value.spotlight)return runInDurableObject(roomStub(String(value.board)),async(instance:any)=>{
        const v=value.spotlight as any;if(v.reconstruct)instance.room=undefined;
        const room=await instance.getRoom(String(value.board));
        if(v.adapterEvents){
          const socket=instance.state.getWebSockets().find((s:any)=>s.deserializeAttachment().connectionId===v.connection);
          if(!socket)throw Error('Adapter socket missing');
          for(const event of v.adapterEvents){if(event==='error')await instance.webSocketError(socket);else await instance.webSocketClose(socket,event.code,event.reason??'');}
        }
        return room.ordered(async()=>{
          await instance.refreshControls();if(!v.inspect){await room.load();await room.spotlight.recover();}
          const peers=room.env.connections(),c=peers.find((p:any)=>p.attachment().connectionId===v.connection);
          if(v.watchCloses&&!(room as any).spotlightCloses){const target=room as any,closed=target.closed.bind(target);target.spotlightCloses=[];target.closed=(c:any,code=1006,reason='')=>{target.spotlightCloses.push({connection:c.attachment().connectionId,code,reason});return closed(c,code,reason);};}
          if(v.controlVersion!==undefined){room.spotlight.session.controlVersion=v.controlVersion;for(const p of peers){const a=p.attachment();if(a.spotlightPresenter)p.attach({...a,spotlightPresenter:{...a.spotlightPresenter,session:room.spotlight.session}});}}
          if(c&&v.suspend)room.spotlight.closed(c,1011,"error");
          if(c&&v.member)c.attach({...c.attachment(),spotlightMember:{sessionId:room.spotlight.session.sessionId,...v.member}});
          if(v.voteFailure){
            const target=room as any,voting=target.voting,flush=target.spotlight.flush.bind(target.spotlight);
            target.spotlight.flush=async()=>{if(voting.running()){target.spotlightBoundary={session:structuredClone(target.spotlight.session),attachments:target.env.connections().map((p:any)=>p.attachment())};target.spotlight.flush=flush;}return flush();};
            if(v.voteFailure==='reply'){
              const send=voting.send;voting.send=function(c:any,frame:any){if(frame.kind!=='vote_result')return send.call(this,c,frame);this.send=send;throw Error('Injected vote reply failure');};
            }else{
              const stamp=voting.stamp;voting.stamp=async function(c:any){this.stamp=stamp;if(v.voteFailure==='stamp')throw Error('Injected vote stamp failure');const authority=this.authority;this.authority=async function(){this.authority=authority;throw Error('Injected post-commit authority failure');};return stamp.call(this,c);};
            }
          }

          return {closes:(room as any).spotlightCloses,boundary:(room as any).spotlightBoundary,session:room.spotlight.session,attachments:room.env.connections().map((c:any)=>c.attachment())};
        });
      });
      if(value.board && value.providerRecovery) {
        // Stand in for the independent reservation surviving a provider rewind;
        // deliberately do not write a marker into the room being recovered.
        const fence=bindings.FENCES.get(bindings.FENCES.idFromName(String(value.board)));
        const response=await fence.fetch('http://fence/recover',{method:'POST'});
        if(!response.ok)throw Error('Recovery fence unavailable');
        return response.json();
      }
      if(value.board&&(value.votingAttachments||value.staleVotingPresence))return runInDurableObject<DurableObject,any>(roomStub(String(value.board)),async(instance:any)=>{
        const sockets=instance.state.getWebSockets();
        if(value.staleVotingPresence)for(const s of sockets){const a=s.deserializeAttachment();if(a.presence)s.serializeAttachment({...a,presence:{...a.presence,cursor:{x:98765,y:12345},selection:[value.target],view:{x:98765,y:12345,width:100,height:100}}});}
        return sockets.map((s:any)=>s.deserializeAttachment());
      });
      if(value.board&&value.timerAttachments)return runInDurableObject<DurableObject,any>(roomStub(String(value.board)),async(instance:any)=>instance.state.getWebSockets().map((s:any)=>{const a=s.deserializeAttachment();return {timerTimes:a.timerTimes??[],timerReadTimes:a.timerReadTimes??[]};}));
      if(value.board&&value.inventory){return runInDurableObject(roomStub(String(value.board)),async(instance:any)=>({tables:instance.state.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%'").toArray(),alarm:await instance.state.storage.getAlarm()}));}
      if (value.board && value.fences) {
        const stub = bindings.FENCES.get(bindings.FENCES.idFromName(String(value.board)));
        const result = await stub.fetch('http://fence/read').then((response: Response) => response.json()) as { generation: number };
        return result.generation;
      }
      if (value.board && value.legacyStorage !== undefined) {
        const stub = roomStub(String(value.board));
        await runInDurableObject<DurableObject, void>(stub, async (instance: any) => {
          const room = await instance.getRoom(String(value.board)), storage = room.env.storage;
          await room.ordered(async () => {
            storage.transaction(() => {
              for (const table of ["threads", "comments", "comment_ids", "comment_counts"]) storage.exec(`DROP TABLE IF EXISTS "${table}"`);
              if (storage.all("PRAGMA table_info(receipts)").some((column: any) => column.name === "kind")) storage.exec("ALTER TABLE receipts DROP COLUMN kind");
              storage.exec("DELETE FROM meta WHERE key IN ('storage_version', 'comment_sequence')");
              if (value.legacyStorage) storage.exec("INSERT INTO meta VALUES ('storage_version', ?)", Number(value.legacyStorage));
            });
            room.initialized = false;
          });
        });
        // S121 calls wake() next; it owns eviction before the next storage open.
        return {};
      }
      if (value.board && (value.raiseFence || value.markRecovery || value.roomSQL || value.failInitialization || value.deliverMentions || value.settled)) {
        return runInDurableObject(roomStub(String(value.board)), async (instance:any) => {
          const room=await instance.getRoom(String(value.board)), storage=room.env.storage;
          if(value.raiseFence)return room.lock();
          if(value.markRecovery)await room.ordered(async()=>{const {markExplicitRecovery}=await import("../../packages/board-room/src/timer.ts");markExplicitRecovery(storage);room.initialized=false;});
          if(value.settled)await room.ordered(async()=>{});
          if(value.roomSQL)await room.ordered(async()=>{for(const item of value.roomSQL)storage.exec(item.sql,...(item.bindings??[]));});
          if(value.failInitialization){const execute=storage.exec.bind(storage);storage.exec=(sql:string,...args:any[])=>{if(sql.includes("CREATE TABLE IF NOT EXISTS mention_pending"))throw Error("initialization rollback");execute(sql,...args);};try{const {initialize}=await import("../../packages/board-room/src/storage.ts");initialize(storage);}finally{storage.exec=execute;}}
          if(value.deliverMentions)await room.deliverNotices();
        });
      }
      if (value.scheduled) {
        const execution = createExecutionContext();
        await worker.scheduled(createScheduledController({ cron: "* * * * *" }), bindings, execution);
        await waitOnExecutionContext(execution);
        return {};
      }
      const control = bindings.CONTROLS.get(bindings.CONTROLS.idFromName("controls"));
      const response = await control.fetch("http://controls/", { method: "POST", body: JSON.stringify(value) });
      const result = await response.json();
      if (value.board && value.alarm) await runInDurableObject(roomStub(String(value.board)), async (instance: any) => instance.alarm());
      if (value.alarmAll) for (const board of rooms) await runInDurableObject(roomStub(board), async (instance: any) => instance.alarm());
      if (value.now) return Date.now() + ((result as any).offset ?? 0);
      return result;
    },
    async wake(board) { await evictDurableObject(roomStub(board)); },
    async restoreFile(board, envelope, fenced) {
      const stub = roomStub(board);
      await runInDurableObject(stub, async (instance: any) => {
        const room = await instance.getRoom(board);
        if (fenced) await room.lock();
        await room.ordered(async () => {
          replace(room.env, decodeBackup(envelope, board));
          if(fenced){const {markExplicitRecovery}=await import("../../packages/board-room/src/timer.ts");markExplicitRecovery(room.env.storage);}
          // A real point-in-time restore replaces storage at the next session.
          // Queued close callbacks must read that copy, not snapshot old RAM.
          room.initialized = false;
        });
      });
      await evictDurableObject(stub);
    },
    async rows(board, table) {
      return runInDurableObject(roomStub(board), async (instance: any) => {
        const room = await instance.getRoom(board);
        // Read progress without waiting behind a held recovery operation.
        return room.env.storage.all(`SELECT * FROM "${table}"`).map((row: any) => Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value instanceof Uint8Array ? { bytes: value.byteLength } : value])));
      });
    },
    async close() {
      for (const board of rooms) {
        try { await evictDurableObject(roomStub(board), { webSockets: "close" }); }
        catch (error) { if (!(error instanceof Error) || !error.message.includes("not currently running")) throw error; }
      }
    },
  };
}
