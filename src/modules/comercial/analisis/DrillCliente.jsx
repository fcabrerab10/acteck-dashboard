// Drill-down por cliente (fila expandida de la tabla de Análisis por Cliente).
// Bloque "Sell out" arriba (sólo si el cliente tiene fuente de sell out) ·
// tendencia 12 meses (+ año anterior, + contribución si sensible) · 3 KPIs · top 10 SKUs del
// periodo con HeatCell SKU × últimos 6 meses · composición por categoría (roadmap_sku) ·
// alertas activas si el cliente es propio. Detalle SKU: mv_analisis_cliente_sku_mes por código ERP.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { SEV_LABEL } from '../../../lib/alertas';
import { Cargando, KpiCard, HeatCell, Pill, Panel, GraficaLineas } from '../../../components/kit';
import { useDetalleCliente } from './useAnalisisData';
import ResumenSellOut from '../sellout/ResumenSellOut';
import { CUENTA_POR_ERP } from '../sellout/datos';
import { MESES, N, idxMes, enPeriodo, serie12, pctDe } from './calc';
import { money, moneyFull, int, pct } from './formato';

const SEV_TONE = { critica: 'red', alta: 'orange', media: 'yellow', info: 'gray' };

export default function DrillCliente({ cliente, anio, mesMax, modo, verSensible, alertas = [] }) {
  const { theme } = useTheme();
  const accent = theme.accent || '#007AFF', green = theme.green || '#34C759';
  const { data: detalle, isLoading } = useDetalleCliente(cliente.cliente, anio);
  const { data: roadmap } = useRoadmap();

  const serie = useMemo(() => serie12(cliente.mensual, anio, mesMax), [cliente, anio, mesMax]);
  const kpis = useMemo(() => {
    const con = serie.filter((s) => s.fact_neta > 0);
    const mejor = con.reduce((b, s) => (!b || s.fact_neta > b.fact_neta ? s : b), null);
    const prom = con.length ? con.reduce((a, s) => a + s.fact_neta, 0) / con.length : null;
    return { mejor, prom, mesesConCompra: con.length };
  }, [serie]);

  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);

  const { topSkus, categorias, meses6, totalPeriodo } = useMemo(() => {
    const rows = detalle || [];
    const fin = idxMes(anio, mesMax), ini = fin - 5;
    const meses6 = Array.from({ length: 6 }, (_, i) => ini + i);
    const by = new Map(), cat = new Map();
    let total = 0;
    for (const r of rows) {
      const k = idxMes(r.anio, r.mes);
      const sku = r.articulo || '—';
      let s = by.get(sku);
      if (!s) { s = { sku, marca: r.marca, piezas: 0, monto: 0, contribucion: 0, meses: new Map() }; by.set(sku, s); }
      if (k >= ini && k <= fin) s.meses.set(k, (s.meses.get(k) || 0) + N(r.fact_neta));
      if (!enPeriodo(r, anio, mesMax, modo)) continue;
      s.piezas += N(r.piezas_venta_neta); s.monto += N(r.fact_neta); s.contribucion += N(r.contribucion);
      total += N(r.fact_neta);
      const cRaw = String(rd.get(sku)?.categoria || r.categoria || 'Sin categoría').trim();
      const cKey = cRaw.toLowerCase(); // roadmap y ERP difieren en mayúsculas ("Espacio de trabajo" / "Espacio de Trabajo")
      const prev = cat.get(cKey) || { nombre: cRaw, monto: 0 };
      prev.monto += N(r.fact_neta); cat.set(cKey, prev);
    }
    const topSkus = Array.from(by.values()).filter((s) => s.monto > 0 || s.piezas > 0).sort((a, b) => b.monto - a.monto).slice(0, 10)
      .map((s) => ({ ...s, max: Math.max(0, ...meses6.map((k) => s.meses.get(k) || 0)) }));
    const categorias = Array.from(cat.values()).map(({ nombre, monto }) => ({ nombre, monto, pct: pctDe(monto, total) || 0 })).sort((a, b) => b.monto - a.monto);
    return { topSkus, categorias, meses6, totalPeriodo: total };
  }, [detalle, rd, anio, mesMax, modo]);

  const alertasCliente = useMemo(() => (cliente.propio ? alertas.filter((a) => a.cliente_key === cliente.key) : []), [alertas, cliente]);

  if (isLoading) return <div style={{ padding: 12 }}><Cargando pantalla="analisisDrill" minHeight={240} /></div>;

  const periodoLbl = modo === 'mes' ? `${MESES[mesMax - 1]} ${anio}` : `ene–${MESES[mesMax - 1].toLowerCase()} ${anio}`;
  const th = { padding: '4px 6px', fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.divider || theme.border}`, textAlign: 'right', whiteSpace: 'nowrap' };
  const td = { padding: '3px 6px', textAlign: 'right', borderBottom: `1px solid ${theme.border}`, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: theme.text, whiteSpace: 'nowrap' };
  const tip = { fontSize: 11, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' };

  // Sell out: sólo los clientes con fuente (los 12 mayoristas del puente + los 3 propios).
  const cuentaSellOut = CUENTA_POR_ERP[cliente.cliente] || null;

  return (
    <div data-stagger style={{ padding: 12, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', display: 'grid', gap: 10, fontFamily: TYPO.fontText }}>
      {cuentaSellOut && (
        <Panel titulo="Sell out" meta={`${MESES[mesMax - 1]} ${anio} · lo que este cliente desplaza y lo que tiene en su almacén · sin IVA`} padding="10px 12px">
          <ResumenSellOut cuenta={cuentaSellOut} anio={anio} mes={mesMax} compacto />
        </Panel>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
        <KpiCard eyebrow="Mejor mes · últimos 12" big={kpis.mejor ? money(kpis.mejor.fact_neta) : '—'} bigSmall={kpis.mejor ? `${MESES[kpis.mejor.mes - 1]} ${kpis.mejor.anio}` : ''} sub="fact. neta" />
        <KpiCard eyebrow="Promedio mensual" big={money(kpis.prom)} bigSmall={`${kpis.mesesConCompra} de 12 meses con compra`} sub={cliente.ocasional ? 'compra ocasional' : 'cliente recurrente'} />
        <KpiCard eyebrow="Último mes con compra" big={cliente.ultimaCompra ? `${MESES[cliente.ultimaCompra.mes - 1]} ${cliente.ultimaCompra.anio}` : '—'} sub={cliente.ultimaCompra ? `${money(cliente.mensual.get(idxMes(cliente.ultimaCompra.anio, cliente.ultimaCompra.mes))?.fact_neta)} ese mes` : 'sin compras'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 10 }}>
        <Panel titulo="Tendencia · últimos 12 meses" meta={`fact. neta${verSensible ? ' y contribución' : ''} · línea gris = mismo mes del año anterior`} padding="6px 8px 4px">
          <GraficaLineas datos={serie.map((d) => ({ x: d.label, fact_neta: d.fact_neta, anterior: d.anterior, contribucion: d.contribucion }))}
            series={[{ key: 'fact_neta', label: 'Fact. neta', tipo: 'principal' }, { key: 'anterior', label: 'Año anterior', tipo: 'anterior' }, ...(verSensible ? [{ key: 'contribucion', label: 'Contribución', tipo: 'linea', color: green }] : [])]}
            formato={money} alto={190} />
        </Panel>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <Panel titulo="Composición por categoría" meta={`${periodoLbl} · roadmap_sku / ERP`}>
            {!categorias.length && <div style={{ fontSize: 11, color: theme.textMuted }}>Sin ventas en el periodo.</div>}
            <div style={{ display: 'grid', gap: 4 }}>
              {categorias.slice(0, 8).map((c) => (
                <div key={c.nombre} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 60px 44px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.text }}>{c.nombre}</div>
                    <div style={{ height: 3, borderRadius: 999, background: theme.border, marginTop: 2 }}><div style={{ height: '100%', width: `${Math.max(2, c.pct)}%`, background: accent, borderRadius: 999 }} /></div>
                  </div>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600 }}>{money(c.monto)}</span>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: theme.textMuted }}>{pct(c.pct, 0)}</span>
                </div>
              ))}
            </div>
          </Panel>
          {cliente.propio && (
            <Panel titulo="Alertas activas" meta={alertasCliente.length ? `${alertasCliente.length} sin resolver` : 'sin alertas'}>
              {!alertasCliente.length && <div style={{ fontSize: 11, color: theme.textMuted }}>Nada pendiente para este cliente.</div>}
              <div style={{ display: 'grid', gap: 5 }}>
                {alertasCliente.slice(0, 6).map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Pill tone={SEV_TONE[a.severidad] || 'gray'} size="xs" dot>{SEV_LABEL[a.severidad] || a.severidad}</Pill>
                    <span title={a.detalle || ''} style={{ fontSize: 11, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.titulo}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel titulo="Top 10 SKUs" meta={`${periodoLbl} · ${money(totalPeriodo)} · intensidad = mes vs pico del SKU (últimos 6 meses)`} padding="0 0 2px">
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: 22 }}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>SKU</th>
                <th style={{ ...th, textAlign: 'left' }}>Descripción</th>
                <th style={th}>Piezas</th>
                <th style={th}>Fact. neta</th>
                {verSensible && <th style={th}>MC %</th>}
                {meses6.map((k) => <th key={k} style={th}>{MESES[k % 12]} {String(Math.floor(k / 12)).slice(2)}</th>)}
              </tr>
            </thead>
            <tbody>
              {!topSkus.length && <tr><td colSpan={6 + meses6.length} style={{ ...td, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText, padding: 14 }}>Sin SKUs en el periodo.</td></tr>}
              {topSkus.map((s, i) => (
                <tr key={s.sku}>
                  <td style={{ ...td, textAlign: 'left', color: theme.textMuted }}>{i + 1}</td>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{s.sku}</td>
                  <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText, color: theme.textMuted, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{rd.get(s.sku)?.descripcion || s.marca || '—'}</td>
                  <td style={td}>{int(s.piezas)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{moneyFull(s.monto)}</td>
                  {verSensible && <td style={td}>{pct(pctDe(s.contribucion, s.monto))}</td>}
                  {meses6.map((k) => <td key={k} style={td}><HeatCell v={s.meses.get(k) || 0} max={s.max} fmt={money} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
