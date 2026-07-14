/**
 * Cross-cutting contracts for PseudoPilot.
 * Tenancy and rate-limit shapes live here so the API cannot "forget" multi-tenant scale rules.
 */

export const PLATFORM_NAME = 'PseudoPilot' as const;
export const PACKAGE_NAME = '@pseudopilot/shared-types' as const;
export const PACKAGE_VERSION = '0.0.0' as const;

/** Stable organization (school/tenant) identifier — required on every multi-tenant row/query. */
export type OrgId = string & { readonly __brand: 'OrgId' };

/** User identifier scoped within the platform (not org-unique by itself). */
export type UserId = string & { readonly __brand: 'UserId' };

export type Role = 'student' | 'teacher' | 'org_admin' | 'platform_admin';

/**
 * Envelope for every authenticated API request context.
 * Enforces org scoping at the type layer before business logic exists.
 */
export interface RequestContext {
  readonly requestId: string;
  readonly userId: UserId;
  readonly orgId: OrgId | null;
  readonly roles: readonly Role[];
}

/**
 * Rate-limit decision returned by gateway / Redis counters.
 * Designed for 100k-user abuse protection without coupling to a vendor SDK.
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Unix epoch milliseconds when the window resets. */
  readonly resetAt: number;
  readonly scope: 'user' | 'org' | 'ip' | 'route';
}

/** Where student code is allowed to execute. ClientLocal is the scale default. */
export type ExecutionMode = 'ClientLocal' | 'ServerSandbox' | 'HybridDebug';

export interface CapacityHint {
  readonly mode: ExecutionMode;
  /**
   * Prefer ClientLocal so 100k editors do not fan-in onto sandbox CPU.
   * ServerSandbox is for untrusted/long/batch work only.
   */
  readonly preferClientLocal: true;
}
