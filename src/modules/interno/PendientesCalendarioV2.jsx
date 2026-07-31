// PendientesCalendarioV2 · rediseño Apple V2
// ─────────────────────────────────────────────
// Rediseño de Administración Interna con estética Apple V2:
//  - Hero editorial + alerts banner + quick add
//  - Calendario Apple-style compacto con dots por tipo
//  - Sidebar con Hoy (timeline) + Equipo (interno + externo)
//  - Minutas centro de gravedad: grid 2×N con cliente pill,
//    responsables (avatars), actividades (checkbox + responsable/fecha)
//    y seguimiento con próxima acción
//  - Modal de detalle de minuta con timeline de seguimiento
//  - Sin recurrentes (feature descontinuada)
//  - Colaboradores externos: solo ven lo que les corresponde
//    (pendientes/minutas donde estén asignados como responsable)

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaGlobal } from '../../lib/permisos';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Plus, X, Search, ChevronLeft, ChevronRight, ChevronRight as ChevRight,
  AlertTriangle, Users, Calendar as CalendarIcon,
} from 'lucide-react';

// ═══════════════ Constantes ═══════════════
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIAS_SEMANA_CORTO = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const CLIENTES_MIN = {
  digitalife:   { label: 'Digitalife',    bg: 'rgba(139,92,246,.14)', bgDark: 'rgba(191,90,242,.20)', fg: '#7C3AED', fgDark: '#BF5AF2' },
  dicotech:     { label: 'Dicotech',      bg: 'rgba(14,165,233,.14)', bgDark: 'rgba(100,210,255,.20)', fg: '#0284C7', fgDark: '#64D2FF' },
  pcel:         { label: 'PCEL',          bg: 'rgba(16,185,129,.14)', bgDark: 'rgba(48,209,88,.20)', fg: '#059669', fgDark: '#30D158' },
  mercadolibre: { label: 'Mercado Libre', bg: 'rgba(245,158,11,.14)', bgDark: 'rgba(255,159,10,.20)', fg: '#D97706', fgDark: '#FF9F0A' },
  otro:         { label: 'Interno',       bg: 'rgba(107,114,128,.14)', bgDark: 'rgba(255,255,255,.10)', fg: '#4B5563', fgDark: '#A1A1A6' },
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0A84FF,#5E5CE6)', 'linear-gradient(135deg,#FF375F,#BF5AF2)',
  'linear-gradient(135deg,#30D158,#5AC8FA)', 'linear-gradient(135deg,#FF9500,#FFCC00)',
  'linear-gradient(135deg,#8B5CF6,#EC4899)', 'linear-gradient(135deg,#14B8A6,#0EA5E9)',
  'linear-gradient(135deg,#FF453A,#FF9F0A)', 'linear-gradient(135deg,#5856D6,#AF52DE)',
];

// ═══════════════ Utils ═══════════════
const toISO = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(n => parseInt(n, 10));
  return new Date(y, m - 1, d);
};
const mismaFecha = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const inicioSemana = (d) => {
  const x = new Date(d); const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x;
};
const iniciales = (nombre) => (nombre || '?').trim().split(/\s+/).map(p => p[0] || '').slice(0, 2).join('').toUpperCase() || '?';
const diasHace = (iso) => {
  const d = parseISO(iso); if (!d) return null;
  const dif = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (dif === 0) return 'hoy';
  if (dif === 1) return 'ayer';
  if (dif < 7) return `hace ${dif} días`;
  if (dif < 30) return `hace ${Math.floor(dif/7)} sem`;
  return `hace ${Math.floor(dif/30)} m`;
};
const fmtFechaCorta = (iso) => {
  const d = parseISO(iso); if (!d) return '—';
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
};
const fmtDiaSemana = (iso) => {
  const d = parseISO(iso); if (!d) return '';
  return DIAS_SEMANA_CORTO[(d.getDay() + 6) % 7];
};

