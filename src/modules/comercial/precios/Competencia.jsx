// Drill del SKU · "Precio de la competencia" (compacto). Tabla precios_competencia (RLS: lectura authenticated,
// escritura interno/super admin). Con referencias: una fila por competidor (competidor · marca/modelo · precio · vs
// Mayoreo AAA con DeltaPill · fecha · comentario · editar/eliminar). Sin referencias: sólo la línea discreta
// "Agregar precio de la competencia" que abre un formulario inline pequeño. Sin cachedQuery; invalida tras escribir.
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { fechaCorta } from '../../../lib/format';
import { Panel, DeltaPill, Boton, toast } from '../../../components/kit';
import { useCompetencia, useCompetenciaMutaciones } from './datos';
import { fmtMoney, selectPill } from './textos';

const VACIA = () => ({ competidor: '', marca: '', modelo: '', precio: '', fecha: new Date().toISOString().slice(0, 10), comentario: '' });

function Formulario({ theme, inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const inp = (k, placeholder, extra = {}) => <input value={f[k] ?? ''} onChange={set(k)} placeholder={placeholder} style={{ ...selectPill(theme), height: 26, padding: '0 8px', minWidth: 0, ...extra.style }} {...extra} />;
  const guardar = async () => {
    if (!f.competidor.trim()) { toast.error('Falta el competidor'); return; }
    if (!(Number(f.precio) > 0)) { toast.error('Escribe el precio (sin IVA)'); return; }
    setBusy(true);
    try { await onGuardar(f); } catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.3fr) 90px 118px', gap: 6, alignItems: 'center', padding: '6px 0' }}
      onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') onCancelar(); }}>
      {inp('competidor', 'Competidor *', { autoFocus: true })}
      {inp('marca', 'Marca')}
      {inp('modelo', 'Modelo / especificaciones')}
      {inp('precio', 'Precio', { type: 'number', step: '0.01', min: '0', style: { textAlign: 'right', fontFamily: TYPO.fontDisplay } })}
      {inp('fecha', '', { type: 'date' })}
      <div style={{ gridColumn: '1 / span 3' }}>{inp('comentario', 'Comentario (opcional)', { style: { width: '100%', boxSizing: 'border-box' } })}</div>
      <div style={{ gridColumn: '4 / span 2', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Boton primario icon={Check} onClick={guardar} disabled={busy}>Guardar</Boton>
        <Boton icon={X} onClick={onCancelar} disabled={busy}>Cancelar</Boton>
      </div>
    </div>
  );
}

export default function Competencia({ sku, precioAAA, interno = false }) {
  const { theme } = useTheme();
  const { data, isLoading, error } = useCompetencia(sku);
  const { guardar, eliminar } = useCompetenciaMutaciones(sku);
  const [modo, setModo] = useState(null); // 'nuevo' | id en edición
  const filas = data || [];

  const onGuardar = async (f) => { await guardar(f); setModo(null); toast.ok(f.id ? 'Referencia actualizada' : 'Precio de la competencia agregado'); };
  const onEliminar = async (r) => {
    if (!window.confirm(`¿Eliminar la referencia de ${r.competidor}?`)) return;
    try { await eliminar(r.id); toast.ok('Referencia eliminada'); } catch (e) { toast.error(`No se pudo eliminar: ${e.message || e}`); }
  };
  const hair = `1px solid ${theme.divider || theme.border}`;
  const linkAgregar = interno && modo !== 'nuevo' && (
    <button type="button" onClick={() => setModo('nuevo')} style={{ background: 'none', border: 0, padding: '4px 0', color: theme.accent || '#007AFF', fontFamily: TYPO.fontText, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Plus size={12} strokeWidth={2.2} /> Agregar precio de la competencia
    </button>
  );

  if (!filas.length && !isLoading && !error) {
    // Sin referencias: sólo la línea discreta (o nada si no puede capturar)
    if (!interno) return null;
    return (
      <div style={{ padding: '0 2px' }}>
        {linkAgregar}
        {modo === 'nuevo' && <Formulario theme={theme} inicial={VACIA()} onGuardar={onGuardar} onCancelar={() => setModo(null)} />}
      </div>
    );
  }

  return (
    <Panel titulo="Precio de la competencia" meta={filas.length ? `${filas.length} referencia${filas.length === 1 ? '' : 's'} · sin IVA · vs Mayoreo AAA` : undefined} acciones={linkAgregar || undefined}>
      {isLoading && <div style={{ fontSize: 11, color: theme.textMuted, padding: '6px 0' }}>Cargando…</div>}
      {error && <div style={{ fontSize: 11, color: theme.red || '#FF3B30', padding: '6px 0' }}>No se pudo leer la competencia: {String(error.message || error)}</div>}
      {filas.map((r) => (
        modo === r.id ? (
          <Formulario key={r.id} theme={theme} inicial={{ ...r, precio: String(r.precio), fecha: r.fecha || '' }} onGuardar={onGuardar} onCancelar={() => setModo(null)} />
        ) : (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto auto auto', gap: 8, alignItems: 'center', padding: '5px 2px', fontSize: 11, borderBottom: hair }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.competidor}{(r.marca || r.modelo) && <span style={{ fontWeight: 400, color: theme.textMuted }}> · {[r.marca, r.modelo].filter(Boolean).join(' ')}</span>}
              </div>
              {r.comentario && <div style={{ fontSize: 10, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.comentario}>{r.comentario}</div>}
            </div>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.precio)}{r.moneda && r.moneda !== 'MXN' ? ` ${r.moneda}` : ''}</span>
            <DeltaPill value={precioAAA > 0 ? ((Number(r.precio) - precioAAA) / precioAAA) * 100 : null} digits={1} />
            <span style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap' }}>{r.fecha ? fechaCorta(r.fecha) : '—'}</span>
            {interno ? (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <button type="button" onClick={() => setModo(r.id)} title="Editar" style={{ background: 'none', border: 0, padding: 3, color: theme.textMuted, cursor: 'pointer' }}><Pencil size={12} /></button>
                <button type="button" onClick={() => onEliminar(r)} title="Eliminar" style={{ background: 'none', border: 0, padding: 3, color: theme.textMuted, cursor: 'pointer' }}><Trash2 size={12} /></button>
              </span>
            ) : <span />}
          </div>
        )
      ))}
      {modo === 'nuevo' && <Formulario theme={theme} inicial={VACIA()} onGuardar={onGuardar} onCancelar={() => setModo(null)} />}
    </Panel>
  );
}
