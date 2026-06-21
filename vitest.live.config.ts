import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only the live contract tests, which hit the real (no-auth) demo API.
    include: ["tests/live/**/*.test.ts"],
    // Network calls to the demo endpoint can be slower than unit tests.
    testTimeout: 30000,
  },
});
