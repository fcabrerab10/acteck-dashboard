// Agenda V5 · celular (2026-10-04 · rehecha 3.70.0): tira de semana estilo iOS Calendar, chips Día · Bandeja · Pendientes · Reuniones · Más,
// Mismo motor que la web (modules/agenda5: calculo · datos · interpretar). Reuniones y la hoja de edición de un ítem se
// comparten con la minuta (Reuniones · Minuta · Captura · comun, en esta misma carpeta desde 2026-10-05; antes en la V4 móvil) a través
// del mismo AgendaCtx (comun.jsx). Gestos: → hecha · ← mañana / 7 días.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarCheck, Check, CalendarClock, Sparkles, Play, Pause } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { Cargando, Pill } from '../../../components/kit';
import { useAgenda5, completarItem, crearDesdeCaptura, moverA, posponer, triage, descartar, cronometro, guardarRegistroDia, guardarCheckin } from '../../../modules/agenda5/datos';
import { hoyDe, bandejaDe, pendientesDe, conteosMes, isoDia, sumarDias, fmtMin, fmtHora, fraseHoy, esDe, abierto } from '../../../modules/agenda5/calculo';
import { interpretarCaptura } from '../../../modules/agenda5/interpretar';
import { MiniMes, Ahora } from '../../../modules/agenda5/Hoy';
import { siguienteDe } from '../../../modules/agenda5/calculo';
import { Compass } from 'lucide-react';
import { useGoogleEstado } from '../../../modules/agenda5/base/google';
import { fechaLarga } from '../../../modules/agenda5/base/textos';
import { nombreClienteAgenda } from '../../../modules/agenda5/base/etiquetas';
import { useNav } from '../../nav';
import { TituloGrande, Vacio, ListaAgrupada, Fila, FilaDeslizable, HojaM, BotonGrande, toast } from '../../piezas';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { bloquesDia } from '../../../modules/agenda5/calculo';
import { useBottomOffset, AgendaCtx, PalomitaM } from './comun';
import CapturaHoja from './Captura';
import Reuniones from './Reuniones';
import DiaM from './DiaM';
import Minuta from './Minuta';
// V6 «que te lleva» (2026-10-08): Hoy único, captura libre, Lo que mandé, Por cliente, Organiza tu día.
import { usePreferencias } from '../../../lib/preferencias';
import { horasDe } from '../../../modules/agenda5/dia/datos';
import HoyM6 from '../agenda6/HoyM6';
import MandeM from '../agenda6/MandeM';
import PorClienteM from '../agenda6/PorClienteM';
import CapturaM6 from '../agenda6/CapturaM6';
import OrganizaDiaM from '../agenda6/OrganizaDiaM';

const VISTAS = [{ id: 'hoy6', label: 'Hoy' }, { id: 'pendientes', label: 'Pendientes' }, { id: 'mande', label: 'Lo que mandé' }, { id: 'clientes', label: 'Por cliente' }, { id: 'reuniones', label: 'Reuniones' }, { id: 'mas', label: 'Más' }];
const VISTA_INICIAL = { dia: 'hoy6', hoy: 'hoy6', horario: 'hoy' };
const OTRAS = [{ id: 'hoy', label: 'Horario del día' }, { id: 'dia', label: 'Armar · Guía · Cierre' }, { id: 'bandeja', label: 'Bandeja' }];
const DIAS_1 = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const lunesDe = (iso) => { const d = new Date(`${iso}T12:00:00`); return isoDia(sumarDias(d, -((d.getDay() + 6) % 7))); };
const TONO = { fecha: ['rgba(10,132,255,0.14)', '#0A84FF'], hora: ['rgba(10,132,255,0.14)', '#0A84FF'], duracion: ['rgba(10,132,255,0.14)', '#0A84FF'], cliente: ['rgba(255,159,10,0.16)', '#C77700'], persona: ['rgba(191,90,242,0.16)', '#9D4EDD'], prioridad: ['rgba(255,69,58,0.14)', '#FF453A'], tipo: ['rgba(48,209,88,0.16)', '#1E9E46'], categoria: ['rgba(120,120,128,0.16)', '#6E6E73'] };

