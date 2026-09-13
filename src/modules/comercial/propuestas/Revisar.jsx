// Revisar — cuerpo de la hoja lateral (HojaLateral ~820 px sobre Armar) antes de mandar: nombre (obligatorio para
// enviar) + folio de referencia + vigencia (fecha editable; por defecto el último día del mes) · Hero (total,
// descuento ⌀, cierra gap; margen ⌀ sólo sensible) · KPIs · distribución por familia · tablas por grupo (Digitalife:
// Monitores / Sillas / Todo lo demás) con edición en sitio (piezas, lista/precio, quitar) · acciones: Guardar ·
// Copiar · Compartir (WhatsApp) · Exportar (Excel = mismo libro que el móvil, PDF "como se ve").
// El Excel y el resumen de WhatsApp NUNCA llevan costo ni margen (excelPropuesta.js sólo escribe sku · descripción ·
// marca · familia · piezas · precio) y ambos llevan la vigencia.
import React, { useMemo, useRef, useState } from 'react';
import { Save, Share2, Copy, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Hero, KpiCard, Panel, Pill, Boton, TablaCompacta, toast } from '../../../components/kit';
import ExportMenu from '../../../components/ExportMenu';
import { money, moneyCompact, int, pct } from '../../../lib/format';
import { compartir, copiar } from '../../../lib/whatsapp';
import { familiaHoja, MES_FULL, clienteColor, vigenciaPorDefecto } from './constantes';
import { exportarPropuestaExcel } from './excelPropuesta';
import { textoPropuesta, vigenciaTexto } from './textos';
import { mapaEan } from '../../../lib/ean';
import { IndicadorGuardado } from './MiPropuesta';
import PrecioPicker from './PrecioPicker';

const N = (v) => Number(v) || 0;

