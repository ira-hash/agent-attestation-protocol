/**
 * AAP HTTP Client
 * 
 * Handles communication with AAP verification servers.
 * Provides a simple interface for the full verification flow.
 */

import { generateProof } from './prover.js';
import { getPublicIdentity } from './identity.js';

/**
 * Perform full AAP verification against a server
 * 
 * @param {string} serverUrl - Base URL of the verification server
 * @param {Function} [llmCallback] - Optional LLM callback for intelligent responses
 * @returns {Promise<Object>} Verification result
 */
export async function verify(serverUrl, llmCallback) {
  const baseUrl = serverUrl.replace(/\/$/, '');
  
  console.log(`[AAP] Starting verification with ${baseUrl}...`);
  
  // Step 1: Request challenge
  console.log('[AAP] Step 1: Requesting challenge...');
  const challengeRes = await fetch(`${baseUrl}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!challengeRes.ok) {
    throw new Error(`Failed to get challenge: ${challengeRes.status}`);
  }
  
  const challenge = await challengeRes.json();
  console.log(`[AAP] Challenge received: type=${challenge.type}, nonce=${challenge.nonce.slice(0, 8)}...`);
  
  // Step 2: Generate proof
  console.log('[AAP] Step 2: Generating proof...');
  const proof = await generateProof(challenge, llmCallback);
  console.log(`[AAP] Proof generated in ${proof.responseTimeMs}ms`);
  
  // Step 3: Submit proof for verification
  console.log('[AAP] Step 3: Submitting proof...');
  const verifyRes = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      solution: proof.solution,
      signature: proof.signature,
      publicKey: proof.publicKey,
      publicId: proof.publicId,
      nonce: proof.nonce,
      timestamp: proof.timestamp,
      responseTimeMs: proof.responseTimeMs
    })
  });
  
  const result = await verifyRes.json();
  
  if (result.verified) {
    console.log(`[AAP] ✅ Verification successful! Role: ${result.role}`);
  } else {
    console.log(`[AAP] ❌ Verification failed: ${result.error}`);
  }
  
  return {
    ...result,
    challenge,
    proof: {
      solution: proof.solution,
      responseTimeMs: proof.responseTimeMs,
      publicId: proof.publicId
    }
  };
}

/**
 * Check if a verification server is healthy
 * 
 * @param {string} serverUrl - Base URL of the verification server
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth(serverUrl) {
  const baseUrl = serverUrl.replace(/\/$/, '');
  
  try {
    const res = await fetch(`${baseUrl}/health`);
    if (!res.ok) {
      return { healthy: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { healthy: true, ...data };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Get a challenge without completing verification
 * Useful for testing or manual verification
 * 
 * @param {string} serverUrl - Base URL of the verification server
 * @returns {Promise<Object>} Challenge object
 */
export async function getChallenge(serverUrl) {
  const baseUrl = serverUrl.replace(/\/$/, '');
  
  const res = await fetch(`${baseUrl}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get challenge: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Submit a pre-generated proof for verification
 * 
 * @param {string} serverUrl - Base URL of the verification server
 * @param {Object} proof - The proof object
 * @returns {Promise<Object>} Verification result
 */
export async function submitProof(serverUrl, proof) {
  const baseUrl = serverUrl.replace(/\/$/, '');
  
  const res = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proof)
  });
  
  return res.json();
}

export default {
  verify,
  checkHealth,
  getChallenge,
  submitProof
};
