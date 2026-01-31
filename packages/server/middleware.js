/**
 * @aap/server - Express Middleware
 * 
 * Drop-in middleware for adding AAP verification to Express apps.
 */

import { verify, generateNonce, createProofData } from 'aap-agent-core';
import { 
  generate as generateChallenge, 
  generateBatch,
  validateBatch,
  getTypes, 
  validate as validateSolution, 
  BATCH_SIZE,
  MAX_RESPONSE_TIME_MS, 
  CHALLENGE_EXPIRY_MS 
} from './challenges.js';
import * as logger from './logger.js';
import { ErrorCodes, sendError } from './errors.js';

/**
 * Create AAP verification middleware/router
 * 
 * @param {Object} [options]
 * @param {number} [options.challengeExpiryMs=60000] - Challenge expiration time
 * @param {number} [options.maxResponseTimeMs=8000] - Max response time for batch
 * @param {number} [options.batchSize=5] - Number of challenges per batch
 * @param {number} [options.minPassCount] - Minimum challenges to pass (default: all)
 * @param {Function} [options.onVerified] - Callback when agent is verified
 * @param {Function} [options.onFailed] - Callback when verification fails
 * @returns {Function} Express router
 */
export function aapMiddleware(options = {}) {
  const {
    challengeExpiryMs = CHALLENGE_EXPIRY_MS,
    maxResponseTimeMs = MAX_RESPONSE_TIME_MS,
    batchSize = BATCH_SIZE,
    minPassCount = null,  // null = all must pass
    onVerified,
    onFailed
  } = options;

  // In-memory challenge store with size limit (DoS protection)
  const MAX_CHALLENGES = 10000;
  const challenges = new Map();

  // Cleanup expired challenges periodically
  const cleanup = () => {
    const now = Date.now();
    for (const [nonce, challenge] of challenges.entries()) {
      if (now > challenge.expiresAt) {
        challenges.delete(nonce);
      }
    }
    
    // Emergency cleanup if still too many (keep newest)
    if (challenges.size > MAX_CHALLENGES) {
      const entries = [...challenges.entries()]
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, MAX_CHALLENGES / 2);
      challenges.clear();
      entries.forEach(([k, v]) => challenges.set(k, v));
    }
  };

  // Return a function that creates routes
  return (router) => {
    /**
     * GET /health - Health check
     */
    router.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        protocol: 'AAP',
        version: '2.0.0',
        mode: 'batch',
        batchSize,
        maxResponseTimeMs,
        challengeTypes: getTypes(),
        activeChallenges: challenges.size
      });
    });

    /**
     * POST /challenge - Request a batch of challenges
     */
    router.post('/challenge', (req, res) => {
      cleanup();

      const nonce = generateNonce();
      const timestamp = Date.now();
      const { challenges: batchChallenges, validators, expected } = generateBatch(nonce, batchSize);

      const challengeData = {
        nonce,
        challenges: batchChallenges,
        batchSize,
        timestamp,
        expiresAt: timestamp + challengeExpiryMs,
        maxResponseTimeMs
      };

      // Store with validators (not sent to client)
      challenges.set(nonce, { 
        ...challengeData, 
        validators,
        expected  // For debugging
      });

      // Send without validators
      res.json({
        nonce,
        challenges: batchChallenges,
        batchSize,
        timestamp,
        expiresAt: challengeData.expiresAt,
        maxResponseTimeMs
      });
    });

    /**
     * POST /verify - Verify agent's batch solutions
     */
    router.post('/verify', (req, res) => {
      const {
        solutions,
        signature,
        publicKey,
        publicId,
        nonce,
        timestamp,
        responseTimeMs
      } = req.body;

      const checks = {
        inputValid: false,
        challengeExists: false,
        notExpired: false,
        solutionsExist: false,
        solutionsValid: false,
        responseTimeValid: false,
        signatureValid: false
      };

      try {
        // Check 0: Input validation (security)
        if (!nonce || typeof nonce !== 'string' || nonce.length !== 32) {
          return res.status(400).json({ verified: false, error: 'Invalid nonce format', checks });
        }
        if (!publicId || typeof publicId !== 'string' || publicId.length !== 20) {
          return res.status(400).json({ verified: false, error: 'Invalid publicId format', checks });
        }
        if (!signature || typeof signature !== 'string' || signature.length < 50) {
          return res.status(400).json({ verified: false, error: 'Invalid signature format', checks });
        }
        if (!publicKey || typeof publicKey !== 'string' || !publicKey.includes('BEGIN PUBLIC KEY')) {
          return res.status(400).json({ verified: false, error: 'Invalid publicKey format', checks });
        }
        if (!timestamp || typeof timestamp !== 'number') {
          return res.status(400).json({ verified: false, error: 'Invalid timestamp', checks });
        }
        if (!responseTimeMs || typeof responseTimeMs !== 'number' || responseTimeMs < 0) {
          return res.status(400).json({ verified: false, error: 'Invalid responseTimeMs', checks });
        }
        checks.inputValid = true;

        // Check 1: Challenge exists (check BEFORE delete for race condition fix)
        const challenge = challenges.get(nonce);
        if (!challenge) {
          if (onFailed) onFailed({ error: 'Challenge not found', checks }, req);
          return res.status(400).json({
            verified: false,
            error: 'Challenge not found or already used',
            checks
          });
        }
        checks.challengeExists = true;

        // Check 2: Not expired (check BEFORE delete - race condition fix)
        if (Date.now() > challenge.expiresAt) {
          challenges.delete(nonce);  // Clean up expired
          if (onFailed) onFailed({ error: 'Challenge expired', checks }, req);
          return res.status(400).json({
            verified: false,
            error: 'Challenge expired',
            checks
          });
        }
        checks.notExpired = true;

        // Remove challenge (one-time use) - only after expiry check
        const { validators, batchSize: size } = challenge;
        challenges.delete(nonce);

        // Check 3: Solutions exist
        if (!solutions || !Array.isArray(solutions) || solutions.length !== size) {
          if (onFailed) onFailed({ error: 'Invalid solutions array', checks }, req);
          return res.status(400).json({
            verified: false,
            error: `Expected ${size} solutions, got ${solutions?.length || 0}`,
            checks
          });
        }
        checks.solutionsExist = true;

        // Check 4: Validate all solutions (Proof of Intelligence)
        const batchResult = validateBatch(validators, solutions);
        const requiredPass = minPassCount || size;
        
        if (batchResult.passed < requiredPass) {
          if (onFailed) onFailed({ error: 'Solutions validation failed', checks, batchResult }, req);
          return res.status(400).json({
            verified: false,
            error: `Proof of Intelligence failed: ${batchResult.passed}/${size} correct (need ${requiredPass})`,
            checks,
            batchResult
          });
        }
        checks.solutionsValid = true;

        // Check 5: Response time (Proof of Liveness) - SERVER-SIDE validation
        const serverResponseTime = Date.now() - challenge.timestamp;
        const effectiveResponseTime = Math.max(responseTimeMs, serverResponseTime);
        
        if (effectiveResponseTime > maxResponseTimeMs) {
          if (onFailed) onFailed({ error: 'Response too slow', checks }, req);
          return res.status(400).json({
            verified: false,
            error: `Response too slow: ${effectiveResponseTime}ms > ${maxResponseTimeMs}ms (Proof of Liveness failed)`,
            checks,
            timing: { client: responseTimeMs, server: serverResponseTime }
          });
        }
        checks.responseTimeValid = true;

        // Check 6: Signature (Proof of Identity)
        // Sign over solutions array
        const solutionsString = JSON.stringify(solutions);
        const proofData = createProofData({ nonce, solution: solutionsString, publicId, timestamp });
        if (!verify(proofData, signature, publicKey)) {
          if (onFailed) onFailed({ error: 'Invalid signature', checks }, req);
          return res.status(400).json({
            verified: false,
            error: 'Invalid signature (Proof of Identity failed)',
            checks
          });
        }
        checks.signatureValid = true;

        // All checks passed
        const result = {
          verified: true,
          role: 'AI_AGENT',
          publicId,
          batchResult,
          responseTimeMs,
          checks
        };

        if (onVerified) onVerified(result, req);

        res.json(result);

      } catch (error) {
        if (onFailed) onFailed({ error: error.message, checks }, req);
        res.status(500).json({
          verified: false,
          error: `Verification error: ${error.message}`,
          checks
        });
      }
    });

    // ============== Legacy single-challenge endpoints ==============
    
    /**
     * POST /challenge/single - Request a single challenge (legacy)
     */
    router.post('/challenge/single', (req, res) => {
      cleanup();

      const nonce = generateNonce();
      const timestamp = Date.now();
      const { type, challenge_string, validate } = generateChallenge(nonce);

      const challenge = {
        challenge_string,
        nonce,
        type,
        difficulty: 1,
        timestamp,
        expiresAt: timestamp + challengeExpiryMs,
        mode: 'single'
      };

      challenges.set(nonce, { ...challenge, validate });

      res.json({
        challenge_string,
        nonce,
        type,
        difficulty: 1,
        timestamp,
        expiresAt: challenge.expiresAt,
        mode: 'single',
        maxResponseTimeMs: 10000  // 10s for single
      });
    });

    /**
     * POST /verify/single - Verify single challenge (legacy)
     */
    router.post('/verify/single', (req, res) => {
      const {
        solution,
        signature,
        publicKey,
        publicId,
        nonce,
        timestamp,
        responseTimeMs
      } = req.body;

      const checks = {
        challengeExists: false,
        notExpired: false,
        solutionExists: false,
        solutionValid: false,
        responseTimeValid: false,
        signatureValid: false
      };

      try {
        const challenge = challenges.get(nonce);
        if (!challenge || challenge.mode !== 'single') {
          return res.status(400).json({
            verified: false,
            error: 'Single challenge not found',
            checks
          });
        }
        checks.challengeExists = true;

        const { validate, type: challengeType } = challenge;
        challenges.delete(nonce);

        if (Date.now() > challenge.expiresAt) {
          return res.status(400).json({ verified: false, error: 'Challenge expired', checks });
        }
        checks.notExpired = true;

        if (!solution) {
          return res.status(400).json({ verified: false, error: 'Missing solution', checks });
        }
        checks.solutionExists = true;

        if (!validate(solution)) {
          return res.status(400).json({ verified: false, error: 'Invalid solution', checks });
        }
        checks.solutionValid = true;

        if (responseTimeMs > 10000) {
          return res.status(400).json({ verified: false, error: 'Too slow', checks });
        }
        checks.responseTimeValid = true;

        const proofData = createProofData({ nonce, solution, publicId, timestamp });
        if (!verify(proofData, signature, publicKey)) {
          return res.status(400).json({ verified: false, error: 'Invalid signature', checks });
        }
        checks.signatureValid = true;

        res.json({
          verified: true,
          role: 'AI_AGENT',
          publicId,
          challengeType,
          checks
        });

      } catch (error) {
        res.status(500).json({ verified: false, error: error.message, checks });
      }
    });

    return router;
  };
}

/**
 * Create a standalone AAP router for Express
 * 
 * @param {Object} [options] - Middleware options
 * @returns {Router} Express router
 * 
 * @example
 * import express from 'express';
 * import { createRouter } from '@aap/server';
 * 
 * const app = express();
 * app.use('/aap/v1', createRouter());
 */
export async function createRouter(options = {}) {
  // Dynamic import for optional express dependency
  let express;
  try {
    express = (await import('express')).default;
  } catch {
    throw new Error('express is required for createRouter. Install with: npm install express');
  }
  const router = express.Router();
  router.use(express.json());
  
  const middleware = aapMiddleware(options);
  middleware(router);
  
  return router;
}

export default { aapMiddleware, createRouter };
