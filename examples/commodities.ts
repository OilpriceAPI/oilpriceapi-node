/**
 * Commodities Metadata Example
 *
 * Shows how to work with commodity metadata endpoints
 */

import { OilPriceAPI } from 'oilpriceapi';

const client = new OilPriceAPI({
  apiKey: process.env.OIL_PRICE_API_KEY || 'your_api_key_here'
});

async function exploreCommodities() {
  console.log('=== Commodity Metadata Examples ===\n');

  // Example 1: Get all commodities
  console.log('1. Getting all commodities...');
  const { commodities } = await client.getCommodities();
  console.log(`Found ${commodities.length} total commodities\n`);

  // Show first few commodities
  console.log('Sample commodities:');
  commodities.slice(0, 3).forEach(c => {
    console.log(`  - ${c.name} (${c.code})`);
    console.log(`    Category: ${c.category}`);
    console.log(`    Unit: ${c.unit_description || c.unit}`);
    if (c.validation) {
      console.log(`    Valid range: $${c.validation.min} - $${c.validation.max}`);
    }
    console.log();
  });

  // Example 2: Get commodities by category
  console.log('\n2. Exploring commodity categories...');
  const categories = await client.getCommodityCategories();
  const categoryNames = Object.keys(categories);
  console.log(`Found ${categoryNames.length} categories:\n`);

  // Show category breakdown
  categoryNames.forEach(key => {
    const category = categories[key];
    console.log(`${category.name}: ${category.commodities.length} commodities`);
  });

  // Example 3: Get oil commodities
  console.log('\n3. Oil category commodities:');
  if (categories.oil) {
    categories.oil.commodities.forEach(c => {
      console.log(`  - ${c.name} (${c.code}): ${c.unit_description}`);
    });
  }

  // Example 4: Get specific commodity details
  console.log('\n4. WTI Crude Oil details:');
  const wti = await client.getCommodity('WTI_USD');
  console.log(`Name: ${wti.name}`);
  console.log(`Code: ${wti.code}`);
  console.log(`Category: ${wti.category}`);
  console.log(`Currency: ${wti.currency}`);
  console.log(`Unit: ${wti.unit_description}`);
  console.log(`Description: ${wti.description}`);
  if (wti.validation) {
    console.log(`Price range: $${wti.validation.min} - $${wti.validation.max}`);
  }
  console.log(`Price change alert threshold: ${wti.price_change_threshold}%`);

  // Example 5: Build a commodity selector for UI
  console.log('\n5. Commodity codes for UI dropdown:');
  const oilCommodities = categories.oil?.commodities || [];
  const dropdownOptions = oilCommodities.map(c => ({
    value: c.code,
    label: c.name,
    unit: c.unit
  }));
  console.log(JSON.stringify(dropdownOptions.slice(0, 3), null, 2));

  // Example 6: Validate commodity codes before API calls
  console.log('\n6. Validating commodity codes:');
  const validCodes = new Set(commodities.map(c => c.code));
  const testCodes = ['WTI_USD', 'BRENT_CRUDE_USD', 'INVALID_CODE'];

  testCodes.forEach(code => {
    const isValid = validCodes.has(code);
    console.log(`${code}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
  });

  // Example 7: Find commodities by category
  console.log('\n7. Finding all renewable energy commodities:');
  if (categories.renewable) {
    categories.renewable.commodities.forEach(c => {
      console.log(`  - ${c.name}: ${c.description || 'N/A'}`);
    });
  }
}

exploreCommodities().catch(console.error);
