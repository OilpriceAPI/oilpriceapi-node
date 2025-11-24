import { OilPriceAPI } from './src/index.js';

async function main() {
  // Initialize with admin API key for testing
  const client = new OilPriceAPI({
    apiKey: '3839c085460dd3a9dac1291f937f5a6d1740e8c668c766bc9f95e166af59cb11'
  });

  console.log('Testing Oil Price API Node.js SDK...\n');

  // Test 1: Get all latest prices
  console.log('1. Getting all latest prices...');
  const allPrices = await client.getLatestPrices();
  console.log(`✓ Got ${allPrices.length} commodities`);
  console.log(`  First: ${allPrices[0].code} = ${allPrices[0].formatted}\n`);

  // Test 2: Get specific commodity (WTI)
  console.log('2. Getting WTI price only...');
  const wti = await client.getLatestPrices({ commodity: 'WTI_USD' });
  console.log(`✓ WTI: ${wti[0].formatted} per barrel\n`);

  // Test 3: Get historical data (past week)
  console.log('3. Getting past week of WTI prices...');
  const historical = await client.getHistoricalPrices({
    period: 'past_week',
    commodity: 'WTI_USD'
  });
  console.log(`✓ Got ${historical.length} data points from past week\n`);

  // Test 4: Get historical data with custom dates
  console.log('4. Getting custom date range...');
  const customRange = await client.getHistoricalPrices({
    startDate: '2024-11-01',
    endDate: '2024-11-15',
    commodity: 'BRENT_CRUDE_USD'
  });
  console.log(`✓ Got ${customRange.length} Brent prices from Nov 1-15\n`);

  console.log('All tests passed! ✓');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
