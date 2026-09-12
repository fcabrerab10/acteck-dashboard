// "Apoyo comercial" en el celular · las bonificaciones del ERP por concepto (rebate, apoyo
// de marketing, promoción de temporada, protección de precios…) con el monto del mes y el YTD.
// Mismo cálculo que la web (modules/comercial/sellin/apoyo.js), lista en vez de tabla: aquí no
// caben columnas. Montos en positivo; en el ERP restan de la venta.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useApoyoComercial } from '../../../modules/comercial/sellin/datos';
import { agruparApoyo, totalesApoyo, factBruta, pctSobre } from '../../../modules/comercial/sellin/apoyo';
import { ListaAgrupada, Fila, Skeleton, HojaM, Vacio } from '../../piezas';
import { money, moneyCompact, MESES, MESES_LARGO, N } from '../../util';

export default function ApoyoM({ anio, mes, clienteKey = null, style }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(null);
  const { data, isLoading } = useApoyoComercial(anio, clienteKey);

  const filas = useMemo(() => agruparApoyo(data?.filas || [], { anio, mes, por: 'concepto', hijo: clienteKey ? 'mes' : 'cliente' }), [data, anio, mes, clienteKey]);
  const tot = useMemo(() => totalesApoyo(data?.filas || [], { anio, mes }), [data, anio, mes]);
  const fb = useMemo(() => factBruta(data?.fb || [], { anio, mes }), [data, anio, mes]);
  const pctTot = pctSobre(tot.ytd, fb.ytd);
  const detalle = filas.find((f) => f.key === abierto) || null;

  if (isLoading) return <div style={{ padding: '18px 16px 0', ...style }}><Skeleton h={160} r={12} /></div>;

  return (
    <>
      <ListaAgrupada titulo="Apoyo comercial" meta={`${filas.length}`} style={{ marginTop: 18, ...style }}
        pie={`Bonificaciones del ERP en ${MESES_LARGO[mes - 1]} ${anio} y en el acumulado del año${pctTot != null ? ` (${pctTot.toFixed(1)}% de la facturación bruta)` : ''}. Se muestran en positivo: en el ERP restan de la venta. Toca un concepto para ver ${clienteKey ? 'sus meses' : 'sus clientes'}.`}>
        {!filas.length && <Vacio icon={null} titulo={`Sin bonificaciones en ${anio}`} style={{ padding: 18 }} />}
        {filas.map((f) => (
          <Fila key={f.key} titulo={f.label} sub={`${f.sub || ''}${f.sub ? ' · ' : ''}YTD ${money(f.ytd)}`}
            valor={f.mes ? moneyCompact(f.mes) : '—'} valorSub={MESES[mes - 1]}
            pill={fb.ytd ? { tone: 'gray', label: `${(pctSobre(f.ytd, fb.ytd) || 0).toFixed(1)}%` } : undefined}
            onClick={() => setAbierto(f.key)} />
        ))}
        {filas.length > 0 && (
          <Fila titulo="Total del año" sub={`${tot.conceptos} conceptos`} chevron={false}
            valor={moneyCompact(tot.ytd)} valorSub={`ene–${MESES[mes - 1].toLowerCase()}`}
            pill={pctTot != null ? { tone: 'gray', label: `${pctTot.toFixed(1)}% fact. bruta` } : undefined} />
        )}
      </ListaAgrupada>

      <HojaM abierto={!!detalle} onClose={() => setAbierto(null)} titulo={detalle?.label || 'Concepto'}
        sub={detalle ? `${detalle.sub || ''} · ${money(detalle.ytd)} en ${anio}` : ''} alto="72vh">
        {detalle && (
          <ListaAgrupada titulo={clienteKey ? 'Mes a mes' : 'Clientes'} meta={clienteKey ? '' : `${detalle.hijos.length}`}>
            {(clienteKey
              ? detalle.meses.map((v, i) => ({ key: String(i + 1), label: `${MESES[i]} ${anio}`, ytd: v })).filter((x) => x.ytd)
              : detalle.hijos
            ).map((x) => (
              <Fila key={x.key} titulo={x.label} chevron={false} valor={moneyCompact(x.ytd)}
                valorSub={detalle.ytd ? `${Math.round((N(x.ytd) / detalle.ytd) * 100)}%` : undefined} />
            ))}
          </ListaAgrupada>
        )}
        <div style={{ padding: '8px 28px 0', fontSize: 11, color: theme.textSubtle || theme.textMuted, lineHeight: 1.45, fontFamily: TYPO.fontText }}>
          Fuente: renglones de erp_ventas con rama «SERVICIOS» (v_bonificaciones_concepto_mes).
        </div>
      </HojaM>
    </>
  );
}
