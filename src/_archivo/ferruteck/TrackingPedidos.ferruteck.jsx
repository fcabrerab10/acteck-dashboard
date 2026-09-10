// Archivo: retirado de src/modules/comercial/TrackingPedidos.jsx el 2026-09-09 (retiro de Ferruteck).
// Contenía: componente <CopilotOps> (panel "Copilot Operaciones" expandible al pie de la tabla de OCs, con
// recomendaciones y chat "próximamente"), el estado copilotOpen y, como referencia, el useMemo `recomendaciones`.
// No se importa desde ningún sitio.
import React, { useMemo, useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';
import { formatMXN } from '../../lib/utils';

// ── Referencia: estado y useMemo que vivían en la pantalla ──
// eslint-disable-next-line no-unused-vars
function recomendacionesRef({ enriquecidas, kpis, P }) {
  const [copilotOpen, setCopilotOpen] = useState(false);
  // Copilot Operaciones · recomendaciones data-driven
  const recomendaciones = useMemo(() => {
    const recs = [];
    // 1) OCs atrasadas urgentes
    const urgentes = kpis.atrasadasAll.filter((o) => o.diasSinAvance > UMBRAL_DIAS_ALERTA * 2);
    if (urgentes.length > 0) {
      const top = urgentes[0];
      recs.push({
        id: 'urg', tag: 'Urgente', tagColor: P.red,
        title: `Acelerar OC ${top.numero_oc_cliente} (${NOMBRE_CLIENTE[top.cliente_key]})`,
        desc: `Lleva ${top.diasSinAvance.toFixed(0)} días en ${ETAPA_LABEL[top.etapa] || 'sin captura'}. ${urgentes.length > 1 ? `+${urgentes.length - 1} OCs con retraso similar.` : ''}`,
        ocId: top.id,
      });
    }
    // 2) OCs cercanas al SLA (5-10 días)
    const cerca = enriquecidas.filter((o) => o.etapa && o.etapa !== 'entregada' && o.diasSinAvance != null && o.diasSinAvance >= 5 && o.diasSinAvance <= 10);
    if (cerca.length > 0) {
      recs.push({
        id: 'sla', tag: 'Cerca del SLA', tagColor: P.orange,
        title: `${cerca.length} OC${cerca.length > 1 ? 's' : ''} en zona amarilla`,
        desc: `Entre 5 y 10 días sin avance. Empújalas esta semana antes de que se atrasen.`,
      });
    }
    // 3) OCs con fill alto listas para cerrar
    const listas = enriquecidas.filter((o) => o.etapa === 'surtida' && o.fillRate >= 100 && o.envios.length > 0 && !o.envios.every((e) => e.fecha_entregada));
    if (listas.length > 0) {
      recs.push({
        id: 'close', tag: 'Cierre mes', tagColor: P.green,
        title: `${listas.length} OC${listas.length > 1 ? 's' : ''} lista${listas.length > 1 ? 's' : ''} para cerrar`,
        desc: `Fill 100% pero falta marcar la entrega final. Ciérralas para mejorar el SLA del mes.`,
      });
    }
    return recs.slice(0, 3);
  }, [enriquecidas, kpis, P]);
  return { recomendaciones, copilotOpen, setCopilotOpen };
}

// ═══════════════════════════════════════════════════════════════════
// COPILOT OPERACIONES · expandible en el pie
// ═══════════════════════════════════════════════════════════════════
function CopilotOps({ theme, P, isDark, open, setOpen, recs }) {
  const grad = `linear-gradient(135deg, ${P.accent}0F, ${P.purple}0F)`;
  return (
    <div style={{ borderTop: `1px solid ${theme.border}`, background: grad }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 0, cursor: 'pointer', fontFamily: TYPO.fontText,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 7,
            background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`,
            color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles style={{ width: 12, height: 12 }} strokeWidth={2} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, letterSpacing: '-0.01em', color: theme.text }}>Copilot Operaciones</span>
            <span style={{ fontSize: 9.5, color: theme.textMuted, marginTop: 1 }}>
              {recs.length === 0 ? <>Sin recomendaciones · todo bajo control</>
                : <><strong style={{ color: P.accent, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{recs.length} acci{recs.length === 1 ? 'ón' : 'ones'} sugerida{recs.length === 1 ? '' : 's'}</strong> · click para {open ? 'plegar' : 'ver'}</>}
            </span>
          </div>
        </div>
        <span style={{
          width: 22, height: 22, borderRadius: 999,
          background: open ? `${P.accent}22` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          color: open ? P.accent : theme.textMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 200ms',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <ChevronDown style={{ width: 12, height: 12 }} strokeWidth={2.5} />
        </span>
      </button>
      <div style={{
        maxHeight: open ? 500 : 0, overflow: 'hidden',
        transition: 'max-height 250ms ease',
        borderTop: open ? `1px solid ${P.accent}22` : '1px solid transparent',
      }}>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(recs.length, 3)}, 1fr)`, gap: 8 }}>
              {recs.map((r) => (
                <div key={r.id} style={{
                  background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
                  padding: '10px 12px', cursor: 'pointer',
                }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                    fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    background: `${r.tagColor}22`, color: r.tagColor, marginBottom: 4, fontFamily: TYPO.fontDisplay,
                  }}>{r.tag}</span>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 3, color: theme.text }}>
                    {r.title}
                  </div>
                  <p style={{ fontSize: 10.5, color: theme.textMuted, margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999,
          }}>
            <Sparkles style={{ width: 12, height: 12, color: P.accent }} strokeWidth={2} />
            <input
              placeholder="Pregúntame algo sobre las OCs (próximamente)…"
              disabled
              style={{ border: 0, outline: 0, background: 'transparent', font: 'inherit', fontFamily: TYPO.fontText, fontSize: 11.5, flex: 1, color: theme.text, opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { CopilotOps };
