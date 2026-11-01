// SPDX-License-Identifier: Apache-2.0
import { TeamDialog } from "./dialog";
import { words, type Outcome } from "./notices";

export function TeamPage({ outcome, close, signIn }: { outcome: Outcome | null; close: () => void; signIn: () => void }) {
  const name = outcome?.name;
  const message = outcome?.message ?? (name === "notFound" ? words.notFound
    : name === "full" ? words.full : name === "restoring" ? words.restoring
      : name === "cantJoin" ? words.cantJoin : name === "disabled" ? words.disabled : words.cantOpen);
  return <main className="team-page"><section className="team-card">
    <b className="brand" aria-hidden="true">N</b>
    <p role="status">{outcome ? message : words.opening}</p>
    {name && ["notFound", "cantJoin", "disabled"].includes(name) && <button onClick={signIn}>Sign in as someone else</button>}
    {name && name !== "cantOpen" && name !== "reconnect" && <button onClick={close}>Close this board</button>}
  </section></main>;
}
export function EndBoardDialog({ outcome, workspace, close, signIn }: {
  outcome: Outcome; workspace: string; close: () => void; signIn: () => void;
}) {
  const removed = outcome.name === "accessRemoved";
  const title = removed ? words.accessTitle : "Sign in again";
  const message = removed ? words.accessRemoved(workspace) : outcome.name === "signedOut" ? words.signedOut : words.expired;
  return <TeamDialog title={title} className="team-ending" close={close}>
    <button className="team-close" aria-label="Close this board" onClick={close}>×</button>
    <h1>{title}</h1><p>{message}</p>
    {!removed && <button className="primary" onClick={signIn}>Sign in again</button>}
    <button onClick={close}>Close this board</button>
  </TeamDialog>;
}
