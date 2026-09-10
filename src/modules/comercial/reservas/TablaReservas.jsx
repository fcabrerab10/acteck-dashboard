// Forecast › Reservas · tabla SKU (TablaCompacta del kit, todo el ancho). Un SKU abierto a la vez
// (renderExpandido → DrillSku). Columnas: SKU · Descripción · Roadmap · necesidad por cliente (método
// elegido) · arribos 3 meses · Inv Acteck · Recom · Reservo (input) · Estado.
import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Pill } from '../../../components/kit';
import { MONO } from '../inventario/constantes';
import { CLIENTES, fmtInt, fmtNum, roadmapTone, ESTADO_LINEA_LABEL, ESTADO_LINEA_TONE, N } from './textos';

function Num({ n, strong }) {
  const { theme } = useTheme();
  const v = N(n);
  return <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: strong && v > 0 ? 600 : 500, color: v === 0 ? (theme.textSubtle || theme.textMuted) : theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(v)}</span>;
}

export function ReservoInput({ value, confirmado, onChange }) {
  const { theme } = useTheme();
  const [local, setLocal] = useState(String(value ?? 0));
  useEffect(() => { setLocal(String(value ?? 0)); }, [value]);
  const n = N(local);
  const activo = n > 0;
  const col = confirmado ? theme.green : activo ? theme.accent : (theme.textSubtle || theme.textMuted);
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <input value={local} placeholder="0" inputMode="numeric" aria-label="Piezas a reservar"
        onChange={(e) => setLocal(e.target.value.replace(/[^\d]/g, ''))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => { const v = N(local); if (v !== N(value)) onChange(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{
          width: 64, padding: '3px 8px', borderRadius: 6, textAlign: 'right', outline: 'none',
          border: `1px solid ${confirmado || activo ? col : theme.border}`,
          background: confirmado ? `${theme.green}1A` : activo ? (theme.accentBg || `${theme.accent}12`) : 'transparent',
          color: col, fontFamily: MONO, fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        }} />
    </span>
  );
}

export function EstadoLinea({ linea }) {
  const est = linea?.estado || 'draft';
  if (est === 'draft' && !linea) return <span style={{ opacity: 0.35 }}>—</span>;
  return <Pill tone={ESTADO_LINEA_TONE[est] || 'gray'} size="xs" dot={est !== 'draft'}>{est === 'draft' ? 'Borrador' : (ESTADO_LINEA_LABEL[est] || est)}</Pill>;
}

export default function TablaReservas({ filas, lineas, meses, expandedSku, onToggle, onReservo, orden, onSort, renderExpandido, maxHeight = 'calc(100vh - 300px)' }) {
  const { theme } = useTheme();
  const columnas = [
    { key: 'chev', label: '', align: 'center', width: 22, render: (r) => <ChevronRight size={12} style={{ color: expandedSku === r.sku ? theme.accent : (theme.textSubtle || theme.textMuted), transform: expandedSku === r.sku ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }} /> },
    { key: 'sku', label: 'SKU', align: 'left', width: 96, mono: true, render: (r) => <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: theme.accent }}>{r.sku}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 280, render: (r) => <span title={`${r.descripcion}${r.marca ? ' · ' + r.marca : ''}${r.familia ? ' · ' + r.familia : ''}`} style={{ fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.text }}>{r.descripcion || '—'}</span> },
    { key: 'roadmap', label: 'Roadmap', align: 'center', width: 62, render: (r) => <Pill tone={roadmapTone(r.roadmap)} size="xs">{r.roadmap || '—'}</Pill> },
    ...CLIENTES.map((c) => ({ key: c.campo, label: c.label, width: 62, sort: true, render: (r) => <Num n={r[c.campo]} /> })),
    ...meses.map((m, i) => ({ key: `arr_${m.key}`, label: `Arribo ${m.label}`, width: 66, render: (r) => <Num n={r.arribosPorMes[m.key]} strong /> , first: i === 0 })),
    { key: 'inventario', label: 'Inv', width: 60, sort: true, render: (r) => <Num n={r.inventario} strong /> },
    { key: 'recomendado', label: 'Recom', width: 62, sort: true, render: (r) => <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: r.recomendado > 0 ? theme.accent : (theme.textSubtle || theme.textMuted), fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.recomendado)}</span> },
    { key: 'reservo', label: 'Reservo', width: 80, render: (r) => { const l = lineas[r.sku]; return <ReservoInput value={N(l?.reservo)} confirmado={l?.estado === 'confirmado' || l?.estado === 'parcial'} onChange={(v) => onReservo(r, v)} />; } },
    { key: 'estado', label: 'Estado', align: 'center', width: 88, render: (r) => <EstadoLinea linea={lineas[r.sku]} /> },
  ];
  return (
    <TablaCompacta
      columnas={columnas}
      filas={filas}
      rowKey={(r) => r.sku}
      onRowClick={(r) => onToggle(r.sku)}
      orden={orden}
      onSort={onSort}
      maxHeight={maxHeight}
      dense
      vacio="No hay SKUs que mostrar con los filtros actuales."
      renderExpandido={renderExpandido}
      expandidoKey={expandedSku}
      rowStyle={(r) => (lineas[r.sku] ? { background: theme.accentBg || `${theme.accent}0D` } : null)}
    />
  );
}
