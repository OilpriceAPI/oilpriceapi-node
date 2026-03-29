import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";
import type {
  DataSource,
  CreateDataSourceParams,
  UpdateDataSourceParams,
  DataSourceTestResponse,
  DataSourceLog,
  DataSourceHealth,
  CredentialRotationResponse,
} from "../../src/resources/data-sources.js";

const makeDataSource = (overrides: Partial<DataSource> = {}): DataSource => ({
  id: "source-1",
  name: "Custom API Source",
  type: "api",
  config: { url: "https://internal.company.com/api/prices" },
  enabled: true,
  status: "active",
  successful_syncs: 100,
  failed_syncs: 5,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-15T00:00:00Z",
  ...overrides,
});

describe("DataSourcesResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("list()", () => {
    it("should fetch all data sources as array", async () => {
      const mockData: DataSource[] = [
        makeDataSource({ id: "source-1", name: "API Source" }),
        makeDataSource({ id: "source-2", name: "SFTP Source", type: "sftp" }),
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataSources.list();

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-sources", {});
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("source-1");
      expect(result[1].type).toBe("sftp");
    });

    it("should unwrap data_sources property when response is wrapped", async () => {
      const mockData: DataSource[] = [makeDataSource()];

      vi.spyOn(client as any, "request").mockResolvedValue({
        data_sources: mockData,
      });

      const result = await client.dataSources.list();

      expect(result).toEqual(mockData);
    });

    it("should return empty array when no data sources exist", async () => {
      vi.spyOn(client as any, "request").mockResolvedValue([]);

      const result = await client.dataSources.list();

      expect(result).toEqual([]);
    });
  });

  describe("get()", () => {
    it("should fetch a specific data source by ID", async () => {
      const mockData = makeDataSource({
        id: "source-1",
        name: "Custom API Source",
        last_sync_at: "2024-01-15T10:00:00Z",
        next_sync_at: "2024-01-15T11:00:00Z",
        sync_frequency_minutes: 60,
      });

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockData);

      const result = await client.dataSources.get("source-1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-sources/source-1", {});
      expect(result.id).toBe("source-1");
      expect(result.name).toBe("Custom API Source");
    });

    it("should unwrap data_source property when response is wrapped", async () => {
      const mockData = makeDataSource();

      vi.spyOn(client as any, "request").mockResolvedValue({
        data_source: mockData,
      });

      const result = await client.dataSources.get("source-1");

      expect(result).toEqual(mockData);
    });

    it("should throw error for empty source ID", async () => {
      await expect(client.dataSources.get("")).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });

    it("should throw error for non-string source ID", async () => {
      await expect(client.dataSources.get(null as any)).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });

  describe("create()", () => {
    it("should create a new data source with required fields", async () => {
      const params: CreateDataSourceParams = {
        name: "Internal Price Feed",
        type: "api",
        config: {
          url: "https://internal.company.com/api/prices",
          auth_type: "bearer",
          token: "secret-token",
        },
      };

      const mockCreated = makeDataSource({
        name: params.name,
        type: params.type,
        config: params.config,
        sync_frequency_minutes: 60,
      });

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ data_source: mockCreated });

      const result = await client.dataSources.create(params);

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-sources",
        {},
        {
          method: "POST",
          body: {
            data_source: {
              name: params.name,
              type: params.type,
              config: params.config,
              enabled: true,
              sync_frequency_minutes: 60,
              metadata: undefined,
            },
          },
        },
      );
      expect(result.name).toBe("Internal Price Feed");
    });

    it("should create a data source with all optional fields", async () => {
      const params: CreateDataSourceParams = {
        name: "SFTP Feed",
        type: "sftp",
        config: { host: "sftp.example.com", username: "user" },
        enabled: false,
        sync_frequency_minutes: 1440,
        metadata: { team: "ops" },
      };

      const mockCreated = makeDataSource({ ...params, status: "paused" });

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockCreated);

      const result = await client.dataSources.create(params);

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-sources",
        {},
        {
          method: "POST",
          body: {
            data_source: {
              name: params.name,
              type: params.type,
              config: params.config,
              enabled: false,
              sync_frequency_minutes: 1440,
              metadata: { team: "ops" },
            },
          },
        },
      );
      expect(result).toEqual(mockCreated);
    });

    it("should throw error when name is missing", async () => {
      await expect(
        client.dataSources.create({ name: "", type: "api", config: {} }),
      ).rejects.toThrow("Data source name is required");
    });

    it("should throw error when type is missing", async () => {
      await expect(
        client.dataSources.create({
          name: "My Source",
          type: "" as any,
          config: {},
        }),
      ).rejects.toThrow("Data source type is required");
    });

    it("should throw error when config is missing", async () => {
      await expect(
        client.dataSources.create({
          name: "My Source",
          type: "api",
          config: null as any,
        }),
      ).rejects.toThrow("Data source config is required");
    });
  });

  describe("update()", () => {
    it("should update a data source with partial fields", async () => {
      const updateParams: UpdateDataSourceParams = {
        enabled: false,
        sync_frequency_minutes: 120,
      };

      const mockUpdated = makeDataSource({
        enabled: false,
        sync_frequency_minutes: 120,
      });

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue({ data_source: mockUpdated });

      const result = await client.dataSources.update("source-1", updateParams);

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-sources/source-1",
        {},
        {
          method: "PATCH",
          body: { data_source: updateParams },
        },
      );
      expect(result.enabled).toBe(false);
      expect(result.sync_frequency_minutes).toBe(120);
    });

    it("should update all fields", async () => {
      const updateParams: UpdateDataSourceParams = {
        name: "Updated Source",
        config: { url: "https://new.endpoint.com/prices" },
        enabled: true,
        sync_frequency_minutes: 30,
        metadata: { updated: true },
      };

      const mockUpdated = makeDataSource({ ...updateParams, id: "source-1" });

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockUpdated);

      const result = await client.dataSources.update("source-1", updateParams);

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-sources/source-1",
        {},
        {
          method: "PATCH",
          body: { data_source: updateParams },
        },
      );
      expect(result).toEqual(mockUpdated);
    });

    it("should throw error for empty source ID", async () => {
      await expect(client.dataSources.update("", { enabled: false })).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });

    it("should throw error for non-string source ID", async () => {
      await expect(client.dataSources.update(null as any, { enabled: false })).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });

  describe("delete()", () => {
    it("should delete a data source successfully", async () => {
      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue({});

      await client.dataSources.delete("source-1");

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-sources/source-1",
        {},
        { method: "DELETE" },
      );
    });

    it("should throw error for empty source ID", async () => {
      await expect(client.dataSources.delete("")).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });

    it("should throw error for non-string source ID", async () => {
      await expect(client.dataSources.delete(null as any)).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });

  describe("test()", () => {
    it("should test a data source connection successfully", async () => {
      const mockResponse: DataSourceTestResponse = {
        success: true,
        duration_ms: 145,
        records_count: 50,
        sample_data: [{ commodity: "WTI", price: 75.5, timestamp: "2024-01-15T10:00:00Z" }],
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockResponse);

      const result = await client.dataSources.test("source-1");

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-sources/source-1/test",
        {},
        { method: "POST" },
      );
      expect(result.success).toBe(true);
      expect(result.duration_ms).toBe(145);
      expect(result.records_count).toBe(50);
    });

    it("should return failure result when test fails", async () => {
      const mockResponse: DataSourceTestResponse = {
        success: false,
        duration_ms: 5000,
        error: "Connection timed out",
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockResponse);

      const result = await client.dataSources.test("source-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timed out");
    });

    it("should throw error for empty source ID", async () => {
      await expect(client.dataSources.test("")).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });

  describe("logs()", () => {
    it("should fetch sync logs as array", async () => {
      const mockLogs: DataSourceLog[] = [
        {
          id: "log-1",
          data_source_id: "source-1",
          status: "success",
          records_synced: 120,
          duration_ms: 2300,
          started_at: "2024-01-15T10:00:00Z",
          completed_at: "2024-01-15T10:00:02Z",
        },
        {
          id: "log-2",
          data_source_id: "source-1",
          status: "failed",
          error: "Connection refused",
          started_at: "2024-01-15T09:00:00Z",
        },
      ];

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockLogs);

      const result = await client.dataSources.logs("source-1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-sources/source-1/logs", {});
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("success");
      expect(result[1].error).toBe("Connection refused");
    });

    it("should unwrap logs property when response is wrapped", async () => {
      const mockLogs: DataSourceLog[] = [
        {
          id: "log-1",
          data_source_id: "source-1",
          status: "success",
          started_at: "2024-01-15T10:00:00Z",
        },
      ];

      vi.spyOn(client as any, "request").mockResolvedValue({ logs: mockLogs });

      const result = await client.dataSources.logs("source-1");

      expect(result).toEqual(mockLogs);
    });

    it("should throw error for empty source ID", async () => {
      await expect(client.dataSources.logs("")).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });

  describe("health()", () => {
    it("should fetch health metrics for a data source", async () => {
      const mockHealth: DataSourceHealth = {
        id: "source-1",
        status: "healthy",
        success_rate: 98.5,
        avg_duration_ms: 1200,
        last_sync_status: "success",
        last_sync_at: "2024-01-15T10:00:00Z",
        recent_errors: [],
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockHealth);

      const result = await client.dataSources.health("source-1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-sources/source-1/health", {});
      expect(result.status).toBe("healthy");
      expect(result.success_rate).toBe(98.5);
      expect(result.avg_duration_ms).toBe(1200);
    });

    it("should return degraded health status with recent errors", async () => {
      const mockHealth: DataSourceHealth = {
        id: "source-1",
        status: "degraded",
        success_rate: 72.0,
        avg_duration_ms: 4500,
        last_sync_status: "failed",
        recent_errors: ["Connection timeout", "Authentication failed"],
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockHealth);

      const result = await client.dataSources.health("source-1");

      expect(result.status).toBe("degraded");
      expect(result.recent_errors).toHaveLength(2);
    });

    it("should throw error for empty source ID", async () => {
      await expect(client.dataSources.health("")).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });

  describe("rotateCredentials()", () => {
    it("should rotate credentials successfully", async () => {
      const mockResponse: CredentialRotationResponse = {
        success: true,
        credential_id: "cred-new-456",
        message: "Credentials rotated successfully",
      };

      const requestSpy = vi.spyOn(client as any, "request").mockResolvedValue(mockResponse);

      const result = await client.dataSources.rotateCredentials("source-1");

      expect(requestSpy).toHaveBeenCalledWith(
        "/v1/data-sources/source-1/rotate-credentials",
        {},
        { method: "POST" },
      );
      expect(result.success).toBe(true);
      expect(result.credential_id).toBe("cred-new-456");
    });

    it("should return failure result when rotation fails", async () => {
      const mockResponse: CredentialRotationResponse = {
        success: false,
        message: "Rotation failed: source is currently syncing",
      };

      vi.spyOn(client as any, "request").mockResolvedValue(mockResponse);

      const result = await client.dataSources.rotateCredentials("source-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Rotation failed");
    });

    it("should throw error for empty source ID", async () => {
      await expect(client.dataSources.rotateCredentials("")).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });

    it("should throw error for non-string source ID", async () => {
      await expect(client.dataSources.rotateCredentials(null as any)).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });
});
