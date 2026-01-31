/**
 * AAP WebSocket Server v3.0
 * 
 * Sequential challenge delivery over persistent connection.
 * No preview. Server controls pacing. Humans cannot pass.
 */

import { WebSocketServer } from 'ws';
import { randomBytes, createHash, createVerify } from 'node:crypto';

// ============== CONSTANTS ==============
export const PROTOCOL_VERSION = '3.0.0';
export const CHALLENGE_COUNT = 7;
export const TIME_PER_CHALLENGE_MS = 1200;
export const CONNECTION_TIMEOUT_MS = 15000;

// ============== CHALLENGE GENERATORS ==============
const GENERATORS = {
  math: (salt, seed) => {
    const a = 10 + (seed % 90);
    const b = 10 + ((seed * 7) % 90);
    const ops = ['+', '-', '*'];
    const op = ops[seed % 3];
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return {
      q: `[REQ-${salt}] What is ${a} ${op} ${b}?\nFormat: {"salt":"${salt}","result":number}`,
      v: (r) => r?.salt === salt && r?.result === answer
    };
  },
  
  logic: (salt, seed) => {
    const x = 10 + (seed % 50);
    const y = 10 + ((seed * 3) % 50);
    const answer = x > y ? 'GREATER' : x < y ? 'LESS' : 'EQUAL';
    return {
      q: `[REQ-${salt}] X=${x}, Y=${y}. Answer "GREATER" if X>Y, "LESS" if X<Y, "EQUAL" if X=Y.\nFormat: {"salt":"${salt}","answer":"..."}`,
      v: (r) => r?.salt === salt && r?.answer === answer
    };
  },
  
  count: (salt, seed) => {
    const all = ['cat','dog','apple','bird','car','fish','tree','book','lion','grape'];
    const animals = ['cat','dog','bird','fish','lion'];
    const n = 4 + (seed % 5);
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push(all[(seed + i * 3) % all.length]);
    }
    const count = items.filter(i => animals.includes(i)).length;
    return {
      q: `[REQ-${salt}] Count animals: ${items.join(', ')}\nFormat: {"salt":"${salt}","count":number}`,
      v: (r) => r?.salt === salt && r?.count === count
    };
  },
  
  pattern: (salt, seed) => {
    const start = 2 + (seed % 10);
    const step = 2 + (seed % 6);
    const seq = [start, start+step, start+step*2, start+step*3];
    const next = [start+step*4, start+step*5];
    return {
      q: `[REQ-${salt}] Next 2 numbers: [${seq.join(', ')}, ?, ?]\nFormat: {"salt":"${salt}","next":[n1,n2]}`,
      v: (r) => r?.salt === salt && Array.isArray(r?.next) && r.next[0] === next[0] && r.next[1] === next[1]
    };
  },
  
  reverse: (salt, seed) => {
    const words = ['hello','world','agent','robot','claw','alpha','delta'];
    const word = words[seed % words.length];
    const rev = word.split('').reverse().join('');
    return {
      q: `[REQ-${salt}] Reverse the string: "${word}"\nFormat: {"salt":"${salt}","result":"..."}`,
      v: (r) => r?.salt === salt && r?.result === rev
    };
  },
  
  extract: (salt, seed) => {
    const colors = ['red','blue','green','yellow','purple','orange'];
    const color = colors[seed % colors.length];
    const nouns = ['car','robot','bird','house'];
    const noun = nouns[seed % nouns.length];
    return {
      q: `[REQ-${salt}] Extract the color: "The ${color} ${noun} moved quickly"\nFormat: {"salt":"${salt}","color":"..."}`,
      v: (r) => r?.salt === salt && r?.color === color
    };
  },
  
  longest: (salt, seed) => {
    const sets = [
      ['cat', 'elephant', 'dog', 'ant'],
      ['bee', 'hippopotamus', 'fox', 'rat'],
      ['owl', 'crocodile', 'bat', 'fly']
    ];
    const words = sets[seed % sets.length];
    const longest = words.reduce((a, b) => a.length >= b.length ? a : b);
    return {
      q: `[REQ-${salt}] Find longest word: ${words.join(', ')}\nFormat: {"salt":"${salt}","answer":"..."}`,
      v: (r) => r?.salt === salt && r?.answer === longest
    };
  }
};

const TYPES = Object.keys(GENERATORS);

function generateChallenge(nonce, index) {
  const type = TYPES[index % TYPES.length];
  const salt = createHash('sha256').update(nonce + index).digest('hex').slice(0, 6).toUpperCase();
  const seed = parseInt(nonce.slice(index * 2, index * 2 + 8), 16) || (index * 17);
  const { q, v } = GENERATORS[type](salt, seed);
  return { type, challenge: q, validate: v };
}

// ============== WEBSOCKET SERVER ==============

/**
 * Create AAP WebSocket verification server
 * @param {Object} options
 * @param {number} [options.port] - Port for standalone server
 * @param {Object} [options.server] - Existing HTTP server to attach to
 * @param {string} [options.path='/aap'] - WebSocket path
 * @param {number} [options.challengeCount=7] - Number of challenges
 * @param {number} [options.timePerChallengeMs=1200] - Time limit per challenge
 * @param {Function} [options.onVerified] - Callback on successful verification
 * @param {Function} [options.onFailed] - Callback on failed verification
 * @returns {Object} { wss, sessions, close }
 */
