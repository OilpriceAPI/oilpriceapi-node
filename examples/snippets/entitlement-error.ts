import { pathToFileURL } from "node:url";

import { OilPriceAPI, OilPriceAPIError } from "oilpriceapi";

export async function run() {
  const client = new OilPriceAPI({
    apiKey: process.env.OILPRICEAPI_KEY,
    baseUrl: process.env.OILPRICEAPI_BASE_URL,
    retries: 0,
  });

  try {
    await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });
  } catch (error) {
    if (error instanceof OilPriceAPIError && error.statusCode === 403) {
      return { handled: true, statusCode: error.statusCode };
    }
    throw error;
  }

  throw new Error("Expected the API to reject the account entitlement");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await run()));
}
