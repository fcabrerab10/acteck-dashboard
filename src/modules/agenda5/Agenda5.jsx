// Agenda V5 (2026-10-04) · «una app completa dentro de una pestaña», rehecha desde cero sobre lo mejor de Sunsama,
// Things, Akiflow, Linear, Granola, Fellow y Basecamp (docs/AGENDA_V5.md). Propuesta A elegida por Fernando: módulos a la
// izquierda, selector de persona arriba (cada quien ve su agenda; Karolina puede ver la de Fernando en sólo lectura y
// Fernando ve todas; David Millán no entra), Hoy con lista + reloj del día + mes completo en pequeño.
// Módulos: Hoy · Bandeja · Pendientes · Reuniones (minutas de la V4 dentro del nuevo armazón) · Ideas · Registro del día ·
// Semana · Equipo. Captura rápida con N o ⌘⇧N en lenguaje natural (agenda5/interpretar.js).
import React, { useEffect, useMemo, useState } from 'react';
import { Sun, Inbox, CheckSquare, Users, Lightbulb, BookOpen, CalendarRange, UserCheck, ChevronDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../lib/permisos';
import { Cargando, Panel, Pill, Boton, toast } from '../../components/kit';
import SinAcceso from '../../components/SinAcceso';
import { supabase } from '../../lib/supabase';
import { useAgenda5, actualizarItem, completarItem, guardarRegistroDia, guardarCheckin, crearObjetivoSemana, marcarObjetivoSemana, borrarObjetivoSemana } from './datos';
import { cuentasPendientes } from './base/calculo';
import { hoyDe, bandejaDe, pendientesDe, isoDia, sumarDias, fmtMin, esDe, abierto } from './calculo';
import { Avatar, FilaTarea, Titulo, Seccion, Palomita } from './comun';
import Captura from './Captura';
import Hoy from './Hoy';
import Bandeja from './Bandeja';
import Pendientes from './Pendientes';
import ReunionesV5 from './Reuniones';
import HojaItem from './base/HojaItem';
import Minuta from './base/Minuta';
import FormReunion from './base/FormReunion';
import { comentariosPorItem } from './base/calculo';

const MODULOS = [
  { id: 'hoy', label: 'Hoy', icon: Sun }, { id: 'bandeja', label: 'Bandeja', icon: Inbox }, { id: 'pendientes', label: 'Pendientes', icon: CheckSquare },
  { id: 'reuniones', label: 'Reuniones', icon: Users }, { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'registro', label: 'Registro del día', icon: BookOpen, grupo: 'Ritmo' }, { id: 'semana', label: 'Semana', icon: CalendarRange, grupo: 'Ritmo' },
  { id: 'equipo', label: 'Equipo', icon: UserCheck, grupo: 'Equipo' },
];

export default function Agenda5({ onNavegar, inicial = null }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const [uid, setUid] = useState(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data?.user?.id || null)); }, []);
  const [modulo, setModulo] = useState(inicial?.vista || 'hoy');
  const [propietario, setPropietario] = useState(null);
  const [captura, setCaptura] = useState(!!inicial?.captura); // el correo de la Agenda trae #/ir/agenda?captura=1
  const [hojaItem, setHojaItem] = useState(null);
  const [minutaId, setMinutaId] = useState(inicial?.reunionId || null);
  const [formReunion, setFormReunion] = useState(null);
  const [menuPersona, setMenuPersona] = useState(false);
  const d = useAgenda5({ enabled: puedeVerPaginaGlobal(perfil, 'agenda') });
  const hoy = useMemo(() => new Date(), []);

  useEffect(() => { if (uid && !propietario) setPropietario(uid); }, [uid, propietario]);
  const yo = useMemo(() => d.personas.find((p) => p.user_id === uid) || null, [d.personas, uid]);
  // A quién puedo ver: yo + (si soy super admin) todos; si no, además los super admin (sólo lectura).
  const visibles = useMemo(() => d.personas.filter((p) => p.user_id === uid || perfil?.es_super_admin || p.es_super_admin), [d.personas, uid, perfil]);
  const persona = useMemo(() => d.personas.find((p) => p.user_id === propietario) || yo, [d.personas, propietario, yo]);
  const esMia = propietario === uid;
  const puedeEditar = (esMia || !!perfil?.es_super_admin) && puedeEditarPestanaGlobal(perfil, 'agenda');

  // Atajos: N / ⌘⇧N captura · 1-8 módulos (fuera de inputs)
  useEffect(() => {
    const h = (e) => {
      if (e.target.closest('input, textarea, [contenteditable], select')) return;
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && puedeEditar) { e.preventDefault(); setCaptura(true); }
      if (e.key === 'Escape') { setCaptura(false); setHojaItem(null); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [puedeEditar]);

  if (!puedeVerPaginaGlobal(perfil, 'agenda')) return <SinAcceso motivo="No tienes acceso a la Agenda. Pídele a Fernando que te la habilite desde Administración." />;
  if (d.cargando || !uid || !propietario) return <Cargando pantalla="agenda" minHeight={520} />;
  if (d.error) return <Panel titulo="No se pudo cargar la Agenda"><div style={{ fontSize: 12, color: theme.red }}>{String(d.error.message || d.error)}</div></Panel>;

  const conteos = { bandeja: bandejaDe(d.items, propietario, hoy).length, hoy: hoyDe(d.items, propietario, hoy, { reuniones: d.reuniones, google: d.google }).deHoy.length, pendientes: Object.values(pendientesDe(d.items, propietario, hoy)).reduce((s, l) => s + l.length, 0) };
  const comunes = { d, uid, propietario, personasPorId: d.personasPorId, puedeEditar, onAbrirItem: (it) => setHojaItem(it), onCapturar: () => setCaptura(true), onAbrirReunion: (r) => { setModulo('reuniones'); setMinutaId(r.id); } };
  const comentariosPor = comentariosPorItem(d.comentarios || []);
  const minuta = minutaId ? d.reuniones.find((r) => r.id === minutaId) : null;

  const nav = { borderRadius: 9, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, cursor: 'pointer', color: theme.text, transition: `background ${DUR.state}ms ${EASE}`, border: 0, background: 'transparent', width: '100%', textAlign: 'left', fontFamily: TYPO.fontText };
  let grupoAnt = null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '208px minmax(0, 1fr)', gap: 0, minHeight: 640, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden', fontFamily: TYPO.fontText, color: theme.text }}>
      <aside style={{ background: theme.surface2 || theme.surfaceHover || 'rgba(120,120,128,0.06)', borderRight: `1px solid ${theme.border}`, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <button type="button" onClick={() => setMenuPersona((v) => !v)} style={{ ...nav, background: theme.surface, border: `1px solid ${theme.border}`, padding: '8px 10px' }}>
            <Avatar persona={persona} size={28} /><span style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 13, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{persona?.nombre?.split(' ')[0] || 'Yo'}</b><small style={{ fontSize: 10.5, color: theme.textMuted }}>{esMia ? 'mi agenda' : puedeEditar ? 'puedes editar' : 'sólo lectura'}</small></span>{visibles.length > 1 && <ChevronDown size={14} style={{ marginLeft: 'auto', color: theme.textMuted }} />}
          </button>
          {menuPersona && visibles.length > 1 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 4, zIndex: 5, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
              {visibles.map((p) => <button key={p.user_id} type="button" onClick={() => { setPropietario(p.user_id); setMenuPersona(false); }} style={{ ...nav, background: p.user_id === propietario ? `${theme.accent}14` : 'transparent' }}><Avatar persona={p} size={22} />{p.nombre?.split(' ')[0]}{p.user_id === uid ? <span style={{ fontSize: 10.5, color: theme.textMuted }}> (yo)</span> : null}</button>)}
            </div>
          )}
        </div>
        {MODULOS.map((m) => { const Icon = m.icon; const on = modulo === m.id; const n = conteos[m.id]; const cab = m.grupo && m.grupo !== grupoAnt ? m.grupo : null; grupoAnt = m.grupo || grupoAnt; return (
          <React.Fragment key={m.id}>
            {cab && <div style={{ fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, padding: '10px 10px 3px', fontWeight: 600 }}>{cab}</div>}
            <button type="button" onClick={() => setModulo(m.id)} style={{ ...nav, background: on ? theme.accent : 'transparent', color: on ? '#fff' : theme.text, fontWeight: on ? 600 : 500 }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(120,120,128,0.12)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
              <Icon size={15} />{m.label}{n > 0 && <span style={{ marginLeft: 'auto', fontSize: 10.5, borderRadius: 999, padding: '1px 7px', background: on ? 'rgba(255,255,255,0.25)' : 'rgba(120,120,128,0.18)' }}>{n}</span>}
            </button>
          </React.Fragment>); })}
        <div style={{ marginTop: 'auto', fontSize: 10.5, color: theme.textMuted, padding: '8px 10px', lineHeight: 1.5 }}>{puedeEditar ? <><b>N</b> captura rápida</> : 'Sólo lectura'}</div>
      </aside>
      <main style={{ padding: '16px 18px', minWidth: 0, animation: `agIn ${DUR.content}ms ${EASE} both` }} key={modulo + propietario}>
        <style>{`@keyframes agIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>
        {modulo === 'hoy' && <Hoy {...comunes} />}
        {modulo === 'bandeja' && <Bandeja {...comunes} />}
        {modulo === 'pendientes' && <Pendientes {...comunes} />}
        {modulo === 'reuniones' && !minuta && <ReunionesV5 d={d} uid={uid} puedeEditar={puedeEditar} personasPorId={d.personasPorId} onAbrirMinuta={(r) => setMinutaId(typeof r === 'string' ? r : r.id)} onNuevaReunion={(extra) => setFormReunion({ ...(extra || {}) })} onAbrirItem={setHojaItem} />}
        {modulo === 'reuniones' && minuta && <Minuta reunion={minuta} items={d.items} reuniones={d.reuniones} personas={d.personas} personasPorId={d.personasPorId} porId={d.porId} hoy={hoy} uid={uid} puedeEditar={puedeEditar} comentariosPor={comentariosPor}
          onClose={() => setMinutaId(null)} onEditar={(r) => setFormReunion({ reunion: r })} onNavegar={onNavegar} onVerReuniones={() => setMinutaId(null)} google={{ ...d.googleEstado, eventos: d.google }} />}
        {modulo === 'ideas' && <Ideas {...comunes} />}
        {modulo === 'registro' && <Registro {...comunes} persona={persona} />}
        {modulo === 'semana' && <Semana {...comunes} />}
        {modulo === 'equipo' && <Equipo {...comunes} personas={d.personas} yo={yo} perfil={perfil} onVerAgenda={(p) => { setPropietario(p.user_id); setModulo('hoy'); }} />}
      </main>
      <Captura abierto={captura} onClose={() => setCaptura(false)} personas={d.personas} propietario={propietario} hoy={hoy} />
      {hojaItem && <HojaItem item={d.porId.get(hojaItem.id) || hojaItem} personas={d.personas} personasPorId={d.personasPorId} porId={d.porId} reuniones={d.reuniones} hoy={hoy} subtareas={d.subtareas} comentariosPor={comentariosPor} items={d.items} puedeEditar={puedeEditar} onClose={() => setHojaItem(null)} onAbrirMinuta={(rid) => { setHojaItem(null); setModulo('reuniones'); setMinutaId(rid); }} />}
      {formReunion && <FormReunion inicial={formReunion} personas={d.personas} google={{ ...d.googleEstado, eventos: d.google }} onClose={() => setFormReunion(null)} onCreada={(r) => { setFormReunion(null); if (r?.id) { setModulo('reuniones'); setMinutaId(r.id); } }} />}
    </div>
  );
}

// ── Ideas: tipo idea/nota, se promueven a tarea (hoy / cuando sea) o a proyecto
function Ideas({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, onCapturar }) {
  const { theme } = useTheme();
  const lista = d.items.filter((it) => esDe(it, propietario) && abierto(it) && (it.tipo === 'idea' || it.tipo === 'nota') && !it.bandeja).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const promover = (it, cuando) => actualizarItem(it.id, { tipo: 'tarea', cuando, promovido_a: null }).then(() => toast.ok('Ahora es un pendiente')).catch((e) => toast.error(e.message));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Titulo meta={`${lista.length} ideas y notas · escribe «idea: …» en la captura`} acciones={puedeEditar && <Boton primario onClick={onCapturar}>Nueva idea (N)</Boton>}>Ideas</Titulo>
      {lista.length === 0 && <div style={{ padding: '26px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Sin ideas guardadas.</div>}
      {lista.map((it) => <FilaTarea key={it.id} item={it} personasPorId={personasPorId} uid={uid} onToggle={(x, h) => completarItem(x, h)} onAbrir={onAbrirItem}
        extra={puedeEditar && <span style={{ display: 'flex', gap: 4 }}><Pill size="xs" tone="blue" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); promover(it, isoDia(new Date())); }}>→ Hoy</Pill><Pill size="xs" tone="gray" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); promover(it, null); }}>→ Pendiente</Pill></span>} />)}
    </div>
  );
}

// ── Registro del día: lo hecho con tiempo real + cierre (reflexión, energía, «mañana empiezo con»)
function Registro({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, persona }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const [dia, setDia] = useState(isoDia(hoy));
  const reg = d.registros.find((r) => r.usuario === propietario && r.fecha === dia) || {};
  const [form, setForm] = useState({ reflexion: reg.reflexion || '', energia: reg.energia || null, manana_empiezo: reg.manana_empiezo || '' });
  useEffect(() => { setForm({ reflexion: reg.reflexion || '', energia: reg.energia || null, manana_empiezo: reg.manana_empiezo || '' }); }, [dia, reg.reflexion, reg.energia, reg.manana_empiezo]);
  const h = hoyDe(d.items, propietario, new Date(`${dia}T12:00:00`), { reuniones: d.reuniones, google: d.google });
  const guardar = () => guardarRegistroDia(propietario, dia, { ...form, min_planeados: h.minTareas, min_reales: h.minReales, cerrado_at: new Date().toISOString() }).then(() => toast.ok('Día cerrado')).catch((e) => toast.error(e.message));
  const dias = Array.from({ length: 10 }, (_, i) => isoDia(sumarDias(hoy, -i)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Titulo meta={`${h.hechasHoy.length} hechas · ${fmtMin(h.minReales)} reales de ${fmtMin(h.minTareas)} planeadas · ${h.reunionesHoy.length + h.googleHoy.length} reuniones`} acciones={<select value={dia} onChange={(e) => setDia(e.target.value)} style={{ height: 30, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: '0 8px', fontFamily: TYPO.fontText }}>{dias.map((x) => <option key={x} value={x}>{x === isoDia(hoy) ? 'Hoy' : x}</option>)}</select>}>Registro del día</Titulo>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
        <div><Seccion>Lo que pasó</Seccion>
          {[...h.hechasHoy, ...h.reunionesHoy.map((r) => ({ id: `r${r.id}`, titulo: `Reunión · ${r.titulo}`, estado: 'hecha', duracion_min: r.duracion_min })), ...h.googleHoy.map((e) => ({ id: `g${e.id}`, titulo: `Evento · ${e.titulo}`, estado: 'hecha' }))].map((it) => <FilaTarea key={it.id} item={it} personasPorId={personasPorId} uid={uid} onAbrir={it.id.startsWith('r') || it.id.startsWith('g') ? undefined : onAbrirItem} compacta />)}
          {h.deHoy.length > 0 && <><Seccion meta={`${h.deHoy.length}`}>Quedó abierto</Seccion>{h.deHoy.map((it) => <FilaTarea key={it.id} item={it} personasPorId={personasPorId} uid={uid} onToggle={(x, hh) => completarItem(x, hh)} onAbrir={onAbrirItem} compacta />)}</>}
        </div>
        <Panel titulo="Cierre del día" meta={reg.cerrado_at ? `cerrado ${String(reg.cerrado_at).slice(11, 16)}` : 'sin cerrar'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11.5, color: theme.textMuted }}>¿Cómo estuvo el día? Una línea.<textarea value={form.reflexion} onChange={(e) => setForm({ ...form, reflexion: e.target.value })} disabled={!puedeEditar} rows={2} style={{ width: '100%', marginTop: 4, borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: 8, fontFamily: TYPO.fontText, fontSize: 13 }} /></label>
            <div style={{ fontSize: 11.5, color: theme.textMuted }}>Energía<div style={{ display: 'flex', gap: 4, marginTop: 4 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" disabled={!puedeEditar} onClick={() => setForm({ ...form, energia: n })} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${form.energia === n ? theme.accent : theme.border}`, background: form.energia === n ? `${theme.accent}18` : theme.surface, color: theme.text, cursor: 'pointer', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{n}</button>)}</div></div>
            <label style={{ fontSize: 11.5, color: theme.textMuted }}>Mañana empiezo con…<input value={form.manana_empiezo} onChange={(e) => setForm({ ...form, manana_empiezo: e.target.value })} disabled={!puedeEditar} style={{ width: '100%', marginTop: 4, height: 32, borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: '0 8px', fontFamily: TYPO.fontText, fontSize: 13 }} /></label>
            {puedeEditar && <Boton primario onClick={guardar}>Cerrar el día (S)</Boton>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ── Semana: lo hecho y lo abierto por día + tiempo por área
function Semana({ d, uid, propietario, personasPorId, onAbrirItem, puedeEditar }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const [nuevoObj, setNuevoObj] = useState('');
  const lunes = useMemo(() => { const x = new Date(hoy); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }, [hoy]);
  const dias = Array.from({ length: 7 }, (_, i) => isoDia(sumarDias(lunes, i)));
  const porDia = dias.map((iso) => ({ iso, h: hoyDe(d.items, propietario, new Date(`${iso}T12:00:00`), { reuniones: d.reuniones, google: d.google }) }));
  const totHechas = porDia.reduce((s, x) => s + x.h.hechasHoy.length, 0), totMin = porDia.reduce((s, x) => s + x.h.minReales, 0);
  const porArea = new Map();
  for (const x of porDia) for (const it of x.h.hechasHoy) { const a = d.areas.find((z) => z.id === it.area_id); const k = a?.nombre || 'Sin área'; porArea.set(k, (porArea.get(k) || 0) + (Number(it.min_real) || Number(it.duracion_min) || 0)); }
  const DL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const semanaIso = isoDia(lunes);
  const objetivos = (d.objetivos || []).filter((o) => o.usuario === propietario && o.semana === semanaIso).sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.created_at).localeCompare(String(b.created_at)));
  const cumplidos = objetivos.filter((o) => o.cumplido).length;
  const sinContacto = propietario === uid ? cuentasPendientes(d.cuentas || [], hoy) : [];
  const acuerdosVencidos = d.items.filter((it) => it.tipo === 'punto' && (it.estado === 'abierta' || it.estado === 'arrastrada') && it.fecha_limite && it.fecha_limite < isoDia(hoy) && (it.responsables || []).includes(propietario));
  const agregar = async () => { if (!nuevoObj.trim()) return; try { await crearObjetivoSemana(propietario, semanaIso, nuevoObj.trim()); setNuevoObj(''); } catch (e) { toast.error(e.message); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Titulo meta={`${totHechas} hechas · ${fmtMin(totMin)} registradas · ${cumplidos} de ${objetivos.length} objetivos · semana del ${lunes.getDate()}`}>Semana</Titulo>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <Panel titulo="Objetivos de la semana" meta={objetivos.length ? `${cumplidos} cumplidos` : 'tres cosas que sí o sí'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {objetivos.map((o) => <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 9, background: theme.surface2 || 'rgba(120,120,128,0.06)' }}><Palomita hecha={!!o.cumplido} onClick={() => puedeEditar && marcarObjetivoSemana(o.id, !o.cumplido).catch((e) => toast.error(e.message))} /><span style={{ flex: 1, fontSize: 13, textDecoration: o.cumplido ? 'line-through' : 'none', color: o.cumplido ? theme.textMuted : theme.text }}>{o.texto}</span>{puedeEditar && <button type="button" onClick={() => borrarObjetivoSemana(o.id).catch((e) => toast.error(e.message))} style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer' }}>✕</button>}</div>)}
            {puedeEditar && <div style={{ display: 'flex', gap: 6 }}><input value={nuevoObj} onChange={(e) => setNuevoObj(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }} placeholder="Nuevo objetivo…" style={{ flex: 1, height: 30, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: '0 8px', fontFamily: TYPO.fontText, fontSize: 12.5 }} /><Boton onClick={agregar}>Agregar</Boton></div>}
          </div>
        </Panel>
        <Panel titulo="Qué revisar" meta="acuerdos vencidos y cuentas sin contacto">
          {acuerdosVencidos.length === 0 && sinContacto.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Nada atrasado. 🎉</div>}
          {acuerdosVencidos.slice(0, 8).map((it) => <div key={it.id} onClick={() => onAbrirItem?.(it)} style={{ fontSize: 12.5, padding: '4px 0', cursor: 'pointer', color: theme.text }}><Pill size="xs" tone="red">acuerdo</Pill> {it.titulo} <span style={{ color: theme.textMuted }}>· venció {it.fecha_limite.slice(5)}</span></div>)}
          {sinContacto.slice(0, 8).map((c) => <div key={c.id} style={{ fontSize: 12.5, padding: '4px 0', color: theme.text }}><Pill size="xs" tone="orange">cuenta</Pill> {c.nombre}{c.empresa ? ` (${c.empresa})` : ''} <span style={{ color: theme.textMuted }}>· toca contactar desde {c.proximo_seguimiento}</span></div>)}
        </Panel>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6 }}>
        {porDia.map((x, i) => <div key={x.iso} style={{ border: `1px solid ${x.iso === isoDia(hoy) ? theme.accent : theme.border}`, borderRadius: 10, padding: 8, background: theme.surface, minHeight: 120 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 700, color: theme.text }}>{DL[i]} {x.iso.slice(8)}</div>
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginBottom: 4 }}>{x.h.hechasHoy.length} hechas · {x.h.deHoy.length} abiertas</div>
          {[...x.h.hechasHoy, ...x.h.deHoy].slice(0, 6).map((it) => <div key={it.id} onClick={() => onAbrirItem?.(it)} style={{ fontSize: 10.5, color: it.estado === 'hecha' ? theme.textMuted : theme.text, textDecoration: it.estado === 'hecha' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{it.titulo}</div>)}
        </div>)}
      </div>
      <Panel titulo="Tiempo por área" meta="minutos reales (o estimados) de lo hecho esta semana">
        {[...porArea.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 70px', gap: 8, alignItems: 'center', fontSize: 12, padding: '3px 0' }}><span>{k}</span><div style={{ height: 6, background: `${theme.text}12`, borderRadius: 999 }}><div style={{ height: '100%', width: `${(v / Math.max(1, totMin)) * 100}%`, background: theme.accent, borderRadius: 999 }} /></div><span style={{ textAlign: 'right', color: theme.textMuted }}>{fmtMin(v)}</span></div>)}
        {!porArea.size && <div style={{ fontSize: 12, color: theme.textMuted }}>Aún nada registrado esta semana.</div>}
      </Panel>
    </div>
  );
}

// ── Equipo: lo que trae cada persona hoy + check-in diario
function Equipo({ d, uid, personas, yo, perfil, onVerAgenda, puedeEditar }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDia(hoy);
  const [resp, setResp] = useState(() => d.checkins.find((c) => c.usuario === uid && c.fecha === hoyIso && c.tipo === 'dia')?.respuesta || '');
  const guardar = () => guardarCheckin(uid, hoyIso, 'dia', resp).then(() => toast.ok('Check-in guardado')).catch((e) => toast.error(e.message));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Titulo meta="lo que trae cada quien hoy · check-in «¿qué hiciste hoy?»">Equipo</Titulo>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {personas.map((p) => { const h = hoyDe(d.items, p.user_id, hoy, { reuniones: d.reuniones }); const ci = d.checkins.find((c) => c.usuario === p.user_id && c.fecha === hoyIso && c.tipo === 'dia'); return (
          <Panel key={p.user_id} titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar persona={p} size={22} />{p.nombre}</span>} meta={`${h.hechasHoy.length} hechas · ${h.deHoy.length} abiertas · ${h.deAyer.length} atrasadas`} acciones={<Boton size="sm" onClick={() => onVerAgenda(p)}>Ver agenda</Boton>}>
            {h.deHoy.slice(0, 5).map((it) => <div key={it.id} style={{ fontSize: 12, padding: '2px 0', color: theme.text }}>· {it.titulo}</div>)}
            {!h.deHoy.length && <div style={{ fontSize: 12, color: theme.textMuted }}>Sin pendientes para hoy.</div>}
            <div style={{ marginTop: 8, fontSize: 11.5, color: theme.textMuted, borderTop: `1px solid ${theme.border}`, paddingTop: 6 }}>{ci ? <><b style={{ color: theme.text }}>Check-in:</b> {ci.respuesta}</> : 'Sin check-in hoy.'}</div>
          </Panel>); })}
      </div>
      {yo && <Panel titulo="Mi check-in de hoy" meta="¿Qué hiciste hoy? Lo ve el equipo en esta misma página.">
        <div style={{ display: 'flex', gap: 8 }}><input value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Cerré la propuesta de Digitalife, cuadré apoyos, llamé a CVA…" style={{ flex: 1, height: 34, borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: '0 10px', fontFamily: TYPO.fontText, fontSize: 13 }} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} /><Boton primario onClick={guardar}>Guardar</Boton></div>
      </Panel>}
    </div>
  );
}
