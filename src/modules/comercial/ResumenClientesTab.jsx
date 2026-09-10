import React, { useMemo, useState } from 'react';
import { Check, Clock, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { useAlertas, resolverAlerta, posponerAlerta, ejecutarAccion, SEV_LABEL, NOMBRE_CLIENTE } from '../../lib/alertas';
import { supabase } from '../../lib/supabase';
import { Hero, KpiCard, Cargando, toast } from '../../components/kit';
import { useResumenData, useMedidasSensibles } from './resumen/datos';
import {
  CLIENTES, CLIENTE_KEYS, opcionesPeriodo, periodoId, esPeriodoActual, labelPeriodo, hoy,
  calcularResumen, calcularConsolidado, calcularShareEmpresa, calcularMargen,
} from './resumen/calculo';
import { fmtCompact, fmtInt, fmtPct, narrativaHero } from './resumen/textos';
import Tendencia from './resumen/Tendencia';
import TarjetaCliente from './resumen/TarjetaCliente';

/**
 * Resumen Clientes V3 — Bento editorial con el kit
 * ─────────────────────────────────────────────
 * - Hero (kit) con facturación consolidada del mes elegido · 4 KpiCard (Cuota · Cobranza · Sell-Out · Cobertura)
 * - Selector de mes (últimos 12): todos los bloques respetan el periodo
 * - Alertas de la central (tabla `alertas`) filtradas a los 3 clientes, con resolver/posponer
 * - Tendencia 12 meses en Recharts · 3 TarjetaCliente con narrativa y doble cuota
 * Datos: resumen/datos.js · cálculo: resumen/calculo.js · textos: resumen/textos.js
 */

const SET_MIOS = new Set(CLIENTE_KEYS);
const SALIDA_MS = 160;

export default function ResumenClientesTab({ onDrillDown }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const verSensible = puedeVerSensible(perfil);
  const data = useResumenData();
  const medidas = useMedidasSensibles(verSensible && !data.loading);
  const opciones = useMemo(() => opcionesPeriodo(12), []);
  const [periodo, setPeriodo] = useState(opciones[0]);

  const resumenes = useMemo(() => {
    if (data.loading) return [];
    return CLIENTES.map((c) => ({ cliente: c, resumen: calcularResumen(c.key, data, periodo) }));
  }, [data, periodo]);
  const consolidado = useMemo(() => calcularConsolidado(resumenes), [resumenes]);
  const share = useMemo(() => (data.loading ? {} : calcularShareEmpresa(data, periodo)), [data, periodo]);
  const margenes = useMemo(() => Object.fromEntries(CLIENTES.map((c) => [c.key, calcularMargen(medidas, c.key, periodo)])), [medidas, periodo]);

  // Navegación: Home del cliente vía onDrillDown; otras pestañas vía el evento global que atiende App.jsx.
  const navegar = (clienteKey, pagina) => {
    if (!pagina || pagina === 'home') { if (clienteKey) onDrillDown?.(clienteKey); return; }
    window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { clienteKey: clienteKey || null, pagina } }));
  };

  if (!puedeVerPestanaGlobal(perfil, 'resumen_clientes')) {
    return <SinAcceso motivo="No tienes acceso al Resumen de Clientes." />;
  }
  if (data.loading) return <Cargando pantalla="resumenClientes" />;

  const green = theme.green || '#34C759', orange = theme.orange || '#FF9500', red = theme.red || '#FF3B30';
  const colCumpl = (c) => (c == null ? undefined : c >= 90 ? green : c >= 80 ? orange : red);
  const actual = esPeriodoActual(periodo);

  return (
    <div data-stagger style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>

      {/* Header + selector de mes */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 4px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontWeight: 500 }}>
            Dirección Comercial · Portafolio propio
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
            Resumen de Clientes.
          </h2>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>
            <strong style={{ color: theme.text, fontWeight: 500 }}>{CLIENTES.length} clientes activos</strong> · {actual ? `al ${hoy.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}` : `cierre de ${labelPeriodo(periodo)}`}
          </p>
        </div>
        <SelectorMes theme={theme} opciones={opciones} value={periodo} onChange={setPeriodo} />
      </div>

      {/* Bento: hero + 4 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)', gridTemplateRows: 'auto auto', gap: 8 }}>
        <Hero
          style={{ gridColumn: 1, gridRow: '1 / span 2', alignContent: 'center' }}
          eyebrow={`Facturación consolidada · ${labelPeriodo(periodo)}`}
          titulo={`${fmtCompact(consolidado.siMes)} facturados${consolidado.siYoY != null ? ` · ${consolidado.siYoY >= 0 ? '+' : ''}${consolidado.siYoY.toFixed(0)}% vs ${periodo.anio - 1}` : ''}`}
          sub={narrativaHero(consolidado, resumenes, periodo)}
          dot={consolidado.cumplIdeal != null && consolidado.cumplIdeal < 80}
          stats={[
            { k: 'YTD acumulado', v: fmtCompact(consolidado.siYTD), sub: `${periodo.anio} a ${labelPeriodo(periodo).split(' ')[0]}` },
            ...(consolidado.cumplYTDIdeal != null ? [{ k: 'Cuota YTD', v: fmtPct(consolidado.cumplYTDIdeal), sub: consolidado.algunaDoble && consolidado.cumplYTDMin != null ? `${fmtPct(consolidado.cumplYTDMin)} de la mínima` : 'de la ideal', color: colCumpl(consolidado.cumplYTDIdeal) }] : []),
            ...(share.shareMes != null ? [{ k: 'Share vs empresa', v: fmtPct(share.shareMes), sub: share.shareYTD != null ? `YTD ${fmtPct(share.shareYTD)}` : null }] : []),
          ]}
        />
        <KpiCard eyebrow="Cuota del mes" badge={{ l: consolidado.algunaDoble ? 'ideal' : 'meta', tone: 'gray' }}
          big={fmtPct(consolidado.cumplIdeal)} bigColor={colCumpl(consolidado.cumplIdeal)}
          sub={<><strong style={{ color: theme.text }}>{fmtCompact(consolidado.siMes)}</strong> / {fmtCompact(consolidado.cuotaIdeal)}{consolidado.algunaDoble && consolidado.cumplMin != null && <> · {fmtPct(consolidado.cumplMin)} de la mínima</>}</>}
          progress={consolidado.cumplIdeal ?? undefined} progressSecondary={consolidado.algunaDoble && consolidado.cumplMin != null ? Math.min(100, consolidado.cumplMin) : undefined} />
        <KpiCard eyebrow="Cobranza" badge={consolidado.saldoVencido > 0 ? { l: `${fmtPct(consolidado.pctVencido, 1)} vencido`, tone: consolidado.pctVencido > 15 ? 'red' : 'orange' } : { l: 'al día', tone: 'green' }}
          big={fmtCompact(consolidado.saldoVencido)} bigColor={consolidado.saldoVencido > 100000 ? red : theme.text}
          sub={<><strong style={{ color: theme.text }}>{fmtInt(consolidado.facturasAbiertas)} facturas</strong> abiertas · saldo {fmtCompact(consolidado.saldoActual)}</>} />
        <KpiCard eyebrow="Sell Out del mes" badge={consolidado.soYoY != null ? { l: `${consolidado.soYoY >= 0 ? '↑' : '↓'} ${Math.abs(consolidado.soYoY).toFixed(0)}% YoY`, tone: consolidado.soYoY >= 0 ? 'green' : 'red' } : null}
          big={fmtCompact(consolidado.soMes)}
          sub={consolidado.siMes > 0 && consolidado.soMes > 0 ? <><strong style={{ color: theme.text }}>{fmtPct((consolidado.soMes / consolidado.siMes) * 100)}</strong> del sell in mensual</> : 'Sin sell out registrado aún'} />
        <KpiCard eyebrow="Cobertura" big={consolidado.coberturaProm != null ? `${consolidado.coberturaProm}d` : '—'}
          bigColor={consolidado.coberturaProm == null ? theme.text : consolidado.coberturaProm < 30 ? red : theme.text}
          sub={<>Promedio de <strong style={{ color: theme.text }}>{consolidado.coberturaN} clientes</strong> · inventario {fmtCompact(consolidado.inventarioValor)}</>} />
      </div>

      {/* Alertas de la central */}
      <AlertasClientes theme={theme} onNavegar={navegar} email={perfil?.email} />

      {/* Tendencia */}
      <Tendencia data={data} periodo={periodo} />

      {/* Tarjetas por cliente */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {resumenes.map(({ cliente, resumen }) => (
          <TarjetaCliente key={cliente.key} cliente={cliente} resumen={resumen}
            margen={margenes[cliente.key]} verSensible={verSensible}
            onDrillDown={() => onDrillDown?.(cliente.key)} onNavegar={navegar} />
        ))}
      </div>
    </div>
  );
}

