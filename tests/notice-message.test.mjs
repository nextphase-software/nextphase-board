// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { noticeMessage } from "../apps/web/src/notice-message.ts";

test("a completed local revision acknowledgement is hidden", () => {
  assert.deepEqual(noticeMessage("Local revision 3 acknowledged after transaction completion."), {
    acknowledgement: true, routineStorage: false, visibleMessage: "",
  });
});

test("a trailing space prevents acknowledgement matching", () => {
  const message = "Local revision 3 acknowledged after transaction completion. ";
  assert.deepEqual(noticeMessage(message), {
    acknowledgement: false, routineStorage: false, visibleMessage: message,
  });
});

test("a nonnumeric revision is shown as given", () => {
  const message = "Local revision x acknowledged after transaction completion.";
  assert.deepEqual(noticeMessage(message), {
    acknowledgement: false, routineStorage: false, visibleMessage: message,
  });
});

test("the routine storage message is hidden", () => {
  assert.deepEqual(noticeMessage("Stored only in this browser profile. Browser storage is not a backup."), {
    acknowledgement: false, routineStorage: true, visibleMessage: "",
  });
});

test("the read-only message is shown as given", () => {
  const message = "Another tab is editing. This board is read-only.";
  assert.deepEqual(noticeMessage(message), {
    acknowledgement: false, routineStorage: false, visibleMessage: message,
  });
});

test("an empty message is neither an acknowledgement nor routine storage", () => {
  assert.deepEqual(noticeMessage(""), {
    acknowledgement: false, routineStorage: false, visibleMessage: "",
  });
});
