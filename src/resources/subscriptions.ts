/**
 * Agent Subscriptions ("Watches") Resource
 *
 * Persistent server-side "watches" that evaluate a set of commodity codes on a
 * recurring interval and emit events an agent can poll for (OilPriceAPI #3245
 * Phase 2). Designed for autonomous agents (MCP, schedulers, bots) that want
 * change notifications without holding an open connection.
 *
 * A watch is not a billing subscription: creating, pausing or deleting one
 * changes nothing the account is charged. Each CRUD call counts as one API
 * request; the scheduled evaluations and the `events` poll do not.
 *
 * Shapes verified against a live lifecycle run on 2026-09-13 (#78): every
 * single-watch route returns `data: { subscription: {...} }` and `list`
 * returns `data: { subscriptions: [...] }`.
 */

import type { OilPriceAPI } from "../client.js";
import { OilPriceAPIError, ValidationError } from "../errors.js";

/**
 * Lifecycle status of a subscription/watch.
 */
export type SubscriptionStatus = "active" | "paused";

const STATUSES: readonly SubscriptionStatus[] = ["active", "paused"];

/**
 * Attribution source recorded on a watch. Defaults to `"sdk-node"` when created
 * via this SDK. The API canonicalizes unknown values to `"api"`.
 */
export type SubscriptionSource = string;

/**
 * A persistent agent subscription ("watch").
 *
 * Returned by every method except {@link SubscriptionsResource.delete} and
 * {@link SubscriptionsResource.events}.
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
  /** Attribution source (e.g. "mcp", "api", "dashboard"). */
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
 * A friendly interval expression accepted by {@link SubscriptionsResource.create}
 * and {@link SubscriptionsResource.update}.
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
 * Fields to change with {@link SubscriptionsResource.update}. At least one is
 * required; omitted fields are left unchanged.
 */
export interface UpdateSubscriptionParams {
  /** New watch name (at most 120 characters server-side). */
  name?: string;
  /** Replacement list of commodity codes. Must be non-empty. */
  codes?: string[];
  /** New cadence; must be at or above the plan's minimum interval. */
  interval?: SubscriptionInterval;
  /** Deliver matching events via webhook (requires webhook entitlement). */
  deliverWebhook?: boolean;
  /** `active` or `paused`. {@link SubscriptionsResource.pause} and `resume` are equivalent. */
  status?: SubscriptionStatus;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? "an empty object" : `an object with keys [${keys.join(", ")}]`;
  }
  return typeof value;
}

function unexpectedShape(endpoint: string, expected: string, response: unknown): OilPriceAPIError {
  return new OilPriceAPIError(
    `Unexpected response shape from ${endpoint}: expected ${expected}, received ` +
      `${describeShape(response)}. The SDK will not guess at a response it cannot map. ` +
      `Please report this at https://github.com/OilpriceAPI/oilpriceapi-node/issues`,
    undefined,
    "unexpected_response_shape",
    { rawBody: response },
  );
}

function isSubscription(value: unknown): value is Subscription {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id !== "" &&
    STATUSES.includes(value.status as SubscriptionStatus) &&
    Array.isArray(value.codes)
  );
}

/** Extract the watch from `{ subscription }`, or raise `unexpected_response_shape`. */
function unwrapSubscription(response: unknown, endpoint: string): Subscription {
  if (isRecord(response) && isSubscription(response.subscription)) {
    return response.subscription;
  }
  throw unexpectedShape(
    endpoint,
    'a "subscription" object with an id, codes and a status of active or paused',
    response,
  );
}

function requireId(id: unknown): string {
  if (typeof id !== "string" || id.trim() === "") {
    throw new ValidationError("Subscription ID must be a non-empty string");
  }
  return id;
}

