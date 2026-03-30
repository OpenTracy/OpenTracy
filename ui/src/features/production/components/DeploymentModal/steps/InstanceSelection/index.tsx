import { useMemo } from 'react';

import { Accordion } from '@/components/ui/accordion';
import { INSTANCE_TYPES } from '@/features/production/constants/instanceTypes';
import type { InstanceWithMeta } from '../../../../types/instanceSelection.types';
import { groupByTier, resolveDefaultOpen } from '../../../../utils/instanceSelection.utils';
import { TierAccordionItem } from './TierAccordionItem';

interface InstanceSelectionProps {
  selectedInstanceId: string;
  availableInstanceIds: string[];
  recommendedInstanceId?: string;
  onInstanceChange: (id: string) => void;
}

export function InstanceSelection({
  selectedInstanceId,
  availableInstanceIds,
  recommendedInstanceId,
  onInstanceChange,
}: InstanceSelectionProps) {
  const instances = useMemo<InstanceWithMeta[]>(
    () =>
      INSTANCE_TYPES.filter((inst) => availableInstanceIds.includes(inst.id)).map((inst) => ({
        ...inst,
        isRecommended: inst.id === recommendedInstanceId,
      })),
    [availableInstanceIds, recommendedInstanceId]
  );

  const tierGroups = useMemo(() => groupByTier(instances), [instances]);

  const defaultOpen = useMemo(
    () => resolveDefaultOpen(instances, tierGroups, selectedInstanceId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only compute once on mount
    []
  );

  if (instances.length === 0) {
    return (
      <div className="p-6 text-center border border-destructive rounded-lg">
        <p className="text-destructive font-medium">No compatible instances available</p>
        <p className="text-destructive/70 text-sm mt-1">
          Please select a different model or contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Select Instance Type</h3>
        <p className="text-sm text-muted-foreground">
          Choose hardware configuration for your deployment. Only compatible tiers are shown.
        </p>
      </div>

      <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-1">
        {tierGroups.map((group) => (
          <TierAccordionItem
            key={group.tier}
            group={group}
            selectedInstanceId={selectedInstanceId}
            onInstanceChange={onInstanceChange}
          />
        ))}
      </Accordion>
    </div>
  );
}
