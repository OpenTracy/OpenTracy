import type { DeploymentModel } from '@/types/deploymentTypes';
import type { ModelSpecs } from '@/features/production/types/modelSpecsModal.types';

export function extractModelSpecs(model: DeploymentModel): ModelSpecs {
  const name = model.name.toLowerCase();
  const description = model.description.toLowerCase();

  return {
    parameters: extractParameters(name, description),
    modelType: extractModelType(description),
    useCases: extractUseCases(description),
    optimization: extractOptimization(description),
  };
}

function extractParameters(name: string, description: string): string {
  const match = name.match(/(\d+)b/) ?? description.match(/(\d+)b/);
  return match ? `${match[1]}B parameters` : 'Unknown';
}

function extractModelType(description: string): string {
  if (description.includes('multimodal')) return 'Multimodal Model';
  if (description.includes('code')) return 'Code Generation Model';
  if (description.includes('reasoning')) return 'Reasoning Model';
  return 'Language Model';
}

function extractUseCases(description: string): string[] {
  const useCases: string[] = [];

  if (description.includes('dialogue') || description.includes('instruction')) {
    useCases.push('Conversational AI');
  }
  if (description.includes('code') || description.includes('coding')) {
    useCases.push('Code Generation');
  }
  if (description.includes('reasoning')) useCases.push('Complex Reasoning');
  if (description.includes('multilingual')) useCases.push('Multilingual Tasks');
  if (description.includes('research')) useCases.push('Research & Analysis');

  return useCases.length > 0 ? useCases : ['General Purpose'];
}

function extractOptimization(description: string): string {
  if (
    description.includes('lightweight') ||
    description.includes('compact') ||
    description.includes('efficient')
  ) {
    return 'Lightweight & Efficient';
  }
  if (description.includes('optimized')) return 'Performance Optimized';
  if (description.includes('distilled')) return 'Knowledge Distilled';
  return 'Standard';
}
