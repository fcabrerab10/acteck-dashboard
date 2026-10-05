// Inventario global en el celular (2026-10-05 · nodo global `inventarioGlobal`; antes abría directo la Ficha de producto).
//
//   Hero: [Inv Actual] del director (a costo si el perfil ve sensible; en piezas si no) · [Dias de Inv] · SKUs agotados
//   + FrescuraPill → 4 KPIs (piezas · críticos/riesgo · sobre-stock · en camino) → Segmented
//   SKUs · Arribos · Agotados · Sobre-stock:
//     · SKUs: buscador por palabras (sin acentos) y lista por valor; tocar → Ficha de producto (canasta de SKUs).
//     · Arribos: una fila por PO ordenada por ETA (piezas, SKUs, naviera, «resuelve N agotados»); tocar → hoja con sus SKUs.
//     · Agotados: sin stock y con demanda ERP (+ críticos < 30 d), con la PO que los cubre o «sin PO».
//     · Sobre-stock: > 90 días de cobertura, por valor.
//
// Datos = los MISMOS de la web: inventario/useInventarioDatos.js (primer viaje sólo `en_inv_actual = true`; después
// descripciones, tránsito, lead time, demanda de 3 meses cerrados y la fila de v_medidas_inventario), agregación pura
// en inventario/agregar.js (agregarSkus · resumenInventario), POs en inventario/arribos.js (agruparPorPO) y tiempos
// reales del Master Embarques en forecast/useEmbarquesTiempos.js. Cobertura por SKU en PIEZAS (ritmo ERP de 3 meses
// cerrados); la del hero es [Dias de Inv] a costo: se muestran las dos con su etiqueta, como en la web.
// `InventarioMVista` es pura: la renderiza scripts/test-movil-tracking-inventario-ssr.mjs.
import React, { useMemo, useState } from 'react';
import { Boxes, Ship, PackageX } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../../lib/permisos';
import { Cargando } from '../../../components/kit';
import FrescuraPill from '../../../components/FrescuraPill';
import { inventarioDesdeVista } from '../../../lib/medidas';
import useInventarioDatos from '../../../modules/comercial/inventario/useInventarioDatos';
import { agregarSkus, resumenInventario } from '../../../modules/comercial/inventario/agregar';
import { agruparPorPO } from '../../../modules/comercial/inventario/arribos';
import { useEmbarquesTiempos, useNavieraPorContenedor, resumen as resumenEmbarques } from '../../../modules/comercial/forecast/useEmbarquesTiempos';
import {
  COBERTURA_CRITICA, COBERTURA_SOBRESTOCK, fmtCompact, fmtInt, fmtDias, fmtFechaCorta, tonoCobertura, etiquetaCobertura, tokensBusqueda, coincideTokens,
} from '../../../modules/comercial/inventario/constantes';
import { useNav } from '../../nav';
import {
  TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, CampoBusqueda, Segmented, Vacio, HojaM, Pill,
} from '../../piezas';
import { MONO } from '../../util';
import FichaProducto from '../../FichaProducto';

const VISTAS = [{ id: 'skus', label: 'SKUs' }, { id: 'arribos', label: 'Arribos' }, { id: 'agotados', label: 'Agotados' }, { id: 'sobre', label: 'Sobre-stock' }];
const PASO = 120;
const TONO_ESTATUS = { 'TRANSITO MARITIMO': 'blue', 'PROXIMO A ZARPAR': 'purple', 'EN RESGUARDO': 'green', 'EN ESPERA DE CONSOLIDAR': 'orange', 'EN PRODUCCION': 'gray', 'Pendiente modular': 'gray' };

const colorTono = (theme, tone) => ({ red: theme.red, orange: theme.orange, green: theme.green, blue: theme.accent, gray: theme.textSubtle || theme.textMuted }[tone] || theme.textMuted);
const etaRelativa = (dias) => (dias == null ? 'sin fecha' : dias < 0 ? `${Math.abs(dias)} d atrás` : dias === 0 ? 'hoy' : `en ${dias} d`);

