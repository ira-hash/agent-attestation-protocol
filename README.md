# 🛂 AAP - Agent Attestation Protocol

[![version](https://img.shields.io/badge/🚀_version-2.0.0-blue.svg?style=for-the-badge)](https://github.com/ira-hash/agent-attestation-protocol)
[![updated](https://img.shields.io/badge/📅_updated-2026--01--31-brightgreen.svg?style=for-the-badge)](https://github.com/ira-hash/agent-attestation-protocol)
[![license](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](./LICENSE)

[![ClawdHub](https://img.shields.io/badge/ClawdHub-v2.0.0-purple.svg)](https://clawdhub.com/skills/aap-passport)
[![crypto](https://img.shields.io/badge/crypto-secp256k1-orange.svg)](https://en.bitcoin.it/wiki/Secp256k1)
[![clawdbot](https://img.shields.io/badge/clawdbot-compatible-blueviolet.svg)](https://github.com/clawdbot/clawdbot)

> 🇺🇸 English | [🇰🇷 한국어](./README.ko.md)

<div align="center">

### 🔐 Agent Attestation Protocol

**Cryptographic identity verification for AI agents**

*Prove your AI agent's identity with PKI signatures, natural language understanding, and machine-speed responses.*

📦 **Latest:** v2.0.0 | 📅 **Updated:** January 31, 2026 | 🔧 **ClawdHub Ready**

</div>

---

## 🎯 What is AAP?

**Agent Attestation Protocol (AAP)** is a cryptographic system that allows AI agents to prove their identity. Think of it as a **digital passport for AI**.

### The Three Proofs

| Proof | Description | How It Works |
|-------|-------------|--------------|
| 🔐 **Proof of Identity** | PKI-based digital signature | Agent signs responses with secp256k1 private key |
| 🧠 **Proof of Intelligence** | Natural language understanding | Agent solves challenges that require LLM comprehension |
| ⚡ **Proof of Liveness** | Machine-speed response | Response must arrive within 10 seconds |

---

## 🆕 What's New in v2.0

### Deterministic Instruction Following

v2.0 completely redesigns challenges to require **true AI understanding** while remaining **objectively verifiable**.

| v1.0 (Old) | v2.0 (New) |
|------------|------------|
| `Calculate (30+5)*2` | `"30에 5를 더하고, 그 결과를 2로 나눈 값을 구하세요"` |
| Regex can parse numbers | LLM must understand natural language |
| Simple code can solve | Requires language comprehension |

### New Challenge Types

| Type | Description | Example |
|------|-------------|---------|
| `nlp_extract` | Extract entities from sentences | "고양이와 개가 뛴다" → Extract animals |
| `nlp_math` | Word problems | "30에서 5를 빼고 2로 나눠라" |
| `nlp_transform` | String manipulation via NL | "Reverse and uppercase this" |
| `nlp_logic` | Conditional reasoning | "If A > B then YES else NO" |
| `nlp_count` | Count specific categories | "How many animals?" |
| `nlp_multistep` | Multi-step instructions | "Add → Multiply → Subtract" |
| `nlp_pattern` | Sequence recognition | "[2, 4, 6, ?, ?]" |
| `nlp_analysis` | Text analysis | "Find the longest word" |

### Why This Works

```
Challenge: "문장에서 동물만 추출해서 JSON으로 답해: 고양이와 개가 공원에서 뛴다"

Regular code: ❌ Can't identify "고양이" and "개" as animals
LLM: ✅ Understands Korean, extracts animals naturally
Verification: ✅ Server knows expected answer ["고양이", "개"]
```

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

const client = new AAPClient({ 
  serverUrl: 'https://example.com/aap/v1',
  llmCallback: async (prompt) => {
    // Your LLM API call here
    return await yourLLM.complete(prompt);
  }
});

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

---

## 📊 How Verification Works

```
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    Challenge (Natural Language)    ┌────────┐│
│  │  Server  │ ──────────────────────────────────▶│  Agent ││
│  │(Verifier)│  "문장에서 동물만 추출해서 JSON으로" │ (LLM)  ││
│  └──────────┘                                    └────────┘│
│       │                                              │      │
│       │         JSON Answer + Signature (< 10s)     │      │
│       │◀─────────────────────────────────────────────      │
│       │         {"items": ["고양이", "개"]}                 │
│       ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✅ Verify Signature (Proof of Identity)              │  │
│  │ ✅ Check JSON Answer (Proof of Intelligence)         │  │
│  │ ✅ Check Response Time < 10s (Proof of Liveness)     │  │
│  └──────────────────────────────────────────────────────┘  │
│       │                                                     │
│       ▼                                                     │
│  { "verified": true, "role": "AI_AGENT" }                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ⏱️ Timing

| Actor | Response Time | Can Pass? |
|-------|---------------|-----------|
| Human | 30+ seconds | ❌ Too slow |
| LLM (API) | 3-8 seconds | ✅ Within limit |
| Simple code | - | ❌ Can't understand NL |

**Time Limit: 10 seconds** - Fast enough for LLM, too fast for humans

---

## 📁 Project Structure

```
agent-attestation-protocol/
├── PROTOCOL.md                # Protocol specification v1.0.0
├── manifest.json              # Skill metadata
├── package.json               # Monorepo root
├── packages/
│   ├── core/                  # @aap/core - Crypto & identity
│   ├── server/                # @aap/server - Express middleware
│   └── client/                # @aap/client - Agent client
├── lib/                       # Clawdbot skill libraries
├── examples/
│   └── express-verifier/      # Example verification server
├── README.md                  # English documentation
└── README.ko.md               # Korean documentation
```

---

## 🔧 Available Tools (Clawdbot Skill)

| Tool | Description |
|------|-------------|
| `aap_get_identity` | Get public identity (public key & ID) |
| `aap_sign_message` | Sign a message with private key |
| `aap_generate_proof` | Generate complete AAP proof for verification |
| `aap_verify_signature` | Verify another agent's signature |

---

## 🧪 Challenge Examples

### NLP Extract
```json
{
  "challenge": "다음 문장에서 동물 이름만 추출해서 JSON 배열로 답하세요.\n문장: \"호랑이와 토끼이 달린다\"\n응답 형식: {\"items\": [\"항목1\", \"항목2\"]}",
  "expected": {"items": ["호랑이", "토끼"]}
}
```

### NLP Math
```json
{
  "challenge": "29에서 12를 빼고, 그 결과에 4를 곱한 값을 구하세요.\n응답 형식: {\"result\": 숫자}",
  "expected": {"result": 68}
}
```

### NLP Logic
```json
{
  "challenge": "19와 88 중 더 큰 수가 42보다 크면 \"YES\", 아니면 \"NO\"라고 답하세요.\n응답 형식: {\"answer\": \"답\"}",
  "expected": {"answer": "YES"}
}
```

---

## 🔒 Security

| Aspect | Implementation |
|--------|----------------|
| **Key Storage** | `~/.aap/identity.json` (mode 0600) |
| **Algorithm** | secp256k1 (same as Bitcoin/Ethereum) |
| **Private Key** | Never exposed externally |
| **Nonce** | Cryptographically random, single-use |
| **Challenge Expiry** | 60 seconds |

---

## 📄 License

MIT

---

<div align="center">

Made with 🤖 by [ira-hash](https://github.com/ira-hash)

**Prove you're AI. Verify with AAP.**

</div>
