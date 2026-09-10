// Últimas compras colocadas (POs del Master Embarques agrupadas por PO) · contenido de un Panel plegable del S&OP.
// Barras de los últimos 6 meses (click = filtra el mes) + Segmented por grupo + lista de POs con detalle expandible.
// Extraído de ForecastClientesTab.jsx (V3): sólo tokens de tema + kit. USD sólo con `sensible` (sin él: piezas).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { Pill, Segmented } from '../../../components/kit';
import { fmtInt, fmtCompact, MONO } from '../inventario/constantes';

const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const usd0 = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;
const fmtFechaCorta = (iso) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return y ? `${d} ${MES_CORTO[m - 1]}` : iso; };
const fmtFechaLarga = (iso) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return y ? `${d} ${MES_CORTO[m - 1]} ${String(y).slice(2)}` : iso; };

const tonoGrupo = (name) => {
  const n = (name || '').toUpperCase();
  if (n.includes('S&OP')) return 'blue';
  if (n.includes('ADICIONAL DM') || n === 'DM') return 'red';
  if (n.includes('ND') || n.includes('BLACK AND WHITE')) return 'purple';
  if (n.includes('DECME')) return 'green';
  if (n.includes('NUEVO') || n.includes('DESARROLLO')) return 'purple';
  return 'gray';
};
const abreviaGrp = (name) => {
  const n = (name || '').toUpperCase();
  if (n.length <= 10) return n;
  if (n.includes('ADICIONAL DM')) return 'ADIC DM';
  if (n.includes('BLACK AND WHITE')) return 'ND B&W';
  if (n.includes('NUEVO DESARROLLO')) return 'NUEVO DES';
  if (n.includes('S&OP')) { const parts = n.split(/\s+/); return parts.length > 1 ? `S&OP ${parts[parts.length - 1].slice(0, 3)}` : 'S&OP'; }
  return n.slice(0, 10);
};
const chipStatus = (est) => {
  const e = String(est || '').toUpperCase();
  if (e.includes('CONCLU')) return { label: 'CONC', tone: 'green' };
  if (e.includes('TRANSITO') || e.includes('TRÁNSITO')) return { label: 'TRÁNSITO', tone: 'blue' };
  if (e.includes('ZARPAR')) return { label: 'ZARPAR', tone: 'blue' };
  if (e.includes('PRODUC')) return { label: 'PROD', tone: 'orange' };
  return null;
};

/** Agrupa embarques por PO (ignora canceladas/rechazadas/perdidas). USD = Σ shp_qty × unit_price. */
export function agruparPorPO(embarques) {
  const map = new Map();
  (embarques || []).forEach((e) => {
    const est = String(e.estatus || '').toLowerCase();
    if (est.includes('cancel') || est.includes('rechaz') || est.includes('perdid')) return;
    const po = (e.po || '').toString().trim();
    if (!po) return;
    if (!map.has(po)) map.set(po, { po, fecha: e.fecha_emision || null, grupo: e.grupo || '(sin grupo)', familia: e.familia || '', supplier: e.supplier || '', contenedor: e.contenedor || '', estatus: e.estatus || '', skus: [], totalUsd: 0, totalPz: 0, cbmTotal: 0 });
    const g = map.get(po);
    const shp = Number(e.shp_qty || e.po_qty || 0);
    const uPrice = Number(e.unit_price || 0);
    g.skus.push({ sku: e.codigo || '', descripcion: e.descripcion || '', piezas: shp, unit_price: uPrice });
    g.totalUsd += shp * uPrice; g.totalPz += shp; g.cbmTotal += Number(e.cbm || 0);
    if (!g.estatus && e.estatus) g.estatus = e.estatus;
  });
  return Array.from(map.values()).sort((a, b) => (b.fecha ? new Date(b.fecha).getTime() : 0) - (a.fecha ? new Date(a.fecha).getTime() : 0));
}

function DetKV({ k, v, mono, verde }) {
  const { theme } = useTheme();
  return (
    <div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 1 }}>{k}</div>
      <div style={{ fontFamily: mono ? MONO : TYPO.fontText, fontSize: mono ? 10.5 : 11, color: verde ? theme.green : theme.text, fontWeight: 500, fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>{v}</div>
    </div>
  );
}

