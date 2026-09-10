// Cargas manuales · un Panel por grupo (Globales, Digitalife, PCEL, Dicotech, Estados de
// cuenta). Fila = Anillo · Fuente · Formato · Última carga · Registros · Estado · Esperada ·
// zona de arrastre. Click en la fila → últimas 10 cargas de sync_events.
// Estados (estadoManual): al_dia (verde) · por_vencer (naranja) · atrasada (rojo).
// "Esperada" la edita el super admin (cadencia semanal/mensual/cambio + tolerancia → fuentes_config).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, TablaCompacta, toast } from '../../../components/kit';
import { puedeConfigurar } from '../../../lib/permisos';
import { GRUPOS, DIAS_SEMANA, TOLERANCIA_SEMANAL, TOLERANCIA_MENSUAL, normalizarCadencia, labelCadencia, labelLimite } from './config';
import { guardarCadencia } from './fuentesConfig';
import { frescuraManual, relTiempo, fmtFechaHora } from './frescura';
import { subirArchivo } from './subir';
import Anillo from './Anillo';
import ZonaArrastre from './ZonaArrastre';

const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmtIso = (iso) => { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? `${p[2]} ${MES[+p[1] - 1]} ${p[0]}` : iso; };

/** Texto del pill de estado: sem NN · mes · N d de atraso · vence en N d · sin datos. */
export function pillEstado(f, fr, info) {
  if (fr.sinDatos && !fr.cambio) return { tone: 'red', txt: 'sin datos' };
  if (fr.estado === 'atrasada') return { tone: 'red', txt: `${fr.diasAtraso} d de atraso` };
  let txt = null;
  if (f.tipo === 'semana' && info?.anio && info?.semana) txt = `sem ${String(info.semana).padStart(2, '0')} · ${info.anio}`;
  else if (f.tipo === 'mes' && info?.anio && info?.mes) txt = `${MES[info.mes - 1]} ${info.anio}`;
  else if (f.tipo === 'sellout' && info?.fecha) txt = `venta ${fmtIso(info.fecha)}`;
  else if (f.tipo === 'updated' && (info?.updated_at || fr.ultima)) txt = fmtIso(info?.updated_at || new Date(fr.ultima).toISOString());
  if (fr.estado === 'por_vencer') return { tone: 'orange', txt: fr.diasParaLimite === 0 ? 'vence hoy' : `vence en ${fr.diasParaLimite} d` };
  if (fr.cambio) return { tone: fr.ultima ? 'green' : 'gray', txt: txt || (fr.ultima ? 'al día' : 'sin datos') };
  return { tone: 'green', txt: txt || 'al día' };
}

/** Editor inline de la cadencia (sólo super admin): tipo · día · tolerancia. Guarda al cambiar. */
function EditorCadencia({ fuente, theme, onGuardado }) {
  const [c, setC] = useState(() => normalizarCadencia(fuente.cadencia));
  const [guardando, setGuardando] = useState(false);
  const sel = { height: 24, padding: '0 6px', borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11, cursor: 'pointer' };
  const guardar = async (next) => {
    const n = normalizarCadencia(next);
    setC(n); setGuardando(true);
    try { await guardarCadencia(fuente.id, n, onGuardado?.quien || null); toast.ok(`${fuente.titulo}: esperada ${labelCadencia(n)}${labelLimite(n) ? ` · ${labelLimite(n)}` : ''}`); onGuardado?.cb?.(); }
    catch (e) { toast.error(`No se pudo guardar la cadencia: ${e.message}`); setC(normalizarCadencia(fuente.cadencia)); }
    setGuardando(false);
  };
  const cambiarTipo = (tipo) => {
    if (tipo === 'cambio') return guardar({ tipo: 'cambio' });
    if (tipo === 'mensual') return guardar({ tipo: 'mensual', dia: c.tipo === 'mensual' ? c.dia : 10, tolerancia: c.tipo === 'mensual' ? c.tolerancia : TOLERANCIA_MENSUAL });
    return guardar({ tipo: 'semanal', dia: c.tipo === 'semanal' ? c.dia : 1, tolerancia: c.tipo === 'semanal' ? c.tolerancia : TOLERANCIA_SEMANAL });
  };
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', opacity: guardando ? 0.6 : 1 }}>
      <select value={c.tipo} onChange={(e) => cambiarTipo(e.target.value)} style={sel} title="Cadencia">
        <option value="semanal">semanal</option><option value="mensual">mensual</option><option value="cambio">cuando cambie</option>
      </select>
      {c.tipo === 'semanal' && (
        <select value={c.dia} onChange={(e) => guardar({ ...c, dia: Number(e.target.value) })} style={sel} title="Día esperado">
          {DIAS_SEMANA.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
        </select>
      )}
      {c.tipo === 'mensual' && (
        <select value={c.dia} onChange={(e) => guardar({ ...c, dia: Number(e.target.value) })} style={sel} title="Día del mes esperado">
          {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>día {i + 1}</option>)}
        </select>
      )}
      {c.tipo !== 'cambio' && (
        <label title="Días de tolerancia antes de marcarla atrasada" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: theme.textMuted }}>
          +<input type="number" min={0} max={30} value={c.tolerancia} onChange={(e) => setC({ ...c, tolerancia: Number(e.target.value) })} onBlur={() => guardar(c)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{ ...sel, width: 40, padding: '0 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} /> d
        </label>
      )}
      {labelLimite(c) && <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap' }}>{labelLimite(c)}</span>}
    </div>
  );
}

