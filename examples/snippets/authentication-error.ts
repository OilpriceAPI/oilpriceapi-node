import { AuthenticationError, OilPriceAPI } from "oilpriceapi";
import { fixtureBaseUrl, isMain } from "./_shared.js";

export async function run() {
  const client = new OilPriceAPI({ baseUrl: fixtureBaseUrl(), retries: 0 });

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

if (isMain(import.meta.url)) {
  console.log(JSON.stringify(await run()));
}
