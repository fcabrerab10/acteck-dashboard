// Agenda móvil · vista Calendario (sólo lectura), Mes | Semana:
//   Mes     rejilla de 6×7 con puntos por fuente; al tocar un día se abre su lista debajo.
//   Semana  lista por día (lun–dom).
// Las dos leen Google + reuniones + VIAJES + tareas + arribos + cargas + cotizaciones (eventosCalendario
// de calculo.js) con los mismos toggles por fuente; ‹ Hoy › mueve el mes o la semana.
// Tocar: tarea → abre el ítem · reunión/viaje → minuta · Google → enlace. Google se conecta desde la computadora.
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { toneColors } from '../../../components/kit';
import { useGoogleEventos } from '../../../modules/agenda/google';
import { eventosCalendario, FUENTES_CALENDARIO, inicioSemana, sumarDias, isoDia, cuando } from '../../../modules/agenda/calculo';
import { MONO } from '../../util';
import { useAgenda } from './Agenda';
import { Segmented } from '../../piezas';
import { ChipM, TagCliente, SeccionM } from './comun';

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VISTAS_CAL = [{ id: 'mes', label: 'Mes' }, { id: 'semana', label: 'Semana' }];
/** Lunes de la primera celda del mes (la rejilla siempre tiene 42 días). */
const inicioRejilla = (d) => inicioSemana(new Date(d.getFullYear(), d.getMonth(), 1));
const TONE = Object.fromEntries(FUENTES_CALENDARIO.map((f) => [f.id, f.tone]));

