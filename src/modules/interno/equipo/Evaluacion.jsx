// Evaluación mensual + bono (sólo usuarios con perfiles.se_evalua). Port del EvalPanel viejo al kit V3.
// Estado optimista: cada cambio actualiza la UI al instante y escribe evaluaciones_mensuales en segundo plano.
// Bono = BONO_BASE + BONO_PCT × facturación (Digitalife + PCEL + Dicotech) + ajustes. "Cerrar y pagar" congela la fila.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check, Lock } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { money, moneyCompact } from '../../../lib/format';
import { Panel, Pill, Boton, Segmented, toast, GraficaLineas } from '../../../components/kit';
import { suaveBg, hairline } from '../../../components/perfil/comun';
import { BONO_BASE, BONO_PCT, serieBonos } from './calculo.js';
import { MESES, MESES_CORTO, nombreCorto } from './textos.js';
import { upsertEvaluacion } from './datos.js';

export const RATINGS = [
  { key: 'rating_comunicacion', label: 'Comunicación' },
  { key: 'rating_iniciativa',   label: 'Iniciativa' },
  { key: 'rating_calidad',      label: 'Calidad del trabajo' },
  { key: 'rating_cumplimiento', label: 'Cumplimiento' },
  { key: 'rating_valor',        label: 'Aporte de valor' },
];

const sumaAjustes = (ajustes) => (ajustes || []).reduce((s, a) => s + (Number(a.monto) || 0), 0);

/** Texto plano del resumen para pegar en WhatsApp/correo. */
export function textoResumen({ user, anio, mes, facturacion, cuota, cuotaPct, evaluacion, agenda }) {
  const rats = RATINGS.map((r) => evaluacion?.[r.key]).filter(Boolean);
  const promRat = rats.length ? rats.reduce((s, v) => s + v, 0) / rats.length : 0;
  const tareas = evaluacion?.tareas || [];
  const cumplidas = tareas.filter((t) => t.cumplida).length;
  const pendientes = tareas.filter((t) => !t.cumplida);
  const ajustes = evaluacion?.ajustes || [];
  const ajustesTotal = sumaAjustes(ajustes);
  const bonoTotal = BONO_BASE + facturacion * BONO_PCT + ajustesTotal;
  const L = [`Evaluación de ${nombreCorto(user.nombre)} · ${MESES[mes - 1]} ${anio}`, ''];
  L.push(`Alcance de cuota: ${money(facturacion)} de ${money(cuota)} (${cuotaPct.toFixed(0)}%${cuotaPct >= 100 ? ', superada' : ''}).`);
  if (rats.length) L.push('', `Evaluación cualitativa: ${promRat.toFixed(1)}/5.`);
  if (agenda && agenda.cerrados) L.push('', `Pendientes: ${agenda.cerrados} cerrados en 30 días, ${agenda.pctATiempo ?? 0}% a tiempo; ${agenda.abiertos} abiertos${agenda.vencidos ? ` (${agenda.vencidos} vencidos)` : ''}.`);
  if (evaluacion?.comentarios?.trim()) L.push('', `Feedback: ${evaluacion.comentarios.trim()}`);
  if (tareas.length) L.push('', `Tareas: ${cumplidas} de ${tareas.length} cumplidas${pendientes.length > 0 && pendientes.length <= 3 ? `; pendientes: ${pendientes.map((t) => t.texto).join('; ')}` : ''}.`);
  if (ajustes.length) { L.push('', 'Ajustes:'); for (const a of ajustes) L.push(`- ${Number(a.monto) >= 0 ? '+' : '−'}${money(Math.abs(Number(a.monto)))} · ${a.descripcion || ''}`); }
  L.push('', 'Bono:', `- Variable fija: ${money(BONO_BASE)}`, `- Comisión ${(BONO_PCT * 100).toFixed(2)}% sobre ${money(facturacion)}: ${money(facturacion * BONO_PCT)}`);
  if (ajustesTotal !== 0) L.push(`- Ajustes: ${ajustesTotal >= 0 ? '+' : ''}${money(ajustesTotal)}`);
  L.push(`Total a pagar: ${money(bonoTotal)}`);
  return L.join('\n');
}

