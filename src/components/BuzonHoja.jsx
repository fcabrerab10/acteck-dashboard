// Hoja del buzón de salida · lista lo que está esperando señal, con Reintentar y Descartar.
// Se carga en perezoso desde BuzonPill: sólo pesa cuando hay algo pendiente y se toca la pastilla.
import React from 'react';
import { X, RefreshCw, Trash2, WifiOff, Check } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { EASE, DUR } from '../lib/motion';
import { elevation } from '../lib/elevation';
import { describir } from '../lib/buzon';

const hora = (ts) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function BuzonHoja({ abierto, onClose, items = [], sincronizando, ultimoError, online, onReintentar, onDescartar }) {
  const { theme } = useTheme();
  if (!abierto) return null;
  return (
    <div role="dialog" aria-label="Cambios por sincronizar" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.28)',
      display: 'flex', justifyContent: 'flex-end', animation: `buzonFade ${DUR.state}ms ${EASE} both`,
    }}>
      <style>{'@keyframes buzonFade{from{opacity:0}to{opacity:1}}@keyframes buzonEntra{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}'}</style>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(420px, 100vw)', height: '100%', overflowY: 'auto', background: theme.bg, borderLeft: `1px solid ${theme.border}`,
        boxShadow: elevation(theme, 'flotante'), fontFamily: TYPO.fontText, color: theme.text,
        padding: 'calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 20px)',
        animation: `buzonEntra ${DUR.content}ms ${EASE} both`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>Cambios por sincronizar</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              {items.length === 0 ? 'Todo está guardado en Supabase.'
                : `${items.length} cambio${items.length === 1 ? '' : 's'} guardado${items.length === 1 ? '' : 's'} en este dispositivo. ${online ? 'Se están subiendo.' : 'Se suben en cuanto vuelva la señal.'}`}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={btnIcono(theme)}><X size={15} /></button>
        </div>

        {ultimoError && (
          <div style={{ padding: '9px 11px', borderRadius: 10, background: theme.redSuave || 'rgba(255,59,48,0.10)', color: theme.red, fontSize: 11.5, lineHeight: 1.45, marginBottom: 10 }}>
            {ultimoError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button type="button" onClick={onReintentar} disabled={sincronizando || !items.length} style={btn(theme, true, sincronizando || !items.length)}>
            <RefreshCw size={12} style={sincronizando ? { animation: 'spin 1s linear infinite' } : undefined} /> {sincronizando ? 'Sincronizando…' : 'Reintentar'}
          </button>
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>

        {items.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 12px', color: theme.textMuted, fontSize: 12.5 }}>
            <Check size={14} color={theme.green} /> No hay nada esperando.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((it, i) => (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 11px', borderRadius: 10,
                background: theme.surface, border: `1px solid ${it.error ? (theme.red || '#FF3B30') + '55' : theme.border}`,
              }}>
                <span style={{ marginTop: 2, color: it.error ? theme.red : theme.textMuted, flexShrink: 0 }}><WifiOff size={13} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{describir(it)}</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>
                    {hora(it.ts)}{it.origen ? ` · ${it.origen}` : ''}{i === 0 ? ' · el siguiente en subir' : ''}{it.intentos ? ` · ${it.intentos} intento${it.intentos === 1 ? '' : 's'}` : ''}
                  </div>
                  {it.error && <div style={{ fontSize: 10.5, color: theme.red, marginTop: 3, wordBreak: 'break-word' }}>{it.error}</div>}
                </div>
                <button type="button" onClick={() => onDescartar(it.id)} title="Descartar este cambio" aria-label="Descartar" style={btnIcono(theme)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 14, lineHeight: 1.5 }}>
          Los cambios se aplican en el orden en que se capturaron. Si uno falla, la cola se detiene ahí para no
          desordenar el historial: arréglalo o descártalo y el resto sigue.
        </div>
      </div>
    </div>
  );
}

const btnIcono = (theme) => ({
  width: 26, height: 26, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
  background: 'transparent', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
});

const btn = (theme, primario, off) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 999,
  border: primario ? 0 : `1px solid ${theme.border}`, cursor: off ? 'default' : 'pointer', opacity: off ? 0.5 : 1,
  background: primario ? (theme.accent || '#007AFF') : 'transparent', color: primario ? '#FFF' : theme.text,
  fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500,
});
