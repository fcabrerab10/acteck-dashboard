// Actividad del equipo en el celular (página global `telemetria`, sólo super admin).
//
//   1. Pulso (HeroM): activos hoy · pendientes vencidos del equipo · acciones de la semana, y quién lleva
//      más días sin entrar o sin cerrar pendientes. Segmented del umbral de inactividad (2 · 3 · 5 días
//      hábiles) — es el MISMO valor que la web: perfiles.preferencias.equipo.umbralInactividad del super admin.
//   2. Lista por persona (Internos primero, Externos después): avatar, puesto, última entrada, pendientes,
//      acciones de la semana. Deslizar a la izquierda = "Recordar pendientes" (sólo internos con vencidos,
//      una vez al día · ver recordar.js) · deslizar a la derecha o tocar = ficha de la persona.
//   3. Ficha (pantalla empujada): Persona.jsx.
//
// Toda la lógica es la MISMA de la web: src/modules/interno/equipo/{datos,calculo,textos}.js.
// Sin costos ni márgenes en ninguna parte.
import React, { useMemo, useState } from 'react';
import { Users, Lock } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Cargando } from '../../../components/kit';
import { useDatosEquipo, useUmbralInactividad, useIndicesPorUsuario, useInvalidarEquipo } from '../../../modules/interno/equipo/datos.js';
import { resumenTelemetria, resumenAcciones, cumplimientoAgenda, inactividad, evaluacionPendiente, pulsoEquipo, ordenarPersonas, isoDia, inicioSemana, UMBRALES_INACTIVIDAD } from '../../../modules/interno/equipo/calculo.js';
import { fraseHero, fmtHmCorto, plural, nombreCorto, MESES_CORTO } from '../../../modules/interno/equipo/textos.js';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Cabecera, Segmented, Vacio, toast } from '../../piezas';
import { Deslizable, FilaPersona } from './piezas';
import { recordarPendientes, yaRecordadoHoy } from './recordar';
import Persona from './Persona';

/** Quién lleva más días sin entrar (o sin cerrar pendientes) — frase del hero. */
function elMasRezagado(usuarios, porUsuario) {
  let mejor = null;
  for (const u of usuarios || []) {
    const inact = porUsuario.get(u.user_id)?.inact;
    if (!inact) continue;
    const dias = inact.sinEntrar ? inact.diasSinEntrar : inact.diasSinCerrar;
    if (!mejor || dias > mejor.dias) mejor = { u, dias, sinEntrar: inact.sinEntrar };
  }
  if (!mejor) return null;
  return `${nombreCorto(mejor.u.nombre || mejor.u.email)} lleva ${plural(mejor.dias, 'día hábil', 'días hábiles')} ${mejor.sinEntrar ? 'sin entrar' : 'sin cerrar pendientes'}.`;
}

