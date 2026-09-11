// Tarjeta de persona (kit V3): avatar · nombre · pills de estado · 4 cifras de la semana ·
// acciones (3 principales) · pendientes · bono (sólo se_evalua). Click → HojaPersona.
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { relativo, money } from '../../../lib/format';
import { Panel, Pill } from '../../../components/kit';
import { AvatarImg } from '../../../lib/avatar';
import { hairline } from '../../../components/perfil/comun';
import { fmtHmCorto, plural, textoInactividad, CLIENTE_LABEL, MESES_CORTO } from './textos.js';

function Cifra({ k, v, sub, color }) {
  const { theme } = useTheme();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: color || theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
      {sub != null && <div style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

export default function TarjetaPersona({ u, datos, agendaDisponible, mesActual, evalPendiente, onClick }) {
  const { theme } = useTheme();
  const { tele, acc, agenda, inact } = datos || {};
  const externo = u.tipo === 'externo';
  const inactTxt = textoInactividad(inact);
  const bono = u.se_evalua && mesActual ? mesActual.bonoBase : null;
  const sub = { fontSize: 10.5, color: theme.textMuted };

  return (
    <Panel elevable padding="12px 14px" style={{ cursor: 'pointer', height: '100%', boxSizing: 'border-box' }} id={`persona-${u.user_id}`}>
      <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }} style={{ outline: 'none' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AvatarImg perfil={u} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || u.email}</span>
              {u.es_super_admin && <Pill tone="purple" size="xs">Super admin</Pill>}
            </div>
            <div style={{ ...sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.puesto || u.rol}{externo ? ' · externo' : ''} · {tele?.ultimo ? `última ${relativo(tele.ultimo)}` : 'sin actividad en 28 días'}
            </div>
          </div>
          <ChevronRight size={14} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0 }} />
        </div>

        {/* Pills de estado */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, minHeight: 18 }}>
          {tele?.activoHoy ? <Pill tone="green" size="xs" dot>activo hoy</Pill> : null}
          {inactTxt && <Pill tone={inact.sinEntrar ? 'red' : 'orange'} size="xs" dot>{inactTxt}</Pill>}
          {evalPendiente && <Pill tone="orange" size="xs">evaluar {MESES_CORTO[evalPendiente.mes - 1]}</Pill>}
          {u.se_evalua && !evalPendiente && <Pill tone="blue" size="xs">se evalúa</Pill>}
          {agenda?.vencidos > 0 && <Pill tone="red" size="xs">{plural(agenda.vencidos, 'pendiente vencido', 'pendientes vencidos')}</Pill>}
        </div>

        {/* Cifras de la semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${hairline(theme)}` }}>
          <Cifra k="Días" v={`${tele?.diasActivosSemana ?? 0}/5`} sub="esta semana" />
          <Cifra k="Tiempo" v={fmtHmCorto(tele?.minutosSemana || 0)} sub={`${tele?.sesionesSemana || 0} ${tele?.sesionesSemana === 1 ? 'sesión' : 'sesiones'}`} />
          <Cifra k="Acciones" v={acc?.semana ?? 0} sub={acc?.total ? `${acc.total} en 28 d` : 'registradas'} />
          {agendaDisponible
            ? <Cifra k="A tiempo" v={agenda?.pctATiempo != null ? `${agenda.pctATiempo}%` : '—'} sub={agenda?.cerrados ? `${agenda.cerrados} cerrados · 30 d` : 'sin cierres · 30 d'} color={agenda?.pctATiempo == null ? undefined : agenda.pctATiempo >= 80 ? theme.green : agenda.pctATiempo >= 50 ? undefined : theme.orange} />
            : <Cifra k="Foco" v={tele?.clienteTop ? CLIENTE_LABEL[tele.clienteTop] || '—' : '—'} sub={tele?.clienteTop ? `${tele.pctClienteTop}% del tiempo` : 'sin datos'} />}
        </div>

        {/* Qué hizo esta semana */}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${hairline(theme)}` }}>
          <div style={{ ...sub, marginBottom: 4 }}>Qué hizo esta semana</div>
          {acc?.principales?.length
            ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{acc.principales.map((p) => <Pill key={p.label} tone="gray" size="xs">{p.label} · {p.n}</Pill>)}</div>
            : <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted }}>Sin acciones registradas.</div>}
        </div>

        {/* Pendientes + bono */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 8, fontSize: 11 }}>
          <span style={{ color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {!agendaDisponible ? 'Agenda no disponible' : agenda ? `${plural(agenda.abiertos, 'pendiente abierto', 'pendientes abiertos')}${agenda.puntosCerrados ? ` · ${plural(agenda.puntosCerrados, 'punto cerrado', 'puntos cerrados')}` : ''}` : '—'}
          </span>
          {bono != null && <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: theme.text, whiteSpace: 'nowrap' }} title="Bono estimado del mes en curso">{money(bono)} <span style={{ color: theme.textMuted, fontWeight: 400 }}>bono est.</span></span>}
        </div>
      </div>
    </Panel>
  );
}
