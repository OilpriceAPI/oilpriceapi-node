import { OilPriceAPI } from './src/index.js';

const API_KEY = '3839c085460dd3a9dac1291f937f5a6d1740e8c668c766bc9f95e166af59cb11';

async function testCommoditiesEndpoints() {
  const client = new OilPriceAPI({ apiKey: API_KEY, debug: true });

  console.log('\n=== Testing Commodities Endpoints ===\n');

  try {
    // Test 1: Get all commodities
    console.log('1. Testing getCommodities()...');
    const commoditiesResponse = await client.getCommodities();
    console.log(`✓ Retrieved ${commoditiesResponse.commodities.length} commodities`);
    console.log('First commodity:', commoditiesResponse.commodities[0]);

    // Test 2: Get commodity categories
    console.log('\n2. Testing getCommodityCategories()...');
    const categoriesResponse = await client.getCommodityCategories();
    console.log(`✓ Retrieved ${categoriesResponse.categories.length} categories`);
    console.log('Categories:', categoriesResponse.categories);

    // Test 3: Get specific commodity
    console.log('\n3. Testing getCommodity("WTI_USD")...');
    const wti = await client.getCommodity('WTI_USD');
    console.log('✓ WTI Details:');
    console.log(`  Name: ${wti.name}`);
    console.log(`  Category: ${wti.category}`);
    console.log(`  Unit: ${wti.unit}`);
    console.log(`  Currency: ${wti.currency}`);

    console.log('\n✅ All commodity endpoints working!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testCommoditiesEndpoints();
