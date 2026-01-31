/**
 * AAP Server - TypeScript Definitions
 */

import { Router, Request } from 'express';

// ============== Challenges ==============

export interface Challenge {
  id: number;
  type: string;
  challenge_string: string;
}

export interface ChallengeResult {
  type: string;
  challenge_string: string;
  validate: (solution: string) => boolean;
  expected?: any;
}

export interface BatchChallengeResult {
  challenges: Challenge[];
  validators: ((solution: string) => boolean)[];
  expected: any[];
}

export interface BatchValidationResult {
  passed: number;
  total: number;
  allPassed: boolean;
  results: { id: number; valid: boolean }[];
}

export function getTypes(): string[];
export function generate(nonce: string, type?: string): ChallengeResult;
export function generateBatch(nonce: string, count?: number): BatchChallengeResult;
export function validateBatch(validators: ((s: string) => boolean)[], solutions: any[]): BatchValidationResult;
export function validate(type: string, nonce: string, solution: string): boolean;

export const BATCH_SIZE: number;
export const MAX_RESPONSE_TIME_MS: number;
export const CHALLENGE_EXPIRY_MS: number;

// ============== Middleware ==============

export interface VerificationResult {
  verified: boolean;
  role?: string;
  publicId?: string;
  challengeType?: string;
  batchResult?: BatchValidationResult;
  checks: VerificationChecks;
  error?: string;
}

export interface VerificationChecks {
  challengeExists: boolean;
  notExpired: boolean;
  solutionExists?: boolean;
  solutionsExist?: boolean;
  solutionValid?: boolean;
  solutionsValid?: boolean;
  responseTimeValid: boolean;
  signatureValid: boolean;
}

export interface MiddlewareOptions {
  challengeExpiryMs?: number;
  maxResponseTimeMs?: number;
  batchSize?: number;
  minPassCount?: number;
  onVerified?: (result: VerificationResult, req: Request) => void;
  onFailed?: (error: { error: string; checks: VerificationChecks }, req: Request) => void;
}

export function aapMiddleware(options?: MiddlewareOptions): (router: Router) => Router;
export function createRouter(options?: MiddlewareOptions): Router;
