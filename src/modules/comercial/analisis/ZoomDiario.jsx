// Zoom diario (2026-10-02, Fernando: «cómo evoluciona el sell out por día del mes… también para el sell in, para
// mejorar cada cuánto nos colocan compras y que no todo se esté yendo al cierre de mes»).
// Entrada: filas { anio, mes, dia, valor } del año pedido y el anterior; pinta el mes elegido día a día (barras =
// venta del día, línea = acumulado del mes, línea gris = acumulado del mismo mes del año anterior) y lee el patrón:
// qué % del mes entra en los últimos 5 días, en qué semana del mes se concentra, cuántos días con venta y el pico.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, GraficaLineas, Pill } from '../../../components/kit';
import { MESES } from './calc';
import { money, pct } from './formato';

const N = (v) => Number(v) || 0;

/** Resume el patrón del mes: [{ dia, valor, acum }], % últimos 5 días, por semana del mes, días con venta, pico. */
export function patronMes(filas, anio, mes) {
  const diasMes = new Date(anio, mes, 0).getDate();
  const porDia = Array.from({ length: diasMes }, (_, i) => ({ dia: i + 1, valor: 0 }));
  filas.forEach((r) => { if (N(r.anio) === anio && N(r.mes) === mes && r.dia >= 1 && r.dia <= diasMes) porDia[r.dia - 1].valor += N(r.valor); });
  let acum = 0; porDia.forEach((d) => { acum += d.valor; d.acum = acum; });
  const total = acum;
  const ult5 = porDia.slice(-5).reduce((s, d) => s + d.valor, 0);
  const semanas = [0, 0, 0, 0, 0];
  porDia.forEach((d) => { semanas[Math.min(4, Math.floor((d.dia - 1) / 7))] += d.valor; });
  const conVenta = porDia.filter((d) => d.valor > 0).length;
  const pico = porDia.reduce((m, d) => (d.valor > (m?.valor || 0) ? d : m), null);
  const mitad = porDia.slice(0, 15).reduce((s, d) => s + d.valor, 0);
  return { porDia, total, diasMes, pctUlt5: total > 0 ? (ult5 / total) * 100 : null, pctMitad: total > 0 ? (mitad / total) * 100 : null,
    semanas: semanas.map((v, i) => ({ semana: i + 1, valor: v, pct: total > 0 ? (v / total) * 100 : 0 })), conVenta, pico };
}

export default function ZoomDiario({ titulo = 'Evolución por día del mes', filas = [], anio, mes, formato = money, cargando = false, meta, hoy = new Date() }) {
  const { theme } = useTheme();
  const cur = useMemo(() => patronMes(filas, anio, mes), [filas, anio, mes]);
  const prev = useMemo(() => patronMes(filas, anio - 1, mes), [filas, anio, mes]);
  const enCurso = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
  const diaHoy = enCurso ? hoy.getDate() : cur.diasMes;
  const datos = cur.porDia.map((d, i) => ({ x: String(d.dia), dia: d.dia <= diaHoy ? d.valor : null, acum: d.dia <= diaHoy ? d.acum : null, prev: prev.porDia[i]?.acum ?? null }));
  const lectura = cur.total > 0
    ? `${pct(cur.pctUlt5, 0)} del mes entró en los últimos 5 días · ${pct(cur.pctMitad, 0)} en la primera quincena · ${cur.conVenta} de ${enCurso ? diaHoy : cur.diasMes} días con venta${cur.pico ? ` · pico el día ${cur.pico.dia} (${formato(cur.pico.valor)})` : ''}`
    : 'Sin venta registrada en este mes.';
  const tonoCierre = cur.pctUlt5 == null ? 'gray' : cur.pctUlt5 >= 50 ? 'red' : cur.pctUlt5 >= 35 ? 'orange' : 'green';
  return (
    <Panel titulo={titulo} meta={meta || `${MESES[mes - 1]} ${anio} · barras = venta del día · línea = acumulado · gris = acumulado de ${MESES[mes - 1].toLowerCase()} ${anio - 1}`} padding="6px 8px 8px">
      {cargando ? <div style={{ fontSize: 11, color: theme.textMuted, padding: 8 }}>Cargando…</div> : (
        <>
          <GraficaLineas datos={datos} formato={formato} alto={200} compacto
            series={[{ key: 'dia', label: 'Venta del día', tipo: 'principal' }, { key: 'acum', label: 'Acumulado', tipo: 'linea', color: theme.accent }, { key: 'prev', label: `Acumulado ${anio - 1}`, tipo: 'anterior' }]} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '8px 4px 0', fontSize: 11, color: theme.textMuted }}>
            {cur.total > 0 && <Pill size="xs" tone={tonoCierre}>{cur.pctUlt5 >= 50 ? 'Todo se va al cierre' : cur.pctUlt5 >= 35 ? 'Cargado al cierre' : 'Compras repartidas'}</Pill>}
            <span>{lectura}</span>
          </div>
          {cur.total > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, padding: '8px 4px 0' }}>
              {cur.semanas.map((s) => (
                <div key={s.semana} style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted }}><span>{s.semana === 5 ? 'Días 29+' : `Sem ${s.semana}`}</span><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text }}>{pct(s.pct, 0)}</span></div>
                  <div style={{ height: 4, borderRadius: 999, background: `${theme.text}12`, marginTop: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${s.pct}%`, background: s.semana >= 4 && s.pct >= 40 ? theme.orange : theme.accent, borderRadius: 999 }} /></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
