// Agenda «que te lleva» · celular (3.78.0 · 2026-10-05). Mismo motor que la web (modules/agenda5/dia): Armar el día →
// Guía (una cosa a la vez) → Cierre. Chip «Día» de AgendaM; «Horario» sigue siendo la vista de reloj de HoyM.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Phone, ExternalLink, Sunrise, Moon, Compass } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { hoyDe, siguienteDe, isoDia, fmtHora } from '../../../modules/agenda5/calculo';
import { completarItem, cronometro, moverA } from '../../../modules/agenda5/datos';
import { useFuentesDia, propuestasDe, decidir, cerrarDia, horasDe, navegar } from '../../../modules/agenda5/dia/datos';
import { HILOS, hiloDe, porHilo, cargaDia, fmtMin, momentoDe } from '../../../modules/agenda5/dia/proponer';
import { ListaAgrupada, Fila, BotonGrande, toast } from '../../piezas';
import { usePreferencias } from '../../../lib/preferencias';
import RitmoM from './RitmoM';

const FASES = [['armar', 'Armar'], ['guia', 'Guía'], ['cierre', 'Cierre']];
const hiloDeId = (id) => HILOS.find((x) => x.id === id) || HILOS[2];

export default function DiaM({ d, uid, propietario, puedeEditar, hoy, abrirItem, perfil }) {
  const { theme } = useTheme();
  const hoyIso = isoDia(hoy);
  const prefs = usePreferencias();
  const esMia = propietario === uid;
  const personaVista = d.personas?.find((x) => x.user_id === propietario) || null;
  const horasGuardadas = esMia ? prefs?.agenda?.horas || perfil?.preferencias?.agenda?.horas || null : personaVista?.preferencias?.agenda?.horas || null;
  const horas = { ...horasDe(null), ...(horasGuardadas || {}) };
  const [ritmo, setRitmo] = useState(false);
  const [ritmoOfrecido, setRitmoOfrecido] = useState(false);
  useEffect(() => { if (esMia && puedeEditar && !horasGuardadas && !ritmoOfrecido && uid) { setRitmo(true); setRitmoOfrecido(true); } }, [esMia, puedeEditar, horasGuardadas, ritmoOfrecido, uid]);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const ahora = useMemo(() => new Date(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const momento = momentoDe(ahora, horas);
  const h = useMemo(() => hoyDe(d.items, propietario, hoy, { reuniones: d.reuniones, google: d.google, ahora }), [d.items, d.reuniones, d.google, propietario, hoy, ahora]);
  const s = useMemo(() => siguienteDe(h, ahora, { hoyIso }), [h, ahora, hoyIso]);
  const fuentes = useFuentesDia({ uid: propietario, hoy });
  const props = useMemo(() => propuestasDe(fuentes.data, { items: d.items, reuniones: d.reuniones, hoyIso, horas }), [fuentes.data, d.items, d.reuniones, hoyIso, horas]);
  const areasPorId = useMemo(() => new Map((d.areas || []).map((a) => [a.id, a])), [d.areas]);
  const registroHoy = (d.registros || []).find((r) => r.fecha === hoyIso && r.usuario === propietario);
  const decididasHoy = (fuentes.data?.decisiones || []).filter((x) => x.fecha === hoyIso).length;
  const [fase, setFase] = useState(null);
  const f = fase || (registroHoy?.cerrado_at || momento === 'cierre' ? 'cierre' : (decididasHoy > 0 || (props.length === 0 && h.deHoy.length > 0)) ? 'guia' : 'armar');
  const toggle = (it, hecha) => completarItem(it, hecha).catch((e) => toast.error(e.message));
  const inv = { background: theme.surfaceInverse || theme.surfaceDark, color: theme.textOnInverse || theme.textOnDark, borderRadius: 16, padding: '14px 16px', margin: '0 16px' };
  const chip = (on) => ({ border: 0, borderRadius: 999, padding: '7px 13px', fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 600, background: on ? theme.text : theme.surface, color: on ? theme.bg : theme.textMuted, cursor: 'pointer' });
  const sub = momento === 'pausa' ? `pausa hasta las ${horas.retomar}` : momento === 'antes' ? `el día se arma a las ${horas.armar}` : momento === 'cierre' ? 'hora de cerrar el día' : `cierras a las ${horas.cierre}`;

  return (
    <div style={{ paddingBottom: 120 }}>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', alignItems: 'center' }}>
        {FASES.map(([id, l]) => <button key={id} type="button" onClick={() => setFase(id)} style={chip(f === id)}>{l}</button>)}
        <button type="button" onClick={() => esMia && puedeEditar && setRitmo(true)} style={{ marginLeft: 'auto', border: 0, background: 'transparent', fontSize: 11.5, color: esMia && puedeEditar ? theme.accent : theme.textMuted, fontFamily: TYPO.fontText, padding: 0, cursor: 'pointer' }}>{sub}</button>
      </div>
      {ritmo && <RitmoM abierto={ritmo} onClose={() => setRitmo(false)} horas={horasGuardadas} personas={d.personas} propietario={propietario} hoy={hoy} />}
      {f === 'armar' && <ArmarM theme={theme} inv={inv} h={h} props={props} cargando={fuentes.isLoading} horas={horas} uid={uid} propietario={propietario} hoyIso={hoyIso} puedeEditar={puedeEditar} onEmpezar={() => setFase('guia')} areasPorId={areasPorId} abrirItem={abrirItem} toggle={toggle} />}
      {f === 'guia' && <GuiaM theme={theme} inv={inv} h={h} s={s} ahora={ahora} areasPorId={areasPorId} puedeEditar={puedeEditar} abrirItem={abrirItem} toggle={toggle} hoyIso={hoyIso} onArmar={() => setFase('armar')} />}
      {f === 'cierre' && <CierreM theme={theme} inv={inv} h={h} propietario={propietario} hoyIso={hoyIso} registro={registroHoy} puedeEditar={puedeEditar} areasPorId={areasPorId} abrirItem={abrirItem} />}
    </div>
  );
}

const Eyebrow = ({ icon: Icon, children }) => <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, opacity: 0.65, fontFamily: TYPO.fontDisplay }}>{Icon && <Icon size={13} />}{children}</div>;
const Hilo = ({ id }) => { const hh = hiloDeId(id); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: hh.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: TYPO.fontDisplay }}><i style={{ width: 7, height: 7, borderRadius: 4, background: hh.color }} />{hh.label}</span>; };
const filaItem = (it, hoyIso, abrirItem, toggle, puedeEditar) => <Fila key={it.id} titulo={it.titulo} sub={[it.hora ? `a las ${it.hora}` : null, it.duracion_min ? `${it.duracion_min} min` : null, it.cuando && it.cuando < hoyIso ? `vencido · ${it.cuando}` : null, it.origen?.porque].filter(Boolean).join(' · ')} chevron={false} alto={54}
  trailing={puedeEditar ? <button type="button" onClick={(e) => { e.stopPropagation(); toggle(it, true); }} aria-label="Hecha" style={{ width: 26, height: 26, borderRadius: 13, border: '1.5px solid currentColor', background: 'transparent', color: 'inherit', opacity: 0.6, cursor: 'pointer' }} /> : undefined} onClick={() => abrirItem(it)} />;

