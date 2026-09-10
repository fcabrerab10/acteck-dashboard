// Pestaña Alertas · mismo modelo del Centro iOS: pilas por área (agruparPorArea), Segmented Hoy / Semana /
// Silenciadas, sección "Resumen programado {hora}" y filas que se deslizan a la izquierda para Posponer 3 d / Resolver.
import React, { useMemo, useState } from 'react';
import { Clock, Check, ChevronDown, ChevronRight, BellOff } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../lib/motion';
import { supabase } from '../../lib/supabase';
import {
  useAlertas, useAlertasPospuestas, useNoLeidas, usePreferenciasNotif, resolverAlerta, posponerAlerta, marcarLeidas,
  ejecutarAccion, accionAlerta, agruparPorArea, areaAlerta, aplicaCliente, esNueva, SEV_LABEL,
} from '../../lib/alertas';
import { colorSev, horaRelativa } from '../../components/notificaciones/Pila';
import { useNav } from '../nav';
import { TituloGrande, Segmented, FilaDeslizable, Fila, Vacio, Skeleton, Pill, TituloSeccionM, toast } from '../piezas';
import { nombreCliente } from '../datos';
import FichaCliente from './FichaCliente';
import FichaProducto from '../FichaProducto';

const TABS = [{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'silenciadas', label: 'Silenciadas' }];