export default function UltimasComprasCard({ embarques, sensible }) {
  const { theme } = useTheme();
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [filtroMes, setFiltroMes] = useState(null);
  const [poAbierta, setPoAbierta] = useState(null);
  const hair = `1px solid ${theme.divider || theme.border}`;

  const posAgrupadas = useMemo(() => agruparPorPO(embarques), [embarques]);
  const grupos = useMemo(() => {
    const counts = new Map();
    posAgrupadas.forEach((p) => { const k = p.grupo || '(sin grupo)'; counts.set(k, (counts.get(k) || 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [posAgrupadas]);
  const barrasMes = useMemo(() => {
    const hoy = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: MES_CORTO[d.getMonth()], usd: 0, pz: 0 });
    }
    posAgrupadas.forEach((p) => {
      if (!p.fecha) return;
      const d = new Date(p.fecha);
      const m = meses.find((x) => x.key === `${d.getFullYear()}-${d.getMonth() + 1}`);
      if (m) { m.usd += p.totalUsd; m.pz += p.totalPz; }
    });
    return meses;
  }, [posAgrupadas]);
  const medida = (m) => (sensible ? m.usd : m.pz);
  const maxBar = barrasMes.reduce((mx, m) => Math.max(mx, medida(m)), 0) || 1;
  const mesActualKey = barrasMes[barrasMes.length - 1]?.key || '';
  const posFiltradas = useMemo(() => posAgrupadas.filter((p) => {
    if (filtroGrupo !== 'todos' && p.grupo !== filtroGrupo) return false;
    if (filtroMes) { if (!p.fecha) return false; const d = new Date(p.fecha); if (`${d.getFullYear()}-${d.getMonth() + 1}` !== filtroMes) return false; }
    return true;
  }).slice(0, 30), [posAgrupadas, filtroGrupo, filtroMes]);

  const fmtBar = (m) => (sensible ? (m.usd > 0 ? fmtCompact(m.usd) : '—') : (m.pz > 0 ? fmtInt(m.pz) : '—'));

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Barras 6 meses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 }}>
        {barrasMes.map((m) => {
          const active = filtroMes === m.key;
          const isCurr = m.key === mesActualKey;
          const h = Math.max(4, (medida(m) / maxBar) * 100);
          return (
            <button key={m.key} type="button" onClick={() => setFiltroMes(active ? null : m.key)} title={`${m.label} ${m.anio} · ${sensible ? usd0(m.usd) : `${fmtInt(m.pz)} pz`}`}
              style={{ cursor: 'pointer', border: `1px solid ${active ? theme.accent : theme.border}`, background: active ? `${theme.accent}12` : theme.surface, borderRadius: 10, padding: '6px 6px 5px', textAlign: 'center', transition: `border-color ${DUR.state}ms ${EASE}` }}>
              <div style={{ height: 34, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ width: '70%', height: `${h}%`, borderRadius: '3px 3px 0 0', background: active || isCurr ? theme.accent : `${theme.text}33`, transition: `height ${DUR.state}ms ${EASE}` }} />
              </div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: theme.textMuted, marginTop: 4 }}>{m.label}</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, color: active || isCurr ? theme.accent : theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtBar(m)}</div>
            </button>
          );
        })}
      </div>

      <Segmented value={filtroGrupo} onChange={setFiltroGrupo} options={[{ id: 'todos', label: 'Todos', badge: posAgrupadas.length }, ...grupos.slice(0, 6).map(([g, n]) => ({ id: g, label: abreviaGrp(g), badge: n }))]} style={{ maxWidth: '100%', overflowX: 'auto' }} />

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden', maxHeight: 460, overflowY: 'auto' }}>
        {posFiltradas.length === 0 && <div style={{ padding: '22px 16px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5 }}>Sin compras que coincidan con los filtros</div>}
        {posFiltradas.map((p, i) => {
          const abierto = poAbierta === p.po;
          const st = chipStatus(p.estatus);
          return (
            <React.Fragment key={p.po}>
              <div onClick={() => setPoAbierta(abierto ? null : p.po)}
                style={{ padding: '9px 12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', borderTop: i > 0 ? hair : 'none', cursor: 'pointer', background: abierto ? (theme.surfaceHover || 'transparent') : 'transparent', borderLeft: abierto ? `2px solid ${theme.accent}` : '2px solid transparent', transition: `background ${DUR.state}ms ${EASE}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{p.po}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <Pill tone={tonoGrupo(p.grupo)} size="xs">{abreviaGrp(p.grupo)}</Pill>
                    <span>{fmtFechaCorta(p.fecha)}</span>
                    {p.familia && <span>· {p.familia.slice(0, 22)}{p.familia.length > 22 ? '…' : ''}{p.skus.length > 1 ? ` · ${p.skus.length} SKUs` : ''}</span>}
                    {st && <Pill tone={st.tone} size="xs">{st.label}</Pill>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{sensible ? usd0(p.totalUsd) : `${fmtInt(p.totalPz)} pz`}</div>
                  <div style={{ fontSize: 9.5, color: theme.textMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{sensible ? `${fmtInt(p.totalPz)} pz` : `${p.skus.length} línea${p.skus.length === 1 ? '' : 's'}`}</div>
                </div>
              </div>
              {abierto && (
                <div style={{ padding: '10px 12px', background: theme.bg, borderTop: hair, borderBottom: hair }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
                    <DetKV k="Fecha" v={fmtFechaLarga(p.fecha)} />
                    <DetKV k="Familia" v={p.familia || '—'} />
                    <DetKV k="Proveedor" v={p.supplier ? p.supplier.slice(0, 22) : '—'} />
                    <DetKV k="CBM total" v={p.cbmTotal > 0 ? `${p.cbmTotal.toFixed(1)} m³` : '—'} mono />
                    <DetKV k="Contenedor" v={p.contenedor && !/^PEND/i.test(p.contenedor) ? p.contenedor : 'pendiente'} mono />
                    <DetKV k="Estatus" v={p.estatus || '—'} verde={/CONCLU/i.test(p.estatus || '')} />
                  </div>
                  <div style={{ paddingTop: 8, borderTop: hair }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted }}>SKUs</span>
                      <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>{p.skus.length} línea{p.skus.length !== 1 ? 's' : ''} · {fmtInt(p.totalPz)} pz</span>
                    </div>
                    {p.skus.map((s, si) => (
                      <div key={si} style={{ display: 'grid', gridTemplateColumns: sensible ? 'auto 1fr auto auto' : 'auto 1fr auto', gap: 8, padding: '4px 0', fontSize: 10.5, alignItems: 'center', borderTop: si > 0 ? hair : 'none' }}>
                        <span style={{ fontFamily: MONO, color: theme.accent, fontSize: 10 }}>{s.sku}</span>
                        <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.descripcion}>{s.descripcion}</span>
                        <span style={{ fontFamily: MONO, color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtInt(s.piezas)}</span>
                        {sensible && <span style={{ fontFamily: MONO, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>{s.unit_price > 0 ? `$${s.unit_price.toFixed(2)}` : '—'}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
