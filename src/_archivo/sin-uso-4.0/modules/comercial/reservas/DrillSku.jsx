// Drill del SKU dentro de la tabla de Reservas (renderExpandido; uno abierto a la vez).
// Heatmap de sell-out por cliente × mes (año elegible, HeatCell) · arribos con piezas por PO (v_transito_sku)
// · stock del cliente y cobertura (inventario_cliente / sellout_pcel, regla de inventario/constantes.js)
// · reservas anteriores del SKU (forecast_propuesta_lineas). Carga sólo al abrir: <Cargando pantalla="forecastDrill" />.
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, Panel, Segmented, TablaCompacta, Cargando, HeatCell, Boton } from '../../../components/kit';
import { tonoCobertura, etiquetaCobertura, fmtDias, fmtFechaCorta, MONO } from '../inventario/constantes';
import { coberturaDias, metodoInfo } from './calculo';
import { useDrillSku } from './datos';
import { CLIENTES, MESES, fmtInt, roadmapTone, ESTADO_LINEA_LABEL, ESTADO_LINEA_TONE, N } from './textos';

export default function DrillSku({ fila, matriz, anios, metodo, onClose }) {
  const { theme } = useTheme();
  const { data, isLoading } = useDrillSku(fila.sku);
  const aniosLista = anios.length ? anios : [new Date().getFullYear()];
  const [anio, setAnio] = useState(aniosLista[0]);
  const yearData = matriz?.get(anio) || null;

  const heat = useMemo(() => {
    let max = 0;
    const filas = CLIENTES.map((c) => {
      const byMes = (yearData && yearData.get(c.key)) || {};
      let total = 0;
      const meses = Array.from({ length: 12 }, (_, i) => { const v = N(byMes[i + 1]); total += v; if (v > max) max = v; return v; });
      return { key: c.key, label: c.label, tone: c.tone, meses, total };
    });
    const totMes = Array.from({ length: 12 }, (_, i) => filas.reduce((a, f) => a + f.meses[i], 0));
    return { filas, max, totMes, total: totMes.reduce((a, b) => a + b, 0) };
  }, [yearData]);

  const th = { fontFamily: TYPO.fontDisplay, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, padding: '3px 2px', textAlign: 'center', whiteSpace: 'nowrap' };
  const cobertura = CLIENTES.map((c) => {
    const stock = fila.stockCliente?.[c.key];
    const vel = fila.velocidad?.[c.key] || 0;
    const dias = stock == null ? null : coberturaDias(stock, vel);
    return { ...c, stock, vel, dias };
  });

  const embarques = (data?.transito?.embarques_detalle || []).slice().sort((a, b) => String(a.eta || '').localeCompare(String(b.eta || '')));
  const reservas = data?.reservas || [];

  return (
    <div style={{ padding: '12px 14px 14px', background: theme.bg, fontFamily: TYPO.fontText }} data-stagger>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: theme.accent }}>{fila.sku}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fila.descripcion}>{fila.descripcion}</span>
        {fila.marca && <Pill tone="gray" size="xs">{fila.marca}</Pill>}
        {fila.familia && <Pill tone="gray" size="xs">{fila.familia}</Pill>}
        <Pill tone={roadmapTone(fila.roadmap)} size="xs">{fila.roadmap || '—'}</Pill>
        <Pill tone="blue" size="xs">Recom {fmtInt(fila.recomendado)} pz · {metodoInfo(metodo).corto}</Pill>
        <span style={{ flex: 1 }} />
        <Boton icon={X} onClick={onClose}>Cerrar</Boton>
      </div>

      {isLoading ? <Cargando pantalla="forecastDrill" minHeight={220} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Panel titulo="Sell-out por cliente" meta="piezas · intensidad relativa al máximo del SKU en el año"
              acciones={<Segmented size="sm" value={anio} onChange={setAnio} options={aniosLista.map((a) => ({ id: a, label: String(a) }))} />}
              padding="6px 8px 8px">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '2px 2px' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left', paddingLeft: 6, width: 84 }}>Cliente</th>
                      {MESES.map((m) => <th key={m} style={th}>{m}</th>)}
                      <th style={{ ...th, textAlign: 'right', paddingRight: 6, width: 54 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heat.filas.map((f) => (
                      <tr key={f.key}>
                        <td style={{ padding: '2px 6px', whiteSpace: 'nowrap' }}><Pill tone={f.tone} size="xs" dot>{f.label}</Pill></td>
                        {f.meses.map((v, i) => <td key={i} style={{ textAlign: 'center', padding: 0 }}><HeatCell v={v} max={heat.max} /></td>)}
                        <td style={{ textAlign: 'right', padding: '2px 6px', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: theme.text }}>{fmtInt(f.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...th, textAlign: 'left', paddingLeft: 6, borderTop: `1px solid ${theme.border}` }}>Tot mes</td>
                      {heat.totMes.map((t, i) => <td key={i} style={{ textAlign: 'center', borderTop: `1px solid ${theme.border}`, fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: t > 0 ? theme.text : (theme.textSubtle || theme.textMuted), padding: '4px 0 0' }}>{t > 0 ? fmtInt(t) : '—'}</td>)}
                      <td style={{ textAlign: 'right', padding: '4px 6px 0', borderTop: `1px solid ${theme.border}`, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: theme.accent }}>{fmtInt(heat.total)}</td>
                    </tr>
                  </tbody>
                </table>
                {!yearData && <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', padding: '6px 6px 0' }}>Sin sell-out para {anio}.</div>}
              </div>
            </Panel>

            <Panel titulo="Reservas anteriores del SKU" meta={reservas.length ? `${reservas.length} línea${reservas.length === 1 ? '' : 's'}` : 'ninguna'} padding="0">
              <TablaCompacta dense maxHeight={200} vacio="Este SKU no se ha reservado antes."
                filas={reservas} rowKey={(r) => r.id}
                columnas={[
                  { key: 'propuesta', label: 'Propuesta', align: 'left', maxWidth: 220, render: (r) => <span title={r.forecast_propuestas?.nombre}>{r.forecast_propuestas?.nombre || '—'}</span> },
                  { key: 'estatus', label: 'Estatus', align: 'center', render: (r) => <Pill tone={r.forecast_propuestas?.estatus === 'cerrada' ? 'green' : r.forecast_propuestas?.estatus === 'generada' ? 'blue' : 'gray'} size="xs">{r.forecast_propuestas?.estatus || '—'}</Pill> },
                  { key: 'reservo', label: 'Reservo', render: (r) => fmtInt(r.reservo) },
                  { key: 'confirmado', label: 'Confirmado', render: (r) => (r.confirmado == null ? '—' : fmtInt(r.confirmado)) },
                  { key: 'estado', label: 'Estado', align: 'center', render: (r) => <Pill tone={ESTADO_LINEA_TONE[r.estado] || 'gray'} size="xs">{ESTADO_LINEA_LABEL[r.estado] || r.estado}</Pill> },
                  { key: 'arribo', label: 'Arribo est.', render: (r) => fmtFechaCorta(r.fecha_arribo_estimada) },
                  { key: 'fecha', label: 'Fecha', render: (r) => fmtFechaCorta(r.forecast_propuestas?.generado_at || r.updated_at) },
                ]} />
            </Panel>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Panel titulo="Arribos por PO" meta={data?.transito ? `${fmtInt(data.transito.cantidad)} pz en tránsito · ETA ${fmtFechaCorta(data.transito.eta_mas_cercana)}` : 'sin tránsito'} padding="0">
              <TablaCompacta dense maxHeight={200} vacio="Sin POs en tránsito para este SKU."
                filas={embarques} rowKey={(r, i) => `${r.po}-${i}`}
                columnas={[
                  { key: 'po', label: 'PO', align: 'left', mono: true, render: (r) => <span style={{ fontFamily: MONO, fontSize: 11 }}>{r.po || '—'}</span> },
                  { key: 'eta', label: 'ETA', render: (r) => fmtFechaCorta(r.eta) },
                  { key: 'estatus', label: 'Estatus', align: 'center', render: (r) => <Pill tone={/PRODUCCION/i.test(r.estatus || '') ? 'orange' : /TRANSITO|NAVEGANDO|PUERTO/i.test(r.estatus || '') ? 'blue' : 'gray'} size="xs">{r.estatus || '—'}</Pill> },
                  { key: 'cantidad', label: 'Piezas', sum: true, render: (r) => fmtInt(r.cantidad) },
                ]} />
            </Panel>

            <Panel titulo="Stock del cliente y cobertura" meta="a su ritmo de sell-out (método elegido)" padding="0">
              <TablaCompacta dense vacio="Sin inventario del cliente."
                filas={cobertura} rowKey={(r) => r.key}
                columnas={[
                  { key: 'label', label: 'Cliente', align: 'left', render: (r) => <Pill tone={r.tone} size="xs" dot>{r.label}</Pill> },
                  { key: 'stock', label: 'Stock', render: (r) => (r.stock == null ? <span style={{ color: theme.textSubtle || theme.textMuted }}>s/d</span> : fmtInt(r.stock)) },
                  { key: 'vel', label: 'Sell-out/mes', render: (r) => fmtInt(Math.round(r.vel)) },
                  { key: 'dias', label: 'Cobertura', align: 'center', render: (r) => (r.stock == null ? '—' : <Pill tone={tonoCobertura(r.dias, r.stock > 0)} size="xs">{r.stock > 0 && r.dias != null ? fmtDias(r.dias) : etiquetaCobertura(r.dias, r.stock > 0)}</Pill>) },
                ]} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
