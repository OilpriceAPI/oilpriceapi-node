/**
 * WebSocket Streaming Resource
 *
 * Real-time price streaming via the OilPriceAPI ActionCable endpoint
 * (`wss://api.oilpriceapi.com/cable`).
 *
 * Streaming is a **Professional plan ($99/mo) or higher** feature. Connections
 * authenticate with your API key and subscribe to the `EnergyPricesChannel`,
 * which pushes an initial `welcome` snapshot followed by live `price_update`
 * and (for drilling-tier accounts) `rig_count_update` messages.
 *
 * The implementation speaks the raw ActionCable JSON subprotocol over the
 * `ws` package: it performs the `welcome` -> `subscribe` ->
 * `confirm_subscription` handshake, answers server `ping` frames, and
 * surfaces decoded channel messages as typed events. Auto-reconnect with
 * exponential backoff keeps the stream alive across transient network drops.
 *
 * @example
 * ```typescript
 * const sub = client.stream.prices({}, (update) => {
 *   console.log(update.prices.oil.wti?.original_price);
 * });
 *
 * sub.on("rig_count_update", (m) => console.log(m.rig_count.region, m.rig_count.count));
 * sub.on("error", (err) => console.error(err));
 *
 * // later
 * sub.close();
 * ```
 */

import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { OilPriceAPI } from "../client.js";

/**
 * The ActionCable channel exposed by the OilPriceAPI server.
 *
 * Confirmed from `app/channels/energy_prices_channel.rb`
 * (`class EnergyPricesChannel`).
 */
export const ENERGY_PRICES_CHANNEL = "EnergyPricesChannel";

/**
 * A single normalized price point as broadcast by the server.
 *
 * Mirrors the shape produced by `BroadcastEnergyPricesJob#normalized_price_for_cached`
 * and `EnergyPricesChannel#normalize_price`.
 */
export interface StreamedPrice {
  /** Price converted to the common base unit (USD / MMBtu). */
  normalized_price: number | null;
  /** Original price in its native unit/currency. */
  original_price: number | null;
  /** Native unit (e.g. `"barrel_oil"`, `"mmbtu"`). */
  original_unit: string;
  /** Native currency (e.g. `"USD"`, `"GBP"`, `"EUR"`). */
  original_currency: string;
  /** ISO-8601 timestamp of the underlying price record. */
  timestamp: string;
  /** 24h absolute change (present on the initial `welcome` snapshot). */
  change_24h?: number;
  /** 24h percent change (present on the initial `welcome` snapshot). */
  change_24h_percent?: number;
}

/**
 * The `prices` map carried by `welcome` and `price_update` messages.
 */
export interface StreamedPriceMap {
  oil: {
    brent: StreamedPrice | null;
    wti: StreamedPrice | null;
  };
  natural_gas: {
    uk: StreamedPrice | null;
    us: StreamedPrice | null;
    eu: StreamedPrice | null;
  };
}

/**
 * Live `price_update` broadcast (the most common streamed message).
 */
export interface PriceUpdateMessage {
  type: "price_update";
  timestamp: string;
  base_currency: string;
  base_unit: string;
  prices: StreamedPriceMap;
}

/**
 * Initial snapshot transmitted immediately on subscription confirmation.
 *
 * Note: the server uses `type: "welcome"` for this *channel* message. It is
 * distinct from the ActionCable transport-level `welcome` frame, which the
 * client consumes internally and never surfaces.
 */
export interface WelcomeMessage {
  type: "welcome";
  data: {
    timestamp?: string;
    base_currency?: string;
    base_unit?: string;
    prices?: StreamedPriceMap;
    /** Present only for drilling-tier accounts. */
    drilling_intelligence?: Record<string, unknown>;
    /** Present when the initial snapshot could not be built. */
    error?: string;
  };
}

/**
 * Rig-count update broadcast (drilling / Professional+ accounts).
 */
