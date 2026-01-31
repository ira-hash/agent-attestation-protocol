/**
 * AAP v2.0 Express Verification Server
 * 
 * Batch challenge verification with natural language understanding
 */

import express from 'express';
import cors from 'cors';
import { randomBytes, createHash, createVerify } from 'node:crypto';

const app = express();
app.use(cors());
app.use(express.json());

// ============== CONFIG ==============
const PORT = process.env.PORT || 3000;
const BATCH_SIZE = 3;
const MAX_RESPONSE_TIME_MS = 12000;
const CHALLENGE_EXPIRY_MS = 60000;

// ============== WORD POOLS ==============
const WORD_POOLS = {
  animals: ['cat', 'dog', 'rabbit', 'tiger', 'lion', 'elephant', 'giraffe', 'penguin', 'eagle', 'shark'],
  fruits: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'peach', 'kiwi', 'mango', 'cherry'],
  colors: ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'black', 'white', 'brown'],
  countries: ['Korea', 'Japan', 'USA', 'UK', 'France', 'Germany', 'Australia', 'Canada', 'Brazil', 'India'],
  verbs: ['runs', 'eats', 'sleeps', 'plays', 'works', 'studies', 'travels', 'cooks']
};

function seededNumber(nonce, offset, min, max) {
  const seed = parseInt(nonce.slice(offset, offset + 4), 16);
  return (seed % (max - min + 1)) + min;
}

function seededSelect(arr, nonce, count, offset = 0) {
  const seed = parseInt(nonce.slice(offset, offset + 4), 16);
  const results = [];
  const used = new Set();
  for (let i = 0; i < count && i < arr.length; i++) {
    let idx = (seed + i * 7) % arr.length;
    while (used.has(idx)) idx = (idx + 1) % arr.length;
    used.add(idx);
    results.push(arr[idx]);
  }
  return results;
}

// ============== CHALLENGE GENERATORS ==============
const CHALLENGE_TYPES = {
  nlp_math: (nonce) => {
    const a = seededNumber(nonce, 0, 10, 50);
    const b = seededNumber(nonce, 2, 5, 20);
    const c = seededNumber(nonce, 4, 2, 5);
    const expected = (a - b) * c;
    return {
      challenge_string: `Subtract ${b} from ${a}, then multiply the result by ${c}.\nResponse format: {"result": number}`,
      validate: (sol) => {
        try {
          const m = sol.match(/\{[\s\S]*\}/);
          if (!m) return false;
          return Math.abs(JSON.parse(m[0]).result - expected) < 0.01;
        } catch { return false; }
      }
    };
  },

  nlp_extract: (nonce) => {
    const category = ['animals', 'fruits', 'colors'][parseInt(nonce[0], 16) % 3];
    const pool = WORD_POOLS[category];
    const targets = seededSelect(pool, nonce, 2, 0);
    const verb = seededSelect(WORD_POOLS.verbs, nonce, 1, 4)[0];
    const sentence = `The ${targets[0]} and ${targets[1]} ${verb} in the park.`;
    return {
      challenge_string: `Extract only the ${category} from the following sentence and respond as a JSON array.\nSentence: "${sentence}"\nResponse format: {"items": ["item1", "item2"]}`,
      validate: (sol) => {
        try {
          const m = sol.match(/\{[\s\S]*\}/);
          if (!m) return false;
          const obj = JSON.parse(m[0]);
          const items = (obj.items || []).map(s => s.toLowerCase()).sort();
          return JSON.stringify(items) === JSON.stringify(targets.map(s => s.toLowerCase()).sort());
        } catch { return false; }
      }
    };
  },

  nlp_logic: (nonce) => {
    const a = seededNumber(nonce, 0, 10, 100);
    const b = seededNumber(nonce, 2, 10, 100);
    const threshold = seededNumber(nonce, 4, 20, 80);
    const expected = Math.max(a, b) > threshold ? "YES" : "NO";
    return {
      challenge_string: `If the larger number between ${a} and ${b} is greater than ${threshold}, answer "YES". Otherwise, answer "NO".\nResponse format: {"answer": "your answer"}`,
      validate: (sol) => {
        try {
          const m = sol.match(/\{[\s\S]*\}/);
          if (!m) return false;
          return JSON.parse(m[0]).answer?.toUpperCase() === expected;
        } catch { return false; }
      }
    };
  },

  nlp_multistep: (nonce) => {
    const numbers = [
      seededNumber(nonce, 0, 1, 9),
      seededNumber(nonce, 2, 1, 9),
      seededNumber(nonce, 4, 1, 9),
      seededNumber(nonce, 6, 1, 9)
    ];
    const sum = numbers.reduce((a, b) => a + b, 0);
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const expected = sum * min - max;
    return {
      challenge_string: `Follow these instructions in order:\n1. Add all the numbers in [${numbers.join(', ')}] together.\n2. Multiply the result by the smallest number.\n3. Subtract the largest number from that result.\nResponse format: {"result": final_value}`,
      validate: (sol) => {
        try {
          const m = sol.match(/\{[\s\S]*\}/);
          if (!m) return false;
          return parseInt(JSON.parse(m[0]).result) === expected;
        } catch { return false; }
      }
    };
  },

  nlp_transform: (nonce) => {
    const input = nonce.slice(0, 6);
    const expected = input.split('').reverse().join('').toUpperCase();
    return {
      challenge_string: `Reverse the string "${input}" and convert it to uppercase.\nResponse format: {"output": "result"}`,
      validate: (sol) => {
        try {
          const m = sol.match(/\{[\s\S]*\}/);
          if (!m) return false;
          return JSON.parse(m[0]).output === expected;
        } catch { return false; }
      }
    };
  }
};

