// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { assertNoServerWarnings } from "./server/server-warnings.ts";

test("pending server warnings fail the check with one line per warning", () => {
  assert.throws(() => assertNoServerWarnings([
    { name: "TimeoutOverflowWarning", message: "2147483648 does not fit into a 32-bit signed integer.\nTimeout duration was set to 1." },
    { name: "ExperimentalWarning", message: "Another warning" },
  ]), {
    message: "Test server warning during this check: TimeoutOverflowWarning: 2147483648 does not fit into a 32-bit signed integer. Timeout duration was set to 1.\n" +
      "Test server warning during this check: ExperimentalWarning: Another warning",
  });
});

test("an empty list of server warnings passes the check", () => {
  assert.doesNotThrow(() => assertNoServerWarnings([]));
});
