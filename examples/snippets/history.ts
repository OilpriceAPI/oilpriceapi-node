import { OilPriceAPI } from "oilpriceapi";
import { fixtureBaseUrl, isMain } from "./_shared.js";

export async function run() {
  const client = new OilPriceAPI({
    baseUrl: fixtureBaseUrl(),
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

if (isMain(import.meta.url)) {
  console.log(JSON.stringify(await run()));
}
