// Administración → Sistema (celular). Versión y commit, novedades plegables (mismas NOVEDADES de la web),
// estado de servicios (Supabase · puente SQL · cron) con la hora del último latido, retención de auditoría
// (RPC purgar_auditoria_admin, con confirmación) y enlaces a Historial de cambios e Importador.
import React, { useState } from 'react';
import { ChevronDown, History, Upload, Trash2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { supabase } from '../../../lib/supabase';
import { APP_VERSION, COMMIT } from '../../../lib/version';
import { relativo, fecha } from '../../../lib/format';
import { NOVEDADES } from '../../../modules/configuracion/novedades';
import { useEstadoSistema, MS_DIA } from '../../../modules/configuracion/useAdminData';
import { plural } from '../../../modules/configuracion/comun';
import { relTiempo } from '../../../modules/settings/importador/frescura';
import { useNav } from '../../nav';
import { ListaAgrupada, Fila, KpiM, KpiGrid, BotonGrande, Pill, toast } from '../../piezas';
import { MONO } from '../../util';

const RETENCION_DIAS = 365;

export default function Sistema({ status, latido }) {
  const { theme } = useTheme();
  const nav = useNav();
  const { data: sis, isLoading, refetch } = useEstadoSistema(true);
  const [abierta, setAbierta] = useState(NOVEDADES[0]?.version || null);
  const [purgando, setPurgando] = useState(false);

  const purgar = async () => {
    const viejas = sis?.auditoria?.masAntigua ? Math.floor((Date.now() - Date.parse(sis.auditoria.masAntigua)) / MS_DIA) : null;
    if (viejas != null && viejas <= RETENCION_DIAS) { toast.info(`Lo más antiguo tiene ${viejas} días: no hay nada que purgar.`); return; }
    if (!window.confirm(`¿Borrar los registros de auditoría con más de ${RETENCION_DIAS} días? No se puede deshacer.`)) return;
    setPurgando(true);
    try {
      const { data, error } = await supabase.rpc('purgar_auditoria_admin', { dias: RETENCION_DIAS });
      if (error) throw error;
      toast.ok(`Auditoría purgada: ${plural(Number(data) || 0, 'registro')} borrados`);
      refetch();
    } catch (e) { toast.error(`No se pudo purgar: ${e.message || e}`); }
    setPurgando(false);
  };

  const servicios = [
    { k: 'Supabase', ok: sis ? sis.supabaseOk : null, v: sis?.supabaseOk ? `${sis.supabaseMs} ms` : sis ? 'sin respuesta' : '…', sub: 'consulta ligera a perfiles' },
    { k: 'Puente SQL', ok: status ? latido.enLinea : null, v: latido.t ? (latido.enLinea ? 'en línea' : 'sin señal') : status ? 'sin latido' : '…', sub: latido.t ? `latido ${relTiempo(latido.t)}` : 'aún no escribe latido' },
    { k: 'Cron (Vercel)', ok: sis ? (sis.alertasHoy ?? 0) > 0 || !!sis.ultimoSync : null, v: sis ? `${sis.alertasHoy ?? 0}` : '…', sub: sis ? `alertas hoy${sis.ultimoSync ? ` · sync ${relativo(sis.ultimoSync.created_at)}` : ''}` : 'consultando' },
    { k: 'Correo', ok: null, v: 'SMTP', sub: 'resumen programado y críticas · se configura en Vercel' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiGrid>
        <KpiM eyebrow="Versión" big={`v${APP_VERSION}`} sub={COMMIT ? `commit ${COMMIT}` : 'package.json'} />
        <KpiM eyebrow="Auditoría" big={sis?.auditoria?.filas == null ? '—' : Number(sis.auditoria.filas).toLocaleString('es-MX')}
          sub={sis?.auditoria?.masAntigua ? `más antiguo ${relativo(sis.auditoria.masAntigua)}` : 'sin registros'} />
      </KpiGrid>

      <ListaAgrupada titulo="Estado de servicios" meta={isLoading ? 'consultando…' : 'cada minuto'}>
        {servicios.map((s) => (
          <Fila key={s.k} chevron={false} alto={52} titulo={s.k} sub={s.sub} valor={s.v}
            tono={s.ok == null ? (theme.textSubtle || theme.textMuted) : s.ok ? theme.green : theme.red} />
        ))}
      </ListaAgrupada>

      <ListaAgrupada titulo="Novedades" meta={String(NOVEDADES.length)} pie="Se agrega una entrada por cada versión con cambios visibles.">
        {NOVEDADES.slice(0, 8).map((n) => {
          const on = abierta === n.version;
          return (
            <div key={n.version}>
              <button type="button" onClick={() => setAbierta(on ? null : n.version)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <Pill tone={n.version === APP_VERSION ? 'blue' : 'gray'} size="xs">v{n.version}</Pill>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.titulo}</span>
                <span style={{ fontSize: 11, color: theme.textMuted, fontFamily: MONO, flexShrink: 0 }}>{fecha(n.fecha)}</span>
                <ChevronDown size={15} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0, transform: on ? 'rotate(180deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />
              </button>
              {on && (
                <ul style={{ margin: 0, padding: '0 16px 12px 32px', fontSize: 12.5, color: theme.textMuted, lineHeight: 1.5 }}>
                  {n.items.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{it}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </ListaAgrupada>

      <ListaAgrupada titulo="Enlaces">
        <Fila icon={History} color={theme.purple || theme.accent} titulo="Historial de cambios" sub="Quién cambió qué y cuándo" onClick={() => nav.navegar({ pagina: 'historialCambios' })} />
        <Fila icon={Upload} color={theme.accent} titulo="Importador" sub="Frescura de las fuentes (sólo lectura)" onClick={() => nav.navegar({ pagina: 'actualizacion' })} />
      </ListaAgrupada>

      <div style={{ padding: '0 16px' }}>
        <BotonGrande peligro icon={Trash2} disabled={purgando || !sis} onClick={purgar}>
          {purgando ? 'Purgando…' : `Purgar auditoría > ${RETENCION_DIAS} días`}
        </BotonGrande>
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 1.45, fontFamily: TYPO.fontText }}>
          Borra los cambios registrados hace más de {RETENCION_DIAS} días (RPC purgar_auditoria_admin, sólo super admin). No se puede deshacer.
        </div>
      </div>
    </div>
  );
}
