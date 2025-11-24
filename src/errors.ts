/**
 * Base error class for all Oil Price API errors
 */
export class OilPriceAPIError extends Error {
  /**
   * HTTP status code (if applicable)
   */
  statusCode?: number;

  /**
   * Error code from the API
   */
  code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'OilPriceAPIError';
    this.statusCode = statusCode;
    this.code = code;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when API authentication fails (401)
 */
export class AuthenticationError extends OilPriceAPIError {
  constructor(message: string = 'Invalid API key') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when rate limit is exceeded (429)
 */
export class RateLimitError extends OilPriceAPIError {
  /**
   * Number of seconds until rate limit resets
   */
  retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Thrown when requested resource is not found (404)
 */
export class NotFoundError extends OilPriceAPIError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when server returns 5xx error
 */
export class ServerError extends OilPriceAPIError {
  constructor(message: string = 'Internal server error', statusCode: number = 500) {
    super(message, statusCode, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}

/**
 * Thrown when request exceeds timeout
 */
export class TimeoutError extends OilPriceAPIError {
  constructor(message: string = 'Request timeout', timeout: number) {
    super(`${message} (${timeout}ms)`, undefined, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}
