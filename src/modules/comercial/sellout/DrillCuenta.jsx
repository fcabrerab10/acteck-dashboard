// Drill de una cuenta de Sell Out · en línea, debajo de su fila, con pestañas (opción A).
// Sólo aparecen las pestañas cuya fuente trae el dato para esa cuenta
// (regla de disponibilidad: si no viene, no se muestra — ni un guion).
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Share2, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Segmented, TablaCompacta, Pill, DeltaPill, HeatCell, Boton, Cargando, toast } from '../../../components/kit';
import { disponibilidadDeCampos } from '../../../lib/disponibilidad';
import ResumenSellOut from './ResumenSellOut';
// Geometría de 82 KB: sólo cuando se abre la pestaña Mapa.
const MapaMexico = lazy(() => import('./MapaMexico'));
import {
  useDrillSkus, useDrillInventario, useDrillInventarioMes, useDrillSucursales,
  useDrillVendedores, useDrillClientesFinales, useDrillEstados, CUENTA_POR_CLIENTE,
} from './datos';
import { skusDeCuenta, alertasDeCuenta, porEstado, agregarDimension as agregarDim, clientesFinalesDelMes as clientesFinales, MESES, ultimosMeses, idxMes, yoy, N } from './calculo';
import { fmtMoney, fmtInt, fmtPct, fmtSigno, capitalizarEstado, textoEstatusCuenta } from './textos';

const CLIENTE_POR_CUENTA = Object.fromEntries(Object.entries(CUENTA_POR_CLIENTE).map(([k, v]) => [v, k]));

