// Panel "Mapa · dónde se vende" del Sell Out consolidado · un panel, tres vistas.
//
//   Medir   — un mapa grande y seis medidas (sell out, Δ vs el año pasado, clientes finales,
//             $ por cliente, cuentas activas, vendedores) con leyenda de tres marcas.
//   Cuentas — hasta 4 mini mapas a la misma escala; los estados donde esa cuenta no vende se
//             pintan naranja ("hueco"). Debajo: huecos del grupo y estados con dependencia > 80 %.
//   Tiempo  — los últimos 12 meses con deslizador y Play, comparativo contra el año anterior,
//             burbujas de clientes finales y las alertas geográficas del mes.
//
// Comunes a las tres: ficha al pasar el cursor, clic que fija el estado y filtra TODA la
// pantalla (estadoSel), ranking al lado sincronizado con el hover y "Sin estado en la fuente"
// siempre como fila aparte, nunca sobre el mapa.
//
// Límite de la fuente: mv_sellout_estado_mes es (cuenta, anio, mes, estado) — no trae SKU ni
// marca. Por eso la ficha da top 3 cuentas y clientes finales, y el modo Cuentas no tiene
// interruptor "por marca". Cálculo puro en calculo.js; este archivo sólo dibuja.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Segmented, Pill, Boton, Skeleton } from '../../../components/kit';
import { usePreferencias, getPath } from '../../../lib/preferencias';
import MapaMexico, { MEDIDAS_MAPA, ESTADOS_MX, valorDe, fmtValor } from './MapaMexico';
import { useEstadosHistoria } from './datos';
import {
  MESES, porEstado, estadosPorCuenta, huecos as calcHuecos, dependencia as calcDependencia,
  alertasGeograficas, ultimosMeses,
} from './calculo';
import { capitalizarEstado, fmtMoney, fmtPct, fmtSigno } from './textos';

const VISTAS = [
  { id: 'medir', label: 'Medir' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'tiempo', label: 'Tiempo' },
];
const MODO_TIEMPO = [{ id: 'mes', label: 'Mes' }, { id: 'yoy', label: 'Comparar vs año anterior' }];
const MAX_MINI = 4;
const PASO_MS = 600;

