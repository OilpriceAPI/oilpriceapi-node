import { pathToFileURL } from "node:url";

export function fixtureBaseUrl(): string | undefined {
  return process.env.OILPRICEAPI_BASE_URL;
}

export function isMain(importMetaUrl: string): boolean {
  return Boolean(process.argv[1]) && importMetaUrl === pathToFileURL(process.argv[1]).href;
}
