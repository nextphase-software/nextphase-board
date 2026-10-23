// SPDX-License-Identifier: Apache-2.0
export function editingCommandReason({ readOnly, composing, pointerGesture, invalidObjectText }: {
  readOnly: boolean;
  composing: boolean;
  pointerGesture: boolean;
  invalidObjectText: boolean;
}): string {
  return readOnly ? "Read-only: editing commands are unavailable."
    : composing ? "Finish text composition before using editing commands."
    : pointerGesture ? "Finish or cancel the pointer gesture before using editing commands."
    : invalidObjectText ? "Correct invalid drafts before using editing commands." : "";
}
