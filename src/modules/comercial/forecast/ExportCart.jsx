// Mi Export · contenido de la hoja lateral del S&OP (borrador activo de solicitudes_compra): selector de borrador,
// nombre editable, totales, líneas agrupadas por proveedor (≥ 3 SKUs del mismo), Exportar a Excel (abre el preview),
// Compartir export (mismo Excel vía navigator.share), Cerrar borrador, Nuevo, historial. Extraído de
// ForecastClientesTab.jsx (V3): sólo tokens de tema + kit; USD sólo con `sensible`.
import React, { useEffect, useState } from 'react';
import { Download, Share2, Plus, History } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, Boton, toast } from '../../../components/kit';
import { fmtInt, MONO } from '../inventario/constantes';

const usd0 = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;
const usd2 = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtRel = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return 'hace segundos';
  if (diff < 60) return `hace ${Math.round(diff)} min`;
  if (diff < 24 * 60) return `hace ${Math.round(diff / 60)} h`;
  return `hace ${Math.round(diff / (60 * 24))} d`;
};

/** Agrupa líneas por proveedor: grupos (≥ 3 SKUs) ordenados por USD desc + sueltas. */
export function agruparPorProveedor(lineas, minGrupo = 3) {
  const provKey = (l) => (l.supplier || l.proveedor || '').trim() || '—';
  const byProv = new Map();
  lineas.forEach((l) => { const k = provKey(l); if (!byProv.has(k)) byProv.set(k, []); byProv.get(k).push(l); });
  const usdOf = (arr) => arr.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0);
  const pzOf = (arr) => arr.reduce((a, l) => a + Number(l.cantidad || 0), 0);
  const cntOf = (arr) => arr.reduce((a, l) => a + Number(l.contenedores || 0), 0);
  const grouped = [], singles = [];
  byProv.forEach((arr, prov) => {
    const g = { prov, arr, usd: usdOf(arr), pz: pzOf(arr), cnt: cntOf(arr) };
    if (arr.length >= minGrupo) grouped.push(g); else singles.push(g);
  });
  grouped.sort((a, b) => b.usd - a.usd || b.pz - a.pz);
  singles.sort((a, b) => b.usd - a.usd || b.pz - a.pz);
  return { grouped, singles, flatSingles: singles.flatMap((s) => s.arr) };
}

