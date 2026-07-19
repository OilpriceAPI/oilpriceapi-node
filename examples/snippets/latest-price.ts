import { OilPriceAPI } from "oilpriceapi";
import { fixtureBaseUrl, isMain } from "./_shared.js";

export async function run() {
  const client = new OilPriceAPI({
    baseUrl: fixtureBaseUrl(),
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

if (isMain(import.meta.url)) {
  console.log(JSON.stringify(await run()));
}
