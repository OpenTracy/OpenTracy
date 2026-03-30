import { useState, useEffect, useRef } from 'react';

interface UseAnimatedValueOptions {
  duration?: number;
  easing?: (t: number) => number;
}

// Easing functions
const easings = {
  // Smooth ease out
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  // Smooth ease in-out
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // Quick start, slow end
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
};

/**
 * Hook to animate a numeric value with smooth transitions
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedValueOptions = {}
): number {
  const { duration = 500, easing = easings.easeOutCubic } = options;

  const [displayValue, setDisplayValue] = useState(targetValue);
  const animationRef = useRef<number | null>(null);
  const startValueRef = useRef(targetValue);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const currentValue =
        startValueRef.current + (targetValue - startValueRef.current) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, easing]);

  return displayValue;
}

/**
 * Parse a formatted string value and extract the numeric part
 * Returns the number and the format pattern
 */
export function parseFormattedValue(value: string): {
  number: number;
  prefix: string;
  suffix: string;
} {
  // Handle special cases
  if (value === '—' || value === 'N/A' || value === '-') {
    return { number: 0, prefix: '', suffix: value };
  }

  // Match patterns like "$1,234.56", "99.9%", "1.5K", "2.3M", "1,234 ms", "1.23 s", etc.
  const match = value.match(/^([^0-9-]*)([-]?[\d,]+\.?\d*)\s*([A-Za-z%¢$€£]*\s*[A-Za-z%¢$€£]*)$/);

  if (!match) {
    return { number: 0, prefix: '', suffix: value };
  }

  const [, prefix, numStr, suffix] = match;
  const number = parseFloat(numStr.replace(/,/g, ''));

  return { number: isNaN(number) ? 0 : number, prefix: prefix || '', suffix: suffix || '' };
}

/**
 * Format a number back to a string with the original format
 */
export function formatAnimatedValue(
  value: number,
  prefix: string,
  suffix: string,
  originalValue: string
): string {
  // Handle special cases
  if (originalValue === '—' || originalValue === 'N/A' || originalValue === '-') {
    return originalValue;
  }

  // Determine decimal places from original
  const decimalMatch = originalValue.match(/\.(\d+)/);
  const decimals = decimalMatch ? decimalMatch[1].length : 0;

  // Format with thousand separators if original had them
  const hasThousandSeparator = originalValue.includes(',');

  let formattedNumber: string;
  if (hasThousandSeparator) {
    formattedNumber = value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } else {
    formattedNumber = value.toFixed(decimals);
  }

  return `${prefix}${formattedNumber}${suffix ? ' ' + suffix.trim() : ''}`.trim();
}

/**
 * Hook to animate a formatted string value (like "$1,234.56" or "99.9%")
 */
export function useAnimatedFormattedValue(
  value: string,
  options: UseAnimatedValueOptions = {}
): string {
  const { number, prefix, suffix } = parseFormattedValue(value);
  const animatedNumber = useAnimatedNumber(number, options);

  return formatAnimatedValue(animatedNumber, prefix, suffix, value);
}

export { easings };
