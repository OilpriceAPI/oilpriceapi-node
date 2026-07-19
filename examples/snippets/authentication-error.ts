import { pathToFileURL } from "node:url";

import { AuthenticationError, OilPriceAPI } from "oilpriceapi";

export async function run() {
  const client = new OilPriceAPI({
    apiKey: process.env.OILPRICEAPI_KEY,
    baseUrl: process.env.OILPRICEAPI_BASE_URL,
    retries: 0,
  });

  try {
    await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { handled: true, statusCode: error.statusCode ?? 401 };
    }
    throw error;
  }

  throw new Error("Expected the API to reject the credential");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await run()));
}