export function ExportCartLine({ linea, puedeEditar, onEditarLinea, onEliminarLinea, indent, showProv, sensible }) {
  const { theme } = useTheme();
  const cantidad = Number(linea.cantidad || 0);
  const cnt = Number(linea.contenedores || 0);
  const pzPorCnt = cnt > 0 ? cantidad / cnt : 0;
  const inc = () => onEditarLinea?.(linea.id, { cantidad: cantidad + (pzPorCnt || 100), contenedores: cnt + 1 });
  const dec = () => { if (cnt <= 1) return; onEditarLinea?.(linea.id, { cantidad: Math.max(0, cantidad - (pzPorCnt || 100)), contenedores: cnt - 1 }); };
  const subtotal = cantidad * Number(linea.ultimo_costo_usd || 0);
  const proveedor = (linea.supplier || linea.proveedor || '').trim();
  const btn = { width: 22, height: 22, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0 };
  return (
    <div style={{ padding: `9px 10px 9px ${indent ? 22 : 10}px`, borderBottom: `1px solid ${theme.divider || theme.border}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 11.5, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={linea.descripcion}>{linea.descripcion || linea.sku}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
          {linea.sku}
          {sensible && linea.ultimo_costo_usd > 0 && ` · ${usd2(linea.ultimo_costo_usd)}`}
          {sensible && subtotal > 0 && ` → ${usd0(subtotal)}`}
          {!sensible && cnt > 0 && ` · ${fmtInt(cantidad)} pz`}
        </div>
        {showProv && proveedor && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, marginTop: 2 }}>{proveedor}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {puedeEditar && <button type="button" onClick={dec} disabled={cnt <= 1} style={{ ...btn, cursor: cnt <= 1 ? 'not-allowed' : 'pointer', opacity: cnt <= 1 ? 0.5 : 1 }}>−</button>}
        <div style={{ textAlign: 'center', minWidth: 30 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: theme.text }}>{cnt > 0 ? cnt : fmtInt(cantidad)}</div>
          <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 500 }}>{cnt > 0 ? 'cnt' : 'pz'}</div>
        </div>
        {puedeEditar && <button type="button" onClick={inc} style={btn}>+</button>}
        {puedeEditar && <button type="button" onClick={() => onEliminarLinea?.(linea.id)} title="Quitar" style={{ ...btn, border: 'none', background: 'transparent', color: theme.textSubtle || theme.textMuted, marginLeft: 2, borderRadius: 999 }}>×</button>}
      </div>
    </div>
  );
}

export default function ExportCart({
  sol, activoId, setActivoId, activo, lineas, totalPz, totalUsd, totalCnt,
  puedeEditar, onCrearNuevo, onEditarLinea, onEliminarLinea, onCerrar, onExportar, onCompartir, onVerHistorial, sensible,
}) {
  const { theme } = useTheme();
  // El nombre del export se guarda en solicitudes_compra.notas (única columna de texto libre).
  const nombreDe = (a) => a?.notas || a?.nombre || '';
  const [nombreEdit, setNombreEdit] = useState(nombreDe(activo));
  const [compartiendo, setCompartiendo] = useState(false);
  useEffect(() => { setNombreEdit(nombreDe(activo)); /* eslint-disable-next-line */ }, [activo?.id, activo?.notas, activo?.nombre]);
  const guardarNombre = async () => {
    if (!activo || nombreEdit === nombreDe(activo)) return;
    try { await sol.editarSolicitud(activo.id, { notas: nombreEdit || null }); toast.ok('Nombre guardado'); } catch (e) { toast.error(e.message || 'Error al renombrar'); }
  };
  const nBorradores = sol.borradores.length;
  const hair = `1px solid ${theme.divider || theme.border}`;
  const cab = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted };
  const compartir = async () => {
    if (!onCompartir || compartiendo) return;
    setCompartiendo(true);
    try { await onCompartir(); } finally { setCompartiendo(false); }
  };

  if (!activo) {
    return (
      <div style={{ padding: '28px 12px', textAlign: 'center', fontFamily: TYPO.fontText }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, marginBottom: 4 }}>{puedeEditar ? 'Empieza tu primer export' : 'Sin export activo'}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.45, maxWidth: 280, margin: '0 auto 16px' }}>
          {puedeEditar ? 'Selecciona SKUs de la tabla con el botón azul o agrega todos los sugeridos con un click.' : 'Un usuario con permisos debe crear un borrador.'}
        </div>
        {puedeEditar && <Boton primario icon={Plus} onClick={onCrearNuevo} size="md">Crear nuevo export</Boton>}
        {sol.cerradas.length > 0 && <div style={{ marginTop: 14 }}><Boton icon={History} onClick={onVerHistorial}>Ver historial · {sol.cerradas.length}</Boton></div>}
      </div>
    );
  }

  const { grouped, flatSingles } = agruparPorProveedor(lineas);

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Selector de borrador (si hay más de uno) */}
      {nBorradores > 1 && (
        <div style={{ position: 'relative' }}>
          <select value={activoId || ''} aria-label="Borrador activo"
            onChange={(e) => { const v = e.target.value; if (v === '__NEW__') { onCrearNuevo?.(); return; } setActivoId(v); }}
            style={{ width: '100%', padding: '8px 32px 8px 12px', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 500, color: theme.text, outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
            {sol.borradores.map((b) => <option key={b.id} value={b.id}>{nombreDe(b) || `Borrador #${b.id}`}</option>)}
            {puedeEditar && <option value="__NEW__">＋ Nuevo export</option>}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: theme.textMuted, fontSize: 10 }}>▼</span>
        </div>
      )}

      {/* Nombre + meta */}
      <div>
        <input type="text" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} onBlur={guardarNombre}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} disabled={!puedeEditar} placeholder="Nombre del export" aria-label="Nombre del export"
          style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, outline: 'none', padding: 0 }} />
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pill tone="green" size="xs" dot>Autoguardado</Pill>
          <span>{lineas.length} SKU{lineas.length !== 1 ? 's' : ''}{activo.updated_at && <> · edición {fmtRel(activo.updated_at)}</>}</span>
        </div>
      </div>

      {/* Totales */}
      <div style={{ padding: '10px 12px', borderRadius: 12, background: `${theme.accent}0D`, border: `1px solid ${theme.accent}22`, display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'baseline', gap: 12 }}>
        <div>
          <div style={{ ...cab, color: theme.accent }}>{sensible ? 'Total USD' : 'Piezas'}</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1 }}>{sensible ? usd0(totalUsd) : fmtInt(totalPz)}</div>
        </div>
        {sensible && (
          <div style={{ textAlign: 'right' }}>
            <div style={cab}>Piezas</div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1 }}>{fmtInt(totalPz)}</div>
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={cab}>Contenedores</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1 }}>{fmtInt(totalCnt)}</div>
        </div>
      </div>

      {/* Líneas */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {lineas.length === 0 ? (
          <div style={{ padding: '26px 16px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5 }}>Sin SKUs. Da click a "＋" en la tabla para agregar.</div>
        ) : (
          <>
            {grouped.map((g, gi) => (
              <div key={`g-${g.prov}`}>
                <div style={{ padding: '8px 10px 5px', background: theme.bg, borderTop: gi > 0 ? hair : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div title={g.prov} style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: theme.text, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.prov}</span>
                    <Pill tone="blue" size="xs">{g.arr.length} SKUs</Pill>
                  </div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {sensible ? usd0(g.usd) : fmtInt(g.pz) + ' pz'}
                    <span style={{ fontFamily: TYPO.fontText, fontWeight: 500, color: theme.textMuted, fontSize: 10.5, marginLeft: 4 }}>· {g.cnt > 0 ? `${g.cnt} cnt` : sensible ? `${fmtInt(g.pz)} pz` : ''}</span>
                  </div>
                </div>
                {g.arr.map((l) => <ExportCartLine key={l.id} linea={l} puedeEditar={puedeEditar} onEditarLinea={onEditarLinea} onEliminarLinea={onEliminarLinea} sensible={sensible} indent />)}
              </div>
            ))}
            {flatSingles.length > 0 && grouped.length > 0 && (
              <div style={{ padding: '8px 10px 5px', background: theme.bg, borderTop: hair, ...cab }}>Otros SKUs</div>
            )}
            {flatSingles.map((l) => <ExportCartLine key={l.id} linea={l} puedeEditar={puedeEditar} onEditarLinea={onEditarLinea} onEliminarLinea={onEliminarLinea} sensible={sensible} showProv />)}
          </>
        )}
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Boton primario icon={Download} size="md" onClick={onExportar} disabled={lineas.length === 0} style={{ flex: 1, justifyContent: 'center', background: lineas.length ? theme.green : undefined, borderColor: lineas.length ? theme.green : undefined }}>Exportar a Excel</Boton>
          <Boton icon={Share2} size="md" onClick={compartir} disabled={lineas.length === 0 || compartiendo} title="Genera el mismo Excel y abre la hoja de compartir (o lo descarga)">{compartiendo ? 'Preparando…' : 'Compartir export'}</Boton>
        </div>
        {puedeEditar && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton onClick={() => onCerrar?.(activo.id)} disabled={lineas.length === 0} style={{ flex: 1, justifyContent: 'center' }}>Cerrar borrador</Boton>
            <Boton icon={Plus} onClick={onCrearNuevo} style={{ flex: 1, justifyContent: 'center' }}>Nuevo</Boton>
          </div>
        )}
        {sol.cerradas.length > 0 && (
          <Boton icon={History} onClick={onVerHistorial} style={{ justifyContent: 'center' }}>Ver historial · {sol.cerradas.length} export{sol.cerradas.length !== 1 ? 's' : ''} cerrado{sol.cerradas.length !== 1 ? 's' : ''}</Boton>
        )}
      </div>
    </div>
  );
}
