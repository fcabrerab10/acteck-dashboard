// Proyectos y forecast del celular (3.83.0 · 2026-10-05, mockup e0c10be2 pantalla 1 + «una pestaña con la suma de los tres»).
// Es donde se CAPTURA la demanda de cada cliente propio (formato del CRM); S&OP · Mis clientes la convierte en compras.
//   chips Los tres · Digitalife · PCEL · Dicotech → HeroM (frase del forecast) → 4 KpiM (En el CRM · Por capturar ·
//   Borrador · Proyectos) → «Capturar forecast» / «Proyecto» → Forecast SKU × mes (Capturado · Sugerido · Todo; en «Los
//   tres» cada SKU trae el reparto por cliente) → Proyectos de la ventana → Lotes exportados («Ya lo cargué en el CRM»)
//   → «Qué hay que comprar» (S&OP · Mis clientes) → «Exportar plantilla del CRM».
// Datos: forecast/datos.js (las mismas fuentes que la vista Forecast de la web). Proyectos: Proyectos.jsx (push).
import React, { useMemo, useState } from 'react';
import { Lock, Plus, FileText, FileSpreadsheet, CheckCircle2, ShoppingCart, Package } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { ventana as ventanaDe, mesSiguiente } from '../../../modules/comercial/proyectos/forecastCalc';
import { useProyectos } from '../../../modules/comercial/proyectos/datos';
import { PROB_LABEL, CLIENTE_LABEL, claveMes, etiquetaMes } from '../../../modules/comercial/proyectos/calculo';
import { useNav } from '../../nav';
import { Cabecera, TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, BotonGrande, Segmented, Pill, Vacio, HojaM, Skeleton, toast } from '../../piezas';
import { int } from '../../util';
import { fechaCorta } from '../../../lib/format';
import Proyectos from '../Proyectos';
import CapturaForecast from './CapturaForecast';
import { useForecastCliente, exportarLote, marcarCargado, PROPIOS_LISTA, labelDe } from './datos';
import { sumarClientes, fraseForecast, lineaMeses, ORIGEN_LABEL, ORIGEN_TONE } from './calculo';

const CHIPS = [{ key: 'todos', label: 'Los tres' }, ...PROPIOS_LISTA.map((c) => ({ key: c.key, label: c.label }))];
const FILTROS = [{ id: 'capturado', label: 'Capturado' }, { id: 'sugerido', label: 'Sugerido' }, { id: 'todo', label: 'Todo' }];
const N = (v) => Number(v) || 0;

