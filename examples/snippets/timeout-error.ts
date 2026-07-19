import { OilPriceAPI, TimeoutError } from "oilpriceapi";
import { fixtureBaseUrl, isMain } from "./_shared.js";

export async function run() {
  const client = new OilPriceAPI({
    baseUrl: fixtureBaseUrl(),
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

if (isMain(import.meta.url)) {
  console.log(JSON.stringify(await run()));
}
