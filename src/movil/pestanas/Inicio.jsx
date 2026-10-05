// Pestaña Inicio · saludo + frescura · hero de dirección general (mismos cálculos que el Inicio de escritorio:
// useInicioData + calcular) · 4 KPIs · Hoy · Requiere decisión · Clientes · «<año> frente a <año-1>».
// 2026-10-01 (Fernando: «los avances aplícalos al celular»): selector de período (mes o año, y año) arriba; todas las
// cifras son de ese período contra el mismo del año anterior; el bloque comparativo permite tocar un mes para moverse.
import React, { useMemo, useState } from 'react';
import { Wallet, Ship, Megaphone, ClipboardList, CalendarDays, Users, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import FrescuraPill from '../../components/FrescuraPill';
import { useInicioData } from '../../modules/general/inicio/useInicioData';
import { calcular } from '../../modules/general/inicio/calc';
import { FUENTES_INICIO, MAX_ALERTAS } from '../../modules/general/inicio/config';
import { useAlertas, ejecutarAccion, accionAlerta } from '../../lib/alertas';
import { colorSev } from '../../components/notificaciones/Pila';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Skeleton, Vacio, HojaM, Pill } from '../piezas';
import { GraficaLineas } from '../../components/kit';
import { idNodo } from '../../components/nav/arbol';
import { useHoyExtra, nombreCliente, colorCliente } from '../datos';
import { puedeVerSensible, puedeVerPestanaGlobal, puedeVerCliente, puedeVerInicio } from '../../lib/permisos';
import { saludo, diaLargo, nombreCorto, hoyISO, moneyCompact, money, pct, deltaPct, tonoCuota, tonoDelta, MESES, N, fechaCorta } from '../util';
import { canalLabel } from '../../modules/general/inicio/config';
import FichaCliente from './FichaCliente';
import FichaProducto from '../FichaProducto';

const fmtM = (n) => moneyCompact(n);
const signo = (v, d = 0) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);

