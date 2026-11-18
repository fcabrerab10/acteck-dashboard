// Inventario vs venta · 12 meses y Composición del inventario (web · 2026-11-18; venían sólo en el celular).
// Mismo motor que el celular (inventario/calculoEmpresa.js#serieInventario y #mixesInventario) → congruencia:
//   · InventarioVsVentaPanel: inventario al cierre de cada mes ([Inv Actual] del último día con foto) contra la venta
//     promedio de 3 meses (CV 3 meses / 3) y, en la lectura del mes, los días de inventario (inv / CV3 × 90).
//   · ComposicionPanel: Categoría · Marca · Almacén del inventario del alcance elegido, en barras.
// Sin permiso sensible todo va en piezas (nada de $ a costo). Vistas puras: reciben la serie y los mixes ya armados.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Segmented, GraficaLineas } from '../../../components/kit';
import { fmtCompact, fmtInt } from './constantes';

const DIMS = [{ id: 'categoria', label: 'Categoría' }, { id: 'marca', label: 'Marca' }, { id: 'almacen', label: 'Almacén' }];
const TOPE = 8;

export function InventarioVsVentaPanel({ serie = [], sensible = false }) {
  const { theme } = useTheme();
  const fmt = sensible ? fmtCompact : fmtInt;
  const conFoto = serie.filter((d) => d.inv != null);
  const datos = useMemo(() => serie.map((d) => ({ x: d.mes === 1 ? `${d.label} ${String(d.anio).slice(2)}` : d.label, inv: d.inv, cv: d.cv, dias: d.dias })), [serie]);
  const ultimo = conFoto[conFoto.length - 1];
  const meta = !conFoto.length ? 'sin cierres de mes todavía'
    : `${sensible ? 'a costo' : 'en piezas'} · ${conFoto.length} ${conFoto.length === 1 ? 'cierre' : 'cierres'} con foto${ultimo?.dias != null ? ` · ${ultimo.label.toLowerCase()}: ${fmtInt(ultimo.dias)} días` : ''}`;
  return (
    <Panel titulo="Inventario vs venta · 12 meses" meta={meta} padding="10px 12px">
      {!conFoto.length
        ? <p style={{ margin: 0, fontSize: 12, color: theme.textMuted, fontFamily: TYPO.fontText }}>Aún no hay cierres de mes con foto de inventario; la serie se forma con la foto diaria.</p>
        : (
          <GraficaLineas datos={datos} formato={fmt} alto={210} desdeCero={false} mostrarMinMax={false}
            series={[
              { key: 'inv', label: 'Inventario al cierre', tipo: 'principal' },
              { key: 'cv', label: sensible ? 'Venta ⌀ 3 m (a costo)' : 'Venta ⌀ 3 m (pz)', tipo: 'linea', color: theme.orange },
              { key: 'dias', label: 'Días de inv', tipo: 'lectura', formato: (v) => (v == null ? '—' : `${fmtInt(v)} d`) },
            ]} />
        )}
    </Panel>
  );
}

export function ComposicionPanel({ mixes = {}, sensible = false, dimInicial = 'categoria' }) {
  const { theme } = useTheme();
  const [dim, setDim] = useState(dimInicial);
  const fmt = sensible ? fmtCompact : fmtInt;
  const { filas, total } = useMemo(() => {
    const l = mixes[dim] || [];
    const total = l.reduce((s, x) => s + x.v, 0);
    const top = l.slice(0, TOPE);
    const resto = l.slice(TOPE);
    const otros = resto.reduce((s, x) => s + x.v, 0);
    return { total, filas: otros > 0 ? [...top, { key: '__otros', label: `Otros (${resto.length})`, v: otros, otros: true }] : top };
  }, [mixes, dim]);
  const max = Math.max(1, ...filas.map((x) => x.v));
  return (
    <Panel titulo="Composición del inventario" meta={`${sensible ? 'valor a costo' : 'piezas'} · ${fmt(total)}`} padding="10px 12px"
      acciones={<Segmented value={dim} onChange={setDim} options={DIMS} />}>
      {!filas.length
        ? <p style={{ margin: 0, fontSize: 12, color: theme.textMuted, fontFamily: TYPO.fontText }}>Sin inventario en este alcance.</p>
        : (
          <div style={{ display: 'grid', gap: 5, fontFamily: TYPO.fontText }}>
            {filas.map((x) => {
              const pct = total > 0 ? (x.v / total) * 100 : 0;
              return (
                <div key={x.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) 64px 40px', alignItems: 'center', gap: 8 }}>
                  <span title={x.label} style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: x.otros ? theme.textMuted : theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</span>
                  <span style={{ height: 8, borderRadius: 999, background: theme.surfaceHover || theme.bg, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.max(2, (x.v / max) * 100)}%`, borderRadius: 999, background: x.otros ? theme.textMuted : theme.accent }} />
                  </span>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(x.v)}</span>
                  <span style={{ fontSize: 10.5, color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
                </div>
              );
            })}
          </div>
        )}
    </Panel>
  );
}
