import { OilPriceAPI, OilPriceAPIError } from "oilpriceapi";
import { fixtureBaseUrl, isMain } from "./_shared.js";

export async function run() {
  const client = new OilPriceAPI({ baseUrl: fixtureBaseUrl(), retries: 0 });

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

if (isMain(import.meta.url)) {
  console.log(JSON.stringify(await run()));
}
