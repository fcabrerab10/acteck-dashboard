// FerrutekLoader · loader oficial del dashboard
// ─ Full-screen: fantasmita bobbing + shadow + 3 dots pulsando + label
// ─ Inline: mini ghost + 3 dots (para dentro de cards o botones)
// Reemplaza el spinner circular genérico

import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

function FerrutekBigGhost({ size = 70, id = 'default' }) {
  // Genera un id único para el gradient (evita colisiones si hay varios ghosts)
  const gid = `ferruLdBody_${id}`;
  return (
    <svg width={size} height={size * 1.07} viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF" />
          <stop offset="40%" stopColor="#D0A8F0" />
          <stop offset="100%" stopColor="#AF52DE" />
        </radialGradient>
      </defs>
      {/* Halo púrpura sutil */}
      <ellipse cx="70" cy="75" rx="52" ry="60" fill="#AF52DE" opacity="0.22" />
      {/* Cuerpo */}
      <path
        d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"
        fill={`url(#${gid})`} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"
      />
      {/* Cachetes */}
      <ellipse cx="45" cy="65" rx="8" ry="5" fill="#FFB4E0" opacity="0.6" />
      <ellipse cx="95" cy="65" rx="8" ry="5" fill="#FFB4E0" opacity="0.6" />
      {/* Ojos */}
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="54" cy="47" rx="3" ry="4" fill="#FFF" />
      <circle cx="55.5" cy="46" r="1" fill="#FFF" />
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="90" cy="47" rx="3" ry="4" fill="#FFF" />
      <circle cx="91.5" cy="46" r="1" fill="#FFF" />
      {/* Sonrisa */}
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const KEYFRAMES = `
  @keyframes ferrutekLdBob {
    0%, 100% { transform: translateY(0) rotate(-3deg); }
    50%      { transform: translateY(-10px) rotate(3deg); }
  }
  @keyframes ferrutekLdShadow {
    0%, 100% { width: 56px; opacity: 0.55; }
    50%      { width: 40px; opacity: 0.28; }
  }
  @keyframes ferrutekLdDot {
    0%, 80%, 100% { opacity: 0.28; transform: scale(0.8); }
    40%           { opacity: 1;    transform: scale(1.2); }
  }
`;

function LoaderDots({ compact = false }) {
  const sz = compact ? 4 : 5;
  const gap = compact ? 3 : 4;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <span style={{ display: 'inline-flex', gap, alignItems: 'center' }}>
        <span style={{ width: sz, height: sz, borderRadius: '50%', background: '#BF5AF2', animation: 'ferrutekLdDot 1.2s ease-in-out infinite' }} />
        <span style={{ width: sz, height: sz, borderRadius: '50%', background: '#A579E8', animation: 'ferrutekLdDot 1.2s ease-in-out 0.2s infinite' }} />
        <span style={{ width: sz, height: sz, borderRadius: '50%', background: '#64D2FF', animation: 'ferrutekLdDot 1.2s ease-in-out 0.4s infinite' }} />
      </span>
    </>
  );
}

// ═════════════ Full-screen loader ═════════════
export default function FerrutekLoader({
  label = 'Cargando…',
  sub = 'Ferruteck está trayendo tus datos',
  fullscreen = false,
  minHeight = 320,
  ghostSize = 70,
  id = 'main',
}) {
  const { theme } = useTheme();
  const isDark = theme?.mode === 'dark';

  const containerStyle = fullscreen ? {
    position: 'fixed', inset: 0, zIndex: 200,
    background: theme?.bg || '#F5F5F7',
  } : {
    minHeight,
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        ...containerStyle,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: TYPO.fontText,
      }}>
        <div style={{ position: 'relative', display: 'inline-block', animation: 'ferrutekLdBob 2.4s ease-in-out infinite' }}>
          <FerrutekBigGhost size={ghostSize} id={id} />
          {/* Sombra */}
          <div style={{
            position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)',
            width: 56, height: 8, borderRadius: '50%',
            background: `radial-gradient(ellipse, ${isDark ? 'rgba(191,90,242,0.4)' : 'rgba(0,0,0,0.35)'}, transparent 70%)`,
            animation: 'ferrutekLdShadow 2.4s ease-in-out infinite',
          }} />
        </div>
        <div style={{
          fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 500,
          color: theme?.text || '#1D1D1F', letterSpacing: '-0.005em', marginTop: 30,
        }}>{label}</div>
        {sub && (
          <div style={{
            fontFamily: TYPO.fontText, fontSize: 11.5,
            color: theme?.textMuted || '#6E6E73', marginTop: 4, textAlign: 'center', maxWidth: 320,
          }}>{sub}</div>
        )}
        <div style={{ marginTop: 18 }}>
          <LoaderDots />
        </div>
      </div>
    </>
  );
}

// ═════════════ Inline loader (para cards / secciones) ═════════════
export function FerrutekLoaderInline({ label = 'Cargando…', ghostSize = 26, id = 'inline' }) {
  const { theme } = useTheme();
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '4px 0', fontFamily: TYPO.fontText,
      }}>
        <span style={{ display: 'inline-block', animation: 'ferrutekLdBob 2.4s ease-in-out infinite' }}>
          <FerrutekBigGhost size={ghostSize} id={id} />
        </span>
        <span style={{
          fontFamily: TYPO.fontText, fontSize: 12,
          color: theme?.textMuted || '#6E6E73',
        }}>{label}</span>
        <LoaderDots compact />
      </div>
    </>
  );
}

// ═════════════ Card loader (skeleton-like, para llenar una card ═════════════
export function FerrutekLoaderCard({ label = 'Cargando…', minHeight = 180, id = 'card' }) {
  const { theme } = useTheme();
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        minHeight, width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12,
      }}>
        <span style={{ display: 'inline-block', animation: 'ferrutekLdBob 2.4s ease-in-out infinite' }}>
          <FerrutekBigGhost size={44} id={id} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 11.5, color: theme?.textMuted || '#6E6E73' }}>{label}</div>
          <LoaderDots compact />
        </div>
      </div>
    </>
  );
}
