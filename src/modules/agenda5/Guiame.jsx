// Agenda V5 · «Guíame» en la web (3.73.0): la Agenda lleva de la mano, un pendiente a la vez, en el orden de ataque de
// siguienteDe (vencidos → con hora → sin hora por prioridad). Modal centrado; el celular tiene su gemelo GuiameM.
import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Modal } from '../../components/perfil/comun';
import { toast } from '../../components/kit';
import { nombreClienteAgenda } from '../agenda/etiquetas';
import { hoyDe, siguienteDe, isoDia, sumarDias, fmtMin } from './calculo';
import { completarItem, cronometro, moverA, posponer } from './datos';

export default function Guiame({ abierto, onClose, d, propietario, hoy, puedeEditar, onAbrirItem }) {
  const { theme } = useTheme();
  const [saltados, setSaltados] = useState([]);
  useEffect(() => { if (abierto) setSaltados([]); }, [abierto]);
  const h = useMemo(() => hoyDe(d.items, propietario, hoy, { reuniones: d.reuniones, google: d.google, ahora: new Date() }), [d.items, d.reuniones, d.google, propietario, hoy]);
  const s = useMemo(() => siguienteDe(h, new Date(), { hoyIso: isoDia(hoy) }), [h, hoy]);
  const cola = s.cola.filter((it) => !saltados.includes(it.id));
  const it = cola[0] || null;
  const total = s.cola.length + h.hechasHoy.length;
  const pos = h.hechasHoy.length + (s.cola.length - cola.length) + 1;
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const run = (fn, msg) => fn().then(() => { if (msg) toast.ok(msg); }).catch((e) => toast.error(e.message));
  const btn = (primario) => ({ flex: 1, height: 40, borderRadius: 10, border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? theme.accent : theme.surface, color: primario ? '#fff' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' });
  useEffect(() => {
    if (!abierto || !it || !puedeEditar) return undefined;
    const onKey = (e) => { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === 'h' || e.key === 'H') run(() => completarItem(it, true), 'Hecha'); else if (e.key === 's' || e.key === 'S') setSaltados((x) => [...x, it.id]); else if (e.key === 'm' || e.key === 'M') run(() => moverA(it, isoDia(sumarDias(hoy, 1))), 'Para mañana'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, it, puedeEditar, hoy]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} ancho={460} titulo="Guíame" sub={it ? `${pos} de ${total} · ${s.vencidos ? `${s.vencidos} vencidos primero` : 'en orden de ataque'} · H hecha · S saltar · M mañana` : 'Día completo'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
        {!it ? (
          <div style={{ padding: '26px 8px', textAlign: 'center', color: theme.textMuted }}><Check size={28} style={{ color: theme.green }} /><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, color: theme.text, marginTop: 8 }}>No queda nada por hacer hoy</div><div style={{ fontSize: 13, marginTop: 4 }}>{h.hechasHoy.length ? `Cerraste ${h.hechasHoy.length}. Cierra el día en «Registro».` : 'Captura con N o jala algo de la Bandeja.'}</div></div>
        ) : (
          <>
            {s.actual && s.actual.tipo !== 'tarea' && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Ahora estás en <b style={{ color: theme.text }}>{s.actual.titulo}</b> hasta las {hhmm(s.actual.fin)}. Lo siguiente:</div>}
            <div onClick={() => onAbrirItem?.(it)} style={{ background: theme.surfaceInverse || theme.text, color: theme.textOnInverse || theme.bg, borderRadius: 14, padding: '18px 18px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 120, justifyContent: 'center' }}>
              {h.deAyer.some((x) => x.id === it.id) && <span style={{ fontSize: 11, fontWeight: 700, color: '#FF453A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Vencido</span>}
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{it.titulo}</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{[it.hora ? `a las ${it.hora}` : null, it.duracion_min ? fmtMin(it.duracion_min) : 'sin estimado', it.cliente_key && it.cliente_key !== 'interno' ? nombreClienteAgenda(it.cliente_key) : null, it.prioridad === 'alta' ? 'prioridad alta' : null].filter(Boolean).join(' · ')}</div>
              {it.notas && <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 72, overflow: 'hidden' }}>{it.notas}</div>}
              {it.inicio_real && <div style={{ fontSize: 12, color: theme.green, fontWeight: 600 }}>En curso · cronómetro corriendo</div>}
            </div>
            {puedeEditar && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={btn(true)} onClick={() => run(() => completarItem(it, true), 'Hecha')}>Hecha ✓</button>
                  <button type="button" style={btn(false)} onClick={() => run(() => cronometro(it, it.inicio_real ? 'parar' : 'iniciar'))}>{it.inicio_real ? 'Parar' : 'Empezar'}</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={{ ...btn(false), height: 34, fontSize: 12.5 }} onClick={() => setSaltados((x) => [...x, it.id])}>Saltar</button>
                  <button type="button" style={{ ...btn(false), height: 34, fontSize: 12.5 }} onClick={() => run(() => moverA(it, isoDia(sumarDias(hoy, 1))), 'Para mañana')}>Mañana</button>
                  <button type="button" style={{ ...btn(false), height: 34, fontSize: 12.5 }} onClick={() => run(() => posponer(it, 7), '7 días')}>7 días</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
