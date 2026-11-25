// SPDX-License-Identifier: Apache-2.0
import { deliver } from "../../apps/server/src/delivery.ts";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Room } from "../../packages/board-room/src/room.ts";
import { RoomError } from "../../packages/board-room/src/protocol.ts";
import { readFile } from "node:fs/promises";
import { Supabase } from "../../apps/server/src/supabase.ts";
import { startNode } from "../../apps/server/src/start-node.ts";
import { request as httpRequest } from "node:http";
import { readdir } from "node:fs/promises";
import { fixtureDial, nodeResolver, testAllow } from "./link-preview-fixtures.ts";
import { checkSettings } from "../../apps/server/src/settings.ts";
process.on("warning", ({ name, message }) => {
  process.send?.({ warning: { name, message } });
});
const settings = checkSettings(JSON.parse(await readFile(process.env.BOARD_SETTINGS!, "utf8")));
let fixedNow: number | null = null;
let offset = Number(process.env.BOARD_TEST_CLOCK_OFFSET ?? 0), unreachable: string[] = [];
let failTimer = "", failVoting = "";
let failCreate = "", failCheckpoint = "", failHistory = "", failLifecycle = "";
let holdRoom = ""; const heldRoom = new Set<() => void>();
const waitRoom = () => holdRoom ? new Promise<void>(resolve => heldRoom.add(resolve)) : Promise.resolve();
const instrumented = new WeakSet<object>();
const db = new Supabase(settings.supabaseUrl, settings.serviceKey);
const documentGeneration = db.documentGeneration.bind(db), mentionGeneration = db.mentionGeneration.bind(db);
db.documentGeneration = board => failCheckpoint === "document" ? Promise.reject(Error("Document checkpoint unavailable")) : documentGeneration(board);
db.mentionGeneration = board => failCheckpoint === "mention" ? Promise.reject(Error("Mention checkpoint unavailable")) : mentionGeneration(board);
const resolutions: { host: string; family: string }[] = [];
const socketRecords: unknown[] = [];
let linkNow: number | undefined, failLinkLimits = false, delayLinkLimits = false;
const httpPort = Number(process.env.LINK_FIXTURE_HTTP_PORT), httpsPort = Number(process.env.LINK_FIXTURE_HTTPS_PORT);
const transportPath = "../../apps/server/src/link-preview/transport-node.ts";
const limitsPath = "../../apps/server/src/link-preview/limits.ts";
let linkOptions: Pick<import("../../apps/server/src/start-node.ts").NodeOptions, "linkTransport" | "linkLimits"> = {};
let linkTransportForProof: import("../../apps/server/src/link-preview/fetcher.ts").LinkTransport | undefined;
try {
  const { createNodeTransport } = await import(transportPath) as typeof import("../../apps/server/src/link-preview/transport-node.ts");
  const { memoryLimits } = await import(limitsPath) as typeof import("../../apps/server/src/link-preview/limits.ts");
  if (httpPort && httpsPort) {
    const ca = process.env.LINK_FIXTURE_CA;
    if (!ca) throw Error("The test harness must supply the link preview fixture CA");
    const memory = memoryLimits(() => linkNow ?? Date.now());
    const linkTransport = { resolver: nodeResolver(resolutions), testAllow, testDial: fixtureDial(httpPort, httpsPort),
      ca, onSocket: (record: unknown) => socketRecords.push(record) };
    linkTransportForProof = createNodeTransport(linkTransport);
    linkOptions = { linkTransport, linkLimits: { async take(key) {
      if (failLinkLimits) throw Error("Fixture limiter unavailable");
      if (delayLinkLimits) await new Promise(resolve => setTimeout(resolve, 1500));
      return memory.take(key);
    } } };
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND") throw error;
}
const app = await startNode(settings, { ...linkOptions, db, now: () => fixedNow ?? Date.now() + offset, backupLimit: 16777216,
  deliveryIntervalMs: Number(process.env.BOARD_DELIVERY_INTERVAL_MS ?? 0) });
const original = app.runtime.room;
const discard=app.runtime.removeRoom.bind(app.runtime), guard=db.lifecycleGuard!;
db.lifecycleGuard=async(...args)=>{if(failLifecycle==='ledger')throw new RoomError(503,'service_unavailable');await guard(...args);};
app.runtime.removeRoom=async(...args)=>{if(failLifecycle==='discard')throw new RoomError(503,'service_unavailable');return discard(...args);};
app.runtime.room = (board) => {
  const room = original(board);
  const entry = app.rooms.get(board)!;
  if (!instrumented.has(entry)) {
    instrumented.add(entry);
    const message=entry.room.message.bind(entry.room);
    entry.room.message=async(...args)=>{await waitRoom();return message(...args);};
    const exec = entry.storage.exec.bind(entry.storage), raise = entry.room.env.raiseFence;
    entry.storage.exec = (sql, ...args) => {
      if ((failVoting === "session" && sql.startsWith("INSERT INTO workshop_vote ")) || (failVoting === "ballot" && sql.startsWith("INSERT INTO workshop_vote_ballots")) || (failVoting === "delete" && sql.startsWith("DELETE FROM workshop_vote_ballots"))) throw Error("Voting storage unavailable");
      if (failTimer === "write" && sql.startsWith("INSERT INTO workshop_timer")) throw Error("Timer storage unavailable");
      if (failHistory === "capture" && sql.startsWith("INSERT INTO versions") ||
        failHistory === "intent" && sql.startsWith("INSERT INTO history_requests") ||
        failHistory === "local" && sql.startsWith("INSERT INTO versions") && args[5] === "before_restore" ||
        failHistory === "cleanup" && sql.startsWith("DELETE FROM history_intent_chunks")) throw Error("History transaction unavailable");
      exec(sql,...args);
      if((failVoting === "after-ballot" && sql.startsWith("INSERT INTO workshop_vote_ballots")) || (failVoting === "after-delete" && sql.startsWith("DELETE FROM workshop_vote_ballots")))throw Error("Voting transaction unavailable");
    };
    entry.room.env.raiseFence = async minimum => {
      if (failHistory === "fence") throw Error("Fence unavailable");
      const result = await raise(minimum);
      if (failHistory === "after-fence") throw Error("Fence answer unavailable");
      return result;
    };
  }
  return { openImport: (...args) => room.openImport(...args), beginImport: (...args) => room.beginImport(...args),
    endImport: (...args) => room.endImport(...args), stageImportPicture: (...args) => room.stageImportPicture(...args),
    stageImportVideo: (...args) => room.stageImportVideo(...args), claimImport: (...args) => room.claimImport(...args),
    releaseImport: (...args) => room.releaseImport(...args), assetSizes: (...args) => room.assetSizes(...args),
    admitLifecycle: r => failLifecycle==='before' ? Promise.reject(new RoomError(503,r.operation==='move'?'move_failed':'restore_failed')) : room.admitLifecycle(r), fenceLifecycle: (r, ready) => failLifecycle==='room' ? Promise.reject(new RoomError(503,'service_unavailable')) : room.fenceLifecycle(r, ready), versions: p => room.versions(p), version: (p,id) => room.version(p,id), saveVersion: (p,v) => room.saveVersion(p,v), nameVersion: (p,id,v) => room.nameVersion(p,id,v), restoreVersion: (p,id,v) => room.restoreVersion(p,id,v), async create(document, importer, token) {
    if (failCreate === "before") throw Error("Create unavailable");
    const entry = app.rooms.get(board)!;
    if (failCreate === "exists") await entry.room.ordered(() => entry.room.load());
    const exec = entry.storage.exec.bind(entry.storage);
    if (failCreate === "write") entry.storage.exec = (sql, ...values) => {
      if (sql.startsWith("INSERT INTO snapshot_chunks")) throw Error("Snapshot write unavailable");
      exec(sql, ...values);
    };
    try { await room.create(document, importer, token); }
    finally { entry.storage.exec = exec; }
    if (failCreate === "after") throw Error("Create reply unavailable");
  }, rename: (p, title) => room.rename(p, title), ticket: (p) => room.ticket(p), export: (p) => room.export(p), backup: () => room.backup(), restore: (v) => room.restore(v),
    storeVideo: (...args) => room.storeVideo(...args), readVideo: (...args) => room.readVideo(...args),
    storePicture: (...args) => room.storePicture(...args), readPicture: (p, hash) => room.readPicture(p, hash),
    discussion: (p, id, occurrence) => room.discussion(p, id, occurrence), deliverNotices: () => room.deliverNotices(),
    changed: () => unreachable.includes(board) ? Promise.reject(Error("Room unavailable")) : room.changed() };
};
process.on("message", async (message: any) => {
  try {
    let result: any = {};
    const value = message.value;
    if (value.linkNow !== undefined) linkNow = typeof value.linkNow === "number" ? value.linkNow : undefined;
    if (value.failLinkLimits !== undefined) failLinkLimits = value.failLinkLimits === true;
    if (value.delayLinkLimits !== undefined) delayLinkLimits = value.delayLinkLimits === true;
    if (value.linkRecords) {
      process.send?.({ id: message.id, result: { resolutions, sockets: socketRecords } }); return;
    }
    if (value.linkInventory) {
      const inventory = await Promise.all(["boards", "template-media"].map(name => readdir(resolve(settings.dataDir, name))));
      process.send?.({ id: message.id, result: inventory.map(files => files.sort()) }); return;
    }
    if (value.linkManual) {
      result = await new Promise((resolve, reject) => {
        const req = httpRequest({ host: "127.0.0.1", port: httpPort, path: "/manual", method: "GET" }, response => {
          response.resume(); resolve({ status: response.statusCode, location: response.headers.location });
        });
        req.once("error", reject); req.end();
      });
      process.send?.({ id: message.id, result }); return;
    }
    if (value.linkPin && linkTransportForProof) {
      const exchange = await linkTransportForProof.request(new URL(`http://pin.test:${httpPort}/`), "127.0.0.1", {}, AbortSignal.timeout(2000));
      await exchange.body?.cancel();
      process.send?.({ id: message.id, result: exchange.status }); return;
    }
    if (value.overflowTimer) setTimeout(() => {}, 2 ** 31).unref();
    if(value.failLifecycle!==undefined)failLifecycle=value.failLifecycle;
    if(value.holdRoom!==undefined)holdRoom=value.holdRoom;
    if(value.releaseRoom){holdRoom='';for(const release of heldRoom)release();heldRoom.clear();}
    if(value.heldRoomCount){process.send?.({id:message.id,result:heldRoom.size});return;}
    if(value.scheduled)await deliver(app.runtime);
    if(value.lifecycleStatus){result=await db.lifecycle(value.board);process.send?.({id:message.id,result});return;}
    if(value.inventory){
      const files=[];for(const suffix of ['', '-wal','-shm']){try{await access(resolve(settings.dataDir,value.store ? 'template-media' : 'boards',value.board+'.sqlite'+suffix));files.push(suffix);}catch{}}
      result={files,loaded:app.rooms.has(value.board),timer:!!app.rooms.get(value.board)?.timer};process.send?.({id:message.id,result});return;
    }
    if (value.failVoting !== undefined) failVoting=value.failVoting;
    if (value.failTimer !== undefined) failTimer = value.failTimer;
    if (value.failHistory !== undefined) failHistory = value.failHistory;
    if (value.failCheckpoint !== undefined) failCheckpoint = value.failCheckpoint;
    if (value.fences) result = await app.fences.read(value.board);
    if (value.failCreate !== undefined) failCreate = value.failCreate;
    if (value.fixedNow !== undefined) fixedNow = value.fixedNow;
    if (value.offset !== undefined) offset = value.offset;
    if (value.readOnlyRows) {
      const table = String(value.readOnlyRows), path = resolve(settings.dataDir, value.store ? "template-media" : "boards", value.board + ".sqlite");
      if (!/^[a-z_]+$/.test(table)) throw Error("Invalid test table");
      try { await access(path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        process.send?.({ id: message.id, result: [] }); return;
      }
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(table);
        const rows = exists ? db.prepare(`SELECT * FROM "${table}"`).all() : [];
        result = rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Uint8Array ? { bytes: v.byteLength } : v])));
      } finally { db.close(); }
      process.send?.({ id: message.id, result }); return;
    }
    if (value.unreachable) unreachable = value.unreachable;
    if (value.backupLimit !== undefined) {
      app.runtime.backupLimit = value.backupLimit;
      for (const entry of app.rooms.values()) entry.room.env.backupLimit = value.backupLimit;
    }
    if (value.board) {
      // Resolve the room through the same lazy factory as production.
      original(value.board);
      const entry = app.rooms.get(value.board)!;
      if (value.importCommand) {
        const room = entry.room;
        if (value.importCommand === "begin") result = await room.beginImport(value.person, value.workspace, value.hash);
        if (value.importCommand === "end") await room.endImport(value.person, value.workspace, value.token);
        if (value.importCommand === "claim") result = await room.claimImport(value.person, value.workspace, value.document);
        if (value.importCommand === "create") await room.create(value.document, value.person, value.token);
        process.send?.({ id: message.id, result }); return;
      }
      if (value.reactions) {
        const v = value.reactions;
        if (v.reconstruct) await entry.room.ordered(async () => { entry.room = new Room(value.board, entry.room.env); });
        await entry.room.ordered(async () => {
          await entry.room.load();
          if (Object.hasOwn(v, 'failAdmission')) {
            const reactions = entry.room.reactions, target = reactions as any;
            target.readAdmission ??= reactions.admitted.bind(reactions);
            reactions.admitted = (c:any, admission:Parameters<typeof reactions.admitted>[1]) => {
              if (c.attachment().id === v.failAdmission) throw Error('Required current admission read unavailable');
              return target.readAdmission(c, admission);
            };
          }
          for (const c of entry.connections) {
            if (v.connection && c.attachment().connectionId !== v.connection) continue;
            const a = c.attachment();
            if (v.patch) c.attach({ ...a, ...v.patch });
            if (v.maximal) c.attach({ ...a, label: '"'.repeat(256), presence: { ...a.presence!, label: '"'.repeat(256), selection: Array.from({length:250}, () => crypto.randomUUID()) },
              ...Object.fromEntries(['presenceTimes','timerTimes','timerReadTimes','voteTimes','voteReadTimes','spotlightTimes','spotlightReadTimes','reactionTimes'].map(k => [k, Array(k === 'presenceTimes' ? 10 : 5).fill(Number.MAX_SAFE_INTEGER)])) });
          }
          result = { attachments: [...entry.connections].map(c => c.attachment()), tables: entry.storage.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB '_cf_*' AND name NOT GLOB 'sqlite_*' ORDER BY name"), meta: entry.storage.all('SELECT * FROM meta ORDER BY key') };
        });
      }
      if(value.spotlight){
        const v=value.spotlight;
        if(v.reconstruct)await entry.room.ordered(async()=>{entry.room=new Room(value.board,entry.room.env);});
        if(v.adapterEvents){
          const c=[...entry.connections].find(c=>c.attachment().connectionId===v.connection),socket=c&&app.socketFor(c);
          if(!socket)throw Error('Adapter socket missing');
          for(const event of v.adapterEvents){if(event==='error')socket.emit('error',Error('Synthetic adapter error'));else socket.emit('close',event.code==='missing'?undefined:event.code,Buffer.from(event.reason??''));await entry.room.ordered(async()=>{});}
          socket.terminate();
        }
        await entry.room.ordered(async()=>{
          if(!v.inspect){await entry.room.load();await entry.room.spotlight.recover();}
          const c=[...entry.connections].find(c=>c.attachment().connectionId===v.connection);
          if(v.watchCloses&&!(entry.room as any).spotlightCloses){const target=entry.room as any,closed=target.closed.bind(target);target.spotlightCloses=[];target.closed=(c:any,code=1006,reason='')=>{target.spotlightCloses.push({connection:c.attachment().connectionId,code,reason});return closed(c,code,reason);};}
          if(v.controlVersion!==undefined){entry.room.spotlight.session.controlVersion=v.controlVersion;for(const p of entry.connections){const a=p.attachment();if(a.spotlightPresenter)p.attach({...a,spotlightPresenter:{...a.spotlightPresenter,session:entry.room.spotlight.session}});}}
          if(c&&v.suspend)entry.room.spotlight.closed(c,1011,"error");
          if(c&&v.member)c.attach({...c.attachment(),spotlightMember:{sessionId:entry.room.spotlight.session.sessionId,...v.member}});
          if(v.voteFailure){
            const target=entry.room as any,voting=target.voting,flush=target.spotlight.flush.bind(target.spotlight);
            target.spotlight.flush=async()=>{if(voting.running()){target.spotlightBoundary={session:structuredClone(target.spotlight.session),attachments:target.env.connections().map((p:any)=>p.attachment())};target.spotlight.flush=flush;}return flush();};
            if(v.voteFailure==='reply'){
              const send=voting.send;voting.send=function(c:any,frame:any){if(frame.kind!=='vote_result')return send.call(this,c,frame);this.send=send;throw Error('Injected vote reply failure');};
            }else{
              const stamp=voting.stamp;voting.stamp=async function(c:any){this.stamp=stamp;if(v.voteFailure==='stamp')throw Error('Injected vote stamp failure');const authority=this.authority;this.authority=async function(){this.authority=authority;throw Error('Injected post-commit authority failure');};return stamp.call(this,c);};
            }
          }

          result={closes:(entry.room as any).spotlightCloses,boundary:(entry.room as any).spotlightBoundary,session:entry.room.spotlight.session,attachments:[...entry.connections].map(c=>c.attachment())};
        });
      }
      if(value.reconstructTimerRoom)await entry.room.ordered(async()=>{entry.room=new Room(value.board,entry.room.env);});
      if(value.votingAttachments)result=[...entry.connections].map(c=>c.attachment());
      if(value.staleVotingPresence)for(const c of entry.connections){const a=c.attachment();if(a.presence)c.attach({...a,presence:{...a.presence,cursor:{x:98765,y:12345},selection:[value.target],view:{x:98765,y:12345,width:100,height:100}}});}
      if(value.timerAttachments)result=[...entry.connections].map(c=>({timerTimes:c.attachment().timerTimes??[],timerReadTimes:c.attachment().timerReadTimes??[]}));
      if (value.legacyStorage !== undefined) {
        entry.storage.transaction(() => {
          for (const table of ["threads", "comments", "comment_ids", "comment_counts"]) entry.storage.exec(`DROP TABLE IF EXISTS "${table}"`);
          if (entry.storage.all("PRAGMA table_info(receipts)").some((column) => column.name === "kind")) entry.storage.exec("ALTER TABLE receipts DROP COLUMN kind");
          entry.storage.exec("DELETE FROM meta WHERE key IN ('storage_version', 'comment_sequence')");
          if (value.legacyStorage) entry.storage.exec("INSERT INTO meta VALUES ('storage_version', ?)", value.legacyStorage);
        });
        entry.room.initialized = false;
      }
      if(value.markRecovery)await entry.room.ordered(async()=>{const {markExplicitRecovery}=await import("../../packages/board-room/src/timer.ts");markExplicitRecovery(entry.storage);entry.room.initialized=false;});
      if (value.roomSQL) await entry.room.ordered(async () => { for (const item of value.roomSQL) entry.storage.exec(item.sql, ...(item.bindings ?? [])); });
      if (value.failInitialization) {
        const execute=entry.storage.exec.bind(entry.storage); entry.storage.exec=(sql,...args)=>{if(sql.includes("CREATE TABLE IF NOT EXISTS mention_pending"))throw Error("initialization rollback");execute(sql,...args);};
        try { const {initialize}=await import("../../packages/board-room/src/storage.ts"); initialize(entry.storage); } finally { entry.storage.exec=execute; }
      }
      if (value.deliverMentions) await entry.room.deliverNotices();
      if (value.settled) await entry.room.ordered(async () => {});
      // Inspection must remain available while a held ordered recovery is awaiting release.
      if (value.rows) result = entry.storage.all(`SELECT * FROM "${value.rows}"`).map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Uint8Array ? { bytes: v.byteLength } : v])));
      if (value.raiseFence) result = await entry.room.lock();
      if (value.fileSnapshot) entry.storage.exec("VACUUM INTO ?", value.fileSnapshot);
      if (value.alarm && (await entry.room.alarm())?.discard) await app.runtime.removeRoom(value.board);
      if (value.reload) {
        for (const connection of entry.connections) connection.close(1001);
        clearTimeout(entry.timer); entry.storage.close(); app.rooms.delete(value.board);
      }
    }
    if (value.alarmAll) for (const entry of app.rooms.values()) await entry.room.alarm();
    if (value.shutdown) {
      const reportRooms = () => {
        const shutdownRooms = [...app.rooms].filter(([, entry]) => entry.tasks.size)
          .map(([board, entry]) => `${board} (${entry.tasks.size})`);
        process.send?.({ shutdownRooms });
      };
      reportRooms();
      const report = setInterval(reportRooms, 1000).unref();
      try { await app.close(); } finally { clearInterval(report); }
      reportRooms();
      process.send?.({ id: message.id, result: {} }, (error) => process.exit(error ? 1 : 0));
      return;
    }
    result = value.now ? Date.now() + offset : result;
    process.send?.({ id: message.id, result });
  } catch (error) { process.send?.({ id: message.id, error: (error as Error).message }); }
});
process.send?.({ ready: true, port: app.port });
