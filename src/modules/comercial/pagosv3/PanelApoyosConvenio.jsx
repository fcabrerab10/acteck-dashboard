// Apoyos vigentes por costo convenio (2026-10-01, Fernando: «lo que se pone como apoyo es la diferencia entre el costo y
// el costo convenio… que te pueda reportar cuando se hacen nuevos apoyos y tú los cuadres»). Sección «Apoyos» de Pagos:
//   · lista los SKUs del cliente cuyo convenio (última foto de inventario) está por debajo de lo que le facturamos:
//     apoyo por pieza = factura − convenio; apoyo sobre inventario = apoyo × stock en piso;
//   · marca cuáles ya están registrados en Pagos (tipo apoyo_producto) y cuáles faltan por registrar;
//   · «Registrar» abre el formulario con el SKU, el apoyo por pieza y las piezas = inventario disponible en ese momento.
// Sólo Digitalife reporta costo convenio; para los demás clientes la sección lo dice y ya.
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, KpiCard, TablaCompacta, Pill, Segmented, Boton, Cargando } from '../../../components/kit';
import { useApoyosConvenio, useApoyosPorSku } from './datosApoyos';
import { apoyosVigentes } from './apoyos';
import { fechaCorta } from '../../../lib/format';

const mxn = (n) => (n == null || !isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n));
const mxn2 = (n) => (n == null || !isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
const int = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-MX'));
const FILTROS = [{ id: 'todos', label: 'Todos' }, { id: 'pendientes', label: 'Por registrar' }, { id: 'registrados', label: 'Registrados' }];

export default function PanelApoyosConvenio({ clienteKey, nombre, puedeEditar = false, onRegistrar }) {
  const { theme } = useTheme();
  const { data: filas = [], isLoading } = useApoyosConvenio(clienteKey);
  const { data: porSku } = useApoyosPorSku(clienteKey);
  const [filtro, setFiltro] = useState('todos');
  const [orden, setOrden] = useState({ col: 'apoyo_inventario', dir: 'desc' });

  const v = useMemo(() => apoyosVigentes(filas, porSku), [filas, porSku]);
  const lista = useMemo(() => {
    let l = v.vigentes;
    if (filtro === 'pendientes') l = l.filter((f) => !f.registrado);
    if (filtro === 'registrados') l = l.filter((f) => f.registrado);
    const dir = orden.dir === 'asc' ? 1 : -1;
    return [...l].sort((a, b) => { const va = a[orden.col], vb = b[orden.col]; if (typeof va === 'string') return String(va).localeCompare(String(vb)) * dir; return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir; });
  }, [v, filtro, orden]);

  if (clienteKey !== 'digitalife' && !filas.length && !isLoading) {
    return <Panel titulo="Apoyos por costo convenio" meta={nombre}><div style={{ fontSize: 11.5, color: theme.textMuted }}>{nombre} no reporta costo convenio en su inventario: aquí sólo se cuadra Digitalife. Los apoyos de este cliente se registran con «Apoyo por producto» y se cuadran contra la bonificación del ERP.</div></Panel>;
  }
  if (isLoading) return <Cargando pantalla="pagos" minHeight={240} />;
  const foto = filas[0] ? `foto semana ${filas[0].semana} · ${filas[0].anio}` : 'sin foto';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="SKUs con apoyo en convenio" big={int(v.vigentes.length)} bigSmall={`de ${int(filas.length)}`} sub={`${foto} · apoyo = factura − convenio`} />
        <KpiCard eyebrow="Apoyo sobre inventario en piso" big={mxn(v.apoyoInventario)} sub={`${int(v.piezas)} pz con apoyo · ${mxn(v.apoyoPorPieza)} prom/pz`} />
        <KpiCard eyebrow="Por registrar en Pagos" big={int(v.pendientes)} bigColor={v.pendientes ? theme.orange : theme.green} sub={v.pendientes ? `${mxn(v.apoyoPendiente)} sobre inventario sin pago registrado` : 'todos los apoyos del convenio ya tienen pago'} />
        <KpiCard eyebrow="Convenio arriba de la factura" big={int(v.compraronCaro)} sub="compraron a un precio anterior más alto; no es apoyo" />
      </div>

      <Panel titulo="Apoyos vigentes por costo convenio" meta={`${lista.length} SKUs · ordenado por ${orden.col === 'apoyo_inventario' ? 'apoyo sobre inventario' : orden.col}`}
        acciones={<Segmented size="sm" options={FILTROS} value={filtro} onChange={setFiltro} />} padding="0 0 2px">
        <TablaCompacta dense maxHeight={520} rowKey={(r) => r.sku} filas={lista} orden={orden}
          onSort={(col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'sku' || col === 'titulo' ? 'asc' : 'desc' }))}
          vacio={filtro === 'pendientes' ? 'Todos los apoyos del convenio ya están registrados.' : 'Ningún SKU con apoyo en el convenio.'}
          columnas={[
            { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100, sort: true },
            { key: 'titulo', label: 'Producto', align: 'left', maxWidth: 240, render: (r) => <span style={{ color: theme.textMuted }} title={r.titulo || ''}>{r.titulo || '—'}</span> },
            { key: 'precio_factura', label: 'Factura', width: 86, sort: true, render: (r) => <span title={r.fecha_factura ? `última factura ${fechaCorta(r.fecha_factura)}` : ''}>{mxn2(r.precio_factura)}</span> },
            { key: 'costo_convenio', label: 'Convenio', width: 86, sort: true, render: (r) => mxn2(r.costo_convenio) },
            { key: 'apoyo_pz', label: 'Apoyo / pz', width: 86, sort: true, bold: true, render: (r) => <span style={{ color: theme.green }}>{mxn2(r.apoyo_pz)}</span> },
            { key: 'apoyo_pct', label: '%', width: 52, sort: true, render: (r) => (r.apoyo_pct == null ? '—' : `${Number(r.apoyo_pct).toFixed(0)}%`) },
            { key: 'stock', label: 'Stock', width: 60, sort: true, render: (r) => int(r.stock) },
            { key: 'vendidas_90d', label: 'Vend. 90 d', width: 74, sort: true, render: (r) => <span style={{ color: r.vendidas_90d < 10 ? theme.orange : theme.text }}>{int(r.vendidas_90d)}</span> },
            { key: 'apoyo_inventario', label: 'Apoyo en inv.', width: 96, sort: true, bold: true, render: (r) => mxn(r.apoyo_inventario) },
            { key: 'registrado', label: 'En Pagos', width: 150, align: 'left', sort: true, render: (r) => (r.registrado
              ? <Pill tone="green" size="xs" title={r.registro.folios?.length ? `NC ${r.registro.folios.join(', ')}` : 'sin NC ligada'}>{r.registro.n} apoyo{r.registro.n === 1 ? '' : 's'} · {mxn(r.registro.monto)}</Pill>
              : <Pill tone="orange" size="xs">por registrar</Pill>) },
            ...(puedeEditar && onRegistrar ? [{ key: 'accion', label: '', width: 96, align: 'left', render: (r) => (
              <Boton icon={Plus} onClick={(e) => { e.stopPropagation(); onRegistrar({ sku: r.sku, apoyo_pz: Number(r.apoyo_pz), piezas: Number(r.stock) || null, descripcion: r.titulo || '' }); }}>Registrar</Boton>
            ) }] : []),
          ]} />
        <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '6px 10px 4px' }}>
          Convenio de la última foto de inventario de {nombre} · factura = último precio que le facturamos por SKU · los apoyos se dan por todo el inventario disponible en ese momento, por eso «Registrar» propone las piezas en piso.
        </div>
      </Panel>
    </div>
  );
}
