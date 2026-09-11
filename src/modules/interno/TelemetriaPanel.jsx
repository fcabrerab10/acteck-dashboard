// Actividad del equipo · V3 (2026-09-11). Sólo super admin (permisos.js: telemetria = __super_admin_only__).
// Hero "pulso del equipo" → 4 KpiCard → umbral de inactividad → Panel Internos / Externos con TarjetaPersona → HojaPersona.
// Datos: src/modules/interno/equipo/datos.js · cálculo puro: equipo/calculo.js (pruebas en scripts/test-equipo-calculo.mjs)
// · textos y mapa de acciones de auditoría: equipo/textos.js · evaluación mensual (sólo perfiles.se_evalua): equipo/Evaluacion.jsx.
import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { relativo } from '../../lib/format';
import SinAcceso from '../../components/SinAcceso';
import { Hero, KpiCard, Panel, Pill, Segmented, Boton, Cargando } from '../../components/kit';
import { useDatosEquipo, useUmbralInactividad, useIndicesPorUsuario } from './equipo/datos.js';
import { resumenTelemetria, resumenAcciones, cumplimientoAgenda, inactividad, evaluacionPendiente, pulsoEquipo, ordenarPersonas, UMBRALES_INACTIVIDAD, inicioSemana } from './equipo/calculo.js';
import { fraseHero, fmtHm, plural, MESES, MESES_CORTO } from './equipo/textos.js';
import TarjetaPersona from './equipo/TarjetaPersona.jsx';
import HojaPersona from './equipo/HojaPersona.jsx';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 };

