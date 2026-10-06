// Propuestas móvil (3.87.0 · 2026-10-06, mockup 792b61a8 pantalla 1): formato estándar. Hero del mes, 4 KpiM (Borradores ·
// Enviadas · Cerradas · Conversión), propuesto vs facturado 12 m en línea, chips de estado + cliente + buscador, lista por
// mes objetivo con pill de estado y «facturó N de M SKUs». Misma tabla que el armador de escritorio (propuestas_borradores);
// la conversión usa el mismo motor (propuestas/efectividad.js) y el cierre automático de la web.
// `inicial.skus` (+ `clienteKey`): abre el armador con esos SKUs (Qué le falta, Producto 360, calculadora de precios).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ClipboardList, AlertTriangle, Trash2, Copy } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { supabase } from '../../lib/supabase';
import { puedeVerPestanaGlobal } from '../../lib/permisos';
import { CLIENTES, MES_FULL } from '../../modules/comercial/propuestas/constantes';
import { filaAModelo, SELECT_PROPUESTA, eliminarPropuesta, guardarPropuesta } from '../../modules/comercial/propuestas/recientes';
import { cargarFacturacionVentanas, aplicarCierreAutomatico } from '../../modules/comercial/propuestas/efectividad';
import { useNav } from '../nav';
import { TituloGrande, Cabecera, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, FilaDeslizable, CampoBusqueda, Vacio, Skeleton, BotonGrande, Pill, GraficaScrub, LeyendaScrub, TituloSeccionM, toast } from '../piezas';
import { colorCliente } from '../datos';
import { money, moneyCompact, int, N } from '../util';
import PropuestaEditor, { QK_PROPUESTAS, TONO_ESTADO, ESTADO_LABEL } from './PropuestaEditor';
import { resumenPropuestas, frasePropuestas, diasDesde, compact } from './propuestas/calculo';

export function usePropuestas(enabled = true) {
  return useQuery({
    queryKey: QK_PROPUESTAS, staleTime: 60 * 1000, enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('propuestas_borradores').select(SELECT_PROPUESTA).order('tstamp', { ascending: false }).limit(200);
      if (error) throw error;
      let modelos = (data || []).map(filaAModelo);
      // Efectividad: facturación de las ventanas de las enviadas/cerradas + cierre automático (igual que la landing web).
      let factMap = new Map();
      try { factMap = await cargarFacturacionVentanas(modelos); modelos = await aplicarCierreAutomatico(modelos, factMap); } catch (e) { console.warn('[Propuestas] efectividad', e); }
      return { modelos, factMap };
    },
  });
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const CHIPS = [{ id: 'todas', label: 'Todas' }, { id: 'borrador', label: 'Borradores' }, { id: 'enviada', label: 'Enviadas' }, { id: 'cerrada', label: 'Cerradas' }];

