/**
 * @aap/client - Prover
 * 
 * Generates proofs for AAP verification.
 */

import { createHash } from 'node:crypto';
import { Identity, createProofData } from '@aap/core';

/**
 * Prover class for generating AAP proofs
 */
export class Prover {
  /**
   * @param {Object} [options]
   * @param {Identity} [options.identity] - Pre-existing identity instance
   * @param {string} [options.storagePath] - Path for identity storage
   */
  constructor(options = {}) {
    this.identity = options.identity || new Identity({ storagePath: options.storagePath });
    this.identity.init();
  }

  /**
   * Get public identity info
   * @returns {Object}
   */
  getIdentity() {
    return this.identity.getPublic();
  }

  /**
   * Generate a proof for a challenge
   * 
   * @param {Object} challenge - Challenge from server
   * @param {string} challenge.challenge_string - The challenge prompt
   * @param {string} challenge.nonce - Server-provided nonce
   * @param {string} [challenge.type] - Challenge type
   * @param {Function|string} [solutionOrCallback] - Solution string or async LLM callback
   * @returns {Promise<Object>} Proof object ready for submission
   */
  async generateProof(challenge, solutionOrCallback) {
    const startTime = Date.now();
    const { challenge_string, nonce, type } = challenge;

    // Get solution
    let solution;
    if (typeof solutionOrCallback === 'function') {
      solution = await solutionOrCallback(challenge_string, nonce, type);
    } else if (typeof solutionOrCallback === 'string') {
      solution = solutionOrCallback;
    } else {
      // Use built-in solver for verifiable challenges
      solution = this.solve(challenge_string, nonce, type);
    }

    // Create proof data
    const identity = this.identity.getPublic();
    const timestamp = Date.now();
    
    const proofData = createProofData({
      nonce,
      solution,
      publicId: identity.publicId,
      timestamp
    });

    // Sign
    const signature = this.identity.sign(proofData);

    // Calculate response time
    const responseTimeMs = Date.now() - startTime;

    return {
      solution,
      signature,
      publicKey: identity.publicKey,
      publicId: identity.publicId,
      nonce,
      timestamp,
      responseTimeMs,
      protocol: 'AAP',
      version: '1.0.0'
    };
  }

  /**
   * Solve a challenge programmatically
   * @param {string} challengeString - The challenge prompt
   * @param {string} nonce - The nonce
   * @param {string} type - Challenge type
   * @returns {string} Solution
   */
  solve(challengeString, nonce, type) {
    const solvers = {
      math: () => {
        const match = challengeString.match(/\((\d+)\s*\+\s*(\d+)\)\s*\*\s*(\d+)/);
        if (match) {
          const [, a, b, c] = match.map(Number);
          return `RESULT=${(a + b) * c}`;
        }
        // Fallback for simple addition
        const simpleMatch = challengeString.match(/(\d+)\s*\+\s*(\d+)/);
        if (simpleMatch) {
          return `RESULT=${parseInt(simpleMatch[1]) + parseInt(simpleMatch[2])}`;
        }
        return 'RESULT=0';
      },

      json: () => {
        const n8 = nonce.slice(0, 8);
        const num = parseInt(nonce.slice(0, 4), 16);
        return JSON.stringify({
          nonce: n8,
          doubled: num * 2,
          reversed: n8.split('').reverse().join('')
        });
      },

      hash: () => {
        const match = challengeString.match(/SHA256\("([^"]+)"\)/);
        if (match) {
          const input = match[1];
          const hash = createHash('sha256').update(input).digest('hex').slice(0, 16);
          return `HASH=${hash}`;
        }
        return 'HASH=0000000000000000';
      },

      base64: () => {
        const match = challengeString.match(/Encode "([^"]+)" in Base64/);
        if (match) {
          const encoded = Buffer.from(match[1]).toString('base64');
          return `BASE64=${encoded}`;
        }
        return 'BASE64=';
      },

      hex: () => {
        const match = challengeString.match(/Parse "([^"]+)" as hex bytes/);
        if (match) {
          const hexPart = match[1];
          let sum = 0;
          for (let i = 0; i < hexPart.length; i += 2) {
            sum += parseInt(hexPart.slice(i, i + 2), 16);
          }
          return `SUM=${sum}`;
        }
        return 'SUM=0';
      },

      pattern: () => {
        const match = challengeString.match(/From "([^"]+)":/);
        if (match) {
          const input = match[1];
          const oddChars = input.split('').filter((_, i) => i % 2 === 1).join('');
          const evenChars = input.split('').filter((_, i) => i % 2 === 0).join('');
          return `ODD=${oddChars} EVEN=${evenChars}`;
        }
        return 'ODD= EVEN=';
      },

      bitwise: () => {
        const match = challengeString.match(/A=0x([0-9a-fA-F]+)\s*\((\d+)\)\s*and\s*B=0x([0-9a-fA-F]+)\s*\((\d+)\)/);
        if (match) {
          const a = parseInt(match[2]);
          const b = parseInt(match[4]);
          return `XOR=${a ^ b} AND=${a & b} OR=${a | b}`;
        }
        return 'XOR=0 AND=0 OR=0';
      },

      sequence: () => {
        const match = challengeString.match(/Starting with \[(\d+),\s*(\d+)\]/);
        if (match) {
          const seq = [parseInt(match[1]), parseInt(match[2])];
          for (let i = 2; i < 6; i++) {
            seq.push(seq[i-1] + seq[i-2]);
          }
          return `NEXT=${seq.slice(2).join(',')}`;
        }
        return 'NEXT=0,0,0,0';
      },

      transform: () => {
        const match = challengeString.match(/Transform "([^"]+)":/);
        if (match) {
          const input = match[1];
          const step1 = input.split('').reverse().join('');
          const step2 = step1.toUpperCase();
          const step3 = step2.match(/.{1,2}/g).join('-');
          return `OUTPUT=${step3}`;
        }
        return 'OUTPUT=';
      },

      checksum: () => {
        const match = challengeString.match(/all bytes in "([^"]+)"/);
        if (match) {
          const hexStr = match[1];
          let checksum = 0;
          for (let i = 0; i < hexStr.length && i < 16; i += 2) {
            checksum ^= parseInt(hexStr.slice(i, i + 2), 16);
          }
          return `CHECKSUM=${checksum.toString(16).padStart(2, '0')}`;
        }
        return 'CHECKSUM=00';
      }
    };

    const solver = solvers[type];
    if (solver) {
      return solver();
    }

    // Unknown type - try to extract nonce and return it
    return `UNKNOWN_TYPE:${type} NONCE=${nonce.slice(0, 8)}`;
  }

  /**
   * Sign arbitrary data with the identity
   * @param {string} data - Data to sign
   * @returns {Object} { data, signature, publicId }
   */
  sign(data) {
    return {
      data,
      signature: this.identity.sign(data),
      publicId: this.identity.getPublic().publicId,
      timestamp: Date.now()
    };
  }
}

export default { Prover };
