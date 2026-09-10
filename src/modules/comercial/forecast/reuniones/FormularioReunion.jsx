// FormularioReunion — hoja lateral para registrar / editar una reunión S&OP.
// modo 'correo': textarea "Pega aquí el correo" → Interpretar (parserCorreo) → vista previa editable → Guardar.
// modo 'manual': el mismo formulario vacío. modo 'editar': el formulario con la reunión existente.
// Sólo kit + piezas de perfil/comun; nada de Tailwind de color ni hex.
import React, { useMemo, useState } from 'react';
import { Trash2, Plus, Sparkles, ArrowLeft, Search } from 'lucide-react';
import { TYPO } from '../../../../lib/themeTokens';
import { Boton, Pill, TablaCompacta, toast } from '../../../../components/kit';
import { HojaLateral, Campo, suaveBg, hairline } from '../../../../components/perfil/comun';
import { fmtInt } from '../../inventario/constantes';
import { parsearCorreo, enriquecerLineas, proponerFolio, MESES_NOMBRE, SKU_RE } from './parserCorreo';

const hoy = new Date();
const FORM_VACIO = () => ({
  folio: '', anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, titulo: `Compras S&OP ${MESES_NOMBRE[hoy.getMonth()]} ${hoy.getFullYear()}`,
  solicita: '', fecha: hoy.toISOString().slice(0, 10), nota: '', nota_autor: '', siguientes: [], lineas: [], avisos: [], fuente: 'manual', correo_raw: null,
});

const formDesdeReunion = (r, lineas) => ({
  folio: r.folio, anio: r.anio, mes: r.mes, titulo: r.titulo || '', solicita: r.solicita || '', fecha: r.fecha_reunion || '', nota: r.nota || '',
  nota_autor: r.nota_autor || '', siguientes: Array.isArray(r.siguientes) ? r.siguientes.map((s) => ({ ...s })) : [], lineas: lineas.map((l) => ({ ...l })),
  avisos: [], fuente: r.fuente || 'manual', correo_raw: r.correo_raw ?? null,
});

function Etiqueta({ theme, children }) {
  return <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 4 }}>{children}</div>;
}

function Area({ theme, value, onChange, placeholder, filas = 4, mono = false, autoFocus }) {
  const [foco, setFoco] = useState(false);
  return (
    <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={filas} autoFocus={autoFocus}
      onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, fontFamily: mono ? '"SF Mono", ui-monospace, Menlo, monospace' : TYPO.fontText, fontSize: mono ? 11.5 : 12.5, lineHeight: 1.45,
        color: theme.text, background: suaveBg(theme), border: `1px solid ${foco ? theme.accent : 'transparent'}`, outline: 'none', resize: 'vertical',
        boxShadow: foco ? `0 0 0 3px ${theme.accentBg || 'rgba(0,122,255,0.15)'}` : 'none',
      }} />
  );
}

