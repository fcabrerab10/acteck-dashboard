// "Equipo comercial" en el celular · cada vendedor del ERP con su fact. neta del mes, la
// pastilla de YoY y un trazo de 6 meses; al tocarlo, hoja con los 12 meses (TablaAnual) y
// sus clientes principales del mes. Datos: v_medidas_ventas_vendedor_mes (medidas del director).
// Nada sensible aquí: ni margen, ni costo, ni contribución.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { agregar, N as Nm } from '../../../lib/medidas';
import { GraficaLineas } from '../../../components/kit';
import { useVendedores, useVendedorClientes } from '../../../modules/comercial/sellin/datos';
import { ListaAgrupada, Fila, Skeleton, HojaM, Vacio } from '../../piezas';
import { money, moneyCompact, int, deltaPct, tonoDelta, MESES, MESES_LARGO } from '../../util';
import TablaAnual from '../sellout/TablaAnual';

const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const corto = (v) => { const p = String(v || '').trim().split(/\s+/); return p.length <= 2 ? p.join(' ') : `${p[0]} ${p[1]}`; };

export default function EquipoM({ anio, mes, style }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(null);
  const { data: rows = [], isLoading } = useVendedores(anio);

  const filas = useMemo(() => {
    const por = new Map();
    for (const r of rows) {
      const v = r.vendedor || 'SIN VENDEDOR';
      if (!por.has(v)) por.set(v, []);
      por.get(v).push(r);
    }
    const out = [];
    for (const [vendedor, rs] of por) {
      const ytd = agregar(rs, (r) => Nm(r.anio) === anio && Nm(r.mes) <= mes);
      const ytdPrev = agregar(rs, (r) => Nm(r.anio) === anio - 1 && Nm(r.mes) <= mes);
      const delMes = rs.find((r) => Nm(r.anio) === anio && Nm(r.mes) === mes);
      const mesPrev = rs.find((r) => Nm(r.anio) === anio - 1 && Nm(r.mes) === mes);
      const anual = (a) => Array.from({ length: 12 }, (_, i) => Nm(rs.find((r) => Nm(r.anio) === a && Nm(r.mes) === i + 1)?.fact_neta));
      const doce = anual(anio);
      out.push({
        key: vendedor, vendedor, corto: corto(vendedor),
        mes: Nm(delMes?.fact_neta), clientes: Nm(delMes?.clientes),
        yoy: delta(Nm(delMes?.fact_neta), Nm(mesPrev?.fact_neta)),
        ytd: ytd.fact_neta, yoyYtd: delta(ytd.fact_neta, ytdPrev.fact_neta),
        piezas: ytd.piezas_venta_neta, doce, docePrev: anual(anio - 1),
        serie6: Array.from({ length: 6 }, (_, i) => { const m = mes - 5 + i; return m >= 1 ? doce[m - 1] : 0; }),
      });
    }
    return out.filter((r) => r.mes || r.ytd).sort((a, b) => b.ytd - a.ytd);
  }, [rows, anio, mes]);

  const detalle = filas.find((f) => f.key === abierto) || null;

  if (isLoading) return <div style={{ padding: '18px 16px 0', ...style }}><Skeleton h={200} r={12} /></div>;

  return (
    <>
      <ListaAgrupada titulo="Equipo comercial" meta={`${filas.length}`} style={{ marginTop: 18, ...style }}
        pie={`Fact. neta de cada vendedor en ${MESES_LARGO[mes - 1]} · pastilla = vs el mismo mes del año anterior · línea = últimos 6 meses. Toca un vendedor para ver su año y sus clientes.`}>
        {!filas.length && <Vacio icon={null} titulo="El ERP no trajo vendedor" style={{ padding: 18 }} />}
        {filas.map((f) => (
          <Fila key={f.key} titulo={f.corto} sub={`YTD ${money(f.ytd)}${f.clientes ? ` · ${int(f.clientes)} clientes` : ''}`}
            valor={f.mes ? moneyCompact(f.mes) : '—'} valorSub={MESES[mes - 1]}
            pill={{ tone: tonoDelta(f.yoy), label: f.yoy != null ? deltaPct(f.yoy) : '—' }}
            trailing={<div style={{ width: 64, height: 28 }}><GraficaLineas mini alto={28} datos={f.serie6.map((v, i) => ({ x: String(i), v: Number(v) || 0 }))} series={[{ key: 'v', label: 'Mes', tipo: 'principal' }]} /></div>}
            onClick={() => setAbierto(f.key)} style={{ gap: 8 }} />
        ))}
      </ListaAgrupada>

      <HojaM abierto={!!detalle} onClose={() => setAbierto(null)} titulo={detalle?.vendedor || 'Vendedor'}
        sub={detalle ? `${money(detalle.ytd)} YTD ${anio} · ${int(detalle.piezas)} pz` : ''} alto="86vh">
        {detalle && <DetalleVendedor fila={detalle} anio={anio} mes={mes} theme={theme} />}
      </HojaM>
    </>
  );
}

function DetalleVendedor({ fila, anio, mes, theme }) {
  const { data: clientes = [], isLoading } = useVendedorClientes(fila.vendedor, anio);
  const top = useMemo(() => {
    const map = new Map();
    for (const c of clientes) {
      if (Nm(c.mes) !== mes) continue;
      const k = c.cliente || c.cliente_nombre || '—';
      const o = map.get(k) || { key: k, label: c.cliente_nombre || k, fact: 0, piezas: 0 };
      o.fact += Nm(c.fact_neta); o.piezas += Nm(c.piezas);
      map.set(k, o);
    }
    return [...map.values()].filter((c) => c.fact).sort((a, b) => b.fact - a.fact).slice(0, 10);
  }, [clientes, mes]);

  const filasAnual = [
    { label: String(anio), sub: `Ene–${MESES[mes - 1]}`, valores: fila.doce.map((v, i) => (i < mes ? v : 0)) },
    { label: String(anio - 1), sub: 'año completo', valores: fila.docePrev },
  ].filter((f) => f.valores.some((v) => v));

  return (
    <>
      <div style={{ padding: '0 16px' }}>
        <TablaAnual columnas={MESES} filas={filasAnual} fmt={moneyCompact} etiquetaFilas="Fact. neta" />
      </div>
      <ListaAgrupada titulo={`Clientes · ${MESES[mes - 1]}`} meta={`${top.length}`} style={{ marginTop: 14 }}
        pie="Los 10 primeros por fact. neta del mes.">
        {isLoading && <div style={{ padding: 16 }}><Skeleton h={120} r={12} /></div>}
        {!isLoading && !top.length && <Vacio icon={null} titulo={`Sin facturación en ${MESES[mes - 1]}`} style={{ padding: 18 }} />}
        {top.map((c) => (
          <Fila key={c.key} titulo={c.label} chevron={false} valor={moneyCompact(c.fact)} valorSub={`${int(c.piezas)} pz`} />
        ))}
      </ListaAgrupada>
      <div style={{ padding: '10px 28px 0', fontSize: 11, color: theme.textSubtle || theme.textMuted, lineHeight: 1.45, fontFamily: TYPO.fontText }}>
        Fuente: v_medidas_ventas_vendedor_mes y v_ventas_vendedor_cliente_mes (erp_ventas).
      </div>
    </>
  );
}
