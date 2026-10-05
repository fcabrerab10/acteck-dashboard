// Agenda V5 · celular (2026-10-04). Pestaña raíz con Segmented Hoy · Bandeja · Pendientes · Reuniones · Más.
// Mismo motor que la web (modules/agenda5: calculo · datos · interpretar). Reuniones y la hoja de edición de un ítem se
// reutilizan de la V4 móvil (src/movil/pestanas/agenda) a través del mismo AgendaCtx. Gestos: → hecha · ← mañana / 7 días.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarCheck, Check, CalendarClock, Sparkles, Play, Pause } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { Cargando, Pill } from '../../../components/kit';
import { useAgenda5, completarItem, crearDesdeCaptura, moverA, posponer, triage, descartar, cronometro, guardarRegistroDia, guardarCheckin } from '../../../modules/agenda5/datos';
import { hoyDe, bandejaDe, pendientesDe, conteosMes, isoDia, sumarDias, fmtMin, fmtHora, fraseHoy, esDe, abierto } from '../../../modules/agenda5/calculo';
import { interpretarCaptura } from '../../../modules/agenda5/interpretar';
import { MiniMes, Reloj } from '../../../modules/agenda5/Hoy';
import { useGoogleEstado } from '../../../modules/agenda/google';
import { fechaLarga } from '../../../modules/agenda/textos';
import { nombreClienteAgenda } from '../../../modules/agenda/etiquetas';
import { useNav } from '../../nav';
import { TituloGrande, Segmented, Vacio, ListaAgrupada, Fila, FilaDeslizable, HojaM, BotonGrande, toast } from '../../piezas';
import { AgendaCtx } from '../agenda/Agenda';
import { FAB, PalomitaM } from '../agenda/comun';
import CapturaHoja from '../agenda/Captura';
import Reuniones from '../agenda/Reuniones';
import Minuta from '../agenda/Minuta';

const VISTAS = [{ id: 'hoy', label: 'Hoy' }, { id: 'bandeja', label: 'Bandeja' }, { id: 'pendientes', label: 'Pendientes' }, { id: 'reuniones', label: 'Reuniones' }, { id: 'mas', label: 'Más' }];
const TONO = { fecha: ['rgba(10,132,255,0.14)', '#0A84FF'], hora: ['rgba(10,132,255,0.14)', '#0A84FF'], duracion: ['rgba(10,132,255,0.14)', '#0A84FF'], cliente: ['rgba(255,159,10,0.16)', '#C77700'], persona: ['rgba(191,90,242,0.16)', '#9D4EDD'], prioridad: ['rgba(255,69,58,0.14)', '#FF453A'], tipo: ['rgba(48,209,88,0.16)', '#1E9E46'], categoria: ['rgba(120,120,128,0.16)', '#6E6E73'] };

