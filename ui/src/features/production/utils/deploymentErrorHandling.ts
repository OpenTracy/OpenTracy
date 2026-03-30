export interface DeploymentError {
  error_code: string;
  error_message: string;
  user_message: string;
  retryable: boolean;
}

export function getDefaultUserMessage(errorCode: string): string {
  switch (errorCode) {
    case 'model_too_large':
      return 'The model is too large for the selected GPU. Choose an instance with more VRAM or use quantization (AWQ/GPTQ).';
    case 'no_spot_capacity':
      return 'Could not allocate the instance. There may be no Spot instances available in the region.';
    case 'gpu_unavailable':
      return 'No GPUs are currently available. This may be due to lack of Spot instances or all GPUs are in use.';
    case 'startup_crash':
      return 'The container is failing to start. Please check the vLLM parameters or try a different configuration.';
    case 'image_pull_error':
      return 'Failed to download the container image. Please verify the model configuration.';
    case 'node_not_ready':
      return 'The instance was interrupted (possible Spot preemption). The deployment will be recreated automatically.';
    case 'network_error':
      return 'A network error occurred. Please check your connection and try again.';
    default:
      return 'An unexpected error occurred. Please try again or contact support.';
  }
}

export function getErrorDisplay(errorCode: string) {
  const displays: Record<
    string,
    { title: string; icon: string; colorClass: string; bgClass: string; borderClass: string }
  > = {
    model_too_large: {
      title: 'Model Too Large',
      icon: 'hard-drive',
      colorClass: 'text-error',
      bgClass: 'bg-error/10',
      borderClass: 'border-error/20',
    },
    no_spot_capacity: {
      title: 'Instance Unavailable',
      icon: 'cloud-off',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/20',
    },
    gpu_unavailable: {
      title: 'GPU Unavailable',
      icon: 'alert-circle',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/20',
    },
    startup_crash: {
      title: 'Startup Failed',
      icon: 'server-crash',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/20',
    },
    image_pull_error: {
      title: 'Image Download Failed',
      icon: 'download',
      colorClass: 'text-brand',
      bgClass: 'bg-brand/10',
      borderClass: 'border-brand/20',
    },
    node_not_ready: {
      title: 'Instance Interrupted',
      icon: 'alert-circle',
      colorClass: 'text-accent-light',
      bgClass: 'bg-accent/10',
      borderClass: 'border-accent/20',
    },
    network_error: {
      title: 'Network Error',
      icon: 'wifi-off',
      colorClass: 'text-foreground-secondary',
      bgClass: 'bg-background-secondary',
      borderClass: 'border-border',
    },
    unknown: {
      title: 'Deployment Failed',
      icon: 'alert-circle',
      colorClass: 'text-error',
      bgClass: 'bg-error/10',
      borderClass: 'border-error/20',
    },
  };

  return displays[errorCode] || displays.unknown;
}
