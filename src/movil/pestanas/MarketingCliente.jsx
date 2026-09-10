// Marketing del cliente (push) · consulta + captura, sin compartir.
// Stepper de mes ‹ Sep 2026 › · resumen del mes (actividades · inversión · activas) · lista de actividades del mes
// (tile del tipo, nombre, fecha, marca, inversión, estado) · hoja de detalle con métricas y acciones
// Editar / Completar-Reactivar / Archivar (mismas reglas y payload que MarketingCliente.jsx de escritorio) ·
// "+ Actividad" abre MarketingForm en hoja. Cerrar mes NO existe en móvil (se hace desde la computadora).
// Datos: marketing_actividades (tabla que la app escribe → supabase directo bajo useQuery, sin cachedQuery) + realtime.
import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Check, RotateCcw, Pencil, Archive, Lock } from 'lucide-react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente, puedeVerPestanaCliente } from '../../lib/permisos';
import { useNav } from '../nav';
import { TituloGrande, KpiM, KpiGrid, ListaAgrupada, Cabecera, Skeleton, Pill, Vacio, BotonGrande, toast } from '../piezas';
import { nombreCliente } from '../datos';
import { MESES, N, leerLS, guardarLS } from '../util';
import { TIPOS, MARCAS, REDES_SOCIALES, tipoMeta, mesAnioDe, fechaCorta, isoHoy, fmtMXN, fmtNum, esCerrada, estatusDe } from '../../modules/comercial/marketing/config';
import MarketingForm from './MarketingForm';

const LS_MES = 'movil_marketing_mes_v1';
const claveQ = (ck, anio) => ['movil', 'marketing', ck, anio];

function useActividades(ck, anio) {
  return useQuery({
    queryKey: claveQ(ck, anio), staleTime: 60 * 1000, enabled: !!ck && DB_CONFIGURED,
    queryFn: async () => {
      const { data, error } = await supabase.from('marketing_actividades').select('*').eq('cliente', ck).eq('anio', anio);
      if (error) throw error;
      return data || [];
    },
  });
}