function Historial({ eventos, theme }) {
  if (!eventos?.length) return <div style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textMuted }}>Sin cargas registradas todavía.</div>;
  return (
    <div style={{ padding: '6px 14px 8px', background: theme.surfaceHover || 'rgba(0,0,0,0.02)' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, margin: '2px 0 4px' }}>Últimas {eventos.length} cargas</div>
      {eventos.map((ev) => (
        <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '112px 150px 1fr auto', gap: 10, alignItems: 'center', fontSize: 11.5, padding: '3px 0', borderTop: `1px solid ${theme.border}` }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', color: theme.textMuted }}>{fmtFechaHora(ev.created_at)}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.user_nombre || '—'}</span>
          <span style={{ color: ev.status === 'error' ? theme.red : theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.detalles?.mensaje || (ev.detalles?.resumen || []).join(' · ')}>
            {ev.status === 'error' ? (ev.detalles?.mensaje || 'error') : `${ev.filas != null ? Number(ev.filas).toLocaleString('es-MX') + ' filas' : ''}${ev.duracion_ms ? ` · ${(ev.duracion_ms / 1000).toFixed(0)}s` : ''}${ev.filename ? ` · ${ev.filename}` : ''}`}
          </span>
          <Pill tone={ev.status === 'success' ? 'green' : ev.status === 'error' ? 'red' : 'orange'} size="xs">{ev.status === 'success' ? 'OK' : ev.status}</Pill>
        </div>
      ))}
    </div>
  );
}

