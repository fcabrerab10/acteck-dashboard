// Agenda · Minuta en vivo (HojaLateral): puntos línea por línea con #cliente @persona /categoría al teclear,
// guardado al momento (debounce 600 ms por punto + "guardado hace N s"), asistentes, notas; Cerrar reunión
// (avisos a responsables + arrastre a la siguiente del mismo cliente); compartir por WhatsApp y PDF.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Share2, Check, Play, Lock, Pencil, Split, ChevronUp, ChevronDown, ArrowUpRight, MessageSquare, CalendarDays, Mail } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { HojaLateral, Campo } from '../../components/perfil/comun';
import { Pill, Boton, Segmented, toast } from '../../components/kit';
import ExportMenu from '../../components/ExportMenu';
import { compartir } from '../../lib/whatsapp';
import { guardarPunto, actualizarReunion, cerrarReunion, borrarItem, recargarAgenda, moverPunto } from './datos';
import { resumenReunion, vecesArrastrado, ordinal, cuando, isoDia, hiloComentarios, pendientesDePunto, fmtCorta } from './calculo';
import { textoConEtiquetas, CATEGORIAS, nombreClienteAgenda } from './etiquetas';
import { textoMinuta, subReunion, ESTADO_REUNION_LABEL } from './textos';
import { CampoEtiquetas, Palomita, TagPersona, CatPill, TagCliente, Avatar } from './comun';
import { detectarAcuerdos } from './reparto';
import HojaReparto from './HojaReparto';
import Hilo from './Comentarios';
import ReunionAnterior from './ReunionAnterior';
import EnviarMinuta from './EnviarMinuta';
import { relativo } from '../../lib/format';

const DEBOUNCE_MS = 600;

