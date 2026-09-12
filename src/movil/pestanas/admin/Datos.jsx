// Administración → Datos (celular). Sólo consulta y "Pedir corrida": los archivos se suben desde la
// computadora.
//   · 2 KPIs: puente SQL (latido) y fuentes al día X/Y.
//   · Cargas automáticas (bridge/): última corrida, registros, estado y un botón "Pedir" por fuente que
//     inserta en `sync_solicitudes` (lo mismo que el menú "Pedir corrida ▾" del importador web). Se
//     deshabilita mientras hay una solicitud pendiente o en proceso de esa fuente (o de "Todo").
//   · Cargas manuales por grupo: anillo de frescura, cadencia esperada, última carga y quién la subió.
// Cálculo compartido con la web: frescuraManual / estadoAutomatica / latidoPuente (importador/frescura.js).
import React, { useState } from 'react';
import { Play, Upload } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { supabase } from '../../../lib/supabase';
import { invalidateDataCache } from '../../../lib/queries';
import { PUENTE, GRUPOS, labelCadencia, labelLimite } from '../../../modules/settings/importador/config';
import { estadoAutomatica, frescuraManual, relTiempo, fmtHora } from '../../../modules/settings/importador/frescura';
import Anillo from '../../../modules/settings/importador/Anillo';
import { KpiM, KpiGrid, ListaAgrupada, Fila, Skeleton, Pill, toast } from '../../piezas';

const TONO_SOL = { pendiente: 'orange', en_proceso: 'blue', hecha: 'green', error: 'red' };
const TONO_AUTO = { OK: 'green', Atrasada: 'orange', Error: 'red', 'Sin carga': 'gray' };