export default function Equipo() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav?.perfil;
  const esAdmin = perfil?.es_super_admin === true || perfil?.rol === 'super_admin';
  const [umbral, setUmbral] = useUmbralInactividad();
  const [recordados, setRecordados] = useState({});   // user_id → true (para pintar la pill al instante)
  const invalidar = useInvalidarEquipo();

  const datos = useDatosEquipo(esAdmin);
  const { usuarios, eventos, auditoria, agenda, evaluaciones, mesActual, cargando, error } = datos;
  const { eventosPor, auditoriaPor } = useIndicesPorUsuario(eventos, auditoria);

  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDia(hoy);
  const visibles = useMemo(() => (usuarios || []).filter((u) => u.activo !== false && u.user_id), [usuarios]);
  const internos = useMemo(() => visibles.filter((u) => u.tipo !== 'externo'), [visibles]);
  const externos = useMemo(() => visibles.filter((u) => u.tipo === 'externo'), [visibles]);

  const porUsuario = useMemo(() => {
    const m = new Map();
    const desdeSemana = inicioSemana(hoy);
    for (const u of visibles) {
      const tele = resumenTelemetria(eventosPor.get(u.user_id) || [], { hoy, desdeSemana });
      const acc = resumenAcciones(auditoriaPor.get(u.user_id) || [], { hoy });
      const ag = agenda?.disponible ? cumplimientoAgenda(agenda.items, u.user_id, { hoy }) : null;
      const inact = u.tipo === 'externo' ? null : inactividad({ ultimoEvento: tele.ultimo, agenda: ag, hoy, umbral });
      const vencidos = (ag?.listaAbiertos || []).filter((i) => i.fecha_limite && String(i.fecha_limite).slice(0, 10) < hoyIso);
      m.set(u.user_id, { tele, acc, agenda: ag, vencidos, inact, evalPendiente: evaluacionPendiente(u, evaluaciones, { hoy }) });
    }
    return m;
  }, [visibles, eventosPor, auditoriaPor, agenda, evaluaciones, umbral]); // eslint-disable-line react-hooks/exhaustive-deps

  const pulso = useMemo(() => pulsoEquipo(internos, porUsuario, { agendaItems: agenda?.disponible ? agenda.items : null, hoy }), [internos, porUsuario, agenda]); // eslint-disable-line react-hooks/exhaustive-deps
  const internosOrden = useMemo(() => ordenarPersonas(internos, porUsuario), [internos, porUsuario]);
  const externosOrden = useMemo(() => ordenarPersonas(externos, porUsuario), [externos, porUsuario]);
  const evalsPendientes = useMemo(() => internos.filter((u) => porUsuario.get(u.user_id)?.evalPendiente), [internos, porUsuario]);

  const abrir = (u) => nav.push(<Persona u={u} datos={porUsuario.get(u.user_id)} agendaDisponible={!!agenda?.disponible} evaluaciones={evaluaciones} mesActual={mesActual} />, `equipo-${u.user_id}`);

  const recordar = async (u) => {
    const d = porUsuario.get(u.user_id);
    const vencidos = d?.vencidos || [];
    if (!vencidos.length) { toast.info(`${nombreCorto(u.nombre || u.email)} no tiene pendientes vencidos`); return; }
    if (recordados[u.user_id] || yaRecordadoHoy(u.user_id)) { toast.info(`Ya le recordaste hoy a ${nombreCorto(u.nombre || u.email)}`); return; }
    try {
      const n = await recordarPendientes(u.user_id, vencidos);
      setRecordados((r) => ({ ...r, [u.user_id]: true }));
      toast.ok(`Aviso en camino a ${nombreCorto(u.nombre || u.email)} · ${plural(n, 'pendiente vencido', 'pendientes vencidos')}`);
      invalidar();
    } catch (e) { toast.error(`No se pudo enviar el recordatorio: ${e.message || e}`); }
  };

  const cabecera = (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Actividad del equipo" sub="Sólo la ves tú" />
    </>
  );

  if (!esAdmin) return (<>{cabecera}<Vacio icon={Lock} color={theme.textMuted} titulo="Sin acceso" sub="La actividad del equipo sólo la ve el super admin." /></>);
  if (cargando) return (<>{cabecera}<div style={{ padding: '0 16px' }}><Cargando pantalla="movilEquipo" /></div></>);

  const semana = inicioSemana(hoy);
  const rezagado = elMasRezagado(internos, porUsuario);

  return (
    <>
      {cabecera}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
        <HeroM eyebrow={`Semana del ${semana.getDate()} ${MESES_CORTO[semana.getMonth()].toLowerCase()}`}
          frase={fraseHero(pulso, internos.length)}
          sub={rezagado || 'Nadie rebasa el umbral de inactividad.'}
          stats={[
            { k: 'Activos hoy', v: `${pulso.activosHoy}/${internos.length}` },
            { k: 'Vencidos', v: pulso.vencidosEquipo == null ? '—' : pulso.vencidosEquipo, sub: agenda?.disponible ? 'del equipo' : 'Agenda no disponible', color: pulso.vencidosEquipo > 0 ? (theme.orangeSoft || theme.orange) : undefined },
            { k: 'Acciones', v: pulso.accionesSemana, sub: 'esta semana' },
          ]} />

        {error && <div style={{ padding: '0 18px', fontSize: 11.5, color: theme.orange }}>No se pudo cargar todo: {String(error.message || error)}</div>}

        <KpiGrid>
          <KpiM eyebrow="Tiempo activo" big={fmtHmCorto(pulso.minutosSemana)} sub={`${plural(pulso.sesionesSemana, 'sesión', 'sesiones')} esta semana`} />
          <KpiM eyebrow="Pendientes a tiempo" big={pulso.pctATiempo != null ? `${pulso.pctATiempo}%` : '—'} sub="últimos 30 días" progress={pulso.pctATiempo ?? undefined} />
          <KpiM eyebrow="Inactividad" big={pulso.inactivos} bigColor={pulso.inactivos > 0 ? theme.red : theme.green}
            sub={`umbral ${plural(umbral, 'día hábil', 'días hábiles')}`} pill={pulso.inactivos > 0 ? { tone: 'red', label: 'atender' } : { tone: 'green', label: 'al día' }} />
          <KpiM eyebrow="Evaluaciones" big={evalsPendientes.length} sub={evalsPendientes.length ? `${evalsPendientes.map((u) => nombreCorto(u.nombre)).join(', ')} · por cerrar` : `${plural(internos.filter((u) => u.se_evalua).length, 'persona')} con evaluación`}
            onClick={evalsPendientes.length ? () => abrir(evalsPendientes[0]) : undefined} />
        </KpiGrid>

        <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>Umbral de inactividad</span>
          <Segmented value={umbral} onChange={setUmbral} options={UMBRALES_INACTIVIDAD.map((n) => ({ id: n, label: `${n} días` }))} />
        </div>

        <ListaAgrupada titulo="Acteck · equipo interno" meta={`${internos.length} · ${pulso.activosHoy} hoy`}
          pie="Desliza a la izquierda para recordarle sus pendientes vencidos; a la derecha para abrir su ficha.">
          {internosOrden.map((u) => {
            const d = porUsuario.get(u.user_id);
            const conVencidos = (d?.vencidos || []).length > 0;
            const yaFue = !!recordados[u.user_id] || yaRecordadoHoy(u.user_id);
            return (
              <Deslizable key={u.user_id} onDerecha={() => abrir(u)} onIzquierda={conVencidos && !yaFue ? () => recordar(u) : undefined} labelIzquierda="Recordar">
                <FilaPersona u={u} datos={d} hoyIso={hoyIso} onAbrir={() => abrir(u)} recordado={yaFue} />
              </Deslizable>
            );
          })}
          {internos.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: theme.textMuted }}>Sin usuarios internos activos.</div>}
        </ListaAgrupada>

        {externos.length > 0 && (
          <ListaAgrupada titulo="Externos · clientes y aliados" meta={String(externos.length)} pie="Los externos entran cuando quieren: no se les mide inactividad ni pendientes.">
            {externosOrden.map((u) => (
              <Deslizable key={u.user_id} onDerecha={() => abrir(u)}>
                <FilaPersona u={u} datos={porUsuario.get(u.user_id)} hoyIso={hoyIso} externo onAbrir={() => abrir(u)} />
              </Deslizable>
            ))}
          </ListaAgrupada>
        )}

        {visibles.length === 0 && <Vacio icon={Users} color={theme.textMuted} titulo="Sin usuarios" sub="No hay perfiles activos que mostrar." />}
      </div>
    </>
  );
}
