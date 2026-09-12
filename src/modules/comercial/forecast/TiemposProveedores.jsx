// Panel "Proveedores y navieras · tiempos reales" (S&OP, 2026-09-12).
// Dos tablas compactas del Master Embarques ya agregado en Postgres (v_embarques_proveedor /
// v_embarques_naviera) más una línea que contrasta el ciclo real de una PO contra el lead time
// que usa el motor del S&OP (v_lead_time_sku → r.ltDias). Los USD sólo con permiso sensible.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Segmented, TablaCompacta } from '../../../components/kit';
import { fmtInt } from '../inventario/constantes';
import { useEmbarquesTiempos, resumen, nombreProveedor as corto } from './useEmbarquesTiempos';

const usd = (n) => (n == null ? '—' : `$${fmtInt(n)}`);
const dias = (n) => (n == null ? '—' : `${Math.round(n)} d`);

export default function TiemposProveedores({ ltPromedio, sensible }) {
  const { theme } = useTheme();
  const anioActual = new Date().getFullYear();
  const [abierto, setAbierto] = useState(false);
  const [anio, setAnio] = useState(anioActual);
  const { loading, proveedores, navieras } = useEmbarquesTiempos(anio, abierto);

  const tot = useMemo(() => resumen(proveedores), [proveedores]);
  const totNav = useMemo(() => resumen(navieras), [navieras]);

  const colsProv = [
    { key: 'supplier', label: 'Proveedor', align: 'left', maxWidth: 200, bold: true, render: (r) => <span title={r.supplier}>{corto(r.supplier)}</span> },
    { key: 'embarques', label: 'Cont.', width: 56, render: (r) => fmtInt(r.embarques), sum: true, renderTotal: (v) => fmtInt(v) },
    { key: 'piezas', label: 'Piezas', width: 78, render: (r) => fmtInt(r.piezas), sum: true, renderTotal: (v) => fmtInt(v) },
    ...(sensible ? [
      { key: 'fob_usd', label: 'FOB USD', width: 92, render: (r) => usd(r.fob_usd), sum: true, renderTotal: (v) => usd(v) },
      { key: 'usd_por_cbm', label: '$/CBM', width: 68, render: (r) => (r.usd_por_cbm == null ? '—' : `$${Math.round(r.usd_por_cbm)}`), renderTotal: () => (tot.usdPorCbm == null ? '—' : `$${Math.round(tot.usdPorCbm)}`) },
    ] : []),
    { key: 'dias_produccion_med', label: 'Prod.', width: 58, render: (r) => dias(r.dias_produccion_med) },
    { key: 'dias_transito_med', label: 'Tránsito', width: 68, render: (r) => dias(r.dias_transito_med) },
    { key: 'dias_total_med', label: 'Total', width: 58, render: (r) => <strong style={{ color: theme.text }}>{dias(r.dias_total_med)}</strong> },
  ];

  const colsNav = [
    { key: 'naviera', label: 'Naviera', align: 'left', maxWidth: 160, bold: true },
    { key: 'contenedores', label: 'Cont.', width: 56, render: (r) => fmtInt(r.contenedores), sum: true, renderTotal: (v) => fmtInt(v) },
    { key: 'cbm', label: 'CBM', width: 72, render: (r) => (r.cbm == null ? '—' : fmtInt(r.cbm)), sum: true, renderTotal: (v) => fmtInt(v) },
    ...(sensible ? [
      { key: 'usd_por_cbm', label: '$/CBM', width: 68, render: (r) => (r.usd_por_cbm == null ? '—' : `$${Math.round(r.usd_por_cbm)}`), renderTotal: () => (totNav.usdPorCbm == null ? '—' : `$${Math.round(totNav.usdPorCbm)}`) },
    ] : []),
    { key: 'dias_transito_med', label: 'Tránsito', width: 72, render: (r) => dias(r.dias_transito_med) },
  ];

  // Contraste con el lead time que usa el motor (promedio de v_lead_time_sku: emisión → CEDIS).
  const lt = Number(ltPromedio || 0);
  const nota = tot.totalMed == null
    ? 'Sin contenedores arribados con fechas completas en el año seleccionado.'
    : `Ciclo real de una PO (emisión → CEDIS) ≈ ${Math.round(tot.totalMed)} d · tránsito ETD → CEDIS ≈ ${Math.round(tot.transitoMed || 0)} d · el S&OP planea con ${lt > 0 ? `${Math.round(lt)} d` : 'el lead time por SKU'}${lt > 0 && tot.totalMed ? ` (${Math.abs(Math.round(tot.totalMed - lt))} d ${tot.totalMed > lt ? 'más' : 'menos'} en la realidad)` : ''}.`;

  const meta = loading ? 'cargando…'
    : proveedores.length
      ? `${fmtInt(tot.embarques)} contenedores · ${fmtInt(tot.cbm)} CBM${sensible && tot.usdPorCbm ? ` · $${Math.round(tot.usdPorCbm)}/CBM` : ''} · mediana de los ya arribados`
      : 'sin embarques en el año seleccionado';

  const anios = [anioActual - 2, anioActual - 1, anioActual].map((a) => ({ id: a, label: String(a) }));

  return (
    <Panel plegable abiertoInicial={false} onToggle={setAbierto}
      titulo="Proveedores y navieras · tiempos reales"
      meta={meta}
      acciones={abierto ? <Segmented options={anios} value={anio} onChange={setAnio} /> : null}
      padding="10px 12px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill tone={tot.totalMed && lt > 0 && tot.totalMed > lt * 1.1 ? 'orange' : 'gray'} size="xs" dot>{nota}</Pill>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text, margin: '0 2px 4px' }}>Por proveedor</div>
            <TablaCompacta columnas={colsProv} filas={proveedores} rowKey={(r) => r.supplier} dense maxHeight={300}
              vacio={loading ? 'Cargando…' : 'Sin embarques.'} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text, margin: '0 2px 4px' }}>Por naviera</div>
            <TablaCompacta columnas={colsNav} filas={navieras} rowKey={(r) => r.naviera} dense maxHeight={300}
              vacio={loading ? 'Cargando…' : 'Sin naviera capturada.'} />
          </div>
        </div>
        <div style={{ fontSize: 10, color: theme.textMuted }}>
          Master Embarques · el flete se captura por contenedor (no por renglón) y aquí no se duplica · días = mediana de los contenedores ya arribados · naviera capturada en 43 % de los embarques.
        </div>
      </div>
    </Panel>
  );
}
