import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { OilPriceAPI } from "../../src/client.js";
import { StreamingResource } from "../../src/resources/streaming.js";
import type {
  PriceUpdateMessage,
  WelcomeMessage,
  RigCountUpdateMessage,
} from "../../src/resources/streaming.js";

/**
 * Minimal mock of the `ws` WebSocket that mirrors the bits the streaming
 * client uses: an EventEmitter surface, `readyState`, `send`, `close`, and
 * the static `OPEN`/`CONNECTING`/`CLOSED` constants. Tests drive the protocol
 * by calling the helper emit methods.
 */
class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  url: string;
  options: unknown;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(url: string, options?: unknown) {
    super();
    this.url = url;
    this.options = options;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    // Real ws emits 'close' asynchronously; emit synchronously for tests.
    this.emit("close", 1000, Buffer.from(""));
  }

  // --- test helpers ---------------------------------------------------------

  /** Simulate the transport opening. */
  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open");
  }

  /** Deliver a raw JSON frame from the server. */
  serverSend(frame: unknown): void {
    this.emit("message", Buffer.from(JSON.stringify(frame)));
  }

  /** Deliver a raw (possibly malformed) string frame. */
  serverSendRaw(raw: string): void {
    this.emit("message", Buffer.from(raw));
  }

  /** Simulate an abnormal close (drives reconnect). */
  drop(code = 1006): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", code, Buffer.from("dropped"));
  }

  get lastSent(): unknown {
    const raw = this.sent[this.sent.length - 1];
    return raw ? JSON.parse(raw) : undefined;
  }

  get parsedSent(): unknown[] {
    return this.sent.map((s) => JSON.parse(s));
  }
}

function makeStream(
  client: OilPriceAPI,
  options: Parameters<StreamingResource["prices"]>[0] = {},
  onUpdate?: Parameters<StreamingResource["prices"]>[1],
) {
  // Inject the mock WebSocket constructor.
  const resource = new StreamingResource(client, MockWebSocket as never);
  return resource.prices(options, onUpdate);
}

const PRICE_UPDATE: PriceUpdateMessage = {
  type: "price_update",
  timestamp: "2026-06-20T12:00:00Z",
  base_currency: "USD",
  base_unit: "MMBtu",
  prices: {
    oil: {
      brent: {
        normalized_price: 12.3,
        original_price: 78.45,
        original_unit: "barrel_oil",
        original_currency: "USD",
        timestamp: "2026-06-20T12:00:00Z",
      },
      wti: {
        normalized_price: 11.9,
        original_price: 74.1,
        original_unit: "barrel_oil",
        original_currency: "USD",
        timestamp: "2026-06-20T12:00:00Z",
      },
    },
    natural_gas: { uk: null, us: null, eu: null },
  },
};