// Realtime (sólo la pantalla, no la hoja de detalle): cualquier cambio en la tabla refresca la lista.
// Nombre de canal único por montaje: supabase.channel(nombre) reutiliza canales y no admite callbacks tras subscribe().
let seqCanal = 0;
function useRealtimeActividades(ck, anio) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ck || !DB_CONFIGURED) return undefined;
    const chan = supabase.channel(`movil-mkt-${ck}-${anio}-${++seqCanal}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_actividades' }, () => qc.invalidateQueries({ queryKey: claveQ(ck, anio) }))
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [ck, anio, qc]);
}

/** Cambia el estatus con actualización optimista sobre la cache de React Query. */
async function cambiarEstatus(qc, ck, anio, a, nuevo, okMsg) {
  const key = claveQ(ck, anio);
  const prev = qc.getQueryData(key);
  qc.setQueryData(key, (p) => (p || []).map((x) => (x.id === a.id ? { ...x, estatus: nuevo } : x)));
  const { error } = await supabase.from('marketing_actividades').update({ estatus: nuevo }).eq('id', a.id);
  if (error) { qc.setQueryData(key, prev); toast.error('Error al cambiar estatus: ' + error.message); return false; }
  toast.ok(okMsg);
  qc.invalidateQueries({ queryKey: key });
  return true;
}

/** Fila de actividad (tile del tipo · nombre · fecha/red/responsable · marca · inversión · estado). */
function FilaActividad({ a, hoy, onClick }) {
  const { theme } = useTheme();
  const tm = tipoMeta(a.tipo);
  const marca = MARCAS[a.marca];
  const st = estatusDe(a, hoy);
  const inv = N(a.inversion);
  const cerrada = esCerrada(a);
  const meta = [fechaCorta(a.fecha), tm.label, a.red_social ? REDES_SOCIALES[a.red_social]?.label : null].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '9px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box', opacity: cerrada ? 0.62 : 1 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: `${tm.color}22`, color: tm.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <tm.Icon size={17} strokeWidth={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre || 'Sin nombre'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textMuted, marginTop: 3, minWidth: 0 }}>
          {marca && <Pill tone={marca.tone} size="xs" style={{ flexShrink: 0 }}>{marca.label}</Pill>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>
        </span>
      </span>
      <span style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: inv > 0 ? theme.text : (theme.textSubtle || theme.textMuted) }}>{inv > 0 ? fmtMXN(inv) : '—'}</span>
        <Pill tone={st.tone} dot={!!st.dot} size="xs">{st.lock && <Lock size={9} strokeWidth={2.5} />}{st.label}</Pill>
      </span>
      <ChevronRight size={15} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0, marginRight: -2 }} />
    </button>
  );
}

/** Contenido de la hoja de detalle · lee la cache (sigue vivo tras editar/cambiar estatus). */
function DetalleActividad({ ck, anio, id, canEdit }) {
  const { theme } = useTheme();
  const nav = useNav();
  const qc = useQueryClient();
  const { data } = useActividades(ck, anio);
  const a = (data || []).find((x) => x.id === id);
  const hoy = isoHoy();
  if (!a) return <Vacio icon={null} titulo="Actividad no disponible" sub="Puede que se haya eliminado o movido de mes." />;
  const tm = tipoMeta(a.tipo);
  const marca = MARCAS[a.marca];
  const st = estatusDe(a, hoy);
  const cerrada = esCerrada(a);
  const m = a.metricas || {};
  const mets = tm.metricas.filter((x) => m[x.key] != null && m[x.key] !== '');
  const datos = [
    ['Fecha', fechaCorta(a.fecha) || '—'], ['Tipo', tm.label], ['Marca', marca?.label || '—'],
    a.red_social ? ['Red social', REDES_SOCIALES[a.red_social]?.label || a.red_social] : null,
    a.tipo === 'evento' && a.evento_sucursal ? ['Sucursal', a.evento_sucursal] : null,
    a.tipo === 'evento' && a.evento_pop ? ['POP / material', a.evento_pop] : null,
    a.responsable ? ['Responsable', a.responsable] : null,
    a.mensaje ? ['Mensaje', a.mensaje] : null,
  ].filter(Boolean);

  const editar = () => nav.abrirHoja({
    titulo: 'Editar actividad', sub: a.nombre, alto: '92vh',
    contenido: <MarketingForm clienteKey={ck} actividad={a} onCancelar={nav.cerrarHoja}
      onGuardado={(saved) => { qc.invalidateQueries({ queryKey: claveQ(ck, anio) }); if (saved && N(saved.anio) !== anio) qc.invalidateQueries({ queryKey: claveQ(ck, N(saved.anio)) }); nav.cerrarHoja(); }} />,
  });
  const toggle = () => cambiarEstatus(qc, ck, anio, a, cerrada ? 'activo' : 'completado', cerrada ? 'Actividad reactivada' : 'Actividad completada');
  const archivar = async () => { if (a.estatus === 'archivado') return; if (await cambiarEstatus(qc, ck, anio, a, 'archivado', 'Actividad archivada')) nav.cerrarHoja(); };

  const filaDato = (k, v) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', fontSize: 14 }}>
      <span style={{ color: theme.textMuted, flexShrink: 0 }}>{k}</span>
      <span style={{ textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
        <span style={{ width: 44, height: 44, borderRadius: 11, background: `${tm.color}22`, color: tm.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><tm.Icon size={22} strokeWidth={1.9} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{N(a.inversion) > 0 ? fmtMXN(a.inversion) : 'Sin inversión'}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
            <Pill tone={st.tone} dot={!!st.dot}>{st.lock && <Lock size={9} strokeWidth={2.5} />}{st.label}</Pill>
            {a.pago_id && <span style={{ fontSize: 11.5, color: theme.textMuted }}>ligada a un pago</span>}
          </div>
        </div>
      </div>
      <ListaAgrupada titulo="Datos">{datos.map(([k, v]) => filaDato(k, v))}</ListaAgrupada>
      <ListaAgrupada titulo={`Métricas · ${tm.label}`} pie={mets.length ? undefined : 'Sin métricas capturadas. Edita la actividad para agregarlas.'}>
        {mets.length ? mets.map((x) => filaDato(x.label.replace(/ \(.*\)$/, ''), <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{x.money ? fmtMXN(m[x.key]) : fmtNum(m[x.key])}</span>))
          : <div style={{ padding: '12px', fontSize: 13, color: theme.textMuted }}>—</div>}
      </ListaAgrupada>
      {a.notas && <ListaAgrupada titulo="Notas"><div style={{ padding: '10px 12px', fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{a.notas}</div></ListaAgrupada>}
      {canEdit && (
        <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BotonGrande primario icon={Pencil} onClick={editar}>Editar</BotonGrande>
          <BotonGrande icon={cerrada ? RotateCcw : Check} onClick={toggle}>{cerrada ? 'Reactivar' : 'Completar'}</BotonGrande>
          {a.estatus !== 'archivado' && <BotonGrande icon={Archive} peligro onClick={archivar}>Archivar</BotonGrande>}
        </div>
      )}
      {!canEdit && <div style={{ padding: '0 20px', fontSize: 12, color: theme.textSubtle || theme.textMuted }}>Sólo lectura: no tienes permiso de edición en Marketing de este cliente.</div>}
    </div>
  );
}

export default function MarketingCliente({ clienteKey, nombre }) {
  const { theme } = useTheme();
  const nav = useNav();
  const qc = useQueryClient();
  const perfil = usePerfil() || nav?.perfil;
  const ck = clienteKey;
  const label = nombre || nombreCliente(ck);
  const puedeVer = puedeVerPestanaCliente(perfil, ck, 'marketing');
  const canEdit = puedeVer && puedeEditarPestanaCliente(perfil, ck, 'marketing');
  const hoy = isoHoy();
  const anioActual = Number(hoy.slice(0, 4)), mesActual = Number(hoy.slice(5, 7));
  const [sel, setSel] = React.useState(() => {
    const g = leerLS(LS_MES, null);
    return g && g.ck === ck && g.anio && g.mes ? { anio: g.anio, mes: g.mes } : { anio: anioActual, mes: mesActual };
  });
  useEffect(() => { guardarLS(LS_MES, { ck, ...sel }); }, [ck, sel]);
  const { data, isLoading, error } = useActividades(puedeVer ? ck : null, sel.anio);
  useRealtimeActividades(puedeVer ? ck : null, sel.anio);

  const mover = (d) => setSel((s) => { let m = s.mes + d, a = s.anio; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } return { anio: a, mes: m }; });

  const r = useMemo(() => {
    if (!data) return null;
    const ordenFecha = (a, b) => { const A = mesAnioDe(a), B = mesAnioDe(b); return (A.d - B.d) || String(a.nombre || '').localeCompare(String(b.nombre || '')); };
    const mes = data.filter((a) => { const x = mesAnioDe(a); return x.y === sel.anio && x.m === sel.mes; }).sort(ordenFecha);
    const activas = mes.filter((a) => !esCerrada(a)), cerradas = mes.filter(esCerrada);
    const inversion = mes.reduce((s, a) => s + N(a.inversion), 0);
    const sinPago = mes.filter((a) => !a.pago_id && N(a.inversion) > 0).reduce((s, a) => s + N(a.inversion), 0);
    const porTipo = {}; mes.forEach((a) => { porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1; });
    return { mes, activas, cerradas, inversion, sinPago, porTipo };
  }, [data, sel]);

  const abrirDetalle = (a) => nav.abrirHoja({ titulo: a.nombre || 'Actividad', sub: `${label} · ${MESES[sel.mes - 1]} ${sel.anio}`, alto: '88vh', contenido: <DetalleActividad ck={ck} anio={sel.anio} id={a.id} canEdit={canEdit} /> });
  const nueva = () => {
    if (!canEdit) return;
    const d = sel.anio === anioActual && sel.mes === mesActual ? Number(hoy.slice(8, 10)) : Math.min(Number(hoy.slice(8, 10)), 28);
    const fecha = `${sel.anio}-${String(sel.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    nav.abrirHoja({
      titulo: 'Nueva actividad', sub: `${label} · ${MESES[sel.mes - 1]} ${sel.anio}`, alto: '92vh',
      contenido: <MarketingForm clienteKey={ck} fechaInicial={fecha} onCancelar={nav.cerrarHoja}
        onGuardado={(saved) => { qc.invalidateQueries({ queryKey: claveQ(ck, sel.anio) }); if (saved && N(saved.anio) !== sel.anio) qc.invalidateQueries({ queryKey: claveQ(ck, N(saved.anio)) }); nav.cerrarHoja(); }} />,
    });
  };

  const btnMes = (Icon, onClick, aria) => (
    <button type="button" aria-label={aria} onClick={onClick} style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
      <Icon size={20} strokeWidth={2.2} />
    </button>
  );
  const esMesActual = sel.anio === anioActual && sel.mes === mesActual;

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta={label}
        derecha={canEdit ? (
          <button type="button" onClick={nueva} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 12px 0 8px', borderRadius: 999, border: 0, background: theme.accent, color: theme.textOnDark || '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={16} strokeWidth={2.5} />Actividad
          </button>
        ) : undefined} />
      <TituloGrande titulo={`Marketing · ${label}`} sub={r ? `${r.mes.length} ${r.mes.length === 1 ? 'actividad' : 'actividades'} en ${MESES[sel.mes - 1].toLowerCase()} · ${fmtMXN(r.inversion)}` : label} />

      {!puedeVer ? <Vacio icon={null} titulo="Sin acceso" sub={`No tienes acceso a Marketing de ${label}.`} /> : (
        <>
          {/* Stepper de mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px' }}>
            {btnMes(ChevronLeft, () => mover(-1), 'Mes anterior')}
            <button type="button" onClick={() => setSel({ anio: anioActual, mes: mesActual })} style={{ border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {MESES[sel.mes - 1]} {sel.anio}
              {!esMesActual && <Pill tone="blue" size="xs">hoy</Pill>}
            </button>
            {btnMes(ChevronRight, () => mover(1), 'Mes siguiente')}
          </div>

          {error && <Vacio titulo="No se pudo cargar marketing" sub={error.message} />}
          {(isLoading || !r) && !error && (
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}><Skeleton h={76} r={12} /><Skeleton h={76} r={12} /><Skeleton h={76} r={12} /></div>
              <Skeleton h={300} r={12} />
            </div>
          )}
          {r && (
            <>
              <KpiGrid cols={3}>
                <KpiM eyebrow="Actividades" big={String(r.mes.length)} sub={Object.entries(r.porTipo).slice(0, 2).map(([t, n]) => `${n} ${tipoMeta(t).label.toLowerCase()}`).join(' · ') || 'ninguna'} />
                <KpiM eyebrow="Inversión" big={r.inversion > 0 ? fmtMXN(r.inversion) : '—'} sub={r.sinPago > 0 ? `${fmtMXN(r.sinPago)} sin cerrar` : r.inversion > 0 ? 'todo en pago' : 'sin inversión'} />
                <KpiM eyebrow="Activas" big={String(r.activas.length)} bigColor={r.activas.length ? theme.green : undefined} sub={r.cerradas.length ? `${r.cerradas.length} cerradas` : 'ninguna cerrada'} />
              </KpiGrid>

              <ListaAgrupada titulo="Actividades" meta={`${r.activas.length}`} style={{ marginTop: 16 }}
                pie={canEdit ? 'Toca una actividad para ver sus métricas, editarla, completarla o archivarla. Cerrar mes se hace desde la computadora.' : 'Toca una actividad para ver sus métricas.'}>
                {r.activas.length === 0 && (
                  <Vacio icon={null} titulo={`Sin actividades activas en ${MESES[sel.mes - 1].toLowerCase()}`} sub={r.cerradas.length ? 'Revisa las completadas abajo.' : 'Todavía no hay actividades planeadas para este mes.'}
                    accion={canEdit ? <BotonGrande primario icon={Plus} onClick={nueva} style={{ width: 'auto', height: 40, padding: '0 16px', fontSize: 14 }}>Nueva actividad</BotonGrande> : undefined} />
                )}
                {r.activas.map((a) => <FilaActividad key={a.id} a={a} hoy={hoy} onClick={() => abrirDetalle(a)} />)}
              </ListaAgrupada>

              {r.cerradas.length > 0 && (
                <ListaAgrupada titulo="Completadas y archivadas" meta={`${r.cerradas.length}`} style={{ marginTop: 18 }}>
                  {r.cerradas.map((a) => <FilaActividad key={a.id} a={a} hoy={hoy} onClick={() => abrirDetalle(a)} />)}
                </ListaAgrupada>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 20px 0' }}>
                {Object.entries(TIPOS).map(([k, t]) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: t.color, display: 'inline-block' }} />{t.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
