// Ficha del SKU dentro de Sell In consolidado (pantalla empujada).
//   · Cabecera: sku, descripción, marca / categoría / roadmap.
//   · Heatmap de los últimos 6 meses por canal (toggle piezas · monto) — datos ya cargados por la pantalla padre.
//   · "Clientes que lo compran": cliente × 6 meses, ordenados por el periodo completo, con corte Pareto 80 %
//     y "ver todos". Se carga bajo demanda (facturacion_clientes filtrado por sku, índice por sku).
//   · Disponibilidad hoy: disponible + próximo arribo con las piezas de ESE embarque (useFichaProducto).
//   · "Compartir disponibilidad": exige elegir lista de precios; el texto lo arma textoDisponibilidad()
//     (nunca nombra la lista, nunca lleva costo ni margen).
// Nada sensible en esta pantalla: sólo piezas, monto facturado, stock, tránsito y precio de lista.
import React, { useMemo, useState } from 'react';
import { Share2, Copy, Tag, Ship } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { textoDisponibilidad, compartir, copiar, precio as fmtPrecio, fechaCorta } from '../../../lib/whatsapp';
import { useNav } from '../../nav';
import { TituloGrande, Cabecera, ListaAgrupada, Fila, BotonGrande, Vacio, Skeleton, Pill, HojaM, Segmented, TituloSeccionM, toast } from '../../piezas';
import { useFichaProducto } from '../../datos';
import { canalLabel } from '../../../modules/comercial/sellin/textos';
import { money, moneyCompact, int, MONO, N } from '../../util';
import { TablaHeat } from './piezas';
import { useClientesSku } from './datos';

const UNIDADES = [{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: 'Monto' }];
const ESTATUS_CORTO = { 'TRANSITO MARITIMO': 'En el mar', 'PROXIMO A ZARPAR': 'Por zarpar', 'EN PRODUCCION': 'En producción', 'EN ESPERA DE CONSOLIDAR': 'Por consolidar', 'EN RESGUARDO': 'En resguardo', 'Pendiente modular': 'Pendiente' };
const nombreBonito = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/\b([A-ZÁÉÍÓÚÑ]{4,})\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase()) || 'Sin nombre';

/**
 * meses: [{ anio, mes, label }] (los mismos 6 del padre) · porCanal: [{ canal, piezas: number[6], monto: number[6] }]
 * info:  { descripcion, marca, categoria, rdmp }
 */
