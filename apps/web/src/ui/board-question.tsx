// SPDX-License-Identifier: Apache-2.0
type Props = {
  question: { name: string } | null; boardName: string; answerPending: boolean;
  saveUnavailable: boolean; dialog: (node: HTMLDialogElement | null) => void;
  answer: (value: "cancel" | "discard" | "save") => void;
};
export function BoardQuestion({ question, boardName, answerPending, saveUnavailable, dialog, answer }: Props) {
  if (!question) return null;
  return <dialog className="board-question" role="alertdialog" aria-labelledby="board-question-title"
    aria-describedby="board-question-text" ref={dialog}
    onCancel={(event) => { event.preventDefault(); if (!answerPending) answer("cancel"); }}
    onKeyDown={(event) => event.stopPropagation()}>
    <h2 id="board-question-title">Save your changes first?</h2>
    <p id="board-question-text">“{boardName}” has changes that are not saved in this browser yet. Save them before opening “{question.name}”?</p>
    <div className="board-question-actions">
      <button disabled={answerPending} onClick={() => answer("cancel")}>Cancel</button>
      <button disabled={answerPending} onClick={() => answer("discard")}>Discard changes</button>
      <button className="primary" disabled={answerPending} aria-disabled={saveUnavailable ? "true" : undefined}
        onClick={() => { if (!saveUnavailable) answer("save"); }}>Save and open</button>
    </div>
  </dialog>;
}
