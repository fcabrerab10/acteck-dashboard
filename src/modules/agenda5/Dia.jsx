// Agenda «que te lleva» · módulo Día (web, 3.78.0 · 2026-10-05, propuesta A aprobada por Fernando). Tres fases:
//   Armar (9:00): la Agenda propone el día desde las fuentes del negocio (dia/proponer.js) y lo que ya estaba en la
//   agenda; se acepta, se manda a mañana o se descarta; carga contra la jornada (9–15 y 17–22).
//   Guía: una cosa a la vez en el orden de siguienteDe (vencidos → con hora → por prioridad) con cronómetro, el porqué,
//   la acción (abrir Pagos, llamar, ver minuta…), Hecha / Después, y lo que sigue agrupado por hilo.
//   Cierre (22:00): planeado vs real, lo abierto se arrastra a mañana, energía y una línea para mañana.
// Derecha: reloj del día y mes en pequeño (de Hoy.jsx). Celular: movil/pestanas/agenda5/DiaM.jsx con el mismo motor.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, ArrowRight, Sunrise, Compass, Moon, Phone, ExternalLink } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Boton, Pill, Segmented, toast } from '../../components/kit';
import { FilaTarea } from './comun';
import { Reloj, MiniMes } from './Hoy';
import { hoyDe, siguienteDe, conteosMes, isoDia, fmtHora } from './calculo';
import { completarItem, cronometro, moverA, actualizarItem } from './datos';
import { useFuentesDia, propuestasDe, decidir, cerrarDia, horasDe, navegar } from './dia/datos';
import { HILOS, hiloDe, porHilo, cargaDia, fmtMin, momentoDe } from './dia/proponer';
import { usePerfil } from '../../lib/perfilContext';

const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const FASES = [{ id: 'armar', label: 'Armar el día' }, { id: 'guia', label: 'Guía' }, { id: 'cierre', label: 'Cierre' }];

export default function Dia({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, onCapturar, onAbrirReunion }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDia(hoy);
  const horas = horasDe(perfil);
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
  const faseAuto = registroHoy?.cerrado_at ? 'cierre' : momento === 'cierre' ? 'cierre' : (decididasHoy > 0 || (props.length === 0 && h.deHoy.length > 0)) ? 'guia' : 'armar';
  const f = fase || faseAuto;
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const conteos = useMemo(() => conteosMes(d.items, propietario, { reuniones: d.reuniones, google: d.google }), [d.items, d.reuniones, d.google, propietario]);
  const toggle = (it, hecha) => completarItem(it, hecha).catch((e) => toast.error(e.message));
  const crono = (it, acc) => cronometro(it, acc).catch((e) => toast.error(e.message));
  const fecha = `${DIAS_LARGO[hoy.getDay()]} ${hoy.getDate()} de ${MESES_L[hoy.getMonth()]}`;
  const saludo = ahora.getHours() < 12 ? 'Buenos días' : ahora.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  const [ancho, setAncho] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1400));
  useEffect(() => { const f = () => setAncho(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const conLado = ancho >= 1100;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: conLado ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text }}>{saludo}{perfil?.nombre ? `, ${String(perfil.nombre).split(' ')[0]}` : ''}</div>
            <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>{fecha.replace(/^./, (c) => c.toUpperCase())} · {momento === 'pausa' ? `pausa hasta las ${horas.retomar}` : momento === 'antes' ? `el día se arma a las ${horas.armar}` : momento === 'cierre' ? 'hora de cerrar el día' : `cierras a las ${horas.cierre}`}</div>
          </div>
          <Segmented options={FASES} value={f} onChange={setFase} />
        </div>
        {f === 'armar' && <Armar theme={theme} h={h} props={props} cargando={fuentes.isLoading} horas={horas} uid={uid} propietario={propietario} hoyIso={hoyIso} puedeEditar={puedeEditar} onEmpezar={() => setFase('guia')} onCapturar={onCapturar} areasPorId={areasPorId} personasPorId={personasPorId} onAbrirItem={onAbrirItem} toggle={toggle} />}
        {f === 'guia' && <Guia theme={theme} h={h} s={s} ahora={ahora} areasPorId={areasPorId} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onAbrirItem={onAbrirItem} onAbrirReunion={onAbrirReunion} toggle={toggle} crono={crono} hoyIso={hoyIso} onArmar={() => setFase('armar')} />}
        {f === 'cierre' && <Cierre theme={theme} h={h} uid={uid} propietario={propietario} hoyIso={hoyIso} registro={registroHoy} puedeEditar={puedeEditar} areasPorId={areasPorId} />}
      </div>
      {conLado && <div style={{ position: 'sticky', top: 8 }}>
        <Panel titulo="Reloj del día" padding="8px 10px">
          <Reloj h={h} hoyIso={hoyIso} esHoy puedeEditar={puedeEditar} onAbrir={(b) => (b.tipo === 'tarea' ? onAbrirItem(b.ref) : b.tipo === 'reunion' ? onAbrirReunion(b.ref) : null)}
            onSoltar={(id, hora) => actualizarItem(id, { hora, cuando: hoyIso, bandeja: false }).then(() => toast.ok(`Bloque a las ${hora}`)).catch((e) => toast.error(e.message))} />
        </Panel>
        <div style={{ marginTop: 10 }}><Panel titulo="Mes" padding="8px 10px"><MiniMes mes={mes} setMes={setMes} dia={hoyIso} onDia={() => {}} conteos={conteos} hoyIso={hoyIso} /></Panel></div>
      </div>}
    </div>
  );
}

