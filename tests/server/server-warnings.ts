// SPDX-License-Identifier: Apache-2.0
export type ServerWarning = { name: string; message: string };

export function assertNoServerWarnings(warnings: readonly ServerWarning[]): void {
  if (warnings.length === 0) return;
  const lines = warnings.map(({ name, message }) => {
    return `Test server warning during this check: ${name}: ${message.replace(/[\r\n]+/g, " ")}`;
  });
  throw Error(lines.join("\n"));
}
