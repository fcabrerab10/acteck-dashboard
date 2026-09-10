// PestanaDatos · pestaña "Datos" del PanelAvatar (sólo puedeActualizarDatos). Panel B del mockup:
//   · dos tiles: Puente SQL (en línea / sin señal + próxima corrida) y Al día X/Y (N atrasadas)
//   · barra de salud proporcional (verde · naranja · rojo)
//   · listas "Atrasadas" y "Por vencer" (máx. 5) con pill de días
//   · botón "Abrir importador central →"
// Fuente única: useFrescura() (v_fuentes_frescura) para las automáticas del puente y
// estadoManual() (cadencia de fuentes_config / importador) para las manuales.
import React, { useMemo } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { useFrescura, FUENTES_AUTOMATICAS, etiquetaCorta } from '../../lib/frescura';
import { Pill } from '../kit';
import { useFuentesConfig } from '../../modules/settings/importador/fuentesConfig';
import { useEstadoImportador } from '../../modules/settings/importador/useImportadorData';
import { frescuraManual, latidoPuente, fmtHora, relTiempo } from '../../modules/settings/importador/frescura';
import { suaveBg, hairline } from './comun';

const MAX_LISTA = 5;

/** Resume automáticas (vista) + manuales (cadencia) en una sola lista de fuentes con estado. Pura. */
export function resumirDatos({ filasVista, fuentes, status, upload, ahora = new Date() }) {
  const autos = (filasVista || []).filter((r) => FUENTES_AUTOMATICAS.includes(r.fuente)).map((r) => ({
    id: r.fuente, nombre: etiquetaCorta(r), auto: true,
    estado: r.estado === 'ok' ? 'al_dia' : 'atrasada', dias: r.dias ?? null, diasAtraso: r.estado === 'ok' ? 0 : Math.max(1, (r.dias ?? 0) - (r.umbral_dias ?? 0)), diasParaLimite: null,
  }));
  const manuales = (fuentes || []).map((f) => {
    const fr = frescuraManual(f, status, ahora, upload?.[f.statusKey]);
    return { id: f.id, nombre: f.titulo, grupo: f.grupo, auto: false, estado: fr.estado, dias: fr.dias, diasAtraso: fr.diasAtraso, diasParaLimite: fr.diasParaLimite, sinDatos: fr.sinDatos && !fr.cambio };
  });
  const todas = [...autos, ...manuales];
  const atrasadas = todas.filter((x) => x.estado === 'atrasada').sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0));
  const porVencer = todas.filter((x) => x.estado === 'por_vencer').sort((a, b) => (a.diasParaLimite ?? 0) - (b.diasParaLimite ?? 0));
  const alDia = todas.length - atrasadas.length - porVencer.length;
  return { todas, atrasadas, porVencer, alDia, total: todas.length };
}

const NOMBRE_GRUPO = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech', estados_cuenta: 'Estado de cuenta', globales: null };

