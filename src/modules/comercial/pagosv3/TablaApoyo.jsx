// Tabla de productos de un apoyo (drill de Pagos y formulario): SKU · inventario apoyado · precio factura ·
// apoyo por pieza · nuevo costo · monto · inventario restante en el cliente. + pill de cuadre con el ERP.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill } from '../../../components/kit';
import { MONO, mxn, mxn2 } from './ui';
import { calcularApoyo } from './apoyos';

export function PillCuadre({ cuadre, bonificacion, size = 'xs' }) {
  if (!cuadre) return null;
  const txt = cuadre.estado === 'cuadra' ? `NC ${bonificacion?.folio || ''} · cuadra` : cuadre.estado === 'difiere' ? `NC ${bonificacion?.folio || ''} · ${cuadre.label}` : 'sin bonificación del ERP';
  return <Pill tone={cuadre.tone} size={size} dot title={bonificacion ? `${bonificacion.concepto || ''} · ${bonificacion.fecha || ''} · ${mxn(bonificacion.monto)}` : 'Liga la bonificación cuando el ERP la emita'}>{txt}</Pill>;
}

export default function TablaApoyo({ productos = [], bonificacion = null, compacto = false }) {
  const { theme } = useTheme();
  const c = calcularApoyo(productos, bonificacion);
  const th = { textAlign: 'right', padding: '4px 6px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' };
  const td = { textAlign: 'right', padding: '5px 6px', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5, ...MONO, whiteSpace: 'nowrap' };
  const izq = { textAlign: 'left' };
  if (!c.lineas.length) return <div style={{ fontSize: 11, color: theme.textMuted }}>Sin productos.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={{ ...th, ...izq }}>Producto</th><th style={th} title="Inventario apoyado o protegido">Inv apoyado</th><th style={th}>Precio factura</th><th style={th}>Apoyo / pz</th><th style={th}>Nuevo costo</th><th style={th}>Monto</th><th style={th} title="Inventario en el cliente al capturar">Inv restante</th>
        </tr></thead>
        <tbody>
          {c.lineas.map((l) => (
            <tr key={l.sku}>
              <td style={{ ...td, ...izq }}><span style={{ fontWeight: 600 }}>{l.sku}</span>{!compacto && l.descripcion && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.descripcion}</div>}</td>
              <td style={td}>{l.piezas.toLocaleString('es-MX')} pz</td>
              <td style={td}>{mxn2(l.precio_factura)}</td>
              <td style={{ ...td, color: theme.green || '#34C759' }}>−{mxn2(l.apoyo_pz)}</td>
              <td style={{ ...td, fontWeight: 600 }}>{mxn2(l.nuevo_costo)}</td>
              <td style={td}>{mxn(l.monto)}</td>
              <td style={{ ...td, color: l.inv_restante == null ? theme.textMuted : l.inv_restante > 0 ? theme.text : theme.red }}>{l.inv_restante == null ? '—' : `${l.inv_restante.toLocaleString('es-MX')} pz`}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, ...izq, fontWeight: 600, borderBottom: 0 }}>Total</td>
            <td style={{ ...td, borderBottom: 0 }}>{c.piezas.toLocaleString('es-MX')} pz</td>
            <td style={{ ...td, borderBottom: 0 }} colSpan={3} />
            <td style={{ ...td, fontWeight: 700, borderBottom: 0 }}>{mxn(c.total)}</td>
            <td style={{ ...td, borderBottom: 0 }} />
          </tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <PillCuadre cuadre={c.cuadre} bonificacion={bonificacion} />
        {bonificacion && <span style={{ fontSize: 10.5, color: theme.textMuted }}>Bonificación del ERP {mxn(bonificacion.monto)} · {bonificacion.fecha}{bonificacion.concepto ? ` · ${String(bonificacion.concepto).toLowerCase()}` : ''}</span>}
      </div>
    </div>
  );
}