export interface RigCountUpdateMessage {
  type: "rig_count_update";
  timestamp: string;
  rig_count: {
    code: string;
    region: string;
    count: number;
    source: string;
    updated_at: string;
  };
}

/**
 * Any decoded channel message. Unknown `type` values are passed through so
 * forward-compatible servers don't break older SDKs.
 */
export type StreamMessage =
  | WelcomeMessage
  | PriceUpdateMessage
  | RigCountUpdateMessage
  | { type: string; [key: string]: unknown };

/**
 * Options for {@link StreamingResource.prices}.
 */
export interface StreamPricesOptions {
  /**
   * Optional client-side filter. When provided, only `price_update` messages
   * whose normalized map contains at least one of these commodity slugs are
   * delivered to `onUpdate` / the `price_update` event.
   *
   * Accepts the streamed slugs (`"brent"`, `"wti"`, `"uk"`, `"us"`, `"eu"`)
   * or the upstream codes (`"BRENT_CRUDE_USD"`, `"WTI_USD"`,
   * `"NATURAL_GAS_GBP"`, `"NATURAL_GAS_USD"`, `"DUTCH_TTF_EUR"`).
   *
   * The server broadcasts the full map regardless; filtering is applied
   * locally so callers can scope updates without extra config.
   */
  commodities?: string[];

  /** Disable automatic reconnection (default: reconnect enabled). */
  autoReconnect?: boolean;

  /** Base reconnect delay in ms (default: 1000). */
  reconnectDelay?: number;

  /** Maximum reconnect delay in ms for the exponential backoff (default: 30000). */
  maxReconnectDelay?: number;

  /**
   * Maximum number of consecutive reconnect attempts before giving up and
   * emitting a terminal `error`. `Infinity` to retry forever (default: 10).
   */
  maxReconnectAttempts?: number;
}

/** Callback invoked for each delivered `price_update` message. */
export type PriceUpdateHandler = (update: PriceUpdateMessage) => void;

/** Maps streamed slug <-> upstream code so `commodities` filtering accepts either. */
const COMMODITY_CODE_TO_SLUG: Record<string, string> = {
  BRENT_CRUDE_USD: "brent",
  WTI_USD: "wti",
  NATURAL_GAS_GBP: "uk",
  NATURAL_GAS_USD: "us",
  DUTCH_TTF_EUR: "eu",
};

/**
 * Handle for an active price stream.
 *
 * Extends `EventEmitter`. Emitted events:
 * - `"connected"` — transport connected and subscription confirmed
 * - `"welcome"` — initial snapshot ({@link WelcomeMessage})
 * - `"price_update"` — live price broadcast ({@link PriceUpdateMessage})
 * - `"rig_count_update"` — drilling broadcast ({@link RigCountUpdateMessage})
 * - `"message"` — every decoded channel message ({@link StreamMessage})
 * - `"reconnecting"` — a reconnect attempt is scheduled (`{ attempt, delay }`)
 * - `"disconnected"` — transport closed (`{ code, reason }`)
 * - `"error"` — an `Error` (transport error, unauthorized, or retries exhausted)
 * - `"close"` — the subscription was closed via {@link PriceStreamSubscription.close}
 */
