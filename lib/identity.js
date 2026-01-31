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
 * Extract short public ID from public key (first 20 hex chars)
 * @param {string} publicKeyPem - Public key in PEM format
 * @returns {string} Short public ID
 */
function getPublicId(publicKeyPem) {
  // Remove PEM headers and decode
  const base64 = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\n/g, '');
  
  const buffer = Buffer.from(base64, 'base64');
  return buffer.slice(-32).toString('hex').slice(0, 20);
}

/**
 * Check if identity exists, create if not
 * Auto-migration: seamlessly creates identity on first run
 * 
 * @returns {Object} Identity object with publicKey, privateKey, publicId, createdAt
 */
export function checkAndCreate() {
  // Return cached identity if available
  if (cachedIdentity) {
    return cachedIdentity;
  }

  try {
    // Ensure directory exists
    if (!existsSync(IDENTITY_DIR)) {
      mkdirSync(IDENTITY_DIR, { recursive: true });
    }

    // Check if identity file exists
    if (existsSync(IDENTITY_FILE)) {
      // Load existing identity
      const data = readFileSync(IDENTITY_FILE, 'utf-8');
      cachedIdentity = JSON.parse(data);
      console.log(`[AAP] Identity loaded! Public ID: ${cachedIdentity.publicId}`);
      return cachedIdentity;
    }

    // Generate new identity
    console.log('[AAP] Identity not found. Generating new secure key pair...');
    
    const { publicKey, privateKey } = generateKeyPair();
    const publicId = getPublicId(publicKey);
    const createdAt = new Date().toISOString();

    const identity = {
      version: '1.0.0',
      publicKey,
      privateKey,
      publicId,
      createdAt
    };

    // Save to file
    writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), {
      mode: 0o600 // Read/write for owner only (secure)
    });

    cachedIdentity = identity;
    console.log(`[AAP] Identity created! Public ID: ${publicId} (Ready to verify)`);
    
    return cachedIdentity;

  } catch (error) {
    console.error('[AAP] Failed to initialize identity:', error.message);
    throw new Error(`AAP Identity initialization failed: ${error.message}`);
  }
}

/**
 * Get the current identity (must call checkAndCreate first)
 * @returns {Object|null} Cached identity or null
 */
export function getIdentity() {
  return cachedIdentity;
}

/**
 * Get only the public parts of identity (safe to share)
 * @returns {Object} Public identity info
 */
export function getPublicIdentity() {
  if (!cachedIdentity) {
    checkAndCreate();
  }
  
  return {
    publicKey: cachedIdentity.publicKey,
    publicId: cachedIdentity.publicId,
    createdAt: cachedIdentity.createdAt
  };
}

/**
 * Sign data with the agent's private key
 * @param {string|Buffer} data - Data to sign
 * @returns {string} Base64-encoded signature
 */
export function sign(data) {
  if (!cachedIdentity) {
    checkAndCreate();
  }

  const signer = createSign('SHA256');
  signer.update(typeof data === 'string' ? data : data.toString());
  signer.end();

  return signer.sign(cachedIdentity.privateKey, 'base64');
}

/**
 * Verify a signature against public key
 * @param {string|Buffer} data - Original data
 * @param {string} signature - Base64-encoded signature
 * @param {string} publicKey - Public key in PEM format
 * @returns {boolean} True if signature is valid
 */
export function verify(data, signature, publicKey) {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(typeof data === 'string' ? data : data.toString());
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
