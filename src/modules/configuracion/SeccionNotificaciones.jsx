// Administración → Notificaciones del equipo. Por usuario interno: sus preferencias del centro de
// notificaciones en lectura (áreas · hora del resumen · correos) con "Editar", que abre
// PreferenciasNotificaciones en modo controlado y escribe perfiles.preferencias.notif de ese usuario
// (update directo: RLS perfiles_write lo permite al super admin). Más los destinatarios fijos del cron.
import React, { useState } from 'react';
import { Pencil, Mail } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { AREAS, AREA_LABEL, NOMBRE_CLIENTE, normalizarPrefsNotif } from '../../lib/alertas';
import { AvatarImg } from '../../lib/avatar';
import { Panel, Pill, Boton, toast } from '../../components/kit';
import { HojaLateral, hairline } from '../../components/perfil/comun';
import PreferenciasNotificaciones from '../../components/notificaciones/PreferenciasNotificaciones';
import { tipoDe, estadoDe } from './comun';

const MODO_TONE = { inmediato: 'blue', resumen: 'gray', silencio: 'orange' };
const MODO_LABEL = { inmediato: 'Inmediato', resumen: 'Resumen', silencio: 'Silencio' };

// Destinatarios de los recordatorios del cron (api/cron.js). Se cambian en Vercel → Environment Variables.
const RECORDATORIOS = [
  { t: 'Tracking de pedidos', d: 'OCs sin actualizar (taskRecordatorioTracking)', para: 'Karolina', cc: 'Fernando', vars: 'SMTP_TO_KAROLINA · SMTP_TO_FERNANDO' },
  { t: 'Forecast · avisos de reserva', d: 'Arribos por reservar (taskForecastAvisos)', para: 'Fernando y Karolina', vars: 'SMTP_TO_FERNANDO · SMTP_TO_KAROLINA' },
  { t: 'Evaluación mensual', d: 'Días 1 y 3 del mes si falta cerrar el mes anterior (taskRecordatorioEvaluacion)', para: 'Fernando y Karolina', vars: 'SMTP_TO_FERNANDO · SMTP_TO_KAROLINA' },
  { t: 'Resumen programado y críticas', d: 'Alertas del centro (taskResumenProgramado / enviarCriticasNuevas)', para: 'Cada usuario según sus preferencias de arriba', vars: 'perfiles.preferencias.notif' },
];

export default function SeccionNotificaciones({ usuarios, actualizar }) {
  const { theme } = useTheme();
  const [editando, setEditando] = useState(null);
  const internos = (usuarios || []).filter((u) => tipoDe(u) === 'interno' && u.activo);
  const u = editando ? usuarios.find((x) => x.id === editando) : null;

  const guardarDe = async (usuario, notif) => {
    const prev = usuario.preferencias && typeof usuario.preferencias === 'object' ? usuario.preferencias : {};
    await actualizar(usuario.id, { preferencias: { ...prev, notif } });
    toast.ok(`Preferencias de ${usuario.nombre || usuario.email} guardadas`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Panel titulo="Preferencias por usuario" meta={`${internos.length} internos activos · los externos no reciben avisos`} padding="0">
        {internos.length === 0 && <div style={{ padding: 16, fontSize: 12, color: theme.textMuted }}>Sin usuarios internos activos.</div>}
        {internos.map((x, i) => <FilaPrefs key={x.id} u={x} primera={i === 0} onEditar={() => setEditando(x.id)} />)}
      </Panel>

      <Panel titulo="Destinatarios de recordatorios" meta="correos fijos del cron (api/cron.js)" padding="0">
        {RECORDATORIOS.map((r, i) => (
          <div key={r.t} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 10, alignItems: 'center', padding: '8px 12px', borderTop: i ? `1px solid ${hairline(theme)}` : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text }}>{r.t}</div>
              <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.d}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.text, minWidth: 0 }}>
              <Mail size={12} style={{ color: theme.textMuted, flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.para}{r.cc ? <span style={{ color: theme.textMuted }}> · cc {r.cc}</span> : null}</span>
            </div>
            <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.vars}>{r.vars}</div>
          </div>
        ))}
        <div style={{ padding: '8px 12px 10px', fontSize: 10.5, color: theme.textSubtle || theme.textMuted, borderTop: `1px solid ${hairline(theme)}` }}>
          Informativo. Los correos fijos se cambian en Vercel → Settings → Environment Variables (SMTP_TO_FERNANDO, SMTP_TO_KAROLINA) y aplican en el siguiente deploy; si no existen, api/cron.js usa fernando.cabrera@ y karolina.veliz@.
        </div>
      </Panel>

      <HojaLateral abierto={!!u} onClose={() => setEditando(null)} theme={theme} titulo={u ? `Notificaciones · ${u.nombre || u.email}` : ''} sub="Se guarda al instante en el perfil de este usuario." ancho={440}>
        {u && (
          <PreferenciasNotificaciones valor={u.preferencias?.notif} onGuardar={(n) => guardarDe(u, n)}
            pieTexto={`Se guarda en el perfil de ${u.nombre || u.email}; lo verá aplicado la próxima vez que abra el dashboard.`} />
        )}
      </HojaLateral>
    </div>
  );
}

function FilaPrefs({ u, primera, onEditar }) {
  const { theme } = useTheme();
  const p = normalizarPrefsNotif(u.preferencias?.notif);
  const est = estadoDe(u);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr auto', gap: 12, alignItems: 'center', padding: '9px 12px', borderTop: primera ? 0 : `1px solid ${hairline(theme)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <AvatarImg perfil={u} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || u.email}</div>
          <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.puesto || u.email}{est.key === 'pendiente' ? ' · invitación pendiente' : ''}</div>
        </div>
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {AREAS.map((a) => <Pill key={a} tone={MODO_TONE[p.areas[a]]} size="xs" title={`${AREA_LABEL[a]}: ${MODO_LABEL[p.areas[a]]}`}>{AREA_LABEL[a]} · {MODO_LABEL[p.areas[a]]}</Pill>)}
        </div>
        <div style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          Resumen a las {p.resumen.hora} · correo del resumen {p.resumen.correo ? 'sí' : 'no'} · críticas por correo {p.criticas_correo ? 'sí' : 'no'} · {p.clientes ? `sólo ${p.clientes.map((c) => NOMBRE_CLIENTE[c] || c).join(', ')}` : 'todos los clientes'}
        </div>
      </div>
      <Boton icon={Pencil} onClick={onEditar}>Editar</Boton>
    </div>
  );
}

