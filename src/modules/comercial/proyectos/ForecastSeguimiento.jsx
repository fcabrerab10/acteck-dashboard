// Seguimiento del Forecast CRM (2026-10-04): (1) lotes exportados con «Ya lo cargué en el CRM» (copia las filas a la
// copia del CRM y fecha el lote); (2) «Forecast vs real»: lo exportado para meses ya cerrados contra la venta real
// del cliente (sell out si lo reporta, si no sell in), por SKU y en total, con la precisión del pronóstico.
import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton, TablaCompacta, toast } from '../../../components/kit';
import { queryClient } from '../../../lib/queryClient';
import { useLotesCrm, marcarLoteCargadoDB, invalidarLotes } from '../reservas/datos';
import { MESES_ABR, mesKey } from './forecastCalc';
import { fechaCorta } from '../../../lib/format';

const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');
const pct = (n) => (n == null || !isFinite(n) ? '—' : `${Math.round(n)}%`);

/** Puro: cruza filas exportadas (forecast_crm) con la serie real Map(sku → Map('YYYY-MM' → pz)) en meses cerrados. */
export function compararForecast(exportadas, series, hoy = new Date()) {
  const cerradoHasta = mesKey(hoy.getFullYear(), hoy.getMonth() + 1); // el mes en curso no cuenta
  const porSku = new Map();
  for (const r of exportadas || []) {
    if (r.estado !== 'exportado' || N(r.piezas) <= 0) continue;
    const k = mesKey(N(r.anio), N(r.mes));
    if (k >= cerradoHasta) continue;
    const o = porSku.get(r.sku) || { sku: r.sku, meses: [], forecast: 0, real: 0 };
    const real = N(series?.get(r.sku)?.get(k));
    o.meses.push({ key: k, label: `${MESES_ABR[N(r.mes) - 1]} ${String(r.anio).slice(2)}`, forecast: N(r.piezas), real });
    o.forecast += N(r.piezas); o.real += real;
    porSku.set(r.sku, o);
  }
  const filas = [...porSku.values()].map((o) => ({ ...o, dif: o.real - o.forecast, precision: o.forecast > 0 ? Math.max(0, 100 - (Math.abs(o.real - o.forecast) / o.forecast) * 100) : null })).sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
  const tot = filas.reduce((s, f) => ({ forecast: s.forecast + f.forecast, real: s.real + f.real }), { forecast: 0, real: 0 });
  return { filas, total: { ...tot, dif: tot.real - tot.forecast, precision: tot.forecast > 0 ? Math.max(0, 100 - (Math.abs(tot.real - tot.forecast) / tot.forecast) * 100) : null },
    sobre: filas.filter((f) => f.dif > 0).length, bajo: filas.filter((f) => f.dif < 0).length };
}

export function LotesPanel({ clienteKey }) {
  const { theme } = useTheme();
  const { data: lotes = [] } = useLotesCrm();
  const [marcando, setMarcando] = useState(null);
  const mios = useMemo(() => lotes.filter((l) => !clienteKey || (l.clientes || []).includes(clienteKey)).slice(0, 8), [lotes, clienteKey]);
  const marcar = async (l) => {
    setMarcando(l.id);
    try { const n = await marcarLoteCargadoDB(l.id); toast.ok(`Lote marcado como cargado en el CRM · ${n} filas ya no se vuelven a sugerir`); invalidarLotes(); queryClient.invalidateQueries({ queryKey: ['forecast', 'existente'] }); }
    catch (e) { toast.error(`No se pudo marcar: ${e.message || e}`); }
    finally { setMarcando(null); }
  };
  if (!mios.length) return null;
  return (
    <Panel titulo="Lotes exportados al CRM" meta={`${mios.length} recientes · marca cada uno cuando ya lo hayas cargado en el CRM`} plegable abiertoInicial={mios.some((l) => !l.cargado_crm_at)} padding="0 0 2px">
      <TablaCompacta dense rowKey={(l) => l.id} filas={mios} columnas={[
        { key: 'created_at', label: 'Exportado', align: 'left', width: 110, render: (l) => fechaCorta(String(l.created_at).slice(0, 10)) },
        { key: 'archivo_nombre', label: 'Archivo', align: 'left', render: (l) => <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11 }}>{l.archivo_nombre}</span> },
        { key: 'mes_inicio', label: 'Ventana', align: 'left', width: 120, render: (l) => `${String(l.mes_inicio).slice(0, 7)} · ${l.meses} m` },
        { key: 'filas', label: 'SKUs', width: 54, render: (l) => int(l.filas) },
        { key: 'cargado_crm_at', label: 'En el CRM', align: 'left', width: 200, render: (l) => (l.cargado_crm_at
          ? <Pill size="xs" tone="green">cargado {fechaCorta(String(l.cargado_crm_at).slice(0, 10))}</Pill>
          : <Boton size="sm" icon={CheckCircle2} onClick={() => marcar(l)} disabled={marcando === l.id}>Ya lo cargué en el CRM</Boton>) },
      ]} />
      <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '6px 10px 4px' }}>Al marcarlo, sus SKUs pasan a la copia del CRM y el sugerido deja de proponerlos para esos meses.</div>
    </Panel>
  );
}

export function ForecastVsReal({ exportadas, series, fuente }) {
  const { theme } = useTheme();
  const c = useMemo(() => compararForecast(exportadas, series), [exportadas, series]);
  if (!c.filas.length) return null;
  const tone = c.total.precision == null ? 'gray' : c.total.precision >= 80 ? 'green' : c.total.precision >= 60 ? 'orange' : 'red';
  return (
    <Panel titulo="Forecast vs real" meta={`${c.filas.length} SKUs con meses cerrados · real = ${fuente === 'sellout' ? 'sell out' : 'sell in'} del cliente`} plegable abiertoInicial={false} padding="0 0 2px"
      acciones={<Pill tone={tone}>{pct(c.total.precision)} de precisión · {int(c.total.real)} real vs {int(c.total.forecast)} forecast</Pill>}>
      <TablaCompacta dense maxHeight={360} rowKey={(f) => f.sku} filas={c.filas} columnas={[
        { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100 },
        { key: 'meses', label: 'Meses', align: 'left', render: (f) => <span style={{ color: theme.textMuted, fontSize: 11 }}>{f.meses.map((m) => `${m.label}: ${int(m.real)}/${int(m.forecast)}`).join(' · ')}</span> },
        { key: 'forecast', label: 'Forecast', width: 76, render: (f) => int(f.forecast) },
        { key: 'real', label: 'Real', width: 70, bold: true, render: (f) => int(f.real) },
        { key: 'dif', label: 'Dif.', width: 70, render: (f) => <span style={{ color: f.dif > 0 ? theme.green : f.dif < 0 ? theme.red : theme.textMuted }}>{f.dif > 0 ? '+' : ''}{int(f.dif)}</span> },
        { key: 'precision', label: 'Precisión', width: 76, render: (f) => <Pill size="xs" tone={f.precision == null ? 'gray' : f.precision >= 80 ? 'green' : f.precision >= 60 ? 'orange' : 'red'}>{pct(f.precision)}</Pill> },
      ]} />
      <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '6px 10px 4px' }}>{c.sobre} SKUs vendieron más de lo pronosticado · {c.bajo} menos. Precisión = 100 − |real − forecast| ÷ forecast. Sólo meses ya cerrados.</div>
    </Panel>
  );
}
