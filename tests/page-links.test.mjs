// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const boardId = '11111111-1111-4111-8111-111111111111';
const ideas = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const root = 'https://example.test/board/';
const bare = '#/b/' + boardId;
const hostedAddress = page => root + bare + '?page=' + page;
const localAddress = page => root + '?board=original&page=' + page;
const fixture = {
  schemaVersion: 14, boardId, objects: [], retiredGenerations: [], title: 'Synthetic board',
  pages: [{ id: boardId, name: 'Page 1' }, { id: ideas, name: 'Ideas' }],
};
const check = (id, title, run) => test('P4-U' + id + ' ' + title, async () => {
  const links = await import('../apps/web/src/page-links.ts');
  await run(links);
});

check('01', 'reads only the page value of the appropriate address', ({ readPageValue }) => {
  assert.equal(readPageValue(hostedAddress(ideas), boardId), ideas);
  assert.equal(readPageValue(hostedAddress(''), boardId), '');
  assert.equal(readPageValue(hostedAddress('nonsense'), boardId), 'nonsense');
  assert.equal(readPageValue(hostedAddress('%ZZ'), boardId), '%ZZ');
  for (const fragment of [bare, bare + '?x=1', bare + '?page=a&x=1', bare + '?page=a#b',
    '#/files?page=a', '#/invite/' + otherId + '?page=a', '#/b/' + otherId + '?page=a']) {
    assert.equal(readPageValue(root + fragment, boardId), undefined, fragment);
  }
  assert.equal(readPageValue(root + '?page=ignored' + bare, boardId), undefined);
  assert.equal(readPageValue(localAddress(ideas)), ideas);
  assert.equal(readPageValue(localAddress('one%2Btwo+three')), 'one+two three');
  assert.equal(readPageValue(localAddress('')), '');
  assert.equal(readPageValue(root + '?board=original'), undefined);
});

check('02', 'extends strict board fragments and retains existing route shapes', async () => {
  const { parseLink, boardLink, invitationLink } = await import('../apps/web/src/team/links.ts');
  assert.deepEqual(parseLink(bare), { kind: 'board', board: boardId });
  for (const page of [ideas, '', 'nonsense', '%ZZ']) {
    assert.deepEqual(parseLink(bare + '?page=' + page), { kind: 'board', board: boardId, page });
  }
  for (const suffix of ['?x=1', '?page=a&x=1', '?page=a#b', '/extra']) {
    assert.deepEqual(parseLink(bare + suffix), { kind: 'bad' });
  }
  assert.deepEqual(parseLink('#/files'), { kind: 'home', workspace: undefined });
  assert.deepEqual(parseLink('#/files/' + boardId), { kind: 'home', workspace: boardId });
  assert.deepEqual(parseLink('#/files/' + boardId + '/trash'), { kind: 'trash', workspace: boardId });
  assert.deepEqual(parseLink('#/invite/' + otherId + '?board=' + boardId), { kind: 'invite', invitation: otherId, board: boardId });
  assert.deepEqual(parseLink('#/invite/' + otherId + '?page=a'), { kind: 'bad' });
  assert.deepEqual(parseLink(''), { kind: 'local' });
  assert.equal(boardLink(root + '?local=yes#old', boardId), root + bare);
  assert.equal(invitationLink(root + '?local=yes#old', otherId, boardId), root + '#/invite/' + otherId + '?board=' + boardId);
});

check('03', 'builds a team page link and preserves the rest of the local address', ({ pageLink }) => {
  assert.equal(pageLink(root + '?board=original#/files', ideas, boardId), hostedAddress(ideas));
  assert.equal(pageLink(root + '?board=original&note=a%20b&%70age=old&x=1&x=2&page=duplicate#view', ideas),
    localAddress(ideas).replace('&page=', '&note=a%20b&page=') + '&x=1&x=2#view');
  assert.equal(pageLink(root + '?board=original#view', ideas), localAddress(ideas) + '#view');
});

check('04', 'resolves a named page, a missing value or the remembered page', ({ resolvePage }) => {
  const [first, second] = fixture.pages;
  assert.deepEqual(resolvePage(fixture.pages, ideas, boardId), { page: second, missing: false });
  for (const value of ['', 'nonsense', otherId]) {
    assert.deepEqual(resolvePage(fixture.pages, value, ideas), { page: first, missing: true });
  }
  assert.deepEqual(resolvePage(fixture.pages, undefined, ideas), { page: second, missing: false });
  assert.deepEqual(resolvePage(fixture.pages, undefined, otherId), { page: first, missing: false });
});

