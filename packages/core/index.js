/**
 * @aap/core
 * 
 * Core utilities for Agent Attestation Protocol.
 * Provides cryptographic primitives and identity management.
 */

export * from './crypto.js';
export * from './identity.js';

// Re-export defaults
import crypto from './crypto.js';
import identity from './identity.js';

export { crypto, identity };

// Protocol constants
export const PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_CHALLENGE_EXPIRY_MS = 30000;
export const DEFAULT_MAX_RESPONSE_TIME_MS = 1500;
export const NONCE_BYTES = 16;

// Challenge types
export const CHALLENGE_TYPES = ['poem', 'math', 'reverse', 'wordplay', 'description'];

export default {
  ...crypto,
  ...identity,
  PROTOCOL_VERSION,
  DEFAULT_CHALLENGE_EXPIRY_MS,
  DEFAULT_MAX_RESPONSE_TIME_MS,
  NONCE_BYTES,
  CHALLENGE_TYPES
};
