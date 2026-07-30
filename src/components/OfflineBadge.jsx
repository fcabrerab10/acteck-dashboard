// OfflineBadge — pill flotante que aparece cuando navigator.onLine === false.
// Usa tokens de useTheme(), sin colores hardcoded.
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

export default function OfflineBadge() {
  const { theme } = useTheme();
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 999,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        color: theme.text,
        fontFamily: TYPO.fontText,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
      role="status"
      aria-live="polite"
    >
      <WifiOff size={14} strokeWidth={2} color={theme.orange || theme.textMuted} />
      <span>Sin conexión · usando datos guardados</span>
    </div>
  );
}
