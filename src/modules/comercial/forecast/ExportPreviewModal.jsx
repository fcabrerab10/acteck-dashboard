// Revisión previa al exportar · Modal del kit de perfil (comun.jsx). Líneas agrupadas por proveedor editables en vivo
// (± contenedores, quitar) y botón Exportar a Excel. USD sólo con `sensible` (sin él: piezas y contenedores).
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Modal } from '../../../components/perfil/comun';
import { Pill, Boton } from '../../../components/kit';
import { fmtInt, MONO } from '../inventario/constantes';
import { agruparPorProveedor } from './ExportCart';

const usd0 = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

function PreviewLine({ linea, onEditarLinea, onEliminarLinea, sensible }) {
  const { theme } = useTheme();
  const cantidad = Number(linea.cantidad || 0);
  const cnt = Number(linea.contenedores || 0);
  const pzPorCnt = cnt > 0 ? cantidad / cnt : 0;
  const inc = () => onEditarLinea?.(linea.id, { cantidad: cantidad + (pzPorCnt || 100), contenedores: cnt + 1 });
  const dec = () => { if (cnt <= 1) return; onEditarLinea?.(linea.id, { cantidad: Math.max(0, cantidad - (pzPorCnt || 100)), contenedores: cnt - 1 }); };
  const usd = cantidad * Number(linea.ultimo_costo_usd || 0);
  const btn = { width: 24, height: 24, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, cursor: 'pointer', lineHeight: 1, padding: 0 };
  return (
    <div style={{ padding: '8px 12px', borderTop: `1px solid ${theme.divider || theme.border}`, display: 'grid', gridTemplateColumns: '90px 1fr auto auto auto', gap: 12, alignItems: 'center', fontSize: 12 }}>
      <span style={{ fontFamily: MONO, color: theme.accent, fontSize: 11.5, fontWeight: 500 }}>{linea.sku}</span>
      <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={linea.descripcion}>{linea.descripcion || linea.sku}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button type="button" onClick={dec} disabled={cnt <= 1} style={{ ...btn, cursor: cnt <= 1 ? 'not-allowed' : 'pointer', opacity: cnt <= 1 ? 0.5 : 1 }}>−</button>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, minWidth: 30, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{cnt > 0 ? cnt : fmtInt(cantidad)}</span>
        <button type="button" onClick={inc} style={btn}>+</button>
      </div>
      <div style={{ minWidth: 44 }}>
        <div style={{ fontSize: 9.5, color: theme.textMuted, fontWeight: 500, lineHeight: 1 }}>{cnt > 0 ? 'cnt' : 'pz'}</div>
        {cnt > 0 && <div style={{ fontSize: 9, color: theme.textSubtle || theme.textMuted, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtInt(cantidad)} pz</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        {sensible && <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>{usd0(usd)}</span>}
        <button type="button" onClick={() => onEliminarLinea?.(linea.id)} title="Quitar del export" style={{ ...btn, border: 0, background: 'transparent', color: theme.textMuted }}>✕</button>
      </div>
    </div>
  );
}

export default function ExportPreviewModal({ abierto, activo, lineas, totalPz, totalUsd, onEditarLinea, onEliminarLinea, onExportar, onCerrar, sensible }) {
  const { theme } = useTheme();
  const [exportando, setExportando] = useState(false);
  if (!activo) return null;
  const { grouped, singles } = agruparPorProveedor(lineas, 1);
  const gruposArr = [...grouped, ...singles].sort((a, b) => b.usd - a.usd || b.pz - a.pz);
  const nProv = gruposArr.length;
  const totalCnt = gruposArr.reduce((a, g) => a + g.cnt, 0);
  const avgPerCnt = totalCnt > 0 ? totalUsd / totalCnt : 0;
  const handleExportar = async () => { setExportando(true); try { await onExportar(); } finally { setExportando(false); } };
  const cab = { fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted };
  const big = { fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 1, lineHeight: 1 };

  return (
    <Modal abierto={abierto} onClose={onCerrar} theme={theme} ancho={780} zIndex={95}
      titulo={activo.notas || activo.nombre || `Export #${activo.id}`}
      sub={`S&OP · Revisión previa · ${lineas.length} SKUs · ${fmtInt(totalPz)} pz · listo para exportar`}
      pie={(
        <>
          <span style={{ fontSize: 11, color: theme.textMuted, marginRight: 'auto', alignSelf: 'center' }}>Editando en tiempo real · los cambios se guardan al modificar</span>
          <Boton onClick={onCerrar} disabled={exportando}>Cancelar</Boton>
          <Boton primario icon={Download} onClick={handleExportar} disabled={exportando || lineas.length === 0} style={{ background: theme.green, borderColor: theme.green }}>{exportando ? 'Exportando…' : 'Exportar a Excel'}</Boton>
        </>
      )}>
      <div style={{ padding: '10px 12px', borderRadius: 12, background: `${theme.accent}0D`, border: `1px solid ${theme.accent}22`, display: 'grid', gridTemplateColumns: sensible ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 14, marginBottom: 10 }}>
        {sensible && <div><div style={cab}>Total USD</div><div style={{ ...big, fontSize: 22, color: theme.accent }}>{usd0(totalUsd)}</div></div>}
        <div><div style={cab}>Piezas</div><div style={big}>{fmtInt(totalPz)}</div></div>
        <div><div style={cab}>Contenedores</div><div style={big}>{totalCnt}<span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, marginLeft: 3 }}>cnt</span></div></div>
        <div style={{ textAlign: 'right' }}><div style={cab}>{sensible ? 'USD prom / cnt' : 'Proveedores'}</div><div style={big}>{sensible ? usd0(avgPerCnt) : nProv}</div></div>
      </div>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {gruposArr.map((g, gi) => (
          <div key={g.prov} style={{ borderTop: gi > 0 ? `1px solid ${theme.divider || theme.border}` : 'none' }}>
            <div style={{ padding: '7px 12px', background: theme.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div title={g.prov} style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: theme.text, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.prov}</span>
                {g.arr.length >= 2 && <Pill tone="blue" size="xs">{g.arr.length} SKUs</Pill>}
              </div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
                {sensible ? usd0(g.usd) : `${fmtInt(g.pz)} pz`}
                <span style={{ fontFamily: TYPO.fontText, color: theme.textMuted, fontWeight: 500, fontSize: 10.5, marginLeft: 4 }}>· {g.cnt > 0 ? `${g.cnt} cnt` : sensible ? `${fmtInt(g.pz)} pz` : ''}</span>
              </div>
            </div>
            {g.arr.map((l) => <PreviewLine key={l.id} linea={l} onEditarLinea={onEditarLinea} onEliminarLinea={onEliminarLinea} sensible={sensible} />)}
          </div>
        ))}
      </div>
    </Modal>
  );
}
