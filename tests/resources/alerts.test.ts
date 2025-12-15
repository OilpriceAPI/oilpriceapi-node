import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OilPriceAPI } from '../../src/client.js';
import type { PriceAlert, CreateAlertParams, UpdateAlertParams } from '../../src/resources/alerts.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('AlertsResource', () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: 'test_key_123' });
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('list()', () => {
    it('should fetch all alerts successfully', async () => {
      const mockAlerts: PriceAlert[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Brent High Alert',
          commodity_code: 'BRENT_CRUDE_USD',
          condition_operator: 'greater_than',
          condition_value: 85.00,
          webhook_url: 'https://example.com/webhook',
          enabled: true,
          cooldown_minutes: 60,
          metadata: null,
          trigger_count: 0,
          last_triggered_at: null,
          created_at: '2025-12-15T10:00:00Z',
          updated_at: '2025-12-15T10:00:00Z'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'WTI Low Alert',
          commodity_code: 'WTI_USD',
          condition_operator: 'less_than',
          condition_value: 70.00,
          webhook_url: null,
          enabled: false,
          cooldown_minutes: 120,
          metadata: { tag: 'important' },
          trigger_count: 5,
          last_triggered_at: '2025-12-14T15:30:00Z',
          created_at: '2025-12-14T10:00:00Z',
          updated_at: '2025-12-15T09:00:00Z'
        }
      ];

      // Mock the request method
      const requestSpy = vi.spyOn(client as any, 'request').mockResolvedValue({ alerts: mockAlerts });

      const alerts = await client.alerts.list();

      expect(requestSpy).toHaveBeenCalledWith('/v1/alerts', {});
      expect(alerts).toEqual(mockAlerts);
      expect(alerts).toHaveLength(2);
      expect(alerts[0].name).toBe('Brent High Alert');
      expect(alerts[1].name).toBe('WTI Low Alert');
    });

    it('should return empty array when no alerts exist', async () => {
      const requestSpy = vi.spyOn(client as any, 'request').mockResolvedValue({ alerts: [] });

      const alerts = await client.alerts.list();

      expect(requestSpy).toHaveBeenCalled();
      expect(alerts).toEqual([]);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('should fetch a specific alert by ID', async () => {
      const mockAlert: PriceAlert = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Brent High Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than',
        condition_value: 85.00,
        webhook_url: 'https://example.com/webhook',
        enabled: true,
        cooldown_minutes: 60,
        metadata: null,
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2025-12-15T10:00:00Z',
        updated_at: '2025-12-15T10:00:00Z'
      };

      const requestSpy = vi.spyOn(client as any, 'request').mockResolvedValue({ alert: mockAlert });

      const alert = await client.alerts.get('550e8400-e29b-41d4-a716-446655440000');

      expect(requestSpy).toHaveBeenCalledWith('/v1/alerts/550e8400-e29b-41d4-a716-446655440000', {});
      expect(alert).toEqual(mockAlert);
      expect(alert.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should throw error for empty alert ID', async () => {
      await expect(client.alerts.get('')).rejects.toThrow('Alert ID must be a non-empty string');
    });

    it('should throw error for non-string alert ID', async () => {
      await expect(client.alerts.get(null as any)).rejects.toThrow('Alert ID must be a non-empty string');
      await expect(client.alerts.get(123 as any)).rejects.toThrow('Alert ID must be a non-empty string');
    });
  });

  describe('create()', () => {
    it('should create a new alert with required fields', async () => {
      const params: CreateAlertParams = {
        name: 'Brent High Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than',
        condition_value: 85.00
      };

      const mockCreatedAlert: PriceAlert = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: params.name,
        commodity_code: params.commodity_code,
        condition_operator: params.condition_operator,
        condition_value: params.condition_value,
        webhook_url: null,
        enabled: true,
        cooldown_minutes: 60,
        metadata: null,
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2025-12-15T10:00:00Z',
        updated_at: '2025-12-15T10:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ alert: mockCreatedAlert })
      });

      const alert = await client.alerts.create(params);

      expect(alert).toEqual(mockCreatedAlert);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.oilpriceapi.com/v1/alerts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_key_123',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should create alert with all optional fields', async () => {
      const params: CreateAlertParams = {
        name: 'Complete Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than_or_equal',
        condition_value: 90.00,
        webhook_url: 'https://example.com/webhook',
        enabled: false,
        cooldown_minutes: 180,
        metadata: { tag: 'important', priority: 'high' }
      };

      const mockCreatedAlert: PriceAlert = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        ...params,
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2025-12-15T10:00:00Z',
        updated_at: '2025-12-15T10:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ alert: mockCreatedAlert })
      });

      const alert = await client.alerts.create(params);

      expect(alert.webhook_url).toBe('https://example.com/webhook');
      expect(alert.enabled).toBe(false);
      expect(alert.cooldown_minutes).toBe(180);
      expect(alert.metadata).toEqual({ tag: 'important', priority: 'high' });
    });

    it('should validate alert name', async () => {
      const baseParams = {
        name: 'Valid',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than' as const,
        condition_value: 85.00
      };

      await expect(client.alerts.create({ ...baseParams, name: '' })).rejects.toThrow('Alert name is required and must be a string');
      await expect(client.alerts.create({ ...baseParams, name: 'a'.repeat(101) })).rejects.toThrow('Alert name must be 1-100 characters');
      await expect(client.alerts.create({ ...baseParams, name: null as any })).rejects.toThrow('Alert name is required and must be a string');
    });

    it('should validate commodity code', async () => {
      const baseParams = {
        name: 'Valid Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than' as const,
        condition_value: 85.00
      };

      await expect(client.alerts.create({ ...baseParams, commodity_code: '' })).rejects.toThrow('Commodity code is required and must be a string');
      await expect(client.alerts.create({ ...baseParams, commodity_code: null as any })).rejects.toThrow('Commodity code is required and must be a string');
    });

    it('should validate condition operator', async () => {
      const baseParams = {
        name: 'Valid Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than' as const,
        condition_value: 85.00
      };

      await expect(client.alerts.create({ ...baseParams, condition_operator: 'invalid' as any })).rejects.toThrow('Invalid operator');
      await expect(client.alerts.create({ ...baseParams, condition_operator: '' as any })).rejects.toThrow('Condition operator is required');
    });

    it('should validate condition value', async () => {
      const baseParams = {
        name: 'Valid Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than' as const,
        condition_value: 85.00
      };

      await expect(client.alerts.create({ ...baseParams, condition_value: 0 })).rejects.toThrow('Condition value must be greater than 0');
      await expect(client.alerts.create({ ...baseParams, condition_value: -5 })).rejects.toThrow('Condition value must be greater than 0');
      await expect(client.alerts.create({ ...baseParams, condition_value: 1_000_001 })).rejects.toThrow('less than or equal to 1,000,000');
      await expect(client.alerts.create({ ...baseParams, condition_value: 'invalid' as any })).rejects.toThrow('Condition value must be a number');
    });

    it('should validate webhook URL format', async () => {
      const baseParams = {
        name: 'Valid Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than' as const,
        condition_value: 85.00
      };

      await expect(client.alerts.create({ ...baseParams, webhook_url: 'http://insecure.com' })).rejects.toThrow('Webhook URL must use HTTPS protocol');
      await expect(client.alerts.create({ ...baseParams, webhook_url: 'not-a-url' })).rejects.toThrow('Webhook URL must use HTTPS protocol');
      await expect(client.alerts.create({ ...baseParams, webhook_url: 123 as any })).rejects.toThrow('Webhook URL must be a string');
    });

    it('should validate cooldown minutes range', async () => {
      const baseParams = {
        name: 'Valid Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than' as const,
        condition_value: 85.00
      };

      await expect(client.alerts.create({ ...baseParams, cooldown_minutes: -1 })).rejects.toThrow('Cooldown minutes must be between 0 and 1440');
      await expect(client.alerts.create({ ...baseParams, cooldown_minutes: 1441 })).rejects.toThrow('Cooldown minutes must be between 0 and 1440');
      await expect(client.alerts.create({ ...baseParams, cooldown_minutes: 'invalid' as any })).rejects.toThrow('Cooldown minutes must be a number');
    });

    it('should accept all valid operators', async () => {
      const baseParams = {
        name: 'Valid Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_value: 85.00
      };

      const mockAlert: PriceAlert = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        ...baseParams,
        condition_operator: 'greater_than',
        webhook_url: null,
        enabled: true,
        cooldown_minutes: 60,
        metadata: null,
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2025-12-15T10:00:00Z',
        updated_at: '2025-12-15T10:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ alert: mockAlert })
      });

      const operators = ['greater_than', 'less_than', 'equals', 'greater_than_or_equal', 'less_than_or_equal'] as const;
      for (const operator of operators) {
        await expect(client.alerts.create({ ...baseParams, condition_operator: operator })).resolves.toBeDefined();
      }

      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('update()', () => {
    it('should update alert with partial fields', async () => {
      const alertId = '550e8400-e29b-41d4-a716-446655440000';
      const updateParams: UpdateAlertParams = {
        condition_value: 90.00,
        enabled: false
      };

      const mockUpdatedAlert: PriceAlert = {
        id: alertId,
        name: 'Brent High Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than',
        condition_value: 90.00,
        webhook_url: 'https://example.com/webhook',
        enabled: false,
        cooldown_minutes: 60,
        metadata: null,
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2025-12-15T10:00:00Z',
        updated_at: '2025-12-15T11:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ alert: mockUpdatedAlert })
      });

      const alert = await client.alerts.update(alertId, updateParams);

      expect(alert.condition_value).toBe(90.00);
      expect(alert.enabled).toBe(false);
    });

    it('should update all fields', async () => {
      const alertId = '550e8400-e29b-41d4-a716-446655440000';
      const updateParams: UpdateAlertParams = {
        name: 'Updated Alert',
        commodity_code: 'WTI_USD',
        condition_operator: 'less_than',
        condition_value: 70.00,
        webhook_url: 'https://new-webhook.com/alert',
        enabled: true,
        cooldown_minutes: 120,
        metadata: { updated: true }
      };

      const mockUpdatedAlert: PriceAlert = {
        id: alertId,
        ...updateParams,
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2025-12-15T10:00:00Z',
        updated_at: '2025-12-15T11:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ alert: mockUpdatedAlert })
      });

      const alert = await client.alerts.update(alertId, updateParams);

      expect(alert.name).toBe('Updated Alert');
      expect(alert.commodity_code).toBe('WTI_USD');
      expect(alert.condition_operator).toBe('less_than');
      expect(alert.condition_value).toBe(70.00);
    });

    it('should throw error for invalid alert ID', async () => {
      await expect(client.alerts.update('', { enabled: false })).rejects.toThrow('Alert ID must be a non-empty string');
      await expect(client.alerts.update(null as any, { enabled: false })).rejects.toThrow('Alert ID must be a non-empty string');
    });

    it('should validate updated fields', async () => {
      const alertId = '550e8400-e29b-41d4-a716-446655440000';

      // Invalid name
      await expect(client.alerts.update(alertId, { name: '' })).rejects.toThrow('Alert name must be 1-100 characters');
      await expect(client.alerts.update(alertId, { name: 'a'.repeat(101) })).rejects.toThrow('Alert name must be 1-100 characters');

      // Invalid operator
      await expect(client.alerts.update(alertId, { condition_operator: 'invalid' as any })).rejects.toThrow('Invalid operator');

      // Invalid value
      await expect(client.alerts.update(alertId, { condition_value: 0 })).rejects.toThrow('Condition value must be greater than 0');
      await expect(client.alerts.update(alertId, { condition_value: 1_000_001 })).rejects.toThrow('less than or equal to 1,000,000');

      // Invalid webhook URL
      await expect(client.alerts.update(alertId, { webhook_url: 'http://insecure.com' })).rejects.toThrow('Webhook URL must be a valid HTTPS URL');

      // Invalid cooldown
      await expect(client.alerts.update(alertId, { cooldown_minutes: -1 })).rejects.toThrow('Cooldown minutes must be between 0 and 1440');
      await expect(client.alerts.update(alertId, { cooldown_minutes: 1441 })).rejects.toThrow('Cooldown minutes must be between 0 and 1440');
    });

    it('should allow setting webhook_url to null', async () => {
      const alertId = '550e8400-e29b-41d4-a716-446655440000';
      const mockUpdatedAlert: PriceAlert = {
        id: alertId,
        name: 'Alert',
        commodity_code: 'BRENT_CRUDE_USD',
        condition_operator: 'greater_than',
        condition_value: 85.00,
        webhook_url: null,
        enabled: true,
        cooldown_minutes: 60,
        metadata: null,
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2025-12-15T10:00:00Z',
        updated_at: '2025-12-15T11:00:00Z'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ alert: mockUpdatedAlert })
      });

      await expect(client.alerts.update(alertId, { webhook_url: null })).resolves.toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('should delete an alert successfully', async () => {
      const alertId = '550e8400-e29b-41d4-a716-446655440000';

      (global.fetch as any).mockResolvedValue({
        ok: true
      });

      await client.alerts.delete(alertId);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.oilpriceapi.com/v1/alerts/${alertId}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should throw error for invalid alert ID', async () => {
      await expect(client.alerts.delete('')).rejects.toThrow('Alert ID must be a non-empty string');
      await expect(client.alerts.delete(null as any)).rejects.toThrow('Alert ID must be a non-empty string');
    });
  });

  describe('testWebhook()', () => {
    it('should test webhook successfully', async () => {
      const webhookUrl = 'https://example.com/webhook';
      const mockResponse = {
        success: true,
        status_code: 200,
        response_time_ms: 145,
        response_body: '{"received":true}'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.alerts.testWebhook(webhookUrl);

      expect(result.success).toBe(true);
      expect(result.status_code).toBe(200);
      expect(result.response_time_ms).toBe(145);
    });

    it('should return failed test result', async () => {
      const webhookUrl = 'https://example.com/webhook';
      const mockResponse = {
        success: false,
        status_code: 500,
        response_time_ms: 5000,
        error: 'Internal Server Error'
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.alerts.testWebhook(webhookUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal Server Error');
    });

    it('should validate webhook URL', async () => {
      await expect(client.alerts.testWebhook('')).rejects.toThrow('Webhook URL is required and must be a string');
      await expect(client.alerts.testWebhook(null as any)).rejects.toThrow('Webhook URL is required and must be a string');
      await expect(client.alerts.testWebhook('http://insecure.com')).rejects.toThrow('Webhook URL must use HTTPS protocol');
      await expect(client.alerts.testWebhook('not-a-url')).rejects.toThrow('Webhook URL must use HTTPS protocol');
    });
  });
});
