/**
 * Webhooks Resource
 *
 * Manage webhook endpoints for real-time event notifications.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";
import { verifyWebhookSignature } from "../index.js";

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  /** Unique webhook identifier */
  id: string;
  /** User-friendly webhook name */
  name: string;
  /** Webhook URL (must be HTTPS) */
  url: string;
  /** Event types to subscribe to */
  events: string[];
  /** Whether the webhook is active */
  enabled: boolean;
  /** Optional secret for signature verification */
  secret?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Number of successful deliveries */
  successful_deliveries: number;
  /** Number of failed deliveries */
  failed_deliveries: number;
  /** Last delivery status */
  last_delivery_status?: "success" | "failed";
  /** ISO timestamp of last delivery attempt */
  last_delivery_at?: string;
  /** ISO timestamp when webhook was created */
  created_at: string;
  /** ISO timestamp when webhook was last updated */
  updated_at: string;
}

/**
 * Parameters for creating a webhook
 */
export interface CreateWebhookParams {
  /** User-friendly webhook name */
  name: string;
  /** Webhook URL (must be HTTPS) */
  url: string;
  /** Event types to subscribe to */
  events: string[];
  /** Whether to enable immediately (default: true) */
  enabled?: boolean;
  /** Optional secret for signature verification */
  secret?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating a webhook
 */
export interface UpdateWebhookParams {
  /** User-friendly webhook name */
  name?: string;
  /** Webhook URL */
  url?: string;
  /** Event types to subscribe to */
  events?: string[];
  /** Whether the webhook is active */
  enabled?: boolean;
  /** Secret for signature verification */
  secret?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Webhook test response
 */
export interface WebhookTestResponse {
  /** Test result status */
  success: boolean;
  /** HTTP status code from webhook endpoint */
  status_code: number;
  /** Response time in milliseconds */
  response_time_ms: number;
  /** Response body from webhook endpoint */
  response_body?: string;
  /** Error message if test failed */
  error?: string;
}

/**
 * Webhook event record
 */
export interface WebhookEvent {
  /** Event ID */
  id: string;
  /** Webhook endpoint ID */
  webhook_id: string;
  /** Event type */
  event_type: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Delivery status */
  status: "pending" | "success" | "failed";
  /** Number of delivery attempts */
  attempts: number;
  /** HTTP status code from delivery */
  status_code?: number;
  /** Error message if delivery failed */
  error?: string;
  /** ISO timestamp when event was created */
  created_at: string;
  /** ISO timestamp of last delivery attempt */
  delivered_at?: string;
}

/**
 * Webhooks Resource
 *
 * Manage webhook endpoints for real-time notifications about price changes,
 * alerts, and other events.
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Create a webhook
 * const webhook = await client.webhooks.create({
 *   name: 'Price Updates',
 *   url: 'https://myapp.com/webhooks/prices',
 *   events: ['price.updated', 'alert.triggered'],
 *   enabled: true
 * });
 *
 * // Test the webhook
 * const test = await client.webhooks.test(webhook.id);
 * console.log(`Test result: ${test.success ? 'passed' : 'failed'}`);
 *
 * // List all webhooks
 * const webhooks = await client.webhooks.list();
 * webhooks.forEach(wh => {
 *   console.log(`${wh.name}: ${wh.successful_deliveries} successful`);
 * });
 *
 * // Update webhook
 * await client.webhooks.update(webhook.id, {
 *   enabled: false
 * });
 *
 * // Delete webhook
 * await client.webhooks.delete(webhook.id);
 * ```
 */
export class WebhooksResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all webhook endpoints
   *
   * @returns Array of webhook endpoints
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const webhooks = await client.webhooks.list();
   * webhooks.forEach(wh => {
   *   console.log(`${wh.name} (${wh.enabled ? 'enabled' : 'disabled'})`);
   *   console.log(`  Events: ${wh.events.join(', ')}`);
   * });
   * ```
   */
  async list(): Promise<WebhookEndpoint[]> {
    const response = await this.client["request"]<
      WebhookEndpoint[] | { webhooks: WebhookEndpoint[] }
    >("/v1/webhooks", {});

    return Array.isArray(response) ? response : response.webhooks;
  }

  /**
   * Get a specific webhook endpoint
   *
   * @param id - Webhook ID
   * @returns Webhook endpoint details
   *
   * @throws {NotFoundError} If webhook not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const webhook = await client.webhooks.get('webhook-id');
   * console.log(`${webhook.name}: ${webhook.url}`);
   * console.log(`Success rate: ${webhook.successful_deliveries}/${webhook.successful_deliveries + webhook.failed_deliveries}`);
   * ```
   */
  async get(id: string): Promise<WebhookEndpoint> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Webhook ID must be a non-empty string");
    }

    const response = await this.client["request"]<WebhookEndpoint | { webhook: WebhookEndpoint }>(
      `/v1/webhooks/${id}`,
      {},
    );

