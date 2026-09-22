// Panel lateral "Qué falta comprar": SKU, piezas que faltan y la fecha límite para
// colocar la PO (mes objetivo − lead time real). Abajo, los dos botones de salida:
// mandarlo al S&OP como solicitud de compra, o bajarlo en Excel.
import React from 'react';
import { ShoppingCart, FileDown, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Boton, Pill } from '../../../components/kit';
import { int } from '../../../lib/format';
import { fechaCortaISO } from './textos';

export default function QueFaltaComprar({ compras, onAbrirSku, onMandarSop, onExcel, puedeEditar, ocupado }) {
  const { theme } = useTheme();
  const vencidas = compras.filter((c) => c.llegaTarde).length;

  return (
    <Panel titulo="Qué falta comprar" meta={compras.length ? `${compras.length} SKU${compras.length === 1 ? '' : 's'} · ${int(compras.reduce((s, c) => s + c.falta, 0))} pz` : 'nada pendiente'} padding="0">
      {vencidas > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, color: theme.red || '#FF3B30', fontFamily: TYPO.fontText, fontSize: 11 }}>
          <AlertTriangle size={13} />
          {vencidas} {vencidas === 1 ? 'SKU ya pasó' : 'SKUs ya pasaron'} su fecha límite: van a llegar tarde aunque se compren hoy.
        </div>
      )}

      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {compras.map((c, i) => (
          <button key={c.sku} type="button" onClick={() => onAbrirSku?.(c.sku)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px',
              border: 0, borderTop: i === 0 ? 0 : `1px solid ${theme.border}`, background: 'transparent', cursor: 'pointer', color: theme.text,
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sku}</div>
              <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.descripcion || c.proveedor || 'sin proveedor'} · para {c.mesLabel}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{int(c.falta)} pz</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>límite {fechaCortaISO(c.limite)}</div>
            </div>
            <Pill tone={c.llegaTarde ? 'red' : c.diasAlLimite <= 15 ? 'orange' : 'gray'} size="xs">
              {c.llegaTarde ? 'Vencido' : `${c.diasAlLimite} d`}
            </Pill>
          </button>
        ))}
        {!compras.length && (
          <div style={{ padding: '22px 12px', textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11.5 }}>
            Todo lo comprometido tiene respaldo en inventario o en tránsito.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${theme.border}` }}>
        {puedeEditar && <Boton primario icon={ShoppingCart} onClick={onMandarSop} disabled={!compras.length || ocupado}>Mandar al S&OP</Boton>}
        <Boton icon={FileDown} onClick={onExcel} disabled={!compras.length}>Excel</Boton>
      </div>
    </Panel>
  );
}
