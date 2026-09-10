// TransitoTimeline — calendario mensual de tránsito (próximos 6 meses): piezas (+ USD si `sensible`) y POs por mes;
// click en un mes lo expande agrupado Familia → Marca. V3: sólo tokens de tema y kit (sin Tailwind).
// Se monta dentro de un Panel plegable del S&OP; la lógica de agrupación es la original.
import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { Pill } from '../../../components/kit';
import { fmtInt } from '../inventario/constantes';

const MES_NOMBRE = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const FMT_USD = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;
const MONO = '"SF Mono", ui-monospace, Menlo, monospace';

export function agruparTransitoPorMes(embarques, metaBySku) {
  // Agrupar embarques por mes de ETA — solo no-cancelados con ETA en el futuro
  // o muy reciente (últimos 14 días) para reflejar lo que está por arribar.
  const hoy = new Date();
  const limiteAtras = new Date(hoy); limiteAtras.setDate(limiteAtras.getDate() - 14);
  const limiteAdelante = new Date(hoy); limiteAdelante.setMonth(limiteAdelante.getMonth() + 6);
  const fueraDeTransito = (e) => {
    const est = String(e.estatus || '').toLowerCase();
    return est.includes('cancel') || est.includes('concluido') || est.includes('rechazada') || est.includes('perdida');
  };
  const etaDe = (e) => {
    // ETA real: arribo_cedis (fecha programada de arribo final) > arribo_almacen > eta_puerto > eta.
    const etaStr = e.arribo_cedis || e.arribo_almacen || e.eta_puerto || e.eta;
    if (!etaStr) return null;
    const eta = new Date(etaStr);
    if (isNaN(eta)) return null;
    const yr = eta.getFullYear();
    if (yr < 2020 || yr > 2030) return null; // fechas absurdas del importador
    return eta;
  };

  const meses = new Map();
  let totalPiezas = 0, totalUsd = 0;
  const totalPOs = new Set();
  let proxEta = null;

  (embarques || []).forEach((e) => {
    if (fueraDeTransito(e)) return;
    const eta = etaDe(e);
    if (!eta || eta < limiteAtras) return;
    if (!proxEta || eta < proxEta) proxEta = eta;
    if (eta > limiteAdelante) return;

    const sku = (e.codigo || '').trim();
    const meta = metaBySku ? metaBySku[sku] : null;
    const costoUsd = Number(e.unit_price || meta?.unit_price_usd_ultima || 0);
    const piezas = Number(e.po_qty || 0);
    const valorUsd = piezas * costoUsd;
    const key = `${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, '0')}`;
    if (!meses.has(key)) meses.set(key, { key, anio: eta.getFullYear(), mes: eta.getMonth() + 1, piezas: 0, usd: 0, pos: new Set(), embarques: [] });
    const m = meses.get(key);
    m.piezas += piezas; m.usd += valorUsd;
    if (e.po) m.pos.add(e.po);
    m.embarques.push({ ...e, valorUsd, marca: meta?.marca || '(sin marca)' });
    totalPiezas += piezas; totalUsd += valorUsd;
    if (e.po) totalPOs.add(e.po);
  });

  return { meses: Array.from(meses.values()).sort((a, b) => a.key.localeCompare(b.key)), total: { piezas: totalPiezas, usd: totalUsd, pos: totalPOs.size }, proxEta };
}

function desgloseFamiliaMarca(embarques) {
  const tree = new Map();
  embarques.forEach((e) => {
    const familia = e.familia || '(sin familia)';
    const marca = e.marca || '(sin marca)';
    if (!tree.has(familia)) tree.set(familia, new Map());
    const fmap = tree.get(familia);
    if (!fmap.has(marca)) fmap.set(marca, { piezas: 0, usd: 0, skus: new Set(), pos: new Set() });
    const cell = fmap.get(marca);
    cell.piezas += Number(e.po_qty || 0); cell.usd += Number(e.valorUsd || 0);
    if (e.codigo) cell.skus.add(e.codigo);
    if (e.po) cell.pos.add(e.po);
  });
  const out = [];
  for (const [familia, fmap] of tree.entries()) {
    let famPiezas = 0, famUsd = 0;
    const marcas = [];
    for (const [marca, cell] of fmap.entries()) {
      marcas.push({ marca, piezas: cell.piezas, usd: cell.usd, skus: cell.skus.size, pos: cell.pos.size });
      famPiezas += cell.piezas; famUsd += cell.usd;
    }
    marcas.sort((a, b) => b.piezas - a.piezas);
    out.push({ familia, piezas: famPiezas, usd: famUsd, marcas });
  }
  return out.sort((a, b) => b.piezas - a.piezas);
}

