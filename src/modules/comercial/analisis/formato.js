// Formateadores de Análisis por Cliente (compactos para hero/KPIs, completos para tabla).
export const money = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a).toLocaleString('es-MX')}`;
};
export const moneyFull = (n) => (n == null || isNaN(n) ? '—' : `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('es-MX')}`);
export const int = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
export const pct = (n, d = 1) => (n == null || isNaN(n) ? '—' : `${n.toFixed(d)}%`);
export const signo = (n, d = 1) => (n == null || isNaN(n) ? '—' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}%`);
export const toneDe = (n) => (n == null ? 'gray' : n >= 0 ? 'green' : 'red');

export const toneCanal = (canal) => {
  const c = String(canal || '').toUpperCase();
  if (c.startsWith('MAYO')) return 'purple';
  if (c.startsWith('DISTRIB')) return 'blue';
  if (c.startsWith('E-COM')) return 'orange';
  if (c.startsWith('MOSTR')) return 'green';
  if (c.startsWith('RETAIL')) return 'pink';
  return 'gray';
};
export const labelCanal = (canal) => {
  const c = String(canal || '').toUpperCase();
  if (c === 'E-COMMERCE') return 'E-com';
  if (c === 'RETAIL REPRESENTADOS') return 'Retail rep.';
  if (c === 'RETAIL PROPIOS') return 'Retail prop.';
  if (c === 'DISTRIBUIDOR') return 'Distrib.';
  return c ? c.charAt(0) + c.slice(1).toLowerCase() : '—';
};
