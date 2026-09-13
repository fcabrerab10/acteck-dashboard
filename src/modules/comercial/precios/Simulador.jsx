// Drill del SKU · "Si muevo el precio": lista + precio nuevo (input o slider ±30 %) → al instante precio con IVA que ve
// el cliente, margen resultante (sólo sensible; costo de v_inventario_comercial) y venta estimada en piezas/mes
// = ritmo actual (promedio 3 meses cerrados) × (1 + elasticidad × Δprecio %), más el Δ de monto mensual.
// Elasticidad: la del SKU → la de su categoría → supuesto por categoría (elasticidad_supuestos, default −1.2; pill
// "supuesto" editable inline para internos). Nada de esto se comparte por WhatsApp. Cálculo puro: precios/elasticidad.js.
import React, { useEffect, useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, DeltaPill, Boton, toast } from '../../../components/kit';
import { simular, elegirElasticidad, ELASTICIDAD_DEFAULT } from './calculo';
import { listaLbl, fmtMoney, fmtInt, fmtPct, fmtPctDelta, fmtElast, selectPill } from './textos';

const ORIGEN_LBL = { sku: 'medida del SKU', categoria: 'de la categoría', supuesto: 'supuesto', default: 'supuesto (default)' };
const ORIGEN_TONE = { sku: 'blue', categoria: 'purple', supuesto: 'orange', default: 'orange' };

