/**
 * Data Sources Resource
 *
 * Manage custom data source integrations for Bring Your Own Source (BYOS) feature.
 */

import type { OilPriceAPI } from "../client.js";
import { ValidationError } from "../errors.js";

/**
 * Data source types
 */
export type DataSourceType =
  | "api"
  | "database"
  | "file"
  | "sftp"
  | "webhook"
  | "custom";

/**
 * Data source status
 */
export type DataSourceStatus = "active" | "paused" | "error" | "pending";

/**
 * Data source configuration
 */
export interface DataSource {
  /** Unique data source identifier */
  id: string;
  /** User-friendly name */
  name: string;
  /** Data source type */
  type: DataSourceType;
  /** Connection configuration (encrypted) */
  config: Record<string, unknown>;
  /** Whether the data source is active */
  enabled: boolean;
  /** Current status */
  status: DataSourceStatus;
  /** Last successful sync timestamp */
  last_sync_at?: string;
  /** Next scheduled sync timestamp */
  next_sync_at?: string;
  /** Sync frequency in minutes */
  sync_frequency_minutes?: number;
  /** Number of successful syncs */
  successful_syncs: number;
  /** Number of failed syncs */
  failed_syncs: number;
  /** Last error message */
  last_error?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when source was created */
  created_at: string;
  /** ISO timestamp when source was last updated */
  updated_at: string;
}

/**
 * Parameters for creating a data source
 */
export interface CreateDataSourceParams {
  /** User-friendly name */
  name: string;
  /** Data source type */
  type: DataSourceType;
  /** Connection configuration */
  config: Record<string, unknown>;
  /** Whether to enable immediately (default: true) */
  enabled?: boolean;
  /** Sync frequency in minutes (default: 60) */
  sync_frequency_minutes?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating a data source
 */
export interface UpdateDataSourceParams {
  /** User-friendly name */
  name?: string;
  /** Connection configuration */
  config?: Record<string, unknown>;
  /** Whether the data source is active */
  enabled?: boolean;
  /** Sync frequency in minutes */
  sync_frequency_minutes?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Data source test response
 */
export interface DataSourceTestResponse {
  /** Test result status */
  success: boolean;
  /** Connection test duration in milliseconds */
  duration_ms: number;
  /** Number of records fetched in test */
  records_count?: number;
  /** Sample data */
  sample_data?: Record<string, unknown>[];
  /** Error message if test failed */
  error?: string;
}

/**
 * Data source sync log entry
 */
export interface DataSourceLog {
  /** Log entry ID */
  id: string;
  /** Data source ID */
  data_source_id: string;
  /** Sync status */
  status: "success" | "failed";
  /** Number of records synced */
  records_synced?: number;
  /** Sync duration in milliseconds */
  duration_ms?: number;
  /** Error message if sync failed */
  error?: string;
  /** ISO timestamp when sync started */
  started_at: string;
  /** ISO timestamp when sync completed */
  completed_at?: string;
}

/**
 * Data source health metrics
 */
export interface DataSourceHealth {
  /** Data source ID */
  id: string;
  /** Overall health status */
  status: "healthy" | "degraded" | "down";
  /** Success rate (0-100) */
  success_rate: number;
  /** Average sync duration in milliseconds */
  avg_duration_ms: number;
  /** Last sync status */
  last_sync_status?: "success" | "failed";
  /** Last sync timestamp */
  last_sync_at?: string;
  /** Recent errors */
  recent_errors?: string[];
}

/**
 * Credential rotation response
 */
export interface CredentialRotationResponse {
  /** Whether rotation was successful */
  success: boolean;
  /** New credential ID or reference */
  credential_id?: string;
  /** Message */
  message?: string;
}

/**
 * Data Sources Resource
 *
 * Manage custom data source integrations for importing your own price data
 * into the platform (BYOS - Bring Your Own Source feature).
 *
 * @example
 * ```typescript
 * import { OilPriceAPI } from 'oilpriceapi';
 *
 * const client = new OilPriceAPI({ apiKey: 'your_key' });
 *
 * // Create a data source
 * const source = await client.dataSources.create({
 *   name: 'Internal Price Feed',
 *   type: 'api',
 *   config: {
 *     url: 'https://internal.company.com/api/prices',
 *     auth_type: 'bearer',
 *     token: 'secret-token'
 *   },
 *   sync_frequency_minutes: 30
 * });
 *
 * // Test the data source
 * const test = await client.dataSources.test(source.id);
 * console.log(`Test result: ${test.success}`);
 *
 * // Check health
 * const health = await client.dataSources.health(source.id);
 * console.log(`Health: ${health.status}`);
 * console.log(`Success rate: ${health.success_rate}%`);
 *
 * // View sync logs
 * const logs = await client.dataSources.logs(source.id);
 * logs.forEach(log => {
 *   console.log(`${log.started_at}: ${log.status} - ${log.records_synced} records`);
 * });
 * ```
 */
export class DataSourcesResource {
  constructor(private client: OilPriceAPI) {}

  /**
   * List all data sources
   *
   * @returns Array of data sources
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const sources = await client.dataSources.list();
   * sources.forEach(source => {
   *   console.log(`${source.name}: ${source.status}`);
   *   console.log(`  Success rate: ${source.successful_syncs}/${source.successful_syncs + source.failed_syncs}`);
   * });
   * ```
   */
  async list(): Promise<DataSource[]> {
    const response = await this.client["request"]<
      DataSource[] | { data_sources: DataSource[] }
    >("/v1/data-sources", {});

    return Array.isArray(response) ? response : response.data_sources;
  }

