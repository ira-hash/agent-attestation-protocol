# 🛂 AAP Passport

[![version](https://img.shields.io/badge/🚀_version-1.0.0-blue.svg?style=for-the-badge)](https://github.com/ira-hash/agent-attestation-protocol)
[![updated](https://img.shields.io/badge/📅_updated-2026--01--31-brightgreen.svg?style=for-the-badge)](https://github.com/ira-hash/agent-attestation-protocol)
[![license](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](./LICENSE)

[![ClawdHub](https://img.shields.io/badge/ClawdHub-v1.0.0-purple.svg)](https://clawdhub.com/skills/aap-passport)
[![crypto](https://img.shields.io/badge/crypto-secp256k1-orange.svg)](https://en.bitcoin.it/wiki/Secp256k1)
[![clawdbot](https://img.shields.io/badge/clawdbot-compatible-blueviolet.svg)](https://github.com/clawdbot/clawdbot)

> 🇺🇸 English | [🇰🇷 한국어](./README.ko.md)

<div align="center">

### 🔐 Agent Attestation Protocol

**Cryptographic identity verification for AI agents**

*Prove your AI agent's identity with PKI signatures, intelligent responses, and machine-speed timing.*

📦 **Latest:** v1.0.0 | 📅 **Updated:** January 31, 2026 | 🔧 **ClawdHub Ready**

</div>

---

## 🎯 What is AAP?

**Agent Attestation Protocol (AAP)** is a cryptographic system that allows AI agents to prove their identity. Think of it as a **digital passport for AI**.

### The Three Proofs

| Proof | Description | How It Works |
|-------|-------------|--------------|
| 🔐 **Proof of Identity** | PKI-based digital signature | Agent signs responses with secp256k1 private key |
| 🧠 **Proof of Intelligence** | LLM reasoning response | Agent generates intelligent response to challenge |
| ⚡ **Proof of Liveness** | Machine-speed response | Response must arrive within 1.5 seconds |

---

## 📦 Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@aap/core` | Cryptographic primitives & identity | `npm i @aap/core` |
| `@aap/server` | Express middleware for verifiers | `npm i @aap/server` |
| `@aap/client` | Client library for agents | `npm i @aap/client` |

---

## 🚀 Quick Start

### For Services (Add AAP Verification)

```javascript
import express from 'express';
import { createRouter } from '@aap/server';

const app = express();
app.use('/aap/v1', createRouter());
app.listen(3000);
// Now accepting AAP verification at /aap/v1/challenge and /aap/v1/verify
```

### For Agents (Prove Identity)

```javascript
import { AAPClient } from '@aap/client';

const client = new AAPClient({ serverUrl: 'https://example.com/aap/v1' });
const result = await client.verify();

if (result.verified) {
  console.log('Verified as AI_AGENT!');
}
```

### Clawdbot Skill Installation

```bash
# Install from ClawdHub (Recommended)
clawdhub install aap-passport

# Or clone directly
git clone https://github.com/ira-hash/agent-attestation-protocol.git
```

### Auto Identity Generation

After installation, restart your bot. Identity is auto-generated:

```
[AAP] Identity not found. Generating new secure key pair...
[AAP] Identity created! Public ID: 04a1b2c3d4... (Ready to verify)
```

---

## 📁 Project Structure

```
agent-attestation-protocol/
├── manifest.json              # Skill metadata
├── index.js                   # Main entry point
├── lib/                       # Core libraries
│   ├── identity.js            #   - Key generation/management
│   └── prover.js              #   - Challenge-Response handling
├── README.md                  # English documentation
├── README.ko.md               # Korean documentation
├── .gitignore
└── examples/                  # Server examples
    └── express-verifier/      #   - Express.js verification server
        ├── server.js
        └── package.json
```

---

## 🔧 Available Tools

| Tool | Description |
|------|-------------|
| `aap_get_identity` | Get public identity (public key & ID) |
| `aap_sign_message` | Sign a message with private key |
| `aap_generate_proof` | Generate complete AAP proof for verification |
| `aap_verify_signature` | Verify another agent's signature |
| `aap_create_challenge` | Create test challenge for development |

---

## 📊 How Verification Works

```
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐         Challenge + Nonce         ┌────────┐ │
│  │  Server  │ ─────────────────────────────────▶│  Bot   │ │
│  │(Verifier)│                                   │(Prover)│ │
│  └──────────┘                                   └────────┘ │
│       │                                              │      │
│       │      Solution + Signature (< 1.5s)          │      │
│       │◀─────────────────────────────────────────────      │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✅ Verify Signature (Proof of Identity)              │  │
│  │ ✅ Check Solution (Proof of Intelligence)            │  │
│  │ ✅ Check Response Time (Proof of Liveness)           │  │
│  └──────────────────────────────────────────────────────┘  │
│       │                                                     │
│       ▼                                                     │
│  { "verified": true, "role": "AI_AGENT" }                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Test Server (Server Side)

Run the example verification server to test the protocol:

```bash
# Navigate to server folder
cd examples/express-verifier

# Install dependencies
npm install

# Start server
npm start
# Server runs on http://localhost:3000
```

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/challenge` | POST | Generate new challenge (issue Nonce) |
| `/verify` | POST | Verify agent proof |
| `/health` | GET | Health check |

### Example Flow

```bash
# 1. Request challenge
curl -X POST http://localhost:3000/challenge
# Response: { "nonce": "abc123...", "challenge_string": "...", ... }

# 2. Bot generates proof, then submits for verification
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"solution": "...", "signature": "...", "publicKey": "...", "nonce": "abc123..."}'
# Response: { "verified": true, "role": "AI_AGENT" }
```

---

## 💻 Usage Examples

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

---

## 🔒 Security

| Aspect | Implementation |
|--------|----------------|
| **Key Storage** | `~/.clawdbot/identity.json` (mode 0600) |
| **Algorithm** | secp256k1 (same as Bitcoin/Ethereum) |
| **Private Key** | Never exposed externally |
| **Permissions** | Owner read/write only |

---

## 📄 License

MIT

---

<div align="center">

Made with 🤖 by [ira-hash](https://github.com/ira-hash)

**Protect your AI identity. Verify with AAP.**

</div>
