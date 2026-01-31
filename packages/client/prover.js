/**
 * @aap/client - Prover
 * 
 * Generates proofs for AAP verification (supports batch challenges).
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
   * Generate proofs for a batch of challenges
   * 
   * @param {Object} challengeBatch - Batch challenge from server
   * @param {string} challengeBatch.nonce - Server-provided nonce
   * @param {Array} challengeBatch.challenges - Array of challenges
   * @param {Function|null} [llmCallback] - Async LLM callback for solving
   * @returns {Promise<Object>} Proof object ready for submission
   */
  async generateBatchProof(challengeBatch, llmCallback) {
    const startTime = Date.now();
    const { nonce, challenges } = challengeBatch;

    // Solve all challenges
    const solutions = [];
    
    if (llmCallback) {
      // Use LLM to solve all at once (more efficient)
      const combinedPrompt = this.createBatchPrompt(challenges);
      const llmResponse = await llmCallback(combinedPrompt);
      const parsedSolutions = this.parseBatchResponse(llmResponse, challenges.length);
      solutions.push(...parsedSolutions);
    } else {
      // Use built-in solvers
      for (const challenge of challenges) {
        const solution = this.solve(challenge.challenge_string, nonce, challenge.type);
        solutions.push(solution);
      }
    }

    // Create proof
    const identity = this.identity.getPublic();
    const timestamp = Date.now();
    
    const solutionsString = JSON.stringify(solutions);
    const proofData = createProofData({
      nonce,
      solution: solutionsString,
      publicId: identity.publicId,
      timestamp
    });

    const signature = this.identity.sign(proofData);
    const responseTimeMs = Date.now() - startTime;

    return {
      solutions,
      signature,
      publicKey: identity.publicKey,
      publicId: identity.publicId,
      nonce,
      timestamp,
      responseTimeMs,
      protocol: 'AAP',
      version: '2.0.0'
    };
  }

  /**
   * Create a combined prompt for batch solving
   * @private
   */
  createBatchPrompt(challenges) {
    let prompt = `Solve all of the following challenges. Respond with a JSON array of solutions.\n\n`;
    
    challenges.forEach((c, i) => {
      prompt += `Challenge ${i + 1} (${c.type}):\n${c.challenge_string}\n\n`;
    });
    
    prompt += `\nRespond with ONLY a JSON array like: [{"result": ...}, {"items": [...]}, {"answer": "..."}]`;
    
    return prompt;
  }

  /**
   * Parse LLM response into solutions array
   * @private
   */
  parseBatchResponse(response, expectedCount) {
    try {
      // Try to find JSON array in response
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length === expectedCount) {
          return parsed.map(s => typeof s === 'string' ? s : JSON.stringify(s));
        }
      }
    } catch (e) {
      // Fall through to fallback
    }
    
    // Fallback: try to extract individual JSON objects
    const solutions = [];
    const jsonMatches = response.matchAll(/\{[^{}]*\}/g);
    for (const match of jsonMatches) {
      solutions.push(match[0]);
      if (solutions.length >= expectedCount) break;
    }
    
    // Pad with empty if needed
    while (solutions.length < expectedCount) {
      solutions.push('{}');
    }
    
    return solutions;
  }

  /**
   * Generate a proof for a single challenge (legacy)
   */
  async generateProof(challenge, solutionOrCallback) {
    const startTime = Date.now();
    const { challenge_string, nonce, type } = challenge;

    let solution;
    if (typeof solutionOrCallback === 'function') {
      solution = await solutionOrCallback(challenge_string, nonce, type);
    } else if (typeof solutionOrCallback === 'string') {
      solution = solutionOrCallback;
    } else {
      solution = this.solve(challenge_string, nonce, type);
    }

    const identity = this.identity.getPublic();
    const timestamp = Date.now();
    
    const proofData = createProofData({
      nonce,
      solution,
      publicId: identity.publicId,
      timestamp
    });

    const signature = this.identity.sign(proofData);
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
      version: '2.0.0'
    };
  }

  /**
   * Solve a challenge programmatically
   */
  solve(challengeString, nonce, type) {
    const solvers = {
      nlp_math: () => {
        // "Subtract B from A, then multiply by C"
        let match = challengeString.match(/Subtract (\d+) from (\d+), then multiply.*?(\d+)/i);
        if (match) {
          const result = (parseInt(match[2]) - parseInt(match[1])) * parseInt(match[3]);
          return JSON.stringify({ result });
        }
        // "Add A and B together, then divide by C"
        match = challengeString.match(/Add (\d+) and (\d+).*?divide by (\d+)/i);
        if (match) {
          const result = Math.round(((parseInt(match[1]) + parseInt(match[2])) / parseInt(match[3])) * 100) / 100;
          return JSON.stringify({ result });
        }
        // "Divide A by C, then add B"
        match = challengeString.match(/Divide (\d+) by (\d+), then add (\d+)/i);
        if (match) {
          const result = Math.round((parseInt(match[1]) / parseInt(match[2]) + parseInt(match[3])) * 100) / 100;
          return JSON.stringify({ result });
        }
        return JSON.stringify({ result: 0 });
      },

      nlp_extract: () => {
        // Extract items from quoted sentence
        const sentenceMatch = challengeString.match(/Sentence: "([^"]+)"/);
        if (!sentenceMatch) return JSON.stringify({ items: [] });
        
        const sentence = sentenceMatch[1].toLowerCase();
        
        const animals = ['cat', 'dog', 'rabbit', 'tiger', 'lion', 'elephant', 'giraffe', 'penguin', 'eagle', 'shark'];
        const fruits = ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'peach', 'kiwi', 'mango', 'cherry'];
        const colors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'black', 'white', 'brown'];
        
        let pool = animals;
        if (challengeString.toLowerCase().includes('fruit')) pool = fruits;
        if (challengeString.toLowerCase().includes('color')) pool = colors;
        
        const found = pool.filter(item => sentence.includes(item.toLowerCase()));
        return JSON.stringify({ items: found });
      },

      nlp_transform: () => {
        const inputMatch = challengeString.match(/"([^"]+)"/);
        if (!inputMatch) return JSON.stringify({ output: '' });
        const input = inputMatch[1];
        
        if (challengeString.toLowerCase().includes('reverse') && challengeString.toLowerCase().includes('uppercase')) {
          return JSON.stringify({ output: input.split('').reverse().join('').toUpperCase() });
        }
        if (challengeString.toLowerCase().includes('digits') && challengeString.toLowerCase().includes('sum')) {
          const sum = input.split('').filter(c => /\d/.test(c)).reduce((a, b) => a + parseInt(b), 0);
          return JSON.stringify({ output: sum });
        }
        if (challengeString.toLowerCase().includes('letters') && challengeString.toLowerCase().includes('sort')) {
          const sorted = input.split('').filter(c => /[a-zA-Z]/.test(c)).sort().join('');
          return JSON.stringify({ output: sorted });
        }
        if (challengeString.toLowerCase().includes('hyphen')) {
          return JSON.stringify({ output: input.split('').join('-') });
        }
        return JSON.stringify({ output: input });
      },

      nlp_logic: () => {
        // "If the larger number between A and B is greater than C"
        let match = challengeString.match(/larger.*?between (\d+) and (\d+).*?greater than (\d+).*?"(\w+)".*?"(\w+)"/i);
        if (match) {
          const answer = Math.max(parseInt(match[1]), parseInt(match[2])) > parseInt(match[3]) ? match[4] : match[5];
          return JSON.stringify({ answer });
        }
        // "If the sum of A and B is less than C"
        match = challengeString.match(/sum of (\d+) and (\d+).*?less than (\d+).*?"(\w+)".*?"(\w+)"/i);
        if (match) {
          const answer = (parseInt(match[1]) + parseInt(match[2])) < parseInt(match[3]) ? match[4] : match[5];
          return JSON.stringify({ answer });
        }
        // "If A is even and B is odd"
        match = challengeString.match(/If (\d+) is even and (\d+) is odd.*?"(\w+)".*?"(\w+)"/i);
        if (match) {
          const answer = (parseInt(match[1]) % 2 === 0 && parseInt(match[2]) % 2 === 1) ? match[3] : match[4];
          return JSON.stringify({ answer });
        }
        return JSON.stringify({ answer: "NO" });
      },

      nlp_count: () => {
        const sentenceMatch = challengeString.match(/Sentence: "([^"]+)"/);
        if (!sentenceMatch) return JSON.stringify({ count: 0 });
        
        const sentence = sentenceMatch[1].toLowerCase();
        
        const animals = ['cat', 'dog', 'rabbit', 'tiger', 'lion', 'elephant', 'giraffe', 'penguin', 'eagle', 'shark'];
        const fruits = ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'peach', 'kiwi', 'mango', 'cherry'];
        const colors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'black', 'white', 'brown'];
        
        let pool = animals;
        if (challengeString.toLowerCase().includes('fruit')) pool = fruits;
        if (challengeString.toLowerCase().includes('color')) pool = colors;
        
        const count = pool.filter(item => sentence.includes(item.toLowerCase())).length;
        return JSON.stringify({ count });
      },

      nlp_multistep: () => {
        const numbersMatch = challengeString.match(/\[([^\]]+)\]/);
        if (!numbersMatch) return JSON.stringify({ result: 0 });
        
        const numbers = numbersMatch[1].split(',').map(n => parseInt(n.trim()));
        const sum = numbers.reduce((a, b) => a + b, 0);
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const result = sum * min - max;
        
        return JSON.stringify({ result });
      },

      nlp_pattern: () => {
        const match = challengeString.match(/\[([^\]]+)\]/);
        if (!match) return JSON.stringify({ next: [0, 0] });
        
        const nums = match[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        if (nums.length < 2) return JSON.stringify({ next: [0, 0] });
        
        // Try arithmetic
        const diff = nums[1] - nums[0];
        const isArithmetic = nums.every((n, i) => i === 0 || n - nums[i-1] === diff);
        if (isArithmetic) {
          const last = nums[nums.length - 1];
          return JSON.stringify({ next: [last + diff, last + diff * 2] });
        }
        
        // Try geometric (doubling)
        const ratio = nums[1] / nums[0];
        const isGeometric = nums.every((n, i) => i === 0 || n / nums[i-1] === ratio);
        if (isGeometric && ratio === 2) {
          const last = nums[nums.length - 1];
          return JSON.stringify({ next: [last * 2, last * 4] });
        }
        
        // Try Fibonacci-like
        const isFib = nums.length >= 3 && nums.slice(2).every((n, i) => n === nums[i] + nums[i+1]);
        if (isFib) {
          const n1 = nums[nums.length - 2] + nums[nums.length - 1];
          const n2 = nums[nums.length - 1] + n1;
          return JSON.stringify({ next: [n1, n2] });
        }
        
        return JSON.stringify({ next: [0, 0] });
      },

      nlp_analysis: () => {
        const listMatch = challengeString.match(/list: ([^\.]+)/i);
        if (!listMatch) return JSON.stringify({ answer: '' });
        
        const words = listMatch[1].split(',').map(w => w.trim().toLowerCase());
        
        if (challengeString.toLowerCase().includes('longest')) {
          const longest = words.reduce((a, b) => a.length >= b.length ? a : b);
          return JSON.stringify({ answer: longest });
        }
        if (challengeString.toLowerCase().includes('shortest')) {
          const shortest = words.reduce((a, b) => a.length <= b.length ? a : b);
          return JSON.stringify({ answer: shortest });
        }
        if (challengeString.toLowerCase().includes('alphabetically')) {
          const first = [...words].sort()[0];
          return JSON.stringify({ answer: first });
        }
        
        return JSON.stringify({ answer: words[0] || '' });
      }
    };

    const solver = solvers[type];
    if (solver) {
      return solver();
    }

    return JSON.stringify({ error: `Unknown type: ${type}` });
  }

  /**
   * Sign arbitrary data
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
