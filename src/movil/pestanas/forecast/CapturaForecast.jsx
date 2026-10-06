// Proyectos y forecast · captura del forecast desde el celular (3.83.0 · 2026-10-05, mockup e0c10be2 pantalla 1b).
// Es el renglón exacto del CRM («Tipo · Cliente · SKU · Justificación ≥ 15 caracteres · piezas por mes») hecho para dedo:
// cliente (su tipo sale solo), SKU con el buscador que entiende, el sugerido del dashboard con «Usar sugerido», piezas
// mes a mes con −/+ de 5 o escritas, justificación con dictado, «Guardar y siguiente SKU». Se guarda en forecast_crm como
// borrador (misma tabla y llave que el armador web). «Exportar plantilla del CRM» baja/comparte el Excel exacto del CRM.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Trash2, FileSpreadsheet, Minus, Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { interpretarBusqueda, coincideSku, indiceSku, quitarChip } from '../../../lib/buscarSku';
import { MIN_JUSTIFICACION } from '../../../modules/comercial/proyectos/forecastCalc';
import { useNav } from '../../nav';
import { Cabecera, TituloGrande, ListaAgrupada, Fila, BotonGrande, CampoBusqueda, Pill, toast } from '../../piezas';
import { ChipsEntendido } from '../sellout/DetalleSkuAnual';
import { categoriasDe } from '../sellout/skuAnual';
import { CampoM, BotonMic } from '../agenda5/comun';
import { int, N, MONO } from '../../util';
import { useForecastCliente, guardarBorrador, quitarBorrador, exportarLote, PROPIOS_LISTA, labelDe } from './datos';
import { lineaMeses, ORIGEN_LABEL, ORIGEN_TONE } from './calculo';

const PASO = 5;

