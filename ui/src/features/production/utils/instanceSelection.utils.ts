import {
  TIER_ORDER,
  type InstanceWithMeta,
  type TierGroup,
  type TierLevel,
} from '../types/instanceSelection.types';

// Groups flat instance list into tier groups sorted by TIER_ORDER.
// Each group carries a `primary` instance (recommended or first).
export function groupByTier(instances: InstanceWithMeta[]): TierGroup[] {
  const map = new Map<TierLevel, InstanceWithMeta[]>();

  for (const inst of instances) {
    const tier = inst.tier as TierLevel;
    const list = map.get(tier) ?? [];
    list.push(inst);
    map.set(tier, list);
  }

  return TIER_ORDER.filter((t) => map.has(t)).map((tier) => {
    const items = map.get(tier)!;
    const primary = items.find((i) => i.isRecommended) ?? items[0];
    return { tier, instances: items, primary };
  });
}

// Resolves which accordion tiers should be open by default.
export function resolveDefaultOpen(
  instances: InstanceWithMeta[],
  tierGroups: TierGroup[],
  selectedInstanceId: string
): string[] {
  const selectedTier = instances.find((i) => i.id === selectedInstanceId)?.tier;
  if (selectedTier) return [selectedTier];

  const recommendedTier = tierGroups.find((g) => g.instances.some((i) => i.isRecommended))?.tier;

  return [recommendedTier ?? tierGroups[0]?.tier].filter(Boolean) as string[];
}
