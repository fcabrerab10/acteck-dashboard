// Administración → Sistema. Versión y commit, novedades por versión, estado de servicios (Supabase ·
// puente SQL · cron), enlaces (Historial de cambios · Importador) y retención de auditoría
// (RPC purgar_auditoria_admin(365): wrapper del super admin sobre purgar_auditoria, migración 20260910).
import React, { useMemo, useState } from 'react';
import { History, Upload, Trash2, ExternalLink } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { supabase } from '../../lib/supabase';
import { APP_VERSION, COMMIT, versionLabel } from '../../lib/version';
import { relativo, fecha } from '../../lib/format';
import { useEstadoImportador } from '../settings/importador/useImportadorData';
import { latidoPuente } from '../settings/importador/frescura';
import { Panel, Pill, Boton, toast } from '../../components/kit';
import { hairline, suaveBg } from '../../components/perfil/comun';
import { NOVEDADES } from './novedades';
import { useEstadoSistema, irAPagina, MS_DIA } from './useAdminData';
import { plural } from './comun';

const RETENCION_DIAS = 365;
const mono = '"SF Mono", ui-monospace, Menlo, monospace';

export default function SeccionSistema() {
  const { theme } = useTheme();
  const { data: sis, isLoading, refetch } = useEstadoSistema(true);
  const { status } = useEstadoImportador({ enabled: true });
  const latido = useMemo(() => latidoPuente(status), [status]);
  const [purgando, setPurgando] = useState(false);

  const purgar = async () => {
    const viejas = sis?.auditoria?.masAntigua ? Math.floor((Date.now() - Date.parse(sis.auditoria.masAntigua)) / MS_DIA) : null;
    if (viejas != null && viejas <= RETENCION_DIAS) { toast.info(`La auditoría más antigua tiene ${viejas} días: no hay nada que purgar.`); return; }
    if (!window.confirm(`¿Borrar los registros de auditoría con más de ${RETENCION_DIAS} días? No se puede deshacer.`)) return;
    setPurgando(true);
    try {
      const { data, error } = await supabase.rpc('purgar_auditoria_admin', { dias: RETENCION_DIAS });
      if (error) throw error;
      toast.ok(`Auditoría purgada: ${plural(Number(data) || 0, 'registro')} borrados`);
      refetch();
    } catch (e) { toast.error(`No se pudo purgar: ${e.message || e}`); }
    finally { setPurgando(false); }
  };

  const servicios = [
    { k: 'Supabase', ok: sis ? sis.supabaseOk : null, v: sis?.supabaseOk ? `${sis.supabaseMs} ms` : sis ? 'sin respuesta' : '…', sub: 'consulta ligera a perfiles' },
    { k: 'Puente SQL (Mac mini)', ok: status ? latido.enLinea : null, v: latido.t ? (latido.enLinea ? 'en línea' : 'sin señal') : status ? 'sin latido' : '…', sub: latido.t ? `latido ${relativo(latido.t)}` : 'aún no escribe latido' },
    { k: 'Cron (Vercel)', ok: sis ? (sis.alertasHoy ?? 0) > 0 || !!sis.ultimoSync : null, v: sis ? `${plural(sis.alertasHoy ?? 0, 'alerta')} hoy` : '…', sub: sis?.ultimoSync ? `último sync_event ${relativo(sis.ultimoSync.created_at)} · ${sis.ultimoSync.status_key}` : 'sin eventos de sincronización' },
  ];

  const filaSrv = (s, i) => (
    <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: i ? `1px solid ${hairline(theme)}` : 0 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: s.ok == null ? theme.textSubtle : s.ok ? theme.green : theme.red, boxShadow: s.ok ? `0 0 0 3px ${theme.green}33` : 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: theme.text }}>{s.k}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</span>
      </span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: s.ok === false ? theme.red : theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{s.v}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, alignItems: 'start' }}>
      <Panel titulo="Versión" meta={versionLabel()} padding="0">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 12px 6px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums' }}>v{APP_VERSION}</span>
          {COMMIT && <span style={{ fontFamily: mono, fontSize: 11.5, color: theme.textMuted }}>commit {COMMIT}</span>}
          <span style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, marginLeft: 'auto' }}>package.json · se edita a mano</span>
        </div>
        {NOVEDADES.map((n, i) => (
          <div key={n.version} style={{ padding: '8px 12px 10px', borderTop: `1px solid ${hairline(theme)}`, opacity: i === 0 ? 1 : 0.82 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill tone={n.version === APP_VERSION ? 'blue' : 'gray'} size="xs">v{n.version}</Pill>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text }}>{n.titulo}</span>
              <span style={{ fontSize: 10.5, color: theme.textMuted, marginLeft: 'auto' }}>{fecha(n.fecha)}</span>
            </div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11.5, color: theme.textMuted, lineHeight: 1.45 }}>
              {n.items.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          </div>
        ))}
      </Panel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Panel titulo="Estado de servicios" meta={isLoading ? 'consultando…' : 'se actualiza cada minuto'} padding="0">
          {servicios.map(filaSrv)}
        </Panel>

        <Panel titulo="Enlaces" padding="0">
          <Enlace icon={History} label="Historial de cambios" sub="Quién cambió qué y cuándo en lo que la app escribe" onClick={() => irAPagina('historialCambios')} primera />
          <Enlace icon={Upload} label="Importador central" sub="Cargas automáticas del puente y manuales por grupo" onClick={() => irAPagina('actualizacion')} />
          <Enlace icon={ExternalLink} label="Supabase · proyecto hrhccvuhnedahznewgaj" sub="Tablas, vistas, RLS y migraciones (supabase/migrations)" href="https://supabase.com/dashboard/project/hrhccvuhnedahznewgaj" />
        </Panel>

        <Panel titulo="Retención de auditoría" meta={`auditoria_cambios · ${RETENCION_DIAS} días`} padding="10px 12px"
          acciones={<Boton icon={Trash2} peligro onClick={purgar} disabled={purgando || !sis}>{purgando ? 'Purgando…' : `Purgar > ${RETENCION_DIAS} días`}</Boton>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Tile theme={theme} k="Registros" v={sis?.auditoria?.filas == null ? '—' : sis.auditoria.filas.toLocaleString('es-MX')} sub="en auditoria_cambios" />
            <Tile theme={theme} k="Más antiguo" v={sis?.auditoria?.masAntigua ? relativo(sis.auditoria.masAntigua) : '—'} sub={sis?.auditoria?.masAntigua ? fecha(sis.auditoria.masAntigua) : 'sin registros'} />
          </div>
          <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 8 }}>
            Borra los cambios registrados hace más de {RETENCION_DIAS} días (RPC purgar_auditoria_admin, sólo super admin). El Historial de cambios deja de mostrarlos.
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Tile({ theme, k, v, sub }) {
  return (
    <div style={{ borderRadius: 10, padding: '8px 10px', background: suaveBg(theme), minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </div>
  );
}

function Enlace({ icon: Icon, label, sub, onClick, href, primera }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const Tag = href ? 'a' : 'button';
  return (
    <Tag type={href ? undefined : 'button'} href={href} target={href ? '_blank' : undefined} rel={href ? 'noreferrer' : undefined} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', border: 0, borderTop: primera ? 0 : `1px solid ${hairline(theme)}`, textAlign: 'left', cursor: 'pointer',
        background: hover ? (theme.surfaceHover || 'rgba(0,0,0,0.03)') : 'transparent', color: theme.text, fontFamily: TYPO.fontText, textDecoration: 'none', boxSizing: 'border-box' }}>
      <Icon size={15} strokeWidth={1.8} style={{ color: theme.textMuted, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
      <span style={{ color: theme.accent, fontSize: 12 }}>{href ? '↗' : '→'}</span>
    </Tag>
  );
}