export default function AgendaM({ inicial, raiz = false }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav.perfil;
  const uid = perfil?.user_id || null;
  const puedeVer = puedeVerPaginaGlobal(perfil, 'agenda');
  const d = useAgenda5({ enabled: !!perfil && puedeVer });
  const google = useGoogleEstado();
  const [vista, setVista] = useState(inicial?.vista || 'hoy');
  const [propietario, setPropietario] = useState(null);
  const [cap, setCap] = useState(null);       // hoja V4 (editar ítem)
  const [rapida, setRapida] = useState(false); // captura rápida V5
  const hoy = useMemo(() => new Date(), []);
  useEffect(() => { if (uid && !propietario) setPropietario(uid); }, [uid, propietario]);
  const visibles = useMemo(() => d.personas.filter((p) => p.user_id === uid || perfil?.es_super_admin || p.es_super_admin), [d.personas, uid, perfil]);
  const esMia = propietario === uid;
  const puedeEditar = (esMia || !!perfil?.es_super_admin) && puedeEditarPestanaGlobal(perfil, 'agenda');

  const abrirMinuta = (r) => { const id = typeof r === 'string' ? r : r?.id; if (!id) return; nav.push(<Minuta reunionId={id} />, `minuta-${id}`); };
  const abrirItem = (item) => setCap({ item });
  const toggle = async (item, hecha) => { try { await completarItem(item, hecha); if (hecha) toast.ok('Hecha', { accion: 'Deshacer', onAccion: () => completarItem(item, false).catch((e) => toast.error(e.message)) }); } catch (e) { toast.error(e.message); } };
  const posponerM = async (item, dias = 1) => { try { await moverA(item, isoDia(sumarDias(hoy, dias))); toast.ok(dias === 1 ? 'Para mañana' : `Pospuesto ${dias} días`); } catch (e) { toast.error(e.message); } };
  const ctx = useMemo(() => ({ ...d, uid, perfil, puedeEditar, google, abrirItem, abrirMinuta, capturar: () => setRapida(true), toggle, posponer: posponerM, navegarAviso: () => {}, setVista }), [d, uid, perfil, puedeEditar, google]); // eslint-disable-line react-hooks/exhaustive-deps

  const cabecera = (
    <>
      <TituloGrande titulo="Agenda" sub={fechaLarga(hoy).replace(/^./, (c) => c.toUpperCase())} derecha={visibles.length > 1 ? (
        <div style={{ display: 'flex', gap: 4 }}>{visibles.map((p) => <button key={p.user_id} type="button" onClick={() => setPropietario(p.user_id)} style={{ width: 30, height: 30, borderRadius: 15, border: `2px solid ${p.user_id === propietario ? theme.accent : 'transparent'}`, background: 'linear-gradient(135deg,#0A84FF,#5E5CE6)', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: TYPO.fontDisplay }}>{String(p.nombre || '?').split(' ').map((x) => x[0]).slice(0, 2).join('')}</button>)}</div>) : null} />
      <div style={{ padding: '0 16px 10px' }}><Segmented size="md" value={vista} onChange={setVista} options={VISTAS} style={{ display: 'flex', width: '100%' }} /></div>
    </>
  );
  if (!perfil || !puedeVer) return (<>{cabecera}<Vacio icon={CalendarCheck} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la Agenda." /></>);
  if (d.error) return (<>{cabecera}<Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar la Agenda" sub={String(d.error.message || d.error)} /></>);
  if (d.cargando || !propietario) return (<>{cabecera}<div style={{ padding: '0 16px' }}><Cargando pantalla="movilAgenda" /></div></>);
  const com = { d, uid, propietario, puedeEditar, esMia, hoy, abrirItem, toggle, posponerM, personasPorId: d.personasPorId, nav };
  return (
    <AgendaCtx.Provider value={ctx}>
      {cabecera}
      {vista === 'hoy' && <HoyM {...com} />}
      {vista === 'bandeja' && <BandejaM {...com} />}
      {vista === 'pendientes' && <PendientesM {...com} />}
      {vista === 'reuniones' && <Reuniones />}
      {vista === 'mas' && <MasM {...com} />}
      {puedeEditar && vista !== 'reuniones' && <FAB onClick={() => setRapida(true)} label="Captura rápida" />}
      <CapturaRapidaM abierto={rapida} onClose={() => setRapida(false)} personas={d.personas} propietario={propietario} hoy={hoy} />
      <CapturaHoja cfg={cap} personas={d.personas} reuniones={d.reuniones} hoy={hoy} subtareas={d.subtareas} puedeEditar={puedeEditar} onClose={() => setCap(null)} onAbrirMinuta={abrirMinuta} />
    </AgendaCtx.Provider>
  );
}

function CapturaRapidaM({ abierto, onClose, personas, propietario, hoy }) {
  const { theme } = useTheme();
  const [texto, setTexto] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (abierto) { setTexto(''); setTimeout(() => ref.current?.focus(), 120); } }, [abierto]);
  const i = texto.trim() ? interpretarCaptura(texto, personas, hoy) : null;
  const crear = async () => { if (!texto.trim()) return; try { const r = await crearDesdeCaptura(texto, { personas, propietario, hoy }); toast.ok(r.interpretado.bandeja ? 'Guardado en la Bandeja' : 'Guardado'); onClose(); } catch (e) { toast.error(e.message); } };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Captura rápida" sub="fecha, hora, duración, #cliente, @persona, p1 · «idea:» · «nota:»" alto="46vh">
      <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px' }}>
          <Sparkles size={16} style={{ color: theme.accent }} /><input ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Llamar a Juan mañana 10am 30m #Dicotech" onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 16, color: theme.text, fontFamily: TYPO.fontText }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 26 }}>
          {i?.chips.map((c, k) => { const [bg, col] = TONO[c.tipo] || TONO.categoria; return <span key={k} style={{ background: bg, color: col, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{c.label}</span>; })}
          {i && !i.chips.length && <span style={{ fontSize: 12, color: theme.textMuted }}>Sin fecha → Bandeja</span>}
        </div>
        <BotonGrande primario icon={Check} onClick={crear}>Guardar</BotonGrande>
      </div>
    </HojaM>
  );
}

function FilaItemM({ it, personasPorId, uid, puedeEditar, onToggle, onAbrir, onManana, onSemana, onCrono, mostrarFecha }) {
  const { theme } = useTheme();
  const hecha = it.estado === 'hecha';
  const acciones = puedeEditar && !hecha ? [{ label: 'Mañana', icon: CalendarClock, color: theme.orange, onClick: () => onManana(it) }, { label: '7 días', icon: CalendarClock, color: theme.textMuted, onClick: () => onSemana(it) }] : [];
  const corriendo = !!it.inicio_real;
  const fila = (
    <Fila titulo={it.titulo} alto={52} chevron={false} onClick={() => onAbrir(it)}
      avatar={<PalomitaM hecha={hecha} onClick={() => onToggle(it, !hecha)} disabled={!puedeEditar} />}
      sub={[it.hora, it.cliente_key && it.cliente_key !== 'interno' ? nombreClienteAgenda(it.cliente_key) : null, it.duracion_min ? fmtMin(it.duracion_min) : null, mostrarFecha && (it.cuando || it.fecha_limite) ? String(it.cuando || it.fecha_limite).slice(5) : null].filter(Boolean).join(' · ')}
      trailing={onCrono && !hecha ? <button type="button" onClick={(e) => { e.stopPropagation(); onCrono(it, corriendo ? 'parar' : 'iniciar'); }} style={{ border: 0, background: corriendo ? `${theme.accent}18` : 'transparent', color: corriendo ? theme.accent : theme.textMuted, borderRadius: 999, padding: 6, display: 'grid' }}>{corriendo ? <Pause size={16} /> : <Play size={16} />}</button> : (it.prioridad === 'alta' ? <Pill tone="red" size="xs">!</Pill> : null)} />
  );
  return acciones.length ? <FilaDeslizable acciones={acciones}>{fila}</FilaDeslizable> : fila;
}

function HoyM({ d, uid, propietario, puedeEditar, hoy, abrirItem, toggle, posponerM, personasPorId }) {
  const { theme } = useTheme();
  const hoyIso = isoDia(hoy);
  const [dia, setDia] = useState(hoyIso);
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [verMes, setVerMes] = useState(false);
  const fecha = useMemo(() => new Date(`${dia}T12:00:00`), [dia]);
  const esHoy = dia === hoyIso;
  const h = useMemo(() => hoyDe(d.items, propietario, fecha, { reuniones: d.reuniones, google: d.google, ahora: esHoy ? new Date() : fecha }), [d.items, d.reuniones, d.google, propietario, fecha, esHoy]);
  const conteos = useMemo(() => conteosMes(d.items, propietario, { reuniones: d.reuniones, google: d.google }), [d.items, d.reuniones, d.google, propietario]);
  const crono = (it, acc) => cronometro(it, acc).catch((e) => toast.error(e.message));
  return (
    <>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 16, padding: '10px 12px', border: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700, color: theme.text }}>{esHoy ? 'Hoy' : dia.slice(5)}</div><button type="button" onClick={() => setVerMes((v) => !v)} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500 }}>{verMes ? 'Ocultar mes' : 'Ver mes'}</button></div>
        <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>{esHoy ? fraseHoy(h) : `${h.deHoy.length} pendientes · ${h.reunionesHoy.length + h.googleHoy.length} reuniones`}</div>
        {verMes && <div style={{ marginTop: 10 }}><MiniMes mes={mes} setMes={setMes} dia={dia} onDia={(iso) => { setDia(iso); }} conteos={conteos} hoyIso={hoyIso} /></div>}
      </div>
      <div style={{ margin: '10px 16px 0', background: theme.surface, borderRadius: 16, padding: 8, border: `1px solid ${theme.border}` }}>
        <Reloj h={h} hoyIso={dia} esHoy={esHoy} alto={300} h0={7} h1={20} onAbrir={(b) => { if (b.tipo === 'tarea' || b.tipo === 'hecha') abrirItem(b.ref); else if (b.ref?.url) window.open(b.ref.url, '_blank', 'noopener'); }} />
      </div>
      {h.deAyer.length > 0 && esHoy && <ListaAgrupada titulo="De días anteriores" meta={`${h.deAyer.length}`} style={{ marginTop: 14 }}>{h.deAyer.map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} onManana={(x) => moverA(x, hoyIso)} onSemana={(x) => posponer(x, 7)} mostrarFecha />)}</ListaAgrupada>}
      <ListaAgrupada titulo="Pendientes del día" meta={h.minTareas ? fmtMin(h.minTareas) : undefined} style={{ marginTop: 14 }} pie="Desliza a la izquierda para mover a mañana o 7 días.">
        {h.deHoy.length === 0 && <Vacio icon={null} titulo="Nada planeado" sub="Toca + para capturar." style={{ padding: '18px 16px' }} />}
        {h.deHoy.map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} onManana={(x) => posponerM(x, 1)} onSemana={(x) => posponer(x, 7)} onCrono={puedeEditar ? crono : null} />)}
      </ListaAgrupada>
      {h.hechasHoy.length > 0 && <ListaAgrupada titulo="Hechas" meta={h.minReales ? fmtMin(h.minReales) : `${h.hechasHoy.length}`} style={{ marginTop: 14 }}>{h.hechasHoy.map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} />)}</ListaAgrupada>}
      <div style={{ height: 90 }} />
    </>
  );
}

