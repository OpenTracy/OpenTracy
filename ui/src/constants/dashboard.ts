// Brand grayscale - our visual identifier
export const BRAND_PURPLE = {
  DEFAULT: '#ededed', // primary brand color
  light: '#d4d4d4', // lighter accent
  dark: '#b0b0b0', // darker accent
  muted: '#333333', // subtle backgrounds
  soft: '#444444', // soft accents
};

// Consolidated chart theme using semantic tokens
export const CHART_THEME = {
  colors: {
    brand: 'hsl(var(--color-brand))', // #ededed
    accent: 'hsl(var(--color-accent))', // #ededed
    error: 'hsl(var(--color-error))', // #888888
    success: 'hsl(var(--color-success))', // #888888
    warning: 'hsl(var(--color-warning))', // #888888
  },
  palette: [
    'hsl(var(--color-brand))', // Brand light
    'hsl(var(--color-accent))', // Accent light
    'hsl(var(--color-success))', // Mid gray
    'hsl(var(--color-warning))', // Mid gray
    'hsl(var(--color-error))', // Mid gray
    '#444444', // Dark gray for variety
  ],
  grid: {
    stroke: 'hsl(var(--color-border))', // #262626
    strokeDasharray: '3 3',
  },
  axis: {
    stroke: 'hsl(var(--color-border))', // #262626
    tick: 'hsl(var(--color-foreground-muted))', // #666666
  },
  tooltip: {
    backgroundColor: 'hsl(var(--color-surface))', // #111111
    border: '1px solid hsl(var(--color-border))', // #262626
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
    padding: '8px 12px',
  },
  label: {
    color: 'hsl(var(--color-foreground-secondary))', // #a1a1a1
    fontWeight: '500',
    fontSize: '13px',
  },
  cursor: {
    fill: 'rgba(255, 255, 255, 0.1)', // white with low opacity
  },
  dot: {
    strokeColor: 'hsl(var(--color-surface))', // #111111 for dot border
  },
} as const;

// Number formatting utilities for charts
export const formatChartNumber = (value: number): string => {
  if (value === 0) return '0';

  const absValue = Math.abs(value);

  // For very small numbers (costs, rates)
  if (absValue < 0.01) {
    return value.toFixed(4);
  }

  // For small decimals
  if (absValue < 1) {
    return value.toFixed(2);
  }

  // For numbers less than 1000
  if (absValue < 1000) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }

  // For thousands
  if (absValue < 1000000) {
    const formatted = value / 1000;
    return `${formatted.toFixed(formatted < 10 ? 1 : 0)}K`;
  }

  // For millions
  if (absValue < 1000000000) {
    const formatted = value / 1000000;
    return `${formatted.toFixed(formatted < 10 ? 1 : 0)}M`;
  }

  // For billions
  const formatted = value / 1000000000;
  return `${formatted.toFixed(formatted < 10 ? 1 : 0)}B`;
};

export const formatCurrency = (value: number): string => {
  if (value === 0) return '$0.00';

  const absValue = Math.abs(value);

  if (absValue < 0.01) {
    return `$${value.toFixed(4)}`;
  }

  if (absValue < 1000) {
    return `$${value.toFixed(2)}`;
  }

  if (absValue < 1000000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }

  return `$${(value / 1000000).toFixed(1)}M`;
};

export const KPI_ICONS = {
  dollar: 'dollar',
  activity: 'activity',
  trending: 'trending',
  alert: 'alert',
} as const;

export const ALERT_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
} as const;
