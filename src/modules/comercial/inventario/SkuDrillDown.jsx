// Drill por SKU · 4 KpiCard + desglose transpuesto (métricas × almacén) + POs en tránsito.
// Se monta dentro de TablaCompacta (renderExpandido).
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { KpiCard, Pill, TablaCompacta } from '../../../components/kit';
import {
  ALM_COMERCIALES, CEDIS_DE_ALMACEN, NOMBRES_ALMACEN, shortAlmacen,
  fmtCompact, fmtInt, fmtDias, fmtFechaCorta, diasHasta, tonoCobertura, etiquetaCobertura,
} from './constantes';

const TONO_ESTATUS = {
  'TRANSITO MARITIMO': 'blue', 'PROXIMO A ZARPAR': 'purple', 'EN RESGUARDO': 'green',
  'EN ESPERA DE CONSOLIDAR': 'orange', 'EN PRODUCCION': 'gray', 'Pendiente modular': 'gray',
};

export default function SkuDrillDown({ row, almacenes }) {
  const { theme } = useTheme();
  const green = theme.green, orange = theme.orange;
  const totalRes = row.totalRes, totalDisp = row.totalDisp;
  const pctRes = row.totalPz > 0 ? (totalRes / row.totalPz) * 100 : 0;
  const tieneStock = row.totalPz > 0;

  // Columnas: almacenes del grid + "Otros" (comerciales fuera del grid con stock)
  const otros = useMemo(() => Object.keys(row.byAlm).map(Number).filter((a) => !almacenes.includes(a) && ALM_COMERCIALES.has(a) && (row.byAlm[a]?.pz || 0) > 0), [row, almacenes]);
  const noComerciales = useMemo(() => Object.keys(row.byAlm).map(Number).filter((a) => !ALM_COMERCIALES.has(a) && (row.byAlm[a]?.pz || 0) > 0), [row]);
  const nAlm = Object.values(row.byAlm).filter((d) => (d?.pz || 0) > 0).length;

  const agg = (lista) => lista.reduce((s, a) => { const d = row.byAlm[a]; if (!d) return s; return { pz: s.pz + d.pz, disp: s.disp + d.disp, res: s.res + d.res, valor: s.valor + d.valor }; }, { pz: 0, disp: 0, res: 0, valor: 0 });
  const cols = [
    ...almacenes.map((a) => ({ id: `a${a}`, label: shortAlmacen(a), sub: CEDIS_DE_ALMACEN[a] || '—', title: NOMBRES_ALMACEN[a], d: row.byAlm[a] })),
    ...(otros.length ? [{ id: 'otros', label: 'OTROS', sub: otros.map(shortAlmacen).join(' · '), title: otros.map((a) => NOMBRES_ALMACEN[a]).join(' · '), d: agg(otros) }] : []),
    ...(noComerciales.length ? [{ id: 'nocom', label: 'NO COM.', sub: `${noComerciales.length} alm.`, title: noComerciales.map((a) => `${a} · ${NOMBRES_ALMACEN[a] || ''}`).join(' · '), d: agg(noComerciales) }] : []),
  ];

  const dash = <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
  const val = (n, color, bold = true) => <span style={{ color: color || theme.text, fontWeight: bold ? 600 : 500 }}>{n}</span>;
  const metricas = [
    { k: 'total', metrica: 'Total', sub: 'piezas', cell: (d) => (d?.pz > 0 ? val(fmtInt(d.pz)) : dash) },
    { k: 'res', metrica: 'Reservado', sub: 'órdenes en curso', cell: (d) => (!d || d.pz === 0 ? dash : d.res > 0 ? val(fmtInt(d.res), orange, false) : <span style={{ color: theme.textMuted }}>—</span>) },
    { k: 'disp', metrica: 'Disponible', sub: 'listo para venta', cell: (d) => (d?.pz > 0 ? val(fmtInt(d.disp), green, false) : dash) },
    { k: 'valor', metrica: 'Valor', sub: 'a costo', cell: (d) => (d?.pz > 0 ? val(fmtCompact(d.valor)) : dash) },
    {
      k: 'comp', metrica: 'Composición', sub: 'reservado / disp', cell: (d) => {
        if (!d || d.pz === 0) return dash;
        const pctR = (d.res / d.pz) * 100, pctD = (d.disp / d.pz) * 100;
        return (
          <div style={{ display: 'flex', height: 5, borderRadius: 999, overflow: 'hidden', background: theme.divider || theme.border, marginLeft: 'auto', minWidth: 54, maxWidth: 90 }}>
            <span style={{ width: `${pctR}%`, background: orange }} />
            <span style={{ width: `${pctD}%`, background: green }} />
          </div>
        );
      },
    },
    { k: 'pct', metrica: '% del SKU', sub: 'participación', cell: (d) => (!d || d.pz === 0 || row.totalPz === 0 ? dash : <span style={{ color: theme.textMuted }}>{((d.pz / row.totalPz) * 100).toFixed(1)}%</span>) },
  ];
  const columnas = [
    { key: 'metrica', label: 'Métrica', align: 'left', width: 150, render: (r) => (<span><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, color: theme.text }}>{r.metrica}</span><span style={{ display: 'block', fontSize: 9.5, color: theme.textMuted }}>{r.sub}</span></span>) },
    ...cols.map((c) => ({
      key: c.id,
      label: <span title={c.title}><span style={{ color: theme.text }}>{c.label}</span><span style={{ display: 'block', fontSize: 8.5, fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: theme.textMuted }}>{c.sub}</span></span>,
      render: (r) => r.cells[c.id],
    })),
  ];
  const filas = metricas.map((m) => ({ id: m.k, metrica: m.metrica, sub: m.sub, cells: Object.fromEntries(cols.map((c) => [c.id, m.cell(c.d)])) }));

  // Tránsito
  const pos = row.transito?.pos || [];
  const cob = row.coberturaDias;
  const colsPo = [
    { key: 'po', label: 'PO', align: 'left', mono: true, bold: true },
    { key: 'estatus', label: 'Estatus', align: 'left', render: (p) => <Pill tone={TONO_ESTATUS[p.estatus] || 'gray'} size="xs">{p.estatus || '—'}</Pill> },
    { key: 'cantidad', label: 'Pendiente', render: (p) => fmtInt(p.cantidad), sum: true, renderTotal: (v) => fmtInt(v) },
    { key: 'etd', label: 'ETD', render: (p) => fmtFechaCorta(p.etd) },
    {
      key: 'eta', label: 'ETA CEDIS', render: (p) => {
        const d = diasHasta(p.eta);
        const tarde = d != null && cob != null && isFinite(cob) && tieneStock && cob < d;
        const tone = d == null ? 'gray' : d < 0 ? 'orange' : tarde || !tieneStock ? 'red' : 'green';
        return (<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{fmtFechaCorta(p.eta)}<Pill tone={tone} size="xs">{d == null ? 'sin fecha' : d < 0 ? `${Math.abs(d)} d atrás` : `en ${d} d`}</Pill></span>);
      },
    },
    { key: 'cedis', label: 'CEDIS', align: 'left', render: (p) => p.cedis || '—' },
    { key: 'contenedor', label: 'Contenedor', align: 'left', mono: true, render: (p) => p.contenedor || '—' },
  ];

  const tono = tonoCobertura(cob, tieneStock);
  const colorTono = { red: theme.red, orange: theme.orange, green: theme.green, gray: theme.textMuted }[tono];

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText, background: theme.bg }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Total inventario" big={fmtInt(row.totalPz)} bigSmall="pz" sub={`${fmtCompact(row.valor)} · ${nAlm} almacenes`} />
        <KpiCard eyebrow="Disponible" big={fmtInt(totalDisp)} bigSmall="pz" bigColor={green} sub={`${(100 - pctRes).toFixed(1)}% · listo para venta`} />
        <KpiCard eyebrow="Reservado" big={fmtInt(totalRes)} bigSmall="pz" bigColor={totalRes > 0 ? orange : theme.text} sub={`${pctRes.toFixed(1)}% del total · ${pctRes > 40 ? 'alto compromiso' : 'rotación saludable'}`}
          badge={{ tone: pctRes > 40 ? 'orange' : pctRes > 20 ? 'blue' : 'green', l: pctRes > 40 ? 'Alta reserva' : pctRes > 20 ? 'Normal' : 'Baja reserva' }} />
        <KpiCard eyebrow="Cobertura" big={cob == null || !isFinite(cob) ? (tieneStock ? '∞' : '0') : fmtInt(cob)} bigSmall="días" bigColor={colorTono}
          badge={{ tone: tono, l: etiquetaCobertura(cob, tieneStock) }}
          sub={`${row.demandaMes > 0 ? `${fmtInt(row.demandaMes)} pz/mes ERP (3 m)` : 'sin demanda ERP en 3 m'} · lead time ${row.leadTime ? fmtDias(row.leadTime.dias) : '—'}`} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 6px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>Desglose por almacén</span>
          <span style={{ fontSize: 10, color: theme.textMuted }}>métricas × {cols.length} columnas · comerciales</span>
        </div>
        <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.id} dense />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 6px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>En tránsito</span>
          <span style={{ fontSize: 10, color: theme.textMuted }}>
            {pos.length ? `${fmtInt(row.transitoPz)} pz en ${pos.length} PO${pos.length > 1 ? 's' : ''} · ${fmtCompact(row.transitoValor)} a costo${row.transito?.supplier ? ` · ${row.transito.supplier}` : ''}` : 'sin embarques pendientes'}
          </span>
        </div>
        {pos.length > 0 && <TablaCompacta columnas={colsPo} filas={pos} rowKey={(p, i) => `${p.po}-${i}`} dense />}
      </div>
    </div>
  );
}