function PillHilo({ hilo }) { const hh = HILOS.find((x) => x.id === hilo) || HILOS[2]; return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: hh.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: TYPO.fontDisplay }}><i style={{ width: 7, height: 7, borderRadius: 4, background: hh.color }} />{hh.label}</span>; }

function Tarjeta({ theme, children, inversa = false, style }) {
  return <div style={{ background: inversa ? theme.surfaceInverse : theme.surface, color: inversa ? theme.textOnInverse : theme.text, border: inversa ? 0 : `1px solid ${theme.border}`, borderRadius: 14, padding: '14px 16px', ...style }}>{children}</div>;
}

function Armar({ theme, h, props, cargando, horas, uid, propietario, hoyIso, puedeEditar, onEmpezar, onCapturar, areasPorId, personasPorId, onAbrirItem, toggle }) {
  const [ocupado, setOcupado] = useState(null);
  const carga = cargaDia({ itemsHoy: h.deHoy, propuestasAceptadas: [], reunionesMin: h.minReuniones, horas });
  const grupos = useMemo(() => HILOS.map((hh) => ({ ...hh, props: props.filter((p) => p.hilo === hh.id) })).filter((g) => g.props.length), [props]);
  const decide = async (p, dec) => { if (!puedeEditar) return; setOcupado(p.id); try { await decidir(uid, hoyIso, p, dec, { propietario }); toast.ok(dec === 'aceptada' ? 'Para hoy' : dec === 'manana' ? 'Para mañana' : 'Descartada 14 días'); } catch (e) { toast.error(e.message); } finally { setOcupado(null); } };
  const aceptarTodas = async () => { for (const p of props) await decide(p, 'aceptada'); };
  const yaHoy = porHilo([...h.deAyer, ...h.deHoy], areasPorId);
  return (
    <>
      <Tarjeta theme={theme} inversa style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, opacity: 0.65 }}><Sunrise size={14} /> Armar el día</div>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.25 }}>
          {cargando ? 'Leyendo lo que el negocio sabe de ti…' : props.length ? `Te propongo ${props.length} cosa${props.length === 1 ? '' : 's'} y ya tienes ${h.deHoy.length + h.deAyer.length} en la agenda.` : h.deHoy.length + h.deAyer.length ? 'Nada nuevo que proponer: tu día ya está armado.' : 'Nada pendiente en el negocio ni en la agenda. Captura lo que traigas en la cabeza.'}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, opacity: 0.8, flexWrap: 'wrap' }}>
          <span>Planeado <b>{fmtMin(carga.tareas)}</b></span><span>Reuniones <b>{fmtMin(carga.reuniones)}</b></span><span>Jornada <b>{fmtMin(carga.jornada)}</b> ({horas.armar}–{horas.pausa} · {horas.retomar}–{horas.cierre})</span>
          <span style={{ marginLeft: 'auto' }}>{carga.exceso > 0 ? `${fmtMin(carga.exceso)} de más: manda algo a mañana` : `te quedan ${fmtMin(carga.libre)} libres`}</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(127,127,127,0.3)', marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, (carga.total / Math.max(1, carga.jornada)) * 100)}%`, background: carga.exceso > 0 ? theme.red : theme.accent, borderRadius: 999 }} /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Boton primario icon={ArrowRight} onClick={onEmpezar}>Empezar el día</Boton>
          {props.length > 0 && puedeEditar && <Boton onClick={aceptarTodas}>Aceptar todas</Boton>}
          {puedeEditar && <Boton onClick={onCapturar}>Añadir algo (N)</Boton>}
        </div>
      </Tarjeta>
      {grupos.map((g) => (
        <div key={g.id} style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px' }}><PillHilo hilo={g.id} /><span style={{ fontSize: 11.5, color: theme.textMuted }}>{g.desc}</span></div>
          <Tarjeta theme={theme} style={{ padding: '2px 14px' }}>
            {g.props.map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: `1px solid ${theme.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text }}>{p.titulo} <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>· {p.min} min</span></div>
                  <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>{p.sub}</div>
                  <div style={{ fontSize: 11, color: theme.accent, marginTop: 3 }}>Por qué: {p.porque}</div>
                </div>
                {puedeEditar && <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Boton primario size="sm" disabled={ocupado === p.id} onClick={() => decide(p, 'aceptada')}>Hoy</Boton>
                  <Boton size="sm" disabled={ocupado === p.id} onClick={() => decide(p, 'manana')}>Mañana</Boton>
                  <Boton size="sm" disabled={ocupado === p.id} onClick={() => decide(p, 'descartada')} title="No volver a proponerla en 14 días">✕</Boton>
                </div>}
              </div>
            ))}
          </Tarjeta>
        </div>
      ))}
      {yaHoy.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, padding: '0 4px 6px', color: theme.text }}>Ya en tu agenda para hoy <span style={{ color: theme.textMuted, fontWeight: 500 }}>· {h.deAyer.length ? `${h.deAyer.length} vencido${h.deAyer.length === 1 ? '' : 's'} · ` : ''}{h.deHoy.length} de hoy</span></div>
          {yaHoy.map((g) => (
            <Tarjeta key={g.id} theme={theme} style={{ padding: '6px 12px', marginBottom: 8 }}>
              <div style={{ padding: '4px 0 2px' }}><PillHilo hilo={g.id} /></div>
              {g.items.map((it) => <FilaTarea key={it.id} item={it} personasPorId={personasPorId} uid={uid} onToggle={puedeEditar ? toggle : undefined} onAbrir={onAbrirItem} mostrarFecha={it.cuando !== hoyIso} compacta />)}
            </Tarjeta>
          ))}
        </div>
      )}
    </>
  );
}

function Guia({ theme, h, s, ahora, areasPorId, personasPorId, uid, puedeEditar, onAbrirItem, onAbrirReunion, toggle, crono, hoyIso, onArmar }) {
  const it = s.cola[0] || null;
  const total = h.deHoy.length + h.deAyer.length + h.hechasHoy.length;
  const hechas = h.hechasHoy.length;
  const corriendo = it?.inicio_real ? Math.max(0, Math.round((ahora - new Date(it.inicio_real)) / 60000)) : null;
  const siguiente = porHilo(s.cola.slice(1), areasPorId);
  const accion = it?.origen?.accion || null;
  return (
    <>
      <Tarjeta theme={theme} inversa style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, opacity: 0.65 }}><Compass size={14} /> {it ? `${hechas + 1} de ${total} · ${(HILOS.find((x) => x.id === hiloDe(it, areasPorId)) || HILOS[2]).label}` : 'Guía'}</span>
          {s.proximo && <span style={{ fontSize: 12, opacity: 0.75 }}>{s.proximo.tipo === 'tarea' ? 'siguiente bloque' : 'siguiente evento'} · {s.proximo.titulo} a las {fmtHora(new Date(new Date(`${hoyIso}T00:00:00`).getTime() + s.proximo.ini * 60000))}</span>}
        </div>
        {!it ? (
          <>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 8 }}>{hechas ? `Terminaste lo de hoy: ${hechas} hecha${hechas === 1 ? '' : 's'}.` : 'No hay nada en la cola de hoy.'}</div>
            <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 6 }}>{hechas ? 'A la hora de cierre te pido cerrar el día.' : 'Arma el día o captura lo que traigas en la cabeza.'}</div>
            <div style={{ marginTop: 12 }}><Boton onClick={onArmar} icon={Sunrise}>Armar el día</Boton></div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 8, lineHeight: 1.2 }}>{it.titulo}</div>
            <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 6 }}>{[it.notas, it.hora ? `a las ${it.hora}` : null, it.duracion_min ? `estimado ${it.duracion_min} min` : null, it.cuando && it.cuando < hoyIso ? `vencido desde ${it.cuando}` : null].filter(Boolean).join(' · ')}</div>
            {it.origen?.porque && <div style={{ fontSize: 11.5, background: 'rgba(127,127,127,0.18)', borderRadius: 8, padding: '6px 8px', marginTop: 8, opacity: 0.95 }}>Por qué: {it.origen.porque}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {accion && <Boton primario icon={accion.tel ? Phone : ExternalLink} onClick={() => navegar(accion)}>{accion.label}</Boton>}
              {puedeEditar && <Boton icon={Check} onClick={() => toggle(it, true)}>Hecha</Boton>}
              {puedeEditar && <Boton icon={Clock} onClick={() => crono(it, it.inicio_real ? 'parar' : 'iniciar')}>{it.inicio_real ? `Parar · ${corriendo} min` : 'Empezar'}</Boton>}
              {puedeEditar && <Boton onClick={() => moverA(it, isoDia(new Date(new Date(`${hoyIso}T12:00:00`).getTime() + 86400000))).then(() => toast.ok('Para mañana')).catch((e) => toast.error(e.message))}>Después</Boton>}
              <Boton onClick={() => onAbrirItem(it)}>Detalle</Boton>
            </div>
          </>
        )}
        <div style={{ height: 5, borderRadius: 999, background: 'rgba(127,127,127,0.3)', marginTop: 12, overflow: 'hidden' }}><div style={{ height: '100%', width: `${total ? (hechas / total) * 100 : 0}%`, background: theme.green, borderRadius: 999 }} /></div>
      </Tarjeta>
      {siguiente.map((g) => (
        <div key={g.id} style={{ marginTop: 12 }}>
          <div style={{ padding: '0 4px 6px' }}><PillHilo hilo={g.id} /> <span style={{ fontSize: 11.5, color: theme.textMuted }}>· {g.items.length}</span></div>
          <Tarjeta theme={theme} style={{ padding: '6px 12px' }}>
            {g.items.map((x) => <FilaTarea key={x.id} item={x} personasPorId={personasPorId} uid={uid} onToggle={puedeEditar ? toggle : undefined} onAbrir={onAbrirItem} onCrono={puedeEditar ? crono : undefined} mostrarFecha={x.cuando !== hoyIso} compacta />)}
          </Tarjeta>
        </div>
      ))}
      {h.hechasHoy.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, padding: '0 4px 6px', color: theme.textMuted }}>Hecho hoy · {h.hechasHoy.length}</div>
          <Tarjeta theme={theme} style={{ padding: '6px 12px', opacity: 0.75 }}>{h.hechasHoy.map((x) => <FilaTarea key={x.id} item={x} personasPorId={personasPorId} uid={uid} onToggle={puedeEditar ? toggle : undefined} onAbrir={onAbrirItem} compacta />)}</Tarjeta>
        </div>
      )}
    </>
  );
}

function Cierre({ theme, h, uid, propietario, hoyIso, registro, puedeEditar, areasPorId }) {
  const [resumen, setResumen] = useState(registro?.resumen || '');
  const [manana, setManana] = useState(registro?.manana_empiezo || '');
  const [energia, setEnergia] = useState(registro?.energia || null);
  const [ocupado, setOcupado] = useState(false);
  const abiertos = [...h.deAyer, ...h.deHoy];
  const plan = h.minTareas + abiertos.reduce((s, it) => s + 0, 0) + h.hechasHoy.reduce((s, it) => s + (Number(it.duracion_min) || 0), 0);
  const real = h.minReales;
  const grupos = porHilo(abiertos, areasPorId);
  const cerrar = async () => { setOcupado(true); try { await cerrarDia(propietario, hoyIso, { resumen, manana_empiezo: manana, energia, min_planeados: plan, min_reales: real }, abiertos); toast.ok(abiertos.length ? `Día cerrado · ${abiertos.length} se van a mañana` : 'Día cerrado'); } catch (e) { toast.error(e.message); } finally { setOcupado(false); } };
  const cerrado = !!registro?.cerrado_at;
  return (
    <>
      <Tarjeta theme={theme} inversa style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, opacity: 0.65 }}><Moon size={14} /> Cierre del día{cerrado ? ' · cerrado' : ''}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
          {[[`${h.hechasHoy.length} de ${h.hechasHoy.length + abiertos.length}`, 'hechas'], [fmtMin(real), `real · plan ${fmtMin(plan)}`], [String(abiertos.length), 'se van a mañana']].map(([v, l]) => <div key={l} style={{ background: 'rgba(127,127,127,0.18)', borderRadius: 10, padding: '8px 10px' }}><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{v}</div><div style={{ fontSize: 10.5, opacity: 0.7 }}>{l}</div></div>)}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>¿Cómo estuvo el día?</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{[[1, '😮‍💨'], [2, '😐'], [3, '🙂'], [4, '😄']].map(([n, e]) => <button key={n} type="button" disabled={!puedeEditar} onClick={() => setEnergia(n)} style={{ flex: 1, border: 0, borderRadius: 10, padding: '8px 0', fontSize: 20, cursor: 'pointer', background: energia === n ? 'rgba(10,132,255,0.25)' : 'rgba(127,127,127,0.18)' }}>{e}</button>)}</div>
        <textarea value={resumen} onChange={(e) => setResumen(e.target.value)} disabled={!puedeEditar} placeholder="Qué quedó hoy (se guarda en el registro del día)…" rows={2} style={{ width: '100%', marginTop: 10, borderRadius: 10, border: 0, padding: '8px 10px', fontFamily: 'inherit', fontSize: 12.5, background: 'rgba(127,127,127,0.18)', color: 'inherit', resize: 'vertical' }} />
        <input value={manana} onChange={(e) => setManana(e.target.value)} disabled={!puedeEditar} placeholder="Mañana empiezo por…" style={{ width: '100%', marginTop: 8, borderRadius: 10, border: 0, padding: '8px 10px', fontFamily: 'inherit', fontSize: 12.5, background: 'rgba(127,127,127,0.18)', color: 'inherit' }} />
        {puedeEditar && <div style={{ marginTop: 12 }}><Boton primario icon={Moon} disabled={ocupado} onClick={cerrar}>{cerrado ? 'Volver a cerrar' : 'Cerrar el día'}</Boton></div>}
      </Tarjeta>
      {grupos.map((g) => (
        <div key={g.id} style={{ marginTop: 12 }}>
          <div style={{ padding: '0 4px 6px' }}><PillHilo hilo={g.id} /> <span style={{ fontSize: 11.5, color: theme.textMuted }}>· se arrastra a mañana</span></div>
          <Tarjeta theme={theme} style={{ padding: '6px 12px' }}>{g.items.map((x) => <FilaTarea key={x.id} item={x} personasPorId={new Map()} uid={uid} compacta mostrarFecha />)}</Tarjeta>
        </div>
      ))}
    </>
  );
}
