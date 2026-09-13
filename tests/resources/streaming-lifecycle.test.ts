/**
 * #84 — a permanently rejected stream must end, and setup must be bounded.
 *
 * Distinct from #91 (the EventEmitter error contract, same file): this is
 * about the ActionCable state machine. A rejected subscription left the socket
 * open and unmanaged, a server `disconnect` with `reconnect: false` was
 * retried anyway, and a socket that opened but never confirmed hung forever.
 *
 * Everything is driven through the real PriceStreamSubscription with a mock
 * `ws`, and asserted on what the class actually did to the socket and its
 * timers — not on an internal flag.
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

  serverSend(frame: unknown): void {
    this.emit("message", Buffer.from(JSON.stringify(frame)));
  }
}

const WS = MockWebSocket as unknown as typeof import("ws").default;
const URL_ = "wss://api.oilpriceapi.com/cable";
const KEY = "fixture_key_not_a_real_credential";

const last = () => MockWebSocket.instances[MockWebSocket.instances.length - 1];

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.spyOn(process, "emitWarning").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("#84.1 reject_subscription is terminal", () => {
  function rejected() {
    const errors: Error[] = [];
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: true, reconnectDelay: 10 },
      WS,
    );
    sub.on("error", (e: Error) => errors.push(e));
    sub.connect();
    const ws = last();
    ws.open();
    ws.serverSend({ type: "reject_subscription" });
    // The real server closes the socket after rejecting. Without this the
    // mock is kinder than the network and the reconnect bug stays hidden.
    ws.emit("close", 1006, Buffer.from(""));
    return { sub, ws, errors };
  }

  it("closes the socket instead of leaving it open", () => {
    const { ws } = rejected();
    expect(ws.closeCalls).toBeGreaterThan(0);
  });

  it("emits exactly one terminal error", () => {
    const { errors } = rejected();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/rejected/i);
  });

  it("schedules no reconnect — a permanent rejection is not transient", () => {
    vi.useFakeTimers();
    const { sub } = rejected();
    const opened = MockWebSocket.instances.length;

    vi.advanceTimersByTime(60_000);

    expect(MockWebSocket.instances.length).toBe(opened);
    expect(vi.getTimerCount()).toBe(0);
    sub.close();
  });
});

describe("#84.2 a server disconnect with reconnect:false is respected", () => {
  it("does not reconnect after an unauthorized disconnect", () => {
    vi.useFakeTimers();
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: true, reconnectDelay: 10 },
      WS,
    );
    sub.on("error", () => {});
    sub.connect();
    const ws = last();
    ws.open();

    ws.serverSend({ type: "disconnect", reason: "unauthorized", reconnect: false });
    // ActionCable sends the disconnect frame and then closes the transport.
    ws.emit("close", 1006, Buffer.from(""));
    const opened = MockWebSocket.instances.length;
    vi.advanceTimersByTime(60_000);

    expect(MockWebSocket.instances.length).toBe(opened);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still reconnects after a disconnect that permits it", () => {
    vi.useFakeTimers();
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: true, reconnectDelay: 10 },
      WS,
    );
    sub.on("error", () => {});
    sub.connect();
    const ws = last();
    ws.open();

    ws.serverSend({ type: "disconnect", reason: "server_restart", reconnect: true });
    ws.emit("close", 1006, Buffer.from(""));
    vi.advanceTimersByTime(1_000);

    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    sub.close();
  });
});

describe("#84.3 protocol setup is bounded", () => {
  it("gives up on a socket that opens but never confirms", () => {
    vi.useFakeTimers();
    const errors: Error[] = [];
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: false, setupTimeout: 5_000 },
      WS,
    );
    sub.on("error", (e: Error) => errors.push(e));
    sub.connect();
    last().open();
    // welcome and confirm_subscription never arrive.

    vi.advanceTimersByTime(5_001);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/confirm/i);
    expect(last().closeCalls).toBeGreaterThan(0);
    expect(sub.isSubscribed).toBe(false);
  });

  it("does not fire once the subscription is confirmed", () => {
    vi.useFakeTimers();
    const errors: Error[] = [];
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: false, setupTimeout: 5_000 },
      WS,
    );
    sub.on("error", (e: Error) => errors.push(e));
    sub.connect();
    const ws = last();
    ws.open();
    ws.serverSend({ type: "welcome" });
    ws.serverSend({ type: "confirm_subscription" });

    vi.advanceTimersByTime(60_000);

    expect(errors).toEqual([]);
    expect(sub.isSubscribed).toBe(true);
    sub.close();
  });

  it("arms a fresh deadline for each reconnect attempt", () => {
    vi.useFakeTimers();
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: true, reconnectDelay: 10, maxReconnectAttempts: 2, setupTimeout: 1_000 },
      WS,
    );
    sub.on("error", () => {});
    sub.connect();
    last().open();

    // Never confirms; the bounded setup should drive the reconnect budget to
    // exhaustion rather than hanging on the first attempt forever.
    vi.advanceTimersByTime(30_000);

    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("#84.4 close() during a pending setup or backoff leaves nothing armed", () => {
  it("clears the setup deadline", () => {
    vi.useFakeTimers();
    const sub = new PriceStreamSubscription(URL_, KEY, { setupTimeout: 5_000 }, WS);
    sub.on("error", () => {});
    sub.connect();
    last().open();

    sub.close();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears a pending reconnect backoff", () => {
    vi.useFakeTimers();
    const sub = new PriceStreamSubscription(
      URL_,
      KEY,
      { autoReconnect: true, reconnectDelay: 5_000 },
      WS,
    );
    sub.on("error", () => {});
    sub.connect();
    last().emit("close", 1006, Buffer.from(""));

    sub.close();

    expect(vi.getTimerCount()).toBe(0);
  });
});
