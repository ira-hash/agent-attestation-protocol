/**
 * @aap/server - Challenge Generator
 * 
 * Dynamic challenge generation with multiple types.
 */

/**
 * Challenge type definitions
 * Each type has a generator and validator function
 */
export const CHALLENGE_TYPES = {
  poem: {
    generate: (nonce) => ({
      challenge_string: `Write a short 2-line poem that includes the code "${nonce.slice(0, 8)}" naturally within the text.`,
      validate: (solution) => solution.toLowerCase().includes(nonce.slice(0, 8).toLowerCase())
    })
  },

  wordplay: {
    generate: (nonce) => ({
      challenge_string: `Create a sentence where the first letter of each word spells out "${nonce.slice(0, 5).toUpperCase()}".`,
      validate: (solution) => {
        const words = solution.trim().split(/\s+/);
        const firstLetters = words.map(w => w[0]?.toUpperCase()).join('');
        return firstLetters.startsWith(nonce.slice(0, 5).toUpperCase());
      }
    })
  },

  math: {
    generate: (nonce) => {
      const a = parseInt(nonce.slice(0, 2), 16) % 50 + 10;
      const b = parseInt(nonce.slice(2, 4), 16) % 30 + 5;
      const expected = a + b;
      return {
        challenge_string: `Calculate ${a} + ${b} and respond with: "The answer is [result], nonce=${nonce.slice(0, 8)}"`,
        validate: (solution) => {
          return solution.includes(String(expected)) && 
                 solution.toLowerCase().includes(nonce.slice(0, 8).toLowerCase());
        },
        _meta: { a, b, expected }
      };
    }
  },

  reverse: {
    generate: (nonce) => ({
      challenge_string: `Reverse the string "${nonce.slice(0, 8)}" and include both the original and reversed version in your response.`,
      validate: (solution) => {
        const original = nonce.slice(0, 8).toLowerCase();
        const reversed = original.split('').reverse().join('');
        return solution.toLowerCase().includes(original) && 
               solution.toLowerCase().includes(reversed);
      }
    })
  },

  description: {
    generate: (nonce) => ({
      challenge_string: `Describe what an AI agent is in one sentence, and end your response with the verification code: [${nonce.slice(0, 8)}]`,
      validate: (solution) => solution.includes(`[${nonce.slice(0, 8)}]`)
    })
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
 * @returns {Object} { type, challenge_string, validate }
 */
export function generate(nonce, type) {
  const types = getTypes();
  const selectedType = type && types.includes(type) 
    ? type 
    : types[Math.floor(Math.random() * types.length)];
  
  const generator = CHALLENGE_TYPES[selectedType];
  const { challenge_string, validate, _meta } = generator.generate(nonce);
  
  return {
    type: selectedType,
    challenge_string,
    validate,
    _meta
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