// ────────── Selector de mes (últimos 12) ──────────
function SelectorMes({ theme, opciones, value, onChange }) {
  const dark = theme.mode === 'dark';
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Mes
      <select value={periodoId(value)} onChange={(e) => onChange(opciones.find((o) => periodoId(o) === e.target.value) || opciones[0])}
        style={{
          appearance: 'none', WebkitAppearance: 'none', height: 30, padding: '0 28px 0 12px', borderRadius: 9, border: `1px solid ${theme.border}`,
          background: `${dark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)'} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/></svg>") no-repeat right 10px center`,
          color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', textTransform: 'none', cursor: 'pointer',
        }}>
        {opciones.map((o, i) => <option key={periodoId(o)} value={periodoId(o)}>{labelPeriodo(o)}{i === 0 ? ' · actual' : ''}</option>)}
      </select>
    </label>
  );
}

// ────────── Alertas de los 3 clientes (central `alertas`) ──────────
function AlertasClientes({ theme, onNavegar, email }) {
  const { data: todas = [], isLoading } = useAlertas({ clienteKey: null });
  const [saliendo, setSaliendo] = useState(() => new Set());
  const [ocultas, setOcultas] = useState(() => new Set());
  const alertas = useMemo(() => todas.filter((a) => SET_MIOS.has(a.cliente_key) && !ocultas.has(a.id)), [todas, ocultas]);
  if (isLoading || alertas.length === 0) return null;

  const colorSev = (s) => ({ critica: theme.red || '#FF3B30', alta: theme.orange || '#FF9500', media: theme.yellow || '#FFCC00', info: theme.accent || '#007AFF' })[s] || theme.textMuted;
  const emailActual = async () => { if (email) return email; try { const { data } = await supabase.auth.getUser(); return data?.user?.email || 'usuario'; } catch { return 'usuario'; } };
  const salir = (id, accion, msg) => {
    setSaliendo((s) => new Set(s).add(id));
    setTimeout(async () => {
      setOcultas((s) => new Set(s).add(id));
      setSaliendo((s) => { const n = new Set(s); n.delete(id); return n; });
      try { await accion(); toast.ok(msg); }
      catch (e) { console.error('alertas:', e); toast.error('No se pudo actualizar la alerta'); setOcultas((s) => { const n = new Set(s); n.delete(id); return n; }); }
    }, SALIDA_MS);
  };
  const resolver = (a) => salir(a.id, async () => resolverAlerta(a.id, await emailActual()), 'Alerta resuelta');
  const posponer = (a) => salir(a.id, () => posponerAlerta(a.id, 3), 'Pospuesta 3 días');
  const btn = (title, color, onClick, Icon) => (
    <button type="button" onClick={onClick} title={title}
      style={{ width: 22, height: 22, borderRadius: 999, border: 0, background: 'transparent', color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, opacity: 0.75 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.04)'; e.currentTarget.style.opacity = 1; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = 0.75; }}>
      <Icon size={12} strokeWidth={2.2} />
    </button>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 2px' }}>
      {alertas.map((a) => {
        const col = colorSev(a.severidad);
        const sale = saliendo.has(a.id);
        return (
          <div key={a.id} title={`${SEV_LABEL[a.severidad] || ''}${a.detalle ? ` · ${a.detalle}` : ''}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 4px 3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
              background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text,
              opacity: sale ? 0 : 1, transform: sale ? 'translateX(8px)' : 'none', transition: `opacity ${SALIDA_MS}ms ease, transform ${SALIDA_MS}ms ease`,
            }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: col, flexShrink: 0 }} />
            <button type="button" onClick={() => ejecutarAccion(a, onNavegar)}
              style={{ border: 0, background: 'transparent', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <strong style={{ fontWeight: 600 }}>{NOMBRE_CLIENTE[a.cliente_key] || a.cliente_key}:</strong> {a.titulo}
              <ArrowUpRight size={11} style={{ color: theme.textSubtle || theme.textMuted }} />
            </button>
            <span style={{ width: 1, height: 14, background: theme.border, margin: '0 2px' }} />
            {btn('Posponer 3 días', theme.textMuted, () => posponer(a), Clock)}
            {btn('Resolver', theme.green || '#34C759', () => resolver(a), Check)}
          </div>
        );
      })}
    </div>
  );
}
