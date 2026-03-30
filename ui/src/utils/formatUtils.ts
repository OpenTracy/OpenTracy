/**
 * Format latency/time values for display
 * - Values < 1 second: shown in milliseconds (e.g., "450ms")
 * - Values >= 1 second: shown in seconds (e.g., "2.35s")
 *
 * @param seconds - Time value in seconds
 * @returns Formatted string with appropriate unit
 */
export function formatLatency(seconds: number): string {
  if (seconds === 0 || seconds === null || seconds === undefined || isNaN(seconds)) {
    return '0ms';
  }

  const ms = seconds * 1000;

  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }

  return `${seconds.toFixed(2)}s`;
}

/**
 * Format latency when the input is already in milliseconds
 * - Values < 1000ms: shown in milliseconds (e.g., "450ms")
 * - Values >= 1000ms: shown in seconds (e.g., "2.35s")
 *
 * @param ms - Time value in milliseconds
 * @returns Formatted string with appropriate unit
 */
export function formatLatencyMs(ms: number): string {
  if (ms === 0 || ms === null || ms === undefined || isNaN(ms)) {
    return '0ms';
  }

  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }

  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format cost values for display
 * - Values = 0: shown as "$0.00"
 * - Values < $0.01: shown with more decimal places
 * - Values >= $0.01: shown with 2 decimal places
 *
 * @param cost - Cost value in USD
 * @returns Formatted string with $ prefix
 */
export function formatCost(cost: number): string {
  if (cost === 0 || cost === null || cost === undefined || isNaN(cost)) {
    return '$0.00';
  }

  if (cost < 0.01) {
    return `$${cost.toFixed(8).replace(/\.?0+$/, '')}`;
  }

  return `$${cost.toFixed(2)}`;
}
