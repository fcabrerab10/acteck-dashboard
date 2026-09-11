// Estado de Resultados · V3 (2026-09-11). Kit: Hero · KpiCard · Segmented · Panel · TablaCompacta · Pill.
// Datos: estados_resultados (P&L contable de REVKO, carga manual mensual desde el importador) por
// resultados/datos.js; cálculo puro en resultados/calculo.js (pruebas: scripts/test-resultados-calculo.mjs).
// Toda la pantalla es información sensible: sin `puedeVerSensible(perfil)` se muestra SinAcceso.
// Estructura: Hero (frase del mes + frescura + alertas) → controles (año · mes · Mes/YTD · exportar)
// → 4 KPIs → Tendencia (Recharts) → Puente ERP vs P&L → Tabla formal (TablaCompacta, grupos plegables,
// fila expandible con 24 meses) → Información general → Ficha del mes (HojaLateral).
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Calculator } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import FrescuraPill from '../../components/FrescuraPill';
import { Hero, KpiCard, Pill, Segmented, Panel, Cargando, toneColors } from '../../components/kit';
import { money, moneyCompact, int, pct, pp } from '../../lib/format';
import { cargarAnios, cargarEstado, cargarErp } from './resultados/datos';
import {
  MESES_LBL, MESES_FULL, GRUPOS_TABLA, indexar, mesMaxDe, medidas, serieMensual, alertasDe, fichaMes as calcFichaMes,
  filasTabla, puente as calcPuente, infoGeneral,
} from './resultados/calculo';
import { fraseHero, subHero, mensajeAlerta } from './resultados/textos';
import Tendencia from './resultados/Tendencia';
import TablaFormal from './resultados/TablaFormal';
import FichaMes from './resultados/FichaMes';
import Puente from './resultados/Puente';

const LS_DESCARTADAS = 'edr_alertas_descartadas';

// Pills sobre el Hero (fondo negro en Claro/Marfil). Misma paleta que FrescuraPill.INVERSO; en Midnight el
// Hero es claro y se usan los tonos de modo claro del kit.
const PILL_INVERSO = {
  orange: { background: 'rgba(255,159,10,0.22)', color: '#FFC46B' },
  purple: { background: 'rgba(191,90,242,0.22)', color: '#DDB4FF' },
  gray:   { background: 'rgba(255,255,255,0.10)', color: 'rgba(245,245,247,0.78)' },
};
const pillInverso = (theme, tone) => {
  if (theme.mode === 'dark') { const [background, color] = toneColors({ mode: 'light', textMuted: '#6E6E73' }, tone); return { background, color }; }
  return PILL_INVERSO[tone] || PILL_INVERSO.gray;
};

