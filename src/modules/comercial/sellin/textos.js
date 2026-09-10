// Sell In consolidado · helpers compartidos (búsqueda sin acentos, formatos, colores por año/roadmap/canal).

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const CLIENTES_CLAVE = ['digitalife', 'pcel', 'dicotech'];

// ── Búsqueda ──
/** 'Mouse Inalámbrico Óptico' → 'mouse inalambrico optico' (NFD + sin diacríticos + minúsculas). */
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** 'mouse  inalámbrico negro' → ['mouse', 'inalambrico', 'negro'] */
export const tokens = (q) => normalizar(q).split(/\s+/).filter(Boolean);
/** Todas las palabras aparecen en el texto normalizado, en cualquier orden. */
export const coincide = (hayNormalizado, toks) => toks.every((t) => hayNormalizado.includes(t));

// ── Texto ──
export const capitalizar = (s) => { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ''; };
const CANAL_LABEL = { MAYOREO: 'Mayoreo', DISTRIBUIDOR: 'Distribuidor', 'E-COMMERCE': 'E-commerce', MOSTRADOR: 'Mostrador', 'RETAIL PROPIOS': 'Retail propios', 'RETAIL REPRESENTADOS': 'Retail representados', OTROS: 'Otros' };
export const canalLabel = (c) => { const k = String(c || '').trim().toUpperCase(); return CANAL_LABEL[k] || capitalizar(k) || 'Otros'; };

// ── Números ──
export const N = (v) => Number(v) || 0;
export const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
export const fmtPct = (n, d = 0) => (n == null || !isFinite(n) ? '—' : `${n.toFixed(d)}%`);
export const fmtMoneyShort = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
export const pctDelta = (act, prev) => (prev ? ((act - prev) / Math.abs(prev)) * 100 : null);

// ── Colores ──
/** Año en curso = accent; los anteriores se reparten entre morado / gris / naranja / teal (mismo criterio que SellInClienteV2). */
export function anioColor(y, aniosSel, theme) {
  const anioNow = new Date().getFullYear();
  if (y === anioNow) return theme.accent || '#007AFF';
  const paleta = [theme.purple || '#AF52DE', theme.textMuted || '#8E8E93', theme.orange || '#FF9500', theme.teal || '#5AC8FA', theme.pink || '#FF2D55'];
  const prev = (aniosSel || []).filter((yy) => yy !== anioNow).sort((a, b) => b - a);
  const idx = prev.indexOf(y);
  return paleta[(idx < 0 ? 0 : idx) % paleta.length];
}
export const ROADMAP_TONE = { RMI: 'blue', RML: 'purple', RMS: 'red', 2026: 'orange', 2027: 'orange' };
export const roadmapTone = (rdmp) => ROADMAP_TONE[String(rdmp || '').toUpperCase()] || 'gray';
export const canalTone = (canal) => ({ MAYOREO: 'purple', DISTRIBUIDOR: 'blue', 'E-COMMERCE': 'teal', MOSTRADOR: 'green', 'RETAIL PROPIOS': 'red', 'RETAIL REPRESENTADOS': 'orange' }[String(canal || '').toUpperCase()] || 'gray');
export const CAT_COLORS = ['#007AFF', '#AF52DE', '#34C759', '#FF9500', '#FF2D55', '#5AC8FA', '#8E8E93', '#FF6B22'];

/** Últimos `n` meses hasta hoy (incluido), como [{ anio, mes, key }]. */
export function ultimosMeses(n = 6, hoy = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}` });
  }
  return out;
}
/** 3 meses cerrados anteriores al actual (regla de Inventario para la demanda ERP). */
export const mesesCerrados = (n = 3, hoy = new Date()) => {
  const out = [];
  for (let i = n; i >= 1; i--) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}` }); }
  return out;
};
