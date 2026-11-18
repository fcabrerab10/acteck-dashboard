// Landing de propuestas generadas/cerradas (kit): tarjetas por propuesta + detalle de seguimiento en 2 pasos
// (1 · CRM, 2 · Comprado con fecha de arribo y piezas). Los avisos de arribo ya no se muestran aquí:
// viven en el centro de notificaciones (alertas area 'forecast', cron generar-alertas).
import React, { useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton, TablaCompacta, toast } from '../../../components/kit';
import { MONO, fmtFechaCorta } from '../inventario/constantes';
import { CLIENTES, fmtInt, N } from './textos';

const ESTATUS = { generada: { tone: 'blue', label: 'Generada' }, cerrada: { tone: 'green', label: 'Cerrada' } };

function ChkPill({ done, onClick, label }) {
  const { theme } = useTheme();
  return (
    <Pill tone={done ? 'green' : 'gray'} size="xs" onClick={onClick} title={label} style={{ cursor: 'pointer', border: `1px solid ${done ? 'currentColor' : theme.border}`, padding: '2px 8px' }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: done ? 'currentColor' : 'transparent', boxShadow: done ? 'none' : `inset 0 0 0 1.5px ${theme.textSubtle || theme.textMuted}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {done && <span style={{ color: theme.surface, fontSize: 8, fontWeight: 800, lineHeight: 1 }}>✓</span>}
      </span>
      {done ? 'Hecho' : label}
    </Pill>
  );
}

function CeldaFecha({ linea, onActualizar }) {
  const { theme } = useTheme();
  const [fecha, setFecha] = useState(linea.fecha_arribo_estimada || '');
  useEffect(() => setFecha(linea.fecha_arribo_estimada || ''), [linea.fecha_arribo_estimada]);
  return (
    <input type="date" value={fecha} aria-label="Arribo estimado" onChange={(e) => setFecha(e.target.value)}
      onBlur={() => { if (fecha !== (linea.fecha_arribo_estimada || '')) onActualizar(linea, { fecha_arribo_estimada: fecha || null }); }}
      style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11, outline: 'none' }} />
  );
}

function CeldaPiezas({ linea, onActualizar }) {
  const { theme } = useTheme();
  const reservo = N(linea.reservo);
  const inicial = () => (linea.piezas_a_reservar_arribo == null ? String(reservo) : String(linea.piezas_a_reservar_arribo));
  const [v, setV] = useState(inicial);
  useEffect(() => setV(inicial()), [linea.piezas_a_reservar_arribo, reservo]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input value={v} inputMode="numeric" aria-label="Piezas a reservar en el arribo" onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))}
      onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      onBlur={() => { const n = Number(v); if (!isNaN(n) && n !== (linea.piezas_a_reservar_arribo ?? reservo)) onActualizar(linea, { piezas_a_reservar_arribo: n }); }}
      style={{ width: 64, padding: '3px 8px', borderRadius: 6, textAlign: 'right', border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: MONO, fontSize: 11, fontWeight: 600, outline: 'none' }} />
  );
}

function Detalle({ propuesta, yoId, onActualizarLinea, onClose }) {
  const { theme } = useTheme();
  const lineas = propuesta.forecast_propuesta_lineas || [];
  const totalReservo = lineas.reduce((a, l) => a + N(l.reservo), 0);
  const nCrm = lineas.filter((l) => l.crm_subido_at).length;
  const nComp = lineas.filter((l) => l.comprado_at).length;
  const toggleCrm = (l) => onActualizarLinea(l, l.crm_subido_at ? { crm_subido_at: null, crm_subido_por: null } : { crm_subido_at: new Date().toISOString(), crm_subido_por: yoId, estado: 'subido_crm' });
  const toggleComp = (l) => {
    if (l.comprado_at) { onActualizarLinea(l, { comprado_at: null, comprado_por: null }); return; }
    if (!l.fecha_arribo_estimada) { toast.info('Captura primero la fecha de arribo estimada.'); return; }
    onActualizarLinea(l, { comprado_at: new Date().toISOString(), comprado_por: yoId, piezas_a_reservar_arribo: l.piezas_a_reservar_arribo ?? N(l.reservo), estado: 'comprado' });
  };
  return (
    <Panel titulo="Seguimiento por SKU" style={{ gridColumn: '1 / -1' }} padding="0"
      meta={<span><span style={{ color: nCrm === lineas.length ? theme.green : theme.text }}>{nCrm}/{lineas.length} CRM</span> · <span style={{ color: nComp === lineas.length ? theme.green : theme.text }}>{nComp}/{lineas.length} compradas</span> · {fmtInt(totalReservo)} pz</span>}
      acciones={<Boton icon={X} onClick={onClose}>Cerrar</Boton>}>
      <TablaCompacta dense vacio="Sin líneas." filas={lineas} rowKey={(l) => l.id}
        columnas={[
          { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100, render: (l) => <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: theme.accent }}>{l.sku}</span> },
          { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 260, render: (l) => <span title={l.descripcion}>{l.descripcion || '—'}</span> },
          { key: 'reservo', label: 'Reservo', sum: true, render: (l) => fmtInt(l.reservo) },
          { key: 'crm', label: '1 · CRM', align: 'center', render: (l) => <ChkPill done={!!l.crm_subido_at} onClick={() => toggleCrm(l)} label="Subir" /> },
          { key: 'comp', label: '2 · Comprado', align: 'center', render: (l) => <ChkPill done={!!l.comprado_at} onClick={() => toggleComp(l)} label="Comprar" /> },
          { key: 'fecha', label: 'Arribo estimado', align: 'left', render: (l) => <CeldaFecha linea={l} onActualizar={onActualizarLinea} /> },
          { key: 'pz', label: 'Pz a reservar', render: (l) => <CeldaPiezas linea={l} onActualizar={onActualizarLinea} /> },
        ]} />
      <div style={{ padding: '8px 12px', fontSize: 10.5, color: theme.textMuted, lineHeight: 1.5 }}>
        Al marcar <b style={{ color: theme.text }}>Comprado</b> con fecha de arribo, el centro de notificaciones avisa <b style={{ color: theme.text }}>3 días antes</b> y <b style={{ color: theme.text }}>el día del arribo</b> (área Forecast; el cron diario las genera y las retira 3 días después del arribo).
      </div>
    </Panel>
  );
}

export default function Landing({ propuestas, propuestaAbierta, setPropuestaAbierta, yoId, onNueva, onReabrir, onEliminar, onActualizarLinea }) {
  const { theme } = useTheme();
  const [colsN, setColsN] = useState(3);
  useEffect(() => {
    const on = () => { const w = window.innerWidth; setColsN(w >= 1400 ? 4 : w >= 1100 ? 3 : w >= 780 ? 2 : 1); };
    on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, []);

  return (
    <Panel titulo="Propuestas generadas" meta={`${propuestas.length} propuesta${propuestas.length === 1 ? '' : 's'}`}
      acciones={<Boton icon={Plus} primario onClick={onNueva}>Nueva propuesta</Boton>}>
      {propuestas.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: theme.textMuted, fontSize: 12.5 }}>Aún no hay propuestas generadas. Arma una en <b style={{ color: theme.text }}>Armador</b>.</div>
      ) : (
        <div data-stagger style={{ display: 'grid', gridTemplateColumns: `repeat(${colsN}, minmax(0, 1fr))`, gap: 10 }}>
          {propuestas.map((p, idx) => {
            const lineas = p.forecast_propuesta_lineas || [];
            const totalPz = lineas.reduce((a, l) => a + N(l.reservo), 0);
            const porCli = CLIENTES.map((c) => ({ ...c, pz: lineas.reduce((a, l) => a + N(l.reservo) * (N(l[c.campo]) / Math.max(1, N(l.recomendado))), 0) }));
            const st = ESTATUS[p.estatus] || { tone: 'gray', label: p.estatus };
            const abierta = propuestaAbierta?.id === p.id;
            const ultimoDeFila = ((idx + 1) % colsN === 0) || idx === propuestas.length - 1;
            const filaIni = Math.floor(idx / colsN) * colsN;
            const abiertaEnFila = propuestaAbierta && propuestas.slice(filaIni, filaIni + colsN).some((x) => x.id === propuestaAbierta.id);
            return (
              <React.Fragment key={p.id}>
                <Panel elevable padding="12px 14px" style={{ cursor: 'pointer', borderColor: abierta ? theme.accent : undefined }}>
                  <div onClick={() => setPropuestaAbierta(abierta ? null : p)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>{fmtFechaCorta(p.generado_at)} · {lineas.length} SKU{lineas.length === 1 ? '' : 's'}</div>
                      </div>
                      <Pill tone={st.tone} size="xs">{st.label}</Pill>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: theme.accent, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>{fmtInt(totalPz)} <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, fontFamily: TYPO.fontDisplay }}>pz</span></div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                      {porCli.map((c) => <Pill key={c.key} tone={c.tone} size="xs" dot>{c.short} {fmtInt(c.pz)}</Pill>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: `1px solid ${theme.border}` }}>
                    <Boton onClick={() => setPropuestaAbierta(abierta ? null : p)} style={{ flex: 1, justifyContent: 'center' }}>{abierta ? 'Cerrar detalle' : 'Ver detalle'}</Boton>
                    <Boton icon={RotateCcw} onClick={() => onReabrir(p)} title="Reabrir como borrador">Reabrir</Boton>
                    <Boton icon={Trash2} peligro onClick={() => onEliminar(p)} title="Eliminar" />
                  </div>
                </Panel>
                {abiertaEnFila && ultimoDeFila && propuestaAbierta && (
                  <Detalle propuesta={propuestaAbierta} yoId={yoId} onActualizarLinea={onActualizarLinea} onClose={() => setPropuestaAbierta(null)} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