/** Frase del hero (pura, para la prueba SSR). */
export function fraseInventario(res, sensible) {
  const inv = sensible && res.valor != null ? `${fmtCompact(res.valor)} en inventario comercial` : `${fmtInt(res.piezas)} pz en inventario comercial`;
  const partes = [inv];
  if (res.diasInv != null) partes.push(`${fmtInt(res.diasInv)} días de inventario`);
  let s = partes.join(', ');
  if (res.agotados) s += `; ${fmtInt(res.agotados)} SKU${res.agotados === 1 ? '' : 's'} agotado${res.agotados === 1 ? '' : 's'} con demanda`;
  else if (res.criticos) s += `; ${fmtInt(res.criticos)} en cobertura crítica`;
  return s + '.';
}

/** Fila de SKU (lista principal, agotados, sobre-stock). */
function FilaSku({ r, sensible, onClick, valorSub }) {
  const { theme } = useTheme();
  const tono = r.tieneStock ? tonoCobertura(r.coberturaDias, true) : r.demandaMes > 0 ? 'red' : 'gray';
  const sub = [r.marca || null, r.descripcion || null].filter(Boolean).join(' · ') || '—';
  return (
    <Fila alto={58} tono={colorTono(theme, tono)} onClick={onClick}
      titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{r.sku}</span>} sub={sub}
      valor={sensible ? fmtCompact(r.valor) : `${fmtInt(r.totalPz)} pz`}
      valorSub={valorSub ?? (sensible ? `${fmtInt(r.totalPz)} pz · ${r.tieneStock ? fmtDias(r.coberturaDias) : 'agotado'}` : (r.tieneStock ? `${fmtDias(r.coberturaDias)} · ${etiquetaCobertura(r.coberturaDias, true)}` : 'agotado'))} />
  );
}

/**
 * Vista pura. skuRows = agregarSkus(...) · res = resumenInventario(skuRows, medidas) · pos = agruparPorPO(...) ·
 * real = resumen(proveedores) de useEmbarquesTiempos (puede ser null).
 */