export class PriceStreamSubscription extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly apiKey: string;
  private readonly identifier: string;
  private readonly options: Required<Omit<StreamPricesOptions, "commodities">> & {
    commodities?: string[];
  };
  private readonly commodityFilter: Set<string> | null;

  private closed = false;
  private subscribed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param url - The `wss://.../cable` endpoint.
   * @param apiKey - API key sent as the ActionCable `Authorization: Token <key>` header.
   * @param options - Reconnect + filter options.
   * @param wsImpl - Injectable WebSocket constructor (used by tests to mock).
   * @internal Construct via {@link StreamingResource.prices}.
   */
  constructor(
    url: string,
    apiKey: string,
    options: StreamPricesOptions,
    private readonly wsImpl: typeof WebSocket = WebSocket,
  ) {
    super();
    this.url = url;
    this.apiKey = apiKey;
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      commodities: options.commodities,
    };

    // The ActionCable subscription identifier. The channel takes no params;
    // we additionally pass `api_key` in the identifier for parity with the
    // documented native-WebSocket clients, while the server's
    // ApplicationCable::Connection authenticates from the Authorization header.
    this.identifier = JSON.stringify({
      channel: ENERGY_PRICES_CHANNEL,
      api_key: apiKey,
    });

    if (options.commodities && options.commodities.length > 0) {
      this.commodityFilter = new Set(
        options.commodities.map((c) => COMMODITY_CODE_TO_SLUG[c] ?? c.toLowerCase()),
      );
    } else {
      this.commodityFilter = null;
    }
  }

  /**
   * Open the transport and begin the ActionCable handshake.
   * @internal Called once by {@link StreamingResource.prices}.
   */
  connect(): void {
    if (this.closed) return;

    const ws = new this.wsImpl(this.url, {
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    });
    this.ws = ws;

    ws.on("open", () => {
      // ActionCable sends a transport `welcome` frame first; we subscribe on
      // open (the server tolerates an early subscribe and replies with
      // confirm_subscription once the connection is established).
      this.send({ command: "subscribe", identifier: this.identifier });
    });

    ws.on("message", (raw: WebSocket.RawData) => this.handleRaw(raw));

    ws.on("error", (err: Error) => {
      this.emit("error", err);
    });

    ws.on("close", (code: number, reason: Buffer) => {
      this.ws = null;
      this.subscribed = false;
      this.emit("disconnected", { code, reason: reason?.toString() ?? "" });
      if (!this.closed) {
        this.scheduleReconnect();
      }
    });
  }

  private handleRaw(raw: WebSocket.RawData): void {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      // Ignore malformed frames rather than crash the stream.
      return;
    }

    // ActionCable transport-level frames carry a top-level `type`.
    const transportType = frame["type"];
    if (transportType === "ping") {
      // Heartbeat — nothing to do; presence of frames keeps `ws` alive.
      return;
    }
    if (transportType === "welcome") {
      // Transport handshake complete. (subscribe already sent on open.)
      return;
    }
    if (transportType === "confirm_subscription") {
      this.subscribed = true;
      this.reconnectAttempts = 0;
      this.emit("connected");
      return;
    }
    if (transportType === "reject_subscription") {
      this.emit(
        "error",
        new Error(
          "WebSocket subscription rejected. Streaming requires a Professional " +
            "plan ($99/mo) or higher and a valid API key.",
        ),
      );
      return;
    }
    if (transportType === "disconnect") {
      // Server-initiated disconnect (e.g. auth failure). Let `close` drive reconnect.
      return;
    }

    // Channel message: payload lives under `message`.
    const payload = frame["message"];
    if (payload && typeof payload === "object") {
      this.dispatch(payload as StreamMessage);
    }
  }

  private dispatch(message: StreamMessage): void {
    this.emit("message", message);

    switch (message.type) {
      case "welcome":
        this.emit("welcome", message as WelcomeMessage);
        break;
      case "price_update": {
        const update = message as PriceUpdateMessage;
        if (this.matchesFilter(update)) {
          this.emit("price_update", update);
        }
        break;
      }
      case "rig_count_update":
        this.emit("rig_count_update", message as RigCountUpdateMessage);
        break;
      default:
        // Unknown message types are still emitted via `message` above.
        break;
    }
  }

  private matchesFilter(update: PriceUpdateMessage): boolean {
    if (!this.commodityFilter) return true;
    const { oil, natural_gas } = update.prices ?? {};
    const present: Record<string, StreamedPrice | null | undefined> = {
      brent: oil?.brent,
      wti: oil?.wti,
      uk: natural_gas?.uk,
      us: natural_gas?.us,
      eu: natural_gas?.eu,
    };
    for (const slug of this.commodityFilter) {
      if (present[slug]) return true;
    }
    return false;
  }

  private scheduleReconnect(): void {
    if (this.closed || !this.options.autoReconnect) return;
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.emit(
        "error",
        new Error(
          `WebSocket reconnect failed after ${this.reconnectAttempts} attempt(s); giving up.`,
        ),
      );
      return;
    }

    const attempt = this.reconnectAttempts++;
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, attempt),
      this.options.maxReconnectDelay,
    );
    this.emit("reconnecting", { attempt: attempt + 1, delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === this.wsImpl.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /** Whether the channel subscription has been confirmed by the server. */
  get isSubscribed(): boolean {
    return this.subscribed;
  }

  /**
   * Cleanly tear down the stream: cancels any pending reconnect, unsubscribes
   * from the channel, and closes the socket. Safe to call multiple times.
   * Emits `"close"` once.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      const ws = this.ws;
      try {
        if (ws.readyState === this.wsImpl.OPEN) {
          ws.send(JSON.stringify({ command: "unsubscribe", identifier: this.identifier }));
        }
      } catch {
        // ignore — we're closing anyway
      }
      try {
        ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.subscribed = false;
    this.emit("close");
    this.removeAllListeners();
  }
}

/**
 * Streaming resource — entry point for real-time price subscriptions.
 *
 * Accessed via `client.stream`.
 */
export class StreamingResource {
  constructor(
    private client: OilPriceAPI,
    /**
     * Injectable WebSocket implementation. Defaults to the `ws` package;
     * tests pass a mock constructor.
     * @internal
     */
    private wsImpl: typeof WebSocket = WebSocket,
  ) {}

  /**
   * Derive the `wss://.../cable` endpoint from the client's REST base URL.
   *
   * `https://api.oilpriceapi.com` -> `wss://api.oilpriceapi.com/cable`
   * `http://localhost:5000`       -> `ws://localhost:5000/cable`
   */
  private cableUrl(): string {
    const base = this.client["baseUrl"] as string;
    const wsBase = base
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:")
      .replace(/\/$/, "");
    return `${wsBase}/cable`;
  }

  /**
   * Open a real-time price stream over the `EnergyPricesChannel`.
   *
   * Returns a {@link PriceStreamSubscription} handle (an `EventEmitter`) you
   * can attach further listeners to and `.close()` when done. The optional
   * `onUpdate` callback is a convenience wired to the `price_update` event.
   *
   * @param options - Filtering and reconnect options.
   * @param onUpdate - Optional callback for each `price_update` message.
   * @returns The subscription handle.
   *
   * @throws {OilPriceAPIError} If no API key is configured on the client.
   *
   * @example
   * ```typescript
   * const client = new OilPriceAPI({ apiKey: process.env.OILPRICEAPI_KEY });
   *
   * const sub = client.stream.prices(
   *   { commodities: ["WTI_USD", "BRENT_CRUDE_USD"] },
   *   (update) => {
   *     const wti = update.prices.oil.wti;
   *     if (wti) console.log(`WTI ${wti.original_price} @ ${update.timestamp}`);
   *   },
   * );
   *
   * sub.on("connected", () => console.log("streaming live"));
   * sub.on("error", (err) => console.error("stream error:", err));
   *
   * process.on("SIGINT", () => sub.close());
   * ```
   */
  prices(
    options: StreamPricesOptions = {},
    onUpdate?: PriceUpdateHandler,
  ): PriceStreamSubscription {
    const apiKey = this.client["apiKey"] as string;
    const sub = new PriceStreamSubscription(this.cableUrl(), apiKey, options, this.wsImpl);

    if (onUpdate) {
      sub.on("price_update", onUpdate);
    }

    sub.connect();
    return sub;
  }
}
