// SPDX-License-Identifier: Apache-2.0
import type { KeyboardEvent } from "react";
import { backgrounds, csvTypes, exportAreas, exportGroups, fileTypes, qualities, type ExportChoices } from "../board-export";

type Props = {
  choices?: ExportChoices;
  hasSelection: boolean;
  change: <K extends keyof ExportChoices>(key: K, value: ExportChoices[K]) => void;
  close: () => void;
  run: () => void;
};

function show(node: HTMLDialogElement | null) {
  if (!node || node.open) return;
  node.showModal();
  node.querySelector<HTMLButtonElement>(".primary")?.focus();
}

function radios<T extends string>(name: string, values: readonly T[], value: T, choose: (value: T) => void, disabled?: T) {
  return <div className="export-options">{values.map(option => <label key={option}>
    <input type="radio" name={name} value={option} checked={option === value} disabled={option === disabled}
      onChange={() => choose(option)} />{option}
  </label>)}</div>;
}

export function ExportDialog({ choices, hasSelection, change, close, run }: Props) {
  if (!choices) return null;
  const groups = exportGroups[choices.type];

  function keys(event: KeyboardEvent<HTMLDialogElement>) {
    event.stopPropagation();
    const target = event.target;
    const first = event.currentTarget.querySelector<HTMLInputElement>('input[name="export-type"]:checked');
    const last = event.currentTarget.querySelector<HTMLButtonElement>(".primary");
    if (event.key === "Tab") {
      const wrap = event.shiftKey && target === first ? last : !event.shiftKey && target === last ? first : null;
      if (wrap) { event.preventDefault(); wrap.focus(); }
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;
    if (target === last || target instanceof HTMLInputElement && target.type === "radio") {
      event.preventDefault();
      run();
    } else if (target instanceof HTMLButtonElement) {
      event.preventDefault();
      close();
    }
  }

  return <dialog className="board-question export-dialog" aria-labelledby="export-dialog-title" ref={show}
    onCancel={event => { event.preventDefault(); close(); }} onClose={close} onKeyDown={keys}>
    <h2 id="export-dialog-title">Export</h2>
    <fieldset><legend>File type</legend>
      {radios("export-type", fileTypes, choices.type, value => change("type", value))}
    </fieldset>
    {"quality" in groups && <fieldset><legend>Quality</legend>
      {radios("export-quality", qualities, choices[groups.quality], value => change(groups.quality, value))}
    </fieldset>}
    {"background" in groups && <fieldset><legend>Background</legend>
      {radios("export-background", backgrounds, choices[groups.background], value => {
        if (groups.background === "pngBackground") change("pngBackground", value);
        else if (value !== groups.disabledBackground) change("jpgBackground", value);
      }, "disabledBackground" in groups ? groups.disabledBackground : undefined)}
    </fieldset>}
    {"white" in groups && <fieldset><legend>Background</legend><span className="export-static">White</span></fieldset>}
    {"content" in groups && <fieldset><legend>Content type</legend>
      {radios("export-content", csvTypes, choices[groups.content], value => change(groups.content, value))}
    </fieldset>}
    <div className="export-area">
      <label htmlFor={hasSelection ? "export-area" : undefined}>Export area</label>
      {hasSelection
        ? <select id="export-area" value={choices.area} onChange={event => change("area", exportAreas[event.currentTarget.selectedIndex])}>
          {exportAreas.map(area => <option key={area}>{area}</option>)}
        </select>
        : <span className="export-static">Entire page</span>}
    </div>
    <div className="board-question-actions">
      <button type="button" onClick={close}>Cancel</button>
      <button type="button" className="primary" onClick={run}>Export</button>
    </div>
  </dialog>;
}