export default function EstadoResultados() {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const permitido = puedeVerPestanaGlobal(perfil, 'estado_resultados');
  const sensible = puedeVerSensible(perfil);

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [anios, setAnios] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);
  const [erpRows, setErpRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState('mes'); // mes | ytd
  const [mesSel, setMesSel] = useState(null); // null → último mes cargado
  const [mesFicha, setMesFicha] = useState(null);
  const [verTodasAlertas, setVerTodasAlertas] = useState(false);
  const [descartadas, setDescartadas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_DESCARTADAS) || '[]')); } catch { return new Set(); }
  });
  const descartar = (id) => setDescartadas((s) => {
    const n = new Set(s); n.add(id);
    try { localStorage.setItem(LS_DESCARTADAS, JSON.stringify(Array.from(n))); } catch { /* noop */ }
    return n;
  });

  // Años disponibles (una vez). Si el año actual no tiene P&L, cae al más reciente.
  useEffect(() => {
    if (!permitido || !sensible) return;
    let vivo = true;
    cargarAnios().then((lista) => {
      if (!vivo) return;
      setAnios(lista);
      if (lista.length && !lista.includes(anio)) setAnio(lista[0]);
    }).catch((e) => vivo && setError(e?.message || String(e)));
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitido, sensible]);

  // P&L del año y del anterior + medidas del ERP, en paralelo.
  useEffect(() => {
    if (!permitido || !sensible) return;
    let vivo = true;
    setLoading(true); setError(null);
    Promise.all([cargarEstado(anio), cargarErp(anio)]).then(([{ rows: a, rowsPrev: p }, erp]) => {
      if (!vivo) return;
      setRows(a); setRowsPrev(p); setErpRows(erp); setMesSel(null); setLoading(false);
    }).catch((e) => { if (!vivo) return; setError(e?.message || String(e)); setLoading(false); });
    return () => { vivo = false; };
  }, [anio, permitido, sensible]);

  const idx = useMemo(() => indexar(rows), [rows]);
  const idxPrev = useMemo(() => indexar(rowsPrev), [rowsPrev]);
  const mesMax = useMemo(() => mesMaxDe(rows), [rows]);
  const mes = mesSel && mesSel <= mesMax ? mesSel : mesMax;

  const mMes = useMemo(() => medidas(idx, idxPrev, mes, 'mes'), [idx, idxPrev, mes]);
  const mYtd = useMemo(() => medidas(idx, idxPrev, mes, 'ytd'), [idx, idxPrev, mes]);
  const m = modo === 'ytd' ? mYtd : mMes;
  const serie = useMemo(() => serieMensual(idx, idxPrev, mesMax), [idx, idxPrev, mesMax]);
  const alertas = useMemo(() => alertasDe(idx, idxPrev, mesMax, anio).filter((a) => !descartadas.has(a.id)), [idx, idxPrev, mesMax, anio, descartadas]);
  const filas = useMemo(() => filasTabla(GRUPOS_TABLA, idx, idxPrev, mes, mesMax), [idx, idxPrev, mes, mesMax]);
  const puente = useMemo(() => calcPuente(idx, erpRows, mesMax), [idx, erpRows, mesMax]);
  const info = useMemo(() => infoGeneral(idx, idxPrev, mes), [idx, idxPrev, mes]);
  const ficha = useMemo(() => (mesFicha ? calcFichaMes(idx, idxPrev, mesFicha) : null), [idx, idxPrev, mesFicha]);
  const abrirMes = useCallback((mm) => setMesFicha(mm), []);

  // Excel: tabla formal completa + puente. Los % van como fracción (exportar.js los formatea 0.0%).
  const pctFrac = (f) => Object.fromEntries(['difVentaNetaPct', 'difFactNetaPct', 'difContribPct'].map((k) => [k, f[k] == null ? null : f[k] / 100]));
  const excel = () => ({
    titulo: `Estado de resultados ${anio}`,
    archivo: `Estado de resultados ${anio}`,
    hojas: [
      {
        nombre: `P&L ${anio}`,
        subtitulo: `REVKO Technology · MXN · P&L hasta ${MESES_LBL[mesMax - 1]} ${anio}`,
        columnas: [
          { label: 'Grupo', key: 'grupo', tipo: 'texto', ancho: 24 },
          { label: 'Cuenta', key: 'label', tipo: 'texto', ancho: 38 },
          { label: 'Tipo', key: 'tipo', tipo: 'texto', ancho: 9 },
          ...MESES_LBL.map((l, i) => ({ label: `${l} ${anio}`, key: `m${i + 1}`, tipo: 'moneda' })),
          { label: `${MESES_LBL[mes - 1]} ${anio - 1}`, key: 'mesPrev', tipo: 'moneda' },
          { label: 'Δ mes %', key: 'deltaMes', tipo: 'pct' },
          { label: `YTD ${anio}`, key: 'ytd', tipo: 'moneda' },
          { label: `YTD ${anio - 1}`, key: 'ytdPrev', tipo: 'moneda' },
          { label: 'Δ YTD %', key: 'deltaYtd', tipo: 'pct' },
          { label: 'Notas', key: 'notas', tipo: 'texto', ancho: 40 },
        ],
        filas: filas.filter((r) => r.tipo !== 'grupo').map((r) => {
          const esPct = r.formato === 'pct';
          const v = (x) => (x == null ? null : esPct ? x * 100 : x);
          const frac = (x) => (x == null ? null : x / 100); // exportar.js: pct como fracción 0–1
          // Las cuentas en % (Alcance % Gasto vs Venta N.) no caben en columnas de moneda: van como texto en Notas.
          const notas = Object.entries(r.notas || {}).map(([mm, n]) => `${MESES_LBL[Number(mm) - 1]}: ${n}`);
          if (esPct) notas.unshift(MESES_LBL.map((l, i) => (r.valores[i + 1] == null ? null : `${l} ${pct(r.valores[i + 1] * 100)}`)).filter(Boolean).join(' · '));
          const o = { grupo: r.grupo, label: r.label.trim(), tipo: r.tipo === 'subtotal' ? 'Subtotal' : esPct ? '%' : 'Cuenta', mesPrev: esPct ? null : v(r.mesPrev), deltaMes: esPct ? r.deltaMes : frac(r.deltaMes), ytd: r.ytd, ytdPrev: r.ytdPrev, deltaYtd: frac(r.deltaYtd),
            notas: notas.join(' · ') || null };
          for (let i = 1; i <= 12; i++) o[`m${i}`] = esPct ? null : v(r.valores[i]);
          return o;
        }),
      },
      {
        nombre: 'Puente ERP vs P&L',
        subtitulo: `Venta neta del P&L vs Venta neta y Fact. neta del ERP · Utilidad bruta vs Contribución · ${anio}`,
        columnas: [
          { label: 'Mes', key: 'lbl', tipo: 'texto', ancho: 8 },
          { label: 'Venta neta P&L', key: 'plVentaNeta', tipo: 'moneda' },
          { label: 'Ventas brutas P&L', key: 'plVentasBrutas', tipo: 'moneda' },
          { label: 'Fact. bruta ERP', key: 'erpFactBruta', tipo: 'moneda' },
          { label: 'Fact. neta ERP', key: 'erpFactNeta', tipo: 'moneda' },
          { label: 'Venta neta ERP', key: 'erpVentaNeta', tipo: 'moneda' },
          { label: 'Δ Venta neta $', key: 'difVentaNeta', tipo: 'moneda' },
          { label: 'Δ Venta neta %', key: 'difVentaNetaPct', tipo: 'pct' },
          { label: 'Δ Fact. neta $', key: 'difFactNeta', tipo: 'moneda' },
          { label: 'Δ Fact. neta %', key: 'difFactNetaPct', tipo: 'pct' },
          { label: 'Utilidad bruta P&L', key: 'plUtilBruta', tipo: 'moneda' },
          { label: 'Contribución ERP', key: 'erpContribucion', tipo: 'moneda' },
          { label: 'Δ Utilidad $', key: 'difContrib', tipo: 'moneda' },
          { label: 'Δ Utilidad %', key: 'difContribPct', tipo: 'pct' },
          { label: 'Alerta', key: 'alerta', tipo: 'texto', ancho: 8 },
        ],
        filas: puente.filas.map((f) => ({ ...f, ...pctFrac(f), alerta: f.alerta ? 'Sí' : '' })),
        totales: puente.totales ? { lbl: 'YTD', ...puente.totales, ...pctFrac(puente.totales) } : undefined,
      },
    ],
  });

  if (!permitido) return <SinAcceso motivo="No tienes acceso a Estado de Resultados." />;
  if (!sensible) return <SinAcceso motivo="Esta pestaña contiene información sensible." />;
  if (loading) return <Cargando pantalla="estadoResultados" label="Cargando estado de resultados…" minHeight={520} />;

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, color: theme.text, marginBottom: 6 }}>No se pudo cargar el estado de resultados</div>
        <div style={{ fontSize: 12.5 }}>{error}</div>
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        <Calculator style={{ width: 44, height: 44, margin: '0 auto 14px', color: theme.textSubtle || theme.textMuted, strokeWidth: 1.2 }} />
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Estado de resultados</div>
        <div style={{ fontSize: 12.5 }}>No hay P&L cargado para {anio}. Súbelo desde Administración → Datos (Estado de Resultados).</div>
        {anios.length > 0 && <div style={{ marginTop: 14 }}><Segmented value={anio} onChange={setAnio} options={anios.map((y) => ({ id: y, label: String(y) }))} /></div>}
      </div>
    );
  }

  const mesLbl = MESES_FULL[mes - 1];
  const periodo = modo === 'ytd' ? `YTD ene–${MESES_LBL[mes - 1].toLowerCase()} ${anio}` : `${mesLbl} ${anio}`;
  const vsTxt = modo === 'ytd' ? `vs YTD ${anio - 1}` : `vs ${MESES_LBL[mes - 1]} ${anio - 1}`;
  const heroStat = (k, v, delta) => ({ k, v: moneyCompact(v), sub: delta == null ? `vs ${anio - 1}: —` : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} % vs ${anio - 1}` });
  const alertasVisibles = verTodasAlertas ? alertas : alertas.slice(0, 3);

  const kpiDelta = (delta, ppVal, invert = false) => ({
    badge: delta == null ? undefined : { tone: (invert ? delta <= 0 : delta >= 0) ? 'green' : 'red', l: `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%` },
    ppTxt: ppVal == null ? null : pp(ppVal),
  });
  const kVenta = kpiDelta(m.delta.ventaNeta);
  const kBruta = kpiDelta(m.delta.utilBruta, m.delta.brutaPp);
  const kUafir = kpiDelta(m.delta.uafir, m.delta.uafirPp);
  const kUaii = kpiDelta(m.delta.uaii, m.delta.uaiiPp);

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, padding: '10px 6px' }}>
      <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* 1 · Hero narrativo */}
        <Hero
          eyebrow={`Estado de resultados · REVKO Technology · ${mesLbl} ${anio}`}
          titulo={fraseHero(mMes, anio)}
          sub={subHero(medidas(idx, idxPrev, mesMax, 'ytd'), anio, mesMax)}
          stats={[
            heroStat('Venta neta', mMes.ventaNeta, mMes.delta.ventaNeta),
            heroStat('UAII · UAFIR', mMes.uafir, mMes.delta.uafir),
            heroStat('UAI · UAII contable', mMes.uaii, mMes.delta.uaii),
          ]}
        >
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <FrescuraPill pantalla="estadoResultados" inverso />
            <Pill tone="gray" size="xs" style={pillInverso(theme, 'gray')} title="Cadencia de carga manual del P&L: día 10 de cada mes, tolerancia 10 días">
              Carga mensual · día 10 · P&L hasta {MESES_LBL[mesMax - 1]} {anio}
            </Pill>
            {alertasVisibles.map((a) => (
              <Pill key={a.id} tone={a.type === 'yoy' ? 'purple' : 'orange'} size="xs" dot onClick={() => abrirMes(a.mes)}
                title={`${a.type === 'yoy' ? 'Vs año anterior' : 'Vs mes anterior'} · antes ${money(a.valorPrev)} · ahora ${money(a.valor)} · clic abre la ficha del mes`}
                style={pillInverso(theme, a.type === 'yoy' ? 'purple' : 'orange')}>
                {mensajeAlerta(a, anio)}
                <span role="button" aria-label="Descartar alerta" title="Descartar" onClick={(e) => { e.stopPropagation(); descartar(a.id); }}
                  style={{ marginLeft: 2, opacity: 0.7, fontWeight: 700, lineHeight: 1 }}>×</span>
              </Pill>
            ))}
            {alertas.length > 3 && (
              <Pill tone="gray" size="xs" onClick={() => setVerTodasAlertas((v) => !v)} style={pillInverso(theme, 'gray')}>
                {verTodasAlertas ? 'ver menos' : `+${alertas.length - 3} más`}
              </Pill>
            )}
          </div>
        </Hero>

        {/* 2 · Controles */}
        <div data-no-print style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {anios.length > 1 && <Segmented value={anio} onChange={setAnio} options={anios.map((y) => ({ id: y, label: String(y) }))} />}
          <Segmented value={mes} onChange={(v) => setMesSel(v)} options={Array.from({ length: mesMax }, (_, i) => ({ id: i + 1, label: MESES_LBL[i] }))} />
          <Segmented value={modo} onChange={setModo} options={[{ id: 'mes', label: 'Mes' }, { id: 'ytd', label: 'YTD' }]} />
          <span style={{ fontSize: 11, color: theme.textMuted }}>{periodo} · {vsTxt}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <ExportMenu titulo="Estado de resultados" subtitulo={`REVKO Technology · ${periodo}`} excel={excel} pdf={{ ref: rootRef }} />
          </span>
        </div>

        {/* 3 · KPIs del periodo (Mes o YTD) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          <KpiCard eyebrow={`Venta neta · ${modo === 'ytd' ? 'YTD' : mesLbl}`} badge={kVenta.badge} big={moneyCompact(m.ventaNeta)}
            sub={`${vsTxt}: ${moneyCompact(m.prev.ventaNeta)}`} onClick={() => abrirMes(mes)} />
          <KpiCard eyebrow={`Utilidad bruta · ${modo === 'ytd' ? 'YTD' : mesLbl}`} badge={kBruta.badge} big={moneyCompact(m.utilBruta)} bigSmall={m.pct.bruta != null ? `margen ${pct(m.pct.bruta)}` : undefined}
            sub={`${vsTxt}: ${moneyCompact(m.prev.utilBruta)}${m.prev.pct.bruta != null ? ` · ${pct(m.prev.pct.bruta)}` : ''}${kBruta.ppTxt ? ` (${kBruta.ppTxt})` : ''}`} onClick={() => abrirMes(mes)} />
          <KpiCard eyebrow={`UAII · UAFIR s/ proyectos · ${modo === 'ytd' ? 'YTD' : mesLbl}`} badge={kUafir.badge} big={moneyCompact(m.uafir)} bigSmall={m.pct.uafir != null ? `${pct(m.pct.uafir)} s/ venta` : undefined}
            sub={`${vsTxt}: ${moneyCompact(m.prev.uafir)}${kUafir.ppTxt ? ` (${kUafir.ppTxt})` : ''}`} onClick={() => abrirMes(mes)} />
          <KpiCard eyebrow={`UAI · UAII contable s/ proyectos · ${modo === 'ytd' ? 'YTD' : mesLbl}`} badge={kUaii.badge} big={moneyCompact(m.uaii)} bigSmall={m.pct.uaii != null ? `${pct(m.pct.uaii)} s/ venta` : undefined}
            sub={`${vsTxt}: ${moneyCompact(m.prev.uaii)}${kUaii.ppTxt ? ` (${kUaii.ppTxt})` : ''}`} onClick={() => abrirMes(mes)} />
        </div>

        {/* 4 · Tendencia mensual */}
        <Tendencia serie={serie} anio={anio} mesMax={mesMax} onMesClick={abrirMes} />

        {/* 5 · Puente ventas ERP vs P&L */}
        <Puente puente={puente} anio={anio} mesMax={mesMax} onMesClick={abrirMes} />

        {/* 6 · Tabla formal */}
        <Panel
          titulo="Detalle por cuenta"
          meta={`cada cuenta con sus 12 meses, ${MESES_LBL[mes - 1]} vs ${MESES_LBL[mes - 1]} ${anio - 1}, YTD vs YTD ${anio - 1} · clic en un grupo lo pliega · clic en una cuenta muestra sus 24 meses · clic en un mes abre su ficha`}
          padding="0"
          acciones={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <Pill tone="gray" size="xs">Última actualización · {MESES_LBL[mesMax - 1]} {anio}</Pill>
            <Pill tone="gray" size="xs">MXN</Pill>
          </span>}
        >
          <TablaFormal idx={idx} idxPrev={idxPrev} filas={filas} anio={anio} mesSel={mes} mesMax={mesMax} onMesClick={abrirMes} />
        </Panel>

        {/* 7 · Información general */}
        {info.length > 0 && (
          <Panel titulo="Información general" meta={`${mesLbl} ${anio} · T.C. DOF, colaboradores y productividad`} plegable abiertoInicial={false}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
              {info.map((it) => (
                <KpiCard key={it.slug} eyebrow={it.label} big={it.valor == null ? '—' : it.entero ? int(it.valor) : moneyCompact(it.valor)}
                  badge={it.delta == null ? undefined : { tone: it.delta >= 0 ? 'green' : 'red', l: `${it.delta >= 0 ? '↑' : '↓'} ${Math.abs(it.delta).toFixed(1)}%` }}
                  sub={`${anio - 1}: ${it.valorPrev == null ? '—' : it.entero ? int(it.valorPrev) : moneyCompact(it.valorPrev)}`} />
              ))}
            </div>
          </Panel>
        )}

        <p style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', margin: '8px 0 0', fontFamily: TYPO.fontText }}>
          Cifras en MXN · fuente <code style={{ background: theme.surfaceHover, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>estados_resultados</code> (P&L contable, importador central) y <code style={{ background: theme.surfaceHover, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>v_erp_medidas_mes</code> (ventas del ERP)
        </p>
      </div>

      <FichaMes ficha={ficha} anio={anio} abierto={!!mesFicha} onClose={() => setMesFicha(null)} />
    </div>
  );
}