export default function CargasManuales({ status, upload, fuentes = [], perfil, onRefetch }) {
  const { theme } = useTheme();
  const [abierta, setAbierta] = useState(null);
  const [cargas, setCargas] = useState({});     // id → { pct, texto }
  const [casillas, setCasillas] = useState({}); // id → { historico: bool }
  const ahora = useMemo(() => new Date(), [status]);
  const editable = puedeConfigurar(perfil);
  const quien = perfil?.nombre || perfil?.email || null;

  const subir = async (f, file) => {
    if (cargas[f.id]) return;
    const opts = casillas[f.id] || {};
    setCargas((c) => ({ ...c, [f.id]: { pct: 0, texto: 'Leyendo…' } }));
    try {
      const r = await subirArchivo(f, file, { opts, onProgress: (pct, texto) => setCargas((c) => ({ ...c, [f.id]: { pct, texto } })) });
      toast.ok(`${f.titulo}: ${r.filas.toLocaleString('es-MX')} filas en ${(r.ms / 1000).toFixed(0)} s`);
      setCasillas((c) => ({ ...c, [f.id]: {} }));
      setAbierta(f.id);
    } catch (e) {
      toast.error(`${f.titulo}: ${e.message}`, { ms: 0 });
    }
    setCargas((c) => { const n = { ...c }; delete n[f.id]; return n; });
    onRefetch?.();
  };

  const columnas = [
    { key: 'anillo', label: '', align: 'center', width: 42, render: (r) => {
      const c = cargas[r.f.id];
      const label = r.fr.cambio ? '✓' : r.fr.sinDatos ? '!' : r.fr.estado === 'atrasada' ? r.fr.diasAtraso : r.fr.dias ?? '—';
      const title = c ? c.texto : r.fr.sinDatos && !r.fr.cambio ? 'sin carga' : r.fr.estado === 'atrasada' ? `${r.fr.diasAtraso} días de atraso` : r.fr.estado === 'por_vencer' ? `vence en ${r.fr.diasParaLimite} días` : r.fr.dias != null ? `${r.fr.dias} días desde la última carga` : 'sin carga';
      return <Anillo pct={r.fr.pct} tone={r.fr.tone} label={label} progreso={c ? c.pct : null} title={title} />;
    } },
    { key: 'fuente', label: 'Fuente', align: 'left', bold: true, render: (r) => (
      <div>
        <div style={{ whiteSpace: 'nowrap' }}>{r.f.titulo}</div>
        {r.f.casilla && (
          <label onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: theme.textMuted, fontWeight: 400, marginTop: 2, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!casillas[r.f.id]?.[r.f.casilla.key]} onChange={(e) => setCasillas((c) => ({ ...c, [r.f.id]: { ...(c[r.f.id] || {}), [r.f.casilla.key]: e.target.checked } }))} style={{ accentColor: theme.accent, margin: 0 }} />
            {r.f.casilla.label}
          </label>
        )}
      </div>
    ) },
    { key: 'formato', label: 'Formato', align: 'left', wrap: true, render: (r) => (
      <div style={{ minWidth: 200 }}>
        <div style={{ fontSize: 11.5 }}>{r.f.formato[0]}</div>
        <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>{r.f.formato[1]}</div>
      </div>
    ) },
    { key: 'ultima', label: 'Última carga', align: 'left', render: (r) => r.fr.ultima ? (
      <div style={{ whiteSpace: 'nowrap' }}>
        <div>{relTiempo(r.fr.ultima)}</div>
        <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>{r.fr.ev?.user_nombre || r.fr.item?.meta?.origen || '—'}{r.fr.ev?.duracion_ms ? ` · ${(r.fr.ev.duracion_ms / 1000).toFixed(0)}s` : ''}</div>
      </div>
    ) : <span style={{ color: theme.textMuted }}>sin carga</span> },
    { key: 'registros', label: 'Registros', align: 'right', render: (r) => { const n = r.fr.ev?.status === 'success' ? r.fr.ev.filas : (r.fr.item?.registros || null); return n != null ? Number(n).toLocaleString('es-MX') : '—'; } },
    { key: 'estado', label: 'Estado', align: 'left', render: (r) => <Pill tone={r.pill.tone} dot>{r.pill.txt}</Pill> },
    { key: 'esperada', label: 'Esperada', align: 'left', render: (r) => editable
      ? <EditorCadencia key={`${r.f.id}-${JSON.stringify(r.f.cadencia)}`} fuente={r.f} theme={theme} onGuardado={{ quien, cb: onRefetch }} />
      : <span style={{ color: theme.textMuted, whiteSpace: 'nowrap' }} title={labelLimite(r.f.cadencia) || undefined}>{labelCadencia(r.f.cadencia)}</span> },
    { key: 'subir', label: '', align: 'right', render: (r) => <ZonaArrastre kind={r.f.kind} accept={r.f.accept} disabled={!!cargas[r.f.id]} onFile={(file) => subir(r.f, file)} texto={cargas[r.f.id] ? `${Math.round(cargas[r.f.id].pct * 100)} %` : undefined} /> },
  ];

  return (
    <>
      {GRUPOS.map((g) => {
        const filas = fuentes.filter((f) => f.grupo === g.id).map((f) => {
          const fr = frescuraManual(f, status, ahora, upload?.[f.statusKey]);
          return { id: f.id, f, fr, pill: pillEstado(f, fr, upload?.[f.statusKey]) };
        });
        const atrasadas = filas.filter((r) => r.fr.estado === 'atrasada').length;
        const porVencer = filas.filter((r) => r.fr.estado === 'por_vencer').length;
        const color = theme[g.color] || theme.textMuted;
        return (
          <Panel key={g.id} padding="0"
            titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />{g.label}</span>}
            meta={g.subtitle}
            acciones={<Pill tone={atrasadas ? 'red' : porVencer ? 'orange' : 'green'} dot>{atrasadas ? `${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : porVencer ? `${porVencer} por vencer` : 'al día'}</Pill>}>
            <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.id}
              onRowClick={(r) => setAbierta((a) => (a === r.id ? null : r.id))} expandidoKey={abierta}
              renderExpandido={(r) => <Historial eventos={status?.historial?.[r.f.statusKey]} theme={theme} />} />
          </Panel>
        );
      })}
    </>
  );
}
