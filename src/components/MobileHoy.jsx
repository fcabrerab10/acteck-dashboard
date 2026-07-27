// MobileHoy — Pendientes + Calendario consolidados para mobile.
// Reemplaza PendientesCalendarioV2 cuando mobile === true.
//
// Layout aprobado en mockup:
//   - Título "Hoy" + subtítulo con fecha completa
//   - Day-picker horizontal (7 días alrededor de hoy) con dots por día ocupado
//   - Alerta urgente (opcional) — cierre de mes cerca con gap
//   - Quick add tarea
//   - Sección Pendientes del día
//   - Sección Eventos del día (timeline vertical)
//   - Sección Minutas recientes
//
// Permisos externos: si el usuario es 'externo' (ej: Camilo Digitalife),
// solo ve pendientes/eventos donde él es responsable, y minutas donde
// aparece en algún acuerdo.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, AlertTriangle, Plus, Check, Circle, Clock, Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_SEMANA_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DIAS_CORTO = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const CLIENTE_PILL = {
  digitalife: { bg: 'rgba(88,86,214,0.12)', color: '#5856D6', label: 'Digitalife' },
  dicotech:   { bg: 'rgba(255,149,0,0.12)', color: '#FF9500', label: 'Dicotech' },
  pcel:       { bg: 'rgba(52,199,89,0.12)', color: '#34C759', label: 'PCEL' },
};