export default function Semana() {
  const { theme } = useTheme();
  const a = useAgenda();
  const { items, reuniones, hoy, transito, fuentesManuales, tracking, google, abrirItem, abrirMinuta } = a;
  const [modo, setModo] = useState('mes');
  const [ini, setIni] = useState(() => inicioSemana(hoy));
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [dia, setDia] = useState(() => isoDia(hoy));
  const [toggles, setToggles] = useState(() => new Set(FUENTES_CALENDARIO.map((f) => f.id)));
  const rejilla = useMemo(() => inicioRejilla(mes), [mes]);
  const arranque = modo === 'mes' ? rejilla : ini;
  const largo = modo === 'mes' ? 41 : 6;
  const desde = isoDia(arranque), hasta = isoDia(sumarDias(arranque, largo));
  const gq = useGoogleEventos(desde, hasta, google?.conectado);
  const datos = useMemo(() => ({ reuniones, items, google: gq.data || [], transito, fuentesManuales, tracking }), [reuniones, items, gq.data, transito, fuentesManuales, tracking]);
  const eventos = useMemo(() => eventosCalendario(datos, desde, hasta, toggles), [datos, desde, hasta, toggles]);
  const dias = Array.from({ length: largo + 1 }, (_, i) => sumarDias(arranque, i));
  const hoyIso = isoDia(hoy);
  const toggleF = (id) => setToggles((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const abrir = (ev) => { if (ev.fuente === 'tareas') abrirItem(ev.ref); else if ((ev.fuente === 'reuniones' || ev.fuente === 'viajes') && ev.ref.tipo === 'reunion') abrirMinuta(ev.ref); else if (ev.fuente === 'google' && ev.url) window.open(ev.url, '_blank', 'noopener'); };
  const navBtn = (Icon, onClick, label) => <button type="button" onClick={onClick} aria-label={label} style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Icon size={16} /></button>;
  const fin = sumarDias(ini, 6);
  const irHoy = () => { setIni(inicioSemana(hoy)); setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); setDia(hoyIso); };
  const mover = (n) => (modo === 'mes' ? setMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1)) : setIni(sumarDias(ini, n * 7)));
  const filaEvento = (ev) => {
    const [bg, col] = toneColors(theme, TONE[ev.fuente] || 'gray');
    const abrible = ev.fuente === 'tareas' || ((ev.fuente === 'reuniones' || ev.fuente === 'viajes') && ev.ref?.tipo === 'reunion') || (ev.fuente === 'google' && ev.url);
    return (
      <div key={ev.id} onClick={abrible ? () => abrir(ev) : undefined} role={abrible ? 'button' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, background: bg, borderLeft: `3px solid ${col}`, fontFamily: TYPO.fontText, fontSize: 13.5, color: theme.text, cursor: abrible ? 'pointer' : 'default' }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: col, fontWeight: 600, minWidth: 38 }}>{ev.hora || (ev.todoElDia ? 'día' : '')}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.titulo}</span>
        <TagCliente clienteKey={ev.cliente_key} />
        {ev.fuente === 'google' && <ExternalLink size={12} color={col} />}
      </div>
    );
  };

  return (
    <div style={{ padding: '0 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {navBtn(ChevronLeft, () => mover(-1), modo === 'mes' ? 'Mes anterior' : 'Semana anterior')}
        <b style={{ flex: 1, textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {modo === 'mes' ? `${MESES_LARGO[mes.getMonth()]} ${mes.getFullYear()}` : `${ini.getDate()} ${ini.getMonth() !== fin.getMonth() ? MESES[ini.getMonth()] : ''} – ${fin.getDate()} ${MESES[fin.getMonth()]}`}
        </b>
        <button type="button" onClick={irHoy} style={{ height: 36, padding: '0 12px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Hoy</button>
        {navBtn(ChevronRight, () => mover(1), modo === 'mes' ? 'Mes siguiente' : 'Semana siguiente')}
      </div>
      <div style={{ marginBottom: 10 }}>
        <Segmented size="md" value={modo} onChange={setModo} options={VISTAS_CAL} style={{ display: 'flex', width: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none', marginRight: -16, paddingRight: 16 }}>
        {FUENTES_CALENDARIO.map((f) => {
          const inactiva = f.id === 'google' && !google?.conectado;
          const on = toggles.has(f.id) && !inactiva;
          return <ChipM key={f.id} on={on} tone={f.tone} onClick={inactiva ? undefined : () => toggleF(f.id)} style={{ opacity: inactiva ? 0.5 : 1, flexShrink: 0 }}>{f.label}{inactiva ? ' · sin conectar' : ''}</ChipM>;
        })}
      </div>
      {gq.error && <div style={{ fontSize: 11.5, color: theme.orange, marginBottom: 8 }}>Google: {gq.error.message}</div>}
      {modo === 'mes' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DIAS.map((d) => <div key={d} style={{ textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted }}>{d.slice(0, 1)}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {dias.map((d) => {
              const iso = isoDia(d); const esHoy = iso === hoyIso; const sel = iso === dia;
              const evs = eventos.get(iso) || [];
              const fuera = d.getMonth() !== mes.getMonth();
              const puntos = [...new Set(evs.map((e) => e.fuente))].slice(0, 4);
              return (
                <button key={iso} type="button" onClick={() => setDia(iso)} aria-label={iso}
                  style={{ aspectRatio: '1 / 1', minHeight: 42, border: sel ? `1.5px solid ${theme.accent}` : '1px solid transparent', borderRadius: 10, background: sel ? (theme.accentBg || 'rgba(0,122,255,0.08)') : 'transparent', color: fuera ? theme.textSubtle || theme.textMuted : theme.text, opacity: fuera ? 0.45 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', padding: 0 }}>
                  <span style={{ display: 'inline-flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: esHoy ? theme.accent : 'transparent', color: esHoy ? '#FFF' : 'inherit', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600 }}>{d.getDate()}</span>
                  <span style={{ display: 'flex', gap: 2, height: 5 }}>
                    {puntos.map((f) => <i key={f} style={{ width: 5, height: 5, borderRadius: 999, background: toneColors(theme, TONE[f] || 'gray')[1], display: 'inline-block' }} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <SeccionM n={(eventos.get(dia) || []).length}>{cuando(dia, hoy)}</SeccionM>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(eventos.get(dia) || []).map(filaEvento)}
            {!(eventos.get(dia) || []).length && <span style={{ fontSize: 12.5, color: theme.textMuted, padding: '2px 2px 8px' }}>Nada agendado ese día.</span>}
          </div>
        </>
      )}
      {modo === 'semana' && dias.map((d) => {
        const iso = isoDia(d); const esHoy = iso === hoyIso; const evs = eventos.get(iso) || [];
        return (
          <div key={iso} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 10, marginBottom: 6 }}>
            <div style={{ textAlign: 'center', paddingTop: 6 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: esHoy ? theme.accent : theme.textMuted }}>{DIAS[(d.getDay() + 6) % 7].slice(0, 3)}</div>
              <div style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: esHoy ? theme.accent : 'transparent', color: esHoy ? '#FFF' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600 }}>{d.getDate()}</div>
            </div>
            <div style={{ minHeight: 44, borderBottom: `1px solid ${theme.border}`, padding: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {evs.map(filaEvento)}
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
