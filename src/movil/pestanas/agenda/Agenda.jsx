// Agenda móvil V4 (2026-09-21) · push (nodo `agenda`). Mismo modelo que la web (src/modules/agenda):
// Segmented Pendientes · Calendario · Reuniones · Cuentas · Archivados.
//   Pendientes  captura en una línea + bloques por horizonte, gestos (→ hecho · ← posponer)
//   Calendario  Mes o Semana con Google, reuniones, viajes, pendientes, arribos y cargas
//   Reuniones   línea del tiempo + minuta en vivo
//   Cuentas     cuentas que Fernando sigue, con "Registrar contacto", llamar y WhatsApp
//   Archivados  lo hecho y lo cancelado, con desarchivar
// Las alertas de SKUs ya NO salen aquí: viven en la campana. `inicial` viene de rutas.js
// (notificación → { itemId } abre el ítem o su minuta; { reunionId } abre la minuta).
// Desde 2026-09-22 es una pestaña RAÍZ del shell (`raiz`): sin "‹ Atrás", como Clientes.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarCheck } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { Cargando } from '../../../components/kit';
import { useAgendaV4, completarItem, actualizarItem } from '../../../modules/agenda/datos';
import { useGoogleEstado } from '../../../modules/agenda/google';
import { isoDia, sumarDias, cuando } from '../../../modules/agenda/calculo';
import { fechaLarga } from '../../../modules/agenda/textos';
import { useNav } from '../../nav';
import { TituloGrande, Cabecera, Segmented, Vacio, toast } from '../../piezas';
import { FAB } from './comun';
import CapturaHoja from './Captura';
import Pendientes from './Pendientes';
import Semana from './Semana';
import Reuniones from './Reuniones';
import Cuentas from './Cuentas';
import Archivados from './Archivados';
import Minuta from './Minuta';

export const AgendaCtx = createContext(null);
export const useAgenda = () => useContext(AgendaCtx);

const VISTAS = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'reuniones', label: 'Reuniones' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'archivados', label: 'Archivados' },
];

export default function Agenda({ inicial, raiz = false }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav.perfil;
  const puedeVer = puedeVerPaginaGlobal(perfil, 'agenda');
  const puedeEditar = !!perfil?.es_super_admin || puedeEditarPestanaGlobal(perfil, 'agenda');
  const d = useAgendaV4({ enabled: !!perfil && puedeVer });
  const google = useGoogleEstado();
  const [vista, setVista] = useState(inicial?.vista || 'pendientes');
  const [cap, setCap] = useState(null);
  const abierto = useRef(false);

  const abrirMinuta = (r) => { const id = typeof r === 'string' ? r : r?.id; if (!id) return; nav.push(<Minuta reunionId={id} />, `minuta-${id}`); };
  const abrirItem = (item) => setCap({ item });
  const capturar = (extra = {}) => setCap({ tipo: 'tarea', ...extra });
  const toggle = async (item, hecha) => {
    try { await completarItem(item, hecha); if (hecha) toast.ok('Hecho · va a Archivados', { accion: 'Deshacer', onAccion: () => completarItem(item, false).catch((e) => toast.error(e.message)) }); }
    catch (e) { toast.error(e.message); }
  };
  const posponer = async (item, dias = 1) => {
    const prev = item.fecha_limite || null;
    const nueva = isoDia(sumarDias(d.hoy, dias));
    try { await actualizarItem(item.id, { fecha_limite: nueva }); toast.ok(`Pospuesto a ${cuando(nueva, d.hoy)}`, { accion: 'Deshacer', onAccion: () => actualizarItem(item.id, { fecha_limite: prev }).catch((e) => toast.error(e.message)) }); }
    catch (e) { toast.error(e.message); }
  };
  const navegarAviso = (aviso) => { const a = aviso?.accion; if (!a) return; nav.navegar({ pagina: a.pagina, clienteKey: a.clienteKey || null, label: a.label }); };

  // Notificación → ítem o minuta (una sola vez, cuando ya hay datos).
  useEffect(() => {
    if (abierto.current || d.cargando) return;
    if (inicial?.reunionId) { abierto.current = true; setVista('reuniones'); abrirMinuta(inicial.reunionId); return; }
    if (!inicial?.itemId) return;
    const it = d.porId.get(inicial.itemId);
    abierto.current = true;
    if (!it) { toast.info('Ese pendiente ya no está en la agenda'); return; }
    const r = it.reunion_id ? d.reuniones.find((x) => x.id === it.reunion_id) : null;
    if (it.tipo === 'punto' && r && r.estado !== 'cerrada') abrirMinuta(r); else setCap({ item: it });
  }, [d.cargando, d.porId, d.reuniones, inicial?.itemId, inicial?.reunionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({
    ...d, uid: perfil?.user_id || null, perfil, puedeEditar, google,
    abrirItem, abrirMinuta, capturar, toggle, posponer, navegarAviso, setVista,
  }), [d, perfil, puedeEditar, google]); // eslint-disable-line react-hooks/exhaustive-deps

  const cabecera = (
    <>
      {!raiz && <Cabecera onVolver={nav.pop} />}
      <TituloGrande titulo="Agenda" sub={fechaLarga(d.hoy).replace(/^./, (c) => c.toUpperCase())} />
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented size="md" value={vista} onChange={setVista} options={VISTAS} style={{ display: 'flex', width: '100%' }} />
      </div>
    </>
  );

  if (!perfil || !puedeVer) return (<>{cabecera}<Vacio icon={CalendarCheck} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la Agenda. Pídele a Fernando que te la habilite desde Administración." /></>);
  if (d.error) return (<>{cabecera}<Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar la Agenda" sub={String(d.error.message || d.error)} /></>);
  if (d.cargando) return (<>{cabecera}<div style={{ padding: '0 16px' }}><Cargando pantalla="movilAgenda" /></div></>);

  return (
    <AgendaCtx.Provider value={ctx}>
      {cabecera}
      {vista === 'pendientes' && <Pendientes />}
      {vista === 'calendario' && <Semana />}
      {vista === 'reuniones' && <Reuniones />}
      {vista === 'cuentas' && <Cuentas />}
      {vista === 'archivados' && <Archivados />}
      {puedeEditar && (vista === 'pendientes' || vista === 'calendario') && <FAB onClick={() => capturar()} />}
      <CapturaHoja cfg={cap} personas={d.personas} reuniones={d.reuniones} hoy={d.hoy} subtareas={d.subtareas} puedeEditar={puedeEditar}
        onClose={() => setCap(null)} onAbrirMinuta={abrirMinuta} />
    </AgendaCtx.Provider>
  );
}