export default function AgendaM({ inicial, raiz = false }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav.perfil;
  const uid = perfil?.user_id || null;
  const puedeVer = puedeVerPaginaGlobal(perfil, 'agenda');
  const d = useAgenda5({ enabled: !!perfil && puedeVer });
  const google = useGoogleEstado();
  const [vista, setVista] = useState(VISTA_INICIAL[inicial?.vista] || inicial?.vista || 'hoy6');
  const [capInicial, setCapInicial] = useState('');
  const [organiza, setOrganiza] = useState(null);
  const prefs = usePreferencias();
  const [propietario, setPropietario] = useState(null);
  const [cap, setCap] = useState(null);       // hoja V4 (editar ítem)
  const [rapida, setRapida] = useState(false); // captura rápida V5
  const [guia, setGuia] = useState(false);     // modo «Guíame»: uno por uno
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDia(hoy);
  const [dia, setDia] = useState(hoyIso);           // día elegido en la tira de semana
  const [verMes, setVerMes] = useState(false);
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const bottom = useBottomOffset();
  useEffect(() => { if (uid && !propietario) setPropietario(uid); }, [uid, propietario]);
  const visibles = useMemo(() => d.personas.filter((p) => p.user_id === uid || perfil?.es_super_admin || p.es_super_admin), [d.personas, uid, perfil]);
  const esMia = propietario === uid;
  const puedeEditar = (esMia || !!perfil?.es_super_admin) && puedeEditarPestanaGlobal(perfil, 'agenda');
  const personaVista = useMemo(() => d.personas.find((p) => p.user_id === propietario) || null, [d.personas, propietario]);
  const horas = useMemo(() => ({ ...horasDe(null), ...((esMia ? prefs?.agenda?.horas || perfil?.preferencias?.agenda?.horas : personaVista?.preferencias?.agenda?.horas) || {}) }), [esMia, prefs, perfil, personaVista]);

  const abrirMinuta = (r) => { const id = typeof r === 'string' ? r : r?.id; if (!id) return; nav.push(<Minuta reunionId={id} />, `minuta-${id}`); };
  const abrirItem = (item) => setCap({ item });
  const toggle = async (item, hecha) => { try { await completarItem(item, hecha); if (hecha) toast.ok('Hecha', { accion: 'Deshacer', onAccion: () => completarItem(item, false).catch((e) => toast.error(e.message)) }); } catch (e) { toast.error(e.message); } };
  const posponerM = async (item, dias = 1) => { try { await moverA(item, isoDia(sumarDias(hoy, dias))); toast.ok(dias === 1 ? 'Para mañana' : `Pospuesto ${dias} días`); } catch (e) { toast.error(e.message); } };
  const ctx = useMemo(() => ({ ...d, uid, perfil, puedeEditar, google, abrirItem, abrirMinuta, capturar: () => { setCapInicial(''); setRapida(true); }, toggle, posponer: posponerM, navegarAviso: () => {}, setVista }), [d, uid, perfil, puedeEditar, google]); // eslint-disable-line react-hooks/exhaustive-deps

  const conteos = useMemo(() => conteosMes(d.items || [], propietario, { reuniones: d.reuniones || [], google: d.google || [] }), [d.items, d.reuniones, d.google, propietario]);
  const bandejaN = useMemo(() => (d.items ? bandejaDe(d.items, propietario, hoy).length : 0), [d.items, propietario, hoy]);
  const pendN = useMemo(() => { if (!d.items) return 0; const g = pendientesDe(d.items, propietario, hoy); return g.vencidos.length + g.hoy.length + g.proximos.length; }, [d.items, propietario, hoy]);
  const semana = useMemo(() => { const l = lunesDe(dia); return Array.from({ length: 7 }, (_, i) => isoDia(sumarDias(new Date(`${l}T12:00:00`), i))); }, [dia]);
  const moverSemana = (n) => { setDia(isoDia(sumarDias(new Date(`${dia}T12:00:00`), 7 * n))); };
  const irHoy = () => { setDia(hoyIso); setVista('hoy'); };
  const fechaSel = new Date(`${dia}T12:00:00`);
  const chip = (on) => ({ border: 0, borderRadius: 999, padding: '7px 13px', fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', background: on ? theme.text : theme.surface, color: on ? theme.bg : theme.text, boxShadow: on ? 'none' : `inset 0 0 0 1px ${theme.border}`, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background 220ms cubic-bezier(.32,.72,0,1), color 220ms' });
  const cabecera = (
    <>
      <TituloGrande titulo={vista === 'hoy' ? (dia === hoyIso ? 'Horario' : `${fechaSel.getDate()} ${MESES_C[fechaSel.getMonth()]}`) : (VISTAS.find((v) => v.id === vista) || OTRAS.find((v) => v.id === vista))?.label}
        sub={vista === 'hoy' ? fechaLarga(fechaSel).replace(/^./, (c) => c.toUpperCase()) : fechaLarga(hoy).replace(/^./, (c) => c.toUpperCase())}
        derecha={<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {vista === 'hoy' && dia !== hoyIso && <button type="button" onClick={irHoy} style={{ ...chip(false), padding: '6px 11px' }}>Hoy</button>}
          {visibles.length > 1 && visibles.map((p) => <button key={p.user_id} type="button" aria-label={p.nombre} onClick={() => setPropietario(p.user_id)} style={{ width: 32, height: 32, borderRadius: 16, padding: 0, border: `2px solid ${p.user_id === propietario ? theme.accent : 'transparent'}`, background: 'linear-gradient(135deg,#0A84FF,#5E5CE6)', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: TYPO.fontDisplay, opacity: p.user_id === propietario ? 1 : 0.55 }}>{String(p.nombre || '?').split(' ').map((x) => x[0]).slice(0, 2).join('')}</button>)}
        </div>} />
      {/* Tira de la semana (iOS Calendar): L M M J V S D con puntos de carga; ‹ › cambian de semana. */}
      {vista === 'hoy' && (
        <div style={{ padding: '0 10px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button type="button" onClick={() => moverSemana(-1)} aria-label="Semana anterior" style={{ border: 0, background: 'transparent', color: theme.textMuted, width: 28, height: 44, display: 'grid', placeItems: 'center' }}><ChevronLeft size={18} /></button>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {semana.map((iso, i) => { const on = iso === dia; const esH = iso === hoyIso; const c = conteos.get(iso); const n = c ? c.tareas + c.reuniones + c.google : 0; return (
                <button key={iso} type="button" onClick={() => setDia(iso)} aria-label={iso} aria-current={on ? 'date' : undefined} style={{ border: 0, background: 'transparent', padding: '2px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: esH ? theme.accent : theme.textMuted, fontFamily: TYPO.fontDisplay }}>{DIAS_1[i]}</span>
                  <span style={{ width: 34, height: 34, borderRadius: 17, display: 'grid', placeItems: 'center', fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: on || esH ? 700 : 500, fontVariantNumeric: 'tabular-nums', background: on ? (esH ? theme.accent : theme.text) : 'transparent', color: on ? (esH ? '#fff' : theme.bg) : esH ? theme.accent : theme.text, transition: 'background 220ms cubic-bezier(.32,.72,0,1), color 220ms' }}>{Number(iso.slice(8))}</span>
                  <span style={{ display: 'flex', gap: 2, height: 4 }}>{Array.from({ length: Math.min(3, n) }, (_, k) => <i key={k} style={{ width: 4, height: 4, borderRadius: 2, background: on ? theme.text : theme.textMuted, opacity: on ? 0.9 : 0.6 }} />)}</span>
                </button>); })}
            </div>
            <button type="button" onClick={() => moverSemana(1)} aria-label="Semana siguiente" style={{ border: 0, background: 'transparent', color: theme.textMuted, width: 28, height: 44, display: 'grid', placeItems: 'center' }}><ChevronRight size={18} /></button>
          </div>
          {verMes && <div style={{ margin: '4px 6px 6px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '10px 12px' }}><MiniMes mes={mes} setMes={setMes} dia={dia} onDia={(iso) => { setDia(iso); setVerMes(false); }} conteos={conteos} hoyIso={hoyIso} /></div>}
        </div>
      )}
      {/* Chips: Día · Bandeja n · Pendientes n · Reuniones · Más (+ Mes en Día) */}
      <div style={{ display: 'flex', gap: 6, padding: '2px 16px 10px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {VISTAS.map((v) => { const n = v.id === 'pendientes' ? pendN : 0; return (
          <button key={v.id} type="button" onClick={() => setVista(v.id)} aria-pressed={vista === v.id} style={chip(vista === v.id)}>
            {v.label}{n > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: vista === v.id ? `${theme.bg}33` : `${theme.accent}1f`, color: vista === v.id ? theme.bg : theme.accent, fontVariantNumeric: 'tabular-nums' }}>{n}</span>}
          </button>); })}
        {vista === 'hoy' && <button type="button" onClick={() => setVerMes((v) => !v)} aria-pressed={verMes} style={chip(verMes)}>Mes</button>}
      </div>
    </>
  );
  if (!perfil || !puedeVer) return (<>{cabecera}<Vacio icon={CalendarCheck} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la Agenda." /></>);
  if (d.error) return (<>{cabecera}<Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar la Agenda" sub={String(d.error.message || d.error)} /></>);
  if (d.cargando || !propietario) return (<>{cabecera}<div style={{ padding: '0 16px' }}><Cargando pantalla="movilAgenda" /></div></>);
  const com = { d, uid, propietario, puedeEditar, esMia, hoy, abrirItem, toggle, posponerM, personasPorId: d.personasPorId, nav, dia, abrirMinuta, abrirGuia: () => setGuia(true) };
  return (
    <AgendaCtx.Provider value={ctx}>
      {cabecera}
      {vista === 'hoy6' && <HoyM6 {...com} horas={horas} persona={personaVista} onOrganizar={(estado) => setOrganiza({ estado })} onIrA={setVista} />}
      {vista === 'mande' && <MandeM {...com} />}
      {vista === 'clientes' && <PorClienteM {...com} onNuevo={(t) => { setCapInicial(t); setRapida(true); }} />}
      {vista === 'dia' && <DiaM {...com} perfil={perfil} />}
      {vista === 'hoy' && <HoyM {...com} />}
      {vista === 'bandeja' && <BandejaM {...com} />}
      {vista === 'pendientes' && <PendientesM {...com} />}
      {vista === 'reuniones' && <Reuniones />}
      {vista === 'mas' && <><ListaAgrupada titulo="Otras vistas" style={{ marginTop: 4 }}>{OTRAS.map((o) => <Fila key={o.id} titulo={o.label} sub={o.id === 'bandeja' && bandejaN ? `${bandejaN} sin fecha` : undefined} onClick={() => setVista(o.id)} />)}</ListaAgrupada><MasM {...com} /></>}
      {/* Captura rápida como barra fija (Recordatorios de iOS): encima de la barra de grupos, se mueve con ella. */}
      {puedeEditar && vista !== 'reuniones' && (
        <button type="button" onClick={() => { setCapInicial(''); setRapida(true); }} aria-label="Nuevo" style={{ position: 'fixed', left: 16, right: 16, bottom, zIndex: 40, height: 48, borderRadius: 14, border: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: theme.accent, color: '#fff', fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, boxShadow: `0 8px 24px ${theme.accent}55`, cursor: 'pointer', transition: 'bottom 340ms cubic-bezier(.32,.72,0,1)' }}>
          <Plus size={20} strokeWidth={2.6} />Nuevo<span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, opacity: 0.8 }}>escribe como hablas</span>
        </button>
      )}
      <CapturaM6 abierto={rapida} onClose={() => setRapida(false)} personas={d.personas} propietario={propietario} uid={uid} hoy={hoy} inicial={capInicial} />
      {organiza && <OrganizaDiaM abierto onClose={() => setOrganiza(null)} d={d} uid={uid} propietario={propietario} hoy={hoy} hoyIso={hoyIso} horas={horas} estado={organiza.estado} puedeEditar={puedeEditar} nombre={personaVista?.nombre?.split(' ')[0]} onAbrirItem={abrirItem} />}
      <GuiameM abierto={guia} onClose={() => setGuia(false)} d={d} propietario={propietario} hoy={hoy} puedeEditar={puedeEditar} abrirItem={abrirItem} />
      <CapturaHoja cfg={cap} personas={d.personas} reuniones={d.reuniones} hoy={hoy} subtareas={d.subtareas} puedeEditar={puedeEditar} onClose={() => setCap(null)} onAbrirMinuta={abrirMinuta} />
    </AgendaCtx.Provider>
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

export function HoyM({ d, uid, propietario, puedeEditar, hoy, abrirItem, toggle, posponerM, personasPorId, dia, abrirMinuta, abrirGuia }) {
  const { theme } = useTheme();
  const hoyIso = isoDia(hoy);
  const fecha = useMemo(() => new Date(`${dia}T12:00:00`), [dia]);
  const esHoy = dia === hoyIso;
  const h = useMemo(() => hoyDe(d.items, propietario, fecha, { reuniones: d.reuniones, google: d.google, ahora: esHoy ? new Date() : fecha }), [d.items, d.reuniones, d.google, propietario, fecha, esHoy]);
  const bloques = useMemo(() => bloquesDia(h, { hoyIso: dia }), [h, dia]);
  const sinHora = h.deHoy.filter((it) => !it.hora);
  const crono = (it, acc) => cronometro(it, acc).catch((e) => toast.error(e.message));
  const ahoraMin = esHoy ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const colorDe = (b) => b.tipo === 'reunion' ? theme.accent : b.tipo === 'google' ? (theme.purple || '#5E5CE6') : b.tipo === 'hecha' ? theme.green : theme.orange;
  const abrirBloque = (b) => { if (b.tipo === 'tarea' || b.tipo === 'hecha') abrirItem(b.ref); else if (b.tipo === 'reunion') abrirMinuta(b.ref); else if (b.ref?.url) window.open(b.ref.url, '_blank', 'noopener'); };
  return (
    <>
      {esHoy && (
        <div style={{ padding: '0 16px 10px' }}>
          <Ahora h={h} hoyIso={hoyIso} puedeEditar={puedeEditar} compacta onAbrirItem={abrirItem} onAbrirReunion={abrirMinuta} onToggle={toggle} onCrono={crono} />
          {puedeEditar && h.deHoy.length + h.deAyer.length > 0 && abrirGuia && (
            <button type="button" onClick={abrirGuia} style={{ marginTop: 8, width: '100%', height: 42, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
              <Compass size={17} style={{ color: theme.accent }} />Guíame · {h.deHoy.length + h.deAyer.length} por hacer
            </button>
          )}
        </div>
      )}
      <div style={{ padding: '0 20px 8px', fontSize: 13, color: theme.textMuted, lineHeight: 1.4 }}>{esHoy ? fraseHoy(h) : `${h.deHoy.length} pendiente${h.deHoy.length === 1 ? '' : 's'} · ${h.reunionesHoy.length + h.googleHoy.length} reunión${h.reunionesHoy.length + h.googleHoy.length === 1 ? '' : 'es'}`}</div>

      {/* Horario del día: reuniones, Google y tareas con hora, como la vista de lista de Calendario. */}
      <ListaAgrupada titulo="Horario" meta={bloques.length ? `${bloques.length}` : undefined} style={{ marginTop: 4 }}>
        {bloques.length === 0 && <Vacio icon={null} titulo="Sin horarios" sub="Las tareas con hora y las reuniones salen aquí." style={{ padding: '16px' }} />}
        {bloques.map((b) => { const pasado = esHoy && b.fin < ahoraMin; const activo = esHoy && b.ini <= ahoraMin && ahoraMin < b.fin; const c = colorDe(b); return (
          <button key={b.id} type="button" onClick={() => abrirBloque(b)} style={{ width: '100%', border: 0, background: activo ? `${theme.accent}10` : 'transparent', borderTop: `1px solid ${theme.border}`, padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'stretch', textAlign: 'left', cursor: 'pointer', opacity: pasado && b.tipo !== 'hecha' ? 0.6 : 1 }}>
            <div style={{ width: 44, flexShrink: 0, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', color: activo ? theme.accent : theme.textMuted, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{hhmm(b.ini)}<div style={{ fontWeight: 400, fontSize: 11, opacity: 0.8 }}>{hhmm(b.fin)}</div></div>
            <div style={{ width: 3, borderRadius: 2, background: c, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, color: theme.text, fontWeight: 500, textDecoration: b.tipo === 'hecha' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.titulo}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{b.tipo === 'reunion' ? `Reunión${b.ref?.cliente_key && b.ref.cliente_key !== 'interno' ? ` · ${nombreClienteAgenda(b.ref.cliente_key)}` : ''}` : b.tipo === 'google' ? 'Google Calendar' : b.tipo === 'hecha' ? 'Hecha' : `${fmtMin(b.fin - b.ini)}${b.ref?.cliente_key && b.ref.cliente_key !== 'interno' ? ` · ${nombreClienteAgenda(b.ref.cliente_key)}` : ''}`}</div>
            </div>
            {(b.tipo === 'tarea') && puedeEditar && <div onClick={(e) => { e.stopPropagation(); toggle(b.ref, true); }} style={{ alignSelf: 'center' }}><PalomitaM hecha={false} onClick={() => {}} /></div>}
          </button>); })}
      </ListaAgrupada>

      {h.deAyer.length > 0 && esHoy && <ListaAgrupada titulo="De días anteriores" meta={`${h.deAyer.length}`} style={{ marginTop: 14 }} pie="Desliza a la izquierda: hoy o 7 días.">{h.deAyer.map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} onManana={(x) => moverA(x, hoyIso).catch((e) => toast.error(e.message))} onSemana={(x) => posponer(x, 7).catch((e) => toast.error(e.message))} mostrarFecha />)}</ListaAgrupada>}
      <ListaAgrupada titulo={esHoy ? 'Pendientes de hoy' : 'Pendientes del día'} meta={h.minTareas ? fmtMin(h.minTareas) : (sinHora.length ? `${sinHora.length}` : undefined)} style={{ marginTop: 14 }} pie={sinHora.length ? 'Desliza a la izquierda para mover a mañana o 7 días.' : undefined}>
        {sinHora.length === 0 && <Vacio icon={null} titulo={h.deHoy.length ? 'Todo tiene hora' : 'Nada planeado'} sub={h.deHoy.length ? 'Lo ves arriba, en el horario.' : 'Toca «Captura rápida» o jala algo de la Bandeja.'} style={{ padding: '16px' }} />}
        {sinHora.map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} onManana={(x) => posponerM(x, 1)} onSemana={(x) => posponer(x, 7).catch((e) => toast.error(e.message))} onCrono={puedeEditar ? crono : null} />)}
      </ListaAgrupada>
      {h.hechasHoy.length > 0 && <ListaAgrupada titulo="Hechas" meta={h.minReales ? fmtMin(h.minReales) : `${h.hechasHoy.length}`} style={{ marginTop: 14 }}>{h.hechasHoy.map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} />)}</ListaAgrupada>}
      <div style={{ height: 110 }} />
    </>
  );
}

