// ============================================================
// Tier definitions for Blue App Gallery SaaS
//
// Tier enforcement is entirely SaaS-side.
// The Operator knows nothing about tiers.
// ============================================================

export interface TierLimits {
  maxDurationMinutes: number;
  maxConcurrentLeases: number;
  maxExtensionsPerLease: number;
  maxApps: number;
  maxMembers: number;
  heartbeatIntervalSeconds: number;
}

export type TierName = 'free' | 'pro' | 'enterprise';

const TIER_DEFINITIONS: Record<TierName, TierLimits> = {
  free: {
    maxDurationMinutes: 1440,
    maxConcurrentLeases: -1,
    maxExtensionsPerLease: -1,
    maxApps: -1,
    maxMembers: -1,
    heartbeatIntervalSeconds: 60,
  },
  pro: {
    maxDurationMinutes: 480,
    maxConcurrentLeases: 5,
    maxExtensionsPerLease: 10,
    maxApps: 20,
    maxMembers: 10,
    heartbeatIntervalSeconds: 30,
  },
  enterprise: {
    maxDurationMinutes: 1440,
    maxConcurrentLeases: 50,
    maxExtensionsPerLease: -1, // unlimited
    maxApps: -1, // unlimited
    maxMembers: -1, // unlimited
    heartbeatIntervalSeconds: 15,
  },
};

/**
 * Get tier limits for a given tier name.
 * Defaults to 'free' if unknown.
 */
export function getTierLimits(tier?: string): TierLimits {
  const name = (tier?.toLowerCase() ?? 'free') as TierName;
  return TIER_DEFINITIONS[name] ?? TIER_DEFINITIONS.free;
}

/**
 * Check if a value is within the tier limit.
 * A limit of -1 means unlimited.
 */
export function isWithinLimit(value: number, limit: number): boolean {
  if (limit === -1) return true;
  return value <= limit;
}