export default function Datos({ status, upload, fuentes, resumen, latido, perfil, onRefetch }) {
  const { theme } = useTheme();
  const [pidiendo, setPidiendo] = useState(null);

  if (!status || !resumen) {
    return <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={220} r={12} /><Skeleton h={260} r={12} /></div>;
  }

  const solicitudes = status.solicitudes || [];
  const enCola = solicitudes.filter((s) => s.estado === 'pendiente' || s.estado === 'en_proceso');
  const pendienteDe = (f) => enCola.some((s) => s.fuente === f || s.fuente === 'all');

  const pedir = async (fuente, titulo) => {
    if (pidiendo || pendienteDe(fuente)) return;
    setPidiendo(fuente);
    try {
      const { error } = await supabase.from('sync_solicitudes').insert({ fuente, solicitado_por: perfil?.nombre || perfil?.email || null });
      if (error) throw error;
      await invalidateDataCache();
      toast.ok(`${titulo}: corrida pedida · el puente la toma en ≤ 5 min`);
      await onRefetch?.();
    } catch (e) { toast.error(`No se pudo pedir la corrida: ${e.message || e}`); }
    setPidiendo(null);
  };

  const filasAuto = PUENTE.map((row) => {
    const item = (status.items || []).find((x) => x.fuente === row.key);
    const ev = (status.eventos || {})[row.key];
    return { row, item, ev, st: estadoAutomatica(row, item, ev) };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KpiGrid>
        <KpiM eyebrow="Puente SQL" big={latido.enLinea ? 'En línea' : latido.t ? 'Sin señal' : 'Sin latido'}
          bigColor={latido.enLinea ? theme.green : theme.red}
          sub={`${latido.t ? `latido ${relTiempo(latido.t)}` : 'aún no escribe latido'} · próxima ${fmtHora(latido.proxima)}`} />
        <KpiM eyebrow="Fuentes al día" big={`${resumen.alDia}/${resumen.total}`}
          sub={resumen.atrasadas.length ? `${resumen.atrasadas.length} atrasada${resumen.atrasadas.length === 1 ? '' : 's'}` : resumen.porVencer.length ? `${resumen.porVencer.length} por vencer` : 'sin pendientes'}
          pill={resumen.atrasadas.length ? { tone: 'red', label: 'atender' } : resumen.porVencer.length ? { tone: 'orange', label: 'ojo' } : { tone: 'green', label: 'al día' }} />
      </KpiGrid>

      <ListaAgrupada titulo="Cargas automáticas" meta="puente SQL · Mac mini"
        pie={enCola.length ? `En cola: ${enCola.map((s) => `${s.fuente} (${s.estado.replace('_', ' ')})`).join(' · ')}.` : 'Corren solas; "Pedir" adelanta la siguiente corrida.'}>
        {filasAuto.map(({ row, item, st }) => (
          <Fila key={row.key} chevron={false} alto={58} titulo={row.titulo}
            sub={`${item?.ultima_actualizacion ? relTiempo(item.ultima_actualizacion) : 'sin carga'}${item?.registros != null ? ` · ${Number(item.registros).toLocaleString('es-MX')} filas` : ''} · ${row.horario}`}
            trailing={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Pill tone={TONO_AUTO[st.texto] || 'gray'} size="xs" dot>{st.texto}</Pill>
                <BotonPedir disabled={pendienteDe(row.solicitud) || pidiendo === row.solicitud} onClick={() => pedir(row.solicitud, row.titulo)} />
              </div>
            } />
        ))}
      </ListaAgrupada>

      {GRUPOS.map((g) => {
        const delGrupo = (fuentes || []).filter((f) => f.grupo === g.id);
        if (!delGrupo.length) return null;
        return (
          <ListaAgrupada key={g.id} titulo={`Manuales · ${g.label}`} meta={String(delGrupo.length)}>
            {delGrupo.map((f) => {
              const fr = frescuraManual(f, status, new Date(), upload?.[f.statusKey]);
              const quien = (status.historial?.[f.statusKey] || []).find((e) => e.status === 'success')?.user_nombre;
              const pill = fr.sinDatos && !fr.cambio ? { tone: 'red', label: 'sin datos' }
                : fr.estado === 'atrasada' ? { tone: 'red', label: `${fr.diasAtraso} d` }
                  : fr.estado === 'por_vencer' ? { tone: 'orange', label: fr.diasParaLimite === 0 ? 'hoy' : `${fr.diasParaLimite} d` }
                    : { tone: fr.cambio && !fr.ultima ? 'gray' : 'green', label: 'al día' };
              return (
                <Fila key={f.id} chevron={false} alto={58} titulo={f.titulo}
                  avatar={<Anillo pct={fr.pct} tone={fr.tone} label={fr.cambio ? '✓' : fr.dias != null ? String(fr.dias) : '—'} size={30} />}
                  sub={`esperada ${labelCadencia(f.cadencia)}${labelLimite(f.cadencia) ? ` · ${labelLimite(f.cadencia)}` : ''} · ${fr.ultima ? relTiempo(fr.ultima) : 'sin carga'}${quien ? ` · ${quien}` : ''}`}
                  pill={pill} />
              );
            })}
          </ListaAgrupada>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0 28px', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, fontFamily: TYPO.fontText, lineHeight: 1.45 }}>
        <Upload size={14} strokeWidth={1.9} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Los archivos se suben desde la computadora (Administración → Datos o el importador central). Aquí sólo ves el estado y puedes adelantar una corrida del puente.</span>
      </div>
    </div>
  );
}

function BotonPedir({ disabled, onClick }) {
  const { theme } = useTheme();
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, padding: '0 11px', borderRadius: 9, border: 0, flexShrink: 0,
        background: disabled ? (theme.mode === 'dark' ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)') : theme.accent,
        color: disabled ? theme.textMuted : (theme.textOnDark || '#FFF'), fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600,
        opacity: disabled ? 0.7 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      <Play size={12} strokeWidth={2.4} />{disabled ? 'En cola' : 'Pedir'}
    </button>
  );
}