function BandejaM({ d, uid, propietario, puedeEditar, hoy, abrirItem, personasPorId }) {
  const { theme } = useTheme();
  const lista = useMemo(() => bandejaDe(d.items, propietario, hoy), [d.items, propietario, hoy]);
  const run = (fn, msg) => fn().then(() => toast.ok(msg)).catch((e) => toast.error(e.message));
  return (
    <>
      <ListaAgrupada titulo="Por clasificar" meta={`${lista.length}`} pie="Lo que capturas sin fecha cae aquí. Elige a dónde va.">
        {lista.length === 0 && <Vacio icon={null} titulo="Bandeja vacía" style={{ padding: '18px 16px' }} />}
        {lista.map((it) => (
          <div key={it.id} style={{ padding: '10px 16px', borderTop: `1px solid ${theme.border}` }}>
            <div onClick={() => abrirItem(it)} style={{ fontSize: 14, color: theme.text }}><Pill size="xs" tone={it.tipo === 'idea' ? 'purple' : 'blue'} style={{ marginRight: 6 }}>{it.tipo}</Pill>{it.titulo}</div>
            {puedeEditar && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {[['Hoy', 'blue', () => triage(it, { tipo: it.tipo === 'idea' ? 'tarea' : it.tipo, cuando: isoDia(hoy) })], ['Mañana', 'gray', () => triage(it, { tipo: it.tipo === 'idea' ? 'tarea' : it.tipo, cuando: isoDia(sumarDias(hoy, 1)) })], ['Idea', 'purple', () => triage(it, { tipo: 'idea' })], ['Cuando sea', 'gray', () => triage(it, { tipo: 'tarea' })], ['7 días', 'orange', () => posponer(it, 7)], ['✕', 'red', () => descartar(it)]].map(([l, tone, fn]) => <Pill key={l} tone={tone} onClick={() => run(fn, l === '✕' ? 'Descartada' : `→ ${l}`)} style={{ cursor: 'pointer', padding: '5px 11px' }}>{l}</Pill>)}
            </div>}
          </div>
        ))}
      </ListaAgrupada>
      <div style={{ height: 90 }} />
    </>
  );
}

