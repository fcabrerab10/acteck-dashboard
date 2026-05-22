// LineamientosCliente — panel colapsable para editar los lineamientos de
// Fondo MKT, Rebate y SPIFF de cada cliente. Persisten en lineamientos_cliente.
//
// La lógica de cálculo del Fondo/Rebate/SPIFF NO lee todavía de aquí — esto
// funciona como documentación viva editable. La integración con las calculadoras
// se hará en un commit posterior si el usuario lo confirma.

import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente } from '../../lib/permisos';
import { FileText, Edit3, Save, X, Plus, Trash2 } from 'lucide-react';
import { formatMXN } from '../../lib/utils';

const TIPOS_META = {
  fondo_mkt: { label: 'Fondo de Marketing', icon: '💰', color: '#7C3AED' },
  rebate:    { label: 'Rebate (Descuento)',  icon: '🎁', color: '#3B82F6' },
  spiff:     { label: 'SPIFF (Comisión)',    icon: '💵', color: '#10B981' },
};

export default function LineamientosCliente({ clienteKey, tipos = ['fondo_mkt', 'rebate', 'spiff'] }) {
  const perfil = usePerfil();
  const canEdit = puedeEditarPestanaCliente(perfil, clienteKey, 'pagos');
  const [lineamientos, setLineamientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(null); // id que se está editando
  const [edits, setEdits] = useState({ config: '', descripcion: '', notas: '' });

  useEffect(() => {
    if (!DB_CONFIGURED || !clienteKey) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('lineamientos_cliente')
        .select('*')
        .eq('cliente', clienteKey)
        .in('tipo', tipos);
      setLineamientos(data || []);
      setLoading(false);
    })();
  }, [clienteKey, tipos.join(',')]);

  const iniciarEdicion = (l) => {
    setEditando(l.id);
    setEdits({
      config: JSON.stringify(l.config || {}, null, 2),
      descripcion: l.descripcion || '',
      notas: l.notas || '',
    });
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setEdits({ config: '', descripcion: '', notas: '' });
  };

  const guardar = async (l) => {
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(edits.config);
    } catch (e) {
      alert('Error en el JSON de configuración: ' + e.message);
      return;
    }
    const { error } = await supabase
      .from('lineamientos_cliente')
      .update({
        config: parsedConfig,
        descripcion: edits.descripcion,
        notas: edits.notas,
        updated_at: new Date().toISOString(),
      })
      .eq('id', l.id);
    if (error) { alert('Error al guardar: ' + error.message); return; }
    // Refetch
    const { data } = await supabase
      .from('lineamientos_cliente')
      .select('*')
      .eq('cliente', clienteKey)
      .in('tipo', tipos);
    setLineamientos(data || []);
    setEditando(null);
  };

  // Renderiza el config de un lineamiento como una vista "amigable" según el tipo
  const renderConfigPretty = (l) => {
    const c = l.config || {};
    if (l.tipo === 'fondo_mkt') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="% Aporte" value={c.aporte_pct != null ? (c.aporte_pct * 100).toFixed(2) + '%' : '—'} />
          <Stat label="Alcance mínimo" value={c.alcance_minimo_pct != null ? c.alcance_minimo_pct + '%' : '—'} />
          <Stat label="Frecuencia" value={c.frecuencia || '—'} />
          <Stat label="Acumula multi-año" value={c.acumula_multianio ? 'Sí' : 'No'} />
        </div>
      );
    }
    if (l.tipo === 'rebate' && c.por_categoria) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {Object.entries(c.por_categoria).map(([cat, pct]) => (
            <Stat key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} value={(pct * 100).toFixed(1) + '%'} />
          ))}
          <Stat label="Frecuencia" value={c.frecuencia || '—'} />
        </div>
      );
    }
    if (l.tipo === 'rebate' && c.tiers) {
      return (
        <div className="space-y-1.5 text-sm">
          <div className="text-xs text-gray-500 font-semibold mb-1">Tiers de Rebate</div>
          {c.tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded px-3 py-1.5">
              <span className="font-mono text-xs text-gray-600 w-32">{t.label || '≥ ' + (t.min_alcance * 100) + '%'}</span>
              <span className="font-bold text-blue-700">{(t.pct * 100).toFixed(2)}%</span>
            </div>
          ))}
          <Stat label="Frecuencia" value={c.frecuencia || '—'} />
        </div>
      );
    }
    if (l.tipo === 'spiff' && c.tiers) {
      return (
        <div className="text-sm space-y-1.5">
          <Stat label="Cuota anual" value={c.cuota_anual ? formatMXN(c.cuota_anual) : '—'} />
          <Stat label="H1 / H2" value={c.split_h1_h2 ? `${(c.split_h1_h2[0]*100).toFixed(0)}% / ${(c.split_h1_h2[1]*100).toFixed(0)}%` : '—'} />
          <Stat label="Tope mensual" value={c.tope_mensual ? formatMXN(c.tope_mensual) : '—'} />
          <div className="text-xs text-gray-500 font-semibold mt-2 mb-1">Tiers</div>
          {c.tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded px-3 py-1.5">
              <span className="font-mono text-xs text-gray-600 w-32">≥ {(t.min_alcance * 100).toFixed(0)}%</span>
              <span className="font-bold text-emerald-700">{(t.pct * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      );
    }
    if (l.tipo === 'spiff') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Stat label="% Fijo" value={c.pct_fijo != null ? (c.pct_fijo * 100).toFixed(2) + '%' : '—'} />
          <Stat label="Alcance mínimo" value={c.requiere_alcance_minimo != null ? (c.requiere_alcance_minimo * 100) + '%' : '—'} />
          <Stat label="Frecuencia" value={c.frecuencia || '—'} />
        </div>
      );
    }
    return <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto">{JSON.stringify(c, null, 2)}</pre>;
  };

  if (!DB_CONFIGURED) return null;
  if (loading) return null;
  if (lineamientos.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      {/* Header colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <h3 className="font-bold text-gray-800 text-sm">📋 Lineamientos del cliente</h3>
          <span className="text-xs text-gray-400">({lineamientos.length} reglas)</span>
        </div>
        <span className="text-gray-400 text-sm">{abierto ? '▾' : '▸'}</span>
      </button>

      {abierto && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          <p className="text-xs text-gray-500 italic">
            Estas reglas describen cómo se calculan los fondos y rebates de este cliente.
            Por ahora son <strong>documentación viva editable</strong>; las calculadoras siguen usando
            su lógica original. Si las modificas, queda registrado para referencia.
          </p>
          {lineamientos.map(l => {
            const meta = TIPOS_META[l.tipo] || { label: l.tipo, icon: '📌', color: '#64748B' };
            const esteEdit = editando === l.id;
            return (
              <div key={l.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ color: meta.color }} className="font-bold">{meta.icon} {meta.label}</span>
                    <span className="text-xs text-gray-400">
                      · actualizado {new Date(l.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {canEdit && !esteEdit && (
                    <button
                      onClick={() => iniciarEdicion(l)}
                      className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Editar
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {!esteEdit ? (
                    <>
                      {l.descripcion && (
                        <p className="text-sm text-gray-700 leading-relaxed">{l.descripcion}</p>
                      )}
                      {renderConfigPretty(l)}
                      {l.notas && (
                        <div className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3">
                          {l.notas}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="block">
                        <span className="text-xs text-gray-500 font-semibold">Descripción</span>
                        <textarea
                          rows={2}
                          value={edits.descripcion}
                          onChange={e => setEdits(prev => ({ ...prev, descripcion: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-gray-500 font-semibold">Configuración (JSON)</span>
                        <textarea
                          rows={8}
                          value={edits.config}
                          onChange={e => setEdits(prev => ({ ...prev, config: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border rounded-lg text-xs font-mono"
                        />
                        <span className="text-[10px] text-gray-400">Tip: edita los % en formato decimal (0.01 = 1%).</span>
                      </label>
                      <label className="block">
                        <span className="text-xs text-gray-500 font-semibold">Notas</span>
                        <input
                          type="text"
                          value={edits.notas}
                          onChange={e => setEdits(prev => ({ ...prev, notas: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </label>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={cancelarEdicion}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 inline-flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                        <button
                          onClick={() => guardar(l)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" /> Guardar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</div>
      <div className="text-sm font-bold text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}
