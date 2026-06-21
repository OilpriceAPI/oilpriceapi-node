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
export type DataSourceType = "api" | "database" | "file" | "sftp" | "webhook" | "custom";

/**
 * Data source status
 */
export type DataSourceStatus = "active" | "paused" | "error" | "pending";

/**
 * Data source configuration
 *
 * NOTE: The API reads `source_type`, `scraper_config`, `status` and `credentials`
 * (nested under `data_source`). Earlier SDK versions used `type`/`config`/`enabled`,
 * which the controller silently dropped.
 */
export interface DataSource {
  /** Unique data source identifier */
  id: string;
  /** User-friendly name */
  name: string;
  /** Data source type */
  source_type: DataSourceType;
  /** Scraper / connection configuration */
  scraper_config?: Record<string, unknown>;
  /** Current status */
  status: DataSourceStatus;
  /** Last successful sync timestamp */
  last_sync_at?: string;
  /** Next scheduled sync timestamp */
  next_sync_at?: string;
  /** Number of successful syncs */
  successful_syncs?: number;
  /** Number of failed syncs */
  failed_syncs?: number;
  /** Last error message */
  last_error?: string;
  /** ISO timestamp when source was created */
  created_at: string;
  /** ISO timestamp when source was last updated */
  updated_at: string;
}

/**
 * Parameters for creating a data source.
 *
 * Maps to the controller's `data_source_params` strong params:
 * `source_type`, `name`, `status`, `credentials`, `scraper_config`.
 */
export interface CreateDataSourceParams {
  /** User-friendly name */
  name: string;
  /** Data source type */
  source_type: DataSourceType;
  /** Scraper / connection configuration */
  scraper_config?: Record<string, unknown>;
  /** Credentials (encrypted server-side) */
  credentials?: Record<string, unknown>;
  /** Lifecycle status */
  status?: DataSourceStatus;
}

/**
 * Parameters for updating a data source.
 *
 * Maps to `data_source_update_params`: `name`, `status`, `credentials`,
 * `scraper_config` (source_type cannot be changed).
 */
export interface UpdateDataSourceParams {
  /** User-friendly name */
  name?: string;
  /** Scraper / connection configuration */
  scraper_config?: Record<string, unknown>;
  /** Credentials (encrypted server-side) */
  credentials?: Record<string, unknown>;
  /** Lifecycle status */
  status?: DataSourceStatus;
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
    const response = await this.client["request"]<DataSource[] | { data_sources: DataSource[] }>(
      "/v1/data-sources",
      {},
    );

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

    const response = await this.client["request"]<DataSource | { data_source: DataSource }>(
      `/v1/data-sources/${id}`,
      {},
    );

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
    if (!params.source_type) {
      throw new ValidationError("Data source source_type is required");
    }

    const response = await this.client["request"]<DataSource | { data_source: DataSource }>(
      "/v1/data-sources",
      {},
      {
        method: "POST",
        body: {
          data_source: {
            name: params.name,
            source_type: params.source_type,
            status: params.status,
            credentials: params.credentials,
            scraper_config: params.scraper_config,
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
  async update(id: string, params: UpdateDataSourceParams): Promise<DataSource> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }

    const response = await this.client["request"]<DataSource | { data_source: DataSource }>(
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

    await this.client["request"](`/v1/data-sources/${id}`, {}, { method: "DELETE" });
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

    const response = await this.client["request"]<DataSourceLog[] | { logs: DataSourceLog[] }>(
      `/v1/data-sources/${id}/logs`,
      {},
    );

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

    return this.client["request"]<DataSourceHealth>(`/v1/data-sources/${id}/health`, {});
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
  async rotateCredentials(
    id: string,
    credentials: Record<string, unknown>,
  ): Promise<CredentialRotationResponse> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("Data source ID must be a non-empty string");
    }
    if (!credentials || typeof credentials !== "object") {
      throw new ValidationError("New credentials object is required");
    }

    // Route is POST /v1/data-sources/:id/rotate_credentials (underscore) and
    // the controller does params.require(:credentials).
    return this.client["request"]<CredentialRotationResponse>(
      `/v1/data-sources/${id}/rotate_credentials`,
      {},
      { method: "POST", body: { credentials } },
    );
  }
}
