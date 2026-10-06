// Cobranza general · celular (3.86.0 · 2026-10-06, mockup f2336912 pantalla 2; antes 2026-10-04). Mismo cálculo que la
// web (cobranza/calculo.js · datos.js). Formato estándar: TituloGrande + FrescuraPill → HeroM del corte → 4 KpiM (Saldo ·
// Vencido · DSO · Vence esta semana) → aging tocable (filtra las facturas) → saldo y vencido por corte en línea → «Quién
// debe» por cliente (tocar abre su ficha en Cobranza) → facturas vencidas / por vencer → Compartir resumen.
// Hoy la base sólo tiene cartera de los tres propios (estados_cuenta); la de todo el ERP necesita una vista por el puente.
import React, { useMemo, useState } from 'react';
import { HandCoins, Share2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Skeleton, Vacio, Segmented, Pill, GraficaScrub, LeyendaScrub, TituloSeccionM, BotonGrande, toast } from '../../piezas';
import { moneyCompact, money, int, fechaCorta } from '../../util';
import FrescuraPill from '../../../components/FrescuraPill';
import { compartir } from '../../../lib/whatsapp';
import { useCobranzaGlobal } from '../../../modules/comercial/cobranza/datos';
import { TRAMOS, fraseCobranza } from '../../../modules/comercial/cobranza/calculo';
import ClientePropioM from '../cliente/ClientePropioM';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaMes = (iso) => { if (!iso) return ''; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES[d.getMonth()]}`; };

export function textoCobranza(t, cls) {
  return [`*Acteck · Cobranza · corte ${diaMes(t.corte)}*`, `Cartera ${moneyCompact(t.saldo)} · vencido ${moneyCompact(t.vencido)} (${Math.round(t.pctVencido)} %)${t.dso != null ? ` · DSO ${t.dso} d` : ''}`, `Vence en 7 días: ${moneyCompact(t.porVencer7)}`, '', ...cls.filter((c) => !c.sinDatos).map((c) => `• ${c.nombre}: ${moneyCompact(c.saldo)}${c.vencido > 0 ? ` · vencido ${moneyCompact(c.vencido)}` : ' · al corriente'}`)].join('\n');
}

/** Vista pura (SSR). */
export function CobranzaGlobalVista({ t, cls = [], vista = 'vencidas', onVista, tramo = null, onTramo, onCliente, onCompartir }) {
  const { theme } = useTheme();
  const [verTodo, setVerTodo] = useState(false);
  const base = vista === 'vencidas' ? t.vencidas : t.porVencer;
  const lista = useMemo(() => (tramo && vista === 'vencidas' ? base.filter((f) => { const tr = TRAMOS.find((x) => x.id === tramo); return tr && f.dias >= tr.min && f.dias <= tr.max; }) : base), [base, tramo, vista]);
  const conVencido = cls.filter((c) => !c.sinDatos && c.vencido > 0).length;
  const serie = (t.serie || []).map((p) => ({ id: p.fecha, label: diaMes(p.fecha), saldo: p.saldo, vencido: p.vencido }));
  const nombreDe = (k) => cls.find((c) => c.key === k)?.nombre || k;
  return (
    <>
      <HeroM eyebrow={t.corte ? `Corte ${diaMes(t.corte)} · ${cls.filter((c) => !c.sinDatos).length} clientes` : 'Sin corte'} frase={fraseCobranza(t, moneyCompact)}
        sub={[`${int(t.nVencidas)} factura${t.nVencidas === 1 ? '' : 's'} vencida${t.nVencidas === 1 ? '' : 's'} en ${conVencido} cliente${conVencido === 1 ? '' : 's'}`, t.dVencido != null && t.dVencido !== 0 ? `vencido ${t.dVencido > 0 ? 'subió' : 'bajó'} ${moneyCompact(Math.abs(t.dVencido))} vs el corte anterior` : null].filter(Boolean).join(' · ')} />
      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow="Saldo" big={moneyCompact(t.saldo)} sub={`${cls.filter((c) => !c.sinDatos).length} clientes · ${int(cls.reduce((s, c) => s + (c.nFacturas || 0), 0))} facturas`} />
        <KpiM eyebrow="Vencido" big={moneyCompact(t.vencido)} bigColor={t.vencido > 0 ? theme.red : theme.green} sub={t.vencido > 0 ? `${Math.round(t.pctVencido)} % · ${conVencido} cliente${conVencido === 1 ? '' : 's'}` : 'todo al corriente'} />
        <KpiM eyebrow="DSO" big={t.dso != null ? `${t.dso} d` : '—'} bigColor={t.dso != null ? (t.dso <= 45 ? theme.green : t.dso <= 60 ? theme.orange : theme.red) : undefined} sub={t.dso != null ? `meta 45 d · ${t.dso <= 45 ? 'en meta' : 'arriba'}` : 'sin dato'} />
        <KpiM eyebrow="Vence esta semana" big={moneyCompact(t.porVencer7)} sub={`${moneyCompact(t.porVencer30)} en 30 días`} onClick={() => onVista?.('porVencer')} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="toca un tramo para filtrar">Aging del vencido</TituloSeccionM>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6, padding: '0 16px' }}>
        {TRAMOS.map((tr) => { const b = t.aging[tr.id]; const on = tramo === tr.id; return (
          <button key={tr.id} type="button" onClick={() => { onTramo?.(on ? null : tr.id); onVista?.('vencidas'); }} style={{ background: on ? theme.text : theme.surface, color: on ? theme.surface : theme.text, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 4px', textAlign: 'center', cursor: 'pointer', fontFamily: TYPO.fontText }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: on ? theme.surface : b.monto > 0 ? (tr.id === 'mas90' || tr.id === 'd61_90' ? theme.red : tr.id === 'd31_60' ? theme.orange : theme.text) : theme.textMuted }}>{b.monto > 0 ? moneyCompact(b.monto) : '—'}</div>
            <div style={{ fontSize: 10, color: on ? theme.surface : theme.textMuted }}>{tr.label.replace(' días', ' d')}{b.n ? ` · ${b.n}` : ''}</div>
          </button>); })}
      </div>

      {serie.length > 1 && (
        <>
          <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">Saldo y vencido por corte</TituloSeccionM>
          <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
            <GraficaScrub datos={serie} formato={moneyCompact} series={[{ key: 'saldo', label: 'Saldo', color: theme.accent, area: true, grosor: 2.4 }, { key: 'vencido', label: 'Vencido', color: theme.red }]}
              tooltip={(d) => <><b style={{ fontSize: 12.5 }}>{d.label}</b> · saldo <b style={{ fontSize: 12.5 }}>{moneyCompact(d.saldo)}</b> · vencido {moneyCompact(d.vencido)}</>} etiqueta={(f, k) => (k % 2 === 0 || k === serie.length - 1 ? String(f.label).split(' ')[0] : '')} />
            <LeyendaScrub items={[{ label: 'Saldo', color: theme.accent }, { label: 'Vencido', color: theme.red }]} />
          </div>
        </>
      )}

      <ListaAgrupada titulo="Quién debe" meta={`${cls.filter((c) => !c.sinDatos).length} · por saldo`} style={{ marginTop: 18 }} pie="Toca un cliente para abrir su cartera: aging, facturas, historial de cortes y compartir su estado de cuenta.">
        {[...cls].sort((a, b) => (b.saldo || 0) - (a.saldo || 0)).map((c) => (
          <Fila key={c.key} titulo={c.nombre} sub={c.sinDatos ? 'sin estado de cuenta' : [c.dso != null ? `DSO ${c.dso} d` : null, c.porVencer7 > 0 ? `vence esta semana ${moneyCompact(c.porVencer7)}` : null, c.usoLinea != null ? `línea al ${Math.round(c.usoLinea)} %` : null].filter(Boolean).join(' · ')}
            valor={c.sinDatos ? '—' : moneyCompact(c.saldo)} pill={c.sinDatos ? undefined : c.vencido > 0 ? { tone: c.pctVencido > 15 ? 'red' : 'orange', label: `vencido ${moneyCompact(c.vencido)}` } : { tone: 'green', label: 'al corriente' }} onClick={c.sinDatos ? undefined : () => onCliente?.(c)} />
        ))}
      </ListaAgrupada>

      <ListaAgrupada titulo={vista === 'vencidas' ? 'Facturas vencidas' : 'Por vencer en 30 días'} meta={`${lista.length}${tramo && vista === 'vencidas' ? ` · ${TRAMOS.find((x) => x.id === tramo)?.label}` : ''}`} style={{ marginTop: 18 }}
        accion={<Segmented size="sm" value={vista} onChange={(v) => { onVista?.(v); setVerTodo(false); }} options={[{ id: 'vencidas', label: 'Vencidas' }, { id: 'porVencer', label: 'Por vencer' }]} />}
        pie="Días contados a la fecha del corte.">
        {lista.length === 0 && <Vacio icon={null} titulo={vista === 'vencidas' ? 'Sin facturas vencidas' : 'Nada vence en 30 días'} style={{ padding: '18px 16px' }} />}
        {(verTodo ? lista : lista.slice(0, 15)).map((f) => (
          <Fila key={`${f.cliente}-${f.referencia}-${f.fecha_emision}`} titulo={f.referencia || f.movimiento || '—'} sub={`${nombreDe(f.cliente)} · emisión ${fechaCorta(f.fecha_emision)} · vence ${fechaCorta(f.vencimiento)}`}
            valor={money(f.saldo)} chevron={false} alto={50} pill={vista === 'vencidas' ? { tone: f.dias > 90 ? 'red' : f.dias > 30 ? 'orange' : 'yellow', label: `${int(f.dias)} d` } : { tone: 'blue', label: `${int(f.paraVencer)} d` }} />
        ))}
        {lista.length > 15 && !verTodo && <Fila titulo={`Ver las ${lista.length}`} chevron onClick={() => setVerTodo(true)} alto={44} />}
      </ListaAgrupada>
      {onCompartir && <div style={{ margin: '18px 16px 0' }}><BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir resumen</BotonGrande></div>}
    </>
  );
}

export default function CobranzaGlobalM() {
  const { theme } = useTheme();
  const nav = useNav();
  const { data, isLoading, error } = useCobranzaGlobal();
  const [vista, setVista] = useState('vencidas');
  const [tramo, setTramo] = useState(null);
  const sub = <><span>Clientes propios · sólo ellos reportan estado de cuenta</span><span>·</span><FrescuraPill fuentes={['estados_cuenta']} detallado /></>;
  if (error) return (<><TituloGrande titulo="Cobranza" sub={sub} /><Vacio icon={HandCoins} color={theme.red} titulo="No se pudo cargar" sub={String(error.message || error)} /></>);
  if (isLoading || !data) return (<><TituloGrande titulo="Cobranza" sub={sub} /><div style={{ padding: '0 16px', display: 'grid', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={84} r={12} /><Skeleton h={200} r={12} /></div></>);
  return (
    <div style={{ paddingBottom: 24 }}>
      <TituloGrande titulo="Cobranza" sub={sub} />
      <CobranzaGlobalVista t={data.total} cls={data.clientes} vista={vista} onVista={setVista} tramo={tramo} onTramo={setTramo}
        onCliente={(c) => nav.push(<ClientePropioM clienteKey={c.key} pestanaInicial="cobranza" />, `cliente-${c.key}`, `${c.key}:cartera`)}
        onCompartir={async () => { const r = await compartir(textoCobranza(data.total, data.clientes), { titulo: 'Cobranza' }); if (r === 'share') toast.ok('Compartido'); else if (r) toast.ok('Texto copiado'); }} />
    </div>
  );
}
