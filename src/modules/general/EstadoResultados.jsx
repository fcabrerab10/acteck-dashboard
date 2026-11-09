// Estado de Resultados · V4 (2026-11-09) · estado financiero sobre el libro mensual de los consultores.
// Fernando («formato de estado financiero, poco texto; acumulado del año y ahí mismo el mes a mes»,
// propuesta C del mockup). Datos: `libro_financiero` (resultados/libro.js), motor puro resultados/libroCalc.js
// (pruebas: scripts/test-libro-financiero.mjs). Toda la pestaña es sensible: sin permiso → SinAcceso.
// Estructura: cabecera (año · mes · Acumulado/Mes · frescura · exportar) → estado del periodo (tabla formal,
// gastos desplegables por grupo) → mes a mes → indicadores → plegados: gastos por cuenta × mes · cartera por
// mes · balance · cinco años.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import FrescuraPill from '../../components/FrescuraPill';
import { Segmented, Panel, Cargando } from '../../components/kit';
import { cargarLibro, cargarAniosLibro } from './resultados/libro';
import {
  MESES_LBL, MESES_FULL, indexar, mesesConLibro, estado, mesAMes, indicadores, cincoAnios, carteraPorMes, balance,
  gastosPorCuentaMes, miles, fmtM,
} from './resultados/libroCalc';