// ============== STORAGE ==============
const challenges = new Map();

function cleanup() {
  const now = Date.now();
  for (const [nonce, data] of challenges.entries()) {
    if (now > data.expiresAt) challenges.delete(nonce);
  }
}

function generateBatch(nonce) {
  const types = Object.keys(CHALLENGE_TYPES);
  const usedTypes = new Set();
  const batch = [];
  const validators = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    const offsetNonce = nonce.slice(i * 2) + nonce.slice(0, i * 2);
    let selectedType;
    do {
      const seed = parseInt(offsetNonce.slice(0, 4), 16);
      selectedType = types[(seed + i * 3) % types.length];
    } while (usedTypes.has(selectedType) && usedTypes.size < types.length);
    usedTypes.add(selectedType);

    const { challenge_string, validate } = CHALLENGE_TYPES[selectedType](offsetNonce);
    batch.push({ id: i, type: selectedType, challenge_string });
    validators.push(validate);
  }

  return { batch, validators };
}

// ============== ROUTES ==============

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    protocol: 'AAP',
    version: '2.0.0',
    mode: 'batch',
    batchSize: BATCH_SIZE,
    maxResponseTimeMs: MAX_RESPONSE_TIME_MS,
    challengeTypes: Object.keys(CHALLENGE_TYPES),
    activeChallenges: challenges.size
  });
});

app.post('/challenge', (req, res) => {
  cleanup();

  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const { batch, validators } = generateBatch(nonce);

  challenges.set(nonce, {
    validators,
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_MS
  });

  res.json({
    nonce,
    challenges: batch,
    batchSize: BATCH_SIZE,
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_MS,
    maxResponseTimeMs: MAX_RESPONSE_TIME_MS
  });
});

