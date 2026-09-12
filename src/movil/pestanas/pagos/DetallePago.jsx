// Detalle de un pago (móvil) · hoja desde abajo con el cálculo, el flujo y las acciones:
// Copiar correo · Autorizar · Capturar folio · Registrar pago (adjuntar el PDF de la NC
// desde el celular; el dashboard lo lee y propone folio, fecha, factura, importe, IVA y total).
import React, { useEffect, useState } from 'react';
import { Mail, Check, Hash, FileText, Upload } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HojaM, BotonGrande, ListaAgrupada, Fila, Pill, toast } from '../../piezas';
import { money, MONO } from '../../util';
import { ESTADO_META, TIPO_META, siguienteEstado } from '../../../modules/comercial/pagosv3/estados';
import { CLIENTE_LABEL, reglaDe } from '../../../modules/comercial/pagosv3/reglas';
import { correoSolicitud } from '../../../modules/comercial/pagosv3/correo';
import { leerNotaCredito } from '../../../modules/comercial/pagosv3/leerNotaCredito';
import { cambiarEstado, subirPdfNotaCredito, leerBitacora } from '../../../modules/comercial/pagosv3/datos';

export default function DetallePago({ pago, abierto, onCerrar, perfil, reglas, puedeEditar, onCambio }) {
  const { theme } = useTheme();
  const [folio, setFolio] = useState('');
  const [nc, setNc] = useState(null);          // { campos, archivo }
  const [ocupado, setOcupado] = useState(false);
  const [bitacora, setBitacora] = useState([]);

  useEffect(() => {
    setFolio(pago?.folio || ''); setNc(null);
    if (pago?.id) leerBitacora(pago.id).then(setBitacora).catch(() => setBitacora([]));
  }, [pago?.id]);

  if (!pago) return null;
  const sig = siguienteEstado(pago.estado);
  const reglaDest = reglaDe(reglas, '_global', 'destinatarios');

  const copiarCorreo = async () => {
    const c = correoSolicitud({ pago, perfil, reglaDestinatarios: reglaDest });
    try { await navigator.clipboard.writeText(c.texto); toast.ok('Correo copiado'); }
    catch { toast.error('No se pudo copiar en este navegador'); }
  };

  const mover = async (hacia, extra, nota) => {
    setOcupado(true);
    try { await cambiarEstado({ pago, hacia, perfil, extra, nota }); toast.ok(ESTADO_META[hacia]?.label || 'Listo'); await onCambio?.(); }
    catch (e) { toast.error(e.message || String(e)); }
    finally { setOcupado(false); }
  };

  const tomarPdf = async (file) => {
    if (!file) return;
    setOcupado(true);
    const r = await leerNotaCredito(file);
    setOcupado(false);
    if (!r.ok) { toast.error(r.motivo || 'No se pudo leer el PDF'); setNc({ campos: {}, archivo: file }); return; }
    setNc({ campos: r.campos, archivo: file });
    toast.ok('PDF leído · revisa y confirma');
  };

  const registrarPago = async () => {
    if (!nc?.campos?.nc_folio) { toast.error('Adjunta el PDF de la nota de crédito (o captúrala en la computadora).'); return; }
    setOcupado(true);
    try {
      const ruta = nc.archivo ? await subirPdfNotaCredito({ pago, archivo: nc.archivo }) : null;
      await cambiarEstado({
        pago, hacia: 'pagado', perfil, nota: `NC ${nc.campos.nc_folio}`,
        extra: { ...nc.campos, nc_pdf_path: ruta, fecha_pago_real: nc.campos.nc_fecha || null },
      });
      toast.ok('Pago registrado');
      await onCambio?.();
    } catch (e) { toast.error(e.message || String(e)); }
    finally { setOcupado(false); }
  };

  const d = pago.detalle || {};

  return (
    <HojaM abierto={abierto} onClose={onCerrar} titulo={pago.concepto}
           sub={`${CLIENTE_LABEL[pago.cliente]} · ${TIPO_META[pago.tipo]?.label || pago.tipo} · ${money(pago.monto)}`} alto="86vh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 16px' }}>
          <Pill tone={ESTADO_META[pago.estado]?.tone || 'gray'} dot>{ESTADO_META[pago.estado]?.label || pago.estado}</Pill>
          <Pill tone={pago.origen === 'auto' ? 'blue' : 'gray'} size="xs">{pago.origen === 'auto' ? 'automático' : 'manual'}</Pill>
          {pago.periodo && <Pill tone="gray" size="xs">{pago.periodo}</Pill>}
          {pago.fecha_programada && <Pill tone="gray" size="xs">pago {String(pago.fecha_programada).slice(5, 10).replace('-', '/')}</Pill>}
        </div>

        {(d.filas || []).length > 0 && (
          <ListaAgrupada titulo="Cálculo y evidencia"
                         pie={d.alcance != null ? `Alcance ${(d.alcance * 100).toFixed(0)} %${d.nivel ? ` · ${d.nivel}` : ''}` : undefined}>
            {(d.filas || []).map((f, i) => (
              <Fila key={i} titulo={f.concepto}
                    sub={[f.base != null ? `base ${money(f.base)}` : null, f.pct != null ? `${(f.pct * 100).toFixed(2)} %` : null, f.premio || null].filter(Boolean).join(' · ')}
                    valor={money(f.monto)} chevron={false} />
            ))}
          </ListaAgrupada>
        )}

        {pago.nc_folio && (
          <ListaAgrupada titulo="Nota de crédito">
            <Fila titulo="Folio" valor={pago.nc_folio} chevron={false} />
            {pago.nc_factura && <Fila titulo="Aplicada a" valor={pago.nc_factura} chevron={false} />}
            {pago.nc_total != null && <Fila titulo="Total" valor={money(pago.nc_total)} chevron={false} />}
          </ListaAgrupada>
        )}

        {bitacora.length > 0 && (
          <ListaAgrupada titulo="Bitácora" meta={bitacora.length}>
            {bitacora.slice(-6).map((b) => (
              <Fila key={b.id} titulo={ESTADO_META[b.estado_nuevo]?.label || b.estado_nuevo}
                    sub={`${b.usuario || '—'}${b.nota ? ` · ${b.nota}` : ''}`}
                    valor={String(b.at).slice(5, 10).replace('-', '/')} chevron={false} />
            ))}
          </ListaAgrupada>
        )}

        {puedeEditar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
            {['calculado', 'solicitado'].includes(pago.estado) && (
              <BotonGrande icon={Mail} onClick={copiarCorreo}>Copiar correo</BotonGrande>
            )}
            {pago.estado === 'calculado' && (
              <BotonGrande primario icon={Check} disabled={ocupado} onClick={() => mover('solicitado')}>Marcar como solicitado</BotonGrande>
            )}
            {pago.estado === 'solicitado' && (
              <BotonGrande primario icon={Check} disabled={ocupado} onClick={() => mover('autorizado')}>Autorizar</BotonGrande>
            )}
            {pago.estado === 'autorizado' && (
              <>
                <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Folio de finanzas"
                       style={{ height: 44, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: '0 12px', fontFamily: TYPO.fontText, fontSize: 15 }} />
                <BotonGrande primario icon={Hash} disabled={ocupado || !folio.trim()} onClick={() => mover('folio', { folio: folio.trim() })}>Capturar folio</BotonGrande>
              </>
            )}
            {pago.estado === 'folio' && (
              <>
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12,
                  border: `1.5px dashed ${theme.border}`, color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 14,
                }}>
                  <Upload size={16} />
                  {nc?.archivo ? nc.archivo.name : 'Adjuntar PDF de la nota de crédito'}
                  <input type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => tomarPdf(e.target.files?.[0])} />
                </label>
                {nc?.campos?.nc_folio && (
                  <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: MONO, lineHeight: 1.6 }}>
                    NC {nc.campos.nc_folio} · {nc.campos.nc_fecha || '—'}<br />
                    Factura {nc.campos.nc_factura || '—'} · total {money(nc.campos.nc_total)}
                  </div>
                )}
                <BotonGrande primario icon={FileText} disabled={ocupado || !nc?.campos?.nc_folio} onClick={registrarPago}>Registrar pago</BotonGrande>
              </>
            )}
          </div>
        )}
        {!puedeEditar && (
          <div style={{ padding: '0 16px', fontSize: 12, color: theme.textMuted }}>Sólo lectura: no tienes permiso de edición en {CLIENTE_LABEL[pago.cliente]}.</div>
        )}
      </div>
    </HojaM>
  );
}
