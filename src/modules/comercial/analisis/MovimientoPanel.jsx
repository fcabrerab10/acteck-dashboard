// «Dónde está el movimiento» en la web (2026-10-08; del celular, 3.79.0). Mayores subidas y bajadas en pesos contra el mes
// anterior mezclando SKU y categoría, con una frase corta cada una (analisis/movimiento.js, puro). En los primeros 10 días
// del mes en curso compara el último mes cerrado contra el anterior (si no, todo saldría «en oct nada»).
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Panel, TablaCompacta, Pill } from '../../../components/kit';
import { movimientos } from './movimiento';
import { MESES } from './calc';
import { moneyCompact } from '../../../movil/util';

const N = (v) => Number(v) || 0;
const norm = (c) => String(c || 'Sin categoría').trim();
const TONO = { SKU: 'blue', Sucursal: 'purple', 'Cliente final': 'gray', Categoría: 'orange', Vendedor: 'green' };

/**
 * @param {Array} filas  filas con { anio, mes, [clave], [valor], [piezas], categoria? }
 * @param {string} clave  'articulo' (sell in) o 'sku' (sell out) · valor: 'fact_neta' | 'importe' · piezas: 'piezas_venta_neta' | 'cantidad'
 * @param {Map} rd  roadmap por SKU (descripción y categoría)
 */
export default function MovimientoPanel({ titulo = 'Dónde está el movimiento', filas = [], clave = 'articulo', valor = 'fact_neta', piezas = 'piezas_venta_neta', rd = new Map(), anio, mes, nota, cargando = false }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const movs = useMemo(() => {
    const catDe = (sku, r) => norm(rd.get(sku)?.categoria || r?.categoria);
    const porCat = new Map();
    filas.forEach((x) => { const c = catDe(x[clave], x); const k = `${x.anio}-${x.mes}-${c}`; const o = porCat.get(k) || { anio: x.anio, mes: x.mes, categoria: c, v: 0 }; o.v += N(x[valor]); porCat.set(k, o); });
    const categoriaDe = {}; filas.forEach((x) => { categoriaDe[x[clave]] = catDe(x[clave], x); });
    const pocoMes = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1 && hoy.getDate() < 10;
    const [mAnio, mMes] = pocoMes ? (mes === 1 ? [anio - 1, 12] : [anio, mes - 1]) : [anio, mes];
    return { ...movimientos({ grupos: [
      { tipo: 'SKU', filas, clave, valor, piezas, etiqueta: (k) => rd.get(k)?.descripcion || '' },
      { tipo: 'Categoría', filas: [...porCat.values()], clave: 'categoria', valor: 'v' },
    ], anio: mAnio, mes: mMes, top: 8, categoriaDe }), pocoMes };
  }, [filas, clave, valor, piezas, rd, anio, mes, hoy]);
  const cols = [
    { key: 'tipo', label: '', width: 80, align: 'left', render: (f) => (f.tipo !== 'SKU' ? <Pill tone={TONO[f.tipo] || 'gray'} size="xs">{f.tipo}</Pill> : <span style={{ fontFamily: 'ui-monospace, SF Mono, monospace', fontSize: 11 }}>{f.clave}</span>) },
    { key: 'nombre', label: 'Qué', align: 'left', maxWidth: 320, render: (f) => <span>{f.tipo === 'SKU' ? (f.etiqueta || f.clave) : f.clave}</span> },
    { key: 'explicacion', label: 'Qué pasó', align: 'left', maxWidth: 260, render: (f) => <span style={{ color: theme.textMuted }}>{f.explicacion || `${moneyCompact(f.prev)} → ${moneyCompact(f.act)}`}</span> },
    { key: 'delta', label: 'Δ', bold: true, render: (f) => <span style={{ color: f.delta >= 0 ? theme.green : theme.red }}>{f.delta >= 0 ? '+' : '−'}{moneyCompact(Math.abs(f.delta))}</span> },
  ];
  return (
    <Panel titulo={titulo} meta={`${movs.mesLbl} vs ${movs.mesPrevLbl} · en pesos${movs.pocoMes ? ' · el mes en curso apenas empieza: se compara el último cerrado' : ''}`}>
      <TablaCompacta dense columnas={cols} filas={movs.filas || []} rowKey={(f) => `${f.tipo}-${f.clave}`} vacio={cargando ? 'Calculando…' : 'Nada cambió más de $1,000 contra el mes anterior.'} />
      {nota && <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 6 }}>{nota}</div>}
    </Panel>
  );
}
