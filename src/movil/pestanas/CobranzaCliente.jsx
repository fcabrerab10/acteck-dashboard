// Crédito y Cobranza del cliente (push) · consulta + compartir + historial de cortes.
// HeroM: saldo actual · vencido con % · DSO · frase del corte. Aging en 4 KpiM tocables (filtran la lista).
// Facturas con saldo (folio, fecha, importe, saldo, días de atraso) ordenadas por atraso, buscador por folio.
// Historial de cortes semanales (fecha, saldo, vencido, DSO) con mini-gráfica; tocar un corte carga su detalle.
// "Compartir estado de cuenta" (textoEstadoCuenta · solo vencidas o todas las facturas con saldo).
// Fuentes (mismas que CreditoCobranzaV2.jsx): estados_cuenta + estados_cuenta_detalle (cargadas por uploads → cachedQuery)
// y clientes_credito_config (la app la escribe → supabase directo). Reglas de atraso/DSO/aging copiadas del escritorio.
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Share2, Copy, CreditCard } from 'lucide-react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaCliente } from '../../lib/permisos';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Cabecera, CampoBusqueda, Skeleton, Segmented, Pill, Vacio, BotonGrande, toast } from '../piezas';
import { nombreCliente } from '../datos';
import { money, moneyCompact, fechaCorta, N, MONO } from '../util';
import { textoEstadoCuenta, folioCorto, compartir, copiar } from '../../lib/whatsapp';

const STALE = 5 * 60 * 1000;
const DIA_MS = 86400000;
const TRAMOS = [
  { id: '0_30',  label: '0–30 días',  corto: '0–30',  min: 1,  max: 30,       tone: 'yellow' },
  { id: '31_60', label: '31–60 días', corto: '31–60', min: 31, max: 60,       tone: 'orange' },
  { id: '61_90', label: '61–90 días', corto: '61–90', min: 61, max: 90,       tone: 'red' },
  { id: 'mas90', label: '+90 días',   corto: '+90',   min: 91, max: Infinity, tone: 'red' },
];
const tramoDe = (d) => (d <= 0 ? null : TRAMOS.find((t) => d >= t.min && d <= t.max)?.id || 'mas90');
const msDe = (iso) => new Date(String(iso).slice(0, 10) + 'T00:00:00').getTime();

function useCortes(ck) {
  return useQuery({
    queryKey: ['movil', 'cobranza', 'cortes', ck], staleTime: STALE, enabled: !!ck && DB_CONFIGURED,
    queryFn: async () => {
      const [ec, cfg] = await Promise.all([
        cachedQuery(supabase.from('estados_cuenta').select('id,cliente,anio,semana,fecha_corte,saldo_actual,saldo_vencido,saldo_a_vencer,dso,tipo_cambio,notas_credito').eq('cliente', ck).order('anio', { ascending: false }).order('semana', { ascending: false }).limit(30)),
        supabase.from('clientes_credito_config').select('*').eq('cliente', ck).maybeSingle(),
      ]);
      if (ec.error) throw ec.error;
      return { cortes: ec.data || [], config: cfg.data || null };
    },
  });
}
function useDetalle(corteId) {
  return useQuery({
    queryKey: ['movil', 'cobranza', 'detalle', corteId], staleTime: STALE, enabled: !!corteId && DB_CONFIGURED,
    queryFn: async () => {
      const { data, error } = await cachedQuery(supabase.from('estados_cuenta_detalle').select('id,movimiento,referencia,fecha_emision,vencimiento,importe_factura,saldo_actual,dias_moratorios').eq('estado_cuenta_id', corteId));
      if (error) throw error;
      return data || [];
    },
  });
}

