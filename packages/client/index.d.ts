/**
 * AAP Client - TypeScript Definitions
 */

import { Identity, PublicIdentity } from 'aap-agent-core';

// ============== Prover ==============

export interface Challenge {
  challenge_string: string;
  nonce: string;
  type?: string;
}

export interface BatchChallenge {
  nonce: string;
  challenges: Challenge[];
  batchSize?: number;
  timestamp?: number;
  expiresAt?: number;
  maxResponseTimeMs?: number;
}

export interface Proof {
  solution: string;
  signature: string;
  publicKey: string;
  publicId: string;
  nonce: string;
  timestamp: number;
  responseTimeMs: number;
  protocol: string;
  version: string;
}

export interface BatchProof {
  solutions: string[];
  signature: string;
  publicKey: string;
  publicId: string;
  nonce: string;
  timestamp: number;
  responseTimeMs: number;
  protocol: string;
  version: string;
}

export type LLMCallback = (challengeString: string, nonce?: string, type?: string) => Promise<string>;
export type BatchLLMCallback = (prompt: string) => Promise<string>;

export interface ProverOptions {
  identity?: Identity;
  storagePath?: string;
}

export class Prover {
  constructor(options?: ProverOptions);
  getIdentity(): PublicIdentity;
  generateProof(challenge: Challenge, solutionOrCallback?: string | LLMCallback): Promise<Proof>;
  generateBatchProof(challengeBatch: BatchChallenge, llmCallback?: BatchLLMCallback): Promise<BatchProof>;
  solve(challengeString: string, nonce: string, type: string): string;
  sign(data: string): { data: string; signature: string; publicId: string; timestamp: number };
}

// ============== Client ==============

export interface AAPClientOptions {
  serverUrl?: string;
  storagePath?: string;
  llmCallback?: LLMCallback | BatchLLMCallback;
}

export interface VerificationResult {
  verified: boolean;
  role?: string;
  publicId?: string;
  challengeType?: string;
  batchResult?: {
    passed: number;
    total: number;
    results: { id: number; valid: boolean }[];
  };
  checks?: Record<string, boolean>;
  error?: string;
  challenge?: any;
  proof?: {
    solution?: string;
    solutions?: string[];
    responseTimeMs: number;
    publicId: string;
  };
}

export interface HealthCheckResult {
  healthy: boolean;
  status?: string;
  protocol?: string;
  version?: string;
  challengeTypes?: string[];
  error?: string;
}

export class AAPClient {
  constructor(options?: AAPClientOptions);
  getIdentity(): PublicIdentity;
  verify(serverUrl?: string, solutionOrCallback?: string | LLMCallback | BatchLLMCallback): Promise<VerificationResult>;
  checkHealth(serverUrl?: string): Promise<HealthCheckResult>;
  getChallenge(serverUrl?: string): Promise<BatchChallenge>;
  generateProof(challenge: Challenge | BatchChallenge, solutionOrCallback?: string | LLMCallback | BatchLLMCallback): Promise<Proof | BatchProof>;
  submitProof(serverUrl: string, proof: Proof | BatchProof): Promise<VerificationResult>;
  sign(data: string): { data: string; signature: string; publicId: string; timestamp: number };
}

export function createClient(options?: AAPClientOptions): AAPClient;

export { Prover };
