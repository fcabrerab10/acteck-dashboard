// Tabla principal del S&OP · TablaCompacta del kit (orden por columnas, totales, drill con renderExpandido —
// un SKU abierto a la vez). La celda "Sugerido" conserva la píldora azul (agregar) / verde (en export) con sus notas
// (⭐ crítico · ↓ tendencia · ⚡ concentración). Extraída de ForecastClientesTab.jsx (V3).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { TablaCompacta, Pill } from '../../../components/kit';
import { roadmapTone } from '../sellin/textos';
import { fmtInt, fmtDias, tonoCobertura, MONO } from '../inventario/constantes';
import DrillSku from './DrillSku';

const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export const fmtEtaCorta = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m) return null;
  return `${d} ${MES_CORTO[m - 1]} ${String(y).slice(2)}`;
};

function SugNota({ kind, tip }) {
  const map = {
    crit: { tone: 'yellow', ch: '⭐' },
    tend: { tone: 'red', ch: '↓' },
    conc: { tone: 'blue', ch: '⚡' },
  };
  const s = map[kind] || map.crit;
  return <Pill tone={s.tone} size="xs" title={tip} style={{ width: 16, height: 16, padding: 0, justifyContent: 'center', cursor: 'help', userSelect: 'none' }}>{s.ch}</Pill>;
}

