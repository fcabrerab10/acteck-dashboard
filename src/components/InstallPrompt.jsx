// InstallPrompt — botón discreto para instalar la PWA en escritorio/Android.
// En iOS Safari no dispara beforeinstallprompt; el usuario instala vía Share → Add to Home Screen.
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

export default function InstallPrompt({ compact = false }) {
  const { theme } = useTheme();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);

    const onBefore = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const handleClick = async () => {
    try {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } catch (_) { /* noop */ }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: compact ? 'auto' : '100%',
        padding: compact ? '6px 10px' : '10px 12px',
        borderRadius: 999,
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        color: theme.text,
        fontFamily: TYPO.fontText,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        cursor: 'pointer',
        transition: 'transform 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <Download size={14} strokeWidth={2} />
      <span>Instalar app</span>
    </button>
  );
}
