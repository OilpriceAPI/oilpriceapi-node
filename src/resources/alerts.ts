/**
 * Price Alerts Resource
 *
 * Manage price alert configurations for automated notifications.
 */

import type { OilPriceAPI } from '../client.js';

/**
 * Valid condition operators for price alerts
 */
export type AlertOperator =
  | 'greater_than'
  | 'less_than'
  | 'equals'
  | 'greater_than_or_equal'
  | 'less_than_or_equal';

/**
 * Price alert configuration
 */
export interface PriceAlert {
  /** Unique alert identifier */
  id: string;
  /** User-friendly alert name */
  name: string;
  /** Commodity code to monitor (e.g., "BRENT_CRUDE_USD") */
  commodity_code: string;
  /** Comparison operator for alert condition */
  condition_operator: AlertOperator;
  /** Price threshold value in USD */
  condition_value: number;
  /** Optional webhook URL for notifications */
  webhook_url?: string | null;
  /** Whether the alert is active */
  enabled: boolean;
  /** Minimum minutes between alert triggers (0-1440) */
  cooldown_minutes: number;
  /** Optional metadata for custom use */
  metadata?: Record<string, unknown> | null;
  /** Number of times this alert has triggered */
  trigger_count: number;
  /** ISO timestamp of last trigger, or null if never triggered */
  last_triggered_at: string | null;
  /** ISO timestamp when alert was created */
  created_at: string;
  /** ISO timestamp when alert was last updated */
  updated_at: string;
}

/**
 * Parameters for creating a new price alert
 */
export interface CreateAlertParams {
  /** User-friendly alert name */
  name: string;
  /** Commodity code to monitor (e.g., "BRENT_CRUDE_USD") */
  commodity_code: string;
  /** Comparison operator for alert condition */
  condition_operator: AlertOperator;
  /** Price threshold value in USD (must be > 0 and <= 1,000,000) */
  condition_value: number;
  /** Optional webhook URL for POST notifications */
  webhook_url?: string;
  /** Whether to enable the alert immediately (default: true) */
  enabled?: boolean;
  /** Minimum minutes between triggers (0-1440, default: 60) */
  cooldown_minutes?: number;
  /** Optional metadata for custom use */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating an existing price alert
 */
export interface UpdateAlertParams {
  /** User-friendly alert name */
  name?: string;
  /** Commodity code to monitor */
  commodity_code?: string;
  /** Comparison operator for alert condition */
  condition_operator?: AlertOperator;
  /** Price threshold value in USD */
  condition_value?: number;
  /** Webhook URL for notifications */
  webhook_url?: string | null;
  /** Whether the alert is active */
  enabled?: boolean;
  /** Minimum minutes between triggers (0-1440) */
  cooldown_minutes?: number;
  /** Metadata for custom use */
  metadata?: Record<string, unknown> | null;
}

/**
 * Response from webhook test endpoint
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
 * Price Alerts Resource
 *
 * Manage automated price alert configurations with webhook notifications.
 *
 * **Features:**
 * - Create alerts with customizable conditions
 * - Monitor commodity prices automatically
 * - Webhook notifications when conditions are met
 * - Cooldown periods to prevent spam
 * - 100 alerts per user soft limit
 *
 * **Example:**
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Create a price alert
 * const alert = await client.alerts.create({
 *   name: 'Brent High Price Alert',
 *   commodity_code: 'BRENT_CRUDE_USD',
 *   condition_operator: 'greater_than',
 *   condition_value: 85.00,
 *   webhook_url: 'https://your-app.com/webhooks/price-alert',
 *   enabled: true,
 *   cooldown_minutes: 60
 * });
 *
 * console.log(`Alert created: ${alert.name} (ID: ${alert.id})`);
 *
 * // List all alerts
 * const alerts = await client.alerts.list();
 * console.log(`You have ${alerts.length} active alerts`);
 *
 * // Update an alert
 * const updated = await client.alerts.update(alert.id, {
 *   condition_value: 90.00,
 *   enabled: false
 * });
 *
 * // Delete an alert
 * await client.alerts.delete(alert.id);
 * ```
 */
export class AlertsResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all price alerts for the authenticated user
   *
   * Returns all configured price alerts, including disabled ones.
   * Alerts are sorted by creation date (newest first).
   *
   * @returns Array of all price alerts
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   * @throws {RateLimitError} If rate limit exceeded
   *
   * @example
   * ```typescript
   * const alerts = await client.alerts.list();
   *
   * alerts.forEach(alert => {
   *   console.log(`${alert.name}: ${alert.commodity_code} ${alert.condition_operator} ${alert.condition_value}`);
   *   console.log(`  Status: ${alert.enabled ? 'Active' : 'Disabled'}`);
   *   console.log(`  Triggers: ${alert.trigger_count}`);
   * });
   * ```
   */
  async list(): Promise<PriceAlert[]> {
    const response = await this.client['request']<{ alerts: PriceAlert[] }>(
      '/v1/alerts',
      {}
    );
    return response.alerts;
  }