export default function TelemetriaPanel() {
  const perfil = usePerfil();
  const esAdmin = perfil?.rol === 'super_admin' || perfil?.es_super_admin === true;
  const { theme } = useTheme();
  const [umbral, setUmbral] = useUmbralInactividad();
  const [selId, setSelId] = useState(null);
  const datos = useDatosEquipo(esAdmin);
  const { usuarios, eventos, auditoria, agenda, evaluaciones, mesActual, cargando, error, refetch } = datos;
  const { eventosPor, auditoriaPor } = useIndicesPorUsuario(eventos, auditoria);

  const hoy = new Date();
  const visibles = useMemo(() => (usuarios || []).filter((u) => u.activo !== false && u.user_id), [usuarios]);
  const internos = useMemo(() => visibles.filter((u) => u.tipo !== 'externo'), [visibles]);
  const externos = useMemo(() => visibles.filter((u) => u.tipo === 'externo'), [visibles]);

  // Métricas por usuario (telemetría · auditoría · agenda · inactividad)
  const porUsuario = useMemo(() => {
    const m = new Map();
    const desdeSemana = inicioSemana(hoy);
    for (const u of visibles) {
      const tele = resumenTelemetria(eventosPor.get(u.user_id) || [], { hoy, desdeSemana });
      const acc = resumenAcciones(auditoriaPor.get(u.user_id) || [], { hoy });
      const ag = agenda?.disponible ? cumplimientoAgenda(agenda.items, u.user_id, { hoy }) : null;
      // La inactividad sólo aplica al equipo interno (externos entran cuando quieren).
      const inact = u.tipo === 'externo' ? null : inactividad({ ultimoEvento: tele.ultimo, agenda: ag, hoy, umbral });
      m.set(u.user_id, { tele, acc, agenda: ag, inact, evalPendiente: evaluacionPendiente(u, evaluaciones, { hoy }) });
    }
    return m;
  }, [visibles, eventosPor, auditoriaPor, agenda, evaluaciones, umbral]); // eslint-disable-line react-hooks/exhaustive-deps

  const pulso = useMemo(() => pulsoEquipo(internos, porUsuario, { agendaItems: agenda?.disponible ? agenda.items : null, hoy }), [internos, porUsuario, agenda]); // eslint-disable-line react-hooks/exhaustive-deps
  const internosOrden = useMemo(() => ordenarPersonas(internos, porUsuario), [internos, porUsuario]);
  const externosOrden = useMemo(() => ordenarPersonas(externos, porUsuario), [externos, porUsuario]);
  const evalsPendientes = internos.filter((u) => porUsuario.get(u.user_id)?.evalPendiente);
  const sel = visibles.find((u) => u.user_id === selId) || null;

  if (!esAdmin) return <SinAcceso motivo="Sólo el super admin puede ver la actividad del equipo." />;
  if (cargando) return <Cargando pantalla="telemetria" label="Cargando actividad del equipo…" />;

  const semana = inicioSemana(hoy);
  const semLbl = `${semana.getDate()} ${MESES_CORTO[semana.getMonth()].toLowerCase()}`;
  const sub = { fontSize: 11, color: theme.textMuted };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }} data-stagger>
      <Hero eyebrow={`Interno · Actividad del equipo · ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`}
        titulo={fraseHero(pulso, internos.length)}
        sub={`Semana del ${semLbl} · telemetría automática, acciones registradas en el historial y pendientes de Agenda. Sólo lo ve el super admin.`}
        stats={[
          { k: 'Activos hoy', v: `${pulso.activosHoy}/${internos.length}`, sub: 'equipo interno' },
          { k: 'Sesiones', v: pulso.sesionesSemana, sub: 'esta semana' },
          { k: 'Pendientes vencidos', v: pulso.vencidosEquipo == null ? '—' : pulso.vencidosEquipo, sub: agenda?.disponible ? 'del equipo' : 'Agenda no disponible', color: pulso.vencidosEquipo > 0 ? (theme.orangeSoft || theme.orange) : undefined },
          { k: 'Acciones', v: pulso.accionesSemana, sub: 'registradas esta semana' },
        ]}>
        {error && <div style={{ marginTop: 6, fontSize: 11, color: theme.orangeSoft || theme.orange }}>No se pudo cargar todo: {String(error.message || error)}</div>}
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <KpiCard eyebrow="Tiempo activo" big={fmtHm(pulso.minutosSemana)} bigSmall="esta semana" sub={`${plural(pulso.sesionesSemana, 'sesión', 'sesiones')} · ${plural(internos.length, 'persona')}`} />
        <KpiCard eyebrow="Pendientes a tiempo" big={pulso.pctATiempo != null ? `${pulso.pctATiempo}%` : '—'} bigSmall="30 días"
          sub={agenda?.disponible ? `${pulso.vencidosEquipo ?? 0} vencidos hoy` : 'Agenda no disponible'} progress={pulso.pctATiempo ?? undefined} />
        <KpiCard eyebrow="Inactividad" big={pulso.inactivos} bigSmall={pulso.inactivos === 1 ? 'persona' : 'personas'}
          sub={`umbral ${plural(umbral, 'día hábil', 'días hábiles')} sin entrar o sin cerrar pendientes`} bigColor={pulso.inactivos > 0 ? theme.red : theme.green}
          badge={pulso.inactivos > 0 ? { l: 'atender', tone: 'red' } : { l: 'al día', tone: 'green' }} />
        <KpiCard eyebrow="Evaluaciones" big={evalsPendientes.length} bigSmall="por cerrar"
          sub={evalsPendientes.length ? `${evalsPendientes.map((u) => (u.nombre || '').split(' ')[0]).join(', ')} · ${MESES_CORTO[porUsuario.get(evalsPendientes[0].user_id).evalPendiente.mes - 1]}` : `${plural(internos.filter((u) => u.se_evalua).length, 'persona')} con evaluación mensual`}
          onClick={evalsPendientes.length ? () => setSelId(evalsPendientes[0].user_id) : undefined}
          badge={evalsPendientes.length && hoy.getDate() > 3 ? { l: 'venció el día 3', tone: 'orange' } : undefined} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={sub}>Umbral de inactividad</span>
        <Segmented value={umbral} onChange={setUmbral} options={UMBRALES_INACTIVIDAD.map((n) => ({ id: n, label: `${n} días hábiles`, title: `Avisar al superar ${n} días hábiles sin entrar o sin cerrar pendientes` }))} />
        <span style={{ ...sub, marginLeft: 'auto' }}>{datos.cargadoAt ? `actualizado ${relativo(datos.cargadoAt)}` : ''}</span>
        <Boton icon={RefreshCw} onClick={() => refetch()}>Actualizar</Boton>
      </div>

      <Panel titulo="Acteck · equipo interno" meta={`${plural(internos.length, 'persona')} · ${pulso.activosHoy} hoy`}
        acciones={!agenda?.disponible ? <Pill tone="gray" size="xs">Agenda no disponible</Pill> : null}>
        <div style={GRID} data-stagger>
          {internosOrden.map((u) => (
            <TarjetaPersona key={u.user_id} u={u} datos={porUsuario.get(u.user_id)} agendaDisponible={!!agenda?.disponible} mesActual={mesActual}
              evalPendiente={porUsuario.get(u.user_id)?.evalPendiente} onClick={() => setSelId(u.user_id)} />
          ))}
          {internos.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: theme.textMuted }}>Sin usuarios internos activos.</div>}
        </div>
      </Panel>

      {externos.length > 0 && (
        <Panel titulo="Externos · clientes y aliados" meta={plural(externos.length, 'usuario')} plegable abiertoInicial={false}>
          <div style={GRID}>
            {externosOrden.map((u) => (
              <TarjetaPersona key={u.user_id} u={u} datos={porUsuario.get(u.user_id)} agendaDisponible={false} mesActual={null} onClick={() => setSelId(u.user_id)} />
            ))}
          </div>
        </Panel>
      )}

      <HojaPersona u={sel} datos={sel ? porUsuario.get(sel.user_id) : null} abierto={!!sel} onClose={() => setSelId(null)}
        agendaDisponible={!!agenda?.disponible} evaluaciones={evaluaciones} />
    </div>
  );
}
