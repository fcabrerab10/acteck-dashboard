// Calendario mensual de UNA persona, debajo de las tarjetas (Fernando, 2026-09-21): clic en la tarjeta → aquí,
// con los días del mes (tiempo activo y acciones por día, color por intensidad) y, al elegir un día, qué hizo:
// sesiones (hora, duración, pantallas, cliente) y acciones de auditoría humanizadas.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, PanelRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton, Skeleton } from '../../../components/kit';
import { AvatarImg } from '../../../lib/avatar';
import { sesiones, acciones, isoDia } from './calculo.js';
import { useActividadMes } from './datos.js';
import { fmtHm, fmtHmCorto, fmtHora, fmtDiaLargo, plural, PAGINA_LABEL, CLIENTE_LABEL, MESES, DIAS_CORTO } from './textos.js';

const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/** Resumen por día del mes a partir de eventos y auditoría (puro). */
export function resumenPorDia(eventos, auditoria, anio, mes) {
  const ses = sesiones(eventos);
  const acc = acciones(auditoria);
  const dias = new Map();
  const n = new Date(anio, mes, 0).getDate();
  for (let d = 1; d <= n; d++) dias.set(isoDia(new Date(anio, mes - 1, d, 12)), { minutos: 0, sesiones: [], acciones: [], paginas: {}, clientes: {} });
  for (const s of ses) { const r = dias.get(s.dia); if (!r) continue; r.minutos += s.minutos; r.sesiones.push(s); for (const [p, v] of Object.entries(s.paginas)) r.paginas[p] = (r.paginas[p] || 0) + v; for (const [c, v] of Object.entries(s.clientes)) r.clientes[c] = (r.clientes[c] || 0) + v; }
  for (const a of acc) { const r = dias.get(a.dia); if (r) r.acciones.push(a); }
  let max = 0; for (const r of dias.values()) max = Math.max(max, r.minutos);
  return { dias, max, totalMin: [...dias.values()].reduce((s, r) => s + r.minutos, 0), totalAcc: acc.length, diasActivos: [...dias.values()].filter((r) => r.minutos > 0 || r.acciones.length).length };
}

const topN = (obj, n) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, n);

