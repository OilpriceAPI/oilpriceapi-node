#!/usr/bin/env node
/**
 * Remove `dist/` before a build.
 *
 * Wired as `prebuild`, so `npm run build` — and therefore `prepublishOnly` —
 * always starts from an empty output directory.
 *
 * Why this exists
 * ---------------
 * `files: ["dist", ...]` publishes whatever `dist/` happens to contain. With
 * no clean step, a module renamed or deleted between releases kept shipping
 * its previous `.js` *and* `.d.ts` forever: a planted
 * `dist/resources/ghost-from-old-release.*` survived a full `npm run build`
 * (exit 0) and appeared in `npm pack --dry-run`. A deep-path import or a stale
 * declaration then resolves against a module that no longer exists in source.
 * See issue #93.
 */
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

rmSync(fileURLToPath(new URL("../dist/", import.meta.url)), {
  recursive: true,
  force: true,
});
