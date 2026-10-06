// Pagos de un cliente propio en el celular (3.85.0 · 2026-10-06, mockup f2336912 + «que yo pueda elegir cuánto porcentaje
// se le paga sobre qué o hacer un apoyo para un producto específico»). Uso interno: sólo con permiso de Pagos del cliente.
//   HeroM (le debemos este mes · rebate · apoyos · vencidos) → 4 KpiM (Por pagar · Rebate del período · Apoyos por producto ·
//   Fondo) → Flujo del mes en 5 etapas tocables (filtran) → lista de pagos con la siguiente acción (DetallePago: solicitar,
//   autorizar, folio, registrar) → «＋ Apoyo por producto» (HojaApoyoM) → Apoyos por SKU · costo convenio (registrar de un
//   toque) → Reglas editables (HojaReglasM: % y base del rebate por niveles o por categoría, SPIFF) → pagado por mes en línea.
// Mismas tablas y motor que la pantalla global (pagosv3): pagos, pagos_reglas (RPC pagos_guardar_regla), v_apoyos_convenio.
import React, { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Check, Trash2, Lock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { useNav } from '../../nav';
import { HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, BotonGrande, Pill, Vacio, Skeleton, HojaM, GraficaScrub, LeyendaScrub, TituloSeccionM, CampoBusqueda, toast } from '../../piezas';
import { moneyCompact, int, MESES, N, MONO } from '../../util';
import { useClientesMes } from '../../datos';
import { reglaDe } from '../../../modules/comercial/pagosv3/reglas';
import { crearPagoManual, guardarRegla, puedeEditarPagos } from '../../../modules/comercial/pagosv3/datos';
import { buscarSkus, datosProducto, bonificacionesErp, useApoyosConvenio, useApoyosPorSku } from '../../../modules/comercial/pagosv3/datosApoyos';
import { calcularApoyo, conceptoApoyo, detalleApoyo } from '../../../modules/comercial/pagosv3/apoyos';
import { CampoCantidad } from '../SOPExport';
import DetallePago from '../pagos/DetallePago';
import { usePagosPropio } from './datos';
import { resumenPagos, rebateProgreso, serieMensualPagos, frasePagos, resumenApoyos, fechaDe, tipoCorto, ACCION, TONO, pctIn, pctOut } from './pagosCalc';

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaCorta = (iso) => { if (!iso) return ''; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES[d.getMonth()].toLowerCase()}`; };
const mxn = (n) => `$${Math.round(N(n)).toLocaleString('es-MX')}`;

function Campo({ label, children }) {
  const { theme } = useTheme();
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${theme.border}` }}><span style={{ fontSize: 13, color: theme.textMuted }}>{label}</span>{children}</div>;
}
function Entrada({ value, onChange, sufijo, ancho = 86, placeholder }) {
  const { theme } = useTheme();
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><input value={value ?? ''} inputMode="decimal" placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, '').replace(',', '.'))} style={{ width: ancho, height: 34, textAlign: 'right', borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: MONO, fontSize: 14, padding: '0 8px' }} />{sufijo && <span style={{ fontSize: 12, color: theme.textMuted }}>{sufijo}</span>}</span>;
}