check('05', 'uses the exact copied, missing and clipboard-refused notices', links => {
  assert.equal(links.copiedPageNotice('Ideas', true), 'Link to “Ideas” copied.');
  assert.equal(links.copiedPageNotice('Ideas', false), 'Link to “Ideas” copied. It opens in this browser only.');
  assert.equal(links.missingPageNotice('Page 1'), 'That page no longer exists. You are on “Page 1”.');
  assert.equal(links.clipboardRefused, 'Could not copy the link. Your browser blocked the clipboard.');
});

async function bundle(contents, ports = {}) {
  const { build } = await import('esbuild');
  const result = await build({
    stdin: { contents, resolveDir: fileURLToPath(new URL('../apps/web/src/', import.meta.url)), loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
    plugins: [{ name: 'page-link-test-ports', setup(build) {
      if (ports.hooks) {
        build.onResolve({ filter: /^(react|test-hooks)$/ }, ({ path, importer }) => {
          if (path === 'test-hooks' || /\/(use-pages|use-panel-layout|use-storage-session|team-app)\.tsx?$/.test(importer)) {
            return { path: 'hooks', namespace: 'test' };
          }
        });
        build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: scheduler }));
      }
      build.onResolve({ filter: /^(react(?:\/.*)?|react-dom(?:\/.*)?)$/ }, ({ path }) => ({
        path: new URL('../node_modules/' + path + (path.includes('/') ? '.js' : '/index.js'), import.meta.url).href,
        external: true,
      }));
      build.onResolve({ filter: /^yjs$/ }, () => ({
        path: new URL('../node_modules/yjs/dist/yjs.mjs', import.meta.url).href, external: true,
      }));
      if (ports.team) {
        build.onLoad({ filter: /\/team\/auth\.ts$/ }, () => ({ contents: authStub }));
        build.onLoad({ filter: /\/App\.tsx$/ }, () => ({ contents: 'export function App() {}' }));
      }
    } }],
    define: { BOARD_TEAM_SETTINGS: JSON.stringify({ supabaseUrl: root, anonKey: 'synthetic', serverUrl: root }) },
  });
  const source = Buffer.from(result.outputFiles[0].text).toString('base64');
  return import('data:text/javascript;base64,' + source + '#' + crypto.randomUUID());
}

const scheduler = `
const frames = new Map();
let slots, at, effects, dirty;
export function render(name, fn) {
  if (!frames.has(name)) frames.set(name, []);
  slots = frames.get(name);
  for (let attempt = 0; attempt < 12; attempt++) {
    at = 0; effects = []; dirty = false;
    const value = fn();
    if (dirty) continue;
    for (const effect of effects) effect();
    if (!dirty) return value;
  }
  throw Error('Hook state did not settle');
}
export function useRef(current) { return slots[at++] ??= { current }; }
export function useState(initial) {
  const cell = slots[at++] ??= { current: typeof initial === 'function' ? initial() : initial };
  return [cell.current, update => {
    const next = typeof update === 'function' ? update(cell.current) : update;
    dirty ||= !Object.is(cell.current, next);
    cell.current = next;
  }];
}
export function useEffect(fn, deps) {
  const cell = useRef();
  const before = cell.current;
  if (!before || !deps || deps.some((value, i) => !Object.is(value, before.deps?.[i]))) {
    effects.push(() => { before?.cleanup?.(); cell.current = { deps, cleanup: fn() }; });
  }
}
export function dispose() {
  for (const frame of frames.values()) for (const cell of frame) cell.current?.cleanup?.();
}
`;
const authStub = `
let listener;
export const deliverAuth = session => listener('SIGNED_IN', session);
export const auth = {
  onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() {} } } }; }
};
`;

