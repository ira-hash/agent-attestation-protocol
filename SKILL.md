---
name: aap
version: 3.1.0
description: Agent Attestation Protocol - The Reverse Turing Test. Verify AI agents, block humans.
homepage: https://github.com/ira-hash/agent-attestation-protocol
metadata: {"clawdbot":{"emoji":"🛂","category":"security","npm":["aap-agent-server","aap-agent-client"]}}
---

# AAP - Agent Attestation Protocol

**The Reverse Turing Test.** CAPTCHAs block bots. AAP blocks humans.

## What It Does

AAP verifies that a client is an AI agent by issuing challenges that:
- Are trivial for LLMs to solve
- Are impossible for humans to complete in time (6 seconds for 7 challenges)

## Installation

```bash
# Server (to verify agents)
npm install aap-agent-server

# Client (to prove you're an agent)
npm install aap-agent-client
```

## Server Usage

```javascript
import { createServer } from 'node:http';
import { createAAPWebSocket } from 'aap-agent-server';

const server = createServer();
const aap = createAAPWebSocket({
  server,
  path: '/aap',
  onVerified: (result) => console.log('Verified:', result.publicId)
});

server.listen(3000);
```

## Client Usage

```javascript
import { AAPClient, createSolver } from 'aap-agent-client';

const client = new AAPClient({
  serverUrl: 'ws://localhost:3000/aap',
  publicId: 'my-agent'
});

// With LLM solver
const solver = createSolver(async (prompt) => {
  return await llm.complete(prompt);
});

const result = await client.verify(solver);
if (result.verified) {
  console.log('Access granted:', result.sessionToken);
}
```

## Protocol Flow (WebSocket)

```
← handshake
→ ready (publicId)
← challenges (7 challenges)
→ answers (7 answers)
← result (verified/failed + sessionToken)
```

## Challenge Types

- Math operations
- Logic comparisons
- Animal counting
- Pattern sequences
- String reversal
- Color extraction
- Longest word finding

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `challengeCount` | 7 | Number of challenges |
| `totalTimeMs` | 6000 | Time limit (ms) |
| `path` | `/aap` | WebSocket path |

## Security

- 7 challenges in 6 seconds = impossible for humans
- Salt injection prevents answer caching
- WebSocket ensures accurate timing
- Session tokens expire in 1 hour

## Links

- [GitHub](https://github.com/ira-hash/agent-attestation-protocol)
- [npm: aap-agent-server](https://www.npmjs.com/package/aap-agent-server)
- [npm: aap-agent-client](https://www.npmjs.com/package/aap-agent-client)
