// Cuánto vale cada categoría en sell in y en sell out (2026-10-02, Fernando: «más que mejores SKUs es más importante
// ver cuánto vale cada categoría en cuanto a sell in y sell out»). Sell in = YTD del cliente (mv_analisis_cliente_sku_mes,
// categoría del roadmap o del ERP); sell out = YTD de la cuenta ligada (mv_sellout_cuenta_sku_mes.categoria).
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, TablaCompacta } from '../../../components/kit';
import { useDrillSkus } from '../sellout/datos';
import { money, pct } from './formato';

const N = (v) => Number(v) || 0;
const norm = (s) => String(s || 'Sin categoría').trim();

export default function CategoriasSiSo({ categoriasSellIn = [], cuenta, anio, mesMax, titulo = 'Categorías · sell in vs sell out' }) {
  const { theme } = useTheme();
  const { data: skus = [], isLoading } = useDrillSkus(cuenta, anio, !!cuenta);
  const filas = useMemo(() => {
    const m = new Map();
    categoriasSellIn.forEach((c) => { const k = norm(c.nombre).toLowerCase(); m.set(k, { nombre: norm(c.nombre), si: N(c.monto), so: 0 }); });
    let soTotal = 0;
    skus.forEach((r) => { if (N(r.anio) !== anio || N(r.mes) > mesMax) return; const nombre = norm(r.categoria); const k = nombre.toLowerCase(); const o = m.get(k) || (m.set(k, { nombre, si: 0, so: 0 }), m.get(k)); o.so += N(r.importe); soTotal += N(r.importe); });
    const siTotal = [...m.values()].reduce((s, x) => s + x.si, 0);
    return [...m.values()].map((x) => ({ ...x, pctSi: siTotal ? (x.si / siTotal) * 100 : null, pctSo: soTotal ? (x.so / soTotal) * 100 : null, soSi: x.si > 0 && x.so > 0 ? x.so / x.si : null })).sort((a, b) => (b.si + b.so) - (a.si + a.so));
  }, [categoriasSellIn, skus, anio, mesMax]);
  const maxSi = Math.max(1, ...filas.map((f) => f.si)), maxSo = Math.max(1, ...filas.map((f) => f.so));
  const barra = (v, max, color) => <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, height: 5, borderRadius: 999, background: `${theme.text}10`, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(v / max) * 100}%`, background: color, borderRadius: 999 }} /></div></div>;
  return (
    <Panel titulo={titulo} meta={`YTD ${anio}${cuenta ? ' · sell out de la cuenta ligada' : ' · este cliente no reporta sell out'}`} padding="0 0 2px">
      <TablaCompacta dense maxHeight={420} rowKey={(r) => r.nombre} filas={filas} vacio="Sin ventas en el año."
        columnas={[
          { key: 'nombre', label: 'Categoría', align: 'left', maxWidth: 200, render: (r) => <span style={{ fontWeight: 500 }} title={r.nombre}>{r.nombre}</span> },
          { key: 'si', label: 'Sell in', width: 84, bold: true, render: (r) => money(r.si) },
          { key: 'bsi', label: '', width: 90, render: (r) => barra(r.si, maxSi, theme.accent) },
          { key: 'pctSi', label: '%', width: 48, render: (r) => <span style={{ color: theme.textMuted }}>{r.pctSi == null ? '—' : pct(r.pctSi, 0)}</span> },
          ...(cuenta ? [
            { key: 'so', label: 'Sell out', width: 84, bold: true, render: (r) => (r.so ? money(r.so) : <span style={{ color: theme.textMuted }}>—</span>) },
            { key: 'bso', label: '', width: 90, render: (r) => barra(r.so, maxSo, theme.green) },
            { key: 'pctSo', label: '%', width: 48, render: (r) => <span style={{ color: theme.textMuted }}>{r.pctSo == null ? '—' : pct(r.pctSo, 0)}</span> },
            { key: 'soSi', label: 'SO / SI', width: 60, render: (r) => (r.soSi == null ? <span style={{ color: theme.textMuted }}>—</span> : <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: r.soSi >= 1 ? theme.green : r.soSi < 0.6 ? theme.orange : theme.text }}>{r.soSi.toFixed(2)}</span>) },
          ] : []),
        ]} />
      {isLoading && cuenta && <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '4px 10px' }}>Cargando sell out…</div>}
    </Panel>
  );
}
