// Feature flags configuration
// Toggle features on/off for A/B testing or gradual rollouts

export const featureFlags = {
  // When true, use hand-drawn SVG icons. When false, use Lucide icons.
  hand_drawn_icons: false,
} as const;

export type FeatureFlags = typeof featureFlags;