  /**
   * Get a specific price alert by ID
   *
   * @param id - The alert ID to retrieve
   * @returns The price alert details
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {DataNotFoundError} If alert ID not found
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const alert = await client.alerts.get('550e8400-e29b-41d4-a716-446655440000');
   * console.log(`Alert: ${alert.name}`);
   * console.log(`Condition: ${alert.commodity_code} ${alert.condition_operator} ${alert.condition_value}`);
   * console.log(`Last triggered: ${alert.last_triggered_at || 'Never'}`);
   * ```
   */
  async get(id: string): Promise<PriceAlert> {
    if (!id || typeof id !== 'string') {
      throw new Error('Alert ID must be a non-empty string');
    }

    const response = await this.client['request']<{ alert: PriceAlert }>(
      `/v1/alerts/${id}`,
      {}
    );
    return response.alert;
  }

  /**
   * Create a new price alert
   *
   * Creates a price alert that monitors a commodity and triggers when
   * the price meets the specified condition. Optionally sends webhook
   * notifications when triggered.
   *
   * **Validation:**
   * - name: 1-100 characters
   * - commodity_code: Must be a valid commodity code
   * - condition_value: Must be > 0 and <= 1,000,000
   * - cooldown_minutes: Must be 0-1440 (24 hours)
   * - webhook_url: Must be valid HTTPS URL if provided
   *
   * **Soft Limit:** 100 alerts per user
   *
   * @param params - Alert configuration parameters
   * @returns The created price alert
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * // Alert when Brent crude exceeds $85
   * const alert = await client.alerts.create({
   *   name: 'Brent $85 Alert',
   *   commodity_code: 'BRENT_CRUDE_USD',
   *   condition_operator: 'greater_than',
   *   condition_value: 85.00,
   *   webhook_url: 'https://myapp.com/webhook',
   *   enabled: true,
   *   cooldown_minutes: 120  // 2 hours between triggers
   * });
   * ```
   */
  async create(params: CreateAlertParams): Promise<PriceAlert> {
    // Validate required fields
    if (!params.name || typeof params.name !== 'string') {
      throw new Error('Alert name is required and must be a string');
    }
    if (params.name.length < 1 || params.name.length > 100) {
      throw new Error('Alert name must be 1-100 characters');
    }
    if (!params.commodity_code || typeof params.commodity_code !== 'string') {
      throw new Error('Commodity code is required and must be a string');
    }
    if (!params.condition_operator) {
      throw new Error('Condition operator is required');
    }

    const validOperators: AlertOperator[] = [
      'greater_than',
      'less_than',
      'equals',
      'greater_than_or_equal',
      'less_than_or_equal'
    ];
    if (!validOperators.includes(params.condition_operator)) {
      throw new Error(`Invalid operator. Must be one of: ${validOperators.join(', ')}`);
    }

    if (typeof params.condition_value !== 'number') {
      throw new Error('Condition value must be a number');
    }
    if (params.condition_value <= 0 || params.condition_value > 1_000_000) {
      throw new Error('Condition value must be greater than 0 and less than or equal to 1,000,000');
    }

    // Validate optional fields
    if (params.webhook_url !== undefined) {
      if (typeof params.webhook_url !== 'string') {
        throw new Error('Webhook URL must be a string');
      }
      if (params.webhook_url && !params.webhook_url.startsWith('https://')) {
        throw new Error('Webhook URL must use HTTPS protocol');
      }
    }

    if (params.cooldown_minutes !== undefined) {
      if (typeof params.cooldown_minutes !== 'number') {
        throw new Error('Cooldown minutes must be a number');
      }
      if (params.cooldown_minutes < 0 || params.cooldown_minutes > 1440) {
        throw new Error('Cooldown minutes must be between 0 and 1440 (24 hours)');
      }
    }

    const url = `${this.client['baseUrl']}/v1/alerts`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.client['apiKey']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_alert: {
          name: params.name,
          commodity_code: params.commodity_code,
          condition_operator: params.condition_operator,
          condition_value: params.condition_value,
          webhook_url: params.webhook_url,
          enabled: params.enabled ?? true,
          cooldown_minutes: params.cooldown_minutes ?? 60,
          metadata: params.metadata
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create alert: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { alert: PriceAlert };
    return data.alert;
  }

  /**
   * Update an existing price alert
   *
   * Updates one or more fields of an existing alert. Only provided
   * fields will be updated; others remain unchanged.
   *
   * @param id - The alert ID to update
   * @param params - Fields to update (partial update supported)
   * @returns The updated price alert
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {DataNotFoundError} If alert ID not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * // Disable an alert
   * await client.alerts.update(alertId, { enabled: false });
   *
   * // Change threshold and cooldown
   * await client.alerts.update(alertId, {
   *   condition_value: 90.00,
   *   cooldown_minutes: 180
   * });
   *
   * // Update webhook URL
   * await client.alerts.update(alertId, {
   *   webhook_url: 'https://newapp.com/webhook'
   * });
   * ```
   */
  async update(id: string, params: UpdateAlertParams): Promise<PriceAlert> {
    if (!id || typeof id !== 'string') {
      throw new Error('Alert ID must be a non-empty string');
    }

    // Validate fields if provided
    if (params.name !== undefined) {
      if (typeof params.name !== 'string' || params.name.length < 1 || params.name.length > 100) {
        throw new Error('Alert name must be 1-100 characters');
      }
    }

    if (params.condition_operator !== undefined) {
      const validOperators: AlertOperator[] = [
        'greater_than',
        'less_than',
        'equals',
        'greater_than_or_equal',
        'less_than_or_equal'
      ];
      if (!validOperators.includes(params.condition_operator)) {
        throw new Error(`Invalid operator. Must be one of: ${validOperators.join(', ')}`);
      }
    }

    if (params.condition_value !== undefined) {
      if (typeof params.condition_value !== 'number') {
        throw new Error('Condition value must be a number');
      }
      if (params.condition_value <= 0 || params.condition_value > 1_000_000) {
        throw new Error('Condition value must be greater than 0 and less than or equal to 1,000,000');
      }
    }

    if (params.webhook_url !== undefined && params.webhook_url !== null) {
      if (typeof params.webhook_url !== 'string' || !params.webhook_url.startsWith('https://')) {
        throw new Error('Webhook URL must be a valid HTTPS URL');
      }
    }

    if (params.cooldown_minutes !== undefined) {
      if (typeof params.cooldown_minutes !== 'number' ||
          params.cooldown_minutes < 0 ||
          params.cooldown_minutes > 1440) {
        throw new Error('Cooldown minutes must be between 0 and 1440 (24 hours)');
      }
    }

    const url = `${this.client['baseUrl']}/v1/alerts/${id}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.client['apiKey']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_alert: params
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update alert: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { alert: PriceAlert };
    return data.alert;
  }

  /**
   * Delete a price alert
   *
   * Permanently deletes a price alert. This action cannot be undone.
   *
   * @param id - The alert ID to delete
   *
   * @throws {DataNotFoundError} If alert ID not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * await client.alerts.delete(alertId);
   * console.log('Alert deleted successfully');
   * ```
   */
  async delete(id: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new Error('Alert ID must be a non-empty string');
    }

    const url = `${this.client['baseUrl']}/v1/alerts/${id}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.client['apiKey']}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete alert: ${response.status} ${errorText}`);
    }
  }

  /**
   * Test a webhook endpoint
   *
   * Sends a test POST request to the webhook URL to verify it's
   * working correctly. Returns response time and status code.
   *
   * **Test Payload Format:**
   * ```json
   * {
   *   "event": "price_alert.test",
   *   "alert_id": "test",
   *   "timestamp": "2025-12-15T12:00:00Z"
   * }
   * ```
   *
   * @param webhookUrl - The HTTPS webhook URL to test
   * @returns Test results including response time and status
   *
   * @throws {ValidationError} If webhook URL is invalid
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const result = await client.alerts.testWebhook('https://myapp.com/webhook');
   *
   * if (result.success) {
   *   console.log(`Webhook OK (${result.status_code}) - ${result.response_time_ms}ms`);
   * } else {
   *   console.error(`Webhook failed: ${result.error}`);
   * }
   * ```
   */
  async testWebhook(webhookUrl: string): Promise<WebhookTestResponse> {
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      throw new Error('Webhook URL is required and must be a string');
    }
    if (!webhookUrl.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS protocol');
    }

    const url = `${this.client['baseUrl']}/v1/alerts/test_webhook`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.client['apiKey']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook_url: webhookUrl
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to test webhook: ${response.status} ${errorText}`);
    }

    const data = await response.json() as WebhookTestResponse;
    return data;
  }
}
