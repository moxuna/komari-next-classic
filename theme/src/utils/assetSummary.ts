export function normalizeCurrency(input?: string) {
  const raw = String(input || '').trim();
  if (!raw) return 'CNY';
  const upper = raw.toUpperCase();
  if (['$', 'US$', 'USD'].includes(upper)) return 'USD';
  if (['￥', '¥', 'CNY', 'RMB', 'CN¥'].includes(upper)) return 'CNY';
  if (['EUR', '€'].includes(upper)) return 'EUR';
  if (['GBP', '£'].includes(upper)) return 'GBP';
  if (['JPY', 'JP¥', 'JPY¥', '円', '¥JPY'].includes(upper)) return 'JPY';
  if (['AUD', 'A$', 'AU$'].includes(upper)) return 'AUD';
  if (['SGD', 'S$'].includes(upper)) return 'SGD';
  if (['MYR', 'RM'].includes(upper)) return 'MYR';
  return upper;
}