    return "webhook" in response ? response.webhook : response;
  }

  /**
   * Create a new webhook endpoint
   *
   * @param params - Webhook configuration
   * @returns Created webhook endpoint
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const webhook = await client.webhooks.create({
   *   name: 'Production Alerts',
   *   url: 'https://api.myapp.com/webhooks',
   *   events: ['alert.triggered', 'price.updated'],
   *   secret: 'my-webhook-secret',
   *   enabled: true
   * });
   * console.log(`Webhook created: ${webhook.id}`);
   * ```
   */
  async create(params: CreateWebhookParams): Promise<WebhookEndpoint> {
    if (!params.name || typeof params.name !== "string") {
      throw new ValidationError("Webhook name is required");
    }
    if (!params.url || !params.url.startsWith("https://")) {
      throw new ValidationError("Webhook URL must use HTTPS protocol");
    }
    if (!params.events || !Array.isArray(params.events) || params.events.length === 0) {
      throw new ValidationError("At least one event type is required");
    }

    const response = await this.client["request"]<WebhookEndpoint | { webhook: WebhookEndpoint }>(
      "/v1/webhooks",
      {},
      {
        method: "POST",
        body: {
          webhook: {
            name: params.name,
            url: params.url,
            events: params.events,
            enabled: params.enabled ?? true,
            secret: params.secret,
            metadata: params.metadata,
          },
        },
      },
    );

    return "webhook" in response ? response.webhook : response;
  }

  /**
   * Update a webhook endpoint
   *
   * @param id - Webhook ID
   * @param params - Fields to update
   * @returns Updated webhook endpoint
   *
   * @throws {NotFoundError} If webhook not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * // Disable a webhook
   * await client.webhooks.update(webhookId, { enabled: false });
   *
   * // Change events
   * await client.webhooks.update(webhookId, {
   *   events: ['alert.triggered']
   * });
   * ```
   */
  async update(id: string, params: UpdateWebhookParams): Promise<WebhookEndpoint> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Webhook ID must be a non-empty string");
    }

    if (params.url !== undefined && !params.url.startsWith("https://")) {
      throw new ValidationError("Webhook URL must use HTTPS protocol");
    }

    if (
      params.events !== undefined &&
      (!Array.isArray(params.events) || params.events.length === 0)
    ) {
      throw new ValidationError("Events must be a non-empty array");
    }

    const response = await this.client["request"]<WebhookEndpoint | { webhook: WebhookEndpoint }>(
      `/v1/webhooks/${id}`,
      {},
      {
        method: "PATCH",
        body: { webhook: params },
      },
    );

    return "webhook" in response ? response.webhook : response;
  }

  /**
   * Delete a webhook endpoint
   *
   * @param id - Webhook ID
   *
   * @throws {NotFoundError} If webhook not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * await client.webhooks.delete(webhookId);
   * console.log('Webhook deleted');
   * ```
   */
  async delete(id: string): Promise<void> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Webhook ID must be a non-empty string");
    }

    await this.client["request"](`/v1/webhooks/${id}`, {}, { method: "DELETE" });
  }

  /**
   * Test a webhook endpoint
   *
   * Sends a test payload to the webhook URL to verify it's reachable.
   *
   * @param id - Webhook ID
   * @returns Test results
   *
   * @throws {NotFoundError} If webhook not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const test = await client.webhooks.test(webhookId);
   * console.log(`Test ${test.success ? 'passed' : 'failed'}`);
   * console.log(`Response time: ${test.response_time_ms}ms`);
   * if (!test.success) {
   *   console.log(`Error: ${test.error}`);
   * }
   * ```
   */
  async test(id: string): Promise<WebhookTestResponse> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Webhook ID must be a non-empty string");
    }

    return this.client["request"]<WebhookTestResponse>(
      `/v1/webhooks/${id}/test`,
      {},
      { method: "POST" },
    );
  }

  /**
   * Get webhook event history
   *
   * Returns recent delivery events for a webhook.
   *
   * @param id - Webhook ID
   * @returns Array of webhook events
   *
   * @throws {NotFoundError} If webhook not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const events = await client.webhooks.events(webhookId);
   * events.forEach(event => {
   *   console.log(`${event.event_type}: ${event.status} (${event.attempts} attempts)`);
   * });
   * ```
   */
  async events(id: string): Promise<WebhookEvent[]> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Webhook ID must be a non-empty string");
    }

    const response = await this.client["request"]<WebhookEvent[] | { events: WebhookEvent[] }>(
      `/v1/webhooks/${id}/events`,
      {},
    );

    return Array.isArray(response) ? response : response.events;
  }

  /**
   * Verify a webhook signature.
   *
   * Validates that a webhook payload was sent by OilPriceAPI by checking
   * the HMAC-SHA256 signature. Uses constant-time comparison to prevent
   * timing attacks.
   *
   * @param payload - Raw request body (string or Buffer)
   * @param signature - Value of the X-OilPriceAPI-Signature header (e.g., "sha256=abc123...")
   * @param secret - Your webhook signing secret
   * @returns true if signature is valid
   *
   * @example
   * ```typescript
   * import express from 'express';
   * import { OilPriceAPI } from 'oilpriceapi';
   *
   * const app = express();
   * const client = new OilPriceAPI({ apiKey: 'your_key' });
   *
   * // Use raw body parser for webhook routes
   * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
   *   const signature = req.headers['x-oilpriceapi-signature'] as string;
   *   const isValid = client.webhooks.verifySignature(req.body, signature, 'your_secret');
   *
   *   if (!isValid) {
   *     return res.status(401).send('Invalid signature');
   *   }
   *
   *   const event = JSON.parse(req.body.toString());
   *   console.log('Verified webhook:', event.type);
   *   res.sendStatus(200);
   * });
   * ```
   */
  verifySignature(payload: string | Buffer, signature: string, secret: string): boolean {
    return verifyWebhookSignature(payload, signature, secret);
  }
}
