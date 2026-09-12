// Tarjeta por cliente · narrativa + barra de cuota (mínima e ideal, marca del día) + 4 KpiCard + acciones.
// Clic en la tarjeta → onDrillDown (Home del cliente). "Ir a" abre un popover con Sell In · Sell Out · Cobranza.
import React, { useEffect, useRef, useState } from 'react';
import { Share2, Copy, ChevronDown, Home, TrendingUp, ShoppingCart, Wallet } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { elevation, bordeFlotante } from '../../../lib/elevation';
import { compartir, copiar } from '../../../lib/whatsapp';
import { KpiCard, Pill, Boton, toast } from '../../../components/kit';
import { estatusCliente, esPeriodoActual, diasDelMes, labelPeriodo } from './calculo';
import { fmtCompact, fmtInt, fmtPct, narrativaCliente, textoCumplimiento, textoAvanceCliente } from './textos';

export function colorCliente(theme, key) {
  return { digitalife: theme.accent || '#007AFF', pcel: theme.red || '#FF3B30', dicotech: theme.purple || '#AF52DE' }[key] || theme.accent || '#007AFF';
}

const DESTINOS = [
  { pagina: 'home',       label: 'Home del cliente', icon: Home },
  { pagina: 'sellIn',     label: 'Sell In',          icon: TrendingUp },
  { pagina: 'estrategia', label: 'Sell Out',         icon: ShoppingCart },
  { pagina: 'cartera',    label: 'Cobranza',         icon: Wallet },
];

