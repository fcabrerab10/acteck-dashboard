// Propuestas · Revisar y enviar (3.87.0 · 2026-10-06, mockup 792b61a8 pantalla 3 + «en la revisión poder cambiar de lista
// de precios por SKU y ver qué otros precios hay de ese mismo SKU»). Vista pura: la monta PropuestaEditor en modo 'revisar'.
import React, { useState } from 'react';
import { Share2, FileSpreadsheet, Send, Tag, Pencil } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HeroM, ListaAgrupada, Fila, BotonGrande, Pill, HojaM, Vacio } from '../../piezas';
import { listaShort, listaColor } from '../../../modules/comercial/propuestas/constantes';
import { vigenciaTexto } from '../../../modules/comercial/propuestas/textos';
import { money, int, MONO, N } from '../../util';

const fmtPrecio = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RevisarM({ cli, nombre, mes, vigencia, lineas = [], precios = new Map(), inventario = new Map(), stockCliente = new Map(), texto = '', total = 0, piezas = 0, ocupado = false, soporteShare = true, onLinea, onWhatsApp, onExcel, onEnviar, onCopiar }) {
  const { theme } = useTheme();
  const [sku, setSku] = useState(null);
  const sinPrecio = lineas.filter((l) => !(l.precio > 0)).length;
  const faltaStock = lineas.filter((l) => inventario.has(l.sku) && N(l.piezas) > N(inventario.get(l.sku))).length;
  const sel = sku ? lineas.find((l) => l.sku === sku) : null;
  const preciosSel = sku ? Object.entries(precios.get(sku) || {}).sort((a, b) => b[1] - a[1]) : [];
  return (
    <>
      <HeroM eyebrow={`Propuesta ${cli.label} · ${nombre || 'Cierre'} · vigente al ${vigenciaTexto(vigencia)}`} frase={money(total)}
        sub={[`${int(lineas.length)} SKU${lineas.length === 1 ? '' : 's'} · ${int(piezas)} pz`, piezas > 0 ? `${money(total / piezas)} prom. por pieza` : null, sinPrecio ? `${sinPrecio} sin precio` : null, faltaStock ? `${faltaStock} con más piezas de las que tenemos` : null].filter(Boolean).join(' · ')} />
      <ListaAgrupada titulo="Líneas" meta={lineas.length} style={{ marginTop: 18 }} pie="Toca una línea para cambiar su lista de precios: verás todos los precios de ese SKU.">
        {!lineas.length && <Vacio icon={null} titulo="Sin líneas" style={{ padding: '20px 16px' }} />}
        {lineas.map((l) => {
          const tenemos = inventario.get(l.sku), enCliente = stockCliente.get(l.sku);
          const custom = l.listaSel === '__custom';
          return (
            <Fila key={l.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{l.sku}{l.descripcion ? <span style={{ fontWeight: 400, color: theme.textMuted }}> {l.descripcion}</span> : null}</span>}
              sub={[`${int(l.piezas)} pz × ${fmtPrecio(l.precio)}`, custom ? 'personalizado' : listaShort(l.listaSel || '') || 'sin lista', enCliente != null ? `cliente ${int(enCliente)} pz` : null, tenemos != null ? (N(l.piezas) > N(tenemos) ? `tenemos ${int(tenemos)} (pides ${int(l.piezas)})` : `tenemos ${int(tenemos)}`) : null, l.spiff ? `SPIFF ${money(l.spiff)}` : null].filter(Boolean).join(' · ')}
              valor={money(N(l.piezas) * N(l.precio))} valorSub={tenemos != null && N(l.piezas) > N(tenemos) ? <span style={{ color: theme.red }}>falta stock</span> : null}
              pill={{ tone: custom ? 'orange' : 'gray', label: custom ? 'custom' : listaShort(l.listaSel || '') || '—' }} onClick={() => setSku(l.sku)} />
          );
        })}
      </ListaAgrupada>

      <ListaAgrupada titulo="Texto para el cliente" style={{ marginTop: 18 }} accion={onCopiar ? <Pill tone="gray" onClick={onCopiar} style={{ cursor: 'pointer' }}>Copiar</Pill> : null}>
        <pre style={{ margin: 0, padding: '12px 14px', fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, color: theme.textMuted, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>
      </ListaAgrupada>

      <div style={{ display: 'flex', gap: 8, margin: '18px 16px 0' }}>
        <BotonGrande icon={Share2} disabled={ocupado || !lineas.length} onClick={onWhatsApp} style={{ flex: 1 }}>WhatsApp</BotonGrande>
        <BotonGrande icon={FileSpreadsheet} disabled={ocupado || !lineas.length || sinPrecio > 0} onClick={onExcel} style={{ flex: 1 }}>{soporteShare ? 'Excel' : 'Excel ↓'}</BotonGrande>
        <BotonGrande primario icon={Send} disabled={ocupado || !lineas.length || sinPrecio > 0} onClick={onEnviar} style={{ flex: 1 }}>{ocupado ? '…' : 'Enviar'}</BotonGrande>
      </div>
      <div style={{ fontSize: 11.5, color: theme.textMuted, textAlign: 'center', padding: '8px 24px 0', lineHeight: 1.4 }}>WhatsApp manda el texto (sin costos ni listas). Excel genera el mismo libro que la computadora y lo comparte. Enviar la marca como enviada con su folio y abre la ventana de efectividad.</div>

      <HojaM abierto={!!sel} onClose={() => setSku(null)} titulo={sel ? sel.sku : ''} sub={sel ? `${sel.descripcion || ''} · precios de lista sin IVA` : ''} alto="70vh">
        {sel && (
          <ListaAgrupada pie="Los mismos precios de Estrategia de precios y del armador de escritorio. La lista de esta línea cambia sólo para este SKU.">
            {preciosSel.map(([l, p]) => <Fila key={l} icon={Tag} color={listaColor(l)} titulo={l} sub={N(sel.precio) > 0 && p !== N(sel.precio) ? `${p > N(sel.precio) ? '+' : ''}${Math.round(((p - N(sel.precio)) / N(sel.precio)) * 100)} % vs el precio actual` : 'precio actual'} valor={fmtPrecio(p)} chevron={false}
              trailing={sel.listaSel === l ? <Pill tone="blue">Elegida</Pill> : null} onClick={() => { onLinea?.(sel.sku, { listaSel: l, precio: p }); setSku(null); }} />)}
            {!preciosSel.length && <Vacio icon={null} titulo="Sin precios de lista" sub="Este SKU no tiene precio en las listas; queda el personalizado." style={{ padding: 16 }} />}
            <Fila icon={Pencil} color={theme.orange} titulo="Personalizado" sub={`hoy ${fmtPrecio(sel.precio)} · se edita en el armador`} chevron={false} trailing={sel.listaSel === '__custom' ? <Pill tone="orange">Actual</Pill> : null} />
          </ListaAgrupada>
        )}
      </HojaM>
    </>
  );
}
