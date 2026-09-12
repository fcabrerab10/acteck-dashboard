// Panel "Equipo comercial" · erp_ventas.vendedor está lleno al 100 % (25 vendedores) y
// hasta hoy no se veía en ninguna pantalla. Las cifras salen de v_medidas_ventas_vendedor_mes,
// que traduce literal las medidas del director (docs/MEDIDAS_DIRECTOR.md) con el grano vendedor.
//
// REGLA: los % (MC, devoluciones) NO se suman ni se promedian — se recalculan sobre el
// agregado con derivadas()/divide() de src/lib/medidas.js.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { agregar, divide, aPct, ETIQUETA, N as Nm } from '../../../lib/medidas';
import { Panel, TablaCompacta, DeltaPill, Skeleton, GraficaLineas, Cargando } from '../../../components/kit';
import { MESES, MESES_LARGO, fmtInt, fmtPct, fmtMoneyShort, pctDelta } from './textos';
import { useVendedores, useVendedorClientes } from './datos';

const nombreCorto = (v) => {
  const p = String(v || '').trim().split(/\s+/);
  return p.length <= 2 ? p.join(' ') : `${p[0]} ${p[1]}`;
};

export default function EquipoComercial({ anio, mes, sensible = false }) {
  const { theme } = useTheme();
  const anioPrev = anio - 1;
  const [abierta, setAbierta] = useState(null);
  const [orden, setOrden] = useState({ col: 'ytd', dir: 'desc' });
  const { data: filasVista = [], isLoading } = useVendedores(anio);

  const filas = useMemo(() => {
    const porVend = new Map();
    for (const r of filasVista) {
      const v = r.vendedor || 'SIN VENDEDOR';
      if (!porVend.has(v)) porVend.set(v, []);
      porVend.get(v).push(r);
    }
    const out = [];
    for (const [vendedor, rows] of porVend) {
      const delMes = rows.find((r) => Nm(r.anio) === anio && Nm(r.mes) === mes) || null;
      const ytd = agregar(rows, (r) => Nm(r.anio) === anio && Nm(r.mes) <= mes);
      const ytdPrev = agregar(rows, (r) => Nm(r.anio) === anioPrev && Nm(r.mes) <= mes);
      const serie = Array.from({ length: 12 }, (_, i) => {
        const a = rows.find((r) => Nm(r.anio) === anio && Nm(r.mes) === i + 1);
        const p = rows.find((r) => Nm(r.anio) === anioPrev && Nm(r.mes) === i + 1);
        return { x: MESES[i], act: a && i < mes ? Math.round(Nm(a.fact_neta)) : null, prev: p ? Math.round(Nm(p.fact_neta)) : null };
      });
      out.push({
        key: vendedor, vendedor, corto: nombreCorto(vendedor),
        mes: delMes ? Nm(delMes.fact_neta) : 0,
        mesPrev: Nm(rows.find((r) => Nm(r.anio) === anioPrev && Nm(r.mes) === mes)?.fact_neta),
        ytd: ytd.fact_neta, ytdPrev: ytdPrev.fact_neta, yoy: pctDelta(ytd.fact_neta, ytdPrev.fact_neta),
        piezas: ytd.piezas_venta_neta, clientes: delMes ? Nm(delMes.clientes) : 0,
        dev: aPct(divide(Math.abs(ytd.devoluciones), ytd.fact_bruta)),
        mc: ytd.pct_mc, bonif: Math.abs(ytd.bonificaciones), serie,
      });
    }
    const f = orden.dir === 'asc' ? 1 : -1;
    return out.filter((r) => r.ytd || r.ytdPrev || r.mes).sort((a, b) => (
      orden.col === 'vendedor' ? String(a.vendedor).localeCompare(String(b.vendedor)) * f : ((a[orden.col] ?? -Infinity) - (b[orden.col] ?? -Infinity)) * f
    ));
  }, [filasVista, anio, anioPrev, mes, orden]);

  const totales = useMemo(() => {
    const t = agregar(filasVista, (r) => Nm(r.anio) === anio && Nm(r.mes) <= mes);
    const tPrev = agregar(filasVista, (r) => Nm(r.anio) === anioPrev && Nm(r.mes) <= mes);
    return {
      mes: filas.reduce((s, r) => s + r.mes, 0), ytd: t.fact_neta,
      yoy: pctDelta(t.fact_neta, tPrev.fact_neta), piezas: t.piezas_venta_neta,
      clientes: filas.reduce((s, r) => s + r.clientes, 0),
      dev: aPct(divide(Math.abs(t.devoluciones), t.fact_bruta)), mc: t.pct_mc,
    };
  }, [filasVista, filas, anio, anioPrev, mes]);

  const columnas = useMemo(() => {
    const cols = [
      { key: 'vendedor', label: 'Vendedor', align: 'left', sort: true, maxWidth: 230, render: (r) => <span title={r.vendedor}>{r.corto}</span>, renderTotal: () => `${filas.length} vendedores` },
      { key: 'mes', label: MESES[mes - 1], align: 'right', width: 90, sort: true, render: (r) => (r.mes ? fmtMoneyShort(r.mes) : <span style={{ color: theme.textSubtle }}>—</span>), renderTotal: (v) => fmtMoneyShort(v) },
      { key: 'ytd', label: `YTD ${anio}`, align: 'right', width: 96, sort: true, bold: true, render: (r) => fmtMoneyShort(r.ytd), renderTotal: (v) => fmtMoneyShort(v) },
      { key: 'yoy', label: 'Δ YoY', align: 'right', width: 72, sort: true, render: (r) => (r.ytdPrev || r.ytd ? <span title={`YTD ${anioPrev}: ${fmtMoneyShort(r.ytdPrev)}`}><DeltaPill value={r.yoy} /></span> : <span style={{ color: theme.textSubtle }}>—</span>), renderTotal: (v) => <DeltaPill value={v} /> },
      { key: 'piezas', label: 'Piezas', align: 'right', width: 74, sort: true, render: (r) => fmtInt(r.piezas), renderTotal: (v) => fmtInt(v) },
      { key: 'clientes', label: 'Clientes', align: 'right', width: 66, sort: true, render: (r) => (r.clientes ? fmtInt(r.clientes) : <span style={{ color: theme.textSubtle }}>—</span>), renderTotal: (v) => fmtInt(v) },
      { key: 'dev', label: 'Dev %', align: 'right', width: 62, sort: true, render: (r) => (r.dev == null ? <span style={{ color: theme.textSubtle }}>—</span> : <span style={{ color: Math.abs(r.dev) >= 5 ? (theme.orange || '#FF9500') : theme.text }}>{fmtPct(Math.abs(r.dev), 1)}</span>), renderTotal: (v) => (v == null ? '—' : fmtPct(Math.abs(v), 1)) },
    ];
    if (sensible) cols.push({ key: 'mc', label: 'MC %', align: 'right', width: 62, sort: true, render: (r) => (r.mc == null ? <span style={{ color: theme.textSubtle }}>—</span> : <span style={{ color: r.mc >= 25 ? (theme.green || '#34C759') : r.mc >= 15 ? theme.text : (theme.orange || '#FF9500'), fontWeight: 600 }}>{fmtPct(r.mc, 1)}</span>), renderTotal: (v) => (v == null ? '—' : fmtPct(v, 1)) });
    return cols;
  }, [mes, anio, anioPrev, sensible, theme, filas.length]);

  const onSort = (col) => setOrden((p) => (p?.col !== col ? { col, dir: 'desc' } : { col, dir: p.dir === 'desc' ? 'asc' : 'desc' }));
  const meta = isLoading ? 'cargando…' : `${MESES_LARGO[mes - 1]} ${fmtMoneyShort(totales.mes)} · YTD ${fmtMoneyShort(totales.ytd)} · ${filas.length} vendedores · ${ETIQUETA.fact_neta}`;

  return (
    <Panel titulo="Equipo comercial" meta={meta} plegable abiertoInicial={false} padding="8px 10px 10px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10.5, color: theme.textMuted }}>
          Vendedor de cada renglón del ERP (<span style={{ fontFamily: TYPO.fontDisplay }}>v_medidas_ventas_vendedor_mes</span>) · fact. neta, piezas y clientes atendidos del mes · Δ YoY sobre el YTD.
          {sensible ? ' El % MC se recalcula sobre el agregado, nunca se promedia.' : ''} Toca una fila para ver sus 12 meses y sus clientes principales.
        </div>
        {isLoading ? <Skeleton h={200} r={10} /> : (
          <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.key} totales={totales} dense maxHeight="56vh"
            orden={orden} onSort={onSort}
            onRowClick={(r) => setAbierta((k) => (k === r.key ? null : r.key))} expandidoKey={abierta}
            vacio="El ERP no trajo vendedor en estos meses."
            renderExpandido={(r) => <DrillVendedor fila={r} anio={anio} anioPrev={anioPrev} mes={mes} theme={theme} />} />
        )}
      </div>
    </Panel>
  );
}

