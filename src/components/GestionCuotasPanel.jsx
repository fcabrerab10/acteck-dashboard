// GestionCuotasPanel — modal Ferruteck para editar cuotas_mensuales manualmente.
// Se abre desde Configuración. Sustituye la carga automática desde el ERP
// (que reescribía todo en cada upload).
//
// Modelo: 1 fila por (cliente, anio, mes). Editas cuota_min y cuota_ideal.
// Vista tipo pivot: filas = meses, columnas = min/ideal, con selector año+cliente.
import React from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

const P_ACCENT = '#007AFF';

const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', color: '#3B82F6' },
  { key: 'pcel',       label: 'PCEL',       color: '#EF4444' },
  { key: 'dicotech',   label: 'Dicotech',   color: '#10B981' },
];

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatMX(n) {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return '';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(v);
}

export default function GestionCuotasPanel({ onClose, onSaved }) {
  const { theme } = useTheme();
  const now = new Date();
  const [anio, setAnio] = React.useState(now.getFullYear());
  const [cliente, setCliente] = React.useState('digitalife');
  const [rows, setRows] = React.useState([]); // [{mes, cuota_min, cuota_ideal, _dirty, _original}]
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [msg, setMsg] = React.useState(null);

  const cargar = React.useCallback(async () => {
    setLoading(true); setError(null); setMsg(null);
    try {
      const { data, error } = await supabase.from('cuotas_mensuales')
        .select('mes, cuota_min, cuota_ideal')
        .eq('cliente', cliente).eq('anio', anio);
      if (error) throw error;
      const byMes = new Map((data || []).map((r) => [r.mes, r]));
      const filas = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const src = byMes.get(mes) || {};
        const cm = Number(src.cuota_min || 0);
        const ci = Number(src.cuota_ideal || 0);
        return { mes, cuota_min: cm, cuota_ideal: ci, _dirty: false, _original: { cuota_min: cm, cuota_ideal: ci } };
      });
      setRows(filas);
    } catch (e) {
      setError(e.message || 'Error al cargar');
    } finally { setLoading(false); }
  }, [cliente, anio]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const editRow = (mes, patch) => {
    setRows((prev) => prev.map((r) => r.mes === mes ? {
      ...r, ...patch,
      _dirty: (patch.cuota_min ?? r.cuota_min) !== r._original.cuota_min
           || (patch.cuota_ideal ?? r.cuota_ideal) !== r._original.cuota_ideal,
    } : r));
  };

  const copiarMinAIdeal = () => {
    setRows((prev) => prev.map((r) => ({
      ...r, cuota_ideal: r.cuota_min,
      _dirty: r.cuota_min !== r._original.cuota_ideal || r.cuota_min !== r._original.cuota_min,
    })));
  };

  const limpiarTodo = () => {
    setRows((prev) => prev.map((r) => ({
      ...r, cuota_min: 0, cuota_ideal: 0,
      _dirty: r._original.cuota_min !== 0 || r._original.cuota_ideal !== 0,
    })));
  };

  const guardar = async () => {
    setSaving(true); setError(null); setMsg(null);
    try {
      // Upsert TODAS las filas del año/cliente (12 meses).
      // Los meses con ambas cuotas en 0 se borran para no dejar filas vacías.
      const payload = rows.filter((r) => Number(r.cuota_min) > 0 || Number(r.cuota_ideal) > 0)
        .map((r) => ({
          cliente, anio, mes: r.mes,
          cuota_min: Number(r.cuota_min) || 0,
          cuota_ideal: Number(r.cuota_ideal) || 0,
        }));
      const toDelete = rows.filter((r) => Number(r.cuota_min) === 0 && Number(r.cuota_ideal) === 0
        && (r._original.cuota_min !== 0 || r._original.cuota_ideal !== 0))
        .map((r) => r.mes);

      if (payload.length > 0) {
        const { error: upErr } = await supabase.from('cuotas_mensuales').upsert(payload, { onConflict: 'cliente,mes,anio' });
        if (upErr) throw upErr;
      }
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('cuotas_mensuales').delete()
          .eq('cliente', cliente).eq('anio', anio).in('mes', toDelete);
        if (delErr) throw delErr;
      }
      setMsg(`✓ Guardado · ${payload.length} meses${toDelete.length ? ` · ${toDelete.length} borrados` : ''}`);
      // Refrescar _original para que _dirty se limpie
      setRows((prev) => prev.map((r) => ({ ...r, _dirty: false, _original: { cuota_min: r.cuota_min, cuota_ideal: r.cuota_ideal } })));
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const dirty = rows.some((r) => r._dirty);
  const totalMin = rows.reduce((s, r) => s + (Number(r.cuota_min) || 0), 0);
  const totalIdeal = rows.reduce((s, r) => s + (Number(r.cuota_ideal) || 0), 0);
  const anios = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const clienteInfo = CLIENTES.find((c) => c.key === cliente);

  const inputStyle = (isDirty) => ({
    width: '100%', padding: '6px 10px', fontSize: 12, fontFamily: '"SF Mono", ui-monospace, monospace',
    background: theme.bg, border: `1px solid ${isDirty ? P_ACCENT + '66' : theme.border}`, borderRadius: 6,
    color: theme.text, outline: 'none', textAlign: 'right', fontWeight: 600,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      fontFamily: TYPO.fontText, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: theme.surface, borderRadius: 16, width: '100%', maxWidth: 720,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${theme.border}`,
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header negro estilo Ferruteck */}
        <div style={{ background: '#000', color: '#F5F5F7', padding: '18px 22px', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🎯</div>
          <div>
            <h3 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>
              Cuotas mensuales
            </h3>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              Editas a mano · ya no se reescriben desde el ERP
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* Controles: cliente + año */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 22px', borderBottom: `1px solid ${theme.border}`, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {CLIENTES.map((c) => (
              <button key={c.key} onClick={() => setCliente(c.key)}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${cliente === c.key ? c.color : theme.border}`,
                  background: cliente === c.key ? `${c.color}18` : 'transparent',
                  color: cliente === c.key ? c.color : theme.text, fontFamily: 'inherit',
                }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: c.color, marginRight: 6, verticalAlign: 'middle' }} />
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {anios.map((a) => (
              <button key={a} onClick={() => setAnio(a)}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${anio === a ? P_ACCENT : theme.border}`,
                  background: anio === a ? `${P_ACCENT}18` : 'transparent',
                  color: anio === a ? P_ACCENT : theme.text, fontFamily: 'inherit',
                }}>{a}</button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 22px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: theme.textMuted }}>Cargando cuotas…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {['Mes', 'Cuota mín ($)', 'Cuota ideal ($)'].map((h, i) => (
                    <th key={i} style={{
                      position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
                      textAlign: i === 0 ? 'left' : 'right', padding: '10px 8px',
                      fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.mes} style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '6px 8px', width: 100 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: theme.text }}>
                        {MESES[r.mes - 1]}
                      </span>
                      <span style={{ fontSize: 10, color: theme.textMuted, marginLeft: 6 }}>{anio}</span>
                    </td>
                    <td style={{ padding: '6px 8px', width: 180 }}>
                      <input type="text" inputMode="numeric"
                        value={r.cuota_min ? formatMX(r.cuota_min) : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          editRow(r.mes, { cuota_min: Number(raw) || 0 });
                        }}
                        placeholder="0"
                        style={inputStyle(r._dirty && r.cuota_min !== r._original.cuota_min)} />
                    </td>
                    <td style={{ padding: '6px 8px', width: 180 }}>
                      <input type="text" inputMode="numeric"
                        value={r.cuota_ideal ? formatMX(r.cuota_ideal) : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          editRow(r.mes, { cuota_ideal: Number(raw) || 0 });
                        }}
                        placeholder="0"
                        style={inputStyle(r._dirty && r.cuota_ideal !== r._original.cuota_ideal)} />
                    </td>
                  </tr>
                ))}
                {/* Totales */}
                <tr style={{ borderTop: `2px solid ${theme.border}` }}>
                  <td style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total {anio}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: theme.text, fontFamily: '"SF Mono", ui-monospace, monospace' }}>${formatMX(totalMin) || '0'}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: theme.text, fontFamily: '"SF Mono", ui-monospace, monospace' }}>${formatMX(totalIdeal) || '0'}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderTop: `1px solid ${theme.border}`, background: theme.bg, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={copiarMinAIdeal} disabled={loading}
              style={{ padding: '6px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontFamily: 'inherit' }}>
              Copiar mín → ideal
            </button>
            <button onClick={limpiarTodo} disabled={loading}
              style={{ padding: '6px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontFamily: 'inherit' }}>
              Limpiar
            </button>
          </div>
          <div style={{ fontSize: 11, minWidth: 200, flex: 1, textAlign: 'center' }}>
            {error && <span style={{ color: '#B91C1C', fontWeight: 600 }}>⚠ {error}</span>}
            {msg && <span style={{ color: '#166534', fontWeight: 600 }}>{msg}</span>}
            {!error && !msg && dirty && <span style={{ color: theme.textMuted }}>Cambios sin guardar en {clienteInfo?.label} · {anio}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: theme.surface, color: theme.text, fontFamily: 'inherit', border: `1px solid ${theme.border}` }}>
              {dirty ? 'Cancelar' : 'Cerrar'}
            </button>
            <button onClick={guardar} disabled={!dirty || saving}
              style={{
                padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                border: 0, background: dirty && !saving ? '#000' : theme.border,
                color: '#fff', fontFamily: 'inherit', opacity: dirty && !saving ? 1 : 0.5,
              }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
