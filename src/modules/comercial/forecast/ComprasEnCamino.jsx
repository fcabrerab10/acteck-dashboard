// Compras en camino · POs pendientes (contenido del Panel plegable del S&OP).
// Fuente: v_compras_pendientes_proveedor / v_compras_pendientes_sku (tabla compras_oc del ERP,
// migración 20260912_compras_en_camino.sql). Son POs COLOCADAS al proveedor que siguen pendientes:
// pueden no haber embarcado todavía, por eso NO se restan de la brecha ni del sugerido (eso lo hace
// sólo el tránsito de v_transito_sku). Aquí sirven para no volver a pedir lo que ya está pedido.
// USD sólo con `sensible`; sin él se muestran piezas.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Pill } from '../../../components/kit';
import { fmtInt, MONO } from '../inventario/constantes';
import { fmtEtaCorta } from './TablaForecast';

const usd0 = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

export default function ComprasEnCamino({ proveedores = [], lineas = [], sensible = false, onSku }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(null);
  const dash = <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;

  const porProveedor = useMemo(() => {
    const m = new Map();
    lineas.forEach((l) => {
      const k = l.proveedor || 'SIN PROVEEDOR';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(l);
    });
    m.forEach((arr) => arr.sort((a, b) => Number(b.usd_pendiente || 0) - Number(a.usd_pendiente || 0)));
    return m;
  }, [lineas]);

  const filas = useMemo(
    () => proveedores.slice().sort((a, b) => Number(b.usd_pendiente || 0) - Number(a.usd_pendiente || 0)),
    [proveedores],
  );

  const columnas = [
    { key: 'proveedor', label: 'Proveedor', align: 'left', maxWidth: 300, render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        <span style={{ color: abierto === r.proveedor ? theme.accent : (theme.textSubtle || theme.textMuted), fontSize: 9 }}>{abierto === r.proveedor ? '▾' : '▸'}</span>
        <span title={r.proveedor} style={{ fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.proveedor}</span>
      </span>
    ) },
    { key: 'pos', label: 'POs', width: 52, render: (r) => fmtInt(r.pos), renderTotal: (v) => fmtInt(v) },
    { key: 'skus', label: 'SKUs', width: 56, render: (r) => fmtInt(r.skus), renderTotal: (v) => fmtInt(v) },
    { key: 'piezas_pendientes', label: 'Pz pend.', width: 82, render: (r) => fmtInt(r.piezas_pendientes), renderTotal: (v) => fmtInt(v) },
    ...(sensible ? [{ key: 'usd_pendiente', label: 'USD pend.', width: 96, render: (r) => usd0(r.usd_pendiente), renderTotal: (v) => usd0(v) }] : []),
    { key: 'po_mas_antigua', label: 'PO más vieja', align: 'center', width: 104, render: (r) => (
      r.po_mas_antigua
        ? <Pill tone={Number(r.dias_po_mas_antigua) > 120 ? 'red' : Number(r.dias_po_mas_antigua) > 60 ? 'orange' : 'gray'} size="xs" title={`Colocada el ${r.po_mas_antigua}`}>{Math.round(Number(r.dias_po_mas_antigua) || 0)} d</Pill>
        : dash
    ) },
    { key: 'eta_mas_cercana', label: 'Próx. arribo', width: 86, render: (r) => (r.eta_mas_cercana ? <span style={{ fontFamily: TYPO.fontText, fontSize: 11.5 }}>{fmtEtaCorta(r.eta_mas_cercana)}</span> : dash) },
    { key: 'renglones_sin_embarque', label: 'Sin embarcar', align: 'center', width: 92, render: (r) => (
      Number(r.renglones_sin_embarque) > 0
        ? <Pill tone="purple" size="xs" title="Renglones de PO que todavía no aparecen en el Master de Embarques">{fmtInt(r.renglones_sin_embarque)} SKU</Pill>
        : <Pill tone="green" size="xs">todo embarcado</Pill>
    ) },
  ];

  const totales = {
    proveedor: `${filas.length} proveedores`,
    pos: filas.reduce((s, r) => s + (Number(r.pos) || 0), 0),
    skus: filas.reduce((s, r) => s + (Number(r.skus) || 0), 0),
    piezas_pendientes: filas.reduce((s, r) => s + (Number(r.piezas_pendientes) || 0), 0),
    usd_pendiente: filas.reduce((s, r) => s + (Number(r.usd_pendiente) || 0), 0),
  };

  const colsSku = [
    { key: 'sku', label: 'SKU', align: 'left', width: 100, render: (r) => (
      <span role={onSku ? 'button' : undefined} onClick={onSku ? (e) => { e.stopPropagation(); onSku(r.sku); } : undefined}
        style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: theme.accent, cursor: onSku ? 'pointer' : 'default' }}>{r.sku}</span>
    ) },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 280, render: (r) => <span title={r.descripcion}>{r.descripcion || '—'}</span> },
    { key: 'po', label: 'PO', align: 'left', width: 78, mono: true, render: (r) => (
      <span title={r.fecha_po ? `Colocada el ${r.fecha_po}` : ''} style={{ fontFamily: MONO, fontSize: 11 }}>
        {r.po || '—'}
        {r.fecha_po && <span style={{ color: theme.textMuted, marginLeft: 5, fontFamily: TYPO.fontText, fontSize: 10 }}>{fmtEtaCorta(r.fecha_po)}</span>}
      </span>
    ) },
    { key: 'piezas_pedidas', label: 'Pedidas', width: 70, render: (r) => fmtInt(r.piezas_pedidas) },
    { key: 'piezas_pendientes', label: 'Pendientes', width: 80, render: (r) => <span style={{ fontWeight: 600 }}>{fmtInt(r.piezas_pendientes)}</span> },
    ...(sensible ? [{ key: 'usd_pendiente', label: 'USD', width: 86, render: (r) => usd0(r.usd_pendiente) }] : []),
    { key: 'estado', label: 'Estado', align: 'center', width: 116, render: (r) => (
      r.en_master_embarques
        ? <Pill tone="blue" size="xs" title={r.eta ? `Arribo a CEDIS ${r.eta}` : 'En el Master de Embarques'}>{r.eta ? `embarcada · ${fmtEtaCorta(r.eta)}` : 'embarcada'}</Pill>
        : <Pill tone="purple" size="xs" title="La PO existe en el ERP pero todavía no aparece en el Master de Embarques">sin embarcar</Pill>
    ) },
  ];

  return (
    <>
      <TablaCompacta
        columnas={columnas}
        filas={filas}
        rowKey={(r) => r.proveedor}
        dense
        maxHeight={420}
        totales={totales}
        vacio="Sin POs pendientes en el ERP."
        onRowClick={(r) => setAbierto(abierto === r.proveedor ? null : r.proveedor)}
        expandidoKey={abierto}
        renderExpandido={(r) => (
          <div style={{ padding: '8px 10px 10px', minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
            <TablaCompacta columnas={colsSku} filas={porProveedor.get(r.proveedor) || []} rowKey={(x) => `${x.po}-${x.sku}`} dense maxHeight={280}
              vacio="Sin renglones pendientes." />
          </div>
        )}
      />
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, fontFamily: TYPO.fontText, lineHeight: 1.45 }}>
        POs colocadas al proveedor con pendiente &gt; 0 en el ERP (compras_oc). <b>No</b> se restan de la brecha ni del sugerido: eso sólo lo
        hace el tránsito del Master de Embarques, que ya tiene contenedor y ETA. Lo marcado «sin embarcar» es la PO que todavía no aparece en el master.
      </div>
    </>
  );
}