// ─── Utils fecha ISO ───
const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const addDays = (d, n) => {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
};
const sameDay = (a, b) => toISO(a) === toISO(b);
const fmtFechaLarga = (d) => `${DIAS_SEMANA_LARGO[d.getDay()]} · ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;

export default function MobileHoy({ perfil, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const yoId = perfil?.user_id;
  const esExterno = perfil?.tipo === 'externo';

  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [minutas, setMinutas] = useState([]);

  const hoy = useMemo(() => new Date(), []);
  const [diaSel, setDiaSel] = useState(() => new Date());
  const [savingId, setSavingId] = useState(null);
  const [quickText, setQuickText] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);

  // ── Fetch inicial
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [p, e, m] = await Promise.all([
          supabase.from('pendientes_equipo').select('*'),
          supabase.from('eventos_equipo').select('*'),
          supabase.from('minutas').select('*, minuta_acuerdos(*)').order('fecha_reunion', { ascending: false }).limit(6),
        ]);
        if (!alive) return;
        setPendientes(p.data || []);
        setEventos(e.data || []);
        setMinutas(m.data || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Filtro por externo
  const pendientesVis = useMemo(() =>
    esExterno ? pendientes.filter(p => p.responsable === yoId) : pendientes,
    [pendientes, esExterno, yoId]);
  const eventosVis = useMemo(() =>
    esExterno ? eventos.filter(e => e.responsable === yoId) : eventos,
    [eventos, esExterno, yoId]);
  const minutasVis = useMemo(() => {
    if (!esExterno) return minutas;
    return minutas.filter(m => (m.minuta_acuerdos || []).some(a => a.responsable === yoId));
  }, [minutas, esExterno, yoId]);

  // ── Días del picker: 3 antes + hoy + 3 después
  const diasPicker = useMemo(() => {
    const arr = [];
    for (let i = -3; i <= 3; i++) arr.push(addDays(hoy, i));
    return arr;
  }, [hoy]);

  // ── Dot indicator por día
  const tienItems = useMemo(() => {
    const map = {};
    diasPicker.forEach(d => {
      const iso = toISO(d);
      const tareas = pendientesVis.filter(p => p.fecha_limite === iso && p.estatus !== 'listo').length;
      const evs = eventosVis.filter(e => e.fecha === iso).length;
      map[iso] = tareas + evs;
    });
    return map;
  }, [diasPicker, pendientesVis, eventosVis]);

  // ── Items del día seleccionado
  const isoSel = toISO(diaSel);
  const tareasHoy = useMemo(
    () => pendientesVis
      .filter(p => p.fecha_limite === isoSel)
      .sort((a, b) => {
        const rank = { alta: 0, media: 1, baja: 2 };
        return (rank[a.prioridad] ?? 1) - (rank[b.prioridad] ?? 1);
      }),
    [pendientesVis, isoSel]
  );
  const eventosHoy = useMemo(
    () => eventosVis
      .filter(e => e.fecha === isoSel)
      .sort((a, b) => (a.hora_ini || a.hora || '99:99').localeCompare(b.hora_ini || b.hora || '99:99')),
    [eventosVis, isoSel]
  );

  // ── Alerta cierre de mes
  const diasCierre = useMemo(() => {
    const last = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return Math.ceil((last - hoy) / 86400000);
  }, [hoy]);
  const mostrarAlerta = diasCierre <= 7 && !esExterno;

  // ── Toggle tarea
  const toggleTarea = async (t) => {
    if (savingId) return;
    const nuevo = t.estatus === 'listo' ? 'pendiente' : 'listo';
    setSavingId(t.id);
    setPendientes(prev => prev.map(p => p.id === t.id ? { ...p, estatus: nuevo } : p));
    try {
      await supabase.from('pendientes_equipo').update({ estatus: nuevo }).eq('id', t.id);
    } catch (e) {
      // revertir
      setPendientes(prev => prev.map(p => p.id === t.id ? { ...p, estatus: t.estatus } : p));
    } finally {
      setSavingId(null);
    }
  };

  // ── Quick add
  const handleQuickAdd = async () => {
    const txt = quickText.trim();
    if (!txt) return;
    const nuevo = {
      titulo: txt, responsable: yoId, fecha_limite: isoSel,
      estatus: 'pendiente', prioridad: 'media', cliente: 'otro',
    };
    const { data, error } = await supabase.from('pendientes_equipo').insert(nuevo).select().single();
    if (!error && data) {
      setPendientes(prev => [...prev, data]);
      setQuickText('');
      setQuickOpen(false);
    }
  };

  return (
    <div style={{
      background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh',
    }}>
      {/* Título */}
      <div style={{ padding: '10px 18px 4px' }}>
        <h1 style={{
          margin: 0, fontFamily: TYPO.fontDisplay,
          fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text,
        }}>Hoy</h1>
        <div style={{ color: theme.textMuted, fontSize: 13.5, fontWeight: 500, marginTop: 2, textTransform: 'capitalize' }}>
          {fmtFechaLarga(hoy)}
        </div>
      </div>

      {/* Day picker */}
      <div style={{
        padding: '10px 18px 12px', display: 'flex', gap: 6, overflowX: 'auto',
        scrollbarWidth: 'none',
      }} className="mh-hide">
        {diasPicker.map((d) => {
          const iso = toISO(d);
          const isHoy = sameDay(d, hoy);
          const on = sameDay(d, diaSel);
          const dots = tienItems[iso] || 0;
          return (
            <button key={iso}
              onClick={() => setDiaSel(d)}
              style={{
                flex: '0 0 54px', padding: '8px 4px', borderRadius: 12,
                background: on ? theme.text : theme.surface,
                border: `1px solid ${on ? theme.text : theme.border}`,
                color: on ? theme.bg : theme.text,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                cursor: 'pointer', fontFamily: TYPO.fontText,
                transition: 'background 200ms cubic-bezier(.4,0,.2,1), transform 160ms',
              }}
              onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.94)'}
              onPointerUp={(e) => e.currentTarget.style.transform = ''}
              onPointerLeave={(e) => e.currentTarget.style.transform = ''}
            >
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: on ? theme.bg : theme.textMuted, fontWeight: 700 }}>
                {isHoy ? 'Hoy' : DIAS_CORTO[d.getDay()]}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>{d.getDate()}</div>
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: dots > 0 ? (on ? theme.bg : theme.accent) : 'transparent',
                marginTop: 2,
              }} />
            </button>
          );
        })}
      </div>

      {/* Alerta urgente */}
      {mostrarAlerta && (
        <button
          onClick={() => onNavegar(null, 'resumenClientes')}
          style={{
            width: 'calc(100% - 36px)', margin: '4px 18px 10px',
            padding: '12px 14px', background: 'rgba(255,59,48,.10)',
            border: '1px solid rgba(255,59,48,.22)', borderRadius: 14,
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            fontFamily: TYPO.fontText, textAlign: 'left',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: theme.red || '#FF3B30',
            color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto',
          }}>
            <AlertTriangle size={16} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Cierre de mes · {diasCierre}d</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Revisa cuotas y gap por cliente</div>
          </div>
          <ChevronRight size={16} style={{ color: theme.red || '#FF3B30' }} />
        </button>
      )}

      {/* Quick add */}
      {!quickOpen ? (
        <button
          onClick={() => setQuickOpen(true)}
          style={{
            width: 'calc(100% - 36px)', margin: '6px 18px 10px',
            padding: '10px 14px', background: theme.surface,
            border: `1px dashed ${theme.border}`, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 8,
            color: theme.textMuted, fontSize: 13, cursor: 'pointer',
            fontFamily: TYPO.fontText, textAlign: 'left',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: theme.accentSoft || 'rgba(0,122,255,.10)',
            color: theme.accent, display: 'grid', placeItems: 'center',
          }}>
            <Plus size={14} strokeWidth={2.4} />
          </span>
          <span>Añadir tarea…</span>
        </button>
      ) : (
        <div style={{
          margin: '6px 18px 10px', padding: 12, background: theme.surface,
          border: `1px solid ${theme.accent}`, borderRadius: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <input
            autoFocus type="text" value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') { setQuickOpen(false); setQuickText(''); } }}
            placeholder="¿Qué tienes que hacer?"
            style={{
              width: '100%', border: 'none', background: 'transparent',
              color: theme.text, fontFamily: TYPO.fontText, fontSize: 14, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setQuickOpen(false); setQuickText(''); }}
              style={{ padding: '6px 12px', border: 'none', background: 'transparent', color: theme.textMuted, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >Cancelar</button>
            <button onClick={handleQuickAdd} disabled={!quickText.trim()}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 100,
                background: quickText.trim() ? theme.accent : theme.surfaceHover,
                color: quickText.trim() ? '#fff' : theme.textMuted,
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Agregar</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
          Cargando…
        </div>
      )}

      {/* Sección Pendientes */}
      {!loading && (
        <>
          <SectionHead theme={theme} title={`Pendientes${sameDay(diaSel, hoy) ? ' hoy' : ''}`} count={tareasHoy.length} />
          {tareasHoy.length === 0 ? (
            <EmptyRow theme={theme}>Nada pendiente {sameDay(diaSel, hoy) ? 'hoy' : 'este día'} · buen momento para adelantar</EmptyRow>
          ) : (
            <div style={{ padding: '0 18px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tareasHoy.map((t) => (
                <TodoRow key={t.id} theme={theme} tarea={t} onToggle={() => toggleTarea(t)} saving={savingId === t.id} />
              ))}
            </div>
          )}

          {/* Sección Eventos */}
          <SectionHead theme={theme} title="Eventos" count={eventosHoy.length} />
          {eventosHoy.length === 0 ? (
            <EmptyRow theme={theme}>Sin eventos programados</EmptyRow>
          ) : (
            <div style={{ padding: '0 18px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventosHoy.map((e) => (
                <EventoRow key={e.id} theme={theme} ev={e} />
              ))}
            </div>
          )}

          {/* Sección Minutas recientes */}
          <SectionHead theme={theme} title="Minutas recientes" count={minutasVis.length} />
          {minutasVis.length === 0 ? (
            <EmptyRow theme={theme}>Sin minutas recientes</EmptyRow>
          ) : (
            <div style={{ padding: '0 18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {minutasVis.slice(0, 4).map((m) => (
                <MinutaRow key={m.id} theme={theme} minuta={m} onOpen={() => onNavegar(null, 'adminInterna')} />
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .mh-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ─────────────── Sub-componentes ───────────────
function SectionHead({ theme, title, count }) {
  return (
    <div style={{ padding: '12px 18px 4px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: theme.textMuted, fontWeight: 700, fontFamily: TYPO.fontText }}>
        {title}{typeof count === 'number' ? ` · ${count}` : ''}
      </div>
    </div>
  );
}

function EmptyRow({ theme, children }) {
  return (
    <div style={{
      margin: '4px 18px 6px', padding: '14px 16px', background: theme.surface,
      border: `1px dashed ${theme.border}`, borderRadius: 12,
      color: theme.textMuted, fontSize: 12.5, textAlign: 'center',
      fontFamily: TYPO.fontText,
    }}>{children}</div>
  );
}

function TodoRow({ theme, tarea, onToggle, saving }) {
  const done = tarea.estatus === 'listo';
  const prioColor = tarea.prioridad === 'alta'
    ? (theme.red || '#FF3B30')
    : tarea.prioridad === 'media'
      ? (theme.orange || '#FF9500')
      : 'transparent';
  const cli = CLIENTE_PILL[tarea.cliente];
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      opacity: saving ? .6 : 1,
      transition: 'opacity 160ms',
    }}>
      <div style={{
        width: 4, alignSelf: 'stretch', margin: '-2px 0',
        background: prioColor, borderRadius: 2,
      }} />
      <button
        onClick={onToggle}
        aria-label={done ? 'Marcar pendiente' : 'Marcar listo'}
        style={{
          width: 22, height: 22, borderRadius: '50%',
          border: `2px solid ${done ? (theme.green || '#34C759') : theme.border}`,
          background: done ? (theme.green || '#34C759') : 'transparent',
          color: '#fff', display: 'grid', placeItems: 'center',
          cursor: 'pointer', flex: '0 0 auto', marginTop: 1,
        }}
      >{done && <Check size={13} strokeWidth={3} />}</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: done ? theme.textMuted : theme.text,
          textDecoration: done ? 'line-through' : 'none',
          fontFamily: TYPO.fontText,
        }}>{tarea.titulo || tarea.texto || '(sin título)'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 11, color: theme.textMuted }}>
          {cli && (
            <span style={{
              padding: '2px 7px', borderRadius: 100, background: cli.bg,
              color: cli.color, fontWeight: 700, fontSize: 10,
            }}>{cli.label}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function EventoRow({ theme, ev }) {
  const hora = ev.hora_ini || ev.hora || '—';
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ textAlign: 'right', minWidth: 52 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{hora}</div>
        {ev.duracion_min && <div style={{ fontSize: 10.5, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>{ev.duracion_min}m</div>}
      </div>
      <div style={{ width: 3, alignSelf: 'stretch', background: theme.accent, borderRadius: 2, margin: '-2px 0' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text }}>{ev.titulo}</div>
        {(ev.notas || ev.lugar) && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{ev.lugar || ev.notas}</div>}
      </div>
    </div>
  );
}

function MinutaRow({ theme, minuta, onOpen }) {
  const acuerdos = minuta.minuta_acuerdos || [];
  const pendCount = acuerdos.filter(a => a.estado !== 'listo').length;
  const cli = CLIENTE_PILL[minuta.cliente];
  const fecha = minuta.fecha_reunion ? new Date(minuta.fecha_reunion + 'T00:00:00') : null;
  return (
    <button onClick={onOpen}
      style={{
        width: '100%', background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 14, padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, fontFamily: TYPO.fontText,
      }}
    >
      <div style={{ textAlign: 'right', minWidth: 44 }}>
        <div style={{ fontSize: 12, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
          {fecha ? DIAS_CORTO[fecha.getDay()] : '—'}
        </div>
        <div style={{ fontSize: 10.5, color: theme.textMuted }}>
          {fecha ? `${fecha.getDate()} ${MESES_CORTO[fecha.getMonth()]}` : ''}
        </div>
      </div>
      <div style={{ width: 3, alignSelf: 'stretch', background: theme.green || '#34C759', borderRadius: 2, margin: '-2px 0' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {minuta.titulo || '(sin título)'}
        </div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          {cli && <span style={{ padding: '1px 6px', borderRadius: 100, background: cli.bg, color: cli.color, fontWeight: 700, fontSize: 10 }}>{cli.label}</span>}
          <span>{acuerdos.length} acuerdos{pendCount > 0 ? ` · ${pendCount} pendientes` : ''}</span>
        </div>
      </div>
      <ChevronRight size={14} style={{ color: theme.textSubtle, flex: '0 0 auto' }} />
    </button>
  );
}
