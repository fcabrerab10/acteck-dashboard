// Pestaña Clientes · lista agrupada Propios / Canales del ERP / Otros del ERP con pill de cuota o YoY (MTD a mismo día).
import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { canalLabel } from '../../modules/general/inicio/config';
import { useNav } from '../nav';
import { TituloGrande, ListaAgrupada, Fila, Skeleton, Vacio } from '../piezas';
import { useClientesMes, PROPIOS, nombreCliente, colorCliente } from '../datos';
import { money, moneyCompact, deltaPct, tonoCuota, tonoDelta, MESES, N } from '../util';
import FichaCliente from './FichaCliente';

const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

export default function Clientes() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const { data, isLoading, error } = useClientesMes(anio);

  const { propios, canales, otros } = useMemo(() => {
    if (!data) return { propios: [], canales: [], otros: [] };
    const diasMes = new Date(anio, mes, 0).getDate();
    const factor = Math.min(1, Math.max(1, hoy.getDate()) / diasMes); // YoY a mismo día
    const fila = (key, rows, cuotaMes) => {
      const cur = sum(rows.filter((r) => N(r.anio) === anio && N(r.mes) === mes), (r) => r.monto);
      const prev = sum(rows.filter((r) => N(r.anio) === anio - 1 && N(r.mes) === mes), (r) => r.monto);
      const ytd = sum(rows.filter((r) => N(r.anio) === anio && N(r.mes) <= mes), (r) => r.monto);
      return { key, cur, prev, ytd, yoy: delta(cur, prev * factor), cuota: cuotaMes, pct: cuotaMes > 0 ? (cur / cuotaMes) * 100 : null };
    };
    const byKey = new Map();
    data.fact.forEach((r) => { if (!byKey.has(r.cliente_key)) byKey.set(r.cliente_key, []); byKey.get(r.cliente_key).push(r); });
    const propios = PROPIOS.map((k) => fila(k, byKey.get(k) || [], sum(data.cuotas.filter((c) => c.cliente === k && N(c.mes) === mes), (c) => c.cuota_ideal)));
    const otros = [...byKey.keys()].filter((k) => !PROPIOS.includes(k)).map((k) => fila(k, byKey.get(k), 0)).filter((f) => f.cur || f.prev || f.ytd).sort((a, b) => b.cur - a.cur);
    const byCanal = new Map();
    data.canales.forEach((r) => { const k = r.canal || 'otros'; if (!byCanal.has(k)) byCanal.set(k, []); byCanal.get(k).push({ ...r, monto: r.fact_neta }); });
    const canales = [...byCanal.keys()].map((k) => fila(k, byCanal.get(k), 0)).filter((f) => f.cur || f.prev).sort((a, b) => b.cur - a.cur);
    return { propios, canales, otros };
  }, [data, anio, mes, hoy]);

  const abrir = (key, tipo, label) => nav.push(<FichaCliente clienteKey={key} tipo={tipo} label={label} />, `cliente-${key}`);
  const sub = `${MESES[mes - 1]} ${anio} · mes en curso`;

  if (error) return (<><TituloGrande titulo="Clientes" sub={sub} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar los clientes" sub={error.message} /></>);
  if (isLoading || !data) {
    return (<><TituloGrande titulo="Clientes" sub={sub} /><div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}><Skeleton h={170} r={12} /><Skeleton h={230} r={12} /><Skeleton h={120} r={12} /></div></>);
  }

  const pillDe = (f) => (f.pct != null ? { tone: tonoCuota(f.pct), label: `${Math.round(f.pct)}% cuota` } : { tone: tonoDelta(f.yoy), label: f.yoy != null ? `${deltaPct(f.yoy)} YoY` : 'sin comparativo' });

  return (
    <>
      <TituloGrande titulo="Clientes" sub={sub} />
      <ListaAgrupada titulo="Propios" pie="Pill = avance de la cuota mensual (facturación sell-in).">
        {propios.map((f) => (
          <Fila key={f.key} tono={colorCliente(f.key, theme)} titulo={nombreCliente(f.key)} sub={f.cuota > 0 ? `${money(f.cur)} de ${moneyCompact(f.cuota)} · YTD ${moneyCompact(f.ytd)}` : `${money(f.cur)} · YTD ${moneyCompact(f.ytd)}`}
            pill={pillDe(f)} onClick={() => abrir(f.key, 'propio')} />
        ))}
      </ListaAgrupada>
      <ListaAgrupada titulo="Canales del ERP" meta={canales.length || undefined} style={{ marginTop: 18 }} pie="Fact Neta del ERP · YoY contra el mismo día del año anterior.">
        {canales.length === 0 && <Vacio icon={null} titulo="Sin ventas del ERP este mes" style={{ padding: '18px' }} />}
        {canales.map((f) => (
          <Fila key={f.key} titulo={canalLabel(f.key)} sub={`${money(f.cur)} · YTD ${moneyCompact(f.ytd)}`} pill={pillDe(f)} onClick={() => abrir(f.key, 'canal', canalLabel(f.key))} />
        ))}
      </ListaAgrupada>
      <ListaAgrupada titulo="Otros del ERP" meta={otros.length || undefined} style={{ marginTop: 18 }} pie="Clientes sin pestaña propia, agrupados por canal en facturacion_clientes.">
        {otros.length === 0 && <Vacio icon={null} titulo="Sin otros clientes con facturación" style={{ padding: '18px' }} />}
        {otros.map((f) => (
          <Fila key={f.key} titulo={nombreCliente(f.key)} sub={`${money(f.cur)} · YTD ${moneyCompact(f.ytd)}`} pill={pillDe(f)} onClick={() => abrir(f.key, 'otro')} />
        ))}
      </ListaAgrupada>
    </>
  );
}
