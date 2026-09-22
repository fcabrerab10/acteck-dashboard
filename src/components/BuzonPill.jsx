// Pastilla del buzón de salida · "Sin conexión · 3 por sincronizar".
// Se monta en el chrome de la web (Topbar) y en la barra superior del móvil.
// Se esconde cuando hay señal y no queda nada pendiente: en el día a día no se ve.
import React, { Suspense, lazy, useState } from 'react';
import { WifiOff, UploadCloud, AlertTriangle } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { EASE, DUR } from '../lib/motion';
import { useBuzon } from '../lib/buzon';

const BuzonHoja = lazy(() => import('./BuzonHoja'));

export default function BuzonPill({ oscuro = false, compacto = false }) {
  const { theme } = useTheme();
  const { pendientes, items, sincronizando, ultimoError, online, sincronizar, reintentar, descartar } = useBuzon();
  const [hoja, setHoja] = useState(false);

  const visible = !online || pendientes > 0;
  if (!visible) return null;

  const tono = ultimoError ? (theme.red || '#FF3B30') : online ? (theme.accent || '#007AFF') : (theme.orange || '#FF9500');
  const Icono = ultimoError ? AlertTriangle : online ? UploadCloud : WifiOff;
  const texto = ultimoError
    ? `${pendientes} sin sincronizar`
    : !online
      ? (pendientes > 0 ? `Sin conexión · ${pendientes} por sincronizar` : 'Sin conexión')
      : sincronizando ? 'Sincronizando…' : `${pendientes} por sincronizar`;

  return (
    <>
      <button
        type="button"
        onClick={() => { setHoja(true); if (online) sincronizar().catch(() => {}); }}
        title={online ? 'Cambios guardados en el dispositivo · toca para ver el detalle' : 'Sin conexión · lo capturado se guarda aquí y se sube al volver la señal'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: compacto ? '0 8px' : '0 10px',
          borderRadius: 999, border: 0, cursor: 'pointer', maxWidth: compacto ? 140 : 260,
          background: oscuro ? 'rgba(255,255,255,0.12)' : `${tono}1A`, color: oscuro ? '#FFF' : tono,
          fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.005em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: `background ${DUR.state}ms ${EASE}`,
        }}
      >
        <Icono size={12} strokeWidth={2.2} style={{ flexShrink: 0 }} />
        {!compacto && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{texto}</span>}
        {compacto && pendientes > 0 && <span>{pendientes}</span>}
      </button>
      {hoja && (
        <Suspense fallback={null}>
          <BuzonHoja
            abierto
            onClose={() => setHoja(false)}
            items={items}
            sincronizando={sincronizando}
            ultimoError={ultimoError}
            online={online}
            onReintentar={() => reintentar().catch(() => {})}
            onDescartar={(id) => descartar(id).catch(() => {})}
          />
        </Suspense>
      )}
    </>
  );
}
