/**
 * @aap/server - Challenge Generator
 * 
 * Objectively verifiable challenges only.
 * Principle: Server must be able to compute the correct answer.
 */

import { createHash } from 'node:crypto';

/**
 * Challenge type definitions
 * Each type has a generator and validator function
 */
export const CHALLENGE_TYPES = {
  /**
   * Math calculation
   * Server knows the answer, agent must compute it
   */
  math: {
    generate: (nonce) => {
      const a = parseInt(nonce.slice(0, 2), 16) % 50 + 10;
      const b = parseInt(nonce.slice(2, 4), 16) % 30 + 5;
      const c = parseInt(nonce.slice(4, 6), 16) % 10 + 1;
      const expected = (a + b) * c;
      return {
        challenge_string: `Calculate (${a} + ${b}) * ${c} and respond with exactly: RESULT=${expected_value}`,
        expected: `RESULT=${expected}`,
        validate: (solution) => solution.includes(`RESULT=${expected}`)
      };
    }
  },

  /**
   * JSON structure generation
   * Must produce valid JSON with exact structure
   */
  json: {
    generate: (nonce) => {
      const n8 = nonce.slice(0, 8);
      const num = parseInt(nonce.slice(0, 4), 16);
      const doubled = num * 2;
      const reversed = n8.split('').reverse().join('');
      
      return {
        challenge_string: `Return a JSON object with exactly these fields:
- "nonce": "${n8}"
- "doubled": ${num} * 2
- "reversed": nonce reversed
Respond with only the JSON, no other text.`,
        expected: { nonce: n8, doubled, reversed },
        validate: (solution) => {
          try {
            // Extract JSON from solution (might have extra text)
            const jsonMatch = solution.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return false;
            
            const obj = JSON.parse(jsonMatch[0]);
            return obj.nonce === n8 &&
                   obj.doubled === doubled &&
                   obj.reversed === reversed;
          } catch {
            return false;
          }
        }
      };
    }
  },

  /**
   * SHA256 hash calculation
   * Agent must compute hash of nonce + salt
   */
  hash: {
    generate: (nonce) => {
      const salt = nonce.slice(8, 16);
      const input = nonce.slice(0, 8) + salt;
      const expected = createHash('sha256').update(input).digest('hex').slice(0, 16);
      
      return {
        challenge_string: `Compute SHA256("${input}") and return the first 16 characters of the hex digest. Respond with exactly: HASH=${hash_value}`,
        expected: `HASH=${expected}`,
        validate: (solution) => solution.toUpperCase().includes(`HASH=${expected.toUpperCase()}`)
      };
    }
  },

  /**
   * Base64 encoding
   */
  base64: {
    generate: (nonce) => {
      const input = nonce.slice(0, 12);
      const expected = Buffer.from(input).toString('base64');
      
      return {
        challenge_string: `Encode "${input}" in Base64. Respond with exactly: BASE64=${encoded_value}`,
        expected: `BASE64=${expected}`,
        validate: (solution) => solution.includes(`BASE64=${expected}`)
      };
    }
  },

  /**
   * Hex encoding/decoding
   */
  hex: {
    generate: (nonce) => {
      // Take first 4 chars as hex, decode to ASCII interpretation
      const hexPart = nonce.slice(0, 8);
      const bytes = [];
      for (let i = 0; i < hexPart.length; i += 2) {
        bytes.push(parseInt(hexPart.slice(i, i + 2), 16));
      }
      const sum = bytes.reduce((a, b) => a + b, 0);
      
      return {
        challenge_string: `Parse "${hexPart}" as hex bytes (4 bytes), sum their decimal values. Respond with exactly: SUM=${sum_value}`,
        expected: `SUM=${sum}`,
        validate: (solution) => solution.includes(`SUM=${sum}`)
      };
    }
  },

  /**
   * Pattern extraction
   * Extract characters at specific positions
   */
  pattern: {
    generate: (nonce) => {
      // Extract odd-indexed characters (1, 3, 5, 7...)
      const oddChars = nonce.split('').filter((_, i) => i % 2 === 1).slice(0, 8).join('');
      // Extract even-indexed characters (0, 2, 4, 6...)
      const evenChars = nonce.split('').filter((_, i) => i % 2 === 0).slice(0, 8).join('');
      
      return {
        challenge_string: `From "${nonce.slice(0, 16)}":
1. Extract characters at ODD positions (1,3,5,7,9,11,13,15)
2. Extract characters at EVEN positions (0,2,4,6,8,10,12,14)
Respond with exactly: ODD=${odd} EVEN=${even}`,
        expected: { odd: oddChars, even: evenChars },
        validate: (solution) => {
          return solution.includes(`ODD=${oddChars}`) && 
                 solution.includes(`EVEN=${evenChars}`);
        }
      };
    }
  },

  /**
   * Bitwise operations
   */
  bitwise: {
    generate: (nonce) => {
      const a = parseInt(nonce.slice(0, 2), 16);
      const b = parseInt(nonce.slice(2, 4), 16);
      const xorResult = a ^ b;
      const andResult = a & b;
      const orResult = a | b;
      
      return {
        challenge_string: `Given A=0x${nonce.slice(0, 2)} (${a}) and B=0x${nonce.slice(2, 4)} (${b}):
Calculate XOR, AND, OR operations.
Respond with exactly: XOR=${xor} AND=${and} OR=${or}`,
        expected: { xor: xorResult, and: andResult, or: orResult },
        validate: (solution) => {
          return solution.includes(`XOR=${xorResult}`) &&
                 solution.includes(`AND=${andResult}`) &&
                 solution.includes(`OR=${orResult}`);
        }
      };
    }
  },

  /**
   * Sequence calculation (Fibonacci-like)
   */
  sequence: {
    generate: (nonce) => {
      const a = parseInt(nonce.slice(0, 2), 16) % 10 + 1;
      const b = parseInt(nonce.slice(2, 4), 16) % 10 + 1;
      // Generate 5 terms: a, b, a+b, b+(a+b), ...
      const seq = [a, b];
      for (let i = 2; i < 6; i++) {
        seq.push(seq[i-1] + seq[i-2]);
      }
      const expected = seq.slice(2).join(',');
      
      return {
        challenge_string: `Starting with [${a}, ${b}], generate the next 4 Fibonacci-like numbers (each = sum of previous two).
Respond with exactly: NEXT=${n3},${n4},${n5},${n6}`,
        expected: `NEXT=${expected}`,
        validate: (solution) => solution.includes(`NEXT=${expected}`)
      };
    }
  },

  /**
   * String transformation chain
   */
  transform: {
    generate: (nonce) => {
      const input = nonce.slice(0, 8);
      // 1. Reverse
      const step1 = input.split('').reverse().join('');
      // 2. Uppercase
      const step2 = step1.toUpperCase();
      // 3. Add dashes every 2 chars
      const step3 = step2.match(/.{1,2}/g).join('-');
      
      return {
        challenge_string: `Transform "${input}":
1. Reverse it
2. Uppercase it  
3. Add dash every 2 characters
Respond with exactly: OUTPUT=${result}`,
        expected: `OUTPUT=${step3}`,
        validate: (solution) => solution.includes(`OUTPUT=${step3}`)
      };
    }
  },

  /**
   * Checksum calculation (simple)
   */
  checksum: {
    generate: (nonce) => {
      // XOR all bytes together
      let checksum = 0;
      for (let i = 0; i < 16; i += 2) {
        checksum ^= parseInt(nonce.slice(i, i + 2), 16);
      }
      const checksumHex = checksum.toString(16).padStart(2, '0');
      
      return {
        challenge_string: `Calculate XOR checksum of all bytes in "${nonce.slice(0, 16)}" (8 bytes as hex).
XOR each byte together. Respond with exactly: CHECKSUM=${hex_value}`,
        expected: `CHECKSUM=${checksumHex}`,
        validate: (solution) => {
          return solution.toLowerCase().includes(`checksum=${checksumHex}`);
        }
      };
    }
  }
};

