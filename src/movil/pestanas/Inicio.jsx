// Pestaña Inicio · saludo + frescura · hero de dirección general (modo Mes, mismos cálculos que el
// Inicio de escritorio: useInicioData + calcular) · 4 KPIs · Hoy · Requiere decisión · Clientes MTD.
import React, { useMemo } from 'react';
import { Wallet, Ship, Megaphone, ClipboardList, CalendarDays, Users, AlertTriangle, ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import FrescuraPill from '../../components/FrescuraPill';
import { useInicioData } from '../../modules/general/inicio/useInicioData';
import { calcular } from '../../modules/general/inicio/calc';
import { FUENTES_INICIO, MAX_ALERTAS } from '../../modules/general/inicio/config';
import { useAlertas, ejecutarAccion, accionAlerta } from '../../lib/alertas';
import { colorSev } from '../../components/notificaciones/Pila';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Skeleton, Vacio } from '../piezas';
import { useHoyExtra, nombreCliente, colorCliente } from '../datos';
import { saludo, diaLargo, nombreCorto, hoyISO, moneyCompact, money, pct, deltaPct, tonoCuota, MESES, N } from '../util';
import FichaCliente from './FichaCliente';
import FichaProducto from '../FichaProducto';

const fmtM = (n) => moneyCompact(n);

