// Mi export (S&OP móvil) · hoja desde abajo con las líneas del borrador activo de solicitudes_compra
// (mismas tablas que ExportCart en escritorio: solicitudes_compra + solicitudes_compra_lineas, estado 'borrador';
// lo que se agrega en el celular aparece en la computadora y viceversa). Cantidad editable, quitar deslizando y
// "Terminar propuesta y exportar": genera el MISMO Excel que escritorio (forecast/excelSOP.js), lo comparte con
// src/lib/compartirArchivo.js (WhatsApp/correo) y cierra el borrador como solicitud 'pendiente' (igual que
// "Cerrar borrador" + "Exportar a Excel" en la computadora), marcando exportada_en.
//
//   <SOPExport abierto onClose sol={useSolicitudes(perfil)} borrador lineas rows puedeEditar />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Share2, FileSpreadsheet, ClipboardList, Minus, Plus } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { solicitudExcelBlob } from '../../modules/comercial/forecast/excelSOP';
import { compartirArchivo, puedeCompartirArchivos } from '../../lib/compartirArchivo';
import { supabase } from '../../lib/supabase';
import { HojaM, ListaAgrupada, FilaDeslizable, BotonGrande, Vacio, Pill, toast } from '../piezas';
import { int, relativo, MONO } from '../util';

const USD = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

/** Campo numérico con − / + (44 px de alto táctil). onChange recibe el número; commit al soltar el foco o con Enter. */
export function CampoCantidad({ value, onChange, paso = 1, min = 0, ancho = 132, autoFocus = false }) {
  const { theme } = useTheme();
  const [txt, setTxt] = useState(String(value ?? ''));
  useEffect(() => { setTxt(String(value ?? '')); }, [value]);
  const commit = (v) => { const n = Math.max(min, Math.round(Number(v) || 0)); setTxt(String(n)); if (n !== Number(value)) onChange(n); };
  const btn = (Icon, delta, label) => (
    <button type="button" aria-label={label} onClick={() => commit((Number(txt) || 0) + delta)}
      style={{ width: 38, height: 40, border: 0, background: 'transparent', color: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
      <Icon size={17} strokeWidth={2.4} />
    </button>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 40, width: ancho, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bg, overflow: 'hidden' }}>
      {btn(Minus, -paso, 'Menos')}
      <input inputMode="numeric" pattern="[0-9]*" value={txt} autoFocus={autoFocus}
        onChange={(e) => setTxt(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => commit(txt)}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(txt); e.currentTarget.blur(); } }}
        style={{ flex: 1, minWidth: 0, width: 40, textAlign: 'center', border: 0, outline: 'none', background: 'transparent', fontFamily: MONO, fontSize: 15, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }} />
      {btn(Plus, paso, 'Más')}
    </span>
  );
}

/** Líneas "frescas" como escritorio (ejecutarExportacion): contenedores recalculados con el motor actual. */
function refrescarLineas(lineas, rows) {
  const bySku = new Map((rows || []).map((r) => [r.sku, r]));
  return lineas.map((l) => {
    const r = bySku.get(l.sku);
    if (!r) return l;
    const ppc = Number(r.piezasPorContenedor || 0);
    const consol = !!r.esConsolidado;
    const cnts = ppc > 0 && !consol ? Math.ceil(Number(l.cantidad || 0) / ppc) : null;
    return { ...l, piezas_por_contenedor: ppc || l.piezas_por_contenedor, contenedores: cnts != null ? cnts : l.contenedores, es_consolidado: consol };
  });
}

