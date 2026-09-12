// Bloque "Sell out" reutilizable · Bento con el mes, el inventario del cliente,
// sell out vs sell in, la evolución de 12 meses, los top SKUs con stock, las
// categorías del mes y las alertas.
//
// Lo usan dos pantallas:
//   · Sell Out consolidado → pestaña Resumen del drill de la cuenta
//   · Análisis por Cliente → bloque de arriba, sólo para clientes con fuente de sell out
//
// Sabe cargar lo suyo: basta con pasarle `cuenta`, `anio` y `mes`.
// Las tarjetas cuya fuente no trae el dato NO se pintan (regla de disponibilidad).
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, DeltaPill, GraficaLineas, TablaCompacta, Cargando } from '../../../components/kit';
import { disponibilidadDeCampos } from '../../../lib/disponibilidad';
import { moneyCompact } from '../../../lib/format';
import { useCuentas, useDias, useMensual, useDrillSkus, useDrillInventario } from './datos';
import {
  construirFilas, skusDeCuenta, alertasDeCuenta, ritmoProyectado, composicion, ultimoDiaConVenta, MESES,
} from './calculo';
import { fmtMoney, fmtInt, fmtPct, fmtSigno, capitalizarEstado } from './textos';

function Caja({ titulo, children, ancho = 1, style }) {
  const { theme } = useTheme();
  return (
    <div style={{
      gridColumn: `span ${ancho}`, background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: '10px 12px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...style,
    }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>{titulo}</div>
      {children}
    </div>
  );
}
function Cifra({ v, sub, color }) {
  const { theme } = useTheme();
  return (
    <>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: color || theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </>
  );
}

/**
 * @param {string} cuenta    clave de v_sellout_cuentas ('dicotech', 'ct', 'pcel'…)
 * @param {number} anio
 * @param {number} mes
 * @param {number} [corteDia] día de corte del MTD; si se omite, el último con venta del mes
 * @param {boolean} [compacto] 2 columnas en vez de 4 (Análisis por Cliente)
 */
export default function ResumenSellOut({ cuenta, anio, mes, corteDia, compacto = false, modoPiezas = false }) {
  const { theme } = useTheme();
  const { data: cuentas = [] } = useCuentas();
  const { data: dias = [], isLoading: cargandoDias } = useDias(anio);
  const { data: mensual = [], isLoading: cargandoMes } = useMensual(anio);
  const { data: skuMes = [], isLoading: cargandoSkus } = useDrillSkus(cuenta, anio);
  const { data: inv = [], isLoading: cargandoInv } = useDrillInventario(cuenta);

  const cargando = cargandoDias || cargandoMes || cargandoSkus || cargandoInv;

  const corte = corteDia ?? (ultimoDiaConVenta(dias, anio, mes) || 31);
  const fila = useMemo(() => {
    const def = cuentas.find((c) => c.cuenta === cuenta);
    if (!def) return null;
    return construirFilas({ cuentas: [def], mensual, dias, anio, mes, corteDia: corte })[0];
  }, [cuentas, cuenta, mensual, dias, anio, mes, corte]);

  const campos = useMemo(() => disponibilidadDeCampos(cuenta, inv, ['stock', 'valor', 'dias_sin_venta', 'fecha_ultima_venta'], { soloUltimaSemana: false }), [cuenta, inv]);
  const skus = useMemo(() => skusDeCuenta(skuMes, inv, anio, mes, 'piezas'), [skuMes, inv, anio, mes]);
  const alertas = useMemo(() => alertasDeCuenta(skus, campos.hay('dias_sin_venta')), [skus, campos]);
  const categorias = useMemo(() => composicion(skuMes.filter((r) => Number(r.anio) === anio && Number(r.mes) === mes), 'categoria', null, 5), [skuMes, anio, mes]);

  if (cargando || !fila) return <Cargando pantalla="selloutDrill" minHeight={260} />;

  const hayInv = fila.invValor != null || inv.length > 0;
  const serie = fila.serie12.map((p) => ({
    x: p.x, sellOut: modoPiezas ? p.piezas : p.importe,
    sellIn: modoPiezas ? null : (p.sellIn == null ? null : Number(p.sellIn)),
    inv: hayInv && p.inv != null ? Number(p.inv) : null,
  }));
  const series = [
    { key: 'sellOut', label: 'Sell out', tipo: 'principal' },
    ...(modoPiezas ? [] : [{ key: 'sellIn', label: 'Sell in', tipo: 'anterior' }]),
    ...(hayInv ? [{ key: 'inv', label: 'Inventario en el cliente', tipo: 'linea', color: theme.orange }] : []),
  ];
  const proyeccion = ritmoProyectado(fila.importe, corte, anio, mes);
  const cols = compacto ? 2 : 4;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8, fontFamily: TYPO.fontText, minWidth: 0 }}>
      <Caja titulo={`Sell out · ${MESES[mes - 1]} ${anio}`} ancho={compacto ? 1 : 1}>
        <Cifra v={fmtMoney(fila.importe)}
          sub={`${fmtInt(fila.cantidad)} pz · ${fila.yoy == null ? 'sin comparativo' : `${fmtSigno(fila.yoy)} vs ${MESES[mes - 1].toLowerCase()} ${anio - 1} a mismo día`}`} />
        {proyeccion != null && corte < 28 && (
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>ritmo del mes ≈ {fmtMoney(proyeccion)}</div>
        )}
      </Caja>

      {/* El valor del inventario del cliente es dato clave para Fernando: la caja siempre está;
          si la fuente no lo reporta, lo dice en vez de desaparecer. */}
      <Caja titulo="Inventario del cliente">
        {hayInv ? (
          <Cifra v={fmtMoney(fila.invValor)}
            sub={`${fmtInt(fila.invPiezas)} pz · ${fmtInt(fila.invSkus)} SKUs con stock${fila.invSemanas != null ? ` · ${fila.invSemanas.toFixed(1)} semanas` : ''}`} />
        ) : (
          <Cifra v="—" sub="esta fuente no reporta inventario" color={theme.textMuted} />
        )}
      </Caja>

      <Caja titulo="Sell out vs sell in">
        <Cifra v={fila.soSi == null ? '—' : fmtPct(fila.soSi)}
          sub={fila.sellIn == null || fila.sellIn <= 0 ? 'sin sell in en el mes' : `sell in ${MESES[mes - 1].toLowerCase()} ${fmtMoney(fila.sellIn)}`}
          color={fila.soSi != null && fila.soSi < 60 ? theme.orange : undefined} />
      </Caja>

      {!compacto && (
        <Caja titulo="Alertas">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {alertas.sinStockConVenta > 0 && <Pill tone="orange" size="xs">{fmtInt(alertas.sinStockConVenta)} SKUs sin stock con venta</Pill>}
            {campos.hay('dias_sin_venta') && alertas.sinVenta30 > 0 && <Pill tone="red" size="xs">{fmtInt(alertas.sinVenta30)} SKUs sin venta 30+ d</Pill>}
            {!alertas.sinStockConVenta && !alertas.sinVenta30 && <span style={{ fontSize: 11, color: theme.textMuted }}>Nada que atender.</span>}
          </div>
        </Caja>
      )}

      <div style={{ gridColumn: `span ${cols}`, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 4 }}>
          Evolución 12 meses{hayInv ? ' · sell out, sell in e inventario' : ' · sell out y sell in'}
        </div>
        <GraficaLineas datos={serie} series={series} alto={compacto ? 150 : 190} formato={modoPiezas ? fmtInt : moneyCompact} />
      </div>

      <div style={{ gridColumn: `span ${Math.min(cols, 2)}`, minWidth: 0 }}>
        <TablaCompacta dense maxHeight={200} rowKey={(r) => r.sku}
          filas={skus.filter((s) => s.mesActual > 0).slice(0, 8)}
          vacio="Sin SKUs con venta este mes."
          columnas={[
            { key: 'sku', label: 'Top SKUs del mes', align: 'left', mono: true, maxWidth: 130 },
            { key: 'mesActual', label: 'Pz', render: (r) => fmtInt(r.mesActual) },
            ...(hayInv ? [
              { key: 'stock', label: 'Stock', render: (r) => (r.stock == null ? '—' : fmtInt(r.stock)) },
              { key: 'semanas', label: 'Sem.', width: 56, render: (r) => (r.stock === 0 ? <Pill tone="orange" size="xs">sin stock</Pill> : r.semanas == null ? '—' : r.semanas.toFixed(1)) },
            ] : []),
          ]} />
      </div>

      <div style={{ gridColumn: `span ${Math.min(cols, 2)}`, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 5 }}>Categorías del mes</div>
        {categorias.length === 0 && <div style={{ fontSize: 11, color: theme.textMuted }}>Sin venta este mes.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {categorias.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
              <div style={{ width: 70, height: 4, borderRadius: 999, background: `${theme.text}12`, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${Math.min(100, c.pct || 0)}%`, height: '100%', background: theme.accent || '#007AFF', borderRadius: 999 }} />
              </div>
              <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', width: 44, textAlign: 'right', color: theme.textMuted }}>{fmtPct(c.pct)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