/** Mini-gráfica del historial: saldo (línea) y vencido (área) por corte, del más viejo al más nuevo. */
function MiniSerie({ cortes, selId, onSel }) {
  const { theme } = useTheme();
  const serie = [...cortes].reverse();
  const W = 320, H = 64, P = 4;
  const max = Math.max(1, ...serie.map((c) => N(c.saldo_actual)));
  const x = (i) => (serie.length > 1 ? P + (i * (W - 2 * P)) / (serie.length - 1) : W / 2);
  const y = (v) => H - P - (Math.max(0, v) / max) * (H - 2 * P);
  const linea = serie.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(N(c.saldo_actual)).toFixed(1)}`).join(' ');
  const area = serie.length ? `M${x(0).toFixed(1)},${H - P} ` + serie.map((c, i) => `L${x(i).toFixed(1)},${y(N(c.saldo_vencido)).toFixed(1)}`).join(' ') + ` L${x(serie.length - 1).toFixed(1)},${H - P} Z` : '';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
      <path d={area} fill={theme.red} opacity={0.18} />
      <path d={linea} fill="none" stroke={theme.text} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {serie.map((c, i) => (
        <g key={c.id} onClick={() => onSel(c.id)} style={{ cursor: 'pointer' }}>
          <rect x={x(i) - 8} y={0} width={16} height={H} fill="transparent" />
          <circle cx={x(i)} cy={y(N(c.saldo_actual))} r={c.id === selId ? 4 : 2.2} fill={c.id === selId ? theme.accent : theme.text} />
        </g>
      ))}
    </svg>
  );
}

/** Contenido de la hoja "Compartir estado de cuenta" · selector de alcance + vista previa + compartir/copiar. */
function HojaCompartir({ facturas, cliente, fechaCorte, saldoTotal, totalVencido }) {
  const { theme } = useTheme();
  const [alcance, setAlcance] = useState('vencidas');
  const texto = useMemo(() => textoEstadoCuenta(facturas, { cliente, fechaCorte, saldoTotal, totalVencido, soloVencidas: alcance === 'vencidas' }), [facturas, cliente, fechaCorte, saldoTotal, totalVencido, alcance]);
  const nVenc = facturas.filter((f) => f.dias > 0).length;
  const dark = theme.mode === 'dark';
  return (
    <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Segmented size="md" value={alcance} onChange={setAlcance} style={{ width: '100%', display: 'flex' }}
        options={[{ id: 'vencidas', label: 'Solo vencidas', badge: nVenc }, { id: 'todas', label: 'Todas con saldo', badge: facturas.length }]} />
      <pre style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(120,120,128,0.10)', color: theme.text, fontFamily: TYPO.fontText, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '38vh', overflowY: 'auto' }}>{texto}</pre>
      <BotonGrande primario icon={Share2} onClick={async () => { const r = await compartir(texto, { titulo: `Estado de cuenta · ${cliente}` }); if (r === 'whatsapp') toast.info('Abriendo WhatsApp…'); }}>Compartir</BotonGrande>
      <BotonGrande icon={Copy} onClick={async () => { (await copiar(texto)) ? toast.ok('Copiado al portapapeles') : toast.error('No se pudo copiar'); }}>Copiar texto</BotonGrande>
      <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, lineHeight: 1.4 }}>Tono formal para el cliente: no incluye línea de crédito, DSO ni notas internas.</div>
    </div>
  );
}

export default function CobranzaCliente({ clienteKey, nombre }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil() || nav?.perfil;
  const ck = clienteKey;
  const label = nombre || nombreCliente(ck);
  const puedeVer = puedeVerPestanaCliente(perfil, ck, 'cartera');
  const { data, isLoading, error } = useCortes(puedeVer ? ck : null);
  const cortes = data?.cortes || [];
  const config = data?.config || null;
  const [corteSel, setCorteSel] = useState(null);
  const idxSel = Math.max(0, cortes.findIndex((c) => c.id === corteSel));
  const estado = cortes[idxSel] || null;
  const estadoPrev = cortes[idxSel + 1] || null;
  const esUltimo = idxSel === 0;
  const { data: detalle, isLoading: cargandoDet } = useDetalle(estado?.id);
  const [filtro, setFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  const r = useMemo(() => {
    if (!estado || !detalle) return null;
    // Referencia temporal: hoy para el último corte, la fecha de corte para semanas anteriores (igual que escritorio).
    const refMs = !esUltimo && estado.fecha_corte ? msDe(estado.fecha_corte) : Date.now();
    const diasAtraso = (f) => (f.vencimiento ? Math.max(0, Math.floor((refMs - msDe(f.vencimiento)) / DIA_MS)) : 0);
    const conSaldo = detalle.filter((f) => N(f.saldo_actual) > 0);
    const facturas = conSaldo.map((f) => {
      const dias = diasAtraso(f);
      return { id: f.id, folio: folioCorto(f.movimiento), referencia: f.referencia || '', fecha: f.fecha_emision, vencimiento: f.vencimiento, importe: N(f.importe_factura), saldo: N(f.saldo_actual), dias, tramo: tramoDe(dias), paraVencer: f.vencimiento ? Math.floor((msDe(f.vencimiento) - refMs) / DIA_MS) : null };
    }).sort((a, b) => (b.dias - a.dias) || (b.saldo - a.saldo));
    const suma = (rows) => rows.reduce((s, f) => s + f.saldo, 0);
    const vencidas = facturas.filter((f) => f.dias > 0);
    const saldoActual = N(estado.saldo_actual) > 0 ? N(estado.saldo_actual) : suma(facturas);
    const saldoVencido = N(estado.saldo_vencido) > 0 ? N(estado.saldo_vencido) : suma(vencidas);
    const aging = Object.fromEntries(TRAMOS.map((t) => [t.id, { monto: 0, n: 0 }]));
    facturas.forEach((f) => { if (f.tramo) { aging[f.tramo].monto += f.saldo; aging[f.tramo].n++; } });
    let num = 0, den = 0;
    facturas.forEach((f) => { if (!f.fecha) return; const d = Math.floor((refMs - msDe(f.fecha)) / DIA_MS); if (d < 0) return; num += f.saldo * d; den += f.saldo; });
    const dso = den > 0 ? Math.round(num / den) : (estado.dso != null ? N(estado.dso) : null);
    const pctVencido = saldoActual > 0 ? (saldoVencido / saldoActual) * 100 : 0;
    const nMas90 = aging.mas90.n;
    const frase = saldoVencido > 0 ? `Vencido ${moneyCompact(saldoVencido)}, ${nMas90 > 0 ? `${nMas90} factura${nMas90 === 1 ? '' : 's'} a más de 90 días` : 'ninguna a más de 90 días'}` : 'Cartera sana';
    const plazo = N(config?.plazo_dias_credito) || 90;
    const lineaMXN = N(config?.linea_credito_usd) * N(estado.tipo_cambio) + N(config?.linea_credito_mxn_pagare);
    const usoPct = lineaMXN > 0 ? Math.min(999, Math.round((saldoActual / lineaMXN) * 100)) : null;
    const deltaVenc = estadoPrev ? saldoVencido - (N(estadoPrev.saldo_vencido)) : null;
    const dsoTone = dso == null ? 'gray' : dso <= plazo ? 'green' : dso <= plazo + 30 ? 'orange' : 'red';
    return { refMs, facturas, vencidas, saldoActual, saldoVencido, aging, dso, pctVencido, frase, plazo, lineaMXN, usoPct, deltaVenc, dsoTone };
  }, [estado, estadoPrev, detalle, esUltimo, config]);

  const lista = useMemo(() => {
    if (!r) return [];
    const q = busqueda.trim().toLowerCase();
    let rows = r.facturas;
    if (filtro === 'vigente') rows = rows.filter((f) => f.dias === 0);
    else if (filtro !== 'todas') rows = rows.filter((f) => f.tramo === filtro);
    if (q) rows = rows.filter((f) => f.folio.toLowerCase().includes(q) || f.referencia.toLowerCase().includes(q));
    return rows;
  }, [r, filtro, busqueda]);

  const abrirCompartir = () => {
    if (!r) return;
    nav.abrirHoja({ titulo: 'Compartir estado de cuenta', sub: `${label} · corte ${fechaCorta(estado.fecha_corte)}`, alto: '88vh', contenido: <HojaCompartir facturas={r.facturas} cliente={label} fechaCorte={estado.fecha_corte} saldoTotal={r.saldoActual} totalVencido={r.saldoVencido} /> });
  };

  const tonoVenc = r ? (r.pctVencido === 0 ? theme.green : r.pctVencido <= 5 ? theme.green : r.pctVencido <= 15 ? theme.orange : theme.red) : theme.text;
  const filtroLabel = filtro === 'todas' ? null : filtro === 'vigente' ? 'Vigentes' : TRAMOS.find((t) => t.id === filtro)?.label;

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta={label} />
      <TituloGrande titulo="Crédito y Cobranza" sub={estado ? `${label} · corte ${fechaCorta(estado.fecha_corte)} · semana ${estado.semana}${esUltimo ? '' : ' · histórico'}` : label} />
      {!puedeVer && <Vacio icon={null} titulo="Sin acceso" sub={`No tienes acceso a Crédito y Cobranza de ${label}.`} />}
      {puedeVer && error && <Vacio titulo="No se pudo cargar la cartera" sub={error.message} />}
      {puedeVer && !error && (isLoading || (estado && (cargandoDet || !r))) && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={150} r={12} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div>
          <Skeleton h={260} r={12} />
        </div>
      )}
      {puedeVer && !isLoading && !error && !estado && <Vacio icon={CreditCard} color={theme.textMuted} titulo="Sin cortes cargados" sub="Todavía no hay estados de cuenta de este cliente. Se cargan desde el importador en la computadora." />}
      {r && (
        <>
          <HeroM eyebrow={`Corte ${fechaCorta(estado.fecha_corte)}${r.usoPct != null ? ` · uso de línea ${r.usoPct}%` : ''}`} frase={r.frase}
            sub={`Saldo ${money(r.saldoActual)} en ${r.facturas.length} factura${r.facturas.length === 1 ? '' : 's'}${r.deltaVenc != null && r.deltaVenc !== 0 ? ` · vencido ${r.deltaVenc > 0 ? 'subió' : 'bajó'} ${moneyCompact(Math.abs(r.deltaVenc))} vs corte anterior` : ''}`}
            stats={[
              { k: 'Saldo', v: moneyCompact(r.saldoActual), sub: r.lineaMXN > 0 ? `línea ${moneyCompact(r.lineaMXN)}` : `${r.facturas.length} facturas` },
              { k: 'Vencido', v: moneyCompact(r.saldoVencido), sub: `${r.pctVencido.toFixed(r.pctVencido < 10 ? 1 : 0)}% del saldo`, color: r.saldoVencido > 0 ? (theme.mode === 'dark' ? '#B00020' : '#FF6961') : undefined },
              { k: 'DSO', v: r.dso != null ? `${r.dso} d` : '—', sub: `plazo ${r.plazo} d` },
            ]} />

          <KpiGrid style={{ marginTop: 12 }}>
            {TRAMOS.map((t) => {
              const a = r.aging[t.id]; const on = filtro === t.id;
              return (
                <KpiM key={t.id} eyebrow={t.label} big={a.monto > 0 ? moneyCompact(a.monto) : '—'} bigColor={a.monto > 0 ? (t.id === 'mas90' || t.id === '61_90' ? theme.red : t.id === '31_60' ? theme.orange : undefined) : (theme.textSubtle || theme.textMuted)}
                  sub={a.n ? `${a.n} factura${a.n === 1 ? '' : 's'}${r.saldoActual > 0 ? ` · ${((a.monto / r.saldoActual) * 100).toFixed(1)}% del saldo` : ''}` : 'sin facturas'} pill={on ? { tone: 'inverse', label: 'filtro' } : undefined}
                  onClick={() => setFiltro(on ? 'todas' : t.id)} style={on ? { outline: `2px solid ${theme.accent}`, outlineOffset: -1 } : undefined} />
              );
            })}
          </KpiGrid>

          <div style={{ padding: '14px 16px 0' }}>
            <BotonGrande primario icon={Share2} onClick={abrirCompartir}>Compartir estado de cuenta</BotonGrande>
          </div>

          <div style={{ padding: '14px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CampoBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar folio o referencia" />
            <Segmented value={filtro === 'todas' || filtro === 'vigente' ? filtro : 'venc'} onChange={(v) => setFiltro(v === 'venc' ? 'mas90' : v)} style={{ alignSelf: 'flex-start' }}
              options={[{ id: 'todas', label: 'Todas', badge: r.facturas.length }, { id: 'vigente', label: 'Vigentes', badge: r.facturas.length - r.vencidas.length }, { id: 'venc', label: filtroLabel && filtro !== 'vigente' ? filtroLabel : 'Vencidas', badge: filtro === 'todas' || filtro === 'vigente' ? r.vencidas.length : lista.length }]} />
          </div>

          <ListaAgrupada titulo="Facturas con saldo" meta={`${lista.length} · ${moneyCompact(lista.reduce((s, f) => s + f.saldo, 0))}`}
            pie={lista.length ? `Días de atraso ${esUltimo ? 'a hoy' : `a la fecha del corte (${fechaCorta(estado.fecha_corte)})`}. Toca un tramo del aging para filtrar.` : undefined}>
            {lista.length === 0 && <Vacio icon={null} titulo="Sin facturas" sub={busqueda ? 'Ninguna coincide con la búsqueda.' : 'No hay facturas en este filtro.'} />}
            {lista.slice(0, 80).map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, padding: '8px 12px', boxSizing: 'border-box' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.folio}</span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fechaCorta(f.fecha)}{f.vencimiento ? ` · vence ${fechaCorta(f.vencimiento)}` : ''}{f.importe > 0 && Math.abs(f.importe - f.saldo) > 1 ? ` · de ${money(f.importe)}` : ''}{f.referencia ? ` · ${f.referencia}` : ''}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(f.saldo)}</span>
                  <span style={{ display: 'block', marginTop: 3 }}>
                    {f.dias > 0
                      ? <Pill tone={TRAMOS.find((t) => t.id === f.tramo)?.tone || 'red'} size="xs">{f.dias} d atraso</Pill>
                      : <Pill tone={f.paraVencer != null && f.paraVencer <= 7 ? 'blue' : 'gray'} size="xs">{f.paraVencer == null ? 'vigente' : f.paraVencer === 0 ? 'vence hoy' : `vence en ${f.paraVencer} d`}</Pill>}
                  </span>
                </span>
              </div>
            ))}
          </ListaAgrupada>
          {lista.length > 80 && <div style={{ padding: '8px 28px 0', fontSize: 11.5, color: theme.textSubtle || theme.textMuted }}>Mostrando 80 de {lista.length}. Afina la búsqueda para ver el resto.</div>}

          <ListaAgrupada titulo="Historial de cortes" meta={`${cortes.length}`} style={{ marginTop: 18 }} pie="Línea = saldo · área roja = vencido. Toca un corte para ver sus facturas; los días de atraso se calculan a la fecha de ese corte.">
            <div style={{ padding: '12px 12px 6px' }}><MiniSerie cortes={cortes} selId={estado.id} onSel={setCorteSel} /></div>
            {cortes.slice(0, 12).map((c) => {
              const on = c.id === estado.id;
              const pv = N(c.saldo_actual) > 0 ? (N(c.saldo_vencido) / N(c.saldo_actual)) * 100 : 0;
              return (
                <button key={c.id} type="button" onClick={() => setCorteSel(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 54, padding: '8px 12px', border: 0, background: on ? (theme.surfaceHover || 'rgba(0,0,0,0.03)') : 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? theme.accent : (pv === 0 ? theme.green : pv <= 15 ? theme.orange : theme.red), flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: on ? 600 : 500, letterSpacing: '-0.01em' }}>{fechaCorta(c.fecha_corte)} <span style={{ color: theme.textMuted, fontWeight: 400, fontSize: 13 }}>· sem {c.semana}</span></span>
                    <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>vencido {moneyCompact(c.saldo_vencido)} ({pv.toFixed(pv < 10 && pv > 0 ? 1 : 0)}%) · DSO {c.dso != null ? `${c.dso} d` : '—'}</span>
                  </span>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{moneyCompact(c.saldo_actual)}</span>
                </button>
              );
            })}
          </ListaAgrupada>
        </>
      )}
    </>
  );
}
