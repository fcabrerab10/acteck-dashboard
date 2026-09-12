// Evaluación mensual en el celular (sólo perfiles.se_evalua). Mismos campos y misma tabla que la web
// (src/modules/interno/equipo/Evaluacion.jsx): calificaciones 1-5, comentarios, tareas del mes, ajustes al
// bono, "Cerrar y pagar" e historial de 12 meses. Se reutilizan sus helpers (RATINGS, textoResumen),
// `upsertEvaluacion` y `serieBonos`.
//
// Guardado al momento: cada cambio pinta la UI al instante, se acumula en un patch y se escribe 600 ms
// después (debounce) con indicador "Guardando… / Guardado". Al salir de la pantalla se vacía lo pendiente.
// Facturado vs cuota: Digitalife + PCEL + Dicotech. Sin costos ni márgenes.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Lock, Share2, Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { GraficaLineas } from '../../../components/kit';
import { compartir, copiar } from '../../../lib/whatsapp';
import { BONO_BASE, BONO_PCT, serieBonos } from '../../../modules/interno/equipo/calculo.js';
import { MESES, MESES_CORTO } from '../../../modules/interno/equipo/textos.js';
import { useDetalleMes, upsertEvaluacion, useInvalidarEquipo } from '../../../modules/interno/equipo/datos.js';
import { RATINGS, textoResumen } from '../../../modules/interno/equipo/Evaluacion.jsx';
import { ListaAgrupada, TituloSeccionM, Segmented, Pill, BotonGrande, Skeleton, toast } from '../../piezas';
import { CampoM } from '../agenda/comun';
import { money, moneyCompact, MONO } from '../../util';

const DEBOUNCE_MS = 600;
const sumaAjustes = (a) => (a || []).reduce((s, x) => s + (Number(x.monto) || 0), 0);