function ArmarM({ theme, inv, h, props, cargando, horas, uid, propietario, hoyIso, puedeEditar, onEmpezar, areasPorId, abrirItem, toggle }) {
  const [ocupado, setOcupado] = useState(null);
  const carga = cargaDia({ itemsHoy: h.deHoy, reunionesMin: h.minReuniones, horas });
  const grupos = HILOS.map((hh) => ({ ...hh, props: props.filter((p) => p.hilo === hh.id) })).filter((g) => g.props.length);
  const decide = async (p, dec) => { setOcupado(p.id); try { await decidir(uid, hoyIso, p, dec, { propietario }); toast.ok(dec === 'aceptada' ? 'Para hoy' : dec === 'manana' ? 'Para mañana' : 'Descartada 14 días'); } catch (e) { toast.error(e.message); } finally { setOcupado(null); } };
  const ya = porHilo([...h.deAyer, ...h.deHoy], areasPorId);
  const b = (on) => ({ border: 0, borderRadius: 999, padding: '6px 11px', fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: on ? theme.accent : `${theme.text}14`, color: on ? '#FFF' : theme.text });
  return (
    <>
      <div style={inv}>
        <Eyebrow icon={Sunrise}>Armar el día</Eyebrow>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.25 }}>{cargando ? 'Leyendo lo que el negocio sabe de ti…' : props.length ? `Te propongo ${props.length} cosa${props.length === 1 ? '' : 's'}; ya tienes ${h.deHoy.length + h.deAyer.length} en la agenda.` : h.deHoy.length + h.deAyer.length ? 'Tu día ya está armado.' : 'Nada pendiente. Captura lo que traigas en la cabeza.'}</div>
        <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 8 }}>Planeado {fmtMin(carga.tareas)} · reuniones {fmtMin(carga.reuniones)} · {carga.exceso > 0 ? `${fmtMin(carga.exceso)} de más` : `${fmtMin(carga.libre)} libres`} · {horas.armar}–{horas.pausa} y {horas.retomar}–{horas.cierre}</div>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(127,127,127,0.3)', marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, (carga.total / Math.max(1, carga.jornada)) * 100)}%`, background: carga.exceso > 0 ? theme.red : theme.accent, borderRadius: 999 }} /></div>
        <div style={{ marginTop: 12 }}><BotonGrande primario onClick={onEmpezar}>Empezar el día</BotonGrande></div>
      </div>
      {grupos.map((g) => (
        <ListaAgrupada key={g.id} titulo={<Hilo id={g.id} />} meta={String(g.props.length)} style={{ marginTop: 16 }}>
          {g.props.map((p) => (
            <div key={p.id} style={{ padding: '10px 16px', borderTop: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{p.titulo}</div>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>{p.sub} · {p.min} min</div>
              <div style={{ fontSize: 11, color: theme.accent, marginTop: 3 }}>Por qué: {p.porque}</div>
              {puedeEditar && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}><button type="button" disabled={ocupado === p.id} onClick={() => decide(p, 'aceptada')} style={b(true)}>Hoy</button><button type="button" disabled={ocupado === p.id} onClick={() => decide(p, 'manana')} style={b(false)}>Mañana</button><button type="button" disabled={ocupado === p.id} onClick={() => decide(p, 'descartada')} style={b(false)}>Descartar</button></div>}
            </div>
          ))}
        </ListaAgrupada>
      ))}
      {ya.map((g) => <ListaAgrupada key={g.id} titulo={<Hilo id={g.id} />} meta="ya en tu agenda" style={{ marginTop: 16 }}>{g.items.map((it) => filaItem(it, hoyIso, abrirItem, toggle, puedeEditar))}</ListaAgrupada>)}
    </>
  );
}

