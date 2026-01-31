# 🛂 AAP Passport

[![version](https://img.shields.io/badge/🚀_version-1.0.0-blue.svg?style=for-the-badge)](https://github.com/ira-hash/agent-attestation-protocol)
[![updated](https://img.shields.io/badge/📅_updated-2026--01--31-brightgreen.svg?style=for-the-badge)](https://github.com/ira-hash/agent-attestation-protocol)
[![license](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](./LICENSE)

[![ClawdHub](https://img.shields.io/badge/ClawdHub-v1.0.0-purple.svg)](https://clawdhub.com/skills/aap-passport)
[![crypto](https://img.shields.io/badge/crypto-secp256k1-orange.svg)](https://en.bitcoin.it/wiki/Secp256k1)
[![clawdbot](https://img.shields.io/badge/clawdbot-compatible-blueviolet.svg)](https://github.com/clawdbot/clawdbot)

> [🇺🇸 English](./README.md) | 🇰🇷 한국어

<div align="center">

### 🔐 Agent Attestation Protocol

**AI 에이전트를 위한 암호학적 신원 검증**

*PKI 서명, 지능적 응답, 기계 속도 타이밍으로 AI 에이전트의 신원을 증명하세요.*

📦 **최신:** v1.0.0 | 📅 **업데이트:** 2026년 1월 31일 | 🔧 **ClawdHub Ready**

</div>

---

## 🎯 AAP란?

**Agent Attestation Protocol (AAP)**는 AI 에이전트가 자신의 신원을 증명할 수 있는 암호학적 시스템입니다. **AI를 위한 디지털 여권**이라고 생각하시면 됩니다.

### 3가지 증명 요소

| 증명 | 설명 | 작동 방식 |
|------|------|----------|
| 🔐 **신원 증명 (Proof of Identity)** | PKI 기반 전자서명 | secp256k1 개인키로 응답 서명 |
| 🧠 **지능 증명 (Proof of Intelligence)** | LLM 추론 응답 | 챌린지에 대한 지능적 응답 생성 |
| ⚡ **활성 증명 (Proof of Liveness)** | 기계 속도 응답 | 1.5초 이내 응답 필수 |

---

## 🚀 빠른 시작

### 설치

```bash
# ClawdHub에서 설치 (권장)
clawdhub install aap-passport

# 또는 직접 클론
git clone https://github.com/ira-hash/agent-attestation-protocol.git
```

### 자동 신원 생성

설치 후 봇을 재시작하면 신원이 자동 생성됩니다:

```
[AAP] Identity not found. Generating new secure key pair...
[AAP] Identity created! Public ID: 04a1b2c3d4... (Ready to verify)
```

---

## 📁 프로젝트 구조

```
agent-attestation-protocol/
├── manifest.json              # 스킬 메타데이터
├── index.js                   # 메인 진입점
├── lib/                       # 핵심 라이브러리
│   ├── identity.js            #   - 키 생성/관리
│   └── prover.js              #   - Challenge-Response 처리
├── README.md                  # 영어 문서
├── README.ko.md               # 한국어 문서
├── .gitignore
└── examples/                  # 서버 예제
    └── express-verifier/      #   - Express.js 검증 서버
        ├── server.js
        └── package.json
```

---

## 🔧 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| `aap_get_identity` | 공개 신원 정보 조회 (공개키 & ID) |
| `aap_sign_message` | 개인키로 메시지 서명 |
| `aap_generate_proof` | 검증용 완전한 AAP 증명 생성 |
| `aap_verify_signature` | 다른 에이전트의 서명 검증 |
| `aap_create_challenge` | 개발용 테스트 챌린지 생성 |

---

## 📊 검증 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                       검증 플로우                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐         Challenge + Nonce         ┌────────┐ │
│  │  서버    │ ─────────────────────────────────▶│   봇   │ │
│  │(검증자)  │                                   │(증명자)│ │
│  └──────────┘                                   └────────┘ │
│       │                                              │      │
│       │      Solution + Signature (< 1.5초)         │      │
│       │◀─────────────────────────────────────────────      │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✅ 서명 검증 (신원 증명)                              │  │
│  │ ✅ 솔루션 확인 (지능 증명)                            │  │
│  │ ✅ 응답 시간 확인 (활성 증명)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│       │                                                     │
│       ▼                                                     │
│  { "verified": true, "role": "AI_AGENT" }                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 테스트 서버 (서버 측)

프로토콜 테스트를 위한 예제 검증 서버 실행:

```bash
# 서버 폴더로 이동
cd examples/express-verifier

# 의존성 설치
npm install

# 서버 시작
npm start
# 서버가 http://localhost:3000에서 실행됩니다
```

### 서버 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/challenge` | POST | 새 챌린지 생성 (Nonce 발급) |
| `/verify` | POST | 에이전트 증명 검증 |
| `/health` | GET | 상태 확인 |

### 예제 플로우

```bash
# 1. 챌린지 요청
curl -X POST http://localhost:3000/challenge
# 응답: { "nonce": "abc123...", "challenge_string": "...", ... }

# 2. 봇이 증명 생성 후 검증 요청
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"solution": "...", "signature": "...", "publicKey": "...", "nonce": "abc123..."}'
# 응답: { "verified": true, "role": "AI_AGENT" }
```

---

## 💻 사용 예제

### 내 신원 확인

```javascript
const result = await bot.tool('aap_get_identity');
// {
//   publicId: "04a1b2c3d4e5f6...",
//   publicKey: "-----BEGIN PUBLIC KEY-----...",
//   createdAt: "2026-01-31T12:00:00Z"
// }
```

### 메시지 서명

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

### 서버 챌린지 응답

```javascript
const result = await bot.tool('aap_generate_proof', {
  challenge_string: "이 난수를 포함해 짧은 시를 지어라",
  nonce: "a1b2c3d4e5f6..."
});
// {
//   solution: "바람이 불어 a1b2c3d4를 품고...",
//   signature: "MEUCIQDx...",
//   responseTimeMs: 342
// }
```

---

## 🔒 보안

| 항목 | 구현 |
|------|------|
| **키 저장** | `~/.clawdbot/identity.json` (mode 0600) |
| **알고리즘** | secp256k1 (Bitcoin/Ethereum과 동일) |
| **개인키** | 절대 외부 노출 안됨 |
| **권한** | 소유자만 읽기/쓰기 가능 |

---

## 🛣️ 로드맵

- [x] 핵심 신원 생성
- [x] Challenge-Response 검증
- [x] Express.js 예제 서버
- [ ] ClawHub 배포
- [ ] 다중 에이전트 검증
- [ ] 블록체인 등록 (선택)
- [ ] 하드웨어 키 지원

---

## 📄 라이선스

MIT

---

<div align="center">

Made with 🤖 by [ira-hash](https://github.com/ira-hash)

**AI 신원을 보호하세요. AAP로 검증하세요.**

</div>
