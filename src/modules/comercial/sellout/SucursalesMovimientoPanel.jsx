// Sell Out de una cuenta · «Sucursales que suben, bajan y dejaron de vender» (3.96.0 · 2026-10-26, bloque 5 del mockup
// aprobado por Fernando). Tres listas en columnas: Suben · Bajan (contra el mes anterior, en pesos, umbral $50K, top 5)
// · Sin venta en <mes> (vendían el mes anterior y este mes 0, con «vendía $X/mes»). Sólo para cuentas cuya fuente trae
// sucursales (bloquesDe); si no, no se pinta nada. Datos: vs_sellout_sucursal_mes (useDrillSucursales, ya cacheado por
// los bloques de la receta). Motor puro en sucursales.js.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Skeleton } from '../../../components/kit';
import { useDrillSucursales } from './datos';
import { bloquesDe } from './BloquesCuenta';
import { movimientoSucursales, fmtMovSuc } from './sucursales';

export default function SucursalesMovimiento({ cuenta, fila, anio, mes }) {
  const tiene = useMemo(() => bloquesDe(cuenta, fila).bloques.includes('sucursales'), [cuenta, fila]);
  const { data: sucursales = [], isLoading } = useDrillSucursales(cuenta, anio, tiene);
  const m = useMemo(() => movimientoSucursales(sucursales, { anio, mes }), [sucursales, anio, mes]);
  if (!tiene) return null;
  return <SucursalesMovimientoVista m={m} cargando={isLoading} />;
}

function Lista({ titulo, tone, items, vacio, valor }) {
  const { theme } = useTheme();
  return (
    <Panel titulo={titulo} meta={<Pill size="xs" tone={tone}>{items.length}</Pill>}>
      {items.length === 0 && <div style={{ fontSize: 11.5, color: theme.textMuted }}>{vacio}</div>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((s) => (
          <div key={s.sucursal} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${theme.border}`, fontSize: 12.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.sucursal}>{s.sucursal}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.frase}</div>
            </div>
            {valor(s)}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Vista pura (SSR en scripts/test-pagina-cliente-ssr.mjs). */
export function SucursalesMovimientoVista({ m, cargando = false }) {
  const { theme } = useTheme();
  const num = (color) => (s) => <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{`${s.delta >= 0 ? '+' : ''}${fmtMovSuc(s.delta)}`}</span>;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 6px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 700, color: theme.text, letterSpacing: '-0.01em' }}>Sucursales que suben, bajan y dejaron de vender</span>
        <span style={{ fontSize: 11.5, color: theme.textMuted }}>{m.mesLbl} contra {m.mesPrevLbl} · en pesos, umbral $50K · {m.total} sucursales con venta</span>
      </div>
      {cargando ? <Skeleton lineas={4} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          <Lista titulo="Suben" tone="green" items={m.suben} vacio={`Ninguna sucursal sube más de $50K en ${m.mesLbl}.`} valor={num(theme.green)} />
          <Lista titulo="Bajan" tone="red" items={m.bajan} vacio={`Ninguna sucursal baja más de $50K en ${m.mesLbl}.`} valor={num(theme.red)} />
          <Lista titulo={`Sin venta en ${m.mesLbl}`} tone="orange" items={m.sinVenta} vacio={`Todas las que vendieron en ${m.mesPrevLbl} siguen vendiendo.`}
            valor={(s) => <Pill size="xs" tone="orange">dejó de vender</Pill>} />
        </div>
      )}
    </div>
  );
}
