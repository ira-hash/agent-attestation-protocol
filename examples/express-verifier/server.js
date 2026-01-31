/**
 * AAP Verifier Server Example
 * 
 * A simple Express.js server demonstrating server-side AAP verification.
 * This is the "server" side of the Agent Attestation Protocol.
 * 
 * Endpoints:
 * - POST /challenge: Generate a new challenge for an agent
 * - POST /verify: Verify an agent's proof response
 * 
 * Usage:
 *   npm install
 *   npm start
 *   # Server runs on http://localhost:3000
 */

import express from 'express';
import { createVerify, randomBytes } from 'node:crypto';

const app = express();
app.use(express.json());

// In-memory challenge store (use Redis/DB in production)
const challenges = new Map();

// Challenge expiration time (30 seconds)
const CHALLENGE_EXPIRY_MS = 30000;

// Maximum response time for Proof of Liveness (1.5 seconds)
const MAX_RESPONSE_TIME_MS = 1500;

/**
 * POST /challenge
 * Generate a new challenge for an agent to prove their identity
 * 
 * Response: {
 *   challenge_string: string,
 *   nonce: string,
 *   difficulty: number,
 *   timestamp: number,
 *   expiresAt: number
 * }
 */
app.post('/challenge', (req, res) => {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now();
  
  const challenge = {
    challenge_string: 'Prove you are an AI agent by responding to this challenge',
    nonce,
    difficulty: 1,
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_MS
  };
  
  // Store challenge for later verification
  challenges.set(nonce, {
    ...challenge,
    issuedAt: timestamp
  });
  
  // Clean up expired challenges periodically
  cleanupExpiredChallenges();
  
  console.log(`[Challenge] Issued nonce: ${nonce.slice(0, 8)}...`);
  
  res.json(challenge);
});

/**
 * POST /verify
 * Verify an agent's proof response
 * 
 * Request body: {
 *   solution: string,
 *   signature: string,
 *   publicKey: string,
 *   publicId: string,
 *   nonce: string,
 *   timestamp: number,
 *   responseTimeMs: number
 * }
 * 
 * Response: {
 *   verified: boolean,
 *   role?: "AI_AGENT",
 *   checks?: object,
 *   error?: string
 * }
 */
app.post('/verify', (req, res) => {
  const { 
    solution, 
    signature, 
    publicKey, 
    publicId, 
    nonce, 
    timestamp,
    responseTimeMs 
  } = req.body;
  
  const results = {
    verified: false,
    checks: {
      challengeExists: false,
      notExpired: false,
      signatureValid: false,
      solutionExists: false,
      responseTimeValid: false
    }
  };
  
  try {
    // Check 1: Challenge exists
    const originalChallenge = challenges.get(nonce);
    if (!originalChallenge) {
      return res.status(400).json({
        verified: false,
        error: 'Challenge not found or already used'
      });
    }
    results.checks.challengeExists = true;
    
    // Remove challenge (one-time use)
    challenges.delete(nonce);
    
    // Check 2: Challenge not expired
    if (Date.now() > originalChallenge.expiresAt) {
      return res.status(400).json({
        verified: false,
        error: 'Challenge expired'
      });
    }
    results.checks.notExpired = true;
    
    // Check 3: Solution exists (Proof of Intelligence)
    if (!solution || solution.trim().length === 0) {
      return res.status(400).json({
        verified: false,
        error: 'Missing solution (Proof of Intelligence failed)'
      });
    }
    results.checks.solutionExists = true;
    
    // Check 4: Response time (Proof of Liveness)
    if (responseTimeMs > MAX_RESPONSE_TIME_MS) {
      return res.status(400).json({
        verified: false,
        error: `Response too slow: ${responseTimeMs}ms > ${MAX_RESPONSE_TIME_MS}ms (Proof of Liveness failed)`
      });
    }
    results.checks.responseTimeValid = true;
    
    // Check 5: Signature valid (Proof of Identity)
    const proofData = {
      nonce,
      solution,
      publicId,
      timestamp
    };
    const dataToVerify = JSON.stringify(proofData);
    
    const isSignatureValid = verifySignature(dataToVerify, signature, publicKey);
    if (!isSignatureValid) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid signature (Proof of Identity failed)'
      });
    }
    results.checks.signatureValid = true;
    
    // All checks passed!
    results.verified = true;
    
    console.log(`[Verify] ✅ Agent verified! Public ID: ${publicId?.slice(0, 8)}...`);
    
    res.json({
      verified: true,
      role: 'AI_AGENT',
      publicId,
      checks: results.checks
    });
    
  } catch (error) {
    console.error('[Verify] Error:', error.message);
    res.status(500).json({
      verified: false,
      error: `Verification error: ${error.message}`
    });
  }
});

/**
 * Verify a signature using secp256k1
 * @param {string} data - Original data that was signed
 * @param {string} signature - Base64-encoded signature
 * @param {string} publicKey - PEM-encoded public key
 * @returns {boolean} True if signature is valid
 */
function verifySignature(data, signature, publicKey) {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('[Verify] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Clean up expired challenges from memory
 */
function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [nonce, challenge] of challenges.entries()) {
    if (now > challenge.expiresAt) {
      challenges.delete(nonce);
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    protocol: 'AAP',
    version: '1.0.0',
    activeChallenges: challenges.size
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           AAP Verifier Server - Example                   ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    POST /challenge  - Get a new challenge                 ║
║    POST /verify     - Verify agent proof                  ║
║    GET  /health     - Health check                        ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                    ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
