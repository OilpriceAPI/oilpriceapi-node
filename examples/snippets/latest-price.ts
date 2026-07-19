import { pathToFileURL } from "node:url";

import { OilPriceAPI } from "oilpriceapi";

export async function run() {
  const client = new OilPriceAPI({
    apiKey: process.env.OILPRICEAPI_KEY,
    baseUrl: process.env.OILPRICEAPI_BASE_URL,
    retries: 0,
  });
  const [record] = await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });
  const timestampFields = [
    "as_of",
    "source_timestamp",
    "created_at",
    "updated_at",
  ] as const;
  const timestampField = timestampFields.find(
    (field) => typeof record?.[field] === "string" && record[field].trim(),
  );

  if (
    !record ||
    !Number.isFinite(record.price) ||
    typeof record.code !== "string" ||
    typeof record.currency !== "string" ||
    typeof record.unit !== "string" ||
    typeof record.source !== "string" ||
    !timestampField
  ) {
    throw new Error("MALFORMED_RESPONSE: source context is incomplete");
  }

  return {
    commodity: record.code,
    currency: record.currency,
    unit: record.unit,
    source: record.source,
    apiTimestamp: record[timestampField],
    timestampField,
    valueType: typeof record.price,
    freshness: record.data_status ?? null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await run()));
}
