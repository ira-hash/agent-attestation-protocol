/**
 * @aap/server
 * 
 * Server-side utilities for Agent Attestation Protocol.
 * Provides middleware and challenge generation for verification servers.
 */

export * from './middleware.js';
export * from './challenges.js';

import { aapMiddleware, createRouter } from './middleware.js';
import challenges from './challenges.js';

export { challenges };

export default {
  aapMiddleware,
  createRouter,
  challenges
};
