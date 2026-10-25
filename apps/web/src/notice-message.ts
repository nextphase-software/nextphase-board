// SPDX-License-Identifier: Apache-2.0

export function noticeMessage(message: string) {
  const acknowledgement = /^Local revision \d+ acknowledged after transaction completion\.$/.test(message);
  const routineStorage = message === "Stored only in this browser profile. Browser storage is not a backup.";
  const visibleMessage = acknowledgement || routineStorage ? "" : message;
  return { acknowledgement, routineStorage, visibleMessage };
}
