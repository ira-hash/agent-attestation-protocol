/**
 * AAP Passport - Agent Attestation Protocol Skill
 * 
 * Provides cryptographic identity and verification capabilities for AI agents.
 * 
 * Features:
 * - Automatic identity generation (secp256k1 key pair)
 * - Message signing and verification
 * - Challenge-Response proof generation
 * - Protocol-compliant attestation
 */

import * as identity from './lib/identity.js';
import * as prover from './lib/prover.js';

/**
 * Skill startup hook
 * Called automatically when the skill is loaded by Clawdbot
 */
export async function onStartup(context) {
  console.log('[AAP] Initializing Agent Attestation Protocol...');
  
  // Auto-generate identity if not exists
  identity.checkAndCreate();
  
  console.log('[AAP] Ready for verification challenges!');
}

/**
 * Tool: Get public identity information
 * Returns the agent's public key and ID (safe to share)
 */
export async function aap_get_identity() {
  const publicIdentity = identity.getPublicIdentity();
  
  if (!publicIdentity) {
    return {
      error: 'Identity not initialized. Please restart the bot.'
    };
  }
  
  return publicIdentity;
}

/**
 * Tool: Sign a message with the agent's private key
 * @param {Object} params
 * @param {string} params.message - Message to sign
 */
export async function aap_sign_message({ message }) {
  if (!message) {
    return { error: 'Message is required' };
  }
  
  const signature = identity.sign(message);
  const publicIdentity = identity.getPublicIdentity();
  
  return {
    message,
    signature,
    publicId: publicIdentity.publicId,
    timestamp: Date.now()
  };
}

/**
 * Tool: Generate a complete AAP proof for a server challenge
 * This is the main verification tool
 * 
 * @param {Object} params
 * @param {string} params.challenge_string - The challenge prompt
 * @param {string} params.nonce - Server-provided nonce
 * @param {string} [params.solution] - Pre-generated solution (optional)
 */
export async function aap_generate_proof({ challenge_string, nonce, solution }) {
  if (!challenge_string || !nonce) {
    return { error: 'challenge_string and nonce are required' };
  }
  
  const challenge = { challenge_string, nonce };
  
  // If solution is provided, use it; otherwise generate via callback
  const llmCallback = solution 
    ? async () => solution
    : async (prompt, n) => `AI Agent response to challenge ${n.slice(0, 8)}: Acknowledged.`;
  
  const proof = await prover.generateProof(challenge, llmCallback);
  
  return proof;
}

/**
 * Tool: Verify another agent's signature
 * @param {Object} params
 * @param {string} params.data - Original data
 * @param {string} params.signature - Signature to verify
 * @param {string} params.publicKey - Signer's public key
 */
export async function aap_verify_signature({ data, signature, publicKey }) {
  if (!data || !signature || !publicKey) {
    return { error: 'data, signature, and publicKey are required' };
  }
  
  const isValid = identity.verify(data, signature, publicKey);
  
  return {
    valid: isValid,
    data,
    verifiedAt: Date.now()
  };
}

/**
 * Tool: Create a test challenge (for development/testing)
 * @param {Object} params
 * @param {string} [params.prompt] - Custom challenge prompt
 */
export async function aap_create_challenge({ prompt } = {}) {
  const challenge = prover.createChallenge(prompt);
  return challenge;
}

// Export tools for Clawdbot registration
export const tools = {
  aap_get_identity: {
    description: 'Get this agent\'s public identity (public key and ID)',
    parameters: {}
  },
  aap_sign_message: {
    description: 'Sign a message with this agent\'s private key',
    parameters: {
      message: { type: 'string', description: 'Message to sign', required: true }
    }
  },
  aap_generate_proof: {
    description: 'Generate a complete AAP proof for server verification',
    parameters: {
      challenge_string: { type: 'string', description: 'Challenge prompt from server', required: true },
      nonce: { type: 'string', description: 'Server-provided nonce', required: true },
      solution: { type: 'string', description: 'Pre-generated solution (optional)' }
    }
  },
  aap_verify_signature: {
    description: 'Verify another agent\'s signature',
    parameters: {
      data: { type: 'string', description: 'Original signed data', required: true },
      signature: { type: 'string', description: 'Signature to verify', required: true },
      publicKey: { type: 'string', description: 'Public key of the signer', required: true }
    }
  },
  aap_create_challenge: {
    description: 'Create a test challenge for development',
    parameters: {
      prompt: { type: 'string', description: 'Custom challenge prompt' }
    }
  }
};

export default {
  onStartup,
  aap_get_identity,
  aap_sign_message,
  aap_generate_proof,
  aap_verify_signature,
  aap_create_challenge,
  tools
};
