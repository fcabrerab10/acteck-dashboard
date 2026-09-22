// Agenda móvil · Minuta en vivo (pantalla empujada, fuera del árbol de Agenda: lee la cache con useAgendaDatos).
// Hero compacto (asistentes, abiertos/arrastrados/resueltos) · secciones Arrastrados / Puntos de hoy: cada punto con
// palomita, texto con etiquetas editable en línea (guardado al momento: debounce 600 ms por punto, "● hace N s"),
// categoría, responsable y fecha (tocar "…" abre la edición completa) · línea "Nuevo punto…" con micrófono ·
// pie fijo con Compartir (textos.js → WhatsApp), Repartir y Cerrar reunión (RPC, confirmación, toast con lo generado).
// Notas de la reunión (2026-09-21, propuesta A «Anota y reparte al cerrar»): área de texto libre que se guarda
// sola cada 800 ms en agenda_reuniones.notas (la misma columna que usa la web), con las líneas que parecen
// acuerdo resaltadas detrás del texto y el contador «N acuerdos detectados» → botón Repartir (hoja Reparto.jsx).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Lock, Play, MoreHorizontal, Plus, Check, Split, ChevronRight, ChevronDown, ArrowDownToLine, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Cargando } from '../../../components/kit';
import { compartir } from '../../../lib/whatsapp';
import { useAgendaDatos, useComentarios, guardarPunto, actualizarReunion, cerrarReunion, recargarAgenda, traerPuntosDeReunion } from '../../../modules/agenda/datos';
import { detectarAcuerdos, lineasMarcadas } from '../../../modules/agenda/reparto';
import { resumenReunion, vecesArrastrado, ordinal, cuando, isoDia, fmtHora, fmtCorta, hiloComentarios, pendientesDePunto, reunionAnterior } from '../../../modules/agenda/calculo';
import { textoConEtiquetas, nombreClienteAgenda, fechaNatural } from '../../../modules/agenda/etiquetas';
import { textoMinuta, subReunion, ESTADO_REUNION_LABEL } from '../../../modules/agenda/textos';
import { useNav, ALTO_BARRA } from '../../nav';
import { Cabecera, HeroM, Pill, Vacio, BotonGrande, toast } from '../../piezas';
import { MONO } from '../../util';
import { PalomitaM, TagPersona, CatPill, BotonMic, SeccionM, ChipM, useReloj, primerNombre } from './comun';
import CapturaHoja from './Captura';
import Reparto from './Reparto';
import HiloM from './Comentarios';

const DEBOUNCE_MS = 600;
const NOTAS_MS = 800;   // las notas son un texto largo: un respiro más que los puntos

