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
    // Type-level contract tests (`*.test-d.ts`). The transport ends in `as T`,
    // so `tsc` is clean however wrong a published type is — the only way to
    // hold the type contract is to assert on the types themselves, and the
    // only way that is a GUARD rather than a comment is for `npm test` to run
    // it. tsconfig.json excludes `tests/`, hence the dedicated project file.
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test-d.ts"],
      tsconfig: "./tsconfig.typecheck.json",
    },
  },
});