function CeldaInput({ theme, value, onChange, numero = false, ancho = '100%', placeholder }) {
  return (
    <input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(numero ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{ width: ancho, boxSizing: 'border-box', height: 24, padding: '0 6px', borderRadius: 6, border: `1px solid ${hairline(theme)}`, background: theme.surface, color: theme.text, fontFamily: numero ? TYPO.fontDisplay : TYPO.fontText, fontSize: 11.5, textAlign: numero ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', outline: 'none' }} />
  );
}

/** Buscador de SKU en roadmap + filas del motor para agregar una línea a mano. */
function AgregarSku({ theme, catalogos, onAgregar, yaEstan }) {
  const [q, setQ] = useState('');
  const universo = useMemo(() => {
    const m = new Map();
    for (const r of catalogos.roadmap || []) if (r.sku) m.set(r.sku.toUpperCase(), { sku: r.sku.toUpperCase(), marca: r.marca || '', familia: r.familia || '', descripcion: r.descripcion || '' });
    for (const [sku, r] of Object.entries(catalogos.rowsBySku || {})) if (!m.has(sku.toUpperCase())) m.set(sku.toUpperCase(), { sku: sku.toUpperCase(), marca: r.marca || '', familia: r.familia || '', descripcion: r.descripcion || '' });
    return Array.from(m.values());
  }, [catalogos]);
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = tokens.length ? universo.filter((u) => { const t = `${u.sku} ${u.marca} ${u.familia} ${u.descripcion}`.toLowerCase(); return tokens.every((k) => t.includes(k)) && !yaEstan.has(u.sku); }).slice(0, 8) : [];
  const skuLibre = q.trim().toUpperCase();
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Search size={13} style={{ color: theme.textMuted }} />
        <Campo theme={theme} value={q} onChange={setQ} placeholder="Agregar SKU: busca por código, familia o descripción…" ancho="100%" style={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) { onAgregar(hits[0]); setQ(''); } }} />
        {SKU_RE.test(skuLibre) && !hits.length && !yaEstan.has(skuLibre) && <Boton icon={Plus} onClick={() => { onAgregar({ sku: skuLibre, marca: '', familia: '', descripcion: '' }); setQ(''); }}>Agregar {skuLibre}</Boton>}
      </div>
      {hits.length > 0 && (
        <div style={{ marginTop: 4, border: `1px solid ${hairline(theme)}`, borderRadius: 8, overflow: 'hidden', background: theme.surface }}>
          {hits.map((h) => (
            <button key={h.sku} type="button" onClick={() => { onAgregar(h); setQ(''); }}
              style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '5px 8px', border: 0, borderBottom: `1px solid ${hairline(theme)}`, background: 'transparent', color: theme.text, cursor: 'pointer', textAlign: 'left', fontFamily: TYPO.fontText, fontSize: 11.5 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, minWidth: 82 }}>{h.sku}</span>
              <span style={{ color: theme.textMuted, minWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.marca} · {h.familia}</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FormularioReunion({ abierto, onClose, theme, modo = 'correo', reunion = null, lineasIniciales = [], catalogos = {}, folios = [], onGuardar }) {
  const editar = modo === 'editar' && reunion;
  const [paso, setPaso] = useState(modo === 'correo' ? 'pegar' : 'previa');
  const [texto, setTexto] = useState('');
  const [form, setForm] = useState(() => (editar ? formDesdeReunion(reunion, lineasIniciales) : FORM_VACIO()));
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLinea = (i, k, v) => setForm((f) => ({ ...f, lineas: f.lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const quitarLinea = (i) => setForm((f) => ({ ...f, lineas: f.lineas.filter((_, j) => j !== i) }));
  const agregarLinea = (h) => setForm((f) => ({ ...f, lineas: [...f.lineas, { orden: f.lineas.length + 1, sku: h.sku, marca: h.marca, familia: h.familia, descripcion: h.descripcion, cantidad: 0, comentario: '' }] }));
  const setSig = (i, k, v) => setForm((f) => ({ ...f, siguientes: f.siguientes.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));

  const interpretar = () => {
    if (!texto.trim()) { toast.error('Pega primero el correo.'); return; }
    const r = parsearCorreo(texto);
    const lineas = enriquecerLineas(r.lineas, catalogos);
    const anio = r.anio || hoy.getFullYear(), mes = r.mes || hoy.getMonth() + 1;
    const folio = r.folio || proponerFolio(anio, mes, folios);
    const avisos = [...r.avisos];
    if (folios.includes(folio)) avisos.push(`El folio ${folio} ya existe: se guardará como ${proponerFolio(anio, mes, folios)}.`);
    const sinCatalogo = lineas.filter((l) => !l.enCatalogo).map((l) => l.sku);
    if (sinCatalogo.length) avisos.push(`SKU fuera del roadmap/reporte: ${sinCatalogo.join(', ')}.`);
    setForm({ ...FORM_VACIO(), ...r, anio, mes, folio, titulo: r.titulo || `Compras S&OP ${MESES_NOMBRE[mes - 1]} ${anio}`, fecha: r.fecha || `${anio}-${String(mes).padStart(2, '0')}-01`, lineas, avisos, fuente: 'correo', correo_raw: texto });
    setPaso('previa');
    toast.ok(`${lineas.length} líneas interpretadas`);
  };

  const guardar = async () => {
    if (!form.lineas.length) { toast.error('La reunión no tiene líneas.'); return; }
    if (form.lineas.some((l) => !(Number(l.cantidad) > 0))) { toast.error('Hay líneas sin cantidad.'); return; }
    if (!form.anio || !form.mes) { toast.error('Falta el mes de la reunión.'); return; }
    setGuardando(true);
    try { await onGuardar(form); onClose(); }
    catch (e) { console.error('[S&OP reuniones] guardar', e); toast.error(`No se pudo guardar: ${e?.message || e}`); }
    finally { setGuardando(false); }
  };

  const totalPz = form.lineas.reduce((a, l) => a + (Number(l.cantidad) || 0), 0);
  const yaEstan = useMemo(() => new Set(form.lineas.map((l) => String(l.sku).toUpperCase())), [form.lineas]);
  const titulo = editar ? `Editar ${reunion.folio}` : modo === 'manual' ? 'Capturar reunión a mano' : 'Registrar reunión';
  const sub = paso === 'pegar' ? 'Pega el correo "ACTECK - SOLICITUD DE COMPRA" tal cual (Cmd+A, Cmd+C en el correo)' : `${form.lineas.length} SKUs · ${fmtInt(totalPz)} pz`;

  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 88, render: (l) => <span title={`${l.marca || ''} · ${l.familia || ''}`}>{l.sku}</span> },
    { key: 'familia', label: 'Marca · familia', align: 'left', width: 140, maxWidth: 140, render: (l) => <span style={{ color: theme.textMuted, fontSize: 10.5 }}>{[l.marca, l.familia].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 220, render: (l) => <span title={l.descripcion}>{l.descripcion || <span style={{ color: theme.textMuted }}>sin descripción</span>}</span> },
    { key: 'cantidad', label: 'Cantidad', width: 84, render: (l, i) => <CeldaInput theme={theme} numero value={l.cantidad} onChange={(v) => setLinea(i, 'cantidad', v === '' ? '' : Number(v))} /> },
    { key: 'comentario', label: 'Comentarios', align: 'left', width: 180, render: (l, i) => <CeldaInput theme={theme} value={l.comentario} onChange={(v) => setLinea(i, 'comentario', v)} placeholder="—" /> },
    { key: 'x', label: '', width: 28, render: (l, i) => <button type="button" title="Quitar" onClick={() => quitarLinea(i)} style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', padding: 2, display: 'inline-flex' }}><Trash2 size={12} /></button> },
  ];

  return (
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} ancho={820} titulo={titulo} sub={sub}
      acciones={paso === 'previa' ? <Boton primario onClick={guardar} disabled={guardando || !form.lineas.length}>{guardando ? 'Guardando…' : editar ? 'Guardar cambios' : 'Guardar reunión'}</Boton> : null}>
      {paso === 'pegar' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Area theme={theme} value={texto} onChange={setTexto} filas={22} mono autoFocus
            placeholder={'ACTECK - SOLICITUD DE COMPRA\nCompras S&OP Septiembre 2026\n47 SKUs · 120,812 piezas · solicita David Millán\nSOP-202609\n…\nMARCA  FAMILIA  SKU  DESCRIPCION  CANTIDAD  COMENTARIOS\n…'} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Boton primario icon={Sparkles} onClick={interpretar} disabled={!texto.trim()}>Interpretar</Boton>
            <Boton onClick={() => { setForm(FORM_VACIO()); setPaso('previa'); }}>Capturar a mano</Boton>
            <span style={{ fontSize: 11, color: theme.textMuted }}>También acepta el HTML del correo (si trae la tabla, se lee celda por celda).</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {form.avisos.length > 0 && (
            <div style={{ border: `1px solid ${hairline(theme)}`, borderRadius: 10, padding: '8px 10px', background: suaveBg(theme), fontSize: 11.5, color: theme.text }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Pill tone="orange" size="xs">Revisar</Pill><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12 }}>Lo que no pude interpretar del todo</span></div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>{form.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
            <div><Etiqueta theme={theme}>Folio</Etiqueta><Campo theme={theme} value={form.folio} onChange={(v) => set('folio', v.toUpperCase())} placeholder="SOP-AAAAMM" ancho="100%" /></div>
            <div>
              <Etiqueta theme={theme}>Mes</Etiqueta>
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={form.mes} onChange={(e) => set('mes', Number(e.target.value))} style={{ flex: 1, height: 30, borderRadius: 8, border: 0, background: suaveBg(theme), color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, padding: '0 6px' }}>
                  {MESES_NOMBRE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <Campo theme={theme} type="number" value={form.anio} onChange={(v) => set('anio', Number(v))} ancho={70} />
              </div>
            </div>
            <div><Etiqueta theme={theme}>Solicita</Etiqueta><Campo theme={theme} value={form.solicita} onChange={(v) => set('solicita', v)} placeholder="David Millán" ancho="100%" /></div>
            <div><Etiqueta theme={theme}>Fecha de la reunión</Etiqueta><Campo theme={theme} type="date" value={form.fecha} onChange={(v) => set('fecha', v)} ancho="100%" /></div>
          </div>
          <div><Etiqueta theme={theme}>Título</Etiqueta><Campo theme={theme} value={form.titulo} onChange={(v) => set('titulo', v)} ancho="100%" /></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Etiqueta theme={theme}>Nota de</Etiqueta><Campo theme={theme} value={form.nota_autor} onChange={(v) => set('nota_autor', v)} placeholder="DAVID" ancho={120} style={{ height: 24, marginBottom: 4 }} /></div>
            <Area theme={theme} value={form.nota} onChange={(v) => set('nota', v)} filas={3} placeholder="Texto libre de la nota…" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Etiqueta theme={theme}>Líneas · {form.lineas.length} SKUs · {fmtInt(totalPz)} pz</Etiqueta>
            </div>
            <TablaCompacta dense columnas={columnas} filas={form.lineas} rowKey={(l, i) => `${l.sku}-${i}`} maxHeight={360} vacio="Sin líneas. Agrega SKUs abajo."
              totales={{ sku: 'Total', cantidad: totalPz }} />
            <AgregarSku theme={theme} catalogos={catalogos} onAgregar={agregarLinea} yaEstan={yaEstan} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Etiqueta theme={theme}>Qué sigue · por rol</Etiqueta>
              <Boton icon={Plus} onClick={() => set('siguientes', [...form.siguientes, { rol: '', accion: '' }])} style={{ height: 24 }}>Rol</Boton>
            </div>
            {form.siguientes.length === 0 && <div style={{ fontSize: 11.5, color: theme.textMuted }}>Sin acciones por rol.</div>}
            {form.siguientes.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 28px', gap: 6, marginBottom: 6 }}>
                <Campo theme={theme} value={s.rol} onChange={(v) => setSig(i, 'rol', v)} placeholder="Compras / Comercio Exterior" ancho="100%" />
                <Campo theme={theme} value={s.accion} onChange={(v) => setSig(i, 'accion', v)} placeholder="acción" ancho="100%" />
                <button type="button" onClick={() => set('siguientes', form.siguientes.filter((_, j) => j !== i))} style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer' }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
            {modo === 'correo' && !editar && <Boton icon={ArrowLeft} onClick={() => setPaso('pegar')}>Volver al correo</Boton>}
            <span style={{ flex: 1 }} />
            <Boton primario onClick={guardar} disabled={guardando || !form.lineas.length}>{guardando ? 'Guardando…' : editar ? 'Guardar cambios' : 'Guardar reunión'}</Boton>
          </div>
        </div>
      )}
    </HojaLateral>
  );
}
