/**
 * @aap/server - Challenge Generator v2.5
 * 
 * "Burst Mode with Entropy Injection"
 * - 5 challenges in 8 seconds (humans cannot pass)
 * - Salt injection prevents caching attacks
 * - Natural language instructions (requires LLM)
 * 
 * v2.5 Changes:
 * - BATCH_SIZE: 3 → 5
 * - MAX_RESPONSE_TIME_MS: 12000 → 8000
 * - Salt injection in challenges (must be echoed back)
 */

import { createHash } from 'node:crypto';

/**
 * Word pools for dynamic challenge generation
 */
const WORD_POOLS = {
  animals: ['cat', 'dog', 'rabbit', 'tiger', 'lion', 'elephant', 'giraffe', 'penguin', 'eagle', 'shark', 'wolf', 'bear', 'fox', 'deer', 'owl'],
  fruits: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'peach', 'kiwi', 'mango', 'cherry', 'lemon', 'lime', 'pear', 'plum'],
  colors: ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'black', 'white', 'brown', 'gray', 'cyan', 'magenta'],
  countries: ['Korea', 'Japan', 'USA', 'UK', 'France', 'Germany', 'Australia', 'Canada', 'Brazil', 'India', 'Italy', 'Spain', 'Mexico'],
  verbs: ['runs', 'eats', 'sleeps', 'plays', 'works', 'studies', 'travels', 'cooks', 'reads', 'writes', 'sings', 'dances'],
  adjectives: ['big', 'small', 'fast', 'slow', 'beautiful', 'cute', 'delicious', 'interesting', 'bright', 'dark']
};

/**
 * Select random items from array using nonce as seed
 */
function seededSelect(arr, nonce, count, offset = 0) {
  const seed = parseInt(nonce.slice(offset, offset + 4), 16);
  const results = [];
  const used = new Set();
  
  for (let i = 0; i < count && i < arr.length; i++) {
    let idx = (seed + i * 7) % arr.length;
    while (used.has(idx)) {
      idx = (idx + 1) % arr.length;
    }
    used.add(idx);
    results.push(arr[idx]);
  }
  return results;
}

/**
 * Generate a random number from nonce
 */
function seededNumber(nonce, offset, min, max) {
  const seed = parseInt(nonce.slice(offset, offset + 4), 16);
  return (seed % (max - min + 1)) + min;
}

/**
 * Generate salt from nonce (for entropy injection)
 * @param {string} nonce - Base nonce
 * @param {number} offset - Offset for variation
 * @returns {string} 6-character salt
 */
function generateSalt(nonce, offset = 0) {
  return nonce.slice(offset, offset + 6).toUpperCase();
}

/**
 * Challenge type definitions
 */
