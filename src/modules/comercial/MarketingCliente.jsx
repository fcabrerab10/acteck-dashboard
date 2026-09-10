// MarketingCliente · V3 (kit)
// ─ Hero narrativo (mes / actividades activas / próxima) + 3 stats
// ─ 4 KPI: Sell-out en promo (v_vision_sellout_promos, global) · Costo por actividad · Apertura mailing · Próxima
// ─ Barra: año · Mes/Anual · meses como pills · Cerrar mes · Exportar · + Actividad · filtros tipo/marca
// ─ Calendario compacto (mes / 12 mini-meses) + lista de actividades con acciones al hover
// ─ Completadas y archivadas en panel plegable · formulario modal (marketing/ActividadForm)
// Conserva: CRUD, realtime, cerrar mes (pago consolidado), permisos canEdit, filtros tipo/marca/mes/día.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Lock, X } from 'lucide-react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente, puedeVerPestanaCliente } from '../../lib/permisos';
import { clientes as CLIENTES } from '../../lib/constants';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Pill, Segmented, Panel, Boton, SkeletonPantalla, toast } from '../../components/kit';
import {
  TIPOS, MARCAS, REDES_SOCIALES, MESES, MESES_CORTOS, tipoMeta, parseFecha, mesAnioDe, fechaCorta, isoHoy, diasEntre,
  fmtMXN, fmtNum, money, esCerrada, emptyForm,
} from './marketing/config';
import { CalendarioMes, CalendarioAnual } from './marketing/Calendario';
import ActividadFila from './marketing/ActividadFila';
import ActividadForm from './marketing/ActividadForm';