/** Modo «Guíame» (3.71.0): la Agenda lleva de la mano, un pendiente a la vez, en el orden de ataque de siguienteDe. */
export function GuiameM({ abierto, onClose, d, propietario, hoy, puedeEditar, abrirItem }) {
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
  const btn = (primario) => ({ flex: 1, height: 48, borderRadius: 12, border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? theme.accent : theme.surface, color: primario ? '#fff' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' });
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Guíame" sub={it ? `${pos} de ${total} · ${s.vencidos ? `${s.vencidos} vencidos primero` : 'en orden de ataque'}` : 'Día completo'} alto="62vh">
      <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box' }}>
        {!it ? (
          <Vacio icon={Check} color={theme.green} titulo="No queda nada por hacer hoy" sub={h.hechasHoy.length ? `Cerraste ${h.hechasHoy.length}. Cierra el día en «Más».` : 'Captura algo o jala de la Bandeja.'} style={{ padding: '26px 8px' }} />
        ) : (
          <>
            {s.actual && s.actual.tipo !== 'tarea' && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Ahora estás en <b style={{ color: theme.text }}>{s.actual.titulo}</b> hasta las {hhmm(s.actual.fin)}. Lo siguiente:</div>}
            <div onClick={() => abrirItem(it)} style={{ background: theme.surfaceInverse || theme.text, color: theme.textOnInverse || theme.bg, borderRadius: 16, padding: '18px 18px 16px', cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              {h.deAyer.some((x) => x.id === it.id) && <span style={{ fontSize: 11, fontWeight: 700, color: '#FF453A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Vencido</span>}
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{it.titulo}</div>
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
                  <button type="button" style={{ ...btn(false), height: 40, fontSize: 13.5 }} onClick={() => setSaltados((x) => [...x, it.id])}>Saltar</button>
                  <button type="button" style={{ ...btn(false), height: 40, fontSize: 13.5 }} onClick={() => run(() => moverA(it, isoDia(sumarDias(hoy, 1))), 'Para mañana')}>Mañana</button>
                  <button type="button" style={{ ...btn(false), height: 40, fontSize: 13.5 }} onClick={() => run(() => posponer(it, 7), '7 días')}>7 días</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </HojaM>
  );
}

export function BandejaM({ d, uid, propietario, puedeEditar, hoy, abrirItem, personasPorId }) {
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
      <div style={{ height: 110 }} />
    </>
  );
}

export function PendientesM({ d, uid, propietario, puedeEditar, hoy, abrirItem, toggle, posponerM, personasPorId }) {
  const g = useMemo(() => pendientesDe(d.items, propietario, hoy), [d.items, propietario, hoy]);
  const H = [['vencidos', 'Vencidos'], ['hoy', 'Hoy'], ['proximos', 'Próximos 7 días'], ['despues', 'Más adelante'], ['cuandoSea', 'Cuando sea'], ['algunDia', 'Algún día']];
  const total = Object.values(g).reduce((s, l) => s + l.length, 0);
  return (
    <>
      {total === 0 && <Vacio icon={null} titulo="Sin pendientes abiertos" style={{ padding: '26px 16px' }} />}
      {H.map(([k, label]) => g[k].length > 0 && <ListaAgrupada key={k} titulo={label} meta={`${g[k].length}`} style={{ marginTop: 14 }}>{g[k].map((it) => <FilaItemM key={it.id} it={it} personasPorId={personasPorId} uid={uid} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} onManana={(x) => posponerM(x, 1)} onSemana={(x) => posponer(x, 7)} mostrarFecha={k !== 'hoy'} />)}</ListaAgrupada>)}
      <div style={{ height: 110 }} />
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
      <div style={{ height: 110 }} />
    </>
  );
}
