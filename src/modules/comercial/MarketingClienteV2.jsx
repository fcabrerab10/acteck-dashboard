// MarketingClienteV2 · rediseño Apple V2 híbrido A+B
// ─ Hero editorial + 4 KPIs (Actividades · Inversión · Sin cerrar · Canal líder)
// ─ Calendario mensual grande + Agenda del día seleccionado
// ─ Ferruteck cosmic strip con insights
// ─ Tarjetas de actividades activas + completadas colapsable
// ─ Modales Apple para Nueva/Editar/Cerrar mes/Eliminar
// Preserva 100% del comportamiento de MarketingCliente.jsx (data, realtime, cerrar mes, permisos)

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { FerrutekLoader } from '../../components';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente } from '../../lib/permisos';
import { Sparkles, Search, Mail, Video, Image as ImageIcon, Smartphone, PartyPopper, Check, Pencil, Trash2, RotateCcw, Calendar, DollarSign, User, Lock } from 'lucide-react';

// Íconos SF-style outline por tipo (lucide-react)
const TIPO_ICON = {
  mailing: Mail,
  reel: Video,
  banner: ImageIcon,
  meta_ads: Smartphone,
  google_ads: Search,
  evento: PartyPopper,
};

// ═══════════ CONFIG (idéntico a V1) ═══════════════════════
const TIPOS = {
  mailing:    { label: 'Mailing',    color: '#30D158', icon: '📧', metricas: [
    { key: 'envios', label: 'Envíos' },
    { key: 'aperturas', label: 'Aperturas' },
    { key: 'clics', label: 'Clics' },
  ]},
  reel:       { label: 'Reel',       color: '#BF5AF2', icon: '🎬', redSocial: true, metricas: [
    { key: 'visualizaciones', label: 'Visualizaciones' },
    { key: 'interaccion', label: 'Interacción' },
    { key: 'cuentas_alcanzadas', label: 'Cuentas alcanzadas' },
    { key: 'retencion', label: 'Retención (%)' },
    { key: 'me_gusta', label: 'Me gusta' },
  ]},
  banner:     { label: 'Banner',     color: '#0071E3', icon: '🖼️', metricas: [
    { key: 'usuarios_activos', label: 'Usuarios activos' },
    { key: 'sesiones', label: 'Sesiones' },
    { key: 'vistas', label: 'Vistas' },
  ]},
  meta_ads:   { label: 'Meta Ads',   color: '#FFD60A', icon: '📱', metricas: [
    { key: 'importe_gastado', label: 'Importe gastado ($)', money: true },
    { key: 'alcance', label: 'Alcance' },
    { key: 'impresiones', label: 'Impresiones' },
    { key: 'clics_enlace', label: 'Clics en enlace' },
    { key: 'compras', label: 'Compras' },
    { key: 'valor_conversion', label: 'Valor conversión ($)', money: true },
  ]},
  google_ads: { label: 'Google Ads', color: '#FF9F0A', icon: '🔍', metricas: [
    { key: 'calidad', label: 'Calidad (1-10)' },
    { key: 'clics', label: 'Clics' },
    { key: 'impresiones', label: 'Impresiones' },
    { key: 'conversiones', label: 'Conversiones' },
    { key: 'valor_conversion', label: 'Valor conversión ($)', money: true },
    { key: 'costo', label: 'Costo ($)', money: true },
    { key: 'nivel_optimizacion', label: 'Nivel optimización (%)' },
  ]},
  evento:     { label: 'Evento',     color: '#FF375F', icon: '🎪', evento: true, metricas: [
    { key: 'asistentes', label: 'Asistentes' },
    { key: 'contactos', label: 'Contactos capturados' },
    { key: 'ventas', label: 'Ventas ($)', money: true },
  ]},
};

const MARCAS = {
  acteck:     { label: 'Acteck',     color: '#0071E3' },
  balam_rush: { label: 'Balam Rush', color: '#BF5AF2' },
};

