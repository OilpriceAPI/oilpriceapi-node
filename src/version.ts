/**
 * SDK Version - centralized to ensure consistency across all headers
 *
 * This version must be updated when publishing a new release.
 * It's used in:
 * - User-Agent header: oilpriceapi-node/{version}
 * - X-Client-Version header
 * - Package.json (should match)
 */
export const SDK_VERSION = '0.7.0';

/**
 * SDK identifier used in User-Agent and X-Api-Client headers
 */
export const SDK_NAME = 'oilpriceapi-node';

/**
 * Build the full User-Agent string
 */
export function buildUserAgent(): string {
  return `${SDK_NAME}/${SDK_VERSION} node/${process.version}`;
}
