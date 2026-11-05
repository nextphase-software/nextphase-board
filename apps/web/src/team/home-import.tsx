// SPDX-License-Identifier: Apache-2.0
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import { api, ApiError } from "./api";
import { importBoard } from "./import";

export type HomeImportHandle = { pick: (workspace: string) => void };
export function HomeImport({ ref, visible, workspace, menu, creating, creation, setCreating, notify, children }: {
  ref: Ref<HomeImportHandle>; visible: boolean; workspace?: string;
  menu: (opener: HTMLButtonElement) => void; creating: boolean; creation: RefObject<boolean>;
  setCreating: (value: boolean) => void; notify: (text: string, persistent: boolean) => void;
  children: (controls: { button: ReactNode; input: ReactNode }) => ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  const destination = useRef(""), alive = useRef(true);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const node = input.current!, cancel = () => button.current?.focus();
    node.addEventListener("cancel", cancel);
    return () => { alive.current = false; node.removeEventListener("cancel", cancel); };
  }, []);
  function pick(id: string) {
    if (creation.current) return;
    destination.current = id;
    button.current?.focus();
    input.current!.value = "";
    input.current!.click();
  }
  useImperativeHandle(ref, () => ({ pick }));
  async function chosen(file: File) {
    if (creation.current) return;
    creation.current = true;
    setCreating(true); setImporting(true);
    notify(`Importing “${file.name}”…`, true);
    try {
      const reply = await importBoard(file, (body) => api<{ id: string }>(`/workspaces/${destination.current}/boards`, "POST", body));
      if (alive.current) location.hash = "#/b/" + reply.id;
    } catch (error) {
      if (alive.current) {
        const reason = error instanceof ApiError ? error.reason.replaceAll("_", " ")
          : error instanceof Error ? error.message : "no answer";
        notify(`Couldn't import “${file.name}”: ${reason}.`, false);
      }
    } finally {
      creation.current = false;
      if (alive.current) {
        setImporting(false); setCreating(false);
        // Focus after React has made the button available again.
        requestAnimationFrame(() => { if (alive.current) button.current?.focus(); });
      }
    }
  }
  return children({
    button: visible && <button ref={button} className="home-import" aria-label="Import board file…" title="Import board file…"
      aria-haspopup={!workspace ? "menu" : undefined} disabled={creating}
      onClick={(event) => { if (workspace) pick(workspace); else menu(event.currentTarget); }}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13V4M6.5 7.5 10 4l3.5 3.5M4 12.5V16h12v-3.5" />
      </svg><span>{importing ? "Importing…" : "Import board file…"}</span>
    </button>,
    input: <input ref={input} type="file" accept=".nextboard,.json" hidden
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) void chosen(file); else button.current?.focus();
      }} />,
  });
}
