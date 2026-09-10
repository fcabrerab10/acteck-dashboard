// SpiffPanel — gestión editable de SPIFFs (tabla con alta/baja/edición, upsert por sku). Modal flotante.
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { supabase } from '../../../lib/supabase';
import { Boton, Pill, toast, elevation, bordeFlotante } from '../../../components/kit';
import Buscador from '../sellin/Buscador';
import { normalizar, tokens as aTokens, coincide } from '../sellin/textos';

export default function SpiffPanel({ onClose, onSaved }) {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);
  const [originalIds, setOriginalIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('spiffs').select('id,sku,descripcion,monto,vigencia_inicio,vigencia_fin,fuente').order('sku');
        if (error) throw error;
        setRows((data || []).map((r) => ({ ...r, _dirty: false, _new: false })));
        setOriginalIds(new Set((data || []).map((r) => r.id)));
      } catch (e) { toast.error(e.message || 'No se pudieron cargar los SPIFFs'); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtradas = useMemo(() => { const t = aTokens(busqueda); return t.length ? rows.filter((r) => coincide(normalizar(`${r.sku} ${r.descripcion}`), t)) : rows; }, [rows, busqueda]);
  const editRow = (id, patch) => setRows((prev) => prev.map((r) => ((r.id || r._tempId) === id ? { ...r, ...patch, _dirty: true } : r)));
  const removeRow = (id) => setRows((prev) => prev.filter((r) => (r.id || r._tempId) !== id));
  const addRow = () => {
    const ref = rows[0] || {};
    setRows((prev) => [{ _tempId: `_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id: null, _new: true, _dirty: true, sku: '', descripcion: '', monto: 0, vigencia_inicio: ref.vigencia_inicio || '', vigencia_fin: ref.vigencia_fin || '' }, ...prev]);
  };
  const dirty = rows.some((r) => r._dirty) || rows.length !== originalIds.size;

  const guardar = async () => {
    setSaving(true);
    try {
      const invalidas = rows.filter((r) => !r.sku?.trim() || !(Number(r.monto) > 0) || !r.vigencia_inicio || !r.vigencia_fin);
      if (invalidas.length > 0) throw new Error(`${invalidas.length} fila${invalidas.length === 1 ? '' : 's'} incompleta${invalidas.length === 1 ? '' : 's'} (falta SKU, monto o fecha)`);
      const currentIds = new Set(rows.filter((r) => r.id).map((r) => r.id));
      const toDelete = [...originalIds].filter((id) => !currentIds.has(id));
      if (toDelete.length > 0) { const { error } = await supabase.from('spiffs').delete().in('id', toDelete); if (error) throw error; }
      const payload = rows.map((r) => ({ sku: r.sku.trim(), descripcion: r.descripcion || null, monto: Number(r.monto), vigencia_inicio: r.vigencia_inicio, vigencia_fin: r.vigencia_fin, situacion: 'Spiff', fuente: r.fuente || 'edición manual' }));
      const { error } = await supabase.from('spiffs').upsert(payload, { onConflict: 'sku' });
      if (error) throw error;
      toast.ok(`${payload.length} SPIFFs guardados${toDelete.length ? ` · ${toDelete.length} eliminados` : ''}`);
      onSaved?.();
      onClose?.();
    } catch (e) { toast.error(e.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const th = { position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'left', padding: '8px 8px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' };
  const inputStyle = (r) => ({ width: '100%', height: 26, padding: '0 8px', fontSize: 11, fontFamily: TYPO.fontText, background: r._new ? `${theme.accent || '#007AFF'}0A` : theme.bg, border: `1px solid ${r._dirty ? `${theme.accent || '#007AFF'}66` : theme.border}`, borderRadius: 7, color: theme.text, outline: 'none', boxSizing: 'border-box' });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: TYPO.fontText, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: theme.surface, border: bordeFlotante(theme), borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: elevation(theme, 'flotante') }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${theme.border}` }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text }}>Gestionar SPIFFs</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>{loading ? 'Cargando…' : `${rows.length} SKUs`}{dirty ? <Pill tone="orange" size="xs" style={{ marginLeft: 6 }}>cambios sin guardar</Pill> : null}</div>
          </div>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar SKU o descripción" width={220} />
            <Boton icon={Plus} onClick={addRow}>Agregar SKU</Boton>
            <Boton icon={X} onClick={onClose} title="Cerrar" />
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 18px' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: theme.textMuted }}>Cargando SPIFFs…</div>
            : filtradas.length === 0 ? <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: theme.textMuted }}>{rows.length === 0 ? 'Sin SPIFFs. Sube un Excel o agrega SKUs manualmente.' : 'Sin resultados con la búsqueda actual.'}</div>
            : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11.5 }}>
                <thead><tr>{['SKU', 'Descripción', 'Monto/pz', 'Vig. inicio', 'Vig. fin', ''].map((h, i) => <th key={i} style={{ ...th, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtradas.map((r) => {
                    const rid = r.id || r._tempId;
                    return (
                      <tr key={rid}>
                        <td style={{ padding: '5px 8px 5px 0', width: 120 }}><input value={r.sku || ''} onChange={(e) => editRow(rid, { sku: e.target.value.toUpperCase() })} placeholder="AC-XXXXXX" style={{ ...inputStyle(r), fontFamily: TYPO.fontDisplay, fontWeight: 600 }} /></td>
                        <td style={{ padding: '5px 8px' }}><input value={r.descripcion || ''} onChange={(e) => editRow(rid, { descripcion: e.target.value })} placeholder="Descripción opcional" style={inputStyle(r)} /></td>
                        <td style={{ padding: '5px 8px', width: 96 }}><input type="number" min="0" step="0.5" value={r.monto ?? ''} onChange={(e) => editRow(rid, { monto: Number(e.target.value) || 0 })} style={{ ...inputStyle(r), textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600 }} /></td>
                        <td style={{ padding: '5px 8px', width: 140 }}><input type="date" value={r.vigencia_inicio || ''} onChange={(e) => editRow(rid, { vigencia_inicio: e.target.value })} style={inputStyle(r)} /></td>
                        <td style={{ padding: '5px 8px', width: 140 }}><input type="date" value={r.vigencia_fin || ''} onChange={(e) => editRow(rid, { vigencia_fin: e.target.value })} style={inputStyle(r)} /></td>
                        <td style={{ padding: '5px 0 5px 8px', width: 34, textAlign: 'center' }}><Boton icon={Trash2} peligro title="Eliminar SPIFF" onClick={() => removeRow(rid)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', padding: '12px 18px', borderTop: `1px solid ${theme.border}` }}>
          <Boton onClick={onClose}>{dirty ? 'Cancelar' : 'Cerrar'}</Boton>
          <Boton primario onClick={guardar} disabled={!dirty || saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Boton>
        </div>
      </div>
    </div>
  );
}
