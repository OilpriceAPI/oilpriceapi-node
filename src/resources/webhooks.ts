/**
 * Webhooks Resource
 *
 * Manage webhook endpoints for real-time event notifications.
 */

import type { OilPriceAPI } from "../client.js";

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
      throw new Error("Webhook ID must be a non-empty string");
    }

    const response = await this.client["request"]<
      WebhookEndpoint | { webhook: WebhookEndpoint }
    >(`/v1/webhooks/${id}`, {});

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
      throw new Error("Webhook name is required");
    }
    if (!params.url || !params.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS protocol");
    }
    if (
      !params.events ||
      !Array.isArray(params.events) ||
      params.events.length === 0
    ) {
      throw new Error("At least one event type is required");
    }

    const url = `${this.client["baseUrl"]}/v1/webhooks`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client["apiKey"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: {
          name: params.name,
          url: params.url,
          events: params.events,
          enabled: params.enabled ?? true,
          secret: params.secret,
          metadata: params.metadata,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create webhook: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as
      | WebhookEndpoint
      | { webhook: WebhookEndpoint };
    return "webhook" in data ? data.webhook : data;
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
  async update(
    id: string,
    params: UpdateWebhookParams,
  ): Promise<WebhookEndpoint> {
    if (!id || typeof id !== "string") {
      throw new Error("Webhook ID must be a non-empty string");
    }

    if (params.url !== undefined && !params.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS protocol");
    }

    if (
      params.events !== undefined &&
      (!Array.isArray(params.events) || params.events.length === 0)
    ) {
      throw new Error("Events must be a non-empty array");
    }

    const url = `${this.client["baseUrl"]}/v1/webhooks/${id}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.client["apiKey"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: params,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update webhook: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as
      | WebhookEndpoint
      | { webhook: WebhookEndpoint };
    return "webhook" in data ? data.webhook : data;
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
      throw new Error("Webhook ID must be a non-empty string");
    }

    const url = `${this.client["baseUrl"]}/v1/webhooks/${id}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.client["apiKey"]}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete webhook: ${response.status} ${errorText}`,
      );
    }
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
      throw new Error("Webhook ID must be a non-empty string");
    }

    const url = `${this.client["baseUrl"]}/v1/webhooks/${id}/test`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client["apiKey"]}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to test webhook: ${response.status} ${errorText}`,
      );
    }

    return response.json() as Promise<WebhookTestResponse>;
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
      throw new Error("Webhook ID must be a non-empty string");
    }

    const response = await this.client["request"]<
      WebhookEvent[] | { events: WebhookEvent[] }
    >(`/v1/webhooks/${id}/events`, {});

    return Array.isArray(response) ? response : response.events;
  }
}
