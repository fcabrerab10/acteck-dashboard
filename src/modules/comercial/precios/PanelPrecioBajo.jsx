// Precio bajo accionable · Panel plegable que abre el KpiCard "Precio bajo": cliente · SKU · precio facturado ·
// precio de su lista · diferencia % · piezas · monto dejado en la mesa (= (lista − real) × piezas). Ordenable y
// exportable a Excel (ExportMenu). Fuente: v_estrategia_precios_bajo (cliente más bajo del año por SKU, ≥ 50 pz)
// contra la lista que le corresponde (precios/textos.js · listaDeCliente).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Panel, TablaCompacta, Pill, DeltaPill } from '../../../components/kit';
import ExportMenu from '../../../components/ExportMenu';
import { fmtMoney, fmtInt, fmtMoneyShort, listaLbl } from './textos';

// `abrir`: contador que sube con cada clic en el KpiCard; remonta el Panel abierto (0 = plegado al inicio).
export default function PanelPrecioBajo({ filas, abrir = 0, id = 'precio-bajo' }) {
  const abierto = abrir > 0;
  const { theme } = useTheme();
  const [orden, setOrden] = useState({ col: 'dejado', dir: 'desc' });
  const onSort = (col) => setOrden((o) => ({ col, dir: o.col === col && o.dir === 'desc' ? 'asc' : 'desc' }));
  const ordenadas = useMemo(() => {
    const s = orden.dir === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = a[orden.col], vb = b[orden.col];
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
      return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')) * s;
    });
  }, [filas, orden]);
  const totalDejado = filas.reduce((s, r) => s + r.dejado, 0);

  const columnas = [
    { key: 'cliente', label: 'Cliente', align: 'left', sort: true, maxWidth: 200, render: (r) => <span title={r.cliente} style={{ fontWeight: 500 }}>{r.cliente}</span> },
    { key: 'sku', label: 'SKU', align: 'left', sort: true, mono: true, render: (r) => <span style={{ fontWeight: 600, fontSize: 10.5 }}>{r.sku}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', sort: true, maxWidth: 260, render: (r) => <span title={r.descripcion}>{r.descripcion || '—'}</span> },
    { key: 'lista', label: 'Su lista', align: 'left', sort: true, render: (r) => <Pill tone="gray" size="xs">{listaLbl(r.lista)}</Pill> },
    { key: 'real', label: 'Facturado', sort: true, render: (r) => <span style={{ color: theme.orange || '#FF9500', fontWeight: 600 }}>{fmtMoney(r.real)}</span> },
    { key: 'precioLista', label: 'Lista', sort: true, render: (r) => fmtMoney(r.precioLista) },
    { key: 'difPct', label: 'Dif.', sort: true, render: (r) => <DeltaPill value={r.difPct} digits={1} /> },
    { key: 'piezas', label: 'Piezas', sort: true, sum: true, render: (r) => fmtInt(r.piezas), fmt: fmtInt },
    { key: 'dejado', label: 'En la mesa', sort: true, sum: true, render: (r) => <span style={{ fontWeight: 600 }}>{fmtMoney(r.dejado)}</span>, fmt: fmtMoney },
  ];

  const excel = () => ({
    titulo: 'Precio bajo facturado',
    hojas: [{
      nombre: 'Precio bajo',
      subtitulo: `${filas.length} SKUs · ${fmtMoneyShort(totalDejado)} dejados en la mesa`,
      columnas: [
        { label: 'Cliente', key: 'cliente', ancho: 32 }, { label: 'SKU', key: 'sku', ancho: 14 }, { label: 'Descripción', key: 'descripcion', ancho: 50 },
        { label: 'Su lista', key: 'lista', ancho: 18 }, { label: 'Precio facturado', key: 'real', tipo: 'moneda', ancho: 14 },
        { label: 'Precio de su lista', key: 'precioLista', tipo: 'moneda', ancho: 14 }, { label: 'Diferencia %', key: 'difPct', tipo: 'pct', ancho: 12 },
        { label: 'Piezas', key: 'piezas', tipo: 'numero', ancho: 10 }, { label: 'Dejado en la mesa', key: 'dejado', tipo: 'moneda', ancho: 16 },
      ],
      filas: ordenadas.map((r) => ({ ...r, difPct: r.difPct / 100 })),
      totales: { piezas: filas.reduce((s, r) => s + r.piezas, 0), dejado: totalDejado },
    }],
  });

  return (
    <Panel key={abrir} id={id} plegable abiertoInicial={abierto}
      titulo="Precio bajo · clientes facturados debajo de su lista"
      meta={filas.length ? `${filas.length} SKUs · ${fmtMoneyShort(totalDejado)} dejados en la mesa · cliente más bajo del año por SKU (≥ 50 pz)` : 'ningún SKU facturado debajo de su lista'}
      acciones={<ExportMenu titulo="Precio bajo facturado" excel={excel} deshabilitado={!filas.length} />}>
      <TablaCompacta columnas={columnas} filas={ordenadas} rowKey={(r) => r.sku} orden={orden} onSort={onSort} maxHeight={420} dense vacio="Ningún SKU facturado debajo de su lista con los filtros actuales." />
    </Panel>
  );
}
