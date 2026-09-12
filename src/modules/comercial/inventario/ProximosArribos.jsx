// Panel "Próximos arribos" · embarques pendientes (v_transito_sku.embarques_detalle) agrupados
// por PO con ETA dentro de 7 / 14 / 30 días (Segmented) o todos. Cruza con el estado de
// cobertura calculado en pantalla: "resuelve N agotados/críticos". Click en una PO abre sus SKUs.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Segmented, TablaCompacta } from '../../../components/kit';
import { fmtInt, fmtFechaCorta, diasHasta, tonoCobertura, etiquetaCobertura, MONO } from './constantes';
import { useEmbarquesTiempos, useNavieraPorContenedor, resumen as resumenEmbarques } from '../forecast/useEmbarquesTiempos';

const HORIZONTES = [{ id: 7, label: '7 d' }, { id: 14, label: '14 d' }, { id: 30, label: '30 d' }, { id: 0, label: 'Todos' }];
const TONO_ESTATUS = { 'TRANSITO MARITIMO': 'blue', 'PROXIMO A ZARPAR': 'purple', 'EN RESGUARDO': 'green', 'EN ESPERA DE CONSOLIDAR': 'orange', 'EN PRODUCCION': 'gray', 'Pendiente modular': 'gray' };

export default function ProximosArribos({ transito, skuRows, descripciones, onVerSku, sensible = false }) {
  const { theme } = useTheme();
  const [horizonte, setHorizonte] = useState(30);
  const [poAbierta, setPoAbierta] = useState(null);
  // Naviera y tiempos reales del Master Embarques (vistas v_embarques_*, migración 20260912).
  const navieraPor = useNavieraPorContenedor();
  const { proveedores } = useEmbarquesTiempos(new Date().getFullYear(), true);
  const real = useMemo(() => resumenEmbarques(proveedores), [proveedores]);

  const porSku = useMemo(() => new Map(skuRows.map((r) => [r.sku, r])), [skuRows]);

  const pos = useMemo(() => {
    const m = new Map();
    transito.forEach((t, sku) => {
      (t.pos || []).forEach((p) => {
        if (!p.po || !(p.cantidad > 0)) return;
        if (!m.has(p.po)) m.set(p.po, { po: p.po, eta: p.eta || null, etd: p.etd || null, cedis: p.cedis || '', estatus: p.estatus || '', contenedor: p.contenedor || '', piezas: 0, skus: [] });
        const it = m.get(p.po);
        if (p.eta && (!it.eta || p.eta < it.eta)) it.eta = p.eta;
        it.piezas += p.cantidad;
        if (!it.contenedor && p.contenedor) it.contenedor = p.contenedor;
        if (p.etd && (!it.etd || p.etd < it.etd)) it.etd = p.etd;
        const r = porSku.get(sku);
        const d = descripciones.get(sku) || {};
        const necesitado = !!r && (r.agotado || r.critico);
        it.skus.push({ sku, descripcion: r?.descripcion || d.descripcion || '', piezas: p.cantidad, stock: r?.totalPz ?? null, coberturaDias: r?.coberturaDias ?? null, tieneStock: !!r?.tieneStock, demandaMes: r?.demandaMes || 0, necesitado, riesgo: !!r?.riesgo, eta: p.eta || null });
      });
    });
    // diasEnTransito = días desde el ETD (lo que ya lleva navegando): sólo para lo que aún no llega.
    const hoyISO = new Date().toISOString().slice(0, 10);
    return [...m.values()].map((it) => ({
      ...it,
      nSkus: it.skus.length,
      resuelve: it.skus.filter((s) => s.necesitado).length,
      dias: diasHasta(it.eta),
      naviera: (it.contenedor && navieraPor.get(it.contenedor)) || null,
      diasEnTransito: it.etd && it.etd <= hoyISO ? Math.round((Date.parse(`${hoyISO}T00:00:00`) - Date.parse(`${it.etd}T00:00:00`)) / 86400000) : null,
    }))
      .sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')) || b.piezas - a.piezas);
  }, [transito, porSku, descripciones, navieraPor]);

  const visibles = useMemo(() => (horizonte ? pos.filter((p) => p.dias != null && p.dias <= horizonte) : pos), [pos, horizonte]);
  const totPz = visibles.reduce((s, p) => s + p.piezas, 0);
  const totResuelve = visibles.reduce((s, p) => s + p.resuelve, 0);

  const columnas = [
    { key: 'po', label: 'PO', align: 'left', mono: true, bold: true, width: 120 },
    {
      key: 'eta', label: 'ETA CEDIS', align: 'left', width: 150, render: (p) => {
        const d = p.dias;
        const tone = d == null ? 'gray' : d < 0 ? 'orange' : d <= 7 ? 'green' : 'blue';
        return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{fmtFechaCorta(p.eta)}<Pill tone={tone} size="xs">{d == null ? 'sin fecha' : d < 0 ? `${Math.abs(d)} d atrás` : d === 0 ? 'hoy' : `en ${d} d`}</Pill></span>;
      },
    },
    { key: 'cedis', label: 'CEDIS', align: 'left', render: (p) => p.cedis || '—' },
    { key: 'naviera', label: 'Naviera', align: 'left', width: 92, render: (p) => (p.naviera ? <span title={p.contenedor ? `contenedor ${p.contenedor}` : ''}>{p.naviera}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    {
      key: 'diasEnTransito', label: 'Navegando', width: 88,
      render: (p) => (p.diasEnTransito == null
        ? <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>
        : <span title={`ETD ${fmtFechaCorta(p.etd)}${real.transitoMed ? ` · tránsito real ${Math.round(real.transitoMed)} d` : ''}`}>{fmtInt(p.diasEnTransito)} d</span>),
    },
    { key: 'estatus', label: 'Estatus', align: 'left', render: (p) => <Pill tone={TONO_ESTATUS[p.estatus] || 'gray'} size="xs">{p.estatus || '—'}</Pill> },
    { key: 'piezas', label: 'Piezas', width: 80, render: (p) => fmtInt(p.piezas), renderTotal: (v) => fmtInt(v) },
    { key: 'nSkus', label: 'SKUs', width: 60, render: (p) => fmtInt(p.nSkus), renderTotal: (v) => fmtInt(v) },
    {
      key: 'resuelve', label: 'Resuelve', width: 150, render: (p) => (p.resuelve > 0
        ? <Pill tone="red" size="xs" title="SKUs agotados o críticos que trae esta PO">{fmtInt(p.resuelve)} agotado{p.resuelve === 1 ? '' : 's'}/crítico{p.resuelve === 1 ? '' : 's'}</Pill>
        : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>),
      renderTotal: (v) => fmtInt(v),
    },
  ];
  const totales = { piezas: totPz, nSkus: visibles.reduce((s, p) => s + p.nSkus, 0), resuelve: totResuelve };

  const colsSku = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 120, render: (s) => <span onClick={onVerSku ? (e) => { e.stopPropagation(); onVerSku(s.sku); } : undefined} style={{ color: onVerSku ? theme.accent : theme.text, cursor: onVerSku ? 'pointer' : 'default' }}>{s.sku}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 320, render: (s) => <span title={s.descripcion}>{s.descripcion || '—'}</span> },
    { key: 'piezas', label: 'Piezas PO', width: 80, render: (s) => fmtInt(s.piezas), renderTotal: (v) => fmtInt(v) },
    { key: 'stock', label: 'Stock hoy', width: 80, render: (s) => (s.stock == null ? '—' : fmtInt(s.stock)) },
    {
      key: 'coberturaDias', label: 'Cobertura', width: 110, render: (s) => {
        if (s.stock == null) return <span style={{ color: theme.textMuted }}>fuera del alcance</span>;
        if (!s.tieneStock) return s.demandaMes > 0 ? <Pill tone="red" size="xs">Agotado</Pill> : <Pill tone="gray" size="xs">Sin stock</Pill>;
        return <Pill tone={tonoCobertura(s.coberturaDias, true)} size="xs">{s.coberturaDias == null ? etiquetaCobertura(null, true) : `${fmtInt(s.coberturaDias)} d · ${etiquetaCobertura(s.coberturaDias, true)}`}</Pill>;
      },
    },
  ];

  const meta = visibles.length
    ? `${fmtInt(visibles.length)} PO${visibles.length === 1 ? '' : 's'} · ${fmtInt(totPz)} pz${totResuelve ? ` · resuelven ${fmtInt(totResuelve)} SKUs agotados/críticos` : ''}`
    : pos.length ? `sin POs con ETA en ${horizonte} días · ${fmtInt(pos.length)} pendientes en total` : 'sin embarques pendientes';

  // Referencia de lo que tarda y cuesta de verdad un embarque este año (v_embarques_proveedor).
  const linea = [
    real.transitoMed ? `tránsito promedio real ${Math.round(real.transitoMed)} d` : null,
    sensible && real.usdPorCbm ? `flete $${Math.round(real.usdPorCbm)}/CBM` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Panel titulo="Próximos arribos" meta={meta} plegable abiertoInicial padding={0}
      acciones={<Segmented options={HORIZONTES} value={horizonte} onChange={setHorizonte} />}>
      {linea && <div style={{ padding: '6px 12px 0', fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted }}>{linea} · ETD → CEDIS de los contenedores ya arribados este año</div>}
      <TablaCompacta columnas={columnas} filas={visibles} rowKey={(p) => p.po} totales={visibles.length ? totales : undefined} maxHeight="46vh" dense
        vacio={pos.length ? `Sin POs con ETA en ${horizonte} días. Prueba "Todos".` : 'Sin embarques pendientes.'}
        onRowClick={(p) => setPoAbierta((a) => (a === p.po ? null : p.po))}
        expandidoKey={poAbierta}
        renderExpandido={(p) => (
          <div style={{ padding: '10px 14px', background: theme.bg, fontFamily: TYPO.fontText }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text }}>SKUs de la PO <span style={{ fontFamily: MONO }}>{p.po}</span></span>
              <span style={{ fontSize: 10, color: theme.textMuted }}>{p.contenedor ? `contenedor ${p.contenedor} · ` : ''}{fmtInt(p.nSkus)} SKUs · {fmtInt(p.piezas)} pz{onVerSku ? ' · click en un SKU abre su drill' : ''}</span>
            </div>
            <TablaCompacta columnas={colsSku} filas={[...p.skus].sort((a, b) => Number(b.necesitado) - Number(a.necesitado) || b.piezas - a.piezas)} rowKey={(s) => s.sku} dense totales={{ piezas: p.piezas }} maxHeight={320} />
          </div>
        )} />
    </Panel>
  );
}
