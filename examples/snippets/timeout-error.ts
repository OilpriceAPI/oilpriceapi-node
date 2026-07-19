import { pathToFileURL } from "node:url";

import { OilPriceAPI, TimeoutError } from "oilpriceapi";

export async function run() {
  const client = new OilPriceAPI({
    apiKey: process.env.OILPRICEAPI_KEY,
    baseUrl: process.env.OILPRICEAPI_BASE_URL,
    retries: 0,
    timeout: 20,
  });

  try {
    await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });
  } catch (error) {
    if (error instanceof TimeoutError) {
      return { handled: true, errorType: "TimeoutError" };
    }
    throw error;
  }

  throw new Error("Expected the request to time out");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await run()));
}
