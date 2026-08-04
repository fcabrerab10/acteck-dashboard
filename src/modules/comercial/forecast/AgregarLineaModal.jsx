// AgregarLineaModal — al hacer "+" en un SKU de la tabla, abre un modal
// que pregunta cuánto agregar al borrador.
//
// Rediseño Fase 4 · sistema visual del dashboard:
//   · SF Pro Display + Text · iOS palette · hairlines · píldoras
//   · Segmented iOS · input grande con +/− centrado
//   · Hero negro compacto con SKU · descripción · último costo
//
// Modos:
//   · Por contenedores (1, 2, 3, ...) — usa piezas_por_contenedor del SKU
//   · Cantidad personalizada (input directo)
// Si el SKU es consolidado o no tiene historial, solo permite cantidad
// personalizada.

import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');
const FMT_USD = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;
const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtFechaC(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return iso;
  return `${d} ${MES_CORTO[m - 1]} ${String(y).slice(2)}`;
}

export default function AgregarLineaModal({ row, onConfirm, onClose }) {
  const { theme, isDark } = useTheme();
  const semGreen = '#1C7A34';

  const piezasPorCnt = Number(row?.piezasPorContenedor || 0);
  const sugeridoCnt  = Number(row?.contenedoresSugeridos || 0);
  const sugeridoPzs  = Number(row?.sugerido || 0);
  const ultUsd       = Number(row?.ultimoCostoUsd || row?.costoUnitUsd || 0);
  const ultima       = row?.ultimaCompra || null;
  const tieneCnt = piezasPorCnt > 0 && !row?.esConsolidado;

  const [modo, setModo] = useState(tieneCnt ? 'contenedor' : 'custom');
  const [contenedores, setContenedores] = useState(Math.max(1, sugeridoCnt));
  const [piezasCustom, setPiezasCustom] = useState(sugeridoPzs > 0 ? sugeridoPzs : '');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setModo(tieneCnt ? 'contenedor' : 'custom');
    setContenedores(Math.max(1, sugeridoCnt));
    setPiezasCustom(sugeridoPzs > 0 ? sugeridoPzs : '');
  }, [row?.sku, tieneCnt, sugeridoCnt, sugeridoPzs]);

  const cantidadFinal = useMemo(() => {
    if (modo === 'contenedor' && tieneCnt) {
      return Math.max(0, Math.round(contenedores)) * piezasPorCnt;
    }
    return Math.max(0, Math.round(Number(piezasCustom) || 0));
  }, [modo, contenedores, piezasCustom, piezasPorCnt, tieneCnt]);

  const valorEstUsd = cantidadFinal * ultUsd;

  if (!row) return null;

  const handleConfirm = async () => {
    if (cantidadFinal <= 0) return;
    setEnviando(true);
    try {
      await onConfirm(cantidadFinal);
    } finally {
      setEnviando(false);
    }
  };

  // ═══ estilos ═══
  const backdrop = {
    position: 'fixed', inset: 0, zIndex: 50,
    background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
    animation: 'modalFadeIn 180ms cubic-bezier(0.32, 0.72, 0, 1) both',
  };
  const modal = {
    background: theme.surface, border: `1px solid ${theme.border}`,
    borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden',
    animation: 'modalPop 240ms cubic-bezier(0.32, 0.72, 0, 1) both',
    boxShadow: isDark
      ? '0 20px 60px rgba(0,0,0,.55)'
      : '0 20px 60px rgba(0,0,0,.18)',
  };

  return (
    <div style={backdrop} onClick={onClose}>
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalPop {
          from { opacity: 0; transform: translateY(6px) scale(.98) }
          to   { opacity: 1; transform: translateY(0)   scale(1) }
        }
      `}</style>
      <div style={modal} onClick={(e) => e.stopPropagation()}>

        {/* ═══ HERO negro compacto ═══ */}
        <div style={{
          background: '#000', color: '#F5F5F7',
          padding: '14px 18px',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700,
              letterSpacing: '.09em', textTransform: 'uppercase',
              color: 'rgba(245,245,247,.6)', marginBottom: 4,
            }}>Agregar al export · {row.sku}</div>
            <div style={{
              fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.015em', color: '#F5F5F7', lineHeight: 1.25,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }} title={row.descripcion}>
              {row.descripcion || row.sku}
            </div>
            <div style={{
              fontFamily: TYPO.fontText, fontSize: 11, color: 'rgba(245,245,247,.6)',
              marginTop: 4, letterSpacing: '-0.005em',
            }}>
              {row.supplier || 'Sin proveedor'}
              {tieneCnt && ` · 1 cnt = ${FMT_N(piezasPorCnt)} pz`}
              {ultUsd > 0 && <> · <span style={{ color: '#30D158', fontWeight: 600 }}>${ultUsd.toFixed(2)} USD</span></>}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            style={{
              width: 28, height: 28, borderRadius: 999,
              background: 'rgba(255,255,255,.08)', color: '#F5F5F7',
              border: 0, fontSize: 14, cursor: 'pointer', lineHeight: 1,
            }}
            title="Cerrar"
          >✕</button>
        </div>

        {/* ═══ Última compra + Sugerido sistema ═══ */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.divider || theme.border}` }}>
          {ultima ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700,
                letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted,
              }}>Última compra</div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11.5,
                color: theme.text, letterSpacing: '-0.005em', marginTop: 2,
              }}>
                <span><span style={{ color: theme.textMuted }}>Fecha</span> <strong style={{ fontWeight: 600 }}>{fmtFechaC(ultima.fecha)}</strong></span>
                <span><span style={{ color: theme.textMuted }}>Piezas</span> <strong style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'SF Mono, ui-monospace, monospace' }}>{FMT_N(ultima.piezas)}</strong></span>
                <span><span style={{ color: theme.textMuted }}>Contenedor</span> <strong style={{ color: ultima.esConsolidado ? (theme.orange || '#FF9500') : semGreen }}>
                  {ultima.esConsolidado ? 'consolidado' : '1 completo'}
                </strong></span>
                {ultima.po && <span><span style={{ color: theme.textMuted }}>PO</span> <strong style={{ fontFamily: 'SF Mono, ui-monospace, monospace' }}>{ultima.po}</strong></span>}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: theme.orange || '#FF9500', fontStyle: 'italic', letterSpacing: '-0.005em' }}>
              ⓘ Sin historial de compras de este SKU
            </div>
          )}

          {/* Sugerido sistema · card destacada */}
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: isDark ? 'rgba(10,132,255,.10)' : 'rgba(0,122,255,.06)',
            border: `1px solid ${theme.accent}33`, borderRadius: 10,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.accent }}>
                Sugerido sistema
              </div>
              <div style={{
                fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600,
                letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums',
                marginTop: 2,
              }}>
                {sugeridoPzs > 0 ? (
                  <>{FMT_N(sugeridoPzs)}<span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, marginLeft: 4 }}>pz</span></>
                ) : <span style={{ color: theme.textMuted, fontWeight: 500 }}>—</span>}
              </div>
              {sugeridoCnt > 0 && (
                <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2 }}>
                  {sugeridoCnt} contenedor{sugeridoCnt !== 1 ? 'es' : ''}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted }}>
                Pz / cnt
              </div>
              <div style={{
                fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600,
                letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums',
                marginTop: 2,
              }}>
                {tieneCnt ? FMT_N(piezasPorCnt) : (
                  <span style={{ color: theme.orange || '#FF9500', fontWeight: 500, fontSize: 12, fontStyle: 'italic' }}>
                    {row?.esConsolidado ? 'consolidado' : 'sin data'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Selector modo + input ═══ */}
        <div style={{ padding: '18px' }}>
          {tieneCnt && (
            <div style={{
              display: 'inline-flex', background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
              borderRadius: 8, padding: 2, marginBottom: 16, width: '100%',
            }}>
              <button
                type="button" onClick={() => setModo('contenedor')}
                style={{
                  flex: 1, border: 0, padding: '7px 12px', borderRadius: 6,
                  background: modo === 'contenedor' ? theme.surface : 'transparent',
                  color: modo === 'contenedor' ? theme.text : theme.textMuted,
                  fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '-0.005em',
                  boxShadow: modo === 'contenedor' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                }}
              >Por contenedor</button>
              <button
                type="button" onClick={() => setModo('custom')}
                style={{
                  flex: 1, border: 0, padding: '7px 12px', borderRadius: 6,
                  background: modo === 'custom' ? theme.surface : 'transparent',
                  color: modo === 'custom' ? theme.text : theme.textMuted,
                  fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '-0.005em',
                  boxShadow: modo === 'custom' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                }}
              >Piezas personalizadas</button>
            </div>
          )}

          {modo === 'contenedor' && tieneCnt ? (
            <div>
              <div style={{
                fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700,
                letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8,
              }}>¿Cuántos contenedores?</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <QtyBtn onClick={() => setContenedores(Math.max(1, contenedores - 1))} theme={theme}>−</QtyBtn>
                <input
                  type="number" min="1" step="1" value={contenedores}
                  onChange={(e) => setContenedores(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: 100, textAlign: 'center', fontFamily: TYPO.fontDisplay,
                    fontSize: 42, fontWeight: 600, letterSpacing: '-0.04em',
                    color: theme.text, fontVariantNumeric: 'tabular-nums',
                    border: 0, background: 'transparent', outline: 'none',
                  }}
                />
                <QtyBtn onClick={() => setContenedores(contenedores + 1)} theme={theme}>+</QtyBtn>
              </div>
              <div style={{
                textAlign: 'center', fontSize: 11.5, color: theme.textMuted,
                marginTop: 4, letterSpacing: '-0.005em', fontVariantNumeric: 'tabular-nums',
              }}>
                {contenedores} × {FMT_N(piezasPorCnt)} pz = <strong style={{ color: theme.text, fontWeight: 600 }}>{FMT_N(cantidadFinal)} piezas</strong>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700,
                letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8,
              }}>Cantidad personalizada</div>
              <input
                type="number" min="1" step="1" value={piezasCustom}
                onChange={(e) => setPiezasCustom(e.target.value)}
                placeholder="0"
                autoFocus
                style={{
                  width: '100%', textAlign: 'center', fontFamily: TYPO.fontDisplay,
                  fontSize: 36, fontWeight: 600, letterSpacing: '-0.035em',
                  color: theme.text, fontVariantNumeric: 'tabular-nums',
                  border: `1px solid ${theme.border}`, background: 'transparent',
                  borderRadius: 12, padding: '8px 14px', outline: 'none',
                }}
              />
              <div style={{
                textAlign: 'center', fontSize: 11, color: theme.textMuted,
                marginTop: 6, letterSpacing: '-0.005em', fontVariantNumeric: 'tabular-nums',
              }}>
                {tieneCnt && cantidadFinal > 0 && (
                  <>≈ {(cantidadFinal / piezasPorCnt).toFixed(2)} contenedor{cantidadFinal / piezasPorCnt !== 1 ? 'es' : ''}
                  {cantidadFinal % piezasPorCnt !== 0 && (
                    <span style={{ color: theme.orange || '#FF9500', marginLeft: 4 }}>(no completa cnt exacto)</span>
                  )}</>
                )}
                {row?.esConsolidado && (
                  <div style={{ color: theme.orange || '#FF9500', fontStyle: 'italic', marginTop: 4 }}>
                    ⓘ Consolidado — comparte contenedor con otros SKUs
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Resumen final ═══ */}
          <div style={{
            marginTop: 16, padding: '12px 14px',
            background: isDark ? 'rgba(48,209,88,.12)' : 'rgba(52,199,89,.10)',
            border: `1px solid ${(theme.green || '#34C759')}44`, borderRadius: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: semGreen }}>
                Total a agregar
              </span>
              <span style={{
                fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600,
                letterSpacing: '-0.025em', color: semGreen, fontVariantNumeric: 'tabular-nums',
              }}>
                {FMT_N(cantidadFinal)}<span style={{ fontSize: 12, marginLeft: 4, fontWeight: 500 }}>pz</span>
              </span>
            </div>
            {valorEstUsd > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5, color: semGreen, letterSpacing: '-0.005em' }}>
                <span>Costo estimado</span>
                <span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{FMT_USD(valorEstUsd)} USD</span>
              </div>
            )}
          </div>

          {/* ═══ Botones ═══ */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button" onClick={onClose} disabled={enviando}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 999,
                background: 'transparent', border: `1px solid ${theme.border}`,
                color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600,
                cursor: enviando ? 'not-allowed' : 'pointer', letterSpacing: '-0.005em',
                opacity: enviando ? 0.5 : 1,
              }}
            >Cancelar</button>
            <button
              type="button" onClick={handleConfirm}
              disabled={enviando || cantidadFinal <= 0}
              style={{
                flex: 2, padding: '10px 16px', borderRadius: 999,
                background: theme.accent || '#007AFF', border: 0, color: '#fff',
                fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600,
                cursor: (enviando || cantidadFinal <= 0) ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.005em',
                opacity: (enviando || cantidadFinal <= 0) ? 0.4 : 1,
              }}
            >{enviando ? 'Agregando…' : 'Agregar al export'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QtyBtn({ children, onClick, theme }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: 12,
        border: `1px solid ${theme.border}`, background: theme.surface,
        color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600,
        fontSize: 20, lineHeight: 1, cursor: 'pointer',
      }}
    >{children}</button>
  );
}