function inicioHoyCDMX() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T06:00:00.000Z`;
}

export default function Alertas() {
  const { theme } = useTheme();
  const nav = useNav();
  const [tab, setTab] = useState('hoy');
  const [saliendo, setSaliendo] = useState(() => new Set());
  const [ocultas, setOcultas] = useState(() => new Set());
  const { data: alertas = [], isLoading, isError } = useAlertas();
  const { data: pospuestas = [] } = useAlertasPospuestas({ enabled: tab === 'silenciadas' });
  const { data: lecturas } = useNoLeidas();
  const { data: prefs } = usePreferenciasNotif();

  const hoyIso = useMemo(() => inicioHoyCDMX(), []);
  const activas = useMemo(() => alertas.filter((a) => !ocultas.has(a.id)), [alertas, ocultas]);
  const { inmediatas, resumen, silenciadas } = useMemo(() => {
    const inm = [], res = [], sil = [];
    for (const a of activas) {
      if (!aplicaCliente(a, prefs)) continue;
      const modo = prefs?.areas?.[areaAlerta(a)] || 'resumen';
      if (a.severidad === 'critica' || modo === 'inmediato') inm.push(a);
      else if (modo === 'resumen') res.push(a);
      else sil.push(a);
    }
    const f = (arr) => (tab === 'hoy' ? arr.filter((a) => esNueva(a, lecturas) || String(a.generada_at || '') >= hoyIso) : arr);
    return { inmediatas: f(inm), resumen: f(res), silenciadas: sil };
  }, [activas, prefs, lecturas, tab, hoyIso]);
  const pilasInm = useMemo(() => agruparPorArea(inmediatas, lecturas), [inmediatas, lecturas]);
  const pilasRes = useMemo(() => agruparPorArea(resumen, lecturas), [resumen, lecturas]);
  const pilasSil = useMemo(() => agruparPorArea([...silenciadas, ...pospuestas.filter((a) => !ocultas.has(a.id))], lecturas), [silenciadas, pospuestas, ocultas, lecturas]);

  const salir = (id, accion, msg) => {
    setSaliendo((s) => new Set(s).add(id));
    setTimeout(async () => {
      setOcultas((s) => new Set(s).add(id));
      setSaliendo((s) => { const n = new Set(s); n.delete(id); return n; });
      try { await accion(); if (msg) toast.ok(msg); }
      catch (e) { toast.error(e?.message || 'No se pudo actualizar'); setOcultas((s) => { const n = new Set(s); n.delete(id); return n; }); }
    }, reduceMotion() ? 0 : DUR.exit);
  };
  const resolver = (a) => salir(a.id, async () => { const { data } = await supabase.auth.getUser(); return resolverAlerta(a.id, data?.user?.email || nav.perfil?.email); }, 'Alerta resuelta');
  const posponer = (a) => salir(a.id, () => posponerAlerta(a.id, 3), 'Pospuesta 3 días');
  const ver = (a) => {
    marcarLeidas([a.id]).catch(() => {});
    ejecutarAccion(a, (ck, pagina, ex) => {
      if (ex?.sku || pagina === 'inventarioGlobal') { if (ex?.sku) nav.agregarSku(ex.sku); nav.push(<FichaProducto />, 'ficha'); return; }
      if (ck) { nav.push(<FichaCliente clienteKey={ck} />, `cliente-${ck}`); return; }
      if (pagina === 'actualizacion') { nav.irATab('mas'); return; }
      nav.abrirProximamente(pagina);
    });
  };
  const leerPila = (p) => { const ids = p.alertas.filter((a) => esNueva(a, lecturas)).map((a) => a.id); if (ids.length) marcarLeidas(ids).catch(() => {}); };
  const hora = prefs?.resumen?.hora || '13:00';
  const nNuevas = [...inmediatas, ...resumen].filter((a) => esNueva(a, lecturas)).length;
  const props = { lecturas, saliendo, onVer: ver, onPosponer: posponer, onResolver: resolver, onAbrir: leerPila, theme };

  let cuerpo;
  if (isLoading) cuerpo = <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={76} r={12} /><Skeleton h={76} r={12} /><Skeleton h={76} r={12} /></div>;
  else if (isError) cuerpo = <Vacio icon={BellOff} color={theme.red} titulo="No se pudieron cargar las alertas" />;
  else if (tab === 'silenciadas') cuerpo = pilasSil.length ? pilasSil.map((p) => <PilaM key={p.area} pila={p} quieta {...props} />) : <Vacio icon={BellOff} color={theme.textMuted} titulo="Nada silenciado" sub="Aquí aparecen las alertas pospuestas y las áreas en modo Silencio." />;
  else if (!pilasInm.length && !pilasRes.length) cuerpo = <Vacio titulo="Todo al corriente" sub={tab === 'hoy' ? 'Sin novedades hoy. Mira "Semana" para ver lo pendiente.' : 'No hay alertas activas en tus áreas.'} />;
  else cuerpo = (
    <>
      {pilasInm.map((p, i) => <PilaM key={p.area} pila={p} abiertaInicial={i === 0} {...props} />)}
      {pilasRes.length > 0 && (
        <>
          <TituloSeccionM meta={`${resumen.length} no crítica${resumen.length === 1 ? '' : 's'}`} style={{ padding: '14px 28px 6px' }}>Resumen programado {hora}</TituloSeccionM>
          {pilasRes.map((p) => <PilaM key={p.area} pila={p} quieta {...props} />)}
        </>
      )}
    </>
  );

  return (
    <>
      <TituloGrande titulo="Alertas" sub={nNuevas ? `${nNuevas} nueva${nNuevas === 1 ? '' : 's'} · desliza una fila para posponer o resolver` : 'Desliza una fila a la izquierda para posponer o resolver'} />
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented size="md" value={tab} onChange={setTab} style={{ display: 'flex', width: '100%' }} options={TABS.map((t) => ({ ...t, badge: t.id === 'hoy' && nNuevas ? nNuevas : undefined }))} />
      </div>
      {cuerpo}
    </>
  );
}

function PilaM({ pila, lecturas, saliendo, onVer, onPosponer, onResolver, onAbrir, abiertaInicial = false, quieta = false, theme }) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  const top = pila.alertas[0];
  const toggle = () => { const n = !abierta; setAbierta(n); if (n) onAbrir?.(pila); };
  return (
    <section style={{ margin: '0 16px 10px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <button type="button" onClick={toggle} aria-expanded={abierta}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 54, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: colorSev(theme, top?.severidad), flexShrink: 0, boxShadow: pila.criticaNueva && !quieta ? `0 0 0 3px ${colorSev(theme, 'critica')}33` : 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{pila.label}</span>
            <span style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted }}>{horaRelativa(pila.ultima)}</span>
          </span>
          {!abierta && <span style={{ display: 'block', fontSize: 12.5, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{top?.titulo}{pila.alertas.length > 1 ? ` · y ${pila.alertas.length - 1} más` : ''}</span>}
        </span>
        {pila.nuevas > 0 && <Pill tone={pila.criticaNueva ? 'red' : 'blue'} size="xs">{pila.nuevas} nueva{pila.nuevas === 1 ? '' : 's'}</Pill>}
        <ChevronDown size={16} style={{ color: theme.textSubtle || theme.textMuted, transform: abierta ? 'rotate(180deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}`, flexShrink: 0 }} />
      </button>
      <div style={{ display: 'grid', gridTemplateRows: abierta ? '1fr' : '0fr', transition: `grid-template-rows ${DUR.content}ms ${EASE}` }}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          {pila.alertas.map((a) => {
            const acc = accionAlerta(a);
            const nueva = esNueva(a, lecturas);
            return (
              <FilaDeslizable key={a.id} saliendo={saliendo.has(a.id)} acciones={[
                { label: 'Posponer', icon: Clock, color: theme.orange, onClick: () => onPosponer(a) },
                { label: 'Resolver', icon: Check, color: theme.green, onClick: () => onResolver(a) },
              ]}>
                <div style={{ borderTop: `1px solid ${theme.border}` }}>
                  <Fila tono={colorSev(theme, a.severidad)} alto={56} chevron={false}
                    titulo={<span style={{ fontWeight: nueva ? 600 : 500 }}>{a.titulo}</span>}
                    sub={[SEV_LABEL[a.severidad], a.cliente_key ? nombreCliente(a.cliente_key) : null, a.sku, a.detalle].filter(Boolean).join(' · ')}
                    onClick={acc ? () => onVer(a) : undefined}
                    trailing={acc && <span style={{ display: 'inline-flex', alignItems: 'center', color: theme.accent, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{acc.label}<ChevronRight size={14} /></span>} />
                </div>
              </FilaDeslizable>
            );
          })}
        </div>
      </div>
    </section>
  );
}
