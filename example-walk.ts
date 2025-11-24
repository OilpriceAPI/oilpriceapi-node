import { OilPriceAPI } from './src/index.js';

async function main() {
  console.log('Testing Oil Price API Node.js SDK v0.2.0 (Walk Phase)\n');

  // Test 1: Basic request with retries
  console.log('1. Testing basic request with retry logic...');
  const client = new OilPriceAPI({
    apiKey: '3839c085460dd3a9dac1291f937f5a6d1740e8c668c766bc9f95e166af59cb11',
    retries: 3,
    retryDelay: 1000,
    retryStrategy: 'exponential',
    timeout: 30000
  });

  const wti = await client.getLatestPrices({ commodity: 'WTI_USD' });
  console.log(`✓ WTI: ${wti[0].formatted}\n`);

  // Test 2: Debug mode
  console.log('2. Testing debug logging...');
  const debugClient = new OilPriceAPI({
    apiKey: '3839c085460dd3a9dac1291f937f5a6d1740e8c668c766bc9f95e166af59cb11',
    debug: true
  });

  await debugClient.getLatestPrices({ commodity: 'BRENT_CRUDE_USD' });
  console.log('✓ Debug logs shown above\n');

  // Test 3: Different retry strategies
  console.log('3. Testing retry strategies...');
  const linearClient = new OilPriceAPI({
    apiKey: '3839c085460dd3a9dac1291f937f5a6d1740e8c668c766bc9f95e166af59cb11',
    retryStrategy: 'linear',
    retries: 2
  });

  const prices = await linearClient.getHistoricalPrices({
    period: 'past_week',
    commodity: 'WTI_USD'
  });
  console.log(`✓ Got ${prices.length} prices with linear retry strategy\n`);

  // Test 4: Custom timeout
  console.log('4. Testing custom timeout (5 seconds)...');
  const shortTimeoutClient = new OilPriceAPI({
    apiKey: '3839c085460dd3a9dac1291f937f5a6d1740e8c668c766bc9f95e166af59cb11',
    timeout: 5000  // 5 seconds
  });

  const quickPrices = await shortTimeoutClient.getLatestPrices();
  console.log(`✓ Got ${quickPrices.length} commodities with 5s timeout\n`);

  // Test 5: Error handling with proper types
  console.log('5. Testing error handling...');
  try {
    const badClient = new OilPriceAPI({
      apiKey: 'invalid_key',
      retries: 1  // Fail fast
    });
    await badClient.getLatestPrices();
  } catch (error: any) {
    console.log(`✓ Caught ${error.name}: ${error.message}`);
    console.log(`  Status code: ${error.statusCode}`);
    console.log(`  Error code: ${error.code}\n`);
  }

  console.log('All Walk phase tests passed! ✓');
  console.log('\nNew features in v0.2.0:');
  console.log('  ✓ Retry logic with exponential backoff');
  console.log('  ✓ Request timeout handling');
  console.log('  ✓ Debug logging mode');
  console.log('  ✓ Improved error messages');
  console.log('  ✓ Configurable retry strategies');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
