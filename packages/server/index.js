/**
 * @aap/server v2.7.0
 * 
 * Server-side utilities for Agent Attestation Protocol.
 * The Reverse Turing Test - CAPTCHAs block bots, AAP blocks humans.
 */

export * from './middleware.js';
export * from './challenges.js';
export * from './ratelimit.js';
export * from './whitelist.js';
export * from './persistence.js';
export * from './errors.js';
export * from './websocket.js';
export * as logger from './logger.js';

import { aapMiddleware, createRouter } from './middleware.js';
import challenges from './challenges.js';
import { createRateLimiter, createFailureLimiter } from './ratelimit.js';
import { createWhitelist, createKeyRotation } from './whitelist.js';
import { createStore, createMemoryStore, createFileStore, createRedisStore } from './persistence.js';
import { createAAPWebSocket } from './websocket.js';

export { challenges };

export default {
  // Core
  aapMiddleware,
  createRouter,
  challenges,
  
  // WebSocket (v2.7+)
  createAAPWebSocket,
  
  // Security
  createRateLimiter,
  createFailureLimiter,
  createWhitelist,
  createKeyRotation,
  
  // Persistence
  createStore,
  createMemoryStore,
  createFileStore,
  createRedisStore
};
