/**
 * Carrier Fuel Surcharge Example
 *
 * Reads published LTL and parcel carrier fuel surcharges. Every rate carries
 * the carrier's effective date and the source URL it was read from; the API
 * serves the latest stored row as-is, so check `effective_date` rather than
 * assuming a rate is this week's.
 *
 * Run: OILPRICEAPI_KEY=... npx tsx examples/fuel-surcharge.ts
 */

import { NotFoundError, OilPriceAPI } from "oilpriceapi";

const client = new OilPriceAPI({ apiKey: process.env.OILPRICEAPI_KEY });

async function main() {
  // Latest LTL surcharge for every carrier that has data.
  const rates = await client.fuelSurcharge.ltl.list();
  for (const rate of rates) {
    console.log(
      `${rate.carrier_name}: ${rate.surcharge_percent}% effective ${rate.effective_date} (source ${rate.source})`,
    );
  }

  // A year of weekly history for one carrier, one page at a time.
  const page = await client.fuelSurcharge.ltl.history("odfl", { perPage: 52 });
  console.log(`ODFL: ${page.history.length} of ${page.meta.total_count} rows`);

  // Parcel surcharges are published per service level.
  const ups = await client.fuelSurcharge.parcel.latest("ups");
  for (const level of ups.service_levels) {
    console.log(
      `UPS ${level.service_level}: ${level.surcharge_percent}% effective ${level.effective_date}`,
    );
  }

  const ground = await client.fuelSurcharge.parcel.history("ups", {
    serviceLevel: "ground",
    perPage: 10,
  });
  console.log(`UPS ground: ${ground.meta.total_count} rows of history`);

  // An uncovered carrier is a 404 that lists the covered ones.
  try {
    await client.fuelSurcharge.ltl.latest("rl-carriers");
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.log(error.message);
    } else {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
