// Agenda V4 (2026-09-21) · pestaña `agenda`. Rediseño pedido por Fernando: «la Agenda como está no me
// funciona» — las alertas de SKUs inundaban la bandeja y tapaban los pendientes reales.
//
// Disposición aprobada (propuesta A "Por horizonte" + sus ajustes):
//   1. Calendario mensual ARRIBA, de ancho completo (Calendario.jsx): Google, reuniones, viajes,
//      pendientes con fecha, arribos y cargas. Clic en un día → Pendiente / Reunión / Viaje.
//   2. Debajo, Segmented: Pendientes · Reuniones · Cuentas · Archivados.
//        Pendientes  captura en una línea + bloques Vencidos · Hoy · Esta semana · Más adelante · Sin fecha
//        Reuniones   la línea del tiempo de siempre + minuta en vivo (Reuniones.jsx / Minuta.jsx)
//        Cuentas     cuentas que Fernando sigue como gerente de ventas (cuentas_seguimiento)
//        Archivados  lo hecho y lo cancelado, con «Desarchivar»
//
// Las alertas del sistema (inventario, ventas, tracking…) YA NO salen aquí: viven en la campana.
// Datos: datos.js → useAgendaV4 (items + reuniones + subtareas + cuentas). Lógica pura: calculo.js.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, CalendarPlus, Share2, Plane, Users } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../lib/permisos';
import { Hero, KpiCard, Segmented, Boton, Cargando, Panel, toast } from '../../components/kit';
import SinAcceso from '../../components/SinAcceso';
import { useAgendaV4, completarItem, actualizarItem, crearItem } from './datos';
import { useGoogleEstado, conectarGoogle, useGoogleEventos, leerRetornoGoogle, MENSAJES_GOOGLE } from './google';
import {
  porHorizonte, fraseAgenda, cumplimiento, isoDia, sumarDias, inicioSemana, cuando,
  ordenarReuniones, cuentasOrdenadas, cuentasPendientes, FILTROS_VACIOS,
} from './calculo';
import { fechaLarga, textoBandeja } from './textos';
import { bandeja as calcBandeja } from './calculo';
import { compartir } from '../../lib/whatsapp';
import Calendario from './Calendario';
import Pendientes, { filtrarQuien } from './Pendientes';
import Reuniones from './Reuniones';
import Minuta from './Minuta';
import HojaItem from './HojaItem';
import FormReunion from './FormReunion';
import Cuentas from './Cuentas';
import Archivados from './Archivados';

const VISTAS = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'reuniones', label: 'Reuniones' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'archivados', label: 'Archivados' },
];