/** Barra de avance de cuota: 100 % = ideal; marca de la mínima si difiere; marca del día si el mes es el actual. */
function BarraCuota({ r, theme }) {
  const green = theme.green || '#34C759', orange = theme.orange || '#FF9500', red = theme.red || '#FF3B30';
  const base = r.cuotaIdeal ?? r.cuotaMin;
  if (!base) return <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, margin: '2px 0 10px' }}>Sin cuota registrada para {labelPeriodo(r.periodo)}.</div>;
  const pct = Math.min(100, (r.siMes / base) * 100);
  const cumpl = r.cumplIdeal ?? r.cumplMin;
  const col = cumpl == null ? theme.textMuted : cumpl >= 90 ? green : cumpl >= 80 ? orange : red;
  const minPos = r.dosCuotas ? Math.min(100, (r.cuotaMin / base) * 100) : null;
  const actual = esPeriodoActual(r.periodo);
  const diaPos = actual ? Math.min(100, (new Date().getDate() / diasDelMes(r.periodo)) * 100) : null;
  const tick = (left, color, title, dashed) => (
    <span title={title} style={{ position: 'absolute', top: -3, bottom: -3, left: `${left}%`, width: 0, borderLeft: `${dashed ? '1px dashed' : '2px solid'} ${color}`, transform: 'translateX(-50%)' }} />
  );
  return (
    <div style={{ margin: '2px 0 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 10.5, marginBottom: 5, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: theme.textMuted }}>{textoCumplimiento(r)}</span>
        <span style={{ color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap' }}>
          {fmtCompact(r.siMes)} / {fmtCompact(base)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 999, background: `${theme.text}0F` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(0, pct)}%`, background: col, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
        </div>
        {minPos != null && tick(minPos, theme.text, `Cuota mínima · ${fmtCompact(r.cuotaMin)}`, false)}
        {diaPos != null && tick(diaPos, theme.textMuted, `Día ${new Date().getDate()} de ${diasDelMes(r.periodo)}`, true)}
      </div>
      {(minPos != null || diaPos != null) && (
        <div style={{ display: 'flex', gap: 10, fontSize: 9.5, color: theme.textSubtle || theme.textMuted, marginTop: 4 }}>
          {minPos != null && <span>│ mínima {fmtCompact(r.cuotaMin)}</span>}
          {r.dosCuotas && <span>ideal {fmtCompact(r.cuotaIdeal)}</span>}
          {diaPos != null && <span>┊ hoy</span>}
        </div>
      )}
    </div>
  );
}

export default function TarjetaCliente({ cliente, resumen: r, margen, verSensible, onDrillDown, onNavegar }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const status = estatusCliente(r);
  const col = colorCliente(theme, cliente.key);
  const green = theme.green || '#34C759', orange = theme.orange || '#FF9500', red = theme.red || '#FF3B30';
  const nar = narrativaCliente(r);

  useEffect(() => {
    if (!menu) return;
    const fuera = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [menu]);

  const texto = textoAvanceCliente(cliente, r);
  const onCompartir = async (e) => { e.stopPropagation(); const res = await compartir(texto, { titulo: `Avance ${cliente.nombre}` }); if (res === 'share') toast.ok('Compartido'); else if (res === 'whatsapp') toast.info('Abriendo WhatsApp…'); };
  const onCopiar = async (e) => { e.stopPropagation(); if (await copiar(texto)) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };
  const ir = (pagina) => { setMenu(false); if (pagina === 'home') onDrillDown?.(); else onNavegar?.(cliente.key, pagina); };

  const dsoCol = r.dsoReal == null ? theme.text : r.dsoReal <= r.dsoPlazo ? theme.text : r.dsoReal <= r.dsoPlazo + 30 ? orange : red;
  const yoyBadge = (v) => (v == null ? null : { l: `${v >= 0 ? '↑' : '↓'} ${Math.abs(v).toFixed(0)}% YoY`, tone: v >= 0 ? 'green' : 'red' });

  return (
    <div onClick={() => onDrillDown?.()}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${col}`, borderRadius: 12,
        fontFamily: TYPO.fontText, cursor: 'pointer', overflow: 'visible', position: 'relative',
        transform: hover ? 'translateY(-1px)' : 'none', boxShadow: elevation(theme, hover ? 'hover' : 'reposo'),
        transition: `transform ${DUR.state}ms ${EASE}, box-shadow ${DUR.state}ms ${EASE}`,
        display: 'flex', flexDirection: 'column',
      }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: col, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em', flexShrink: 0 }}>{cliente.letter}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{cliente.nombre}.</div>
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{cliente.marca}</div>
          </div>
        </div>
        <Pill tone={status.tone} dot>{status.label}</Pill>
      </div>

      <div style={{ padding: '12px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {/* Narrativa */}
        <p style={{ fontSize: 11.5, color: theme.textMuted, margin: 0, lineHeight: 1.5 }}>
          {nar.sinDatos ? (
            <>Sin sell in en {labelPeriodo(r.periodo)} ni acumulado del año.</>
          ) : (
            <>
              Sell in de {labelPeriodo(r.periodo)} en <strong style={{ color: theme.text }}>{nar.sellIn}</strong>
              {nar.yoy != null && <> · <span style={{ color: nar.yoy >= 0 ? green : red }}>{nar.yoy >= 0 ? '▲' : '▼'} {Math.abs(nar.yoy).toFixed(0)}% vs {r.periodo.anio - 1}</span></>}
              . {nar.cobranza}
            </>
          )}
        </p>

        <BarraCuota r={r} theme={theme} />

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <KpiCard eyebrow={r.selloutEstimado ? 'Sell Out · estimado a lista' : 'Sell Out · sin IVA'} big={fmtCompact(r.soMes)} badge={yoyBadge(r.soYoY)}
            sub={r.soMes > 0 && r.siMes > 0 ? `${fmtPct((r.soMes / r.siMes) * 100)} del sell in` : 'Sin sell out del mes'} />
          <KpiCard eyebrow="Cartera" big={fmtCompact(r.saldoActual)} bigColor={r.pctVencido > 15 ? red : theme.text}
            badge={r.saldoVencido > 0 ? { l: `${fmtCompact(r.saldoVencido)} venc.`, tone: r.pctVencido > 15 ? 'red' : 'orange' } : (r.corteFecha ? { l: 'al día', tone: 'green' } : null)}
            sub={r.dsoReal != null ? <>DSO <span style={{ color: dsoCol, fontWeight: 600 }}>{r.dsoReal}d</span> · plazo {r.dsoPlazo}d{r.facturasAbiertas > 0 && <> · {fmtInt(r.facturasAbiertas)} fact.</>}</> : (r.corteFecha ? `corte ${r.corteFecha}` : 'sin corte en el periodo')} />
          <KpiCard eyebrow="Cobertura" big={r.coberturaDias != null ? `${r.coberturaDias}d` : '—'}
            bigColor={r.coberturaDias == null ? theme.text : r.coberturaDias < 30 ? red : r.coberturaDias < 60 ? orange : theme.text}
            sub={r.inventarioPiezas > 0 || r.inventarioValor > 0
              ? (r.inventarioValor > 0 ? `Inv. ${fmtCompact(r.inventarioValor)} · ${fmtInt(r.inventarioPiezas)} pz` : `Inv. ${fmtInt(r.inventarioPiezas)} pz`)
              : 'Sin inventario al corte'} />
          {verSensible ? (
            <KpiCard eyebrow="MC %" big={margen ? fmtPct(margen.mcMes, 1) : '…'}
              bigColor={margen?.mcMes == null ? theme.text : margen.mcMes >= 25 ? green : margen.mcMes >= 18 ? theme.text : orange}
              sub={margen ? `YTD ${fmtPct(margen.mcYTD, 1)} · contrib. ${fmtCompact(margen.contribucionMes)}` : 'Cargando medidas…'} />
          ) : (
            <KpiCard eyebrow="Acumulado" big={fmtCompact(r.siYTD)}
              sub={r.cumplYTDIdeal != null ? `${fmtPct(r.cumplYTDIdeal)} de la cuota YTD` : `Sell in ${r.periodo.anio}`} />
          )}
        </div>

        {/* Acciones */}
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 4, cursor: 'default' }}>
          <Boton primario icon={Share2} onClick={onCompartir} title="Compartir avance por WhatsApp">Compartir avance</Boton>
          <Boton icon={Copy} onClick={onCopiar} title="Copiar texto" />
          <div ref={menuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <Boton icon={ChevronDown} onClick={() => setMenu((v) => !v)} title="Ir a una pestaña del cliente">Ir a</Boton>
            {menu && (
              <div style={{
                position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', zIndex: 20, minWidth: 170, padding: 6,
                background: theme.surface, border: bordeFlotante(theme), borderRadius: 12, boxShadow: elevation(theme, 'flotante'),
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                {DESTINOS.map((d) => (
                  <button key={d.pagina} type="button" onClick={() => ir(d.pagina)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: 0, borderRadius: 8, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <d.icon size={13} strokeWidth={2} style={{ color: theme.textMuted }} />{d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