// ═══════════════ Componente principal ═══════════════
export default function PendientesCalendarioV2() {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const canEdit = puedeEditarPestanaGlobal(perfil, 'admin_interna');
  const isDark = theme.mode === 'dark';
  const yoId = perfil?.user_id;

  const [loading, setLoading] = useState(true);
  const [perfiles, setPerfiles] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [minutas, setMinutas] = useState([]);
  const [mesVisible, setMesVisible] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date());
  const [busquedaMin, setBusquedaMin] = useState('');
  const [filtroMin, setFiltroMin] = useState('todas'); // todas | mias | seguimiento
  const [minutaAbierta, setMinutaAbierta] = useState(null);
  const [quickText, setQuickText] = useState('');
  const [quickFecha, setQuickFecha] = useState('mañana');
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [showTareaModal, setShowTareaModal] = useState(false);

  const esSuperAdmin = !!perfil?.es_super_admin;

  // ═══════════ Fetch ═══════════
  useEffect(() => {
    (async () => {
      if (!perfil) return;
      setLoading(true);
      try {
        // Query base
        let pendQ = supabase.from('pendientes_equipo').select('*');
        let evQ = supabase.from('eventos_equipo').select('*');

        // Filtro por usuario (bypass super_admin): creador o participante
        if (!esSuperAdmin && yoId) {
          pendQ = pendQ.or(
            `creado_por.eq.${yoId},responsable.eq.${yoId},responsables.cs.{${yoId}}`
          );
          evQ = evQ.or(`creado_por.eq.${yoId},responsable.eq.${yoId}`);
        }

        const [pR, peR, evR, minR] = await Promise.all([
          supabase.from('perfiles').select('user_id, nombre, email, rol, tipo, puesto, activo, es_super_admin').eq('activo', true),
          pendQ,
          evQ,
          supabase.from('minutas').select('*, minuta_acuerdos(*)').order('fecha_reunion', { ascending: false }),
        ]);
        setPerfiles(pR.data || []);
        setPendientes(peR.data || []);
        setEventos(evR.data || []);
        setMinutas(minR.data || []);
      } catch (e) { console.error('PendientesV2 fetch', e); }
      setLoading(false);
    })();
  }, [perfil, yoId, esSuperAdmin]);

  // ═══════════ Lookup ═══════════
  const internos = useMemo(() => perfiles.filter(p => p.tipo === 'interno' || p.es_super_admin), [perfiles]);
  const externos = useMemo(() => perfiles.filter(p => p.tipo === 'externo'), [perfiles]);

  const colorPorUserId = useMemo(() => {
    const m = {};
    const ordenados = [...perfiles].sort((a, b) => (a.user_id || '').localeCompare(b.user_id || ''));
    ordenados.forEach((p, i) => { m[p.user_id] = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]; });
    return m;
  }, [perfiles]);

  const nombrePorUserId = useMemo(() => {
    const m = {}; perfiles.forEach(p => { m[p.user_id] = p.nombre || p.email || '—'; });
    return m;
  }, [perfiles]);

  const tipoPorUserId = useMemo(() => {
    const m = {}; perfiles.forEach(p => { m[p.user_id] = p.tipo || 'interno'; });
    return m;
  }, [perfiles]);

  // ═══════════ Visibilidad por usuario ═══════════
  // Super_admin ve todo. El resto: solo lo que creó o donde participa.
  const pendientesVisibles = useMemo(() => {
    if (esSuperAdmin) return pendientes;
    if (!yoId) return [];
    return pendientes.filter(p =>
      p.creado_por === yoId ||
      p.responsable === yoId ||
      (Array.isArray(p.responsables) && p.responsables.includes(yoId))
    );
  }, [pendientes, esSuperAdmin, yoId]);
  const minutasVisibles = useMemo(() => {
    if (esSuperAdmin) return minutas;
    if (!yoId) return [];
    return minutas.filter(m => {
      if (m.creado_por === yoId) return true;
      const asis = Array.isArray(m.asistentes) ? m.asistentes : [];
      if (asis.some(a => a && (a.user_id === yoId || a === yoId))) return true;
      const acuerdos = Array.isArray(m.minuta_acuerdos) ? m.minuta_acuerdos : [];
      return acuerdos.some(a => a.responsable === yoId);
    });
  }, [minutas, esSuperAdmin, yoId]);
  const eventosVisibles = useMemo(() => {
    if (esSuperAdmin) return eventos;
    if (!yoId) return [];
    return eventos.filter(e => e.creado_por === yoId || e.responsable === yoId);
  }, [eventos, esSuperAdmin, yoId]);
  const esExterno = perfil?.tipo === 'externo';

  // ═══════════ Métricas ═══════════
  const hoyISO = toISO(new Date());
  const hoyDate = parseISO(hoyISO);
  const metricas = useMemo(() => {
    const vencidas = pendientesVisibles.filter(p =>
      p.fecha_limite && p.fecha_limite < hoyISO && p.estatus !== 'listo'
    );
    const estancadas = pendientesVisibles.filter(p => {
      if (p.estatus === 'listo') return false;
      const ref = p.updated_at || p.created_at;
      if (!ref) return false;
      const dias = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));
      return dias >= 7;
    });
    const activas = pendientesVisibles.filter(p => p.estatus !== 'listo').length;
    return { vencidas, estancadas, activas };
  }, [pendientesVisibles, hoyISO]);

  // ═══════════ Calendario ═══════════
  const diasDelMes = useMemo(() => {
    const y = mesVisible.getFullYear(), m = mesVisible.getMonth();
    const primeroMes = new Date(y, m, 1);
    const inicioGrid = inicioSemana(primeroMes);
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicioGrid);
      d.setDate(inicioGrid.getDate() + i);
      const iso = toISO(d);
      const esOtroMes = d.getMonth() !== m;
      const esHoy = mismaFecha(d, hoyDate);
      const esSel = mismaFecha(d, diaSeleccionado);
      // Dots: task, evento, vac, venc
      const dots = { task: 0, evento: 0, vac: 0, venc: 0 };
      pendientesVisibles.forEach(p => {
        if (p.fecha_limite !== iso) return;
        if (p.estatus === 'listo') return;
        if (p.fecha_limite < hoyISO) dots.venc++;
        else dots.task++;
      });
      eventosVisibles.forEach(e => {
        const ini = e.fecha_ini || e.fecha;
        const fin = e.fecha_fin || e.fecha_ini || e.fecha;
        if (!ini) return;
        if (iso >= ini && iso <= fin) {
          if (e.tipo === 'vacaciones' || e.tipo === 'permiso' || e.tipo === 'salida_trabajo') dots.vac++;
          else dots.evento++;
        }
      });
      dias.push({ d, iso, esOtroMes, esHoy, esSel, dots });
    }
    return dias;
  }, [mesVisible, pendientesVisibles, eventosVisibles, hoyISO, diaSeleccionado, hoyDate]);

  const eventosDelDia = useMemo(() => {
    const iso = toISO(diaSeleccionado);
    const arr = [];
    eventosVisibles.forEach(e => {
      const ini = e.fecha_ini || e.fecha;
      const fin = e.fecha_fin || e.fecha_ini || e.fecha;
      if (ini && iso >= ini && iso <= fin) arr.push({ tipo: 'evento', ev: e });
    });
    pendientesVisibles.forEach(p => {
      if (p.fecha_limite === iso && p.estatus !== 'listo') arr.push({ tipo: 'tarea', ev: p });
    });
    return arr.sort((a, b) => {
      const ta = a.ev.hora_ini || a.ev.hora || '99:99';
      const tb = b.ev.hora_ini || b.ev.hora || '99:99';
      return ta.localeCompare(tb);
    });
  }, [diaSeleccionado, eventosVisibles, pendientesVisibles]);

  // ═══════════ Carga por persona ═══════════
  const cargaPorPersona = useMemo(() => {
    const m = new Map();
    perfiles.forEach(p => {
      m.set(p.user_id, {
        perfil: p,
        activas: 0,
        vencidas: 0,
      });
    });
    pendientesVisibles.forEach(p => {
      if (!p.responsable) return;
      const it = m.get(p.responsable);
      if (!it) return;
      if (p.estatus !== 'listo') it.activas++;
      if (p.fecha_limite && p.fecha_limite < hoyISO && p.estatus !== 'listo') it.vencidas++;
    });
    return Array.from(m.values()).filter(x => x.activas > 0 || x.vencidas > 0).sort((a, b) => b.activas - a.activas);
  }, [pendientesVisibles, perfiles, hoyISO]);

  // ═══════════ Minutas filtradas ═══════════
  const minutasFiltradas = useMemo(() => {
    const q = busquedaMin.trim().toLowerCase();
    return minutasVisibles.filter(m => {
      if (filtroMin === 'mias') {
        const acuerdos = Array.isArray(m.minuta_acuerdos) ? m.minuta_acuerdos : [];
        if (!acuerdos.some(a => a.responsable === yoId)) return false;
      }
      if (filtroMin === 'seguimiento') {
        const acuerdos = Array.isArray(m.minuta_acuerdos) ? m.minuta_acuerdos : [];
        if (!acuerdos.some(a => a.estado !== 'listo')) return false;
      }
      if (q) {
        const hay = `${m.titulo || ''} ${m.contenido || ''} ${m.cliente || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [minutasVisibles, busquedaMin, filtroMin, yoId]);

  // ═══════════ Narrativa hero ═══════════
  const narrativa = useMemo(() => {
    if (esExterno) {
      return {
        eye: `${perfil?.nombre || 'Colaborador'} · ${MESES_LARGO[hoyDate.getMonth()]} ${hoyDate.getFullYear()}`,
        h: metricas.activas === 0 ? 'Sin tareas asignadas' : `${metricas.activas} tarea${metricas.activas === 1 ? '' : 's'} asignada${metricas.activas === 1 ? '' : 's'}`,
        p: metricas.vencidas.length > 0 ? `${metricas.vencidas.length} vencida${metricas.vencidas.length === 1 ? '' : 's'} · atención` : 'Al día · buen trabajo',
      };
    }
    const partes = [];
    if (metricas.vencidas.length > 0) partes.push(`${metricas.vencidas.length} pendientes vencidos`);
    partes.push(`${minutasFiltradas.length} minutas activas`);
    const topCarga = cargaPorPersona[0];
    const secundaria = topCarga
      ? `${topCarga.perfil.nombre?.split(' ')[0] || '—'} tiene ${topCarga.activas} tareas${topCarga.vencidas > 0 ? ` · ${topCarga.vencidas} vencidas` : ''}`
      : 'Equipo al día';
    return {
      eye: `Administración Interna · ${MESES_LARGO[hoyDate.getMonth()]} ${hoyDate.getFullYear()}`,
      h: partes.join(' · '),
      p: secundaria,
    };
  }, [esExterno, perfil, hoyDate, metricas, minutasFiltradas.length, cargaPorPersona]);

  // ═══════════ Quick add task ═══════════
  async function handleQuickAdd() {
    const txt = quickText.trim();
    if (!txt || !canEdit) return;
    let fecha_limite = null;
    const hoyD = new Date();
    if (quickFecha === 'hoy') fecha_limite = toISO(hoyD);
    else if (quickFecha === 'mañana') { const d = new Date(hoyD); d.setDate(d.getDate() + 1); fecha_limite = toISO(d); }
    else if (quickFecha === 'semana') { const d = new Date(hoyD); d.setDate(d.getDate() + 7); fecha_limite = toISO(d); }
    const payload = {
      tarea: txt,
      responsable: yoId,
      creado_por: yoId,
      fecha_limite,
      estatus: 'pendiente',
      prioridad: 'media',
      cuenta: 'otro',
    };
    const { data, error } = await supabase.from('pendientes_equipo').insert(payload).select().single();
    if (error) { console.error('quickAdd', error); return; }
    if (data) {
      setPendientes(prev => [...prev, data]);
      setQuickText('');
    }
  }

  async function handleCrearTarea(payload) {
    const insertPayload = {
      tarea: payload.tarea,
      cuenta: payload.cuenta || 'otro',
      fecha_limite: payload.fecha_limite || null,
      prioridad: payload.prioridad || 'media',
      estatus: 'pendiente',
      responsable: payload.responsable || yoId,
      creado_por: yoId,
      notas: payload.notas || null,
    };
    const { data, error } = await supabase.from('pendientes_equipo').insert(insertPayload).select().single();
    if (error) { console.error('crearTarea', error); alert('No se pudo guardar la tarea: ' + error.message); return false; }
    if (data) {
      setPendientes(prev => [...prev, data]);
      setShowTareaModal(false);
    }
    return true;
  }

  async function handleCrearEvento(payload) {
    const insertPayload = {
      titulo: payload.titulo,
      tipo: payload.tipo || 'reunion',
      fecha_ini: payload.fecha_ini,
      fecha_fin: payload.fecha_fin || payload.fecha_ini,
      responsable: payload.responsable || yoId,
      creado_por: yoId,
      notas: payload.notas || null,
    };
    const { data, error } = await supabase.from('eventos_equipo').insert(insertPayload).select().single();
    if (error) { console.error('crearEvento', error); alert('No se pudo guardar el evento: ' + error.message); return false; }
    if (data) {
      setEventos(prev => [...prev, data]);
      setShowEventoModal(false);
    }
    return true;
  }

  // ═══════════ Estilos base ═══════════
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#000000');

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        Cargando pendientes y calendario…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ═════ Hero editorial ═════ */}
      <div style={{
        background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px',
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, alignItems: 'center',
      }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.teal || '#5AC8FA' }} />
            {narrativa.eye}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>{narrativa.h}</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 520, lineHeight: 1.4, margin: 0 }}>{narrativa.p}</p>
        </div>
        {canEdit && (
          <>
            <button onClick={() => setShowEventoModal(true)} style={{ padding: '7px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)', color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Evento</button>
            <button onClick={() => setShowTareaModal(true)} style={{ padding: '7px 14px', borderRadius: 999, background: theme.accent, border: 0, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Nueva tarea</button>
          </>
        )}
      </div>

      {/* ═════ Alerts banner ═════ */}
      {(metricas.vencidas.length > 0 || metricas.estancadas.length > 0) && (
        <div style={{
          background: `linear-gradient(90deg, ${theme.red}18 0%, ${theme.orange}18 100%)`,
          border: `1px solid ${theme.red}33`,
          borderRadius: 10, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: `${theme.red}28`, color: theme.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={12} />
          </div>
          <span style={{ fontSize: 11.5, color: theme.text, fontWeight: 500 }}>
            {metricas.vencidas.length > 0 && <><strong style={{ color: theme.red }}>{metricas.vencidas.length} vencidas</strong> · </>}
            {metricas.estancadas.length > 0 && <><strong style={{ color: theme.orange }}>{metricas.estancadas.length} sin avance +7 días</strong></>}
          </span>
        </div>
      )}

      {/* ═════ Quick add task ═════ */}
      {canEdit && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999,
          padding: '6px 14px 6px 6px',
        }}>
          <button onClick={handleQuickAdd}
            style={{ width: 26, height: 26, borderRadius: 999, background: theme.accent, color: '#FFF', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Agregar tarea">
            <Plus size={14} strokeWidth={2.5} />
          </button>
          <input
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
            placeholder="Agregar tarea rápida… (Enter para guardar)"
            style={{ border: 0, outline: 0, background: 'transparent', flex: 1, fontFamily: TYPO.fontText, fontSize: 12, color: theme.text }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {[['hoy','Hoy'], ['mañana','Mañana'], ['semana','Semana']].map(([k, l]) => (
              <button key={k} onClick={() => setQuickFecha(k)}
                style={{
                  padding: '3px 10px', borderRadius: 999,
                  border: `1px solid ${quickFecha === k ? theme.accent : theme.border}`,
                  background: quickFecha === k ? `${theme.accent}18` : 'transparent',
                  color: quickFecha === k ? theme.accent : theme.textMuted,
                  fontFamily: quickFecha === k ? TYPO.fontDisplay : TYPO.fontText,
                  fontSize: 10.5, fontWeight: quickFecha === k ? 600 : 500, cursor: 'pointer',
                }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {/* ═════ Grid principal: Calendario + Sidebar ═════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 8 }}>
        <CalendarioApple
          theme={theme}
          isDark={isDark}
          mesVisible={mesVisible}
          setMesVisible={setMesVisible}
          dias={diasDelMes}
          onSelectDia={(d) => setDiaSeleccionado(d)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SidebarDia theme={theme} isDark={isDark} date={diaSeleccionado} eventos={eventosDelDia} nombrePorUserId={nombrePorUserId} hoyISO={hoyISO} />
          <SidebarEquipo theme={theme} isDark={isDark} internos={internos} externos={externos} carga={cargaPorPersona} colorPorUserId={colorPorUserId} canEdit={canEdit} />
        </div>
      </div>

      {/* ═════ Minutas ═════ */}
      <MinutasSeccion
        theme={theme}
        isDark={isDark}
        minutas={minutasFiltradas}
        totalMinutas={minutasVisibles.length}
        busqueda={busquedaMin}
        setBusqueda={setBusquedaMin}
        filtro={filtroMin}
        setFiltro={setFiltroMin}
        onAbrir={setMinutaAbierta}
        canEdit={canEdit}
        nombrePorUserId={nombrePorUserId}
        colorPorUserId={colorPorUserId}
        tipoPorUserId={tipoPorUserId}
        yoId={yoId}
      />

      {/* ═════ Modal Evento ═════ */}
      {showEventoModal && (
        <EventoModal
          theme={theme}
          isDark={isDark}
          internos={internos}
          yoId={yoId}
          onClose={() => setShowEventoModal(false)}
          onSave={handleCrearEvento}
        />
      )}

      {/* ═════ Modal Tarea ═════ */}
      {showTareaModal && (
        <TareaModal
          theme={theme}
          isDark={isDark}
          internos={internos}
          yoId={yoId}
          onClose={() => setShowTareaModal(false)}
          onSave={handleCrearTarea}
        />
      )}

      {/* ═════ Modal minuta ═════ */}
      {minutaAbierta && (
        <MinutaModal
          theme={theme}
          isDark={isDark}
          minuta={minutaAbierta}
          nombrePorUserId={nombrePorUserId}
          colorPorUserId={colorPorUserId}
          tipoPorUserId={tipoPorUserId}
          onClose={() => setMinutaAbierta(null)}
          canEdit={canEdit}
          onUpdateAcuerdo={async (id, estado) => {
            await supabase.from('minuta_acuerdos').update({ estado }).eq('id', id);
            setMinutas(prev => prev.map(m => ({
              ...m,
              minuta_acuerdos: (m.minuta_acuerdos || []).map(a => a.id === id ? { ...a, estado } : a),
            })));
            setMinutaAbierta(prev => prev ? ({
              ...prev,
              minuta_acuerdos: (prev.minuta_acuerdos || []).map(a => a.id === id ? { ...a, estado } : a),
            }) : prev);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════ Calendario Apple ═══════════════
function CalendarioApple({ theme, isDark, mesVisible, setMesVisible, dias, onSelectDia }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.divider || theme.border}` }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, cursor: 'pointer', color: theme.textMuted }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => { setMesVisible(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); onSelectDia(new Date()); }}
            style={{ padding: '0 12px', height: 28, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.accent, cursor: 'pointer' }}>Hoy</button>
          <button onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, cursor: 'pointer', color: theme.textMuted }}>
            <ChevronRight size={14} />
          </button>
        </div>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em', color: theme.text }}>
          {MESES_LARGO[mesVisible.getMonth()]}<span style={{ color: theme.textMuted, fontWeight: 500, marginLeft: 6 }}>{mesVisible.getFullYear()}</span>
        </span>
        <div style={{ width: 64 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {DIAS_SEMANA_CORTO.map((d, i) => (
          <div key={d} style={{
            padding: '8px 4px', fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase',
            letterSpacing: '0.09em', fontWeight: 700, textAlign: 'center',
            color: i >= 5 ? theme.red : theme.textMuted,
          }}>{d}</div>
        ))}
        {dias.map((day, idx) => (
          <div key={idx}
            onClick={() => onSelectDia(day.d)}
            style={{
              padding: '5px 4px 6px', minHeight: 56,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              cursor: 'pointer',
              background: day.esSel ? (isDark ? 'rgba(10,132,255,0.12)' : 'rgba(0,122,255,0.08)') : 'transparent',
              transition: 'background 160ms',
            }}
            onMouseEnter={(e) => { if (!day.esSel) e.currentTarget.style.background = `${theme.text}05`; }}
            onMouseLeave={(e) => { if (!day.esSel) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{
              fontFamily: TYPO.fontDisplay, fontSize: 13,
              fontWeight: day.esHoy || day.esSel ? 700 : 500,
              color: day.esOtroMes ? theme.textSubtle : (day.esSel ? theme.accent : theme.text),
              opacity: day.esOtroMes ? 0.55 : 1,
              lineHeight: 1,
              background: day.esHoy ? theme.accent : 'transparent',
              borderRadius: 999,
              width: day.esHoy ? 26 : 'auto', height: day.esHoy ? 26 : 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color2: day.esHoy ? '#FFF' : undefined,
              ...(day.esHoy ? { color: '#FFF' } : {}),
            }}>{day.d.getDate()}</span>
            <div style={{ display: 'flex', gap: 2, minHeight: 6 }}>
              {day.dots.task > 0 && <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.accent }} />}
              {day.dots.evento > 0 && <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.green }} />}
              {day.dots.vac > 0 && <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.orange }} />}
              {day.dots.venc > 0 && <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.red }} />}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        padding: '8px 14px', borderTop: `1px solid ${theme.divider || theme.border}`,
        display: 'flex', gap: 12, fontSize: 9.5, color: theme.textMuted,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: theme.accent }} />Tarea</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: theme.green }} />Evento</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: theme.orange }} />Vacación</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: theme.red }} />Vencida</span>
      </div>
    </div>
  );
}