/** Barra de cuota (se llena y cambia de color: rojo < 60 · naranja < 85 · azul < 100 · verde) con monto y %. */
function BarraCuotaM({ valor, cuota, label }) {
  const { theme } = useTheme();
  if (!cuota) return null;
  const p = Math.max(0, (valor / cuota) * 100);
  const color = p >= 100 ? theme.green : p >= 85 ? '#5AC8FA' : p >= 60 ? theme.orange : theme.red;
  // Va dentro del HeroM (tarjeta inversa): en tema oscuro la tarjeta es clara, así que el texto es oscuro.
  const texto = theme.textOnInverse || theme.textOnDark || '#FFF';
  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.7)';
  const pista = theme.mode === 'dark' ? 'rgba(29,29,31,0.12)' : 'rgba(255,255,255,0.14)';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5, color: muted, fontVariantNumeric: 'tabular-nums' }}>
        <span><b style={{ color: texto, fontWeight: 600 }}>{fmtM(valor)}</b> de {fmtM(cuota)} de {label}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, color }}>{Math.round(p)}%</span>
      </div>
      <div style={{ marginTop: 4, height: 8, borderRadius: 999, background: pista, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, p)}%`, background: color, borderRadius: 999, transition: 'width 420ms cubic-bezier(0.32,0.72,0,1)' }} /></div>
    </div>
  );
}

/** Botón «Sep 2026 ▾» + hoja con los meses (y «Año completo») del año en curso y los dos anteriores. */
function SelectorPeriodoM({ anio, mes, anioHoy, mesHoy, onChange }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const anios = [anioHoy, anioHoy - 1, anioHoy - 2];
  const label = mes === 'anio' ? `Año ${anio}` : `${MESES[mes - 1]} ${anio}`;
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px 0 12px', borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {label}<ChevronDown size={14} style={{ color: theme.textMuted }} />
      </button>
      <HojaM abierto={abierto} onClose={() => setAbierto(false)} titulo="Período" sub="Mes o año completo · se compara con el año anterior" alto="75vh">
        {anios.map((a) => (
          <ListaAgrupada key={a} titulo={String(a)} style={{ marginBottom: 14 }}>
            <Fila titulo={`Año ${a}`} sub={a === anioHoy ? 'Acumulado a hoy' : 'Año completo'} chevron={false} alto={44}
              trailing={anio === a && mes === 'anio' ? <Pill tone="blue">Elegido</Pill> : undefined} onClick={() => { onChange(a, 'anio'); setAbierto(false); }} />
            {MESES.map((lbl, i) => {
              const m = i + 1;
              if (a === anioHoy && m > mesHoy) return null;
              const on = anio === a && mes === m;
              return <Fila key={m} titulo={`${lbl} ${a}`} sub={a === anioHoy && m === mesHoy ? 'Mes en curso' : undefined} chevron={false} alto={44}
                trailing={on ? <Pill tone="blue">Elegido</Pill> : undefined} onClick={() => { onChange(a, m); setAbierto(false); }} />;
            })}
          </ListaAgrupada>
        ))}
      </HojaM>
    </>
  );
}

export default function Inicio() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1, hoyIso = hoyISO(hoy);
  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(mesHoy);   // 1..12 | 'anio'
  const modo = mes === 'anio' ? 'anio' : 'mes';
  const { loading, error, data } = useInicioData(anio);
  const ultimoMesConDatos = useMemo(() => (data ? (data.medidas || []).filter((x) => N(x.anio) === anio && N(x.fact_neta)).reduce((u, x) => Math.max(u, N(x.mes)), 0) : 0), [data, anio]);
  const mesActual = modo === 'mes' ? mes : (anio === anioHoy ? mesHoy : (ultimoMesConDatos || 12));
  const enCurso = anio === anioHoy && mesActual === mesHoy;
  const elegirPeriodo = (a, m) => { setAnio(a); setMes(m); };
  const { data: alertas = [] } = useAlertas();
  const { data: extra } = useHoyExtra();
  const perfil = nav.perfil;
  const veInicio = puedeVerInicio(perfil);
  const sensible = puedeVerSensible(perfil);
  const veCobranza = puedeVerPestanaGlobal(perfil, 'cobranza_global'), veInventario = puedeVerPestanaGlobal(perfil, 'inventario_global');
  const clientesVisibles = useMemo(() => ['digitalife', 'pcel', 'dicotech'].filter((k) => puedeVerCliente(perfil, k)), [perfil]);
  const r = useMemo(() => (data ? calcular(data, alertas, { anio, mesActual, hoy, modo, sensible, clientesVisibles, enCurso }) : null), [data, alertas, anio, mesActual, hoy, modo, sensible, clientesVisibles, enCurso]);

  // 3er argumento de push = nodo del árbol que queda resaltado en el menú.
  const abrirCliente = (ck) => nav.push(<FichaCliente clienteKey={ck} />, `cliente-${ck}`, ['digitalife', 'pcel', 'dicotech'].includes(ck) ? idNodo(ck, 'home') : null);
  const abrirFicha = () => nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal');
  const navegarAlerta = (a) => ejecutarAccion(a, (ck, pagina, ex) => {
    if (ex?.sku) { nav.agregarSku(ex.sku); abrirFicha(); return; }
    if (ck) { abrirCliente(ck); return; }
    if (pagina === 'inventarioGlobal') { abrirFicha(); return; }
    nav.navegar({ pagina, label: pagina === 'sellIn' ? 'Sell In global' : undefined }); // rutas.js: Fuentes, Historial o "Próximamente"
  });

  // ── Hoy: pagos (vencidos/hoy) · arribos de hoy · marketing de hoy · pendientes · minutas y eventos ──
  const hoyItems = useMemo(() => {
    if (!r) return [];
    const items = [];
    (extra?.pagos || []).forEach((p) => items.push({ key: `p${p.id}`, icon: Wallet, color: theme.orange, titulo: p.concepto || p.categoria || 'Pago', sub: `${nombreCliente(p.cliente)} · ${p.fecha_compromiso < hoyIso ? 'vencido' : 'vence hoy'}`, valor: money(p.monto), onClick: () => abrirCliente(p.cliente) }));
    r.inv.arribos.filter((a) => a.eta === hoyIso).forEach((a) => items.push({ key: `a${a.po}`, icon: Ship, color: theme.accent, titulo: `Arribo PO ${a.po}`, sub: `${Math.round(a.piezas).toLocaleString('es-MX')} pz · ${a.skus} SKUs${a.cedis ? ` · ${a.cedis}` : ''}`, onClick: abrirFicha }));
    (data?.marketing || []).filter((m) => m.fecha === hoyIso).forEach((m) => items.push({ key: `m${m.id}`, icon: Megaphone, color: theme.purple, titulo: m.nombre, sub: [nombreCliente(m.cliente), m.tipo].filter(Boolean).join(' · '), onClick: () => abrirCliente(m.cliente) }));
    (extra?.pendientes || []).forEach((p) => items.push({ key: `t${p.id}`, icon: ClipboardList, color: theme.green, titulo: p.titulo, sub: `${nombreCliente(p.cliente)}${p.responsable ? ` · ${p.responsable}` : ''}${p.fecha_entrega < hoyIso ? ' · atrasado' : ''}`, onClick: () => abrirCliente(p.cliente) }));
    (extra?.minutas || []).forEach((m) => items.push({ key: `n${m.id}`, icon: CalendarDays, color: theme.indigo, titulo: m.titulo || 'Minuta', sub: `${nombreCliente(m.cliente)} · reunión de hoy`, onClick: () => abrirCliente(m.cliente) }));
    (data?.eventosEquipo || []).filter((e) => e.fecha_ini <= hoyIso && (!e.fecha_fin || e.fecha_fin >= hoyIso)).forEach((e) => items.push({ key: `e${e.id}`, icon: CalendarDays, color: theme.indigo, titulo: e.titulo, sub: e.tipo || 'Evento del equipo', onClick: () => nav.navegar({ pagina: 'agenda' }) }));
    (data?.eventosCliente || []).filter((e) => e.fecha === hoyIso).forEach((e) => items.push({ key: `c${e.id}`, icon: Users, color: theme.teal, titulo: e.descripcion || 'Evento con cliente', sub: [nombreCliente(e.cliente), e.lugar].filter(Boolean).join(' · '), onClick: () => abrirCliente(e.cliente) }));
    return items;
  }, [r, extra, data, hoyIso, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const titulo = `${saludo(hoy)}, ${nombreCorto(nav.perfil) || 'hola'}`;
  const periodoLbl = modo === 'mes' ? `${MESES[mesActual - 1]} ${anio}` : `${anio}`;
  const so = r?.sellOut, ec = r?.enCamino;
  const fraseNegocio = r ? [
    so.total > 0 ? `Sell out ${fmtM(so.total)}${so.yoy != null ? ` (${deltaPct(so.yoy)} vs ${anio - 1})` : ''}${so.soSi != null ? ` · SO/SI ${so.soSi.toFixed(2)}` : ''}` : null,
    r.inv.cobertura != null ? `${r.inv.cobertura} d de inventario` : null,
    ec.valor > 0 ? `${fmtM(ec.valor)} en camino en ${ec.pos} PO` : null,
    r.cartera.vencido > 0 ? `cartera vencida ${fmtM(r.cartera.vencido)}` : null,
  ].filter(Boolean).join(' · ') : '';
  const selector = sensible ? <SelectorPeriodoM anio={anio} mes={mes} anioHoy={anioHoy} mesHoy={mesHoy} onChange={elegirPeriodo} /> : null;
  const sub = <><span>{diaLargo(hoy).replace(/^./, (c) => c.toUpperCase())}</span><span>·</span><FrescuraPill fuentes={FUENTES_INICIO} detallado /></>;

  if (error) {
    return (<><TituloGrande titulo={titulo} sub={sub} derecha={selector} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar los datos" sub={error} /></>);
  }
  if (!veInicio) return <Vacio titulo="Sin acceso a Inicio" sub="Entra por Clientes para ver tu información." style={{ padding: '40px 16px' }} />;
  if (loading || !r) {
    return (
      <>
        <TituloGrande titulo={titulo} sub={sub} derecha={selector} />
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
    <div data-stagger>
      <TituloGrande titulo={titulo} sub={sub} derecha={selector} />
      {sensible && puedeVerPestanaGlobal(perfil, 'vision_general') && (
        <div style={{ padding: '0 20px 10px' }}>
          <button type="button" onClick={() => nav.navegar({ pagina: 'visionGeneral' })}
            style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent, borderRadius: 999, padding: '6px 14px', fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Detalle del año <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* La facturación de toda la empresa es sensible: sin el permiso, el hero es de sus clientes y su día. */}
      <HeroM eyebrow={sensible ? `Dirección general · ${modo === 'mes' ? `${r.mesL} ${anio}` : `Año ${anio}`}` : `Mis clientes · ${r.mesL} ${anio}`} frase={sensible ? r.titulo : `Hoy tienes ${decision.length} aviso${decision.length === 1 ? '' : 's'} que atender.`} sub={sensible ? fraseNegocio : `Tus clientes: ${r.clientes.map((c) => c.nombre || c.label || c.key).filter(Boolean).join(' · ') || 'ninguno'}.`}
        stats={sensible ? [
          { k: 'Margen MC', v: r.cur.mc != null ? pct(r.cur.mc) : '—', sub: r.dMc != null ? `${r.dMc >= 0 ? '+' : ''}${r.dMc.toFixed(1)} pp vs ${anio - 1}` : undefined },
          { k: 'Utilidad', v: fmtM(r.cur.utilidad_comercial), sub: r.yoyUtilidad != null ? `${deltaPct(r.yoyUtilidad)} ${r.yoyLabel}` : undefined },
          { k: 'Piezas netas', v: Math.round(r.cur.piezas).toLocaleString('es-MX'), sub: modo === 'mes' ? 'del mes' : 'del año' },
        ] : [
          { k: 'Clientes', v: String(r.clientes.length), sub: 'que ves' },
          { k: 'Avisos', v: String(decision.length), sub: 'hoy' },
        ]}>
        {sensible && <BarraCuotaM valor={r.cur.fact_neta} cuota={r.cuotaPeriodo} label={modo === 'mes' ? `cuota de ${r.mesL.toLowerCase()}` : (anio === anioHoy ? 'cuota a la fecha' : 'cuota anual')} />}
      </HeroM>

      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        {sensible && <KpiM eyebrow={`Sell in · ${periodoLbl}`} big={fmtM(r.cur.fact_neta)} sub={r.yoy != null ? `${deltaPct(r.yoy)} ${r.yoyLabel}` : 'sin comparativo'} progress={r.pctCuota} pill={r.pctCuota != null ? { tone: tonoCuota(r.pctCuota), label: `${Math.round(r.pctCuota)}% cuota` } : undefined} onClick={() => nav.navegar({ pagina: 'sellIn', label: 'Sell In global' })} />}
        {sensible && <KpiM eyebrow={`Sell out · ${periodoLbl}`} big={so.total > 0 ? fmtM(so.total) : '—'} sub={so.total > 0 ? `${so.nCuentas} cuenta${so.nCuentas === 1 ? '' : 's'}${so.soSi != null ? ` · SO/SI ${so.soSi.toFixed(2)}` : ''}` : 'sin sell out en el período'} pill={so.yoy != null ? { tone: tonoDelta(so.yoy), label: deltaPct(so.yoy) } : undefined} onClick={() => nav.navegar({ pagina: 'sellOut' })} />}
        {sensible && veInventario && <KpiM eyebrow="En camino" big={fmtM(ec.valor)} sub={`${Math.round(ec.piezas).toLocaleString('es-MX')} pz · ${ec.pos} PO${ec.porMes[0] ? ` · ${ec.porMes[0].label} ${fmtM(ec.porMes[0].valor)}` : ''}`} pill={ec.atrasados.pos > 0 ? { tone: 'red', label: `${ec.atrasados.pos} PO atrasadas` } : ec.proximos[0] ? { tone: 'blue', label: fechaCorta(ec.proximos[0].eta) } : undefined} onClick={abrirFicha} />}
        {sensible && <KpiM eyebrow={modo === 'mes' ? `Sell in YTD ${anio}` : `Sell in ${r.mesL}`} big={fmtM(r.otro.fact_neta)} sub={r.yoyOtro != null ? `${deltaPct(r.yoyOtro)} vs ${anio - 1}` : undefined} progress={r.pctOtro} pill={r.pctOtro != null ? { tone: tonoCuota(r.pctOtro), label: `${Math.round(r.pctOtro)}%` } : undefined} />}
        {veCobranza && <KpiM eyebrow="Cartera vencida" big={fmtM(r.cartera.vencido)} bigColor={r.cartera.vencido > 0 ? theme.red : undefined} sub={r.cartera.saldo > 0 ? `${pct(r.cartera.pctVencido, 0)} de ${fmtM(r.cartera.saldo)}` : 'sin saldo'} onClick={() => nav.navegar({ pagina: 'cobranzaGlobal' })} />}
        {veInventario && <KpiM eyebrow="Inventario comercial" big={sensible ? fmtM(r.inv.valor) : `${Math.round(r.inv.piezas).toLocaleString('es-MX')} pz`} sub={r.inv.cobertura != null ? `${r.inv.cobertura} d de cobertura` : `${r.inv.skus} SKUs con stock`} pill={r.inv.skusRiesgo > 0 ? { tone: 'red', label: `${r.inv.skusRiesgo} en riesgo` } : undefined} onClick={abrirFicha} />}
        <KpiM eyebrow={`Sell-out ${soMes ? MESES[soMes - 1] : 'últ. mes'}`} big={soTotal > 0 ? fmtM(soTotal) : '—'} sub={soUltimo.length ? `${soUltimo.length} clientes · último mes cerrado` : 'sin sell-out cargado'} />
      </KpiGrid>

      <ListaAgrupada titulo="Hoy" meta={hoyItems.length || undefined} style={{ marginTop: 18 }}
        accion={<button type="button" onClick={() => nav.navegar({ pagina: 'agenda' })} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, padding: 0, cursor: 'pointer' }}>Agenda ›</button>}>
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

      {sensible && <SellOutM r={r} periodoLbl={periodoLbl} onAbrir={() => nav.navegar({ pagina: 'sellOut' })} />}
      {sensible && <MixM r={r} periodoLbl={periodoLbl} />}
      {sensible && veInventario && <InventarioM r={r} onAbrir={abrirFicha} />}

      {!sensible && <ListaAgrupada titulo={`Clientes · ${periodoLbl}`} style={{ marginTop: 18 }} pie="Toca un cliente para ver su ficha.">
        {r.clientes.map((c) => (
          <Fila key={c.key} tono={colorCliente(c.key, theme)} titulo={c.nombre} sub={c.cuota > 0 ? `${money(c.fact)} de ${fmtM(c.cuota)}` : money(c.fact)}
            pill={c.pct != null ? { tone: tonoCuota(c.pct), label: `${Math.round(c.pct)}% cuota` } : { tone: 'gray', label: c.yoy != null ? `${deltaPct(c.yoy)} YoY` : 'sin cuota' }}
            onClick={() => abrirCliente(c.key)} />
        ))}
      </ListaAgrupada>}

      {sensible && <ComparativoM r={r} mes={mes} onMes={(m) => setMes(m)} />}
    </div>
  );
}

// ── «<año> frente a <año-1>»: gráfica 12 meses vs anterior (+ cuota) y lista mes a mes; tocar un mes cambia el período.
function ComparativoM({ r, mes, onMes }) {
  const { theme } = useTheme();
  const c = r.comparativo;
  const datos = c.meses.map((m) => ({ x: m.label, fn: m.fn || null, prev: m.prev || null, cuota: m.cuota }));
  const series = [{ key: 'fn', label: String(r.anio), tipo: 'principal' }, { key: 'prev', label: String(r.anio - 1), tipo: 'anterior' }, ...(c.cuotaAnual ? [{ key: 'cuota', label: 'Cuota', tipo: 'cuota' }] : [])];
  const filas = c.meses.filter((m) => m.conDatos || m.mes <= (c.ultimoMesConDatos || 0));
  const tot = c.anual, totP = c.anualPrev;
  const hasta = c.hastaMes < 12 ? `ene–${c.meses[c.hastaMes - 1].label.toLowerCase()}` : 'total';
  const meta = c.mesesConDatos ? `${c.mesesArriba} de ${c.mesesConDatos} arriba de ${r.anio - 1}` : undefined;
  return (
    <ListaAgrupada titulo={`${r.anio} frente a ${r.anio - 1}`} meta={meta} style={{ marginTop: 18 }}
      accion={mes !== 'anio' ? <button type="button" onClick={() => onMes('anio')} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, padding: 0, cursor: 'pointer' }}>Ver el año ›</button> : undefined}
      pie="Toca un mes para ver toda la pestaña en ese mes. El mes en curso (·) se compara a mismo día del año anterior.">
      <div style={{ padding: '10px 12px 4px' }}>
        <GraficaLineas compacto alto={160} datos={datos} series={series} formato={fmtM} mesActivo={mes === 'anio' ? null : mes - 1} onClickMes={(i) => onMes(i + 1)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '6px 16px 10px', borderBottom: `1px solid ${theme.border}` }}>
        {[
          { k: hasta === 'total' ? `Total ${r.anio}` : `${hasta.replace(/^./, (x) => x.toUpperCase())} ${r.anio}`, v: fmtM(tot.fact_neta), sub: c.yoyAnual != null ? `${signo(c.yoyAnual)} vs ${r.anio - 1}` : undefined, color: c.yoyAnual == null ? theme.text : c.yoyAnual >= 0 ? theme.green : theme.red },
          c.cuotaAnual ? { k: 'Cuota anual', v: fmtM(c.cuotaAnual), sub: tot.fact_neta ? `${Math.round((tot.fact_neta / c.cuotaAnual) * 100)}% alcanzado` : undefined } : null,
          { k: `MC ${r.anio}`, v: tot.mc != null ? pct(tot.mc) : '—', sub: tot.mc != null && totP.mc != null ? `${tot.mc - totP.mc >= 0 ? '+' : ''}${(tot.mc - totP.mc).toFixed(1)} pp` : undefined },
        ].filter(Boolean).map((x) => (
          <div key={x.k} style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.k}</div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: x.color || theme.text, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
            {x.sub && <div style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.sub}</div>}
          </div>
        ))}
      </div>
      {filas.map((m) => (
        <Fila key={m.mes} titulo={`${m.label}${m.enCurso ? ' ·' : ''} ${r.anio}`} sub={`${r.anio - 1}: ${m.prev ? fmtM(m.prev) : '—'}${m.pct != null ? ` · ${Math.round(m.pct)}% cuota` : ''}${r.sensible && m.mc != null ? ` · MC ${pct(m.mc)}` : ''}`}
          valor={m.fn ? fmtM(m.fn) : '—'} chevron={false} alto={48} onClick={() => onMes(m.mes)}
          pill={m.yoy == null ? undefined : { tone: m.yoy >= 0 ? 'green' : 'red', label: signo(m.yoy) }}
          style={m.mes === mes ? { background: `${theme.accent}14` } : undefined} />
      ))}
    </ListaAgrupada>
  );
}

// ── Sell out del período por cuenta (consolidado)
function SellOutM({ r, periodoLbl, onAbrir }) {
  const { theme } = useTheme();
  const s = r.sellOut;
  return (
    <ListaAgrupada titulo={`Sell out · ${periodoLbl}`} meta={s.nCuentas ? `${s.nCuentas}` : undefined} style={{ marginTop: 18 }}
      accion={<button type="button" onClick={onAbrir} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, padding: 0, cursor: 'pointer' }}>Consolidado ›</button>}
      pie={s.total > 0 ? `${fmtM(s.total)} en total${s.soSi != null ? ` · SO/SI ${s.soSi.toFixed(2)}` : ''}${s.invCuentas ? ` · inventario en cuentas ${fmtM(s.invValor)}` : ''}` : undefined}>
      {s.cuentas.length === 0 && <Vacio titulo="Sin sell out en el período" sub="Las cuentas aún no reportan este mes." style={{ padding: '22px 16px' }} />}
      {s.cuentas.slice(0, 10).map((x) => (
        <Fila key={x.cuenta} titulo={x.nombre} sub={`${x.sellIn ? `sell in ${fmtM(x.sellIn)}` : 'sin sell in'}${x.soSi != null ? ` · SO/SI ${x.soSi.toFixed(2)}` : ''}${x.inv != null ? ` · inv. ${fmtM(x.inv)}` : ''}`}
          valor={fmtM(x.cur)} chevron={false} alto={50} pill={x.yoy != null ? { tone: tonoDelta(x.yoy), label: deltaPct(x.yoy) } : undefined} />
      ))}
    </ListaAgrupada>
  );
}

// ── Mix de sell in por canal · marca · categoría
function MixM({ r, periodoLbl }) {
  const { theme } = useTheme();
  const [dim, setDim] = useState('canal');
  const filas = (r.mixes[dim] || []).slice(0, 10);
  const max = Math.max(1, ...filas.map((x) => x.cur));
  const hayCuota = dim === 'canal' && filas.some((x) => x.cuota != null);
  return (
    <ListaAgrupada titulo={`Mix de sell in · ${periodoLbl}`} style={{ marginTop: 18 }}
      accion={<div style={{ display: 'flex', gap: 2, fontSize: 12, fontWeight: 500 }}>{[['canal', 'Canal'], ['marca', 'Marca'], ['categoria', 'Categoría']].map(([id, l]) => <button key={id} type="button" onClick={() => setDim(id)} style={{ border: 0, background: dim === id ? `${theme.accent}18` : 'transparent', color: dim === id ? theme.accent : theme.textMuted, borderRadius: 999, padding: '3px 9px', fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500 }}>{l}</button>)}</div>}>
      {filas.map((x) => (
        <div key={x.key} style={{ padding: '8px 16px', borderTop: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 500, color: theme.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dim === 'canal' ? canalLabel(x.key) : x.key}</span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtM(x.cur)} <span style={{ color: theme.textMuted, fontWeight: 500, fontSize: 11.5 }}>{x.share != null ? `${x.share.toFixed(0)}%` : ''}</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, height: 6, background: `${theme.text}10`, borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(x.cur / max) * 100}%`, background: hayCuota && x.pct != null ? (x.pct >= 100 ? theme.green : x.pct >= 85 ? theme.accent : x.pct >= 60 ? theme.orange : theme.red) : theme.accent, borderRadius: 999 }} /></div>
            <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: hayCuota && x.pct != null ? theme.text : x.yoy == null ? theme.textMuted : x.yoy >= 0 ? theme.green : theme.red, flexShrink: 0 }}>{hayCuota && x.pct != null ? `${Math.round(x.pct)}% cuota` : x.yoy != null ? `${deltaPct(x.yoy)} vs ${r.anio - 1}` : '—'}</span>
          </div>
        </div>
      ))}
    </ListaAgrupada>
  );
}

