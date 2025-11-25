/**
 * Express.js Integration Example
 *
 * Shows how to use the SDK in an Express API server
 *
 * Install dependencies:
 *   npm install express
 *   npm install -D @types/express
 */

import express from 'express';
import { OilPriceAPI } from 'oilpriceapi';

const app = express();
const port = 3000;

// Initialize SDK client (reuse across requests)
const oilPriceClient = new OilPriceAPI({
  apiKey: process.env.OIL_PRICE_API_KEY || 'your_api_key_here',
  retries: 3,
  timeout: 10000
});

// Endpoint: Get latest prices
app.get('/api/prices/latest', async (req, res) => {
  try {
    const commodity = req.query.commodity as string | undefined;
    const prices = await oilPriceClient.getLatestPrices({ commodity });

    res.json({
      success: true,
      data: prices,
      count: prices.length
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint: Get historical prices
app.get('/api/prices/historical', async (req, res) => {
  try {
    const commodity = req.query.commodity as string | undefined;
    const period = req.query.period as 'past_week' | 'past_month' | 'past_year' | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const prices = await oilPriceClient.getHistoricalPrices({
      commodity,
      period,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: prices,
      count: prices.length
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint: Get all commodities
app.get('/api/commodities', async (req, res) => {
  try {
    const response = await oilPriceClient.getCommodities();

    res.json({
      success: true,
      data: response.commodities,
      count: response.commodities.length
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint: Get commodity details
app.get('/api/commodities/:code', async (req, res) => {
  try {
    const commodity = await oilPriceClient.getCommodity(req.params.code);

    res.json({
      success: true,
      data: commodity
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Oil Price API server running on http://localhost:${port}`);
  console.log('\nAvailable endpoints:');
  console.log('  GET /api/prices/latest?commodity=WTI_USD');
  console.log('  GET /api/prices/historical?commodity=WTI_USD&period=past_week');
  console.log('  GET /api/commodities');
  console.log('  GET /api/commodities/WTI_USD');
});
