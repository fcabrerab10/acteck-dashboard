// Agenda móvil (push · nodo `agenda`) · orquestador: mismos datos y lógica pura que la web (src/modules/agenda),
// dos disposiciones elegibles con la MISMA preferencia `agenda.modo` (bandeja = A "Hoy en lista" · tablero = C
// "Tablero deslizable"; se cambia aquí, en Preferencias del avatar o en la web) y cuatro vistas:
// Hoy/Tablero · Reuniones · Semana · Clientes. Captura rápida desde el FAB (Captura.jsx) y Minuta en vivo (Minuta.jsx,
// pantalla empujada). `inicial` viene de rutas.js (notificación → { itemId } abre el ítem o su minuta).
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutList, Columns3, AlertTriangle, CalendarCheck } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePreferencias } from '../../../lib/preferencias';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { Cargando } from '../../../components/kit';
import { useBandejaHoy, completarItem, actualizarItem } from '../../../modules/agenda/datos';
import { useGoogleEstado } from '../../../modules/agenda/google';
import { isoDia, sumarDias, cuando } from '../../../modules/agenda/calculo';
import { fechaLarga } from '../../../modules/agenda/textos';
import { useNav } from '../../nav';
import { TituloGrande, Cabecera, Segmented, Vacio, toast } from '../../piezas';
import { FAB } from './comun';
import CapturaHoja from './Captura';
import Hoy from './Hoy';
import Tablero from './Tablero';
import Reuniones from './Reuniones';
import Semana from './Semana';
import Clientes from './Clientes';
import Minuta from './Minuta';

export const AgendaCtx = createContext(null);
export const useAgenda = () => useContext(AgendaCtx);

const VISTAS = (modo) => [
  { id: 'hoy', label: modo === 'tablero' ? 'Tablero' : 'Hoy' }, { id: 'reuniones', label: 'Reuniones' }, { id: 'semana', label: 'Semana' }, { id: 'clientes', label: 'Clientes' },
];

export default function Agenda({ inicial }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav.perfil;
  const { prefs, setPreferencia } = usePreferencias();
  const modo = prefs?.agenda?.modo === 'tablero' ? 'tablero' : 'bandeja';
  const puedeVer = puedeVerPaginaGlobal(perfil, 'agenda');
  const puedeEditar = !!perfil?.es_super_admin || perfil?.tipo === 'interno' || puedeEditarPestanaGlobal(perfil, 'agenda');
  const d = useBandejaHoy({ enabled: !!perfil && puedeVer });
  const google = useGoogleEstado();
  const [vista, setVista] = useState(inicial?.vista || 'hoy');
  const [cap, setCap] = useState(null);
  const abierto = useRef(false);

  const abrirMinuta = (r) => { const id = typeof r === 'string' ? r : r?.id; if (!id) return; nav.push(<Minuta reunionId={id} />, `minuta-${id}`); };
  const abrirItem = (item) => setCap({ item });
  const capturar = (extra = {}) => setCap({ tipo: 'tarea', ...extra });
  const toggle = async (item, hecha) => {
    try { await completarItem(item, hecha); if (hecha) toast.ok('Hecho', { accion: 'Deshacer', onAccion: () => completarItem(item, false).catch((e) => toast.error(e.message)) }); }
    catch (e) { toast.error(e.message); }
  };
  const posponer = async (item, dias = 1) => {
    const prev = item.fecha_limite || null;
    const nueva = isoDia(sumarDias(d.hoy, dias));
    try { await actualizarItem(item.id, { fecha_limite: nueva }); toast.ok(`Pospuesta a ${cuando(nueva, d.hoy)}`, { accion: 'Deshacer', onAccion: () => actualizarItem(item.id, { fecha_limite: prev }).catch((e) => toast.error(e.message)) }); }
    catch (e) { toast.error(e.message); }
  };
  const navegarAviso = (aviso) => { const a = aviso?.accion; if (!a) return; nav.navegar({ pagina: a.pagina, clienteKey: a.clienteKey || null, label: a.label }); };

  // Notificación → ítem o minuta (una sola vez, cuando ya hay datos).
  useEffect(() => {
    if (abierto.current || d.cargando || !inicial?.itemId) return;
    const it = d.porId.get(inicial.itemId);
    if (!it) { abierto.current = true; toast.info('Ese punto ya no está en la agenda'); return; }
    abierto.current = true;
    const r = it.reunion_id ? d.reuniones.find((x) => x.id === it.reunion_id) : null;
    if (it.tipo === 'punto' && r && r.estado !== 'cerrada') abrirMinuta(r); else setCap({ item: it });
  }, [d.cargando, d.porId, d.reuniones, inicial?.itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({
    ...d, uid: perfil?.user_id || null, perfil, puedeEditar, modo, google,
    abrirItem, abrirMinuta, capturar, toggle, posponer, navegarAviso, setVista,
  }), [d, perfil, puedeEditar, modo, google]); // eslint-disable-line react-hooks/exhaustive-deps

  const cabecera = (
    <>
      <Cabecera onVolver={nav.pop} derecha={vista === 'hoy' && (
        <button type="button" onClick={() => setPreferencia('agenda.modo', modo === 'tablero' ? 'bandeja' : 'tablero')} aria-label={modo === 'tablero' ? 'Ver como lista' : 'Ver como tablero'} title="Disposición · se guarda en tu perfil"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 44, padding: '0 10px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 14, cursor: 'pointer' }}>
          {modo === 'tablero' ? <><LayoutList size={17} />Lista</> : <><Columns3 size={17} />Tablero</>}
        </button>
      )} />
      <TituloGrande titulo="Agenda" sub={fechaLarga(d.hoy).replace(/^./, (c) => c.toUpperCase())} />
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented size="md" value={vista} onChange={setVista} options={VISTAS(modo)} style={{ display: 'flex', width: '100%' }} />
      </div>
    </>
  );

  if (!perfil || !puedeVer) return (<>{cabecera}<Vacio icon={CalendarCheck} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la Agenda. Pídele a Fernando que te la habilite desde Administración." /></>);
  if (d.error) return (<>{cabecera}<Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar la Agenda" sub={String(d.error.message || d.error)} /></>);
  if (d.cargando) return (<>{cabecera}<div style={{ padding: '0 16px' }}><Cargando pantalla={modo === 'tablero' && vista === 'hoy' ? 'movilAgendaTablero' : 'movilAgenda'} /></div></>);

  return (
    <AgendaCtx.Provider value={ctx}>
      {cabecera}
      {vista === 'hoy' && (modo === 'tablero' ? <Tablero /> : <Hoy />)}
      {vista === 'reuniones' && <Reuniones />}
      {vista === 'semana' && <Semana />}
      {vista === 'clientes' && <Clientes />}
      {puedeEditar && vista !== 'reuniones' && <FAB onClick={() => capturar()} />}
      <CapturaHoja cfg={cap} personas={d.personas} reuniones={d.reuniones} hoy={d.hoy} onClose={() => setCap(null)} onAbrirMinuta={abrirMinuta} />
    </AgendaCtx.Provider>
  );
}
