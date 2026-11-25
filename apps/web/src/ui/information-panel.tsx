// SPDX-License-Identifier: Apache-2.0

type Props = {
  linkLine: string;
  busy: boolean;
  composing: boolean;
  toggle: (name: string) => void;
};

export function InformationPanel({
  busy, composing, toggle, linkLine
}: Props) {
  return (
    <section className="information-panel floating" aria-label="About local storage">
      <p>One board in this browser origin/profile. Browser storage is not a backup.</p>
      {linkLine && <p>{linkLine}</p>}
      <button disabled={busy || composing} onClick={() => toggle("Information")}>Close</button>
    </section>
  );
}
