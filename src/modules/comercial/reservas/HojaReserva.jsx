// Hoja lateral "Mi reserva" (patrón del carrito de S&OP): nombre editable · piezas reservadas vs recomendadas
// · cobertura por cliente · SKUs en la propuesta · compartir por WhatsApp por cliente (sin datos sensibles)
// · Generar / Vaciar. Se abre desde la pill flotante "Reserva · N pz".
import React, { useEffect, useMemo, useState } from 'react';
import { Share2, Copy, Trash2, Send, X } from 'lucide-react';
import { HojaLateral, Campo, Seccion, Grupo } from '../../../components/perfil/comun';
import { Pill, Boton, Segmented, toast } from '../../../components/kit';
import { TYPO } from '../../../lib/themeTokens';
import { compartir, copiar } from '../../../lib/whatsapp';
import { MONO } from '../inventario/constantes';
import { CLIENTES, fmtInt, N, textoReservaCliente } from './textos';

const colorPct = (theme, p) => (p >= 95 ? theme.green : p >= 70 ? theme.orange : theme.red);

export default function HojaReserva({ abierto, onClose, theme, propuesta, lineas, filasPorSku, kpis, stats, nombre, onRenombrar, onGenerar, onVaciar, onVerSku, onEliminarSku, saving }) {
  const [nombreLocal, setNombreLocal] = useState(nombre);
  useEffect(() => setNombreLocal(nombre), [nombre]);
  const [cliente, setCliente] = useState('digitalife');

  const totalRecom = kpis.totalRecom || 0, totalReservo = kpis.totalReservo || 0;
  const pct = totalRecom > 0 ? Math.round((totalReservo / totalRecom) * 100) : 0;
  const faltantes = Math.max(0, totalRecom - totalReservo);
  const numLineas = Object.keys(lineas).length;
  const generada = propuesta?.estatus === 'generada';

  // Piezas por cliente = reservo prorrateado por su necesidad (si el SKU no tiene necesidad por cliente, va completo).
  const lineasCliente = useMemo(() => stats.enPropuesta.map((s) => {
    const f = filasPorSku.get(s.sku) || s;
    const nec = f.necesidad?.[cliente] || 0;
    const piezas = f.recomendado > 0 ? Math.round(s.reservo * (nec / f.recomendado)) : s.reservo;
    return { sku: s.sku, descripcion: f.descripcion, piezas, arribo: lineas[s.sku]?.fecha_arribo_estimada || f.proxArribo || null };
  }).filter((l) => l.piezas > 0), [stats.enPropuesta, filasPorSku, cliente, lineas]);

  const texto = () => textoReservaCliente({ cliente, nombre, lineas: lineasCliente });
  const onCompartir = async () => {
    if (!lineasCliente.length) { toast.info('Este cliente no tiene piezas en la reserva.'); return; }
    const r = await compartir(texto(), { titulo: `Reserva · ${CLIENTES.find((c) => c.key === cliente)?.label}` });
    if (r) toast.ok(r === 'share' ? 'Reserva compartida' : 'Se abrió WhatsApp con la reserva');
  };
  const onCopiar = async () => {
    if (!lineasCliente.length) { toast.info('Este cliente no tiene piezas en la reserva.'); return; }
    if (await copiar(texto())) toast.ok('Texto copiado'); else toast.error('No se pudo copiar');
  };

  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, fontWeight: 600 };

  return (
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} ancho={460} titulo="Mi reserva"
      sub={`Forecast · Reservas${propuesta ? ` · ${generada ? 'generada' : 'borrador'}` : ' · sin propuesta activa'}`}
      acciones={numLineas > 0 ? <Pill tone="green" dot>Autoguardado</Pill> : null}>
      <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
        <div>
          <div style={{ ...lbl, marginBottom: 4 }}>Nombre</div>
          <Campo theme={theme} value={nombreLocal} onChange={setNombreLocal} ancho="100%" placeholder="Preventa & Reservas · mes"
            onBlur={() => { if (nombreLocal !== nombre) onRenombrar(nombreLocal); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </div>

        <Grupo theme={theme} style={{ padding: '12px 14px' }}>
          <div style={lbl}>Piezas reservadas</div>
          <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: theme.accent, lineHeight: 1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {fmtInt(totalReservo)} <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, fontFamily: TYPO.fontDisplay }}>/ {fmtInt(totalRecom)} pz recomendadas</span>
          </div>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 6 }}>
            <b style={{ color: theme.text, fontWeight: 600 }}>{pct}% de la necesidad</b>
            {faltantes > 0 && <> · <b style={{ color: theme.orange, fontWeight: 600 }}>{fmtInt(faltantes)} pz</b> por reservar</>}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {CLIENTES.map((c) => {
              const cob = stats.cobertura[c.key];
              const p = cob.recom > 0 ? Math.round((cob.reservo / cob.recom) * 100) : 0;
              const col = colorPct(theme, p);
              return (
                <div key={c.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, fontSize: 11.5 }}>
                    <Pill tone={c.tone} size="xs" dot>{c.label}</Pill>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      <b style={{ color: col, fontWeight: 700 }}>{p}%</b> · {fmtInt(cob.reservo)} / {fmtInt(cob.recom)}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: `${theme.text}0F`, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: col, width: `${Math.min(100, p)}%`, transition: 'width 300ms ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Grupo>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={lbl}>SKUs en la reserva</span>
            <span style={{ color: theme.accent, fontWeight: 600, fontSize: 10.5, fontFamily: TYPO.fontDisplay }}>{stats.enPropuesta.length} SKUs · {fmtInt(totalReservo)} pz</span>
          </div>
          <Grupo theme={theme}>
            {stats.enPropuesta.length === 0 && <div style={{ padding: 14, fontSize: 12, color: theme.textMuted }}>Escribe piezas en la columna <b style={{ color: theme.text }}>Reservo</b> de la tabla para armar la reserva.</div>}
            {stats.enPropuesta.map((s, i) => (
              <div key={s.sku} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 8, alignItems: 'center', padding: '7px 12px', borderTop: i ? `1px solid ${theme.border}` : 0 }}>
                <button type="button" onClick={() => onVerSku(s.sku)} style={{ minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: theme.text, fontFamily: TYPO.fontText }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: theme.accent, fontWeight: 600, display: 'block' }}>{s.sku}</span>
                  <span title={s.descripcion} style={{ display: 'block', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{s.descripcion}</span>
                </button>
                <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(s.reservo)}<span style={{ fontSize: 9.5, color: theme.textSubtle || theme.textMuted, fontWeight: 500, marginLeft: 2, fontFamily: TYPO.fontDisplay }}>pz</span></span>
                <button type="button" onClick={() => onEliminarSku(s.sku)} title="Quitar de la reserva" aria-label="Quitar"
                  style={{ width: 22, height: 22, borderRadius: 999, border: 0, background: 'transparent', color: theme.textSubtle || theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </Grupo>
        </div>

        <div>
          <Seccion theme={theme} style={{ padding: '4px 0 6px' }}>Compartir por WhatsApp</Seccion>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Segmented value={cliente} onChange={setCliente} options={CLIENTES.map((c) => ({ id: c.key, label: c.label }))} />
            <span style={{ flex: 1 }} />
            <Boton icon={Copy} onClick={onCopiar} disabled={!lineasCliente.length}>Copiar</Boton>
            <Boton icon={Share2} primario onClick={onCompartir} disabled={!lineasCliente.length}>Compartir</Boton>
          </div>
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, lineHeight: 1.45 }}>
            {lineasCliente.length ? `${lineasCliente.length} SKU${lineasCliente.length === 1 ? '' : 's'} · ${fmtInt(lineasCliente.reduce((a, l) => a + N(l.piezas), 0))} pz para ${CLIENTES.find((c) => c.key === cliente)?.label}` : 'Este cliente no tiene piezas en la reserva.'} · SKU, nombre, piezas y arribo estimado; sin precios ni costos.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6, borderTop: `1px solid ${theme.border}` }}>
          <Boton primario size="md" icon={Send} onClick={onGenerar} disabled={saving || numLineas === 0 || generada} style={{ justifyContent: 'center' }}>
            {generada ? 'Propuesta generada' : 'Generar propuesta'}
          </Boton>
          <Boton size="md" icon={Trash2} peligro onClick={onVaciar} disabled={numLineas === 0} style={{ justifyContent: 'center' }}>Vaciar reserva</Boton>
        </div>
      </div>
    </HojaLateral>
  );
}
