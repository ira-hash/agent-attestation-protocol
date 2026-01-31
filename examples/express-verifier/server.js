/**
 * AAP Verifier Server Example
 * 
 * A simple Express.js server demonstrating server-side AAP verification.
 * This is the "server" side of the Agent Attestation Protocol.
 * 
 * Endpoints:
 * - POST /challenge: Generate a new challenge for an agent
 * - POST /verify: Verify an agent's proof response
 */

import express from 'express';
import { createVerify, randomBytes } from 'node:crypto';

const app = express();
app.use(express.json());

// In-memory challenge store (use Redis/DB in production)
const challenges = new Map();

// Challenge expiration time (30 seconds)
const CHALLENGE_EXPIRY_MS = 30000;

// Maximum response time for Proof of Liveness (1.5 seconds)
const MAX_RESPONSE_TIME_MS = 1500;

/**
 * Dynamic Challenge Generator
 * Creates varied challenges that require actual AI reasoning
 */
const CHALLENGE_TEMPLATES = [
  {
    type: 'poem',
    generate: (nonce) => ({
      challenge_string: `Write a short 2-line poem that includes the code "${nonce.slice(0, 8)}" naturally within the text.`,
      validation: (solution, nonce) => solution.toLowerCase().includes(nonce.slice(0, 8).toLowerCase())
    })
  },
  {
    type: 'wordplay',
    generate: (nonce) => ({
      challenge_string: `Create a sentence where the first letter of each word spells out "${nonce.slice(0, 5).toUpperCase()}".`,
      validation: (solution, nonce) => {
        const words = solution.trim().split(/\s+/);
        const firstLetters = words.map(w => w[0]?.toUpperCase()).join('');
        return firstLetters.startsWith(nonce.slice(0, 5).toUpperCase());
      }
    })
  },
  {
    type: 'math',
    generate: (nonce) => {
      const a = parseInt(nonce.slice(0, 2), 16) % 50 + 10;
      const b = parseInt(nonce.slice(2, 4), 16) % 30 + 5;
      return {
        challenge_string: `Calculate ${a} + ${b} and respond with: "The answer is [result], nonce=${nonce.slice(0, 8)}"`,
        validation: (solution, nonce) => {
          const expected = a + b;
          return solution.includes(String(expected)) && solution.toLowerCase().includes(nonce.slice(0, 8).toLowerCase());
        }
      };
    }
  },
  {
    type: 'reverse',
    generate: (nonce) => ({
      challenge_string: `Reverse the string "${nonce.slice(0, 8)}" and include both the original and reversed version in your response.`,
      validation: (solution, nonce) => {
        const original = nonce.slice(0, 8).toLowerCase();
        const reversed = original.split('').reverse().join('');
        return solution.toLowerCase().includes(original) && solution.toLowerCase().includes(reversed);
      }
    })
  },
  {
    type: 'description',
    generate: (nonce) => ({
      challenge_string: `Describe what an AI agent is in one sentence, and end your response with the verification code: [${nonce.slice(0, 8)}]`,
      validation: (solution, nonce) => solution.includes(`[${nonce.slice(0, 8)}]`)
    })
  }
];

/**
 * Generate a random challenge
 */
function generateChallenge(nonce) {
  const template = CHALLENGE_TEMPLATES[Math.floor(Math.random() * CHALLENGE_TEMPLATES.length)];
  const generated = template.generate(nonce);
  return {
    type: template.type,
    ...generated
  };
}

/**
 * POST /challenge
 * Generate a new challenge for an agent to prove their identity
 */
app.post('/challenge', (req, res) => {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now();
  
  const { type, challenge_string, validation } = generateChallenge(nonce);
  
  const challenge = {
    challenge_string,
    nonce,
    type,
    difficulty: 1,
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_MS
  };
  
  // Store challenge with validation function
  challenges.set(nonce, {
    ...challenge,
    validation,
    issuedAt: timestamp
  });
  
  // Clean up expired challenges
  cleanupExpiredChallenges();
  
  console.log(`[Challenge] Type: ${type}, Nonce: ${nonce.slice(0, 8)}...`);
  
  // Don't send validation function to client
  res.json({
    challenge_string,
    nonce,
    type,
    difficulty: challenge.difficulty,
    timestamp,
    expiresAt: challenge.expiresAt
  });
});

