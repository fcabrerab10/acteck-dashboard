// "Registrar pago" · el pago sale por nota de crédito: se adjunta el PDF, el dashboard
// lee folio/fecha/factura/importe/IVA/total y Fernando confirma antes de guardar.
import React, { useRef, useState } from 'react';
import { Upload, Check } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { leerNotaCredito } from './leerNotaCredito';
import { subirPdfNotaCredito } from './datos';
import { CampoInline, Entrada, AreaTexto, Nota, mxn2, MONO } from './ui';

const vacio = {
  nc_folio: '', nc_fecha: '', nc_factura: '', nc_razon_social: '', nc_rfc: '',
  nc_concepto: '', nc_importe: '', nc_iva: '', nc_total: '',
  nc_servicio_tipo: '', nc_referencia: '', nc_observaciones: '',
};

export default function HojaRegistrarPago({ pago, abierto, onCerrar, onGuardar }) {
  const { theme } = useTheme();
  const [campos, setCampos] = useState(vacio);
  const [archivo, setArchivo] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [leido, setLeido] = useState(null);   // { ok, motivo }
  const [guardando, setGuardando] = useState(false);
  const inputRef = useRef(null);

  React.useEffect(() => {
    if (abierto && pago) {
      setCampos({ ...vacio, nc_importe: String(pago.monto ?? ''), nc_razon_social: pago.nc_razon_social || '' });
      setArchivo(null); setLeido(null);
    }
  }, [abierto, pago?.id]);

  const set = (k) => (e) => setCampos((c) => ({ ...c, [k]: e.target.value }));

  const tomarArchivo = async (file) => {
    if (!file) return;
    setArchivo(file);
    setLeyendo(true);
    const r = await leerNotaCredito(file);
    setLeyendo(false);
    setLeido(r);
    if (r.ok) {
      setCampos((c) => ({
        ...c,
        nc_folio: r.campos.nc_folio || c.nc_folio,
        nc_fecha: r.campos.nc_fecha || c.nc_fecha,
        nc_factura: r.campos.nc_factura || c.nc_factura,
        nc_razon_social: r.campos.nc_razon_social || c.nc_razon_social,
        nc_rfc: r.campos.nc_rfc || c.nc_rfc,
        nc_concepto: r.campos.nc_concepto || c.nc_concepto,
        nc_importe: r.campos.nc_importe != null ? String(r.campos.nc_importe) : c.nc_importe,
        nc_iva: r.campos.nc_iva != null ? String(r.campos.nc_iva) : c.nc_iva,
        nc_total: r.campos.nc_total != null ? String(r.campos.nc_total) : c.nc_total,
      }));
      toast.ok('PDF leído · revisa los datos y confirma');
    } else {
      toast.error(r.motivo || 'No se pudo leer el PDF; captura los datos a mano');
    }
  };

  const guardar = async () => {
    if (!campos.nc_folio.trim()) { toast.error('Falta el folio de la nota de crédito.'); return; }
    setGuardando(true);
    try {
      let ruta = null;
      if (archivo) ruta = await subirPdfNotaCredito({ pago, archivo });
      await onGuardar?.({
        pago,
        extra: {
          nc_folio: campos.nc_folio.trim() || null,
          nc_fecha: campos.nc_fecha || null,
          nc_factura: campos.nc_factura.trim() || null,
          nc_razon_social: campos.nc_razon_social.trim() || null,
          nc_rfc: campos.nc_rfc.trim() || null,
          nc_concepto: campos.nc_concepto.trim() || null,
          nc_importe: campos.nc_importe === '' ? null : Number(campos.nc_importe),
          nc_iva: campos.nc_iva === '' ? null : Number(campos.nc_iva),
          nc_total: campos.nc_total === '' ? null : Number(campos.nc_total),
          nc_servicio_tipo: campos.nc_servicio_tipo.trim() || null,
          nc_referencia: campos.nc_referencia.trim() || null,
          nc_observaciones: campos.nc_observaciones.trim() || null,
          nc_pdf_path: ruta,
          nc_uuid: leido?.campos?.nc_uuid || null,
          fecha_pago_real: campos.nc_fecha || null,
        },
      });
      onCerrar?.();
    } catch (e) {
      toast.error(e.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const difImporte = campos.nc_importe !== '' && Math.abs(Number(campos.nc_importe) - Number(pago?.monto || 0)) > 0.5;

  return (
    <HojaLateral
      abierto={abierto} onClose={onCerrar} theme={theme} ancho={480}
      titulo="Registrar pago"
      sub={pago ? `${pago.concepto} · ${mxn2(pago.monto)}` : ''}
      acciones={<Boton primario icon={Check} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Confirmar pago'}</Boton>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); tomarArchivo(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1.5px dashed ${theme.border}`, borderRadius: 12, padding: 14, textAlign: 'center',
            cursor: 'pointer', color: theme.textMuted, fontSize: 12,
          }}
        >
          <Upload size={16} style={{ marginBottom: 4 }} />
          <div>{archivo ? archivo.name : 'Arrastra el PDF de la nota de crédito (o toca para elegirlo)'}</div>
          {leyendo && <div style={{ marginTop: 4, fontSize: 11 }}>Leyendo el PDF…</div>}
          {leido && !leido.ok && <div style={{ marginTop: 4, fontSize: 11, color: theme.orange }}>{leido.motivo}</div>}
          {leido?.ok && <div style={{ marginTop: 4, fontSize: 11, color: theme.green }}>Datos propuestos desde el PDF — revísalos.</div>}
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }}
                 onChange={(e) => tomarArchivo(e.target.files?.[0])} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CampoInline label="Folio NC"><Entrada value={campos.nc_folio} onChange={set('nc_folio')} placeholder="B13719" /></CampoInline>
          <CampoInline label="Fecha"><Entrada type="date" value={campos.nc_fecha} onChange={set('nc_fecha')} /></CampoInline>
          <CampoInline label="Factura a la que se aplicó"><Entrada value={campos.nc_factura} onChange={set('nc_factura')} placeholder="A10379702" /></CampoInline>
          <CampoInline label="RFC del cliente"><Entrada value={campos.nc_rfc} onChange={set('nc_rfc')} placeholder="DMT0911105L5" /></CampoInline>
        </div>
        <CampoInline label="Razón social"><Entrada value={campos.nc_razon_social} onChange={set('nc_razon_social')} /></CampoInline>
        <CampoInline label="Concepto"><Entrada value={campos.nc_concepto} onChange={set('nc_concepto')} placeholder="Bonificación · Nota Credito 13890 · CAMPAÑA ADS 2026 (1/4)" /></CampoInline>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <CampoInline label="Importe"><Entrada type="number" step="0.01" value={campos.nc_importe} onChange={set('nc_importe')} /></CampoInline>
          <CampoInline label="IVA"><Entrada type="number" step="0.01" value={campos.nc_iva} onChange={set('nc_iva')} /></CampoInline>
          <CampoInline label="Total"><Entrada type="number" step="0.01" value={campos.nc_total} onChange={set('nc_total')} /></CampoInline>
        </div>
        {difImporte && <Nota style={{ color: theme.orange }}>El importe de la NC ({mxn2(campos.nc_importe)}) no coincide con el pago ({mxn2(pago?.monto)}). Revisa antes de confirmar.</Nota>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CampoInline label="Servicio tipo"><Entrada value={campos.nc_servicio_tipo} onChange={set('nc_servicio_tipo')} placeholder="del correo de finanzas" /></CampoInline>
          <CampoInline label="Referencia de bonificación"><Entrada value={campos.nc_referencia} onChange={set('nc_referencia')} /></CampoInline>
        </div>
        <CampoInline label="Observaciones"><AreaTexto rows={2} value={campos.nc_observaciones} onChange={set('nc_observaciones')} /></CampoInline>

        {leido?.texto && (
          <details>
            <summary style={{ fontSize: 11, color: theme.textMuted, cursor: 'pointer' }}>Ver el texto leído del PDF</summary>
            <pre style={{ ...MONO, fontSize: 10, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', color: theme.textMuted }}>{leido.texto}</pre>
          </details>
        )}
      </div>
    </HojaLateral>
  );
}