/** Vista pura (SSR en pruebas). */
export function ForecastVista({ estado, clienteSel = 'todos', onCliente, ventana = [], proyectos = [], filtro = 'capturado', onFiltro, puedeEditar = false, onCapturar, onProyecto, onNuevoProyecto, onExportar, onMarcarCargado, onSop, exportando = false, sugeridoTotal = null }) {
  const { theme } = useTheme();
  const [todas, setTodas] = useState(false);
  const r = estado.resumen;
  const filas = useMemo(() => estado.filas.filter((f) => (filtro === 'todo' ? true : filtro === 'sugerido' ? f.origen === 'sugerido' : f.origen !== 'sugerido')), [estado.filas, filtro]);
  const visibles = todas ? filas : filas.slice(0, 40);
  const sub = [sugeridoTotal ? `Sugerido del dashboard: ${sugeridoTotal.skus} SKUs · ${int(sugeridoTotal.pz)} pz` : null, r.lotes.ultimo ? `última exportación ${fechaCorta(String(r.lotes.ultimo.created_at).slice(0, 10))}` : 'sin exportaciones'].filter(Boolean).join(' · ');
  return (
    <>
      <HeroM eyebrow={`${estado.key === 'todos' ? 'Los tres clientes' : estado.label} · forecast a ${ventana.length} meses`} frase={fraseForecast(estado)} sub={sub} />
      <KpiGrid data-entrada-kpis style={{ marginTop: 10 }}>
        <KpiM eyebrow="En el CRM" big={`${int(r.enCrm.skus)} SKU${r.enCrm.skus === 1 ? '' : 's'}`} sub={r.enCrm.skus ? `${int(r.enCrm.pz)} pz · ya enviados` : 'nada enviado para esta ventana'} />
        <KpiM eyebrow="Por capturar" big={`${int(r.porCapturar.skus)} SKU${r.porCapturar.skus === 1 ? '' : 's'}`} bigColor={r.porCapturar.skus ? theme.orange : undefined} sub={r.porCapturar.skus ? `${int(r.porCapturar.pz)} pz sugeridas · ${r.diasLimite === 0 ? 'hoy es el día 10' : `día 10 en ${r.diasLimite} d`}` : 'todo lo sugerido está capturado'} onClick={puedeEditar ? () => onCapturar?.(null, null) : undefined} />
        <KpiM eyebrow="Borrador" big={`${int(r.borrador.skus)} SKU${r.borrador.skus === 1 ? '' : 's'}`} bigColor={r.borrador.skus ? theme.orange : undefined} sub={r.borrador.skus ? `${int(r.borrador.pz)} pz sin exportar` : 'nada pendiente de exportar'} onClick={r.borrador.skus && puedeEditar ? onExportar : undefined} />
        <KpiM eyebrow="Proyectos" big={int(r.proyectos.n)} sub={r.proyectos.n ? `${int(r.proyectos.pz)} pz en la ventana${r.proyectos.confirmados ? ` · ${r.proyectos.confirmados} confirmado${r.proyectos.confirmados === 1 ? '' : 's'}` : ''}` : 'sin proyectos en la ventana'} />
      </KpiGrid>
      {puedeEditar && (
        <div style={{ display: 'flex', gap: 8, margin: '12px 16px 0' }}>
          <BotonGrande primario icon={Plus} onClick={() => onCapturar?.(null, null)} style={{ flex: 1 }}>Capturar forecast</BotonGrande>
          <BotonGrande icon={Package} onClick={onNuevoProyecto}>Proyecto</BotonGrande>
        </div>
      )}

      <div style={{ padding: '0 16px', marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 6px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text }}>Forecast · SKU × mes <span style={{ color: theme.textMuted, fontWeight: 500 }}>· {filas.length}</span></span>
          <Segmented value={filtro} onChange={onFiltro} options={FILTROS} />
        </div>
      </div>
      <ListaAgrupada pie={filtro === 'sugerido' ? 'Sugerido = ritmo de 3 meses cerrados × estacionalidad − inventario en exceso en el cliente + proyectos. Toca uno para capturarlo.' : 'Toca un SKU para editar sus piezas o su justificación.'}>
        {!visibles.length && <Vacio icon={FileText} color={theme.textMuted} titulo={filtro === 'sugerido' ? 'Nada sugerido por capturar' : 'Sin forecast capturado'} sub={filtro === 'sugerido' ? 'Todo lo que el dashboard sugiere ya está en el CRM o en borrador.' : 'Captura el primero con el botón de arriba o acepta los sugeridos.'} style={{ padding: '20px 16px' }} />}
        {visibles.map((f) => {
          const reparto = estado.key === 'todos' && f.porCliente?.length ? f.porCliente.map((c) => `${c.label} ${int(c.pz)}`).join(' · ') : null;
          const cli = estado.key === 'todos' ? (f.porCliente?.length === 1 ? f.porCliente[0].key : null) : estado.key;
          return <Fila key={f.sku} titulo={`${f.sku}${f.descripcion ? ` ${f.descripcion}` : ''}`} sub={reparto ? `${reparto} · ${lineaMeses(f.meses, ventana, { max: 3 })}` : lineaMeses(f.meses, ventana)} valor={`${int(f.total)} pz`}
            pill={{ tone: ORIGEN_TONE[f.origen] || 'gray', label: ORIGEN_LABEL[f.origen] || f.origen }} onClick={puedeEditar ? () => onCapturar?.(f.sku, cli) : undefined} chevron={puedeEditar} />;
        })}
        {filas.length > 40 && !todas && <Fila titulo={`Mostrar los ${filas.length}`} chevron={false} onClick={() => setTodas(true)} tono={theme.accent} />}
      </ListaAgrupada>

      <ListaAgrupada titulo="Proyectos" meta={proyectos.length ? `${proyectos.length} en la ventana` : undefined} style={{ marginTop: 18 }} accion={puedeEditar ? <Pill tone="blue" onClick={onNuevoProyecto} style={{ cursor: 'pointer' }}>＋ Proyecto</Pill> : null}>
        {!proyectos.length && <Fila icon={Package} color={theme.textMuted} titulo="Sin proyectos en la ventana" sub="Un proyecto es una venta comprometida: cliente, mes y SKUs. Sus piezas se suman al forecast sugerido." chevron={false} />}
        {proyectos.map((p) => <Fila key={p.id} titulo={p.nombre} sub={`${CLIENTE_LABEL[p.cliente] || p.cliente} · ${etiquetaMes(p.anio, p.mes)} · ${PROB_LABEL[p.probabilidad] || p.probabilidad}`} valor={`${int(p.pz)} pz`} valorSub={p.skus ? `${p.skus} SKU${p.skus === 1 ? '' : 's'}` : null} onClick={() => onProyecto?.(p.id)} />)}
      </ListaAgrupada>

      {estado.lotesLista?.length > 0 && (
        <ListaAgrupada titulo="Lotes exportados al CRM" meta={estado.lotesLista.length} style={{ marginTop: 18 }} pie="Al marcar un lote como cargado, sus SKUs pasan a la copia del CRM y el sugerido deja de proponerlos.">
          {estado.lotesLista.slice(0, 6).map((l) => (
            <Fila key={l.id} icon={FileSpreadsheet} color={l.cargado_crm_at ? theme.green : theme.orange} titulo={l.archivo_nombre || `Lote ${String(l.id).slice(0, 6)}`}
              sub={`${fechaCorta(String(l.created_at).slice(0, 10))} · ${int(l.filas)} SKU${N(l.filas) === 1 ? '' : 's'} · ${(l.clientes || []).map(labelDe).join(', ')}`} chevron={false}
              trailing={l.cargado_crm_at ? <Pill tone="green" size="xs">cargado</Pill> : (puedeEditar ? <button type="button" onClick={() => onMarcarCargado?.(l)} style={{ flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 999, border: 0, background: `${theme.accent}1A`, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} />Ya lo cargué</button> : <Pill tone="orange" size="xs">sin cargar</Pill>)} />
          ))}
        </ListaAgrupada>
      )}

      <ListaAgrupada style={{ marginTop: 18 }}>
        <Fila icon={ShoppingCart} color={theme.accent} titulo="Qué hay que comprar" sub="S&OP · Mis clientes: forecast − inventario del cliente − nuestro stock − tránsito" onClick={onSop} />
      </ListaAgrupada>
      {puedeEditar && r.borrador.skus > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <BotonGrande icon={FileSpreadsheet} disabled={exportando} onClick={onExportar}>{exportando ? 'Generando…' : `Exportar plantilla del CRM · ${r.borrador.skus}`}</BotonGrande>
        </div>
      )}
    </>
  );
}

