// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import { catalog } from "../activities/catalog";
import type { Activity, Preview } from "../activities";

type Props = {
  close: () => void;
  addActivity: (entry: Activity) => void;
  previews: Record<string, Preview>;
  firstButton: RefObject<HTMLButtonElement | null>;
  disabled: boolean;
};

export function TemplatesPanel({ close, addActivity, previews, firstButton, disabled }: Props) {
  return <section className="templates-panel floating" aria-label="Templates">
    <header><h2>Templates</h2><button onClick={close}>Close</button></header>
    <h3>Activities</h3>
    <div className="template-cards">
      {catalog.map((entry, index) => {
        const preview = previews[entry.id];
        return <article className="template-card" key={entry.id}>
          <div className="template-preview">
            <svg viewBox={preview?.viewBox} preserveAspectRatio={preview?.preserveAspectRatio ?? "xMidYMid meet"}
              aria-hidden="true" focusable="false">
              {preview?.rectangles.map(({ id, ...rect }) => <rect key={id} {...rect} />)}
              {preview?.lines.map(({ id, ...line }) => <line key={id} {...line} />)}
            </svg>
            <button className="add-template primary" ref={index === 0 ? firstButton : undefined}
              aria-label={"Add template: " + entry.name} disabled={disabled} onClick={() => addActivity(entry)}>
              Add template
            </button>
          </div>
          <h4>{entry.name}</h4><p>{entry.description}</p>
          <small>By {entry.author} · {entry.license}</small>
        </article>;
      })}
    </div>
  </section>;
}