function CeldaMes({ m, valor, onChange }) {
  const { theme } = useTheme();
  const [txt, setTxt] = useState(valor ? String(valor) : '');
  useEffect(() => { setTxt(valor ? String(valor) : ''); }, [valor]);
  const fijar = (v) => onChange(Math.max(0, Math.round(N(v))));
  return (
    <div style={{ background: `${theme.text}0A`, borderRadius: 10, padding: '6px 4px 4px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '0.04em' }}>{m.label.split(' ')[0]}</div>
      <input value={txt} inputMode="numeric" pattern="[0-9]*" onChange={(e) => setTxt(e.target.value.replace(/[^\d]/g, ''))} onBlur={() => fijar(txt)} onKeyDown={(e) => { if (e.key === 'Enter') { fijar(txt); e.target.blur(); } }} aria-label={`${m.label} piezas`}
        style={{ width: '100%', height: 30, textAlign: 'center', border: 0, borderRadius: 6, background: 'transparent', color: valor ? theme.text : theme.textMuted, fontFamily: MONO, fontSize: 15, fontWeight: 600, padding: 0, outline: 'none' }} placeholder="0" />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <button type="button" aria-label={`${m.label} menos ${PASO}`} onClick={() => fijar(N(valor) - PASO)} style={{ width: 26, height: 24, border: 0, borderRadius: 6, background: 'transparent', color: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={13} /></button>
        <button type="button" aria-label={`${m.label} más ${PASO}`} onClick={() => fijar(N(valor) + PASO)} style={{ width: 26, height: 24, border: 0, borderRadius: 6, background: 'transparent', color: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={13} /></button>
      </div>
    </div>
  );
}

/** Vista pura del editor de un SKU (para pruebas SSR): sugerido, celdas por mes, justificación. */
export function EditorSku({ sku, descripcion, ventana, meses, onMeses, justificacion, onJustificacion, sugerido = null, origen = null, onUsarSugerido }) {
  const { theme } = useTheme();
  const total = ventana.reduce((s, m) => s + N(meses[m.key]), 0);
  const faltaJust = String(justificacion || '').trim().length < MIN_JUSTIFICACION;
  return (
    <div style={{ background: theme.surface, borderRadius: 14, padding: '12px 14px', marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text }}>{sku}</div>
          <div style={{ fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{descripcion || 'Sin descripción'}</div>
        </div>
        {origen && origen !== 'sugerido' && <Pill tone={ORIGEN_TONE[origen]} size="xs">{ORIGEN_LABEL[origen]}</Pill>}
      </div>
      {sugerido && (
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.4 }}>
          Sugerido del dashboard: {lineaMeses(sugerido.meses, ventana)} · {sugerido.base ? `ritmo ${int(sugerido.base)} pz/mes` : ''}{sugerido.stock ? ` · ${int(sugerido.stock)} pz en el cliente` : ''}
          {' '}<button type="button" onClick={onUsarSugerido} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 600, padding: 0, cursor: 'pointer' }}>Usar sugerido</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(6, ventana.length)}, minmax(0, 1fr))`, gap: 5, marginTop: 10 }}>
        {ventana.map((m) => <CeldaMes key={m.key} m={m} valor={N(meses[m.key])} onChange={(v) => onMeses({ ...meses, [m.key]: v > 0 ? v : null })} />)}
      </div>
      <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>Total {int(total)} pz en {ventana.filter((m) => N(meses[m.key]) > 0).length} mes{ventana.filter((m) => N(meses[m.key]) > 0).length === 1 ? '' : 'es'}</div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: faltaJust ? theme.orange : theme.textMuted, fontWeight: 600, marginBottom: 6 }}>Justificación · mínimo {MIN_JUSTIFICACION} caracteres</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><CampoM value={justificacion || ''} onChange={onJustificacion} multiline placeholder="Por qué va a consumir estas piezas…" /></div>
          <BotonMic onTexto={(t) => onJustificacion(`${justificacion ? `${justificacion} ` : ''}${t}`)} size={40} />
        </div>
      </div>
    </div>
  );
}

export default function CapturaForecast({ clienteInicial = 'digitalife', skuInicial = null, ventana, yoId }) {
  const { theme } = useTheme();
  const nav = useNav();
  const [cliente, setCliente] = useState(clienteInicial);
  const [q, setQ] = useState('');
  const [sku, setSku] = useState(skuInicial);
  const [meses, setMeses] = useState({});
  const [just, setJust] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const fc = useForecastCliente(cliente, ventana);
  const catalogo = fc.roadmap || [];
  const categorias = useMemo(() => categoriasDe(catalogo), [catalogo]);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const resultados = useMemo(() => {
    if (interp.vacio || sku) return [];
    const idx = new Map(catalogo.map((r) => [r.sku, indiceSku(r)]));
    return catalogo.filter((r) => coincideSku(r, interp, idx.get(r.sku))).slice(0, 8);
  }, [catalogo, interp, sku]);
  const fila = useMemo(() => (sku ? fc.estado.filas.find((f) => f.sku === sku) || null : null), [sku, fc.estado]);
  const sugerido = useMemo(() => (sku ? fc.sugerido.find((s) => s.sku === sku) || (fila?.origen === 'sugerido' ? fila : null) : null), [sku, fc.sugerido, fila]);
  const desc = useMemo(() => (sku ? catalogo.find((r) => r.sku === sku)?.descripcion || fila?.descripcion || '' : ''), [sku, catalogo, fila]);
  // Al elegir un SKU: lo ya capturado se edita; si sólo hay sugerido, se propone; si nada, en blanco.
  useEffect(() => {
    if (!sku) return;
    if (fila && fila.origen !== 'sugerido') { setMeses({ ...fila.meses }); setJust(fila.justificacion || ''); }
    else if (sugerido) { setMeses({ ...sugerido.meses }); setJust(sugerido.justificacion || ''); }
    else { setMeses({}); setJust(''); }
  }, [sku, fila?.origen, fila?.total]); // eslint-disable-line react-hooks/exhaustive-deps
  const borradores = useMemo(() => fc.estado.filas.filter((f) => f.origen === 'borrador'), [fc.estado]);
  const total = ventana.reduce((s, m) => s + N(meses[m.key]), 0);

  const elegir = (s) => { setSku(s); setQ(''); };
  const guardar = async () => {
    if (!sku) return;
    if (total <= 0) { toast.error('Pon piezas en al menos un mes'); return; }
    if (String(just).trim().length < MIN_JUSTIFICACION) { toast.error(`La justificación necesita ${MIN_JUSTIFICACION} caracteres (el CRM la rechaza)`); return; }
    setOcupado(true);
    try { await guardarBorrador({ cliente, sku, meses, justificacion: just.trim(), yoId, ventana }); toast.ok(`${sku} · ${int(total)} pz guardado como borrador`); setSku(null); setMeses({}); setJust(''); }
    catch (e) { toast.error(`No se pudo guardar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };
  const quitar = async (f) => { try { await quitarBorrador({ cliente, sku: f.sku }); toast.ok(`${f.sku} quitado del borrador`); if (sku === f.sku) setSku(null); } catch (e) { toast.error(e?.message || 'No se pudo quitar'); } };
  const exportar = async () => {
    if (!borradores.length || ocupado) return;
    setOcupado(true);
    try { const r = await exportarLote({ cliente, filas: borradores, ventana, yoId }); toast.ok(r.resultado === 'share' ? `${r.nombre} compartido · ${r.n} SKUs` : `${r.nombre} · ${r.n} SKUs · súbelo en el CRM con «Cargar Excel»`); }
    catch (e) { toast.error(`No se pudo exportar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };
  const cli = PROPIOS_LISTA.find((c) => c.key === cliente);

  return (
    <div style={{ paddingBottom: 24 }}>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Capturar forecast" sub={`${labelDe(cliente)} · ${cli?.tipo || 'directa'} · ${ventana[0]?.label.split(' ')[0].toLowerCase()} → ${ventana[ventana.length - 1]?.label.split(' ')[0].toLowerCase()}`} />
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px 10px' }}>
        {PROPIOS_LISTA.map((c) => <Pill key={c.key} tone={cliente === c.key ? 'blue' : 'gray'} onClick={() => { setCliente(c.key); setSku(null); }} style={{ cursor: 'pointer', flexShrink: 0 }}>{c.label}</Pill>)}
      </div>
      <div style={{ padding: '0 16px' }}>
        {!sku && (
          <>
            <CampoBusqueda value={q} onChange={setQ} placeholder="SKU, marca, categoría, pulgadas…" autoFocus={!skuInicial} />
            <ChipsEntendido chips={interp.chips} onQuitar={(c) => setQ(quitarChip(q, c, { categorias }))} />
          </>
        )}
        {sku && <button type="button" onClick={() => setSku(null)} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13, padding: '4px 0', cursor: 'pointer' }}>‹ Otro SKU</button>}
      </div>
      {resultados.length > 0 && (
        <ListaAgrupada titulo="Resultados" meta={resultados.length} style={{ marginTop: 10 }}>
          {resultados.map((r) => {
            const f = fc.estado.filas.find((x) => x.sku === r.sku);
            return <Fila key={r.sku} titulo={r.sku} sub={[r.descripcion, r.categoria].filter(Boolean).join(' · ')} pill={f ? { tone: ORIGEN_TONE[f.origen], label: f.origen === 'sugerido' ? `sugerido ${int(f.total)} pz` : `${ORIGEN_LABEL[f.origen]} · ${int(f.total)} pz` } : null} onClick={() => elegir(r.sku)} />;
          })}
        </ListaAgrupada>
      )}
      {!sku && interp.vacio && fc.estado.resumen.porCapturar.skus > 0 && (
        <ListaAgrupada titulo="Sugeridos por capturar" meta={fc.estado.resumen.porCapturar.skus} style={{ marginTop: 10 }} pie="El dashboard sugiere con el ritmo de 3 meses cerrados, la estacionalidad y el inventario en el cliente. Toca uno para aceptarlo o ajustarlo.">
          {fc.estado.filas.filter((f) => f.origen === 'sugerido').slice(0, 12).map((f) => <Fila key={f.sku} titulo={`${f.sku}${f.descripcion ? ` ${f.descripcion}` : ''}`} sub={lineaMeses(f.meses, ventana)} valor={`${int(f.total)} pz`} onClick={() => elegir(f.sku)} />)}
        </ListaAgrupada>
      )}
      {sku && (
        <div style={{ padding: '0 16px' }}>
          <EditorSku sku={sku} descripcion={desc} ventana={ventana} meses={meses} onMeses={setMeses} justificacion={just} onJustificacion={setJust} sugerido={sugerido && fila?.origen !== 'sugerido' ? sugerido : (fila?.origen === 'sugerido' ? fila : null)} origen={fila?.origen || null}
            onUsarSugerido={() => { const s = sugerido || fila; if (s) { setMeses({ ...s.meses }); if (!just) setJust(s.justificacion || ''); } }} />
          <div style={{ marginTop: 12 }}><BotonGrande primario icon={Check} disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar y siguiente SKU'}</BotonGrande></div>
        </div>
      )}
      {borradores.length > 0 && (
        <ListaAgrupada titulo={`Borradores · ${labelDe(cliente)}`} meta={`${borradores.length} SKU${borradores.length === 1 ? '' : 's'} · ${int(borradores.reduce((s, f) => s + f.total, 0))} pz`} style={{ marginTop: 18 }} pie="Lo que captures aquí también se ve en la computadora. Al exportar, estas filas pasan a «exportadas» y el archivo se sube tal cual en el CRM con «Cargar Excel».">
          {borradores.map((f) => (
            <Fila key={f.sku} titulo={`${f.sku}${f.descripcion ? ` ${f.descripcion}` : ''}`} sub={lineaMeses(f.meses, ventana)} valor={`${int(f.total)} pz`} chevron={false} onClick={() => elegir(f.sku)}
              trailing={<button type="button" onClick={(e) => { e.stopPropagation(); quitar(f); }} aria-label="Quitar" style={{ border: 0, background: 'transparent', color: theme.textMuted, padding: 6, cursor: 'pointer' }}><Trash2 size={15} /></button>} />
          ))}
        </ListaAgrupada>
      )}
      <div style={{ margin: '16px 16px 0' }}>
        <BotonGrande icon={FileSpreadsheet} disabled={!borradores.length || ocupado} onClick={exportar}>Exportar plantilla del CRM{borradores.length ? ` · ${borradores.length}` : ''}</BotonGrande>
      </div>
    </div>
  );
}
