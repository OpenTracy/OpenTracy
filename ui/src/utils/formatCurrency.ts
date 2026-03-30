export const centsToCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);

export const currencyToCents = (currency: string) => {
  const rawValue = currency.replace(/[^\d]/g, '');
  const numeric = rawValue ? parseInt(rawValue, 10) : 0;
  return numeric;
};

export const floatToCents = (currency: string) => {
  let sanitized = currency.replace(/[^\d.,]/g, '');
  sanitized = sanitized.replace(',', '.');
  const value = parseFloat(sanitized);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
};
