import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { OilPriceAPI } from "../../src/client.js";
import type {
  WebhookEndpoint,
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookTestResponse,
  WebhookEvent,
} from "../../src/resources/webhooks.js";

describe("WebhooksResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("list()", () => {
    it("should fetch all webhooks successfully", async () => {
      const mockWebhooks: WebhookEndpoint[] = [
        {
          id: "webhook-1",
          name: "Price Updates",
          url: "https://example.com/webhook",
          events: ["price.updated", "alert.triggered"],
          enabled: true,
          successful_deliveries: 100,
          failed_deliveries: 5,
          last_delivery_status: "success",
          last_delivery_at: "2024-01-15T10:00:00Z",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      ];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ webhooks: mockWebhooks });

      const result = await client.webhooks.list();

      expect(requestSpy).toHaveBeenCalledWith("/v1/webhooks", {});
      expect(result).toEqual(mockWebhooks);
      expect(result).toHaveLength(1);
    });

    it("should handle array response format", async () => {
      const mockWebhooks: WebhookEndpoint[] = [];

      vi.spyOn(client as any, "request").mockResolvedValue(mockWebhooks);

      const result = await client.webhooks.list();

      expect(result).toEqual(mockWebhooks);
    });
  });

  describe("get()", () => {
    it("should fetch a specific webhook by ID", async () => {
      const mockWebhook: WebhookEndpoint = {
        id: "webhook-1",
        name: "Price Updates",
        url: "https://example.com/webhook",
        events: ["price.updated"],
        enabled: true,
        successful_deliveries: 100,
        failed_deliveries: 5,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ webhook: mockWebhook });

      const result = await client.webhooks.get("webhook-1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/webhooks/webhook-1", {});
      expect(result).toEqual(mockWebhook);
    });

    it("should throw error for empty webhook ID", async () => {
      await expect(client.webhooks.get("")).rejects.toThrow(
        "Webhook ID must be a non-empty string",
      );
    });

    it("should throw error for non-string webhook ID", async () => {
      await expect(client.webhooks.get(null as any)).rejects.toThrow(
        "Webhook ID must be a non-empty string",
      );
    });
  });

  describe("create()", () => {
    it("should create a new webhook", async () => {
      const params: CreateWebhookParams = {
        name: "Price Alerts",
        url: "https://example.com/webhook",
        events: ["price.updated", "alert.triggered"],
        enabled: true,
      };

      const mockWebhook: WebhookEndpoint = {
        id: "webhook-1",
        ...params,
        successful_deliveries: 0,
        failed_deliveries: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ webhook: mockWebhook });

      const result = await client.webhooks.create(params);

      expect(result).toEqual(mockWebhook);
      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/webhooks",
        {},
        {
          method: "POST",
          body: {
            webhook: {
              name: params.name,
              url: params.url,
              events: params.events,
              enabled: true,
              secret: undefined,
              metadata: undefined,
            },
          },
        },
      );
    });

    it("should validate webhook name", async () => {
      await expect(
        client.webhooks.create({
          name: "",
          url: "https://example.com",
          events: ["price.updated"],
        }),
      ).rejects.toThrow("Webhook name is required");
    });

    it("should validate HTTPS URL", async () => {
      await expect(
        client.webhooks.create({
          name: "Test",
          url: "http://example.com",
          events: ["price.updated"],
        }),
      ).rejects.toThrow("Webhook URL must use HTTPS protocol");
    });

    it("should validate events array is not empty", async () => {
      await expect(
        client.webhooks.create({
          name: "Test",
          url: "https://example.com",
          events: [],
        }),
      ).rejects.toThrow("At least one event type is required");
    });
  });

  describe("update()", () => {
    it("should update a webhook", async () => {
      const params: UpdateWebhookParams = {
        enabled: false,
      };

      const mockWebhook: WebhookEndpoint = {
        id: "webhook-1",
        name: "Price Alerts",
        url: "https://example.com/webhook",
        events: ["price.updated"],
        enabled: false,
        successful_deliveries: 100,
        failed_deliveries: 5,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ webhook: mockWebhook });

      const result = await client.webhooks.update("webhook-1", params);

      expect(result.enabled).toBe(false);
      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/webhooks/webhook-1",
        {},
        {
          method: "PATCH",
          body: { webhook: params },
        },
      );
    });

    it("should throw error for empty webhook ID", async () => {
      await expect(client.webhooks.update("", { enabled: false })).rejects.toThrow(
        "Webhook ID must be a non-empty string",
      );
    });

    it("should validate HTTPS URL when updating", async () => {
      await expect(
        client.webhooks.update("webhook-1", { url: "http://example.com" }),
      ).rejects.toThrow("Webhook URL must use HTTPS protocol");
    });

    it("should validate events array when updating", async () => {
      await expect(client.webhooks.update("webhook-1", { events: [] })).rejects.toThrow(
        "Events must be a non-empty array",
      );
    });
  });

  describe("delete()", () => {
    it("should delete a webhook", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.webhooks.delete("webhook-1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/webhooks/webhook-1", {}, { method: "DELETE" });
    });

    it("should throw error for empty webhook ID", async () => {
      await expect(client.webhooks.delete("")).rejects.toThrow(
        "Webhook ID must be a non-empty string",
      );
    });
  });

  describe("test()", () => {
    it("should test a webhook endpoint", async () => {
      const mockResponse: WebhookTestResponse = {
        success: true,
        status_code: 200,
        response_time_ms: 145,
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockResponse);

      const result = await client.webhooks.test("webhook-1");

      expect(result.success).toBe(true);
      expect(result.status_code).toBe(200);
      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/webhooks/webhook-1/test",
        {},
        { method: "POST" },
      );
    });

    it("should throw error for empty webhook ID", async () => {
      await expect(client.webhooks.test("")).rejects.toThrow(
        "Webhook ID must be a non-empty string",
      );
    });
  });

  describe("events()", () => {
    it("should fetch webhook event history", async () => {
      const mockEvents: WebhookEvent[] = [
        {
          id: "event-1",
          webhook_id: "webhook-1",
          event_type: "price.updated",
          payload: { price: 75.5 },
          status: "success",
          attempts: 1,
          status_code: 200,
          created_at: "2024-01-15T10:00:00Z",
          delivered_at: "2024-01-15T10:00:01Z",
        },
      ];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ events: mockEvents });

      const result = await client.webhooks.events("webhook-1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/webhooks/webhook-1/events", {});
      expect(result).toEqual(mockEvents);
    });

    it("should throw error for empty webhook ID", async () => {
      await expect(client.webhooks.events("")).rejects.toThrow(
        "Webhook ID must be a non-empty string",
      );
    });
  });

  describe("verifySignature()", () => {
    const secret = "webhook_secret_xyz";
    const payload = '{"event":"price.updated","price":80.25}';

    function makeSignature(p: string | Buffer, s: string): string {
      return "sha256=" + createHmac("sha256", s).update(p).digest("hex");
    }

    it("returns true for a valid signature", () => {
      const sig = makeSignature(payload, secret);
      expect(client.webhooks.verifySignature(payload, sig, secret)).toBe(true);
    });

    it("returns false for an invalid signature", () => {
      const badSig = "sha256=" + "b".repeat(64);
      expect(client.webhooks.verifySignature(payload, badSig, secret)).toBe(false);
    });

    it("returns false for an empty signature string", () => {
      expect(client.webhooks.verifySignature(payload, "", secret)).toBe(false);
    });

    it("returns false when the payload differs from what was signed", () => {
      const sig = makeSignature(payload, secret);
      expect(
        client.webhooks.verifySignature('{"event":"price.updated","price":0}', sig, secret),
      ).toBe(false);
    });

    it("returns false when the wrong secret is used", () => {
      const sig = makeSignature(payload, secret);
      expect(client.webhooks.verifySignature(payload, sig, "wrong_secret")).toBe(false);
    });
  });
});
