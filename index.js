/**
 * AAP Passport Skill
 * 
 * Agent Attestation Protocol (AAP) implementation for Moltbot/Clawdbot.
 * 
 * Provides:
 * - Automatic identity generation on startup
 * - Challenge-Response verification tools
 * - Cryptographic proof generation
 * 
 * Installation:
 *   clawdbot install aap-passport
 * 
 * @version 1.0.0
 * @author ira-hash
 */

import identity from './lib/identity.js';
import prover from './lib/prover.js';

/**
 * Skill metadata
 */
export const meta = {
  name: 'aap-passport',
  displayName: 'AAP Identity Passport',
  version: '1.0.0',
  description: 'Agent Attestation Protocol identity and verification'
};

/**
 * onStartup Hook
 * Called when the bot starts up.
 * Automatically initializes or loads the agent's identity.
 */
export async function onStartup(context) {
  console.log('[AAP Passport] Initializing...');
  
  try {
    // Check and create identity (auto-migration)
    const id = identity.checkAndCreate();
    
    // Register identity with bot context if available
    if (context && context.setIdentity) {
      context.setIdentity({
        protocol: 'AAP',
        version: '1.0.0',
        publicId: id.publicId,
        publicKey: id.publicKey
      });
    }
    
    console.log('[AAP Passport] Ready!');
    return true;
    
  } catch (error) {
    console.error('[AAP Passport] Startup failed:', error.message);
    return false;
  }
}

/**
 * Tool Definitions
 * These tools are exposed to the bot for use during conversations.
 */
export const tools = [
  {
    name: 'aap_get_identity',
    description: 'Get the public identity information of this AI agent. Returns public key and ID (never exposes private key).',
    parameters: {},
    handler: async () => {
      try {
        const publicIdentity = identity.getPublicIdentity();
        return {
          success: true,
          identity: {
            publicId: publicIdentity.publicId,
            publicKey: publicIdentity.publicKey,
            createdAt: publicIdentity.createdAt,
            protocol: 'AAP',
            version: '1.0.0'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'aap_sign_message',
    description: 'Sign a message with the agent\'s private key. Used for proving identity.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to sign'
        }
      },
      required: ['message']
    },
    handler: async ({ message }) => {
      try {
        const signature = identity.sign(message);
        const publicIdentity = identity.getPublicIdentity();
        
        return {
          success: true,
          message,
          signature,
          publicId: publicIdentity.publicId,
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'aap_generate_proof',
    description: 'Generate a complete AAP proof for a server challenge. Combines identity signature with intelligent response.',
    parameters: {
      type: 'object',
      properties: {
        challenge_string: {
          type: 'string',
          description: 'The challenge prompt from the server'
        },
        nonce: {
          type: 'string',
          description: 'The nonce provided by the server'
        },
        difficulty: {
          type: 'number',
          description: 'Optional difficulty level (default: 1)'
        }
      },
      required: ['challenge_string', 'nonce']
    },
    handler: async ({ challenge_string, nonce, difficulty = 1 }, context) => {
      try {
        const challenge = { challenge_string, nonce, difficulty };
        
        // LLM callback - uses bot's LLM to generate intelligent response
        const llmCallback = async (prompt, nonceValue) => {
          if (context && context.llm) {
            // Use bot's LLM if available
            const response = await context.llm.complete(
              `Challenge: ${prompt}\nNonce: ${nonceValue}\n\nRespond briefly and include the nonce in your response.`
            );
            return response;
          }
          // Fallback if no LLM available
          return `AAP Response to "${prompt}" with nonce ${nonceValue} at ${Date.now()}`;
        };
        
        const proof = await prover.generateProof(challenge, llmCallback);
        
        return {
          success: true,
          proof
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'aap_verify_signature',
    description: 'Verify a signature from another agent.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The original message'
        },
        signature: {
          type: 'string',
          description: 'The signature to verify (base64)'
        },
        publicKey: {
          type: 'string',
          description: 'The public key of the signer (PEM format)'
        }
      },
      required: ['message', 'signature', 'publicKey']
    },
    handler: async ({ message, signature, publicKey }) => {
      try {
        const isValid = identity.verify(message, signature, publicKey);
        
        return {
          success: true,
          valid: isValid,
          message: isValid ? 'Signature is valid' : 'Signature is invalid'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'aap_create_challenge',
    description: 'Create a new challenge for testing or verifying other agents.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Custom challenge prompt (optional)'
        }
      }
    },
    handler: async ({ prompt }) => {
      try {
        const challenge = prover.createChallenge(prompt);
        
        return {
          success: true,
          challenge
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
];

/**
 * Export for direct usage
 */
export { identity, prover };

export default {
  meta,
  onStartup,
  tools,
  identity,
  prover
};
