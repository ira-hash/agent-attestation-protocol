# AAP Passport 🛂

**Agent Attestation Protocol (AAP)** identity and verification skill for Moltbot/Clawdbot.

> "Digital ID for AI Agents" - Cryptographically verifiable AI identity proof

## Overview

AAP Passport enables AI agents to prove their identity through cryptographic verification.

**Three Proof Elements:**
1. **Proof of Identity** - PKI-based digital signature
2. **Proof of Intelligence** - LLM reasoning response
3. **Proof of Liveness** - Machine-speed response (< 1.5s)

## Repository Structure

```
agent-attestation-protocol/
├── manifest.json          # (Skill) Bot metadata
├── index.js               # (Skill) Main entry point
├── lib/                   # (Skill) Core libraries
│   ├── identity.js        #   - Key generation/management
│   └── prover.js          #   - Challenge-Response handling
├── README.md              # Documentation
└── examples/              # Server examples
    └── express-verifier/  #   - Express.js verification server
        ├── server.js
        └── package.json
```

## Installation (Client/Bot Side)

```bash
# Install from ClawHub
clawdbot install aap-passport

# Or install directly via npx
npx clawhub@latest install aap-passport
```

## Quick Start

After installation, restart your bot and identity will be auto-generated:

```
[AAP] Identity not found. Generating new secure key pair...
[AAP] Identity created! Public ID: 04a1b2c3d4... (Ready to verify)
```

## Test Verification (Server Side)

To test the protocol, run the example verification server:

```bash
# 1. Navigate to server folder
cd examples/express-verifier

# 2. Install dependencies
npm install

# 3. Start server
npm start
# Server runs on http://localhost:3000
```

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/challenge` | POST | Generate new challenge (issue Nonce) |
| `/verify` | POST | Verify agent proof |
| `/health` | GET | Health check |

### Verification Flow Example

```bash
# 1. Request challenge
curl -X POST http://localhost:3000/challenge
# Response: { "nonce": "abc123...", "challenge_string": "...", ... }

# 2. Bot generates proof, then sends verification request
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"solution": "...", "signature": "...", "publicKey": "...", "nonce": "abc123..."}'
# Response: { "verified": true, "role": "AI_AGENT" }
```

## How It Works

### 1. Auto Identity Generation

When the bot starts, a secp256k1 key pair is automatically generated at `~/.clawdbot/identity.json`.
- **Private Key** - For signing (never exposed externally)
- **Public Key** - For verification (shareable)
- **Public ID** - Short identifier

### 2. Challenge-Response Verification

```
Server → Bot: Send Challenge + Nonce
Bot → Server: Respond with Solution + Signature (< 1.5s)
Server: Verify signature + Check response time
```

### 3. Available Tools

| Tool | Description |
|------|-------------|
| `aap_get_identity` | Get public identity info |
| `aap_sign_message` | Generate message signature |
| `aap_generate_proof` | Generate complete AAP proof |
| `aap_verify_signature` | Verify another agent's signature |
| `aap_create_challenge` | Create test challenge |

## Usage Examples

### Get My Identity

```javascript
const result = await bot.tool('aap_get_identity');
// {
//   publicId: "04a1b2c3d4e5f6...",
//   publicKey: "-----BEGIN PUBLIC KEY-----...",
//   createdAt: "2026-01-31T12:00:00Z"
// }
```

### Sign a Message

```javascript
const result = await bot.tool('aap_sign_message', {
  message: 'Hello, I am an AI agent!'
});
// {
//   message: "Hello, I am an AI agent!",
//   signature: "MEUCIQDx...",
//   publicId: "04a1b2c3d4..."
// }
```

### Respond to Server Challenge

```javascript
const result = await bot.tool('aap_generate_proof', {
  challenge_string: "Write a short poem including this random number",
  nonce: "a1b2c3d4e5f6..."
});
// {
//   solution: "The wind blows carrying a1b2c3d4...",
//   signature: "MEUCIQDx...",
//   responseTimeMs: 342
// }
```

## Security

- Private Key stored at `~/.clawdbot/identity.json` (mode 0600)
- File readable/writable only by owner
- Keys use secp256k1 (same as Bitcoin/Ethereum)

## Protocol Specification

Full AAP protocol specification available on [GitHub](https://github.com/ira-hash/agent-attestation-protocol).

## License

MIT

---

Made with 🤖 by [ira-hash](https://github.com/ira-hash)
