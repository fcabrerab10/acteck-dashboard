// Drill-down de un SKU dentro del Sell In consolidado (renderExpandido de la tabla; uno abierto a la vez).
// Carga sus datos SÓLO al abrir (useQuery por sku): facturacion_clientes del SKU (clientes × mes),
// v_sellin_global_sku_mes_erp (devoluciones · notas de crédito · bonificaciones · MC), v_inventario_comercial,
// v_transito_sku y v_estrategia_precios_lista. MC % sólo con permiso `sensible`.
// "Compartir disponibilidad" usa textoDisponibilidad de lib/whatsapp.js: lista de precios obligatoria y SIN datos sensibles.
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Share2, Copy, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchAll, cachedQuery } from '../../../lib/queries';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN } from '../../../lib/utils';
import { KpiCard, Pill, DeltaPill, Panel, Boton, Cargando, HeatCell, toast } from '../../../components/kit';
import { textoDisponibilidad, compartir, copiar, fechaCorta, precio as fmtPrecio } from '../../../lib/whatsapp';
import { tonoCobertura, etiquetaCobertura } from '../inventario/constantes';
import { MESES, N, fmtInt, fmtMoneyShort, fmtPct, pctDelta, capitalizar, canalLabel, canalTone, roadmapTone, ultimosMeses, mesesCerrados } from './textos';

const hoyISO = () => new Date().toISOString().slice(0, 10);

function useDrillSku(sku) {
  return useQuery({
    queryKey: ['sellin_global', 'drill', sku],
    enabled: !!sku,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [fact, erp, inv, tr, pr] = await Promise.all([
        fetchAll('facturacion_clientes', 'sku,cliente_nombre,cliente_key,canal,anio,mes,piezas,monto', (q) => q.eq('sku', sku)),
        cachedQuery(supabase.from('v_sellin_global_sku_mes_erp').select('anio,mes,fact_neta,venta_neta,contribucion,devoluciones,rmas,bonificaciones,piezas').eq('sku', sku)),
        cachedQuery(supabase.from('v_inventario_comercial').select('sku,disponible,inventario').eq('sku', sku).maybeSingle()),
        cachedQuery(supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana,embarques,embarques_detalle').eq('sku', sku).maybeSingle()),
        cachedQuery(supabase.from('v_estrategia_precios_lista').select('lista,moneda,precio,anio,mes').eq('sku', sku)),
      ]);
      return { fact: fact || [], erp: erp.data || [], inv: inv.data || null, tr: tr.data || null, precios: pr.data || [] };
    },
  });
}

