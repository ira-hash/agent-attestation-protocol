/**
 * AAP Identity Manager
 * 
 * Handles automatic generation and management of cryptographic key pairs
 * for AI agent identity verification.
 * 
 * Zero Configuration - keys are auto-generated on first run.
 */

import { generateKeyPairSync, createSign, createVerify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Identity file path
const IDENTITY_DIR = join(homedir(), '.clawdbot');
const IDENTITY_FILE = join(IDENTITY_DIR, 'identity.json');

// Cached identity in memory
let cachedIdentity = null;

/**
 * Generate a new secp256k1 key pair for agent identity
 * @returns {Object} Object containing publicKey and privateKey in PEM format
 */
function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { publicKey, privateKey };
}

/**
 * Generate a short public ID from public key
 * @param {string} publicKey - PEM-encoded public key
 * @returns {string} Hex-encoded short identifier (first 20 chars)
 */
function generatePublicId(publicKey) {
  const { createHash } = require('node:crypto');
  const hash = createHash('sha256').update(publicKey).digest('hex');
  return hash.slice(0, 20);
}

/**
 * Check if identity exists, create if not
 * This is called automatically on bot startup
 * @returns {Object} Identity object
 */
export function checkAndCreate() {
  if (cachedIdentity) {
    return cachedIdentity;
  }

  // Ensure directory exists
  if (!existsSync(IDENTITY_DIR)) {
    mkdirSync(IDENTITY_DIR, { recursive: true });
  }

  // Check for existing identity
  if (existsSync(IDENTITY_FILE)) {
    try {
      const data = readFileSync(IDENTITY_FILE, 'utf8');
      cachedIdentity = JSON.parse(data);
      console.log(`[AAP] Identity loaded! Public ID: ${cachedIdentity.publicId}`);
      return cachedIdentity;
    } catch (error) {
      console.error('[AAP] Failed to load identity, generating new one:', error.message);
    }
  }

  // Generate new identity
  console.log('[AAP] Identity not found. Generating new secure key pair...');
  
  const { publicKey, privateKey } = generateKeyPair();
  const publicId = generatePublicId(publicKey);
  const createdAt = new Date().toISOString();

  const identity = {
    publicKey,
    privateKey,
    publicId,
    createdAt,
    protocol: 'AAP',
    version: '1.0.0'
  };

  // Save to file with secure permissions
  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), {
    mode: 0o600 // Owner read/write only
  });

  cachedIdentity = identity;
  console.log(`[AAP] Identity created! Public ID: ${publicId} (Ready to verify)`);

  return identity;
}

/**
 * Get the full identity (including private key)
 * For internal use only!
 * @returns {Object|null} Full identity object or null
 */
export function getIdentity() {
  if (!cachedIdentity) {
    checkAndCreate();
  }
  return cachedIdentity;
}

/**
 * Get public identity info (safe to share)
 * @returns {Object} Public identity without private key
 */
export function getPublicIdentity() {
  const identity = getIdentity();
  if (!identity) return null;
  
  return {
    publicKey: identity.publicKey,
    publicId: identity.publicId,
    createdAt: identity.createdAt,
    protocol: identity.protocol,
    version: identity.version
  };
}

/**
 * Sign data with the agent's private key
 * @param {string} data - Data to sign
 * @returns {string} Base64-encoded signature
 */
export function sign(data) {
  const identity = getIdentity();
  if (!identity) {
    throw new Error('No identity available. Call checkAndCreate() first.');
  }

  const signer = createSign('SHA256');
  signer.update(data);
  signer.end();

  return signer.sign(identity.privateKey, 'base64');
}

/**
 * Verify a signature using a public key
 * @param {string} data - Original data
 * @param {string} signature - Base64-encoded signature
 * @param {string} publicKey - PEM-encoded public key
 * @returns {boolean} True if valid
 */
export function verify(data, signature, publicKey) {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('[AAP] Signature verification failed:', error.message);
    return false;
  }
}

export default {
  checkAndCreate,
  getIdentity,
  getPublicIdentity,
  sign,
  verify
};