export function InventarioMVista({ skuRows = [], res, pos = [], real = null, sensible = false, enriqueciendo = false, onVerSku, frescura = null, onVolver }) {
  const { theme } = useTheme();
  const [vista, setVista] = useState('skus');
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(PASO);
  const [poAbierta, setPoAbierta] = useState(null);

  const tokens = useMemo(() => tokensBusqueda(q), [q]);
  const ordenados = useMemo(() => [...skuRows].sort((a, b) => (sensible ? b.valor - a.valor : b.totalPz - a.totalPz) || a.sku.localeCompare(b.sku)), [skuRows, sensible]);
  const buscados = useMemo(() => (tokens.length ? ordenados.filter((r) => coincideTokens(r.indice || '', tokens)) : ordenados), [ordenados, tokens]);
  const agotados = useMemo(() => skuRows.filter((r) => r.agotado).sort((a, b) => b.demandaMes - a.demandaMes), [skuRows]);
  const criticos = useMemo(() => skuRows.filter((r) => r.critico).sort((a, b) => (a.coberturaDias ?? 0) - (b.coberturaDias ?? 0)), [skuRows]);
  const sobre = useMemo(() => skuRows.filter((r) => r.sobrestock).sort((a, b) => (sensible ? b.valor - a.valor : b.totalPz - a.totalPz)), [skuRows, sensible]);
  const po = useMemo(() => pos.find((p) => p.po === poAbierta) || null, [pos, poAbierta]);
  const abrirSku = onVerSku ? (sku) => onVerSku(sku) : undefined;

  const stats = [
    sensible && res.valor != null
      ? { k: 'Inv Actual', v: fmtCompact(res.valor), sub: `${fmtInt(res.piezas)} pz a costo` }
      : { k: 'Inv Actual', v: `${fmtInt(res.piezas)} pz`, sub: `${fmtInt(res.conStock)} SKUs con stock` },
    { k: 'Días de inv', v: res.diasInv != null ? fmtInt(res.diasInv) : '—', sub: res.diasInv != null ? 'a costo · 3 m cerrados' : 'sin medida' },
    { k: 'Agotados', v: fmtInt(res.agotados), sub: res.agotados ? 'con demanda ERP' : 'ninguno', color: res.agotados ? theme.red : undefined },
  ];

  let cuerpo = null;
  if (vista === 'skus') {
    const lista = buscados.slice(0, limite);
    cuerpo = (
      <>
        <div style={{ padding: '0 16px 12px' }}><CampoBusqueda value={q} onChange={(v) => { setQ(v); setLimite(PASO); }} placeholder="SKU, descripción, marca o familia" /></div>
        {lista.length === 0
          ? <Vacio icon={Boxes} color={theme.textMuted} titulo="Sin SKUs" sub={q ? `Nada coincide con «${q}».` : 'No hay inventario comercial cargado.'} />
          : (
            <ListaAgrupada titulo={q ? 'Resultados' : sensible ? 'Por valor' : 'Por piezas'} meta={fmtInt(buscados.length)}
              pie={enriqueciendo ? 'Calculando cobertura y tránsito…' : `Cobertura en piezas al ritmo ERP de 3 meses cerrados: crítica < ${COBERTURA_CRITICA} d · sobre-stock > ${COBERTURA_SOBRESTOCK} d. Toca un SKU para ver su ficha.`}>
              {lista.map((r) => <FilaSku key={r.sku} r={r} sensible={sensible} onClick={abrirSku ? () => abrirSku(r.sku) : undefined} />)}
              {buscados.length > limite && (
                <Fila key="mas" alto={44} chevron={false} onClick={() => setLimite((l) => l + PASO)}
                  titulo={<span style={{ color: theme.accent, fontSize: 14 }}>Mostrar {fmtInt(Math.min(PASO, buscados.length - limite))} más</span>} sub={`${fmtInt(limite)} de ${fmtInt(buscados.length)}`} />
              )}
            </ListaAgrupada>
          )}
      </>
    );
  } else if (vista === 'arribos') {
    cuerpo = pos.length === 0
      ? <Vacio icon={Ship} color={theme.textMuted} titulo="Sin embarques pendientes" sub="No hay POs con piezas por llegar." />
      : (
        <ListaAgrupada titulo="Próximos arribos" meta={`${fmtInt(pos.length)} PO · ${fmtInt(pos.reduce((s, p) => s + p.piezas, 0))} pz`}
          pie={real?.transitoMed ? `Tránsito real promedio ${fmtInt(real.transitoMed)} d (ETD → CEDIS de los contenedores ya arribados este año). Toca una PO para ver sus SKUs.` : 'Toca una PO para ver sus SKUs.'}>
          {pos.map((p) => {
            const tone = p.dias == null ? 'gray' : p.dias < 0 ? 'orange' : p.dias <= 7 ? 'green' : 'blue';
            return (
              <Fila key={p.po} alto={60} tono={colorTono(theme, tone)} onClick={() => setPoAbierta(p.po)}
                titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: MONO, fontWeight: 600 }}>PO {p.po}</span>{p.resuelve > 0 && <Pill tone="red" size="xs">resuelve {p.resuelve}</Pill>}</span>}
                sub={[p.cedis || null, `${fmtInt(p.nSkus)} SKU${p.nSkus === 1 ? '' : 's'}`, p.naviera || null, p.diasEnTransito != null ? `navegando ${fmtInt(p.diasEnTransito)} d` : (p.estatus || null)].filter(Boolean).join(' · ')}
                valor={`${fmtInt(p.piezas)} pz`} valorSub={<span style={{ color: colorTono(theme, tone) }}>{fmtFechaCorta(p.eta)} · {etaRelativa(p.dias)}</span>} />
            );
          })}
        </ListaAgrupada>
      );
  } else if (vista === 'agotados') {
    cuerpo = (
      <>
        {agotados.length === 0 && criticos.length === 0 && <Vacio titulo="Nada agotado" sub="Todos los SKUs con demanda tienen stock y más de 30 días de cobertura." />}
        {agotados.length > 0 && (
          <ListaAgrupada titulo="Agotados" meta={agotados.length} style={{ marginBottom: 16 }} pie={`Sin stock y con demanda ERP: se dejan de vender ${fmtInt(res.demandaPerdida)} pz al mes.`}>
            {agotados.map((r) => (
              <FilaSku key={r.sku} r={r} sensible={false} onClick={abrirSku ? () => abrirSku(r.sku) : undefined}
                valorSub={r.transitoPz > 0 ? <span style={{ color: theme.accent }}>llega {fmtFechaCorta(r.transitoEta)} · {fmtInt(r.transitoPz)} pz</span> : <span style={{ color: theme.red }}>sin PO</span>} />
            ))}
          </ListaAgrupada>
        )}
        {criticos.length > 0 && (
          <ListaAgrupada titulo="Críticos" meta={criticos.length} pie={`Menos de ${COBERTURA_CRITICA} días de cobertura · ${fmtInt(res.riesgo)} se agotan antes de que llegue su tránsito.`}>
            {criticos.map((r) => (
              <FilaSku key={r.sku} r={r} sensible={false} onClick={abrirSku ? () => abrirSku(r.sku) : undefined}
                valorSub={<span style={{ color: r.riesgo ? theme.red : theme.orange }}>{fmtDias(r.coberturaDias)}{r.riesgo ? ' · riesgo' : r.transitoPz > 0 ? ` · llega ${fmtFechaCorta(r.transitoEta)}` : ' · sin PO'}</span>} />
            ))}
          </ListaAgrupada>
        )}
      </>
    );
  } else {
    cuerpo = sobre.length === 0
      ? <Vacio titulo="Sin sobre-stock" sub={`Ningún SKU pasa de ${COBERTURA_SOBRESTOCK} días de cobertura.`} />
      : (
        <ListaAgrupada titulo="Sobre-stock" meta={sobre.length} pie={`Más de ${COBERTURA_SOBRESTOCK} días de cobertura al ritmo ERP · ${sensible ? fmtCompact(res.valorSobre) : `${fmtInt(res.piezasSobre)} pz`} en total.`}>
          {sobre.map((r) => <FilaSku key={r.sku} r={r} sensible={sensible} onClick={abrirSku ? () => abrirSku(r.sku) : undefined} valorSub={<span style={{ color: theme.orange }}>{fmtDias(r.coberturaDias)} · {fmtInt(r.demandaMes)} pz/mes</span>} />)}
        </ListaAgrupada>
      );
  }

  return (
    <>
      <Cabecera onVolver={onVolver} />
      <TituloGrande titulo="Inventario" sub={`${fmtInt(res.nSkus)} SKUs comerciales · ${fmtInt(res.conStock)} con stock`} />
      <HeroM eyebrow="Inventario comercial · Acteck" frase={fraseInventario(res, sensible)} stats={stats}>
        {frescura && <div style={{ marginTop: 8 }}>{frescura}</div>}
      </HeroM>

      <KpiGrid style={{ marginTop: 10 }}>
        <KpiM eyebrow="Piezas" big={fmtInt(res.piezas)} sub={res.coberturaPz != null ? `${fmtInt(res.coberturaPz)} d de cobertura en pz` : `${fmtInt(res.conStock)} SKUs con stock`} />
        <KpiM eyebrow="Críticos" big={fmtInt(res.criticos)} bigColor={res.criticos ? theme.orange : undefined} sub={`< ${COBERTURA_CRITICA} d · ${fmtInt(res.riesgo)} en riesgo`} onClick={() => setVista('agotados')} />
        <KpiM eyebrow="Sobre-stock" big={fmtInt(res.sobrestock)} sub={sensible ? `${fmtCompact(res.valorSobre)} · > ${COBERTURA_SOBRESTOCK} d` : `${fmtInt(res.piezasSobre)} pz · > ${COBERTURA_SOBRESTOCK} d`} onClick={() => setVista('sobre')} />
        <KpiM eyebrow="En camino" big={`${fmtInt(res.transitoPz)} pz`} sub={res.transitoPos ? `${fmtInt(res.transitoPos)} PO · próximo ${fmtFechaCorta(res.proximaEta)}` : 'sin embarques pendientes'} onClick={() => setVista('arribos')} />
      </KpiGrid>

      <div style={{ padding: '16px 16px 12px' }}>
        <Segmented size="md" value={vista} onChange={setVista} options={VISTAS.map((v) => ({ ...v, badge: v.id === 'agotados' && res.agotados ? res.agotados : v.id === 'arribos' && pos.length ? pos.length : undefined }))} />
      </div>

      {cuerpo}
      <div style={{ height: 24 }} />

      <HojaM abierto={!!po} onClose={() => setPoAbierta(null)} titulo={po ? `PO ${po.po}` : ''} alto="80vh"
        sub={po ? [fmtFechaCorta(po.eta) ? `ETA ${fmtFechaCorta(po.eta)} · ${etaRelativa(po.dias)}` : null, po.cedis || null, po.contenedor ? `contenedor ${po.contenedor}` : null, po.naviera || null].filter(Boolean).join(' · ') : ''}>
        {po && (
          <ListaAgrupada titulo="SKUs de la PO" meta={`${fmtInt(po.nSkus)} · ${fmtInt(po.piezas)} pz`}
            accion={po.estatus ? <Pill tone={TONO_ESTATUS[po.estatus] || 'gray'} size="xs">{po.estatus}</Pill> : null}
            pie={po.resuelve ? `${fmtInt(po.resuelve)} de estos SKUs están agotados o en cobertura crítica hoy.` : null}>
            {[...po.skus].sort((a, b) => Number(b.necesitado) - Number(a.necesitado) || b.piezas - a.piezas).map((s) => (
              <Fila key={s.sku} alto={56} onClick={abrirSku ? () => { setPoAbierta(null); abrirSku(s.sku); } : undefined}
                tono={s.stock == null ? colorTono(theme, 'gray') : !s.tieneStock ? (s.demandaMes > 0 ? theme.red : colorTono(theme, 'gray')) : colorTono(theme, tonoCobertura(s.coberturaDias, true))}
                titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{s.sku}</span>} sub={s.descripcion || '—'}
                valor={`${fmtInt(s.piezas)} pz`}
                valorSub={s.stock == null ? 'fuera del alcance' : !s.tieneStock ? (s.demandaMes > 0 ? <span style={{ color: theme.red }}>agotado</span> : 'sin stock') : `stock ${fmtInt(s.stock)} · ${fmtDias(s.coberturaDias)}`} />
            ))}
          </ListaAgrupada>
        )}
        <div style={{ height: 24 }} />
      </HojaM>
    </>
  );
}