export default function ForecastM({ inicial = null }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil();
  const puedeVer = puedeVerPestanaGlobal(perfil, 'forecast_reservas');
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'forecast_reservas');
  const yoId = perfil?.user_id || perfil?.id || null;
  const hoy = useMemo(() => new Date(), []);
  const ventana = useMemo(() => ventanaDe(mesSiguiente(hoy), 6), [hoy]);
  const [clienteSel, setClienteSel] = useState(inicial?.cliente && PROPIOS_LISTA.some((c) => c.key === inicial.cliente) ? inicial.cliente : 'todos');
  const [filtro, setFiltro] = useState('capturado');
  const [exportando, setExportando] = useState(false);
  const [elegirCliente, setElegirCliente] = useState(false);
  const a = useForecastCliente('digitalife', ventana, { enabled: puedeVer, hoy });
  const b = useForecastCliente('pcel', ventana, { enabled: puedeVer, hoy });
  const c = useForecastCliente('dicotech', ventana, { enabled: puedeVer, hoy });
  const porKey = { digitalife: a, pcel: b, dicotech: c };
  const { data: pr } = useProyectos();
  const loading = a.loading || b.loading || c.loading;
  const estado = useMemo(() => {
    const e = clienteSel === 'todos' ? sumarClientes([a.estado, b.estado, c.estado]) : porKey[clienteSel].estado;
    const lotes = (a.lotes || []).filter((l) => clienteSel === 'todos' || (l.clientes || []).includes(clienteSel));
    return { ...e, lotesLista: lotes };
  }, [clienteSel, a.estado, b.estado, c.estado, a.lotes]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugeridoTotal = useMemo(() => { const ls = clienteSel === 'todos' ? [a, b, c] : [porKey[clienteSel]]; const skus = ls.reduce((s, x) => s + x.sugerido.length, 0); return skus ? { skus, pz: ls.reduce((s, x) => s + x.sugerido.reduce((t, f) => t + N(f.total), 0), 0) } : null; }, [clienteSel, a.sugerido, b.sugerido, c.sugerido]); // eslint-disable-line react-hooks/exhaustive-deps
  const proyectos = useMemo(() => {
    const keys = new Set(ventana.map((m) => m.key));
    const lineas = pr?.lineas || [];
    return (pr?.proyectos || []).filter((p) => p.anio && p.mes && keys.has(claveMes(p.anio, p.mes)) && (clienteSel === 'todos' || p.cliente === clienteSel) && p.probabilidad !== 'cancelado')
      .map((p) => { const ls = lineas.filter((l) => l.proyecto_id === p.id); return { ...p, pz: ls.reduce((s, l) => s + N(l.piezas), 0), skus: ls.length }; });
  }, [pr, ventana, clienteSel]);

  const capturar = (sku, cliente) => nav.push(<CapturaForecast clienteInicial={cliente || (clienteSel === 'todos' ? 'digitalife' : clienteSel)} skuInicial={sku} ventana={ventana} yoId={yoId} />, `captura-${cliente || clienteSel}-${sku || 'nuevo'}`);
  const exportar = async (cliente) => {
    const ck = cliente || (clienteSel === 'todos' ? null : clienteSel);
    if (!ck) { setElegirCliente(true); return; }
    const filas = porKey[ck].estado.filas.filter((f) => f.origen === 'borrador');
    if (!filas.length) { toast.info(`${labelDe(ck)} no tiene borradores que exportar`); return; }
    setExportando(true); setElegirCliente(false);
    try { const r = await exportarLote({ cliente: ck, filas, ventana, yoId }); toast.ok(r.resultado === 'share' ? `${r.nombre} compartido · ${r.n} SKUs` : `${r.nombre} · ${r.n} SKUs · súbelo en el CRM con «Cargar Excel»`); }
    catch (e) { toast.error(`No se pudo exportar: ${e?.message || e}`); }
    finally { setExportando(false); }
  };
  const marcar = async (l) => { try { const n = await marcarCargado(l.id); toast.ok(`Lote marcado como cargado · ${n} filas ya no se sugieren`); } catch (e) { toast.error(e?.message || 'No se pudo marcar'); } };

  if (!puedeVer) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Proyectos y forecast" /><Vacio icon={Lock} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene esta pestaña." /></>);
  return (
    <div style={{ paddingBottom: 24 }}>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Proyectos y forecast" sub={`${ventana[0].label} → ${ventana[ventana.length - 1].label} · ventana del CRM`} />
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px 10px' }}>
        {CHIPS.map((ch) => <Pill key={ch.key} tone={clienteSel === ch.key ? 'blue' : 'gray'} onClick={() => setClienteSel(ch.key)} style={{ cursor: 'pointer', flexShrink: 0 }}>{ch.label}</Pill>)}
      </div>
      {loading ? <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={120} r={12} /><Skeleton h={220} r={12} /></div> : (
        <ForecastVista estado={estado} clienteSel={clienteSel} ventana={ventana} proyectos={proyectos} filtro={filtro} onFiltro={setFiltro} puedeEditar={puedeEditar} exportando={exportando} sugeridoTotal={sugeridoTotal}
          onCapturar={capturar} onProyecto={(id) => nav.push(<Proyectos inicial={{ proyectoId: id }} />, `proyectos-${id}`)} onNuevoProyecto={() => nav.push(<Proyectos inicial={{ nuevo: true }} />, 'proyectos-nuevo')}
          onExportar={() => exportar(null)} onMarcarCargado={marcar} onSop={() => nav.navegar({ pagina: 'forecastClientes', extra: { vista: 'clientes' } })} />
      )}
      <HojaM abierto={elegirCliente} onClose={() => setElegirCliente(false)} titulo="Exportar plantilla del CRM" sub="La plantilla se arma por cliente. ¿Cuál?" alto="40vh">
        <ListaAgrupada>
          {PROPIOS_LISTA.map((cl) => { const n = porKey[cl.key].estado.filas.filter((f) => f.origen === 'borrador').length; return <Fila key={cl.key} titulo={cl.label} sub={n ? `${n} SKU${n === 1 ? '' : 's'} en borrador` : 'sin borradores'} onClick={n ? () => exportar(cl.key) : undefined} chevron={!!n} />; })}
        </ListaAgrupada>
      </HojaM>
    </div>
  );
}
