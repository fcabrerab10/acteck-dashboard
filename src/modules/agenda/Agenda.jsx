// Agenda · pestaña única (página `agenda`, debajo de Inicio). Orquestador: Hero común + KPIs,
// Segmented de disposición (Bandeja A / Tablero C, preferencia agenda.modo por usuario) y monta
// Bandeja.jsx o Tablero.jsx. Reuniones (línea del tiempo), Minuta en vivo, hoja de ítem y
// formulario de reunión son comunes a las dos disposiciones.
// Datos: agenda/datos.js (useBandejaHoy). Lógica pura: calculo.js · etiquetas.js · textos.js.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, CalendarPlus, LayoutList, Columns3, Share2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../lib/permisos';
import { usePreferencias } from '../../lib/preferencias';
import { Hero, KpiCard, Segmented, Boton, Cargando, Panel, toast } from '../../components/kit';
import SinAcceso from '../../components/SinAcceso';
import { useBandejaHoy, crearItem, completarItem, actualizarItem } from './datos';
import { useGoogleEstado, conectarGoogle, useGoogleEventos, leerRetornoGoogle, MENSAJES_GOOGLE } from './google';
import { bandeja as calcBandeja, equipo as calcEquipo, cumplimiento, fraseHero, isoDia, sumarDias, inicioSemana, FILTROS_VACIOS, pasaFiltros, ordenarReuniones, resumenReunion, vecesArrastrado } from './calculo';
import { fechaLarga, textoBandeja } from './textos';
import { compartir } from '../../lib/whatsapp';
import { CampoEtiquetas } from './comun';
import Bandeja from './Bandeja';
import Tablero from './Tablero';
import Reuniones from './Reuniones';
import Minuta from './Minuta';
import HojaItem from './HojaItem';
import FormReunion from './FormReunion';

export const MODOS_AGENDA = [{ id: 'bandeja', label: 'Bandeja', icon: LayoutList }, { id: 'tablero', label: 'Tablero', icon: Columns3 }];