function GuiaM({ theme, inv, h, s, ahora, areasPorId, puedeEditar, abrirItem, toggle, hoyIso, onArmar }) {
  const it = s.cola[0] || null;
  const total = h.deHoy.length + h.deAyer.length + h.hechasHoy.length, hechas = h.hechasHoy.length;
  const corriendo = it?.inicio_real ? Math.max(0, Math.round((ahora - new Date(it.inicio_real)) / 60000)) : null;
  const accion = it?.origen?.accion || null;
  const siguiente = porHilo(s.cola.slice(1), areasPorId);
  const crono = (acc) => cronometro(it, acc).catch((e) => toast.error(e.message));
  const btn = (primario) => ({ flex: 1, border: 0, borderRadius: 12, padding: '11px 0', fontFamily: TYPO.fontText, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: primario ? theme.accent : 'rgba(127,127,127,0.25)', color: primario ? '#FFF' : 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 });
  return (
    <>
      <div style={inv}>
        <Eyebrow icon={Compass}>{it ? `${hechas + 1} de ${total} · ${hiloDeId(hiloDe(it, areasPorId)).label}` : 'Guía'}</Eyebrow>
        {!it ? (<><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, marginTop: 6 }}>{hechas ? `Terminaste lo de hoy: ${hechas}.` : 'Nada en la cola de hoy.'}</div><div style={{ marginTop: 12 }}><BotonGrande onClick={onArmar} icon={Sunrise}>Armar el día</BotonGrande></div></>) : (
          <>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.2 }}>{it.titulo}</div>
            <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 6 }}>{[it.notas, it.hora ? `a las ${it.hora}` : null, it.duracion_min ? `${it.duracion_min} min` : null, it.cuando && it.cuando < hoyIso ? `vencido desde ${it.cuando}` : null].filter(Boolean).join(' · ')}</div>
            {it.origen?.porque && <div style={{ fontSize: 11.5, background: 'rgba(127,127,127,0.18)', borderRadius: 8, padding: '6px 8px', marginTop: 8 }}>Por qué: {it.origen.porque}</div>}
            {s.proximo && <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 8 }}>Siguiente: {s.proximo.titulo} · {fmtHora(new Date(new Date(`${hoyIso}T00:00:00`).getTime() + s.proximo.ini * 60000))}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {accion && <button type="button" style={btn(true)} onClick={() => navegar(accion)}>{accion.tel ? <Phone size={15} /> : <ExternalLink size={15} />}{accion.label}</button>}
              {puedeEditar && <button type="button" style={btn(!accion)} onClick={() => toggle(it, true)}><Check size={15} />Hecha</button>}
            </div>
            {puedeEditar && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" style={btn(false)} onClick={() => crono(it.inicio_real ? 'parar' : 'iniciar')}><Clock size={15} />{it.inicio_real ? `Parar · ${corriendo} min` : 'Empezar'}</button>
              <button type="button" style={btn(false)} onClick={() => moverA(it, isoDia(new Date(new Date(`${hoyIso}T12:00:00`).getTime() + 86400000))).then(() => toast.ok('Para mañana')).catch((e) => toast.error(e.message))}>Después</button>
              <button type="button" style={{ ...btn(false), flex: 0.6 }} onClick={() => abrirItem(it)}>Detalle</button>
            </div>}
          </>
        )}
        <div style={{ height: 5, borderRadius: 999, background: 'rgba(127,127,127,0.3)', marginTop: 12, overflow: 'hidden' }}><div style={{ height: '100%', width: `${total ? (hechas / total) * 100 : 0}%`, background: theme.green, borderRadius: 999 }} /></div>
      </div>
      {siguiente.map((g) => <ListaAgrupada key={g.id} titulo={<Hilo id={g.id} />} meta={String(g.items.length)} style={{ marginTop: 16 }}>{g.items.map((x) => filaItem(x, hoyIso, abrirItem, toggle, puedeEditar))}</ListaAgrupada>)}
      {h.hechasHoy.length > 0 && <ListaAgrupada titulo="Hecho hoy" meta={String(h.hechasHoy.length)} style={{ marginTop: 16, opacity: 0.75 }}>{h.hechasHoy.map((x) => <Fila key={x.id} titulo={x.titulo} sub={x.min_real ? `${x.min_real} min reales` : undefined} chevron={false} alto={46} onClick={() => abrirItem(x)} />)}</ListaAgrupada>}
    </>
  );
}