const REDES_SOCIALES = {
  tiktok:    { label: 'TikTok',    icon: '🎵' },
  facebook:  { label: 'Facebook',  icon: '📘' },
  instagram: { label: 'Instagram', icon: '📷' },
  youtube:   { label: 'YouTube',   icon: '▶️' },
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIAS_SEMANA = ['L','M','X','J','V','S','D'];

const emptyForm = () => ({
  tipo: 'mailing',
  marca: 'acteck',
  fecha: new Date().toISOString().slice(0, 10),
  nombre: '',
  mensaje: '',
  red_social: '',
  inversion: 0,
  metricas: {},
  evento_sucursal: '',
  evento_pop: '',
  notas: '',
  responsable: '',
});

const fmt$ = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('es-MX')}`;
};
const fmt$Full = (v) => '$' + Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtN = (v) => Number(v || 0).toLocaleString('es-MX');

const parseFecha = (f) => {
  if (!f) return null;
  const p = String(f).slice(0, 10).split('-').map(n => parseInt(n, 10));
  if (p.length !== 3 || !p[0]) return null;
  return { y: p[0], m: p[1], d: p[2] };
};

// ═══════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════
export default function MarketingClienteV2({ cliente, clienteKey }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const ck = clienteKey || cliente;
  const canEdit = puedeEditarPestanaCliente(perfil, ck, 'marketing');

  const [actividades, setActividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mesSel, setMesSel] = useState(new Date().getMonth() + 1);
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterMarca, setFilterMarca] = useState('todas');
  const [calVista, setCalVista] = useState('mes');
  const [diaSel, setDiaSel] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // {id, nombre}
  const [confirmClose, setConfirmClose] = useState(false);

  // ─── Carga inicial + realtime ─────────────────────────────
  useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    supabase.from('marketing_actividades').select('*').eq('cliente', ck).eq('anio', anio).then(({ data }) => {
      setActividades(data || []);
      setLoading(false);
    });
    const chan = supabase.channel('mkt-v2-' + ck + '-' + anio)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_actividades' }, (payload) => {
        if (payload.eventType === 'INSERT') setActividades(p => [...p, payload.new]);
        else if (payload.eventType === 'UPDATE') setActividades(p => p.map(a => a.id === payload.new.id ? payload.new : a));
        else if (payload.eventType === 'DELETE') setActividades(p => p.filter(a => a.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [ck, anio]);

  // Filtros aplicados a listas activas/completadas
  const { activasFiltradas, completadasFiltradas } = useMemo(() => {
    const applyFilters = (arr) => arr.filter(a => {
      const pf = parseFecha(a.fecha);
      const aMes = pf ? pf.m : Number(a.mes) || 0;
      const aAnio = pf ? pf.y : Number(a.anio) || 0;
      if (aAnio !== anio) return false;
      if (aMes !== mesSel) return false;
      if (filterTipo !== 'todos' && a.tipo !== filterTipo) return false;
      if (filterMarca !== 'todas' && a.marca !== filterMarca) return false;
      if (diaSel && pf && pf.d !== diaSel) return false;
      return true;
    }).sort((a, b) => {
      const pa = parseFecha(a.fecha), pb = parseFecha(b.fecha);
      return (pa ? pa.d : 0) - (pb ? pb.d : 0);
    });
    const activas = applyFilters(actividades.filter(a => a.estatus !== 'completado' && a.estatus !== 'archivado'));
    const completadas = applyFilters(actividades.filter(a => a.estatus === 'completado' || a.estatus === 'archivado'));
    return { activasFiltradas: activas, completadasFiltradas: completadas };
  }, [actividades, anio, mesSel, filterTipo, filterMarca, diaSel]);

  const actividadesDelMes = useMemo(() => actividades.filter(a => {
    const pf = parseFecha(a.fecha);
    const m = pf ? pf.m : Number(a.mes) || 0;
    const y = pf ? pf.y : Number(a.anio) || 0;
    return y === anio && m === mesSel;
  }), [actividades, anio, mesSel]);

  // KPIs
  const kpis = useMemo(() => {
    const total = actividadesDelMes.length;
    let inversion = 0, sinPago = 0, inversionSinPago = 0, conPago = 0;
    const porTipo = {};
    for (const a of actividadesDelMes) {
      const inv = Number(a.inversion) || 0;
      inversion += inv;
      porTipo[a.tipo] = (porTipo[a.tipo] || 0) + inv;
      if (a.pago_id) conPago++;
      else { sinPago++; inversionSinPago += inv; }
    }
    const tipoLider = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0];
    // Mes previo — para MoM
    const prevMes = mesSel === 1 ? 12 : mesSel - 1;
    const prevAnio = mesSel === 1 ? anio - 1 : anio;
    let inversionPrev = 0;
    for (const a of actividades) {
      const pf = parseFecha(a.fecha);
      const m = pf ? pf.m : Number(a.mes) || 0;
      const y = pf ? pf.y : Number(a.anio) || 0;
      if (y === prevAnio && m === prevMes) inversionPrev += Number(a.inversion) || 0;
    }
    const momPct = inversionPrev > 0 ? ((inversion - inversionPrev) / inversionPrev * 100) : null;
    // Cerradas
    const cerradas = actividadesDelMes.filter(a => a.estatus === 'completado' || a.estatus === 'archivado').length;
    const enCurso = total - cerradas;
    // Marcas activas
    const marcasSet = new Set(actividadesDelMes.map(a => a.marca).filter(Boolean));
    return {
      total, inversion, sinPago, inversionSinPago, conPago,
      tipoLider: tipoLider ? { key: tipoLider[0], monto: tipoLider[1], meta: TIPOS[tipoLider[0]] } : null,
      inversionPrev, momPct, cerradas, enCurso, marcasCount: marcasSet.size,
      countsPorTipo: porTipo,
    };
  }, [actividadesDelMes, actividades, mesSel, anio]);

  // Ferruteck insights
  const recos = useMemo(() => {
    const out = [];
    if (kpis.tipoLider) {
      const t = kpis.tipoLider;
      out.push({ icon: '🏆', t: `${t.meta.label} lidera con ${fmt$(t.monto)}`, s: `${Math.round(t.monto / (kpis.inversion || 1) * 100)}% del gasto` });
    }
    // Reel con retención alta
    const reels = actividadesDelMes.filter(a => a.tipo === 'reel');
    let bestReel = null;
    for (const r of reels) {
      const ret = Number(r.metricas?.retencion) || 0;
      if (ret > (bestReel?.ret || 0)) bestReel = { ret, nombre: r.nombre };
    }
    if (bestReel && bestReel.ret > 0) {
      out.push({ icon: '🔥', t: `Reel con ${bestReel.ret}% de retención`, s: bestReel.nombre || 'Mejor engagement del mes' });
    }
    // Sin métricas
    const sinMetricas = actividadesDelMes.filter(a => {
      const m = a.metricas || {};
      const t = TIPOS[a.tipo]; if (!t) return false;
      return t.metricas.every(k => m[k.key] == null || m[k.key] === '');
    }).length;
    if (sinMetricas > 0) {
      out.push({ icon: '⚠️', t: `${sinMetricas} actividades sin métricas`, s: 'Completa para medir ROAS real' });
    }
    // Cerrar mes
    if (kpis.sinPago > 0 && kpis.inversionSinPago > 0) {
      out.push({ icon: '💸', t: `${fmt$(kpis.inversionSinPago)} listos para cerrar`, s: `${kpis.sinPago} actividades pendientes` });
    }
    return out.slice(0, 3);
  }, [kpis, actividadesDelMes]);

  // Calendario mes
  const calendario = useMemo(() => {
    const firstDay = new Date(anio, mesSel - 1, 1);
    const lastDay = new Date(anio, mesSel, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay; d++) {
      const acts = actividadesDelMes.filter(a => {
        const pf = parseFecha(a.fecha);
        if (!pf) return false;
        if (filterTipo !== 'todos' && a.tipo !== filterTipo) return false;
        if (filterMarca !== 'todas' && a.marca !== filterMarca) return false;
        return pf.d === d;
      });
      days.push({ day: d, actividades: acts });
    }
    return days;
  }, [anio, mesSel, actividadesDelMes, filterTipo, filterMarca]);

  const hoyDia = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === anio && now.getMonth() + 1 === mesSel ? now.getDate() : null;
  }, [anio, mesSel]);

  // Agenda del día seleccionado
  const agendaDia = useMemo(() => {
    if (!diaSel) return { actividades: [], total: 0 };
    const acts = actividadesDelMes.filter(a => {
      const pf = parseFecha(a.fecha);
      return pf && pf.d === diaSel;
    });
    return { actividades: acts, total: acts.reduce((s, a) => s + (Number(a.inversion) || 0), 0) };
  }, [diaSel, actividadesDelMes]);

  // Composición anual (para vista anual)
  const conteoAnual = useMemo(() => {
    const m = Array(12).fill(0).map(() => ({ count: 0, byTipo: {} }));
    for (const a of actividades) {
      const pf = parseFecha(a.fecha);
      const mm = pf ? pf.m : Number(a.mes) || 0;
      const yy = pf ? pf.y : Number(a.anio) || 0;
      if (yy !== anio || mm < 1 || mm > 12) continue;
      if (filterTipo !== 'todos' && a.tipo !== filterTipo) continue;
      if (filterMarca !== 'todas' && a.marca !== filterMarca) continue;
      m[mm - 1].count++;
      m[mm - 1].byTipo[a.tipo] = (m[mm - 1].byTipo[a.tipo] || 0) + 1;
    }
    return m;
  }, [actividades, anio, filterTipo, filterMarca]);

  // CRUD
  const openNew = () => {
    if (!canEdit) return;
    const d = new Date();
    const day = d.getFullYear() === anio && d.getMonth() + 1 === mesSel ? d.getDate() : (diaSel || Math.min(new Date().getDate(), 28));
    const fecha = `${anio}-${String(mesSel).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setForm({ ...emptyForm(), fecha });
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
    if (!form.nombre.trim()) { alert('Falta el nombre de la actividad'); return; }
    setSaving(true);
    let fAnio = anio, fMes = mesSel;
    if (form.fecha) {
      const parts = form.fecha.split('-').map(n => parseInt(n, 10));
      if (parts.length === 3 && parts[0] && parts[1]) { fAnio = parts[0]; fMes = parts[1]; }
    }
    const payload = {
      cliente: ck,
      tipo: form.tipo, marca: form.marca,
      nombre: form.nombre.trim(),
      mensaje: form.mensaje || '',
      red_social: form.red_social || null,
      fecha: form.fecha || null,
      anio: fAnio, mes: String(fMes),
      inversion: Number(form.inversion) || 0,
      metricas: form.metricas || {},
      evento_sucursal: form.evento_sucursal || null,
      evento_pop: form.evento_pop || null,
      notas: form.notas || null,
      responsable: form.responsable || null,
      estatus: 'activo',
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
    if (err) { alert('Error guardando: ' + err.message); return; }
    if (saved) {
      if (editId) setActividades(p => p.map(a => a.id === editId ? saved : a));
      else setActividades(p => [...p.filter(a => a.id !== saved.id), saved]);
    }
    closeForm();
  };
  const doDelete = async () => {
    if (!canEdit || !confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setActividades(p => p.filter(a => a.id !== id));
    const { error } = await supabase.from('marketing_actividades').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
      const { data } = await supabase.from('marketing_actividades').select('*').eq('cliente', ck).eq('anio', anio);
      setActividades(data || []);
    }
  };
  const toggleCompletada = async (a) => {
    if (!canEdit) return;
    const nuevoEstatus = (a.estatus === 'completado' || a.estatus === 'archivado') ? 'activo' : 'completado';
    setActividades(p => p.map(x => x.id === a.id ? { ...x, estatus: nuevoEstatus } : x));
    const { error } = await supabase.from('marketing_actividades').update({ estatus: nuevoEstatus }).eq('id', a.id);
    if (error) { alert('Error: ' + error.message); }
  };
  const doCerrarMes = async () => {
    if (!canEdit) return;
    const actsACerrar = actividadesDelMes.filter(a => !a.pago_id);
    if (actsACerrar.length === 0) { setConfirmClose(false); return; }
    const totalInv = actsACerrar.reduce((s, a) => s + (Number(a.inversion) || 0), 0);
    const mesLabel = MESES[mesSel - 1];
    const nextMes = mesSel === 12 ? 1 : mesSel + 1;
    const nextAnio = mesSel === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, '0')}-15`;
    const pagoPayload = {
      cliente: ck, categoria: 'marketing', folio: null,
      concepto: `Marketing ${mesLabel} ${anio} — ${actsACerrar.length} actividad(es)`,
      monto: totalInv, estatus: 'pendiente',
      fecha_compromiso: fechaCompromiso, responsable: 'Fernando Cabrera',
      notas: actsACerrar.map(a => `• ${a.nombre} (${TIPOS[a.tipo]?.label || a.tipo}): ${fmt$Full(a.inversion || 0)}`).join('\n'),
    };
    const { data: pagoData, error: pagoError } = await supabase.from('pagos').insert(pagoPayload).select().single();
    if (pagoError) { alert('Error creando el pago: ' + pagoError.message); return; }
    const ids = actsACerrar.map(a => a.id);
    const { error: updError } = await supabase.from('marketing_actividades').update({ pago_id: pagoData.id }).in('id', ids);
    if (updError) { alert('Pago creado pero no se pudieron ligar las actividades: ' + updError.message); return; }
    setActividades(p => p.map(a => ids.includes(a.id) ? { ...a, pago_id: pagoData.id } : a));
    setConfirmClose(false);
    alert(`✓ Mes cerrado. Pago ${fmt$Full(totalInv)} creado para ${mesLabel} ${anio}.`);
  };

  // Estilos comunes
  const heroBg = theme.heroCardBg || '#0A0A0C';
  const bgAlt = theme.bgAlt || (theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)');
  const accentSoft = theme.accentSoft || `${theme.accent}20`;
  const accentBg = theme.accentBg || `${theme.accent}25`;

  if (loading) {
    return <FerrutekLoader label="Cargando marketing…" sub={`Ferruteck está trayendo las actividades de ${MESES[mesSel - 1]} ${anio}`} minHeight={480} />;
  }

  const filaChip = { padding: '4px 10px', borderRadius: 99, fontSize: 11, fontFamily: TYPO.fontDisplay, fontWeight: 600, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'transform 160ms cubic-bezier(0.34,1.56,0.64,1), background 160ms' };

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <style>{`
        .mkv2-hoverGrow { transition: transform 160ms cubic-bezier(0.34,1.56,0.64,1), background 160ms; }
        .mkv2-hoverGrow:hover { transform: scale(1.03); }
        .mkv2-hoverGrow:active { transform: scale(0.97); }
        .mkv2-btn { transition: transform 160ms cubic-bezier(0.34,1.56,0.64,1), background 160ms, filter 160ms; border: 0; cursor: pointer; }
        .mkv2-btn:hover { transform: scale(1.03); }
        .mkv2-btn:active { transform: scale(0.97); }
        .mkv2-btn-primary:hover { background: ${theme.accentHover || theme.accent}; }
        .mkv2-btn-solid:hover { filter: brightness(1.05); }
        .mkv2-btn-ghost:hover { background: ${bgAlt}; color: ${theme.text}; }
        .mkv2-field { transition: border-color 160ms, box-shadow 160ms; }
        .mkv2-field:focus { outline: none; border-color: ${theme.accent}; box-shadow: 0 0 0 3px ${accentSoft}; }
      `}</style>

      {/* Hero */}
      <div style={{ background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 20, alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.accent }} />
            Marketing · {cliente || ck} · {MESES[mesSel - 1]} {anio}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            {kpis.tipoLider
              ? `${kpis.tipoLider.meta.label} captura el ${Math.round(kpis.tipoLider.monto / (kpis.inversion || 1) * 100)}% del gasto`
              : kpis.total > 0 ? `${kpis.total} actividades este mes` : `Sin actividades en ${MESES[mesSel - 1]}`}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 440, lineHeight: 1.4, margin: 0 }}>
            {kpis.total > 0
              ? `${kpis.total} actividades · ${fmt$(kpis.inversion)} invertidos${kpis.sinPago > 0 ? ` · ${kpis.sinPago} sin cerrar por ${fmt$(kpis.inversionSinPago)}` : ''}`
              : canEdit ? 'Crea la primera actividad del mes con el botón +' : 'Sin actividades para mostrar'}
          </p>
        </div>
        <HeroStat k="Actividades" v={String(kpis.total)} sub={`${MESES_CORTOS[mesSel - 1]} ${anio}`} />
        <HeroStat k="Inversión" v={fmt$(kpis.inversion)} sub={kpis.momPct != null ? `${kpis.momPct >= 0 ? '+' : ''}${kpis.momPct.toFixed(0)}% vs mes -1` : '—'} valColor={kpis.momPct == null ? undefined : kpis.momPct >= 0 ? theme.green : theme.red} />
        <HeroStat k="Sin cerrar" v={String(kpis.sinPago)} sub={kpis.sinPago > 0 ? `${fmt$(kpis.inversionSinPago)} pendiente` : 'Todo cerrado'} valColor={kpis.sinPago > 0 ? theme.orange : theme.green} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} eyebrow={`MTD · ${MESES_CORTOS[mesSel - 1]}`} title="Actividades"
          badge={kpis.enCurso > 0 ? { l: `${kpis.enCurso} en curso`, tone: 'neu' } : null}
          big={String(kpis.total)} bigSmall="total"
          sub={<>{kpis.cerradas} cerradas · {kpis.marcasCount} {kpis.marcasCount === 1 ? 'marca' : 'marcas'}</>} />
        <KpiCard theme={theme} eyebrow="Inversión mensual" title="Gasto marketing"
          badge={kpis.momPct != null ? { l: `${kpis.momPct >= 0 ? '+' : ''}${Math.round(kpis.momPct)}%`, tone: kpis.momPct >= 0 ? 'good' : 'warn' } : null}
          big={fmt$(kpis.inversion)}
          bigSmall={kpis.inversionPrev > 0 ? `vs ${fmt$(kpis.inversionPrev)}` : ''}
          sub={kpis.momPct != null && kpis.inversionPrev > 0 ? <><strong style={{ color: kpis.momPct >= 0 ? theme.green : theme.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{kpis.momPct >= 0 ? '+' : ''}{fmt$(kpis.inversion - kpis.inversionPrev)}</strong> vs mes anterior</> : 'Sin comparativo'} />
        <KpiCard theme={theme} eyebrow="Cierre de mes" title="Sin pago consolidado"
          badge={kpis.sinPago > 0 ? { l: String(kpis.sinPago), tone: 'warn' } : { l: '✓', tone: 'good' }}
          big={fmt$(kpis.inversionSinPago)}
          bigColor={kpis.sinPago > 0 ? theme.orange : theme.text}
          bigSmall={`${kpis.sinPago} actividad${kpis.sinPago === 1 ? '' : 'es'}`}
          sub={kpis.sinPago > 0 && canEdit ? 'Cerrar mes disponible' : 'Todo consolidado'} />
        <KpiCard theme={theme} eyebrow="Canal líder" title="Mayor inversión"
          big={kpis.tipoLider ? kpis.tipoLider.meta.label : '—'}
          bigSmall={kpis.tipoLider ? `${fmt$(kpis.tipoLider.monto)} · ${Math.round(kpis.tipoLider.monto / (kpis.inversion || 1) * 100)}%` : ''}
          sub={kpis.tipoLider ? `${kpis.countsPorTipo[kpis.tipoLider.key] > 0 ? '' : ''}${(actividadesDelMes.filter(a => a.tipo === kpis.tipoLider.key)).length} ${(actividadesDelMes.filter(a => a.tipo === kpis.tipoLider.key)).length === 1 ? 'campaña' : 'campañas'}` : 'Sin actividades'} />
      </div>

      {/* Toolbar año/mes + acciones */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Eyebrow theme={theme}>Año</Eyebrow>
        <Segmented theme={theme} bgAlt={bgAlt}>
          {[2025, 2026].map(y => (
            <SegBtn key={y} theme={theme} active={anio === y} onClick={() => setAnio(y)}>{y}</SegBtn>
          ))}
        </Segmented>
        <Eyebrow theme={theme} style={{ marginLeft: 8 }}>Mes</Eyebrow>
        <Segmented theme={theme} bgAlt={bgAlt} wrap>
          {MESES_CORTOS.map((m, i) => (
            <SegBtn key={m} theme={theme} active={mesSel === i + 1} onClick={() => { setMesSel(i + 1); setDiaSel(null); }}>{m}</SegBtn>
          ))}
        </Segmented>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {canEdit && kpis.sinPago > 0 && kpis.inversionSinPago > 0 && (
            <button className="mkv2-btn mkv2-btn-solid" onClick={() => setConfirmClose(true)}
              style={{ padding: '8px 16px', borderRadius: 8, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, background: theme.green, color: '#FFF', letterSpacing: '-0.005em' }}>
              🔒 Cerrar mes · {fmt$(kpis.inversionSinPago)}
            </button>
          )}
          {canEdit && (
            <button className="mkv2-btn mkv2-btn-primary" onClick={openNew}
              style={{ padding: '8px 16px', borderRadius: 8, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, background: theme.accent, color: '#FFF', letterSpacing: '-0.005em' }}>
              + Nueva actividad
            </button>
          )}
        </div>
      </div>

      {/* Filter chips: Tipo + Marca */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Eyebrow theme={theme}>Tipo</Eyebrow>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <FilterChip theme={theme} filaChip={filaChip} active={filterTipo === 'todos'} onClick={() => setFilterTipo('todos')}>Todos · {actividadesDelMes.length}</FilterChip>
          {Object.entries(TIPOS).map(([k, t]) => {
            const count = actividadesDelMes.filter(a => a.tipo === k).length;
            return (
              <FilterChip key={k} theme={theme} filaChip={filaChip} active={filterTipo === k} color={t.color} onClick={() => setFilterTipo(k)}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: t.color }} />
                {t.icon} {t.label} {count > 0 ? count : ''}
              </FilterChip>
            );
          })}
        </div>
        <Eyebrow theme={theme} style={{ marginLeft: 12 }}>Marca</Eyebrow>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <FilterChip theme={theme} filaChip={filaChip} active={filterMarca === 'todas'} onClick={() => setFilterMarca('todas')}>Todas</FilterChip>
          {Object.entries(MARCAS).map(([k, m]) => {
            const count = actividadesDelMes.filter(a => a.marca === k).length;
            return (
              <FilterChip key={k} theme={theme} filaChip={filaChip} active={filterMarca === k} color={m.color} onClick={() => setFilterMarca(k)}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: m.color }} />
                {m.label} {count > 0 ? count : ''}
              </FilterChip>
            );
          })}
        </div>
      </div>

      {/* Calendario + Agenda */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 10 }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
              {calVista === 'mes' ? `${MESES[mesSel - 1]} ${anio}` : anio}
            </h5>
            <Segmented theme={theme} bgAlt={bgAlt}>
              <SegBtn theme={theme} active={calVista === 'mes'} onClick={() => setCalVista('mes')}>Mes</SegBtn>
              <SegBtn theme={theme} active={calVista === 'anual'} onClick={() => setCalVista('anual')}>Anual</SegBtn>
            </Segmented>
          </div>
          {calVista === 'mes' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, fontFamily: TYPO.fontDisplay, fontSize: 9.5, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600, marginBottom: 4 }}>
                {DIAS_SEMANA.map(d => <div key={d} style={{ textAlign: 'center', padding: '2px 0' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {calendario.map((cell, i) => {
                  if (!cell) return <div key={i} style={{ minHeight: 44 }} />;
                  const isSel = cell.day === diaSel;
                  const isHoy = cell.day === hoyDia;
                  const hasActs = cell.actividades.length > 0;
                  return (
                    <div key={i} onClick={() => setDiaSel(cell.day === diaSel ? null : cell.day)}
                      style={{
                        minHeight: 44,
                        borderRadius: 6, padding: '4px 5px',
                        display: 'flex', flexDirection: 'column', gap: 2,
                        cursor: 'pointer', transition: 'background 160ms',
                        background: isSel ? `${theme.accent}1A` : isHoy ? `${theme.accent}0A` : (hasActs ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent'),
                        boxShadow: isSel ? `inset 0 0 0 1.5px ${theme.accent}` : 'none',
                        position: 'relative',
                      }}
                    >
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: isHoy || isSel ? 700 : 600, color: isHoy || isSel ? theme.accent : theme.textMuted, lineHeight: 1 }}>{cell.day}</div>
                      {hasActs && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 'auto', alignItems: 'center' }}>
                          {cell.actividades.slice(0, 4).map(a => (
                            <span key={a.id} title={`${TIPOS[a.tipo]?.label || a.tipo}: ${a.nombre || ''}`}
                              style={{ width: 5, height: 5, borderRadius: 99, background: TIPOS[a.tipo]?.color || theme.textMuted }} />
                          ))}
                          {cell.actividades.length > 4 && (
                            <span style={{ fontSize: 8.5, color: theme.textMuted, fontFamily: 'SF Mono, ui-monospace, monospace', lineHeight: 1 }}>+{cell.actividades.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {conteoAnual.map((mo, i) => (
                <div key={i} onClick={() => { setMesSel(i + 1); setCalVista('mes'); setDiaSel(null); }}
                  style={{ border: `1px solid ${mesSel === i + 1 ? theme.accent : theme.divider || theme.border}`, background: mesSel === i + 1 ? `${theme.accent}08` : 'transparent', borderRadius: 10, padding: 10, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text }}>{MESES_CORTOS[i]}</span>
                    <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>{mo.count}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {Object.entries(mo.byTipo).map(([tk, cnt]) => (
                      <span key={tk} title={`${TIPOS[tk]?.label || tk}: ${cnt}`}
                        style={{ width: 8, height: 8, borderRadius: 99, background: TIPOS[tk]?.color || theme.textMuted }} />
                    ))}
                    {mo.count === 0 && <span style={{ fontSize: 10, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic' }}>Sin actividades</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agenda del día */}
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div>
              <Eyebrow theme={theme}>{diaSel ? 'Día seleccionado' : 'Agenda del día'}</Eyebrow>
              <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', margin: '2px 0 0', color: theme.text }}>
                {diaSel ? `${diaSel} · ${MESES[mesSel - 1]}` : 'Selecciona un día'}
              </h5>
            </div>
            {diaSel && agendaDia.actividades.length > 0 && (
              <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11, color: theme.textMuted }}>{agendaDia.actividades.length} act.</span>
            )}
          </div>
          {!diaSel ? (
            <div style={{ padding: '30px 8px', textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
              Click en un día del calendario para ver las actividades
            </div>
          ) : agendaDia.actividades.length === 0 ? (
            <div style={{ padding: '30px 8px', textAlign: 'center', color: theme.textSubtle || theme.textMuted, fontSize: 12, fontStyle: 'italic' }}>
              Sin actividades ese día
            </div>
          ) : (
            <>
              {agendaDia.actividades.map(a => {
                const t = TIPOS[a.tipo] || { label: a.tipo, color: theme.textMuted };
                const Icon = TIPO_ICON[a.tipo] || Mail;
                const m = MARCAS[a.marca];
                return (
                  <div key={a.id} onClick={() => openEdit(a)}
                    style={{ borderRadius: 8, padding: '8px 10px', marginBottom: 4, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', background: 'transparent', cursor: 'pointer', transition: 'background 160ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = bgAlt; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${t.color}1F`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={14} strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, letterSpacing: '-0.005em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre || 'Sin nombre'}</div>
                      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>
                        <span style={{ color: t.color, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{t.label}</span>{m ? ` · ${m.label}` : ''}{a.responsable ? ` · ${a.responsable}` : ''}
                      </div>
                    </div>
                    <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11.5, fontWeight: 600, color: a.inversion > 0 ? theme.green : theme.textSubtle || theme.textMuted }}>{a.inversion > 0 ? fmt$(a.inversion) : '—'}</div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.divider || theme.border}` }}>
                <Eyebrow theme={theme}>Total del día</Eyebrow>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{fmt$(agendaDia.total)}</span>
              </div>
              {canEdit && (
                <button className="mkv2-btn mkv2-btn-primary" onClick={openNew}
                  style={{ width: '100%', marginTop: 8, padding: '9px 14px', borderRadius: 8, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, background: theme.accent, color: '#FFF' }}>
                  + Añadir al {diaSel} {MESES_CORTOS[mesSel - 1]}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ferruteck strip */}
      {recos.length > 0 && <FerruteckStrip recos={recos} />}

      {/* Grid tarjetas activas */}
      {activasFiltradas.length === 0 && completadasFiltradas.length === 0 ? (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
          {diaSel ? `Sin actividades el día ${diaSel}.` : 'No hay actividades para estos filtros.'}
          {canEdit && <> <button className="mkv2-btn mkv2-btn-ghost" onClick={openNew} style={{ marginLeft: 8, background: 'transparent', color: theme.accent, textDecoration: 'underline', padding: 0 }}>Crear una</button></>}
        </div>
      ) : (
        <>
          {activasFiltradas.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 10 }}>
              {activasFiltradas.map(a => (
                <ActivityCard key={a.id} a={a} theme={theme} canEdit={canEdit}
                  onEdit={openEdit} onDelete={(id, nombre) => setConfirmDelete({ id, nombre })} onToggle={toggleCompletada} />
              ))}
            </div>
          )}

          {completadasFiltradas.length > 0 && (
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 14px' }}>
              <button onClick={() => setMostrarArchivadas(s => !s)}
                style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, color: theme.text, padding: 0 }}>
                <span style={{ fontSize: 10, display: 'inline-block', transform: mostrarArchivadas ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .18s' }}>▶</span>
                📁 Actividades completadas
                <span style={{ background: bgAlt, color: theme.textMuted, fontSize: 10.5, padding: '1px 8px', borderRadius: 99 }}>{completadasFiltradas.length}</span>
              </button>
              {mostrarArchivadas && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 10 }}>
                  {completadasFiltradas.map(a => (
                    <ActivityCard key={a.id} a={a} theme={theme} canEdit={canEdit}
                      onEdit={openEdit} onDelete={(id, nombre) => setConfirmDelete({ id, nombre })} onToggle={toggleCompletada} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {showForm && (
        <ActivityFormModal
          theme={theme} bgAlt={bgAlt} accentSoft={accentSoft} accentBg={accentBg}
          form={form} setForm={setForm} editId={editId} saving={saving}
          onSave={save} onClose={closeForm}
          onDelete={editId ? () => { const a = actividades.find(x => x.id === editId); setConfirmDelete({ id: editId, nombre: a?.nombre || '' }); closeForm(); } : null}
          cliente={cliente || ck}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          theme={theme} bgAlt={bgAlt}
          leadEye="Acción irreversible" title="Eliminar actividad"
          iconBg={`${theme.red}22`} icon="🗑"
          body={<>Esta acción no se puede deshacer. <strong>"{confirmDelete.nombre || 'Sin nombre'}"</strong> y todas sus métricas se eliminarán permanentemente.</>}
          onCancel={() => setConfirmDelete(null)}
          confirmLabel="Eliminar" confirmColor={theme.red} onConfirm={doDelete}
        />
      )}
      {confirmClose && (
        <ConfirmModal
          theme={theme} bgAlt={bgAlt}
          leadEye="Cierre mensual" title={`Cerrar ${MESES[mesSel - 1]} ${anio}`}
          iconBg={`${theme.green}22`} icon="🔒"
          body={<>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: theme.text }}>
              Se consolidarán <strong>{kpis.sinPago} actividad{kpis.sinPago === 1 ? '' : 'es'}</strong> pendientes en un pago por <strong style={{ color: theme.green }}>{fmt$Full(kpis.inversionSinPago)}</strong>. Fecha compromiso: <strong>15 · {MESES_CORTOS[mesSel === 12 ? 0 : mesSel]} · {mesSel === 12 ? anio + 1 : anio}</strong>.
            </p>
            <div style={{ background: bgAlt, borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>Actividades a consolidar</div>
              {actividadesDelMes.filter(a => !a.pago_id).map((a, i, arr) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '5px 0', color: theme.text, borderTop: i > 0 ? `1px solid ${theme.divider || theme.border}` : 'none' }}>
                  <span>{TIPOS[a.tipo]?.icon || '📌'} {a.nombre}</span>
                  <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontWeight: 600 }}>{fmt$Full(a.inversion || 0)}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: theme.textMuted }}>El folio se agregará manualmente en Pagos.</p>
          </>}
          onCancel={() => setConfirmClose(false)}
          confirmLabel={`🔒 Cerrar mes · ${fmt$Full(kpis.inversionSinPago)}`} confirmColor={theme.green} onConfirm={doCerrarMes}
        />
      )}
    </div>
  );
}

// ═══════════ Sub-componentes ═══════════════════════

function HeroStat({ k, v, sub, valColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, color: valColor || '#FFF', letterSpacing: '-0.02em' }}>{v}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>{sub}</div>
    </div>
  );
}

function KpiCard({ theme, eyebrow, title, big, bigSmall, bigColor, sub, badge }) {
  const badgeStyle = (tone) => {
    if (tone === 'good') return { bg: 'rgba(48,209,88,0.14)', color: '#0F8A3A' };
    if (tone === 'warn') return { bg: 'rgba(255,159,10,0.14)', color: '#B76E00' };
    return { bg: `${theme.accent}20`, color: theme.accent };
  };
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, marginTop: 1 }}>{title}</div>
        </div>
        {badge && (() => {
          const s = badgeStyle(badge.tone);
          return <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.color }}>{badge.l}</span>;
        })()}
      </div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: bigColor || theme.text, marginTop: 4 }}>
        {big}
        {bigSmall && <span style={{ fontFamily: TYPO.fontText, fontSize: 11, color: theme.textMuted, fontWeight: 500, marginLeft: 6 }}>{bigSmall}</span>}
      </div>
      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Eyebrow({ theme, children, style }) {
  return (
    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, ...(style || {}) }}>{children}</span>
  );
}

function Segmented({ theme, bgAlt, wrap, children }) {
  return (
    <div style={{ display: 'inline-flex', background: bgAlt, borderRadius: 8, padding: 2, flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</div>
  );
}
function SegBtn({ theme, active, onClick, children, style }) {
  return (
    <button className="mkv2-btn" onClick={onClick}
      style={{
        border: 0, padding: '5px 12px', borderRadius: 6,
        fontSize: 11, fontWeight: active ? 600 : 500,
        fontFamily: active ? TYPO.fontDisplay : TYPO.fontText,
        color: active ? theme.text : theme.textMuted,
        background: active ? theme.surface : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        cursor: 'pointer',
        ...(style || {}),
      }}>{children}</button>
  );
}

function FilterChip({ theme, filaChip, active, color, onClick, children }) {
  return (
    <button className="mkv2-btn" onClick={onClick}
      style={{
        ...filaChip,
        background: active ? (color || theme.text) : theme.surface,
        color: active ? '#FFF' : theme.textMuted,
        borderColor: active ? (color || theme.text) : theme.border,
      }}>{children}</button>
  );
}

function FerruteckStrip({ recos }) {
  return (
    <div style={{
      borderRadius: 12, padding: '12px 16px', color: '#FFF',
      background: `radial-gradient(120% 130% at 20% 30%, rgba(191,90,242,0.35), transparent 50%),
                   radial-gradient(120% 130% at 90% 90%, rgba(100,210,255,0.28), transparent 55%),
                   linear-gradient(180deg,#0F0B24 0%,#1A0F3E 100%)`,
      display: 'grid', gridTemplateColumns: `auto ${recos.map(() => '1fr').join(' ')}`, gap: 16, alignItems: 'center',
    }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.75)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <Sparkles size={12} /> Ferruteck
      </span>
      {recos.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{r.icon}</div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: '#FFF', lineHeight: 1.15 }}>{r.t}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)' }}>{r.s}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({ a, theme, canEdit, onEdit, onDelete, onToggle }) {
  const t = TIPOS[a.tipo] || { label: a.tipo || '?', color: theme.textMuted, metricas: [] };
  const Icon = TIPO_ICON[a.tipo] || Mail;
  const marca = MARCAS[a.marca];
  const rs = a.red_social ? REDES_SOCIALES[a.red_social] : null;
  const metricas = a.metricas || {};
  const fechaTxt = a.fecha ? (() => {
    const pf = parseFecha(a.fecha);
    return pf ? `${pf.d} ${MESES_CORTOS[pf.m - 1]}` : '';
  })() : '';
  const isCompleted = a.estatus === 'completado' || a.estatus === 'archivado';
  // Solo las métricas rellenadas se muestran como chips
  const metricasChips = t.metricas
    .map(m => ({ ...m, v: metricas[m.key] }))
    .filter(m => m.v != null && m.v !== '');

  const iconBtnStyle = {
    width: 26, height: 26, borderRadius: 8, border: 0, background: 'transparent',
    color: theme.textMuted, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 160ms, color 160ms, transform 160ms cubic-bezier(0.34,1.56,0.64,1)',
  };

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
      padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: 8,
      opacity: isCompleted ? 0.68 : 1,
      transition: 'transform 160ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 160ms',
    }}>
      {/* Head: ícono outline + nombre + marca */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${t.color}1F`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.25, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre || 'Sin nombre'}</div>
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.color }}>{t.label}</span>
            {rs && (<><span style={{ color: theme.textSubtle || theme.textMuted }}>·</span><span>{rs.icon} {rs.label}</span></>)}
          </div>
        </div>
        {marca && (
          <span style={{ padding: '2px 8px', borderRadius: 999, fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, background: `${marca.color}1F`, color: marca.color, whiteSpace: 'nowrap' }}>{marca.label}</span>
        )}
      </div>

      {/* Mensaje (si existe) */}
      {a.mensaje && (
        <div style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>"{a.mensaje}"</div>
      )}

      {/* Meta row: fecha, inversión, responsable, en pago */}
      <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: theme.textMuted, flexWrap: 'wrap', alignItems: 'center' }}>
        {fechaTxt && (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={11} strokeWidth={2} />{fechaTxt}</span>)}
        {Number(a.inversion) > 0 && (
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: theme.green }}>{fmt$Full(a.inversion)}</span>
        )}
        {a.responsable && (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} strokeWidth={2} />{a.responsable}</span>)}
        {a.pago_id && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${theme.green}1F`, color: theme.green, padding: '1px 8px', borderRadius: 999, fontWeight: 600, fontSize: 10 }}><Lock size={10} strokeWidth={2.5} />En pago</span>
        )}
      </div>

      {/* Solo métricas rellenadas · chips pill */}
      {metricasChips.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {metricasChips.map(m => (
            <span key={m.key} style={{ display: 'inline-flex', gap: 5, alignItems: 'baseline', padding: '2px 8px', borderRadius: 999, background: theme.bgAlt || `${theme.text}08`, fontSize: 10.5 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>{m.label.replace(/\s*\(.*?\)\s*/g, '').trim()}</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: theme.text }}>{m.money ? fmt$(m.v) : fmtN(m.v)}</span>
            </span>
          ))}
        </div>
      ) : t.metricas.length > 0 && (
        <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic' }}>Sin métricas capturadas</div>
      )}

      {/* Detalle evento */}
      {a.tipo === 'evento' && (a.evento_sucursal || a.evento_pop) && (
        <div style={{ background: theme.bgAlt || `${theme.text}05`, borderRadius: 6, padding: '5px 8px', fontSize: 10.5, color: theme.text, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {a.evento_sucursal && <div><strong>📍 {a.evento_sucursal}</strong></div>}
          {a.evento_pop && <div style={{ color: theme.textMuted }}>POP: {a.evento_pop}</div>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, paddingTop: 6, marginTop: 2, borderTop: `1px solid ${theme.divider || theme.border}` }}>
        {canEdit ? (
          <button className="mkv2-btn" onClick={() => onToggle(a)}
            style={{
              padding: '3px 10px', borderRadius: 999, border: 0, cursor: 'pointer',
              fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600,
              background: isCompleted ? `${theme.orange}1F` : `${theme.green}1F`,
              color: isCompleted ? theme.orange : theme.green,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
            {isCompleted
              ? <><RotateCcw size={11} strokeWidth={2.5} />Reactivar</>
              : <><Check size={11} strokeWidth={2.5} />Completar</>}
          </button>
        ) : <span />}
        {canEdit && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="mkv2-btn" onClick={() => onEdit(a)} title="Editar" style={iconBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.text}0A`; e.currentTarget.style.color = theme.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }}>
              <Pencil size={13} strokeWidth={2} />
            </button>
            <button className="mkv2-btn" onClick={() => onDelete(a.id, a.nombre)} title="Eliminar" style={iconBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.red}12`; e.currentTarget.style.color = theme.red; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }}>
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════ Modal formulario ═══════════════════════
function ActivityFormModal({ theme, bgAlt, accentSoft, accentBg, form, setForm, editId, saving, onSave, onClose, onDelete, cliente }) {
  const tipoMeta = TIPOS[form.tipo] || TIPOS.mailing;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMet = (k, v) => setForm(f => ({ ...f, metricas: { ...f.metricas, [k]: v === '' ? null : (isNaN(v) ? v : Number(v)) } }));
  const shadow = theme.mode === 'dark'
    ? '0 40px 100px rgba(0,0,0,0.60), 0 8px 26px rgba(0,0,0,0.35)'
    : '0 40px 100px rgba(0,0,0,0.30), 0 8px 26px rgba(0,0,0,0.14)';

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,12,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 30, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: theme.surface, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', boxShadow: shadow, border: `1px solid ${theme.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: theme.text }}>
        {/* Header */}
        <div style={{ padding: '14px 18px 10px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: `1px solid ${theme.divider || theme.border}` }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>Marketing · {cliente}</div>
          <h3 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, textAlign: 'center' }}>{editId ? 'Editar actividad' : 'Nueva actividad'}</h3>
          <button className="mkv2-btn" onClick={onClose}
            style={{ justifySelf: 'end', background: 'transparent', border: 0, width: 28, height: 28, borderRadius: 999, fontSize: 16, color: theme.textMuted, cursor: 'pointer' }}>×</button>
        </div>
        {/* Body */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div>
            <FieldLb theme={theme}>Tipo de actividad</FieldLb>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {Object.entries(TIPOS).map(([k, t]) => {
                const active = form.tipo === k;
                return (
                  <button key={k} className="mkv2-btn" onClick={() => set('tipo', k)}
                    style={{
                      padding: '10px 6px', borderRadius: 10,
                      border: `1px solid ${active ? t.color : theme.border}`,
                      background: active ? `${t.color}18` : theme.surface,
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}>
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, color: active ? t.color : theme.text }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: tipoMeta.redSocial ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
            <div>
              <FieldLb theme={theme}>Marca</FieldLb>
              <Segmented theme={theme} bgAlt={bgAlt}>
                {Object.entries(MARCAS).map(([k, m]) => (
                  <SegBtn key={k} theme={theme} active={form.marca === k} onClick={() => set('marca', k)} style={{ flex: 1 }}>{m.label}</SegBtn>
                ))}
              </Segmented>
            </div>
            <div>
              <FieldLb theme={theme}>Fecha</FieldLb>
              <input type="date" className="mkv2-field" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                style={fieldInStyle(theme)} />
            </div>
            {tipoMeta.redSocial && (
              <div>
                <FieldLb theme={theme}>Red social</FieldLb>
                <select className="mkv2-field" value={form.red_social} onChange={e => set('red_social', e.target.value)} style={fieldInStyle(theme)}>
                  <option value="">Selecciona…</option>
                  {Object.entries(REDES_SOCIALES).map(([k, r]) => <option key={k} value={k}>{r.icon} {r.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <FieldLb theme={theme}>Nombre / título</FieldLb>
            <input className="mkv2-field" type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Black Friday Sillas Gamer" style={fieldInStyle(theme)} />
          </div>

          <div>
            <FieldLb theme={theme}>Temática / mensaje (opcional)</FieldLb>
            <input className="mkv2-field" type="text" value={form.mensaje} onChange={e => set('mensaje', e.target.value)}
              placeholder="Qué promueve esta actividad" style={fieldInStyle(theme)} />
          </div>

          <div>
            <FieldLb theme={theme}>Inversión ($)</FieldLb>
            <input className="mkv2-field" type="number" value={form.inversion} onChange={e => set('inversion', e.target.value)}
              style={{ ...fieldInStyle(theme), fontFamily: 'SF Mono, ui-monospace, monospace' }} />
          </div>

          {/* Bloque métricas */}
          <div style={{ background: bgAlt, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, color: tipoMeta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tipoMeta.icon} Métricas {tipoMeta.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {tipoMeta.metricas.map(m => (
                <div key={m.key}>
                  <FieldLb theme={theme}>{m.label}</FieldLb>
                  <input className="mkv2-field" type="number" value={form.metricas?.[m.key] ?? ''} onChange={e => setMet(m.key, e.target.value)}
                    style={{ ...fieldInStyle(theme), fontFamily: 'SF Mono, ui-monospace, monospace' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Detalle evento */}
          {tipoMeta.evento && (
            <div style={{ background: bgAlt, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, color: TIPOS.evento.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                📍 Detalle del evento
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLb theme={theme}>Sucursal</FieldLb>
                  <input className="mkv2-field" type="text" value={form.evento_sucursal} onChange={e => set('evento_sucursal', e.target.value)}
                    placeholder="Dónde se realizó" style={fieldInStyle(theme)} />
                </div>
                <div>
                  <FieldLb theme={theme}>POP / material</FieldLb>
                  <input className="mkv2-field" type="text" value={form.evento_pop} onChange={e => set('evento_pop', e.target.value)}
                    placeholder="Lonas, muestras…" style={fieldInStyle(theme)} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <FieldLb theme={theme}>Responsable (opcional)</FieldLb>
              <input className="mkv2-field" type="text" value={form.responsable} onChange={e => set('responsable', e.target.value)}
                style={fieldInStyle(theme)} />
            </div>
            <div>
              <FieldLb theme={theme}>Notas (opcional)</FieldLb>
              <input className="mkv2-field" type="text" value={form.notas} onChange={e => set('notas', e.target.value)}
                style={fieldInStyle(theme)} />
            </div>
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${theme.divider || theme.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', background: bgAlt }}>
          {editId && onDelete && (
            <button className="mkv2-btn" onClick={onDelete}
              style={{ marginRight: 'auto', padding: '8px 18px', borderRadius: 8, border: 0, background: 'transparent', color: theme.red, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>🗑 Eliminar</button>
          )}
          <button className="mkv2-btn mkv2-btn-ghost" onClick={onClose} disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, border: 0, background: 'transparent', color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button className="mkv2-btn mkv2-btn-primary" onClick={onSave} disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, border: 0, background: theme.accent, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Guardando…' : (editId ? 'Guardar cambios' : 'Crear actividad')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLb({ theme, children }) {
  return <label style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, marginBottom: 5, display: 'block' }}>{children}</label>;
}

function fieldInStyle(theme) {
  return {
    padding: '9px 12px', border: `1px solid ${theme.border}`, borderRadius: 8,
    fontSize: 13, width: '100%', boxSizing: 'border-box',
    fontFamily: TYPO.fontText, color: theme.text, background: theme.surface,
  };
}

// ═══════════ Modal confirm ═══════════════════════
function ConfirmModal({ theme, bgAlt, leadEye, title, iconBg, icon, body, onCancel, confirmLabel, confirmColor, onConfirm }) {
  const shadow = theme.mode === 'dark'
    ? '0 40px 100px rgba(0,0,0,0.60), 0 8px 26px rgba(0,0,0,0.35)'
    : '0 40px 100px rgba(0,0,0,0.30), 0 8px 26px rgba(0,0,0,0.14)';
  return (
    <div onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,12,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 30, zIndex: 1001 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: theme.surface, borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: shadow, border: `1px solid ${theme.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: theme.text }}>
        <div style={{ padding: '14px 18px 10px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: `1px solid ${theme.divider || theme.border}` }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{leadEye}</div>
          <h3 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, textAlign: 'center' }}>{title}</h3>
          <button className="mkv2-btn" onClick={onCancel}
            style={{ justifySelf: 'end', background: 'transparent', border: 0, width: 28, height: 28, borderRadius: 999, fontSize: 16, color: theme.textMuted, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 13.5, lineHeight: 1.5, color: theme.text }}>{body}</div>
        </div>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${theme.divider || theme.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: bgAlt }}>
          <button className="mkv2-btn mkv2-btn-ghost" onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 8, border: 0, background: 'transparent', color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button className="mkv2-btn mkv2-btn-solid" onClick={onConfirm}
            style={{ padding: '8px 18px', borderRadius: 8, border: 0, background: confirmColor, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
