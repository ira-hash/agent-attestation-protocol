# AAP Passport 🛂

**Agent Attestation Protocol (AAP)** identity and verification skill for Moltbot/Clawdbot.

> "AI 에이전트의 신분증" - 암호학적으로 검증 가능한 AI 신원 증명

## Overview

AAP Passport는 AI 에이전트가 자신의 신원을 증명할 수 있게 해주는 스킬입니다.

**3가지 증명 요소:**
1. **Proof of Identity** - PKI 기반 전자서명
2. **Proof of Intelligence** - LLM 추론 응답
3. **Proof of Liveness** - 기계 속도 응답 (< 1.5초)

## Installation

```bash
# ClawHub에서 설치
clawdbot install aap-passport

# 또는 npx로 직접 설치
npx clawhub@latest install aap-passport
```

## Quick Start

설치 후 봇을 재시작하면 자동으로 신원이 생성됩니다:

```
[AAP] Identity not found. Generating new secure key pair...
[AAP] Identity created! Public ID: 04a1b2c3d4... (Ready to verify)
```

## How It Works

### 1. 자동 신원 생성

봇이 시작될 때 `~/.clawdbot/identity.json`에 secp256k1 키 쌍이 자동 생성됩니다.
- **Private Key** - 서명용 (절대 외부 노출 안됨)
- **Public Key** - 검증용 (공유 가능)
- **Public ID** - 짧은 식별자

### 2. Challenge-Response 검증

```
서버 → 봇: Challenge + Nonce 전송
봇 → 서버: Solution + Signature 응답 (< 1.5초)
서버: 서명 검증 + 응답 시간 확인
```

### 3. 사용 가능한 Tools

| Tool | 설명 |
|------|------|
| `aap_get_identity` | 공개 신원 정보 조회 |
| `aap_sign_message` | 메시지 서명 생성 |
| `aap_generate_proof` | 완전한 AAP 증명 생성 |
| `aap_verify_signature` | 다른 에이전트 서명 검증 |
| `aap_create_challenge` | 테스트용 챌린지 생성 |

## Usage Examples

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

## Security

- Private Key는 `~/.clawdbot/identity.json`에 저장 (mode 0600)
- 파일은 소유자만 읽기/쓰기 가능
- 키는 secp256k1 (Bitcoin/Ethereum과 동일)

## Protocol Specification

AAP 프로토콜 전체 스펙은 [GitHub](https://github.com/ira-hash/agent-attestation-protocol)에서 확인하세요.

## License

MIT

---

Made with 🤖 by [ira-hash](https://github.com/ira-hash)
