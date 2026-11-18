// Sugeridos exportados pendientes (sugeridos_compra en estado pendiente/exportado; desaparecen al aparecer en
// Master Embarques). Panel plegable + TablaCompacta del kit; cancelar con confirmación y toast. Costos sólo con `sensible`.
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/themeContext';
import { Panel, TablaCompacta, Pill, Boton, toast } from '../../../components/kit';
import { fmtInt, MONO } from '../inventario/constantes';

const usd0 = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

export default function SugeridosPendientes({ sugeridos, onRefresh, sensible, puedeEditar }) {
  const { theme } = useTheme();
  const [cancelando, setCancelando] = useState(null);
  const totalValor = sugeridos.reduce((a, s) => a + Number(s.costo_estimado || 0) * Number(s.cantidad || 0), 0);
  const totalPz = sugeridos.reduce((a, s) => a + Number(s.cantidad || 0), 0);

  const cancelar = async (s) => {
    if (!window.confirm(`¿Cancelar el sugerido de ${s.sku}?`)) return;
    setCancelando(s.id);
    const { error } = await supabase.from('sugeridos_compra').update({ estado: 'cancelado' }).eq('id', s.id);
    setCancelando(null);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.ok('Sugerido cancelado');
    onRefresh?.();
  };

  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, render: (s) => <span style={{ fontFamily: MONO, color: theme.accent, fontSize: 11 }}>{s.sku}</span> },
    { key: 'supplier', label: 'Proveedor', align: 'left', maxWidth: 220, render: (s) => s.supplier || '—' },
    { key: 'cantidad', label: 'Cantidad', width: 80, render: (s) => fmtInt(s.cantidad), renderTotal: (v) => fmtInt(v) },
    ...(sensible ? [
      { key: 'costo_estimado', label: 'Costo USD', width: 84, render: (s) => (s.costo_estimado ? `$${Number(s.costo_estimado).toFixed(2)}` : '—') },
      { key: 'valor', label: 'Valor', width: 96, render: (s) => usd0(Number(s.costo_estimado || 0) * Number(s.cantidad || 0)), renderTotal: (v) => usd0(v) },
    ] : []),
    { key: 'junta_fecha', label: 'Junta', align: 'left', width: 96, render: (s) => s.junta_fecha || '—' },
    { key: 'estado', label: 'Estado', align: 'center', width: 84, render: (s) => <Pill tone={s.estado === 'exportado' ? 'blue' : 'gray'} size="xs">{s.estado}</Pill> },
    { key: 'x', label: '', width: 40, render: (s) => (puedeEditar ? <Boton icon={X} title="Cancelar sugerido" onClick={(e) => { e.stopPropagation(); cancelar(s); }} disabled={cancelando === s.id} style={{ height: 22, padding: '0 6px' }} /> : null) },
  ];
  const totales = { sku: 'Total', supplier: `${sugeridos.length} SKUs`, cantidad: totalPz, ...(sensible ? { valor: totalValor } : {}) };

  return (
    <Panel plegable abiertoInicial={false} titulo="Sugeridos exportados pendientes"
      meta={`${sugeridos.length} SKU${sugeridos.length === 1 ? '' : 's'} · ${fmtInt(totalPz)} pz${sensible ? ` · ${usd0(totalValor)}` : ''} · desaparecen al aparecer en Master Embarques`}
      acciones={<Pill tone="blue" size="xs">{sugeridos.length}</Pill>} padding="8px 10px">
      <TablaCompacta columnas={columnas} filas={sugeridos} rowKey={(s) => s.id} dense totales={totales} maxHeight={320} />
    </Panel>
  );
}
