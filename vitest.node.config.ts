// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "board-test-driver": fileURLToPath(new URL("tests/server/driver-node.ts", import.meta.url)) } },
  test: { provide: { runner: "node" }, include: ["tests/server/suite.test.ts"], globalSetup: ["tests/server/setup.ts"],
    fileParallelism: false, testTimeout: 120000, hookTimeout: 120000, reporters: ["default"] },
});
