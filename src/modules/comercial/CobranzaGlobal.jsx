// Cobranza general (2026-10-04) · la cartera de los tres clientes propios en una pantalla, con el kit V3.
// Hero (frase + 4 cifras) → KPIs por cliente (abren su Crédito y Cobranza) → aging consolidado (4 tramos, filtran la
// tabla) → serie de cortes (saldo y vencido) → facturas vencidas de todos + por vencer en 30 días. Datos en
// cobranza/datos.js, cálculo puro en cobranza/calculo.js. Permiso global `cobranza_global`.
import React, { useMemo, useRef, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal } from '../../lib/permisos';
import { money, moneyCompact as $c, int, pct, fechaCorta } from '../../lib/format';
import SinAcceso from '../../components/SinAcceso';
import FrescuraPill from '../../components/FrescuraPill';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Pill, Panel, Segmented, TablaCompacta, Cargando, GraficaLineas } from '../../components/kit';
import { useCobranzaGlobal } from './cobranza/datos';
import { TRAMOS, fraseCobranza } from './cobranza/calculo';

const signo = (v) => (v == null ? null : `${v >= 0 ? '+' : '−'}${$c(Math.abs(v))}`);

export default function CobranzaGlobal({ onNavegar }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const { data, isLoading, error } = useCobranzaGlobal(puedeVerPestanaGlobal(perfil, 'cobranza_global'));
  const [tramo, setTramo] = useState(null);
  const [cliente, setCliente] = useState('todos');
  const [vista, setVista] = useState('vencidas');

  const filas = useMemo(() => {
    if (!data) return [];
    const base = vista === 'vencidas' ? data.total.vencidas : data.total.porVencer;
    return base.filter((f) => (cliente === 'todos' || f.cliente === cliente) && (!tramo || vista !== 'vencidas' || (f.dias >= TRAMOS.find((t) => t.id === tramo).min && f.dias <= TRAMOS.find((t) => t.id === tramo).max)));
  }, [data, vista, cliente, tramo]);

  if (!puedeVerPestanaGlobal(perfil, 'cobranza_global')) return <SinAcceso motivo="No tienes acceso a Cobranza." />;
  if (isLoading || !data) return <Cargando pantalla="cobranzaGlobal" minHeight={520} />;
  if (error) return <Panel titulo="No se pudo cargar Cobranza"><div style={{ fontSize: 12, color: theme.red }}>{String(error.message || error)}</div></Panel>;
  const t = data.total, cls = data.clientes;
  const ir = (ck) => (onNavegar ? () => onNavegar(ck, 'cartera') : undefined);
  const excel = () => ({
    nombre: `Cobranza_${t.corte || 'sin-corte'}.xlsx`,
    hojas: [
      { nombre: 'Clientes', columnas: [{ label: 'Cliente', key: 'nombre' }, { label: 'Corte', key: 'corte' }, { label: 'Saldo', key: 'saldo', tipo: 'moneda' }, { label: 'Vencido', key: 'vencido', tipo: 'moneda' }, { label: '% vencido', key: 'pctVencido', tipo: 'pct' }, { label: 'DSO', key: 'dso' }, { label: 'Línea MXN', key: 'lineaMxn', tipo: 'moneda' }, { label: 'Vence 30 d', key: 'porVencer30', tipo: 'moneda' }], filas: cls },
      { nombre: 'Facturas vencidas', columnas: [{ label: 'Cliente', key: 'cliente' }, { label: 'Referencia', key: 'referencia' }, { label: 'Emisión', key: 'fecha_emision' }, { label: 'Vencimiento', key: 'vencimiento' }, { label: 'Días', key: 'dias' }, { label: 'Saldo', key: 'saldo', tipo: 'moneda' }], filas: t.vencidas },
    ],
  });

  return (
    <div ref={rootRef} data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ExportMenu titulo="Cobranza" subtitulo={t.corte ? `corte ${fechaCorta(t.corte)}` : ''} excel={excel} pdf={{ ref: rootRef }} /></div>
      <Hero eyebrow={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Cobranza · {t.corte ? `corte ${fechaCorta(t.corte)}` : 'sin corte'}<span style={{ textTransform: 'none', letterSpacing: 0 }}><FrescuraPill fuentes={['estados_cuenta']} inverso /></span></span>}
        titulo={fraseCobranza(t, $c)} sub={`${cls.filter((c) => !c.sinDatos).length} clientes con estado de cuenta · ${int(t.nVencidas)} facturas vencidas · ${$c(t.porVencer30)} por vencer en 30 días`}
        stats={[
          { k: 'Cartera total', v: $c(t.saldo), sub: t.dSaldo != null ? `${signo(t.dSaldo)} vs corte anterior` : '' },
          { k: 'Vencido', v: $c(t.vencido), sub: `${Math.round(t.pctVencido)} % de la cartera${t.dVencido != null ? ` · ${signo(t.dVencido)}` : ''}`, color: t.vencido > 0 ? '#FF6961' : undefined },
          { k: 'DSO', v: t.dso != null ? `${t.dso} d` : '—', sub: 'edad ponderada por saldo' },
          { k: 'Vence en 7 días', v: $c(t.porVencer7), sub: `${$c(t.porVencer30)} en 30 días` },
        ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
        {cls.map((c) => (
          <KpiCard key={c.key} eyebrow={`${c.nombre}${c.corte ? ` · ${fechaCorta(c.corte)}` : ''}`} big={c.sinDatos ? '—' : $c(c.saldo)} bigColor={c.pctVencido > 25 ? theme.red : undefined}
            badge={c.sinDatos ? { l: 'sin estado de cuenta', tone: 'gray' } : c.vencido > 0 ? { l: `${$c(c.vencido)} vencido · ${Math.round(c.pctVencido)}%`, tone: c.pctVencido > 15 ? 'red' : 'orange' } : { l: 'al corriente', tone: 'green' }}
            progress={c.usoLinea ?? undefined}
            sub={c.sinDatos ? 'carga el estado de cuenta en el importador' : [c.dso != null ? `DSO ${c.dso} d (plazo ${c.plazo})` : null, c.lineaMxn ? `línea ${$c(c.lineaMxn)} · ${Math.round(c.usoLinea)} % usada` : 'sin línea cargada', c.porVencer7 > 0 ? `${$c(c.porVencer7)} vencen en 7 d` : null].filter(Boolean).join(' · ')}
            onClick={c.sinDatos ? undefined : ir(c.key)} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        {TRAMOS.map((tr) => { const b = t.aging[tr.id]; const on = tramo === tr.id; return (
          <KpiCard key={tr.id} eyebrow={`Vencido ${tr.label}`} big={$c(b.monto)} bigSmall={`${int(b.n)} fact.`} badge={{ l: t.vencido > 0 ? `${Math.round((b.monto / t.vencido) * 100)} % del vencido` : '—', tone: b.monto > 0 ? tr.tone : 'gray' }}
            progress={t.vencido > 0 ? (b.monto / t.vencido) * 100 : 0} sub={on ? 'filtrando la tabla · toca para quitar' : 'toca para filtrar la tabla'} onClick={() => { setTramo(on ? null : tr.id); setVista('vencidas'); }} style={on ? { outline: `2px solid ${theme.accent}` } : undefined} />
        ); })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 10, alignItems: 'start' }}>
        <Panel titulo="Cartera por corte" meta={`${t.serie.length} cortes · saldo y vencido de los tres clientes`} padding="6px 8px 4px">
          <GraficaLineas datos={t.serie.map((p) => ({ x: fechaCorta(p.fecha), saldo: p.saldo, vencido: p.vencido }))} formato={$c} alto={220}
            series={[{ key: 'saldo', label: 'Cartera', tipo: 'principal' }, { key: 'vencido', label: 'Vencido', tipo: 'linea', color: theme.red }]} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, padding: '8px 4px 4px' }}>
            {cls.filter((c) => !c.sinDatos).map((c) => (
              <div key={c.key} style={{ fontSize: 11 }}><div style={{ color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.nombre}</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{$c(c.saldo)} <span style={{ color: c.vencido > 0 ? theme.red : theme.green, fontWeight: 500 }}>{c.vencido > 0 ? `${$c(c.vencido)} venc.` : 'al día'}</span></div>
                <div style={{ color: theme.textMuted }}>{c.dSaldo != null ? `${signo(c.dSaldo)} vs anterior` : ''}</div></div>
            ))}
          </div>
        </Panel>
        <Panel titulo={vista === 'vencidas' ? 'Facturas vencidas' : 'Por vencer en 30 días'} meta={`${filas.length} facturas · ${$c(filas.reduce((s, f) => s + f.saldo, 0))}${tramo && vista === 'vencidas' ? ` · ${TRAMOS.find((x) => x.id === tramo).label}` : ''}`} padding="0 0 2px"
          acciones={<div style={{ display: 'flex', gap: 8 }}><Segmented size="sm" value={vista} onChange={setVista} options={[{ id: 'vencidas', label: 'Vencidas', badge: t.nVencidas || undefined }, { id: 'porVencer', label: 'Por vencer' }]} />
            <Segmented size="sm" value={cliente} onChange={setCliente} options={[{ id: 'todos', label: 'Todos' }, ...cls.filter((c) => !c.sinDatos).map((c) => ({ id: c.key, label: c.nombre }))]} /></div>}>
          <TablaCompacta dense maxHeight={420} rowKey={(f) => `${f.cliente}-${f.referencia}-${f.fecha_emision}`} filas={filas} vacio={vista === 'vencidas' ? 'Sin facturas vencidas. 🎉' : 'Nada vence en los próximos 30 días.'}
            columnas={[
              { key: 'cliente', label: 'Cliente', align: 'left', width: 84, render: (f) => <Pill size="xs" tone="gray">{cls.find((c) => c.key === f.cliente)?.nombre || f.cliente}</Pill> },
              { key: 'referencia', label: 'Factura', align: 'left', mono: true, width: 110, render: (f) => f.referencia || f.movimiento || '—' },
              { key: 'fecha_emision', label: 'Emisión', width: 90, render: (f) => fechaCorta(f.fecha_emision) },
              { key: 'vencimiento', label: 'Vencimiento', width: 96, render: (f) => fechaCorta(f.vencimiento) },
              vista === 'vencidas'
                ? { key: 'dias', label: 'Días', width: 60, render: (f) => <span style={{ color: f.dias > 90 ? theme.red : f.dias > 30 ? theme.orange : theme.text, fontWeight: 600 }}>{int(f.dias)}</span> }
                : { key: 'paraVencer', label: 'Faltan', width: 60, render: (f) => `${int(f.paraVencer)} d` },
              { key: 'importe_factura', label: 'Factura', width: 90, render: (f) => money(f.importe_factura) },
              { key: 'saldo', label: 'Saldo', width: 96, bold: true, render: (f) => money(f.saldo) },
            ]} />
        </Panel>
      </div>
      <p style={{ fontSize: 10.5, color: theme.textSubtle, padding: '0 6px' }}>Estados de cuenta semanales del importador (grupo de cada cliente). Días de atraso contados a la fecha del corte; DSO = edad promedio de las facturas abiertas ponderada por saldo. La línea de crédito en MXN sale del pagaré o de la línea en USD al tipo de cambio del corte.</p>
    </div>
  );
}