/**
 * Get list of available challenge types
 * @returns {string[]}
 */
export function getTypes() {
  return Object.keys(CHALLENGE_TYPES);
}

/**
 * Generate a random challenge
 * @param {string} nonce - The nonce to incorporate
 * @param {string} [type] - Specific type (random if not specified)
 * @returns {Object} { type, challenge_string, validate, expected }
 */
export function generate(nonce, type) {
  const types = getTypes();
  const selectedType = type && types.includes(type) 
    ? type 
    : types[Math.floor(Math.random() * types.length)];
  
  const generator = CHALLENGE_TYPES[selectedType];
  const result = generator.generate(nonce);
  
  return {
    type: selectedType,
    challenge_string: result.challenge_string,
    validate: result.validate,
    expected: result.expected  // For debugging, not sent to client
  };
}

/**
 * Validate a solution against a challenge
 * @param {string} type - Challenge type
 * @param {string} nonce - Original nonce
 * @param {string} solution - Agent's solution
 * @returns {boolean}
 */
export function validate(type, nonce, solution) {
  const generator = CHALLENGE_TYPES[type];
  if (!generator) {
    return false;
  }
  
  const { validate: validateFn } = generator.generate(nonce);
  return validateFn(solution);
}

export default {
  CHALLENGE_TYPES,
  getTypes,
  generate,
  validate
};