export default function Agenda({ onNavegar, inicial }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const uid = perfil?.user_id || null;
  const puedeEditar = !!perfil?.es_super_admin || puedeEditarPestanaGlobal(perfil, 'agenda');

  const d = useAgendaV4({ enabled: !!perfil });
  const { items, reuniones, personas, personasPorId, porId, subtareas, progreso, cuentas, notasPorCuenta, hoy } = d;
  const g = useGoogleEstado();

  const [vista, setVista] = useState(inicial?.vista || 'pendientes');
  const [hojaItem, setHojaItem] = useState(null);
  const [minutaId, setMinutaId] = useState(inicial?.reunionId || null);
  const [formReunion, setFormReunion] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const rootRef = useRef(null);
  const abrioInicial = useRef(false);

  // Rango del calendario → eventos de Google
  const [rango, setRango] = useState(() => ({ desde: isoDia(sumarDias(inicioSemana(new Date()), -45)), hasta: isoDia(sumarDias(inicioSemana(new Date()), 60)) }));
  const googleQ = useGoogleEventos(rango.desde, rango.hasta, g.conectado);
  const googleEventos = googleQ.data || [];

  useEffect(() => {
    const r = leerRetornoGoogle();
    if (!r) return;
    if (r.ok) toast.ok('Google Calendar conectado'); else toast.error(`No se pudo conectar Google${r.motivo ? `: ${r.motivo}` : ''}`);
  }, []);

  // Enlace externo (Resumen del cliente → «Últimas minutas y acuerdos») que pide una minuta concreta.
  useEffect(() => {
    if (abrioInicial.current || d.cargando || !inicial?.reunionId) return;
    abrioInicial.current = true;
    if (reuniones.some((r) => r.id === inicial.reunionId)) { setVista('reuniones'); setMinutaId(inicial.reunionId); }
    else toast.info('Esa reunión ya no está en la agenda');
  }, [d.cargando, reuniones, inicial?.reunionId]);

  const mios = useMemo(() => filtrarQuien(items.filter((i) => i.estado === 'abierta'), 'mios', uid), [items, uid]);
  const bloquesMios = useMemo(() => porHorizonte(mios, hoy), [mios, hoy]);
  const bloquesTodos = useMemo(() => porHorizonte(items.filter((i) => i.estado === 'abierta'), hoy), [items, hoy]);
  const reunionesHoy = useMemo(() => reuniones.filter((r) => r.tipo === 'reunion' && r.estado !== 'cerrada' && isoDia(new Date(r.fecha)) === isoDia(hoy)).sort((a, c) => new Date(a.fecha) - new Date(c.fecha)), [reuniones, hoy]);
  const reunionesSemana = useMemo(() => { const ini = inicioSemana(hoy), fin = sumarDias(ini, 7); return reuniones.filter((r) => r.tipo === 'reunion' && new Date(r.fecha) >= ini && new Date(r.fecha) < fin); }, [reuniones, hoy]);
  const cuentasHoy = useMemo(() => cuentasPendientes(cuentas, hoy), [cuentas, hoy]);
  const cuentasSemana = useMemo(() => cuentasOrdenadas(cuentas, { hoy, estado: 'activa' }).filter((c) => c.seg.nivel !== 'despues' && c.seg.nivel !== 'sinfecha'), [cuentas, hoy]);
  const cumpl = useMemo(() => cumplimiento(items, hoy), [items, hoy]);
  const cerradasHoy = useMemo(() => items.filter((i) => i.estado === 'hecha' && i.completado_en && isoDia(new Date(i.completado_en)) === isoDia(hoy)).length, [items, hoy]);
  const viajes = useMemo(() => reuniones.filter((r) => r.tipo === 'viaje' && new Date(r.fecha_fin || r.fecha) >= sumarDias(hoy, -1)).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)), [reuniones, hoy]);
  const hero = useMemo(() => fraseAgenda({ bloques: bloquesMios, reunionesHoy, cuentasHoy, hoy, quien: (perfil?.nombre || '').split(' ')[0] }), [bloquesMios, reunionesHoy, cuentasHoy, hoy, perfil]);

  if (!perfil) return <Cargando pantalla="agenda" />;
  if (!puedeVerPaginaGlobal(perfil, 'agenda')) return <SinAcceso motivo="No tienes acceso a Agenda. Pídele a Fernando que te la habilite desde Administración." />;
  if (d.cargando) return <Cargando pantalla="agenda" />;
  if (d.error) return <Panel titulo="No se pudo cargar la Agenda"><div style={{ fontSize: 12, color: theme.red }}>{String(d.error.message || d.error)}</div></Panel>;

  const nBloque = (bs, id) => bs.find((b) => b.id === id)?.items.length || 0;
  const toggle = async (item, hecha) => {
    try {
      await completarItem(item, hecha);
      if (hecha) toast.ok('Hecho · va a Archivados', { accion: 'Deshacer', onAccion: () => completarItem(item, false).catch((e) => toast.error(e.message)) });
    } catch (e) { toast.error(e.message); }
  };
  const posponer = async (item, dias) => {
    const prev = item.fecha_limite || null;
    const nueva = isoDia(sumarDias(hoy, dias));
    try {
      await actualizarItem(item.id, { fecha_limite: nueva });
      toast.ok(`Pospuesto a ${cuando(nueva, hoy)}`, { accion: 'Deshacer', onAccion: () => actualizarItem(item.id, { fecha_limite: prev }).catch((e) => toast.error(e.message)) });
    } catch (e) { toast.error(e.message); }
  };
  const nuevoPendiente = async (fechaIso) => {
    try {
      const it = await crearItem({ texto: 'Nuevo pendiente', tipo: 'tarea', fecha_limite: fechaIso || isoDia(hoy), responsables: uid ? [uid] : undefined, origen: { fuente: 'calendario' } }, personas);
      setVista('pendientes'); setHojaItem(it);
      toast.ok(`Pendiente para ${cuando(fechaIso || isoDia(hoy), hoy)} · ponle nombre`);
    } catch (e) { toast.error(e.message); }
  };
  const nuevoViaje = (dia) => setFormReunion({ tipo: 'viaje', fecha: dia });
  const compartirHoy = async () => {
    const b = calcBandeja(mios, hoy);
    const txt = textoBandeja(b, { personasPorId, hoy, quien: (perfil.nombre || '').split(' ')[0] });
    await compartir(txt, { titulo: 'Agenda de hoy' });
  };
  const onConectar = async () => { try { await conectarGoogle(); } catch (e) { toast.error(MENSAJES_GOOGLE[e.codigo] || e.message, { ms: 5000 }); } };
  const ir = (ck, pagina, extra) => onNavegar?.(ck, pagina, extra);

  const comunes = {
    d, items, reuniones, reunionesOrd: ordenarReuniones(reuniones, hoy), personas, personasPorId, porId, hoy, puedeEditar,
    filtros, setFiltros, filtrar: (arr) => arr, toggle, abrirItem: setHojaItem,
    abrirMinuta: (r) => { setVista('reuniones'); setMinutaId(typeof r === 'string' ? r : r.id); },
    nuevaReunion: (extra) => setFormReunion({ ...(extra || {}) }), editarReunion: (r) => setFormReunion({ reunion: r }),
    nuevoPendiente, nuevoViaje,
    google: { ...g, eventos: googleEventos, cargando: googleQ.isLoading, error: googleQ.error, onConectar },
    rango, setRango, onNavegar: ir,
  };
  const minuta = minutaId ? reuniones.find((r) => r.id === minutaId) : null;
  const ghost = { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', color: theme.textOnInverse || '#F5F5F7' };

  return (
    <div ref={rootRef} data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <Hero eyebrow={`Agenda · ${fechaLarga(hoy)}`} titulo={hero.titulo} sub={hero.sub} dot={hero.venc > 0}
        stats={[
          { k: 'Hoy', v: hero.hoy, sub: `${hero.venc} vencido${hero.venc === 1 ? '' : 's'}` },
          { k: 'Reuniones', v: reunionesSemana.length, sub: reunionesHoy.length ? `${reunionesHoy.length} hoy` : 'esta semana' },
          { k: 'Cuentas', v: cuentasHoy.length, sub: `de ${cuentas.filter((c) => c.estado === 'activa').length} activas` },
        ]}>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {puedeEditar && <Boton icon={Plus} onClick={() => { setVista('pendientes'); document.getElementById('agenda-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} style={ghost}>Pendiente</Boton>}
          {puedeEditar && <Boton icon={CalendarPlus} onClick={() => setFormReunion({})} style={ghost}>Reunión</Boton>}
          {puedeEditar && <Boton icon={Plane} onClick={() => setFormReunion({ tipo: 'viaje' })} style={ghost}>Viaje / ausencia</Boton>}
          {puedeEditar && <Boton icon={Users} onClick={() => setVista('cuentas')} style={ghost}>Cuentas</Boton>}
          <Boton icon={Share2} onClick={compartirHoy} style={ghost} title="Compartir mi día por WhatsApp">Compartir hoy</Boton>
          {g.conectado
            ? <Boton style={ghost} title={`Google Calendar · ${g.email || ''}`}>Google conectado ✓</Boton>
            : <Boton icon={CalendarPlus} primario onClick={onConectar} disabled={g.cargando} title="Conecta tu Google Calendar (cada quien el suyo)">Conectar Google</Boton>}
        </div>
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Vencidos" badge={hero.venc ? { l: `${hero.venc}`, tone: 'red' } : { l: 'al día', tone: 'green' }} big={hero.venc} bigSmall="pendientes tuyos"
          sub={hero.venc ? bloquesMios.find((b) => b.id === 'vencidos').items.slice(0, 2).map((i) => i.titulo.slice(0, 26)).join(' · ') : 'nada vencido'}
          onClick={() => setVista('pendientes')} />
        <KpiCard eyebrow="Esta semana" badge={{ l: 'por delante', tone: 'blue' }} big={nBloque(bloquesMios, 'semana') + nBloque(bloquesMios, 'hoy')} bigSmall="tuyos"
          sub={`${nBloque(bloquesTodos, 'semana') + nBloque(bloquesTodos, 'hoy')} del equipo · ${cerradasHoy} cerrado${cerradasHoy === 1 ? '' : 's'} hoy${cumpl != null ? ` · ${cumpl} % a tiempo` : ''}`}
          onClick={() => setVista('pendientes')} />
        <KpiCard eyebrow="Cuentas que sigo" badge={{ l: cuentasHoy.length ? 'toca hoy' : 'al día', tone: cuentasHoy.length ? 'orange' : 'green' }} big={cuentasSemana.length} bigSmall="esta semana"
          sub={cuentasSemana.slice(0, 2).map((c) => `${c.nombre.split(' ')[0]} ${c.seg.label}`).join(' · ') || 'sin seguimientos próximos'}
          onClick={() => setVista('cuentas')} />
        <KpiCard eyebrow="Viajes y ausencias" badge={{ l: viajes.length ? 'agendados' : 'ninguno', tone: viajes.length ? 'red' : 'gray' }} big={viajes.length} bigSmall="próximos"
          sub={viajes[0] ? `${viajes[0].titulo} · ${cuando(isoDia(new Date(viajes[0].fecha)), hoy)}` : 'crea uno desde el calendario'}
          onClick={puedeEditar ? () => setFormReunion({ tipo: 'viaje' }) : undefined} />
      </div>

      {/* 1 · calendario de ancho completo, arriba de todo */}
      <Calendario {...comunes} />

      {/* 2 · la lista */}
      <div id="agenda-lista" style={{ display: 'flex', justifyContent: 'center' }}>
        <Segmented options={VISTAS} value={vista} onChange={setVista} size="md" />
      </div>

      {vista === 'pendientes' && (
        <Pendientes items={items} personas={personas} personasPorId={personasPorId} porId={porId} reuniones={reuniones} hoy={hoy} uid={uid}
          progreso={progreso} puedeEditar={puedeEditar} onAbrir={setHojaItem} onToggle={toggle} onPosponer={posponer} />
      )}
      {vista === 'reuniones' && <Reuniones {...comunes} id="agenda-reuniones" />}
      {vista === 'cuentas' && (
        <Cuentas cuentas={cuentas} notasPorCuenta={notasPorCuenta} personas={personas} hoy={hoy} puedeEditar={puedeEditar}
          onNavegarPendientes={() => setVista('pendientes')} />
      )}
      {vista === 'archivados' && <Archivados items={items} personasPorId={personasPorId} hoy={hoy} progreso={progreso} puedeEditar={puedeEditar} onAbrir={setHojaItem} />}

      {hojaItem && <HojaItem item={porId.get(hojaItem.id) || hojaItem} personas={personas} personasPorId={personasPorId} porId={porId} reuniones={reuniones} hoy={hoy}
        subtareas={subtareas} puedeEditar={puedeEditar} onClose={() => setHojaItem(null)} onAbrirMinuta={(rid) => { setHojaItem(null); setVista('reuniones'); setMinutaId(rid); }} />}
      {minuta && <Minuta reunion={minuta} items={items} personas={personas} personasPorId={personasPorId} porId={porId} reuniones={reuniones} hoy={hoy} uid={uid}
        puedeEditar={puedeEditar} onClose={() => setMinutaId(null)} onEditar={() => setFormReunion({ reunion: minuta })} google={comunes.google} />}
      {formReunion && <FormReunion inicial={formReunion} personas={personas} google={comunes.google} onClose={() => setFormReunion(null)}
        onCreada={(r) => { setFormReunion(null); if (r?.tipo === 'reunion') { setVista('reuniones'); setMinutaId(r.id); } }} />}
    </div>
  );
}
