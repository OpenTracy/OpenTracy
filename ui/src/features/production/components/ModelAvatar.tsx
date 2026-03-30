import type { SVGProps } from 'react';
import { Cpu } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ModelAvatarProps {
  icon: React.ComponentType<SVGProps<SVGSVGElement>> | string | null;
  size?: 'sm' | 'md';
}

export function ModelAvatar({ icon, size = 'md' }: ModelAvatarProps) {
  const sizeClass = size === 'sm' ? 'size-8' : 'size-10';
  const iconSize = size === 'sm' ? 'size-4' : 'size-5';

  if (typeof icon === 'string') {
    return <img src={icon} alt="Model icon" className={`${sizeClass} rounded-full`} />;
  }

  const IconComponent = icon;

  return (
    <Avatar className={sizeClass}>
      <AvatarFallback className="bg-muted text-muted-foreground">
        {IconComponent ? <IconComponent className={iconSize} /> : <Cpu className={iconSize} />}
      </AvatarFallback>
    </Avatar>
  );
}