function requireCodes(codes: unknown): string[] {
  if (!Array.isArray(codes) || codes.length === 0) {
    throw new ValidationError("codes is required and must be a non-empty array of commodity codes");
  }
  if (codes.some((c) => typeof c !== "string" || c.trim() === "")) {
    throw new ValidationError("every code must be a non-empty string");
  }
  return codes as string[];
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
 * const watch = await client.subscriptions.create({
 *   name: 'Crude desk',
 *   codes: ['BRENT_CRUDE_USD', 'WTI_USD'],
 *   interval: '1h',
 * });
 *
 * await client.subscriptions.pause(watch.id);
 * await client.subscriptions.update(watch.id, { codes: ['BRENT_CRUDE_USD'] });
 * await client.subscriptions.resume(watch.id);
 *
 * const { events, cursor } = await client.subscriptions.events({ since: 0 });
 *
 * await client.subscriptions.delete(watch.id);
 * ```
 */
export class SubscriptionsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all subscriptions/watches for the authenticated user.
   *
   * @returns Array of subscriptions, newest first. Empty only when the API
   *   returns an empty list.
   *
   * @throws {OilPriceAPIError} `unexpected_response_shape` if the response has
   *   no `subscriptions` array.
   *
   * @example
   * ```typescript
   * const subscriptions = await client.subscriptions.list();
   * console.log(`You have ${subscriptions.length} watches`);
   * ```
   */
  async list(): Promise<Subscription[]> {
    const endpoint = "/v1/subscriptions";
    const response = await this.client["request"]<unknown>(endpoint, {});
    if (isRecord(response) && Array.isArray(response.subscriptions)) {
      const watches = response.subscriptions;
      if (watches.every(isSubscription)) return watches;
    }
    throw unexpectedShape(endpoint, 'a "subscriptions" array of watches', response);
  }

  /**
   * Get one subscription/watch.
   *
   * @param id - The subscription ID.
   * @returns The watch.
   *
   * @throws {ValidationError} If `id` is not a non-empty string.
   * @throws {NotFoundError} If no watch with that ID belongs to the account.
   *
   * @example
   * ```typescript
   * const watch = await client.subscriptions.get(id);
   * console.log(watch.status, watch.next_run_at);
   * ```
   */
  async get(id: string): Promise<Subscription> {
    const endpoint = `/v1/subscriptions/${encodeURIComponent(requireId(id))}`;
    const response = await this.client["request"]<unknown>(endpoint, {});
    return unwrapSubscription(response, "/v1/subscriptions/:id");
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
   * @throws {OilPriceAPIError} HTTP 402 when the plan's watch count or minimum
   *   interval is exceeded; the upgrade details are on `rawBody`.
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
    if (!params) {
      throw new ValidationError(
        "codes is required and must be a non-empty array of commodity codes",
      );
    }
    const codes = requireCodes(params.codes);
    const intervalSeconds = intervalToSeconds(params.interval);

    const body: Record<string, unknown> = {
      codes,
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

    const endpoint = "/v1/subscriptions";
    const response = await this.client["request"]<unknown>(
      endpoint,
      {},
      { method: "POST", body, headers },
    );

    return unwrapSubscription(response, endpoint);
  }

  /**
   * Change a subscription/watch.
   *
   * Sends only the fields given. A PATCH that times out is not replayed and
   * its error carries `ambiguousWrite: true`: check with {@link get} before
   * resending.
   *
   * @param id - The subscription ID.
   * @param params - Fields to change; at least one.
   * @returns The updated watch.
   *
   * @throws {ValidationError} For an empty id, no fields, empty codes, an
   *   invalid interval or a status other than `active` / `paused`.
   * @throws {NotFoundError} If no watch with that ID belongs to the account.
   * @throws {OilPriceAPIError} HTTP 422 with `rawBody.data.details` when the
   *   API rejects a value (unknown code, interval below the plan minimum).
   *
   * @example
   * ```typescript
   * const watch = await client.subscriptions.update(id, { interval: '15m', name: 'Fast desk' });
   * ```
   */
  async update(id: string, params: UpdateSubscriptionParams): Promise<Subscription> {
    const path = `/v1/subscriptions/${encodeURIComponent(requireId(id))}`;
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
      throw new ValidationError("update requires an object of fields to change");
    }

    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.codes !== undefined) body.codes = requireCodes(params.codes);
    if (params.interval !== undefined) body.interval_seconds = intervalToSeconds(params.interval);
    if (params.deliverWebhook !== undefined) body.deliver_webhook = params.deliverWebhook;
    if (params.status !== undefined) {
      // Any other value makes the API return HTTP 500 (api#8471).
      if (!STATUSES.includes(params.status)) {
        throw new ValidationError(`status must be one of ${STATUSES.join(", ")}`);
      }
      body.status = params.status;
    }

    if (Object.keys(body).length === 0) {
      throw new ValidationError(
        "update requires at least one of name, codes, interval, deliverWebhook or status",
      );
    }

    const response = await this.client["request"]<unknown>(path, {}, { method: "PATCH", body });
    return unwrapSubscription(response, "/v1/subscriptions/:id");
  }

  /**
   * Pause a subscription/watch. A paused watch is not evaluated and does not
   * count toward the plan's active-watch limit.
   *
   * @param id - The subscription ID.
   * @returns The watch, with `status: "paused"`.
   *
   * @throws {ValidationError} If `id` is not a non-empty string.
   * @throws {NotFoundError} If no watch with that ID belongs to the account.
   *
   * @example
   * ```typescript
   * await client.subscriptions.pause(id);
   * ```
   */
  async pause(id: string): Promise<Subscription> {
    const path = `/v1/subscriptions/${encodeURIComponent(requireId(id))}/pause`;
    const response = await this.client["request"]<unknown>(path, {}, { method: "POST" });
    return unwrapSubscription(response, "/v1/subscriptions/:id/pause");
  }

  /**
   * Resume a paused subscription/watch. The API schedules its next evaluation
   * immediately.
   *
   * @param id - The subscription ID.
   * @returns The watch, with `status: "active"` and a fresh `next_run_at`.
   *
   * @throws {ValidationError} If `id` is not a non-empty string.
   * @throws {NotFoundError} If no watch with that ID belongs to the account.
   *
   * @example
   * ```typescript
   * const watch = await client.subscriptions.resume(id);
   * console.log(`next evaluation at ${watch.next_run_at}`);
   * ```
   */
  async resume(id: string): Promise<Subscription> {
    const path = `/v1/subscriptions/${encodeURIComponent(requireId(id))}/resume`;
    const response = await this.client["request"]<unknown>(path, {}, { method: "POST" });
    return unwrapSubscription(response, "/v1/subscriptions/:id/resume");
  }

  /**
   * Delete a subscription/watch.
   *
   * @param id - The subscription ID to delete.
   *
   * @throws {ValidationError} If `id` is not a non-empty string.
   * @throws {NotFoundError} If no watch with that ID belongs to the account.
   *
   * @example
   * ```typescript
   * await client.subscriptions.delete(watch.id);
   * ```
   */
  async delete(id: string): Promise<void> {
    await this.client["request"](
      `/v1/subscriptions/${encodeURIComponent(requireId(id))}`,
      {},
      { method: "DELETE" },
    );
  }

  /**
   * Poll for events emitted by your watches.
   *
   * Returns events with `seq` greater than the supplied cursor, ordered
   * ascending. Polling does not count against the request quota.
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
