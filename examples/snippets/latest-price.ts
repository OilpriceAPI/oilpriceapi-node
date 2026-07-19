import { pathToFileURL } from "node:url";

import { OilPriceAPI } from "oilpriceapi";

export async function run() {
  const client = new OilPriceAPI({
    apiKey: process.env.OILPRICEAPI_KEY,
    baseUrl: process.env.OILPRICEAPI_BASE_URL,
    retries: 0,
  });
  const [price] = await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });

  return {
    commodity: price.code,
    currency: price.currency,
    valueType: typeof price.price,
    timestampType: typeof price.created_at,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await run()));
}
