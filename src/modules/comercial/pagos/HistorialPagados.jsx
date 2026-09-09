// Pagos completados · Segmented 3 m / 6 m / año / todo, agrupados por mes y expandibles.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN, formatFecha } from '../../../lib/utils';
import { Panel, Segmented, TablaCompacta, Pill } from '../../../components/kit';
import { MESES_LARGOS, CategoriaPill, CheckPagado, MONO } from './pagosUI';

export default function HistorialPagados({ pagados, catActiva, onTogglePagado, canEdit }) {
  const { theme } = useTheme();
  const [rango, setRango] = useState('6m');
  const [expandido, setExpandido] = useState(null);

  const pagadosFiltrados = useMemo(() => {
    if (!pagados || pagados.length === 0) return [];
    if (rango === 'todo') return pagados;
    const hoy = new Date();
    let desde;
    if (rango === '3m') { desde = new Date(hoy); desde.setMonth(hoy.getMonth() - 3); }
    else if (rango === '6m') { desde = new Date(hoy); desde.setMonth(hoy.getMonth() - 6); }
    else desde = new Date(hoy.getFullYear(), 0, 1);
    const desdeISO = desde.toISOString().slice(0, 10);
    return pagados.filter((r) => { const f = r.fecha_pago_real || r.fecha_compromiso; return f && String(f).slice(0, 10) >= desdeISO; });
  }, [pagados, rango]);

  const grupos = useMemo(() => {
    const g = {};
    pagadosFiltrados.forEach((r) => { const f = r.fecha_pago_real || r.fecha_compromiso; const k = f ? String(f).slice(0, 7) : 'sin-fecha'; (g[k] = g[k] || []).push(r); });
    return Object.keys(g).sort((a, b) => b.localeCompare(a)).map((k) => {
      const [anio, mm] = k.split('-');
      const nombre = mm && !isNaN(Number(mm)) ? `${MESES_LARGOS[Number(mm) - 1]} ${anio}` : 'Sin fecha';
      const items = g[k];
      return { mes: k, nombre, n: items.length, total: items.reduce((s, r) => s + (Number(r.monto) || 0), 0), items };
    });
  }, [pagadosFiltrados]);

  const totalPagados = pagadosFiltrados.reduce((s, r) => s + (Number(r.monto) || 0), 0);

  const columnas = [
    { key: 'nombre', label: 'Mes', align: 'left', render: (g) => <span style={{ fontWeight: 600 }}>{g.nombre}</span> },
    { key: 'n', label: 'Pagos', align: 'right', render: (g) => `${g.n}` },
    { key: 'total', label: 'Total', align: 'right', sum: true, fmt: formatMXN, render: (g) => <span style={{ fontWeight: 600, color: theme.green }}>{formatMXN(g.total)}</span> },
  ];

  const renderExpandido = (g) => (
    <div style={{ padding: '6px 10px 10px', background: theme.bg }}>
      <TablaCompacta dense columnas={[
        { key: 'concepto', label: 'Concepto', align: 'left', maxWidth: 280, render: (r) => r.concepto },
        { key: 'categoria', label: 'Categoría', align: 'left', render: (r) => <CategoriaPill categoria={r.categoria} size="xs" /> },
        { key: 'monto', label: 'Monto', align: 'right', render: (r) => <span style={{ fontWeight: 600, color: theme.green }}>{formatMXN(r.monto)}</span> },
        { key: 'fecha_pago_real', label: 'F. pago', align: 'left', mono: true, render: (r) => r.fecha_pago_real ? formatFecha(r.fecha_pago_real) : <span style={{ color: theme.textMuted }}>—</span> },
        { key: 'folio', label: 'Folio', align: 'left', mono: true, render: (r) => r.folio || '—' },
        { key: 'responsable', label: 'Responsable', align: 'left', render: (r) => r.responsable || '—' },
        ...(canEdit && onTogglePagado ? [{ key: '_ok', label: '✓', align: 'center', width: 36, render: (r) => <CheckPagado pagado onClick={() => onTogglePagado(r)} title="Click para desmarcar y volver a pendiente" /> }] : []),
      ]} filas={g.items} rowKey={(r) => r.id} />
    </div>
  );

  return (
    <Panel titulo="Pagos completados"
      meta={pagados.length === 0 ? `aún no hay pagos completados${catActiva !== 'todas' ? ' en esta categoría' : ''}` : `${pagadosFiltrados.length} pago${pagadosFiltrados.length !== 1 ? 's' : ''} · ${grupos.length} mes${grupos.length !== 1 ? 'es' : ''}`}
      acciones={
        <>
          <span style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: theme.green }}>{formatMXN(totalPagados)}</span>
          <Segmented value={rango} onChange={setRango} options={[{ id: '3m', label: '3 m' }, { id: '6m', label: '6 m' }, { id: 'anio', label: 'Año' }, { id: 'todo', label: 'Todo' }]} />
        </>
      }>
      <TablaCompacta columnas={columnas} filas={grupos} rowKey={(g) => g.mes} totales={{ total: totalPagados, n: pagadosFiltrados.length }}
        onRowClick={(g) => setExpandido((k) => (k === g.mes ? null : g.mes))} renderExpandido={renderExpandido} expandidoKey={expandido}
        vacio="Sin pagos completados en este rango." />
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, fontFamily: TYPO.fontText }}>Click en un mes para ver el detalle. <Pill tone="gray" size="xs">Agrupado por fecha de pago real</Pill></div>
    </Panel>
  );
}
