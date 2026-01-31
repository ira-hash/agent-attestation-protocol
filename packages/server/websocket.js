/**
 * AAP WebSocket Server v2.7
 * 
 * Sequential challenge delivery over persistent connection.
 * Humans cannot preview questions - each arrives with strict time limit.
 */

import { WebSocketServer } from 'ws';
import { randomBytes, createVerify } from 'node:crypto';
import { generate as generateChallenge, getTypes } from './challenges.js';

// Constants
const CHALLENGE_COUNT = 7;
const TIME_PER_CHALLENGE_MS = 1200;  // 1.2 seconds per challenge
const CONNECTION_TIMEOUT_MS = 15000; // 15 seconds total
const PROTOCOL_VERSION = '2.7.0';

/**
 * Create AAP WebSocket server
 * @param {Object} options
 * @param {number} [options.port] - Standalone port (if no httpServer)
 * @param {Object} [options.httpServer] - Existing HTTP server
 * @param {string} [options.path='/aap'] - WebSocket path
 * @param {Function} [options.onVerified] - Callback on successful verification
 * @param {Function} [options.onFailed] - Callback on failed verification
 */
export function createAAPWebSocket(options = {}) {
  const {
    port,
    httpServer,
    path = '/aap',
    onVerified = null,
    onFailed = null,
    challengeCount = CHALLENGE_COUNT,
    timePerChallengeMs = TIME_PER_CHALLENGE_MS
  } = options;

  const wssOptions = httpServer 
    ? { server: httpServer, path }
    : { port, path };
  
  const wss = new WebSocketServer(wssOptions);
  
  // Track active sessions
  const sessions = new Map();

  wss.on('connection', (ws, req) => {
    const sessionId = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    const startTime = Date.now();
    
    const session = {
      id: sessionId,
      nonce,
      ws,
      startTime,
      currentChallenge: 0,
      challenges: [],
      validators: [],
      answers: [],
      timings: [],
      publicKey: null,
      publicId: null,
      challengeStartTime: null,
      timeout: null,
      connectionTimeout: null
    };
    
    sessions.set(sessionId, session);
    
    // Connection timeout
    session.connectionTimeout = setTimeout(() => {
      sendError(ws, 'Connection timeout');
      ws.close();
    }, CONNECTION_TIMEOUT_MS);
    
    // Generate all challenges upfront (but send one at a time)
    const types = getTypes();
    for (let i = 0; i < challengeCount; i++) {
      const type = types[i % types.length];
      const challenge = generateChallenge(nonce + i, type);
      session.challenges.push({
        id: i,
        type,
        challenge_string: challenge.challenge_string
      });
      session.validators.push(challenge.validate);
    }
    
    // Send handshake
    send(ws, {
      type: 'handshake',
      sessionId,
      nonce,
      protocol: 'AAP',
      version: PROTOCOL_VERSION,
      mode: 'websocket',
      challengeCount,
      timePerChallengeMs,
      message: 'Connected. Send "ready" with publicKey to begin.'
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(session, msg, { onVerified, onFailed, timePerChallengeMs });
      } catch (e) {
        sendError(ws, 'Invalid JSON');
      }
    });
    
    ws.on('close', () => {
      clearTimeout(session.timeout);
      clearTimeout(session.connectionTimeout);
      sessions.delete(sessionId);
    });
    
    ws.on('error', () => {
      sessions.delete(sessionId);
    });
  });

  return {
    wss,
    sessions,
    close: () => wss.close()
  };
}

function send(ws, data) {
  if (ws.readyState === 1) { // OPEN
    ws.send(JSON.stringify(data));
  }
}

function sendError(ws, message, code = 'ERROR') {
  send(ws, { type: 'error', code, message });
}

function handleMessage(session, msg, options) {
  const { ws, currentChallenge, challenges, validators, answers, timings } = session;
  const { onVerified, onFailed, timePerChallengeMs } = options;

  switch (msg.type) {
    case 'ready':
      // Client ready to start, optionally provides identity
      if (currentChallenge !== 0) {
        sendError(ws, 'Already started');
        return;
      }
      
      session.publicKey = msg.publicKey || null;
      session.publicId = msg.publicId || null;
      
      // Send first challenge
      sendNextChallenge(session, timePerChallengeMs);
      break;
      
    case 'answer':
      // Client submitting answer
      if (session.challengeStartTime === null) {
        sendError(ws, 'No active challenge');
        return;
      }
      
      const responseTime = Date.now() - session.challengeStartTime;
      clearTimeout(session.timeout);
      
      // Check if too slow
      if (responseTime > timePerChallengeMs) {
        send(ws, {
          type: 'timeout',
          challengeId: currentChallenge,
          responseTimeMs: responseTime,
          limit: timePerChallengeMs
        });
        finishSession(session, false, 'Too slow on challenge ' + currentChallenge, { onVerified, onFailed });
        return;
      }
      
      // Record answer and timing
      answers.push(msg.answer);
      timings.push(responseTime);
      
      // Validate immediately
      const valid = validators[currentChallenge](msg.answer);
      
      send(ws, {
        type: 'ack',
        challengeId: currentChallenge,
        responseTimeMs: responseTime,
        valid  // Real-time feedback
      });
      
      session.currentChallenge++;
      
      // More challenges?
      if (session.currentChallenge < challenges.length) {
        // Small delay then next challenge
        setTimeout(() => sendNextChallenge(session, timePerChallengeMs), 100);
      } else {
        // All done - calculate result
        const passed = answers.filter((_, i) => validators[i](answers[i])).length;
        const allPassed = passed === challenges.length;
        const totalTime = Date.now() - session.startTime;
        
        finishSession(session, allPassed, allPassed ? 'Verified' : `Failed: ${passed}/${challenges.length}`, {
          onVerified,
          onFailed,
          passed,
          total: challenges.length,
          timings,
          totalTime
        });
      }
      break;
      
    default:
      sendError(ws, 'Unknown message type: ' + msg.type);
  }
}

function sendNextChallenge(session, timePerChallengeMs) {
  const { ws, currentChallenge, challenges } = session;
  const challenge = challenges[currentChallenge];
  
  session.challengeStartTime = Date.now();
  
  send(ws, {
    type: 'challenge',
    id: currentChallenge,
    total: challenges.length,
    challenge: challenge.challenge_string,
    timeLimit: timePerChallengeMs
  });
  
  // Timeout for this challenge
  session.timeout = setTimeout(() => {
    send(ws, {
      type: 'timeout',
      challengeId: currentChallenge,
      message: 'Time expired'
    });
    finishSession(session, false, 'Timeout on challenge ' + currentChallenge, {});
  }, timePerChallengeMs + 100); // Small grace period for network
}

function finishSession(session, success, message, options) {
  const { ws, nonce, publicId, startTime } = session;
  const { onVerified, onFailed, passed, total, timings, totalTime } = options;
  
  clearTimeout(session.timeout);
  clearTimeout(session.connectionTimeout);
  
  const result = {
    type: 'result',
    verified: success,
    nonce,
    publicId,
    message,
    passed,
    total,
    timings,
    totalTimeMs: totalTime || (Date.now() - startTime),
    avgResponseMs: timings?.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null
  };
  
  if (success) {
    result.role = 'AI_AGENT';
    result.sessionToken = randomBytes(32).toString('hex');
    if (onVerified) onVerified(result, session);
  } else {
    if (onFailed) onFailed(result, session);
  }
  
  send(ws, result);
  
  // Close after sending result
  setTimeout(() => ws.close(), 500);
}

export default { createAAPWebSocket };
