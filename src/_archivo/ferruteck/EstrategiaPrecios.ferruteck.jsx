// Archivo: retirado de src/modules/comercial/EstrategiaPrecios.jsx el 2026-09-09 (retiro de Ferruteck).
// Contenía: componente <CopilotPricing> (panel expandible al pie del drill-down de SKU, con recomendaciones de precio
// y chat "próximamente"), el estado copilotOpen y, como referencia, el useMemo `recomendaciones` que lo alimentaba.
// No se importa desde ningún sitio.
import React, { useMemo, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';
import { formatMXN } from '../../lib/utils';

// ── Referencia: estado y useMemo que vivían en la pantalla ──
// eslint-disable-next-line no-unused-vars
function recomendacionesRef({ analisis, precios, precioAAA, promo, theme, PRECIO_BAJO_KEY }) {
  const [copilotOpen, setCopilotOpen] = useState(false);
  // Recomendaciones del Copilot · data-driven
  const recomendaciones = useMemo(() => {
    if (!analisis) return [];
    const recs = [];
    // 1) Oportunidad · lista con delta más grande vs AAA con volumen relevante
    const listasBajoAAA = Object.entries(precios || {})
      .filter(([k, v]) => k !== 'Mayoreo AAA' && k !== PRECIO_BAJO_KEY && v != null && precioAAA > 0 && v < precioAAA)
      .map(([k, v]) => ({ lista: k, precio: v, deltaAbs: precioAAA - v, deltaPct: ((v - precioAAA) / precioAAA) * 100 }))
      .sort((a, b) => b.deltaAbs - a.deltaAbs);
    if (listasBajoAAA.length > 0) {
      const l = listasBajoAAA[0];
      const impacto = l.deltaAbs * (analisis.piezasMesActual || 0);
      recs.push({
        id: 'op',
        tag: 'Oportunidad',
        tagColor: paletteFromTheme(theme).accent,
        title: `Sube ${LISTAS_LBL[l.lista] || l.lista} ${Math.abs(Math.round(l.deltaPct))}%`,
        desc: `Están $${Math.round(l.deltaAbs).toLocaleString('es-MX')} abajo de Mayoreo AAA. Impacto proyectado: $${Math.round(impacto).toLocaleString('es-MX')}/mes.`,
      });
    }
    // 2) Revisar · cliente de mayor volumen con delta < -5%
    const cli = analisis.clienteVolumen;
    if (cli && cli.deltaLista != null && cli.deltaLista < -5) {
      const impactoAnual = Math.abs(cli.deltaLista / 100) * cli.monto * (12 / (new Date().getMonth() + 1));
      recs.push({
        id: 'rev',
        tag: 'Revisar',
        tagColor: paletteFromTheme(theme).orange,
        title: `${cli.cliente} renegociar precio`,
        desc: `Paga ${Math.abs(cli.deltaLista).toFixed(1)}% bajo AAA con ${fmtInt(cli.piezas)} pz YTD. Impacto anualizado ~$${Math.round(impactoAnual / 1000).toLocaleString('es-MX')}K.`,
      });
    }
    // 3) Alerta · si hay promo activa
    if (promo && promo.campania) {
      recs.push({
        id: 'alert',
        tag: 'Alerta',
        tagColor: paletteFromTheme(theme).red,
        title: `Promo "${promo.campania}" activa`,
        desc: `Descuento vigente del ${Math.round(Number(promo.promo_pct) * 100)}%. Revisa la transición al terminar.`,
      });
    }
    return recs;
  }, [analisis, precios, precioAAA, promo, theme]);
  return { recomendaciones, copilotOpen, setCopilotOpen };
}

// ═══ Copilot Pricing · expandible ═══
function CopilotPricing({ theme, isDark, P, open, setOpen, recs }) {
  const grad = `linear-gradient(135deg, ${P.accent}0F, ${P.purple}0F)`;
  return (
    <div style={{
      borderTop: `1px solid ${theme.border}`,
      background: grad,
      transition: 'all 200ms ease',
    }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = `${P.accent}0A`}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8,
            background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`,
            color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles style={{ width: 13, height: 13 }} strokeWidth={2} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12.5, letterSpacing: '-0.01em', color: theme.text }}>Copilot Pricing</span>
            <span style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
              {recs.length === 0 ? (
                <>Sin recomendaciones para este SKU · click para chat</>
              ) : (
                <><strong style={{ color: P.accent, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{recs.length} recomendaci{recs.length === 1 ? 'ón' : 'ones'}</strong> para este SKU · click para {open ? 'plegar' : 'ver'}</>
              )}
            </span>
          </div>
        </div>
        <span style={{
          width: 24, height: 24, borderRadius: 999,
          background: open ? `${P.accent}1A` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          color: open ? P.accent : theme.textMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 200ms, background 200ms, color 200ms',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <ChevronDown style={{ width: 14, height: 14 }} strokeWidth={2.5} />
        </span>
      </button>

      <div style={{
        maxHeight: open ? 500 : 0, overflow: 'hidden',
        transition: 'max-height 250ms ease',
        borderTop: open ? `1px solid ${P.accent}22` : '1px solid transparent',
      }}>
        <div style={{ padding: '14px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(recs.length, 3)}, 1fr)`, gap: 10 }}>
              {recs.map((r) => (
                <div key={r.id} style={{
                  background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
                  padding: '12px 14px', cursor: 'pointer', transition: 'border-color 120ms',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = P.accent}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = theme.border}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                    fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    background: `${r.tagColor}22`, color: r.tagColor, marginBottom: 6,
                  }}>{r.tag}</span>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, marginBottom: 4 }}>
                    {r.title}
                  </div>
                  <p style={{ fontSize: 11, color: theme.textMuted, margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, marginTop: recs.length > 0 ? 4 : 0,
          }}>
            <Sparkles style={{ width: 12, height: 12, color: P.accent }} strokeWidth={2} />
            <input
              placeholder="Pregúntame algo sobre este SKU (próximamente)…"
              disabled
              style={{ border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 12, flex: 1, color: theme.text, opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { CopilotPricing };
