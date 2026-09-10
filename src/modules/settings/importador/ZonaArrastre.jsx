// Zona de arrastre compacta por fila: "⬆ Excel" / "⬆ CSV". Drag & drop + click.
import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';

export default function ZonaArrastre({ kind = 'Excel', accept, disabled, onFile, texto }) {
  const { theme } = useTheme();
  const ref = useRef();
  const [over, setOver] = useState(false);
  const accent = theme.accent;
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  const entregar = (f) => { if (f && !disabled) onFile(f); };
  return (
    <div role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) ref.current?.click(); }}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ref.current?.click(); } }}
      onDragOver={(e) => { stop(e); if (!disabled) setOver(true); }}
      onDragEnter={(e) => { stop(e); if (!disabled) setOver(true); }}
      onDragLeave={(e) => { stop(e); setOver(false); }}
      onDrop={(e) => { stop(e); setOver(false); entregar(e.dataTransfer?.files?.[0]); }}
      title={disabled ? 'Espera a que termine la carga en curso' : `Arrastra el ${kind} aquí o haz clic para elegirlo`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 92, height: 28, padding: '0 10px', borderRadius: 999,
        border: `1px dashed ${over ? accent : theme.borderStrong || theme.border}`, background: over ? `${accent}14` : 'transparent',
        color: disabled ? theme.textSubtle || theme.textMuted : over ? accent : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, whiteSpace: 'nowrap', userSelect: 'none',
        transition: `border-color ${DUR.state}ms ${EASE}, background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
      }}>
      <Upload size={12} strokeWidth={2.2} />
      {texto || kind}
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onClick={(e) => e.stopPropagation()}
        onChange={(e) => { entregar(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