/** Vista pura (SSR). */
export function PagosPropioVista({ nombre, anio, mes, r, rebate, apoyos, fondo, serie = [], filtro = null, onFiltro, puedeEditar = false, onPago, onNuevoApoyo, onRegistrarApoyo, onReglas, hoy = new Date() }) {
  const { theme } = useTheme();
  const lista = useMemo(() => (filtro ? r.lista.filter((p) => p.estado === filtro) : r.lista), [r.lista, filtro]);
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return (
    <>
      <HeroM eyebrow={`${MESES_LARGO[mes - 1]} ${anio}`} frase={frasePagos({ nombre, mes, r, rebate, apoyos })} sub={[`${r.abiertos} pago${r.abiertos === 1 ? '' : 's'} en proceso`, r.nPagadosAnio ? `${r.nPagadosAnio} pagado${r.nPagadosAnio === 1 ? '' : 's'} en el año por ${moneyCompact(r.pagadoAnio)}` : null, fondo != null ? `fondo ${moneyCompact(fondo)}` : null].filter(Boolean).join(' · ')} />
      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow={`Por pagar · ${MESES[mes - 1].toLowerCase()}`} big={r.nPorPagar ? moneyCompact(r.porPagar) : '—'} bigColor={r.vencidos ? theme.red : undefined} sub={r.nPorPagar ? `${r.nPorPagar} pago${r.nPorPagar === 1 ? '' : 's'}${r.vencidos ? ` · ${r.vencidos} vencido${r.vencidos === 1 ? '' : 's'}` : ' · nada vencido'}` : 'nada pendiente este mes'} />
        <KpiM eyebrow={rebate ? `${rebate.nombre} · ${rebate.periodo}` : 'Rebate'} big={rebate ? (rebate.alcance != null ? `${Math.round(rebate.alcance * 100)} %` : '—') : '—'} bigColor={rebate?.alcance != null ? (rebate.pct ? theme.green : theme.orange) : undefined}
          sub={rebate ? (rebate.modo === 'por_categoria' ? `${moneyCompact(rebate.base)} de base · ${rebate.nivel}` : rebate.pct ? `${(rebate.pct * 100).toFixed(1)} % → ${moneyCompact(rebate.monto)} · nivel ${rebate.nivel}` : `${moneyCompact(rebate.base)} de ${moneyCompact(rebate.cuota)} · paga desde ${Math.round((rebate.minimo || 0.9) * 100)} %`) : 'sin regla'} onClick={onReglas} />
        <KpiM eyebrow="Apoyos por producto" big={apoyos ? (apoyos.skus ? moneyCompact(apoyos.enPiso) : '—') : '—'} bigColor={apoyos?.porRegistrar ? theme.orange : undefined} sub={apoyos ? (apoyos.skus ? `${apoyos.skus} SKU${apoyos.skus === 1 ? '' : 's'} con costo convenio · ${apoyos.porRegistrar} por registrar` : 'sin costo convenio reportado') : 'sin datos'} onClick={onNuevoApoyo} />
        <KpiM eyebrow="Fondo" big={fondo != null ? moneyCompact(fondo) : '—'} sub={fondo != null ? 'saldo de marketing y promoción' : 'sin fondo configurado'} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="toca una etapa para filtrar">Flujo del mes</TituloSeccionM>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 4, padding: '0 16px' }}>
        {r.flujo.map((e) => { const on = filtro === e.id; return (
          <button key={e.id} type="button" onClick={() => onFiltro?.(on ? null : e.id)} style={{ background: on ? theme.text : theme.surface, color: on ? theme.surface : theme.text, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '8px 2px', textAlign: 'center', cursor: 'pointer', fontFamily: TYPO.fontText }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{e.n}</div>
            <div style={{ fontSize: 9.5, color: on ? theme.surface : theme.textMuted, lineHeight: 1.2 }}>{e.label}</div>
          </button>); })}
      </div>

      <ListaAgrupada titulo="Pagos" meta={`${lista.length}${filtro ? ' · filtrados' : ''}`} style={{ marginTop: 18 }} accion={puedeEditar ? <Pill tone="blue" onClick={onNuevoApoyo} style={{ cursor: 'pointer' }}>＋ Apoyo por producto</Pill> : null}
        pie={puedeEditar ? 'Toca un pago para solicitarlo, autorizarlo, capturar el folio o registrar el pago (mismo flujo que la computadora).' : 'Tu perfil ve los pagos de este cliente pero no los mueve de etapa.'}>
        {!lista.length && <Vacio titulo={filtro ? 'Nada en esta etapa' : 'Nada en proceso'} sub={filtro ? 'Toca otra etapa o quita el filtro.' : 'Sin rebates, apoyos ni pagos pendientes.'} style={{ padding: '18px 16px' }} />}
        {lista.slice(0, 40).map((p) => {
          const f = fechaDe(p); const vencido = f && f < hoyIso && p.estado !== 'pagado';
          return <Fila key={p.id} titulo={p.concepto || p.descripcion || tipoCorto(p)} sub={[tipoCorto(p), f ? `${vencido ? 'venció' : 'vence'} ${fechaCorta(f)}` : (p.periodo || null), p.folio ? `folio ${p.folio}` : null].filter(Boolean).join(' · ')} valor={moneyCompact(p.monto)} valorSub={vencido ? <span style={{ color: theme.red }}>vencido</span> : null}
            pill={{ tone: TONO[p.estado] || 'gray', label: ACCION[p.estado] && puedeEditar ? ACCION[p.estado] : p.estado }} onClick={() => onPago?.(p)} />;
        })}
      </ListaAgrupada>

      {apoyos?.lista?.length > 0 && (
        <ListaAgrupada titulo="Apoyos por SKU · costo convenio" meta={`${apoyos.skus} · ${moneyCompact(apoyos.enPiso)} en piso`} style={{ marginTop: 18 }} pie="Apoyo = nuestra última factura − costo convenio que reporta el cliente, por las piezas que tiene en piso. Registrar lo mete al flujo de pagos; Karolina lo cuadra con la bonificación del ERP.">
          {apoyos.lista.slice(0, 8).map((x) => <Fila key={x.sku} titulo={x.sku} sub={`${x.titulo || ''}${x.titulo ? ' · ' : ''}convenio ${mxn(x.costo_convenio)} · factura ${mxn(x.precio_factura)} · ${int(x.stock)} pz`} valor={moneyCompact(x.apoyo_inventario)} valorSub={`${mxn(x.apoyo_pz)}/pz`} chevron={false}
            trailing={x.registrado ? <Pill tone="green" size="xs">registrado</Pill> : (puedeEditar ? <button type="button" onClick={() => onRegistrarApoyo?.(x)} style={{ flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 999, border: 0, background: `${theme.accent}1A`, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Registrar</button> : <Pill tone="orange" size="xs">por registrar</Pill>)} />)}
        </ListaAgrupada>
      )}

      <ListaAgrupada titulo="Reglas de pago" style={{ margin: '18px 0 0' }} pie={puedeEditar ? 'Cambia el porcentaje y sobre qué se paga; queda vigente desde hoy y con historial, igual que en la computadora.' : undefined}>
        <Fila icon={SlidersHorizontal} color={theme.accent} titulo={rebate ? `${rebate.nombre} · ${rebate.modo === 'mensual' ? 'mensual' : 'trimestral'}` : 'Rebate'} sub={rebate ? (rebate.modo === 'por_categoria' ? rebate.nivel : `sobre sell in · paga desde ${Math.round((rebate.minimo || 0.9) * 100)} % de cuota`) : 'sin regla'} onClick={onReglas} />
      </ListaAgrupada>

      {serie.some((d) => d.v || d.prev) && (
        <>
          <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">Pagado por mes</TituloSeccionM>
          <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
            <GraficaScrub datos={serie} formato={moneyCompact} series={[{ key: 'prev', label: `${anio - 1}`, color: theme.textSubtle || theme.textMuted }, { key: 'v', label: `${anio}`, color: theme.accent, area: true, grosor: 2.4 }]}
              tooltip={(d) => <><b style={{ fontSize: 12.5 }}>{d.label}</b> · <b style={{ fontSize: 12.5 }}>{moneyCompact(d.v)}</b>{d.prev ? ` · ${anio - 1} ${moneyCompact(d.prev)}` : ''}</>} />
            <LeyendaScrub items={[{ label: `${anio}`, color: theme.accent }, { label: `${anio - 1}`, color: theme.textSubtle || theme.textMuted }]} />
          </div>
        </>
      )}
    </>
  );
}

/** Hoja: apoyo para productos específicos (misma lógica que FormApoyoProducto de la web). */
export function HojaApoyoM({ abierto, onClose, ck, nombre, anio, mes, perfil, prefill = null, onGuardado }) {
  const { theme } = useTheme();
  const [productos, setProductos] = useState([]);
  const [q, setQ] = useState('');
  const [sugs, setSugs] = useState([]);
  const [bonifs, setBonifs] = useState([]);
  const [bonif, setBonif] = useState(null);
  const [elegirBonif, setElegirBonif] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (!abierto) { setProductos([]); setQ(''); setSugs([]); setBonif(null); return; } bonificacionesErp(ck).then(setBonifs).catch(() => setBonifs([])); }, [abierto, ck]);
  useEffect(() => { if (!abierto || !prefill?.sku) return; agregar({ sku: prefill.sku, descripcion: prefill.descripcion || '' }, prefill); }, [abierto, prefill?.sku]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (q.trim().length < 2) { setSugs([]); return; } let vivo = true; const t = setTimeout(() => buscarSkus(q).then((r) => { if (vivo) setSugs(r.filter((s) => !productos.some((p) => p.sku === s.sku))); }).catch(() => {}), 180); return () => { vivo = false; clearTimeout(t); }; }, [q, productos]);
  const agregar = async (s, pre = null) => {
    setQ(''); setSugs([]);
    setProductos((prev) => (prev.some((p) => p.sku === s.sku) ? prev : [...prev, { sku: s.sku, descripcion: s.descripcion || '', piezas: pre?.piezas ?? null, precio_factura: 0, apoyo_pz: pre?.apoyo_pz ?? null, inv_restante: null, cargando: true }]));
    try { const d = await datosProducto(ck, s.sku); setProductos((prev) => prev.map((p) => (p.sku === s.sku ? { ...p, precio_factura: d.precio_factura, inv_restante: d.inv_restante, piezas: p.piezas ?? d.inv_restante ?? null, cargando: false } : p))); }
    catch { setProductos((prev) => prev.map((p) => (p.sku === s.sku ? { ...p, cargando: false } : p))); }
  };
  const editar = (sku, patch) => setProductos((prev) => prev.map((p) => (p.sku === sku ? { ...p, ...patch } : p)));
  const calc = useMemo(() => calcularApoyo(productos, bonif), [productos, bonif]);
  const guardar = async () => {
    if (!productos.length) { toast.error('Agrega al menos un producto'); return; }
    if (calc.lineas.some((l) => !(l.piezas > 0) || !(l.apoyo_pz > 0))) { toast.error('Cada producto necesita piezas y apoyo por pieza'); return; }
    setGuardando(true);
    try {
      await crearPagoManual({ datos: { cliente: ck, tipo: 'apoyo_producto', concepto: conceptoApoyo(productos, bonif), monto: calc.total, periodo: bonif?.fecha ? bonif.fecha.slice(0, 7) : `${anio}-${String(mes).padStart(2, '0')}`, fecha_programada: null, notas: 'Capturado desde el celular', detalle: detalleApoyo(productos, bonif) }, perfil });
      toast.ok(`Apoyo registrado · ${mxn(calc.total)}${calc.cuadre.estado === 'cuadra' ? ' · cuadra con el ERP' : ''}`);
      onGuardado?.(); onClose?.();
    } catch (e) { toast.error(e?.message || String(e)); }
    finally { setGuardando(false); }
  };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Apoyo por producto" sub={`${nombre} · entra al flujo de pagos${bonif ? ` · bonificación ${bonif.folio || ''}` : ''}`} alto="92vh">
      <div style={{ padding: '0 16px' }}>
        <CampoBusqueda value={q} onChange={setQ} placeholder="SKU o descripción" autoFocus={!prefill} />
        {sugs.length > 0 && <ListaAgrupada style={{ padding: 0, marginTop: 8 }}>{sugs.map((s) => <Fila key={s.sku} titulo={s.sku} sub={s.descripcion || ''} onClick={() => agregar(s)} />)}</ListaAgrupada>}
      </div>
      <ListaAgrupada titulo="Productos" meta={productos.length ? `${productos.length} · ${mxn(calc.total)}` : undefined} style={{ marginTop: 12 }} pie="Piezas = las que tiene en piso (puedes cambiarlas). Apoyo por pieza = lo que se le reconoce; su nuevo costo = factura − apoyo.">
        {!productos.length && <Fila titulo="Busca el SKU al que quieres dar apoyo" chevron={false} />}
        {productos.map((p) => { const l = calc.lineas.find((x) => x.sku === p.sku) || p; return (
          <div key={p.sku} style={{ padding: '10px 12px', borderTop: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div style={{ minWidth: 0 }}><div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 14 }}>{p.sku}</div><div style={{ fontSize: 11.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.descripcion || '—'}{p.cargando ? ' · cargando…' : p.precio_factura ? ` · factura ${mxn(p.precio_factura)}` : ' · sin factura reciente'}{p.inv_restante != null ? ` · ${int(p.inv_restante)} pz en piso` : ''}</div></div><button type="button" onClick={() => setProductos((prev) => prev.filter((x) => x.sku !== p.sku))} aria-label="Quitar" style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer' }}><Trash2 size={15} /></button></div>
            <Campo label="Piezas"><CampoCantidad value={N(p.piezas)} onChange={(v) => editar(p.sku, { piezas: v })} paso={10} ancho={130} /></Campo>
            <Campo label="Apoyo por pieza"><Entrada value={p.apoyo_pz ?? ''} onChange={(v) => editar(p.sku, { apoyo_pz: v })} sufijo="$" placeholder="0" /></Campo>
            <Campo label="Monto"><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{mxn(l.monto)}{l.nuevo_costo != null && p.precio_factura ? <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400 }}> · nuevo costo {mxn(l.nuevo_costo)}</span> : null}</span></Campo>
          </div>); })}
      </ListaAgrupada>
      <ListaAgrupada titulo="Bonificación del ERP" style={{ marginTop: 12 }} pie="Opcional: liga el documento BPRM-102 / BPRM-101 / BINC-901 con el que el ERP bonificó este apoyo; la suma debe cuadrar.">
        <Fila titulo={bonif ? `${bonif.folio || bonif.venta_id} · ${bonif.concepto || ''}` : 'Sin bonificación ligada'} sub={bonif ? `${fechaCorta(bonif.fecha)} · ${mxn(bonif.monto)} · ${calc.cuadre.label}` : 'se puede ligar después'} onClick={() => setElegirBonif(true)} pill={bonif ? { tone: calc.cuadre.tone, label: calc.cuadre.estado === 'cuadra' ? 'cuadra' : 'difiere' } : null} />
      </ListaAgrupada>
      <div style={{ padding: '14px 16px 8px' }}><BotonGrande primario icon={Check} disabled={guardando || !productos.length} onClick={guardar}>{guardando ? 'Guardando…' : `Registrar apoyo · ${mxn(calc.total)}`}</BotonGrande></div>
      <HojaM abierto={elegirBonif} onClose={() => setElegirBonif(false)} titulo="Bonificaciones del ERP" sub={`${nombre} · últimos 15 meses`} alto="70vh" zIndex={80}>
        <ListaAgrupada>
          <Fila titulo="Sin bonificación" sub="ligar después" onClick={() => { setBonif(null); setElegirBonif(false); }} />
          {bonifs.slice(0, 30).map((b) => <Fila key={b.venta_id} titulo={`${b.folio || b.venta_id} · ${b.concepto_codigo || ''}`} sub={`${fechaCorta(b.fecha)} · ${b.concepto || ''}`} valor={mxn(b.monto)} onClick={() => { setBonif(b); setElegirBonif(false); }} />)}
        </ListaAgrupada>
      </HojaM>
    </HojaM>
  );
}