export default function FichaSku({ sku, info = {}, meses = [], porCanal = [] }) {
  const { theme } = useTheme();
  const nav = useNav();
  const [unidad, setUnidad] = useState('piezas');
  const [verTodos, setVerTodos] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [lista, setLista] = useState(null);

  const columnas = meses.map((m) => m.label);
  const anios = useMemo(() => [...new Set(meses.map((m) => m.anio))], [meses]);
  const fmt = unidad === 'monto' ? moneyCompact : (n) => Math.round(n).toLocaleString('es-MX');

  const { data: clientes, isLoading: lClientes } = useClientesSku(sku, anios);
  const { data: disp, isLoading: lDisp } = useFichaProducto([sku]);
  const it = disp?.items?.[0] || null;
  const listas = disp?.listas || [];
  const listaValida = lista && listas.includes(lista) ? lista : null;
  const precioSel = listaValida && it ? it.precios[listaValida] || null : null;

  // ── Canales × meses (datos ya en memoria) ──
  const filasCanal = useMemo(() => porCanal
    .map((c) => ({ label: canalLabel(c.canal), valores: unidad === 'monto' ? c.monto : c.piezas }))
    .filter((f) => f.valores.some((v) => N(v) > 0))
    .sort((a, b) => b.valores.reduce((s, v) => s + N(v), 0) - a.valores.reduce((s, v) => s + N(v), 0)), [porCanal, unidad]);
  const totalPeriodo = useMemo(() => porCanal.reduce((s, c) => s + c.monto.reduce((a, b) => a + N(b), 0), 0), [porCanal]);

  // ── Clientes × meses (lazy) con corte Pareto 80 % ──
  const paretoClientes = useMemo(() => {
    if (!clientes) return null;
    const idx = new Map(meses.map((m, i) => [`${m.anio}-${m.mes}`, i]));
    const by = new Map();
    clientes.forEach((r) => {
      const i = idx.get(`${N(r.anio)}-${N(r.mes)}`); if (i == null) return;
      const lbl = nombreBonito(r.cliente_nombre);
      const o = by.get(lbl) || (by.set(lbl, { label: lbl, piezas: meses.map(() => 0), monto: meses.map(() => 0) }), by.get(lbl));
      o.piezas[i] += N(r.piezas); o.monto[i] += N(r.monto);
    });
    const todas = [...by.values()]
      .map((o) => ({ ...o, valores: unidad === 'monto' ? o.monto : o.piezas }))
      .filter((o) => o.valores.some((v) => v > 0))
      .map((o) => ({ ...o, total: o.valores.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total);
    const gran = todas.reduce((s, o) => s + o.total, 0);
    let acc = 0, corte = 0;
    for (const o of todas) { acc += o.total; corte++; if (gran > 0 && acc / gran >= 0.8) break; }
    return { todas, corte: Math.max(1, Math.min(corte, todas.length)), gran };
  }, [clientes, meses, unidad]);

  const filasClientes = paretoClientes ? (verTodos ? paretoClientes.todas : paretoClientes.todas.slice(0, paretoClientes.corte)) : [];

  // ── Compartir disponibilidad ──
  const texto = useMemo(() => (it && listaValida ? textoDisponibilidad([{ sku: it.sku, descripcion: it.descripcion, disponible: it.disponible, proximoArribo: it.proximoArribo, enCamino: it.enCamino, precio: precioSel?.precio ?? null }]) : ''), [it, listaValida, precioSel]);
  const puedeCompartir = !!texto;
  const onCompartir = async () => { if (!puedeCompartir) return; if (await compartir(texto) === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (!puedeCompartir) return; if (await copiar(texto)) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };

  const dato = (k, v, sub, color) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );

  const periodo = meses.length ? `${meses[0].label} – ${meses[meses.length - 1].label}` : '';
  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Sell In" derecha={<Segmented value={unidad} onChange={setUnidad} options={UNIDADES} />} />
      <TituloGrande titulo={sku} sub={info.descripcion || 'Sin descripción en el roadmap'} />

      <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {info.marca && <Pill tone="blue">{info.marca}</Pill>}
        {info.categoria && <Pill tone="gray">{info.categoria}</Pill>}
        {info.rdmp && <Pill tone="purple">{info.rdmp}</Pill>}
      </div>

      <TituloSeccionM style={{ padding: '0 28px 6px' }} meta={periodo}>Últimos 6 meses por canal</TituloSeccionM>
      <div style={{ padding: '0 16px' }}>
        <TablaHeat columnas={columnas} filas={filasCanal} fmt={fmt} etiquetaFilas={filasCanal.length > 1 ? `${filasCanal.length} canales` : ''} totalLabel="Total" />
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>
          {unidad === 'monto' ? 'Monto facturado' : 'Piezas facturadas'} por canal · intensidad relativa al máximo de cada fila.
        </div>
      </div>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta={paretoClientes ? `${paretoClientes.todas.length}` : undefined}>Clientes que lo compran</TituloSeccionM>
      <div style={{ padding: '0 16px' }}>
        {lClientes && <Skeleton h={160} r={12} />}
        {!lClientes && paretoClientes && paretoClientes.todas.length === 0 && <Vacio icon={null} titulo="Sin clientes en estos meses" sub="Nadie facturó este SKU en el periodo." />}
        {!lClientes && filasClientes.length > 0 && (
          <>
            <TablaHeat columnas={columnas} filas={filasClientes} fmt={fmt} etiquetaFilas={`${filasClientes.length} clientes`} totalLabel={verTodos ? 'Total' : 'Subtotal 80 %'} />
            <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>
              {verTodos ? 'Todos los clientes del periodo' : `Los ${paretoClientes.corte} que concentran el 80 % del periodo`} · nombre del cliente en el ERP.
            </div>
            {paretoClientes.todas.length > paretoClientes.corte && (
              <button type="button" onClick={() => setVerTodos((v) => !v)} style={{ width: '100%', height: 44, marginTop: 4, border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {verTodos ? 'Ver sólo el 80 %' : `Ver los ${paretoClientes.todas.length} clientes`}
              </button>
            )}
          </>
        )}
      </div>

      <ListaAgrupada titulo="Disponibilidad hoy" style={{ marginTop: 18 }} pie="Disponible del almacén comercial · el arribo muestra las piezas de ESE embarque.">
        {lDisp && <div style={{ padding: 16 }}><Skeleton h={60} r={10} /></div>}
        {!lDisp && !it && <Vacio icon={null} titulo="Sin inventario cargado para este SKU" style={{ padding: 18 }} />}
        {!lDisp && it && (
          <div style={{ padding: '12px 14px', fontFamily: TYPO.fontText }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
              {dato('Disponible', `${int(it.disponible)} pz`, `${int(it.inventario)} inv. · ${int(it.reservado)} res.`, it.disponible > 0 ? theme.text : theme.red)}
              {dato('Próximo arribo', it.proximoArribo ? fechaCorta(it.proximoArribo.fecha) : '—', it.proximoArribo ? `${int(it.proximoArribo.piezas)} pz · ${ESTATUS_CORTO[it.proximoArribo.estatus] || it.proximoArribo.estatus || `PO ${it.proximoArribo.po}`}` : 'sin tránsito')}
              {dato('Precio de lista', precioSel ? fmtPrecio(precioSel.precio) : listaValida ? '—' : 'Elige', precioSel ? `+ IVA · ${precioSel.moneda === 'PESOS' ? 'MXN' : precioSel.moneda}` : listaValida ? 'sin precio en esta lista' : 'una lista', precioSel ? theme.text : theme.orange)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: theme.textMuted }}>
              <Ship size={13} />{it.enCamino > 0 ? `${int(it.enCamino)} pz en camino en ${it.embarques} embarque${it.embarques === 1 ? '' : 's'}` : 'Nada en camino'}
              {it.demandaMes > 0 && <span style={{ marginLeft: 'auto' }}>{int(it.demandaMes)} pz/mes ERP</span>}
            </div>
          </div>
        )}
      </ListaAgrupada>

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BotonGrande icon={Tag} onClick={() => setEligiendo(true)} style={{ color: listaValida ? theme.text : theme.orange }}>{listaValida || 'Elige una lista de precios'}</BotonGrande>
        <BotonGrande primario icon={Share2} disabled={!puedeCompartir} onClick={onCompartir}>Compartir disponibilidad</BotonGrande>
        <BotonGrande icon={Copy} disabled={!puedeCompartir} onClick={onCopiar}>Copiar texto</BotonGrande>
        {puedeCompartir && <pre style={{ margin: '4px 0 0', padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, color: theme.textMuted, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>}
      </div>

      <HojaM abierto={eligiendo} onClose={() => setEligiendo(false)} titulo="Lista de precios" sub="Precio de lista sin IVA · no se guarda entre sesiones" alto="60vh">
        {lDisp && <div style={{ padding: 16 }}><Skeleton h={44} r={10} /></div>}
        {!lDisp && listas.length === 0 && <Vacio icon={null} titulo="Sin precios de lista" sub="Este SKU no tiene precio cargado en precios_sku." />}
        {listas.length > 0 && (
          <ListaAgrupada>
            {listas.map((l) => (
              <Fila key={l} icon={Tag} color={l === listaValida ? theme.accent : theme.textSubtle || theme.textMuted} titulo={l}
                sub={it?.precios[l] ? `${fmtPrecio(it.precios[l].precio)} + IVA` : 'sin precio para este SKU'} chevron={false}
                trailing={l === listaValida ? <Pill tone="blue">Elegida</Pill> : undefined} onClick={() => { setLista(l); setEligiendo(false); }} />
            ))}
          </ListaAgrupada>
        )}
      </HojaM>

      <div style={{ padding: '18px 16px 0', fontSize: 11, color: theme.textSubtle || theme.textMuted, lineHeight: 1.45, fontFamily: TYPO.fontText }}>
        Periodo {periodo} · {money(totalPeriodo)} facturados en {filasCanal.length} canal{filasCanal.length === 1 ? '' : 'es'} (<span style={{ fontFamily: MONO }}>facturacion_clientes</span>).
      </div>
    </>
  );
}
