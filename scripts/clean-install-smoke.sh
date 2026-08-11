#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

version="$(node -p "require('$root/package.json').version")"
tarball="$scratch/oilpriceapi-$version.tgz"

cd "$root"
npm run build
npm pack --pack-destination "$scratch" >/dev/null
test -f "$tarball"

mkdir "$scratch/consumer"
cd "$scratch/consumer"
npm init -y >/dev/null
npm install --ignore-scripts --no-audit --no-fund "$tarball" >/dev/null

EXPECTED_VERSION="$version" node --input-type=module <<'NODE'
import { OilPriceAPI, SDK_VERSION } from "oilpriceapi";

if (SDK_VERSION !== process.env.EXPECTED_VERSION) {
  throw new Error(`ESM version mismatch: ${SDK_VERSION}`);
}
const response = await new OilPriceAPI({ apiKey: "", retries: 0 }).getDemoPrices();
const brent = response.prices.find((price) => price.code === "BRENT_CRUDE_USD");
if (!brent || !Number.isFinite(brent.price) || !brent.updated_at) {
  throw new Error("ESM demo response failed the price integrity contract");
}
NODE

sleep 1

EXPECTED_VERSION="$version" node --input-type=commonjs <<'NODE'
const { OilPriceAPI, SDK_VERSION } = require("oilpriceapi");

if (SDK_VERSION !== process.env.EXPECTED_VERSION) {
  throw new Error(`CJS version mismatch: ${SDK_VERSION}`);
}
new OilPriceAPI({ apiKey: "", retries: 0 }).getDemoPrices().then((response) => {
  const wti = response.prices.find((price) => price.code === "WTI_USD");
  if (!wti || !Number.isFinite(wti.price) || !wti.updated_at) {
    throw new Error("CJS demo response failed the price integrity contract");
  }
});
NODE

echo "oilpriceapi@$version packed ESM/CJS production smoke passed"