/** Hoja: reglas de pago editables (% y base del rebate; SPIFF). Guarda con la RPC de la web (vigente desde hoy + historial). */
export function HojaReglasM({ abierto, onClose, ck, nombre, reglas, perfil, puedeEditar, onGuardado }) {
  const { theme } = useTheme();
  const rReb = reglaDe(reglas, ck, 'rebate');
  const rSpiff = reglaDe(reglas, ck, 'spiff');
  const [tiers, setTiers] = useState([]);
  const [cats, setCats] = useState({});
  const [minimo, setMinimo] = useState('');
  const [spiff, setSpiff] = useState({});
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    setTiers((rReb?.tiers || []).map((t) => ({ min: pctIn(t.min_alcance), pct: pctIn(t.pct), label: t.label })));
    setCats(Object.fromEntries(Object.entries(rReb?.por_categoria || {}).map(([k, v]) => [k, pctIn(v)])));
    setMinimo(pctIn(rReb?.alcance_minimo_pago ?? rReb?.requiere_alcance_minimo ?? 0.9));
    setSpiff(Object.fromEntries(['pct_fijo', 'compradora_pct', 'flat_pct', 'min_alcance', 'requiere_alcance_minimo'].filter((k) => rSpiff?.[k] != null).map((k) => [k, pctIn(rSpiff[k])])));
  }, [abierto, ck]); // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = async (seccion) => {
    if (!puedeEditar) return;
    setGuardando(true);
    try {
      if (seccion === 'rebate') {
        const c = { ...rReb };
        if (rReb.modo === 'por_categoria') c.por_categoria = Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, pctOut(v)]));
        else { c.tiers = tiers.map((t, i) => ({ ...(rReb.tiers?.[i] || {}), min_alcance: pctOut(t.min), pct: pctOut(t.pct), label: t.label })); if (rReb.alcance_minimo_pago != null) c.alcance_minimo_pago = pctOut(minimo); else c.requiere_alcance_minimo = pctOut(minimo); }
        await guardarRegla({ cliente: ck, seccion: 'rebate', config: c, perfil, nota: 'Desde el celular' });
      } else {
        const c = { ...rSpiff }; for (const [k, v] of Object.entries(spiff)) c[k] = pctOut(v);
        await guardarRegla({ cliente: ck, seccion: 'spiff', config: c, perfil, nota: 'Desde el celular' });
      }
      toast.ok(`Regla de ${seccion} guardada · vigente desde hoy`); onGuardado?.();
    } catch (e) { toast.error(e?.message || String(e)); }
    finally { setGuardando(false); }
  };
  const etiquetaSpiff = { pct_fijo: '% del sell in', compradora_pct: '% compradora', flat_pct: '% del sell out', min_alcance: 'Paga desde alcance', requiere_alcance_minimo: 'Alcance mínimo' };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Reglas de pago" sub={`${nombre} · cuánto se paga y sobre qué`} alto="90vh">
      {!puedeEditar && <div style={{ padding: '0 16px 8px' }}><Pill tone="gray"><Lock size={10} /> Sólo lectura</Pill></div>}
      {rReb && (
        <ListaAgrupada titulo={rReb.nombre_oficial || 'Rebate'} meta={`${rReb.frecuencia} · sobre ${String(rReb.base || 'sell in').replace('_', ' ')}`} pie={rReb.modo === 'por_categoria' ? 'Porcentaje sobre el sell in del trimestre de cada categoría.' : 'Niveles por alcance de cuota: desde qué % de alcance aplica cada porcentaje sobre el sell in.'}>
          <div style={{ padding: '0 12px' }}>
            {rReb.modo === 'por_categoria' && Object.keys(cats).map((c) => <Campo key={c} label={c.charAt(0).toUpperCase() + c.slice(1)}><Entrada value={cats[c]} onChange={(v) => setCats((x) => ({ ...x, [c]: v }))} sufijo="%" /></Campo>)}
            {rReb.modo !== 'por_categoria' && tiers.map((t, i) => (
              <Campo key={i} label={t.label || `Nivel ${i + 1}`}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: 11, color: theme.textMuted }}>desde</span><Entrada value={t.min} onChange={(v) => setTiers((x) => x.map((y, k) => (k === i ? { ...y, min: v } : y)))} sufijo="%" ancho={64} /><span style={{ fontSize: 11, color: theme.textMuted }}>paga</span><Entrada value={t.pct} onChange={(v) => setTiers((x) => x.map((y, k) => (k === i ? { ...y, pct: v } : y)))} sufijo="%" ancho={64} /></span></Campo>
            ))}
            {rReb.modo !== 'por_categoria' && <Campo label="Alcance mínimo para pagar"><Entrada value={minimo} onChange={setMinimo} sufijo="%" /></Campo>}
          </div>
          {puedeEditar && <div style={{ padding: '10px 12px 4px' }}><BotonGrande primario icon={Check} disabled={guardando} onClick={() => guardar('rebate')}>Guardar rebate</BotonGrande></div>}
        </ListaAgrupada>
      )}
      {rSpiff && Object.keys(spiff).length > 0 && (
        <ListaAgrupada titulo="SPIFF" meta={`${rSpiff.base === 'sell_out' ? 'sobre sell out' : 'sobre sell in'} · ${rSpiff.frecuencia || 'mensual'}`} style={{ marginTop: 14 }}>
          <div style={{ padding: '0 12px' }}>{Object.keys(spiff).map((k) => <Campo key={k} label={etiquetaSpiff[k] || k}><Entrada value={spiff[k]} onChange={(v) => setSpiff((x) => ({ ...x, [k]: v }))} sufijo="%" /></Campo>)}</div>
          {puedeEditar && <div style={{ padding: '10px 12px 4px' }}><BotonGrande primario icon={Check} disabled={guardando} onClick={() => guardar('spiff')}>Guardar SPIFF</BotonGrande></div>}
        </ListaAgrupada>
      )}
      <div style={{ padding: '12px 20px 8px', fontSize: 11.5, color: theme.textMuted, lineHeight: 1.45 }}>Los fondos, los pagos fijos y la dinámica de vendedores se editan desde la computadora. Para apoyar un producto específico usa «＋ Apoyo por producto».</div>
    </HojaM>
  );
}

