// Tabla SKU × listas (kit TablaCompacta): orden por columna (default = orden del roadmap), un SKU abierto a la vez
// (renderExpandido → DrillSku). Mayoreo AAA siempre primero; promo del mes como pill; flecha ↑/↓ cuando el precio
// cambió este mes (v_precios_cambios_mes); margen por lista en tooltip y columna "Margen AAA" sólo con permiso sensible.
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Pill } from '../../../components/kit';
import DrillSku from './DrillSku';
import { precioEfectivo } from './calculo';
import { fmtMoney, fmtInt, fmtPct, fmtPctDelta, listaLbl, roadmapTone, periodoLbl } from './textos';

export default function TablaPrecios({ filas, listas, sensible, orden, onSort, skuAbierto, onToggle, periodo }) {
  const { theme } = useTheme();
  const green = theme.green || '#34C759', red = theme.red || '#FF3B30', orange = theme.orange || '#FF9500', purple = theme.purple || '#AF52DE';
  const tonoMargen = (m) => (m == null ? theme.textMuted : m < 10 ? red : m < 20 ? orange : theme.text);

  const columnas = [
    { key: 'marca', label: 'Marca', align: 'left', sort: true, width: 70, render: (r) => <span style={{ color: theme.textMuted, fontSize: 10.5, fontWeight: 500 }}>{r.marca || '—'}</span> },
    { key: 'sku', label: 'SKU', align: 'left', sort: true, mono: true, width: 110, render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 10.5 }}>
        <ChevronRight size={11} strokeWidth={2.4} style={{ color: theme.accent || '#007AFF', flexShrink: 0, transform: skuAbierto === r.sku ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
        {r.sku}
      </span>
    ) },
    { key: 'descripcion', label: 'Descripción', align: 'left', sort: true, maxWidth: 320, render: (r) => <span title={r.descripcion} style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>{r.descripcion || '—'}</span> },
    { key: 'rdmp', label: 'Roadmap', align: 'center', sort: true, width: 70, render: (r) => (r.rdmp ? <Pill tone={roadmapTone(r.rdmp)} size="xs">{r.rdmp}</Pill> : <span style={{ color: theme.textSubtle }}>—</span>) },
    { key: 'bajo', label: 'Precio bajo', align: 'right', sort: true, width: 96, render: (r) => (r.bajo
      ? <span title={`${r.bajo.cliente} · ${fmtInt(r.bajo.piezas)} pz · lista ${listaLbl(r.bajo.lista)} ${fmtMoney(r.bajo.precioLista)} (${fmtPctDelta(r.bajo.difPct)})`} style={{ color: orange, fontWeight: 600 }}>{fmtMoney(r.bajo.real)}</span>
      : <span style={{ color: theme.textSubtle }}>—</span>) },
    ...listas.map((l) => ({
      key: `p:${l}`, label: listaLbl(l), align: 'right', sort: true, bold: l === 'Mayoreo AAA',
      render: (r) => {
        const p = precioEfectivo(r.precios, r.promo, l);
        if (p == null) return <span style={{ color: theme.textSubtle, fontWeight: 400 }}>—</span>;
        const c = r.cambios[l]; const cambioMes = c && periodo && c.anio === periodo.anio && c.mes === periodo.mes && (c.tipo === 'subio' || c.tipo === 'bajo') ? c : null;
        const m = sensible ? r.margen[l] : null;
        const partes = [];
        if (l === 'Mayoreo AAA' && r.promo) partes.push(`Promo −${(r.promo.promo_pct * 100).toFixed(1)}% · lista ${fmtMoney(r.precios[l])}`);
        if (cambioMes) partes.push(`${c.tipo === 'subio' ? 'Subió' : 'Bajó'} de ${fmtMoney(c.precio_anterior)} (${periodoLbl(c.anio_prev, c.mes_prev)}) · ${fmtPctDelta(Number(c.delta_pct))}`);
        if (m != null) partes.push(`Margen ${fmtPct(m, 1)} · costo ${fmtMoney(r.costo)}`);
        return (
          <span title={partes.join('\n') || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
            {cambioMes && <span style={{ color: cambioMes.tipo === 'subio' ? green : red, fontSize: 10, fontWeight: 700 }}>{cambioMes.tipo === 'subio' ? '↑' : '↓'}</span>}
            {fmtMoney(p)}
            {l === 'Mayoreo AAA' && r.promo && <Pill tone="purple" size="xs" style={{ color: purple }}>−{Math.round(r.promo.promo_pct * 100)}%</Pill>}
          </span>
        );
      },
    })),
    ...(sensible ? [{ key: 'margenAAA', label: 'Margen AAA', align: 'right', sort: true, width: 84, render: (r) => {
      const m = r.margen['Mayoreo AAA'];
      return m == null ? <span style={{ color: theme.textSubtle }}>—</span> : <span title={`costo promedio ${fmtMoney(r.costo)}`} style={{ color: tonoMargen(m), fontWeight: 600 }}>{fmtPct(m, 1)}</span>;
    } }] : []),
  ];

  return (
    <TablaCompacta
      columnas={columnas} filas={filas} rowKey={(r) => r.sku} maxHeight="70vh"
      orden={orden} onSort={onSort}
      onRowClick={(r) => onToggle(skuAbierto === r.sku ? null : r.sku)}
      expandidoKey={skuAbierto}
      renderExpandido={(r) => <DrillSku row={r} sensible={sensible} onClose={() => onToggle(null)} />}
      vacio="Ningún SKU coincide con la búsqueda o los filtros."
    />
  );
}
