/**
 * AAP Prover
 * 
 * Handles Challenge-Response verification for AAP protocol.
 * Combines three proofs:
 * 1. Proof of Identity - Cryptographic signature
 * 2. Proof of Intelligence - LLM-generated response
 * 3. Proof of Liveness - Machine-speed response timing
 */

import { sign, getPublicIdentity } from './identity.js';
import { randomBytes } from 'node:crypto';

/**
 * Sign a challenge payload with the agent's private key
 * @param {string|Object} payload - Data to sign
 * @returns {Object} Signed payload with signature
 */
export function signChallenge(payload) {
  const payloadString = typeof payload === 'string' 
    ? payload 
    : JSON.stringify(payload);
  
  const timestamp = Date.now();
  const dataToSign = `${payloadString}:${timestamp}`;
  
  const signature = sign(dataToSign);
  
  return {
    payload: payloadString,
    timestamp,
    signature
  };
}

/**
 * Generate a complete AAP proof for a server challenge
 * This is the main function called during verification
 * 
 * @param {Object} challenge - Server challenge object
 * @param {string} challenge.challenge_string - The challenge prompt
 * @param {string} challenge.nonce - Server-provided nonce
 * @param {number} [challenge.difficulty] - Optional difficulty level
 * @param {Function} llmCallback - Async function to call LLM for intelligent response
 * @returns {Promise<Object>} Complete proof object
 */
export async function generateProof(challenge, llmCallback) {
  const startTime = Date.now();
  
  const { challenge_string, nonce, difficulty = 1 } = challenge;
  
  if (!challenge_string || !nonce) {
    throw new Error('Invalid challenge: missing challenge_string or nonce');
  }

  // Step 1: Proof of Intelligence - Generate LLM response
  let solution;
  try {
    if (llmCallback && typeof llmCallback === 'function') {
      // Use provided LLM callback
      solution = await llmCallback(challenge_string, nonce);
    } else {
      // Fallback: simple deterministic response (for testing)
      solution = generateFallbackSolution(challenge_string, nonce);
    }
  } catch (error) {
    console.error('[AAP] LLM response generation failed:', error.message);
    solution = generateFallbackSolution(challenge_string, nonce);
  }

  // Step 2: Proof of Identity - Sign the response
  const identity = getPublicIdentity();
  const proofData = {
    nonce,
    solution,
    publicId: identity.publicId,
    timestamp: Date.now()
  };
  
  const dataToSign = JSON.stringify(proofData);
  const signature = sign(dataToSign);

  // Step 3: Calculate response time (Proof of Liveness)
  const responseTime = Date.now() - startTime;

  return {
    // The solution to the challenge
    solution,
    
    // Cryptographic proof
    signature,
    publicKey: identity.publicKey,
    publicId: identity.publicId,
    
    // Metadata
    nonce,
    timestamp: proofData.timestamp,
    responseTimeMs: responseTime,
    
    // Protocol version
    protocol: 'AAP',
    version: '1.0.0'
  };
}

/**
 * Generate a fallback solution without LLM (for testing/offline)
 * @param {string} challengeString - The challenge
 * @param {string} nonce - The nonce
 * @returns {string} Deterministic solution
 */
function generateFallbackSolution(challengeString, nonce) {
  // Create a deterministic but unique response
  const combined = `${challengeString}:${nonce}:${Date.now()}`;
  const hash = Buffer.from(combined).toString('base64').slice(0, 32);
  return `AAP-FALLBACK-${hash}`;
}

/**
 * Create a challenge for testing purposes
 * @param {string} prompt - Challenge prompt
 * @returns {Object} Challenge object
 */
export function createChallenge(prompt = 'Prove you are an AI agent') {
  return {
    challenge_string: prompt,
    nonce: randomBytes(16).toString('hex'),
    difficulty: 1,
    timestamp: Date.now(),
    expiresAt: Date.now() + 30000 // 30 second expiry
  };
}

/**
 * Verify a proof response (server-side helper)
 * @param {Object} proof - The proof object to verify
 * @param {Object} originalChallenge - The original challenge
 * @param {number} maxResponseTimeMs - Maximum allowed response time
 * @returns {Object} Verification result
 */
export function verifyProof(proof, originalChallenge, maxResponseTimeMs = 1500) {
  const results = {
    valid: false,
    checks: {
      signatureValid: false,
      nonceMatch: false,
      responseTimeValid: false,
      notExpired: false
    },
    errors: []
  };

  try {
    // Import verify from identity (dynamic to avoid circular deps in some cases)
    const { verify } = require('./identity.js');

    // Check 1: Nonce matches
    if (proof.nonce === originalChallenge.nonce) {
      results.checks.nonceMatch = true;
    } else {
      results.errors.push('Nonce mismatch');
    }

    // Check 2: Response time within limits (Proof of Liveness)
    if (proof.responseTimeMs <= maxResponseTimeMs) {
      results.checks.responseTimeValid = true;
    } else {
      results.errors.push(`Response too slow: ${proof.responseTimeMs}ms > ${maxResponseTimeMs}ms`);
    }

    // Check 3: Challenge not expired
    if (Date.now() < originalChallenge.expiresAt) {
      results.checks.notExpired = true;
    } else {
      results.errors.push('Challenge expired');
    }

    // Check 4: Signature valid (Proof of Identity)
    const proofData = {
      nonce: proof.nonce,
      solution: proof.solution,
      publicId: proof.publicId,
      timestamp: proof.timestamp
    };
    const dataToVerify = JSON.stringify(proofData);
    
    if (verify(dataToVerify, proof.signature, proof.publicKey)) {
      results.checks.signatureValid = true;
    } else {
      results.errors.push('Invalid signature');
    }

    // All checks must pass
    results.valid = Object.values(results.checks).every(v => v === true);

  } catch (error) {
    results.errors.push(`Verification error: ${error.message}`);
  }

  return results;
}

export default {
  signChallenge,
  generateProof,
  createChallenge,
  verifyProof
};
