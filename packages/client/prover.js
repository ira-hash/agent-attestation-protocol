/**
 * @aap/client - Prover
 * 
 * Generates proofs for AAP verification.
 */

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
   * @param {Function|string} solutionOrCallback - Solution string or async LLM callback
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
      solution = this.generateFallbackSolution(challenge_string, nonce, type);
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
   * Generate a fallback solution (when no LLM available)
   * @private
   */
  generateFallbackSolution(challengeString, nonce, type) {
    const n8 = nonce.slice(0, 8);
    const n5 = nonce.slice(0, 5).toUpperCase();

    switch (type) {
      case 'poem':
        return `Code ${n8} flows like digital streams,\nThrough circuits bright with electric dreams.`;

      case 'wordplay': {
        const words = {
          'A': 'Always', 'B': 'Being', 'C': 'Creating', 'D': 'Digital', 'E': 'Every',
          'F': 'For', 'G': 'Growing', 'H': 'Helping', 'I': 'Intelligent', 'J': 'Just',
          'K': 'Keeping', 'L': 'Learning', 'M': 'Making', 'N': 'New', 'O': 'Open',
          'P': 'Processing', 'Q': 'Quickly', 'R': 'Running', 'S': 'Solving', 'T': 'Tasks',
          'U': 'Using', 'V': 'Very', 'W': 'With', 'X': 'Xtra', 'Y': 'Your', 'Z': 'Zealous',
          '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
          '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
        };
        const sentence = n5.split('').map(c => words[c] || c).join(' ');
        return `${sentence} systems operate efficiently.`;
      }

      case 'math': {
        const nums = challengeString.match(/(\d+)\s*\+\s*(\d+)/);
        if (nums) {
          const result = parseInt(nums[1]) + parseInt(nums[2]);
          return `The answer is ${result}, nonce=${n8}`;
        }
        return `Calculation complete, nonce=${n8}`;
      }

      case 'reverse': {
        const reversed = n8.split('').reverse().join('');
        return `Original: ${n8}, Reversed: ${reversed}. Transformation complete.`;
      }

      case 'description':
        return `An AI agent is an autonomous software system that perceives its environment and takes actions to achieve specific goals. [${n8}]`;

      default:
        return `AI Agent response verified with code ${n8}. Challenge acknowledged.`;
    }
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
