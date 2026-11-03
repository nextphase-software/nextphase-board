// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { joinPages, type BoardRow, type Workspace, type Sort, type Order } from "./home-rules";

type BoardPage = { boards: BoardRow[]; nextCursor?: string | null };
type ListState = {
  key: string; workspaces: Workspace[]; rows: BoardRow[];
  workspacesReady: boolean; boardsReady: boolean; failed: boolean; notFound: boolean;
  cursor: string | null; paging: boolean;
};
function emptyState(key: string): ListState {
  return { key, workspaces: [], rows: [], workspacesReady: false, boardsReady: false,
    failed: false, notFound: false, cursor: null, paging: false };
}

export function useHomeLists(workspace: string | undefined, sort: Sort, order: Order) {
  const [retry, setRetry] = useState(0);
  const key = `${workspace ?? "recents"}/${sort}/${order}/${retry}`;
  const [state, setState] = useState<ListState>(() => emptyState(key));
  const generation = useRef(0), inFlight = useRef(false);
  const currentKey = useRef(key);
  currentKey.current = key;
  const path = workspace ? `/workspaces/${workspace}/boards?sort=${sort}&order=${order}` : "/recent-boards";

  useEffect(() => {
    const token = ++generation.current;
    inFlight.current = false;
    setState(emptyState(key));
    const current = () => token === generation.current && key === currentKey.current;
    // Start both reads together; a workspace 404 wins even if the other read failed first.
    void api<{ workspaces: Workspace[] }>("/workspaces").then((reply) => {
      if (current()) setState((old) => ({ ...old, workspaces: reply.workspaces, workspacesReady: true }));
    }, () => {
      if (current()) setState((old) => ({ ...old, failed: true, rows: [] }));
    });
    void api<BoardPage>(path).then((reply) => {
      if (current()) setState((old) => ({ ...old, rows: old.failed ? [] : joinPages([], reply.boards),
        boardsReady: true, cursor: reply.nextCursor ?? null }));
    }, (error) => {
      if (current()) setState((old) => ({ ...old, rows: [], boardsReady: true,
        failed: true, notFound: !!workspace && error instanceof ApiError && error.status === 404 }));
    });
    return () => { generation.current++; };
  }, [key]);

  const shown = state.key === key ? state : emptyState(key);
  const status = shown.notFound ? "notFound" : shown.failed ? "failed"
    : shown.workspacesReady && shown.boardsReady ? "ready" : "loading";

  async function more() {
    if (!workspace || status !== "ready" || !shown.cursor || inFlight.current) return;
    const token = generation.current;
    inFlight.current = true;
    setState((old) => ({ ...old, paging: true }));
    try {
      const reply = await api<BoardPage>(path + "&cursor=" + encodeURIComponent(shown.cursor));
      if (token === generation.current && key === currentKey.current) {
        setState((old) => ({ ...old, rows: joinPages(old.rows, reply.boards),
          cursor: reply.nextCursor ?? null, paging: false }));
      }
    } catch {
      if (token === generation.current && key === currentKey.current) {
        // A failed later page removes the cards, but retains a successful sidebar.
        setState((old) => ({ ...old, rows: [], failed: true, cursor: null, paging: false }));
      }
    } finally {
      if (token === generation.current && key === currentKey.current) inFlight.current = false;
    }
  }
  return { workspaces: shown.workspaces, rows: status === "ready" ? shown.rows : [],
    status, paging: shown.paging, cursor: shown.cursor, more, retry: () => setRetry((value) => value + 1) };
}