/** Vista pura (SSR). */
export function PropuestasVista({ r, propuestas = [], anio, mes, estado = 'todas', onEstado, cliente = 'todos', onCliente, q = '', onQ, onAbrir, onNueva, onDuplicar, onEliminar, hoy = new Date() }) {
  const { theme } = useTheme();
  const grupos = useMemo(() => {
    const terms = norm(q.trim()).split(/\s+/).filter(Boolean);
    const filas = propuestas.filter((p) => (estado === 'todas' || p.estado === estado) && (cliente === 'todos' || p.clienteKey === cliente) && (!terms.length || terms.every((w) => norm(`${p.nombre} ${p.clienteLabel} ${p.clienteKey} ${p.folio || ''} ${(p.lineas || []).map((l) => l.sku).join(' ')}`).includes(w))));
    const m = new Map();
    for (const p of filas) { const d = new Date(N(p.tstamp) || Date.now()); const a = p.anio || d.getFullYear(), mm = p.mes || d.getMonth() + 1; const k = `${a}-${String(mm).padStart(2, '0')}`; if (!m.has(k)) m.set(k, { key: k, label: `${MES_FULL[mm - 1]} ${a}`, items: [] }); m.get(k).items.push(p); }
    return [...m.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [propuestas, estado, cliente, q]);
  const verde = theme.green, azul = theme.accent;
  return (
    <>
      <HeroM eyebrow={`${MES_FULL[mes - 1]} ${anio}`} frase={frasePropuestas(r, { mes, hoy })} sub={r.ultima ? `última enviada hace ${diasDesde(r.ultima.enviadaAt, hoy)} d · ${r.ultima.clienteLabel || r.ultima.clienteKey} · ${moneyCompact(r.ultima.resumen?.total)} · ${int(r.ultima.lineas?.length)} SKUs` : 'ninguna enviada todavía'} />
      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow="Borradores" big={String(r.borradores.n)} bigColor={r.borradores.n ? theme.orange : undefined} sub={r.borradores.n ? `${moneyCompact(r.borradores.total)} · en edición` : 'nada en edición'} onClick={() => onEstado?.('borrador')} />
        <KpiM eyebrow="Enviadas" big={String(r.enviadas.n)} sub={r.enviadas.n ? `${moneyCompact(r.enviadas.total)} · esperando OC` : 'ninguna esperando OC'} onClick={() => onEstado?.('enviada')} />
        <KpiM eyebrow="Cerradas" big={String(r.cerradas.n)} bigColor={r.cerradas.n ? theme.green : undefined} sub={r.cerradas.n ? `${moneyCompact(r.cerradas.total)} · facturó ${r.cerradas.skus} de ${r.cerradas.deSkus} SKUs` : 'el cliente aún no factura'} onClick={() => onEstado?.('cerrada')} />
        <KpiM eyebrow="Conversión ⌀" big={r.conversion != null ? `${Math.round(r.conversion)} %` : '—'} bigColor={r.conversion != null ? (r.conversion >= 60 ? theme.green : theme.orange) : undefined} sub={r.conversion != null ? `${r.nConv} propuesta${r.nConv === 1 ? '' : 's'} · últimos 3 meses · meta 60 %` : 'sin ventanas cerradas aún'} />
      </KpiGrid>
      {r.serie.some((d) => d.propuesto) && (
        <>
          <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">Propuesto vs facturado · 12 m</TituloSeccionM>
          <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
            <GraficaScrub datos={r.serie} formato={moneyCompact} series={[{ key: 'propuesto', label: 'Propuesto', color: azul, area: true, grosor: 2.4 }, { key: 'facturado', label: 'Facturado', color: verde }]}
              tooltip={(d) => <><b style={{ fontSize: 12.5 }}>{d.label}</b> · propuesto <b style={{ fontSize: 12.5 }}>{moneyCompact(d.propuesto)}</b>{d.facturado != null ? ` · facturado ${moneyCompact(d.facturado)}${d.propuesto ? ` · ${Math.round((d.facturado / d.propuesto) * 100)} %` : ''}` : ''}</>} />
            <LeyendaScrub items={[{ label: 'Propuesto', color: azul }, { label: 'Facturado en la ventana', color: verde }]} />
          </div>
        </>
      )}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 8 }}>
          {CHIPS.map((c) => <Pill key={c.id} tone={estado === c.id ? 'blue' : 'gray'} onClick={() => onEstado?.(c.id)} style={{ cursor: 'pointer', flexShrink: 0 }}>{c.label}</Pill>)}
          <span style={{ width: 1, background: theme.border, flexShrink: 0 }} />
          {[{ key: 'todos', label: 'Todos' }, ...CLIENTES].map((c) => <Pill key={c.key} tone={cliente === c.key ? 'blue' : 'gray'} onClick={() => onCliente?.(c.key)} style={{ cursor: 'pointer', flexShrink: 0 }}>{c.label}</Pill>)}
        </div>
        <CampoBusqueda value={q} onChange={onQ} placeholder="Cliente, folio, nombre o SKU" />
      </div>
      {!grupos.length && <Vacio icon={ClipboardList} color={theme.textMuted} titulo={q || estado !== 'todas' || cliente !== 'todos' ? 'Nada coincide' : 'Sin propuestas'} sub={q || estado !== 'todas' || cliente !== 'todos' ? 'Prueba con otro filtro.' : 'Arma la primera con «Nueva propuesta».'} />}
      {grupos.map((g) => (
        <ListaAgrupada key={g.key} titulo={g.label} meta={`${g.items.length} · ${compact(g.items.reduce((s, p) => s + N(p.resumen?.total), 0))}`} style={{ marginTop: 14 }}>
          {g.items.map((p) => {
            const ef = r.efectividad.get(p.id);
            const res = p.resumen || {};
            const sub = [p.estado === 'borrador' ? (p.updatedAt ? `editada hace ${diasDesde(p.updatedAt, hoy)} d` : 'borrador') : p.enviadaAt ? `enviada hace ${diasDesde(p.enviadaAt, hoy)} d` : null, `${int(res.skus)} SKUs · ${int(res.piezas)} pz`, ef ? `facturó ${ef.skusConvertidos} SKU${ef.skusConvertidos === 1 ? '' : 's'}${ef.pct != null ? ` · ${Math.round(ef.pct)} %` : ''}` : null, p.origen].filter(Boolean).join(' · ');
            const fila = <Fila tono={colorCliente(p.clienteKey, theme)} titulo={`${p.clienteLabel || p.clienteKey} · ${p.folio || p.nombre || 'Cierre'}`} sub={sub} valor={money(res.total)} pill={{ tone: TONO_ESTADO[p.estado] || 'gray', label: ESTADO_LABEL(p.estado) }} onClick={() => onAbrir?.(p)} />;
            return onDuplicar ? <FilaDeslizable key={p.id} acciones={[{ label: 'Duplicar', icon: Copy, color: theme.accent, onClick: () => onDuplicar(p) }, ...(p.estado === 'borrador' ? [{ label: 'Eliminar', icon: Trash2, color: theme.red, onClick: () => onEliminar?.(p) }] : [])]}>{fila}</FilaDeslizable> : <React.Fragment key={p.id}>{fila}</React.Fragment>;
          })}
        </ListaAgrupada>
      ))}
      {onNueva && <div style={{ margin: '18px 16px 0' }}><BotonGrande primario icon={Plus} onClick={onNueva}>Nueva propuesta</BotonGrande></div>}
    </>
  );
}

