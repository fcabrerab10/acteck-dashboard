// Detalle de un pago (fila expandida) · cálculo y evidencia · flujo · correo · bitácora.
import React, { useEffect, useState } from 'react';
import { Copy, Mail, History, Check, X, FileText, Trash2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Panel, Pill, toast } from '../../../components/kit';
import { correoSolicitud, mailto } from './correo';
import { siguienteEstado, faltaPara, ESTADO_META } from './estados';
import { LineaTiempo, TablaEvidencia, mxn2, Nota, AreaTexto, Entrada, CampoInline, MONO } from './ui';
import { leerBitacora, urlPdfNotaCredito } from './datos';

export default function DrillPago({ pago, perfil, puedeEditar, reglaDestinatarios, onAccion, onRegistrarPago, onBorrar }) {
  const { theme } = useTheme();
  const [correo, setCorreo] = useState(null);
  const [bitacora, setBitacora] = useState(null);
  const [verBitacora, setVerBitacora] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [folio, setFolio] = useState(pago.folio || '');
  const [urlPdf, setUrlPdf] = useState(null);

  useEffect(() => { setFolio(pago.folio || ''); }, [pago.id, pago.folio]);
  useEffect(() => {
    let vivo = true;
    if (pago.nc_pdf_path) urlPdfNotaCredito(pago.nc_pdf_path).then((u) => { if (vivo) setUrlPdf(u); });
    return () => { vivo = false; };
  }, [pago.nc_pdf_path]);

  const generarCorreo = () => {
    const c = correoSolicitud({ pago, perfil, reglaDestinatarios });
    setCorreo(c);
    return c;
  };

  const copiar = async () => {
    const c = correo || generarCorreo();
    try {
      await navigator.clipboard.writeText(c.texto);
      toast.ok('Correo copiado · pégalo en tu cliente de correo');
    } catch {
      setCorreo(c);
      toast.error('No se pudo copiar solo: selecciona el texto de abajo');
    }
  };

  const abrirBitacora = async () => {
    setVerBitacora((v) => !v);
    if (bitacora === null) setBitacora(await leerBitacora(pago.id));
  };

  const sig = siguienteEstado(pago.estado);
  const falta = sig ? faltaPara({ ...pago, folio }, sig) : null;

  const avanzar = async () => {
    if (!sig) return;
    if (sig === 'pagado') { onRegistrarPago?.(pago); return; }
    if (sig === 'folio') {
      if (!folio.trim()) { toast.error('Captura el folio de finanzas.'); return; }
      await onAccion?.({ pago, hacia: 'folio', extra: { folio: folio.trim() } });
      return;
    }
    if (sig === 'solicitado') {
      const c = correo || generarCorreo();
      await onAccion?.({ pago, hacia: 'solicitado', nota: `Correo: ${c.asunto}` });
      return;
    }
    await onAccion?.({ pago, hacia: sig });
  };

  const hair = `1px solid ${theme.border}`;
  const cajita = { border: hair, borderRadius: 10, padding: 10, minWidth: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 4px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 10 }}>
        <div style={cajita}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>Cálculo y evidencia</div>
          <TablaEvidencia detalle={pago.detalle} />
          {pago.notas && <Nota style={{ marginTop: 6 }}>{pago.notas}</Nota>}
        </div>
        <div style={cajita}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>Nota de crédito</div>
          {pago.nc_folio ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
              <Dato k="Folio NC" v={pago.nc_folio} />
              <Dato k="Fecha" v={pago.nc_fecha} />
              <Dato k="Aplicada a" v={pago.nc_factura} />
              <Dato k="Cliente" v={pago.nc_razon_social} />
              <Dato k="RFC" v={pago.nc_rfc} />
              <Dato k="Concepto" v={pago.nc_concepto} />
              <Dato k="Importe" v={pago.nc_importe != null ? mxn2(pago.nc_importe) : null} />
              <Dato k="IVA" v={pago.nc_iva != null ? mxn2(pago.nc_iva) : null} />
              <Dato k="Total" v={pago.nc_total != null ? mxn2(pago.nc_total) : null} />
              {pago.nc_referencia && <Dato k="Referencia" v={pago.nc_referencia} />}
              {pago.nc_observaciones && <Dato k="Observaciones" v={pago.nc_observaciones} />}
              {urlPdf && <a href={urlPdf} target="_blank" rel="noreferrer" style={{ color: theme.accent || '#007AFF', fontSize: 11, display: 'inline-flex', gap: 4, alignItems: 'center', marginTop: 4 }}><FileText size={12} /> Ver PDF</a>}
            </div>
          ) : (
            <Nota>Se captura al registrar el pago: se adjunta el PDF de la NC y el dashboard propone folio, fecha, factura aplicada, importe, IVA y total.</Nota>
          )}
        </div>
      </div>

      <LineaTiempo pago={pago} />

      {puedeEditar && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {sig === 'folio' && (
            <CampoInline label="Folio de finanzas" ancho={160}>
              <Entrada value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="F-2291" />
            </CampoInline>
          )}
          {sig && (
            <Boton primario icon={Check} onClick={avanzar} title={falta || undefined}>
              {ESTADO_META[pago.estado]?.accion || 'Avanzar'}
            </Boton>
          )}
          {['calculado', 'solicitado'].includes(pago.estado) && (
            <Boton icon={Mail} onClick={copiar}>Copiar correo</Boton>
          )}
          {['solicitado', 'autorizado', 'folio'].includes(pago.estado) && (
            <Boton icon={X} onClick={() => setPidiendoMotivo((v) => !v)}>Rechazar</Boton>
          )}
          {pago.estado === 'rechazado' && (
            <Boton primario onClick={() => onAccion?.({ pago, hacia: 'calculado', nota: 'Reabierto' })}>Volver a calculado</Boton>
          )}
          {pago.estado !== 'pagado' && pago.estado !== 'cancelado' && (
            <Boton onClick={() => onAccion?.({ pago, hacia: 'cancelado', nota: 'Marcado como No aplica' })}>No aplica</Boton>
          )}
          <Boton icon={History} onClick={abrirBitacora}>Bitácora</Boton>
          {pago.origen === 'manual' && pago.estado !== 'pagado' && (
            <Boton peligro icon={Trash2} onClick={() => onBorrar?.(pago)}>Borrar</Boton>
          )}
        </div>
      )}

      {pidiendoMotivo && (
        <div style={{ ...cajita, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <CampoInline label="Motivo del rechazo">
            <AreaTexto rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué se regresa el pago" />
          </CampoInline>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Boton onClick={() => setPidiendoMotivo(false)}>Cancelar</Boton>
            <Boton primario disabled={!motivo.trim()} onClick={async () => {
              await onAccion?.({ pago, hacia: 'rechazado', nota: motivo, extra: { motivo_rechazo: motivo } });
              setPidiendoMotivo(false); setMotivo('');
            }}>Rechazar</Boton>
          </div>
        </div>
      )}

      {correo && (
        <div style={{ ...cajita, background: theme.surfaceHover || 'transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>Correo de solicitud</div>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <Boton icon={Copy} onClick={copiar}>Copiar</Boton>
              <a href={mailto(correo)} style={{ textDecoration: 'none' }}><Boton icon={Mail}>Abrir en correo</Boton></a>
            </span>
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.5, ...MONO, color: theme.text, maxHeight: 320, overflowY: 'auto' }}>{correo.texto}</pre>
        </div>
      )}

      {verBitacora && (
        <div style={cajita}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>Bitácora</div>
          {(bitacora || []).length === 0 ? <Nota>Sin movimientos registrados.</Nota> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(bitacora || []).map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 11 }}>
                  <span style={{ ...MONO, color: theme.textMuted, whiteSpace: 'nowrap' }}>{String(b.at).slice(0, 16).replace('T', ' ')}</span>
                  <Pill tone={ESTADO_META[b.estado_nuevo]?.tone || 'gray'} size="xs">{ESTADO_META[b.estado_nuevo]?.label || b.estado_nuevo}</Pill>
                  <span style={{ color: theme.textMuted }}>{b.usuario}</span>
                  {b.nota && <span style={{ color: theme.textMuted }}>· {b.nota}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Dato({ k, v }) {
  const { theme } = useTheme();
  if (!v) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
      <span style={{ color: theme.textMuted, whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ ...MONO, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
    </div>
  );
}
