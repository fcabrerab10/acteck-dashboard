// Hoja "Compartir disponibilidad" · 1 o N SKUs (canasta). Lista de precios OBLIGATORIA
// (sin opción por defecto, no se recuerda entre sesiones); vista previa del texto exacto
// de lib/whatsapp.textoDisponibilidad; Compartir (navigator.share o wa.me) y Copiar (+ toast).
import React, { useEffect, useMemo, useState } from 'react';
import { Share2, Copy, Tag, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Modal } from '../../../components/perfil/comun';
import { Pill, Boton, Skeleton, toast } from '../../../components/kit';
import { compartir, copiar, precio as fmtPrecio } from '../../../lib/whatsapp';
import { usePreciosLista, armarTexto } from './compartir';
import { fmtInt, MONO } from './constantes';

export default function CompartirHoja({ abierto, rows, onClose, onQuitar }) {
  const { theme } = useTheme();
  const [lista, setLista] = useState(null);
  useEffect(() => { if (abierto) setLista(null); }, [abierto]); // obligatoria: sin default, se elige cada vez
  const skus = useMemo(() => (rows || []).map((r) => r.sku), [rows]);
  const { porSku, listas, cargando, error } = usePreciosLista(skus, abierto);
  const listaValida = lista && listas.includes(lista) ? lista : null;
  const texto = useMemo(() => armarTexto(rows, porSku, listaValida), [rows, porSku, listaValida]);
  const n = rows?.length || 0;
  const conPrecio = listaValida ? rows.filter((r) => porSku.get(r.sku)?.[listaValida]).length : 0;

  const onCompartir = async () => {
    if (!texto) return;
    const r = await compartir(texto);
    if (r === 'share') toast.ok('Compartido');
    else if (r === 'whatsapp') toast.ok('Abriendo WhatsApp…');
  };
  const onCopiar = async () => {
    if (!texto) return;
    const ok = await copiar(texto);
    if (ok) toast.ok('Texto copiado'); else toast.error('No se pudo copiar');
  };

  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} ancho={560}
      titulo={n === 1 ? 'Compartir disponibilidad' : `Compartir ${fmtInt(n)} SKUs`}
      sub="Precio de lista sin IVA · el texto no lleva el nombre de la lista ni costos"
      pie={(
        <>
          <Boton icon={Copy} onClick={onCopiar} disabled={!texto}>Copiar</Boton>
          <Boton icon={Share2} primario onClick={onCompartir} disabled={!texto}>Compartir</Boton>
        </>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
        {/* SKUs incluidos */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(rows || []).map((r) => (
            <Pill key={r.sku} tone="gray" size="xs" title={r.descripcion} style={{ fontFamily: MONO, gap: 6 }}>
              {r.sku}
              {onQuitar && n > 1 && <X size={10} style={{ cursor: 'pointer' }} onClick={() => onQuitar(r.sku)} />}
            </Pill>
          ))}
        </div>

        {/* Lista de precios (obligatoria) */}
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: listaValida ? theme.textMuted : theme.orange, fontWeight: 600, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Tag size={11} /> Lista de precios {listaValida ? '' : '· elige una'}
          </div>
          {cargando && <Skeleton h={26} r={999} />}
          {!cargando && error && <span style={{ fontSize: 11.5, color: theme.red }}>No se pudieron leer los precios.</span>}
          {!cargando && !error && listas.length === 0 && <span style={{ fontSize: 11.5, color: theme.textMuted }}>Ninguno de estos SKUs tiene precio de lista cargado.</span>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {listas.map((l) => {
              const on = l === listaValida;
              const cuantos = rows.filter((r) => porSku.get(r.sku)?.[l]).length;
              return (
                <Pill key={l} tone={on ? 'blue' : 'gray'} size="sm" onClick={() => setLista(l)} title={`${cuantos} de ${n} SKU con precio en esta lista`}
                  style={{ cursor: 'pointer', border: `1px solid ${on ? theme.accent : theme.border}`, padding: '4px 11px' }}>
                  {l}{n > 1 ? ` · ${cuantos}/${n}` : ''}
                </Pill>
              );
            })}
          </div>
          {listaValida && n > 1 && conPrecio < n && <div style={{ fontSize: 10.5, color: theme.orange, marginTop: 6 }}>{n - conPrecio} SKU sin precio en {listaValida}: saldrán con "—".</div>}
          {listaValida && n === 1 && (
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {porSku.get(rows[0].sku)?.[listaValida] ? `${fmtPrecio(porSku.get(rows[0].sku)[listaValida].precio)} + IVA` : 'sin precio en esta lista'}
            </div>
          )}
        </div>

        {/* Vista previa */}
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>Vista previa</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: TYPO.fontText, fontSize: 12, lineHeight: 1.45, color: texto ? theme.text : theme.textMuted, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', maxHeight: 260, overflowY: 'auto' }}>
            {texto || 'Elige una lista de precios para armar el mensaje.'}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