export default function EvaluacionM({ u, agenda, evaluaciones, mesActual }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const [mesRef, setMesRef] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const invalidar = useInvalidarEquipo();

  const meses = useMemo(() => {
    const arr = []; let a = hoy.getFullYear(), m = hoy.getMonth() + 1;
    for (let i = 0; i < 4; i++) { arr.push({ id: `${a}-${m}`, anio: a, mes: m, label: MESES_CORTO[m - 1] }); m -= 1; if (m < 1) { m = 12; a -= 1; } }
    return arr.reverse();
  }, [hoy]);

  const detalle = useDetalleMes(u.user_id, mesRef.anio, mesRef.mes, true);
  const d = detalle.data;
  const evaluacion = d?.evaluacion || null;
  const facturacion = d?.facturacion || 0;
  const cuota = d?.cuota || 0;
  const cuotaPct = d?.cuotaPct || 0;

  const [local, setLocal] = useState(evaluacion);
  const [estado, setEstado] = useState('listo');      // listo · guardando · guardado · error
  const [confirmar, setConfirmar] = useState(false);
  const idRef = useRef(evaluacion?.id || null);
  const pend = useRef({});
  const timer = useRef(null);

  useEffect(() => { setLocal(evaluacion); idRef.current = evaluacion?.id || null; setConfirmar(false); setEstado('listo'); }, [evaluacion?.id, mesRef.anio, mesRef.mes]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrada = local?.cerrada === true;
  const bonoBase = BONO_BASE + facturacion * BONO_PCT;
  const ajustesTotal = sumaAjustes(local?.ajustes);
  const bonoTotal = bonoBase + ajustesTotal;
  const base = { facturacion, cuota_total: cuota, cuota_pct: cuotaPct, bono_base: bonoBase, bono_ajustes: 0, bono_total: bonoBase };

  const escribir = async (patch) => {
    try {
      const id = await upsertEvaluacion({ id: idRef.current, userId: u.user_id, anio: mesRef.anio, mes: mesRef.mes, base, patch });
      if (id) idRef.current = id;
      setEstado('guardado');
    } catch (e) { setEstado('error'); toast.error(`No se pudo guardar: ${e.message || e}`); }
  };
  const vaciar = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const patch = pend.current; pend.current = {};
    if (Object.keys(patch).length) escribir(patch);
  };
  const guardar = (patch) => {
    if (cerrada) return;
    setLocal((p) => ({ ...(p || {}), ...patch }));
    pend.current = { ...pend.current, ...patch };
    setEstado('guardando');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(vaciar, DEBOUNCE_MS);
  };
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); const p = pend.current; pend.current = {}; if (Object.keys(p).length) escribir(p); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = async () => {
    if (cerrada) return;
    vaciar();
    const patch = { facturacion, cuota_total: cuota, cuota_pct: cuotaPct, bono_base: bonoBase, bono_ajustes: ajustesTotal, bono_total: bonoTotal, cerrada: true, cerrada_ts: new Date().toISOString() };
    setLocal((p) => ({ ...(p || {}), ...patch }));
    setConfirmar(false);
    try {
      const id = await upsertEvaluacion({ id: idRef.current, userId: u.user_id, anio: mesRef.anio, mes: mesRef.mes, base, patch });
      if (id) idRef.current = id;
      toast.ok(`Evaluación de ${MESES[mesRef.mes - 1]} cerrada · bono ${money(bonoTotal)}`);
      detalle.refetch(); invalidar();
    } catch (e) { toast.error(`No se pudo cerrar: ${e.message || e}`); }
  };

  const texto = () => textoResumen({ user: u, anio: mesRef.anio, mes: mesRef.mes, facturacion, cuota, cuotaPct, evaluacion: local, agenda });
  const serie = useMemo(() => serieBonos(evaluaciones, u.user_id, { hoy }), [evaluaciones, u.user_id, hoy]);
  const datosGrafica = useMemo(() => serie.map((s) => ({ x: MESES_CORTO[s.mes - 1], bono: s.bono })), [serie]);

  const sub = { fontSize: 11.5, color: theme.textMuted };
  const num = { fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: theme.text };
  const fila = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <Segmented value={`${mesRef.anio}-${mesRef.mes}`} onChange={(id) => { const m = meses.find((x) => x.id === id); if (m) setMesRef({ anio: m.anio, mes: m.mes }); }} options={meses} />
        <span style={{ ...sub, fontSize: 11 }}>
          {cerrada ? 'Cerrada' : estado === 'guardando' ? 'Guardando…' : estado === 'guardado' ? '● Guardado' : estado === 'error' ? 'Error al guardar' : 'Abierta'}
        </span>
      </div>

      {detalle.isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={150} r={12} /></div>}

      {/* Bono del mes */}
      <section style={{ padding: '0 16px' }}>
        <TituloSeccionM meta={cerrada ? 'cerrada' : 'abierta'}>Bono · {MESES_CORTO[mesRef.mes - 1]} {mesRef.anio}</TituloSeccionM>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{money(bonoTotal)}</span>
            <span style={sub}>a pagar</span>
            {cerrada && <Pill tone="green" size="xs" dot>cerrada</Pill>}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.border}` }}>
            <div style={fila}><span style={sub}>Variable fija</span><span style={num}>{money(BONO_BASE)}</span></div>
            <div style={fila}><span style={sub}>{(BONO_PCT * 100).toFixed(2)}% sobre {money(facturacion)}</span><span style={num}>+{money(facturacion * BONO_PCT)}</span></div>
            {ajustesTotal !== 0 && <div style={fila}><span style={sub}>Ajustes</span><span style={{ ...num, color: ajustesTotal >= 0 ? theme.green : theme.red }}>{ajustesTotal >= 0 ? '+' : ''}{money(ajustesTotal)}</span></div>}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={sub}>Facturado vs cuota</span>
              <span style={{ ...num, color: cuotaPct >= 100 ? theme.green : theme.text }}>{cuotaPct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 5, background: `${theme.text}12`, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, cuotaPct)}%`, background: cuotaPct >= 100 ? theme.green : cuotaPct >= 85 ? theme.accent : theme.orange, borderRadius: 999 }} />
            </div>
            <div style={{ ...fila, marginTop: 5 }}>
              <span style={sub}>Fact. <b style={num}>{money(facturacion)}</b></span>
              <span style={sub}>Cuota <b style={num}>{money(cuota)}</b></span>
            </div>
          </div>
        </div>
      </section>

      {/* Calificaciones */}
      <section style={{ padding: '0 16px' }}>
        <TituloSeccionM meta="1 a 5">Evaluación cualitativa</TituloSeccionM>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '4px 12px' }}>
          {RATINGS.map((r, i) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: i === 0 ? 0 : `1px solid ${theme.border}` }}>
              <span style={{ fontSize: 13.5, color: theme.text }}>{r.label}</span>
              <Segmented value={local?.[r.key] || 0} onChange={(n) => guardar({ [r.key]: n })}
                options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: String(n), disabled: cerrada }))} />
            </div>
          ))}
        </div>
      </section>

      {/* Comentarios */}
      <section style={{ padding: '0 16px' }}>
        <TituloSeccionM>Comentarios del mes</TituloSeccionM>
        <CampoM multiline value={local?.comentarios || ''} onChange={(v) => guardar({ comentarios: v })} placeholder="Feedback del mes…" disabled={cerrada} style={{ minHeight: 84 }} />
      </section>

      {/* Tareas */}
      <TareasM tareas={local?.tareas || []} onChange={(t) => guardar({ tareas: t })} disabled={cerrada} />

      {/* Ajustes */}
      <AjustesM ajustes={local?.ajustes || []} onChange={(a) => guardar({ ajustes: a })} disabled={cerrada} total={ajustesTotal} />

      {/* Historial */}
      <section style={{ padding: '0 16px' }}>
        <TituloSeccionM meta="12 meses">Historial de bonos</TituloSeccionM>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 8px' }}>
          {datosGrafica.some((x) => x.bono != null)
            ? <GraficaLineas compacto datos={datosGrafica} series={[{ key: 'bono', label: 'Bono', tipo: 'principal' }]} formato={moneyCompact} alto={130} leyenda={false} />
            : <div style={{ fontSize: 12, color: theme.textMuted, padding: '10px 6px' }}>Aún no hay evaluaciones cerradas.</div>}
        </div>
      </section>

      {/* Acciones */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BotonGrande icon={Share2} onClick={() => compartir(texto(), { titulo: `Evaluación · ${MESES[mesRef.mes - 1]}` })}>Compartir resumen</BotonGrande>
        <BotonGrande icon={Copy} onClick={async () => { const ok = await copiar(texto()); if (ok) toast.ok('Resumen copiado'); else toast.error('No se pudo copiar'); }}>Copiar resumen</BotonGrande>
        {!cerrada && !confirmar && <BotonGrande primario icon={Lock} onClick={() => setConfirmar(true)}>Cerrar y pagar</BotonGrande>}
        {!cerrada && confirmar && (
          <>
            <div style={{ ...sub, textAlign: 'center' }}>Se congela el bono de {MESES[mesRef.mes - 1]} en {money(bonoTotal)}. No se podrá editar.</div>
            <BotonGrande primario icon={Check} onClick={cerrar}>Confirmar cierre</BotonGrande>
            <BotonGrande onClick={() => setConfirmar(false)}>Cancelar</BotonGrande>
          </>
        )}
        {mesActual && mesRef.anio === hoy.getFullYear() && mesRef.mes === hoy.getMonth() + 1 && (
          <div style={{ ...sub, textAlign: 'center', fontFamily: MONO, fontSize: 11 }}>Mes en curso · bono estimado {money(mesActual.bonoBase)}</div>
        )}
      </div>
    </div>
  );
}

