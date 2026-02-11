import { describe, it, expect, beforeEach, vi } from "vitest";
import { OilPriceAPI } from "../../src/client.js";

describe("DataSourcesResource", () => {
  let client: OilPriceAPI;

  beforeEach(() => {
    client = new OilPriceAPI({ apiKey: "test_key_123" });
    vi.clearAllMocks();
  });

  describe("list()", () => {
    it("should fetch all data sources", async () => {
      const mockData = [
        {
          id: "source-1",
          name: "Custom API Source",
          type: "api" as const,
          config: {},
          enabled: true,
          status: "active" as const,
          successful_syncs: 100,
          failed_syncs: 5,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-15T00:00:00Z",
        },
      ];

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.dataSources.list();

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-sources", {});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("source-1");
    });
  });

  describe("get()", () => {
    it("should fetch a specific data source", async () => {
      const mockData = {
        id: "source-1",
        name: "Custom API Source",
        type: "api" as const,
        config: {},
        enabled: true,
        status: "active" as const,
        successful_syncs: 100,
        failed_syncs: 5,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z",
      };

      const requestSpy = vi
        .spyOn(client as any, "request")
        .mockResolvedValue(mockData);

      const result = await client.dataSources.get("source-1");

      expect(requestSpy).toHaveBeenCalledWith("/v1/data-sources/source-1", {});
      expect(result.id).toBe("source-1");
    });

    it("should throw error for empty source code", async () => {
      await expect(client.dataSources.get("")).rejects.toThrow(
        "Data source ID must be a non-empty string",
      );
    });
  });
});
