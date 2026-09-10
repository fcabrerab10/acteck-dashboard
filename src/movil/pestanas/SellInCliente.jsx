// Sell In del cliente (push) · top 20 SKUs del mes desde facturacion_clientes: dos líneas (SKU + descripción),
// HeatCell con las piezas (relativo al máximo) y pill YoY del monto. Tocar un SKU abre la Ficha de producto.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { useNav } from '../nav';
import { TituloGrande, ListaAgrupada, Cabecera, Skeleton, Segmented, HeatCell, Pill, Vacio } from '../piezas';
import { useSellInSkus } from '../datos';
import { money, moneyCompact, deltaPct, tonoDelta, MESES, N } from '../util';
import FichaProducto from '../FichaProducto';

const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

export default function SellInCliente({ clienteKey, nombre }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;
  const { data, isLoading, error } = useSellInSkus(clienteKey, anio, mesActual);
  const [orden, setOrden] = useState('monto');

  const r = useMemo(() => {
    if (!data) return null;
    const hayActual = data.rows.some((x) => N(x.anio) === anio && N(x.mes) === mesActual && N(x.monto) > 0);
    const mes = hayActual ? mesActual : (mesActual === 1 ? 12 : mesActual - 1);
    const a = hayActual || mesActual !== 1 ? anio : anio - 1;
    const by = new Map();
    data.rows.forEach((x) => {
      if (N(x.mes) !== mes || !x.sku) return;
      const o = by.get(x.sku) || (by.set(x.sku, { sku: x.sku, monto: 0, piezas: 0, prev: 0 }), by.get(x.sku));
      if (N(x.anio) === a) { o.monto += N(x.monto); o.piezas += N(x.piezas); } else if (N(x.anio) === a - 1) o.prev += N(x.monto);
    });
    const filas = [...by.values()].filter((o) => o.monto > 0 || o.piezas > 0).map((o) => ({ ...o, yoy: delta(o.monto, o.prev), ...(data.desc.get(o.sku) || {}) }));
    filas.sort((x, y) => (orden === 'piezas' ? y.piezas - x.piezas : y.monto - x.monto));
    const top = filas.slice(0, 20);
    const total = filas.reduce((s, o) => s + o.monto, 0), totalTop = top.reduce((s, o) => s + o.monto, 0);
    return { mes, anio: a, top, total, totalTop, n: filas.length, maxPz: Math.max(0, ...top.map((o) => o.piezas)), maxMonto: Math.max(0, ...top.map((o) => o.monto)) };
  }, [data, anio, mesActual, orden]);

  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha'); };

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta={nombre} />
      <TituloGrande titulo="Sell In" sub={r ? `${nombre} · ${MESES[r.mes - 1]} ${r.anio} · ${money(r.total)} en ${r.n} SKUs` : nombre}
        derecha={<Segmented value={orden} onChange={setOrden} options={[{ id: 'monto', label: '$' }, { id: 'piezas', label: 'Pz' }]} />} />
      {error && <Vacio titulo="No se pudo cargar el sell in" sub={error.message} />}
      {(isLoading || !r) && !error && <div style={{ padding: '0 16px' }}><Skeleton h={420} r={12} /></div>}
      {r && (
        <ListaAgrupada titulo={`Top ${r.top.length} SKUs`} meta={r.total > 0 ? `${Math.round((r.totalTop / r.total) * 100)}% del mes` : undefined} pie="Celda = piezas del mes (intensidad relativa al SKU líder) · pill = monto vs mismo mes del año anterior. Toca un SKU para ver disponibilidad y precio.">
          {r.top.length === 0 && <Vacio icon={null} titulo="Sin facturación este mes" sub="Todavía no hay renglones cargados para este cliente." />}
          {r.top.map((o, i) => (
            <button key={o.sku} type="button" onClick={() => abrirSku(o.sku)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
              <span style={{ width: 20, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textSubtle || theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sku}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 13 }}>{money(o.monto)}</span></span>
                <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.descripcion || 'Sin descripción'}{o.marca ? ` · ${o.marca}` : ''}</span>
              </span>
              <HeatCell v={o.piezas} max={r.maxPz} />
              <Pill tone={tonoDelta(o.yoy)} size="xs" style={{ minWidth: 48, justifyContent: 'center' }}>{o.yoy != null ? deltaPct(o.yoy) : 'nuevo'}</Pill>
            </button>
          ))}
        </ListaAgrupada>
      )}
      {r && r.top.length > 0 && <div style={{ padding: '10px 28px 0', fontSize: 11.5, color: theme.textSubtle || theme.textMuted }}>Top 20 = {moneyCompact(r.totalTop)} de {moneyCompact(r.total)}.</div>}
    </>
  );
}
