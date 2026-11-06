// SPDX-License-Identifier: Apache-2.0
import { RoomError } from 'nextphase-board-room/protocol.ts';
import { candidatePage } from 'nextphase-board-sync/mentions.ts';
import type { Runtime } from '../runtime.ts';
import { authorize, body, id, shape, uuid, type ServerApp } from './common.ts';
export function mentions(app: ServerApp, runtime: Runtime) {
  app.get('/boards/:board/participants', async c => {
    const board = id(c,'board'), caller = c.get('person').id;
    await authorize(runtime,caller,board,'board');
    const query = c.req.query('q') ?? '', page = Number(c.req.query('page') ?? 0);
    if (query.length>4000 || !Number.isSafeInteger(page) || page<0) throw new RoomError(400,'bad_request');
    const roster = await runtime.db.roster(board,caller);
    const found = candidatePage(roster,query,page);
    return c.json({ candidates: found.candidates.map(({person,label,suffix}) => ({person,label,suffix})), more: found.more });
  });
  async function references(person: string): Promise<any[]> { return runtime.db.rpc('list_mentions',{person}); }
  app.get('/notifications',async c => {
    const person = c.get('person'), refs = await references(person.id), rows = [];
    const workspaces = await runtime.db.workspaces(person.id);
    for (const ref of refs) {
      try {
        const current = await runtime.room(ref.board_id).discussion(person,ref.comment_id,ref.id);
        const board = await runtime.db.board(ref.board_id);
        if (!board) throw new RoomError(404,'not_found');
        rows.push({ id: ref.id, version: Number(ref.state_version), read: ref.is_read, createdAt: Number(ref.created_at),
          ...current, workspace: workspaces.find(w => w.id===board.workspaceId)?.name ?? 'Workspace' });
      } catch(error) {
        if (!(error instanceof RoomError) || error.status!==404) throw error;
        await runtime.db.rpc('act_mentions',{person:person.id,action:'dismiss',seen:[{id:ref.id,version:ref.state_version}]});
      }
    }
    return c.json({ notices: rows });
  });
  app.get('/notifications/:notice/open',async c => {
    const notice = id(c,'notice'), person = c.get('person');
    const ref = (await references(person.id)).find(n => n.id===notice);
    if (!ref) throw new RoomError(404,'not_found');
    try {
      await authorize(runtime,person.id,ref.board_id,'board');
      return c.json(await runtime.room(ref.board_id).discussion(person,ref.comment_id,ref.id));
    } catch (error) {
      if (error instanceof RoomError && error.status === 404) await runtime.db.rpc('act_mentions',{person:person.id,action:'dismiss',seen:[{id:ref.id,version:ref.state_version}]});
      throw error;
    }
  });
  app.post('/notifications/actions',async c => {
    const value = await body(c); shape(value,['action','seen']);
    if (!['read','unread','dismiss'].includes(String(value.action)) || !Array.isArray(value.seen) || value.seen.length>50 || value.seen.some(n =>
      !n || typeof n!=='object' || Object.keys(n).sort().join()!=='id,version' || !uuid.test(n.id) || !Number.isSafeInteger(n.version) || n.version<0)) throw new RoomError(400,'bad_request');
    await runtime.db.rpc('act_mentions',{person:c.get('person').id,action:value.action,seen:value.seen});
    return c.body(null,204);
  });
  app.post('/boards/:board/mentions/displayed',async c => {
    const board = id(c,'board'), person = c.get('person');
    await authorize(runtime,person.id,board,'board');
    const value = await body(c); shape(value,['comments']);
    if (!Array.isArray(value.comments) || value.comments.length>2000 || value.comments.some(id => typeof id!=='string' || !uuid.test(id))) throw new RoomError(400,'bad_request');
    const refs = (await references(person.id)).filter(n => n.board_id===board && (value.comments as string[]).includes(n.comment_id));
    for (const ref of refs) await runtime.room(board).discussion(person,ref.comment_id,ref.id);
    await runtime.db.rpc('act_mentions',{person:person.id,action:'read',seen:refs.map(n => ({id:n.id,version:n.state_version}))});
    return c.body(null,204);
  });
}