export default function Revisar({ cliente, contexto, skus, propuesta, setPropuesta, nombre, setNombre, vigencia, setVigencia, modelo, sensible, autosave, onGuardar, onEnviada }) {
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const cliCol = clienteColor(theme, cliente.key);
  const green = theme.green || '#34C759', orange = theme.orange || '#FF9500', red = theme.red || '#FF3B30', accent = theme.accent || '#007AFF', purple = theme.purple || '#AF52DE';
  const nombreOk = !!(nombre || '').trim();
  const vig = vigencia || vigenciaPorDefecto();

  const propuestaLista = useMemo(() => Object.entries(propuesta).map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val })).filter((r) => r.sku), [propuesta, skus]);
  const total = propuestaLista.reduce((s, r) => s + N(r.piezas) * N(r.precio), 0);
  const piezas = propuestaLista.reduce((s, r) => s + N(r.piezas), 0);
  const spiffTotal = propuestaLista.reduce((s, r) => s + N(r.piezas) * N(r.spiff), 0);
  const spiffSkus = propuestaLista.filter((r) => N(r.spiff) > 0 && N(r.piezas) > 0).length;
  const anio = modelo?.anio || new Date().getFullYear(), mes = modelo?.mes || new Date().getMonth() + 1;

  const editarSku = (sku, cambios) => setPropuesta?.((prev) => (sku in prev ? { ...prev, [sku]: { ...prev[sku], ...cambios } } : prev));
  const quitarSku = (sku) => setPropuesta?.((prev) => { if (!(sku in prev)) return prev; const n = { ...prev }; delete n[sku]; return n; });

  const grupos = useMemo(() => {
    if (cliente.key !== 'digitalife') return { Propuesta: propuestaLista };
    const g = { Monitores: [], Sillas: [], 'Todo lo demás': [] };
    for (const r of propuestaLista) g[familiaHoja(r.familia)].push(r);
    return g;
  }, [propuestaLista, cliente]);

  const gap = contexto?.gap || 0;
  const cierraGapPct = gap > 0 ? Math.round((total / gap) * 100) : null;

  const met = useMemo(() => {
    let ahorroTotal = 0, sumaDescPond = 0, sumaTotalConComp = 0, sumaMargPond = 0, sumaTotalConCosto = 0, sinCosto = 0;
    for (const r of propuestaLista) {
      const px = N(r.precio), pz = N(r.piezas), tot = px * pz, maaa = N(r.precios?.['Mayoreo AAA']), costo = N(r.costo);
      if (maaa > 0 && px > 0) { ahorroTotal += (maaa - px) * pz; sumaDescPond += ((maaa - px) / maaa) * tot; sumaTotalConComp += tot; }
      if (costo > 0 && px > 0) { sumaMargPond += ((px - costo) / px) * tot; sumaTotalConCosto += tot; } else if (px > 0) sinCosto++;
    }
    return { ahorroTotal, descuentoProm: sumaTotalConComp > 0 ? (sumaDescPond / sumaTotalConComp) * 100 : null, margenProm: sumaTotalConCosto > 0 ? (sumaMargPond / sumaTotalConCosto) * 100 : null, sinCosto };
  }, [propuestaLista]);

  const distribucion = useMemo(() => {
    const arr = Object.entries(grupos).map(([k, filas]) => ({ nombre: k, total: filas.reduce((s, r) => s + N(r.piezas) * N(r.precio), 0) })).filter((g) => g.total > 0);
    const suma = arr.reduce((s, g) => s + g.total, 0);
    return arr.map((g) => ({ ...g, pct: suma > 0 ? (g.total / suma) * 100 : 0 }));
  }, [grupos]);
  const famColor = (n) => ({ Monitores: accent, Sillas: purple, 'Todo lo demás': green, Propuesta: accent }[n] || accent);
  const margenColor = (m) => (m == null ? red : m >= 25 ? green : m >= 15 ? orange : red);

  // Validación común antes de enviar (Excel / Compartir): líneas, precios y nombre.
  const listaParaEnviar = () => {
    if (propuestaLista.length === 0) { toast.error('La propuesta está vacía.'); return false; }
    if (propuestaLista.some((r) => !(N(r.piezas) > 0))) { toast.error('Hay líneas con 0 piezas: corrígelas o quítalas.'); return false; }
    if (propuestaLista.some((r) => !(N(r.precio) > 0))) { toast.error('Hay líneas sin precio.'); return false; }
    if (!nombreOk) { toast.error('Ponle nombre a la propuesta antes de enviarla.'); return false; }
    return true;
  };
  const lineasTexto = () => propuestaLista.map((r) => ({ sku: r.sku, descripcion: r.descripcion, piezas: r.piezas, precio: r.precio }));
  const exportarExcel = async () => {
    if (!listaParaEnviar()) return;
    setOcupado(true);
    try {
      const filename = await exportarPropuestaExcel({ cliente, propuestaLista, nombre, vigencia: vig });
      await onEnviada?.({ exported_filename: filename });
      toast.ok('Excel descargado · propuesta marcada como enviada');
    } catch (e) { toast.error(`No se pudo exportar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };
  /** Resumen de WhatsApp con el EAN de cada SKU cuando lo haya (v_sku_ean). Si la vista falla, el texto va igual. */
  const armarTexto = async () => {
    const eanPorSku = await mapaEan(propuestaLista.map((r) => r.sku)).catch(() => null);
    return textoPropuesta({ clienteLabel: cliente.label, nombre, anio, mes, lineas: lineasTexto(), vigencia: vig, eanPorSku });
  };
  const compartirTexto = async () => {
    if (!listaParaEnviar()) return;
    const texto = await armarTexto();
    const r = await compartir(texto, { titulo: `Propuesta ${cliente.label}` });
    if (!r) return;
    await onEnviada?.();
    toast.ok(r === 'share' ? 'Propuesta compartida' : 'Se abrió WhatsApp con el resumen');
  };
  const copiarTexto = async () => {
    const ok = await copiar(await armarTexto());
    ok ? toast.ok('Resumen copiado') : toast.error('No se pudo copiar');
  };

  const th = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', width: 96, mono: true, bold: true },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 240, render: (r) => <span title={r.descripcion}>{r.descripcion}</span> },
    { key: 'piezas', label: 'Piezas', width: 72, sum: true, render: (r) => (
      <input type="number" min="0" value={r.piezas ?? ''} onChange={(e) => editarSku(r.sku, { piezas: Number(e.target.value) || 0 })} aria-label={`Piezas de ${r.sku}`}
        style={{ width: 60, height: 24, padding: '0 8px', textAlign: 'right', fontSize: 11, ...th, background: theme.bg, border: `1px solid ${N(r.piezas) > 0 ? theme.border : red}`, borderRadius: 7, color: theme.text, outline: 'none' }} />
    ) },
    { key: 'precio', label: 'Precio propuesta', align: 'left', width: 150, render: (r) => <PrecioPicker r={r} val={r} onChange={(patch) => editarSku(r.sku, patch)} /> },
    { key: 'maaa', label: 'vs MAAA', width: 80, render: (r) => { const m = N(r.precios?.['Mayoreo AAA']); return m > 0 ? <span style={{ color: theme.textMuted }}>{money(m)}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>; } },
    { key: 'desc', label: 'Desc.', width: 62, render: (r) => { const m = N(r.precios?.['Mayoreo AAA']), px = N(r.precio); if (!(m > 0 && px > 0)) return '—'; const d = ((m - px) / m) * 100; return <span style={{ fontWeight: 600, color: d > 0 ? green : d < 0 ? red : theme.textMuted }}>{d > 0 ? '-' : d < 0 ? '+' : ''}{Math.abs(d).toFixed(1)}%</span>; } },
    ...(sensible ? [{ key: 'margen', label: 'Margen', width: 70, render: (r) => { const c = N(r.costo), px = N(r.precio); if (!(c > 0 && px > 0)) return <Pill tone="red" size="xs" title="Falta costo_promedio en precios_sku">sin costo</Pill>; const m = ((px - c) / px) * 100; return <Pill tone={m >= 25 ? 'green' : m >= 15 ? 'orange' : 'red'} size="xs">{m.toFixed(0)}%</Pill>; } }] : []),
    { key: 'total', label: 'Total', width: 96, bold: true, sum: true, render: (r) => money(N(r.piezas) * N(r.precio)), fmt: money },
    { key: 'quitar', label: '', align: 'center', width: 30, render: (r) => (
      <button type="button" title={`Quitar ${r.sku} de la propuesta`} aria-label={`Quitar ${r.sku}`} onClick={() => quitarSku(r.sku)}
        style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer', color: theme.textMuted, padding: 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = red; }} onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; }}>
        <X size={13} />
      </button>
    ) },
  ];
  const filasGrupo = (filas) => filas.map((r) => ({ ...r, total: N(r.piezas) * N(r.precio) }));

  const kpis = [
    { eyebrow: 'Líneas', big: `${propuestaLista.length}`, bigSmall: 'SKUs', sub: `${int(piezas)} piezas · ${piezas > 0 ? money(total / piezas) : '—'} promedio por pieza` },
    { eyebrow: 'Ahorro vs Mayoreo AAA', big: met.ahorroTotal > 0 ? moneyCompact(met.ahorroTotal) : '—', bigColor: met.ahorroTotal > 0 ? green : undefined, sub: met.descuentoProm != null ? `${pct(met.descuentoProm, 1)} de descuento ponderado` : 'sin precio MAAA para comparar' },
    { eyebrow: 'Cierra el gap', big: cierraGapPct != null ? `${cierraGapPct}%` : '✓', bigColor: cierraGapPct == null || cierraGapPct >= 100 ? green : orange, sub: cierraGapPct != null ? `de ${moneyCompact(gap)} pendientes de cuota` : 'la cuota del mes ya está cubierta', progress: cierraGapPct ?? undefined },
    { eyebrow: 'SPIFF ganado', big: spiffTotal > 0 ? money(spiffTotal) : '—', bigColor: spiffTotal > 0 ? (theme.yellow || '#FFCC00') : undefined, sub: spiffTotal > 0 ? `${spiffSkus} SKUs · ${contexto?.spiffsMeta ? `vigente hasta ${new Date(contexto.spiffsMeta.vigencia_fin).toLocaleDateString('es-MX')}` : 'Q actual'}` : 'sin SKUs con SPIFF en la propuesta' },
  ];
  if (sensible) kpis.splice(2, 0, { eyebrow: 'Margen ⌀ vs costo', badge: { l: 'sensible', tone: 'purple' }, big: met.margenProm != null ? pct(met.margenProm, 1) : '—', bigColor: met.margenProm != null ? margenColor(met.margenProm) : undefined, sub: met.sinCosto > 0 ? `${met.sinCosto} SKU${met.sinCosto === 1 ? '' : 's'} sin costo cargado` : 'ponderado por el total de cada línea' });

  const stats = [
    { k: 'Descuento ⌀', v: met.descuentoProm != null ? pct(met.descuentoProm, 1) : '—', sub: 'vs Mayoreo AAA' },
    ...(sensible ? [{ k: 'Margen ⌀', v: met.margenProm != null ? pct(met.margenProm, 1) : '—', sub: 'vs costo · sensible', color: met.margenProm != null ? margenColor(met.margenProm) : undefined }] : []),
    { k: cierraGapPct != null ? 'Cierra gap' : 'Gap', v: cierraGapPct != null ? `${cierraGapPct}%` : 'cubierto', sub: cierraGapPct != null ? `de ${moneyCompact(gap)}` : 'cuota del mes', color: cierraGapPct == null || cierraGapPct >= 100 ? green : orange },
  ];
  const campo = { height: 28, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '0 10px', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, outline: 'none' };
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textMuted };

  return (
    <div ref={rootRef} data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
      <Panel padding="10px 12px">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: cliCol, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 11, alignSelf: 'center' }}>{cliente.iniciales}</span>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 220px', minWidth: 200 }}>
            <span style={lbl}>Nombre de la propuesta <span style={{ color: red }}>*</span></span>
            <input type="text" value={nombre || ''} onChange={(e) => setNombre?.(e.target.value)} placeholder="Ej. Cierre de mes, Resurtido monitores…" aria-label="Nombre de la propuesta"
              style={{ ...campo, color: accent, borderColor: nombreOk ? theme.border : red }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={lbl}>Vigencia</span>
            <input type="date" value={vig} onChange={(e) => setVigencia?.(e.target.value || vigenciaPorDefecto())} aria-label="Vigencia de la propuesta" style={{ ...campo, width: 150 }} />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={lbl}>Referencia</span>
            <div style={{ height: 28, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {modelo?.folio ? <Pill tone="gray" size="xs" title="Folio automático (se asigna al enviar)">{modelo.folio}</Pill> : <Pill tone="gray" size="xs" title="El folio se asigna al enviar">folio al enviar</Pill>}
              <IndicadorGuardado autosave={autosave} />
            </div>
          </div>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Boton icon={Save} onClick={onGuardar} disabled={autosave?.guardando}>Guardar</Boton>
            <Boton icon={Copy} onClick={copiarTexto} title="Copia el resumen limpio (sin costos ni márgenes)">Copiar</Boton>
            <Boton icon={Share2} onClick={compartirTexto} title="Resumen limpio por WhatsApp: nombre, vigencia, líneas y total + IVA" disabled={ocupado}>Compartir</Boton>
            <ExportMenu titulo={`Propuesta ${cliente.label}`} subtitulo={`${(nombre || 'Sin nombre').trim()} · ${MES_FULL[mes - 1]} ${anio} · vigencia al ${vigenciaTexto(vig)}`} excel={exportarExcel} pdf={{ ref: rootRef }} deshabilitado={ocupado} />
          </span>
        </div>
        {!nombreOk && <div style={{ marginTop: 6, fontSize: 10.5, color: red }}>Escribe el nombre para poder exportar o compartir. El folio automático queda como referencia secundaria.</div>}
      </Panel>

      <Hero
        eyebrow={`Revisar propuesta · ${cliente.label} · ${MES_FULL[mes - 1]} ${anio} · vigencia al ${vigenciaTexto(vig)}`}
        titulo={money(total)}
        sub={<>
          <strong style={{ fontWeight: 500 }}>{propuestaLista.length} SKUs · {int(piezas)} piezas.</strong>{' '}
          {met.ahorroTotal > 0 && <>{moneyCompact(met.ahorroTotal)} de ahorro sobre Mayoreo AAA. </>}
          {cierraGapPct != null ? <>Cierra el gap del mes en {cierraGapPct}%.</> : <>El gap del mes ya está cerrado.</>}
          {' '}Se exportará como <b>Propuesta {cliente.label} {(nombre || 'Cierre').trim()} {MES_FULL[new Date().getMonth()]} {new Date().getFullYear()}.xlsx</b>.
        </>}
        stats={stats}
      />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))`, gap: 8 }}>
        {kpis.map((k) => <KpiCard key={k.eyebrow} {...k} />)}
      </div>

      {distribucion.length > 1 && (
        <Panel titulo="Distribución del total por familia" meta={distribucion.some((g) => g.pct > 60) ? `${distribucion.find((g) => g.pct > 60).nombre} concentra ${distribucion.find((g) => g.pct > 60).pct.toFixed(0)}% — considera balancear` : undefined}>
          <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: theme.bg, marginBottom: 8 }}>
            {distribucion.map((g) => <div key={g.nombre} style={{ width: `${g.pct}%`, background: famColor(g.nombre), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600 }}>{g.pct >= 8 ? `${g.pct.toFixed(0)}%` : ''}</div>)}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11 }}>
            {distribucion.map((g) => <span key={g.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.text }}><span style={{ width: 10, height: 10, borderRadius: 3, background: famColor(g.nombre) }} />{g.nombre}<span style={{ ...th, fontWeight: 600 }}>{moneyCompact(g.total)}</span></span>)}
          </div>
        </Panel>
      )}

      {propuestaLista.length === 0 && (
        <Panel padding="24px 16px"><div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>La propuesta quedó vacía. Cierra la hoja y agrega SKUs desde el catálogo.</div></Panel>
      )}
      {Object.entries(grupos).map(([nombreGrupo, filas]) => {
        if (filas.length === 0) return null;
        const totalGrupo = filas.reduce((s, r) => s + N(r.piezas) * N(r.precio), 0);
        const piezasGrupo = filas.reduce((s, r) => s + N(r.piezas), 0);
        return (
          <Panel key={nombreGrupo} titulo={nombreGrupo} meta={`${filas.length} SKUs · ${int(piezasGrupo)} pz · piezas y precio editables`} acciones={<Pill tone="inverse">{money(totalGrupo)}</Pill>} padding="0">
            <TablaCompacta dense columnas={columnas} filas={filasGrupo(filas)} rowKey={(r) => r.sku} totales={{ piezas: piezasGrupo, total: totalGrupo }} />
          </Panel>
        );
      })}
    </div>
  );
}
