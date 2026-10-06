// Página de UN cliente del ERP en el celular (3.79.0 · 2026-10-05, mockup scratchpad/analisis-movil.html pantalla 2).
// Cabecera «‹ Análisis por cliente» · nombre · «canal · código · atiende <vendedor> · compra cada N días» · Segmented
// Resumen · Sell In · Sell Out (las pestañas viven en analisis/Pestanas.jsx).
// Resumen: HeroM con la frase del mes (cuota, YoY a mismo día, SO/SI, semanas de inventario) y barra de cuota → 4 KpiM
// (sell in del mes con cuota · sell out del mes con SO/SI · inventario en el cliente · última compra y ritmo) → gráfica
// sell in vs sell out del año con cuota punteada (GraficaScrub) → «Dónde está el movimiento» (movimiento.js) →
// Categorías como pay Sell in · Sell out (PayM) → Cuotas por trimestre → Compartir ficha. Los top 10 SKUs se fueron.
// Datos (8 consultas chicas): mv_analisis_cliente_mes del cliente (24 filas) · v_cuota_erp_mes · v_ventas_vendedor_cliente_mes ·
// mv_sellin_cliente_dia · v_sellout_cuenta_mes (cuenta ligada por CUENTA_POR_ERP) · mv_analisis_cliente_sku_mes ·
// mv_sellout_cuenta_sku_mes de la cuenta · roadmap_sku (descripciones, ya en cache).
import React, { useMemo, useState } from 'react';
import { Share2, Copy } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { useRoadmap } from '../../lib/queries';
import { puedeVerSensible } from '../../lib/permisos';
import { canalLabel } from '../../modules/general/inicio/config';
import { textoFichaCliente, compartir, copiar } from '../../lib/whatsapp';
import { GraficaLineas } from '../../components/kit';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, Cabecera, Skeleton, Vacio, HojaM, BotonGrande, TituloSeccionM, Segmented, GraficaScrub, LeyendaScrub, PayM, ChipsPay, BarraCuotaM, toast } from '../piezas';
import { PROPIOS, nombreCliente, colorCliente } from '../datos';
import { moneyCompact, int, deltaPct, MESES, MONO, N } from '../util';
import { useCuotasClientes, useSellInDia, useDetalleCliente } from '../../modules/comercial/analisis/useAnalisisData';
import { mapaCuotas, cuotaPeriodo, alcanceCuota, idxMes, yoyDe } from '../../modules/comercial/analisis/calc';
import { movimientos } from '../../modules/comercial/analisis/movimiento';
import { useMensual, useDrillSkus, CUENTA_POR_ERP } from '../../modules/comercial/sellout/datos';
import { useCodigoErp, useClienteMes, useVendedorCliente } from './analisis/datos';
import { fraccionMes, ritmoCompras, sellOutMesCuenta, serieAnioSiSo, fraseCliente } from './analisis/calculo';
import { SellInM, SellOutM, CuotasTrimestreM, MovimientoM } from './analisis/Pestanas';

const PESTANAS = [{ id: 'resumen', label: 'Resumen' }, { id: 'sellin', label: 'Sell In' }, { id: 'sellout', label: 'Sell Out' }];

/** Nombre display: "CT INTERNACIONAL DEL NOROESTE" → "Ct Internacional Del Noroeste" (siglas ≤ 3 letras se respetan). */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en', 'sa', 'cv', 'sapi']);
export const nombreBonito = (s) => String(s || '').trim().toLowerCase().split(/\s+/).map((w, i) => {
  if (PARTICULAS.has(w) && i > 0) return w === 'sa' || w === 'cv' || w === 'sapi' ? w.toUpperCase() : w;
  if (w.length <= 3 && /^[a-z]+$/.test(w)) return w.toUpperCase();
  return w.replace(/^(\S)/, (c) => c.toUpperCase());
}).join(' ');