export default function Inicio() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mesActual = hoy.getMonth() + 1, hoyIso = hoyISO(hoy);
  const { loading, error, data } = useInicioData(anio);
  const { data: alertas = [] } = useAlertas();
  const { data: extra } = useHoyExtra();
  const r = useMemo(() => (data ? calcular(data, alertas, { anio, mesActual, hoy, modo: 'mes' }) : null), [data, alertas, anio, mesActual, hoy]);

  const abrirCliente = (ck) => nav.push(<FichaCliente clienteKey={ck} />, `cliente-${ck}`);
  const navegarAlerta = (a) => ejecutarAccion(a, (ck, pagina, ex) => {
    if (ex?.sku) { nav.agregarSku(ex.sku); nav.push(<FichaProducto />, 'ficha'); return; }
    if (ck) { abrirCliente(ck); return; }
    if (pagina === 'inventarioGlobal') { nav.push(<FichaProducto />, 'ficha'); return; }
    if (pagina === 'actualizacion') { nav.irATab('mas'); return; }
    nav.abrirProximamente(pagina === 'sellIn' ? 'Sell In global' : pagina);
  });

  // ── Hoy: pagos (vencidos/hoy) · arribos de hoy · marketing de hoy · pendientes · minutas y eventos ──
  const hoyItems = useMemo(() => {
    if (!r) return [];
    const items = [];
    (extra?.pagos || []).forEach((p) => items.push({ key: `p${p.id}`, icon: Wallet, color: theme.orange, titulo: p.concepto || p.categoria || 'Pago', sub: `${nombreCliente(p.cliente)} · ${p.fecha_compromiso < hoyIso ? 'vencido' : 'vence hoy'}`, valor: money(p.monto), onClick: () => abrirCliente(p.cliente) }));
    r.inv.arribos.filter((a) => a.eta === hoyIso).forEach((a) => items.push({ key: `a${a.po}`, icon: Ship, color: theme.accent, titulo: `Arribo PO ${a.po}`, sub: `${Math.round(a.piezas).toLocaleString('es-MX')} pz · ${a.skus} SKUs${a.cedis ? ` · ${a.cedis}` : ''}`, onClick: () => nav.push(<FichaProducto />, 'ficha') }));
    (data?.marketing || []).filter((m) => m.fecha === hoyIso).forEach((m) => items.push({ key: `m${m.id}`, icon: Megaphone, color: theme.purple, titulo: m.nombre, sub: [nombreCliente(m.cliente), m.tipo].filter(Boolean).join(' · '), onClick: () => abrirCliente(m.cliente) }));
    (extra?.pendientes || []).forEach((p) => items.push({ key: `t${p.id}`, icon: ClipboardList, color: theme.green, titulo: p.titulo, sub: `${nombreCliente(p.cliente)}${p.responsable ? ` · ${p.responsable}` : ''}${p.fecha_entrega < hoyIso ? ' · atrasado' : ''}`, onClick: () => abrirCliente(p.cliente) }));
    (extra?.minutas || []).forEach((m) => items.push({ key: `n${m.id}`, icon: CalendarDays, color: theme.indigo, titulo: m.titulo || 'Minuta', sub: `${nombreCliente(m.cliente)} · reunión de hoy`, onClick: () => abrirCliente(m.cliente) }));
    (data?.eventosEquipo || []).filter((e) => e.fecha_ini <= hoyIso && (!e.fecha_fin || e.fecha_fin >= hoyIso)).forEach((e) => items.push({ key: `e${e.id}`, icon: CalendarDays, color: theme.indigo, titulo: e.titulo, sub: e.tipo || 'Evento del equipo', onClick: () => nav.abrirProximamente('Pendientes & Calendario') }));
    (data?.eventosCliente || []).filter((e) => e.fecha === hoyIso).forEach((e) => items.push({ key: `c${e.id}`, icon: Users, color: theme.teal, titulo: e.descripcion || 'Evento con cliente', sub: [nombreCliente(e.cliente), e.lugar].filter(Boolean).join(' · '), onClick: () => abrirCliente(e.cliente) }));
    return items;
  }, [r, extra, data, hoyIso, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const titulo = `${saludo(hoy)}, ${nombreCorto(nav.perfil) || 'hola'}`;
  const sub = <><span>{diaLargo(hoy).replace(/^./, (c) => c.toUpperCase())}</span><span>·</span><FrescuraPill fuentes={FUENTES_INICIO} /></>;

  if (error) {
    return (<><TituloGrande titulo={titulo} sub={sub} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar los datos" sub={error} /></>);
  }
  if (loading || !r) {
    return (
      <>
        <TituloGrande titulo={titulo} sub={sub} />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={150} r={12} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div>
          <Skeleton h={170} r={12} />
        </div>
      </>
    );
  }

  const soUltimo = r.clientes.map((c) => c.sellout).filter(Boolean);
  const soTotal = soUltimo.reduce((s, x) => s + N(x.monto), 0);
  const soMes = soUltimo.length ? Math.max(...soUltimo.map((x) => x.mes)) : null;
  const decision = r.decision.slice(0, MAX_ALERTAS);

  return (
    <>
      <TituloGrande titulo={titulo} sub={sub} />

      <HeroM eyebrow={`Dirección general · ${r.mesL} ${anio}`} frase={r.titulo} sub={r.sub}
        stats={[
          { k: 'Fact Neta MTD', v: fmtM(r.cur.fact_neta), sub: r.pctCuota != null ? `${Math.round(r.pctCuota)}% de cuota` : 'sin cuota' },
          { k: 'Margen MC', v: r.cur.mc != null ? pct(r.cur.mc) : '—', sub: r.dMc != null ? `${r.dMc >= 0 ? '+' : ''}${r.dMc.toFixed(1)} pp` : undefined },
          { k: 'Utilidad', v: fmtM(r.cur.utilidad_comercial), sub: r.yoyUtilidad != null ? `${deltaPct(r.yoyUtilidad)} YoY` : undefined },
        ]} />

      <KpiGrid style={{ marginTop: 12 }}>
        <KpiM eyebrow={`Fact Neta YTD ${anio}`} big={fmtM(r.otro.fact_neta)} sub={r.yoyOtro != null ? `${deltaPct(r.yoyOtro)} vs ${anio - 1}` : undefined} progress={r.pctOtro} pill={r.pctOtro != null ? { tone: tonoCuota(r.pctOtro), label: `${Math.round(r.pctOtro)}%` } : undefined} />
        <KpiM eyebrow="Cartera vencida" big={fmtM(r.cartera.vencido)} bigColor={r.cartera.vencido > 0 ? theme.red : undefined} sub={r.cartera.saldo > 0 ? `${pct(r.cartera.pctVencido, 0)} de ${fmtM(r.cartera.saldo)}` : 'sin saldo'} onClick={() => nav.abrirProximamente('Cobranza')} />
        <KpiM eyebrow="Inventario comercial" big={fmtM(r.inv.valor)} sub={r.inv.cobertura != null ? `${r.inv.cobertura} d de cobertura` : `${r.inv.skus} SKUs con stock`} pill={r.inv.skusRiesgo > 0 ? { tone: 'red', label: `${r.inv.skusRiesgo} en riesgo` } : undefined} onClick={() => nav.push(<FichaProducto />, 'ficha')} />
        <KpiM eyebrow={`Sell-out ${soMes ? MESES[soMes - 1] : 'últ. mes'}`} big={soTotal > 0 ? fmtM(soTotal) : '—'} sub={soUltimo.length ? `${soUltimo.length} clientes · último mes cerrado` : 'sin sell-out cargado'} />
      </KpiGrid>

      <ListaAgrupada titulo="Hoy" meta={hoyItems.length || undefined} style={{ marginTop: 18 }}>
        {hoyItems.length === 0 && <Vacio titulo="Nada pendiente para hoy" sub="Sin pagos, arribos, actividades ni tareas con fecha de hoy." style={{ padding: '22px 16px' }} />}
        {hoyItems.map((it) => <Fila key={it.key} icon={it.icon} color={it.color} titulo={it.titulo} sub={it.sub} valor={it.valor} onClick={it.onClick} />)}
      </ListaAgrupada>

      <ListaAgrupada titulo="Requiere decisión" meta={r.decision.length || undefined} style={{ marginTop: 18 }}
        accion={r.decision.length > MAX_ALERTAS && <button type="button" onClick={() => nav.irATab('alertas')} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, padding: 0, cursor: 'pointer' }}>Ver las {r.decision.length} ›</button>}>
        {decision.length === 0 && <Vacio titulo="Sin asuntos críticos" sub="No hay alertas críticas ni altas activas." style={{ padding: '22px 16px' }} />}
        {decision.map((a) => {
          const acc = accionAlerta(a);
          return (
            <Fila key={a.id} tono={colorSev(theme, a.severidad)} titulo={a.titulo} sub={[a.cliente_key ? nombreCliente(a.cliente_key) : null, a.sku, a.detalle].filter(Boolean).join(' · ')}
              onClick={acc ? () => navegarAlerta(a) : undefined} chevron={false}
              trailing={acc && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: theme.accent, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{acc.label}<ChevronRight size={14} /></span>} />
          );
        })}
      </ListaAgrupada>

      <ListaAgrupada titulo="Clientes · MTD" style={{ marginTop: 18 }} pie="Toca un cliente para ver su ficha.">
        {r.clientes.map((c) => (
          <Fila key={c.key} tono={colorCliente(c.key, theme)} titulo={c.nombre} sub={c.cuota > 0 ? `${money(c.fact)} de ${fmtM(c.cuota)}` : money(c.fact)}
            pill={c.pct != null ? { tone: tonoCuota(c.pct), label: `${Math.round(c.pct)}% cuota` } : { tone: 'gray', label: c.yoy != null ? `${deltaPct(c.yoy)} YoY` : 'sin cuota' }}
            onClick={() => abrirCliente(c.key)} />
        ))}
      </ListaAgrupada>
    </>
  );
}