export default function Minuta({ reunionId }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const { items, reuniones, personas, personasPorId, porId, cargando } = useAgendaDatos();
  const { comentariosPor } = useComentarios();
  const reunion = reuniones.find((r) => r.id === reunionId) || null;
  const perfil = nav.perfil;
  const puedeEditar = !!perfil?.es_super_admin || perfil?.tipo === 'interno';
  const cerrada = reunion?.estado === 'cerrada';
  const editable = puedeEditar && !cerrada;
  const res = useMemo(() => (reunion ? resumenReunion(reunion, items, porId) : null), [reunion, items, porId]);

  const [guardadoAt, setGuardadoAt] = useState(null);
  const [guardando, setGuardando] = useState(0);
  const [nuevo, setNuevo] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [cap, setCap] = useState(null);
  const [verAsistentes, setVerAsistentes] = useState(false);
  const [notas, setNotas] = useState('');
  const [verReparto, setVerReparto] = useState(false);
  const notaDe = useRef(null);
  const timers = useRef(new Map());
  const pendientes = useRef(new Map());
  const baseDictado = useRef('');
  useReloj(true);
  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t); recargarAgenda(); }, []);
  // Las notas se cargan una vez por reunión (después manda lo que se escribe en el celular).
  useEffect(() => { if (reunion?.id && notaDe.current !== reunion.id) { notaDe.current = reunion.id; setNotas(reunion.notas || ''); } }, [reunion?.id, reunion?.notas]);

  const marcarGuardado = () => { setGuardadoAt(Date.now()); setGuardando((n) => Math.max(0, n - 1)); };
  const guardarAhora = useCallback(async (id, campos) => {
    const p = porId.get(id); if (!p || !reunion) return;
    setGuardando((n) => n + 1);
    try { await guardarPunto({ id, reunion, texto: campos.texto ?? textoConEtiquetas(p, personas), orden: p.orden, estado: campos.estado ?? p.estado, fecha_limite: campos.fecha_limite === undefined ? p.fecha_limite : campos.fecha_limite, resolucion: p.resolucion, responsables: p.responsables || [], categoria: p.categoria, cliente_key: p.cliente_key, prev: p }, personas); marcarGuardado(); }
    catch (e) { setGuardando((n) => Math.max(0, n - 1)); toast.error(`No se guardó: ${e.message}`); }
  }, [porId, reunion, personas]);
  const programar = useCallback((id, campos) => {
    pendientes.current.set(id, { ...(pendientes.current.get(id) || {}), ...campos });
    if (timers.current.has(id)) clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => { const c = pendientes.current.get(id); pendientes.current.delete(id); timers.current.delete(id); guardarAhora(id, c); }, DEBOUNCE_MS));
  }, [guardarAhora]);

  const guardarNotas = (v) => {
    setNotas(v);
    if (timers.current.has('__notas')) clearTimeout(timers.current.get('__notas'));
    timers.current.set('__notas', setTimeout(async () => {
      timers.current.delete('__notas');
      setGuardando((n) => n + 1);
      try { await actualizarReunion(reunion.id, { notas: v }); marcarGuardado(); }
      catch (e) { setGuardando((n) => Math.max(0, n - 1)); toast.error(e.message); }
    }, NOTAS_MS));
  };

  const crear = async () => {
    const t = nuevo.trim(); if (!t || !reunion) return;
    const nat = fechaNatural(t, hoy);
    setGuardando((n) => n + 1);
    try { await guardarPunto({ id: null, reunion, texto: nat.texto || t, orden: (res.puntos.at(-1)?.orden ?? -1) + 1, responsables: [], cliente_key: reunion.cliente_key, fecha_limite: nat.fecha || null }, personas); setNuevo(''); baseDictado.current = ''; marcarGuardado(); }
    catch (e) { setGuardando((n) => Math.max(0, n - 1)); toast.error(e.message); }
  };
  const togglePunto = (p) => { if (!editable || p.estado === 'arrastrada') return; guardarAhora(p.id, { estado: p.estado === 'hecha' ? 'abierta' : 'hecha' }); };
  const toggleAsistente = async (p) => {
    if (!editable) return;
    const lista = reunion.asistentes || [];
    const ya = lista.some((x) => x.user_id === p.user_id);
    try { await actualizarReunion(reunion.id, { asistentes: ya ? lista.filter((x) => x.user_id !== p.user_id) : [...lista, { user_id: p.user_id, nombre: p.nombre }] }); } catch (e) { toast.error(e.message); }
  };
  const iniciar = async () => { try { await actualizarReunion(reunion.id, { estado: 'en_curso' }); toast.ok('Reunión en curso'); } catch (e) { toast.error(e.message); } };
  const cerrar = async () => {
    const n = res.abiertos.length;
    if (!window.confirm(`¿Cerrar la reunión? ${n ? `${n} punto${n === 1 ? '' : 's'} abierto${n === 1 ? '' : 's'} se convierten en tareas y se arrastran a la siguiente reunión con ${nombreClienteAgenda(reunion.cliente_key)}; ` : ''}cada responsable recibe aviso.`)) return;
    setCerrando(true);
    try {
      for (const [id, t] of timers.current) { clearTimeout(t); if (id === '__notas') { await actualizarReunion(reunion.id, { notas }).catch(() => {}); continue; } const c = pendientes.current.get(id); if (c) await guardarAhora(id, c); }
      timers.current.clear(); pendientes.current.clear();
      const r = await cerrarReunion(reunion.id);
      toast.ok(`Reunión cerrada · ${n} tarea${n === 1 ? '' : 's'} generada${n === 1 ? '' : 's'}${r.siguiente ? ` · ${r.arrastrados ?? n} a la siguiente` : ''} · ${r.avisos ?? 0} aviso${r.avisos === 1 ? '' : 's'}`, { ms: 5000 });
    } catch (e) { toast.error(e.message); }
    setCerrando(false);
  };
  const compartirWa = () => compartir(textoMinuta(reunion, res.puntos, { personasPorId, porId }), { titulo: `Minuta ${nombreClienteAgenda(reunion.cliente_key)}` });
  const onDictado = (t, final) => { const sep = baseDictado.current && !/\s$/.test(baseDictado.current) ? ' ' : ''; setNuevo(`${baseDictado.current}${sep}${t}`); if (final) baseDictado.current = `${baseDictado.current}${sep}${t}`; };

  // Acuerdos detectados en las notas (reparto.js): alimentan el contador y la hoja Repartir.
  const acuerdos = useMemo(() => (reunion
    ? detectarAcuerdos(notas, { clienteKey: reunion.cliente_key, personas, hoy, yo: perfil?.user_id || null, existentes: res?.puntos || [] })
    : []), [notas, reunion, personas, hoy, perfil, res]);

  const seg = guardadoAt ? Math.max(0, Math.round((Date.now() - guardadoAt) / 1000)) : null;
  const indicador = guardando > 0 ? 'guardando…' : seg == null ? (editable ? 'se guarda al momento' : '') : seg < 3 ? '● guardado' : `● hace ${seg < 60 ? `${seg} s` : `${Math.round(seg / 60)} min`}`;
  const bottomPie = nav.modo === 'barra' ? `calc(${ALTO_BARRA + 20}px + env(safe-area-inset-bottom))` : 'env(safe-area-inset-bottom)';

  if (cargando && !reunion) return (<><Cabecera onVolver={nav.pop} /><div style={{ padding: '0 16px' }}><Cargando pantalla="movilMinuta" /></div></>);
  if (!reunion) return (<><Cabecera onVolver={nav.pop} /><Vacio titulo="Reunión no encontrada" sub="Quizá se eliminó o ya no está en el rango cargado." /></>);

  const f = new Date(reunion.fecha);
  const asis = (reunion.asistentes || []).map((x) => x.nombre || personasPorId.get(x.user_id)?.nombre).filter(Boolean).map(primerNombre);
  const arrastrados = res.puntos.filter((p) => p.arrastrado_desde && p.estado !== 'arrastrada');
  const deHoy = res.puntos.filter((p) => !p.arrastrado_desde || p.estado === 'arrastrada');
  const dark = theme.mode === 'dark';

  const irAEnlace = (p) => { const e = p.origen?.enlace; if (e?.pagina) nav.navegar({ pagina: e.pagina, clienteKey: e.clienteKey || null }); };
  const punto = (p) => (
    <LineaPunto key={p.id} p={p} theme={theme} editable={editable && p.estado !== 'arrastrada'} personas={personas} personasPorId={personasPorId} porId={porId} hoy={hoy}
      hilo={hiloComentarios([], p, porId, { porItem: comentariosPor })} nPendientes={pendientesDePunto(items, p.id).length} reunionId={reunion.id}
      reunionOrigen={p.arrastrado_desde ? reuniones.find((r) => r.id === porId.get(p.arrastrado_desde)?.reunion_id) : null}
      onEnlace={p.origen?.enlace?.pagina ? () => irAEnlace(p) : null}
      onTexto={(texto) => programar(p.id, { texto })} onToggle={() => togglePunto(p)} onMas={() => setCap({ item: p })} />
  );

  return (
    <>
      <Cabecera onVolver={nav.pop} derecha={<span style={{ fontFamily: MONO, fontSize: 11, color: guardando ? theme.orange : theme.green, paddingRight: 8, whiteSpace: 'nowrap' }}>{indicador}</span>} />
      <div style={{ padding: '0 20px 8px' }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, lineHeight: 1.15 }}>{nombreClienteAgenda(reunion.cliente_key)} · {cuando(isoDia(f), hoy)} {fmtHora(f)}</h1>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{subReunion(reunion, hoy)} · {ESTADO_REUNION_LABEL[reunion.estado]}</div>
      </div>
      <HeroM eyebrow={`Minuta en vivo · ${reunion.titulo}`} frase={asis.length ? `Asistentes: ${asis.join(', ')}` : 'Sin asistentes marcados'} sub={editable ? 'Toca para marcar asistentes' : undefined} onClick={editable ? () => setVerAsistentes((v) => !v) : undefined}
        stats={[{ k: 'Abiertos', v: res.abiertos.length }, { k: 'Arrastrados', v: res.arrastradosAqui.length, color: res.arrastradosAqui.length ? theme.orange : undefined }, { k: 'Resueltos', v: res.resueltos.length }]} style={{ padding: '14px 16px 12px' }} />
      {verAsistentes && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 16px 0' }}>
          {personas.map((p) => { const on = (reunion.asistentes || []).some((x) => x.user_id === p.user_id); return <ChipM key={p.user_id} on={on} tone="blue" onClick={() => toggleAsistente(p)}>{on && <Check size={12} />}{primerNombre(p.nombre)}</ChipM>; })}
          {editable && reunion.estado === 'programada' && <ChipM tone="green" onClick={iniciar}><Play size={12} />Iniciar reunión</ChipM>}
        </div>
      )}

      <div style={{ padding: '4px 16px 0' }}>
        <PanelAnterior reunion={reunion} reuniones={reuniones} items={items} porId={porId} comentariosPor={comentariosPor} personasPorId={personasPorId}
          hoy={hoy} puedeEditar={editable} theme={theme} />
        {arrastrados.length > 0 && <><SeccionM tone="orange" n={arrastrados.length}>Arrastrados de reuniones anteriores</SeccionM>{arrastrados.map(punto)}</>}
        <SeccionM n={deHoy.length}>{cerrada ? 'Puntos' : 'Puntos de hoy'}</SeccionM>
        {deHoy.map(punto)}
        {!res.puntos.length && !editable && <div style={{ fontSize: 13, color: theme.textMuted, padding: '6px 4px' }}>Sin puntos.</div>}
        {editable && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', border: `1.5px dashed ${theme.borderStrong || theme.border}`, borderRadius: 12, padding: '6px 8px 6px 12px', marginTop: 4, background: 'transparent' }}>
            <span style={{ width: 20, height: 20, borderRadius: 999, border: `1.5px solid ${theme.border}`, flexShrink: 0, opacity: 0.5 }} />
            <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }} placeholder="Nuevo punto… #cliente @persona /categoría" enterKeyHint="done" autoCapitalize="sentences"
              style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 16, color: theme.text, height: 36 }} />
            {nuevo.trim() ? <button type="button" onClick={crear} aria-label="Agregar punto" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: theme.accent, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Plus size={18} strokeWidth={2.6} /></button>
              : <BotonMic size={36} onTexto={onDictado} onEstado={(on) => { if (on) baseDictado.current = nuevo; }} />}
          </div>
        )}
        <SeccionM tone={acuerdos.length ? 'blue' : undefined}>Notas de la reunión</SeccionM>
        <NotasMinuta theme={theme} valor={notas} onChange={guardarNotas} editable={editable} hoy={hoy} />
        {(editable || acuerdos.length > 0) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: acuerdos.length ? theme.accent : theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>
              {acuerdos.length ? `${acuerdos.length} acuerdo${acuerdos.length === 1 ? '' : 's'} detectado${acuerdos.length === 1 ? '' : 's'}` : 'Sin acuerdos detectados'}
            </span>
            <span style={{ flex: 1, fontSize: 11, color: theme.textMuted }}>Empieza con «-», menciona @alguien o pon una fecha.</span>
          </div>
        )}
        {editable && <div style={{ marginTop: 10 }}><BotonGrande primario icon={Split} disabled={!acuerdos.length} onClick={() => setVerReparto(true)}>Repartir{acuerdos.length ? ` ${acuerdos.length}` : ''}</BotonGrande></div>}
        <div style={{ height: 96 }} />
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: `10px 16px calc(12px + ${bottomPie})`, background: dark ? 'rgba(0,0,0,0.78)' : 'rgba(245,245,247,0.86)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', borderTop: `1px solid ${theme.border}`, display: 'flex', gap: 8, zIndex: 30 }}>
        <button type="button" onClick={compartirWa} style={pie(theme, false)}><Share2 size={16} />Compartir</button>
        {editable && <button type="button" onClick={cerrar} disabled={cerrando} style={{ ...pie(theme, true), opacity: cerrando ? 0.5 : 1 }}><Lock size={16} />Cerrar reunión</button>}
        {cerrada && <span style={{ ...pie(theme, false), background: 'transparent', border: 0, color: theme.textMuted }}>Cerrada{res.arrastradosFuera.length ? ` · ${res.arrastradosFuera.length} arrastrado${res.arrastradosFuera.length === 1 ? '' : 's'}` : ''}</span>}
      </div>

      <CapturaHoja cfg={cap} personas={personas} reuniones={reuniones} hoy={hoy} onClose={() => setCap(null)} onGuardado={() => setGuardadoAt(Date.now())} />
      <Reparto abierto={verReparto} onClose={() => setVerReparto(false)} reunion={reunion} filas={acuerdos} personas={personas} hoy={hoy}
        orden0={(res.puntos.at(-1)?.orden ?? -1) + 1} onListo={() => nav.pop()} />
    </>
  );
}