export default function PagosPropio({ clienteKey: ck, nombre }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil() || nav.perfil;
  const qc = useQueryClient();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const puedeEditar = puedeEditarPagos(perfil, ck);
  const { data, isLoading, error, refetch } = usePagosPropio(ck);
  const { data: cm } = useClientesMes(anio);
  const { data: convenio = [] } = useApoyosConvenio(ck, true);
  const { data: registrados } = useApoyosPorSku(ck, true);
  const [filtro, setFiltro] = useState(null);
  const [pago, setPago] = useState(null);
  const [apoyo, setApoyo] = useState(null);      // null | { prefill }
  const [reglasAb, setReglasAb] = useState(false);
  const pagos = data?.pagos || [];
  const r = useMemo(() => resumenPagos({ pagos, anio, mes, hoy }), [pagos, anio, mes, hoy]);
  const regla = useMemo(() => (data ? reglaDe(data.reglas, ck, 'rebate') : null), [data, ck]);
  const rebate = useMemo(() => rebateProgreso({ fact: (cm?.fact || []).filter((x) => x.cliente_key === ck), cuotas: (cm?.cuotas || []).filter((x) => x.cliente === ck), regla, anio, mes }), [cm, ck, regla, anio, mes]);
  const apoyos = useMemo(() => resumenApoyos(convenio, registrados || new Map()), [convenio, registrados]);
  const fondo = useMemo(() => (data?.fondos?.length ? data.fondos.filter((f) => f.activo !== false).reduce((s, f) => s + N(f.saldo), 0) : null), [data]);
  const serie = useMemo(() => serieMensualPagos(pagos, anio), [pagos, anio]);
  const recargar = async () => { await refetch(); qc.invalidateQueries({ queryKey: ['apoyos_sku', ck] }); };
  if (error) return <Vacio titulo="No se pudieron cargar los pagos" sub={String(error.message || error)} color={theme.red} />;
  if (isLoading || !data) return <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={220} r={12} /></div>;
  return (
    <>
      <PagosPropioVista nombre={nombre} anio={anio} mes={mes} r={r} rebate={rebate} apoyos={apoyos} fondo={fondo} serie={serie} filtro={filtro} onFiltro={setFiltro} puedeEditar={puedeEditar} hoy={hoy}
        onPago={setPago} onNuevoApoyo={() => setApoyo({ prefill: null })} onRegistrarApoyo={(x) => setApoyo({ prefill: { sku: x.sku, descripcion: x.titulo || '', apoyo_pz: Number(x.apoyo_pz), piezas: Number(x.stock) || null } })} onReglas={() => setReglasAb(true)} />
      <DetallePago pago={pago} abierto={!!pago} onCerrar={() => setPago(null)} perfil={perfil} reglas={data.reglas} puedeEditar={puedeEditar} onCambio={async () => { await recargar(); setPago(null); }} />
      <HojaApoyoM abierto={!!apoyo} onClose={() => setApoyo(null)} ck={ck} nombre={nombre} anio={anio} mes={mes} perfil={perfil} prefill={apoyo?.prefill || null} onGuardado={recargar} />
      <HojaReglasM abierto={reglasAb} onClose={() => setReglasAb(false)} ck={ck} nombre={nombre} reglas={data.reglas} perfil={perfil} puedeEditar={puedeEditar} onGuardado={recargar} />
    </>
  );
}
