// Calendario del mes (móvil) · cuadrícula compacta lunes→domingo con un punto por tipo de pago
// (colores de TIPO_META), "hoy" resaltado y el día elegido en negativo. Tocar un día lista sus pagos abajo.
import React, { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { ListaAgrupada, Fila, Vacio } from '../../piezas';
import { money, MESES_LARGO, MONO, N } from '../../util';
import { CLIENTE_LABEL } from '../../../modules/comercial/pagosv3/reglas';
import { ESTADO_META, TIPO_META } from '../../../modules/comercial/pagosv3/estados';

const DIAS = ['l', 'm', 'm', 'j', 'v', 's', 'd'];
const pad = (n) => String(n).padStart(2, '0');
export const fechaDe = (p) => String(p?.fecha_programada || p?.fecha_compromiso || '').slice(0, 10);

export default function CalendarioM({ pagos = [], anio, mes, hoy, dia, onDia, onMes, onPago }) {
  const { theme } = useTheme();

  const porDia = useMemo(() => {
    const m = new Map();
    for (const p of pagos) {
      const f = fechaDe(p) || 'sin-fecha';
      if (!m.has(f)) m.set(f, []);
      m.get(f).push(p);
    }
    return m;
  }, [pagos]);

  const diasMes = new Date(anio, mes, 0).getDate();
  const primero = new Date(anio, mes - 1, 1).getDay();      // 0 = domingo
  const hueco = (primero + 6) % 7;                           // la semana empieza en lunes
  const celdas = [...Array(hueco).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];

  // Si el día elegido no tiene pagos, se salta al primero del mes que sí tenga (hoy tiene preferencia).
  useEffect(() => {
    if (dia && porDia.has(dia)) return;
    const hoyEnMes = hoy.slice(0, 7) === `${anio}-${pad(mes)}` ? hoy : null;
    if (hoyEnMes && porDia.has(hoyEnMes)) { onDia?.(hoyEnMes); return; }
    const conPagos = [...porDia.keys()].filter((k) => k.startsWith(`${anio}-${pad(mes)}`)).sort();
    onDia?.(conPagos[0] || hoyEnMes || `${anio}-${pad(mes)}-01`);
  }, [anio, mes, porDia]); // eslint-disable-line react-hooks/exhaustive-deps

  const delDia = porDia.get(dia) || [];
  const sinFecha = porDia.get('sin-fecha') || [];
  const inv = theme.surfaceInverse || '#000';
  const invTxt = theme.textOnInverse || '#F5F5F7';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
        <BotonMes icon={ChevronLeft} label="Mes anterior" onClick={() => onMes?.(-1)} />
        <div style={{ flex: 1, textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', textTransform: 'capitalize', color: theme.text }}>
          {MESES_LARGO[mes - 1]} {anio}
        </div>
        <BotonMes icon={ChevronRight} label="Mes siguiente" onClick={() => onMes?.(1)} />
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 3 }}>
            {DIAS.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, paddingBottom: 4 }}>{d}</div>
            ))}
            {celdas.map((n, i) => {
              if (n == null) return <div key={`h${i}`} />;
              const iso = `${anio}-${pad(mes)}-${pad(n)}`;
              const filas = porDia.get(iso) || [];
              const esHoy = iso === hoy;
              const elegido = iso === dia;
              return (
                <button key={iso} type="button" onClick={() => onDia?.(iso)} aria-label={`${n} · ${filas.length} pago(s)`} aria-pressed={elegido}
                  style={{
                    aspectRatio: '1', border: esHoy && !elegido ? `1.5px solid ${theme.accent}` : '1px solid transparent',
                    borderRadius: 9, background: elegido ? inv : 'transparent', color: elegido ? invTxt : filas.length ? theme.text : (theme.textSubtle || theme.textMuted),
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    fontFamily: MONO, fontSize: 12, fontWeight: filas.length ? 600 : 400, cursor: 'pointer', padding: 0,
                    transition: `background ${DUR.state}ms ${EASE}`,
                  }}>
                  {n}
                  <span style={{ display: 'flex', gap: 2, height: 5 }}>
                    {filas.slice(0, 3).map((p, j) => (
                      <span key={j} style={{ width: 5, height: 5, borderRadius: 999, background: TIPO_META[p.tipo]?.color || theme.textMuted }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {delDia.length > 0 ? (
        <ListaAgrupada titulo={tituloDia(dia, hoy)} meta={money(delDia.reduce((s, p) => s + N(p.monto), 0))}>
          {delDia.map((p) => <FilaDia key={p.id} pago={p} onPago={onPago} />)}
        </ListaAgrupada>
      ) : (
        <Vacio titulo={tituloDia(dia, hoy)} sub="Sin pagos programados ese día." />
      )}

      {sinFecha.length > 0 && (
        <ListaAgrupada titulo="Sin fecha programada" meta={sinFecha.length}>
          {sinFecha.map((p) => <FilaDia key={p.id} pago={p} onPago={onPago} />)}
        </ListaAgrupada>
      )}
    </div>
  );
}

function tituloDia(iso, hoy) {
  if (!iso) return 'Día';
  const d = Number(iso.slice(8, 10));
  return `${d} ${MESES_LARGO[Number(iso.slice(5, 7)) - 1]}${iso === hoy ? ' · hoy' : ''}`;
}

function FilaDia({ pago: p, onPago }) {
  const { theme } = useTheme();
  return (
    <Fila
      titulo={p.concepto}
      sub={`${CLIENTE_LABEL[p.cliente] || p.cliente} · ${TIPO_META[p.tipo]?.label || p.tipo}`}
      valor={money(p.monto)}
      tono={TIPO_META[p.tipo]?.color || theme.textMuted}
      pill={{ tone: ESTADO_META[p.estado]?.tone || 'gray', label: ESTADO_META[p.estado]?.label || p.estado }}
      onClick={() => onPago?.(p)} />
  );
}

function BotonMes({ icon: Icon, label, onClick }) {
  const { theme } = useTheme();
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{ width: 40, height: 34, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <Icon size={16} />
    </button>
  );
}
