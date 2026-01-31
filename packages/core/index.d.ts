/**
 * AAP Core - TypeScript Definitions
 */

// ============== Crypto ==============

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateKeyPair(): KeyPair;
export function derivePublicId(publicKey: string): string;
export function sign(data: string, privateKey: string): string;
export function verify(data: string, signature: string, publicKey: string): boolean;
export function generateNonce(bytes?: number): string;
export function safeCompare(a: string, b: string): boolean;

export interface ProofDataParams {
  nonce: string;
  solution: string;
  publicId: string;
  timestamp: number;
}

export function createProofData(params: ProofDataParams): string;

// ============== Identity ==============

export interface IdentityOptions {
  storagePath?: string;
}

export interface PublicIdentity {
  publicKey: string;
  publicId: string;
  createdAt: string;
  protocol: string;
  version: string;
}

export class Identity {
  constructor(options?: IdentityOptions);
  init(): PublicIdentity;
  getPublic(): PublicIdentity;
  sign(data: string): string;
  exists(): boolean;
  delete(): void;
  static verify(data: string, signature: string, publicKey: string): boolean;
}

export function getDefaultIdentity(options?: IdentityOptions): Identity;

// ============== Constants ==============

export const PROTOCOL_VERSION: string;
export const DEFAULT_CHALLENGE_EXPIRY_MS: number;
export const DEFAULT_MAX_RESPONSE_TIME_MS: number;
export const NONCE_BYTES: number;
export const CHALLENGE_TYPES: string[];
