// Tarjeta "Cargas automáticas" (puente SQL en la Mac mini). Misma tabla y columnas de
// siempre (Fuente · Origen · Última carga · Registros · Estado · Detalle · Horario),
// pasada al kit. Al pie: latido del puente, "Pedir corrida ▾" (sync_solicitudes) y
// "Ver log" (últimos 30 sync_events del puente).
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ScrollText, Play, ExternalLink } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton, toast, elevation } from '../../../components/kit';
import { supabase } from '../../../lib/supabase';
import { PUENTE, SOLICITUDES } from './config';
import { estadoAutomatica, latidoPuente, relTiempo, fmtHora, fmtFechaHora } from './frescura';

const TONO_SOL = { pendiente: 'orange', en_proceso: 'blue', hecha: 'green', error: 'red' };

function MenuCorrida({ onPedir, disabled }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const cerrar = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <Boton primario icon={Play} disabled={disabled} onClick={() => setOpen((v) => !v)}>Pedir corrida <ChevronDown size={12} /></Boton>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20, minWidth: 180, padding: 4, borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: elevation(theme, 'flotante') }}>
          {SOLICITUDES.map((s) => (
            <button key={s.id} type="button" role="menuitem" onClick={() => { setOpen(false); onPedir(s.id); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 0, background: 'transparent', borderRadius: 7, cursor: 'pointer', color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: s.id === 'all' ? 600 : 400, borderTop: s.id === 'all' ? `1px solid ${theme.border}` : 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export default function CargasAutomaticas({ status, perfil, onRefetch }) {
  const { theme } = useTheme();
  const [verLog, setVerLog] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const items = status?.items || [], eventos = status?.eventos || {};
  const filas = PUENTE.map((row) => { const item = items.find((x) => x.fuente === row.key); const ev = eventos[row.key]; return { row, item, ev, st: estadoAutomatica(row, item, ev) }; });
  const errores = filas.filter((f) => f.st.texto === 'Error').length, atrasadas = filas.filter((f) => f.st.texto === 'Atrasada').length;
  const resumen = errores ? { tone: 'red', txt: `${errores} con error` } : atrasadas ? { tone: 'orange', txt: `${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` } : { tone: 'green', txt: 'todo al día' };
  const latido = latidoPuente(status);
  const solicitudes = status?.solicitudes || [];
  const enCola = solicitudes.filter((s) => s.estado === 'pendiente' || s.estado === 'en_proceso');

  const pedir = async (fuente) => {
    setPidiendo(true);
    try {
      const { error } = await supabase.from('sync_solicitudes').insert({ fuente, solicitado_por: perfil?.nombre || perfil?.email || null });
      if (error) throw error;
      toast.ok(`Corrida de ${SOLICITUDES.find((s) => s.id === fuente)?.label || fuente} pedida · el puente la toma en ≤ 5 min`);
      onRefetch?.();
    } catch (e) { toast.error(`No se pudo pedir la corrida: ${e.message}`); }
    setPidiendo(false);
  };

  const th = { padding: '7px 10px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.divider || theme.border}`, textAlign: 'left', whiteSpace: 'nowrap' };
  const td = { padding: '8px 10px', borderBottom: `1px solid ${theme.border}`, fontSize: 12, color: theme.text, verticalAlign: 'middle' };
  const sub = { fontSize: 10.5, color: theme.textSubtle || theme.textMuted };

  return (
    <Panel titulo="Cargas automáticas" meta="Puente SQL en la Mac mini · sin intervención manual" padding="0"
      acciones={<Pill tone={resumen.tone} dot>{resumen.txt}</Pill>}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead><tr>{['Fuente', 'Origen', 'Última carga', 'Registros', 'Estado', 'Detalle', 'Horario'].map((h) => <th key={h} style={{ ...th, textAlign: h === 'Registros' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.map(({ row, item, ev, st }) => (
              <tr key={row.key}>
                <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.titulo}</td>
                <td style={td}><div>{row.fuente}</div><div style={sub}>{item?.meta?.origen || ev?.user_nombre || '—'}</div></td>
                <td style={{ ...td, whiteSpace: 'nowrap', fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' }}>
                  <div>{fmtFechaHora(item?.ultima_actualizacion)}</div>
                  {item?.ultima_actualizacion && <div style={sub}>{relTiempo(item.ultima_actualizacion)}{ev?.duracion_ms ? ` · ${(ev.duracion_ms / 1000).toFixed(0)}s` : ''}</div>}
                </td>
                <td style={{ ...td, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{item?.registros != null ? Number(item.registros).toLocaleString('es-MX') : '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><Pill tone={st.tone} dot>{st.texto}</Pill></td>
                <td style={{ ...td, fontSize: 11.5, color: st.texto === 'Error' ? theme.red : theme.textMuted, maxWidth: 340, wordBreak: 'break-word' }}>{st.detalle}</td>
                <td style={{ ...td, fontSize: 11.5, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                  {row.horario}
                  {row.manual && (
                    <a href={row.manual.href} target="_blank" rel="noopener noreferrer" title={row.manual.title}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 8, color: theme.accent, textDecoration: 'none', fontSize: 11 }}>
                      {row.manual.label} <ExternalLink size={10} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '9px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: theme.textMuted }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: latido.enLinea ? theme.green : theme.red, display: 'inline-block', boxShadow: latido.enLinea ? `0 0 0 3px ${theme.green}33` : 'none' }} />
          <span style={{ color: theme.text, fontWeight: 600 }}>{latido.enLinea ? 'Puente en línea' : latido.t ? 'Puente sin señal' : 'Puente sin latido'}</span>
          <span>· último latido {latido.t ? relTiempo(latido.t) : '—'}</span>
          <span>· próxima corrida {fmtHora(latido.proxima)}</span>
          {latido.meta?.version && <span>· v{latido.meta.version}</span>}
          {!latido.conLatido && <Pill tone="gray" size="xs" title="Los agentes de la Mac mini aún no escriben el latido (sync_status.puente): reinstalar agentes tras git pull">latido pendiente de instalar</Pill>}
          {enCola.map((s) => <Pill key={s.id} tone={TONO_SOL[s.estado]} size="xs" dot title={`Pedida por ${s.solicitado_por || '—'} · ${relTiempo(s.solicitado_at)}`}>{s.fuente} · {s.estado.replace('_', ' ')}</Pill>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Boton icon={ScrollText} onClick={() => setVerLog((v) => !v)}>{verLog ? 'Ocultar log' : 'Ver log'}</Boton>
          <MenuCorrida onPedir={pedir} disabled={pidiendo} />
        </div>
      </div>

      {verLog && (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: '8px 12px 10px' }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6 }}>Últimos 30 eventos del puente</div>
          <div style={{ maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(status?.puente || []).length === 0 && <div style={{ fontSize: 11.5, color: theme.textMuted }}>Sin eventos del puente todavía.</div>}
            {(status?.puente || []).map((ev) => (
              <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '112px 130px 1fr auto', gap: 10, alignItems: 'center', fontSize: 11.5, padding: '3px 0', borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', color: theme.textMuted }}>{fmtFechaHora(ev.created_at)}</span>
                <span style={{ fontWeight: 600 }}>{ev.detalles?.fuente || ev.status_key || ev.src_id}</span>
                <span style={{ color: ev.status === 'error' ? theme.red : theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.status === 'error' ? (ev.detalles?.mensaje || 'error') : `${ev.filas != null ? Number(ev.filas).toLocaleString('es-MX') + ' filas' : ''}${ev.duracion_ms ? ` · ${(ev.duracion_ms / 1000).toFixed(0)}s` : ''}${ev.detalles?.desde ? ` · desde ${ev.detalles.desde}` : ''}${ev.detalles?.anios ? ` · ${[].concat(ev.detalles.anios).join(',')}` : ''}`}
                </span>
                <Pill tone={ev.status === 'success' ? 'green' : ev.status === 'error' ? 'red' : 'orange'} size="xs">{ev.status === 'success' ? 'OK' : ev.status}</Pill>
              </div>
            ))}
          </div>
          {solicitudes.length > 0 && (
            <>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, margin: '10px 0 6px' }}>Solicitudes recientes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {solicitudes.slice(0, 8).map((s) => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '112px 110px 1fr auto', gap: 10, alignItems: 'center', fontSize: 11.5, padding: '3px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', color: theme.textMuted }}>{fmtFechaHora(s.solicitado_at)}</span>
                    <span style={{ fontWeight: 600 }}>{s.fuente}</span>
                    <span style={{ color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.solicitado_por || '—'}{s.resultado?.mensaje ? ` · ${s.resultado.mensaje}` : s.resultado?.filas != null ? ` · ${Number(s.resultado.filas).toLocaleString('es-MX')} filas` : ''}{s.atendida_at ? ` · atendida ${relTiempo(s.atendida_at)}` : ''}</span>
                    <Pill tone={TONO_SOL[s.estado] || 'gray'} size="xs">{s.estado.replace('_', ' ')}</Pill>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
