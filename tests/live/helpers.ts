/**
 * Shared helpers for the LIVE contract suites under `tests/live/**`.
 *
 * The live tests authenticate with a SHARED CI test key that is rate-limited to
 * ~1 request/second. When several repos/CI jobs exercise that key at once, the
 * API legitimately returns HTTP 429 (rate limit). A 429 is NOT a defect in the
 * SDK or the endpoint under test — it is cross-repo contention on the shared
 * key. Failing the build on it red-flags otherwise-green code.
 *
 * `skipIfRateLimited` lets a live test treat a 429 as a SKIP (not a failure):
 * pass it the caught error and the Vitest test context. If the error is a
 * rate-limit error (HTTP 429 / `RateLimitError`) the current test is marked
 * skipped with a clear message; any other error is re-thrown so real failures
 * still fail the build.
 */
import { RateLimitError } from "../../src/errors.js";

/** Vitest test context shape we rely on (just the dynamic `skip`). */
export interface SkippableTaskContext {
  skip: (note?: string) => void;
}

/** Space requests to respect the ~1 req/sec rate limit on the shared key. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Inter-test delay (ms). Must be >= 1.1s to stay under the 1 req/sec limit and
 * reduce 429s in the first place.
 */
export const RATE_LIMIT_DELAY_MS = 1100;

/** True when the error represents an HTTP 429 rate-limit response. */
export function isRateLimitError(e: unknown): boolean {
  if (e instanceof RateLimitError) return true;
  // Defensive duck-typing in case the error crosses a module/realm boundary
  // (different `instanceof` identity) but still carries the 429 signal.
  const err = e as { statusCode?: number; status?: number; name?: string } | null;
  return !!err && (err.statusCode === 429 || err.status === 429 || err.name === "RateLimitError");
}

/**
 * If `e` is a rate-limit (429) error, mark the current test SKIPPED with a
 * clear message and return. Otherwise re-throw so genuine failures still fail.
 *
 * Usage:
 *   it("...", async (ctx) => {
 *     try {
 *       const res = await client.someLiveCall();
 *       expect(res)...;
 *     } catch (e) {
 *       skipIfRateLimited(e, ctx);
 *     }
 *   });
 */
export function skipIfRateLimited(e: unknown, ctx: SkippableTaskContext): void {
  if (isRateLimitError(e)) {
    ctx.skip(
      "Skipped: shared CI test key hit its rate limit (HTTP 429). " +
        "This is cross-repo rate-limit contention, not an SDK/endpoint failure.",
    );
    return;
  }
  throw e;
}
