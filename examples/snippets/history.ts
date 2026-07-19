import { pathToFileURL } from "node:url";

import { OilPriceAPI } from "oilpriceapi";

export async function run() {
  const client = new OilPriceAPI({
    apiKey: process.env.OILPRICEAPI_KEY,
    baseUrl: process.env.OILPRICEAPI_BASE_URL,
    retries: 0,
  });
  const prices = await client.getHistoricalPrices({
    commodity: "BRENT_CRUDE_USD",
    period: "past_week",
    interval: "daily",
    perPage: 5,
  });

  return {
    commodity: prices[0].code,
    count: prices.length,
    valueType: typeof prices[0].price,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await run()));
}