export default function Simulador({ row, listasConPrecio, precioDe, costo = 0, sensible = false, ritmo = 0, elastSku, elastCat, supuesto, onGuardarSupuesto, interno = false }) {
  const { theme } = useTheme();
  const [lista, setLista] = useState(listasConPrecio.includes('Mayoreo AAA') ? 'Mayoreo AAA' : listasConPrecio[0] || '');
  const precioActual = lista ? precioDe(lista) : null;
  const [precioTxt, setPrecioTxt] = useState('');
  const [editSup, setEditSup] = useState(null); // string mientras se edita
  useEffect(() => { setPrecioTxt(precioActual != null ? String(Math.round(precioActual * 100) / 100) : ''); }, [lista, precioActual]);

  const precioNuevo = Number(precioTxt);
  const el = elegirElasticidad({ sku: elastSku, categoria: elastCat, supuesto: supuesto?.elasticidad });
  const esSupuesto = el.origen === 'supuesto' || el.origen === 'default';
  const s = precioActual > 0 && precioNuevo > 0 ? simular({ precioActual, precioNuevo, costo, ritmo, elasticidad: el.valor }) : null;
  const sliderPct = precioActual > 0 && precioNuevo > 0 ? Math.max(-30, Math.min(30, ((precioNuevo - precioActual) / precioActual) * 100)) : 0;
  const setDesdeSlider = (pct) => { if (precioActual > 0) setPrecioTxt(String(Math.round(precioActual * (1 + pct / 100) * 100) / 100)); };

  const guardarSupuesto = async () => {
    const v = Number(String(editSup).replace(',', '.'));
    if (!isFinite(v) || v > 0 || v < -10) { toast.error('Escribe una elasticidad entre −10 y 0 (p. ej. −1.2)'); return; }
    try { await onGuardarSupuesto(v); setEditSup(null); toast.ok(`Supuesto de ${row.categoria || 'la categoría'} guardado: ${fmtElast(v)}`); }
    catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); }
  };

  const inputStyle = { ...selectPill(theme), width: 92, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontWeight: 600 };
  const dato = (k, v, sub, color) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: color || theme.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {sub && <div style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );

  return (
    <Panel titulo="Si muevo el precio" meta={`ritmo actual ${fmtInt(ritmo)} pz/mes · promedio 3 meses cerrados`}>
      {!listasConPrecio.length ? <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '10px 0' }}>Sin precio de lista: nada que simular.</div> : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <select value={lista} onChange={(e) => setLista(e.target.value)} style={selectPill(theme)}>
              {listasConPrecio.map((l) => <option key={l} value={l}>{listaLbl(l)} · {fmtMoney(precioDe(l))}</option>)}
            </select>
            <span style={{ fontSize: 11, color: theme.textMuted }}>→</span>
            <input type="number" step="0.01" min="0" value={precioTxt} onChange={(e) => setPrecioTxt(e.target.value)} style={inputStyle} title="Precio nuevo sin IVA" />
            {s && <DeltaPill value={s.deltaPrecioPct} digits={1} />}
            <input type="range" min={-30} max={30} step={1} value={Math.round(sliderPct)} onChange={(e) => setDesdeSlider(Number(e.target.value))} style={{ flex: '1 1 120px', minWidth: 100, accentColor: theme.accent || '#007AFF' }} title="±30 %" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 10.5, color: theme.textMuted }}>Elasticidad</span>
            {editSup == null ? (
              <>
                <Pill tone={ORIGEN_TONE[el.origen]} title={esSupuesto ? 'Sin elasticidad medida: se usa el supuesto de la categoría' : 'Elasticidad medida en cambios de precio con ventana cerrada'}>{fmtElast(el.valor)} · {ORIGEN_LBL[el.origen]}</Pill>
                {esSupuesto && interno && row.categoria && (
                  <Boton icon={Pencil} onClick={() => setEditSup(String(supuesto?.elasticidad ?? ELASTICIDAD_DEFAULT))} title={`Editar el supuesto de ${row.categoria}`}>Editar</Boton>
                )}
              </>
            ) : (
              <>
                <input type="number" step="0.1" max="0" min="-10" value={editSup} onChange={(e) => setEditSup(e.target.value)} style={{ ...inputStyle, width: 72 }} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') guardarSupuesto(); if (e.key === 'Escape') setEditSup(null); }} />
                <span style={{ fontSize: 10.5, color: theme.textMuted }}>para {row.categoria}</span>
                <Boton primario icon={Check} onClick={guardarSupuesto}>Guardar</Boton>
                <Boton icon={X} onClick={() => setEditSup(null)}>Cancelar</Boton>
              </>
            )}
          </div>

          {s && (
            <div style={{ display: 'grid', gridTemplateColumns: sensible ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.divider || theme.border}` }}>
              {dato('Cliente ve (con IVA)', fmtMoney(s.conIva), `sin IVA ${fmtMoney(precioNuevo)}`)}
              {sensible && dato('Margen', s.margenPct != null ? fmtPct(s.margenPct, 1) : '—', s.margenActualPct != null ? `hoy ${fmtPct(s.margenActualPct, 1)} · costo ${fmtMoney(costo)}` : 'sin costo promedio',
                s.margenPct == null ? undefined : s.margenPct < 10 ? (theme.red || '#FF3B30') : s.margenPct < 20 ? (theme.orange || '#FF9500') : undefined)}
              {dato('Venta estimada', `${fmtInt(s.piezasEstimadas)} pz/mes`, `hoy ${fmtInt(s.piezasActual)} pz/mes · ${fmtPctDelta(s.deltaPiezasPct, 1)}`, s.deltaPiezasPct < 0 ? (theme.orange || '#FF9500') : undefined)}
              {dato('Δ monto mensual', (s.deltaMonto >= 0 ? '+' : '−') + fmtMoney(Math.abs(s.deltaMonto)), `${fmtMoney(s.montoActual)} → ${fmtMoney(s.montoEstimado)}${s.deltaMontoPct != null ? ` · ${fmtPctDelta(s.deltaMontoPct, 1)}` : ''}`,
                s.deltaMonto < 0 ? (theme.red || '#FF3B30') : s.deltaMonto > 0 ? (theme.green || '#34C759') : undefined)}
            </div>
          )}
          {ritmo <= 0 && <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>Sin facturación en los 3 meses cerrados: la venta estimada parte de 0.</div>}
        </>
      )}
    </Panel>
  );
}
