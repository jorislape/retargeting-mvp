/**
 * Feature flags.
 *
 * The retargeting module (the original MVP) is frozen, not deleted.
 * Its code and API routes remain in the repo but are unreachable unless
 * FEATURE_RETARGETING=true is set in the environment.
 */
export const flags = {
  retargeting: process.env.FEATURE_RETARGETING === "true",
} as const;

export type FeatureFlag = keyof typeof flags;