// Píldora azul (agregar) / verde (editar) + sub-línea explicativa + notas a la izquierda (misma altura en todas las filas).
export function SugeridoCompraCell({ r, enExport, cantidadEnExport, onAgregarSolicitud, puedeEditar }) {
  const { theme } = useTheme();
  const sug = Number(r.sugerido || 0);
  const cnt = Number(r.contenedoresSugeridos || 0);
  const crecPct = Math.round(Number(r.crecimientoPct || 0) * 100);
  const seg = Number(r.mesesSeguridad || 0);
  const conc = r.concentracionAlta || null;
  const tendNeg = !!r.tendenciaNegativa;
  const critico = !!r.esCritico;
  const cap = !!r.crecimientoCap;
  if (sug <= 0 && !enExport) return null;

  const btnBg = enExport ? (theme.green || '#34C759') : (theme.accent || '#007AFF');
  const btnLabel = enExport
    ? `✓ ${fmtInt(cantidadEnExport)} pz`
    : cnt > 0 ? `＋ ${cnt} cnt · ${fmtInt(sug)} pz` : `＋ ${fmtInt(sug)} pz`;
  let sub = 'en Mi Export';
  if (!enExport) {
    const parts = [];
    if (crecPct > 0) parts.push(`+${crecPct}%${cap ? ' cap' : ''}`);
    parts.push(`3m${seg > 0 ? ` + ${seg}m seg` : ''}`);
    sub = parts.join(' · ');
  }
  const tieneNotas = critico || tendNeg || conc;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      {tieneNotas && (
        <div style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
          {critico && <SugNota kind="crit" tip="SKU crítico · no puede faltar" />}
          {tendNeg && <SugNota kind="tend" tip={`Consumo bajando · últ 3m ${fmtInt(Math.round(r.ritmo3m))} pz/m vs 3m ant ${fmtInt(Math.round(r.ritmo3mAnt))} pz/m`} />}
          {conc && <SugNota kind="conc" tip={`Concentración alta: ${conc.cliente} = ${conc.pct}% del consumo con tendencia +${conc.tendPct}% vs 3m ant`} />}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onAgregarSolicitud?.(r); }}
          title={enExport ? `En Mi Export con ${fmtInt(cantidadEnExport)} pz — click para editar` : `Sugerido: ${fmtInt(sug)} pz (${cnt} cnt) — click para agregar`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 999,
            background: btnBg, color: '#FFF', border: 0, fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
            letterSpacing: '-0.01em', cursor: puedeEditar ? 'pointer' : 'default', whiteSpace: 'nowrap', lineHeight: 1.2,
            opacity: puedeEditar ? 1 : 0.7, transition: `transform ${DUR.tap}ms ${EASE}`,
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
          {btnLabel}
        </button>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 9.5, color: theme.textMuted, fontWeight: 500, lineHeight: 1.1, paddingRight: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

export default function TablaForecast({
  rows, expandedSku, setExpandedSku, sortCol, sortDir, onSort,
  onAgregarSolicitud, skusEnBorrador, lineasBorrador, puedeEditar, sensible, facturacion, metaBySku, maxHeight = '72vh', vacio,
}) {
  const { theme } = useTheme();
  const dash = <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
  const lineaDe = (sku) => (skusEnBorrador.has(sku) ? lineasBorrador.find((l) => l.sku === sku) : null);

  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', width: 96, sort: true, mono: true, render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: expandedSku === r.sku ? theme.accent : (theme.textSubtle || theme.textMuted), fontSize: 9 }}>{expandedSku === r.sku ? '▾' : '▸'}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: theme.accent, fontWeight: 600 }}>{r.sku}</span>
      </span>
    ) },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 360, render: (r) => <span title={r.descripcion} style={{ fontFamily: TYPO.fontText, fontSize: 12, color: theme.text }}>{r.descripcion || '—'}</span> },
    { key: 'roadmapEstado', label: 'Roadmap', align: 'center', width: 64, render: (r) => (r.roadmapEstado ? <Pill tone={roadmapTone(r.roadmapEstado)} size="xs">{r.roadmapEstado}</Pill> : dash) },
    { key: 'inv', label: 'Inv', width: 64, sort: true, render: (r) => fmtInt(r.inv), renderTotal: (v) => fmtInt(v) },
    { key: 'traCant', label: 'Tránsito', width: 70, sort: true, render: (r) => (r.traCant > 0 ? fmtInt(r.traCant) : dash), renderTotal: (v) => fmtInt(v) },
    { key: 'traEta', label: 'Arribo', width: 76, sort: true, render: (r) => (r.traEta ? <span style={{ fontFamily: TYPO.fontText, fontSize: 11.5 }}>{fmtEtaCorta(r.traEta)}</span> : <span style={{ color: theme.textSubtle || theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11 }}>sin OC</span>) },
    { key: 'demandaMesErp', label: 'Dem 3m', width: 80, sort: true, title: 'Ritmo mensual ERP · promedio 3 meses (todos los clientes)', render: (r) => <>{fmtInt(r.demandaMesErp)}<span style={{ color: theme.textMuted, marginLeft: 3, fontSize: 10 }}>pz/m</span></>, renderTotal: (v) => fmtInt(v) },
    { key: 'coberturaDiasErp', label: 'Días inv', align: 'center', width: 72, sort: true, render: (r) => (
      r.coberturaDiasErp == null || !isFinite(r.coberturaDiasErp)
        ? <Pill tone={Number(r.inv) > 0 ? 'gray' : 'red'} size="xs">{Number(r.inv) > 0 ? 'sin dem.' : 'agotado'}</Pill>
        : <Pill tone={tonoCobertura(r.coberturaDiasErp, Number(r.inv) > 0)} size="xs">{fmtDias(r.coberturaDiasErp)}</Pill>
    ) },
    { key: 'sugerido', label: 'Sugerido', width: 150, sort: true, render: (r) => {
      const l = lineaDe(r.sku);
      return <SugeridoCompraCell r={r} enExport={!!l} cantidadEnExport={l?.cantidad || 0} onAgregarSolicitud={onAgregarSolicitud} puedeEditar={puedeEditar} />;
    }, renderTotal: (v) => (v > 0 ? `${fmtInt(v)} pz` : '') },
  ];

  const totales = {
    sku: 'Total', descripcion: `${rows.length} SKUs`,
    inv: rows.reduce((s, r) => s + (Number(r.inv) || 0), 0),
    traCant: rows.reduce((s, r) => s + (Number(r.traCant) || 0), 0),
    demandaMesErp: rows.reduce((s, r) => s + (Number(r.demandaMesErp) || 0), 0),
    sugerido: rows.reduce((s, r) => s + (Number(r.sugerido) > 0 ? Number(r.sugerido) : 0), 0),
  };

  return (
    <TablaCompacta
      columnas={columnas}
      filas={rows}
      rowKey={(r) => r.sku}
      dense
      maxHeight={maxHeight}
      orden={sortCol ? { col: sortCol, dir: sortDir } : null}
      onSort={onSort}
      totales={totales}
      vacio={vacio || 'Sin resultados con los filtros actuales'}
      onRowClick={(r) => setExpandedSku(expandedSku === r.sku ? null : r.sku)}
      expandidoKey={expandedSku}
      renderExpandido={(r) => {
        const l = lineaDe(r.sku);
        return (
          <DrillSku r={r} enExport={!!l} cantidadEnExport={l?.cantidad || 0} onAgregarSolicitud={onAgregarSolicitud}
            puedeEditar={puedeEditar} sensible={sensible} facturacion={facturacion} metaBySku={metaBySku} />
        );
      }}
    />
  );
}
