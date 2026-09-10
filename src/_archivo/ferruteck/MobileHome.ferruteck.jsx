// Archivo: retirado de src/components/MobileHome.jsx el 2026-09-09 (retiro de Ferruteck).
// Contenía: <FerruteckCard> (card B del home móvil con logo rosa→naranja, badge y 3 sugerencias).
// No se importa desde ningún sitio.
import React from 'react';
import { Sparkles } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';

// ═══════════════════════════════════════════════════════════════════════
// Ferruteck card B (protagonista) — con logo original
// ═══════════════════════════════════════════════════════════════════════
function FerruteckCard({ theme, isDark, onNavegar }) {
  const suggestions = [
    { tag: 'Top movidos', txt: '12 SKUs con inv', valor: '$96K', accion: () => onNavegar(null, 'propuestas') },
    { tag: 'Reposición',  txt: 'Cobertura baja', valor: '$45K', accion: () => onNavegar(null, 'inventarioGlobal') },
    { tag: 'Oportunidad', txt: 'Precio agresivo', valor: '$193K', accion: () => onNavegar(null, 'estrategiaPrecios') },
  ];
  return (
    <div style={{
      margin: '0 18px 10px', padding: '14px 16px', borderRadius: 18,
      background: isDark
        ? 'linear-gradient(135deg, rgba(255,55,95,.14), rgba(255,159,10,.08))'
        : 'linear-gradient(135deg, rgba(255,45,85,.10), rgba(255,149,0,.06))',
      border: `1px solid ${isDark ? 'rgba(255,55,95,.28)' : 'rgba(255,45,85,.20)'}`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-30%', right: '-10%', width: '60%', height: '130%',
        background: 'radial-gradient(circle, rgba(255,149,0,.14), transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
          display: 'grid', placeItems: 'center', color: '#fff',
          boxShadow: '0 6px 14px rgba(255,45,85,.30)',
        }}>
          <Sparkles size={18} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: theme.text }}>Ferruteck</div>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>3 sugerencias para cerrar el mes</div>
        </div>
        <span style={{
          padding: '3px 8px', borderRadius: 100, background: theme.pink || '#FF375F',
          color: '#fff', fontSize: 10.5, fontWeight: 800,
        }}>3</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, position: 'relative' }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={s.accion}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', background: isDark ? 'rgba(255,255,255,.04)' : theme.surface,
              border: `1px solid ${theme.border}`, borderRadius: 10, cursor: 'pointer',
              textAlign: 'left', fontFamily: TYPO.fontText,
              transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1)',
            }}
            onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.98)'}
            onPointerUp={(e) => e.currentTarget.style.transform = ''}
            onPointerLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{s.tag}</span>
              <span style={{ fontSize: 12.5, color: theme.text, fontWeight: 600 }}>{s.txt}</span>
            </div>
            <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 700 }}>{s.valor}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { FerruteckCard };
