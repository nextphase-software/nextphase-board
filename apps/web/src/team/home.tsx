// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { boardLink } from "./links";
import { applyHeldNames, canCreate, canRename, holdName, roleWords, sortWords,
  type BoardRow, type HeldNames, type Sort, type Order } from "./home-rules";
import { useHomeLists } from "./home-lists";
import { HomeImport, type HomeImportHandle } from "./home-import";
import { HomeCard } from "./home-card";
import { HomeMenu, type MenuEntry, type MenuPosition } from "./home-menu";

type Menu = MenuPosition & ({ kind: "account" } | { kind: "create" } | { kind: "import" } | { kind: "sort" } | { kind: "card"; row: BoardRow });
const paths = {
  clock: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M10 7v3l2 2", device: "M4 5h12v8H4zM2 16h16",
  plus: "M10 4v12M4 10h12", chevron: "m6 8 4 4 4-4",
};
function Icon({ kind }: { kind: keyof typeof paths }) {
  const size = kind === "plus" ? 16 : kind === "chevron" ? 14 : 18;
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth={kind === "plus" ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[kind]} />
  </svg>;
}
const reason = (error: unknown) => error instanceof ApiError ? error.reason.replaceAll("_", " ") : "no answer";

export function Home({ workspaceId, email, names, signOut }: {
  workspaceId?: string; email: string; names: HeldNames; signOut: () => void;
}) {
  const [sort, setSort] = useState<Sort>("edited"), [order, setOrder] = useState<Order>("desc");
  const lists = useHomeLists(workspaceId, sort, order);
  const [selected, setSelected] = useState(""), [renaming, setRenaming] = useState("");
  const [menu, setMenu] = useState<Menu | null>(null), [toast, setToast] = useState({ text: "", id: 0, persistent: false });
  const [creating, setCreating] = useState(false), [, redraw] = useState(0);
  const importer = useRef<HomeImportHandle>(null), importMessage = useRef(false);
  const creation = useRef(false), pending = useRef(new Set<string>());
  const body = useRef<HTMLDivElement>(null), alive = useRef(true);
  const workspace = lists.workspaces.find((item) => item.id === workspaceId);
  const creatable = lists.workspaces.filter((item) => canCreate(item.role));
  const canMake = lists.status !== "notFound" && (workspaceId ? !!workspace && canCreate(workspace.role) : creatable.length > 0);
  const rows = applyHeldNames(lists.rows, names);
  const pageName = workspaceId ? workspace?.name ?? "Workspace" : "Recents";

  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    if (!toast.text || toast.persistent) return;
    const timer = setTimeout(() => setToast((value) => ({ ...value, text: "" })), 5000);
    return () => clearTimeout(timer);
  }, [toast.id]);
  useEffect(() => {
    if (!workspaceId || lists.status !== "ready" || !lists.cursor || lists.paging) return;
    const last = body.current?.querySelector("[role=option]:last-child");
    if (!last) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void lists.more();
    }, { root: body.current });
    observer.observe(last);
    return () => observer.disconnect();
  }, [lists.rows, lists.status, lists.cursor, lists.paging]);

  function notify(text: string) {
    if (alive.current && !importMessage.current) setToast((old) => ({ text, id: old.id + 1, persistent: false }));
  }
  function importNotice(text: string, persistent: boolean) {
    importMessage.current = persistent;
    if (alive.current) setToast((old) => ({ text, id: old.id + 1, persistent }));
  }
  function buttonMenu(kind: "account" | "create" | "import" | "sort", opener: HTMLButtonElement) {
    const rect = opener.getBoundingClientRect();
    setMenu({ kind, opener, point: { x: rect.right - 208, y: rect.bottom + 6 } });
  }
  async function create(id: string) {
    if (creation.current) return;
    creation.current = true; setCreating(true);
    try {
      const reply = await api<{ id: string }>(`/workspaces/${id}/boards`, "POST", {});
      if (alive.current) location.hash = "#/b/" + reply.id;
    } catch (error) { notify(`Couldn't create that board: ${reason(error)}.`); }
    finally { creation.current = false; if (alive.current) setCreating(false); }
  }
  function newBoard(opener: HTMLButtonElement) {
    if (workspaceId) void create(workspaceId);
    else if (creatable.length === 1) void create(creatable[0].id);
    else buttonMenu("create", opener);
  }
  async function rename(row: BoardRow, title: string, previous: string) {
    if (!title.trim() || title === previous || pending.current.has(row.id)) return;
    pending.current.add(row.id);
    holdName(names, row.id, title, [previous]); redraw((value) => value + 1);
    const held = names.get(row.id);
    try {
      const reply = await api<{ title: string }>(`/boards/${row.id}`, "PATCH", { title });
      // Keep the original holding time: waiting for a reply must not extend its lifetime.
      if (held && names.get(row.id) === held) names.set(row.id, { ...held, title: reply.title });
    } catch (error) {
      if (names.get(row.id) === held) names.delete(row.id);
      notify(`That name wasn't saved: ${reason(error)}.`);
    } finally {
      pending.current.delete(row.id);
      if (alive.current) redraw((value) => value + 1);
    }
  }
  async function copy(row: BoardRow) {
    const suppressed = importMessage.current;
    try { await navigator.clipboard.writeText(boardLink(location.href, row.id)); if (!suppressed) notify("Link copied"); }
    catch { if (!suppressed) notify("Couldn't copy the link. Try again."); }
  }
  function menuEntries(): MenuEntry[] {
    if (!menu) return [];
    if (menu.kind === "account") return [{ kind: "item", text: "Sign out", run: signOut }];
    if (menu.kind === "create") return [{ kind: "label", text: "New board in" }, ...creatable.map((item): MenuEntry =>
      ({ kind: "item", text: item.name, run: () => { void create(item.id); } }))];
    if (menu.kind === "import") return [{ kind: "label", text: "Import into" }, ...creatable.map((item): MenuEntry =>
      ({ kind: "item", text: item.name, run: () => importer.current?.pick(item.id) }))];
    if (menu.kind === "sort") return [
      { kind: "label", text: "Sort by" },
      ...(["title", "created", "edited"] as const).map((value): MenuEntry => ({ kind: "item",
        text: sortWords[value], checked: sort === value, initial: sort === value,
        run: () => { if (sort === value) lists.retry(); else setSort(value); } })),
      { kind: "divider" }, { kind: "label", text: "Order" },
      ...(["asc", "desc"] as const).map((value): MenuEntry => ({ kind: "item",
        text: value === "asc" ? "Oldest first" : "Newest first", checked: order === value,
        run: () => { if (order === value) lists.retry(); else setOrder(value); } })),
    ];
    const row = menu.row;
    return [
      ...(!workspaceId ? [{ kind: "item" as const, text: "Show in workspace", run: () => { location.hash = "#/files/" + row.workspaceId; } },
        { kind: "divider" as const }] : []),
      { kind: "item", text: "Open", initial: true, run: () => { location.hash = "#/b/" + row.id; } },
      { kind: "item", text: "Open in new tab", run: () => { window.open(boardLink(location.href, row.id), "_blank", "noopener"); } },
      { kind: "divider" }, { kind: "item", text: "Copy link", run: () => { void copy(row); } },
      ...(canRename(row.role) && !pending.current.has(row.id) ? [{ kind: "divider" as const },
        { kind: "item" as const, text: "Rename", run: () => setRenaming(row.id) }] : []),
    ];
  }
  function stateContent() {
    if (lists.status === "loading") return <span role="status">Loading boards…</span>;
    if (lists.status === "notFound") {
      return <span role="status">This workspace doesn't exist, or you don't have access to it.</span>;
    }
    if (lists.status === "failed") return <>
      <b className="home-error" role="alert">Couldn't load your boards</b>
      <p className="home-state-hint">Board's server didn't answer. Try again in a moment.</p>
      <button onClick={lists.retry}>Try again</button>
    </>;
    if (!workspaceId) return <><b>No recent boards</b><p>Boards you open appear here.</p></>;
    return <>
      <b>No boards yet</b>
      {canMake && <>
        <p className="home-state-hint">Everyone in {workspace?.name} can open the boards made here.</p>
        <button className="primary home-empty-new" disabled={creating}
          onClick={() => { void create(workspaceId); }}>New board</button>
      </>}
    </>;
  }
  return <HomeImport ref={importer} visible={canMake} workspace={workspaceId ?? (creatable.length === 1 ? creatable[0].id : undefined)}
    menu={(opener) => buttonMenu("import", opener)} creating={creating} creation={creation} setCreating={setCreating} notify={importNotice}>
    {({ button, input }) => <main className="home">
    <nav className="home-sidebar" aria-label="Files">
      <button className="home-account" aria-haspopup="menu" onClick={(event) => buttonMenu("account", event.currentTarget)}>
        <b className="home-brand" aria-hidden="true">N</b><span>{email}</span><Icon kind="chevron" />
      </button>
      <button className="home-sidebar-item" aria-current={!workspaceId ? "page" : undefined}
        onClick={() => { location.hash = "#/files"; }}><Icon kind="clock" />Recents</button>
      <div className="home-workspaces-label">Workspaces</div>
      {lists.workspaces.map((item) => <button key={item.id} className="home-sidebar-item"
        aria-current={workspaceId === item.id ? "page" : undefined} onClick={() => { location.hash = "#/files/" + item.id; }}>
        <span className="home-workspace-tile" aria-hidden="true">{[...item.name][0]}</span>
        <span className="home-workspace-name">{item.name}</span><small>{roleWords[item.role]}</small>
      </button>)}
      <div className="home-local"><button className="home-sidebar-item" onClick={() => { location.hash = ""; }}>
        <Icon kind="device" />Boards in this browser</button></div>
    </nav>
    <div className="home-main">
      <header className="home-topbar"><h1>{pageName}</h1>{button}{canMake && <button className="home-new-board"
        aria-haspopup={!workspaceId && creatable.length > 1 ? "menu" : undefined} disabled={creating}
        onClick={(event) => newBoard(event.currentTarget)}><Icon kind="plus" />New board</button>}</header>
      <div className="home-body" ref={body}>
        {workspace && <div className="home-workspace-head"><h2>{workspace.name}</h2><span className="home-chip">{roleWords[workspace.role]}</span>
          <div className="home-head-space" />{lists.status !== "notFound" && <button className="home-sort" aria-haspopup="menu"
            onClick={(event) => buttonMenu("sort", event.currentTarget)}>{sortWords[sort]}<Icon kind="chevron" /></button>}
        </div>}
        {lists.status === "ready" && rows.length > 0 && <div className="home-grid" role="listbox" aria-label="Boards">
          {rows.map((row) => <HomeCard key={row.id} row={row} recent={!workspaceId} selected={selected === row.id}
            select={() => setSelected(row.id)} open={() => { location.hash = "#/b/" + row.id; }}
            showMenu={(position) => setMenu({ ...position, kind: "card", row })} renaming={renaming === row.id}
            endRename={() => setRenaming("")} rename={(title, previous) => { void rename(row, title, previous); }} />)}
        </div>}
        {lists.paging && <p role="status">Loading boards…</p>}
        {(lists.status !== "ready" || !rows.length) && <div className="home-state"><div>{stateContent()}</div></div>}
      </div>
    </div>
    {menu && <HomeMenu key={menu.kind + (menu.kind === "card" ? menu.row.id : "")} entries={menuEntries()} position={menu} close={() => setMenu(null)} />}
    {input}
    {toast.text && <div className="home-toast" role="status">{toast.text}</div>}
  </main>}
  </HomeImport>;
}