/** Pantalla conectada (push desde el menú). */
export default function InventarioM() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil() || nav?.perfil;
  const puedeVer = puedeVerPestanaGlobal(perfil, 'inventario_global');
  const sensible = puedeVerSensible(perfil);
  const { filas, loading, enriqueciendo, descripciones, transito, leadTime, demanda, medidas } = useInventarioDatos();
  const navieraPor = useNavieraPorContenedor(puedeVer);
  const { proveedores } = useEmbarquesTiempos(new Date().getFullYear(), puedeVer);
  const real = useMemo(() => resumenEmbarques(proveedores), [proveedores]);

  const skuRows = useMemo(() => agregarSkus(filas, { descripciones, transito, leadTime, demanda }), [filas, descripciones, transito, leadTime, demanda]);
  const res = useMemo(() => resumenInventario(skuRows, inventarioDesdeVista(medidas)), [skuRows, medidas]);
  const porSku = useMemo(() => new Map(skuRows.map((r) => [r.sku, r])), [skuRows]);
  const pos = useMemo(() => agruparPorPO({ transito, porSku, descripciones, navieraPor }), [transito, porSku, descripciones, navieraPor]);

  if (!puedeVer) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Inventario" /><Vacio icon={PackageX} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña Inventario." /></>);
  }
  if (loading) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Inventario" sub="Cargando…" /><Cargando pantalla="movilInventario" /></>);

  const verSku = (sku) => { nav.agregarSku?.(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };

  return (
    <InventarioMVista skuRows={skuRows} res={res} pos={pos} real={real} sensible={sensible} enriqueciendo={enriqueciendo} onVerSku={verSku} onVolver={nav.pop}
      frescura={<FrescuraPill pantalla="inventarioGlobal" inverso detallado />} />
  );
}
