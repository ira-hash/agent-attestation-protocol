/**
 * @aap/server - Express Middleware
 * 
 * Drop-in middleware for adding AAP verification to Express apps.
 */

import { verify, generateNonce, createProofData, DEFAULT_CHALLENGE_EXPIRY_MS, DEFAULT_MAX_RESPONSE_TIME_MS } from '@aap/core';
import { generate as generateChallenge, getTypes, validate as validateSolution } from './challenges.js';

/**
 * Create AAP verification middleware/router
 * 
 * @param {Object} [options]
 * @param {number} [options.challengeExpiryMs=30000] - Challenge expiration time
 * @param {number} [options.maxResponseTimeMs=1500] - Max response time for liveness
 * @param {Function} [options.onVerified] - Callback when agent is verified
 * @param {Function} [options.onFailed] - Callback when verification fails
 * @returns {Function} Express router
 */
export function aapMiddleware(options = {}) {
  const {
    challengeExpiryMs = DEFAULT_CHALLENGE_EXPIRY_MS,
    maxResponseTimeMs = DEFAULT_MAX_RESPONSE_TIME_MS,
    onVerified,
    onFailed
  } = options;

  // In-memory challenge store
  const challenges = new Map();

  // Cleanup expired challenges periodically
  const cleanup = () => {
    const now = Date.now();
    for (const [nonce, challenge] of challenges.entries()) {
      if (now > challenge.expiresAt) {
        challenges.delete(nonce);
      }
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
        version: '1.0.0',
        challengeTypes: getTypes(),
        activeChallenges: challenges.size
      });
    });

    /**
     * POST /challenge - Request a new challenge
     */
    router.post('/challenge', (req, res) => {
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
        expiresAt: timestamp + challengeExpiryMs
      };

      // Store with validation function
      challenges.set(nonce, { ...challenge, validate });

      // Send without validate function
      res.json({
        challenge_string,
        nonce,
        type,
        difficulty: 1,
        timestamp,
        expiresAt: challenge.expiresAt
      });
    });

    /**
     * POST /verify - Verify an agent's proof
     */
    router.post('/verify', (req, res) => {
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
        // Check 1: Challenge exists
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

        // Remove challenge (one-time use)
        const { validate, type: challengeType } = challenge;
        challenges.delete(nonce);

        // Check 2: Not expired
        if (Date.now() > challenge.expiresAt) {
          if (onFailed) onFailed({ error: 'Challenge expired', checks }, req);
          return res.status(400).json({
            verified: false,
            error: 'Challenge expired',
            checks
          });
        }
        checks.notExpired = true;

        // Check 3: Solution exists
        if (!solution || solution.trim().length === 0) {
          if (onFailed) onFailed({ error: 'Missing solution', checks }, req);
          return res.status(400).json({
            verified: false,
            error: 'Missing solution',
            checks
          });
        }
        checks.solutionExists = true;

        // Check 4: Solution valid (Proof of Intelligence)
        if (!validate(solution)) {
          if (onFailed) onFailed({ error: 'Invalid solution', checks }, req);
          return res.status(400).json({
            verified: false,
            error: 'Solution does not meet challenge requirements (Proof of Intelligence failed)',
            checks
          });
        }
        checks.solutionValid = true;

        // Check 5: Response time (Proof of Liveness)
        if (responseTimeMs > maxResponseTimeMs) {
          if (onFailed) onFailed({ error: 'Response too slow', checks }, req);
          return res.status(400).json({
            verified: false,
            error: `Response too slow: ${responseTimeMs}ms > ${maxResponseTimeMs}ms (Proof of Liveness failed)`,
            checks
          });
        }
        checks.responseTimeValid = true;

        // Check 6: Signature (Proof of Identity)
        const proofData = createProofData({ nonce, solution, publicId, timestamp });
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
          challengeType,
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
export function createRouter(options = {}) {
  // Dynamic import to avoid requiring express as hard dependency
  const express = require('express');
  const router = express.Router();
  router.use(express.json());
  
  const middleware = aapMiddleware(options);
  middleware(router);
  
  return router;
}

export default { aapMiddleware, createRouter };