export default function Evaluacion({ user, anio, mes, detalle, cargando, perfilId, agenda, evaluaciones, onGuardado }) {
  const { theme } = useTheme();
  const evaluacion = detalle?.evaluacion || null;
  const facturacion = detalle?.facturacion || 0;
  const cuota = detalle?.cuota || 0;
  const cuotaPct = detalle?.cuotaPct || 0;
  const [local, setLocal] = useState(evaluacion);
  const [confirmar, setConfirmar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const idRef = useRef(evaluacion?.id || null);
  useEffect(() => { setLocal(evaluacion); idRef.current = evaluacion?.id || null; setConfirmar(false); }, [evaluacion?.id, anio, mes]);

  const cerrada = local?.cerrada === true;
  const bonoBase = BONO_BASE + facturacion * BONO_PCT;
  const ajustesTotal = sumaAjustes(local?.ajustes);
  const bonoTotal = bonoBase + ajustesTotal;
  const base = { facturacion, cuota_total: cuota, cuota_pct: cuotaPct, bono_base: bonoBase, bono_ajustes: 0, bono_total: bonoBase };

  const guardar = (patch) => {
    if (cerrada) return;
    setLocal((prev) => ({ ...(prev || {}), ...patch }));
    upsertEvaluacion({ id: idRef.current, userId: user.user_id, anio, mes, base, patch })
      .then((id) => { if (id) idRef.current = id; })
      .catch((e) => toast.error(`No se pudo guardar la evaluación: ${e.message || e}`));
  };
  const cerrar = async () => {
    if (cerrada) return;
    const patch = { facturacion, cuota_total: cuota, cuota_pct: cuotaPct, bono_base: bonoBase, bono_ajustes: ajustesTotal, bono_total: bonoTotal, cerrada: true, cerrada_ts: new Date().toISOString(), cerrada_por: perfilId };
    setLocal((prev) => ({ ...(prev || {}), ...patch }));
    setConfirmar(false);
    try {
      const id = await upsertEvaluacion({ id: idRef.current, userId: user.user_id, anio, mes, base, patch });
      if (id) idRef.current = id;
      toast.ok(`Evaluación de ${MESES[mes - 1]} cerrada · bono ${money(bonoTotal)}`);
      onGuardado?.();
    } catch (e) { toast.error(`No se pudo cerrar: ${e.message || e}`); }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoResumen({ user, anio, mes, facturacion, cuota, cuotaPct, evaluacion: local, agenda }));
      setCopiado(true); setTimeout(() => setCopiado(false), 2000); toast.ok('Resumen copiado');
    } catch { toast.error('No se pudo copiar'); }
  };

  const serie = useMemo(() => serieBonos(evaluaciones, user.user_id, { hoy: new Date() }), [evaluaciones, user.user_id]);
  const sub = { fontSize: 11, color: theme.textMuted };
  const fila = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 11.5 };
  const num = { fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Bono + cuota */}
      <Panel titulo={`Bono · ${MESES_CORTO[mes - 1]} ${anio}`} meta={cargando ? 'cargando…' : cerrada ? 'cerrada' : 'abierta'}
        acciones={<Pill tone={cerrada ? 'green' : 'gray'} dot>{cerrada ? 'Cerrada' : 'Abierta'}</Pill>}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{money(bonoTotal)}</span>
          <span style={sub}>a pagar {cerrada && local?.cerrada_ts ? `· cerrada el ${new Date(local.cerrada_ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` : ''}</span>
        </div>
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${hairline(theme)}` }}>
          <div style={fila}><span style={sub}>Variable fija</span><span style={num}>{money(BONO_BASE)}</span></div>
          <div style={fila}><span style={sub}>+ {(BONO_PCT * 100).toFixed(2)}% sobre {money(facturacion)} facturados</span><span style={num}>+{money(facturacion * BONO_PCT)}</span></div>
          {ajustesTotal !== 0 && <div style={fila}><span style={sub}>Ajustes</span><span style={{ ...num, color: ajustesTotal >= 0 ? theme.green : theme.red }}>{ajustesTotal >= 0 ? '+' : ''}{money(ajustesTotal)}</span></div>}
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${hairline(theme)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={sub}>Facturado vs cuota (Digitalife + PCEL + Dicotech)</span>
            <span style={{ ...num, color: cuotaPct >= 100 ? theme.green : theme.text }}>{cuotaPct.toFixed(0)}%</span>
          </div>
          <div style={{ height: 4, background: suaveBg(theme), borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, cuotaPct)}%`, background: cuotaPct >= 100 ? theme.green : cuotaPct >= 85 ? theme.accent : theme.orange, borderRadius: 999 }} />
          </div>
          <div style={{ ...fila, marginTop: 4 }}><span style={sub}>Fact. <b style={num}>{money(facturacion)}</b></span><span style={sub}>Cuota <b style={num}>{money(cuota)}</b></span></div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Boton icon={copiado ? Check : Copy} onClick={copiar}>{copiado ? 'Copiado' : 'Copiar resumen'}</Boton>
          {!cerrada && !confirmar && <Boton primario icon={Lock} onClick={() => setConfirmar(true)} disabled={cargando}>Cerrar y pagar</Boton>}
          {confirmar && <><Boton onClick={() => setConfirmar(false)}>Cancelar</Boton><Boton primario peligro onClick={cerrar}>Confirmar cierre</Boton></>}
        </div>
        {anio === 2026 && mes === 6 && <div style={{ ...sub, marginTop: 8 }}>Nota · La telemetría inició en julio 2026; junio se evalúa con actividad estimada al 100 %.</div>}
      </Panel>

      {/* Ratings */}
      <Panel titulo="Evaluación cualitativa" meta="1 a 5">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {RATINGS.map((r) => (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: theme.text }}>{r.label}</span>
              <Segmented value={local?.[r.key] || 0} onChange={(n) => !cerrada && guardar({ [r.key]: n })}
                options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: String(n), disabled: cerrada }))} />
            </div>
          ))}
        </div>
      </Panel>

      {/* Comentarios */}
      <Panel titulo="Comentarios" meta="feedback del mes">
        <textarea disabled={cerrada} key={`c-${anio}-${mes}-${local?.id || 'n'}`} defaultValue={local?.comentarios || ''}
          onBlur={(e) => e.target.value !== (local?.comentarios || '') && guardar({ comentarios: e.target.value })}
          placeholder="Feedback del mes…"
          style={{ width: '100%', minHeight: 72, padding: 10, fontSize: 12.5, fontFamily: TYPO.fontText, color: theme.text, background: suaveBg(theme), border: `1px solid transparent`, borderRadius: 10, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
      </Panel>

      {/* Tareas */}
      <Panel titulo="Tareas del mes" meta={local?.tareas?.length ? `${(local.tareas || []).filter((t) => t.cumplida).length}/${local.tareas.length} cumplidas` : 'sin tareas'}>
        <Tareas tareas={local?.tareas || []} onChange={(t) => guardar({ tareas: t })} disabled={cerrada} />
      </Panel>

      {/* Ajustes */}
      <Panel titulo="Ajustes al bono" meta={ajustesTotal !== 0 ? `${ajustesTotal >= 0 ? '+' : ''}${money(ajustesTotal)}` : 'sin ajustes'}>
        <Ajustes ajustes={local?.ajustes || []} onChange={(a) => guardar({ ajustes: a })} disabled={cerrada} />
      </Panel>

      {/* Historial 12 meses */}
      <Panel titulo="Historial de bonos" meta="12 meses">
        <HistorialBonos serie={serie} anio={anio} mes={mes} />
      </Panel>
    </div>
  );
}

