import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type PageTab<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

interface PageTabsProps<T extends string> {
  tabs: PageTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
}

export function PageTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  className,
}: PageTabsProps<T>) {
  return (
    <div className="border-b border-border px-6">
      <Tabs
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
        className={cn('w-full', className)}
      >
        <TabsList variant="line">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              aria-disabled={tab.disabled || undefined}
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
