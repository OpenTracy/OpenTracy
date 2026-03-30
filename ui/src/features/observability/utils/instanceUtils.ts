/**
 * Maps AWS instance types to their corresponding GPU information.
 */
interface GPUInfo {
  name: string;
  size: string;
}

const instanceGPUMap: Record<string, GPUInfo> = {
  // G5 instances (NVIDIA A10G)
  'ml.g5.xlarge': { name: 'NVIDIA A10G', size: 'Small' },
  'ml.g5.2xlarge': { name: 'NVIDIA A10G', size: 'Medium' },
  'ml.g5.4xlarge': { name: 'NVIDIA A10G', size: 'Large' },
  'ml.g5.8xlarge': { name: 'NVIDIA A10G', size: 'XLarge' },
  'ml.g5.12xlarge': { name: 'NVIDIA A10G', size: 'XXLarge' },
  'ml.g5.16xlarge': { name: 'NVIDIA A10G', size: 'XXXLarge' },
  'ml.g5.24xlarge': { name: 'NVIDIA A10G', size: 'Massive' },
  'ml.g5.48xlarge': { name: 'NVIDIA A10G', size: 'Ultra' },

  // P4 instances (NVIDIA A100)
  'ml.p4d.24xlarge': { name: 'NVIDIA A100', size: 'Large' },
  'ml.p4de.24xlarge': { name: 'NVIDIA A100', size: 'XLarge' },

  // P5 instances (NVIDIA H100)
  'ml.p5.48xlarge': { name: 'NVIDIA H100', size: 'Ultra' },

  // G4dn instances (NVIDIA T4)
  'ml.g4dn.xlarge': { name: 'NVIDIA T4', size: 'Small' },
  'ml.g4dn.2xlarge': { name: 'NVIDIA T4', size: 'Medium' },
  'ml.g4dn.4xlarge': { name: 'NVIDIA T4', size: 'Large' },
  'ml.g4dn.8xlarge': { name: 'NVIDIA T4', size: 'XLarge' },
  'ml.g4dn.12xlarge': { name: 'NVIDIA T4', size: 'XXLarge' },
  'ml.g4dn.16xlarge': { name: 'NVIDIA T4', size: 'XXXLarge' },

  // CPU instances
  'ml.c5.large': { name: 'CPU', size: 'Small' },
  'ml.c5.xlarge': { name: 'CPU', size: 'Medium' },
  'ml.c5.2xlarge': { name: 'CPU', size: 'Large' },
  'ml.c5.4xlarge': { name: 'CPU', size: 'XLarge' },
  'ml.c5.9xlarge': { name: 'CPU', size: 'XXLarge' },
  'ml.c5.18xlarge': { name: 'CPU', size: 'XXXLarge' },

  // Memory optimized instances
  'ml.r5.large': { name: 'Memory Optimized', size: 'Small' },
  'ml.r5.xlarge': { name: 'Memory Optimized', size: 'Medium' },
  'ml.r5.2xlarge': { name: 'Memory Optimized', size: 'Large' },
  'ml.r5.4xlarge': { name: 'Memory Optimized', size: 'XLarge' },
  'ml.r5.12xlarge': { name: 'Memory Optimized', size: 'XXLarge' },
  'ml.r5.24xlarge': { name: 'Memory Optimized', size: 'XXXLarge' },
};

/**
 * Formats an AWS instance type to a user-friendly display format
 * showing the GPU type and size.
 *
 * @param instanceType - e.g. 'ml.g5.2xlarge'
 * @returns e.g. 'NVIDIA A10G (Medium)'
 */
export function formatInstanceType(instanceType: string): string {
  if (!instanceType) return 'Unknown Instance';

  const gpuInfo = instanceGPUMap[instanceType];
  if (gpuInfo) return `${gpuInfo.name} (${gpuInfo.size})`;

  // For unknown instance types, try to extract info from the name
  if (instanceType.startsWith('ml.')) {
    const parts = instanceType.split('.');
    if (parts.length >= 3) {
      const family = parts[1].toUpperCase();
      const size = parts[2].replace('xlarge', 'XL');
      return `${family} (${size})`;
    }
  }

  return instanceType;
}