const reducirMovimiento = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PanelMapa({ anio, mes, estadoMes = [], estadoSel = null, onEstado, nombres = {} }) {
  const { theme } = useTheme();
  const { prefs, setPreferencia } = usePreferencias();
  const vista = ['medir', 'cuentas', 'tiempo'].includes(getPath(prefs, 'sellOut.mapaModo')) ? getPath(prefs, 'sellOut.mapaModo') : 'medir';
  const setVista = (v) => setPreferencia('sellOut.mapaModo', v);

  const { data: historia = [], isLoading } = useEstadosHistoria(anio);
  // Mientras baja la historia se pinta con lo que la pantalla ya tiene del mes en curso.
  const filas = historia.length ? historia : estadoMes;

  const [medida, setMedida] = useState('importe');
  const [hover, setHover] = useState(null);
  const [cuentasSel, setCuentasSel] = useState(null); // modo Cuentas: ids elegidos
  const [cuentaZoom, setCuentaZoom] = useState(null); // Medir filtrado a una cuenta
  const [idxTiempo, setIdxTiempo] = useState(11);
  const [modoTiempo, setModoTiempo] = useState('mes');
  const [burbujasOn, setBurbujasOn] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);

  const nombreCuenta = (c) => (nombres[c] || c).split(' (')[0];
  const meses12 = useMemo(() => ultimosMeses(anio, mes, 12), [anio, mes]);
  const mesActivo = vista === 'tiempo' ? (meses12[idxTiempo] || meses12[11]) : { anio, mes };

  useEffect(() => { setIdxTiempo(11); setReproduciendo(false); }, [anio, mes]);

  // Play del modo Tiempo (600 ms por mes). Con "reducir movimiento" no se anima solo.
  useEffect(() => {
    if (!reproduciendo) return undefined;
    const t = setInterval(() => setIdxTiempo((i) => (i >= 11 ? 0 : i + 1)), PASO_MS);
    return () => clearInterval(t);
  }, [reproduciendo]);

  // Cuentas que de verdad mandan estado (hoy: CVA, GUC, TechSmart y PCH).
  const conEstado = useMemo(() => estadosPorCuenta(filas, anio, mes), [filas, anio, mes]);
  const elegidas = useMemo(() => {
    if (cuentasSel?.length) return cuentasSel.slice(0, MAX_MINI);
    return conEstado.slice(0, MAX_MINI).map((c) => c.cuenta);
  }, [cuentasSel, conEstado]);

  const filasMedir = useMemo(
    () => (cuentaZoom ? filas.filter((r) => r.cuenta === cuentaZoom) : filas),
    [filas, cuentaZoom],
  );
  const estados = useMemo(
    () => porEstado(vista === 'medir' ? filasMedir : filas, mesActivo.anio, mesActivo.mes),
    [filasMedir, filas, vista, mesActivo.anio, mesActivo.mes],
  );
  const enMapa = useMemo(() => estados.filter((e) => e.estado !== 'SIN ESTADO'), [estados]);

  const medidaActiva = vista === 'tiempo' ? (modoTiempo === 'yoy' ? 'yoy' : 'importe') : medida;

  // Ranking ordenado por la medida en curso (los nulos al final).
  const ranking = useMemo(() => {
    const v = (e) => valorDe(e, medidaActiva);
    return [...enMapa].filter((e) => e.importe > 0 || medidaActiva === 'yoy')
      .sort((a, b) => (v(b) ?? -Infinity) - (v(a) ?? -Infinity));
  }, [enMapa, medidaActiva]);
  const topRanking = ranking.length ? Math.max(...ranking.map((e) => Math.abs(valorDe(e, medidaActiva) || 0))) : 0;

  // Ficha del hover: top 3 cuentas del estado (no hay SKU por estado en la fuente).
  const ficha = (estado, d) => (
    d?.cuentas?.length ? (
      <div style={{ opacity: 0.78, marginTop: 3 }}>
        {d.cuentas.slice(0, 3).map((c) => `${nombreCuenta(c.cuenta)} ${fmtPct(c.pct)}`).join(' · ')}
        {d.cuentas.length > 3 ? ` · +${d.cuentas.length - 3}` : ''}
      </div>
    ) : null
  );

  const burbujas = useMemo(() => {
    if (vista !== 'tiempo' || !burbujasOn) return null;
    return new Map(enMapa.map((e) => [e.estado, e.clientes]));
  }, [vista, burbujasOn, enMapa]);

  if (isLoading && !estadoMes.length) return <Skeleton h={420} r={12} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Segmented options={VISTAS} value={vista} onChange={(v) => { setVista(v); setCuentaZoom(null); }} />
        {vista === 'medir' && <Segmented options={MEDIDAS_MAPA} value={medida} onChange={setMedida} />}
        {vista === 'tiempo' && <Segmented options={MODO_TIEMPO} value={modoTiempo} onChange={setModoTiempo} />}
        {vista === 'tiempo' && (
          <Pill tone={burbujasOn ? 'blue' : 'gray'} size="xs" onClick={() => setBurbujasOn((b) => !b)} style={{ cursor: 'pointer' }}>
            Burbujas de clientes
          </Pill>
        )}
        {cuentaZoom && (
          <Pill tone="blue" size="xs" onClick={() => setCuentaZoom(null)} style={{ cursor: 'pointer' }}>
            Sólo {nombreCuenta(cuentaZoom)} ✕
          </Pill>
        )}
        {estadoSel && (
          <Pill tone="blue" size="xs" onClick={() => onEstado?.(null)} style={{ cursor: 'pointer' }}>
            {capitalizarEstado(estadoSel)} ✕
          </Pill>
        )}
        <span style={{ fontSize: 10.5, color: theme.textMuted, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
          {enMapa.filter((e) => e.importe > 0).length} estados con venta · {MESES[mesActivo.mes - 1]} {mesActivo.anio}
        </span>
      </div>

      {vista === 'cuentas' ? (
        <VistaCuentas
          filas={filas} anio={anio} mes={mes} conEstado={conEstado} elegidas={elegidas}
          onElegir={setCuentasSel} nombreCuenta={nombreCuenta} estadoSel={estadoSel} onEstado={onEstado}
          onAbrirGrande={(c) => { setCuentaZoom(c); setVista('medir'); }} theme={theme} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 250px)', gap: 10, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            {vista === 'tiempo' && (
              <BarraTiempo meses={meses12} idx={idxTiempo} onIdx={(i) => { setIdxTiempo(i); setReproduciendo(false); }}
                reproduciendo={reproduciendo} onPlay={() => setReproduciendo((p) => !p)} theme={theme} />
            )}
            <MapaMexico
              datos={estados} seleccion={estadoSel} onSelect={onEstado}
              medida={medidaActiva} onMedida={vista === 'medir' ? setMedida : undefined}
              compacto alto={vista === 'tiempo' ? 380 : 420}
              ficha={ficha} onHover={setHover} resaltado={hover} burbujas={burbujas} />
          </div>
          <Ranking filas={ranking} medida={medidaActiva} max={topRanking} seleccion={estadoSel}
            resaltado={hover} onHover={setHover} onSelect={onEstado} theme={theme} />
        </div>
      )}

      {vista === 'tiempo' && (
        <AlertasGeo filas={filas} anio={mesActivo.anio} mes={mesActivo.mes} onEstado={onEstado} theme={theme} />
      )}
    </div>
  );
}