export const CHALLENGE_TYPES = {
  /**
   * Extract entities from natural language sentence (HARD - more distractors)
   */
  nlp_extract: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 0);
      const category = ['animals', 'fruits', 'colors'][parseInt(nonce[0], 16) % 3];
      const pool = WORD_POOLS[category];
      const targets = seededSelect(pool, nonce, 3, 0);  // 3 targets now
      const distractorPool = category === 'animals' ? 'fruits' : category === 'fruits' ? 'colors' : 'animals';
      const distractors = seededSelect(WORD_POOLS[distractorPool], nonce, 2, 8);
      const verb = seededSelect(WORD_POOLS.verbs, nonce, 1, 4)[0];
      const adj = seededSelect(WORD_POOLS.adjectives, nonce, 1, 6)[0];
      
      // Complex sentence with distractors mixed in
      const templates = [
        `The ${adj} ${targets[0]}, a ${distractors[0]}, the ${targets[1]}, and ${targets[2]} all ${verb} near the ${distractors[1]}.`,
        `I saw ${targets[0]} and ${distractors[0]} yesterday, but today only ${targets[1]}, ${targets[2]}, and a ${distractors[1]} appeared.`,
        `Between the ${distractors[0]} and ${distractors[1]}, there were ${targets[0]}, ${targets[1]}, and ${targets[2]} ${verb}ing.`
      ];
      const sentence = templates[parseInt(nonce[12], 16) % templates.length];
      
      return {
        challenge_string: `[REQ-${salt}] Extract ONLY the ${category} from this sentence (ignore other categories).
Sentence: "${sentence}"
Response format: {"salt": "${salt}", "items": ["item1", "item2", "item3"]}`,
        expected: { salt, items: targets.map(s => s.toLowerCase()).sort() },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            // Check salt
            if (obj.salt !== salt) return false;
            
            const items = (obj.items || obj.animals || obj.fruits || obj.colors || []).map(s => s.toLowerCase()).sort();
            const expected = targets.map(s => s.toLowerCase()).sort();
            return JSON.stringify(items) === JSON.stringify(expected);
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Math problem expressed in natural language (HARD)
   */
  nlp_math: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 2);
      const a = seededNumber(nonce, 0, 15, 99);
      const b = seededNumber(nonce, 2, 5, 30);
      const c = seededNumber(nonce, 4, 2, 7);
      const d = seededNumber(nonce, 6, 2, 10);
      
      const templates = [
        {
          text: `Take ${a}, subtract ${b}, multiply by ${c}, then add ${d}.`,
          answer: ((a - b) * c) + d
        },
        {
          text: `What do you get if you add ${a} to ${b}, divide the sum by ${c}, and round down?`,
          answer: Math.floor((a + b) / c)
        },
        {
          text: `Calculate: the product of ${c} and ${d}, plus the difference between ${a} and ${b}.`,
          answer: (c * d) + (a - b)
        },
        {
          text: `First double ${a}, then subtract ${b}, finally divide by ${c}.`,
          answer: (a * 2 - b) / c
        },
        {
          text: `If you have ${a} items, give away ${b}, then triple what remains. How many?`,
          answer: (a - b) * 3
        }
      ];
      
      const template = templates[parseInt(nonce[8], 16) % templates.length];
      const expected = Math.round(template.answer * 100) / 100;
      
      return {
        challenge_string: `[REQ-${salt}] ${template.text}
Response format: {"salt": "${salt}", "result": number}`,
        expected: { salt, result: expected },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            if (obj.salt !== salt) return false;
            
            const result = parseFloat(obj.result);
            return Math.abs(result - expected) < 0.01;
          } catch { return false; }
        }
      };
    }
  },

  /**
   * String transformation described in natural language
   */
  nlp_transform: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 4);
      const input = nonce.slice(8, 14);
      const transformType = parseInt(nonce[6], 16) % 4;
      
      let instruction, expected;
      
      switch (transformType) {
        case 0:
          instruction = `Reverse the string "${input}" and convert it to uppercase.`;
          expected = input.split('').reverse().join('').toUpperCase();
          break;
        case 1:
          instruction = `Extract only the digits from "${input}" and calculate their sum.`;
          expected = input.split('').filter(c => /\d/.test(c)).reduce((a, b) => a + parseInt(b), 0);
          break;
        case 2:
          instruction = `Extract only the letters from "${input}" and sort them alphabetically.`;
          expected = input.split('').filter(c => /[a-zA-Z]/.test(c)).sort().join('');
          break;
        case 3:
          instruction = `Insert a hyphen "-" between each character of "${input}".`;
          expected = input.split('').join('-');
          break;
      }
      
      return {
        challenge_string: `[REQ-${salt}] ${instruction}
Response format: {"salt": "${salt}", "output": "result"}`,
        expected: { salt, output: expected },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            if (obj.salt !== salt) return false;
            
            const output = String(obj.output);
            return output === String(expected) || output.toLowerCase() === String(expected).toLowerCase();
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Conditional logic (HARD - nested conditions)
   */
  nlp_logic: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 6);
      const a = seededNumber(nonce, 0, 10, 100);
      const b = seededNumber(nonce, 2, 10, 100);
      const c = seededNumber(nonce, 4, 10, 50);
      const threshold = seededNumber(nonce, 6, 30, 80);
      
      const templates = [
        {
          text: `Consider: A=${a}, B=${b}, C=${c}. If A is greater than B AND B is greater than C, answer "DESCENDING". If A is less than B AND B is less than C, answer "ASCENDING". Otherwise, answer "MIXED".`,
          answer: (a > b && b > c) ? "DESCENDING" : (a < b && b < c) ? "ASCENDING" : "MIXED"
        },
        {
          text: `Given ${a}, ${b}, and ${c}: If exactly two of these are even, answer "TWO". If all are even or all are odd, answer "ALL". Otherwise, answer "ONE".`,
          answer: (() => {
            const evens = [a, b, c].filter(n => n % 2 === 0).length;
            return evens === 2 ? "TWO" : (evens === 0 || evens === 3) ? "ALL" : "ONE";
          })()
        },
        {
          text: `If the average of ${a}, ${b}, and ${c} exceeds ${threshold}, respond "HIGH". Otherwise, respond "LOW".`,
          answer: ((a + b + c) / 3) > threshold ? "HIGH" : "LOW"
        },
        {
          text: `Among ${a}, ${b}, ${c}: if the largest minus the smallest is greater than ${threshold}, say "WIDE". Otherwise, say "NARROW".`,
          answer: (Math.max(a, b, c) - Math.min(a, b, c)) > threshold ? "WIDE" : "NARROW"
        },
        {
          text: `Is ${a} + ${b} greater than ${c} * 2? Answer "YES" or "NO".`,
          answer: (a + b) > (c * 2) ? "YES" : "NO"
        }
      ];
      
      const template = templates[parseInt(nonce[8], 16) % templates.length];
      
      return {
        challenge_string: `[REQ-${salt}] ${template.text}
Response format: {"salt": "${salt}", "answer": "your answer"}`,
        expected: { salt, answer: template.answer },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            if (obj.salt !== salt) return false;
            
            return obj.answer?.toUpperCase() === template.answer.toUpperCase();
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Counting task
   */
  nlp_count: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 8);
      const category = ['animals', 'fruits', 'colors'][parseInt(nonce[0], 16) % 3];
      const pool = WORD_POOLS[category];
      const count1 = seededNumber(nonce, 0, 2, 4);
      const count2 = seededNumber(nonce, 2, 1, 3);
      
      const items1 = seededSelect(pool, nonce, count1, 0);
      const items2 = seededSelect(WORD_POOLS.countries, nonce, count2, 8);
      
      // Create sentence with mixed items
      const allItems = [...items1, ...items2].sort(() => 
        parseInt(nonce.slice(10, 12), 16) % 2 - 0.5
      );
      const sentence = `I see ${allItems.join(', ')} in the picture.`;
      
      return {
        challenge_string: `[REQ-${salt}] Count only the ${category} in the following sentence.
Sentence: "${sentence}"
Response format: {"salt": "${salt}", "count": number}`,
        expected: { salt, count: count1 },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            if (obj.salt !== salt) return false;
            
            return parseInt(obj.count) === count1;
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Multi-step instruction following (HARD - 4+ steps)
   */
  nlp_multistep: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 10);
      const numbers = [
        seededNumber(nonce, 0, 2, 15),
        seededNumber(nonce, 2, 2, 15),
        seededNumber(nonce, 4, 2, 15),
        seededNumber(nonce, 6, 2, 15),
        seededNumber(nonce, 8, 2, 15)
      ];
      
      const templateType = parseInt(nonce[10], 16) % 3;
      let instructions, final;
      
      if (templateType === 0) {
        // Sum → remove max → multiply by count → add min
        const sum = numbers.reduce((a, b) => a + b, 0);
        const max = Math.max(...numbers);
        const withoutMax = sum - max;
        const timesCount = withoutMax * (numbers.length - 1);
        final = timesCount + Math.min(...numbers);
        instructions = `1. Sum all numbers in [${numbers.join(', ')}].
2. Remove the largest number from that sum.
3. Multiply the result by the count of remaining numbers.
4. Add the smallest original number to that.`;
      } else if (templateType === 1) {
        // Sort → take middle → square → subtract sum of extremes
        const sorted = [...numbers].sort((a, b) => a - b);
        const middle = sorted[Math.floor(sorted.length / 2)];
        const squared = middle * middle;
        final = squared - (sorted[0] + sorted[sorted.length - 1]);
        instructions = `1. Sort [${numbers.join(', ')}] in ascending order.
2. Take the middle value.
3. Square it.
4. Subtract the sum of the smallest and largest values.`;
      } else {
        // Evens sum - odds sum → absolute value → double
        const evensSum = numbers.filter(n => n % 2 === 0).reduce((a, b) => a + b, 0);
        const oddsSum = numbers.filter(n => n % 2 !== 0).reduce((a, b) => a + b, 0);
        final = Math.abs(evensSum - oddsSum) * 2;
        instructions = `1. From [${numbers.join(', ')}], sum all even numbers.
2. Sum all odd numbers separately.
3. Find the absolute difference between these sums.
4. Double that difference.`;
      }
      
      return {
        challenge_string: `[REQ-${salt}] Follow these steps precisely:
${instructions}
Response format: {"salt": "${salt}", "result": final_value}`,
        expected: { salt, result: final },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            if (obj.salt !== salt) return false;
            
            return parseInt(obj.result) === final;
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Pattern recognition and completion
   */
  nlp_pattern: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 12);
      const start = seededNumber(nonce, 0, 1, 10);
      const step = seededNumber(nonce, 2, 2, 5);
      const patternType = parseInt(nonce[4], 16) % 3;
      
      let sequence, next2, instruction;
      
      switch (patternType) {
        case 0: // Arithmetic
          sequence = [start, start + step, start + step * 2, start + step * 3];
          next2 = [start + step * 4, start + step * 5];
          instruction = `Find the pattern and provide the next 2 numbers: [${sequence.join(', ')}, ?, ?]`;
          break;
        case 1: // Geometric (doubling)
          sequence = [start, start * 2, start * 4, start * 8];
          next2 = [start * 16, start * 32];
          instruction = `Find the pattern and provide the next 2 numbers: [${sequence.join(', ')}, ?, ?]`;
          break;
        case 2: // Fibonacci-like
          sequence = [start, step, start + step, step + (start + step)];
          next2 = [sequence[2] + sequence[3], sequence[3] + (sequence[2] + sequence[3])];
          instruction = `Find the pattern and provide the next 2 numbers: [${sequence.join(', ')}, ?, ?]`;
          break;
      }
      
      return {
        challenge_string: `[REQ-${salt}] ${instruction}
Response format: {"salt": "${salt}", "next": [number1, number2]}`,
        expected: { salt, next: next2 },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            if (obj.salt !== salt) return false;
            
            const next = obj.next;
            return Array.isArray(next) && 
                   parseInt(next[0]) === next2[0] && 
                   parseInt(next[1]) === next2[1];
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Text analysis - find specific properties
   */
  nlp_analysis: {
    generate: (nonce) => {
      const salt = generateSalt(nonce, 14);
      const words = seededSelect([...WORD_POOLS.animals, ...WORD_POOLS.fruits], nonce, 5, 0);
      const analysisType = parseInt(nonce[8], 16) % 3;
      
      let instruction, expected;
      const wordList = words.join(', ');
      
      switch (analysisType) {
        case 0: // Longest word
          expected = words.reduce((a, b) => a.length >= b.length ? a : b);
          instruction = `Find the longest word from the following list: ${wordList}`;
          break;
        case 1: // Shortest word
          expected = words.reduce((a, b) => a.length <= b.length ? a : b);
          instruction = `Find the shortest word from the following list: ${wordList}`;
          break;
        case 2: // First alphabetically
          expected = [...words].sort()[0];
          instruction = `Find the word that comes first alphabetically from the following list: ${wordList}`;
          break;
      }
      
      return {
        challenge_string: `[REQ-${salt}] ${instruction}
Response format: {"salt": "${salt}", "answer": "word"}`,
        expected: { salt, answer: expected },
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            
            if (obj.salt !== salt) return false;
            
            return obj.answer?.toLowerCase() === expected.toLowerCase();
          } catch { return false; }
        }
      };
    }
  }
};