export default function DrillCuenta({ fila, anio, mes, corteDia, estadoSel, onEstado }) {
  const { theme } = useTheme();
  const cuenta = fila.cuenta;
  const [tab, setTab] = useState('resumen');

  // Cada pestaña pide lo suyo sólo cuando se abre (salvo lo que necesita el Resumen).
  const skuQ = useDrillSkus(cuenta, anio, tab === 'resumen' || tab === 'skus');
  const invQ = useDrillInventario(cuenta, tab === 'resumen' || tab === 'skus' || tab === 'inventario');
  const invMesQ = useDrillInventarioMes(cuenta, tab === 'inventario');
  const sucQ = useDrillSucursales(cuenta, anio, tab === 'sucursales');
  const venQ = useDrillVendedores(cuenta, anio, tab === 'sucursales');
  const cfQ = useDrillClientesFinales(cuenta, anio, mes, tab === 'clientes');
  const edoQ = useDrillEstados(cuenta, anio, mes, tab === 'mapa');

  const inv = invQ.data || [];
  const campos = useMemo(() => disponibilidadDeCampos(cuenta, inv, ['stock', 'valor', 'dias_sin_venta', 'fecha_ultima_venta'], { soloUltimaSemana: false }), [cuenta, inv]);

  // Qué pestañas existen para ESTA cuenta.
  const pestanas = useMemo(() => {
    const out = [{ id: 'resumen', label: 'Resumen' }, { id: 'skus', label: 'SKUs' }];
    if (fila.invValor != null) out.push({ id: 'inventario', label: 'Inventario' });
    if (fila.sucursales != null || fila.vendedores != null) out.push({ id: 'sucursales', label: 'Sucursales y vendedores' });
    if (fila.clientesFinales != null) out.push({ id: 'clientes', label: 'Clientes finales' });
    // Sólo si la fuente trae estado: CT, Ingram, Arroba y Dicotech lo mandan vacío.
    if (fila.estados > 0) out.push({ id: 'mapa', label: 'Mapa' });
    return out;
  }, [fila, cuenta]);
  const tabActiva = pestanas.some((p) => p.id === tab) ? tab : 'resumen';

  const skus = useMemo(() => skusDeCuenta(skuQ.data || [], inv, anio, mes, 'piezas'), [skuQ.data, inv, anio, mes]);
  const estados = useMemo(() => porEstado(edoQ.data || [], anio, mes), [edoQ.data, anio, mes]);

  const clienteKey = CLIENTE_POR_CUENTA[cuenta];
  const irACliente = () => window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { clienteKey, pagina: 'estrategia' } }));

  const compartir = async () => {
    const alertas = alertasDeCuenta(skus, campos.hay('dias_sin_venta'));
    const txt = textoEstatusCuenta({ fila, anio, mes, corteDia, topSkus: skus.filter((s) => s.mesActual > 0), alertas, estados });
    try { await navigator.clipboard.writeText(txt); toast.ok('Estatus copiado'); }
    catch { toast.ok('No se pudo copiar'); }
  };

  const meses12 = ultimosMeses(anio, mes, 12);
  const fondo = theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)';

  return (
    <div style={{ padding: 12, background: fondo, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Segmented options={pestanas} value={tabActiva} onChange={setTab} />
        <span style={{ fontSize: 10.5, color: theme.textMuted }}>
          {fila.nombre} · {MESES[mes - 1].toLowerCase()} {anio}{corteDia && corteDia < 28 ? ` al día ${corteDia}` : ''} · sin IVA
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Boton icon={Share2} onClick={compartir}>Compartir estatus</Boton>
          {clienteKey && <Boton icon={ArrowUpRight} onClick={irACliente}>Ir a {fila.nombre.split(' ')[0]} › Sell Out</Boton>}
        </div>
      </div>

      {tabActiva === 'resumen' && <ResumenSellOut cuenta={cuenta} anio={anio} mes={mes} corteDia={corteDia} />}

      {tabActiva === 'skus' && (
        skuQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={240} /> : (
          <TablaCompacta dense maxHeight={420} rowKey={(r) => r.sku}
            filas={skus}
            vacio="Sin SKUs con venta en los últimos 12 meses."
            columnas={[
              { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 110, sort: false },
              { key: 'marca', label: 'Marca', align: 'left', width: 88 },
              ...meses12.map((m, i) => ({
                key: `m${i}`, label: `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`, width: 52,
                render: (r) => <HeatCell v={r.meses[i]} max={Math.max(...r.meses)} fmt={fmtInt} />,
              })),
              { key: 'prom', label: 'Prom', width: 58, render: (r) => fmtInt(r.prom) },
              { key: 'total', label: 'Total', width: 66, bold: true, render: (r) => fmtInt(r.total) },
              ...(fila.invValor != null ? [
                { key: 'stock', label: 'Stock', width: 60, render: (r) => (r.stock == null ? '—' : fmtInt(r.stock)) },
                { key: 'semanas', label: 'Sem.', width: 54, render: (r) => (r.stock === 0 ? <Pill tone="orange" size="xs">0</Pill> : r.semanas == null ? '—' : r.semanas.toFixed(1)) },
              ] : []),
            ]} />
        )
      )}

      {tabActiva === 'inventario' && (
        invQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={240} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 8 }}>
            <TablaCompacta dense maxHeight={380} rowKey={(r) => r.sku}
              filas={[...inv].sort((a, b) => N(b.valor) - N(a.valor))}
              vacio="Este cliente no reporta inventario."
              columnas={[
                { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 110 },
                { key: 'titulo', label: 'Producto', align: 'left', maxWidth: 230 },
                { key: 'stock', label: 'Stock', render: (r) => fmtInt(r.stock) },
                { key: 'valor', label: 'Valor', render: (r) => fmtMoney(r.valor) },
                ...(campos.hay('dias_sin_venta') ? [{ key: 'dias_sin_venta', label: 'Días s/venta', width: 78, render: (r) => (r.dias_sin_venta == null ? '—' : <span style={{ color: N(r.dias_sin_venta) >= 30 ? theme.red : theme.text }}>{fmtInt(r.dias_sin_venta)}</span>) }] : []),
              ]} />
            <TablaCompacta dense maxHeight={380} rowKey={(r) => `${r.anio}-${r.mes}`}
              filas={[...(invMesQ.data || [])].sort((a, b) => idxMes(N(b.anio), N(b.mes)) - idxMes(N(a.anio), N(a.mes)))}
              vacio="Sin fotos de inventario por mes."
              columnas={[
                { key: 'mes', label: 'Cierre de mes', align: 'left', width: 92, render: (r) => `${MESES[N(r.mes) - 1]} ${r.anio}` },
                { key: 'valor', label: 'Valor', render: (r) => fmtMoney(r.valor) },
                { key: 'piezas', label: 'Piezas', render: (r) => fmtInt(r.piezas) },
                { key: 'skus_con_stock', label: 'SKUs', width: 52, render: (r) => fmtInt(r.skus_con_stock) },
              ]} />
          </div>
        )
      )}

      {tabActiva === 'sucursales' && (
        sucQ.isLoading || venQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={240} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: 8 }}>
            <TablaCompacta dense maxHeight={360} rowKey={(r) => r.sucursal}
              filas={agregarDim(sucQ.data || [], 'sucursal', anio, mes)}
              vacio="Esta cuenta no reporta sucursales."
              columnas={[
                { key: 'clave', label: 'Sucursal', align: 'left', maxWidth: 150 },
                { key: 'importe', label: `${MESES[mes - 1]}`, render: (r) => fmtMoney(r.importe) },
                { key: 'yoy', label: 'Δ YoY', width: 74, render: (r) => <DeltaPill value={r.yoy} /> },
                { key: 'vendedores', label: 'Vend.', width: 52, render: (r) => fmtInt(r.vendedores) },
                { key: 'top', label: 'Top vendedor', align: 'left', maxWidth: 140, render: (r) => r.top_vendedor || '—' },
              ]} />
            <TablaCompacta dense maxHeight={360} rowKey={(r) => r.clave}
              filas={agregarDim(venQ.data || [], 'vendedor', anio, mes)}
              vacio="Esta cuenta no reporta vendedores."
              columnas={[
                { key: 'clave', label: 'Vendedor', align: 'left', maxWidth: 160 },
                { key: 'importe', label: `${MESES[mes - 1]}`, render: (r) => fmtMoney(r.importe) },
                { key: 'yoy', label: 'Δ YoY', width: 74, render: (r) => <DeltaPill value={r.yoy} /> },
                { key: 'clientes', label: 'Clientes', width: 60, render: (r) => fmtInt(r.clientes) },
                { key: 'skus', label: 'SKUs', width: 52, render: (r) => fmtInt(r.skus) },
                { key: 'tend', label: '6 m', align: 'left', width: 150, render: (r) => (
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    {r.tendencia.map((v, i) => <HeatCell key={i} v={v} max={Math.max(...r.tendencia)} fmt={(n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}K`)} />)}
                  </span>
                ) },
              ]} />
          </div>
        )
      )}

      {tabActiva === 'clientes' && (
        cfQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={240} /> : (() => {
          const cf = clientesFinales(cfQ.data || [], anio, mes);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                <Pill tone="gray">{fmtInt(cf.activos)} en el mes</Pill>
                <Pill tone="green">+{fmtInt(cf.nuevos)} nuevos</Pill>
                <Pill tone="red">{fmtInt(cf.perdidos)} perdidos</Pill>
                {fila.cfRecompra != null && <Pill tone="blue">recompra {fmtPct(fila.cfRecompra)}</Pill>}
                {fila.cfTicket != null && <Pill tone="gray">ticket {fmtMoney(fila.cfTicket)}</Pill>}
              </div>
              <TablaCompacta dense maxHeight={380} rowKey={(r) => r.cliente_final}
                filas={cf.filas}
                vacio="Esta cuenta no reporta cliente final."
                columnas={[
                  { key: 'cliente_final', label: 'Cliente final', align: 'left', maxWidth: 260 },
                  { key: 'estado', label: 'Estado', align: 'left', width: 130, render: (r) => capitalizarEstado(r.estado) },
                  { key: 'importe', label: `${MESES[mes - 1]}`, render: (r) => fmtMoney(r.importe) },
                  { key: 'facturas', label: 'Facturas', width: 62, render: (r) => fmtInt(r.facturas) },
                  { key: 'ticket', label: 'Ticket', width: 70, render: (r) => fmtMoney(r.ticket) },
                  { key: 'estatus', label: '', width: 72, align: 'left', render: (r) => (r.nuevo ? <Pill tone="green" size="xs">nuevo</Pill> : r.perdido ? <Pill tone="red" size="xs">perdido</Pill> : null) },
                ]} />
            </div>
          );
        })()
      )}

      {tabActiva === 'mapa' && (
        edoQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={300} /> : (
          <Suspense fallback={<Cargando pantalla="selloutDrill" minHeight={340} />}>
            <MapaMexico datos={estados} seleccion={estadoSel} onSelect={onEstado} alto={340} />
          </Suspense>
        )
      )}
    </div>
  );
}
