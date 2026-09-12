// Hojas de acción de Pagos (móvil) · las abre un gesto de la bandeja o el detalle del pago.
//   · HojaCorreo     — "Copiar correo": Para/CC, asunto y cuerpo reales; al copiar marca Solicitado
//                      (si ya está solicitado, copia el MISMO texto para reenviar y no mueve el flujo).
//   · HojaFolio      — captura del folio que asignó finanzas.
//   · HojaRegistrar  — registrar el pago adjuntando el PDF de la nota de crédito (lo lee leerNotaCredito).
//   · HojaConfirmar  — confirmación corta (autorizar, reabrir un rechazado).
// Toda la lógica viene de src/modules/comercial/pagosv3 (correo.js · leerNotaCredito.js · datos.js).
import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Check, Hash, FileText, Upload, RotateCcw } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HojaM, BotonGrande, ListaAgrupada, Fila, Segmented, toast } from '../../piezas';
import { money, MONO } from '../../util';
import { CLIENTE_LABEL, reglaDe } from '../../../modules/comercial/pagosv3/reglas';
import { TIPO_META } from '../../../modules/comercial/pagosv3/estados';
import { correoSolicitud, mailto } from '../../../modules/comercial/pagosv3/correo';
import { leerNotaCredito } from '../../../modules/comercial/pagosv3/leerNotaCredito';
import { cambiarEstado, subirPdfNotaCredito } from '../../../modules/comercial/pagosv3/datos';

const sub = (p) => (p ? `${CLIENTE_LABEL[p.cliente] || p.cliente} · ${TIPO_META[p.tipo]?.label || p.tipo} · ${money(p.monto)}` : '');

