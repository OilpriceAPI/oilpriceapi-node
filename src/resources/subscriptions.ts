/**
 * Agent Subscriptions ("Watches") Resource
 *
 * Persistent server-side "watches" that evaluate a set of commodity codes on a
 * recurring interval and emit events an agent can poll for (OilPriceAPI #3245
 * Phase 2). Designed for autonomous agents (MCP, schedulers, bots) that want
 * change notifications without holding an open connection.
 *
 * The poll endpoint (`events`) does NOT consume the monthly request quota and
 * has its own generous rate-limit lane, so agents can poll frequently.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Lifecycle status of a subscription/watch.
 */
export type SubscriptionStatus = "active" | "paused";

/**
 * Attribution source recorded on a watch. Defaults to `"sdk-node"` when created
 * via this SDK. The API canonicalizes unknown values to `"api"`.
 */
export type SubscriptionSource = string;

/**
 * A persistent agent subscription ("watch").
 *
 * Returned by {@link SubscriptionsResource.list} and
 * {@link SubscriptionsResource.create}.
 */
export interface Subscription {
  /** Unique watch identifier (UUID). */
  id: string;
  /** User-friendly watch name. */
  name: string | null;
  /** Commodity codes this watch evaluates (e.g. ["BRENT_CRUDE_USD"]). */
  codes: string[];
  /** Evaluation cadence in seconds. */
  interval_seconds: number;
  /** Lifecycle status. */
  status: SubscriptionStatus;
  /** Whether matching events are also delivered via webhook. */
  deliver_webhook: boolean;
  /** Attribution source (e.g. "sdk-node", "mcp", "api"). */
  source: string;
  /** Attribution tool name, if any. */
  tool_name: string | null;
  /** ISO timestamp the watch was last evaluated, or null. */
  last_evaluated_at: string | null;
  /** ISO timestamp the watch is next scheduled to run, or null. */
  next_run_at: string | null;
  /** ISO timestamp when the watch was created. */
  created_at: string;
}

/**
 * A friendly interval expression accepted by {@link SubscriptionsResource.create}.
 *
 * Either a preset string ("5m", "15m", "1h", "daily") or an explicit number of
 * seconds.
 */
export type SubscriptionInterval = "5m" | "15m" | "1h" | "daily" | (string & {}) | number;

/**
 * Parameters for creating a new subscription/watch.
 */
export interface CreateSubscriptionParams {
  /** Commodity codes to watch (e.g. ["BRENT_CRUDE_USD", "WTI_USD"]). Required. */
  codes: string[];
  /**
   * Evaluation cadence. A friendly preset ("5m" / "15m" / "1h" / "daily"), a
   * `<n>m` / `<n>h` / `<n>d` / `<n>s` expression, or a number of seconds.
   * Defaults to "5m" when omitted.
   */
  interval?: SubscriptionInterval;
  /** Optional friendly watch name. */
  name?: string;
  /** Whether to also deliver matching events via webhook. */
  deliverWebhook?: boolean;
  /**
   * Attribution source → `X-OPA-Source` header. Defaults to `"sdk-node"`.
   */
  source?: string;
  /** Attribution tool name → `X-OPA-Tool` header. */
  tool?: string;
}

/**
 * A single event emitted by a watch evaluation.
 *
 * The exact payload depends on the event type; common fields are surfaced here
 * while the full server payload is preserved via the index signature.
 */
export interface SubscriptionEvent {
  /** Monotonic per-user sequence number; use as the `since` cursor. */
  seq: number;
  /** The watch that produced this event. */
  watch_id: string;
  /** Event type (e.g. "evaluated", "threshold_crossed"). */
  type?: string;
  /** Commodity code the event concerns, if applicable. */
  code?: string;
  /** ISO timestamp the event was emitted. */
  created_at?: string;
  /** Any additional server-provided fields. */
  [key: string]: unknown;
}

/**
 * Response from {@link SubscriptionsResource.events}.
 */
export interface SubscriptionEventsResult {
  /** The highest `seq` returned; pass as `since` on the next poll. */
  cursor: number;
  /** True if more events are available beyond this page. */
  has_more: boolean;
  /** Events with `seq > since`, ordered ascending by `seq`. */
  events: SubscriptionEvent[];
}

/**
 * Options for {@link SubscriptionsResource.events}.
 */
export interface SubscriptionEventsOptions {
  /** Return only events with `seq` greater than this cursor. Defaults to 0. */
  since?: number;
  /** Restrict to a single watch by id. */
  watchId?: string;
  /** Max events to return (1-500, server default 100). */
  limit?: number;
}

/** Default attribution source for watches created via this SDK. */
const DEFAULT_SOURCE = "sdk-node";

/** Named interval presets mapped to seconds. */
const INTERVAL_PRESETS: Record<string, number> = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  hourly: 3600,
  daily: 86400,
};

/**
 * Convert a friendly interval ("5m" / "1h" / "daily" / 300) into seconds.
 *
 * Accepts:
 * - presets: "5m", "15m", "1h", "hourly", "daily"
 * - unit expressions: "<n>s", "<n>m", "<n>h", "<n>d"
 * - a raw number of seconds
 *
 * @internal Exported for unit testing of the mapping.
 */
