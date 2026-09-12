// Calendario del mes (eje A) · "qué pago cuándo". Color = tipo de pago.
import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel } from '../../../components/kit';
import { TIPO_META } from './estados';
import { mxnCorto, MONO, Nota } from './ui';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const LEYENDA = [
  { tipo: 'rebate', label: 'Rebate' },
  { tipo: 'spiff', label: 'SPIFF' },
  { tipo: 'proteccion_precio', label: 'Protección' },
  { tipo: 'marketing', label: 'Marketing / fijo' },
  { tipo: 'otro', label: 'Manual' },
];

export default function Calendario({ pagos, anio, mes, onMes, onPago, hoyISO }) {
  const { theme } = useTheme();
  const primero = new Date(anio, mes - 1, 1);
  const diasMes = new Date(anio, mes, 0).getDate();
  const offset = (primero.getDay() + 6) % 7;   // lunes primero

  const porDia = useMemo(() => {
    const m = {};
    for (const p of pagos) {
      const f = p.fecha_programada || p.fecha_compromiso;
      if (!f) continue;
      const d = String(f).slice(0, 10);
      if (Number(d.slice(0, 4)) !== anio || Number(d.slice(5, 7)) !== mes) continue;
      (m[Number(d.slice(8, 10))] ||= []).push(p);
    }
    return m;
  }, [pagos, anio, mes]);

  const sinFecha = pagos.filter((p) => !(p.fecha_programada || p.fecha_compromiso));
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const nav = (delta) => {
    let a = anio, m = mes + delta;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    onMes?.(a, m);
  };

  const botonMes = (icon, titulo, delta) => (
    <button onClick={() => nav(delta)} title={titulo} style={{ width: 24, height: 24, borderRadius: 999, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>{icon}</button>
  );

  return (
    <Panel
      titulo={`${MESES[mes - 1]} ${anio}`}
      meta="fecha de pago programada · color = tipo"
      acciones={<span style={{ display: 'inline-flex', gap: 5 }}>{botonMes(<ChevronLeft size={13} />, 'Mes anterior', -1)}{botonMes(<ChevronRight size={13} />, 'Mes siguiente', 1)}</span>}
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {LEYENDA.map((l) => (
          <span key={l.tipo} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: TIPO_META[l.tipo]?.color }} />{l.label}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>
        {DIAS.map((d) => (
          <div key={d} style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, textAlign: 'center', paddingBottom: 2 }}>{d}</div>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <div key={`v${i}`} />;
          const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const esHoy = iso === hoyISO;
          const delDia = porDia[d] || [];
          return (
            <div key={iso} style={{
              minHeight: 74, borderRadius: 10, padding: 5,
              border: `1px solid ${esHoy ? (theme.accent || '#007AFF') : theme.border}`,
              background: esHoy ? `${theme.accent || '#007AFF'}0A` : (delDia.length ? theme.surfaceHover || 'transparent' : 'transparent'),
              display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden',
            }}>
              <div style={{ ...MONO, fontSize: 10.5, color: esHoy ? (theme.accent || '#007AFF') : theme.textMuted, fontWeight: esHoy ? 700 : 400 }}>{d}</div>
              {delDia.slice(0, 3).map((p) => {
                const col = TIPO_META[p.tipo]?.color || theme.textMuted;
                return (
                  <button key={p.id} onClick={() => onPago?.(p)} title={`${p.concepto} · ${mxnCorto(p.monto)}`} style={{
                    textAlign: 'left', border: 0, background: `${col}1F`, color: theme.text,
                    borderLeft: `2px solid ${col}`, borderRadius: 5, padding: '2px 4px', cursor: 'pointer',
                    fontFamily: TYPO.fontText, fontSize: 9.5, lineHeight: 1.25,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    opacity: p.estado === 'pagado' || p.estado === 'cancelado' ? 0.55 : 1,
                  }}>
                    {p.concepto} <span style={MONO}>{mxnCorto(p.monto)}</span>
                  </button>
                );
              })}
              {delDia.length > 3 && <span style={{ fontSize: 9.5, color: theme.textMuted }}>+{delDia.length - 3} más</span>}
            </div>
          );
        })}
      </div>

      {sinFecha.length > 0 && (
        <Nota style={{ marginTop: 8 }}>
          {sinFecha.length} pago(s) sin fecha programada: {sinFecha.slice(0, 3).map((p) => p.concepto).join(' · ')}{sinFecha.length > 3 ? '…' : ''}
        </Nota>
      )}
    </Panel>
  );
}