describe("StreamingResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    MockWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("connect -> subscribe handshake", () => {
    it("opens the cable URL derived from baseUrl with the Token auth header", () => {
      makeStream(client);
      const ws = MockWebSocket.instances[0];
      expect(ws.url).toBe("wss://api.oilpriceapi.com/cable");
      expect(ws.options).toMatchObject({
        headers: { Authorization: "Token test_key_123" },
      });
    });

    it("derives a ws:// URL for an http baseUrl", () => {
      const localClient = new OilPriceAPI({
        apiKey: "k",
        baseUrl: "http://localhost:5000",
      });
      makeStream(localClient);
      expect(MockWebSocket.instances[0].url).toBe("ws://localhost:5000/cable");
    });

    it("sends a subscribe command for EnergyPricesChannel on open", () => {
      makeStream(client);
      const ws = MockWebSocket.instances[0];
      ws.open();

      const sub = ws.lastSent as { command: string; identifier: string };
      expect(sub.command).toBe("subscribe");
      const identifier = JSON.parse(sub.identifier);
      expect(identifier.channel).toBe("EnergyPricesChannel");
      expect(identifier.api_key).toBe("test_key_123");
    });

    it("emits 'connected' on confirm_subscription and reports isSubscribed", () => {
      const handle = makeStream(client);
      const onConnected = vi.fn();
      handle.on("connected", onConnected);

      const ws = MockWebSocket.instances[0];
      ws.open();
      ws.serverSend({ type: "welcome" }); // transport welcome
      expect(handle.isSubscribed).toBe(false);

      ws.serverSend({ identifier: "{}", type: "confirm_subscription" });
      expect(onConnected).toHaveBeenCalledOnce();
      expect(handle.isSubscribed).toBe(true);

      handle.close();
    });

    it("emits an error on reject_subscription", () => {
      const handle = makeStream(client);
      const onError = vi.fn();
      handle.on("error", onError);

      const ws = MockWebSocket.instances[0];
      ws.open();
      ws.serverSend({ identifier: "{}", type: "reject_subscription" });

      expect(onError).toHaveBeenCalledOnce();
      expect((onError.mock.calls[0][0] as Error).message).toMatch(/Professional plan/);
      handle.close();
    });
  });

  describe("message dispatch", () => {
    it("invokes the onUpdate callback and 'price_update' event for price updates", () => {
      const onUpdate = vi.fn();
      const handle = makeStream(client, {}, onUpdate);
      const onEvent = vi.fn();
      handle.on("price_update", onEvent);

      const ws = MockWebSocket.instances[0];
      ws.open();
      ws.serverSend({ identifier: "{}", message: PRICE_UPDATE });

      expect(onUpdate).toHaveBeenCalledOnce();
      const received = onUpdate.mock.calls[0][0] as PriceUpdateMessage;
      expect(received.prices.oil.wti?.original_price).toBe(74.1);
      expect(onEvent).toHaveBeenCalledOnce();
      handle.close();
    });

    it("emits 'welcome' for the initial snapshot message", () => {
      const handle = makeStream(client);
      const onWelcome = vi.fn();
      handle.on("welcome", onWelcome);

      const ws = MockWebSocket.instances[0];
      ws.open();
      const welcome: WelcomeMessage = {
        type: "welcome",
        data: { timestamp: "2026-06-20T12:00:00Z", base_currency: "USD" },
      };
      ws.serverSend({ identifier: "{}", message: welcome });

      expect(onWelcome).toHaveBeenCalledOnce();
      handle.close();
    });

    it("emits 'rig_count_update' for drilling broadcasts", () => {
      const handle = makeStream(client);
      const onRig = vi.fn();
      handle.on("rig_count_update", onRig);

      const ws = MockWebSocket.instances[0];
      ws.open();
      const rig: RigCountUpdateMessage = {
        type: "rig_count_update",
        timestamp: "2026-06-20T12:00:00Z",
        rig_count: {
          code: "US_RIG_COUNT",
          region: "United States",
          count: 540,
          source: "baker_hughes",
          updated_at: "2026-06-20T12:00:00Z",
        },
      };
      ws.serverSend({ identifier: "{}", message: rig });

      expect(onRig).toHaveBeenCalledOnce();
      expect((onRig.mock.calls[0][0] as RigCountUpdateMessage).rig_count.count).toBe(540);
      handle.close();
    });

    it("ignores ping frames and malformed JSON without emitting", () => {
      const handle = makeStream(client);
      const onMessage = vi.fn();
      const onError = vi.fn();
      handle.on("message", onMessage);
      handle.on("error", onError);

      const ws = MockWebSocket.instances[0];
      ws.open();
      ws.serverSend({ type: "ping", message: Date.now() });
      ws.serverSendRaw("not-json{");

      expect(onMessage).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      handle.close();
    });

    it("applies the commodities filter (slug and code forms)", () => {
      const onUpdate = vi.fn();
      // Filter to natural-gas only; PRICE_UPDATE has only oil -> should be filtered out.
      const handle = makeStream(client, { commodities: ["NATURAL_GAS_US", "us"] }, onUpdate);
      const ws = MockWebSocket.instances[0];
      ws.open();
      ws.serverSend({ identifier: "{}", message: PRICE_UPDATE });
      expect(onUpdate).not.toHaveBeenCalled();

      // Now a matching update with US gas present.
      const gasUpdate: PriceUpdateMessage = {
        ...PRICE_UPDATE,
        prices: {
          oil: { brent: null, wti: null },
          natural_gas: {
            uk: null,
            us: {
              normalized_price: 3.1,
              original_price: 3.1,
              original_unit: "mmbtu",
              original_currency: "USD",
              timestamp: "2026-06-20T12:00:00Z",
            },
            eu: null,
          },
        },
      };
      ws.serverSend({ identifier: "{}", message: gasUpdate });
      expect(onUpdate).toHaveBeenCalledOnce();
      handle.close();
    });
  });

  describe("reconnect with backoff", () => {
    it("schedules a reconnect after an abnormal close and re-opens", () => {
      const handle = makeStream(client, { reconnectDelay: 1000 });
      const onReconnecting = vi.fn();
      const onDisconnected = vi.fn();
      handle.on("reconnecting", onReconnecting);
      handle.on("disconnected", onDisconnected);

      const ws1 = MockWebSocket.instances[0];
      ws1.open();
      ws1.serverSend({ identifier: "{}", type: "confirm_subscription" });

      ws1.drop();
      expect(onDisconnected).toHaveBeenCalledOnce();
      expect(onReconnecting).toHaveBeenCalledOnce();
      expect(onReconnecting.mock.calls[0][0]).toMatchObject({ attempt: 1, delay: 1000 });

      // Advance the backoff timer -> a new socket should be created.
      expect(MockWebSocket.instances).toHaveLength(1);
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances).toHaveLength(2);

      handle.close();
    });

    it("uses exponential backoff capped at maxReconnectDelay", () => {
      const handle = makeStream(client, {
        reconnectDelay: 1000,
        maxReconnectDelay: 3000,
      });
      const delays: number[] = [];
      handle.on("reconnecting", (info: { delay: number }) => delays.push(info.delay));

      // Drop repeatedly; each new socket is the latest instance.
      for (let i = 0; i < 4; i++) {
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        ws.open();
        ws.drop();
        vi.advanceTimersByTime(5000);
      }

      // 1000, 2000, then capped at 3000, 3000...
      expect(delays.slice(0, 4)).toEqual([1000, 2000, 3000, 3000]);
      handle.close();
    });

    it("gives up and emits a terminal error after maxReconnectAttempts", () => {
      const handle = makeStream(client, {
        reconnectDelay: 100,
        maxReconnectAttempts: 2,
      });
      const onError = vi.fn();
      handle.on("error", onError);

      for (let i = 0; i < 4; i++) {
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        ws.open();
        ws.drop();
        vi.advanceTimersByTime(10000);
      }

      expect(onError).toHaveBeenCalled();
      expect((onError.mock.calls.at(-1)?.[0] as Error).message).toMatch(/giving up/);
      handle.close();
    });

    it("does not reconnect when autoReconnect is false", () => {
      const handle = makeStream(client, { autoReconnect: false });
      const onReconnecting = vi.fn();
      handle.on("reconnecting", onReconnecting);

      const ws = MockWebSocket.instances[0];
      ws.open();
      ws.drop();
      vi.advanceTimersByTime(60000);

      expect(onReconnecting).not.toHaveBeenCalled();
      expect(MockWebSocket.instances).toHaveLength(1);
      handle.close();
    });
  });

  describe("close / teardown", () => {
    it("sends unsubscribe, closes the socket, and emits 'close'", () => {
      const handle = makeStream(client);
      const onClose = vi.fn();
      handle.on("close", onClose);

      const ws = MockWebSocket.instances[0];
      ws.open();
      ws.serverSend({ identifier: "{}", type: "confirm_subscription" });

      handle.close();

      const unsub = ws.parsedSent.find(
        (m): m is { command: string } =>
          typeof m === "object" &&
          m !== null &&
          (m as { command?: string }).command === "unsubscribe",
      );
      expect(unsub).toBeTruthy();
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      expect(onClose).toHaveBeenCalledOnce();
      expect(handle.isSubscribed).toBe(false);
    });

    it("is idempotent and stops reconnects after close", () => {
      const handle = makeStream(client, { reconnectDelay: 100 });
      const onReconnecting = vi.fn();
      handle.on("reconnecting", onReconnecting);

      const ws = MockWebSocket.instances[0];
      ws.open();
      handle.close();
      handle.close(); // second call must be a no-op

      // A late drop after close must not schedule a reconnect.
      ws.drop();
      vi.advanceTimersByTime(10000);
      expect(onReconnecting).not.toHaveBeenCalled();
      expect(MockWebSocket.instances).toHaveLength(1);
    });
  });

  it("is exposed as client.stream", () => {
    expect(client.stream).toBeInstanceOf(StreamingResource);
  });
});