function browser(address, clipboard) {
  const events = new Map(), replacements = [], pushes = [], values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let url = new URL(address);
  const globals = {
    location: { get href() { return url.href; }, get hash() { return url.hash; }, set hash(value) { url.hash = value; } },
    history: { state: { marker: 'kept' }, replaceState(state, _title, value) {
      if (typeof value === 'string') assert.deepEqual(state, this.state);
      replacements.push(String(value));
      url = new URL(value, url);
      this.state = state;
    }, pushState(state, _title, value) {
      pushes.push(String(value));
      url = new URL(value, url);
      this.state = state;
    } },
    window: { innerWidth: 1440, innerHeight: 900, addEventListener: (key, fn) => events.set(key, fn),
      removeEventListener: key => events.delete(key), sessionStorage: storage, localStorage: storage },
    document: { activeElement: null, querySelector: () => null, addEventListener() {}, removeEventListener() {} },
    localStorage: storage, sessionStorage: storage, requestAnimationFrame: () => 0, confirm: () => true,
    navigator: { clipboard },
  };
  const restore = installGlobals(globals);
  return { replacements, pushes, values, events, restore, navigate: value => { url = new URL(value, url); } };
}

function installGlobals(globals) {
  const descriptors = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return () => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
}

async function pagesHarness(address, { team, clipboard, placeholder, storage } = {}) {
  const m = await bundle(`
export { usePages, rememberedPageKey } from './state/use-pages.ts';
export { useStorageSession } from './state/use-storage-session.ts';
export { LocalStore, digest } from './storage.ts';
export { canonical } from 'nextphase-board-rules/document.ts';
export { editingCommandReason } from './commands.ts';
export { HostedBoard } from './team/hosted-board.ts';
export * from 'test-hooks';
`, { hooks: true, team: true });
  const b = browser(address, clipboard);
  const initial = placeholder ?? { ...fixture, boardId: otherId, pages: [{ id: otherId, name: 'Page 1' }] };
  const messages = [], focus = [], views = [], commits = [];
  let pageHook, storageHook, board = initial;
  const host = team && new m.HostedBoard(team, () => {});
  let presenceUpdates = 0;
  if (host) host.pageChanged = () => presenceUpdates++;
  const openingView = { x: 4, y: 8, z: 1 };
  const model = { current: board };
  if (storage) {
    // Exercise the real storage session and envelope decoding. Hold only its
    // IndexedDB read so the initial read-only canvas repaint can run first.
    const pairs = new Map();
    for (const [key, saved] of storage.boards) {
      const payload = m.canonical(saved);
      pairs.set(key, [JSON.stringify({ formatVersion: 1, storageRevision: 1, payload, sha256: await m.digest(payload) }), undefined]);
    }
    navigator.locks = { request: async (_name, _options, hold) => hold(storage.owned === false ? null : {}),
      query: async () => ({ held: [] }) };
    m.LocalStore.prototype.open = async function () {
      await storage.ready;
      if (storage.fail) throw Error('Test storage unavailable');
      if (storage.damaged) return ['damaged envelope', undefined];
      return pairs.get(this.key) ?? [undefined, undefined];
    };
    m.LocalStore.prototype.refreshList = async () => [];
  }
  const revision = { current: 0 }, adapter = { current: null };
  const pending = { current: { invalid: false, busy: false, composing: false } };
  const h = { ...b, messages, focus, views, commits, host, openingView, key: m.rememberedPageKey,
    blocked: '', readOnly: !!storage, get pages() { return pageHook; },
    get presenceUpdates() { return presenceUpdates; },
    get model() { return model.current; },
    get storage() { return storageHook; },
    refresh() {
      pageHook = m.render('pages', () => {
        const pages = m.usePages({
          board, model, stepPage: h.stepPage, hosted: !!host, team: host, canEdit: !host || !h.readOnly,
          commit: next => commits.push(next), finishTextSession() {}, select() {},
          setMessage: message => messages.push(message), getView: () => views.at(-1) ?? openingView,
          setView: view => views.push(view), getObjects: () => board.objects,
          openingReason: () => h.blocked,
          editingReason: () => m.editingCommandReason({ readOnly: h.readOnly, composing: false, pointerGesture: false, invalidObjectText: false }),
        });
        if (storage) storageHook = m.useStorageSession({
          readOnly: h.readOnly, title: board.title, setReadOnly: value => { h.readOnly = value; },
          setStatus() {}, setMessage: message => messages.push(message), clearHistory() {},
          load: next => { model.current = board = next; }, model, revision, adapter,
          select() {}, setInline() {}, setView: view => views.push(view),
          invalid: false, busy: false, composing: false, pending,
        });
        return pages;
      });
      pageHook.button.current = { focus: () => focus.push('Pages') };
      pageHook.pageMenu.current = { querySelector: () => ({ focus: () => focus.push('first item') }) };
      return pageHook;
    },
    deliver(next, change, preview = false) {
      model.current = next;
      if (change) pageHook.changed(board, next, change, preview);
      board = next;
      return h.refresh();
    },
    repaint() { board = { ...model.current }; h.refresh(); },
    async waitForStorage() {
      const deadline = Date.now() + 2000;
      for (;;) {
        h.refresh();
        if (!storageHook.boardFiles.opening) return;
        assert(Date.now() < deadline, 'storage session did not finish');
        await new Promise(resolve => setImmediate(resolve));
      }
    },
    close() { m.dispose(); b.restore(); },
    stepPage: { current: undefined },
  };
  h.refresh();
  return h;
}