function HistorialBonos({ serie, anio, mes }) {
  const { theme } = useTheme();
  const datos = serie.map((s) => ({ ...s, label: `${MESES_CORTO[s.mes - 1]}${s.mes === 1 ? ` ${String(s.anio).slice(2)}` : ''}` }));
  const conDatos = datos.filter((d) => d.bono != null);
  if (!conDatos.length) return <div style={{ fontSize: 12, color: theme.textMuted, padding: '6px 0' }}>Aún no hay evaluaciones cerradas.</div>;
  const idxActual = datos.findIndex((d) => d.anio === anio && d.mes === mes && d.bono != null);
  return (
    <GraficaLineas datos={datos.map((d) => ({ x: d.label, bono: d.bono }))} series={[{ key: 'bono', label: 'Bono', tipo: 'principal' }]}
      formato={moneyCompact} alto={150} mesActivo={idxActual >= 0 ? idxActual : null} leyenda={false} />
  );
}

const inputStyle = (theme, extra = {}) => ({ fontFamily: TYPO.fontText, fontSize: 12, padding: '5px 9px', color: theme.text, background: suaveBg(theme), border: '1px solid transparent', borderRadius: 8, outline: 'none', boxSizing: 'border-box', ...extra });

function Tareas({ tareas, onChange, disabled }) {
  const { theme } = useTheme();
  const [nueva, setNueva] = useState('');
  const add = () => { const t = nueva.trim(); if (!t) return; onChange([...tareas, { id: Date.now(), texto: t, cumplida: false, nota: '' }]); setNueva(''); };
  const toggle = (i) => onChange(tareas.map((t, k) => (k === i ? { ...t, cumplida: !t.cumplida } : t)));
  const remove = (i) => onChange(tareas.filter((_, k) => k !== i));
  const setNota = (i, nota) => onChange(tareas.map((t, k) => (k === i ? { ...t, nota } : t)));
  return (
    <div>
      {tareas.length === 0 && <div style={{ fontSize: 12, color: theme.textMuted }}>Sin tareas aún.</div>}
      {tareas.map((t, i) => (
        <div key={t.id || i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${hairline(theme)}` }}>
          <button type="button" disabled={disabled} onClick={() => toggle(i)} aria-label={t.cumplida ? 'Marcar pendiente' : 'Marcar cumplida'}
            style={{ width: 16, height: 16, marginTop: 2, borderRadius: 4, border: `1.5px solid ${t.cumplida ? theme.green : theme.border}`, background: t.cumplida ? theme.green : 'transparent', color: theme.textOnDark || theme.surface, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', padding: 0 }}>{t.cumplida ? '✓' : ''}</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: t.cumplida ? theme.textMuted : theme.text, textDecoration: t.cumplida ? 'line-through' : 'none' }}>{t.texto}</div>
            {!disabled
              ? <input defaultValue={t.nota || ''} onBlur={(e) => e.target.value !== (t.nota || '') && setNota(i, e.target.value)} placeholder="+ nota" style={{ fontSize: 10.5, color: theme.textMuted, background: 'transparent', border: 'none', outline: 'none', width: '100%', marginTop: 2, fontFamily: TYPO.fontText }} />
              : t.nota && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>→ {t.nota}</div>}
          </div>
          {!disabled && <button type="button" onClick={() => remove(i)} aria-label="Quitar" style={{ color: theme.textMuted, background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', padding: 0 }}>×</button>}
        </div>
      ))}
      {!disabled && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Nueva tarea…" style={inputStyle(theme, { flex: 1 })} />
          <Boton primario onClick={add}>Agregar</Boton>
        </div>
      )}
    </div>
  );
}

function Ajustes({ ajustes, onChange, disabled }) {
  const { theme } = useTheme();
  const [nuevo, setNuevo] = useState({ fecha: new Date().toISOString().slice(0, 10), descripcion: '', monto: '' });
  const add = () => {
    const monto = Number(nuevo.monto);
    if (!nuevo.descripcion.trim() || !Number.isFinite(monto) || monto === 0) return;
    onChange([...ajustes, { id: Date.now(), ...nuevo, descripcion: nuevo.descripcion.trim(), monto }]);
    setNuevo({ fecha: nuevo.fecha, descripcion: '', monto: '' });
  };
  const remove = (i) => onChange(ajustes.filter((_, k) => k !== i));
  return (
    <div>
      {ajustes.length === 0 && <div style={{ fontSize: 12, color: theme.textMuted }}>Sin ajustes aún.</div>}
      {ajustes.map((a, i) => (
        <div key={a.id || i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto auto', gap: 8, alignItems: 'baseline', padding: '5px 0', borderBottom: `1px solid ${hairline(theme)}`, fontSize: 12 }}>
          <span style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{a.fecha}</span>
          <span style={{ color: theme.text }}>{a.descripcion}</span>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: Number(a.monto) >= 0 ? theme.green : theme.red }}>{Number(a.monto) >= 0 ? '+' : '−'}{money(Math.abs(Number(a.monto)))}</span>
          {!disabled ? <button type="button" onClick={() => remove(i)} aria-label="Quitar" style={{ color: theme.textMuted, background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', padding: 0 }}>×</button> : <span />}
        </div>
      ))}
      {!disabled && (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '120px 1fr 90px auto', gap: 6 }}>
          <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} style={inputStyle(theme, { fontSize: 11 })} />
          <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Descripción…" style={inputStyle(theme)} />
          <input type="number" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="±$" step="50" style={inputStyle(theme, { fontVariantNumeric: 'tabular-nums' })} />
          <Boton primario onClick={add}>Agregar</Boton>
        </div>
      )}
    </div>
  );
}