export default function CalendarioPersona({ u, onClose, onAbrirHoja }) {
  const { theme } = useTheme();
  const hoy = new Date();
  const [ref, setRef] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const [diaSel, setDiaSel] = useState(isoDia(hoy));
  const q = useActividadMes(u?.user_id, ref.anio, ref.mes, !!u);
  useEffect(() => { setDiaSel(ref.anio === hoy.getFullYear() && ref.mes === hoy.getMonth() + 1 ? isoDia(hoy) : null); }, [ref.anio, ref.mes]); // eslint-disable-line react-hooks/exhaustive-deps

  const res = useMemo(() => (q.data ? resumenPorDia(q.data.eventos, q.data.auditoria, ref.anio, ref.mes) : null), [q.data, ref.anio, ref.mes]);
  const mover = (d) => setRef((r) => { const m = r.mes + d; return m < 1 ? { anio: r.anio - 1, mes: 12 } : m > 12 ? { anio: r.anio + 1, mes: 1 } : { anio: r.anio, mes: m }; });
  const esFuturo = ref.anio > hoy.getFullYear() || (ref.anio === hoy.getFullYear() && ref.mes >= hoy.getMonth() + 1);

  // Rejilla: lunes primero
  const primero = new Date(ref.anio, ref.mes - 1, 1);
  const offset = (primero.getDay() + 6) % 7;
  const celdas = useMemo(() => {
    if (!res) return [];
    const out = Array(offset).fill(null);
    for (const [iso, r] of res.dias) out.push({ iso, ...r });
    return out;
  }, [res, offset]);

  const sel = diaSel && res ? res.dias.get(diaSel) : null;
  const eventosDia = useMemo(() => {
    if (!sel) return [];
    return [...sel.sesiones.map((s) => ({ ts: s.inicio, tipo: 'sesion', s })), ...sel.acciones.map((a) => ({ ts: a.ts, tipo: 'accion', a }))]
      .sort((x, y) => String(x.ts).localeCompare(String(y.ts)));
  }, [sel]);

  const tono = (r) => {
    if (!r || (!r.minutos && !r.acciones.length)) return { bg: 'transparent', color: theme.textMuted };
    const k = res.max ? r.minutos / res.max : 0;
    const a = theme.accent || '#007AFF';
    if (k > 0.66) return { bg: a, color: '#fff' };
    if (k > 0.33) return { bg: `${a}66`, color: theme.text };
    return { bg: `${a}22`, color: theme.text };
  };
  const hoyIso = isoDia(hoy);
  const sub = { fontSize: 11, color: theme.textMuted };

  return (
    <Panel id="calendario-persona" padding="10px 12px"
      titulo={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AvatarImg perfil={u} size={22} />{u?.nombre || u?.email}
        </span>
      )}
      meta={res ? `${MESES[ref.mes - 1]} ${ref.anio} · ${fmtHm(res.totalMin)} en ${plural(res.diasActivos, 'día')} · ${plural(res.totalAcc, 'acción', 'acciones')}` : `${MESES[ref.mes - 1]} ${ref.anio}`}
      acciones={(
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <Boton icon={ChevronLeft} onClick={() => mover(-1)} title="Mes anterior" />
          <Boton icon={ChevronRight} onClick={() => mover(1)} disabled={esFuturo} title="Mes siguiente" />
          {onAbrirHoja && <Boton icon={PanelRight} onClick={onAbrirHoja}>Ficha completa</Boton>}
          <Boton icon={X} onClick={onClose} title="Cerrar" />
        </span>
      )}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
        {/* Rejilla del mes */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4, marginBottom: 4 }}>
            {SEMANA.map((d) => <div key={d} style={{ ...sub, fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{d}</div>)}
          </div>
          {q.isLoading ? <Skeleton h={220} /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>
              {celdas.map((c, i) => {
                if (!c) return <div key={`v${i}`} />;
                const t = tono(c);
                const on = c.iso === diaSel;
                const vacio = !c.minutos && !c.acciones.length;
                return (
                  <button key={c.iso} onClick={() => setDiaSel(c.iso)} title={vacio ? 'Sin actividad' : `${fmtHm(c.minutos)} · ${plural(c.acciones.length, 'acción', 'acciones')}`}
                    style={{ border: `1px solid ${on ? theme.text : c.iso === hoyIso ? (theme.accent || '#007AFF') : theme.border}`, borderRadius: 10, padding: '5px 6px', minHeight: 46, textAlign: 'left', cursor: 'pointer', background: t.bg, color: t.color, fontFamily: TYPO.fontDisplay, transition: 'transform 120ms', outline: 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Number(c.iso.slice(8, 10))}</div>
                    {!vacio && <div style={{ fontSize: 9.5, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.minutos ? fmtHmCorto(c.minutos) : ''}{c.acciones.length ? `${c.minutos ? ' · ' : ''}${c.acciones.length} acc.` : ''}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detalle del día */}
        <div style={{ minWidth: 0, borderLeft: `1px solid ${theme.border}`, paddingLeft: 12, minHeight: 200 }}>
          {!diaSel ? <div style={sub}>Toca un día para ver qué hizo.</div> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, textTransform: 'capitalize' }}>{fmtDiaLargo(diaSel)}</span>
                <span style={sub}>{sel && (sel.minutos || sel.acciones.length) ? `${fmtHm(sel.minutos)} · ${plural(sel.sesiones.length, 'sesión', 'sesiones')} · ${plural(sel.acciones.length, 'acción', 'acciones')}` : 'sin actividad'}</span>
              </div>
              {sel && (topN(sel.paginas, 4).length > 0 || topN(sel.clientes, 2).length > 0) && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {topN(sel.paginas, 4).map(([p, n]) => <Pill key={p} tone="gray" size="xs">{PAGINA_LABEL[p] || `p${p}`} · {fmtHmCorto(n)}</Pill>)}
                  {topN(sel.clientes, 2).map(([c, n]) => <Pill key={c} tone="blue" size="xs">{CLIENTE_LABEL[c] || `c${c}`} · {fmtHmCorto(n)}</Pill>)}
                </div>
              )}
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {eventosDia.map((e, i) => e.tipo === 'sesion' ? (
                  <div key={`s${i}`} style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 8, fontSize: 11.5, padding: '3px 0', color: theme.text }}>
                    <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>{fmtHora(e.s.inicio)}–{fmtHora(e.s.fin)}</span>
                    <span>Sesión de {fmtHm(e.s.minutos)}{topN(e.s.paginas, 2).length ? ` · ${topN(e.s.paginas, 2).map(([p]) => PAGINA_LABEL[p] || `p${p}`).join(', ')}` : ''}</span>
                  </div>
                ) : (
                  <div key={`a${i}`} style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 8, fontSize: 11.5, padding: '3px 0', color: theme.text }}>
                    <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>{fmtHora(e.a.ts)}</span>
                    <span><span style={{ width: 6, height: 6, borderRadius: 999, background: theme.accent, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />{e.a.label}{e.a.cliente_key ? <span style={sub}> · {e.a.cliente_key}</span> : null}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