export function intervalToSeconds(interval: SubscriptionInterval | undefined): number {
  if (interval === undefined) {
    return INTERVAL_PRESETS["5m"];
  }

  if (typeof interval === "number") {
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new ValidationError("interval (seconds) must be a positive number");
    }
    return Math.floor(interval);
  }

  const key = interval.trim().toLowerCase();

  if (key in INTERVAL_PRESETS) {
    return INTERVAL_PRESETS[key];
  }

  // Unit expression: <number><unit> where unit ∈ s/m/h/d.
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(key);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    const seconds = value * multipliers[unit];
    if (seconds <= 0) {
      throw new ValidationError("interval must be greater than zero");
    }
    return seconds;
  }

  throw new ValidationError(
    `Invalid interval "${interval}". Use a preset ("5m", "15m", "1h", "daily"), ` +
      `a unit expression ("30s", "10m", "2h", "1d"), or a number of seconds.`,
  );
}

/**
 * Agent Subscriptions ("Watches") Resource
 *
 * Manage persistent, recurring watches over commodity codes and poll for the
 * events they emit.
 *
 * **Example:**
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Create a watch that evaluates Brent + WTI every 5 minutes
 * const watch = await client.subscriptions.create({
 *   name: 'Crude desk',
 *   codes: ['BRENT_CRUDE_USD', 'WTI_USD'],
 *   interval: '5m',
 * });
 *
 * // List all watches
 * const watches = await client.subscriptions.list();
 *
 * // Poll for new events
 * let cursor = 0;
 * const { events, cursor: next } = await client.subscriptions.events({ since: cursor });
 * cursor = next;
 *
 * // Remove a watch
 * await client.subscriptions.delete(watch.id);
 * ```
 */
export class SubscriptionsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all subscriptions/watches for the authenticated user.
   *
   * @returns Array of subscriptions, newest first.
   *
   * @example
   * ```typescript
   * const subscriptions = await client.subscriptions.list();
   * console.log(`You have ${subscriptions.length} watches`);
   * ```
   */
  async list(): Promise<Subscription[]> {
    const response = await this.client["request"]<
      Subscription[] | { subscriptions: Subscription[] }
    >("/v1/subscriptions", {});
    return Array.isArray(response) ? response : (response.subscriptions ?? []);
  }

  /**
   * Create a new subscription/watch.
   *
   * Maps the friendly `interval` ("5m" / "1h" / "daily" / seconds) to the
   * API's `interval_seconds`, and forwards optional attribution as
   * `X-OPA-Source` / `X-OPA-Tool` headers (source defaults to `"sdk-node"`).
   *
   * @param params - Watch configuration. `codes` is required.
   * @returns The created subscription.
   *
   * @throws {ValidationError} If `codes` is empty or `interval` is invalid.
   *
   * @example
   * ```typescript
   * const watch = await client.subscriptions.create({
   *   name: 'Crude desk',
   *   codes: ['BRENT_CRUDE_USD', 'WTI_USD'],
   *   interval: '1h',
   *   tool: 'my-trading-bot',
   * });
   * ```
   */
  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    if (!params || !Array.isArray(params.codes) || params.codes.length === 0) {
      throw new ValidationError(
        "codes is required and must be a non-empty array of commodity codes",
      );
    }
    if (params.codes.some((c) => typeof c !== "string" || c.trim() === "")) {
      throw new ValidationError("every code must be a non-empty string");
    }

    const intervalSeconds = intervalToSeconds(params.interval);

    const body: Record<string, unknown> = {
      codes: params.codes,
      interval_seconds: intervalSeconds,
    };
    if (params.name !== undefined) {
      body.name = params.name;
    }
    if (params.deliverWebhook !== undefined) {
      body.deliver_webhook = params.deliverWebhook;
    }

    const headers: Record<string, string> = {
      "X-OPA-Source": params.source ?? DEFAULT_SOURCE,
    };
    if (params.tool !== undefined) {
      headers["X-OPA-Tool"] = params.tool;
    }

    const response = await this.client["request"]<Subscription | { subscription: Subscription }>(
      "/v1/subscriptions",
      {},
      { method: "POST", body, headers },
    );

    return "subscription" in response ? response.subscription : response;
  }

  /**
   * Delete a subscription/watch.
   *
   * @param id - The subscription ID to delete.
   *
   * @throws {ValidationError} If `id` is not a non-empty string.
   *
   * @example
   * ```typescript
   * await client.subscriptions.delete(watch.id);
   * ```
   */
  async delete(id: string): Promise<void> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Subscription ID must be a non-empty string");
    }
    await this.client["request"](`/v1/subscriptions/${id}`, {}, { method: "DELETE" });
  }

  /**
   * Poll for events emitted by your watches.
   *
   * Returns events with `seq` greater than the supplied cursor, ordered
   * ascending. This endpoint does NOT consume the monthly request quota.
   *
   * @param options - Cursor (`since`), optional `watchId`, and `limit`.
   * @returns The next cursor, a `has_more` flag, and the events.
   *
   * @example
   * ```typescript
   * let cursor = 0;
   * while (true) {
   *   const { events, cursor: next, has_more } = await client.subscriptions.events({ since: cursor });
   *   for (const ev of events) handle(ev);
   *   cursor = next;
   *   if (!has_more) break;
   * }
   * ```
   */
  async events(options: SubscriptionEventsOptions = {}): Promise<SubscriptionEventsResult> {
    const params: Record<string, string> = {};
    if (options.since !== undefined) {
      params.since = String(options.since);
    }
    if (options.watchId !== undefined) {
      params.watch_id = options.watchId;
    }
    if (options.limit !== undefined) {
      params.limit = String(options.limit);
    }

    return this.client["request"]<SubscriptionEventsResult>("/v1/subscriptions/events", params);
  }
}
