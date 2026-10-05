// Cobranza general · celular (2026-10-04). Mismo cálculo que la web (cobranza/calculo.js · datos.js).
import React, { useMemo, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Skeleton, Vacio, Segmented, Pill } from '../../piezas';
import { moneyCompact, money, int, fechaCorta } from '../../util';
import FrescuraPill from '../../../components/FrescuraPill';
import { useCobranzaGlobal } from '../../../modules/comercial/cobranza/datos';
import { TRAMOS, fraseCobranza } from '../../../modules/comercial/cobranza/calculo';
import CobranzaCliente from '../CobranzaCliente';

export default function CobranzaGlobalM() {
  const { theme } = useTheme();
  const nav = useNav();
  const { data, isLoading, error } = useCobranzaGlobal();
  const [vista, setVista] = useState('vencidas');
  const [verTodo, setVerTodo] = useState(false);
  const lista = useMemo(() => (!data ? [] : (vista === 'vencidas' ? data.total.vencidas : data.total.porVencer)), [data, vista]);
  const sub = <><span>Los tres clientes</span><span>·</span><FrescuraPill fuentes={['estados_cuenta']} detallado /></>;
  if (error) return (<><TituloGrande titulo="Cobranza" sub={sub} /><Vacio icon={HandCoins} color={theme.red} titulo="No se pudo cargar" sub={String(error.message || error)} /></>);
  if (isLoading || !data) return (<><TituloGrande titulo="Cobranza" sub={sub} /><div style={{ padding: '0 16px', display: 'grid', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={84} r={12} /><Skeleton h={200} r={12} /></div></>);
  const t = data.total, cls = data.clientes;
  const abrir = (c) => nav.push(<CobranzaCliente clienteKey={c.key} nombre={c.nombre} />, `cobranza-${c.key}`, `${c.key}:cartera`);
  return (
    <>
      <TituloGrande titulo="Cobranza" sub={sub} />
      <HeroM eyebrow={`Cartera · ${t.corte ? `corte ${fechaCorta(t.corte)}` : 'sin corte'}`} frase={fraseCobranza(t, moneyCompact)}
        sub={`${int(t.nVencidas)} facturas vencidas · ${moneyCompact(t.porVencer30)} por vencer en 30 días`}
        stats={[{ k: 'Cartera', v: moneyCompact(t.saldo) }, { k: 'Vencido', v: moneyCompact(t.vencido), sub: `${Math.round(t.pctVencido)} %`, color: t.vencido > 0 ? '#FF6961' : undefined }, { k: 'DSO', v: t.dso != null ? `${t.dso} d` : '—' }]} />
      <KpiGrid style={{ marginTop: 12 }}>
        {cls.map((c) => <KpiM key={c.key} eyebrow={c.nombre} big={c.sinDatos ? '—' : moneyCompact(c.saldo)} sub={c.sinDatos ? 'sin estado de cuenta' : `${c.vencido > 0 ? `${moneyCompact(c.vencido)} vencido` : 'al corriente'}${c.dso != null ? ` · DSO ${c.dso} d` : ''}`} progress={c.usoLinea ?? undefined}
          pill={c.sinDatos ? undefined : c.vencido > 0 ? { tone: c.pctVencido > 15 ? 'red' : 'orange', label: `${Math.round(c.pctVencido)} %` } : { tone: 'green', label: 'al día' }} onClick={c.sinDatos ? undefined : () => abrir(c)} />)}
        <KpiM eyebrow="Vence en 7 días" big={moneyCompact(t.porVencer7)} sub={`${moneyCompact(t.porVencer30)} en 30 días`} />
      </KpiGrid>
      <ListaAgrupada titulo="Aging del vencido" style={{ marginTop: 18 }}>
        {TRAMOS.map((tr) => { const b = t.aging[tr.id]; return <Fila key={tr.id} titulo={tr.label} sub={`${int(b.n)} facturas`} valor={moneyCompact(b.monto)} chevron={false} alto={46} pill={t.vencido > 0 && b.monto > 0 ? { tone: tr.tone, label: `${Math.round((b.monto / t.vencido) * 100)} %` } : undefined} />; })}
      </ListaAgrupada>
      <ListaAgrupada titulo={vista === 'vencidas' ? 'Facturas vencidas' : 'Por vencer en 30 días'} meta={`${lista.length}`} style={{ marginTop: 18 }}
        accion={<Segmented size="sm" value={vista} onChange={(v) => { setVista(v); setVerTodo(false); }} options={[{ id: 'vencidas', label: 'Vencidas' }, { id: 'porVencer', label: 'Por vencer' }]} />}
        pie={lista.length > 15 && !verTodo ? undefined : 'Días contados a la fecha del corte.'}>
        {lista.length === 0 && <Vacio icon={null} titulo={vista === 'vencidas' ? 'Sin facturas vencidas' : 'Nada vence en 30 días'} style={{ padding: '18px 16px' }} />}
        {(verTodo ? lista : lista.slice(0, 15)).map((f) => (
          <Fila key={`${f.cliente}-${f.referencia}-${f.fecha_emision}`} titulo={f.referencia || f.movimiento || '—'} sub={`${cls.find((c) => c.key === f.cliente)?.nombre || f.cliente} · emisión ${fechaCorta(f.fecha_emision)} · vence ${fechaCorta(f.vencimiento)}`}
            valor={money(f.saldo)} chevron={false} alto={50} pill={vista === 'vencidas' ? { tone: f.dias > 90 ? 'red' : f.dias > 30 ? 'orange' : 'yellow', label: `${int(f.dias)} d` } : { tone: 'blue', label: `${int(f.paraVencer)} d` }} />
        ))}
        {lista.length > 15 && !verTodo && <Fila titulo={`Ver las ${lista.length}`} chevron onClick={() => setVerTodo(true)} alto={44} />}
      </ListaAgrupada>
    </>
  );
}