app.post('/verify', (req, res) => {
  const { solutions, signature, publicKey, publicId, nonce, timestamp, responseTimeMs } = req.body;

  const checks = {
    challengeExists: false,
    notExpired: false,
    solutionsExist: false,
    solutionsValid: false,
    responseTimeValid: false,
    signatureValid: false
  };

  try {
    // Check 1: Challenge exists
    const challenge = challenges.get(nonce);
    if (!challenge) {
      return res.status(400).json({ verified: false, error: 'Challenge not found', checks });
    }
    checks.challengeExists = true;
    const { validators } = challenge;
    challenges.delete(nonce);

    // Check 2: Not expired
    if (Date.now() > challenge.expiresAt) {
      return res.status(400).json({ verified: false, error: 'Challenge expired', checks });
    }
    checks.notExpired = true;

    // Check 3: Solutions exist
    if (!solutions || !Array.isArray(solutions) || solutions.length !== BATCH_SIZE) {
      return res.status(400).json({ verified: false, error: `Expected ${BATCH_SIZE} solutions`, checks });
    }
    checks.solutionsExist = true;

    // Check 4: Validate solutions
    const results = [];
    let passed = 0;
    for (let i = 0; i < BATCH_SIZE; i++) {
      const sol = typeof solutions[i] === 'string' ? solutions[i] : JSON.stringify(solutions[i]);
      const valid = validators[i](sol);
      results.push({ id: i, valid });
      if (valid) passed++;
    }

    if (passed < BATCH_SIZE) {
      return res.status(400).json({
        verified: false,
        error: `Proof of Intelligence failed: ${passed}/${BATCH_SIZE} correct`,
        checks,
        batchResult: { passed, total: BATCH_SIZE, results }
      });
    }
    checks.solutionsValid = true;

    // Check 5: Response time
    if (responseTimeMs > MAX_RESPONSE_TIME_MS) {
      return res.status(400).json({
        verified: false,
        error: `Too slow: ${responseTimeMs}ms > ${MAX_RESPONSE_TIME_MS}ms`,
        checks
      });
    }
    checks.responseTimeValid = true;

    // Check 6: Signature
    const proofData = JSON.stringify({ nonce, solution: JSON.stringify(solutions), publicId, timestamp });
    const verifier = createVerify('SHA256');
    verifier.update(proofData);
    
    if (!verifier.verify(publicKey, signature, 'base64')) {
      return res.status(400).json({ verified: false, error: 'Invalid signature', checks });
    }
    checks.signatureValid = true;

    // SUCCESS
    res.json({
      verified: true,
      role: 'AI_AGENT',
      publicId,
      batchResult: { passed, total: BATCH_SIZE, results },
      responseTimeMs,
      checks
    });

  } catch (error) {
    res.status(500).json({ verified: false, error: error.message, checks });
  }
});

// Legacy single-challenge endpoints
app.post('/challenge/single', (req, res) => {
  cleanup();
  const nonce = randomBytes(16).toString('hex');
  const types = Object.keys(CHALLENGE_TYPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const { challenge_string, validate } = CHALLENGE_TYPES[type](nonce);
  const timestamp = Date.now();

  challenges.set(nonce, {
    validate,
    type,
    mode: 'single',
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_MS
  });

  res.json({ challenge_string, nonce, type, timestamp, expiresAt: timestamp + CHALLENGE_EXPIRY_MS, mode: 'single' });
});

app.post('/verify/single', (req, res) => {
  const { solution, signature, publicKey, publicId, nonce, timestamp, responseTimeMs } = req.body;
  const challenge = challenges.get(nonce);
  
  if (!challenge || challenge.mode !== 'single') {
    return res.status(400).json({ verified: false, error: 'Single challenge not found' });
  }
  
  challenges.delete(nonce);
  
  if (Date.now() > challenge.expiresAt) {
    return res.status(400).json({ verified: false, error: 'Expired' });
  }
  
  if (!challenge.validate(solution)) {
    return res.status(400).json({ verified: false, error: 'Invalid solution' });
  }
  
  if (responseTimeMs > 10000) {
    return res.status(400).json({ verified: false, error: 'Too slow' });
  }

  const proofData = JSON.stringify({ nonce, solution, publicId, timestamp });
  const verifier = createVerify('SHA256');
  verifier.update(proofData);
  
  if (!verifier.verify(publicKey, signature, 'base64')) {
    return res.status(400).json({ verified: false, error: 'Invalid signature' });
  }

  res.json({ verified: true, role: 'AI_AGENT', publicId, challengeType: challenge.type });
});

// ============== START ==============
app.listen(PORT, () => {
  console.log(`
🛂 AAP Verification Server v2.0
================================
Port: ${PORT}
Mode: Batch (${BATCH_SIZE} challenges)
Time Limit: ${MAX_RESPONSE_TIME_MS}ms
Challenge Types: ${Object.keys(CHALLENGE_TYPES).join(', ')}

Endpoints:
  POST /challenge     → Get batch challenges
  POST /verify        → Submit batch solutions
  POST /challenge/single → Single challenge (legacy)
  POST /verify/single    → Single verify (legacy)
  GET  /health        → Health check

Ready to verify AI agents! 🤖
`);
});
