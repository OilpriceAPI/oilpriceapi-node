/**
 * Basic Usage Example
 *
 * Simple example showing how to get latest and historical oil prices
 */

import { OilPriceAPI } from 'oilpriceapi';

const client = new OilPriceAPI({
  apiKey: process.env.OIL_PRICE_API_KEY || 'your_api_key_here'
});

async function main() {
  try {
    // Get latest WTI price
    console.log('Getting latest WTI price...');
    const wtiPrices = await client.getLatestPrices({
      commodity: 'WTI_USD'
    });
    console.log(`WTI: ${wtiPrices[0].formatted}`);

    // Get latest Brent price
    console.log('\nGetting latest Brent price...');
    const brentPrices = await client.getLatestPrices({
      commodity: 'BRENT_CRUDE_USD'
    });
    console.log(`Brent: ${brentPrices[0].formatted}`);

    // Get all latest prices
    console.log('\nGetting all latest commodity prices...');
    const allPrices = await client.getLatestPrices();
    console.log(`Retrieved ${allPrices.length} commodity prices`);

    // Get historical prices for past week
    console.log('\nGetting WTI prices for past week...');
    const historicalPrices = await client.getHistoricalPrices({
      commodity: 'WTI_USD',
      period: 'past_week'
    });
    console.log(`Retrieved ${historicalPrices.length} historical prices`);

    // Show first and last price
    if (historicalPrices.length > 0) {
      console.log(`First: ${historicalPrices[0].formatted} at ${historicalPrices[0].created_at}`);
      console.log(`Last: ${historicalPrices[historicalPrices.length - 1].formatted} at ${historicalPrices[historicalPrices.length - 1].created_at}`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
