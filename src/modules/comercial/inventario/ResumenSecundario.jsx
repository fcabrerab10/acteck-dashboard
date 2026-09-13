// Secundario plegable · distribución por CEDIS (donut + ranking, click filtra),
// estatus del stock (disponible / reservado / tránsito) y tipos de almacén.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, TablaCompacta } from '../../../components/kit';
import { EASE, DUR } from '../../../lib/motion';
import { CEDIS_CORTO, fmtCompact, fmtInt, fmtFechaCorta } from './constantes';

// Un solo acento: intensidades por ranking (sin paleta de colores)
const OPACIDAD = [1, 0.55, 0.3, 0.18, 0.12, 0.08];

export default function ResumenSecundario({ porCedis, porTipo, kpis, insights, cedisFiltro, onCedis, sensible = true }) {
  const { theme } = useTheme();
  // Sin permiso sensible: todo en piezas (nada de valor a costo).
  const $ = (v, pz) => (sensible ? fmtCompact(v) : `${fmtInt(pz)} pz`);
  const accent = theme.accent, green = theme.green, orange = theme.orange;
  const total = porCedis.reduce((s, c) => s + (sensible ? c.valor : c.piezas), 0) || 1;
  const C = 2 * Math.PI * 42;
  let acc = 0;
  const arcos = porCedis.map((c, i) => { const len = ((sensible ? c.valor : c.piezas) / total) * C; const off = -acc; acc += len; return { ...c, len, off, op: OPACIDAD[Math.min(i, OPACIDAD.length - 1)] }; });

  const estatus = [
    { tone: 'green', col: green, label: 'Comercial disponible', sub: `${fmtInt(kpis.skus)} SKUs · ${kpis.almacenes} alm.`, val: sensible ? fmtCompact(insights.valorDisponible) : `${fmtInt(insights.disponible)} pz`, vsub: sensible ? `${fmtInt(insights.disponible)} pz` : `${fmtInt(kpis.skus)} SKUs` },
    { tone: 'orange', col: orange, label: 'Apartado', sub: 'comprometido en órdenes en curso', val: sensible ? fmtCompact(insights.valorReservado) : `${fmtInt(insights.reservado)} pz`, vsub: sensible ? `${fmtInt(insights.reservado)} pz · ${insights.pctReservado.toFixed(1)}%` : `${insights.pctReservado.toFixed(1)}% del total` },
    { tone: 'blue', col: accent, label: 'En tránsito', sub: insights.transitoEta ? `próximo arribo ${fmtFechaCorta(insights.transitoEta)}` : 'sin embarques pendientes', val: sensible ? fmtCompact(insights.transitoValor) : `${fmtInt(insights.transitoPz)} pz`, vsub: sensible ? `${fmtInt(insights.transitoPz)} pz · ${insights.transitoPos} POs` : `${insights.transitoPos} POs` },
  ];

  const colsTipo = [
    { key: 'tipo', label: 'Tipo de almacén', align: 'left' },
    { key: 'skus', label: 'SKUs', render: (r) => fmtInt(r.skus) },
    { key: 'piezas', label: 'Piezas', render: (r) => fmtInt(r.piezas), sum: true, renderTotal: (v) => fmtInt(v) },
    ...(sensible ? [{ key: 'valor', label: 'Valor', render: (r) => fmtCompact(r.valor), sum: true, renderTotal: (v) => fmtCompact(v), bold: true }] : []),
    { key: 'share', label: sensible ? '% valor' : '% piezas', render: (r) => <Pill tone={r.share >= 50 ? 'blue' : 'gray'} size="xs">{r.share.toFixed(1)}%</Pill> },
  ];

  return (
    <Panel titulo="Distribución y estatus" meta={`${porCedis.length} CEDIS · ${porTipo.length} tipos de almacén · click en un CEDIS filtra la pantalla`} plegable abiertoInicial={false} padding="12px 14px">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, fontFamily: TYPO.fontText }}>
        {/* Donut + ranking */}
        <div>
          <Titulo theme={theme} t="Por CEDIS" m={`${porCedis.length} activos`} />
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke={theme.divider || theme.border} strokeWidth="14" />
                {arcos.map((c) => (
                  <circle key={c.cedis} cx="50" cy="50" r="42" fill="none" stroke={accent} strokeWidth="14"
                    strokeDasharray={`${c.len} ${C - c.len}`} strokeDashoffset={c.off}
                    style={{ opacity: cedisFiltro !== 'TODOS' && cedisFiltro !== c.cedis ? c.op * 0.25 : c.op, cursor: 'pointer', transition: `opacity ${DUR.state}ms ${EASE}` }}
                    onClick={() => onCedis(cedisFiltro === c.cedis ? 'TODOS' : c.cedis)}>
                    <title>{CEDIS_CORTO[c.cedis] || c.cedis} · {$(c.valor, c.piezas)} · {c.share.toFixed(1)}%</title>
                  </circle>
                ))}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Total</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{$(kpis.valor, kpis.piezas)}</span>
                <span style={{ fontSize: 9, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{kpis.nCEDIS} CEDIS · {kpis.almacenes} alm</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {arcos.map((c) => {
                const active = cedisFiltro === c.cedis;
                return (
                  <div key={c.cedis} onClick={() => onCedis(active ? 'TODOS' : c.cedis)}
                    style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto 40px', gap: 8, alignItems: 'center', padding: '4px 6px', borderRadius: 8, cursor: 'pointer', background: active ? (theme.surfaceHover || 'transparent') : 'transparent', border: `1px solid ${active ? theme.borderStrong || theme.border : 'transparent'}`, transition: `background ${DUR.state}ms ${EASE}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: accent, opacity: c.op }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text }}>{CEDIS_CORTO[c.cedis] || c.cedis}</div>
                      <div style={{ fontSize: 9.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(c.skus)} SKUs · {c.almacenes} alm.</div>
                    </div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{$(c.valor, c.piezas)}</div>
                    <div style={{ fontSize: 9.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{c.share.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Estatus del stock */}
        <div>
          <Titulo theme={theme} t="Estatus del stock" m={sensible ? "valor comercial a costo" : "piezas comerciales"} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {estatus.map((it, idx) => (
              <div key={it.label} style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: idx < estatus.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: it.col }} />
                <div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text }}>{it.label}</div>
                  <div style={{ fontSize: 9.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{it.sub}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: it.col, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{it.val}</div>
                  <div style={{ fontSize: 9.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{it.vsub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tipos de almacén */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Titulo theme={theme} t="Por tipo de almacén" m={`${porTipo[0]?.tipo || '—'} domina con ${porTipo[0] ? porTipo[0].share.toFixed(0) : 0}% ${sensible ? 'del valor' : 'de las piezas'}`} />
          <TablaCompacta columnas={colsTipo} filas={porTipo} rowKey={(r) => r.tipo} dense />
        </div>
      </div>
    </Panel>
  );
}

function Titulo({ theme, t, m }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{t}</span>
      <span style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m}</span>
    </div>
  );
}