function PendientesM({ d, uid, propietario, puedeEditar, hoy, abrirItem, toggle, posponerM, personasPorId }) {
  const g = useMemo(() => pendientesDe(d.items, propietario, hoy), [d.items, propietario, hoy]);
  const H = [['vencidos', 'Vencidos'], ['hoy', 'Hoy'], ['proximos', 'Próximos 7 días'], ['despues', 'Más adelante'], ['cuandoSea', 'Cuando sea'], ['algunDia', 'Algún día']];
  const total = Object.values(g).reduce((s, l) => s + l.length, 0);
  return (
    <>
      {total === 0 && <Vacio icon={null} titulo="Sin pendientes abiertos" style={{ padding: '26px 16px' }} />}
      {H.map(([k, label]) => g[k].length > 0 && <ListaAgrupada key={k} titulo={label} meta={`${g[k].length}`} style={{ marginTop: 14 }}>{g[k].map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} onManana={(x) => posponerM(x, 1)} onSemana={(x) => posponer(x, 7)} mostrarFecha={k !== 'hoy'} />)}</ListaAgrupada>)}
      <div style={{ height: 90 }} />
    </>
  );
}

function MasM({ d, uid, propietario, puedeEditar, hoy, abrirItem, personasPorId, nav }) {
  const { theme } = useTheme();
  const hoyIso = isoDia(hoy);
  const h = useMemo(() => hoyDe(d.items, propietario, hoy, { reuniones: d.reuniones, google: d.google }), [d.items, d.reuniones, d.google, propietario, hoy]);
  const reg = d.registros.find((r) => r.usuario === propietario && r.fecha === hoyIso) || {};
  const [reflexion, setReflexion] = useState(reg.reflexion || '');
  const [energia, setEnergia] = useState(reg.energia || null);
  const [checkin, setCheckin] = useState(() => d.checkins.find((c) => c.usuario === uid && c.fecha === hoyIso && c.tipo === 'dia')?.respuesta || '');
  const ideas = d.items.filter((it) => esDe(it, propietario) && abierto(it) && (it.tipo === 'idea' || it.tipo === 'nota') && !it.bandeja);
  const cerrar = () => guardarRegistroDia(propietario, hoyIso, { reflexion, energia, min_planeados: h.minTareas, min_reales: h.minReales, cerrado_at: new Date().toISOString() }).then(() => toast.ok('Día cerrado')).catch((e) => toast.error(e.message));
  const inp = { width: '100%', borderRadius: 11, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: '10px 12px', fontFamily: TYPO.fontText, fontSize: 14 };
  return (
    <>
      <ListaAgrupada titulo="Registro del día" meta={`${h.hechasHoy.length} hechas · ${fmtMin(h.minReales)} reales`} style={{ marginTop: 4 }}>
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={reflexion} onChange={(e) => setReflexion(e.target.value)} disabled={!puedeEditar} rows={2} placeholder="¿Cómo estuvo el día? Una línea." style={inp} />
          <div style={{ display: 'flex', gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" disabled={!puedeEditar} onClick={() => setEnergia(n)} style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${energia === n ? theme.accent : theme.border}`, background: energia === n ? `${theme.accent}18` : theme.surface, color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{n}</button>)}</div>
          {puedeEditar && <BotonGrande primario onClick={cerrar}>Cerrar el día</BotonGrande>}
        </div>
      </ListaAgrupada>
      <ListaAgrupada titulo="Mi check-in" meta="¿qué hiciste hoy?" style={{ marginTop: 14 }}>
        <div style={{ padding: '10px 16px', display: 'flex', gap: 8 }}><input value={checkin} onChange={(e) => setCheckin(e.target.value)} style={inp} placeholder="Cerré la propuesta, cuadré apoyos…" /><button type="button" onClick={() => guardarCheckin(uid, hoyIso, 'dia', checkin).then(() => toast.ok('Guardado')).catch((e) => toast.error(e.message))} style={{ border: 0, borderRadius: 11, background: theme.accent, color: '#fff', padding: '0 14px', fontFamily: TYPO.fontText, fontWeight: 600 }}>OK</button></div>
      </ListaAgrupada>
      <ListaAgrupada titulo="Equipo hoy" style={{ marginTop: 14 }}>
        {d.personas.map((p) => { const hp = hoyDe(d.items, p.user_id, hoy, { reuniones: d.reuniones }); const ci = d.checkins.find((c) => c.usuario === p.user_id && c.fecha === hoyIso && c.tipo === 'dia'); return <Fila key={p.user_id} titulo={p.nombre} sub={ci ? ci.respuesta : `${hp.hechasHoy.length} hechas · ${hp.deHoy.length} abiertas`} chevron={false} alto={50} pill={{ tone: hp.deAyer.length ? 'orange' : 'green', label: `${hp.hechasHoy.length}/${hp.hechasHoy.length + hp.deHoy.length}` }} />; })}
      </ListaAgrupada>
      <ListaAgrupada titulo="Ideas" meta={`${ideas.length}`} style={{ marginTop: 14 }}>
        {ideas.length === 0 && <Vacio icon={null} titulo="Sin ideas guardadas" sub="Escribe «idea: …» en la captura." style={{ padding: '16px' }} />}
        {ideas.map((it) => <Fila key={it.id} titulo={it.titulo} sub={it.cliente_key && it.cliente_key !== 'interno' ? nombreClienteAgenda(it.cliente_key) : undefined} chevron={false} alto={48} onClick={() => abrirItem(it)} pill={puedeEditar ? { tone: 'blue', label: '→ hoy' } : undefined} />)}
      </ListaAgrupada>
      <div style={{ height: 90 }} />
    </>
  );
}