export default function DrillSku({ sku, info = {}, anio, anioPrev, mesActual, sensible = false, onVerFicha }) {
  const { theme } = useTheme();
  const { data, isLoading, error } = useDrillSku(sku);
  const [lista, setLista] = useState('');
  const [mostrarCola, setMostrarCola] = useState(false);

  const calc = useMemo(() => {
    if (!data) return null;
    const { fact, erp, inv, tr, precios } = data;
    // YTD piezas / monto (todos los clientes) · YoY mismo periodo
    const ytd = { pz: 0, m: 0 }, ytdPrev = { pz: 0, m: 0 };
    for (const r of fact) {
      if (r.mes > mesActual) continue;
      if (r.anio === anio) { ytd.pz += N(r.piezas); ytd.m += N(r.monto); }
      else if (r.anio === anioPrev) { ytdPrev.pz += N(r.piezas); ytdPrev.m += N(r.monto); }
    }
    const precioReal = ytd.pz > 0 ? ytd.m / ytd.pz : null;
    // MC % YTD (ERP)
    let fn = 0, contrib = 0;
    const erpMes = Array.from({ length: 12 }, () => ({ dev: 0, rma: 0, bon: 0, fn: 0 }));
    for (const r of erp) {
      if (r.anio !== anio) continue;
      const i = N(r.mes) - 1; if (i < 0 || i > 11) continue;
      erpMes[i] = { dev: N(r.devoluciones), rma: N(r.rmas), bon: N(r.bonificaciones), fn: N(r.fact_neta) };
      if (r.mes <= mesActual) { fn += N(r.fact_neta); contrib += N(r.contribucion); }
    }
    const mc = fn ? (contrib / fn) * 100 : null;
    const erpTot = erpMes.reduce((s, x) => ({ dev: s.dev + x.dev, rma: s.rma + x.rma, bon: s.bon + x.bon, fn: s.fn + x.fn }), { dev: 0, rma: 0, bon: 0, fn: 0 });
    // Heatmap clientes × últimos 6 meses · Pareto 80 %
    const meses = ultimosMeses(6);
    const idx = new Map(meses.map((m, i) => [m.key, i]));
    const byCli = new Map();
    for (const r of fact) {
      const i = idx.get(`${r.anio}-${Number(r.mes)}`); if (i == null) continue;
      const k = r.cliente_nombre || '(sin nombre)';
      if (!byCli.has(k)) byCli.set(k, { cliente: k, canal: r.canal || '', mensual: Array(6).fill(0), total: 0 });
      const it = byCli.get(k); it.mensual[i] += N(r.piezas); it.total += N(r.piezas);
    }
    const arr = Array.from(byCli.values()).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
    const grand = arr.reduce((s, c) => s + c.total, 0);
    let acum = 0, corte = arr.length;
    const conPct = arr.map((c, i) => { const pct = grand ? (c.total / grand) * 100 : 0; acum += pct; if (acum >= 80 && corte === arr.length) corte = i + 1; return { ...c, pct, pctAcum: acum }; });
    const pareto = conPct.slice(0, corte), cola = conPct.slice(corte);
    const colaMensual = Array(6).fill(0).map((_, i) => cola.reduce((s, c) => s + c.mensual[i], 0));
    const totMes = Array(6).fill(0).map((_, i) => conPct.reduce((s, c) => s + c.mensual[i], 0));
    // Disponibilidad · cobertura con la regla de Inventario (3 meses cerrados, todos los clientes)
    const cerrados = mesesCerrados(3); const setC = new Set(cerrados.map((m) => m.key));
    let dem = 0; for (const r of fact) if (setC.has(`${r.anio}-${Number(r.mes)}`)) dem += N(r.piezas);
    const demMes = dem / cerrados.length;
    const inventario = N(inv?.inventario), disponible = N(inv?.disponible);
    const cobertura = demMes > 0 ? inventario / (demMes / 30) : null;
    const hoy = hoyISO();
    const det = (Array.isArray(tr?.embarques_detalle) ? tr.embarques_detalle : []).filter((e) => N(e.cantidad) > 0).sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')));
    const proximo = det.find((e) => e.eta && e.eta >= hoy) || det.find((e) => e.eta) || null;
    const proximoArribo = proximo ? { fecha: proximo.eta, piezas: N(proximo.cantidad), po: proximo.po, estatus: proximo.estatus } : null;
    // Precios por lista (1 fila por lista, la más reciente)
    const porLista = new Map();
    for (const p of precios) { const prev = porLista.get(p.lista); if (!prev || `${p.anio}-${String(p.mes).padStart(2, '0')}` > `${prev.anio}-${String(prev.mes).padStart(2, '0')}`) porLista.set(p.lista, p); }
    const listas = Array.from(porLista.keys()).sort();
    return { ytd, ytdPrev, precioReal, mc, erpMes, erpTot, meses, pareto, cola, colaMensual, totMes, grand, inventario, disponible, cobertura, demMes, enCamino: N(tr?.cantidad), proximoArribo, porLista, listas };
  }, [data, anio, anioPrev, mesActual]);

  const wrap = { padding: '12px 14px 14px', background: theme.bg, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText };
  if (isLoading || !calc) return <div style={wrap}><Cargando pantalla="sellInDrill" minHeight={300} /></div>;
  if (error) return <div style={{ ...wrap, color: theme.red || '#FF3B30', fontSize: 12 }}>No se pudo cargar el detalle de {sku}: {String(error.message || error)}</div>;

  const listaValida = lista && calc.listas.includes(lista) ? lista : '';
  const precioLista = listaValida ? N(calc.porLista.get(listaValida)?.precio) : null;
  const armarTexto = () => textoDisponibilidad([{ sku, descripcion: info.descripcion, disponible: calc.disponible, proximoArribo: calc.proximoArribo, enCamino: calc.enCamino, precio: precioLista }], { marca: /balam/i.test(info.marca || '') ? 'Balam Rush' : 'Acteck' });
  const exigirLista = () => { if (!listaValida) { toast.error('Elige una lista de precios para compartir'); return false; } return true; };
  const onCompartir = async () => { if (!exigirLista()) return; const r = await compartir(armarTexto(), { titulo: `Disponibilidad ${sku}` }); if (r === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (!exigirLista()) return; if (await copiar(armarTexto())) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };

  const yoyPz = pctDelta(calc.ytd.pz, calc.ytdPrev.pz), yoyM = pctDelta(calc.ytd.m, calc.ytdPrev.m);
  const difLista = precioLista && calc.precioReal != null ? pctDelta(calc.precioReal, precioLista) : null;
  const tonoCob = tonoCobertura(calc.cobertura, calc.inventario);
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const th = { padding: '4px 6px', fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.divider || theme.border}`, textAlign: 'right', whiteSpace: 'nowrap' };
  const td = { padding: '3px 6px', textAlign: 'right', borderBottom: `1px solid ${theme.divider || theme.border}`, ...mono, fontSize: 11, color: theme.text };
  const selectStyle = { height: 28, borderRadius: 999, border: `1px solid ${listaValida ? theme.border : (theme.orange || '#FF9500')}`, background: theme.surface, color: listaValida ? theme.text : (theme.orange || '#FF9500'), fontFamily: TYPO.fontText, fontSize: 12, padding: '0 10px', outline: 'none' };
  const maxTot = Math.max(0, ...calc.totMes);

  const filaCliente = (c, i, menor = false) => {
    const maxCli = Math.max(0, ...c.mensual);
    return (
      <tr key={c.cliente}>
        <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText, fontWeight: menor ? 400 : 500, color: menor ? theme.textMuted : theme.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.cliente}>
          <span style={{ color: theme.textSubtle || theme.textMuted, fontSize: 9.5, marginRight: 6, ...mono }}>#{i + 1}</span>{c.cliente}
        </td>
        <td style={{ ...td, textAlign: 'left' }}><Pill tone={canalTone(c.canal)} size="xs">{canalLabel(c.canal)}</Pill></td>
        {c.mensual.map((v, k) => <td key={k} style={td}><HeatCell v={v} max={maxCli} /></td>)}
        <td style={{ ...td, fontWeight: 700 }}>{fmtInt(c.total)}</td>
        <td style={td}><Pill tone="orange" size="xs">{c.pct >= 1 ? `${Math.round(c.pct)}%` : c.pct > 0 ? `${c.pct.toFixed(1)}%` : '—'}</Pill></td>
      </tr>
    );
  };

  return (
    <div style={wrap} onClick={(e) => e.stopPropagation()}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...mono, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: theme.text }}>{sku}</span>
            {info.marca && <Pill tone={/balam/i.test(info.marca) ? 'purple' : 'blue'} size="xs">{info.marca}</Pill>}
            {info.categoriaCap && <Pill tone="gray" size="xs">{info.categoriaCap}</Pill>}
            {info.rdmp && <Pill tone={roadmapTone(info.rdmp)} size="xs">{info.rdmp}</Pill>}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, maxWidth: 640 }}>{info.descripcion || '—'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <select value={listaValida} onChange={(e) => setLista(e.target.value)} style={selectStyle} title="Lista de precios (obligatoria para compartir; el texto no la menciona)">
            <option value="">{calc.listas.length ? 'Elige una lista' : 'Sin precios de lista'}</option>
            {calc.listas.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <Boton primario icon={Share2} onClick={onCompartir} disabled={!calc.listas.length} title="WhatsApp / compartir · sin datos sensibles">Compartir disponibilidad</Boton>
          <Boton icon={Copy} onClick={onCopiar} disabled={!calc.listas.length} title="Copiar el texto">Copiar</Boton>
          {onVerFicha && <Boton icon={ExternalLink} onClick={() => onVerFicha(sku)}>Ver ficha completa</Boton>}
        </div>
      </div>

      {/* 3 cifras */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sensible ? 3 : 2}, minmax(0, 1fr))`, gap: 8 }}>
        <KpiCard eyebrow={`YTD ${anio} · ene–${MESES[mesActual - 1]}`} badge={yoyPz != null ? { l: `${yoyPz >= 0 ? '↑' : '↓'} ${Math.abs(yoyPz).toFixed(0)}% pz`, tone: yoyPz >= 0 ? 'green' : 'red' } : undefined}
          big={`${fmtInt(calc.ytd.pz)} pz`} bigSmall={fmtMoneyShort(calc.ytd.m)}
          sub={`${anioPrev}: ${fmtInt(calc.ytdPrev.pz)} pz · ${fmtMoneyShort(calc.ytdPrev.m)}${yoyM != null ? ` · monto ${yoyM >= 0 ? '↑' : '↓'} ${Math.abs(yoyM).toFixed(0)}%` : ''}`} />
        <KpiCard eyebrow="Precio promedio real · YTD" badge={difLista != null ? { l: `${difLista >= 0 ? '+' : ''}${difLista.toFixed(1)}% vs lista`, tone: difLista >= -2 ? 'green' : difLista >= -8 ? 'orange' : 'red' } : undefined}
          big={calc.precioReal != null ? fmtPrecio(calc.precioReal) : '—'} bigSmall={precioLista ? `/ ${fmtPrecio(precioLista)} lista` : undefined}
          sub={listaValida ? `Lista ${listaValida} · sin IVA` : calc.listas.length ? 'Elige una lista para comparar' : 'Sin precio de lista cargado'} />
        {sensible && (
          <KpiCard eyebrow={`MC % · YTD ${anio}`} badge={{ l: 'Sensible', tone: 'red' }}
            big={calc.mc != null ? fmtPct(calc.mc, 1) : '—'} bigColor={calc.mc == null ? theme.textMuted : calc.mc >= 25 ? (theme.green || '#34C759') : calc.mc >= 15 ? theme.text : (theme.orange || '#FF9500')}
            sub={`Contribución / Fact. Neta · ERP${calc.erpTot.fn ? ` · Fact. Neta ${fmtMoneyShort(calc.erpTot.fn)}` : ''}`} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 10 }}>
        {/* Heatmap clientes × 6 meses · Pareto */}
        <Panel titulo="Clientes · últimos 6 meses" meta={calc.grand ? `${fmtInt(calc.grand)} pz · ${calc.pareto.length} cliente${calc.pareto.length === 1 ? '' : 's'} hacen el 80 %` : 'sin ventas'} padding="0 0 4px">
          {calc.grand === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 11.5, color: theme.textMuted }}>Sin ventas del SKU en los últimos 6 meses.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead><tr>
                  <th style={{ ...th, textAlign: 'left' }}>Cliente</th><th style={{ ...th, textAlign: 'left' }}>Canal</th>
                  {calc.meses.map((m) => <th key={m.key} style={th}>{MESES[m.mes - 1]}{m.mes === 1 || m === calc.meses[0] ? ` ${String(m.anio).slice(2)}` : ''}</th>)}
                  <th style={th}>Total</th><th style={th}>%</th>
                </tr></thead>
                <tbody>
                  {calc.pareto.map((c, i) => filaCliente(c, i))}
                  {calc.cola.length > 0 && (
                    <tr onClick={() => setMostrarCola((v) => !v)} style={{ cursor: 'pointer' }}>
                      <td colSpan={2} style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText, color: theme.textMuted }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{mostrarCola ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Cola larga · {calc.cola.length} cliente{calc.cola.length === 1 ? '' : 's'}</span>
                      </td>
                      {calc.colaMensual.map((v, k) => <td key={k} style={{ ...td, color: theme.textMuted }}>{v ? fmtInt(v) : '—'}</td>)}
                      <td style={{ ...td, color: theme.textMuted, fontWeight: 600 }}>{fmtInt(calc.cola.reduce((s, c) => s + c.total, 0))}</td>
                      <td style={td}><Pill tone="gray" size="xs">{`${Math.round(100 - calc.pareto.reduce((s, c) => s + c.pct, 0))}%`}</Pill></td>
                    </tr>
                  )}
                  {mostrarCola && calc.cola.map((c, i) => filaCliente(c, calc.pareto.length + i, true))}
                </tbody>
                <tfoot><tr>
                  <td colSpan={2} style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText, fontWeight: 700, borderBottom: 0 }}>Total</td>
                  {calc.totMes.map((v, k) => <td key={k} style={{ ...td, fontWeight: 700, borderBottom: 0 }}><HeatCell v={v} max={maxTot} /></td>)}
                  <td style={{ ...td, fontWeight: 700, borderBottom: 0 }}>{fmtInt(calc.grand)}</td><td style={{ ...td, borderBottom: 0 }} />
                </tr></tfoot>
              </table>
            </div>
          )}
        </Panel>

        {/* Disponibilidad hoy + precios */}
        <Panel titulo="Disponibilidad hoy" meta="almacenes comerciales · tránsito · listas">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[
              { k: 'Disponible', v: `${fmtInt(calc.disponible)} pz`, s: calc.inventario !== calc.disponible ? `${fmtInt(calc.inventario)} pz en inventario` : 'sin reservas' },
              { k: 'Cobertura', v: calc.cobertura != null ? `${fmtInt(calc.cobertura)} d` : '—', s: etiquetaCobertura(calc.cobertura, calc.inventario) + (calc.demMes ? ` · ${fmtInt(calc.demMes)} pz/mes` : ''), tone: tonoCob },
              { k: 'Próximo arribo', v: calc.proximoArribo ? fechaCorta(calc.proximoArribo.fecha) : '—', s: calc.proximoArribo ? `${fmtInt(calc.proximoArribo.piezas)} pz · ${calc.proximoArribo.po || ''}${calc.enCamino ? ` · ${fmtInt(calc.enCamino)} en camino` : ''}` : calc.enCamino ? `${fmtInt(calc.enCamino)} pz en camino sin ETA` : 'sin embarques' },
            ].map((x) => (
              <div key={x.k}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>{x.k}</div>
                <div style={{ ...mono, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>{x.v}{x.tone && <Pill tone={x.tone} size="xs" dot>{etiquetaCobertura(calc.cobertura, calc.inventario)}</Pill>}</div>
                <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{x.tone ? (calc.demMes ? `${fmtInt(calc.demMes)} pz/mes · 3 meses cerrados` : 'sin demanda reciente') : x.s}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, borderTop: `1px solid ${theme.divider || theme.border}`, paddingTop: 8 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 5 }}>Precios vigentes por lista · sin IVA</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {calc.listas.length === 0 && <span style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted }}>Sin precios cargados en precios_sku.</span>}
              {calc.listas.map((l) => { const p = calc.porLista.get(l); return (
                <Pill key={l} tone={l === listaValida ? 'blue' : 'gray'} onClick={() => setLista(l)} title={`${p.moneda || ''} · ${p.anio}-${String(p.mes).padStart(2, '0')}`}>{l} · {fmtPrecio(p.precio)}</Pill>
              ); })}
            </div>
          </div>
        </Panel>
      </div>

      {/* Devoluciones · notas de crédito · bonificaciones por mes (ERP) */}
      <Panel titulo={`Devoluciones · Notas de crédito · Bonificaciones ${anio}`} meta="ERP · montos del mes (sin IVA)" padding="0" plegable abiertoInicial={false}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Concepto</th>{MESES.map((m) => <th key={m} style={th}>{m}</th>)}<th style={th}>Total</th></tr></thead>
            <tbody>
              {[['Devoluciones', 'dev'], ['Notas de crédito', 'rma'], ['Bonificaciones', 'bon']].map(([lbl, k]) => (
                <tr key={k}>
                  <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText, fontWeight: 500 }}>{lbl}</td>
                  {calc.erpMes.map((x, i) => <td key={i} style={{ ...td, color: x[k] ? (theme.red || '#FF3B30') : (theme.textSubtle || theme.textMuted) }}>{x[k] ? fmtMoneyShort(Math.abs(x[k])) : '—'}</td>)}
                  <td style={{ ...td, fontWeight: 700, color: calc.erpTot[k] ? (theme.red || '#FF3B30') : theme.textMuted }}>{calc.erpTot[k] ? fmtMoneyShort(Math.abs(calc.erpTot[k])) : '—'}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, textAlign: 'left', fontFamily: TYPO.fontText, color: theme.textMuted, borderBottom: 0 }}>Fact. Neta</td>
                {calc.erpMes.map((x, i) => <td key={i} style={{ ...td, color: theme.textMuted, borderBottom: 0 }}>{x.fn ? fmtMoneyShort(x.fn) : '—'}</td>)}
                <td style={{ ...td, color: theme.textMuted, fontWeight: 600, borderBottom: 0 }} title={formatMXN(calc.erpTot.fn)}>{calc.erpTot.fn ? fmtMoneyShort(calc.erpTot.fn) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
