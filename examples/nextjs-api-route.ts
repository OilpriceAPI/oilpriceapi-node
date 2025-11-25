/**
 * Next.js API Route Example
 *
 * Place this file in: pages/api/oil-prices.ts (Pages Router)
 * Or: app/api/oil-prices/route.ts (App Router - adjust export syntax)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { OilPriceAPI, OilPriceAPIError } from 'oilpriceapi';

// Initialize client outside handler for connection reuse
const client = new OilPriceAPI({
  apiKey: process.env.OIL_PRICE_API_KEY!,
  retries: 3,
  timeout: 10000
});

type SuccessResponse = {
  success: true;
  data: any;
  cached?: boolean;
};

type ErrorResponse = {
  success: false;
  error: string;
  statusCode?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { commodity, period, type = 'latest' } = req.query;

    // Set cache headers (cache for 5 minutes)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    if (type === 'latest') {
      const prices = await client.getLatestPrices({
        commodity: commodity as string | undefined
      });

      return res.status(200).json({
        success: true,
        data: prices
      });
    }

    if (type === 'historical') {
      const prices = await client.getHistoricalPrices({
        commodity: commodity as string | undefined,
        period: period as 'past_week' | 'past_month' | 'past_year' | undefined
      });

      return res.status(200).json({
        success: true,
        data: prices
      });
    }

    if (type === 'commodities') {
      const response = await client.getCommodities();

      return res.status(200).json({
        success: true,
        data: response.commodities
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid type parameter. Use: latest, historical, or commodities'
    });

  } catch (error) {
    console.error('Oil Price API Error:', error);

    if (error instanceof OilPriceAPIError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        statusCode: error.statusCode
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
