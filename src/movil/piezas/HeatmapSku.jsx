// SIN USO desde 2026-09-11: Sell In y Sell Out por cliente pasaron a la vista anual con Prom y Total
// (src/movil/pestanas/sellout/TablaAnual.jsx). Se conserva por si alguna pantalla vuelve a querer el
// heatmap de "últimos N meses" sin columnas de cierre; si no, se puede archivar.
//
// Heatmap de un SKU · filas (clientes finales, sucursales o "Piezas") × columnas (últimos N meses).
// Cabecera con SKU y nombre, HeatCell del kit con 5 intensidades relativas al máximo de CADA fila,
// primera columna fija y scroll horizontal. Pensado para abrirse dentro de una HojaM.
//
//   <HeatmapSku sku="AC-943" nombre="Mouse Óptico…" columnas={['Abr','May',…]}
//     filas={[{ label: 'CVA', valores: [12, 0, 30, …] }, …]} unidad="pz"
//     pie="…" onDisponibilidad={() => …} />
import React from 'react';
import { PackageSearch } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { HeatCell, Pill } from '../../components/kit';
import BotonGrande from './BotonGrande';
import { MONO } from '../util';

const fmtPz = (n) => Math.round(n).toLocaleString('es-MX');

export default function HeatmapSku({ sku, nombre, marca, columnas = [], filas = [], unidad = 'pz', totalLabel = 'Total', pie, onDisponibilidad, cargando = false }) {
  const { theme } = useTheme();
  const conDatos = filas.filter((f) => (f.valores || []).some((v) => Number(v) > 0));
  const totales = columnas.map((_, i) => conDatos.reduce((s, f) => s + (Number(f.valores?.[i]) || 0), 0));
  const maxTotal = Math.max(0, ...totales);
  const th = { position: 'sticky', top: 0, background: theme.surface, zIndex: 1, padding: '8px 6px', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textMuted, textAlign: 'center', whiteSpace: 'nowrap', borderBottom: `1px solid ${theme.border}` };
  const tdLabel = { position: 'sticky', left: 0, background: theme.surface, zIndex: 1, padding: '7px 10px', fontSize: 12.5, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150, borderRight: `1px solid ${theme.border}` };
  const td = { padding: '5px 5px', textAlign: 'center' };
  return (
    <div style={{ padding: '0 16px 8px', fontFamily: TYPO.fontText, color: theme.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{sku}{marca && <span style={{ fontWeight: 500, fontSize: 12, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText }}>{marca}</span>}</div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{nombre || 'Sin descripción'}</div>
        </div>
        <Pill tone="gray" style={{ flexShrink: 0 }}>{unidad === 'pz' ? 'Piezas' : unidad}</Pill>
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {cargando && <div style={{ padding: 18, fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>Cargando…</div>}
        {!cargando && conDatos.length === 0 && <div style={{ padding: 18, fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>Sin movimiento en estos meses.</div>}
        {!cargando && conDatos.length > 0 && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 150 + columnas.length * 64 }}>
              <thead>
                <tr>
                  <th style={{ ...th, ...tdLabel, textAlign: 'left', zIndex: 2, textTransform: 'none', letterSpacing: 0, fontFamily: TYPO.fontDisplay, fontSize: 10.5 }}>{conDatos.length > 1 ? `${conDatos.length} filas` : ''}</th>
                  {columnas.map((c) => <th key={c} style={th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {conDatos.map((f) => {
                  const max = Math.max(0, ...(f.valores || []).map((v) => Number(v) || 0));
                  return (
                    <tr key={f.label}>
                      <td style={tdLabel} title={f.label}>{f.label}{f.sub && <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, fontWeight: 400 }}>{f.sub}</span>}</td>
                      {columnas.map((c, i) => <td key={c} style={td}><HeatCell v={Number(f.valores?.[i]) || 0} max={max} fmt={fmtPz} /></td>)}
                    </tr>
                  );
                })}
                {conDatos.length > 1 && (
                  <tr>
                    <td style={{ ...tdLabel, fontFamily: TYPO.fontDisplay, fontWeight: 600, borderTop: `1px solid ${theme.border}` }}>{totalLabel}</td>
                    {totales.map((v, i) => <td key={i} style={{ ...td, borderTop: `1px solid ${theme.border}` }}><HeatCell v={v} max={maxTotal} fmt={fmtPz} /></td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {pie && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '8px 4px 0', lineHeight: 1.4 }}>{pie}</div>}
      {!cargando && conDatos.length > 0 && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: theme.textSubtle || theme.textMuted, padding: '6px 4px 0' }}>
          Total {columnas.length} meses: {fmtPz(totales.reduce((s, v) => s + v, 0))} {unidad}
        </div>
      )}
      {onDisponibilidad && <BotonGrande icon={PackageSearch} onClick={onDisponibilidad} style={{ marginTop: 14 }}>Ver disponibilidad</BotonGrande>}
    </div>
  );
}
