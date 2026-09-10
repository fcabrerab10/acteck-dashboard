// Reuniones — repositorio de las reuniones mensuales de S&OP (vista "Reuniones" del Segmented en la pantalla S&OP).
// Plantilla V3: Hero (última reunión) → 4 KpiCard (año) → lista por mes (Panel por reunión) → "Exports anteriores" plegable.
// El detalle abre en el mismo lugar (DetalleReunion) y el alta/edición en una HojaLateral (FormularioReunion).
// Datos de hoy para el cruce (rows del motor, inventario, tránsito, embarques) vienen por props desde ForecastClientesTab.
import React, { useMemo, useState } from 'react';
import { Plus, PenLine, Download } from 'lucide-react';
import { useTheme } from '../../../../lib/themeContext';
import { TYPO } from '../../../../lib/themeTokens';
import { fecha as fmtFecha } from '../../../../lib/format';
import { Hero, KpiCard, Panel, Boton, Pill, Cargando, TablaCompacta, toast } from '../../../../components/kit';
import { fmtInt } from '../../inventario/constantes';
import { exportarSolicitudExcel } from '../excelSOP';
import { useReuniones } from './useReuniones';
import { indicesCruce, cumplimientoDe, tonoCumplimiento } from './cruce';
import { MESES_NOMBRE } from './parserCorreo';
import FormularioReunion from './FormularioReunion';
import DetalleReunion from './DetalleReunion';

const ESTADO_SOL = { pendiente: 'orange', colocada: 'green', cancelada: 'gray', borrador: 'blue' };

