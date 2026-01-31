/**
 * AAP Server - Error Definitions
 * 
 * Consistent, client-friendly error messages
 */

export const ErrorCodes = {
  // Challenge errors
  CHALLENGE_NOT_FOUND: 'CHALLENGE_NOT_FOUND',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
  CHALLENGE_ALREADY_USED: 'CHALLENGE_ALREADY_USED',
  
  // Solution errors
  MISSING_SOLUTIONS: 'MISSING_SOLUTIONS',
  INVALID_SOLUTIONS_COUNT: 'INVALID_SOLUTIONS_COUNT',
  SOLUTION_VALIDATION_FAILED: 'SOLUTION_VALIDATION_FAILED',
  
  // Timing errors
  RESPONSE_TOO_SLOW: 'RESPONSE_TOO_SLOW',
  
  // Signature errors
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  INVALID_PUBLIC_KEY: 'INVALID_PUBLIC_KEY',
  
  // General errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED'
};

export const ErrorMessages = {
  [ErrorCodes.CHALLENGE_NOT_FOUND]: {
    message: 'Challenge not found',
    hint: 'Request a new challenge via POST /challenge',
    status: 400
  },
  [ErrorCodes.CHALLENGE_EXPIRED]: {
    message: 'Challenge has expired',
    hint: 'Challenges expire after 60 seconds. Request a new one.',
    status: 400
  },
  [ErrorCodes.CHALLENGE_ALREADY_USED]: {
    message: 'Challenge already used',
    hint: 'Each challenge can only be used once. Request a new one.',
    status: 400
  },
  [ErrorCodes.MISSING_SOLUTIONS]: {
    message: 'Missing solutions array',
    hint: 'Include "solutions" array in request body',
    status: 400
  },
  [ErrorCodes.INVALID_SOLUTIONS_COUNT]: {
    message: 'Invalid number of solutions',
    hint: 'Provide exactly 3 solutions for batch challenges',
    status: 400
  },
  [ErrorCodes.SOLUTION_VALIDATION_FAILED]: {
    message: 'Solution validation failed (Proof of Intelligence)',
    hint: 'One or more solutions are incorrect. Ensure your LLM correctly solves each challenge.',
    status: 400
  },
  [ErrorCodes.RESPONSE_TOO_SLOW]: {
    message: 'Response too slow (Proof of Liveness failed)',
    hint: 'Response must arrive within 12 seconds for batch challenges',
    status: 400
  },
  [ErrorCodes.INVALID_SIGNATURE]: {
    message: 'Invalid signature (Proof of Identity failed)',
    hint: 'Ensure you sign the correct data with your private key',
    status: 400
  },
  [ErrorCodes.MISSING_SIGNATURE]: {
    message: 'Missing signature',
    hint: 'Include "signature" field with Base64-encoded ECDSA signature',
    status: 400
  },
  [ErrorCodes.INVALID_PUBLIC_KEY]: {
    message: 'Invalid public key',
    hint: 'Public key must be PEM-encoded secp256k1 key',
    status: 400
  },
  [ErrorCodes.INVALID_REQUEST]: {
    message: 'Invalid request format',
    hint: 'Check the API documentation for required fields',
    status: 400
  },
  [ErrorCodes.INTERNAL_ERROR]: {
    message: 'Internal server error',
    hint: 'Please try again later',
    status: 500
  },
  [ErrorCodes.RATE_LIMITED]: {
    message: 'Too many requests',
    hint: 'Please wait before making more requests',
    status: 429
  }
};

/**
 * Create an error response
 * @param {string} code - Error code from ErrorCodes
 * @param {Object} [extra] - Additional fields to include
 * @returns {Object} Error response object
 */
export function createError(code, extra = {}) {
  const errorDef = ErrorMessages[code] || ErrorMessages[ErrorCodes.INTERNAL_ERROR];
  
  return {
    verified: false,
    error: errorDef.message,
    code,
    hint: errorDef.hint,
    ...extra
  };
}

/**
 * Create error response with HTTP status
 * @param {string} code - Error code
 * @param {Object} res - Express response object
 * @param {Object} [extra] - Additional fields
 */
export function sendError(code, res, extra = {}) {
  const errorDef = ErrorMessages[code] || ErrorMessages[ErrorCodes.INTERNAL_ERROR];
  res.status(errorDef.status).json(createError(code, extra));
}

export default {
  ErrorCodes,
  ErrorMessages,
  createError,
  sendError
};