export default function PestanaDatos({ activo = true, onNavegar, onCerrar }) {
  const { theme } = useTheme();
  const { filas: filasVista, cargando: cargandoVista } = useFrescura(activo);
  const { fuentes } = useFuentesConfig({ enabled: activo });
  const { status, upload, loading: cargandoStatus, error } = useEstadoImportador({ enabled: activo });

  const r = useMemo(() => (status ? resumirDatos({ filasVista, fuentes, status, upload }) : null), [filasVista, fuentes, status, upload]);
  const latido = useMemo(() => latidoPuente(status), [status]);
  const cargando = cargandoVista || cargandoStatus || !r;

  const tile = { borderRadius: 10, padding: '8px 10px', background: suaveBg(theme), display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 };
  const eyebrow = { fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap' };
  const cifra = { fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 };
  const sub = { fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  if (error && !status) {
    return <div style={{ padding: '18px 8px', fontSize: 12, color: theme.red }}>No se pudo leer el estado del importador: {error}</div>;
  }
  if (cargando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{[0, 1].map((i) => <div key={i} style={{ ...tile, height: 52 }} />)}</div>
        <div style={{ height: 6, borderRadius: 999, background: suaveBg(theme) }} />
        <div style={{ fontSize: 11.5, color: theme.textSubtle, padding: '6px 2px' }}>Leyendo frescura…</div>
      </div>
    );
  }

  const todoAlDia = r.atrasadas.length === 0 && r.porVencer.length === 0;
  const proxima = fmtHora(latido.proxima);
  const colorPuente = latido.enLinea ? theme.green : theme.red;
  const pct = (n) => (r.total ? (n / r.total) * 100 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0 2px' }}>
      {/* Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={tile} title={latido.t ? `Último latido ${relTiempo(latido.t)}` : 'El puente aún no escribe latido'}>
          <span style={eyebrow}>Puente SQL</span>
          <span style={cifra}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: colorPuente, boxShadow: latido.enLinea ? `0 0 0 3px ${colorPuente}33` : 'none', flexShrink: 0 }} />
            {latido.enLinea ? 'En línea' : latido.t ? 'Sin señal' : 'Sin latido'}
          </span>
          <span style={sub}>próxima corrida {proxima}</span>
        </div>
        <div style={tile}>
          <span style={eyebrow}>Al día</span>
          <span style={cifra}>{r.alDia}<span style={{ color: theme.textSubtle, fontWeight: 500 }}>/{r.total}</span></span>
          <span style={{ ...sub, color: r.atrasadas.length ? theme.red : r.porVencer.length ? theme.orange : theme.textMuted }}>
            {r.atrasadas.length ? `${r.atrasadas.length} atrasada${r.atrasadas.length === 1 ? '' : 's'}` : r.porVencer.length ? `${r.porVencer.length} por vencer` : 'sin pendientes'}
          </span>
        </div>
      </div>

      {/* Barra de salud */}
      <div aria-label="Salud de las fuentes" style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: suaveBg(theme) }}>
        {[[r.alDia, theme.green], [r.porVencer.length, theme.orange], [r.atrasadas.length, theme.red]].map(([n, col], i) => n > 0 && (
          <span key={i} style={{ width: `${pct(n)}%`, background: col, transition: `width ${DUR.content}ms ${EASE}` }} />
        ))}
      </div>

      {todoAlDia ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '18px 8px 12px' }}>
          <CheckCircle2 size={24} color={theme.green} strokeWidth={1.8} />
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em' }}>Todo al día</span>
          <span style={{ fontSize: 11.5, color: theme.textMuted }}>próxima corrida {proxima}</span>
        </div>
      ) : (
        <>
          <Lista theme={theme} titulo="Atrasadas" items={r.atrasadas} tone="red" pill={(x) => (x.sinDatos ? 'sin datos' : `${x.diasAtraso} d`)} />
          <Lista theme={theme} titulo="Por vencer" items={r.porVencer} tone="orange" pill={(x) => (x.diasParaLimite === 0 ? 'hoy' : `${x.diasParaLimite} d`)} />
        </>
      )}

      <button type="button" onClick={() => { onCerrar?.(); onNavegar?.(null, 'actualizacion'); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 32, marginTop: 2, borderRadius: 9, border: 0, cursor: 'pointer',
          background: theme.accent, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em' }}>
        Abrir importador central <ArrowRight size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function Lista({ theme, titulo, items, tone, pill }) {
  if (!items.length) return null;
  const extra = items.length - MAX_LISTA;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, padding: '6px 2px 3px' }}>{titulo}</div>
      <div style={{ borderRadius: 10, border: `1px solid ${hairline(theme)}`, overflow: 'hidden' }}>
        {items.slice(0, MAX_LISTA).map((x, i) => (
          <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderTop: i ? `1px solid ${hairline(theme)}` : 0 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {x.nombre}
              {!x.auto && NOMBRE_GRUPO[x.grupo] && <span style={{ color: theme.textMuted }}> · {NOMBRE_GRUPO[x.grupo]}</span>}
              {x.auto && <span style={{ color: theme.textSubtle || theme.textMuted }}> · puente</span>}
            </span>
            <Pill tone={tone} size="xs">{pill(x)}</Pill>
          </div>
        ))}
        {extra > 0 && <div style={{ padding: '5px 10px', fontSize: 11, color: theme.textMuted, borderTop: `1px solid ${hairline(theme)}` }}>y {extra} más en el importador</div>}
      </div>
    </div>
  );
}