// ── Inventario comercial · qué llega y cuándo · camino del producto
function InventarioM({ r, onAbrir }) {
  const { theme } = useTheme();
  const inv = r.inv, ec = r.enCamino;
  const linea = (k, titulo, sub, valor, color) => <Fila key={k} titulo={titulo} sub={sub} valor={valor} chevron={false} alto={46} tono={color} />;
  return (
    <ListaAgrupada titulo="Inventario y en camino" style={{ marginTop: 18 }}
      accion={<button type="button" onClick={onAbrir} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, padding: 0, cursor: 'pointer' }}>Inventario ›</button>}>
      {linea('inv', 'Inventario comercial', `${Math.round(inv.piezas).toLocaleString('es-MX')} pz · ${inv.skus} SKUs con stock${inv.skusAgotados != null ? ` · ${inv.skusAgotados} agotados con demanda` : ''}`, fmtM(inv.valor), theme.accent)}
      {linea('dias', 'Días de inventario', 'al ritmo de los 3 meses cerrados', inv.cobertura != null ? `${inv.cobertura} d` : '—', inv.cobertura > 120 ? theme.orange : inv.cobertura < 30 ? theme.red : theme.green)}
      {ec.porMes.slice(0, 4).map((m) => linea(m.key, `Llega ${m.label}`, `${Math.round(m.piezas).toLocaleString('es-MX')} pz · ${m.pos} PO`, fmtM(m.valor), m.key === 'sin ETA' ? theme.textMuted : theme.teal || theme.accent))}
      {ec.atrasados.pos > 0 && linea('atr', 'PO con ETA vencida', 'revisar en Inventario › Próximos arribos', `${ec.atrasados.pos}`, theme.red)}
      {r.camino.map((m) => linea(m.key, m.label, `${Math.round(m.piezas).toLocaleString('es-MX')} pz · ${m.pos} PO`, fmtM(m.valor), theme.purple || theme.accent))}
    </ListaAgrupada>
  );
}