export default function SOPExport({ abierto, onClose, sol, borrador, lineas, rows, puedeEditar, sensible = false }) {
  // `sensible` = permiso de información sensible. Sin él no se muestra ni se exporta el costo USD.
  const { theme } = useTheme();
  const [ocupado, setOcupado] = useState(false);
  const xlsxListo = useRef(false);
  const totalPz = useMemo(() => lineas.reduce((s, l) => s + Number(l.cantidad || 0), 0), [lineas]);
  const totalUsd = useMemo(() => lineas.reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0), [lineas]);
  const soporteShare = useMemo(() => puedeCompartirArchivos(new Blob([''], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'x.xlsx'), []);

  // Precarga xlsx-js-style al abrir: así el Excel se arma dentro del gesto del botón (iOS exige el share en el gesto).
  useEffect(() => { if (abierto && !xlsxListo.current) { import('xlsx-js-style').then(() => { xlsxListo.current = true; }).catch(() => {}); } }, [abierto]);

  const cambiarCantidad = async (l, n) => {
    if (!puedeEditar) return;
    try { await sol.editarLinea(l.id, { cantidad: n, contenedores: l.piezas_por_contenedor > 0 && !l.es_consolidado ? Math.ceil(n / Number(l.piezas_por_contenedor)) : l.contenedores }); }
    catch (e) { toast.error(e?.message || 'No se pudo editar la línea'); }
  };
  const quitar = async (l) => {
    if (!puedeEditar) return;
    try { await sol.eliminarLinea(l.id); toast.ok(`${l.sku} quitado`); }
    catch (e) { toast.error(e?.message || 'No se pudo quitar'); }
  };

  const exportar = async ({ cerrar }) => {
    if (!borrador || !lineas.length || ocupado) return;
    setOcupado(true);
    try {
      const { blob, filename } = await solicitudExcelBlob(borrador, refrescarLineas(lineas, rows), { sinCostos: !sensible });
      const r = await compartirArchivo(blob, filename, { titulo: filename, texto: `S&OP · ${lineas.length} SKUs · ${int(totalPz)} pz` });
      if (!r) { toast.info('Se canceló el envío'); return; }
      if (cerrar) {
        await sol.cerrarBorrador(borrador.id);
        try { await supabase.from('solicitudes_compra').update({ exportada_en: new Date().toISOString() }).eq('id', borrador.id); } catch { /* columna informativa */ }
        toast.ok(r === 'share' ? 'Solicitud cerrada y compartida' : 'Solicitud cerrada · Excel descargado');
        onClose?.();
      } else {
        toast.ok(r === 'share' ? 'Excel compartido' : 'Excel descargado');
      }
    } catch (e) {
      toast.error(`No se pudo exportar: ${e?.message || e}`);
    } finally {
      setOcupado(false);
    }
  };

  const n = lineas.length;
  const sub = borrador ? `Borrador #${borrador.id} · ${relativo(borrador.updated_at || borrador.fecha_creacion)} · ${n} SKU${n === 1 ? '' : 's'} · ${int(totalPz)} pz` : 'Sin borrador activo';
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={`Mi export${n ? ` · ${n}` : ''}`} sub={sub} alto="88vh">
      {!borrador || n === 0 ? (
        <Vacio icon={ClipboardList} color={theme.textMuted} titulo="El export está vacío" sub="Busca un SKU arriba y toca “Agregar al export”. Las líneas se guardan en la nube: también las verás en la computadora." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: sensible ? '1fr 1fr' : '1fr', gap: 10, padding: '0 16px 12px' }}>
            <Dato theme={theme} k="Piezas" v={int(totalPz)} sub={`${n} SKU${n === 1 ? '' : 's'}`} />
            {sensible && <Dato theme={theme} k="Total estimado" v={USD(totalUsd)} sub="USD · último costo" />}
          </div>
          <ListaAgrupada pie="Desliza una línea a la izquierda para quitarla. La cantidad se guarda al soltar el campo.">
            {lineas.map((l) => (
              <FilaDeslizable key={l.id} acciones={puedeEditar ? [{ label: 'Quitar', icon: Trash2, color: theme.red, onClick: () => quitar(l) }] : []}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: theme.surface }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.sku}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.descripcion || 'Sin descripción'}</div>
                    <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                      {l.proveedor || 'Sin proveedor'}{sensible && l.ultimo_costo_usd ? ` · $${Number(l.ultimo_costo_usd).toFixed(2)} USD` : ''}{l.es_consolidado || l.grupo_contenedor ? ' · consolidado' : l.contenedores ? ` · ${l.contenedores} cnt` : ''}
                    </div>
                  </div>
                  {puedeEditar ? <CampoCantidad value={Number(l.cantidad || 0)} onChange={(v) => cambiarCantidad(l, v)} paso={l.piezas_por_contenedor > 0 && !l.es_consolidado ? Number(l.piezas_por_contenedor) : 100} />
                    : <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600 }}>{int(l.cantidad)}</span>}
                </div>
              </FilaDeslizable>
            ))}
          </ListaAgrupada>
          <div style={{ padding: '16px 16px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {puedeEditar && <BotonGrande primario icon={Share2} disabled={ocupado} onClick={() => exportar({ cerrar: true })}>{ocupado ? 'Generando…' : 'Terminar propuesta y exportar'}</BotonGrande>}
            <BotonGrande icon={FileSpreadsheet} disabled={ocupado} onClick={() => exportar({ cerrar: false })}>{soporteShare ? 'Solo compartir el Excel' : 'Solo descargar el Excel'}</BotonGrande>
            <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', lineHeight: 1.4 }}>
              {puedeEditar ? 'Terminar cierra el borrador como solicitud pendiente (Karolina la ve en la computadora) y abre la hoja para mandar el Excel por WhatsApp o correo.' : 'Tu perfil sólo puede ver el export; los cambios se hacen desde un perfil con edición.'}
            </div>
            {!puedeEditar && <Pill tone="gray" style={{ alignSelf: 'center' }}>Solo lectura</Pill>}
          </div>
        </>
      )}
    </HojaM>
  );
}

function Dato({ theme, k, v, sub }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}