check('06', 'local page links wait for storage adoption and reopen the saved page after reload', async () => {
  let address = localAddress(ideas);
  for (const visit of ['link', 'reload']) {
    const ready = Promise.withResolvers();
    const h = await pagesHarness(address, { storage: { boards: [['original', fixture]], ready: ready.promise } });
    try {
      h.values.set(h.key(boardId), boardId);
      h.repaint();
      const writesBeforeLoad = [...h.replacements];
      ready.resolve();
      await h.waitForStorage();
      assert.equal(h.pages.id, ideas, visit);
      assert.equal(h.stepPage.current, ideas);
      assert.equal(h.values.get(h.key(boardId)), ideas);
      assert.deepEqual(writesBeforeLoad, [], 'a placeholder repaint must not write an address');
      assert.deepEqual(h.replacements.map(url => new URL(url).searchParams.get('page')), [ideas, ideas]);
      assert.deepEqual(h.views, [{ x: 0, y: 0, z: 1 }]);
      address = location.href;
      h.pages.openPage(boardId); h.refresh();
      assert.equal(h.replacements.at(-1), localAddress(boardId));
      assert.deepEqual(h.pushes, []);
      assert.deepEqual(h.commits, []);
    } finally { h.close(); }
  }
  const source = await readFile(new URL('../apps/web/src/state/use-pages.ts', import.meta.url), 'utf8');
  assert.equal(source.match(/\buseEffect\(/g).length, 2);
  assert.doesNotMatch(source, /useLayoutEffect|pushState|location\.hash\s*=/);
});

check('07', 'missing local page links fix the address after adoption and preserve read-only notices', async () => {
  const withoutIdeas = { ...fixture, pages: [fixture.pages[0]] };
  const cases = [
    ['deleted', ideas, withoutIdeas, true],
    ['malformed', '%ZZ', fixture, true],
    ['empty', '', fixture, true],
    ['never saved', otherId, fixture, true],
    ['read-only', 'missing', fixture, false],
  ];
  for (const [label, page, saved, owned] of cases) {
    const ready = Promise.withResolvers();
    const h = await pagesHarness(localAddress(page), { storage: { boards: [['original', saved]], ready: ready.promise, owned } });
    try {
      h.values.set(h.key(boardId), ideas);
      h.repaint();
      ready.resolve();
      await h.waitForStorage();
      assert.equal(h.pages.id, boardId, label);
      assert.equal(h.messages.at(-1), owned ? 'That page no longer exists. You are on “Page 1”.'
        : 'Another tab is editing. This board is read-only.', label);
      assert.equal(h.replacements.at(-1), localAddress(boardId), label);
    } finally { h.close(); }
  }
  const recovery = await pagesHarness(localAddress(ideas), { storage: { boards: [], damaged: true } });
  try {
    await recovery.waitForStorage();
    assert.equal(recovery.pages.id, recovery.model.pages[0].id);
    assert.equal(location.href, localAddress(recovery.pages.id));
    assert.match(recovery.messages.at(-1), /^Saved data is unsupported, damaged or inconsistent\./);
  } finally { recovery.close(); }
});

check('08', 'first hosted delivery consumes the latest pending value regardless of origin', async () => {
  const h = await pagesHarness(hostedAddress('old'), { team: { kind: 'board', board: boardId, page: 'old' } });
  try {
    h.host.openLinkedPage('older');
    h.host.openLinkedPage();
    assert.equal(h.host.pendingPage.value, undefined);
    h.host.openLinkedPage(ideas);
    h.readOnly = true;
    assert.deepEqual(h.replacements, []);
    assert.equal(h.deliver(fixture, { origin: 'remote' }).id, ideas);
    assert.equal(h.host.pendingPage, undefined);
    assert.equal(h.host.page, ideas);
    assert.equal(h.presenceUpdates, 1);
    assert.equal(h.values.get(h.key(boardId)), ideas);
    assert.equal(h.replacements.at(-1), hostedAddress(ideas));
    assert.deepEqual(h.views, []);
    h.navigate(hostedAddress('stale'));
    h.deliver({ ...fixture, title: 'Reloaded' }, { origin: 'reload' });
    assert.equal(h.pages.id, ideas);
    assert.equal(h.replacements.length, 1, 'a later delivery does not apply the address');
    assert.deepEqual(h.commits, []);
  } finally { h.close(); }
});

check('09', 'same-board page changes fit or restore the view and repair blocked, missing and bare addresses', async () => {
  const h = await pagesHarness(hostedAddress(ideas), { team: { kind: 'board', board: boardId, page: ideas } });
  try {
    h.deliver(fixture, { origin: 'reload' });
    h.readOnly = true;
    h.navigate(hostedAddress(boardId));
    h.host.openLinkedPage(boardId); h.refresh();
    assert.deepEqual(h.views.at(-1), { x: 0, y: 0, z: 1 });
    h.navigate(hostedAddress(ideas));
    h.host.openLinkedPage(ideas); h.refresh();
    assert.deepEqual(h.views.at(-1), h.openingView);
    h.blocked = 'Finish the current action first.';
    h.navigate(hostedAddress(boardId));
    h.host.openLinkedPage(boardId); h.refresh();
    assert.equal(h.pages.id, ideas);
    assert.equal(h.messages.at(-1), h.blocked);
    assert.equal(location.href, hostedAddress(ideas));
    h.blocked = '';
    h.navigate(hostedAddress('deleted'));
    h.host.openLinkedPage('deleted'); h.refresh();
    assert.equal(h.pages.id, boardId);
    assert.equal(h.messages.at(-1), 'That page no longer exists. You are on “Page 1”.');
    assert.equal(location.href, hostedAddress(boardId));
    h.navigate(root + bare);
    h.host.openLinkedPage(); h.refresh();
    assert.equal(location.href, hostedAddress(boardId));
    assert.equal(h.pages.id, boardId);
    assert.deepEqual(h.commits, []);
  } finally { h.close(); }
});

check('10', 'copy closes the menu and list, returns focus and works read-only or when opening is blocked', async () => {
  for (const mode of ['local', 'viewer', 'refused', 'no API']) {
    const writes = [];
    const clipboard = mode === 'no API' ? undefined : { writeText(text) {
      writes.push(text);
      return mode === 'refused' ? Promise.reject(Error('Refused')) : Promise.resolve();
    } };
    const team = mode === 'viewer' ? { kind: 'board', board: boardId, page: boardId } : undefined;
    const h = await pagesHarness(team ? hostedAddress(boardId) : localAddress(boardId), { team, clipboard });
    try {
      h.deliver(fixture, team ? { origin: 'reload' } : undefined);
      h.pages.toggle(); h.refresh();
      h.pages.showMenu(ideas); h.refresh();
      if (team) {
        h.readOnly = true; h.refresh();
        assert.equal(h.pages.menu, '');
        h.pages.showMenu(ideas); h.refresh();
      }
      assert.equal(h.pages.menu, ideas);
      assert.equal(h.focus.at(-1), 'first item');
      h.blocked = 'Finish the current action first.';
      h.refresh();
      const before = h.replacements.length;
      h.pages.choose('Copy link to page', ideas);
      assert.deepEqual(writes, mode === 'no API' ? [] : [team ? hostedAddress(ideas) : localAddress(ideas)]);
      h.refresh();
      assert.equal(h.pages.open, false);
      assert.equal(h.pages.menu, '');
      assert.equal(h.focus.at(-1), 'Pages');
      await Promise.resolve();
      await Promise.resolve();
      const expected = { local: 'Link to “Ideas” copied. It opens in this browser only.', viewer: 'Link to “Ideas” copied.' };
      assert.equal(h.messages.at(-1), expected[mode] ?? 'Could not copy the link. Your browser blocked the clipboard.');
      assert.equal(h.pages.id, boardId);
      assert.equal(h.replacements.length, before);
      assert.deepEqual(h.commits, []);
    } finally { h.close(); }
  }
});

check('11', 'the real menu renders copy first, enabled in all roles and the only item for viewers', async () => {
  const { PagesPanel } = await bundle('export { PagesPanel } from "./ui/pages-panel.tsx";');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const restore = installGlobals({ window: { innerWidth: 1440 } });
  const pages = {
    open: true, id: ideas, list: fixture.pages, menu: ideas, editing: '', openingReason: '',
    people: () => ({ name: '', shown: [], overflow: 0 }), duplicateReason: () => '', voteReason: () => '',
    button: { current: null }, options: { current: new Map() },
  };
  try {
    for (const [canEdit, editingReason] of [[true, ''], [true, 'Finish the current action first.'], [false, 'View only']]) {
      const html = renderToStaticMarkup(createElement(PagesPanel, { pages: { ...pages, canEdit, editingReason } }));
      assert.match(html, /aria-label="Page options for Page 1"/);
      assert.match(html, /aria-label="Page options for Ideas"/);
      const menu = html.slice(html.indexOf('role="menu"'));
      const items = Array.from(menu.matchAll(/<button[^>]*role="menuitem"[^>]*><span>([^<]+)<\/span>|role="separator"/g),
        match => match[1] ?? 'separator');
      assert.deepEqual(items, canEdit
        ? ['Copy link to page', 'separator', 'Rename page', 'Duplicate page', 'separator', 'Move up', 'Move down', 'separator', 'Delete page']
        : ['Copy link to page']);
      assert.match(menu, /<button role="menuitem"><span>Copy link to page<\/span>/);
      if (!canEdit) {
        assert.match(html, /View only/);
        assert.doesNotMatch(html, /aria-label="Add page"/);
        assert.match(html, /class="page-row current menu-open"/);
      }
    }
  } finally { restore(); }
});

check('12', 'the real notice renders Retry editing only on a local board', async () => {
  const { Notice } = await bundle('export { Notice } from "./ui/notice.tsx";');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const props = { pages: { list: fixture.pages }, showNotice: true, visibleMessage: 'Example', readOnly: true,
    invalidFields: [], snapshots: [], tool: 'Select' };
  const local = renderToStaticMarkup(createElement(Notice, props));
  const hosted = renderToStaticMarkup(createElement(Notice, { ...props, hosted: true }));
  assert.match(local, /Retry editing/);
  assert.match(hosted, /role="status">Example/);
  assert.doesNotMatch(hosted, /Retry editing/);
});

check('13', 'the hidden notice keeps panel top at 68 while team changes move only the notice', async () => {
  const m = await bundle('export { usePanelLayout } from "./state/use-panel-layout.ts"; export * from "test-hooks";', { hooks: true });
  const resizes = [];
  let mutated, column, bottom = 115;
  const bars = { getBoundingClientRect: () => ({ bottom: 60 }) };
  const notice = { hidden: true, getBoundingClientRect: () => ({ height: 37 }) };
  const restore = installGlobals({
    window: { addEventListener() {}, removeEventListener() {} },
    document: { querySelector: selector => selector === '.notice' ? notice : bars },
    ResizeObserver: class { constructor(callback) { resizes.push(callback); } observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { constructor(callback) { mutated = callback; } observe() {} disconnect() {} },
  });
  const scene = { current: { parentElement: { querySelector: () => column }, getBoundingClientRect: () => ({ top: 0 }) } };
  const render = () => m.render('layout', () => m.usePanelLayout(scene));
  try {
    assert.deepEqual(render(), { notice: 68, panel: 68 });
    // A child-list mutation can sample a transient notice before it is hidden
    // again. The baseline layout measures only on its original resize signals.
    notice.hidden = false;
    mutated();
    notice.hidden = true;
    assert.deepEqual(render(), { notice: 68, panel: 68 }, 'I7 hidden notice');
    notice.hidden = false;
    resizes[0]();
    assert.deepEqual(render(), { notice: 68, panel: 113 });
    column = { getBoundingClientRect: () => ({ bottom }) };
    mutated();
    assert.deepEqual(render(), { notice: 123, panel: 113 });
    bottom = 160;
    for (const resize of resizes) resize();
    assert.deepEqual(render(), { notice: 168, panel: 113 });
    notice.hidden = true;
    resizes[0]();
    assert.deepEqual(render(), { notice: 168, panel: 68 });
    column = null;
    mutated();
    assert.deepEqual(render(), { notice: 68, panel: 68 });
  } finally { m.dispose(); restore(); }
});

check('14', 'hosted leave pushes the active page address while same-board links stay in place', async ({ pageLink }) => {
  const m = await bundle(`
export { TeamApp } from './team/team-app.tsx';
export { HostedBoard } from './team/hosted-board.ts';
export { deliverAuth } from './team/auth.ts';
export * from 'test-hooks';
`, { hooks: true, team: true });
  const invitation = '#/invite/' + otherId + '?board=' + boardId;
  const b = browser(root + invitation);
  const stops = [], links = [];
  let board;
  m.HostedBoard.prototype.start = function () { board = this; this.boardId = boardId; };
  m.HostedBoard.prototype.stop = function () { stops.push(this); };
  m.HostedBoard.prototype.updateSession = () => {};
  m.HostedBoard.prototype.signedOut = () => {};
  const render = () => m.render('team', m.TeamApp);
  const route = node => m.render(node.key, () => node.type(node.props));
  const hashchange = fragment => { b.navigate(fragment); b.events.get('hashchange')(); };
  try {
    render();
    m.deliverAuth({ user: { id: otherId } });
    await Promise.resolve();
    const joined = render();
    assert.equal(joined.props.link.kind, 'invite');
    route(joined);
    assert(board);
    hashchange(bare + '?page=' + ideas);
    assert.equal(board.pendingPage.value, ideas);
    assert.equal(render().key, joined.key);
    assert.deepEqual(stops, []);
    Object.defineProperty(board, 'counts', { value: { waiting: 1 }, configurable: true });
    board.pendingPage = undefined;
    board.page = boardId;
    board.onLinkedPage = page => {
      links.push(page);
      board.page = page ?? board.page;
      history.replaceState(history.state, '', pageLink(location.href, board.page, boardId));
    };
    hashchange(bare + '?page=' + ideas);
    hashchange(bare);
    assert.deepEqual(links, [ideas, undefined]);
    assert.deepEqual(stops, []);
    assert.equal(render().props.leave, null);
    assert.equal(render().key, joined.key);
    assert.deepEqual(b.pushes, []);
    const replacements = b.replacements.length;
    hashchange('#/b/' + otherId);
    const question = render();
    assert(question.props.leave);
    assert.deepEqual(b.pushes, [hostedAddress(ideas)]);
    assert.equal(b.replacements.length, replacements);
    assert.equal(location.href, hostedAddress(ideas));
    question.props.stay();
    assert.equal(render().props.leave, null);
    assert.equal(location.href, hostedAddress(ideas));
    question.props.restart();
    const restarted = render();
    assert.notEqual(restarted.key, joined.key);
    assert.deepEqual(restarted.props.link, { kind: 'board', board: boardId, page: ideas });
    Object.defineProperty(board, 'counts', { value: { waiting: 0 } });
    hashchange('#/b/' + otherId);
    assert.deepEqual(stops, [board]);
    assert.deepEqual(render().props.link, { kind: 'board', board: otherId });
  } finally { m.dispose(); b.restore(); }
});

check('15', 'board-list choices and Retry never apply a local startup page link', async () => {
  const later = { ...fixture, boardId: otherId, pages: [{ id: otherId, name: 'Later' }, fixture.pages[1]] };
  const boards = [['original', fixture], [otherId, later]];
  const h = await pagesHarness(localAddress(ideas), { storage: { boards } });
  try {
    await h.waitForStorage();
    h.storage.boardFiles.openBoard({ key: otherId, state: 'valid' }, null);
    await h.waitForStorage();
    assert.equal(h.pages.id, otherId);
    assert.equal(location.href, root + '?board=' + otherId + '&page=' + otherId);
  } finally { h.close(); }

  const storage = { boards, fail: true };
  const retry = await pagesHarness(localAddress(ideas), { storage });
  try {
    await retry.waitForStorage();
    assert.match(retry.messages.at(-1), /^Storage unavailable\./);
    storage.fail = false;
    await retry.storage.reopen();
    retry.refresh();
    assert.equal(retry.pages.id, boardId);
    assert.equal(location.href, localAddress(boardId));
  } finally { retry.close(); }
});