export default function TransitoTimeline({ embarques, metaBySku, sensible = false }) {
  const { theme } = useTheme();
  const [mesExpandido, setMesExpandido] = useState(null);
  const data = useMemo(() => agruparTransitoPorMes(embarques, metaBySku), [embarques, metaBySku]);
  const hair = `1px solid ${theme.divider || theme.border}`;
  const num = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: theme.text, fontSize: 12 };

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: theme.textMuted, padding: '0 2px 8px' }}>
        <span>Total <strong style={{ color: theme.text }}>{fmtInt(data.total.piezas)} pz</strong></span>
        {sensible && <span>· <strong style={{ color: theme.text }}>{FMT_USD(data.total.usd)}</strong></span>}
        <span>· {data.total.pos} POs</span>
        {data.proxEta && <Pill tone="blue" size="xs">próx. ETA {data.proxEta.getDate()} {MES_NOMBRE[data.proxEta.getMonth()]}</Pill>}
      </div>
      {data.meses.length === 0 && (
        <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 11.5, color: theme.textMuted }}>Sin tránsito programado en los próximos 6 meses</div>
      )}
      {data.meses.map((m) => {
        const abierto = mesExpandido === m.key;
        return (
          <div key={m.key} style={{ borderTop: hair }}>
            <button type="button" onClick={() => setMesExpandido(abierto ? null : m.key)}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: '16px 96px 1fr auto auto', gap: 10, alignItems: 'center', padding: '7px 6px', border: 0, background: 'transparent', cursor: 'pointer', color: theme.text, textAlign: 'left', fontFamily: TYPO.fontText }}>
              <ChevronDown size={13} style={{ color: theme.textMuted, transform: abierto ? 'rotate(0)' : 'rotate(-90deg)', transition: `transform ${DUR.state}ms ${EASE}` }} />
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{MES_NOMBRE[m.mes - 1]} {m.anio}</span>
              <span style={{ fontSize: 10.5, color: theme.textMuted }}>{m.pos.size} PO{m.pos.size === 1 ? '' : 's'}</span>
              <span style={num}>{fmtInt(m.piezas)} pz</span>
              {sensible ? <span style={{ ...num, color: theme.green, minWidth: 90, textAlign: 'right' }}>{FMT_USD(m.usd)}</span> : <span />}
            </button>
            {abierto && (
              <div style={{ padding: '2px 8px 10px 32px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {desgloseFamiliaMarca(m.embarques).map((g) => (
                  <div key={g.familia} style={{ fontSize: 11 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '3px 0', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text }}>{g.familia}</span>
                      <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: theme.text }}>{fmtInt(g.piezas)} pz</span>
                      {sensible ? <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: theme.green, minWidth: 90, textAlign: 'right' }}>{FMT_USD(g.usd)}</span> : <span />}
                    </div>
                    {g.marcas.map((mk) => (
                      <div key={mk.marca} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, padding: '1px 0 1px 12px', color: theme.textMuted, fontSize: 10.5, alignItems: 'baseline' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mk.marca}</span>
                        <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(mk.piezas)}</span>
                        {sensible ? <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>{FMT_USD(mk.usd)}</span> : <span />}
                        <span style={{ color: theme.textSubtle || theme.textMuted, minWidth: 52, textAlign: 'right' }}>{mk.skus} SKU{mk.skus === 1 ? '' : 's'}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