// ============== Protocol Constants v2.5 ==============

/**
 * Batch challenge settings (v2.5 - Burst Mode)
 */
export const BATCH_SIZE = 5;               // 5 challenges per batch (was 3)
export const MAX_RESPONSE_TIME_MS = 8000;  // 8 seconds total (was 12)
export const CHALLENGE_EXPIRY_MS = 60000;  // 60 seconds

/**
 * Get list of available challenge types
 * @returns {string[]}
 */
export function getTypes() {
  return Object.keys(CHALLENGE_TYPES);
}

/**
 * Generate a single random challenge
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
    expected: result.expected  // For debugging only
  };
}

/**
 * Generate a batch of challenges (Burst Mode)
 * @param {string} nonce - Base nonce
 * @param {number} [count=BATCH_SIZE] - Number of challenges
 * @returns {Object} { challenges: [...], validators: [...] }
 */
export function generateBatch(nonce, count = BATCH_SIZE) {
  const types = getTypes();
  const usedTypes = new Set();
  const challenges = [];
  const validators = [];
  const expected = [];
  
  for (let i = 0; i < count; i++) {
    // Use different nonce offset for each challenge
    const offsetNonce = nonce.slice(i * 2) + nonce.slice(0, i * 2);
    
    // Select different type for each challenge (ensure variety)
    let selectedType;
    let attempts = 0;
    do {
      const seed = parseInt(offsetNonce.slice(0, 4), 16);
      selectedType = types[(seed + i * 3 + attempts) % types.length];
      attempts++;
    } while (usedTypes.has(selectedType) && usedTypes.size < types.length);
    usedTypes.add(selectedType);
    
    const generator = CHALLENGE_TYPES[selectedType];
    const result = generator.generate(offsetNonce);
    
    challenges.push({
      id: i,
      type: selectedType,
      challenge_string: result.challenge_string
    });
    
    validators.push(result.validate);
    expected.push(result.expected);
  }
  
  return {
    challenges,
    validators,  // Keep on server, don't send to client
    expected     // For debugging
  };
}

/**
 * Validate batch solutions
 * @param {Array} validators - Validator functions from generateBatch
 * @param {Array} solutions - Array of solutions from client
 * @returns {Object} { passed, total, results: [{id, valid}] }
 */
export function validateBatch(validators, solutions) {
  const results = [];
  let passed = 0;
  
  for (let i = 0; i < validators.length; i++) {
    const solution = solutions[i];
    const valid = solution && validators[i](
      typeof solution === 'string' ? solution : JSON.stringify(solution)
    );
    
    results.push({ id: i, valid });
    if (valid) passed++;
  }
  
  return {
    passed,
    total: validators.length,
    allPassed: passed === validators.length,
    results
  };
}

/**
 * Validate a single solution against a challenge
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
  BATCH_SIZE,
  MAX_RESPONSE_TIME_MS,
  CHALLENGE_EXPIRY_MS,
  getTypes,
  generate,
  generateBatch,
  validateBatch,
  validate
};
