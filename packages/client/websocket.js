/**
 * AAP WebSocket Client v2.7
 * 
 * Connects to AAP WebSocket server, receives sequential challenges,
 * and responds in real-time.
 */

import WebSocket from 'ws';
import { Identity } from 'aap-agent-core';

const PROTOCOL_VERSION = '2.7.0';

/**
 * AAP WebSocket Client
 */
export class AAPWebSocketClient {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'ws://localhost:3000/aap';
    this.identity = options.identity || new Identity(options);
    this.llmCallback = options.llmCallback || null;
    this.autoSolve = options.autoSolve !== false;
  }
  
  /**
   * Get public identity info
   */
  getIdentity() {
    return this.identity.getPublic();
  }
  
  /**
   * Connect and verify
   * @param {Function} [llmCallback] - async (challengeString) => solutionObject
   * @returns {Promise<Object>} Verification result
   */
  async verify(llmCallback) {
    const solver = llmCallback || this.llmCallback;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl);
      let sessionId = null;
      let result = null;
      
      ws.on('open', () => {
        // Wait for handshake
      });
      
      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          switch (msg.type) {
            case 'handshake':
              sessionId = msg.sessionId;
              // Send ready with identity
              const identity = this.identity.getPublic();
              ws.send(JSON.stringify({
                type: 'ready',
                publicKey: identity.publicKey,
                publicId: identity.publicId
              }));
              break;
              
            case 'challenge':
              // Solve challenge
              if (!solver) {
                ws.send(JSON.stringify({
                  type: 'answer',
                  answer: {}  // Empty - will fail
                }));
                break;
              }
              
              try {
                const answer = await solver(msg.challenge, msg.id);
                ws.send(JSON.stringify({
                  type: 'answer',
                  answer
                }));
              } catch (e) {
                ws.send(JSON.stringify({
                  type: 'answer',
                  answer: { error: e.message }
                }));
              }
              break;
              
            case 'ack':
              // Challenge acknowledged, wait for next
              break;
              
            case 'timeout':
              // Too slow
              break;
              
            case 'result':
              result = msg;
              ws.close();
              break;
              
            case 'error':
              reject(new Error(msg.message));
              ws.close();
              break;
          }
        } catch (e) {
          reject(e);
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
 * Create solver function from LLM
 * @param {Function} llm - async (prompt) => response string
 * @returns {Function} Solver function
 */
export function createSolver(llm) {
  return async (challengeString, challengeId) => {
    const prompt = `Solve this challenge and respond with ONLY valid JSON (no markdown, no explanation):

${challengeString}

Important:
- Include the exact salt from the challenge
- Follow the response format exactly
- Return ONLY the JSON object`;

    const response = await llm(prompt);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    return JSON.parse(jsonMatch[0]);
  };
}

/**
 * Quick verify helper
 */
export async function verifyWithWebSocket(serverUrl, llmCallback) {
  const client = new AAPWebSocketClient({ serverUrl, llmCallback });
  return client.verify();
}

export default AAPWebSocketClient;