export default function Agenda({ onNavegar }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const { prefs, setPreferencia } = usePreferencias();
  const modo = prefs?.agenda?.modo === 'tablero' ? 'tablero' : 'bandeja';
  const puedeEditar = !!perfil?.es_super_admin || perfil?.tipo === 'interno' || puedeEditarPestanaGlobal(perfil, 'agenda');

  const d = useBandejaHoy({ enabled: !!perfil });
  const { items, reuniones, personas, personasPorId, porId, hoy, avisos } = d;
  const g = useGoogleEstado();

  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [hojaItem, setHojaItem] = useState(null);       // item abierto en la hoja lateral
  const [minutaId, setMinutaId] = useState(null);       // reunión abierta en la minuta en vivo
  const [formReunion, setFormReunion] = useState(null); // null | { reunion?, fecha? }
  const [rapida, setRapida] = useState('');
  const [rapidaAbierta, setRapidaAbierta] = useState(false);
  const rootRef = useRef(null);

  // Rango del calendario (Semana/Mes) → eventos de Google
  const [rango, setRango] = useState(() => ({ desde: isoDia(sumarDias(inicioSemana(new Date()), -7)), hasta: isoDia(sumarDias(inicioSemana(new Date()), 42)) }));
  const googleQ = useGoogleEventos(rango.desde, rango.hasta, g.conectado);
  const googleEventos = googleQ.data || [];

  // Retorno de Google (?google=ok|error)
  useEffect(() => {
    const r = leerRetornoGoogle();
    if (!r) return;
    if (r.ok) toast.ok('Google Calendar conectado'); else toast.error(`No se pudo conectar Google${r.motivo ? `: ${r.motivo}` : ''}`);
  }, []);

  const b = d.bandeja;
  const equipoRes = useMemo(() => calcEquipo(items, personas, hoy), [items, personas, hoy]);
  const cumpl = useMemo(() => cumplimiento(items, hoy), [items, hoy]);
  const reunionesHoy = useMemo(() => reuniones.filter((r) => r.tipo === 'reunion' && r.estado !== 'cerrada' && isoDia(new Date(r.fecha)) === isoDia(hoy)).sort((a, c) => new Date(a.fecha) - new Date(c.fecha)), [reuniones, hoy]);
  const reunionesSemana = useMemo(() => { const ini = inicioSemana(hoy), fin = sumarDias(ini, 7); return reuniones.filter((r) => r.tipo === 'reunion' && new Date(r.fecha) >= ini && new Date(r.fecha) < fin); }, [reuniones, hoy]);
  const puntosAbiertos = useMemo(() => items.filter((i) => i.tipo === 'punto' && i.estado === 'abierta'), [items]);
  const sinResponsable = useMemo(() => puntosAbiertos.filter((i) => !(i.responsables || []).length), [puntosAbiertos]);
  const avisosHoy = useMemo(() => avisos.filter((a) => a.fecha === isoDia(hoy) || a.severidad === 'alta' || a.severidad === 'critica'), [avisos, hoy]);
  const hero = useMemo(() => fraseHero({ b, avisos, reunionesHoy, equipoRes, personasPorId, reuniones, porId, hoy }), [b, avisos, reunionesHoy, equipoRes, personasPorId, reuniones, porId, hoy]);
  const reunionesOrd = useMemo(() => ordenarReuniones(reuniones, hoy), [reuniones, hoy]);
  const cerradasHoy = useMemo(() => items.filter((i) => i.estado === 'hecha' && i.completado_en && isoDia(new Date(i.completado_en)) === isoDia(hoy)).length, [items, hoy]);
  const abiertasTotal = b.abiertos.length;
  const vencPorPersona = useMemo(() => b.vencidas.flatMap((i) => i.responsables || []).reduce((m, u) => m.set(u, (m.get(u) || 0) + 1), new Map()), [b.vencidas]);

  if (!perfil) return <Cargando pantalla="agenda" />;
  if (!puedeVerPaginaGlobal(perfil, 'agenda')) return <SinAcceso motivo="No tienes acceso a Agenda. Pídele a Fernando que te la habilite desde Administración." />;
  if (d.cargando) return <Cargando pantalla={modo === 'tablero' ? 'agendaTablero' : 'agenda'} />;
  if (d.error) return <Panel titulo="No se pudo cargar la Agenda"><div style={{ fontSize: 12, color: theme.red }}>{String(d.error.message || d.error)}</div></Panel>;

  const filtrar = (arr) => arr.filter((it) => pasaFiltros(it, filtros, hoy, personasPorId));
  const toggle = async (item, hecha) => { try { await completarItem(item, hecha); if (hecha) toast.ok('Hecho'); } catch (e) { toast.error(e.message); } };
  const abrirItem = (item) => setHojaItem(item);
  const crearRapida = async () => {
    const t = rapida.trim(); if (!t) return;
    try { await crearItem({ texto: t, tipo: 'tarea', fecha_limite: isoDia(hoy) }, personas); setRapida(''); setRapidaAbierta(false); toast.ok('Tarea creada para hoy'); }
    catch (e) { toast.error(e.message); }
  };
  const compartirHoy = async () => { const txt = textoBandeja(b, { personasPorId, hoy, quien: (perfil.nombre || '').split(' ')[0] }); await compartir(txt, { titulo: 'Agenda de hoy' }); };
  const onConectar = async () => { try { await conectarGoogle(); } catch (e) { toast.error(MENSAJES_GOOGLE[e.codigo] || e.message, { ms: 5000 }); } };
  const ir = (ck, pagina, extra) => onNavegar?.(ck, pagina, extra);

  const comunes = {
    d, items, reuniones, reunionesOrd, personas, personasPorId, porId, hoy, avisos, puedeEditar, filtros, setFiltros, filtrar, toggle, abrirItem,
    abrirMinuta: (r) => setMinutaId(r.id), nuevaReunion: (extra) => setFormReunion({ ...(extra || {}) }), editarReunion: (r) => setFormReunion({ reunion: r }),
    google: { ...g, eventos: googleEventos, cargando: googleQ.isLoading, error: googleQ.error, onConectar }, rango, setRango, onNavegar: ir, equipoRes,
  };
  const minuta = minutaId ? reuniones.find((r) => r.id === minutaId) : null;
  const ghost = { background: 'rgba(255,255,255,0.10)', border: `1px solid rgba(255,255,255,0.18)`, color: theme.textOnInverse || '#F5F5F7' };

  return (
    <div ref={rootRef} data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10.5, color: theme.textMuted }}>Disposición · se guarda en tu perfil</span>
        <Segmented value={modo} onChange={(v) => setPreferencia('agenda.modo', v)} options={MODOS_AGENDA.map((m) => ({ id: m.id, label: m.label }))} />
      </div>

      <Hero eyebrow={`Agenda · ${modo === 'tablero' ? 'tablero · ' : ''}${fechaLarga(hoy)}`} titulo={modo === 'tablero' ? tituloTablero(abiertasTotal, b, avisosHoy) : hero.titulo} sub={hero.sub || 'Tareas, puntos de reunión y avisos del dashboard en un solo lugar.'} dot={b.vencidas.length > 0}
        stats={modo === 'tablero'
          ? [{ k: 'Abiertas', v: abiertasTotal, sub: `${b.vencidas.length} vencidas · ${avisosHoy.length} del sistema` }, { k: 'Cerradas hoy', v: cerradasHoy, sub: cumpl != null ? `${cumpl} % a tiempo · 30 d` : 'sin historial' }]
          : [{ k: 'Hoy', v: hero.nHoy, sub: `${b.vencidas.length} vencida${b.vencidas.length === 1 ? '' : 's'}` }, { k: 'Puntos abiertos', v: puntosAbiertos.length, sub: `de ${new Set(puntosAbiertos.map((p) => p.reunion_id)).size} reuniones` }, { k: 'Cumplimiento', v: cumpl != null ? `${cumpl} %` : '—', sub: 'tareas a tiempo · 30 d' }]}>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {puedeEditar && !rapidaAbierta && <Boton icon={Plus} onClick={() => setRapidaAbierta(true)} style={ghost}>Tarea</Boton>}
          {puedeEditar && rapidaAbierta && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 320, flex: 1, maxWidth: 520 }}>
              <CampoEtiquetas value={rapida} onChange={setRapida} personas={personas} placeholder="Nueva tarea para hoy… #cliente @persona /categoría" autoFocus onEnter={crearRapida} onEscape={() => { setRapidaAbierta(false); setRapida(''); }} />
              <Boton primario onClick={crearRapida}>Crear</Boton>
            </div>
          )}
          {puedeEditar && <Boton icon={CalendarPlus} onClick={() => setFormReunion({})} style={ghost}>Reunión</Boton>}
          {puedeEditar && <Boton icon={CalendarPlus} onClick={() => setFormReunion({ tipo: 'evento' })} style={ghost}>Evento</Boton>}
          <Boton icon={Share2} onClick={compartirHoy} style={ghost} title="Compartir mi día por WhatsApp">Compartir hoy</Boton>
          {g.cargando ? null : g.conectado
            ? <Boton style={ghost} title={`Google Calendar · ${g.email || ''}${g.ultimaSync ? ` · sync ${new Date(g.ultimaSync).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}`} onClick={() => ir(null, 'agenda')}>Google conectado ✓</Boton>
            : <Boton style={ghost} onClick={onConectar} title="Conecta tu Google Calendar (cada quien el suyo)">Conectar Google</Boton>}
        </div>
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Vencidas" badge={b.vencidas.length ? { l: `${b.vencidas.length}`, tone: 'red' } : { l: 'al día', tone: 'green' }} big={b.vencidas.length} bigSmall="tareas y puntos"
          sub={[...vencPorPersona.entries()].map(([u, n]) => `@${personasPorId.get(u)?.handle || '…'} ${n}`).join(' · ') || 'nada vencido'} onClick={() => setFiltros({ ...FILTROS_VACIOS(), vencidas: !filtros.vencidas })} />
        <KpiCard eyebrow="Del sistema" badge={{ l: `${avisosHoy.length}`, tone: avisosHoy.some((a) => a.severidad === 'critica') ? 'red' : avisosHoy.length ? 'orange' : 'gray' }} big={avisosHoy.length} bigSmall="avisos"
          sub={avisosHoy.slice(0, 3).map((a) => a.titulo.slice(0, 28)).join(' · ') || 'alertas, arribos, cargas, tracking, cierre de mes'} />
        <KpiCard eyebrow="Reuniones" badge={{ l: 'semana', tone: 'blue' }} big={reunionesSemana.length} bigSmall={reunionesHoy.length ? `${reunionesHoy.length} hoy` : ''}
          sub={reunionesSemana.slice(0, 3).map((r) => `${(r.cliente_key || 'interna')} ${new Date(r.fecha).toLocaleDateString('es-MX', { weekday: 'short' })} ${new Date(r.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`).join(' · ') || 'sin reuniones esta semana'} onClick={() => document.getElementById('agenda-reuniones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <KpiCard eyebrow="Sin responsable" badge={{ l: 'asignar', tone: sinResponsable.length ? 'orange' : 'gray' }} big={sinResponsable.length} bigSmall="puntos"
          sub={sinResponsable[0] ? `de la reunión ${reuniones.find((r) => r.id === sinResponsable[0].reunion_id)?.titulo || ''}` : 'todos los puntos tienen dueño'} onClick={() => setFiltros({ ...FILTROS_VACIOS(), personas: new Set(['__sin__']) })} />
      </div>

      {modo === 'tablero' ? <Tablero {...comunes} /> : <Bandeja {...comunes} />}

      <Reuniones {...comunes} id="agenda-reuniones" />

      {hojaItem && <HojaItem item={porId.get(hojaItem.id) || hojaItem} personas={personas} personasPorId={personasPorId} porId={porId} reuniones={reuniones} hoy={hoy} puedeEditar={puedeEditar} onClose={() => setHojaItem(null)} onAbrirMinuta={(rid) => { setHojaItem(null); setMinutaId(rid); }} />}
      {minuta && <Minuta reunion={minuta} items={items} personas={personas} personasPorId={personasPorId} porId={porId} reuniones={reuniones} hoy={hoy} puedeEditar={puedeEditar} onClose={() => setMinutaId(null)} onEditar={() => setFormReunion({ reunion: minuta })} google={comunes.google} />}
      {formReunion && <FormReunion inicial={formReunion} personas={personas} google={comunes.google} onClose={() => setFormReunion(null)} onCreada={(r) => { setFormReunion(null); if (r?.tipo === 'reunion') setMinutaId(r.id); }} />}
    </div>
  );
}

function tituloTablero(total, b, avisos) {
  const porCliente = b.abiertos.reduce((m, i) => m.set(i.cliente_key || 'interno', (m.get(i.cliente_key || 'interno') || 0) + 1), new Map());
  const top = [...porCliente.entries()].sort((a, c) => c[1] - a[1])[0];
  const n = total + avisos.length;
  return top ? `Lo abierto, agrupado por cliente: ${top[0] === 'interno' ? 'Interno' : top[0][0].toUpperCase() + top[0].slice(1)} concentra ${top[1]} de ${n} tarjetas` : 'Nada abierto: tablero limpio';
}
