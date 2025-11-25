/**
 * QA Test Script - Test SDK against live API
 */
import { OilPriceAPI } from './dist/index.js';

const API_KEY = process.env.OIL_PRICE_API_KEY || '3839c085460dd3a9dac1291f937f5a6d1740e8c668c766bc9f95e166af59cb11';

async function runQATests() {
  console.log('=== Node.js SDK v0.3.0 QA Tests ===\n');

  const client = new OilPriceAPI({
    apiKey: API_KEY,
    retries: 2,
    timeout: 120000, // 2 minutes for slow historical queries
    debug: false
  });

  let passed = 0;
  let failed = 0;

  // Test 1: Get Latest Prices (All)
  try {
    console.log('Test 1: getLatestPrices() - All commodities');
    const prices = await client.getLatestPrices();
    if (prices && Array.isArray(prices) && prices.length > 0) {
      console.log(`✅ PASS - Got ${prices.length} prices`);
      console.log(`   Sample: ${prices[0].name} = $${prices[0].value}`);
      passed++;
    } else {
      console.log('❌ FAIL - Invalid response');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL -', error.message);
    failed++;
  }
  console.log();

  // Test 2: Get Latest Price (Specific Commodity)
  try {
    console.log('Test 2: getLatestPrices({ commodity: "WTI_USD" })');
    const prices = await client.getLatestPrices({ commodity: 'WTI_USD' });
    if (prices && prices.length === 1 && prices[0].code === 'WTI_USD') {
      console.log(`✅ PASS - WTI = $${prices[0].value}`);
      passed++;
    } else {
      console.log('❌ FAIL - Invalid response');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL -', error.message);
    failed++;
  }
  console.log();

  // Test 3: Get Historical Prices
  try {
    console.log('Test 3: getHistoricalPrices({ period: "past_week", commodity: "WTI_USD" })');
    const prices = await client.getHistoricalPrices({
      period: 'past_week',
      commodity: 'WTI_USD'
    });
    if (prices && Array.isArray(prices) && prices.length > 0) {
      console.log(`✅ PASS - Got ${prices.length} historical data points`);
      passed++;
    } else {
      console.log('❌ FAIL - Invalid response');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL -', error.message);
    failed++;
  }
  console.log();

  // Test 4: Get Commodities
  try {
    console.log('Test 4: getCommodities()');
    const result = await client.getCommodities();
    if (result && result.commodities && result.commodities.length > 0) {
      console.log(`✅ PASS - Got ${result.commodities.length} commodities`);
      passed++;
    } else {
      console.log('❌ FAIL - Invalid response');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL -', error.message);
    failed++;
  }
  console.log();

  // Test 5: Get Commodity Categories
  try {
    console.log('Test 5: getCommodityCategories()');
    const categories = await client.getCommodityCategories();
    if (categories && typeof categories === 'object') {
      const keys = Object.keys(categories);
      console.log(`✅ PASS - Got ${keys.length} categories`);
      passed++;
    } else {
      console.log('❌ FAIL - Invalid response');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL -', error.message);
    failed++;
  }
  console.log();

  // Test 6: Get Specific Commodity
  try {
    console.log('Test 6: getCommodity("WTI_USD")');
    const commodity = await client.getCommodity('WTI_USD');
    if (commodity && commodity.code === 'WTI_USD') {
      console.log(`✅ PASS - Got ${commodity.name} metadata`);
      passed++;
    } else {
      console.log('❌ FAIL - Invalid response');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL -', error.message);
    failed++;
  }
  console.log();

  // Test 7: Error Handling (Invalid Commodity)
  try {
    console.log('Test 7: Error Handling - getCommodity("INVALID_CODE")');
    await client.getCommodity('INVALID_CODE');
    console.log('❌ FAIL - Should have thrown error');
    failed++;
  } catch (error) {
    if (error.name === 'NotFoundError' || error.statusCode === 404) {
      console.log('✅ PASS - Correctly threw NotFoundError');
      passed++;
    } else {
      console.log('❌ FAIL - Wrong error type:', error.name);
      failed++;
    }
  }
  console.log();

  // Summary
  console.log('=== QA Test Results ===');
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! SDK is ready for users.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review before sharing with users.');
    process.exit(1);
  }
}

runQATests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