// ═══════════════ Sidebar día ═══════════════
function SidebarDia({ theme, isDark, date, eventos, nombrePorUserId, hoyISO }) {
  const iso = toISO(date);
  const esHoy = iso === hoyISO;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${theme.divider || theme.border}` }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text }}>
          {DIAS_SEMANA_CORTO[(date.getDay() + 6) % 7] === 'Sáb' || DIAS_SEMANA_CORTO[(date.getDay() + 6) % 7] === 'Dom' ? DIAS_SEMANA_CORTO[(date.getDay() + 6) % 7] : ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][(date.getDay() + 6) % 7]} {date.getDate()} · {MESES_LARGO[date.getMonth()]}
        </div>
        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>
          {esHoy ? 'Hoy · ' : ''}{eventos.length === 0 ? 'Sin actividades' : `${eventos.length} actividades`}
        </div>
      </div>
      <div style={{ padding: '8px 4px 12px' }}>
        {eventos.length === 0 && (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 11, fontStyle: 'italic' }}>
            No hay tareas ni eventos para este día
          </div>
        )}
        {eventos.slice(0, 6).map((item, i) => {
          const isTask = item.tipo === 'tarea';
          const esVenc = isTask && item.ev.fecha_limite < hoyISO;
          const color = esVenc ? theme.red : (isTask ? theme.accent : theme.green);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 8, padding: '4px 10px' }}>
              <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted, paddingTop: 5 }}>
                {item.ev.hora_ini || item.ev.hora || '—'}
              </div>
              <div style={{
                background: isDark ? `${color}10` : `${color}08`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 6, padding: '6px 10px',
              }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text }}>
                  {esVenc && '⚠ '}{item.ev.titulo || (isTask ? 'Tarea' : 'Evento')}
                </div>
                <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
                  {nombrePorUserId[item.ev.responsable]?.split(' ')[0] || '—'}
                  {isTask && item.ev.prioridad && ` · ${item.ev.prioridad === 'alta' ? 'Alta' : item.ev.prioridad === 'media' ? 'Media' : 'Baja'}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════ Sidebar equipo ═══════════════
function SidebarEquipo({ theme, isDark, internos, externos, carga, colorPorUserId, canEdit }) {
  const cargaMap = useMemo(() => {
    const m = new Map();
    carga.forEach(c => m.set(c.perfil.user_id, c));
    return m;
  }, [carga]);
  const todos = [...internos, ...externos];
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>👥 Equipo · esta semana</span>
      </div>
      {todos.map((p) => {
        const c = cargaMap.get(p.user_id) || { activas: 0, vencidas: 0 };
        const esExt = p.tipo === 'externo';
        const total = c.activas + c.vencidas;
        const pct = Math.min(100, total * 12); // heurística visual
        const barColor = c.vencidas > 0 ? theme.red : (pct >= 80 ? theme.orange : theme.accent);
        return (
          <div key={p.user_id} style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto auto', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: `1px dashed ${theme.divider || theme.border}` }}>
            <span style={{
              width: 26, height: 26, borderRadius: 999,
              background: colorPorUserId[p.user_id] || 'linear-gradient(135deg,#8E8E93,#6E6E73)',
              color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, position: 'relative',
            }}>
              {iniciales(p.nombre)}
              {esExt && (
                <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: 999, background: theme.teal, border: `1.5px solid ${theme.surface}` }} />
              )}
            </span>
            <div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {p.nombre || p.email}
                {esExt && (
                  <span style={{
                    fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em',
                    padding: '1px 5px', borderRadius: 4,
                    background: isDark ? 'rgba(100,210,255,.20)' : 'rgba(90,200,250,.16)',
                    color: isDark ? '#64D2FF' : '#00647A',
                  }}>EXT</span>
                )}
              </div>
              <div style={{ fontSize: 9.5, color: theme.textMuted }}>
                {esExt ? 'Externo' : 'Interno'}
                {total > 0 && ` · ${c.activas} tareas${c.vencidas > 0 ? ` · ${c.vencidas} vencidas` : ''}`}
              </div>
            </div>
            <div style={{ width: 60 }}>
              <div style={{ height: 5, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999 }} />
              </div>
            </div>
            <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: c.vencidas > 0 ? theme.red : theme.textMuted, textAlign: 'right' }}>{pct}%</span>
          </div>
        );
      })}
      {canEdit && (
        <button style={{
          padding: '5px 10px', marginTop: 8, border: `1px dashed ${theme.border}`, borderRadius: 8, background: 'transparent',
          textAlign: 'center', width: '100%', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.accent, cursor: 'pointer',
        }}>+ Invitar colaborador externo</button>
      )}
    </div>
  );
}

