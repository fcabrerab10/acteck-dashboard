// Archivo: retirado de src/modules/comercial/PropuestasTab.jsx el 2026-09-09 (retiro de Ferruteck).
// Contenía: componente <Copilot> (sidebar derecho con paquetes sugeridos + chat "próximamente") y, como referencia,
// el handler aplicarPaquete() que vivía en la pantalla armadora y sólo lo usaba el Copilot. No se importa desde ningún sitio.
import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';
import { formatMXN } from '../../lib/utils';

// ── Referencia: handler que vivía dentro de la pantalla armadora ──
// eslint-disable-next-line no-unused-vars
function aplicarPaqueteRef(setPropuesta, skus) {
    const aplicarPaquete = (skusIds) => {
      setPropuesta((prev) => {
        const next = { ...prev };
        skusIds.forEach((sku) => {
          if (sku in next) return;
          const meta = skus.find((r) => r.sku === sku);
          if (!meta) return;
          const precioDefault = Object.values(meta.precios)[0] || 0;
          const listaDefault = Object.keys(meta.precios)[0] || '';
          next[sku] = {
            piezas: Math.max(1, meta.promSellout || 1),
            precio: precioDefault,
            listaSel: listaDefault,
          };
        });
        return next;
      });
}


// ════════════════════════════════════════════════════════════════════
// COPILOT · sugerencias inteligentes
// ════════════════════════════════════════════════════════════════════
function Copilot({ theme, isDark, P, cliente, contexto, skus, propuesta, onAplicarPaquete }) {
  const [aplicadas, setAplicadas] = useState(new Set());

  const sugerencias = useMemo(() => {
    if (!skus || skus.length === 0) return [];
    // 1) Top 12 SO 90d con inv comercial
    const topSO = skus
      .filter((r) => (r.sellout90 || 0) > 0 && (r.invActeck || 0) > 100)
      .slice(0, 12);
    const topSOTotal = topSO.reduce((s, r) => {
      const p = Object.values(r.precios || {})[0] || 0;
      return s + (r.promSellout || 1) * p;
    }, 0);

    // 2) Cobertura baja del cliente (invCliente < promSellout · con inv Acteck > 0)
    const covBaja = skus
      .filter((r) => (r.promSellout || 0) > 0 && (r.invCliente || 0) < (r.promSellout || 0) && (r.invActeck || 0) > 0)
      .sort((a, b) => (a.invCliente || 0) - (b.invCliente || 0))
      .slice(0, 10);
    const covBajaTotal = covBaja.reduce((s, r) => {
      const p = Object.values(r.precios || {})[0] || 0;
      const suggPz = Math.max(1, (r.promSellout || 1) * 2 - (r.invCliente || 0));
      return s + suggPz * p;
    }, 0);

    // 3) Skus con múltiples listas de precios — precio más agresivo
    const multiLista = skus
      .filter((r) => Object.keys(r.precios || {}).length > 1 && (r.sellout90 || 0) > 0 && (r.invActeck || 0) > 0)
      .slice(0, 8);
    const multiTotal = multiLista.reduce((s, r) => {
      const listaB = Object.values(r.precios || {}).sort((a, b) => a - b)[0] || 0;
      return s + (r.promSellout || 1) * listaB;
    }, 0);

    return [
      {
        id: 'top-so',
        tag: 'Top movidos',
        tagColor: P.green,
        title: `Top ${topSO.length} SO 90d con inv`,
        desc: 'Los más movidos con stock comercial suficiente para empujar sin agotar CEDIS.',
        skus: topSO.length,
        piezas: topSO.reduce((s, r) => s + (r.promSellout || 1), 0),
        monto: topSOTotal,
        applyIds: topSO.map((r) => r.sku),
      },
      {
        id: 'cov-baja',
        tag: 'Reposición',
        tagColor: P.orange,
        title: 'Cobertura baja del cliente',
        desc: `${covBaja.length} SKUs donde ${cliente.label} tiene menos inventario del que vende. Repón hasta cubrir 60 días.`,
        skus: covBaja.length,
        piezas: covBaja.reduce((s, r) => s + Math.max(1, (r.promSellout || 1) * 2 - (r.invCliente || 0)), 0),
        monto: covBajaTotal,
        applyIds: covBaja.map((r) => r.sku),
      },
      {
        id: 'multi-lista',
        tag: 'Oportunidad',
        tagColor: P.accent,
        title: 'Precio agresivo (múltiples listas)',
        desc: `${multiLista.length} SKUs con varias listas — puedes negociar la más baja para volumen.`,
        skus: multiLista.length,
        piezas: multiLista.reduce((s, r) => s + (r.promSellout || 1), 0),
        monto: multiTotal,
        applyIds: multiLista.map((r) => r.sku),
      },
    ].filter((s) => s.skus > 0);
  }, [skus, cliente.label, P]);

  const aplicar = (sug) => {
    onAplicarPaquete(sug.applyIds);
    setAplicadas((prev) => new Set([...prev, sug.id]));
  };

  const totalAplicables = sugerencias.reduce((s, x) => s + x.skus, 0);

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      {/* Header — negro consistente con Mi Propuesta */}
      <div style={{
        padding: '14px 16px', background: '#000', color: '#F5F5F7',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
            fontSize: 15,
          }} title="Ferruteck">
            🌴
          </div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 14, letterSpacing: '-0.015em', color: '#F5F5F7' }}>
              Ferruteck
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(245,245,247,0.6)', marginTop: 1 }}>
              {cliente.label} · {sugerencias.length} sugerencia{sugerencias.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 12, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {sugerencias.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 11, lineHeight: 1.5 }}>
            Sin sugerencias con los datos actuales. Prueba usar el buscador o desactivar "Solo con inventario".
          </div>
        ) : sugerencias.map((sug) => {
          const applied = aplicadas.has(sug.id);
          return (
            <div key={sug.id} onClick={() => !applied && aplicar(sug)}
              style={{
                background: applied ? `${P.green}0F` : theme.bg,
                border: `1px solid ${applied ? P.green : theme.border}`,
                borderRadius: 12, padding: '12px 14px',
                cursor: applied ? 'default' : 'pointer',
                transition: 'border-color 120ms',
                fontFamily: TYPO.fontText,
              }}
              onMouseEnter={(e) => { if (!applied) e.currentTarget.style.borderColor = P.accent; }}
              onMouseLeave={(e) => { if (!applied) e.currentTarget.style.borderColor = theme.border; }}>
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                background: applied ? `${P.green}22` : `${sug.tagColor}22`,
                color: applied ? P.green : sug.tagColor,
                marginBottom: 6,
              }}>{applied ? 'Aplicada' : sug.tag}</span>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginBottom: 4 }}>
                {sug.title}
              </div>
              <p style={{ fontSize: 11, color: theme.textMuted, margin: '0 0 8px', lineHeight: 1.4 }}>
                {sug.desc}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', paddingTop: 6, borderTop: `1px dashed ${theme.divider || theme.border}` }}>
                <span>{sug.skus} SKUs · {fmtInt(sug.piezas)}pz</span>
                <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtCompact(sug.monto)}</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input placeholder (todavía no funcional) */}
      <div style={{ padding: 12, borderTop: `1px solid ${theme.border}`, background: theme.bg }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999,
        }}>
          <Sparkles style={{ width: 12, height: 12, color: P.accent }} strokeWidth={2} />
          <input placeholder="Chat con Ferruteck (próximamente)"
            disabled
            style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 11, color: theme.text, flex: 1, cursor: 'not-allowed', opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}

export { Copilot };
