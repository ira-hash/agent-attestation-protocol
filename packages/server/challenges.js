/**
 * @aap/server - Challenge Generator v2.0
 * 
 * "Deterministic Instruction Following"
 * - Natural language instructions (requires LLM to understand)
 * - Deterministic answers (server knows the correct answer)
 * 
 * Principle: Instructions in natural language, but answers are verifiable.
 */

import { createHash } from 'node:crypto';

/**
 * Word pools for dynamic challenge generation
 */
const WORD_POOLS = {
  animals: ['고양이', '강아지', '토끼', '호랑이', '사자', '코끼리', '기린', '펭귄', '독수리', '상어'],
  fruits: ['사과', '바나나', '오렌지', '포도', '딸기', '수박', '참외', '복숭아', '키위', '망고'],
  colors: ['빨강', '파랑', '노랑', '초록', '보라', '주황', '분홍', '검정', '하양', '갈색'],
  countries: ['한국', '일본', '미국', '영국', '프랑스', '독일', '호주', '캐나다', '브라질', '인도'],
  verbs: ['달린다', '먹는다', '잔다', '논다', '일한다', '공부한다', '여행한다', '요리한다'],
  adjectives: ['큰', '작은', '빠른', '느린', '예쁜', '귀여운', '맛있는', '재미있는']
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
 * Challenge type definitions
 */
export const CHALLENGE_TYPES = {
  /**
   * Extract entities from natural language sentence
   */
  nlp_extract: {
    generate: (nonce) => {
      const category = ['animals', 'fruits', 'colors'][parseInt(nonce[0], 16) % 3];
      const pool = WORD_POOLS[category];
      const targets = seededSelect(pool, nonce, 2, 0);
      const distractors = seededSelect(WORD_POOLS.verbs, nonce, 1, 4);
      
      const categoryName = {
        animals: '동물',
        fruits: '과일', 
        colors: '색깔'
      }[category];

      const sentence = `${targets[0]}와 ${targets[1]}이 ${distractors[0]}`;
      
      return {
        challenge_string: `다음 문장에서 ${categoryName} 이름만 추출해서 JSON 배열로 답하세요.
문장: "${sentence}"
응답 형식: {"items": ["항목1", "항목2"]}`,
        expected: targets.sort(),
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            const items = (obj.items || obj.animals || obj.fruits || obj.colors || []).sort();
            return JSON.stringify(items) === JSON.stringify(targets.sort());
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Math problem expressed in natural language
   */
  nlp_math: {
    generate: (nonce) => {
      const a = seededNumber(nonce, 0, 10, 50);
      const b = seededNumber(nonce, 2, 5, 20);
      const c = seededNumber(nonce, 4, 2, 5);
      
      const templates = [
        {
          text: `${a}에서 ${b}를 빼고, 그 결과에 ${c}를 곱한 값을 구하세요.`,
          answer: (a - b) * c
        },
        {
          text: `${a}와 ${b}를 더한 다음, ${c}로 나눈 값을 구하세요.`,
          answer: (a + b) / c
        },
        {
          text: `${a}를 ${c}로 나누고, 거기에 ${b}를 더한 값을 구하세요.`,
          answer: a / c + b
        }
      ];
      
      const template = templates[parseInt(nonce[6], 16) % templates.length];
      const expected = Math.round(template.answer * 100) / 100; // 소수점 2자리
      
      return {
        challenge_string: `${template.text}
응답 형식: {"result": 숫자}`,
        expected,
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
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
      const input = nonce.slice(0, 6);
      const transformType = parseInt(nonce[6], 16) % 4;
      
      let instruction, expected;
      
      switch (transformType) {
        case 0:
          instruction = `문자열 "${input}"을 거꾸로 뒤집고, 모두 대문자로 바꾸세요.`;
          expected = input.split('').reverse().join('').toUpperCase();
          break;
        case 1:
          instruction = `문자열 "${input}"에서 숫자만 추출하고, 그 숫자들의 합을 구하세요.`;
          expected = input.split('').filter(c => /\d/.test(c)).reduce((a, b) => a + parseInt(b), 0);
          break;
        case 2:
          instruction = `문자열 "${input}"에서 알파벳만 추출하고, 알파벳 순서로 정렬하세요.`;
          expected = input.split('').filter(c => /[a-zA-Z]/.test(c)).sort().join('');
          break;
        case 3:
          instruction = `문자열 "${input}"의 각 문자 사이에 "-"를 넣으세요.`;
          expected = input.split('').join('-');
          break;
      }
      
      return {
        challenge_string: `${instruction}
응답 형식: {"output": "결과값"}`,
        expected,
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            const output = String(obj.output);
            return output === String(expected) || output.toLowerCase() === String(expected).toLowerCase();
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Conditional logic
   */
  nlp_logic: {
    generate: (nonce) => {
      const a = seededNumber(nonce, 0, 10, 100);
      const b = seededNumber(nonce, 2, 10, 100);
      const threshold = seededNumber(nonce, 4, 20, 80);
      
      const templates = [
        {
          text: `${a}와 ${b} 중 더 큰 수가 ${threshold}보다 크면 "YES", 아니면 "NO"라고 답하세요.`,
          answer: Math.max(a, b) > threshold ? "YES" : "NO"
        },
        {
          text: `${a}와 ${b}의 합이 ${threshold * 2}보다 작으면 "SMALL", 아니면 "LARGE"라고 답하세요.`,
          answer: (a + b) < (threshold * 2) ? "SMALL" : "LARGE"
        },
        {
          text: `${a}가 짝수이고 ${b}가 홀수이면 "MIXED", 아니면 "SAME"이라고 답하세요.`,
          answer: (a % 2 === 0 && b % 2 === 1) ? "MIXED" : "SAME"
        }
      ];
      
      const template = templates[parseInt(nonce[6], 16) % templates.length];
      
      return {
        challenge_string: `${template.text}
응답 형식: {"answer": "답"}`,
        expected: template.answer,
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
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
      const category = ['animals', 'fruits', 'colors'][parseInt(nonce[0], 16) % 3];
      const pool = WORD_POOLS[category];
      const count1 = seededNumber(nonce, 0, 2, 4);
      const count2 = seededNumber(nonce, 2, 1, 3);
      
      const items1 = seededSelect(pool, nonce, count1, 0);
      const items2 = seededSelect(WORD_POOLS.countries, nonce, count2, 8);
      
      const categoryName = {
        animals: '동물',
        fruits: '과일',
        colors: '색깔'
      }[category];
      
      // Create sentence with repetitions
      const allItems = [...items1, ...items2].sort(() => 
        parseInt(nonce.slice(10, 12), 16) % 2 - 0.5
      );
      const sentence = allItems.join(', ') + '이 있습니다.';
      
      return {
        challenge_string: `다음 문장에서 ${categoryName}의 개수를 세세요.
문장: "${sentence}"
응답 형식: {"count": 숫자}`,
        expected: count1,
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            return parseInt(obj.count) === count1;
          } catch { return false; }
        }
      };
    }
  },

  /**
   * Multi-step instruction following
   */
  nlp_multistep: {
    generate: (nonce) => {
      const numbers = [
        seededNumber(nonce, 0, 1, 9),
        seededNumber(nonce, 2, 1, 9),
        seededNumber(nonce, 4, 1, 9),
        seededNumber(nonce, 6, 1, 9)
      ];
      
      // Step 1: Sum all
      const sum = numbers.reduce((a, b) => a + b, 0);
      // Step 2: Multiply by smallest
      const min = Math.min(...numbers);
      const step2 = sum * min;
      // Step 3: Subtract largest
      const max = Math.max(...numbers);
      const final = step2 - max;
      
      return {
        challenge_string: `다음 지시를 순서대로 따르세요:
1. 숫자 [${numbers.join(', ')}]를 모두 더하세요.
2. 그 결과에 가장 작은 수를 곱하세요.
3. 거기서 가장 큰 수를 빼세요.
응답 형식: {"result": 최종값}`,
        expected: final,
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
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
      const start = seededNumber(nonce, 0, 1, 10);
      const step = seededNumber(nonce, 2, 2, 5);
      const patternType = parseInt(nonce[4], 16) % 3;
      
      let sequence, next2, instruction;
      
      switch (patternType) {
        case 0: // Arithmetic
          sequence = [start, start + step, start + step * 2, start + step * 3];
          next2 = [start + step * 4, start + step * 5];
          instruction = `다음 수열의 규칙을 파악하고, 다음 2개 숫자를 구하세요: [${sequence.join(', ')}, ?, ?]`;
          break;
        case 1: // Geometric-ish (doubling)
          sequence = [start, start * 2, start * 4, start * 8];
          next2 = [start * 16, start * 32];
          instruction = `다음 수열의 규칙을 파악하고, 다음 2개 숫자를 구하세요: [${sequence.join(', ')}, ?, ?]`;
          break;
        case 2: // Fibonacci-like
          sequence = [start, step, start + step, step + (start + step)];
          next2 = [sequence[2] + sequence[3], sequence[3] + (sequence[2] + sequence[3])];
          instruction = `다음 수열의 규칙을 파악하고, 다음 2개 숫자를 구하세요: [${sequence.join(', ')}, ?, ?]`;
          break;
      }
      
      return {
        challenge_string: `${instruction}
응답 형식: {"next": [숫자1, 숫자2]}`,
        expected: next2,
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
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
      const words = seededSelect([...WORD_POOLS.animals, ...WORD_POOLS.fruits], nonce, 5, 0);
      const analysisType = parseInt(nonce[8], 16) % 3;
      
      let instruction, expected;
      const sentence = words.join(', ');
      
      switch (analysisType) {
        case 0: // Longest word
          expected = words.reduce((a, b) => a.length >= b.length ? a : b);
          instruction = `다음 단어들 중 가장 긴 단어를 찾으세요: ${sentence}`;
          break;
        case 1: // Shortest word
          expected = words.reduce((a, b) => a.length <= b.length ? a : b);
          instruction = `다음 단어들 중 가장 짧은 단어를 찾으세요: ${sentence}`;
          break;
        case 2: // First alphabetically (Korean)
          expected = [...words].sort()[0];
          instruction = `다음 단어들을 가나다순으로 정렬했을 때 첫 번째 단어를 찾으세요: ${sentence}`;
          break;
      }
      
      return {
        challenge_string: `${instruction}
응답 형식: {"answer": "단어"}`,
        expected,
        validate: (solution) => {
          try {
            const match = solution.match(/\{[\s\S]*\}/);
            if (!match) return false;
            const obj = JSON.parse(match[0]);
            return obj.answer === expected;
          } catch { return false; }
        }
      };
    }
  }
};

// ============== Protocol Constants ==============

/**
 * Updated timing for LLM-based challenges
 */
export const MAX_RESPONSE_TIME_MS = 10000; // 10 seconds (LLM needs time)
export const CHALLENGE_EXPIRY_MS = 60000;  // 60 seconds

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
    expected: result.expected  // For debugging only
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
  MAX_RESPONSE_TIME_MS,
  CHALLENGE_EXPIRY_MS,
  getTypes,
  generate,
  validate
};
