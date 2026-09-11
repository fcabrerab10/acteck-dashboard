// Agenda móvil · Semana (sólo lectura): lista por día (lun–dom) con Google + reuniones + tareas + arribos + cargas +
// cotizaciones (eventosCalendario de calculo.js) y toggles por fuente; ‹ Hoy › para cambiar de semana.
// Tocar: tarea → abre el ítem · reunión → minuta · Google → enlace. Google se conecta desde la computadora.
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { toneColors } from '../../../components/kit';
import { useGoogleEventos } from '../../../modules/agenda/google';
import { eventosCalendario, FUENTES_CALENDARIO, inicioSemana, sumarDias, isoDia } from '../../../modules/agenda/calculo';
import { MONO } from '../../util';
import { useAgenda } from './Agenda';
import { ChipM, TagCliente } from './comun';

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TONE = Object.fromEntries(FUENTES_CALENDARIO.map((f) => [f.id, f.tone]));

export default function Semana() {
  const { theme } = useTheme();
  const a = useAgenda();
  const { items, reuniones, hoy, transito, fuentesManuales, tracking, google, abrirItem, abrirMinuta } = a;
  const [ini, setIni] = useState(() => inicioSemana(hoy));
  const [toggles, setToggles] = useState(() => new Set(FUENTES_CALENDARIO.map((f) => f.id)));
  const desde = isoDia(ini), hasta = isoDia(sumarDias(ini, 6));
  const gq = useGoogleEventos(desde, hasta, google?.conectado);
  const datos = useMemo(() => ({ reuniones, items, google: gq.data || [], transito, fuentesManuales, tracking }), [reuniones, items, gq.data, transito, fuentesManuales, tracking]);
  const eventos = useMemo(() => eventosCalendario(datos, desde, hasta, toggles), [datos, desde, hasta, toggles]);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(ini, i));
  const hoyIso = isoDia(hoy);
  const toggleF = (id) => setToggles((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const abrir = (ev) => { if (ev.fuente === 'tareas') abrirItem(ev.ref); else if (ev.fuente === 'reuniones' && ev.ref.tipo === 'reunion') abrirMinuta(ev.ref); else if (ev.fuente === 'google' && ev.url) window.open(ev.url, '_blank', 'noopener'); };
  const navBtn = (Icon, onClick, label) => <button type="button" onClick={onClick} aria-label={label} style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Icon size={16} /></button>;
  const fin = sumarDias(ini, 6);

  return (
    <div style={{ padding: '0 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {navBtn(ChevronLeft, () => setIni(sumarDias(ini, -7)), 'Semana anterior')}
        <b style={{ flex: 1, textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{ini.getDate()} {ini.getMonth() !== fin.getMonth() ? MESES[ini.getMonth()] : ''} – {fin.getDate()} {MESES[fin.getMonth()]}</b>
        <button type="button" onClick={() => setIni(inicioSemana(hoy))} style={{ height: 36, padding: '0 12px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Hoy</button>
        {navBtn(ChevronRight, () => setIni(sumarDias(ini, 7)), 'Semana siguiente')}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none', marginRight: -16, paddingRight: 16 }}>
        {FUENTES_CALENDARIO.map((f) => {
          const inactiva = f.id === 'google' && !google?.conectado;
          const on = toggles.has(f.id) && !inactiva;
          return <ChipM key={f.id} on={on} tone={f.tone} onClick={inactiva ? undefined : () => toggleF(f.id)} style={{ opacity: inactiva ? 0.5 : 1, flexShrink: 0 }}>{f.label}{inactiva ? ' · sin conectar' : ''}</ChipM>;
        })}
      </div>
      {gq.error && <div style={{ fontSize: 11.5, color: theme.orange, marginBottom: 8 }}>Google: {gq.error.message}</div>}
      {dias.map((d) => {
        const iso = isoDia(d); const esHoy = iso === hoyIso; const evs = eventos.get(iso) || [];
        return (
          <div key={iso} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 10, marginBottom: 6 }}>
            <div style={{ textAlign: 'center', paddingTop: 6 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: esHoy ? theme.accent : theme.textMuted }}>{DIAS[(d.getDay() + 6) % 7].slice(0, 3)}</div>
              <div style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: esHoy ? theme.accent : 'transparent', color: esHoy ? '#FFF' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600 }}>{d.getDate()}</div>
            </div>
            <div style={{ minHeight: 44, borderBottom: `1px solid ${theme.border}`, padding: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {evs.map((ev) => {
                const [bg, col] = toneColors(theme, TONE[ev.fuente] || 'gray');
                const abrible = ev.fuente === 'tareas' || (ev.fuente === 'reuniones' && ev.ref?.tipo === 'reunion') || (ev.fuente === 'google' && ev.url);
                return (
                  <div key={ev.id} onClick={abrible ? () => abrir(ev) : undefined} role={abrible ? 'button' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, background: bg, borderLeft: `3px solid ${col}`, fontFamily: TYPO.fontText, fontSize: 13.5, color: theme.text, cursor: abrible ? 'pointer' : 'default' }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: col, fontWeight: 600, minWidth: 38 }}>{ev.hora || (ev.todoElDia ? 'día' : '')}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.titulo}</span>
                    <TagCliente clienteKey={ev.cliente_key} />
                    {ev.fuente === 'google' && <ExternalLink size={12} color={col} />}
                  </div>
                );
              })}
              {!evs.length && <span style={{ fontSize: 12, color: theme.textSubtle || theme.textMuted, padding: '8px 2px' }}>—</span>}
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 2px', fontSize: 11, color: theme.textMuted }}>
        {FUENTES_CALENDARIO.filter((f) => toggles.has(f.id)).map((f) => <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: toneColors(theme, f.tone)[1], display: 'inline-block' }} />{f.label}</span>)}
      </div>
    </div>
  );
}
