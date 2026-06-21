import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import {
  intervalToSeconds,
  type Subscription,
  type SubscriptionEventsResult,
} from "../../src/resources/subscriptions.js";
import { ValidationError } from "../../src/errors.js";

const mockWatch: Subscription = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Crude desk",
  codes: ["BRENT_CRUDE_USD", "WTI_USD"],
  interval_seconds: 300,
  status: "active",
  deliver_webhook: false,
  source: "sdk-node",
  tool_name: null,
  last_evaluated_at: null,
  next_run_at: "2026-06-21T00:05:00Z",
  created_at: "2026-06-21T00:00:00Z",
};

describe("SubscriptionsResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("list()", () => {
    it("returns subscriptions from the { subscriptions } envelope", async () => {
      const spy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ subscriptions: [mockWatch] });

      const result = await client.subscriptions.list();

      expect(spy).toHaveBeenCalledWith("/v1/subscriptions", {});
      expect(result).toEqual([mockWatch]);
      expect(result).toHaveLength(1);
    });

    it("tolerates a bare array response", async () => {
      vi.spyOn(client as any, "request").mockResolvedValue([mockWatch]);
      const result = await client.subscriptions.list();
      expect(result).toEqual([mockWatch]);
    });

    it("returns [] when subscriptions is missing", async () => {
      vi.spyOn(client as any, "request").mockResolvedValue({});
      const result = await client.subscriptions.list();
      expect(result).toEqual([]);
    });
  });

  describe("create()", () => {
    it("maps friendly interval, defaults source to sdk-node, and posts", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({ subscription: mockWatch });

      const result = await client.subscriptions.create({
        name: "Crude desk",
        codes: ["BRENT_CRUDE_USD", "WTI_USD"],
        interval: "5m",
      });

      expect(spy).toHaveBeenCalledWith(
        "/v1/subscriptions",
        {},
        {
          method: "POST",
          body: {
            name: "Crude desk",
            codes: ["BRENT_CRUDE_USD", "WTI_USD"],
            interval_seconds: 300,
          },
          headers: { "X-OPA-Source": "sdk-node" },
        },
      );
      expect(result).toEqual(mockWatch);
    });

    it("forwards source/tool as X-OPA-Source / X-OPA-Tool headers", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mockWatch);

      await client.subscriptions.create({
        codes: ["WTI_USD"],
        interval: "1h",
        source: "mcp",
        tool: "my-bot",
        deliverWebhook: true,
      });

      const [, , options] = spy.mock.calls[0];
      expect(options.headers).toEqual({ "X-OPA-Source": "mcp", "X-OPA-Tool": "my-bot" });
      expect(options.body.interval_seconds).toBe(3600);
      expect(options.body.deliver_webhook).toBe(true);
    });

    it("defaults interval to 5m (300s) when omitted", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mockWatch);
      await client.subscriptions.create({ codes: ["WTI_USD"] });
      const [, , options] = spy.mock.calls[0];
      expect(options.body.interval_seconds).toBe(300);
    });

    it("rejects empty codes", async () => {
      await expect(client.subscriptions.create({ codes: [] })).rejects.toThrow(ValidationError);
    });

    it("rejects an invalid interval", async () => {
      await expect(
        client.subscriptions.create({ codes: ["WTI_USD"], interval: "banana" }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("delete()", () => {
    it("issues a DELETE to the subscription path", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue({});
      await client.subscriptions.delete(mockWatch.id);
      expect(spy).toHaveBeenCalledWith(
        `/v1/subscriptions/${mockWatch.id}`,
        {},
        { method: "DELETE" },
      );
    });

    it("rejects an empty id", async () => {
      await expect(client.subscriptions.delete("")).rejects.toThrow(ValidationError);
    });
  });

  describe("events()", () => {
    const mockResult: SubscriptionEventsResult = {
      cursor: 42,
      has_more: false,
      events: [{ seq: 42, watch_id: mockWatch.id, type: "evaluated", code: "WTI_USD" }],
    };

    it("passes since/watchId/limit as query params", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mockResult);

      const result = await client.subscriptions.events({
        since: 10,
        watchId: mockWatch.id,
        limit: 50,
      });

      expect(spy).toHaveBeenCalledWith("/v1/subscriptions/events", {
        since: "10",
        watch_id: mockWatch.id,
        limit: "50",
      });
      expect(result).toEqual(mockResult);
    });

    it("works with no options (no params)", async () => {
      const spy = vi.spyOn(client as any, "request").mockResolvedValue(mockResult);
      await client.subscriptions.events();
      expect(spy).toHaveBeenCalledWith("/v1/subscriptions/events", {});
    });
  });
});

describe("intervalToSeconds()", () => {
  it("maps presets", () => {
    expect(intervalToSeconds("5m")).toBe(300);
    expect(intervalToSeconds("15m")).toBe(900);
    expect(intervalToSeconds("1h")).toBe(3600);
    expect(intervalToSeconds("hourly")).toBe(3600);
    expect(intervalToSeconds("daily")).toBe(86400);
  });

  it("defaults to 5m when undefined", () => {
    expect(intervalToSeconds(undefined)).toBe(300);
  });

  it("parses unit expressions", () => {
    expect(intervalToSeconds("30s")).toBe(30);
    expect(intervalToSeconds("10m")).toBe(600);
    expect(intervalToSeconds("2h")).toBe(7200);
    expect(intervalToSeconds("1d")).toBe(86400);
  });

  it("accepts raw seconds", () => {
    expect(intervalToSeconds(120)).toBe(120);
  });

  it("is case/whitespace tolerant", () => {
    expect(intervalToSeconds(" 1H ")).toBe(3600);
    expect(intervalToSeconds("DAILY")).toBe(86400);
  });

  it("throws on invalid values", () => {
    expect(() => intervalToSeconds("banana")).toThrow(ValidationError);
    expect(() => intervalToSeconds(0)).toThrow(ValidationError);
    expect(() => intervalToSeconds(-5)).toThrow(ValidationError);
  });
});
