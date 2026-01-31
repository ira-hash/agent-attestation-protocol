/**
 * @aap/client
 * 
 * Client library for Agent Attestation Protocol.
 * Enables AI agents to prove their identity to verification servers.
 */

import { Prover } from './prover.js';
import { Identity } from 'aap-agent-core';

/**
 * AAP Client - High-level interface for verification
 */
export class AAPClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.serverUrl] - Default verification server URL
   * @param {string} [options.storagePath] - Identity storage path
   * @param {Function} [options.llmCallback] - Default LLM callback for solutions
   */
  constructor(options = {}) {
    this.serverUrl = options.serverUrl?.replace(/\/$/, '');
    this.llmCallback = options.llmCallback;
    this.prover = new Prover({ storagePath: options.storagePath });
  }

  /**
   * Get agent's public identity
   * @returns {Object}
   */
  getIdentity() {
    return this.prover.getIdentity();
  }

  /**
   * Perform full verification against a server
   * 
   * @param {string} [serverUrl] - Override default server URL
   * @param {Function|string} [solutionOrCallback] - Solution or LLM callback
   * @returns {Promise<Object>} Verification result
   */
  async verify(serverUrl, solutionOrCallback) {
    const baseUrl = (serverUrl || this.serverUrl)?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new Error('Server URL is required');
    }

    const callback = solutionOrCallback || this.llmCallback;

    // Step 1: Request challenge
    const challengeRes = await fetch(`${baseUrl}/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!challengeRes.ok) {
      throw new Error(`Failed to get challenge: ${challengeRes.status}`);
    }

    const challenge = await challengeRes.json();

    // Step 2: Generate proof
    const proof = await this.prover.generateProof(challenge, callback);

    // Step 3: Submit proof
    const verifyRes = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof)
    });

    const result = await verifyRes.json();

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
   * Check server health
   * @param {string} [serverUrl] - Override default server URL
   * @returns {Promise<Object>}
   */
  async checkHealth(serverUrl) {
    const baseUrl = (serverUrl || this.serverUrl)?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new Error('Server URL is required');
    }

    try {
      const res = await fetch(`${baseUrl}/health`);
      if (!res.ok) {
        return { healthy: false, error: `HTTP ${res.status}` };
      }
      return { healthy: true, ...(await res.json()) };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Get a challenge without verifying (for manual flow)
   * @param {string} [serverUrl] - Override default server URL
   * @returns {Promise<Object>}
   */
  async getChallenge(serverUrl) {
    const baseUrl = (serverUrl || this.serverUrl)?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new Error('Server URL is required');
    }

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
   * Generate a proof for a challenge (for manual flow)
   * @param {Object} challenge - Challenge from getChallenge()
   * @param {Function|string} [solutionOrCallback] - Solution or callback
   * @returns {Promise<Object>}
   */
  async generateProof(challenge, solutionOrCallback) {
    return this.prover.generateProof(challenge, solutionOrCallback || this.llmCallback);
  }

  /**
   * Submit a proof for verification (for manual flow)
   * @param {string} serverUrl - Server URL
   * @param {Object} proof - Proof from generateProof()
   * @returns {Promise<Object>}
   */
  async submitProof(serverUrl, proof) {
    const baseUrl = (serverUrl || this.serverUrl)?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new Error('Server URL is required');
    }

    const res = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof)
    });

    return res.json();
  }

  /**
   * Sign arbitrary data
   * @param {string} data - Data to sign
   * @returns {Object}
   */
  sign(data) {
    return this.prover.sign(data);
  }
}

// Convenience factory
export function createClient(options) {
  return new AAPClient(options);
}

// Re-export Prover
export { Prover };

export default { AAPClient, createClient, Prover };