function TareasM({ tareas, onChange, disabled, }) {
  const { theme } = useTheme();
  const [nueva, setNueva] = useState('');
  const add = () => { const t = nueva.trim(); if (!t) return; onChange([...tareas, { id: Date.now(), texto: t, cumplida: false, nota: '' }]); setNueva(''); };
  const toggle = (i) => onChange(tareas.map((t, k) => (k === i ? { ...t, cumplida: !t.cumplida } : t)));
  const quitar = (i) => onChange(tareas.filter((_, k) => k !== i));
  const cumplidas = tareas.filter((t) => t.cumplida).length;
  return (
    <ListaAgrupada titulo="Tareas del mes" meta={tareas.length ? `${cumplidas}/${tareas.length}` : '0'}>
      {tareas.map((t, i) => (
        <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', minHeight: 48, boxSizing: 'border-box' }}>
          <button type="button" disabled={disabled} onClick={() => toggle(i)} aria-label={t.cumplida ? 'Marcar pendiente' : 'Marcar cumplida'}
            style={{ width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${t.cumplida ? theme.green : theme.borderStrong || theme.border}`, background: t.cumplida ? theme.green : 'transparent', color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: disabled ? 'default' : 'pointer', padding: 0 }}>
            {t.cumplida && <Check size={13} strokeWidth={3} />}
          </button>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: t.cumplida ? theme.textMuted : theme.text, textDecoration: t.cumplida ? 'line-through' : 'none' }}>{t.texto}</span>
          {!disabled && <button type="button" onClick={() => quitar(i)} aria-label="Quitar" style={{ border: 0, background: 'transparent', color: theme.textMuted, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>×</button>}
        </div>
      ))}
      {tareas.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: theme.textMuted }}>Sin tareas aún.</div>}
      {!disabled && (
        <div style={{ display: 'flex', gap: 8, padding: 10, alignItems: 'center' }}>
          <CampoM value={nueva} onChange={setNueva} placeholder="Nueva tarea…" onEnter={add} />
          <button type="button" onClick={add} aria-label="Agregar tarea" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: 0, background: theme.accent, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={20} strokeWidth={2.4} /></button>
        </div>
      )}
    </ListaAgrupada>
  );
}

function AjustesM({ ajustes, onChange, disabled, total }) {
  const { theme } = useTheme();
  const [nuevo, setNuevo] = useState({ descripcion: '', monto: '' });
  const add = () => {
    const monto = Number(nuevo.monto);
    if (!nuevo.descripcion.trim() || !Number.isFinite(monto) || monto === 0) return;
    onChange([...ajustes, { id: Date.now(), fecha: new Date().toISOString().slice(0, 10), descripcion: nuevo.descripcion.trim(), monto }]);
    setNuevo({ descripcion: '', monto: '' });
  };
  const quitar = (i) => onChange(ajustes.filter((_, k) => k !== i));
  return (
    <ListaAgrupada titulo="Ajustes al bono" meta={total ? `${total >= 0 ? '+' : ''}${money(total)}` : 'sin ajustes'}>
      {ajustes.map((a, i) => (
        <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', minHeight: 48, boxSizing: 'border-box' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.descripcion}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: MONO }}>{a.fecha}</div>
          </div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: Number(a.monto) >= 0 ? theme.green : theme.red }}>{Number(a.monto) >= 0 ? '+' : '−'}{money(Math.abs(Number(a.monto)))}</span>
          {!disabled && <button type="button" onClick={() => quitar(i)} aria-label="Quitar" style={{ border: 0, background: 'transparent', color: theme.textMuted, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>×</button>}
        </div>
      ))}
      {ajustes.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: theme.textMuted }}>Sin ajustes aún.</div>}
      {!disabled && (
        <div style={{ display: 'flex', gap: 8, padding: 10, alignItems: 'center' }}>
          <CampoM value={nuevo.descripcion} onChange={(v) => setNuevo({ ...nuevo, descripcion: v })} placeholder="Descripción…" />
          <CampoM type="number" value={nuevo.monto} onChange={(v) => setNuevo({ ...nuevo, monto: v })} placeholder="±$" style={{ width: 96, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }} onEnter={add} />
          <button type="button" onClick={add} aria-label="Agregar ajuste" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: 0, background: theme.accent, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={20} strokeWidth={2.4} /></button>
        </div>
      )}
    </ListaAgrupada>
  );
}
