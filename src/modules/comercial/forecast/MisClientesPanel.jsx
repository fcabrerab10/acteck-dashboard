// S&OP · «Mis clientes» en la web (2026-10-06; Fernando lo aprobó del celular, punto 5). Mismo motor puro que el celular
// (movil/pestanas/sop/calculo.js#calcularMisClientes): forecast capturado de cada cliente propio (forecast_crm + copia del
// CRM + proyectos probables/confirmados donde no hay forecast) − inventario del cliente − nuestro stock − tránsito por ETA
// (FIFO por mes, reparto proporcional entre clientes) → qué comprar y desde qué mes. Los datos de clientes salen de los
// mismos hooks del celular (useSopClientes); inventario y tránsito, de los que ya bajó la pantalla (useForecastData).
import React, { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, TablaCompacta, Pill, Boton } from '../../../components/kit';
import { useSopClientes } from '../../../movil/pestanas/sop/datos';
import { calcularMisClientes, fraseMisClientes, mesesDesde, costoDe, usdCompact } from '../../../movil/pestanas/sop/calculo';

const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');

export default function MisClientesPanel({ data, rows = [], sensible = false, onAgregarSolicitud, puedeEditar = false }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const cli = useSopClientes(abierto);
  const hoy = useMemo(() => new Date(), []);
  const ventana = useMemo(() => mesesDesde(hoy, 6, 1), [hoy]);
  const inventario = useMemo(() => { const m = new Map(); for (const r of data?.inventario || []) if (r.sku) m.set(r.sku, (m.get(r.sku) || 0) + N(r.disponible ?? r.inventario)); return m; }, [data?.inventario]);
  const llegadas = useMemo(() => { const out = []; for (const t of data?.transito || []) for (const e of Array.isArray(t.embarques_detalle) ? t.embarques_detalle : []) if (e?.po && N(e.cantidad) > 0) out.push({ sku: t.sku, po: e.po, eta: e.eta || null, cantidad: N(e.cantidad) }); return out; }, [data?.transito]);
  const costos = useMemo(() => new Map(rows.map((r) => [r.sku, costoDe(r)])), [rows]);
  const descripciones = useMemo(() => { const m = new Map(); for (const r of data?.roadmap || []) if (r.sku && r.descripcion) m.set(r.sku, r.descripcion); for (const r of rows) if (r.sku && r.descripcion && !m.has(r.sku)) m.set(r.sku, r.descripcion); return m; }, [data?.roadmap, rows]);
  const res = useMemo(() => (abierto && !cli.loading ? calcularMisClientes({ clientes: cli.clientes.map((c) => ({ key: c.key, label: c.label, forecast: c.forecast, stock: c.stock })), inventario, llegadas, ventana, costos, descripciones, hoy }) : null), [abierto, cli.loading, cli.clientes, inventario, llegadas, ventana, costos, descripciones, hoy]);

  const colsCli = [
    { key: 'label', label: 'Cliente', align: 'left', bold: true },
    { key: 'forecastPz', label: 'Forecast', render: (c) => `${int(c.forecastPz)} pz` },
    { key: 'netoPz', label: 'Neto de su piso', render: (c) => `${int(c.netoPz)} pz` },
    { key: 'cubierto', label: 'Cubierto', render: (c) => `${int(c.cubierto)} pz` },
    { key: 'falta', label: 'Falta', bold: true, render: (c) => (c.falta > 0 ? <span style={{ color: theme.red }}>{int(c.falta)} pz</span> : <Pill tone="green" size="xs">cubierto</Pill>) },
    { key: 'primerHueco', label: 'Desde', render: (c) => (c.primerHueco ? ventana.find((m) => m.key === c.primerHueco)?.label || c.primerHueco : '—') },
    ...(sensible ? [{ key: 'usd', label: 'USD', render: (c) => (c.usd > 0 ? usdCompact(c.usd) : '—') }] : []),
  ];
  const colsComprar = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 110 },
    { key: 'descripcion', label: 'Producto', align: 'left', maxWidth: 240, render: (r) => <span style={{ color: theme.textMuted }}>{r.descripcion || '—'}</span> },
    { key: 'piezas', label: 'Faltan', bold: true, render: (r) => `${int(r.piezas)} pz` },
    { key: 'desdeLabel', label: 'Desde', align: 'left' },
    { key: 'clientes', label: 'Para', align: 'left', render: (r) => (r.clientes || []).map((c) => `${c.label} ${int(c.piezas)}`).join(' · ') },
    { key: 'tienePo', label: 'PO', render: (r) => (r.tienePo ? <Pill tone="blue" size="xs">en camino</Pill> : <Pill tone="gray" size="xs">sin PO</Pill>) },
    ...(sensible ? [{ key: 'usd', label: 'USD', render: (r) => (r.usd > 0 ? usdCompact(r.usd) : '—') }] : []),
    ...(puedeEditar && onAgregarSolicitud ? [{ key: 'acc', label: '', width: 90, render: (r) => <Boton onClick={() => onAgregarSolicitud(r.sku, r.piezas)}>+ Solicitud</Boton> }] : []),
  ];
  const meta = !abierto ? 'forecast de Digitalife · PCEL · Dicotech contra su piso, nuestro stock y lo que viene' : cli.loading ? 'cargando forecast de los tres…' : res ? fraseMisClientes(res, { sensible }) : '';
  return (
    <Panel titulo="Mis clientes · qué comprar para su forecast" meta={meta} plegable abiertoInicial={false} onToggle={(o) => { if (o) setAbierto(true); }}
      acciones={!abierto ? <Boton icon={Users} onClick={() => setAbierto(true)}>Calcular</Boton> : null}>
      {abierto && res && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
          <TablaCompacta dense columnas={colsCli} filas={res.porCliente} rowKey={(c) => c.key} />
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Comprar para mis clientes · {res.comprar.length} SKUs</div>
          <TablaCompacta dense maxHeight={360} columnas={colsComprar} filas={res.comprar} rowKey={(r) => r.sku} vacio="Con lo que tienen, tenemos y viene no hace falta comprar nada." />
          <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>El forecast se captura en Proyectos y forecast; aquí sólo se convierte en compra. Lo que tiene el cliente en su piso consume primero su propio forecast; lo vencido en tránsito cuenta este mes.</div>
        </div>
      )}
      {abierto && cli.loading && <div style={{ fontSize: 12, color: theme.textMuted, padding: 8 }}>Cargando forecast de los tres clientes…</div>}
    </Panel>
  );
}
