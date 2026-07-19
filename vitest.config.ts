import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      oilpriceapi: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  test: {
    // Live contract tests under tests/live/** hit the real API over the network.
    // They are excluded from the default `npm test` run so offline/CI unit runs
    // stay deterministic. Run them explicitly with `npm run test:live`.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/live/**"],
  },
});
