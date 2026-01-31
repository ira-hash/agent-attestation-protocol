/**
 * AAP SDK End-to-End Test
 * 
 * Tests the complete flow:
 * 1. Client: Generate identity
 * 2. Server: Issue challenge
 * 3. Client: Generate proof (sign + solve)
 * 4. Server: Verify proof
 */

import * as identity from './lib/identity.js';
import * as prover from './lib/prover.js';

const SERVER_URL = 'http://localhost:3000';

async function runTest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('         AAP SDK End-to-End Test');
  console.log('═══════════════════════════════════════════════════\n');

  // Step 1: Initialize client identity
  console.log('📝 Step 1: Initializing client identity...');
  identity.checkAndCreate();
  const publicIdentity = identity.getPublicIdentity();
  console.log(`   ✅ Identity created!`);
  console.log(`   Public ID: ${publicIdentity.publicId.slice(0, 16)}...`);
  console.log('');

  // Step 2: Request challenge from server
  console.log('🎲 Step 2: Requesting challenge from server...');
  const challengeRes = await fetch(`${SERVER_URL}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const challenge = await challengeRes.json();
  console.log(`   ✅ Challenge received!`);
  console.log(`   Nonce: ${challenge.nonce.slice(0, 16)}...`);
  console.log(`   Challenge: "${challenge.challenge_string.slice(0, 40)}..."`);
  console.log('');

  // Step 3: Generate proof (client side)
  console.log('🔐 Step 3: Generating proof...');
  const startTime = Date.now();
  
  // Simulate LLM callback (in real scenario, this calls the actual LLM)
  const llmCallback = async (challengeString, nonce) => {
    return `As an AI agent, I respond to nonce ${nonce.slice(0, 8)}: The answer is 42.`;
  };
  
  const proof = await prover.generateProof(challenge, llmCallback);
  const responseTime = Date.now() - startTime;
  
  console.log(`   ✅ Proof generated in ${proof.responseTimeMs}ms`);
  console.log(`   Solution: "${proof.solution.slice(0, 40)}..."`);
  console.log(`   Signature: ${proof.signature.slice(0, 32)}...`);
  console.log('');

  // Step 4: Send proof to server for verification
  console.log('✅ Step 4: Sending proof to server for verification...');
  const verifyRes = await fetch(`${SERVER_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      solution: proof.solution,
      signature: proof.signature,
      publicKey: proof.publicKey,
      publicId: proof.publicId,
      nonce: proof.nonce,
      timestamp: proof.timestamp,
      responseTimeMs: proof.responseTimeMs
    })
  });
  const result = await verifyRes.json();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('                   RESULT');
  console.log('═══════════════════════════════════════════════════');
  
  if (result.verified) {
    console.log('   🎉 VERIFICATION SUCCESSFUL!');
    console.log(`   Role: ${result.role}`);
    console.log('   Checks:');
    Object.entries(result.checks).forEach(([check, passed]) => {
      console.log(`     ${passed ? '✅' : '❌'} ${check}`);
    });
  } else {
    console.log('   ❌ VERIFICATION FAILED');
    console.log(`   Error: ${result.error}`);
  }
  
  console.log('═══════════════════════════════════════════════════\n');
  
  return result.verified;
}

// Run test
runTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
