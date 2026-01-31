/**
 * AAP Rate Limiter
 * 
 * Simple in-memory rate limiting (no external dependencies)
 */

/**
 * Create a rate limiter
 * @param {Object} options
 * @param {number} [options.windowMs=60000] - Time window in ms
 * @param {number} [options.max=10] - Max requests per window
 * @param {string} [options.message] - Error message
 * @returns {Function} Express middleware
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,
    max = 10,
    message = 'Too many requests, please try again later'
  } = options;

  const requests = new Map();

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.firstRequest > windowMs) {
        requests.delete(key);
      }
    }
  }, windowMs);

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let data = requests.get(key);

    if (!data || now - data.firstRequest > windowMs) {
      // New window
      data = { count: 1, firstRequest: now };
      requests.set(key, data);
    } else {
      data.count++;
    }

    // Set headers
    const remaining = Math.max(0, max - data.count);
    const resetTime = Math.ceil((data.firstRequest + windowMs) / 1000);
    
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (data.count > max) {
      res.setHeader('Retry-After', Math.ceil((data.firstRequest + windowMs - now) / 1000));
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((data.firstRequest + windowMs - now) / 1000)
      });
    }

    next();
  };
}

/**
 * Create rate limiter for failed attempts
 * Stricter limits after failures
 */
export function createFailureLimiter(options = {}) {
  const {
    windowMs = 60000,
    maxFailures = 5,
    message = 'Too many failed attempts'
  } = options;

  const failures = new Map();

  return {
    middleware: (req, res, next) => {
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      const data = failures.get(key);

      if (data && data.count >= maxFailures && Date.now() - data.firstFailure < windowMs) {
        return res.status(429).json({
          error: message,
          retryAfter: Math.ceil((data.firstFailure + windowMs - Date.now()) / 1000)
        });
      }

      next();
    },

    recordFailure: (req) => {
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      let data = failures.get(key);

      if (!data || now - data.firstFailure > windowMs) {
        data = { count: 1, firstFailure: now };
      } else {
        data.count++;
      }

      failures.set(key, data);
    },

    clearFailures: (req) => {
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      failures.delete(key);
    }
  };
}

export default { createRateLimiter, createFailureLimiter };
