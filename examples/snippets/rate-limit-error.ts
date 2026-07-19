import { OilPriceAPI, RateLimitError } from "oilpriceapi";
import { fixtureBaseUrl, isMain } from "./_shared.js";

export async function run() {
  const client = new OilPriceAPI({ baseUrl: fixtureBaseUrl(), retries: 0 });

  try {
    await client.getLatestPrices({ commodity: "BRENT_CRUDE_USD" });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { handled: true, statusCode: error.statusCode ?? 429 };
    }
    throw error;
  }

  throw new Error("Expected the API to enforce its request limit");
}

if (isMain(import.meta.url)) {
  console.log(JSON.stringify(await run()));
}