export default function Minuta({ reunion, items, reuniones = [], personas, personasPorId, porId, hoy, uid = null, puedeEditar, comentariosPor, onClose, onEditar, onNavegar, onVerReuniones, google }) {
  const { theme } = useTheme();
  const res = useMemo(() => resumenReunion(reunion, items, porId), [reunion, items, porId]);
  const cerrada = reunion.estado === 'cerrada';
  const editable = puedeEditar && !cerrada;
  const [guardadoAt, setGuardadoAt] = useState(null);
  const [guardando, setGuardando] = useState(0);
  const [tick, setTick] = useState(0);
  const [nuevo, setNuevo] = useState('');
  const [notas, setNotas] = useState(reunion.notas || '');
  const [cerrando, setCerrando] = useState(false);
  const [verReparto, setVerReparto] = useState(false);
  const [verCorreo, setVerCorreo] = useState(false);
  const ultimoEnvio = (reunion.envios || []).at(-1);
  const rootRef = useRef(null);
  const timers = useRef(new Map());
  const pendientes = useRef(new Map());
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t); recargarAgenda(); }, []);

  const marcarGuardado = () => { setGuardadoAt(Date.now()); setGuardando((n) => Math.max(0, n - 1)); };
  const guardarAhora = useCallback(async (id, campos) => {
    const p = porId.get(id);
    setGuardando((n) => n + 1);
    try { await guardarPunto({ id, reunion, texto: campos.texto ?? textoConEtiquetas(p, personas), orden: p?.orden, estado: campos.estado ?? p?.estado, fecha_limite: campos.fecha_limite === undefined ? p?.fecha_limite : campos.fecha_limite, resolucion: campos.resolucion === undefined ? p?.resolucion : campos.resolucion, responsables: p?.responsables || [], categoria: p?.categoria, cliente_key: p?.cliente_key, prev: p }, personas); marcarGuardado(); }
    catch (e) { setGuardando((n) => Math.max(0, n - 1)); toast.error(`No se guardó: ${e.message}`); }
  }, [porId, reunion, personas]);
  /** Programa el guardado de un punto (debounce por id). */
  const programar = useCallback((id, campos) => {
    pendientes.current.set(id, { ...(pendientes.current.get(id) || {}), ...campos });
    if (timers.current.has(id)) clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => { const c = pendientes.current.get(id); pendientes.current.delete(id); timers.current.delete(id); guardarAhora(id, c); }, DEBOUNCE_MS));
  }, [guardarAhora]);

  const crear = async () => {
    const t = nuevo.trim(); if (!t) return;
    setGuardando((n) => n + 1);
    try { await guardarPunto({ id: null, reunion, texto: t, orden: (res.puntos.at(-1)?.orden ?? -1) + 1, responsables: [], cliente_key: reunion.cliente_key }, personas); setNuevo(''); marcarGuardado(); }
    catch (e) { setGuardando((n) => Math.max(0, n - 1)); toast.error(e.message); }
  };
  const togglePunto = (p) => { if (!editable) return; const estado = p.estado === 'hecha' ? 'abierta' : 'hecha'; guardarAhora(p.id, { estado }); };
  const borrar = async (p) => { if (!editable) return; try { await borrarItem(p.id); toast.ok('Punto eliminado'); } catch (e) { toast.error(e.message); } };
  const mover = async (p, delta) => { if (!editable) return; try { await moverPunto(res.puntos, p.id, delta); } catch (e) { toast.error(e.message); } };
  // «Ver en dashboard»: los puntos sembrados desde el correo traen origen.enlace = { pagina, clienteKey }.
  const irAEnlace = (p) => {
    const e = p.origen?.enlace; if (!e?.pagina) return;
    if (onNavegar) onNavegar(e.clienteKey || null, e.pagina);
    else if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { pagina: e.pagina, clienteKey: e.clienteKey || null } }));
  };
  const guardarNotas = (v) => { setNotas(v); if (timers.current.has('__notas')) clearTimeout(timers.current.get('__notas')); timers.current.set('__notas', setTimeout(async () => { setGuardando((n) => n + 1); try { await actualizarReunion(reunion.id, { notas: v }); marcarGuardado(); } catch (e) { setGuardando((n) => Math.max(0, n - 1)); toast.error(e.message); } }, DEBOUNCE_MS)); };
  const toggleAsistente = async (p) => {
    if (!editable) return;
    const lista = reunion.asistentes || [];
    const ya = lista.some((a) => a.user_id === p.user_id);
    const asistentes = ya ? lista.filter((a) => a.user_id !== p.user_id) : [...lista, { user_id: p.user_id, nombre: p.nombre }];
    try { await actualizarReunion(reunion.id, { asistentes }); } catch (e) { toast.error(e.message); }
  };
  const iniciar = async () => { try { await actualizarReunion(reunion.id, { estado: 'en_curso' }); toast.ok('Reunión en curso'); } catch (e) { toast.error(e.message); } };
  const cerrar = async () => {
    if (!window.confirm(`¿Cerrar la reunión? Los ${res.abiertos.length} punto${res.abiertos.length === 1 ? '' : 's'} abierto${res.abiertos.length === 1 ? '' : 's'} se arrastran a la siguiente reunión con ${nombreClienteAgenda(reunion.cliente_key)} y cada responsable recibe aviso.`)) return;
    setCerrando(true);
    try {
      for (const [id, t] of timers.current) { clearTimeout(t); if (id !== '__notas') { const c = pendientes.current.get(id); if (c) await guardarAhora(id, c); } }
      const r = await cerrarReunion(reunion.id);
      toast.ok(r.siguiente ? `Cerrada · ${r.arrastrados} arrastrado${r.arrastrados === 1 ? '' : 's'} a la siguiente · ${r.avisos} aviso${r.avisos === 1 ? '' : 's'}` : `Cerrada · ${r.avisos} aviso${r.avisos === 1 ? '' : 's'}${res.abiertos.length ? ' · los abiertos se arrastrarán al crear la siguiente reunión' : ''}`, { ms: 5000 });
    } catch (e) { toast.error(e.message); }
    setCerrando(false);
  };
  const compartirWa = () => compartir(textoMinuta(reunion, res.puntos, { personasPorId, porId }), { titulo: `Minuta ${nombreClienteAgenda(reunion.cliente_key)}` });
  // Acuerdos escritos en las Notas (mismo detector que el celular).
  const acuerdos = useMemo(() => detectarAcuerdos(notas, { clienteKey: reunion.cliente_key, personas, hoy, yo: uid, existentes: res.puntos }), [notas, reunion.cliente_key, personas, hoy, uid, res.puntos]);

  const seg = guardadoAt ? Math.max(0, Math.round((Date.now() - guardadoAt) / 1000)) : null;
  const indicador = guardando > 0 ? 'guardando…' : seg == null ? (editable ? 'se guarda al momento' : '') : seg < 3 ? '● guardado' : `● guardado hace ${seg < 60 ? `${seg} s` : `${Math.round(seg / 60)} min`}`;
  void tick;

  return (
    <HojaLateral abierto onClose={onClose} theme={theme} ancho={600} titulo={reunion.titulo} sub={`${subReunion(reunion, hoy)} · ${ESTADO_REUNION_LABEL[reunion.estado]}`}
      acciones={<>
        <span style={{ fontSize: 10.5, color: guardando ? theme.orange : theme.green, fontFamily: TYPO.fontDisplay, whiteSpace: 'nowrap' }}>{indicador}</span>
        <ExportMenu titulo={`Minuta · ${reunion.titulo}`} subtitulo={subReunion(reunion, hoy)} pdf={{ ref: rootRef }} label="PDF" />
      </>}>
      <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 4px 24px', fontFamily: TYPO.fontText }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <TagCliente clienteKey={reunion.cliente_key} size="sm" />
          {reunion.google_event_id && <Pill tone="blue">Google</Pill>}
          <Pill tone={cerrada ? 'gray' : reunion.estado === 'en_curso' ? 'blue' : 'orange'} dot>{ESTADO_REUNION_LABEL[reunion.estado]}</Pill>
          {ultimoEnvio && <Pill tone="green" dot title={`Enviada a ${ultimoEnvio.para.join(', ')}`}>Enviada {relativo(ultimoEnvio.at)}</Pill>}
          <Pill tone="gray">{res.abiertos.length} abierto{res.abiertos.length === 1 ? '' : 's'} · {res.resueltos.length} resuelto{res.resueltos.length === 1 ? '' : 's'}{res.arrastradosAqui.length ? ` · ${res.arrastradosAqui.length} arrastrado${res.arrastradosAqui.length === 1 ? '' : 's'}` : ''}</Pill>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Boton icon={Share2} onClick={compartirWa} title="Compartir por WhatsApp">WhatsApp</Boton>
            {puedeEditar && <Boton icon={Mail} onClick={() => setVerCorreo(true)} title={`Enviar la minuta por correo a ${nombreClienteAgenda(reunion.cliente_key)}`}>Correo</Boton>}
            {puedeEditar && <Boton icon={Pencil} onClick={onEditar} title="Editar fecha, lugar, asistentes">Editar</Boton>}
            {editable && reunion.estado === 'programada' && <Boton icon={Play} onClick={iniciar}>Iniciar</Boton>}
            {editable && acuerdos.length > 0 && <Boton icon={Split} onClick={() => setVerReparto(true)} title="Convertir las líneas de las Notas en pendientes">Repartir {acuerdos.length}</Boton>}
            {editable && <Boton icon={Lock} primario onClick={cerrar} disabled={cerrando}>Cerrar reunión</Boton>}
          </span>
        </div>

        <ReunionAnterior reunion={reunion} reuniones={reuniones} items={items} porId={porId} comentariosPor={comentariosPor}
          personasPorId={personasPorId} hoy={hoy} puedeEditar={editable} onVerTodas={onVerReuniones} />

        <Bloque theme={theme} titulo="Asistentes" sub={editable ? 'clic para marcar' : ''}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {personas.map((p) => { const on = (reunion.asistentes || []).some((a) => a.user_id === p.user_id); return <button key={p.user_id} type="button" onClick={() => toggleAsistente(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px 3px 4px', borderRadius: 999, border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? (theme.accentBg || 'rgba(0,122,255,0.08)') : theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, cursor: editable ? 'pointer' : 'default', opacity: on ? 1 : 0.6 }}><Avatar persona={p} size={18} />{(p.nombre || '').split(' ')[0]}{on && <Check size={11} />}</button>; })}
            {(reunion.asistentes || []).filter((a) => !a.user_id || !personasPorId.get(a.user_id)).map((a, i) => <Pill key={i} tone="gray">{a.nombre}</Pill>)}
          </div>
        </Bloque>

        <Bloque theme={theme} titulo="Puntos" sub={editable ? "palomita = resuelto · clic en el texto para editar · el globo abre los comentarios" : ""}>
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface, padding: '4px 10px' }}>
            {res.puntos.map((p, i) => (
              <LineaPunto key={p.id} p={p} theme={theme} editable={editable && p.estado !== 'arrastrada'} personas={personas} personasPorId={personasPorId} porId={porId} hoy={hoy}
                hilo={hiloComentarios([], p, porId, { porItem: comentariosPor })} nPendientes={pendientesDePunto(items, p.id).length}
                reunionOrigen={p.arrastrado_desde ? reuniones.find((r) => r.id === porId.get(p.arrastrado_desde)?.reunion_id) : null}
                puedeSubir={editable && i > 0} puedeBajar={editable && i < res.puntos.length - 1} onMover={(d) => mover(p, d)} onEnlace={p.origen?.enlace?.pagina ? () => irAEnlace(p) : null}
                onTexto={(texto) => programar(p.id, { texto })} onResolucion={(resolucion) => programar(p.id, { resolucion })} onFecha={(fecha_limite) => guardarAhora(p.id, { fecha_limite })} onToggle={() => togglePunto(p)} onBorrar={() => borrar(p)} reunionId={reunion.id} />
            ))}
            {editable && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 0' }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, border: `1.5px dashed ${theme.borderStrong || theme.border}`, flexShrink: 0 }} />
                <CampoEtiquetas value={nuevo} onChange={setNuevo} personas={personas} placeholder="Escribe un punto… usa #cliente @persona y /categoría · Enter guarda" onEnter={crear} sinBorde />
              </div>
            )}
            {!res.puntos.length && !editable && <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>Sin puntos.</div>}
          </div>
        </Bloque>

        <Bloque theme={theme} titulo="Notas" sub={cerrada ? '' : 'texto libre · se guarda al momento · «-», @alguien o una fecha = acuerdo'}>
          <textarea value={notas} onChange={(e) => guardarNotas(e.target.value)} readOnly={!editable} placeholder="Contexto, acuerdos generales, próximos pasos…" rows={Math.min(14, Math.max(4, String(notas).split('\n').length + 1))}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, padding: 10, outline: 'none', resize: 'vertical', lineHeight: 1.45 }} />
          {(editable || acuerdos.length > 0) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 11, fontFamily: TYPO.fontDisplay, fontWeight: 600, color: acuerdos.length ? theme.accent : theme.textMuted }}>
                {acuerdos.length ? `${acuerdos.length} acuerdo${acuerdos.length === 1 ? '' : 's'} detectado${acuerdos.length === 1 ? '' : 's'}` : 'Sin acuerdos detectados'}
              </span>
              {editable && <Boton icon={Split} disabled={!acuerdos.length} onClick={() => setVerReparto(true)}>Repartir</Boton>}
            </div>
          )}
        </Bloque>
        {reunion.migrado_de && <div style={{ fontSize: 10.5, color: theme.textMuted }}>Migrada de {reunion.migrado_de.tabla} · {reunion.migrado_de.fuente ? `fuente ${reunion.migrado_de.fuente}` : ''}</div>}
      </div>
      {verCorreo && <EnviarMinuta abierto onClose={() => setVerCorreo(false)} reunion={reunion} puntos={res.puntos} personasPorId={personasPorId} porId={porId} yo={personasPorId.get(uid)} />}
      <HojaReparto abierto={verReparto} onClose={() => setVerReparto(false)} reunion={reunion} filas={acuerdos} personas={personas} hoy={hoy}
        orden0={(res.puntos.at(-1)?.orden ?? -1) + 1} onListo={onClose} />
    </HojaLateral>
  );
}

