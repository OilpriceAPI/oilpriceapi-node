/**
 * Real-time Streaming Example (WebSocket)
 *
 * Streams live oil & natural-gas price updates over the OilPriceAPI
 * ActionCable `/cable` endpoint. Requires a Reservoir Mastery (Professional+)
 * plan and a valid API key.
 *
 * Run:
 *   OILPRICEAPI_KEY=your_key npx tsx examples/streaming.ts
 */

import { OilPriceAPI } from "oilpriceapi";

const client = new OilPriceAPI({
  apiKey: process.env.OILPRICEAPI_KEY || "your_api_key_here",
});

function main() {
  console.log("Connecting to the OilPriceAPI price stream...");

  const sub = client.stream.prices(
    // Optional client-side filter — omit to receive all commodities.
    { commodities: ["WTI_USD", "BRENT_CRUDE_USD"] },
    (update) => {
      const { brent, wti } = update.prices.oil;
      const parts: string[] = [];
      if (wti) parts.push(`WTI ${wti.original_price}`);
      if (brent) parts.push(`Brent ${brent.original_price}`);
      console.log(`[${update.timestamp}] ${parts.join("  |  ")}`);
    },
  );

  sub.on("connected", () => console.log("✓ Subscription confirmed — streaming live"));

  sub.on("welcome", (snapshot) => {
    console.log("Initial snapshot received:", JSON.stringify(snapshot.data, null, 2));
  });

  sub.on("rig_count_update", (m) => {
    console.log(`Rig count — ${m.rig_count.region}: ${m.rig_count.count} (${m.rig_count.source})`);
  });

  sub.on("reconnecting", ({ attempt, delay }) => {
    console.log(`Connection dropped. Reconnecting (attempt ${attempt}) in ${delay}ms...`);
  });

  sub.on("disconnected", ({ code, reason }) => {
    console.log(`Disconnected (code=${code})${reason ? `: ${reason}` : ""}`);
  });

  sub.on("error", (err) => {
    console.error("Stream error:", err.message);
  });

  // Clean teardown on Ctrl-C.
  process.on("SIGINT", () => {
    console.log("\nClosing stream...");
    sub.close();
    process.exit(0);
  });
}

main();
