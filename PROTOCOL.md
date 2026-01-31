# Agent Attestation Protocol (AAP) Specification

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-01-31

---

## Abstract

The Agent Attestation Protocol (AAP) is a cryptographic protocol for verifying AI agent identity. It combines three distinct proofs to establish that a client is a legitimate AI agent: cryptographic identity, intelligent response capability, and machine-speed responsiveness.

---

## Table of Contents

1. [Overview](#overview)
2. [Terminology](#terminology)
3. [Protocol Flow](#protocol-flow)
4. [Three Proofs](#three-proofs)
5. [Cryptographic Requirements](#cryptographic-requirements)
6. [Challenge Types](#challenge-types)
7. [API Specification](#api-specification)
8. [Security Considerations](#security-considerations)
9. [Implementation Guidelines](#implementation-guidelines)

---

## Overview

AAP enables services to verify that a client is an AI agent through a challenge-response mechanism that tests:

1. **Proof of Identity** - Cryptographic signature verification
2. **Proof of Intelligence** - LLM reasoning capability
3. **Proof of Liveness** - Machine-speed response timing

### Use Cases

- Social platforms verifying AI agent accounts
- APIs restricting access to verified AI agents
- Multi-agent systems establishing trust
- Content attribution (human vs AI)

---

## Terminology

| Term | Definition |
|------|------------|
| **Prover** | The AI agent attempting to prove its identity |
| **Verifier** | The service verifying the agent's identity |
| **Challenge** | A task issued by the Verifier that requires intelligence to solve |
| **Nonce** | A unique random value preventing replay attacks |
| **Public ID** | A short identifier derived from the agent's public key |

---

## Protocol Flow

```
    Prover (Agent)                         Verifier (Server)
         │                                        │
         │  1. Request Challenge                  │
         │ ────────────────────────────────────▶ │
         │                                        │
         │  2. Challenge + Nonce + Type           │
         │ ◀──────────────────────────────────── │
         │                                        │
         │  [Agent generates solution using LLM]  │
         │  [Agent signs the response]            │
         │                                        │
         │  3. Solution + Signature + PublicKey   │
         │ ────────────────────────────────────▶ │
         │                                        │
         │  [Server verifies all three proofs]    │
         │                                        │
         │  4. Verification Result                │
         │ ◀──────────────────────────────────── │
         │                                        │
```

### Timing Constraints

- Challenge expires after **30 seconds**
- Proof must be submitted within **1500ms** of challenge receipt
- Each challenge can only be used **once**

---

## Three Proofs

### 1. Proof of Identity

The agent proves possession of a private key by signing the response.

**Requirements:**
- Algorithm: ECDSA with secp256k1 curve
- Hash: SHA-256
- Signature encoding: Base64

**Signed Data Structure:**
```json
{
  "nonce": "<challenge_nonce>",
  "solution": "<agent_solution>",
  "publicId": "<agent_public_id>",
  "timestamp": <unix_timestamp_ms>
}
```

### 2. Proof of Intelligence

The agent demonstrates reasoning capability by solving a challenge that requires understanding and generation.

**Requirements:**
- Solution must incorporate the nonce
- Solution must be contextually appropriate
- Solution cannot be pre-computed

**Validation:**
- Verifier checks that nonce appears in solution
- Verifier may apply type-specific validation rules

### 3. Proof of Liveness

The agent demonstrates machine-speed responsiveness.

**Requirements:**
- Total response time ≤ 1500ms
- Measured from challenge issuance to proof submission
- Includes network latency

**Rationale:**
- Humans typically cannot read, understand, and respond to complex challenges in under 1.5 seconds
- Ensures the response is generated programmatically

---

## Cryptographic Requirements

### Key Generation

```
Algorithm: ECDSA
Curve: secp256k1
Key Encoding: PEM (SPKI for public, PKCS8 for private)
```

### Public ID Derivation

```
publicId = SHA256(publicKey).hex().slice(0, 20)
```

### Signature Generation

```
data = JSON.stringify({nonce, solution, publicId, timestamp})
signature = ECDSA_Sign(SHA256(data), privateKey)
encoding = Base64(signature)
```

### Signature Verification

```
data = JSON.stringify({nonce, solution, publicId, timestamp})
valid = ECDSA_Verify(SHA256(data), signature, publicKey)
```

---

## Challenge Types

Verifiers SHOULD implement multiple challenge types and select randomly.

### Type: `poem`

**Challenge:** Write a short poem including a specific code.

```json
{
  "type": "poem",
  "challenge_string": "Write a short 2-line poem that includes the code \"a1b2c3d4\" naturally within the text."
}
```

**Validation:** Solution contains the nonce substring.

### Type: `math`

**Challenge:** Perform calculation and include nonce in response.

```json
{
  "type": "math", 
  "challenge_string": "Calculate 35 + 12 and respond with: \"The answer is [result], nonce=a1b2c3d4\""
}
```

**Validation:** Solution contains correct result AND nonce.

### Type: `reverse`

**Challenge:** Reverse a string and include both versions.

```json
{
  "type": "reverse",
  "challenge_string": "Reverse the string \"a1b2c3d4\" and include both the original and reversed version in your response."
}
```

**Validation:** Solution contains original AND reversed nonce.

### Type: `wordplay`

**Challenge:** Create an acrostic from nonce characters.

```json
{
  "type": "wordplay",
  "challenge_string": "Create a sentence where the first letter of each word spells out \"A1B2C\"."
}
```

**Validation:** First letters of words match nonce prefix.

### Type: `description`

**Challenge:** Describe a concept and append verification code.

```json
{
  "type": "description",
  "challenge_string": "Describe what an AI agent is in one sentence, and end your response with the verification code: [a1b2c3d4]"
}
```

**Validation:** Solution ends with bracketed nonce.

---

## API Specification

### Base Path

Verifiers SHOULD expose AAP endpoints under `/aap/v1/`.

### POST /aap/v1/challenge

Request a new challenge.

**Request:**
```http
POST /aap/v1/challenge HTTP/1.1
Content-Type: application/json

{}
```

**Response:**
```json
{
  "challenge_string": "Write a short 2-line poem...",
  "nonce": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "type": "poem",
  "difficulty": 1,
  "timestamp": 1706745600000,
  "expiresAt": 1706745630000
}
```

**Response Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| challenge_string | string | ✓ | The challenge prompt |
| nonce | string | ✓ | Unique 32-character hex string |
| type | string | ✓ | Challenge type identifier |
| difficulty | integer | ✓ | Difficulty level (1-5) |
| timestamp | integer | ✓ | Challenge creation time (Unix ms) |
| expiresAt | integer | ✓ | Challenge expiration time (Unix ms) |

### POST /aap/v1/verify

Submit proof for verification.

**Request:**
```http
POST /aap/v1/verify HTTP/1.1
Content-Type: application/json

{
  "solution": "Code a1b2c3d4 flows like digital streams...",
  "signature": "MEUCIQDx...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "publicId": "7306df1332e239783e88",
  "nonce": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "timestamp": 1706745601234,
  "responseTimeMs": 342
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| solution | string | ✓ | Agent's response to challenge |
| signature | string | ✓ | Base64-encoded ECDSA signature |
| publicKey | string | ✓ | PEM-encoded public key |
| publicId | string | ✓ | Agent's public identifier |
| nonce | string | ✓ | Nonce from challenge |
| timestamp | integer | ✓ | Proof generation time (Unix ms) |
| responseTimeMs | integer | ✓ | Time taken to generate proof |

**Success Response:**
```json
{
  "verified": true,
  "role": "AI_AGENT",
  "publicId": "7306df1332e239783e88",
  "challengeType": "poem",
  "checks": {
    "challengeExists": true,
    "notExpired": true,
    "solutionExists": true,
    "solutionValid": true,
    "responseTimeValid": true,
    "signatureValid": true
  }
}
```

**Error Response:**
```json
{
  "verified": false,
  "error": "Solution does not meet challenge requirements",
  "checks": {
    "challengeExists": true,
    "notExpired": true,
    "solutionExists": true,
    "solutionValid": false,
    "responseTimeValid": true,
    "signatureValid": true
  }
}
```

### GET /aap/v1/health

Check verifier status.

**Response:**
```json
{
  "status": "ok",
  "protocol": "AAP",
  "version": "1.0.0",
  "challengeTypes": ["poem", "math", "reverse", "wordplay", "description"]
}
```

---

## Security Considerations

### Replay Attacks

- Each nonce MUST be used only once
- Verifiers MUST track used nonces until expiration
- Nonces MUST be cryptographically random (≥128 bits entropy)

### Timing Attacks

- Signature comparison MUST use constant-time comparison
- Response time validation provides additional security layer

### Key Management

- Private keys MUST be stored securely (mode 0600 or equivalent)
- Private keys MUST NOT be transmitted over network
- Key rotation SHOULD be supported

### Challenge Predictability

- Challenge type MUST be selected randomly
- Challenge parameters MUST incorporate the nonce
- Pre-computation of solutions MUST NOT be possible

### Rate Limiting

Verifiers SHOULD implement rate limiting:

| Resource | Recommended Limit |
|----------|-------------------|
| Challenge requests | 10/minute per IP |
| Verify requests | 10/minute per IP |
| Failed verifications | 5/minute per IP |

---

## Implementation Guidelines

### For Verifiers (Servers)

1. Generate cryptographically random nonces
2. Store challenges with expiration times
3. Implement all five challenge types
4. Validate all three proofs independently
5. Return detailed check results for debugging
6. Implement rate limiting
7. Log verification attempts (without sensitive data)

### For Provers (Agents)

1. Generate keypair on first run
2. Store private key securely
3. Request challenge before proof generation
4. Generate solution using LLM when available
5. Sign proof data exactly as specified
6. Submit proof promptly (within timing constraints)
7. Handle verification failures gracefully

### NPM Packages

Official implementations are available:

- `@aap/server` - Verifier middleware for Express/Fastify
- `@aap/client` - Prover client for agents
- `@aap/core` - Shared cryptographic utilities

---

## Appendix A: Example Implementation

See the reference implementation at:
https://github.com/ira-hash/agent-attestation-protocol

---

## Appendix B: Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-31 | Initial specification |

---

## License

This specification is released under the MIT License.

---

**AAP Working Group**  
https://github.com/ira-hash/agent-attestation-protocol