/** Gráfica mínima de 12 meses (kit GraficaLineas compacto) con el mes actual resaltado. La usa Visión General móvil. */
export function MiniLineas({ serie, fmt = moneyCompact, alto = 150, nombre = 'Monto' }) {
  const { theme } = useTheme();
  return (
    <div style={{ margin: '0 16px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 8px 4px' }}>
      <GraficaLineas compacto datos={serie.map((s) => ({ x: s.label, v: s.v }))} series={[{ key: 'v', label: nombre, tipo: 'principal' }]}
        formato={fmt} alto={alto} mesActivo={serie.findIndex((s) => s.actual)} cabecera />
    </div>
  );
}

const norm = (s) => String(s || 'Sin categoría').trim();

/** Vista pura del Resumen (sin red): la prueba scripts/test-analisis-movil-ssr.mjs. */
export function ResumenVista({ nombre, anio, mes, enCurso, mtd, yoyMes, cuotaMes, so, ritmo, serie, movs, catSi, catSo, mensual, cuotasRows, codigo, onCompartir }) {
  const { theme } = useTheme();
  const [dimCat, setDimCat] = useState('si');
  const mesL = MESES[mes - 1];
  const pctCuota = alcanceCuota(mtd, cuotaMes);
  const frase = fraseCliente({ nombre, anio, mes, mtd, pctCuota, yoy: yoyMes, soSi: so?.soSi ?? null, semanas: so?.semanas ?? null, enCurso });
  const gris = theme.textSubtle || theme.textMuted;
  const series = [
    { key: 'cuota', label: 'Cuota', color: theme.orange, dash: true },
    { key: 'so', label: 'Sell out', color: theme.purple || theme.indigo || theme.accent },
    { key: 'si', label: 'Sell in', color: theme.accent, area: true, grosor: 2.6 },
  ];
  const tooltip = (f) => (
    <>
      <b style={{ fontSize: 12.5 }}>{f.label}{f.enCurso ? ' ·' : ''}</b> · sell in <b style={{ fontSize: 12.5 }}>{f.si != null ? moneyCompact(f.si) : '—'}</b>{f.so != null ? ` · sell out ${moneyCompact(f.so)}` : ''}<br />
      {f.soSi != null ? `SO/SI ${f.soSi.toFixed(2)}` : ''}{f.cuota ? `${f.soSi != null ? ' · ' : ''}cuota ${moneyCompact(f.cuota)}${f.si != null && f.cuota > 0 ? ` (${Math.round((f.si / f.cuota) * 100)} %)` : ''}` : ''}
    </>
  );
  const catFilas = dimCat === 'si' ? catSi : catSo;
  return (
    <>
      <HeroM eyebrow={`${mesL} ${anio}${enCurso ? ' · a mismo día' : ''}`} frase={frase}>
        <BarraCuotaM valor={mtd} cuota={cuotaMes} label={`cuota de ${mesL.toLowerCase()}`} />
      </HeroM>
      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow={`Sell in · ${mesL.toLowerCase()}`} big={moneyCompact(mtd)} sub={<span>{yoyMes != null ? <><span style={{ color: yoyMes >= 0 ? theme.green : theme.red }}>{deltaPct(yoyMes)}</span> vs {anio - 1}</> : `sin ${anio - 1}`}{cuotaMes ? ` · ${Math.round(pctCuota)} % de ${moneyCompact(cuotaMes)}` : ''}</span>} />
        <KpiM eyebrow={`Sell out · ${so?.mesUsado ? MESES[so.mesUsado - 1].toLowerCase() : mesL.toLowerCase()}${so?.esOtroMes ? ' (último)' : ''}`} big={so && so.reporta ? moneyCompact(so.importe) : '—'} sub={so && so.reporta ? <span>{so.soSi != null ? `SO/SI ${(so.soSi / 100).toFixed(2)}` : 'sin sell in ese mes'}{so.yoy != null ? <> · <span style={{ color: so.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(so.yoy)}</span></> : ''}</span> : 'no reporta sell out'} />
        <KpiM eyebrow={`Inventario en ${nombre.split(' ')[0]}`} big={so && so.invPiezas != null ? (so.semanas != null ? `${Math.round(so.semanas)} sem` : `${int(so.invPiezas)} pz`) : '—'} sub={so && so.invPiezas != null ? `${so.invValor ? `${moneyCompact(so.invValor)} · ` : ''}${int(so.invPiezas)} pz${so.invMes && (so.invMes.mes !== mes || so.invMes.anio !== anio) ? ` · ${MESES[so.invMes.mes - 1].toLowerCase()}` : ''}` : 'no reporta inventario'} />
        <KpiM eyebrow="Última compra" big={ritmo?.diasDesde == null ? '—' : ritmo.diasDesde === 0 ? 'hoy' : `hace ${ritmo.diasDesde} d`} sub={ritmo?.diasDesde == null ? 'sin facturas en dos años' : `${ritmo.cadaDias ? `cada ${ritmo.cadaDias} días` : 'una sola compra en 6 m'}${ritmo.mesFacturas ? ` · ${int(ritmo.facturasMes)} factura${ritmo.facturasMes === 1 ? '' : 's'} en ${MESES[ritmo.mesFacturas.mes - 1].toLowerCase()}` : ''}`} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">Sell in vs sell out · {anio}</TituloSeccionM>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
        <GraficaScrub series={series} datos={serie} formato={moneyCompact} tooltip={tooltip} activo={enCurso ? mes - 1 : null} />
        <LeyendaScrub items={[{ label: 'Sell in', color: theme.accent }, ...(so ? [{ label: 'Sell out', color: theme.purple || theme.indigo || theme.accent }] : []), ...(serie.some((f) => f.cuota) ? [{ label: 'Cuota', color: theme.orange, dash: true }] : [])]} />
      </div>

      <MovimientoM titulo="Dónde está el movimiento" movs={movs} meta={`${movs.mesLbl || mesL.toLowerCase()} vs ${movs.mesPrevLbl} · en pesos`} nota="Lo que más subió y lo que más bajó en este cliente respecto al mes anterior, mezclando SKUs y categorías." />

      <div style={{ padding: '0 16px' }}>
        <PayM titulo="Categorías" filas={catFilas} formato={moneyCompact} centro={`YTD ${dimCat === 'si' ? 'SI' : 'SO'}`} vacio={dimCat === 'si' ? 'Sin sell in en el año.' : (so ? 'Sin sell out en el año.' : 'Este cliente no reporta sell out.')}
          acciones={<ChipsPay opciones={[['si', 'Sell in'], ['so', 'Sell out']]} value={dimCat} onChange={setDimCat} />} />
      </div>

      {codigo && <CuotasTrimestreM mensual={mensual} cuotasRows={cuotasRows} codigo={codigo} anio={anio} mes={mes} />}

      {onCompartir && <div style={{ padding: '18px 16px 0' }}><BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir ficha</BotonGrande></div>}
    </>
  );
}

export default function AnalisisFicha({ codigo: codigoProp, clienteNombre, canal, label }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const [pestana, setPestana] = useState('resumen');
  const [compartiendo, setCompartiendo] = useState(false);
  const { data: codigoBuscado, isLoading: lCod } = useCodigoErp(clienteNombre, anio, !codigoProp);
  const codigo = codigoProp || codigoBuscado || null;
  const cuenta = codigo ? (CUENTA_POR_ERP[codigo] || null) : null;
  const sensible = puedeVerSensible(nav.perfil);

  const { data: rows = [], isLoading: lMes, error } = useClienteMes(codigo, anio);
  const { data: cuotasRows = [] } = useCuotasClientes(anio);
  const { data: vendedor } = useVendedorCliente(codigo, anio);
  const { data: diario = [] } = useSellInDia(codigo, anio, !!codigo);
  const { data: soMensual = [] } = useMensual(cuenta ? anio : null);
  const { data: detalle = [] } = useDetalleCliente(codigo, anio, !!codigo);
  const { data: skusSo = [] } = useDrillSkus(cuenta, anio, !!cuenta);
  const { data: roadmap } = useRoadmap();
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);

  const info = useMemo(() => {
    const r0 = rows.find((r) => N(r.anio) === anio) || rows[0] || {};
    const ck = r0.cliente_key || null;
    return { ck, propio: PROPIOS.includes(ck), canal: r0.canal || canal || null };
  }, [rows, anio, canal]);
  const nombre = label || (info.propio ? nombreCliente(info.ck) : nombreBonito(clienteNombre || rows[0]?.cliente_nombre));

  const mensual = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { const k = idxMes(r.anio, r.mes); const o = m.get(k) || { fact_neta: 0, contribucion: 0, piezas: 0, fact_bruta: 0, devoluciones: 0, rmas: 0, bonificaciones: 0 }; o.fact_neta += N(r.fact_neta); o.contribucion += N(r.contribucion); o.piezas += N(r.piezas_venta_neta); o.fact_bruta += N(r.fact_bruta); o.devoluciones += N(r.devoluciones); o.rmas += N(r.rmas); o.bonificaciones += N(r.bonificaciones); m.set(k, o); });
    return m;
  }, [rows]);
  const mapa = useMemo(() => mapaCuotas(cuotasRows), [cuotasRows]);
  const ritmo = useMemo(() => ritmoCompras(diario, hoy), [diario, hoy]);

  const r = useMemo(() => {
    if (!rows.length && !codigo) return null;
    const kMes = idxMes(anio, mes), factor = fraccionMes(anio, mes, hoy);
    const mtd = N(mensual.get(kMes)?.fact_neta), prev = N(mensual.get(kMes - 12)?.fact_neta) * factor;
    const cuotaMes = cuotaPeriodo(mapa, codigo, anio, mes, 'mes');
    const so = cuenta ? sellOutMesCuenta(soMensual, cuenta, anio, mes, hoy) : null;
    const serie = serieAnioSiSo({ mensual, soMensual, cuenta, mapa, codigo, anio, hoy });
    // Movimiento: SKUs (descripción del roadmap) + categorías (roadmap o ERP) del mes vs el anterior.
    const catDe = (sku, r2) => norm(rd.get(sku)?.categoria || r2?.categoria);
    const porCat = new Map();
    detalle.forEach((x) => { const c = catDe(x.articulo, x); const k = `${x.anio}-${x.mes}-${c}`; const o = porCat.get(k) || { anio: x.anio, mes: x.mes, categoria: c, fact_neta: 0 }; o.fact_neta += N(x.fact_neta); porCat.set(k, o); });
    const categoriaDe = {}; detalle.forEach((x) => { categoriaDe[x.articulo] = catDe(x.articulo, x); });
    // Con menos de 10 días del mes en curso el «movimiento» compara el último mes cerrado contra el anterior (si no, todo sale «en oct nada»).
    const pocoMes = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1 && hoy.getDate() < 10;
    const [mAnio, mMes] = pocoMes ? (mes === 1 ? [anio - 1, 12] : [anio, mes - 1]) : [anio, mes];
    const movs = { ...movimientos({
      grupos: [
        { tipo: 'SKU', filas: detalle, clave: 'articulo', valor: 'fact_neta', piezas: 'piezas_venta_neta', etiqueta: (k) => rd.get(k)?.descripcion || '' },
        { tipo: 'Categoría', filas: [...porCat.values()], clave: 'categoria', valor: 'fact_neta' },
      ], anio: mAnio, mes: mMes, top: 6, categoriaDe,
    }), mesLbl: MESES[mMes - 1].toLowerCase() };
    // Categorías YTD: sell in del cliente y sell out de la cuenta ligada.
    const si = new Map(), soCat = new Map();
    detalle.forEach((x) => { if (N(x.anio) !== anio || N(x.mes) > mes) return; const c = catDe(x.articulo, x); si.set(c, N(si.get(c)) + N(x.fact_neta)); });
    skusSo.forEach((x) => { if (N(x.anio) !== anio || N(x.mes) > mes) return; const c = norm(x.categoria); soCat.set(c, N(soCat.get(c)) + N(x.importe)); });
    const top5 = (() => { const m = new Map(); detalle.forEach((x) => { if (N(x.anio) !== anio) return; const o = m.get(x.articulo) || { sku: x.articulo, piezas: 0, monto: 0, descripcion: rd.get(x.articulo)?.descripcion || '' }; o.piezas += N(x.piezas_venta_neta); o.monto += N(x.fact_neta); m.set(x.articulo, o); }); return [...m.values()].sort((a, b) => b.monto - a.monto).slice(0, 5); })();
    const ytd = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + a.fact_neta, 0);
    const ytdPrev = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio - 1 && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + a.fact_neta, 0);
    return { mtd, yoyMes: yoyDe(mtd, prev), cuotaMes, so, serie, movs, catSi: [...si].map(([label2, v]) => ({ label: label2, v })), catSo: [...soCat].map(([label2, v]) => ({ label: label2, v })), top5, ytd, yoyYtd: yoyDe(ytd, ytdPrev), enCurso: anio === hoy.getFullYear() && mes === hoy.getMonth() + 1 };
  }, [rows, codigo, mensual, mapa, cuenta, soMensual, detalle, skusSo, rd, anio, mes, hoy]);

  const texto = useMemo(() => (r ? textoFichaCliente({ cliente: nombre, mes, anio, mtd: r.mtd, ytd: r.ytd, yoyYtd: r.yoyYtd, top: r.top5 }) : ''), [r, nombre, mes, anio]);
  const onCompartir = async () => { const res = await compartir(texto, { titulo: `Ficha ${nombre}` }); if (res === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (await copiar(texto)) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };

  const color = info.propio ? colorCliente(info.ck, theme) : theme.textMuted;
  const sub = [canalLabel(info.canal || 'otros'), codigo ? `código ${codigo}` : null, vendedor ? `atiende ${nombreBonito(vendedor)}` : null, ritmo.cadaDias ? `compra cada ${ritmo.cadaDias} días` : null].filter(Boolean).join(' · ');
  const cargando = lCod || (lMes && !rows.length);
  return (
    <div data-stagger>
      <Cabecera onVolver={nav.pop} etiqueta="Análisis por cliente" />
      <TituloGrande titulo={nombre} sub={<><span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block', flexShrink: 0 }} /><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span></>} />
      <div style={{ padding: '0 20px 10px' }}><Segmented value={pestana} onChange={setPestana} options={PESTANAS} /></div>
      {error && <Vacio titulo="No se pudo cargar el cliente" sub={error.message} color={theme.red} />}
      {!error && !codigo && !lCod && <Vacio titulo="Cliente sin código en el ERP" sub="No hay ventas con ese nombre en los dos últimos años." />}
      {cargando && !error && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={200} r={12} /></div>}
      {!cargando && r && pestana === 'resumen' && (
        <ResumenVista nombre={nombre} anio={anio} mes={mes} enCurso={r.enCurso} mtd={r.mtd} yoyMes={r.yoyMes} cuotaMes={r.cuotaMes} so={r.so} ritmo={ritmo} serie={r.serie} movs={r.movs}
          catSi={r.catSi} catSo={r.catSo} mensual={mensual} cuotasRows={cuotasRows} codigo={codigo} onCompartir={() => setCompartiendo(true)} />
      )}
      {!cargando && r && pestana === 'sellin' && <SellInM codigo={codigo} mensual={mensual} detalle={detalle} diario={diario} cuotasRows={cuotasRows} anio={anio} mes={mes} sensible={sensible} rd={rd} />}
      {!cargando && r && pestana === 'sellout' && <SellOutM codigo={codigo} nombre={nombre} anio={anio} propio={info.propio} clienteKey={info.ck} />}

      <HojaM abierto={compartiendo} onClose={() => setCompartiendo(false)} titulo="Compartir ficha" sub="Texto limpio · sin alertas, márgenes ni cartera" alto="70vh">
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>
          <BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} onClick={onCopiar}>Copiar texto</BotonGrande>
        </div>
      </HojaM>
    </div>
  );
}

