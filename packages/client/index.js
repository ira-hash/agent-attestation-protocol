/**
 * @aap/client v3.1.0
 * 
 * WebSocket client for Agent Attestation Protocol.
 * Batch mode: receive all challenges, solve, submit.
 */

import WebSocket from 'ws';

export const PROTOCOL_VERSION = '3.1.0';

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
   * @param {Function} [solver] - async (challenges) => answers[]
   * @returns {Promise<Object>} Verification result
   */
  async verify(solver) {
    const solve = solver || this.solver;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl);
      let result = null;

      ws.on('open', () => {});

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());

          switch (msg.type) {
            case 'handshake':
              ws.send(JSON.stringify({
                type: 'ready',
                publicId: this.publicId
              }));
              break;

            case 'challenges':
              if (!solve) {
                ws.send(JSON.stringify({ type: 'answers', answers: [] }));
                break;
              }

              try {
                const answers = await solve(msg.challenges);
                ws.send(JSON.stringify({ type: 'answers', answers }));
              } catch (e) {
                ws.send(JSON.stringify({ type: 'answers', answers: [] }));
              }
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
        if (result) resolve(result);
        else reject(new Error('Connection closed without result'));
      });

      ws.on('error', reject);
    });
  }
}

/**
 * Create a solver function from an LLM callback
 * @param {Function} llm - async (prompt) => responseString
 * @returns {Function} Solver function
 */
export function createSolver(llm) {
  return async (challenges) => {
    const prompt = `Solve ALL these challenges. Return a JSON array of answers in order.

${challenges.map((c, i) => `[${i}] ${c.challenge}`).join('\n\n')}

Respond with ONLY a JSON array like: [{...}, {...}, ...]`;

    const response = await llm(prompt);
    const match = response.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array found');
    return JSON.parse(match[0]);
  };
}

/**
 * Quick verify helper
 */
export async function verify(serverUrl, solver, publicId) {
  const client = new AAPClient({ serverUrl, solver, publicId });
  return client.verify();
}

export function createClient(options) {
  return new AAPClient(options);
}

export default { AAPClient, createClient, createSolver, verify, PROTOCOL_VERSION };