  /**
   * Get a specific data source
   *
   * @param id - Data source ID
   * @returns Data source details
   *
   * @throws {NotFoundError} If data source not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const source = await client.dataSources.get('source-id');
   * console.log(`${source.name} (${source.type})`);
   * console.log(`Last sync: ${source.last_sync_at}`);
   * ```
   */
  async get(id: string): Promise<DataSource> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    const response = await this.client["request"]<
      DataSource | { data_source: DataSource }
    >(`/v1/data-sources/${id}`, {});

    return "data_source" in response ? response.data_source : response;
  }

  /**
   * Create a new data source
   *
   * @param params - Data source configuration
   * @returns Created data source
   *
   * @throws {OilPriceAPIError} If API request fails
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const source = await client.dataSources.create({
   *   name: 'SFTP Price Feed',
   *   type: 'sftp',
   *   config: {
   *     host: 'sftp.example.com',
   *     username: 'user',
   *     password: 'pass',
   *     path: '/prices/daily.csv'
   *   },
   *   sync_frequency_minutes: 1440 // Daily
   * });
   * ```
   */
  async create(params: CreateDataSourceParams): Promise<DataSource> {
    if (!params.name || typeof params.name !== "string") {
      throw new ValidationError("Data source name is required");
    }
    if (!params.type) {
      throw new ValidationError("Data source type is required");
    }
    if (!params.config || typeof params.config !== "object") {
      throw new ValidationError("Data source config is required");
    }

    const response = await this.client["request"]<
      DataSource | { data_source: DataSource }
    >(
      "/v1/data-sources",
      {},
      {
        method: "POST",
        body: {
          data_source: {
            name: params.name,
            type: params.type,
            config: params.config,
            enabled: params.enabled ?? true,
            sync_frequency_minutes: params.sync_frequency_minutes ?? 60,
            metadata: params.metadata,
          },
        },
      },
    );

    return "data_source" in response ? response.data_source : response;
  }

  /**
   * Update a data source
   *
   * @param id - Data source ID
   * @param params - Fields to update
   * @returns Updated data source
   *
   * @throws {NotFoundError} If data source not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * // Pause a data source
   * await client.dataSources.update(sourceId, { enabled: false });
   *
   * // Update sync frequency
   * await client.dataSources.update(sourceId, {
   *   sync_frequency_minutes: 120
   * });
   * ```
   */
  async update(
    id: string,
    params: UpdateDataSourceParams,
  ): Promise<DataSource> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    const response = await this.client["request"]<
      DataSource | { data_source: DataSource }
    >(
      `/v1/data-sources/${id}`,
      {},
      {
        method: "PATCH",
        body: { data_source: params },
      },
    );

    return "data_source" in response ? response.data_source : response;
  }

  /**
   * Delete a data source
   *
   * @param id - Data source ID
   *
   * @throws {NotFoundError} If data source not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * await client.dataSources.delete(sourceId);
   * console.log('Data source deleted');
   * ```
   */
  async delete(id: string): Promise<void> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    await this.client["request"](
      `/v1/data-sources/${id}`,
      {},
      { method: "DELETE" },
    );
  }

  /**
   * Test a data source connection
   *
   * @param id - Data source ID
   * @returns Test results
   *
   * @throws {NotFoundError} If data source not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const test = await client.dataSources.test(sourceId);
   * console.log(`Connection test: ${test.success ? 'passed' : 'failed'}`);
   * console.log(`Duration: ${test.duration_ms}ms`);
   * if (test.sample_data) {
   *   console.log(`Sample records: ${test.sample_data.length}`);
   * }
   * ```
   */
  async test(id: string): Promise<DataSourceTestResponse> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    return this.client["request"]<DataSourceTestResponse>(
      `/v1/data-sources/${id}/test`,
      {},
      { method: "POST" },
    );
  }

  /**
   * Get data source sync logs
   *
   * @param id - Data source ID
   * @returns Array of sync log entries
   *
   * @throws {NotFoundError} If data source not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const logs = await client.dataSources.logs(sourceId);
   * logs.forEach(log => {
   *   console.log(`${log.started_at}: ${log.status}`);
   *   if (log.records_synced) {
   *     console.log(`  ${log.records_synced} records in ${log.duration_ms}ms`);
   *   }
   * });
   * ```
   */
  async logs(id: string): Promise<DataSourceLog[]> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    const response = await this.client["request"]<
      DataSourceLog[] | { logs: DataSourceLog[] }
    >(`/v1/data-sources/${id}/logs`, {});

    return Array.isArray(response) ? response : response.logs;
  }

  /**
   * Get data source health metrics
   *
   * @param id - Data source ID
   * @returns Health metrics
   *
   * @throws {NotFoundError} If data source not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const health = await client.dataSources.health(sourceId);
   * console.log(`Status: ${health.status}`);
   * console.log(`Success rate: ${health.success_rate}%`);
   * console.log(`Avg duration: ${health.avg_duration_ms}ms`);
   * ```
   */
  async health(id: string): Promise<DataSourceHealth> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    return this.client["request"]<DataSourceHealth>(
      `/v1/data-sources/${id}/health`,
      {},
    );
  }

  /**
   * Rotate data source credentials
   *
   * Updates stored credentials with new values and re-encrypts them.
   *
   * @param id - Data source ID
   * @returns Rotation result
   *
   * @throws {NotFoundError} If data source not found
   * @throws {OilPriceAPIError} If API request fails
   *
   * @example
   * ```typescript
   * const result = await client.dataSources.rotateCredentials(sourceId);
   * console.log(`Credential rotation: ${result.success ? 'success' : 'failed'}`);
   * ```
   */
  async rotateCredentials(id: string): Promise<CredentialRotationResponse> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    return this.client["request"]<CredentialRotationResponse>(
      `/v1/data-sources/${id}/rotate-credentials`,
      {},
      { method: "POST" },
    );
  }
}