function Bloque({ theme, titulo, sub, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600 }}>{titulo}</span>
        {sub && <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function LineaPunto({ p, theme, editable, personas, personasPorId, porId, hoy, hilo = [], nPendientes = 0, reunionOrigen = null, puedeSubir, puedeBajar, onMover, onEnlace, reunionId, onTexto, onResolucion, onFecha, onToggle, onBorrar }) {
  // Dos modos (2026-09-22, Fernando: «no entiendo cómo funciona»): en reposo el punto se LEE limpio —
  // título sin códigos, responsable, fecha y categoría como pastillas—; al hacer clic en el texto se edita
  // con #cliente @persona /categoría. Los comentarios van plegados detrás del globo con su contador.
  const [texto, setTexto] = useState(() => textoConEtiquetas(p, personas));
  const [quedo, setQuedo] = useState(p.resolucion || '');
  const [editando, setEditando] = useState(false);
  const [verHilo, setVerHilo] = useState(() => hilo.length > 0); // con seguimiento previo, abierto; sin él, plegado
  const [hover, setHover] = useState(false);
  const fechaRef = useRef(null);
  useEffect(() => { if (!editando) setTexto(textoConEtiquetas(p, personas)); }, [p.titulo, p.cliente_key, p.categoria, p.responsables, personas, editando]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = vecesArrastrado(p, porId);
  const hecha = p.estado === 'hecha';
  const vencida = !hecha && p.fecha_limite && p.fecha_limite < isoDia(hoy);
  const abrirFecha = () => { const el = fechaRef.current; if (!el) return; if (typeof el.showPicker === 'function') { try { el.showPicker(); return; } catch { /* Safari */ } } el.focus(); el.click(); };
  const nComentarios = hilo.length;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ borderBottom: `1px dashed ${theme.border}`, padding: '6px 0', opacity: p.estado === 'arrastrada' ? 0.55 : 1 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, position: 'relative' }}>
        <Palomita hecha={hecha} onClick={onToggle} size={15} disabled={!editable} />
        {editable && editando
          ? <CampoEtiquetas value={texto} onChange={(v) => { setTexto(v); onTexto(v); }} personas={personas} sinBorde autoFocus onBlur={() => setEditando(false)} onEnter={() => setEditando(false)} onEscape={() => setEditando(false)} style={{ textDecoration: hecha ? 'line-through' : 'none' }} />
          : <button type="button" onClick={editable ? () => setEditando(true) : undefined} title={editable ? 'Clic para editar el punto' : undefined}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', padding: '2px 0', cursor: editable ? 'text' : 'default', fontFamily: TYPO.fontText, fontSize: 13, color: hecha ? theme.textMuted : theme.text, textDecoration: hecha ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.titulo || <span style={{ color: theme.textMuted }}>Sin texto</span>}
            </button>}
        {(p.responsables || []).slice(0, 2).map((u) => <TagPersona key={u} persona={personasPorId.get(u)} />)}
        {/* Fecha límite: pastilla que abre el selector; sin fecha, un icono discreto */}
        {editable && <input ref={fechaRef} type="date" value={p.fecha_limite || ''} onChange={(e) => onFecha(e.target.value || null)} aria-label="Fecha límite" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />}
        {p.fecha_limite
          ? <button type="button" onClick={editable ? abrirFecha : undefined} title={editable ? 'Cambiar la fecha límite' : 'Fecha límite'} style={{ border: 0, background: 'transparent', padding: 0, cursor: editable ? 'pointer' : 'default' }}><Pill tone={vencida ? 'red' : 'gray'} size="xs">{cuando(p.fecha_limite, hoy)}</Pill></button>
          : editable && <button type="button" onClick={abrirFecha} title="Poner fecha límite" style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', padding: 2, display: 'inline-flex', opacity: hover ? 1 : 0.35 }}><CalendarDays size={13} /></button>}
        <CatPill categoria={p.categoria} />
        {n > 0 && <Pill tone="orange" size="xs">{ordinal(n)}</Pill>}
        {p.estado === 'arrastrada' && <Pill tone="gray" size="xs">arrastrado</Pill>}
        {onEnlace && <button type="button" onClick={onEnlace} title="Ver en el dashboard" style={{ border: 0, background: 'transparent', color: theme.accent, cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600 }}><ArrowUpRight size={12} />Ver</button>}
        <button type="button" onClick={() => setVerHilo((v) => !v)} title={verHilo ? 'Ocultar comentarios' : nComentarios ? `${nComentarios} comentario${nComentarios === 1 ? '' : 's'}` : 'Comentar'}
          style={{ border: 0, background: 'transparent', color: nComentarios || verHilo ? theme.accent : theme.textMuted, cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, opacity: nComentarios || verHilo || hover ? 1 : 0.35 }}>
          <MessageSquare size={13} />{nComentarios > 0 && nComentarios}
        </button>
        {editable && <span style={{ display: 'inline-flex', opacity: hover ? 1 : 0 }}>
          <button type="button" onClick={() => onMover?.(-1)} disabled={!puedeSubir} title="Subir" style={flecha(theme, puedeSubir)}><ChevronUp size={12} /></button>
          <button type="button" onClick={() => onMover?.(1)} disabled={!puedeBajar} title="Bajar" style={flecha(theme, puedeBajar)}><ChevronDown size={12} /></button>
          <button type="button" onClick={onBorrar} title="Eliminar punto" style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', padding: 2, display: 'inline-flex' }}><Trash2 size={12} /></button>
        </span>}
      </div>
      {(reunionOrigen || nPendientes > 0) && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 23, marginTop: 2 }}>
          {reunionOrigen && <span style={{ fontSize: 10, color: theme.textMuted }}>viene de la reunión del {fmtCorta(isoDia(new Date(reunionOrigen.fecha)))}</span>}
          {nPendientes > 0 && <Pill tone="blue" size="xs">{nPendientes} pendiente{nPendientes === 1 ? '' : 's'}</Pill>}
        </div>
      )}
      {/* «quedó:» = en qué quedó el punto; se escribe al resolverlo o al abrir los comentarios */}
      {(p.resolucion || (editable && (hecha || verHilo))) && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 23, marginTop: 3 }}>
          <span style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>quedó:</span>
          {editable ? <input value={quedo} onChange={(e) => { setQuedo(e.target.value); onResolucion(e.target.value); }} placeholder="en qué quedó (nota corta)" style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.text }} /> : <span style={{ fontSize: 11.5, color: theme.text }}>{p.resolucion}</span>}
        </div>
      )}
      {/* Seguimiento del punto: el hilo no se pierde cuando el punto se arrastra a la siguiente reunión. */}
      {verHilo && <Hilo item={p} hilo={hilo} personasPorId={personasPorId} reunionId={reunionId} puedeEditar={editable} compacto />}
    </div>
  );
}

const flecha = (theme, on) => ({ border: 0, background: 'transparent', color: on ? theme.textMuted : theme.border, cursor: on ? 'pointer' : 'default', padding: 0, display: 'inline-flex' });