/**
 * POST /verify
 * Verify an agent's proof response
 */
app.post('/verify', (req, res) => {
  const { 
    solution, 
    signature, 
    publicKey, 
    publicId, 
    nonce, 
    timestamp,
    responseTimeMs 
  } = req.body;
  
  const checks = {
    challengeExists: false,
    notExpired: false,
    solutionExists: false,
    solutionValid: false,
    responseTimeValid: false,
    signatureValid: false
  };
  
  try {
    // Check 1: Challenge exists
    const originalChallenge = challenges.get(nonce);
    if (!originalChallenge) {
      return res.status(400).json({
        verified: false,
        error: 'Challenge not found or already used',
        checks
      });
    }
    checks.challengeExists = true;
    
    // Remove challenge (one-time use)
    const validation = originalChallenge.validation;
    challenges.delete(nonce);
    
    // Check 2: Challenge not expired
    if (Date.now() > originalChallenge.expiresAt) {
      return res.status(400).json({
        verified: false,
        error: 'Challenge expired',
        checks
      });
    }
    checks.notExpired = true;
    
    // Check 3: Solution exists (basic)
    if (!solution || solution.trim().length === 0) {
      return res.status(400).json({
        verified: false,
        error: 'Missing solution',
        checks
      });
    }
    checks.solutionExists = true;
    
    // Check 4: Solution is valid (Proof of Intelligence)
    if (!validation(solution, nonce)) {
      return res.status(400).json({
        verified: false,
        error: 'Solution does not meet challenge requirements (Proof of Intelligence failed)',
        checks
      });
    }
    checks.solutionValid = true;
    
    // Check 5: Response time (Proof of Liveness)
    if (responseTimeMs > MAX_RESPONSE_TIME_MS) {
      return res.status(400).json({
        verified: false,
        error: `Response too slow: ${responseTimeMs}ms > ${MAX_RESPONSE_TIME_MS}ms (Proof of Liveness failed)`,
        checks
      });
    }
    checks.responseTimeValid = true;
    
    // Check 6: Signature valid (Proof of Identity)
    const proofData = {
      nonce,
      solution,
      publicId,
      timestamp
    };
    const dataToVerify = JSON.stringify(proofData);
    
    const isSignatureValid = verifySignature(dataToVerify, signature, publicKey);
    if (!isSignatureValid) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid signature (Proof of Identity failed)',
        checks
      });
    }
    checks.signatureValid = true;
    
    // All checks passed!
    console.log(`[Verify] ✅ Agent verified! Public ID: ${publicId?.slice(0, 8)}...`);
    
    res.json({
      verified: true,
      role: 'AI_AGENT',
      publicId,
      challengeType: originalChallenge.type,
      checks
    });
    
  } catch (error) {
    console.error('[Verify] Error:', error.message);
    res.status(500).json({
      verified: false,
      error: `Verification error: ${error.message}`,
      checks
    });
  }
});

/**
 * Verify a signature using secp256k1
 */
function verifySignature(data, signature, publicKey) {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(data);
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('[Verify] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Clean up expired challenges from memory
 */
function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [nonce, challenge] of challenges.entries()) {
    if (now > challenge.expiresAt) {
      challenges.delete(nonce);
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    protocol: 'AAP',
    version: '1.0.0',
    activeChallenges: challenges.size,
    challengeTypes: CHALLENGE_TEMPLATES.map(t => t.type)
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           AAP Verifier Server v1.0.0                      ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    POST /challenge  - Get a new challenge                 ║
║    POST /verify     - Verify agent proof                  ║
║    GET  /health     - Health check                        ║
╠═══════════════════════════════════════════════════════════╣
║  Challenge Types: poem, wordplay, math, reverse, desc     ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                    ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
