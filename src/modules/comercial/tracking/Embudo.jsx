// Ciclo del pedido · embudo de 5 etapas (conteo, % sobre la base y días promedio). Clic en una etapa filtra la tabla.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { toneColors, EASE, DUR } from '../../../components/kit';
import { ETAPA_LABEL, ETAPA_TONE } from './textos';

const LABEL = { cotizacion: 'Cotizaciones', recibida: 'OC recibida', facturada: 'Facturada', enviada: 'Enviada', entregada: 'Entregada' };

export default function Embudo({ embudo, activa, onEtapa }) {
  const { theme } = useTheme();
  const base = Math.max(1, ...embudo.etapas.map((e) => e.n));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${embudo.etapas.length}, minmax(0, 1fr))`, gap: 8 }}>
      {embudo.etapas.map((e) => {
        const [bg, col] = toneColors(theme, ETAPA_TONE[e.etapa]);
        const on = activa === e.etapa;
        const pct = e.n / base;
        return (
          <button key={e.etapa} type="button" onClick={() => onEtapa?.(on ? null : e.etapa)} title={`${on ? 'Quitar filtro' : 'Filtrar la tabla por'} ${ETAPA_LABEL[e.etapa]}`}
            style={{ textAlign: 'left', border: `1px solid ${on ? col : theme.border}`, borderRadius: 10, padding: '10px 12px', background: on ? bg : theme.surface, cursor: 'pointer', fontFamily: TYPO.fontText, transition: `background ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}`, minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{e.n}</div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text, marginTop: 6 }}>{LABEL[e.etapa]}</div>
            <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.sub}</div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(pct * 100)}%`, height: '100%', background: col, borderRadius: 2, transition: `width 600ms ${EASE}` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
