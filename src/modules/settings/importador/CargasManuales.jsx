// Cargas manuales · un Panel por grupo (Globales, Digitalife, PCEL, Dicotech, Estados de
// cuenta). Fila = Anillo · Fuente · Formato · Última carga · Registros · Estado · Esperada ·
// zona de arrastre. Click en la fila → últimas 10 cargas de sync_events.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, TablaCompacta, toast } from '../../../components/kit';
import { GRUPOS, FUENTES } from './config';
import { frescuraManual, relTiempo, fmtFechaHora } from './frescura';
import { subirArchivo } from './subir';
import Anillo from './Anillo';
import ZonaArrastre from './ZonaArrastre';

const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmtIso = (iso) => { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? `${p[2]} ${MES[+p[1] - 1]} ${p[0]}` : iso; };

/** Texto del pill de estado: sem NN · mes · N d atraso · sin datos. */
function pillEstado(f, fr, info) {
  if (fr.estado === 'atrasada') return { tone: 'red', txt: `${fr.diasAtraso} d de atraso` };
  if (fr.estado === 'sin_datos') return { tone: 'red', txt: 'sin datos' };
  let txt = null;
  if (f.tipo === 'semana' && info?.anio && info?.semana) txt = `sem ${String(info.semana).padStart(2, '0')} · ${info.anio}`;
  else if (f.tipo === 'mes' && info?.anio && info?.mes) txt = `${MES[info.mes - 1]} ${info.anio}`;
  else if (f.tipo === 'sellout' && info?.fecha) txt = `venta ${fmtIso(info.fecha)}`;
  else if (f.tipo === 'updated' && (info?.updated_at || fr.ultima)) txt = fmtIso(info?.updated_at || new Date(fr.ultima).toISOString());
  if (fr.estado === 'pronto') return { tone: 'orange', txt: txt ? `${txt} · hoy toca` : 'hoy toca' };
  if (fr.estado === 'cambio') return { tone: fr.ultima ? 'green' : 'gray', txt: txt || (fr.ultima ? 'al día' : 'sin datos') };
  return { tone: 'green', txt: txt || 'al día' };
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

export default function CargasManuales({ status, upload, onRefetch }) {
  const { theme } = useTheme();
  const [abierta, setAbierta] = useState(null);
  const [cargas, setCargas] = useState({});     // id → { pct, texto }
  const [casillas, setCasillas] = useState({}); // id → { historico: bool }
  const ahora = useMemo(() => new Date(), [status]);

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
      const label = r.fr.estado === 'cambio' ? '✓' : r.fr.estado === 'sin_datos' ? '!' : r.fr.estado === 'atrasada' ? r.fr.diasAtraso : r.fr.dias ?? '—';
      const title = c ? c.texto : r.fr.estado === 'atrasada' ? `${r.fr.diasAtraso} días de atraso` : r.fr.dias != null ? `${r.fr.dias} días desde la última carga` : 'sin carga';
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
    { key: 'esperada', label: 'Esperada', align: 'left', render: (r) => <span style={{ color: theme.textMuted }}>{r.f.cadencia.label}</span> },
    { key: 'subir', label: '', align: 'right', render: (r) => <ZonaArrastre kind={r.f.kind} accept={r.f.accept} disabled={!!cargas[r.f.id]} onFile={(file) => subir(r.f, file)} texto={cargas[r.f.id] ? `${Math.round(cargas[r.f.id].pct * 100)} %` : undefined} /> },
  ];

  return (
    <>
      {GRUPOS.map((g) => {
        const filas = FUENTES.filter((f) => f.grupo === g.id).map((f) => {
          const fr = frescuraManual(f, status, ahora, upload?.[f.statusKey]);
          return { id: f.id, f, fr, pill: pillEstado(f, fr, upload?.[f.statusKey]) };
        });
        const atrasadas = filas.filter((r) => r.fr.estado === 'atrasada' || r.fr.estado === 'sin_datos').length;
        const color = theme[g.color] || theme.textMuted;
        return (
          <Panel key={g.id} padding="0"
            titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />{g.label}</span>}
            meta={g.subtitle}
            acciones={<Pill tone={atrasadas ? 'red' : 'green'} dot>{atrasadas ? `${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : 'al día'}</Pill>}>
            <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.id}
              onRowClick={(r) => setAbierta((a) => (a === r.id ? null : r.id))} expandidoKey={abierta}
              renderExpandido={(r) => <Historial eventos={status?.historial?.[r.f.statusKey]} theme={theme} />} />
          </Panel>
        );
      })}
    </>
  );
}
