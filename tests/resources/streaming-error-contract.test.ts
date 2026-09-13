/**
 * #91 — a library may not terminate its host process.
 *
 * `PriceStreamSubscription` extends a bare `EventEmitter`, and Node THROWS
 * when `'error'` is emitted with no listener attached. These tests drive the
 * real class with a mock `ws` and assert the emit does not throw — which is
 * the same thing as "the consumer's process is still alive", because an
 * unhandled 'error' propagates out of `emit` and ends the process with
 * exit code 1.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PriceStreamSubscription } from "../../src/resources/streaming.js";

class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  closeCalls = 0;

  constructor(url: string) {
    super();
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCalls++;
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", 1000, Buffer.from(""));
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open");
  }
}

const WS = MockWebSocket as unknown as typeof import("ws").default;
const URL_ = "wss://api.oilpriceapi.com/cable";
const KEY = "fixture_key_not_a_real_credential";

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  MockWebSocket.instances = [];
  // The floor handler reports; keep the report out of the test output.
  warn = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("#91.1 a transient socket error must not kill the process", () => {
  it("survives ECONNRESET when the consumer wired only price_update", () => {
    const sub = new PriceStreamSubscription(URL_, KEY, { autoReconnect: false }, WS);
    // What StreamingResource.prices() auto-wires: price_update only.
    sub.on("price_update", () => {});
    sub.connect();

    const ws = MockWebSocket.instances[0];
    expect(() => ws.emit("error", new Error("read ECONNRESET"))).not.toThrow();
    sub.close();
  });

  it("still delivers the error to a consumer who did register a listener", () => {
    const seen: Error[] = [];
    const sub = new PriceStreamSubscription(URL_, KEY, { autoReconnect: false }, WS);
    sub.on("error", (err: Error) => seen.push(err));
    sub.connect();

    MockWebSocket.instances[0].emit("error", new Error("read ECONNRESET"));

    expect(seen).toHaveLength(1);
    expect(seen[0].message).toBe("read ECONNRESET");
    sub.close();
  });

  it("reports rather than silently swallowing an unlistened error", () => {
    const sub = new PriceStreamSubscription(URL_, KEY, { autoReconnect: false }, WS);
    sub.connect();

    MockWebSocket.instances[0].emit("error", new Error("read ECONNRESET"));

    expect(warn).toHaveBeenCalled();
    sub.close();
  });
});

describe("#91.2 close() must not disarm the consumer's safety net", () => {
  it("survives a mid-handshake error arriving after close()", () => {
    const seen: Error[] = [];
    const sub = new PriceStreamSubscription(URL_, KEY, { autoReconnect: false }, WS);
    sub.on("error", (err: Error) => seen.push(err));
    sub.connect();

    const ws = MockWebSocket.instances[0];
    sub.close();

    // What the real `ws` package emits when you close mid-handshake — the
    // documented SIGINT case.
    expect(() =>
      ws.emit("error", new Error("WebSocket was closed before the connection was established")),
    ).not.toThrow();
  });

  it("detaches its own handlers from the socket on close", () => {
    const seen: unknown[] = [];
    const sub = new PriceStreamSubscription(URL_, KEY, { autoReconnect: false }, WS);
    sub.on("error", (e: unknown) => seen.push(e));
    sub.on("disconnected", (e: unknown) => seen.push(e));
    sub.connect();
    const ws = MockWebSocket.instances[0];

    sub.close();
    seen.length = 0;

    // Nothing the discarded socket says reaches the consumer any more.
    ws.emit("error", new Error("late socket error"));
    ws.emit("close", 1006, Buffer.from(""));
    ws.emit("message", Buffer.from("{}"));

    expect(seen).toEqual([]);
    expect(ws.listenerCount("message")).toBe(0);
    expect(ws.listenerCount("close")).toBe(0);
    expect(ws.listenerCount("open")).toBe(0);
    // One no-op absorber stays: `ws` is an EventEmitter too, so leaving it
    // bare would just move the unhandled-'error' throw onto the socket.
    expect(ws.listenerCount("error")).toBe(1);
  });

  it("keeps the consumer's listeners rather than removing them", () => {
    const sub = new PriceStreamSubscription(URL_, KEY, { autoReconnect: false }, WS);
    sub.on("error", () => {});
    sub.connect();
    sub.close();

    expect(sub.listenerCount("error")).toBeGreaterThan(0);
  });
});

describe("#91.3 exhausting the reconnect budget must not kill the process", () => {
  it("survives the terminal give-up error with no listener attached", () => {
    vi.useFakeTimers();
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: true, maxReconnectAttempts: 2, reconnectDelay: 1 },
      WS,
    );
    sub.connect();

    expect(() => {
      for (let i = 0; i < 4; i++) {
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        ws.emit("close", 1006, Buffer.from(""));
        vi.advanceTimersByTime(100);
      }
    }).not.toThrow();

    sub.close();
  });
});

describe("#91.4 close() inside the reconnecting handler must not leak a timer", () => {
  it("leaves no armed reconnect timer behind", () => {
    vi.useFakeTimers();
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: true, reconnectDelay: 5000 },
      WS,
    );
    sub.on("error", () => {});
    sub.on("reconnecting", () => sub.close());
    sub.connect();

    MockWebSocket.instances[0].emit("close", 1006, Buffer.from(""));

    // Pre-fix: "reconnecting" was emitted BEFORE this.reconnectTimer was
    // assigned, so close()'s clearTimeout ran against null and
    // scheduleReconnect armed the timer anyway — the process stayed alive
    // for the full reconnectDelay after close() returned (measured 5,001 ms).
    expect(vi.getTimerCount()).toBe(0);
  });
});
