// Agenda «que te lleva» (V6 · 2026-10-08) · el pop-up «Organiza tu día» montado en TODA la app (web y celular): sale la
// primera vez que entras en el día, en cualquier pestaña, mientras sea tu agenda y tengas permiso. Se recuerda por día
// en localStorage y en agenda_registro_dia.organizado_at. Se carga perezoso desde App.jsx; sólo usa la cache de la Agenda.
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { usePerfil } from '../../lib/perfilContext';
import { usePreferencias } from '../../lib/preferencias';
import { puedeVerPaginaGlobal, puedeEditarPestanaGlobal } from '../../lib/permisos';
import { useAgenda5 } from '../agenda5/datos';
import { horasDe } from '../agenda5/dia/datos';
import { estadoDelDia, isoDe } from './calculo';
import { organizadoHoy, recordarOrganizado } from './datos';

const OrganizaDia = lazy(() => import('./OrganizaDia'));
const OrganizaDiaM = lazy(() => import('../../movil/pestanas/agenda6/OrganizaDiaM'));

export default function OrganizaGlobal({ movil = false }) {
  const perfil = usePerfil();
  const prefs = usePreferencias();
  const uid = perfil?.user_id || null;
  const puede = !!perfil && puedeVerPaginaGlobal(perfil, 'agenda') && puedeEditarPestanaGlobal(perfil, 'agenda');
  const d = useAgenda5({ enabled: puede });
  const horas = useMemo(() => ({ ...horasDe(null), ...(prefs?.agenda?.horas || perfil?.preferencias?.agenda?.horas || {}) }), [prefs, perfil]);
  const [cerrado, setCerrado] = useState(false);
  const [org, setOrg] = useState(() => (uid ? organizadoHoy(uid) : true));
  useEffect(() => { if (uid) setOrg(organizadoHoy(uid)); }, [uid]);
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDe(hoy);
  const estado = useMemo(() => (puede && uid && d.items ? estadoDelDia({ items: d.items, uid, hoy: new Date(), horas, registros: d.registros || [], organizadoHoy: org, reuniones: d.reuniones || [], google: d.google || [] }) : null), [puede, uid, d.items, d.registros, d.reuniones, d.google, horas, org]);
  // Si ya se organizó desde otro dispositivo (registro con organizado_at), no molestar aquí.
  useEffect(() => { if (estado?.regHoy?.organizado_at && uid && !org) { recordarOrganizado(uid, hoyIso); setOrg(true); } }, [estado, uid, org, hoyIso]);
  const abierto = !!estado && estado.fase === 'organizar' && !org && !cerrado && !d.cargando;
  if (!abierto) return null;
  const cerrar = () => { setCerrado(true); try { sessionStorage.setItem(`agenda_org_luego_${hoyIso}`, '1'); } catch { /* sin storage */ } };
  const listo = () => { setOrg(true); setCerrado(true); };
  const props = { abierto: true, onClose: cerrar, onListo: listo, d, uid, propietario: uid, hoy, hoyIso, horas, estado, puedeEditar: true, nombre: String(perfil?.nombre || '').split(' ')[0] };
  return <Suspense fallback={null}>{movil ? <OrganizaDiaM {...props} /> : <OrganizaDia {...props} />}</Suspense>;
}