// ═══════════════ Minutas sección ═══════════════
function MinutasSeccion({ theme, isDark, minutas, totalMinutas, busqueda, setBusqueda, filtro, setFiltro, onAbrir, canEdit, nombrePorUserId, colorPorUserId, tipoPorUserId, yoId }) {
  const activas = minutas.filter(m => {
    const acs = Array.isArray(m.minuta_acuerdos) ? m.minuta_acuerdos : [];
    return acs.some(a => a.estado !== 'listo');
  }).length;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text }}>Minutas · seguimiento activo</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, color: theme.textMuted, padding: '2px 8px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 999 }}>
            {activas} activas · {totalMinutas} total
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 999, height: 28, fontSize: 11, color: theme.textMuted, flex: 1, maxWidth: 240 }}>
            <Search size={12} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar minuta, cliente…"
              style={{ border: 0, outline: 0, background: 'transparent', flex: 1, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text }} />
          </div>
          <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
            {[['todas','Todas'], ['mias','Mías'], ['seguimiento','Seguimiento']].map(([k, l]) => (
              <button key={k} onClick={() => setFiltro(k)} style={{
                padding: '4px 10px', border: 0, background: filtro === k ? theme.surface : 'transparent',
                borderRadius: 6, fontFamily: filtro === k ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 10.5, fontWeight: filtro === k ? 600 : 500, color: filtro === k ? theme.text : theme.textMuted,
                boxShadow: filtro === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
          {canEdit && (
            <button style={{ padding: '5px 12px', borderRadius: 999, border: 0, background: theme.accent, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Nueva minuta</button>
          )}
        </div>
      </div>
      {minutas.length === 0 ? (
        <div style={{ background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 12, fontStyle: 'italic' }}>
          Sin minutas para los filtros seleccionados
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {minutas.slice(0, 8).map((m) => (
            <MinutaCard key={m.id} theme={theme} isDark={isDark} minuta={m} onClick={() => onAbrir(m)} nombrePorUserId={nombrePorUserId} colorPorUserId={colorPorUserId} tipoPorUserId={tipoPorUserId} yoId={yoId} />
          ))}
        </div>
      )}
    </div>
  );
}

function MinutaCard({ theme, isDark, minuta, onClick, nombrePorUserId, colorPorUserId, tipoPorUserId, yoId }) {
  const acs = Array.isArray(minuta.minuta_acuerdos) ? minuta.minuta_acuerdos : [];
  const responsables = Array.from(new Set(acs.map(a => a.responsable).filter(Boolean)));
  const proxima = acs.find(a => a.estado !== 'listo' && a.fecha_limite);
  const clienteMeta = CLIENTES_MIN[minuta.cliente || 'otro'] || CLIENTES_MIN.otro;
  return (
    <div onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
        transition: 'transform 240ms cubic-bezier(.4,0,.2,1), box-shadow 240ms cubic-bezier(.4,0,.2,1)',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: '-0.015em', color: theme.text, lineHeight: 1.2 }}>
            {minuta.titulo || '(Sin título)'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10.5, color: theme.textMuted, marginTop: 3 }}>
            <span>{fmtFechaCorta(minuta.fecha_reunion)} · {diasHace(minuta.fecha_reunion) || '—'}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 999,
              fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em',
              background: isDark ? clienteMeta.bgDark : clienteMeta.bg,
              color: isDark ? clienteMeta.fgDark : clienteMeta.fg,
            }}>{clienteMeta.label}</span>
          </div>
        </div>
      </div>
      {minuta.contenido && (
        <div style={{
          fontSize: 11.5, color: theme.textMuted, lineHeight: 1.5,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{minuta.contenido}</div>
      )}
      {acs.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '8px 0', borderTop: `1px dashed ${theme.divider || theme.border}`, borderBottom: `1px dashed ${theme.divider || theme.border}`,
        }}>
          {[...acs].sort((a, b) => (a.orden || 0) - (b.orden || 0)).slice(0, 4).map((a) => {
            const done = a.estado === 'listo';
            return (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 6, alignItems: 'center', fontSize: 11 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4,
                  border: `1.5px solid ${done ? theme.accent : (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)')}`,
                  background: done ? theme.accent : 'transparent',
                  color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                }}>{done ? '✓' : ''}</span>
                <span style={{ color: theme.text, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.55 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.texto || a.contenido || '(sin descripción)'}
                </span>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted }}>
                  {nombrePorUserId[a.responsable]?.split(' ')[0]?.substring(0, 3).toUpperCase() || '—'}{a.fecha_limite ? ` · ${fmtFechaCorta(a.fecha_limite).replace(' ', '')}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex' }}>
          {responsables.slice(0, 4).map((rid, i) => (
            <span key={rid} title={nombrePorUserId[rid] || '—'} style={{
              width: 22, height: 22, borderRadius: 999,
              background: colorPorUserId[rid] || 'linear-gradient(135deg,#8E8E93,#6E6E73)',
              color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700,
              marginLeft: i === 0 ? 0 : -4, border: `2px solid ${theme.surface}`,
              position: 'relative',
            }}>
              {iniciales(nombrePorUserId[rid])}
              {tipoPorUserId[rid] === 'externo' && (
                <span style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: 999, background: theme.teal, border: `1px solid ${theme.surface}` }} />
              )}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 9.5, color: theme.textMuted, textAlign: 'right' }}>
          {proxima ? (
            <span style={{ color: theme.accent, fontWeight: 600, fontFamily: TYPO.fontDisplay }}>
              → {nombrePorUserId[proxima.responsable]?.split(' ')[0] || '—'} {fmtFechaCorta(proxima.fecha_limite)}
            </span>
          ) : '✓ sin pendientes'}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ Modal minuta ═══════════════
function MinutaModal({ theme, isDark, minuta, nombrePorUserId, colorPorUserId, tipoPorUserId, onClose, canEdit, onUpdateAcuerdo }) {
  const acs = Array.isArray(minuta.minuta_acuerdos) ? minuta.minuta_acuerdos : [];
  const responsables = Array.from(new Set(acs.map(a => a.responsable).filter(Boolean)));
  const clienteMeta = CLIENTES_MIN[minuta.cliente || 'otro'] || CLIENTES_MIN.otro;
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#000000');
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60,
      }}>
      <div style={{
        background: theme.surface, borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.32)', maxWidth: 720, width: '100%', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Hero */}
        <div style={{ background: heroBg, color: '#FFF', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
              Minuta · {clienteMeta.label} · {fmtFechaCorta(minuta.fecha_reunion)}
            </span>
            <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 700, margin: '4px 0 4px', letterSpacing: '-0.02em', color: '#FFF' }}>
              {minuta.titulo || '(Sin título)'}
            </h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              {responsables.slice(0, 5).map((rid) => (
                <span key={rid} style={{
                  width: 20, height: 20, borderRadius: 999,
                  background: colorPorUserId[rid] || '#8E8E93',
                  color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, border: '2px solid #000',
                  marginRight: -6,
                }}>{iniciales(nombrePorUserId[rid])}</span>
              ))}
              <span style={{ marginLeft: 10 }}>{responsables.map(rid => (nombrePorUserId[rid] || '—').split(' ')[0]).join(', ')}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.14)', border: 0, color: '#FFF',
            width: 28, height: 28, borderRadius: 999, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '16px 20px 18px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {minuta.contenido && (
            <div style={{
              gridColumn: '1 / -1',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderRadius: 8, padding: '10px 12px',
              fontSize: 11.5, color: theme.text, lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>{minuta.contenido}</div>
          )}
          {acs.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>Actividades derivadas</div>
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                {[...acs].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((a) => {
                  const done = a.estado === 'listo';
                  return (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 8, alignItems: 'center' }}>
                      <span
                        onClick={() => canEdit && onUpdateAcuerdo(a.id, done ? 'pendiente' : 'listo')}
                        style={{
                          width: 14, height: 14, borderRadius: 4,
                          border: `1.5px solid ${done ? theme.accent : (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)')}`,
                          background: done ? theme.accent : 'transparent',
                          color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                          cursor: canEdit ? 'pointer' : 'default',
                        }}>{done ? '✓' : ''}</span>
                      <span style={{ fontSize: 11.5, color: theme.text, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.55 : 1 }}>
                        {a.texto || a.contenido || '(sin descripción)'}
                      </span>
                      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted }}>
                        {nombrePorUserId[a.responsable]?.split(' ')[0] || '—'}{a.fecha_limite ? ` · ${fmtFechaCorta(a.fecha_limite)}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Seguimiento timeline */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>Seguimiento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SegItem theme={theme} isDark={isDark} color={theme.green} txt="Minuta creada" sub={`${fmtFechaCorta(minuta.fecha_reunion)}${minuta.autor ? ' · ' + (nombrePorUserId[minuta.autor] || '—') : ''}`} />
              {acs.filter(a => a.estado === 'listo').slice(0, 3).map(a => (
                <SegItem key={a.id} theme={theme} isDark={isDark} color={theme.green} txt={`Actividad completada · ${a.texto || a.contenido || '—'}`} sub={nombrePorUserId[a.responsable] || '—'} />
              ))}
              {acs.filter(a => a.estado !== 'listo' && a.fecha_limite).slice(0, 2).map(a => (
                <SegItem key={a.id} theme={theme} isDark={isDark} color={theme.orange} txt={`Próxima acción · ${a.texto || a.contenido || '—'}`} sub={`${nombrePorUserId[a.responsable] || '—'} · ${fmtFechaCorta(a.fecha_limite)}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ Modal Evento ═══════════════
function EventoModal({ theme, isDark, internos, yoId, onClose, onSave }) {
  const hoyISO = toISO(new Date());
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('reunion');
  const [fechaIni, setFechaIni] = useState(hoyISO);
  const [fechaFin, setFechaFin] = useState(hoyISO);
  const [responsable, setResponsable] = useState(yoId || '');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    if (!titulo.trim() || !fechaIni) return;
    setSaving(true);
    await onSave({ titulo: titulo.trim(), tipo, fecha_ini: fechaIni, fecha_fin: fechaFin || fechaIni, responsable, notas });
    setSaving(false);
  }
  return (
    <ModalShell theme={theme} isDark={isDark} title="Nuevo evento" subtitle="Reunión, vacaciones, home office o salida" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="Título" theme={theme}>
          <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Junta con proveedor"
            style={inputStyle(theme)} />
        </Field>
        <Field label="Tipo" theme={theme}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle(theme)}>
            <option value="reunion">Reunión</option>
            <option value="salida_trabajo">Salida de trabajo</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="permiso">Permiso</option>
            <option value="home_office">Home office</option>
            <option value="feriado">Feriado</option>
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Desde" theme={theme}>
            <input type="date" value={fechaIni} onChange={(e) => { setFechaIni(e.target.value); if (!fechaFin || fechaFin < e.target.value) setFechaFin(e.target.value); }} style={inputStyle(theme)} />
          </Field>
          <Field label="Hasta" theme={theme}>
            <input type="date" value={fechaFin} min={fechaIni} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle(theme)} />
          </Field>
        </div>
        <Field label="Responsable" theme={theme}>
          <select value={responsable || ''} onChange={(e) => setResponsable(e.target.value)} style={inputStyle(theme)}>
            <option value="">Sin asignar</option>
            {internos.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
            ))}
          </select>
        </Field>
        <Field label="Notas" theme={theme}>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
            style={{ ...inputStyle(theme), resize: 'vertical', fontFamily: TYPO.fontText }} />
        </Field>
        <ModalActions theme={theme} onClose={onClose} saving={saving} disabled={!titulo.trim() || !fechaIni} />
      </form>
    </ModalShell>
  );
}