export default function MarketingCliente({ cliente, clienteKey }) {
  const perfil = usePerfil();
  const ckPerm = clienteKey || cliente;
  if (!puedeVerPestanaCliente(perfil, ckPerm, 'marketing')) {
    return <SinAcceso motivo={`No tienes acceso a Marketing de ${ckPerm || 'este cliente'}.`} />;
  }
  // Permiso granular por (clienteKey, 'marketing').
  const canEdit = puedeEditarPestanaCliente(perfil, ckPerm, 'marketing');
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const ck = clienteKey || cliente;
  const clienteLabel = CLIENTES?.[ck]?.nombre || cliente || ck;
  const hoy = isoHoy();
  const anioActual = Number(hoy.slice(0, 4)), mesActual = Number(hoy.slice(5, 7));

  const [actividades, setActividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState(anioActual);
  const [mesSel, setMesSel] = useState(mesActual);
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterMarca, setFilterMarca] = useState('todas');
  const [calVista, setCalVista] = useState('mes'); // 'mes' | 'anual'
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [promo, setPromo] = useState({ loading: true, row: null });

  // ─── Carga de datos + realtime ───────────────────────────────
  useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    supabase.from('marketing_actividades').select('*').eq('cliente', ck).eq('anio', anio).then(({ data }) => {
      setActividades(data || []);
      setLoading(false);
    });
    const mio = (r) => r && r.cliente === ck && Number(r.anio) === anio;
    const chan = supabase.channel('mkt-' + ck + '-' + anio)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_actividades' }, (payload) => {
        if (payload.eventType === 'INSERT') { if (mio(payload.new)) setActividades((p) => p.some((a) => a.id === payload.new.id) ? p : [...p, payload.new]); }
        else if (payload.eventType === 'UPDATE') setActividades((p) => p.map((a) => (a.id === payload.new.id ? payload.new : a)));
        else if (payload.eventType === 'DELETE') setActividades((p) => p.filter((a) => a.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [ck, anio]);

  // KPI promo · vista global (campaña del mes en curso, sin cliente). Lectura cacheada.
  useEffect(() => {
    if (!DB_CONFIGURED) { setPromo({ loading: false, row: null }); return; }
    let cancel = false;
    cachedQuery(supabase.from('v_vision_sellout_promos').select('campania,skus_campania,sellout_en_promo,sellout_fuera_promo,sellout_promo_mes_prev').limit(1))
      .then(({ data }) => { if (!cancel) setPromo({ loading: false, row: data?.[0] || null }); })
      .catch(() => { if (!cancel) setPromo({ loading: false, row: null }); });
    return () => { cancel = true; };
  }, []);

  // ─── Derivados ───────────────────────────────────────────────
  const actividadesAnio = useMemo(() => actividades.filter((a) => mesAnioDe(a).y === anio), [actividades, anio]);
  const actividadesDelMes = useMemo(() => actividadesAnio.filter((a) => mesAnioDe(a).m === mesSel), [actividadesAnio, mesSel]);

  const pasaFiltros = (a) => (filterTipo === 'todos' || a.tipo === filterTipo) && (filterMarca === 'todas' || a.marca === filterMarca);
  const ordenFecha = (a, b) => { const A = mesAnioDe(a), B = mesAnioDe(b); return (A.m - B.m) || (A.d - B.d); };

  const { activasFiltradas, completadasFiltradas } = useMemo(() => {
    const base = calVista === 'anual' ? actividadesAnio : actividadesDelMes;
    const arr = base.filter((a) => pasaFiltros(a) && (!diaSeleccionado || calVista === 'anual' || parseFecha(a.fecha)?.d === diaSeleccionado)).sort(ordenFecha);
    return { activasFiltradas: arr.filter((a) => !esCerrada(a)), completadasFiltradas: arr.filter(esCerrada) };
  }, [actividadesAnio, actividadesDelMes, calVista, filterTipo, filterMarca, diaSeleccionado]);

  // Conteo por mes (pills + calendario anual) respetando tipo/marca
  const porMes = useMemo(() => {
    const out = {}; for (let m = 1; m <= 12; m++) out[m] = { total: 0, inv: 0, porTipo: {} };
    actividadesAnio.forEach((a) => {
      const { m } = mesAnioDe(a); if (m < 1 || m > 12 || !pasaFiltros(a)) return;
      out[m].total++; out[m].inv += Number(a.inversion) || 0; out[m].porTipo[a.tipo] = (out[m].porTipo[a.tipo] || 0) + 1;
    });
    return out;
  }, [actividadesAnio, filterTipo, filterMarca]);

  const totales = useMemo(() => {
    const t = { actividades: actividadesDelMes.length, inversion: 0, sinPago: 0, inversionSinPago: 0, conPago: 0, activas: 0 };
    actividadesDelMes.forEach((a) => {
      const inv = Number(a.inversion) || 0; t.inversion += inv;
      if (a.pago_id) t.conPago++; else { t.sinPago++; t.inversionSinPago += inv; }
      if (!esCerrada(a)) t.activas++;
    });
    return t;
  }, [actividadesDelMes]);

  const anual = useMemo(() => {
    const t = { total: actividadesAnio.length, inversion: 0, ytd: 0, activas: 0, enPago: 0, mailEnvios: 0, mailAperturas: 0, mailings: 0 };
    actividadesAnio.forEach((a) => {
      const inv = Number(a.inversion) || 0; t.inversion += inv;
      const f = a.fecha ? String(a.fecha).slice(0, 10) : null;
      if (anio < anioActual || (f ? f <= hoy : mesAnioDe(a).m <= mesActual)) t.ytd += inv;
      if (!esCerrada(a)) t.activas++;
      if (a.pago_id) t.enPago++;
      if (a.tipo === 'mailing') { const m = a.metricas || {}; if (Number(m.envios) > 0) { t.mailings++; t.mailEnvios += Number(m.envios); t.mailAperturas += Number(m.aperturas) || 0; } }
    });
    t.costoPorActividad = t.total ? t.inversion / t.total : null;
    t.apertura = t.mailEnvios ? (t.mailAperturas / t.mailEnvios) * 100 : null;
    return t;
  }, [actividadesAnio, anio, anioActual, mesActual, hoy]);

  const proxima = useMemo(() => {
    const cand = actividadesAnio.filter((a) => !esCerrada(a) && a.fecha && String(a.fecha).slice(0, 10) >= hoy).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    if (!cand.length) return null;
    return { a: cand[0], dias: diasEntre(hoy, String(cand[0].fecha).slice(0, 10)) };
  }, [actividadesAnio, hoy]);

  // ─── CRUD ────────────────────────────────────────────────────
  const openNew = () => {
    if (!canEdit) return;
    const d = anio === anioActual && mesSel === mesActual ? Number(hoy.slice(8, 10)) : Math.min(Number(hoy.slice(8, 10)), 28);
    setForm({ ...emptyForm(), fecha: `${anio}-${String(mesSel).padStart(2, '0')}-${String(diaSeleccionado || d).padStart(2, '0')}` });
    setEditId(null);
    setShowForm(true);
  };
  const openEdit = (a) => {
    if (!canEdit) return;
    setForm({
      tipo: a.tipo || 'mailing',
      marca: a.marca || 'acteck',
      fecha: a.fecha || (a.anio && a.mes ? `${a.anio}-${String(a.mes).padStart(2, '0')}-01` : ''),
      nombre: a.nombre || '',
      mensaje: a.mensaje || '',
      red_social: a.red_social || '',
      inversion: Number(a.inversion) || 0,
      metricas: a.metricas || {},
      evento_sucursal: a.evento_sucursal || '',
      evento_pop: a.evento_pop || '',
      notas: a.notas || '',
      responsable: a.responsable || '',
    });
    setEditId(a.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm()); };
  const save = async () => {
    if (!canEdit) return;
    if (!form.nombre.trim()) { toast.error('Falta el nombre de la actividad'); return; }
    setSaving(true);
    // Parse YYYY-MM-DD SIN conversión de timezone (new Date() lo interpreta como UTC)
    let fAnio = anio, fMes = mesSel;
    if (form.fecha) {
      const parts = form.fecha.split('-').map((n) => parseInt(n, 10));
      if (parts.length === 3 && parts[0] && parts[1]) { fAnio = parts[0]; fMes = parts[1]; }
    }
    const payload = {
      cliente: ck,
      tipo: form.tipo,
      marca: form.marca,
      nombre: form.nombre.trim(),
      mensaje: form.mensaje || '',
      red_social: form.red_social || null,
      fecha: form.fecha || null,
      anio: fAnio,
      mes: String(fMes),
      inversion: Number(form.inversion) || 0,
      metricas: form.metricas || {},
      evento_sucursal: form.evento_sucursal || null,
      evento_pop: form.evento_pop || null,
      notas: form.notas || null,
      responsable: form.responsable || null,
      estatus: 'activo',
      // Valores por defecto para columnas legacy NOT NULL
      subtipo: form.fecha || '',
      temporalidad: form.fecha || '',
      producto: '',
    };
    let err = null, saved = null;
    if (editId) {
      const { data, error } = await supabase.from('marketing_actividades').update(payload).eq('id', editId).select().single();
      err = error; saved = data;
    } else {
      const { data, error } = await supabase.from('marketing_actividades').insert(payload).select().single();
      err = error; saved = data;
    }
    setSaving(false);
    if (err) { toast.error('Error guardando: ' + err.message); return; }
    // Actualizar estado local de inmediato (no depender solo de realtime)
    if (saved) {
      if (editId) setActividades((p) => p.map((a) => (a.id === editId ? saved : a)));
      else setActividades((p) => [...p.filter((a) => a.id !== saved.id), saved]);
    }
    toast.ok(editId ? 'Actividad actualizada' : 'Actividad creada');
    closeForm();
  };
  const deleteAct = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('¿Eliminar esta actividad?')) return;
    setActividades((p) => p.filter((a) => a.id !== id)); // optimista
    const { error } = await supabase.from('marketing_actividades').delete().eq('id', id);
    if (error) {
      toast.error('Error al eliminar: ' + error.message);
      const { data } = await supabase.from('marketing_actividades').select('*').eq('cliente', ck).eq('anio', anio);
      setActividades(data || []);
    } else toast.ok('Actividad eliminada');
  };
  const cambiarEstatus = async (a, nuevoEstatus, okMsg) => {
    if (!canEdit) return;
    setActividades((p) => p.map((x) => (x.id === a.id ? { ...x, estatus: nuevoEstatus } : x))); // optimista
    const { error } = await supabase.from('marketing_actividades').update({ estatus: nuevoEstatus }).eq('id', a.id);
    if (error) { toast.error('Error al cambiar estatus: ' + error.message); setActividades((p) => p.map((x) => (x.id === a.id ? a : x))); }
    else toast.ok(okMsg);
  };
  const toggleCompletada = (a) => (esCerrada(a) ? cambiarEstatus(a, 'activo', 'Actividad reactivada') : cambiarEstatus(a, 'completado', 'Actividad completada'));
  const archivar = (a) => { if (a.estatus !== 'archivado') cambiarEstatus(a, 'archivado', 'Actividad archivada'); };

  // ─── Cerrar mes: consolida actividades sin pago en un solo pago ──
  const cerrarMes = async () => {
    if (!canEdit) return;
    const actsACerrar = actividadesDelMes.filter((a) => !a.pago_id);
    if (actsACerrar.length === 0) { toast.info('No hay actividades pendientes de cerrar en este mes.'); return; }
    const totalInv = actsACerrar.reduce((s, a) => s + (Number(a.inversion) || 0), 0);
    const mesLabel = MESES[mesSel - 1];
    const confirmMsg = `Cerrar ${mesLabel} ${anio}:\n\n• ${actsACerrar.length} actividad(es) se consolidarán en un solo pago\n• Total: ${fmtMXN(totalInv)}\n\n¿Continuar?`;
    if (!window.confirm(confirmMsg)) return;
    // Fecha compromiso = día 15 del MES SIGUIENTE (el folio lo pone Fernando manualmente cuando se paga)
    const nextMes = mesSel === 12 ? 1 : mesSel + 1;
    const nextAnio = mesSel === 12 ? anio + 1 : anio;
    const pagoPayload = {
      cliente: ck,
      categoria: 'marketing',
      folio: null,
      concepto: `Marketing ${mesLabel} ${anio} — ${actsACerrar.length} actividad(es)`,
      monto: totalInv,
      estatus: 'pendiente',
      fecha_compromiso: `${nextAnio}-${String(nextMes).padStart(2, '0')}-15`,
      responsable: 'Fernando Cabrera',
      notas: actsACerrar.map((a) => `• ${a.nombre} (${tipoMeta(a.tipo).label}): ${fmtMXN(a.inversion || 0)}`).join('\n'),
    };
    const { data: pagoData, error: pagoError } = await supabase.from('pagos').insert(pagoPayload).select().single();
    if (pagoError) { toast.error('Error creando el pago: ' + pagoError.message); return; }
    const ids = actsACerrar.map((a) => a.id);
    const { error: updError } = await supabase.from('marketing_actividades').update({ pago_id: pagoData.id }).in('id', ids);
    if (updError) { toast.error('Pago creado pero no se pudieron ligar las actividades: ' + updError.message); return; }
    setActividades((p) => p.map((a) => (ids.includes(a.id) ? { ...a, pago_id: pagoData.id } : a)));
    toast.ok(`Mes cerrado · pago ${fmtMXN(totalInv)} creado para ${mesLabel} ${anio}`);
  };

  // ─── Exportar ────────────────────────────────────────────────
  const excelActividades = () => {
    const columnas = [
      { label: 'Fecha', key: 'fecha', tipo: 'fecha', ancho: 12 },
      { label: 'Tipo', key: 'tipo', tipo: 'texto', ancho: 12 },
      { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 12 },
      { label: 'Actividad', key: 'nombre', tipo: 'texto', ancho: 36 },
      { label: 'Mensaje', key: 'mensaje', tipo: 'texto', ancho: 30 },
      { label: 'Red social', key: 'red_social', tipo: 'texto', ancho: 11 },
      { label: 'Inversión', key: 'inversion', tipo: 'moneda', ancho: 13 },
      { label: 'Estatus', key: 'estatus', tipo: 'texto', ancho: 11 },
      { label: 'En pago', key: 'en_pago', tipo: 'texto', ancho: 8 },
      { label: 'Responsable', key: 'responsable', tipo: 'texto', ancho: 16 },
      { label: 'Sucursal', key: 'evento_sucursal', tipo: 'texto', ancho: 14 },
      { label: 'POP', key: 'evento_pop', tipo: 'texto', ancho: 14 },
      { label: 'Métricas', key: 'metricas', tipo: 'texto', ancho: 48 },
      { label: 'Notas', key: 'notas', tipo: 'texto', ancho: 30 },
    ];
    const filas = [...actividadesAnio].sort(ordenFecha).map((a) => ({
      fecha: a.fecha || '', tipo: tipoMeta(a.tipo).label, marca: MARCAS[a.marca]?.label || a.marca || '', nombre: a.nombre || '', mensaje: a.mensaje || '',
      red_social: REDES_SOCIALES[a.red_social]?.label || '', inversion: Number(a.inversion) || 0, estatus: a.estatus || '', en_pago: a.pago_id ? 'Sí' : '',
      responsable: a.responsable || '', evento_sucursal: a.evento_sucursal || '', evento_pop: a.evento_pop || '',
      metricas: tipoMeta(a.tipo).metricas.filter((m) => a.metricas?.[m.key] != null && a.metricas[m.key] !== '').map((m) => `${m.label}: ${m.money ? fmtMXN(a.metricas[m.key]) : fmtNum(a.metricas[m.key])}`).join(' · '),
      notas: a.notas || '',
    }));
    return { archivo: `Marketing ${clienteLabel} ${anio}`, hojas: [{ nombre: `Actividades ${anio}`, columnas, filas, totales: { nombre: `${filas.length} actividades`, inversion: anual.inversion } }] };
  };

  // ─── Render ──────────────────────────────────────────────────
  if (loading) return <SkeletonPantalla />;

  const mesLabel = MESES[mesSel - 1];
  const dTxt = (d) => (d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`);
  const proximaEnMes = proxima && mesAnioDe(proxima.a).m === mesSel;
  const heroTitulo = totales.activas === 0
    ? `${mesLabel} sin actividad planeada.`
    : proximaEnMes && proxima.dias >= 0 ? `${proxima.a.nombre || "Actividad"} ${dTxt(proxima.dias)}.` : `${totales.activas} ${totales.activas === 1 ? 'actividad activa' : 'actividades activas'} en ${mesLabel.toLowerCase()}.`;
  const heroSub = `${anual.total} ${anual.total === 1 ? 'actividad' : 'actividades'} en ${anio} · ${fmtMXN(anual.inversion)} de inversión${anual.enPago ? ` · ${anual.enPago} en pago` : ''}${totales.sinPago && totales.inversionSinPago ? ` · ${fmtMXN(totales.inversionSinPago)} sin cerrar en ${mesLabel.toLowerCase()}` : ''}.`;

  const p = promo.row;
  const promoOn = p && Number(p.skus_campania) > 0;
  const enPromo = Number(p?.sellout_en_promo) || 0, fueraPromo = Number(p?.sellout_fuera_promo) || 0;
  const sharePromo = enPromo + fueraPromo ? (enPromo / (enPromo + fueraPromo)) * 100 : 0;
  const tmProx = proxima ? tipoMeta(proxima.a.tipo) : null;

  const barLabel = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginRight: 2 };

  return (
    <div ref={rootRef} data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText, color: theme.text }}>
      {/* 1 · Hero */}
      <Hero
        eyebrow={`Marketing · ${clienteLabel} · ${anio}`}
        titulo={heroTitulo}
        sub={heroSub}
        stats={[
          { k: 'Invertido YTD', v: money(anual.ytd), sub: `${anio}` },
          { k: 'Actividades', v: `${anual.total} · ${anual.activas}`, sub: 'total · activas' },
          { k: 'Inversión del mes', v: money(totales.inversion), sub: `${totales.actividades} en ${MESES_CORTOS[mesSel - 1]}` },
        ]}
      />

      {/* 2 · KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
        <KpiCard
          eyebrow="Sell-out en promo" badge={{ l: 'Global', tone: 'gray' }}
          big={promo.loading ? '…' : promoOn ? money(enPromo) : '—'}
          bigSmall={promo.loading ? '' : promoOn ? `vs ${money(fueraPromo)} fuera` : 'sin campaña activa'}
          sub={promo.loading ? 'Cargando…' : promoOn ? `${p.campania || 'Campaña'} · ${fmtNum(p.skus_campania)} SKUs · mes actual` : `Fuera de promo ${money(fueraPromo)} · mes actual`}
          progress={promoOn ? sharePromo : undefined} progressColor={theme.accent}
        />
        <KpiCard
          eyebrow="Costo por actividad" badge={{ l: `${anio}`, tone: 'gray' }}
          big={anual.costoPorActividad != null ? money(anual.costoPorActividad) : '—'}
          bigSmall={anual.total ? `${anual.total} act.` : ''}
          sub={anual.total ? `${fmtMXN(anual.inversion)} ÷ ${anual.total} ${anual.total === 1 ? 'actividad' : 'actividades'}` : 'Sin actividades en el año'}
        />
        <KpiCard
          eyebrow="Mailing · apertura" badge={{ l: 'Promedio', tone: 'green' }}
          big={anual.apertura != null ? `${anual.apertura.toFixed(1)}%` : '—'}
          bigSmall={anual.mailings ? `${anual.mailings} ${anual.mailings === 1 ? 'mailing' : 'mailings'}` : ''}
          sub={anual.mailings ? `${fmtNum(anual.mailAperturas)} aperturas de ${fmtNum(anual.mailEnvios)} envíos` : 'Sin envíos capturados'}
          progress={anual.apertura != null ? anual.apertura : undefined} progressColor={theme.green}
        />
        <KpiCard
          eyebrow="Próxima actividad" badge={tmProx ? { l: tmProx.label, tone: tmProx.tone } : undefined}
          big={proxima ? fechaCorta(proxima.a.fecha) : '—'}
          bigSmall={proxima ? proxima.a.nombre : 'nada programado'}
          sub={proxima ? `${dTxt(proxima.dias)}${MARCAS[proxima.a.marca] ? ` · ${MARCAS[proxima.a.marca].label}` : ''}${proxima.a.responsable ? ` · ${proxima.a.responsable}` : ''}` : `Sin actividades futuras en ${anio}`}
          onClick={proxima ? () => { const { m } = mesAnioDe(proxima.a); setMesSel(m); setCalVista('mes'); setDiaSeleccionado(null); } : undefined}
        />
      </div>

      {/* 3 · Barra de control */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Segmented value={anio} onChange={(y) => { setAnio(Number(y)); setDiaSeleccionado(null); }} options={[anioActual - 1, anioActual].map((y) => ({ id: y, label: String(y) }))} />
          <Segmented value={calVista} onChange={(v) => { setCalVista(v); setDiaSeleccionado(null); }} options={[{ id: 'mes', label: 'Mes' }, { id: 'anual', label: 'Anual', badge: anual.total || undefined }]} />
          {calVista === 'mes' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {MESES_CORTOS.map((m, i) => {
                const n = porMes[i + 1]?.total || 0, sel = mesSel === i + 1;
                return (
                  <Pill key={m} tone={sel ? 'inverse' : 'gray'} onClick={() => { setMesSel(i + 1); setDiaSeleccionado(null); }} style={{ cursor: 'pointer', opacity: !sel && !n && i + 1 !== mesActual ? 0.6 : 1 }}>
                    {m}{n > 0 && <span style={{ fontSize: 9, opacity: 0.7 }}>{n}</span>}
                  </Pill>
                );
              })}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {canEdit && totales.sinPago > 0 && totales.inversionSinPago > 0 && (
              <Boton icon={Lock} onClick={cerrarMes} title={`Genera un pago consolidado de ${fmtMXN(totales.inversionSinPago)} por ${totales.sinPago} actividad(es) de ${mesLabel}`}>
                Cerrar mes · {money(totales.inversionSinPago)}
              </Boton>
            )}
            <ExportMenu titulo="Marketing" subtitulo={`${clienteLabel} · ${anio}`} excel={excelActividades} pdf={{ ref: rootRef }} deshabilitado={!actividadesAnio.length} />
            {canEdit && <Boton primario icon={Plus} onClick={openNew}>Actividad</Boton>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={barLabel}>Tipo</span>
            <Pill tone={filterTipo === 'todos' ? 'inverse' : 'gray'} onClick={() => setFilterTipo('todos')} style={{ cursor: 'pointer' }}>Todos</Pill>
            {Object.entries(TIPOS).map(([k, t]) => (
              <Pill key={k} tone={filterTipo === k ? t.tone : 'gray'} onClick={() => setFilterTipo(filterTipo === k ? 'todos' : k)} style={{ cursor: 'pointer', opacity: filterTipo === 'todos' || filterTipo === k ? 1 : 0.55 }}>
                <t.Icon size={10} strokeWidth={2} />{t.label}
              </Pill>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={barLabel}>Marca</span>
            <Pill tone={filterMarca === 'todas' ? 'inverse' : 'gray'} onClick={() => setFilterMarca('todas')} style={{ cursor: 'pointer' }}>Todas</Pill>
            {Object.entries(MARCAS).map(([k, m]) => (
              <Pill key={k} tone={filterMarca === k ? m.tone : 'gray'} onClick={() => setFilterMarca(filterMarca === k ? 'todas' : k)} style={{ cursor: 'pointer', opacity: filterMarca === 'todas' || filterMarca === k ? 1 : 0.55 }}>{m.label}</Pill>
            ))}
          </div>
          {diaSeleccionado && calVista === 'mes' && (
            <Pill tone="blue" onClick={() => setDiaSeleccionado(null)} style={{ cursor: 'pointer', marginLeft: 'auto' }}>Día {diaSeleccionado} <X size={10} strokeWidth={2.5} /></Pill>
          )}
        </div>
      </div>

      {/* 4 · Calendario + Actividades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.4fr)', gap: 10, alignItems: 'start' }}>
        <Panel
          titulo={calVista === 'mes' ? `${mesLabel} ${anio}` : `${anio}`}
          meta={calVista === 'mes' ? `${porMes[mesSel]?.total || 0} act. · ${money(porMes[mesSel]?.inv || 0)}` : `${anual.total} act. · ${money(anual.inversion)}`}
          padding="8px 10px 10px">
          {calVista === 'mes'
            ? <CalendarioMes anio={anio} mes={mesSel} actividades={actividadesDelMes.filter(pasaFiltros)} diaSeleccionado={diaSeleccionado} onSelectDia={setDiaSeleccionado} hoy={hoy} />
            : <CalendarioAnual anio={anio} porMes={porMes} mesSel={mesSel} onSelectMes={(m) => { setMesSel(m); setCalVista('mes'); setDiaSeleccionado(null); }} />}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.border}` }}>
            {Object.entries(TIPOS).map(([k, t]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: t.color, display: 'inline-block' }} />{t.label}
              </span>
            ))}
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <Panel
            titulo="Actividades"
            meta={`${activasFiltradas.length} ${activasFiltradas.length === 1 ? 'activa' : 'activas'}${calVista === 'mes' ? ` · ${mesLabel}${diaSeleccionado ? ` ${diaSeleccionado}` : ''}` : ` · ${anio}`} · ${money(activasFiltradas.reduce((s, a) => s + (Number(a.inversion) || 0), 0))}`}
            padding="4px 8px">
            {activasFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '22px 12px', color: theme.textMuted, fontSize: 12 }}>
                {completadasFiltradas.length ? 'Sin actividades pendientes con estos filtros. Revisa las completadas abajo.' : 'No hay actividades para estos filtros.'}
                {canEdit && <span onClick={openNew} style={{ marginLeft: 8, color: theme.accent, cursor: 'pointer', fontWeight: 500 }}>Crear una</span>}
              </div>
            ) : activasFiltradas.map((a, i) => (
              <ActividadFila key={a.id} a={a} hoy={hoy} canEdit={canEdit} onEdit={openEdit} onToggle={toggleCompletada} onArchivar={archivar} onDelete={deleteAct} ultima={i === activasFiltradas.length - 1} />
            ))}
          </Panel>

          {completadasFiltradas.length > 0 && (
            <Panel
              titulo="Completadas y archivadas"
              meta={`${completadasFiltradas.length} · ${money(completadasFiltradas.reduce((s, a) => s + (Number(a.inversion) || 0), 0))}`}
              plegable abiertoInicial={false} padding="4px 8px">
              {completadasFiltradas.map((a, i) => (
                <ActividadFila key={a.id} a={a} hoy={hoy} canEdit={canEdit} onEdit={openEdit} onToggle={toggleCompletada} onArchivar={archivar} onDelete={deleteAct} ultima={i === completadasFiltradas.length - 1} />
              ))}
            </Panel>
          )}
        </div>
      </div>

      {/* 5 · Formulario */}
      {showForm && <ActividadForm form={form} setForm={setForm} editId={editId} saving={saving} onSave={save} onClose={closeForm} />}
    </div>
  );
}