/** Copia al portapapeles con respaldo para navegadores sin Clipboard API (iOS en http). */
export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* respaldo abajo */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// ───────────────────────── Copiar correo ─────────────────────────
export function HojaCorreo({ pago, abierto, onCerrar, perfil, reglas = [], puedeEditar, onSolicitado }) {
  const { theme } = useTheme();
  const reglaDest = useMemo(() => reglaDe(reglas, '_global', 'destinatarios'), [reglas]);
  const mia = String(perfil?.email || '').toLowerCase().startsWith('karolina') ? 'karolina' : 'fernando';
  const [quien, setQuien] = useState(mia);
  useEffect(() => { setQuien(mia); }, [mia, pago?.id]);

  const firmante = quien === mia ? perfil : { nombre: quien === 'karolina' ? 'Karolina' : 'Fernando' };
  const correo = useMemo(
    () => (pago ? correoSolicitud({ pago, perfil: firmante, reglaDestinatarios: reglaDest }) : null),
    [pago, firmante?.nombre, reglaDest], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!pago || !correo) return null;

  const reenvio = pago.estado !== 'calculado';
  const marcar = !reenvio && puedeEditar;

  const alCopiar = async () => {
    const ok = await copiar(correo.texto);
    if (!ok) { toast.error('No se pudo copiar en este navegador'); return; }
    if (marcar) { onSolicitado?.(pago); onCerrar?.(); return; }
    toast.ok(reenvio ? 'Correo copiado para reenviar' : 'Correo copiado');
    onCerrar?.();
  };

  return (
    <HojaM abierto={abierto} onClose={onCerrar} titulo="Copiar correo" sub={sub(pago)} alto="82vh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
        <ListaAgrupada titulo="Solicita">
          <div style={{ padding: '10px 12px' }}>
            <Segmented size="md" style={{ display: 'flex', width: '100%' }} value={quien} onChange={setQuien}
              options={[{ id: 'fernando', label: 'Fernando' }, { id: 'karolina', label: 'Karolina' }]} />
          </div>
        </ListaAgrupada>

        <ListaAgrupada titulo="Para · CC">
          <Fila titulo="Para" sub={correo.para.join(', ') || '—'} chevron={false} />
          <Fila titulo="CC" sub={correo.cc.join(', ') || '—'} chevron={false} />
        </ListaAgrupada>

        <ListaAgrupada titulo="Asunto" pie={reenvio ? 'El pago ya está solicitado: copiar aquí sólo te da el texto para reenviarlo; no mueve el flujo.' : 'Al copiar, el pago pasa a Solicitado (puedes deshacerlo desde el aviso).'}>
          <Fila titulo={correo.asunto} chevron={false} />
          <div style={{ padding: '10px 12px', fontFamily: TYPO.fontText, fontSize: 12.5, lineHeight: 1.5, color: theme.textMuted, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}>
            {correo.cuerpo}
          </div>
        </ListaAgrupada>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
          <BotonGrande icon={Mail} onClick={() => { window.location.href = mailto(correo); }}>Abrir en Mail</BotonGrande>
          <BotonGrande primario icon={Check} onClick={alCopiar}>
            {marcar ? 'Copiar y marcar solicitado' : 'Copiar correo'}
          </BotonGrande>
        </div>
      </div>
    </HojaM>
  );
}

// ───────────────────────── Capturar folio ─────────────────────────
export function HojaFolio({ pago, abierto, onCerrar, onGuardar, ocupado }) {
  const { theme } = useTheme();
  const [folio, setFolio] = useState('');
  useEffect(() => { setFolio(pago?.folio || ''); }, [pago?.id, abierto]);
  if (!pago) return null;
  return (
    <HojaM abierto={abierto} onClose={onCerrar} titulo="Folio de finanzas" sub={sub(pago)} alto="44vh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 20px' }}>
        <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Folio de finanzas" autoFocus
          style={{ height: 46, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, padding: '0 12px', fontFamily: MONO, fontSize: 16 }} />
        <BotonGrande primario icon={Hash} disabled={ocupado || !folio.trim()} onClick={() => onGuardar?.(folio.trim())}>Capturar folio</BotonGrande>
      </div>
    </HojaM>
  );
}

// ───────────────────────── Registrar pago (PDF de la NC) ─────────────────────────
export function HojaRegistrar({ pago, abierto, onCerrar, perfil, onHecho }) {
  const { theme } = useTheme();
  const [nc, setNc] = useState(null);      // { campos, archivo }
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setNc(null); }, [pago?.id, abierto]);
  if (!pago) return null;

  const tomarPdf = async (file) => {
    if (!file) return;
    setOcupado(true);
    const r = await leerNotaCredito(file);
    setOcupado(false);
    if (!r.ok) { toast.error(r.motivo || 'No se pudo leer el PDF'); setNc({ campos: {}, archivo: file }); return; }
    setNc({ campos: r.campos, archivo: file });
    toast.ok('PDF leído · revisa y confirma');
  };

  const registrar = async () => {
    if (!nc?.campos?.nc_folio) { toast.error('Adjunta el PDF de la nota de crédito (o captúrala en la computadora).'); return; }
    setOcupado(true);
    try {
      const ruta = nc.archivo ? await subirPdfNotaCredito({ pago, archivo: nc.archivo }) : null;
      await cambiarEstado({
        pago, hacia: 'pagado', perfil, nota: `NC ${nc.campos.nc_folio}`,
        extra: { ...nc.campos, nc_pdf_path: ruta, fecha_pago_real: nc.campos.nc_fecha || null },
      });
      toast.ok('Pago registrado');
      await onHecho?.();
      onCerrar?.();
    } catch (e) { toast.error(e.message || String(e)); }
    finally { setOcupado(false); }
  };

  const c = nc?.campos || {};
  return (
    <HojaM abierto={abierto} onClose={onCerrar} titulo="Registrar pago" sub={sub(pago)} alto="78vh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
        <ListaAgrupada titulo="Pago">
          <Fila titulo={pago.concepto} sub={`${CLIENTE_LABEL[pago.cliente] || pago.cliente}${pago.folio ? ` · folio finanzas ${pago.folio}` : ''}`} valor={money(pago.monto)} chevron={false} />
        </ListaAgrupada>

        <div style={{ padding: '0 16px' }}>
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 74, borderRadius: 12,
            border: `1.5px dashed ${theme.border}`, color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 14, textAlign: 'center', padding: '10px 14px',
          }}>
            <Upload size={16} />
            {nc?.archivo ? nc.archivo.name : 'Adjuntar PDF de la nota de crédito'}
            <input type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => tomarPdf(e.target.files?.[0])} />
          </label>
        </div>

        {c.nc_folio && (
          <ListaAgrupada titulo="Leído del PDF · confirma">
            <Fila titulo="Nota de crédito" valor={c.nc_folio} chevron={false} />
            <Fila titulo="Fecha" valor={c.nc_fecha || '—'} chevron={false} />
            <Fila titulo="Aplicada a factura" valor={c.nc_factura || '—'} chevron={false} />
            <Fila titulo="Importe · IVA · Total" valor={`${money(c.nc_importe)} · ${money(c.nc_iva)} · ${money(c.nc_total)}`} chevron={false} />
            {c.nc_concepto && <Fila titulo="Concepto" sub={c.nc_concepto} chevron={false} />}
          </ListaAgrupada>
        )}

        <div style={{ padding: '0 16px' }}>
          <BotonGrande primario icon={FileText} disabled={ocupado || !c.nc_folio} onClick={registrar}>Confirmar pagado</BotonGrande>
        </div>
      </div>
    </HojaM>
  );
}

// ───────────────────────── Confirmación corta ─────────────────────────
export function HojaConfirmar({ abierto, onCerrar, titulo, sub: subtitulo, texto, label = 'Confirmar', icon = Check, onOk, ocupado }) {
  const { theme } = useTheme();
  return (
    <HojaM abierto={abierto} onClose={onCerrar} titulo={titulo} sub={subtitulo} alto="40vh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 20px' }}>
        {texto && <div style={{ fontFamily: TYPO.fontText, fontSize: 13.5, color: theme.textMuted, lineHeight: 1.5 }}>{texto}</div>}
        <BotonGrande primario icon={icon} disabled={ocupado} onClick={onOk}>{label}</BotonGrande>
        <BotonGrande icon={RotateCcw} onClick={onCerrar}>Cancelar</BotonGrande>
      </div>
    </HojaM>
  );
}

export default { HojaCorreo, HojaFolio, HojaRegistrar, HojaConfirmar, copiar };
