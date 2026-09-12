// Ficha de cliente (push) · hero MTD vs cuota · YTD · sell-out último mes cerrado + pestañas del cliente.
// Consultas directas por vistas (v_fact_cliente_mes, cuotas_mensuales, v_sellout_*_mensual); no carga el Home completo.
import React, { useMemo } from 'react';
import { ShoppingCart, ShoppingBag, Megaphone, Wallet, CreditCard, Home } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { canalLabel } from '../../modules/general/inicio/config';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Skeleton } from '../piezas';
import { useClientesMes, useSelloutMensual, PROPIOS, nombreCliente, colorCliente } from '../datos';
import { money, moneyCompact, deltaPct, tonoCuota, MESES, N } from '../util';
import SellInCliente from './SellInCliente';

const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

export default function FichaCliente({ clienteKey, tipo, label }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const propio = PROPIOS.includes(clienteKey);
  const esCanal = tipo === 'canal';
  const nombre = label || (esCanal ? canalLabel(clienteKey) : nombreCliente(clienteKey));
  const { data, isLoading } = useClientesMes(anio);
  const { data: so } = useSelloutMensual(propio ? clienteKey : null, anio);

  const r = useMemo(() => {
    if (!data) return null;
    const rows = esCanal ? data.canales.filter((x) => (x.canal || 'otros') === clienteKey).map((x) => ({ ...x, monto: x.fact_neta })) : data.fact.filter((x) => x.cliente_key === clienteKey);
    const de = (a, m) => sum(rows.filter((x) => N(x.anio) === a && N(x.mes) === m), (x) => x.monto);
    const factor = Math.min(1, Math.max(1, hoy.getDate()) / new Date(anio, mes, 0).getDate());
    const mtd = de(anio, mes), mtdPrev = de(anio - 1, mes);
    const ytd = sum(rows.filter((x) => N(x.anio) === anio && N(x.mes) <= mes), (x) => x.monto);
    const ytdPrev = sum(rows.filter((x) => N(x.anio) === anio - 1 && N(x.mes) <= mes), (x) => x.monto);
    const cuotaMes = sum(data.cuotas.filter((c) => c.cliente === clienteKey && N(c.mes) === mes), (c) => c.cuota_ideal);
    const cuotaYtd = sum(data.cuotas.filter((c) => c.cliente === clienteKey && N(c.mes) <= mes), (c) => c.cuota_ideal);
    const pct = cuotaMes > 0 ? (mtd / cuotaMes) * 100 : null, pctYtd = cuotaYtd > 0 ? (ytd / cuotaYtd) * 100 : null;
    const piezas = sum(rows.filter((x) => N(x.anio) === anio && N(x.mes) === mes), (x) => x.piezas ?? x.piezas_venta_neta);
    // Sell-out: último mes cerrado con datos (< mes actual)
    let soCerrado = null;
    if (so?.length) {
      const soDe = (a, m) => sum(so.filter((x) => N(x.anio) === a && N(x.mes) === m), (x) => x.monto);
      for (let m = mes - 1; m >= 1; m--) if (soDe(anio, m) > 0) { soCerrado = { mes: m, monto: soDe(anio, m), yoy: delta(soDe(anio, m), soDe(anio - 1, m)) }; break; }
    }
    const frase = !mtd ? `Aún sin facturación en ${MESES[mes - 1].toLowerCase()}`
      : pct == null ? `${MESES[mes - 1]} lleva ${moneyCompact(mtd)}${mtdPrev ? `, ${deltaPct(delta(mtd, mtdPrev * factor))} vs ${anio - 1} a mismo día` : ''}`
      : pct >= 100 ? `${(pct - 100).toFixed(0)}% arriba de la cuota de ${MESES[mes - 1].toLowerCase()}`
      : `Va al ${Math.round(pct)}% de la cuota de ${MESES[mes - 1].toLowerCase()}`;
    return { mtd, mtdPrev, yoy: delta(mtd, mtdPrev * factor), ytd, ytdPrev, yoyYtd: delta(ytd, ytdPrev), cuotaMes, cuotaYtd, pct, pctYtd, piezas, soCerrado, frase };
  }, [data, so, clienteKey, esCanal, anio, mes, hoy]);

  const proximamente = (que) => nav.abrirProximamente(`${nombre} · ${que}`);
  const ir = (pagina, label) => nav.navegar({ clienteKey, pagina, label });
  const pestanas = propio
    ? [
      // nav.navegar (no nav.push) para que el nodo quede resaltado en el menú: pasa por rutas.js y fija activoId.
      { id: 'sellIn', label: 'Sell In', icon: ShoppingCart, sub: 'Avance de cuota · SKUs del mes · compartir avance', onClick: () => ir('sellIn', 'Sell In') },
      { id: 'sellOut', label: 'Sell Out', icon: ShoppingBag, sub: 'Sell-out del mes · inventario del cliente', onClick: () => ir('estrategia', 'Sell Out') },
      { id: 'marketing', label: 'Marketing', icon: Megaphone, sub: 'Actividades del mes · captura', onClick: () => ir('marketing', 'Marketing') },
      { id: 'pagos', label: 'Pagos', icon: Wallet, sub: 'Próximamente', onClick: () => proximamente('Pagos') },
      { id: 'cartera', label: 'Cobranza', icon: CreditCard, sub: 'Saldo · vencido · estado de cuenta', onClick: () => ir('cartera', 'Crédito y Cobranza') },
    ]
    : [
      { id: 'sellIn', label: 'Sell In', icon: ShoppingCart, sub: esCanal ? 'SKUs del canal por mes' : 'SKUs por mes · YoY', onClick: esCanal ? () => proximamente('Sell In por canal') : () => nav.push(<SellInCliente clienteKey={clienteKey} nombre={nombre} />, `sellin-${clienteKey}`) },
      { id: 'home', label: 'Resumen completo', icon: Home, sub: 'Próximamente', onClick: () => proximamente('Resumen') },
    ];

  const color = colorCliente(clienteKey, theme);
  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Clientes" />
      <TituloGrande titulo={nombre} sub={<><span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />{propio ? 'Cliente propio' : esCanal ? 'Canal del ERP' : 'Cliente del ERP'} · {MESES[mes - 1]} {anio}</>} />
      {isLoading || !r ? (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={140} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div></div>
      ) : (
        <>
          <HeroM eyebrow={esCanal ? 'Fact Neta ERP' : 'Sell In'} frase={r.frase}
            sub={r.cuotaMes > 0 ? `${money(r.mtd)} de ${moneyCompact(r.cuotaMes)} de cuota · ${Math.round(r.piezas).toLocaleString('es-MX')} pz` : `${money(r.mtd)} este mes${r.piezas ? ` · ${Math.round(r.piezas).toLocaleString('es-MX')} pz` : ''}`}
            stats={[
              { k: 'MTD', v: moneyCompact(r.mtd), sub: r.pct != null ? `${Math.round(r.pct)}% cuota` : r.yoy != null ? `${deltaPct(r.yoy)} YoY` : undefined },
              { k: `YTD ${anio}`, v: moneyCompact(r.ytd), sub: r.pctYtd != null ? `${Math.round(r.pctYtd)}% cuota` : r.yoyYtd != null ? `${deltaPct(r.yoyYtd)} YoY` : undefined },
              propio ? { k: `Sell-out ${r.soCerrado ? MESES[r.soCerrado.mes - 1] : ''}`, v: r.soCerrado ? moneyCompact(r.soCerrado.monto) : '—', sub: r.soCerrado?.yoy != null ? `${deltaPct(r.soCerrado.yoy)} YoY` : 'último mes cerrado' }
                : { k: `${anio - 1} mismo día`, v: moneyCompact(r.mtdPrev), sub: r.yoy != null ? `${deltaPct(r.yoy)} YoY` : undefined },
            ]} />
          <KpiGrid style={{ marginTop: 12 }}>
            <KpiM eyebrow="Cuota del mes" big={r.cuotaMes > 0 ? moneyCompact(r.cuotaMes) : '—'} sub={r.cuotaMes > 0 ? `faltan ${moneyCompact(Math.max(0, r.cuotaMes - r.mtd))}` : 'sin cuota cargada'} progress={r.pct} pill={r.pct != null ? { tone: tonoCuota(r.pct), label: `${Math.round(r.pct)}%` } : undefined} />
            <KpiM eyebrow={`YTD vs ${anio - 1}`} big={r.yoyYtd != null ? deltaPct(r.yoyYtd, 1) : '—'} bigColor={r.yoyYtd == null ? undefined : r.yoyYtd >= 0 ? theme.green : theme.red} sub={`${moneyCompact(r.ytdPrev)} el año pasado`} />
          </KpiGrid>
        </>
      )}
      <ListaAgrupada titulo="Pestañas" style={{ marginTop: 18 }} pie={propio ? 'Sell In y Sell Out son de consulta; lo que todavía se edita desde la computadora se marca como Próximamente.' : undefined}>
        {pestanas.map((p) => <Fila key={p.id} icon={p.icon} color={color} titulo={p.label} sub={p.sub} onClick={p.onClick} />)}
      </ListaAgrupada>
    </>
  );
}
