// SPDX-License-Identifier: Apache-2.0
import { afterAll, afterEach } from "vitest";
import { takeServerWarnings } from "board-test-driver";
import { assertNoServerWarnings } from "./server-warnings.ts";

function checkServerWarnings() {
  assertNoServerWarnings(takeServerWarnings());
}

// Vitest's stack order runs these after the test file's cleanup hooks.
afterEach(checkServerWarnings);
afterAll(checkServerWarnings);
