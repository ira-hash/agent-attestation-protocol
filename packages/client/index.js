/**
 * @aap/client v3.0.0
 * 
 * WebSocket client for Agent Attestation Protocol.
 * Connect, solve sequential challenges, prove your intelligence.
 */

import WebSocket from 'ws';

export const PROTOCOL_VERSION = '3.0.0';

/**
 * AAP WebSocket Client
 */
export class AAPClient {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'ws://localhost:3000/aap';
    this.publicId = options.publicId || null;
    this.solver = options.solver || null;
  }

  /**
   * Connect and verify
   * @param {Function} [solver] - async (challengeString, challengeId) => answerObject
   * @returns {Promise<Object>} Verification result
   */
  async verify(solver) {
    const solve = solver || this.solver;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl);
      let result = null;

      ws.on('open', () => {
        // Wait for handshake
      });

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());

          switch (msg.type) {
            case 'handshake':
              // Send ready
              ws.send(JSON.stringify({
                type: 'ready',
                publicId: this.publicId
              }));
              break;

            case 'challenge':
              if (!solve) {
                // No solver - send empty answer (will fail)
                ws.send(JSON.stringify({ type: 'answer', answer: {} }));
                break;
              }

              try {
                const answer = await solve(msg.challenge, msg.id);
                ws.send(JSON.stringify({ type: 'answer', answer }));
              } catch (e) {
                ws.send(JSON.stringify({ type: 'answer', answer: { error: e.message } }));
              }
              break;

            case 'ack':
              // Challenge acknowledged, waiting for next
              break;

            case 'timeout':
              // Too slow
              break;

            case 'result':
              result = msg;
              break;

            case 'error':
              reject(new Error(msg.message || 'Unknown error'));
              ws.close();
              break;
          }
        } catch (e) {
          reject(e);
          ws.close();
        }
      });

      ws.on('close', () => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Connection closed without result'));
        }
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });
  }
}

/**
 * Create a solver function from an LLM callback
 * @param {Function} llm - async (prompt) => responseString
 * @returns {Function} Solver function for verify()
 */
export function createSolver(llm) {
  return async (challengeString, challengeId) => {
    const prompt = `Solve this challenge. Respond with ONLY the JSON object, no explanation:

${challengeString}`;

    const response = await llm(prompt);
    
    // Extract JSON from response
    const match = response.match(/\{[\s\S]*?\}/);
    if (!match) {
      throw new Error('No JSON found in response');
    }
    
    return JSON.parse(match[0]);
  };
}

/**
 * Quick verify helper
 * @param {string} serverUrl - WebSocket URL
 * @param {Function} [solver] - Solver function
 * @param {string} [publicId] - Public ID
 * @returns {Promise<Object>} Verification result
 */
export async function verify(serverUrl, solver, publicId) {
  const client = new AAPClient({ serverUrl, solver, publicId });
  return client.verify();
}

/**
 * Create client instance
 */
export function createClient(options) {
  return new AAPClient(options);
}

export default { AAPClient, createClient, createSolver, verify, PROTOCOL_VERSION };