/** Drill de un vendedor: 12 meses de fact. neta (vs año anterior) + sus 8 clientes principales del mes. */
function DrillVendedor({ fila, anio, anioPrev, mes, theme }) {
  const { data: clientes = [], isLoading } = useVendedorClientes(fila.vendedor, anio);
  const top = useMemo(() => {
    const delMes = clientes.filter((c) => Nm(c.mes) === mes && Nm(c.fact_neta) !== 0);
    const map = new Map();
    for (const c of delMes) {
      const k = c.cliente || c.cliente_nombre || '—';
      const o = map.get(k) || { key: k, label: c.cliente_nombre || k, fact: 0, piezas: 0 };
      o.fact += Nm(c.fact_neta); o.piezas += Nm(c.piezas);
      map.set(k, o);
    }
    return [...map.values()].sort((a, b) => b.fact - a.fact).slice(0, 8);
  }, [clientes, mes]);
  const totalMes = top.reduce((s, c) => s + c.fact, 0);

  return (
    <div data-stagger style={{ padding: 10, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 10, fontFamily: TYPO.fontText }}>
      <Panel titulo="Fact. neta · 12 meses" meta={`${anio} vs ${anioPrev}`} padding="6px 8px 4px">
        <GraficaLineas datos={fila.serie} series={[{ key: 'act', label: String(anio), tipo: 'principal' }, { key: 'prev', label: String(anioPrev), tipo: 'anterior' }]} formato={fmtMoneyShort} alto={170} mesActivo={mes - 1} />
      </Panel>
      <Panel titulo={`Clientes principales · ${MESES[mes - 1]}`} meta={top.length ? `${top.length} de ${new Set(clientes.filter((c) => Nm(c.mes) === mes).map((c) => c.cliente)).size}` : 'sin ventas en el mes'}>
        {isLoading && <Cargando pantalla="analisisDrill" minHeight={120} />}
        {!isLoading && !top.length && <div style={{ fontSize: 11, color: theme.textMuted }}>Este vendedor no facturó en {MESES[mes - 1]}.</div>}
        <div style={{ display: 'grid', gap: 4 }}>
          {top.map((c) => (
            <div key={c.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 86px 52px', gap: 8, alignItems: 'center', fontSize: 11 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.text }} title={c.label}>{c.label}</div>
                <div style={{ height: 3, borderRadius: 999, background: theme.border, marginTop: 2 }}>
                  <div style={{ height: '100%', width: `${totalMes ? Math.max(2, (c.fact / totalMes) * 100) : 2}%`, background: theme.accent || '#007AFF', borderRadius: 999 }} />
                </div>
              </div>
              <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600 }}>{fmtMoneyShort(c.fact)}</span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: theme.textMuted }}>{fmtInt(c.piezas)} pz</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
