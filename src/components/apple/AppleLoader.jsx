// AppleLoader — spinner estilo iOS/macOS. 12 trazos rotando con opacity
// gradient. Fade in suave. Se usa cuando cualquier pestaña está cargando.
import React from 'react';
import { useTheme } from '../../lib/themeContext';

const APPLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

export default function AppleLoader({ label, size = 20, minHeight = '60vh' }) {
  const { theme } = useTheme();
  return (
    <>
      <style>{`
        @keyframes appleSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes appleFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        minHeight, width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16,
        animation: `appleFadeIn 400ms ${APPLE_EASE} both`,
        animationDelay: '150ms',
        opacity: 0,
      }}>
        <div style={{
          position: 'relative', width: size * 2, height: size * 2,
          animation: 'appleSpin 900ms linear infinite',
        }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{
              position: 'absolute',
              top: 0, left: '50%',
              width: 2, height: size * 0.55,
              background: theme.textMuted,
              borderRadius: 999,
              transformOrigin: `1px ${size}px`,
              transform: `translateX(-1px) rotate(${i * 30}deg)`,
              opacity: (i + 1) / 12,
            }} />
          ))}
        </div>
        {label && (
          <div style={{
            fontSize: 13, color: theme.textMuted, fontWeight: 500,
            fontFamily: '-apple-system, "SF Pro Text", sans-serif',
            letterSpacing: 0,
          }}>{label}</div>
        )}
      </div>
    </>
  );
}

// ─── Fullscreen loader (para bootstrap auth) ───
export function AppleLoaderFullscreen({ label = 'Cargando…' }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#F5F5F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          position: 'relative', width: 40, height: 40,
          animation: 'appleSpin 900ms linear infinite',
        }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{
              position: 'absolute',
              top: 0, left: '50%',
              width: 2.5, height: 11,
              background: '#6E6E73',
              borderRadius: 999,
              transformOrigin: `1.25px 20px`,
              transform: `translateX(-1.25px) rotate(${i * 30}deg)`,
              opacity: (i + 1) / 12,
            }} />
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#86868B', fontWeight: 500 }}>{label}</div>
      </div>
      <style>{`
        @keyframes appleSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── PageTransition — fade+slide sutil al montar cada página ───
export function PageTransition({ children, keyId }) {
  return (
    <>
      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div key={keyId} style={{
        animation: `pageEnter 340ms ${APPLE_EASE} both`,
      }}>{children}</div>
    </>
  );
}