export default function Propuestas({ inicial = null }) {
  const { theme } = useTheme();
  const nav = useNav();
  const abierto = useRef(false);
  useEffect(() => {
    if (abierto.current || !inicial?.skus?.length) return;
    abierto.current = true;
    nav.push(<PropuestaEditor skusIniciales={inicial.skus} clienteInicial={inicial.clienteKey || null} />, 'propuesta-nueva');
  }, [inicial, nav]);
  const puedeVer = puedeVerPestanaGlobal(nav.perfil, 'propuestas');
  const { data, isLoading, error, refetch } = usePropuestas(puedeVer);
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const [estado, setEstado] = useState('todas');
  const [cliente, setCliente] = useState(inicial?.clienteKey && CLIENTES.some((c) => c.key === inicial.clienteKey) ? inicial.clienteKey : 'todos');
  const [q, setQ] = useState('');
  const r = useMemo(() => (data ? resumenPropuestas({ propuestas: data.modelos, factMap: data.factMap, anio, mes, hoy }) : null), [data, anio, mes, hoy]);
  const abrir = (p) => nav.push(<PropuestaEditor id={p.id} />, `propuesta-${p.id}`);
  const nueva = () => nav.push(<PropuestaEditor clienteInicial={cliente !== 'todos' ? cliente : null} />, 'propuesta-nueva');
  const duplicar = async (p) => {
    try {
      const id = `prp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await guardarPropuesta({ ...p, id, estado: 'borrador', nombre: `${p.nombre || 'Cierre'} (copia)`, tstamp: Date.now(), anio, mes, vigencia: null, enviadaAt: null, cerradaAt: null, folio: null, exportedFilename: null, excelFinal: null });
      toast.ok('Propuesta duplicada como borrador'); refetch(); nav.push(<PropuestaEditor id={id} />, `propuesta-${id}`);
    } catch (e) { toast.error(e?.message || 'No se pudo duplicar'); }
  };
  const eliminar = async (p) => { if (!window.confirm(`¿Eliminar el borrador «${p.nombre || 'Cierre'}» de ${p.clienteLabel || p.clienteKey}?`)) return; try { await eliminarPropuesta(p.id); toast.ok('Borrador eliminado'); refetch(); } catch (e) { toast.error(e?.message || 'No se pudo eliminar'); } };
  const botonNueva = <button type="button" onClick={nueva} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 44, padding: '0 10px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 15, cursor: 'pointer' }}><Plus size={18} strokeWidth={2.4} />Nueva</button>;
  if (!puedeVer) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Propuestas" /><Vacio icon={ClipboardList} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña Propuestas." /></>);
  return (
    <div style={{ paddingBottom: 24 }}>
      <Cabecera onVolver={nav.pop} derecha={botonNueva} />
      <TituloGrande titulo="Propuestas" sub={isLoading ? 'Cargando…' : `${MES_FULL[mes - 1]} ${anio} · Digitalife · PCEL · Dicotech`} />
      {error && <Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar las propuestas" sub={error.message} />}
      {isLoading && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={240} r={12} /></div>}
      {!isLoading && !error && r && <PropuestasVista r={r} propuestas={data.modelos} anio={anio} mes={mes} estado={estado} onEstado={(e) => setEstado((cur) => (cur === e ? 'todas' : e))} cliente={cliente} onCliente={setCliente} q={q} onQ={setQ} onAbrir={abrir} onNueva={nueva} onDuplicar={duplicar} onEliminar={eliminar} hoy={hoy} />}
    </div>
  );
}