// ── Ranking lateral ───────────────────────────────────────────────────────────
function Ranking({ filas, medida, max, seleccion, resaltado, onHover, onSelect, theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 460, overflowY: 'auto', minWidth: 0 }}
      onMouseLeave={() => onHover?.(null)}>
      {filas.length === 0 && <span style={{ fontSize: 11, color: theme.textMuted }}>Ninguna fuente manda estado este mes.</span>}
      {filas.map((e) => {
        const v = valorDe(e, medida);
        const on = seleccion === e.estado || resaltado === e.estado;
        const ancho = max ? Math.min(100, (Math.abs(v || 0) / max) * 100) : 0;
        const negativo = medida === 'yoy' && (v || 0) < 0;
        return (
          <button key={e.estado} type="button"
            onMouseEnter={() => onHover?.(e.estado)}
            onClick={() => onSelect?.(seleccion === e.estado ? null : e.estado)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 6px', borderRadius: 8, cursor: 'pointer',
              background: on ? (theme.surfaceHover || 'rgba(0,0,0,0.04)') : 'transparent',
              border: `1px solid ${seleccion === e.estado ? (theme.accent || '#007AFF') : 'transparent'}`,
              color: theme.text, font: 'inherit', fontSize: 11, textAlign: 'left', width: '100%' }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{capitalizarEstado(e.estado)}</span>
            <span style={{ width: 46, height: 4, borderRadius: 999, background: `${theme.text}12`, overflow: 'hidden', flexShrink: 0 }}>
              <span style={{ display: 'block', width: `${ancho}%`, height: '100%', borderRadius: 999,
                background: negativo ? (theme.red || '#FF3B30') : (theme.accent || '#007AFF') }} />
            </span>
            <span style={{ width: 62, textAlign: 'right', flexShrink: 0, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums',
              color: negativo ? theme.red : theme.text }}>{fmtValor(v, medida)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Modo Cuentas · small multiples ────────────────────────────────────────────
function VistaCuentas({ filas, anio, mes, conEstado, elegidas, onElegir, nombreCuenta, estadoSel, onEstado, onAbrirGrande, theme }) {
  const mostradas = useMemo(() => estadosPorCuenta(filas, anio, mes, elegidas), [filas, anio, mes, elegidas]);
  // Misma escala en los cuatro mini mapas: si no, el pequeño miente.
  const escala = useMemo(() => {
    const vals = mostradas.flatMap((c) => c.estados.map((e) => e.importe));
    return { max: vals.length ? Math.max(...vals) : 0, min: 0 };
  }, [mostradas]);
  const huecosPorCuenta = useMemo(() => new Map(mostradas.map((c) => [
    c.cuenta, new Set(ESTADOS_MX.filter((e) => !c.estados.some((x) => x.estado === e && x.importe > 0))),
  ])), [mostradas]);

  const huecosGrupo = useMemo(() => calcHuecos(filas, anio, mes, elegidas, ESTADOS_MX), [filas, anio, mes, elegidas]);
  const dependen = useMemo(() => calcDependencia(filas, anio, mes, 80), [filas, anio, mes]);

  const alternar = (c) => {
    const actual = new Set(elegidas);
    if (actual.has(c)) actual.delete(c); else actual.add(c);
    onElegir([...actual].slice(0, MAX_MINI));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, color: theme.textMuted }}>Cuentas con estado ({conEstado.length}):</span>
        {conEstado.map((c) => (
          <Pill key={c.cuenta} size="xs" tone={elegidas.includes(c.cuenta) ? 'blue' : 'gray'}
            onClick={() => alternar(c.cuenta)} style={{ cursor: 'pointer' }}
            title={`${c.nEstados} estados · ${fmtMoney(c.total)}`}>{nombreCuenta(c.cuenta)}</Pill>
        ))}
        <span style={{ fontSize: 10, color: theme.textMuted }}>máximo {MAX_MINI} · misma escala · naranja = sin venta</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(mostradas.length || 1, MAX_MINI)}, minmax(0, 1fr))`, gap: 8 }}>
        {mostradas.length === 0 && <span style={{ fontSize: 11, color: theme.textMuted }}>Ninguna cuenta elegida manda estado este mes.</span>}
        {mostradas.map((c) => (
          <button key={c.cuenta} type="button" onClick={() => onAbrirGrande(c.cuenta)}
            title={`Abrir ${nombreCuenta(c.cuenta)} en grande`}
            style={{ background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 10, padding: 8, cursor: 'pointer',
              color: theme.text, font: 'inherit', textAlign: 'left', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreCuenta(c.cuenta)}</span>
              <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{c.nEstados} edos</span>
            </div>
            <MapaMexico mini datos={c.estados} medida="importe" escala={escala} alto={150}
              huecosSet={huecosPorCuenta.get(c.cuenta)} seleccion={estadoSel} onSelect={onEstado} />
            <div style={{ marginTop: 4, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {fmtMoney(c.total)} con estado{c.sinEstado > 0 ? ` · ${fmtMoney(c.sinEstado)} sin estado` : ''}
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
        <Lista titulo={`Huecos · ${huecosGrupo.length} estados`} pie="Ningún seleccionado vende ahí este mes." theme={theme}>
          {huecosGrupo.slice(0, 12).map((h) => (
            <FilaLista key={h.estado} theme={theme} onClick={() => onEstado?.(h.estado)}
              izq={capitalizarEstado(h.estado)}
              der={h.otras.length ? `sí venden: ${h.otras.slice(0, 3).map(nombreCuenta).join(', ')}` : 'nadie vende ahí'}
              tone={h.otras.length ? 'orange' : 'gray'} />
          ))}
          {huecosGrupo.length === 0 && <Vacio theme={theme}>Las cuentas elegidas cubren los 32 estados.</Vacio>}
        </Lista>
        <Lista titulo={`Dependencia · ${dependen.length} estados`} pie="Una sola cuenta se lleva más del 80 % del estado." theme={theme}>
          {dependen.slice(0, 12).map((d) => (
            <FilaLista key={d.estado} theme={theme} onClick={() => onEstado?.(d.estado)}
              izq={capitalizarEstado(d.estado)}
              der={`${nombreCuenta(d.cuenta)} ${fmtPct(d.pct)} · ${fmtMoney(d.importe)}`}
              tone={d.pct >= 99 ? 'orange' : 'gray'} />
          ))}
          {dependen.length === 0 && <Vacio theme={theme}>Ningún estado depende de una sola cuenta.</Vacio>}
        </Lista>
      </div>
    </div>
  );
}

// ── Modo Tiempo ───────────────────────────────────────────────────────────────
function BarraTiempo({ meses, idx, onIdx, reproduciendo, onPlay, theme }) {
  const reduce = useRef(reducirMovimiento()).current;
  const m = meses[idx] || meses[meses.length - 1];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <Boton icon={reproduciendo ? Pause : Play} onClick={onPlay} disabled={reduce}
        title={reduce ? 'El sistema pide reducir el movimiento: usa el deslizador' : 'Recorrer los 12 meses'}>
        {reproduciendo ? 'Pausa' : 'Play'}
      </Boton>
      <input type="range" min={0} max={meses.length - 1} step={1} value={idx}
        onChange={(e) => onIdx(Number(e.target.value))} aria-label="Mes del mapa"
        style={{ flex: 1, minWidth: 0, accentColor: theme.accent || '#007AFF' }} />
      <span style={{ width: 74, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {MESES[m.mes - 1]} {m.anio}
      </span>
    </div>
  );
}

function AlertasGeo({ filas, anio, mes, onEstado, theme }) {
  const a = useMemo(() => alertasGeograficas(filas, anio, mes), [filas, anio, mes]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
      <Lista titulo={`Caen · ${a.caen.length}`} pie="Más de 20 % abajo del mismo mes del año pasado." theme={theme}>
        {a.caen.slice(0, 8).map((x) => (
          <FilaLista key={x.estado} theme={theme} onClick={() => onEstado?.(x.estado)}
            izq={capitalizarEstado(x.estado)} der={`${fmtSigno(x.yoy)} · ${fmtMoney(x.importe)}`} tone="orange" />
        ))}
        {a.caen.length === 0 && <Vacio theme={theme}>Ningún estado cae más de 20 %.</Vacio>}
      </Lista>
      <Lista titulo={`Estrenan · ${a.nuevos.length}`} pie="Primera venta en al menos 12 meses." theme={theme}>
        {a.nuevos.slice(0, 8).map((x) => (
          <FilaLista key={x.estado} theme={theme} onClick={() => onEstado?.(x.estado)}
            izq={capitalizarEstado(x.estado)} der={fmtMoney(x.importe)} tone="green" />
        ))}
        {a.nuevos.length === 0 && <Vacio theme={theme}>Ningún estado nuevo este mes.</Vacio>}
      </Lista>
      <Lista titulo={`Dejaron de comprar · ${a.perdidos.length}`} pie="Vendieron el mes pasado y este mes nada." theme={theme}>
        {a.perdidos.slice(0, 8).map((x) => (
          <FilaLista key={x.estado} theme={theme} onClick={() => onEstado?.(x.estado)}
            izq={capitalizarEstado(x.estado)} der={`traía ${fmtMoney(x.importePrev)}`} tone="gray" />
        ))}
        {a.perdidos.length === 0 && <Vacio theme={theme}>Todos los estados del mes pasado repiten.</Vacio>}
      </Lista>
    </div>
  );
}

// ── Piezas menores ────────────────────────────────────────────────────────────
function Lista({ titulo, pie, children, theme }) {
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{titulo}</div>
      <div style={{ fontSize: 9.5, color: theme.textMuted, marginBottom: 6 }}>{pie}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 190, overflowY: 'auto' }}>{children}</div>
    </div>
  );
}
function FilaLista({ izq, der, tone = 'gray', onClick, theme }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%',
        background: 'transparent', border: 0, borderRadius: 7, padding: '2px 4px', cursor: onClick ? 'pointer' : 'default',
        color: theme.text, font: 'inherit', fontSize: 11, textAlign: 'left' }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{izq}</span>
      <Pill tone={tone} size="xs" style={{ flexShrink: 0 }}>{der}</Pill>
    </button>
  );
}
const Vacio = ({ children, theme }) => <span style={{ fontSize: 10.5, color: theme.textMuted }}>{children}</span>;