export default function Reuniones({ perfil, puedeEditar, sensible, rows = [], metaBySku = {}, data = {}, sol }) {
  const { theme } = useTheme();
  const rep = useReuniones();
  const [abiertaId, setAbiertaId] = useState(null);
  const [hoja, setHoja] = useState(null); // { modo: 'correo' | 'manual' | 'editar', reunion? }

  const idx = useMemo(() => indicesCruce({ rows, inventario: data.inventario, transito: data.transito, embarques: data.embarques }), [rows, data.inventario, data.transito, data.embarques]);
  const rowsBySku = idx.rowsBySku;
  const catalogos = useMemo(() => ({ roadmap: data.roadmap || [], metaBySku, rowsBySku }), [data.roadmap, metaBySku, rowsBySku]);

  // Cumplimiento por reunión (misma regla que el detalle) — sobre datos ya en memoria.
  const cumpl = useMemo(() => Object.fromEntries(rep.reuniones.map((r) => [r.id, cumplimientoDe(r, rep.lineasDe(r.id), idx)])), [rep.reuniones, rep.lineas, idx]);

  const anio = new Date().getFullYear();
  const delAnio = rep.reuniones.filter((r) => r.anio === anio);
  const kpis = useMemo(() => {
    const piezas = delAnio.reduce((a, r) => a + Number(r.total_piezas || 0), 0);
    const skus = new Set(delAnio.flatMap((r) => rep.lineasDe(r.id).map((l) => l.sku))).size;
    const c = delAnio.map((r) => cumpl[r.id]).filter((v) => v != null);
    return { n: delAnio.length, piezas, skus, cumplProm: c.length ? c.reduce((a, b) => a + b, 0) / c.length : null };
  }, [delAnio, cumpl, rep.lineas]);

  const ultima = rep.reuniones[0] || null;
  const abierta = abiertaId ? rep.reuniones.find((r) => r.id === abiertaId) : null;

  const porMes = useMemo(() => {
    const g = new Map();
    for (const r of rep.reuniones) { const k = `${r.anio}-${String(r.mes).padStart(2, '0')}`; (g.get(k) || g.set(k, []).get(k)).push(r); }
    return Array.from(g.entries());
  }, [rep.reuniones]);

  const onGuardar = async (form) => {
    if (hoja?.modo === 'editar' && hoja.reunion) { await rep.actualizar(hoja.reunion.id, form); toast.ok(`${form.folio} actualizada`); }
    else { const r = await rep.guardar(form); toast.ok(`Reunión ${r.folio} guardada · ${form.lineas.length} SKUs`); setAbiertaId(r.id); }
  };
  const onEliminar = async () => {
    if (!abierta) return;
    if (!window.confirm(`¿Eliminar la reunión ${abierta.folio} y sus ${abierta.total_skus} líneas?`)) return;
    try { await rep.eliminar(abierta.id); setAbiertaId(null); toast.ok(`${abierta.folio} eliminada`); }
    catch (e) { toast.error(`No se pudo eliminar: ${e?.message || e}`); }
  };

  if (rep.loading) return <Cargando pantalla="sopReuniones" minHeight={520} />;

  if (abierta) {
    return (
      <>
        <DetalleReunion theme={theme} reunion={abierta} lineas={rep.lineasDe(abierta.id)} idx={idx} puedeEditar={puedeEditar} sensible={sensible}
          onVolver={() => setAbiertaId(null)} onEditar={() => setHoja({ modo: 'editar', reunion: abierta })} onEliminar={onEliminar} />
        {hoja && <FormularioReunion key={`${hoja.modo}-${hoja.reunion?.id || 'nueva'}`} abierto onClose={() => setHoja(null)} theme={theme} modo={hoja.modo} reunion={hoja.reunion}
          lineasIniciales={hoja.reunion ? rep.lineasDe(hoja.reunion.id) : []} catalogos={catalogos} folios={rep.folios.filter((f) => f !== hoja.reunion?.folio)} onGuardar={onGuardar} />}
      </>
    );
  }

  return (
    <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Hero
        eyebrow={`Dirección Comercial · S&OP · Reuniones${ultima ? ` · última ${ultima.folio}` : ''}`}
        titulo={ultima ? `${ultima.titulo || ultima.folio}.` : 'Repositorio de reuniones S&OP.'}
        sub={ultima ? (
          <>
            <strong style={{ color: theme.textOnInverse || '#F5F5F7', fontWeight: 500 }}>{fmtInt(ultima.total_skus)} SKUs · {fmtInt(ultima.total_piezas)} piezas</strong> solicitadas por {ultima.solicita || '—'}
            {' '}el {fmtFecha(ultima.fecha_reunion || String(ultima.created_at).slice(0, 10))}. Cumplimiento hoy: <strong style={{ color: theme.green || '#34D158', fontWeight: 500 }}>{Math.round(cumpl[ultima.id] || 0)} %</strong> de las piezas ya tienen PO.
          </>
        ) : 'Pega aquí el correo "ACTECK - SOLICITUD DE COMPRA" que sale del CRM tras cada reunión mensual; queda guardado con sus SKUs, cantidades y comentarios, y se cruza con el S&OP de hoy.'}
        stats={ultima ? [
          { k: 'Folio', v: ultima.folio, sub: `${MESES_NOMBRE[ultima.mes - 1]} ${ultima.anio}` },
          { k: 'SKUs', v: fmtInt(ultima.total_skus), sub: `${fmtInt(ultima.total_piezas)} pz` },
          { k: 'Cumplimiento', v: `${Math.round(cumpl[ultima.id] || 0)} %`, sub: 'piezas con PO', color: (cumpl[ultima.id] || 0) >= 90 ? (theme.green || '#34D158') : undefined },
        ] : []}
      >
        {puedeEditar && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Boton primario icon={Plus} onClick={() => setHoja({ modo: 'correo' })}>Registrar reunión</Boton>
            <Boton icon={PenLine} onClick={() => setHoja({ modo: 'manual' })} style={{ background: 'transparent', color: theme.textOnInverse || '#F5F5F7', borderColor: 'rgba(255,255,255,0.25)' }}>Capturar a mano</Boton>
          </div>
        )}
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard eyebrow={`Reuniones ${anio}`} badge={{ tone: kpis.n ? 'blue' : 'gray', l: `${rep.reuniones.length} en total` }} big={fmtInt(kpis.n)} bigSmall="reuniones" sub="una por mes desde el CRM" />
        <KpiCard eyebrow={`Piezas ${anio}`} big={`${fmtInt(kpis.piezas)} pz`} bigSmall={`${kpis.n} reuniones`} sub="suma de lo solicitado en el año" />
        <KpiCard eyebrow="SKUs distintos" big={fmtInt(kpis.skus)} bigSmall="en el año" sub="códigos solicitados al menos una vez" />
        <KpiCard eyebrow="Cumplimiento promedio" badge={{ tone: tonoCumplimiento(kpis.cumplProm), l: kpis.cumplProm == null ? 'sin datos' : kpis.cumplProm >= 90 ? 'al día' : 'en curso' }}
          big={kpis.cumplProm == null ? '—' : `${Math.round(kpis.cumplProm)} %`} progress={kpis.cumplProm ?? undefined} sub="Σ min(pedido, pz con PO) ÷ Σ pedido · POs emitidas desde la reunión" />
      </div>

      {rep.error && <Panel padding="10px 12px"><span style={{ color: theme.red, fontSize: 12 }}>No se pudieron cargar las reuniones: {rep.error}</span></Panel>}

      {porMes.length === 0 && !rep.error && (
        <Panel padding="24px">
          <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 12.5 }}>
            Aún no hay reuniones guardadas.{puedeEditar ? ' Pulsa "Registrar reunión" y pega el correo del CRM.' : ''}
          </div>
        </Panel>
      )}

      {porMes.map(([k, lista]) => {
        const [a, m] = k.split('-').map(Number);
        return (
          <div key={k}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textMuted, margin: '4px 2px 6px' }}>{MESES_NOMBRE[m - 1]} {a}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
              {lista.map((r) => {
                const c = cumpl[r.id] || 0;
                return (
                  <Panel key={r.id} elevable padding="12px 14px" style={{ cursor: 'pointer' }}>
                    <div onClick={() => setAbiertaId(r.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{r.folio}</span>
                        <Pill tone={r.fuente === 'correo' ? 'blue' : 'gray'} size="xs">{r.fuente === 'correo' ? 'correo CRM' : 'manual'}</Pill>
                        <span style={{ flex: 1 }} />
                        <Pill tone={tonoCumplimiento(c)} size="xs" dot>{Math.round(c)} % con PO</Pill>
                      </div>
                      <div style={{ fontSize: 12.5, color: theme.text, marginBottom: 2 }}>{r.titulo || '—'}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        solicita {r.solicita || '—'} · <strong style={{ color: theme.text, fontWeight: 600 }}>{fmtInt(r.total_skus)} SKUs</strong> · {fmtInt(r.total_piezas)} pz · {fmtFecha(r.fecha_reunion || String(r.created_at).slice(0, 10))}
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>
        );
      })}

      {sol && (
        <Panel plegable abiertoInicial={false} titulo="Exports anteriores" meta={`${sol.cerradas.length} exports cerrados del carrito Mi Export · click en la fila para ver las líneas`} padding="6px">
          <ExportsAnteriores theme={theme} sol={sol} sensible={sensible} />
        </Panel>
      )}

      {hoja && <FormularioReunion key={`${hoja.modo}-${hoja.reunion?.id || 'nueva'}`} abierto onClose={() => setHoja(null)} theme={theme} modo={hoja.modo} reunion={hoja.reunion}
        lineasIniciales={hoja.reunion ? rep.lineasDe(hoja.reunion.id) : []} catalogos={catalogos} folios={rep.folios} onGuardar={onGuardar} />}
    </div>
  );
}

/** Historial del carrito (solicitudes_compra con estado ≠ borrador). Sustituye al SolicitudesModal viejo. */
function ExportsAnteriores({ theme, sol, sensible }) {
  const [abierto, setAbierto] = useState(null);
  const filas = sol.cerradas.map((s) => {
    const ls = sol.lineasDe(s.id);
    return { ...s, nSkus: ls.length, piezas: ls.reduce((a, l) => a + Number(l.cantidad || 0), 0), usd: ls.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0) };
  });
  const descargar = async (s) => {
    try { const f = await exportarSolicitudExcel(s, sol.lineasDe(s.id), { sinCostos: !sensible }); toast.ok(`Excel descargado: ${f}`); }
    catch (e) { toast.error(`No se pudo exportar: ${e?.message || e}`); }
  };
  const columnas = [
    { key: 'id', label: 'Export', align: 'left', mono: true, bold: true, width: 70, render: (s) => `#${s.id}` },
    { key: 'notas', label: 'Nombre', align: 'left', maxWidth: 220, render: (s) => s.notas || <span style={{ color: theme.textMuted }}>sin nombre</span> },
    { key: 'estado', label: 'Estado', align: 'left', width: 90, render: (s) => <Pill tone={ESTADO_SOL[s.estado] || 'gray'} size="xs">{s.estado}</Pill> },
    { key: 'fecha_cerrada', label: 'Cerrado', width: 100, render: (s) => (s.fecha_cerrada ? fmtFecha(String(s.fecha_cerrada).slice(0, 10)) : '—') },
    { key: 'nSkus', label: 'SKUs', width: 60, render: (s) => fmtInt(s.nSkus) },
    { key: 'piezas', label: 'Piezas', width: 80, render: (s) => fmtInt(s.piezas) },
    ...(sensible ? [{ key: 'usd', label: 'USD', width: 90, render: (s) => `$${fmtInt(s.usd)}` }] : []),
    { key: 'x', label: '', width: 36, render: (s) => <button type="button" title="Descargar Excel" onClick={(e) => { e.stopPropagation(); descargar(s); }} style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', padding: 2 }}><Download size={12} /></button> },
  ];
  const colsLinea = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 88 },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 320 },
    { key: 'cantidad', label: 'Cantidad', sum: true, render: (l) => fmtInt(l.cantidad) },
    { key: 'contenedores', label: 'Cnt', width: 50, render: (l) => (l.contenedores ? fmtInt(l.contenedores) : '—') },
    { key: 'proveedor', label: 'Proveedor', align: 'left', maxWidth: 200, render: (l) => l.proveedor || '—' },
    { key: 'fecha_estimada', label: 'Estimado', width: 90, render: (l) => (l.fecha_estimada ? fmtFecha(l.fecha_estimada) : '—') },
  ];
  return (
    <TablaCompacta dense columnas={columnas} filas={filas} rowKey={(s) => s.id} onRowClick={(s) => setAbierto((v) => (v === s.id ? null : s.id))} expandidoKey={abierto}
      vacio="Todavía no hay exports cerrados."
      renderExpandido={(s) => <div style={{ padding: 8 }}><TablaCompacta dense columnas={colsLinea} filas={sol.lineasDe(s.id)} rowKey={(l) => l.id} vacio="Sin líneas." /></div>} />
  );
}
