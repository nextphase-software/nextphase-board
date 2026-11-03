// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef } from "react";
import { TeamDialog } from "./dialog";
import { endingMessage, words, type Outcome } from "./notices";

export function TeamPage({ outcome, close, signIn, count = 0 }: { outcome: Outcome | null; close: () => void; signIn: () => void; count?: number }) {
  const name = outcome?.name;
  const message = outcome?.message ?? (name === "notFound" ? words.notFound
    : name === "full" ? words.full : name === "restoring" ? words.restoring
      : name === "cantJoin" ? words.cantJoin : name === "disabled" ? endingMessage(name, "", count) : words.cantOpen);
  return <main className="team-page"><section className="team-card">
    <b className="brand" aria-hidden="true">N</b>
    <p role="status">{outcome ? message : words.opening}</p>
    {name && ["notFound", "cantJoin", "disabled"].includes(name) && <button onClick={signIn}>Sign in as someone else</button>}
    {name && name !== "cantOpen" && name !== "reconnect" && <button onClick={close}>Close this board</button>}
  </section></main>;
}
export function EndBoardDialog({ outcome, workspace, close, signIn, count = 0 }: {
  outcome: Outcome; workspace: string; close: () => void; signIn: () => void; count?: number;
}) {
  const removed = outcome.name === "accessRemoved";
  const title = removed ? words.accessTitle : "Sign in again";
  const message = endingMessage(outcome.name, workspace, count);
  return <TeamDialog title={title} className="team-ending" close={close}>
    <button className="team-close" aria-label="Close this board" onClick={close}>×</button>
    <h1>{title}</h1><p>{message}</p>
    {!removed && <button className="primary" onClick={signIn}>Sign in again</button>}
    <button onClick={close}>Close this board</button>
  </TeamDialog>;
}

export type PendingLeave = { run: () => void; opener: Element | null };
export function LeaveBoardQuestion({ count, boardName, pending, stay }: {
  count: number; boardName: string; pending: PendingLeave; stay: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), stayButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    node.showModal(); stayButton.current?.focus();
    return () => {
      node.close();
      const opener = pending.opener;
      if (opener instanceof HTMLElement && opener.isConnected && opener.getClientRects().length &&
        !opener.matches(":disabled")) opener.focus();
      else document.querySelector<HTMLElement>(".scene")?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="board-question team-leave" role="alertdialog"
    aria-labelledby="team-leave-title" aria-describedby="team-leave-text"
    onCancel={(event) => { event.preventDefault(); stay(); }}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); stay(); }
      if (event.key === "Tab") {
        const buttons = [...dialog.current!.querySelectorAll("button")];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); }
      }
    }}>
    <h2 id="team-leave-title">{words.leaveTitle(count)}</h2>
    <p id="team-leave-text">{words.leaveBody(count, boardName)}</p>
    <div className="board-question-actions">
      <button onClick={pending.run}>{words.leaveAnyway}</button>
      <button ref={stayButton} className="primary" onClick={stay}>{words.stay}</button>
    </div>
  </dialog>;
}
