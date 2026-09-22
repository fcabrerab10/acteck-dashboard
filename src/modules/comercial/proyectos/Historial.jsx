// Historial: quién cambió qué y cuándo en los proyectos. Sale de `auditoria_cambios`
// (trigger genérico fn_auditoria en proyectos y proyecto_lineas), filtrado a esas dos tablas.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Cargando } from '../../../components/kit';
import { relativo } from '../../../lib/format';

const OP = { INSERT: { label: 'Alta', tone: 'green' }, UPDATE: { label: 'Cambio', tone: 'blue' }, DELETE: { label: 'Baja', tone: 'red' } };
const TABLA = { proyectos: 'Proyecto', proyecto_lineas: 'SKU del proyecto' };

// "piezas 100 → 250 · probabilidad prospecto → confirmado"
function resumirCambios(c) {
  if (!c || typeof c !== 'object') return '';
  const partes = [];
  for (const [campo, v] of Object.entries(c)) {
    if (['updated_at', 'created_at', 'id', 'proyecto_id'].includes(campo)) continue;
    if (v && typeof v === 'object' && ('de' in v || 'a' in v)) partes.push(`${campo}: ${v.de ?? '—'} → ${v.a ?? '—'}`);
    else if (v != null && v !== '') partes.push(`${campo}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : v}`);
    if (partes.length >= 4) break;
  }
  return partes.join(' · ');
}

export default function Historial({ filas, cargando }) {
  const { theme } = useTheme();
  const lista = useMemo(() => (filas || []).map((f) => ({ ...f, resumen: resumirCambios(f.cambios) })), [filas]);

  if (cargando) return <Cargando silueta={[{ tipo: 'tabla', filas: 10, cols: 5 }]} minHeight={280} />;

  return (
    <Panel titulo="Historial de cambios" meta={`${lista.length} movimiento${lista.length === 1 ? '' : 's'}`} padding="0">
      <div style={{ maxHeight: 560, overflowY: 'auto' }}>
        {lista.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderTop: i === 0 ? 0 : `1px solid ${theme.border}` }}>
            <Pill tone={OP[f.operacion]?.tone || 'gray'} size="xs" style={{ marginTop: 1 }}>{OP[f.operacion]?.label || f.operacion}</Pill>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text }}>
                {TABLA[f.tabla] || f.tabla}
                <span style={{ fontWeight: 400, color: theme.textMuted, fontFamily: TYPO.fontText }}> · {f.usuario_email || 'sistema'}</span>
              </div>
              {f.resumen && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 2, wordBreak: 'break-word' }}>{f.resumen}</div>}
            </div>
            <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{relativo(f.creado_at)}</span>
          </div>
        ))}
        {!lista.length && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11.5 }}>
            Todavía no hay movimientos registrados.
          </div>
        )}
      </div>
    </Panel>
  );
}
