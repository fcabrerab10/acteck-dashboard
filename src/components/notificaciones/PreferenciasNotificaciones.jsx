// PreferenciasNotificaciones — vista ⚙️ dentro del panel del centro.
// Por área: Segmented Inmediato / Resumen / Silencio. Clientes (pills, vacío =
// todos). Hora del resumen (select, sólo horas con cron). Correo del resumen y
// correo de críticas (toggles iOS). Guardado optimista en perfiles.preferencias.notif
// vía guardarPreferenciasNotif → store de preferencias (RPC set_preferencias).
import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Segmented, Pill, toast } from '../kit';
import {
  AREAS, AREA_LABEL, HORAS_RESUMEN, NOMBRE_CLIENTE, usePreferenciasNotif, guardarPreferenciasNotif, normalizarPrefsNotif,
} from '../../lib/alertas';

const CLIENTES_PREF = ['digitalife', 'pcel', 'dicotech', 'mayoreo', 'distribuidor', 'e_commerce', 'mostrador'];
const MODOS = [{ id: 'inmediato', label: 'Inmediato' }, { id: 'resumen', label: 'Resumen' }, { id: 'silencio', label: 'Silencio' }];
const AYUDA_MODO = {
  inmediato: 'Aparece arriba en la campana en cuanto se genera.',
  resumen: 'Va a la sección "Resumen programado" y al correo diario.',
  silencio: 'Sólo en la pestaña Silenciadas. Las críticas siempre se muestran.',
};

export function ToggleIOS({ on, onChange, label }) {
  const { theme } = useTheme();
  const W = 40, H = 24, K = 20;
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange?.(!on)}
      style={{ position: 'relative', width: W, height: H, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
        background: on ? (theme.green || '#34C759') : (theme.mode === 'dark' ? 'rgba(120,120,128,0.32)' : 'rgba(120,120,128,0.16)'),
        transition: `background ${DUR.state}ms ${EASE}`, flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? W - K - 2 : 2, width: K, height: K, borderRadius: 999, background: '#FFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 3px 8px rgba(0,0,0,0.15)', transition: `left ${DUR.state}ms ${EASE}` }} />
    </button>
  );
}

export default function PreferenciasNotificaciones({ onVolver }) {
  const { theme } = useTheme();
  const { data: prefsRemotas, isLoading } = usePreferenciasNotif();
  const [prefs, setPrefs] = useState(() => normalizarPrefsNotif(prefsRemotas));
  useEffect(() => { if (prefsRemotas) setPrefs(prefsRemotas); }, [prefsRemotas]);

  const guardar = async (next) => {
    setPrefs(next); // optimista en la vista
    try { await guardarPreferenciasNotif(next); }
    catch (e) { console.error('prefs notif:', e); toast.error('No se pudieron guardar las preferencias'); if (prefsRemotas) setPrefs(prefsRemotas); }
  };
  const setArea = (area, modo) => guardar({ ...prefs, areas: { ...prefs.areas, [area]: modo } });
  const toggleCliente = (ck) => {
    const cur = prefs.clientes || [];
    const next = cur.includes(ck) ? cur.filter((x) => x !== ck) : [...cur, ck];
    guardar({ ...prefs, clientes: next.length ? next : null });
  };

  const secTitulo = { fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textSubtle, padding: '14px 16px 6px' };
  const fila = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 16px', borderTop: `1px solid ${theme.border}` };
  const lbl = { fontSize: 13, color: theme.text, fontWeight: 500 };
  const sub = { fontSize: 11, color: theme.textMuted, marginTop: 1 };

  return (
    <div style={{ fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px 10px', borderBottom: `1px solid ${theme.border}` }}>
        <button type="button" onClick={onVolver} title="Volver" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 0, background: 'transparent', color: theme.accent || '#007AFF', fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '2px 4px 2px 0' }}>
          <ChevronLeft size={16} /> Atrás
        </button>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, marginLeft: 4 }}>Preferencias</span>
        {isLoading && <span style={{ fontSize: 11, color: theme.textSubtle, marginLeft: 'auto' }}>Cargando…</span>}
      </div>

      <div style={secTitulo}>Por área</div>
      {AREAS.map((area, i) => (
        <div key={area} style={{ ...fila, borderTop: i === 0 ? 'none' : fila.borderTop, alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
            <span style={lbl}>{AREA_LABEL[area]}</span>
            <Segmented size="sm" value={prefs.areas[area]} onChange={(m) => setArea(area, m)} options={MODOS} />
          </div>
          <span style={sub}>{AYUDA_MODO[prefs.areas[area]]}</span>
        </div>
      ))}

      <div style={secTitulo}>Clientes</div>
      <div style={{ padding: '2px 16px 10px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CLIENTES_PREF.map((ck) => {
            const on = !prefs.clientes || prefs.clientes.includes(ck);
            const explicito = !!prefs.clientes && prefs.clientes.includes(ck);
            return (
              <Pill key={ck} tone={explicito ? 'blue' : on ? 'gray' : 'gray'} onClick={() => toggleCliente(ck)} title={on ? 'Recibiendo avisos' : 'Sin avisos de este cliente'}
                style={{ cursor: 'pointer', opacity: on ? 1 : 0.45, border: `1px solid ${explicito ? 'transparent' : theme.border}`, transition: `opacity ${DUR.state}ms ${EASE}` }}>
                {NOMBRE_CLIENTE[ck] || ck}
              </Pill>
            );
          })}
        </div>
        <div style={{ ...sub, marginTop: 6 }}>{prefs.clientes ? `Sólo ${prefs.clientes.length} cliente${prefs.clientes.length === 1 ? '' : 's'}. Los avisos sin cliente (inventario, datos) se muestran siempre.` : 'Todos los clientes. Toca uno para quedarte sólo con ése.'}</div>
        {prefs.clientes && (
          <button type="button" onClick={() => guardar({ ...prefs, clientes: null })} style={{ border: 0, background: 'transparent', color: theme.accent || '#007AFF', fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '4px 0 0' }}>Volver a todos</button>
        )}
      </div>

      <div style={secTitulo}>Resumen programado</div>
      <div style={{ ...fila, borderTop: 'none' }}>
        <div><div style={lbl}>Hora del resumen</div><div style={sub}>Hora de la Ciudad de México.</div></div>
        <select value={prefs.resumen.hora} onChange={(e) => guardar({ ...prefs, resumen: { ...prefs.resumen, hora: e.target.value } })}
          style={{ height: 28, padding: '0 8px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
          {HORAS_RESUMEN.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <div style={fila}>
        <div><div style={lbl}>Correo del resumen</div><div style={sub}>Un correo al día con las áreas en modo Resumen.</div></div>
        <ToggleIOS on={prefs.resumen.correo} label="Correo del resumen" onChange={(v) => guardar({ ...prefs, resumen: { ...prefs.resumen, correo: v } })} />
      </div>
      <div style={fila}>
        <div><div style={lbl}>Correo de críticas</div><div style={sub}>Las críticas nuevas llegan al momento, sin esperar el resumen.</div></div>
        <ToggleIOS on={prefs.criticas_correo} label="Correo de críticas" onChange={(v) => guardar({ ...prefs, criticas_correo: v })} />
      </div>
      <div style={{ padding: '10px 16px 14px', fontSize: 11, color: theme.textSubtle, borderTop: `1px solid ${theme.border}` }}>Se guarda al instante en tu perfil.</div>
    </div>
  );
}
