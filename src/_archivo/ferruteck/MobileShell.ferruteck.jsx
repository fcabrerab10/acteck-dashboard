// Archivo: retirado de src/components/MobileShell.jsx el 2026-09-09 (retiro de Ferruteck).
// Contenía: <FerrutekMini> (SVG fantasmita), el botón Ferruteck del bottom nav (con su separador visual) y el
// bottom sheet `openSheet === 'ferruteck'` con 3 sugerencias. No se importa desde ningún sitio.
import React from 'react';
import { Sparkles } from 'lucide-react';
import { TYPO } from '../../lib/themeTokens';

// Mini fantasmita de Ferruteck — mismo diseño del Topbar web (versión compacta)
function FerrutekMini({ size = 22 }) {
  return (
    <svg width={size} height={size * 1.07} viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="frtMini" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF" />
          <stop offset="40%" stopColor="#D0A8F0" />
          <stop offset="100%" stopColor="#AF52DE" />
        </radialGradient>
      </defs>
      <path
        d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"
        fill="url(#frtMini)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"
      />
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="54" cy="47" rx="3" ry="4" fill="#FFF" />
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="90" cy="47" rx="3" ry="4" fill="#FFF" />
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
import Sidebar, { CLIENTES } from './Sidebar';
import MobileYo from './MobileYo';

// ── Botón del bottom nav (iba dentro de <nav>, tras los TabPill) ──
export function FerruteckNavButton({ shrunk, isDark, theme, setOpenSheet }) {
  return (
    <>
        {/* Separador visual */}
        <div style={{
          width: 1, height: shrunk ? 22 : 26, background: theme.border,
          margin: '0 2px', flex: '0 0 auto',
          transition: 'height 420ms cubic-bezier(.32,.72,0,1)',
        }} />

        {/* Ferruteck · fantasmita real con cosmic bg (idéntico al web) */}
        <button
          onClick={() => setOpenSheet('ferruteck')}
          aria-label="Ferruteck"
          style={{
            width: shrunk ? 36 : 46, height: shrunk ? 36 : 46,
            borderRadius: '50%',
            background: `radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(100,210,255,0.25) 0%, transparent 55%), linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
            border: '1px solid rgba(255,255,255,0.10)',
            cursor: 'pointer', display: 'grid', placeItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
            flex: '0 0 auto', position: 'relative', padding: 0,
            transition: 'transform 200ms cubic-bezier(.34,1.56,.64,1), width 420ms cubic-bezier(.32,.72,0,1), height 420ms cubic-bezier(.32,.72,0,1)',
          }}
          onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.88)'}
          onPointerUp={(e) => e.currentTarget.style.transform = ''}
          onPointerLeave={(e) => e.currentTarget.style.transform = ''}
        >
          <FerrutekMini size={shrunk ? 20 : 26} />
          {!shrunk && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
              background: '#FF375F', color: '#fff', fontSize: 9.5, fontWeight: 800,
              display: 'grid', placeItems: 'center',
              border: `1.5px solid ${isDark ? '#000' : '#fff'}`,
            }}>3</span>
          )}
        </button>
    </>
  );
}

// ── Sheet (iba tras los DominioSheet) ──
export function FerruteckSheet({ openSheet, setOpenSheet, theme, onNavegar, BottomSheet }) {
  return (
    <>
      {/* ═══ FERRUTECK SHEET ═══ */}
      {openSheet === 'ferruteck' && (
        <BottomSheet theme={theme} onClose={() => setOpenSheet(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
              color: '#fff', display: 'grid', placeItems: 'center',
              boxShadow: '0 6px 14px rgba(255,45,85,.35)',
            }}>
              <Sparkles size={22} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', color: theme.text }}>Ferruteck</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>3 sugerencias para cerrar el mes</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { tag: 'Top movidos', txt: '12 SKUs con inv', val: '$96K', go: () => onNavegar(null, 'propuestas') },
              { tag: 'Reposición', txt: 'Cobertura baja del cliente', val: '$45K', go: () => onNavegar(null, 'inventarioGlobal') },
              { tag: 'Oportunidad', txt: 'Precio agresivo (múltiples listas)', val: '$193K', go: () => onNavegar(null, 'estrategiaPrecios') },
            ].map((s, i) => (
              <button key={i} onClick={() => { s.go(); setOpenSheet(null); }}
                style={{
                  padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`,
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10, fontFamily: TYPO.fontText,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{s.tag}</div>
                  <div style={{ fontSize: 13.5, color: theme.text, fontWeight: 600, marginTop: 2 }}>{s.txt}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

    </>
  );
}

export { FerrutekMini };