const pie = (theme, primario) => ({ flex: 1, height: 48, borderRadius: 12, border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? theme.accent : theme.surface, color: primario ? '#FFF' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' });

function LineaPunto({ p, theme, editable, personas, personasPorId, porId, hoy, hilo = [], nPendientes = 0, reunionOrigen = null, reunionId, onEnlace, onTexto, onToggle, onMas }) {
  const [texto, setTexto] = useState(() => textoConEtiquetas(p, personas));
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setTexto(textoConEtiquetas(p, personas)); }, [p.titulo, p.cliente_key, p.categoria, p.responsables, personas, foco]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = vecesArrastrado(p, porId);
  const hecha = p.estado === 'hecha';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px dashed ${theme.border}`, opacity: p.estado === 'arrastrada' ? 0.55 : 1 }}>
      <div style={{ paddingTop: 2 }}><PalomitaM hecha={hecha} onClick={onToggle} disabled={!editable} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editable
          ? <input value={texto} onChange={(e) => { setTexto(e.target.value); onTexto(e.target.value); }} onFocus={() => setFoco(true)} onBlur={() => setFoco(false)} aria-label="Punto"
              style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 15, color: hecha ? theme.textMuted : theme.text, textDecoration: hecha ? 'line-through' : 'none', padding: 0, lineHeight: 1.35 }} />
          : <div style={{ fontSize: 15, color: hecha ? theme.textMuted : theme.text, textDecoration: hecha ? 'line-through' : 'none', lineHeight: 1.35 }}>{p.titulo}</div>}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 4, fontSize: 11, color: theme.textMuted }}>
          <CatPill categoria={p.categoria} />
          {(p.responsables || []).slice(0, 2).map((u) => <TagPersona key={u} persona={personasPorId.get(u)} />)}
          {!(p.responsables || []).length && p.estado === 'abierta' && <span style={{ color: theme.orange }}>sin responsable</span>}
          {p.fecha_limite && <span>{cuando(p.fecha_limite, hoy)}</span>}
          {n > 0 && <Pill tone="orange" size="xs">{ordinal(n)}</Pill>}
          {hecha && <Pill tone="green" size="xs">resuelto</Pill>}
          {p.estado === 'arrastrada' && <Pill tone="gray" size="xs">arrastrado</Pill>}
          {p.resolucion && <span>— {p.resolucion}</span>}
          {nPendientes > 0 && <Pill tone="blue" size="xs">{nPendientes} pendiente{nPendientes === 1 ? '' : 's'}</Pill>}
          {reunionOrigen && <span>viene de la reunión del {fmtCorta(isoDia(new Date(reunionOrigen.fecha)))}</span>}
          {onEnlace && <button type="button" onClick={onEnlace} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2, padding: 0, cursor: 'pointer' }}><ArrowUpRight size={12} />Ver en dashboard</button>}
        </div>
        <HiloM item={p} hilo={hilo} personasPorId={personasPorId} reunionId={reunionId} puedeEditar={editable} />
      </div>
      <button type="button" onClick={onMas} aria-label="Más opciones" style={{ width: 32, height: 32, margin: '-4px -6px 0 0', border: 0, background: 'transparent', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><MoreHorizontal size={18} /></button>
    </div>
  );
}

/**
 * Área de notas con resaltado por línea: detrás del textarea va una copia del texto donde las
 * líneas que `reparto.js` reconoce como acuerdo llevan fondo. Mismo tipo, tamaño, interlineado y
 * padding en las dos capas, o el resaltado se desalinea.
 */
function NotasMinuta({ theme, valor, onChange, editable, hoy }) {
  const marcas = useMemo(() => lineasMarcadas(valor, { hoy }), [valor, hoy]);
  const fondo = useRef(null);
  const dark = theme.mode === 'dark';
  const caja = { fontFamily: TYPO.fontText, fontSize: 15, lineHeight: 1.5, padding: '10px 12px', margin: 0, border: '1px solid transparent', borderRadius: 12, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', boxSizing: 'border-box', width: '100%' };
  const filas = Math.min(18, Math.max(5, marcas.length + 1));
  const resalte = dark ? 'rgba(10,132,255,0.22)' : 'rgba(0,122,255,0.12)';
  if (!editable) {
    return (
      <div style={{ ...caja, border: `1px solid ${theme.border}`, background: dark ? 'rgba(255,255,255,0.04)' : theme.surface, color: valor ? theme.text : theme.textMuted, minHeight: 60 }}>
        {valor || 'Sin notas.'}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', border: `1px solid ${theme.border}`, borderRadius: 12, background: dark ? 'rgba(255,255,255,0.04)' : theme.surface }}>
      <div ref={fondo} aria-hidden style={{ ...caja, position: 'absolute', inset: 0, color: 'transparent', overflow: 'hidden', pointerEvents: 'none' }}>
        {marcas.map((l) => (
          <React.Fragment key={l.i}>
            <span style={l.acuerdo ? { background: resalte, borderRadius: 4, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } : undefined}>{l.texto || ' '}</span>{'\n'}
          </React.Fragment>
        ))}
      </div>
      <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={filas} placeholder="Anota la reunión. Las líneas con «-», @alguien, #cliente o una fecha se reparten al cerrar."
        autoCapitalize="sentences" onScroll={(e) => { if (fondo.current) fondo.current.scrollTop = e.target.scrollTop; }}
        style={{ ...caja, position: 'relative', background: 'transparent', color: theme.text, caretColor: theme.accent, outline: 'none', resize: 'none', display: 'block' }} />
    </div>
  );
}

/**
 * «Reunión anterior ›» del celular: plegado por omisión, lista los puntos de la última reunión del
 * mismo cliente con su estado y sus comentarios, y trae aquí los que quedaron abiertos
 * (RPC agenda_traer_puntos). Mismo cálculo que la web: calculo.js#reunionAnterior.
 */
function PanelAnterior({ reunion, reuniones, items, porId, comentariosPor, personasPorId, hoy, puedeEditar, theme }) {
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const previa = useMemo(() => reunionAnterior(reuniones, reunion), [reuniones, reunion]);
  const res = useMemo(() => (previa ? resumenReunion(previa, items, porId) : null), [previa, items, porId]);
  if (!previa) return null;
  const traer = async () => {
    if (busy) return;
    setBusy(true);
    try { const n = await traerPuntosDeReunion(reunion.id, previa.id); toast.ok(n ? `${n} punto${n === 1 ? '' : 's'} traído${n === 1 ? '' : 's'}` : 'No quedaban puntos abiertos'); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, marginBottom: 8 }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', border: 0, background: 'transparent', color: theme.text, cursor: 'pointer', textAlign: 'left' }}>
        {abierto ? <ChevronDown size={16} style={{ color: theme.textMuted }} /> : <ChevronRight size={16} style={{ color: theme.textMuted }} />}
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600 }}>Reunión anterior · {cuando(isoDia(new Date(previa.fecha)), hoy)}</span>
        <span style={{ marginLeft: 'auto' }}><Pill tone={res.abiertos.length ? 'orange' : 'green'} size="xs">{res.abiertos.length} abierto{res.abiertos.length === 1 ? '' : 's'}</Pill></span>
      </button>
      {abierto && (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: '8px 12px 12px' }}>
          {!res.puntos.length && <div style={{ fontSize: 13, color: theme.textMuted }}>Esa reunión no tuvo puntos.</div>}
          {res.puntos.map((p) => {
            const hilo = hiloComentarios([], p, porId, { porItem: comentariosPor });
            return (
              <div key={p.id} style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 6, marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: theme.text, textDecoration: p.estado === 'hecha' ? 'line-through' : 'none' }}>{p.titulo}</span>
                  <Pill tone={p.estado === 'hecha' ? 'green' : p.estado === 'arrastrada' ? 'gray' : 'orange'} size="xs">{p.estado === 'hecha' ? 'resuelto' : p.estado === 'arrastrada' ? 'arrastrado' : 'abierto'}</Pill>
                </div>
                {hilo.length > 0 && <HiloM item={p} hilo={hilo} personasPorId={personasPorId} puedeEditar={false} />}
              </div>
            );
          })}
          {puedeEditar && res.abiertos.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <BotonGrande icon={ArrowDownToLine} disabled={busy} onClick={traer}>Traer {res.abiertos.length} punto{res.abiertos.length === 1 ? '' : 's'} abierto{res.abiertos.length === 1 ? '' : 's'}</BotonGrande>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