const MONO = '"SF Mono", ui-monospace, Menlo, monospace';
const pctTxt = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)} %`);
const ppTxt = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`);
const deltaTxt = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)} %`);
const alcanceTxt = (v) => (v == null ? '—' : `${Math.round(v * 100)} %`);

function tonos(theme) {
  return { ok: theme.green || '#34C759', casi: theme.orange || '#FF9500', mal: theme.red || '#FF3B30' };
}

export default function EstadoResultados() {
  const perfil = usePerfil();
  const rootRef = useRef(null);
  const permitido = puedeVerPestanaGlobal(perfil, 'estado_resultados');
  const sensible = puedeVerSensible(perfil);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [anios, setAnios] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mesSel, setMesSel] = useState(null);
  const [periodo, setPeriodo] = useState('acum');

  useEffect(() => {
    if (!permitido || !sensible) return;
    let vivo = true;
    (async () => {
      try {
        const lista = await cargarAniosLibro();
        if (!vivo) return;
        setAnios(lista);
        if (lista.length && !lista.includes(anio)) setAnio(lista[0]);
      } catch (e) { if (vivo) setError(e?.message || String(e)); }
    })();
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitido, sensible]);

  useEffect(() => {
    if (!permitido || !sensible) return;
    let vivo = true;
    setLoading(true); setError(null);
    cargarLibro(anio).then((r) => { if (vivo) { setRows(r); setLoading(false); } }).catch((e) => { if (vivo) { setError(e?.message || String(e)); setLoading(false); } });
    return () => { vivo = false; };
  }, [anio, permitido, sensible]);

  const idx = useMemo(() => indexar(rows), [rows]);
  const meses = useMemo(() => mesesConLibro(idx, anio), [idx, anio]);
  const mes = mesSel && meses.includes(mesSel) ? mesSel : meses[meses.length - 1] || null;
  const datos = useMemo(() => (mes ? armar(idx, anio, mes, periodo, meses) : null), [idx, anio, mes, periodo, meses]);

  if (!permitido || !sensible) return <SinAcceso pantalla="Estado de Resultados" />;
  if (loading && !rows.length) return <Cargando pantalla="estadoResultados" />;
  if (error) return <div style={{ padding: 24, fontFamily: TYPO.fontText }}>No se pudo cargar el libro financiero: {error}</div>;
  if (!mes || !datos) return <div style={{ padding: 24, fontFamily: TYPO.fontText }}>No hay libro financiero cargado para {anio}. Súbelo en Configuración → Actualización de datos → «Libro financiero (consultores)».</div>;

  const excel = () => excelDe(datos, anio, mes, periodo);
  return (
    <div ref={rootRef}>
      <EstadoLibroVista datos={datos} anio={anio} anios={anios} mes={mes} meses={meses} periodo={periodo}
        onAnio={(a) => { setAnio(a); setMesSel(null); }} onMes={setMesSel} onPeriodo={setPeriodo}
        acciones={<><FrescuraPill pantalla="estadoResultados" /><ExportMenu titulo="Estado de resultados" subtitulo={`REVKO Technology · ${periodoLabel(anio, mes, periodo)}`} excel={excel} pdf={{ ref: rootRef }} /></>} />
    </div>
  );
}

/** Todo lo que pinta la vista, calculado una vez. */
export function armar(idx, anio, mes, periodo, meses) {
  return {
    est: estado(idx, anio, mes, periodo),
    mm: mesAMes(idx, anio),
    ind: indicadores(idx, anio, mes),
    cinco: cincoAnios(idx, anio, mes),
    cartera: carteraPorMes(idx, anio),
    bal: balance(idx, anio, mes),
    gastosCuenta: gastosPorCuentaMes(idx, anio, meses),
  };
}

const periodoLabel = (anio, mes, periodo) => (periodo === 'acum' ? `enero a ${MESES_FULL[mes - 1]} ${anio}` : `${MESES_FULL[mes - 1]} ${anio}`);

/** Vista pura (SSR en scripts/test-libro-financiero.mjs). */
export function EstadoLibroVista({ datos, anio, anios = [], mes, meses, periodo, onAnio, onMes, onPeriodo, acciones }) {
  const { theme } = useTheme();
  const { est, mm, ind, cinco, cartera, bal, gastosCuenta } = datos;
  const titulo = periodo === 'acum' ? `Acumulado · enero a ${MESES_FULL[mes - 1]}` : `${MESES_FULL[mes - 1][0].toUpperCase()}${MESES_FULL[mes - 1].slice(1)}`;
  return (
    <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 20px 32px', fontFamily: TYPO.fontText, color: theme.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', fontFamily: TYPO.fontDisplay }}>Estado de Resultados</h1>
          <span style={{ fontSize: 12, color: theme.textMuted }}>REVKO Technology · {periodoLabel(anio, mes, periodo)} · miles de pesos · libro mensual de los consultores</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {anios.length > 1 && <Segmented value={anio} onChange={onAnio} options={anios.map((a) => ({ id: a, label: String(a) }))} />}
          <Segmented value={mes} onChange={onMes} options={meses.map((m) => ({ id: m, label: MESES_LBL[m - 1] }))} />
          <Segmented value={periodo} onChange={onPeriodo} options={[{ id: 'acum', label: 'Acumulado' }, { id: 'mes', label: 'Mes' }]} />
          {acciones}
        </div>
      </div>

      <Panel titulo={titulo} meta={`real · % de la venta · presupuesto · alcance · ${anio - 1} · variación`} padding="4px 6px 8px">
        <TablaEstado est={est} anio={anio} />
      </Panel>

      <Panel titulo={`Mes a mes · ${anio}`} meta="alcance = real ÷ presupuesto · tocar un mes lo elige arriba" padding="4px 6px 8px">
        <TablaMeses mm={mm} mes={mes} onMes={onMes} />
      </Panel>

      <Panel titulo={`Indicadores · al cierre de ${MESES_FULL[mes - 1]}`} padding="4px 6px 8px">
        <TablaIndicadores ind={ind} anio={anio} />
      </Panel>

      <Panel titulo="Gastos por cuenta · mes a mes" meta={`${gastosCuenta.length} grupos · miles de pesos`} plegable abiertoInicial={false} padding="4px 6px 8px">
        <TablaGastosCuenta grupos={gastosCuenta} meses={mm.meses} />
      </Panel>
      <Panel titulo="Antigüedad de cartera · por mes" meta="miles de pesos" plegable abiertoInicial={false} padding="4px 6px 8px">
        <TablaCartera filas={cartera} />
      </Panel>
      <Panel titulo={`Balance · al cierre de ${MESES_FULL[mes - 1]}`} meta={`saldo al cierre de diciembre ${anio - 1} · saldo · origen · aplicación`} plegable abiertoInicial={false} padding="4px 6px 8px">
        <TablaBalance secciones={bal} />
      </Panel>
      <Panel titulo={`Cinco años · enero a ${MESES_FULL[mes - 1]}`} meta="ventas y utilidad neta de la hoja comparativa" plegable abiertoInicial={false} padding="4px 6px 8px">
        <TablaCinco filas={cinco} anio={anio} />
      </Panel>
    </div>
  );
}

// ─── tablas estilo estado financiero ───
function useEstilos() {
  const { theme } = useTheme();
  const t = tonos(theme);
  const hair = theme.border;
  return {
    theme, t,
    tabla: { borderCollapse: 'collapse', width: '100%', fontSize: 13, fontFamily: TYPO.fontText },
    th: { fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'right', padding: '6px 10px 8px', borderBottom: `1px solid ${theme.text}33`, whiteSpace: 'nowrap' },
    thL: { textAlign: 'left' },
    td: { padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: `1px solid ${hair}`, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 12.5 },
    tdL: { textAlign: 'left', fontFamily: TYPO.fontText, fontSize: 13 },
    sub: { fontWeight: 700, borderTop: `1px solid ${theme.text}33`, borderBottom: `1px solid ${theme.text}33`, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' },
    pct: { fontSize: 11.5, color: theme.textMuted, paddingTop: 2, paddingBottom: 8 },
    hijo: { color: theme.textMuted, fontSize: 12 },
    mut: { color: theme.textMuted },
    tono: (k) => ({ color: k ? t[k] : undefined, fontWeight: k ? 600 : undefined }),
  };
}

function TablaEstado({ est, anio }) {
  const s = useEstilos();
  const [abiertos, setAbiertos] = useState(() => new Set());
  const toggle = (id) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const hayGastos = est.filas.some((f) => f.tipo === 'hijo');
  const gastosAbiertos = abiertos.has('gastos');
  const signo = (f, v) => (v == null ? '—' : f.negativo ? miles(Math.abs(v), { paren: true }) : miles(v));
  const filas = est.filas.flatMap((f) => {
    if (f.tipo === 'hijo') {
      if (!gastosAbiertos) return [];
      const sub = abiertos.has(f.id) ? (f.hijos || []).flatMap((h) => [{ ...h, id: `h:${h.clave}`, tipo: 'nieto', label: h.concepto, real: h.valor, negativo: true, pctVenta: est.ventas ? h.valor / est.ventas : null, delta: h.ant == null || !h.ant ? null : (h.valor - h.ant) / Math.abs(h.ant) }, ...(abiertos.has(`h:${h.clave}`) ? (h.hijos || []).map((g) => ({ ...g, id: `g2:${g.clave}`, tipo: 'bisnieto', label: g.concepto, real: g.valor, negativo: true, pctVenta: est.ventas ? g.valor / est.ventas : null, delta: g.ant == null || !g.ant ? null : (g.valor - g.ant) / Math.abs(g.ant) })) : [])]) : [];
      return [f, ...sub];
    }
    return [f];
  });
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.tabla}>
        <thead><tr>
          <th style={{ ...s.th, ...s.thL, width: 300 }}>Concepto</th><th style={s.th}>{anio}</th><th style={s.th}>% venta</th><th style={s.th}>Presupuesto</th><th style={s.th}>Alcance</th><th style={s.th}>{anio - 1}</th><th style={s.th}>Δ {anio - 1}</th>
        </tr></thead>
        <tbody>
          {filas.map((f) => {
            if (f.tipo === 'pct') return (
              <tr key={f.id}><td style={{ ...s.td, ...s.tdL, ...s.pct, paddingLeft: 26 }}>{f.label}</td><td style={{ ...s.td, ...s.pct }}>{pctTxt(f.real)}</td><td style={s.td}></td><td style={{ ...s.td, ...s.pct }}>{pctTxt(f.ppto)}</td><td style={{ ...s.td, ...s.pct, ...s.tono(f.alcance == null ? null : f.alcance >= 0 ? 'ok' : 'mal') }}>{ppTxt(f.alcance)}</td><td style={{ ...s.td, ...s.pct }}>{pctTxt(f.ant)}</td><td style={{ ...s.td, ...s.pct, ...s.tono(f.delta == null ? null : f.delta >= 0 ? 'ok' : 'mal') }}>{ppTxt(f.delta)}</td></tr>
            );
            const esSub = f.tipo === 'subtotal';
            const nivel = f.tipo === 'hijo' ? 1 : f.tipo === 'nieto' ? 2 : f.tipo === 'bisnieto' ? 3 : 0;
            const desplegable = f.id === 'gastos' ? hayGastos : (f.tipo === 'hijo' || f.tipo === 'nieto') && (f.hijos || []).length > 0;
            const abierto = abiertos.has(f.id);
            const deltaTono = f.delta == null ? null : (f.negativo ? f.delta <= 0 : f.delta >= 0) ? 'ok' : 'mal';
            return (
              <tr key={f.id} style={esSub ? s.sub : undefined}>
                <td style={{ ...s.td, ...s.tdL, ...(nivel ? s.hijo : null), paddingLeft: 10 + nivel * 16, fontWeight: esSub ? 700 : undefined }}>
                  {desplegable ? (
                    <button type="button" onClick={() => toggle(f.id)} aria-expanded={abierto} style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <ChevronRight size={12} style={{ transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 160ms', color: s.theme.textMuted }} />{f.label}
                      {f.id === 'gastos' && <span style={{ ...s.mut, fontSize: 11, marginLeft: 6 }}>{abierto ? 'ocultar grupos' : 'ver grupos'}</span>}
                    </button>
                  ) : f.label}
                </td>
                <td style={{ ...s.td, fontWeight: esSub ? 700 : undefined }}>{signo(f, f.real)}</td>
                <td style={{ ...s.td, ...s.mut }}>{f.pctVenta == null ? '' : (f.pctVenta * 100).toFixed(1)}</td>
                <td style={{ ...s.td, ...s.mut }}>{f.ppto == null ? '—' : signo(f, f.ppto)}</td>
                <td style={{ ...s.td, ...s.tono(f.tono) }}>{f.ppto == null ? '' : alcanceTxt(f.alcance)}</td>
                <td style={{ ...s.td, ...s.mut }}>{signo(f, f.ant)}</td>
                <td style={{ ...s.td, ...s.tono(deltaTono) }}>{deltaTxt(f.delta)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TablaMeses({ mm, mes, onMes }) {
  const s = useEstilos();
  const cols = [...mm.columnas, ...(mm.acum ? [{ ...mm.acum, esAcum: true }] : [])];
  const celda = (c, v, extra) => <td key={c.label} style={{ ...s.td, ...(c.mes === mes && !c.esAcum ? { background: s.theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' } : null), ...(c.esAcum ? { borderLeft: `1px solid ${s.theme.text}33`, fontWeight: 700 } : null), ...extra }}>{v}</td>;
  const fila = (label, f, { tipo = 'linea', tono } = {}) => (
    <tr key={label} style={tipo === 'subtotal' ? s.sub : undefined}>
      <td style={{ ...s.td, ...s.tdL, ...(tipo === 'pct' ? { ...s.pct, paddingLeft: 26 } : null), fontWeight: tipo === 'subtotal' ? 700 : undefined }}>{label}</td>
      {cols.map((c) => celda(c, f(c), { ...(tipo === 'pct' ? s.pct : null), ...(tono ? s.tono(tono(c)) : null) }))}
    </tr>
  );
  const tonoA = (v, gasto = false) => (v == null ? null : gasto ? (v <= 1 ? 'ok' : v <= 1.1 ? 'casi' : 'mal') : (v >= 1 ? 'ok' : v >= 0.85 ? 'casi' : 'mal'));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.tabla}>
        <thead><tr>
          <th style={{ ...s.th, ...s.thL, width: 200 }}>Concepto</th>
          {cols.map((c) => (
            <th key={c.label} style={{ ...s.th, ...(c.esAcum ? { borderLeft: `1px solid ${s.theme.text}33` } : null) }}>
              {c.esAcum ? 'Acum' : <button type="button" onClick={() => onMes?.(c.mes)} style={{ border: 0, background: 'transparent', color: c.mes === mes ? s.theme.text : 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, textDecoration: c.mes === mes ? 'underline' : 'none' }}>{c.label}</button>}
            </th>
          ))}
        </tr></thead>
        <tbody>
          {fila('Ventas netas', (c) => miles(c.ventas))}
          {fila('presupuesto', (c) => miles(c.ventasPpto), { tipo: 'pct' })}
          {fila('alcance', (c) => alcanceTxt(c.ventasAlcance), { tipo: 'pct', tono: (c) => tonoA(c.ventasAlcance) })}
          {fila(String(mm.columnas[0] ? (mm.acum ? 'año anterior' : '') : ''), (c) => miles(c.ventasAnt), { tipo: 'pct' })}
          {fila('Utilidad bruta', (c) => miles(c.utilidadBruta), { tipo: 'subtotal' })}
          {fila('margen bruto', (c) => pctTxt(c.margenBruto), { tipo: 'pct', tono: (c) => (c.margenBruto == null ? null : c.margenBruto >= 0.25 ? 'ok' : c.margenBruto >= 0.22 ? 'casi' : 'mal') })}
          {fila('Gastos de operación', (c) => miles(c.gastos, { paren: true }))}
          {fila('alcance', (c) => alcanceTxt(c.gastosPpto ? c.gastos / c.gastosPpto : null), { tipo: 'pct', tono: (c) => tonoA(c.gastosPpto ? c.gastos / c.gastosPpto : null, true) })}
          {fila('% de la venta', (c) => pctTxt(c.gastosPct), { tipo: 'pct', tono: (c) => (c.gastosPct == null ? null : c.gastosPct <= 0.15 ? null : c.gastosPct <= 0.18 ? 'casi' : 'mal') })}
          {fila('Gastos financieros', (c) => miles(c.gastosFinancieros, { paren: true }))}
          {fila('Resultado cambiario', (c) => miles(c.cambiario))}
          {fila('Utilidad neta', (c) => miles(c.utilidadNeta), { tipo: 'subtotal' })}
          {fila('presupuesto', (c) => miles(c.utilidadPpto), { tipo: 'pct' })}
          {fila('alcance', (c) => alcanceTxt(c.utilidadAlcance), { tipo: 'pct', tono: (c) => tonoA(c.utilidadAlcance) })}
          {fila('margen neto', (c) => pctTxt(c.margenNeto), { tipo: 'pct', tono: (c) => (c.margenNeto == null ? null : c.margenNeto >= 0.1 ? 'ok' : c.margenNeto >= 0.05 ? 'casi' : 'mal') })}
        </tbody>
      </table>
    </div>
  );
}

function TablaIndicadores({ ind, anio }) {
  const s = useEstilos();
  const val = (i, v, v2) => {
    if (v == null) return '—';
    if (i.unidad === '$') return miles(v);
    if (i.unidad === '%') return pctTxt(v);
    if (i.unidad === 'pers') return `${Math.round(v)} · ${v2 == null ? '—' : miles(v2)}`;
    return `${Math.round(v)}`;
  };
  const delta = (i) => {
    if (i.delta == null) return '—';
    if (i.unidad === 'd') return `${i.delta > 0 ? '+' : ''}${Math.round(i.delta)} d`;
    return deltaTxt(i.delta);
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.tabla}>
        <thead><tr><th style={{ ...s.th, ...s.thL, width: 300 }}>Indicador</th><th style={s.th}>{anio}</th><th style={s.th}>Meta</th><th style={s.th}>Alcance</th><th style={s.th}>{anio - 1}</th><th style={s.th}>Δ {anio - 1}</th><th style={{ ...s.th, ...s.thL }}></th></tr></thead>
        <tbody>
          {ind.map((i) => (
            <tr key={i.id}>
              <td style={{ ...s.td, ...s.tdL }}>{i.label}</td>
              <td style={{ ...s.td, fontWeight: 600 }}>{val(i, i.real, i.real2)}</td>
              <td style={{ ...s.td, ...s.mut }}>{i.meta == null ? '—' : val(i, i.meta)}</td>
              <td style={{ ...s.td, ...s.tono(i.tono) }}>{i.alcance == null ? '' : alcanceTxt(i.alcance)}</td>
              <td style={{ ...s.td, ...s.mut }}>{val(i, i.ant, i.ant2)}</td>
              <td style={{ ...s.td, ...s.tono(i.delta == null ? null : (i.id === 'deuda' || i.id === 'cartera' || i.id === 'inventario' ? i.delta <= 0 : i.delta >= 0) ? 'ok' : 'mal') }}>{delta(i)}</td>
              <td style={{ ...s.td, ...s.tdL, ...s.mut, fontSize: 11.5, whiteSpace: 'normal' }}>{i.nota}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaGastosCuenta({ grupos, meses }) {
  const s = useEstilos();
  const [abiertos, setAbiertos] = useState(() => new Set());
  const toggle = (k) => setAbiertos((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const filas = [];
  const rec = (nodo, nivel) => { filas.push({ ...nodo, nivel }); if (abiertos.has(nodo.clave)) (nodo.hijos || []).forEach((h) => rec(h, nivel + 1)); };
  grupos.forEach((g) => rec(g, 0));
  const totales = meses.map((_, i) => grupos.reduce((acc, g) => acc + (g.meses[i] || 0), 0));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.tabla}>
        <thead><tr><th style={{ ...s.th, ...s.thL, width: 260 }}>Cuenta</th>{meses.map((m) => <th key={m} style={s.th}>{MESES_LBL[m - 1]}</th>)}<th style={{ ...s.th, borderLeft: `1px solid ${s.theme.text}33` }}>Acum</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}>
              <td style={{ ...s.td, ...s.tdL, ...(f.nivel ? s.hijo : null), paddingLeft: 10 + f.nivel * 16 }}>
                {(f.hijos || []).length ? <button type="button" onClick={() => toggle(f.clave)} aria-expanded={abiertos.has(f.clave)} style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ChevronRight size={12} style={{ transform: abiertos.has(f.clave) ? 'rotate(90deg)' : 'none', color: s.theme.textMuted }} />{f.concepto}</button> : f.concepto}
              </td>
              {f.meses.map((v, i) => <td key={i} style={{ ...s.td, ...(f.nivel ? s.hijo : null) }}>{v == null ? '—' : miles(v)}</td>)}
              <td style={{ ...s.td, borderLeft: `1px solid ${s.theme.text}33`, fontWeight: f.nivel ? undefined : 600 }}>{miles(f.total)}</td>
            </tr>
          ))}
          <tr style={s.sub}><td style={{ ...s.td, ...s.tdL, fontWeight: 700 }}>Suma total</td>{totales.map((v, i) => <td key={i} style={{ ...s.td, fontWeight: 700 }}>{miles(v)}</td>)}<td style={{ ...s.td, fontWeight: 700, borderLeft: `1px solid ${s.theme.text}33` }}>{miles(totales.reduce((a, b) => a + b, 0))}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function TablaCartera({ filas }) {
  const s = useEstilos();
  const k = (v) => (v == null ? '—' : Math.round(v).toLocaleString('es-MX'));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.tabla}>
        <thead><tr><th style={{ ...s.th, ...s.thL, width: 120 }}>Mes</th><th style={s.th}>Por vencer</th><th style={s.th}>1–30</th><th style={s.th}>31–60</th><th style={s.th}>61–90</th><th style={s.th}>91–180</th><th style={s.th}>+180</th><th style={{ ...s.th, borderLeft: `1px solid ${s.theme.text}33` }}>Total</th><th style={s.th}>Reserva</th><th style={s.th}>Días</th><th style={s.th}>% vencido</th></tr></thead>
        <tbody>
          {filas.map((f) => { const venc = f.total ? ((f.d1_30 || 0) + (f.d31_60 || 0) + (f.d61_90 || 0) + (f.d91_180 || 0) + (f.mas_180 || 0)) / f.total : null; return (
            <tr key={`${f.anio}-${f.mes}`}>
              <td style={{ ...s.td, ...s.tdL }}>{f.label}</td><td style={s.td}>{k(f.por_vencer)}</td><td style={s.td}>{k(f.d1_30)}</td><td style={s.td}>{k(f.d31_60)}</td><td style={s.td}>{k(f.d61_90)}</td><td style={s.td}>{k(f.d91_180)}</td><td style={{ ...s.td, ...s.tono(f.mas_180 > 0 && f.total && f.mas_180 / f.total > 0.03 ? 'mal' : null) }}>{k(f.mas_180)}</td>
              <td style={{ ...s.td, borderLeft: `1px solid ${s.theme.text}33`, fontWeight: 600 }}>{k(f.total)}</td><td style={{ ...s.td, ...s.mut }}>{k(f.reserva)}</td><td style={{ ...s.td, ...s.tono(f.dias == null ? null : f.dias <= 90 ? 'ok' : f.dias <= 105 ? 'casi' : 'mal') }}>{f.dias == null ? '—' : f.dias.toFixed(0)}</td><td style={{ ...s.td, ...s.mut }}>{pctTxt(venc)}</td>
            </tr>); })}
        </tbody>
      </table>
    </div>
  );
}

function TablaBalance({ secciones }) {
  const s = useEstilos();
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.tabla}>
        <thead><tr><th style={{ ...s.th, ...s.thL, width: 300 }}>Concepto</th><th style={s.th}>Diciembre</th><th style={s.th}>Al cierre</th><th style={s.th}>Variación</th><th style={s.th}>Origen</th><th style={s.th}>Aplicación</th></tr></thead>
        <tbody>
          {secciones.map((sec) => (
            <React.Fragment key={sec.id}>
              <tr><td colSpan={6} style={{ ...s.td, ...s.tdL, ...s.th, textAlign: 'left', paddingTop: 12 }}>{sec.label}</td></tr>
              {sec.lineas.map((l) => (
                <tr key={l.clave}><td style={{ ...s.td, ...s.tdL, paddingLeft: 26 }}>{l.concepto}</td><td style={{ ...s.td, ...s.mut }}>{miles(l.inicial)}</td><td style={s.td}>{miles(l.saldo)}</td><td style={{ ...s.td, ...s.mut }}>{l.inicial == null || l.saldo == null ? '—' : miles(l.saldo - l.inicial)}</td><td style={{ ...s.td, ...s.mut }}>{l.origen ? miles(l.origen) : ''}</td><td style={{ ...s.td, ...s.mut }}>{l.aplicacion ? miles(l.aplicacion) : ''}</td></tr>
              ))}
              {sec.suma && <tr style={s.sub}><td style={{ ...s.td, ...s.tdL, fontWeight: 700 }}>Suma {sec.label.toLowerCase()}</td><td style={{ ...s.td, fontWeight: 700 }}>{miles(sec.suma.inicial)}</td><td style={{ ...s.td, fontWeight: 700 }}>{miles(sec.suma.saldo)}</td><td style={{ ...s.td, fontWeight: 700 }}>{sec.suma.inicial == null || sec.suma.saldo == null ? '—' : miles(sec.suma.saldo - sec.suma.inicial)}</td><td style={s.td}></td><td style={s.td}></td></tr>}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaCinco({ filas, anio }) {
  const s = useEstilos();
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.tabla}>
        <thead><tr><th style={{ ...s.th, ...s.thL, width: 120 }}>Año</th><th style={s.th}>Ventas</th><th style={s.th}>Utilidad neta</th><th style={s.th}>Margen</th><th style={{ ...s.th, borderLeft: `1px solid ${s.theme.text}33` }}>Año completo · ventas</th><th style={s.th}>Utilidad</th><th style={s.th}>Margen</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.anio} style={f.anio === anio ? s.sub : undefined}>
              <td style={{ ...s.td, ...s.tdL, fontWeight: f.anio === anio ? 700 : undefined }}>{f.anio}</td><td style={s.td}>{miles(f.ventas)}</td><td style={{ ...s.td, ...s.tono(f.utilidad == null ? null : f.utilidad >= 0 ? null : 'mal') }}>{miles(f.utilidad)}</td><td style={{ ...s.td, ...s.mut }}>{pctTxt(f.margen)}</td>
              <td style={{ ...s.td, ...s.mut, borderLeft: `1px solid ${s.theme.text}33` }}>{f.totalVentas == null ? '—' : miles(f.totalVentas)}</td><td style={{ ...s.td, ...s.mut }}>{f.totalUtilidad == null ? '—' : miles(f.totalUtilidad)}</td><td style={{ ...s.td, ...s.mut }}>{pctTxt(f.margenTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Excel ───
function excelDe({ est, mm, ind }, anio, mes, periodo) {
  const num = (v) => (v == null ? null : Math.round(v));
  const pct = (v) => (v == null ? null : Math.round(v * 1000) / 10);
  const estadoFilas = est.filas.filter((f) => f.tipo !== 'pct').map((f) => ({ concepto: `${f.tipo === 'hijo' ? '   ' : ''}${f.label}`, real: num(f.negativo ? -f.real : f.real), pct_venta: pct(f.pctVenta), ppto: num(f.ppto == null ? null : f.negativo ? -f.ppto : f.ppto), alcance: pct(f.alcance), ant: num(f.ant == null ? null : f.negativo ? -f.ant : f.ant), delta: pct(f.delta) }));
  const cols = [...mm.columnas, ...(mm.acum ? [mm.acum] : [])];
  const mesFila = (label, k, fn = num) => ({ concepto: label, ...Object.fromEntries(cols.map((c) => [c.label, fn(c[k])])) });
  return {
    titulo: 'Estado de resultados', archivo: `Estado_de_resultados_${anio}_${String(mes).padStart(2, '0')}_${periodo}`,
    hojas: [
      { nombre: periodo === 'acum' ? 'Acumulado' : 'Mes', subtitulo: periodoLabel(anio, mes, periodo), columnas: [{ label: 'Concepto', key: 'concepto', ancho: 36 }, { label: String(anio), key: 'real', tipo: 'num' }, { label: '% venta', key: 'pct_venta', tipo: 'num' }, { label: 'Presupuesto', key: 'ppto', tipo: 'num' }, { label: 'Alcance %', key: 'alcance', tipo: 'num' }, { label: String(anio - 1), key: 'ant', tipo: 'num' }, { label: 'Δ %', key: 'delta', tipo: 'num' }], filas: estadoFilas },
      { nombre: 'Mes a mes', subtitulo: String(anio), columnas: [{ label: 'Concepto', key: 'concepto', ancho: 28 }, ...cols.map((c) => ({ label: c.label, key: c.label, tipo: 'num' }))],
        filas: [mesFila('Ventas netas', 'ventas'), mesFila('Presupuesto ventas', 'ventasPpto'), mesFila('Alcance ventas %', 'ventasAlcance', pct), mesFila(`Ventas ${anio - 1}`, 'ventasAnt'), mesFila('Utilidad bruta', 'utilidadBruta'), mesFila('Margen bruto %', 'margenBruto', pct), mesFila('Gastos de operación', 'gastos'), mesFila('Gastos % venta', 'gastosPct', pct), mesFila('Gastos financieros', 'gastosFinancieros'), mesFila('Resultado cambiario', 'cambiario'), mesFila('Utilidad neta', 'utilidadNeta'), mesFila('Presupuesto utilidad', 'utilidadPpto'), mesFila('Alcance utilidad %', 'utilidadAlcance', pct), mesFila('Margen neto %', 'margenNeto', pct)] },
      { nombre: 'Indicadores', columnas: [{ label: 'Indicador', key: 'label', ancho: 32 }, { label: String(anio), key: 'real', tipo: 'num' }, { label: 'Meta', key: 'meta', tipo: 'num' }, { label: String(anio - 1), key: 'ant', tipo: 'num' }, { label: 'Nota', key: 'nota', ancho: 60 }], filas: ind.map((i) => ({ label: i.label, real: i.real, meta: i.meta, ant: i.ant, nota: i.nota })) },
    ],
  };
}