// ═══════════════ Modal Tarea ═══════════════
function TareaModal({ theme, isDark, internos, yoId, onClose, onSave }) {
  const [tarea, setTarea] = useState('');
  const [cuenta, setCuenta] = useState('otro');
  const [prioridad, setPrioridad] = useState('media');
  const [fechaLimite, setFechaLimite] = useState('');
  const [responsable, setResponsable] = useState(yoId || '');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    if (!tarea.trim()) return;
    setSaving(true);
    await onSave({ tarea: tarea.trim(), cuenta, prioridad, fecha_limite: fechaLimite || null, responsable, notas });
    setSaving(false);
  }
  return (
    <ModalShell theme={theme} isDark={isDark} title="Nueva tarea" subtitle="Asignar pendiente al equipo" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="Tarea" theme={theme}>
          <input autoFocus value={tarea} onChange={(e) => setTarea(e.target.value)} placeholder="¿Qué hay que hacer?"
            style={inputStyle(theme)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Cliente" theme={theme}>
            <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} style={inputStyle(theme)}>
              <option value="otro">Interno / Otro</option>
              <option value="digitalife">Digitalife</option>
              <option value="pcel">PCEL</option>
              <option value="mercadolibre">Mercado Libre</option>
            </select>
          </Field>
          <Field label="Prioridad" theme={theme}>
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} style={inputStyle(theme)}>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Fecha límite" theme={theme}>
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} style={inputStyle(theme)} />
          </Field>
          <Field label="Responsable" theme={theme}>
            <select value={responsable || ''} onChange={(e) => setResponsable(e.target.value)} style={inputStyle(theme)}>
              <option value="">Sin asignar</option>
              {internos.map(p => (
                <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notas" theme={theme}>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
            style={{ ...inputStyle(theme), resize: 'vertical', fontFamily: TYPO.fontText }} />
        </Field>
        <ModalActions theme={theme} onClose={onClose} saving={saving} disabled={!tarea.trim()} />
      </form>
    </ModalShell>
  );
}

// ═══════════════ Helpers Modal ═══════════════
function ModalShell({ theme, isDark, title, subtitle, onClose, children }) {
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#000000');
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 70,
      }}>
      <div style={{ background: theme.surface, borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.32)', maxWidth: 520, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: heroBg, color: '#FFF', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#FFF' }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.14)', border: 0, color: '#FFF', width: 28, height: 28, borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '16px 20px 18px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, theme, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
function inputStyle(theme) {
  return {
    border: `1px solid ${theme.border}`, background: theme.bg || 'transparent',
    color: theme.text, padding: '8px 10px', borderRadius: 8, fontSize: 12,
    fontFamily: TYPO.fontText, outline: 'none', width: '100%',
  };
}
function ModalActions({ theme, onClose, saving, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
      <button type="button" onClick={onClose} style={{ padding: '7px 14px', borderRadius: 999, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
      <button type="submit" disabled={disabled || saving} style={{ padding: '7px 16px', borderRadius: 999, background: disabled ? theme.border : theme.accent, border: 0, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}

function SegItem({ theme, isDark, color, txt, sub }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8, alignItems: 'center',
      padding: '6px 10px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 8, fontSize: 11,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, margin: 'auto' }} />
      <span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text }}>{txt}</span>
        <span style={{ fontSize: 10, color: theme.textMuted, fontWeight: 500, marginLeft: 8 }}>{sub}</span>
      </span>
    </div>
  );
}
