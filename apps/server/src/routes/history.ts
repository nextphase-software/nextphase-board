// SPDX-License-Identifier: Apache-2.0
import { RoomError } from 'nextphase-board-room/protocol.ts';
import type { Runtime } from '../runtime.ts';
import { authorize, body, id, shape, type ServerApp, type ServerContext } from './common.ts';
export function historyRoutes(app: ServerApp, runtime: Runtime) {
  async function target(c: ServerContext, mutate = false) {
    const board = id(c, 'board');
    await authorize(runtime, c.get('person').id, board, 'board', mutate ? 'editor' : undefined);
    if (new URL(c.req.url).search) throw new RoomError(400, 'bad_request');
    return runtime.room(board);
  }
  app.get('/boards/:board/versions', async c => c.json(await (await target(c)).versions(c.get('person'))));
  app.get('/boards/:board/versions/:version', async c => {
    const room = await target(c); return c.json(await room.version(c.get('person'), id(c, 'version')));
  });
  app.post('/boards/:board/versions', async c => {
    const room = await target(c, true), value = await body(c); shape(value, ['requestId','name','description']);
    return c.json(await room.saveVersion(c.get('person'), value as any));
  });
  app.patch('/boards/:board/versions/:version', async c => {
    const room = await target(c, true), version = id(c, 'version'), value = await body(c); shape(value, ['name','description']);
    return c.json(await room.nameVersion(c.get('person'), version, value as any));
  });
  app.post('/boards/:board/versions/:version/restore', async c => {
    const room = await target(c, true), version = id(c, 'version'), value = await body(c); shape(value, ['requestId','expectedRevision','expectedGeneration']);
    return c.json(await room.restoreVersion(c.get('person'), version, value as any));
  });
}
