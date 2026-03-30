import type { GPUInstanceType } from '@/types/deploymentTypes';

export type TierLevel = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export const TIER_ORDER: TierLevel[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const TIER_AVATAR_CLASS: Record<TierLevel, string> = {
  XS: 'bg-chart-2/15 text-chart-2',
  S: 'bg-chart-1/15 text-chart-1',
  M: 'bg-chart-4/15 text-chart-4',
  L: 'bg-chart-3/15 text-chart-3',
  XL: 'bg-chart-5/15 text-chart-5',
  XXL: 'bg-destructive/15 text-destructive',
};

export type InstanceWithMeta = GPUInstanceType & { isRecommended: boolean };

export interface TierGroup {
  tier: TierLevel;
  instances: InstanceWithMeta[];
  // Representative instance for the tier header (recommended or first).
  primary: InstanceWithMeta;
}
