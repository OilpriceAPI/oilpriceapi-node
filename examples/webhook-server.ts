/**
 * Express Webhook Server Example
 *
 * Demonstrates how to receive and verify OilPriceAPI webhook events.
 *
 * IMPORTANT: Use express.raw() for webhook routes — JSON body parsers
 * consume the raw body, which breaks signature verification.
 *
 * Setup:
 *   npm install express oilpriceapi
 *   OILPRICEAPI_KEY=your_key WEBHOOK_SECRET=your_secret npx ts-node webhook-server.ts
 */

import express from "express";
import { OilPriceAPI, verifyWebhookSignature } from "oilpriceapi";

const app = express();
const client = new OilPriceAPI(); // reads OILPRICEAPI_KEY from env

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error("WEBHOOK_SECRET environment variable is required");
  process.exit(1);
}

// Use raw body parser for webhook routes — this is critical!
// JSON parsers consume the stream, making signature verification impossible.
app.post("/webhooks/oilpriceapi", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-oilpriceapi-signature"] as string;

  if (!signature) {
    console.error("Missing X-OilPriceAPI-Signature header");
    return res.status(401).json({ error: "Missing signature" });
  }

  // Verify the webhook signature
  const isValid = verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET);

  if (!isValid) {
    console.error("Invalid webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Parse the verified payload
  const event = JSON.parse(req.body.toString());

  // Respond immediately — process asynchronously
  res.sendStatus(200);

  // Handle event types
  switch (event.type) {
    case "price.updated":
      console.log(`Price update: ${event.data.commodity} = $${event.data.price}`);
      break;

    case "alert.triggered":
      console.log(`Alert triggered: ${event.data.alert_name} (${event.data.commodity})`);
      break;

    default:
      console.log(`Unknown event type: ${event.type}`);
  }
});

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
  console.log(`POST http://localhost:${PORT}/webhooks/oilpriceapi`);
});
