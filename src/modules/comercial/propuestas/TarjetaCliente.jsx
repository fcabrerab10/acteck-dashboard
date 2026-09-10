// TarjetaCliente — tarjeta por cliente en la Landing: cuota / facturado / gap / propuestas del mes + última propuesta.
// "Nueva propuesta" entra directo a Armar (un clic menos que la vista ElegirCliente que sustituye); si el cliente
// tiene un borrador abierto, "Continuar" lo retoma tal como lo dejó el autoguardado.
import React from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton } from '../../../components/kit';
import { moneyCompact, int, relativo } from '../../../lib/format';
import { MES_LABEL, MES_ACTUAL, clienteColor, estadoInfo } from './constantes';

export default function TarjetaCliente({ c, kpi, propuestas, ocupado, onNueva, onContinuar }) {
  const { theme } = useTheme();
  const col = clienteColor(theme, c.key);
  const k = kpi || { cuota: 0, facturado: 0, gap: 0 };
  const pctC = k.cuota > 0 ? Math.round((k.facturado / k.cuota) * 100) : 0;
  const gapCol = k.gap > 300000 ? (theme.red || '#FF3B30') : k.gap > 100000 ? (theme.orange || '#FF9500') : (theme.green || '#34C759');
  const propias = propuestas.filter((p) => p.clienteKey === c.key);
  const ult = propias[0] || null;
  const borrador = propias.find((p) => p.estado === 'borrador') || null;
  const est = ult ? estadoInfo(ult.estado) : null;
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textMuted };
  const val = (color) => ({ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: color || theme.text });
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };
  return (
    <Panel elevable padding="0" style={{ cursor: 'pointer' }}>
      <div onClick={() => onNueva(c.key)} title={`Nueva propuesta para ${c.label}`}>
        <div style={{ height: 3, background: col, borderRadius: '12px 12px 0 0' }} />
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: col, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>{c.iniciales}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{c.label}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{c.marca}</div>
          </div>
          <Pill tone={k.cuota > 0 ? (pctC >= 100 ? 'green' : pctC >= 70 ? 'blue' : 'orange') : 'gray'} size="xs" style={{ marginLeft: 'auto' }}>{k.cuota > 0 ? `${pctC}% de cuota` : 'sin cuota'}</Pill>
        </div>
        <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
          <div><div style={lbl}>Cuota {MES_LABEL[MES_ACTUAL.mes - 1]}</div><div style={val()}>{moneyCompact(k.cuota)}</div></div>
          <div><div style={lbl}>Facturado</div><div style={val()}>{moneyCompact(k.facturado)}</div></div>
          <div><div style={lbl}>Gap</div><div style={val(k.gap > 0 ? gapCol : (theme.green || '#34C759'))}>{k.gap > 0 ? moneyCompact(k.gap) : '✓ Cumplida'}</div></div>
          <div><div style={lbl}>Propuestas</div><div style={val()}>{int(propias.length)}</div></div>
        </div>
        <div style={{ padding: '0 16px 10px', fontSize: 10.5, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 18 }}>
          {ult ? <>Última: <Pill tone={est.tone} size="xs">{est.label}</Pill> {ult.nombre || 'Sin nombre'} · {ult.resumen?.skus || 0} SKUs · {relativo(ult.updatedAt || ult.tstamp)}</> : 'Sin propuestas previas'}
        </div>
      </div>
      <div style={{ padding: '10px 16px 12px', borderTop: `1px solid ${theme.border}`, display: 'flex', gap: 6 }}>
        <Boton primario size="md" disabled={ocupado} style={{ flex: 1, justifyContent: 'center' }} onClick={stop(() => onNueva(c.key))}>Nueva propuesta <ArrowRight size={13} /></Boton>
        {borrador && (
          <Boton size="md" icon={Pencil} disabled={ocupado} title={`Retomar el borrador "${borrador.nombre || 'Sin nombre'}" (${relativo(borrador.updatedAt || borrador.tstamp)})`} onClick={stop(() => onContinuar(borrador))}
            style={{ maxWidth: '50%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Continuar{borrador.nombre ? ` · ${borrador.nombre}` : ''}</span>
          </Boton>
        )}
      </div>
    </Panel>
  );
}