export function createAAPWebSocket(options = {}) {
  const {
    port,
    server,
    path = '/aap',
    challengeCount = CHALLENGE_COUNT,
    timePerChallengeMs = TIME_PER_CHALLENGE_MS,
    connectionTimeoutMs = CONNECTION_TIMEOUT_MS,
    onVerified,
    onFailed
  } = options;

  const wssOptions = server ? { server, path } : { port };
  const wss = new WebSocketServer(wssOptions);
  const sessions = new Map();
  const verifiedTokens = new Map();

  wss.on('connection', (ws) => {
    const sessionId = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    const startTime = Date.now();

    const session = {
      id: sessionId,
      ws,
      nonce,
      startTime,
      current: 0,
      challenges: [],
      answers: [],
      timings: [],
      publicId: null,
      challengeStart: null,
      timer: null,
      connTimer: null
    };

    sessions.set(sessionId, session);

    // Generate challenges
    for (let i = 0; i < challengeCount; i++) {
      session.challenges.push(generateChallenge(nonce, i));
    }

    // Connection timeout
    session.connTimer = setTimeout(() => {
      send(ws, { type: 'error', code: 'TIMEOUT', message: 'Connection timeout' });
      ws.close();
    }, connectionTimeoutMs);

    // Send handshake
    send(ws, {
      type: 'handshake',
      sessionId,
      protocol: 'AAP',
      version: PROTOCOL_VERSION,
      challengeCount,
      timePerChallengeMs,
      message: 'Send {"type":"ready"} to begin verification.'
    });

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        send(ws, { type: 'error', code: 'INVALID_JSON', message: 'Invalid JSON' });
        return;
      }

      handleMessage(session, msg, {
        challengeCount,
        timePerChallengeMs,
        onVerified,
        onFailed,
        verifiedTokens
      });
    });

    ws.on('close', () => {
      cleanup(session);
      sessions.delete(sessionId);
    });

    ws.on('error', () => {
      cleanup(session);
      sessions.delete(sessionId);
    });
  });

  return {
    wss,
    sessions,
    verifiedTokens,
    close: () => wss.close(),
    
    // Helper to check if token is verified
    isVerified: (token) => {
      const session = verifiedTokens.get(token);
      return session && Date.now() < session.expiresAt;
    },
    
    // Get verified session info
    getSession: (token) => verifiedTokens.get(token)
  };
}

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function cleanup(session) {
  clearTimeout(session.timer);
  clearTimeout(session.connTimer);
}

function handleMessage(session, msg, options) {
  const { ws, current, challenges, answers, timings } = session;
  const { challengeCount, timePerChallengeMs, onVerified, onFailed, verifiedTokens } = options;

  switch (msg.type) {
    case 'ready':
      if (current !== 0) {
        send(ws, { type: 'error', code: 'ALREADY_STARTED', message: 'Already started' });
        return;
      }
      session.publicId = msg.publicId || 'anon-' + randomBytes(4).toString('hex');
      sendNextChallenge(session, timePerChallengeMs);
      break;

    case 'answer':
      if (session.challengeStart === null) {
        send(ws, { type: 'error', code: 'NO_CHALLENGE', message: 'No active challenge' });
        return;
      }

      clearTimeout(session.timer);
      const elapsed = Date.now() - session.challengeStart;

      // Too slow?
      if (elapsed > timePerChallengeMs) {
        finishSession(session, false, `Too slow on challenge #${current}: ${elapsed}ms > ${timePerChallengeMs}ms`, options);
        return;
      }

      // Record answer
      answers.push(msg.answer);
      timings.push(elapsed);

      // Validate
      const valid = challenges[current].validate(msg.answer);
      send(ws, { type: 'ack', id: current, valid, responseMs: elapsed });

      session.current++;

      // More challenges?
      if (session.current < challengeCount) {
        setTimeout(() => sendNextChallenge(session, timePerChallengeMs), 50);
      } else {
        // Calculate final result
        const passed = answers.filter((a, i) => challenges[i].validate(a)).length;
        const success = passed === challengeCount;
        finishSession(session, success, success ? 'All challenges passed' : `Failed: ${passed}/${challengeCount}`, options, passed);
      }
      break;

    default:
      send(ws, { type: 'error', code: 'UNKNOWN_TYPE', message: 'Unknown message type' });
  }
}

function sendNextChallenge(session, timePerChallengeMs) {
  const { ws, current, challenges } = session;
  const challenge = challenges[current];

  session.challengeStart = Date.now();

  send(ws, {
    type: 'challenge',
    id: current,
    total: challenges.length,
    challenge: challenge.challenge,
    timeLimit: timePerChallengeMs
  });

  // Timeout for this challenge
  session.timer = setTimeout(() => {
    send(ws, { type: 'timeout', id: current, message: 'Time expired' });
    finishSession(session, false, `Timeout on challenge #${current}`, {});
  }, timePerChallengeMs + 100);
}

function finishSession(session, success, message, options, passed) {
  const { ws, nonce, publicId, startTime, timings } = session;
  const { onVerified, onFailed, verifiedTokens } = options;

  cleanup(session);

  const totalTime = Date.now() - startTime;
  const result = {
    type: 'result',
    verified: success,
    message,
    nonce,
    publicId,
    passed,
    total: session.challenges.length,
    timings,
    totalTimeMs: totalTime,
    avgResponseMs: timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null
  };

  if (success) {
    result.role = 'AI_AGENT';
    result.sessionToken = randomBytes(32).toString('hex');
    
    // Store verified session
    if (verifiedTokens) {
      verifiedTokens.set(result.sessionToken, {
        publicId,
        nonce,
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 hour
        totalTimeMs: totalTime,
        avgResponseMs: result.avgResponseMs
      });
    }

    if (onVerified) onVerified(result, session);
  } else {
    if (onFailed) onFailed(result, session);
  }

  send(ws, result);
  setTimeout(() => ws.close(), 300);
}

export default { createAAPWebSocket, PROTOCOL_VERSION, CHALLENGE_COUNT, TIME_PER_CHALLENGE_MS };