function CierreM({ theme, inv, h, propietario, hoyIso, registro, puedeEditar, areasPorId, abrirItem }) {
  const [resumen, setResumen] = useState(registro?.resumen || '');
  const [manana, setManana] = useState(registro?.manana_empiezo || '');
  const [energia, setEnergia] = useState(registro?.energia || null);
  const [ocupado, setOcupado] = useState(false);
  const abiertos = [...h.deAyer, ...h.deHoy];
  const plan = h.minTareas + h.hechasHoy.reduce((s, it) => s + (Number(it.duracion_min) || 0), 0);
  const grupos = porHilo(abiertos, areasPorId);
  const campo = { width: '100%', marginTop: 8, borderRadius: 10, border: 0, padding: '9px 10px', fontFamily: 'inherit', fontSize: 13, background: 'rgba(127,127,127,0.18)', color: 'inherit' };
  const cerrar = async () => { setOcupado(true); try { await cerrarDia(propietario, hoyIso, { resumen, manana_empiezo: manana, energia, min_planeados: plan, min_reales: h.minReales }, abiertos); toast.ok(abiertos.length ? `Día cerrado · ${abiertos.length} se van a mañana` : 'Día cerrado'); } catch (e) { toast.error(e.message); } finally { setOcupado(false); } };
  return (
    <>
      <div style={inv}>
        <Eyebrow icon={Moon}>Cierre del día{registro?.cerrado_at ? ' · cerrado' : ''}</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
          {[[`${h.hechasHoy.length} de ${h.hechasHoy.length + abiertos.length}`, 'hechas'], [fmtMin(h.minReales), `real · plan ${fmtMin(plan)}`], [String(abiertos.length), 'a mañana']].map(([v, l]) => <div key={l} style={{ background: 'rgba(127,127,127,0.18)', borderRadius: 10, padding: '8px 10px' }}><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 10.5, opacity: 0.7 }}>{l}</div></div>)}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>{[[1, '😮‍💨'], [2, '😐'], [3, '🙂'], [4, '😄']].map(([n, e]) => <button key={n} type="button" disabled={!puedeEditar} onClick={() => setEnergia(n)} style={{ flex: 1, border: 0, borderRadius: 10, padding: '8px 0', fontSize: 20, background: energia === n ? 'rgba(10,132,255,0.25)' : 'rgba(127,127,127,0.18)' }}>{e}</button>)}</div>
        <textarea value={resumen} onChange={(e) => setResumen(e.target.value)} disabled={!puedeEditar} placeholder="Qué quedó hoy…" rows={2} style={{ ...campo, resize: 'vertical' }} />
        <input value={manana} onChange={(e) => setManana(e.target.value)} disabled={!puedeEditar} placeholder="Mañana empiezo por…" style={campo} />
        {puedeEditar && <div style={{ marginTop: 12 }}><BotonGrande primario disabled={ocupado} onClick={cerrar} icon={Moon}>{registro?.cerrado_at ? 'Volver a cerrar' : 'Cerrar el día'}</BotonGrande></div>}
      </div>
      {grupos.map((g) => <ListaAgrupada key={g.id} titulo={<Hilo id={g.id} />} meta="se arrastra a mañana" style={{ marginTop: 16 }}>{g.items.map((x) => <Fila key={x.id} titulo={x.titulo} sub={x.cuando && x.cuando < hoyIso ? `vencido · ${x.cuando}` : 'de hoy'} chevron={false} alto={46} onClick={() => abrirItem(x)} />)}</ListaAgrupada>)}
    </>
  );
}
