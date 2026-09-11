// Registrar / editar OC (HojaLateral): cliente, número de OC, fecha recibida, folios de factura (chips), SKUs (buscar en
// roadmap, piezas, precio opcional), notas. Modo "pegar correo": textarea → parserCorreoOC → vista previa editable con avisos.
// Modo "folios": sólo captura de folios. Modo "convertir": viene de una cotización aceptada.
import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, ClipboardPaste, Wand2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { CLIENTES, isoDia, fmtInt, fmtMoney, normalizar, tokens as toks, nombreCliente } from './textos';
import { parsearCorreoOC } from './parserCorreoOC';
import { guardarOC } from './datos';
import { Campo, Input, Select, TextArea, Chips, Nota, Fila2 } from './ui';

const vacia = (cliente = '') => ({ id: null, cliente_key: cliente, numero_oc_cliente: '', fecha_recibida: isoDia(new Date()), facturas: [], notas: '', fuente: 'manual', cotizacion_id: null });

function BuscadorSku({ roadmap, onElegir }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const res = useMemo(() => {
    const t = toks(q); if (!t.length) return [];
    const out = [];
    for (const r of roadmap) { const hay = normalizar(`${r.sku} ${r.descripcion || ''} ${r.marca || ''} ${r.familia || ''}`); if (t.every((x) => hay.includes(x))) { out.push(r); if (out.length >= 8) break; } }
    return out;
  }, [q, roadmap]);
  const elegir = (r) => { onElegir(r); setQ(''); };
  return (
    <div style={{ position: 'relative' }}>
      <Input value={q} onChange={setQ} placeholder="Buscar SKU o descripción y Enter…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const exacto = res.find((r) => r.sku.toUpperCase() === q.trim().toUpperCase()) || res[0]; if (exacto) elegir(exacto); else if (/^[A-Z]{2}-\w{5,7}$/i.test(q.trim())) elegir({ sku: q.trim().toUpperCase(), descripcion: '' }); } }} />
      {res.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 5, top: 34, left: 0, right: 0, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          {res.map((r) => (
            <button key={r.sku} type="button" onClick={() => elegir(r)} style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', padding: '6px 10px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, minWidth: 82 }}>{r.sku}</span><span style={{ color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const normFolio = (f) => String(f || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Vista previa de las facturas del ERP cuyos folios se capturaron: SKUs, piezas, precio y total, sin teclear nada. */
function FacturasPreview({ folios, erpFacturas, clienteKey, onUsarComoPedido }) {
  const { theme } = useTheme();
  const filas = useMemo(() => {
    const idx = new Map();
    for (const f of erpFacturas || []) idx.set(normFolio(f.folio), f);
    return (folios || []).map((folio) => ({ folio, f: idx.get(normFolio(folio)) || null }));
  }, [folios, erpFacturas]);
  if (!filas.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {filas.map(({ folio, f }) => (
        <div key={folio} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden', background: theme.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: f ? `1px solid ${theme.border}` : 0, fontSize: 11.5 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{folio}</span>
            {f ? (
              <>
                <Pill tone="green" size="xs">ERP</Pill>
                <span style={{ color: theme.textMuted }}>{f.fecha ? String(f.fecha).slice(0, 10) : ''} · {fmtInt(f.n_partidas)} SKU · {fmtInt(f.piezas)} pz</span>
                <span style={{ marginLeft: 'auto', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(f.monto)}</span>
                {f.cliente_key && clienteKey && f.cliente_key !== clienteKey && <Pill tone="orange" size="xs">otro cliente en ERP</Pill>}
                {onUsarComoPedido && <Boton onClick={() => onUsarComoPedido(f)}>Usar como pedido</Boton>}
              </>
            ) : (
              <span style={{ color: theme.textMuted }}>no está en el ERP de los últimos 60 días · se ligará cuando cargue</span>
            )}
          </div>
          {f && (
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 64px 84px 92px', gap: 6, padding: '3px 10px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted }}>
                <span>SKU</span><span>Descripción</span><span style={{ textAlign: 'right' }}>Pz</span><span style={{ textAlign: 'right' }}>Precio</span><span style={{ textAlign: 'right' }}>Monto</span>
              </div>
              {(f.partidas || []).map((p) => (
                <div key={p.sku} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 64px 84px 92px', gap: 6, padding: '3px 10px', fontSize: 11, borderTop: `1px solid ${theme.border}`, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{p.sku}</span>
                  <span style={{ color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion}</span>
                  <span style={{ textAlign: 'right' }}>{fmtInt(p.piezas)}</span>
                  <span style={{ textAlign: 'right' }}>{p.piezas ? fmtMoney(Number(p.monto) / Number(p.piezas)) : '—'}</span>
                  <span style={{ textAlign: 'right' }}>{fmtMoney(p.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FormOC({ abierto, onClose, modo = 'nueva', oc = null, cotizacion = null, roadmap = [], roadmapMap, email, onGuardado, erpFacturas = [] }) {
  const { theme } = useTheme();
  const [form, setForm] = useState(vacia());
  const [skus, setSkus] = useState([]);
  const [texto, setTexto] = useState('');
  const [avisos, setAvisos] = useState([]);
  const [leido, setLeido] = useState(false);
  const [saving, setSaving] = useState(false);
  const soloFolios = modo === 'folios';

  useEffect(() => {
    if (!abierto) return;
    setTexto(''); setAvisos([]); setLeido(false);
    if (oc) {
      setForm({ id: oc.id, cliente_key: oc.cliente_key, numero_oc_cliente: oc.numero_oc_cliente || '', fecha_recibida: isoDia(oc.fecha_recibida), facturas: [...(oc.facturas || []).map((f) => (typeof f === 'string' ? f : f.folio)), ...(oc.folioPendientes || [])].filter((v, i, a) => a.indexOf(v) === i), notas: oc.notas || '', fuente: oc.fuente || 'manual', cotizacion_id: oc.cotizacion_id || null });
      setSkus((oc.skusCalc || []).filter((s) => !s.noPedido).map((s) => ({ sku: s.sku, descripcion: s.descripcion, cantidad_ordenada: s.pedido, precio_unitario: s.precio || '' })));
    } else if (cotizacion) {
      setForm({ ...vacia(cotizacion.cliente_key), notas: cotizacion.notas || '', fuente: 'cotizacion', cotizacion_id: cotizacion.id, numero_oc_cliente: '' });
      setSkus([]);
    } else { setForm(vacia()); setSkus([]); }
  }, [abierto, oc, cotizacion]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setSku = (i, k, v) => setSkus((p) => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const addSku = (r) => setSkus((p) => (p.some((s) => s.sku === r.sku) ? p : [...p, { sku: r.sku, descripcion: r.descripcion || roadmapMap?.get(r.sku)?.descripcion || '', cantidad_ordenada: r.cantidad || '', precio_unitario: r.precio || '' }]));

  const leer = () => {
    const r = parsearCorreoOC(texto);
    setAvisos(r.avisos); setLeido(true);
    setForm((p) => ({ ...p, cliente_key: r.cliente_key || p.cliente_key, numero_oc_cliente: r.numero_oc || p.numero_oc_cliente, fecha_recibida: r.fecha || p.fecha_recibida, fuente: 'correo', notas: r.asunto ? `Correo: ${r.asunto}` : p.notas }));
    setSkus(r.lineas.map((l) => ({ sku: l.sku, descripcion: l.descripcion || roadmapMap?.get(l.sku)?.descripcion || '', cantidad_ordenada: l.cantidad || '', precio_unitario: l.precio || '' })));
  };
  const totalPz = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0), 0);
  const valido = form.cliente_key && form.numero_oc_cliente.trim() && (soloFolios || form.fecha_recibida) && (soloFolios || skus.length === 0 || skus.every((s) => s.sku && Number(s.cantidad_ordenada) > 0));

  const guardar = async () => {
    if (!valido) return;
    setSaving(true);
    try {
      const id = await guardarOC({ ...form, fecha_recibida: form.fecha_recibida ? new Date(`${form.fecha_recibida}T12:00:00`).toISOString() : null }, soloFolios ? (oc?.skusCalc || []).filter((s) => !s.noPedido).map((s) => ({ sku: s.sku, cantidad_ordenada: s.pedido, precio_unitario: s.precio })) : skus, email);
      toast.ok(oc ? 'OC actualizada' : cotizacion ? 'Cotización convertida en OC' : 'OC registrada');
      onGuardado?.(id); onClose?.();
    } catch (e) { toast.error(`No se pudo guardar: ${e.message}`); }
    finally { setSaving(false); }
  };

  const titulo = soloFolios ? 'Folios de factura' : modo === 'pegar' ? 'Pegar correo' : cotizacion ? 'Convertir en OC' : oc ? 'Editar OC' : 'Registrar OC';
  const sub = soloFolios ? `OC ${oc?.numero_oc_cliente} · ${nombreCliente(oc?.cliente_key)} · la liga con el ERP se hace sola al guardar` : modo === 'pegar' ? 'Pega el texto del correo: se leen OC, cliente, fecha y líneas; revisa la vista previa' : cotizacion ? `Cotización ${cotizacion.folio || ''} · ${nombreCliente(cotizacion.cliente_key)}` : 'Karolina sólo registra la OC; facturas y guías llegan del ERP';
  return (
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} titulo={titulo} sub={sub} ancho={560}
      acciones={<Boton primario onClick={guardar} disabled={!valido || saving}>{saving ? 'Guardando…' : 'Guardar'}</Boton>}>
      {modo === 'pegar' && (
        <div style={{ marginBottom: 12 }}>
          <Campo label="Texto del correo" sub="Ctrl/⌘+V y luego «Leer»">
            <TextArea value={texto} onChange={setTexto} filas={7} autoFocus placeholder={'Asunto: Orden de compra 4500218\nAC-943178 Mouse … 200 pz\nAC-943253 Monitor … 150 pz'} mono />
          </Campo>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <Boton primario icon={Wand2} onClick={leer} disabled={!texto.trim()}>Leer</Boton>
            <Boton icon={ClipboardPaste} onClick={async () => { try { const t = await navigator.clipboard.readText(); setTexto(t); } catch { toast.info('Pega con Ctrl/⌘+V en el cuadro'); } }}>Pegar del portapapeles</Boton>
          </div>
          {leido && avisos.length > 0 && <Nota tone="orange">{avisos.map((a, i) => <div key={i}>• {a}</div>)}</Nota>}
          {leido && !avisos.length && <Nota tone="green">Todo se leyó bien: revisa la vista previa y guarda.</Nota>}
        </div>
      )}
      {(modo !== 'pegar' || leido) && (
        <>
          {!soloFolios && (
            <Fila2 cols="1fr 1fr 1fr">
              <Campo label="Cliente"><Select value={form.cliente_key} onChange={(v) => set('cliente_key', v)} placeholder="Elegir…" opciones={CLIENTES.map((c) => ({ id: c.key, label: c.nombre }))} /></Campo>
              <Campo label="Número de OC" sub="como lo escribe el cliente"><Input value={form.numero_oc_cliente} onChange={(v) => set('numero_oc_cliente', v)} mono placeholder="4500218 · OC-48211" autoFocus={modo === 'nueva'} /></Campo>
              <Campo label="Fecha recibida"><Input type="date" value={form.fecha_recibida} onChange={(v) => set('fecha_recibida', v)} /></Campo>
            </Fila2>
          )}
          <Campo label="Folios de factura" sub="opcional · el ERP también liga por referencia">
            <Chips items={form.facturas} onChange={(v) => set('facturas', v)} placeholder="A10381203 y Enter" />
            <FacturasPreview folios={form.facturas} erpFacturas={erpFacturas} clienteKey={form.cliente_key}
              onUsarComoPedido={soloFolios ? null : (f) => { setSkus((p) => { const m = new Map(p.map((s) => [s.sku, s])); for (const x of f.partidas || []) { const prev = m.get(x.sku); const precio = x.piezas ? Math.round((Number(x.monto) / Number(x.piezas)) * 100) / 100 : ''; if (prev) m.set(x.sku, { ...prev, cantidad_ordenada: (Number(prev.cantidad_ordenada) || 0) + (Number(x.piezas) || 0), precio_unitario: prev.precio_unitario || precio }); else m.set(x.sku, { sku: x.sku, descripcion: x.descripcion || roadmapMap?.get(x.sku)?.descripcion || '', cantidad_ordenada: Number(x.piezas) || 0, precio_unitario: precio }); } return Array.from(m.values()); }); toast.ok(`${fmtInt(f.n_partidas)} partidas de ${f.folio} agregadas al pedido`); }} />
          </Campo>
          {!soloFolios && (
            <>
              <Campo label="SKUs del pedido" sub={skus.length ? `${skus.length} SKU · ${fmtInt(totalPz)} pz` : 'busca en el roadmap o escribe el SKU'}>
                <BuscadorSku roadmap={roadmap} onElegir={addSku} />
                {skus.length > 0 && (
                  <div style={{ marginTop: 8, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 72px 84px 28px', gap: 6, padding: '4px 8px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>
                      <span>SKU</span><span>Descripción</span><span style={{ textAlign: 'right' }}>Piezas</span><span style={{ textAlign: 'right' }}>Precio</span><span />
                    </div>
                    {skus.map((s, i) => (
                      <div key={s.sku} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 72px 84px 28px', gap: 6, padding: '4px 8px', alignItems: 'center', borderBottom: i < skus.length - 1 ? `1px solid ${theme.border}` : 0 }}>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text }}>{s.sku}</span>
                        <Input value={s.descripcion} onChange={(v) => setSku(i, 'descripcion', v)} placeholder="descripción" style={{ height: 26, fontSize: 11.5 }} />
                        <Input type="number" value={s.cantidad_ordenada} onChange={(v) => setSku(i, 'cantidad_ordenada', v)} mono style={{ height: 26, textAlign: 'right', fontSize: 11.5 }} />
                        <Input type="number" value={s.precio_unitario} onChange={(v) => setSku(i, 'precio_unitario', v)} mono placeholder="$" style={{ height: 26, textAlign: 'right', fontSize: 11.5 }} />
                        <button type="button" title="Quitar" onClick={() => setSkus((p) => p.filter((_, j) => j !== i))} style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', padding: 0 }}><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </Campo>
              <Campo label="Notas"><TextArea value={form.notas} onChange={(v) => set('notas', v)} filas={2} placeholder="Condiciones, contacto, urgencia…" /></Campo>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: theme.textMuted }}>
                <Pill tone="gray" size="xs">fuente: {form.fuente}</Pill>
                {form.cotizacion_id && <Pill tone="purple" size="xs">desde cotización</Pill>}
                {!skus.length && <span>Sin SKUs se puede guardar; el pedido se llenará con las partidas de la factura del ERP al ligar.</span>}
              </div>
            </>
          )}
        </>
      )}
      {modo === 'pegar' && !leido && <div style={{ fontSize: 11.5, color: theme.textMuted }}><Plus size={11} style={{ verticalAlign: -2 }} /> Reconoce «OC-48211», «Orden de compra: 4500218», «DT-0931», fechas y líneas «AC-943178 … 200 pz». No hay ejemplos reales de correo todavía: si algo no se lee, corrígelo en la vista previa.</div>}
    </HojaLateral>
  );
}
