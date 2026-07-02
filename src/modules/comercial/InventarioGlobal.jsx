import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, Boxes, MapPin, AlertTriangle, ArrowRightLeft, FileText,
} from 'lucide-react';

const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6', soft: '#B5D4F4' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75', soft: '#9FE1CB' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD', soft: '#CECBF6' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30', soft: '#F5C4B3' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517', soft: '#FAC775' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E', soft: '#F4C0D1' },
  green:  { bg: '#EAF3DE', text: '#173404', mid: '#3B6D11', strong: '#639922', soft: '#C0DD97' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D', strong: '#E24B4A', soft: '#F7C1C1' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780', soft: '#D3D1C7' },
};

const CEDIS_COLOR = {
  'ALMACENES GUADALAJARA': PALETTE.blue,
  'ALMACENES MEXICO':      PALETTE.teal,
  'ALMACENES COLOTLAN':    PALETTE.purple,
};
const CEDIS_CORTO = {
  'ALMACENES GUADALAJARA': 'Guadalajara',
  'ALMACENES MEXICO':      'México',
  'ALMACENES COLOTLAN':    'Colotlán',
};

// Mapping oficial (archivo "Almacenes 2026.xlsx")
const NOMBRES_ALMACEN = {
  1: 'VENTAS GENERAL GUADALAJARA',
  2: 'VENTAS GENERAL COLOTLAN',
  3: 'VENTAS GENERAL MEXICO',
  4: 'NO COMERCIAL',
  5: 'REFACTURACION',
  6: 'VENTAS DECME MEXICO',
  9: 'VENTAS CONSIGNACION MERCADO LIBRE',
  10: 'ACTIVO FIJO',
  11: 'NO COMERCIAL',
  12: 'VENTAS REFACCIONES',
  13: 'NO COMERCIAL',
  14: 'VENTAS PAGINA WEB DROSHIPPING',
  15: 'STOCK ROTATION TEMPORAL',
  16: 'VENTAS RETAIL GUADALAJARA',
  17: 'VENTAS RETAIL MEXICO',
  19: 'VENTAS DECME GUADALAJARA',
  20: 'NO COMERCIAL',
  25: 'VENTAS APARTADO ECOMMERCE',
  30: 'NO COMERCIAL',
  41: 'NO COMERCIAL',
  42: 'NO COMERCIAL',
  43: 'NO COMERCIAL',
  44: 'VENTAS EMPAQUE DANADO GUADALAJARA',
  50: 'ALMACEN MUESTRAS',
  62: 'NO COMERCIAL',
  63: 'NO COMERCIAL',
  64: 'VENTAS EMPAQUE DANADO MEXICO',
  70: 'NO COMERCIAL',
  71: 'VENTAS APARTADO ECOMMERCE TULTITLAN',
  90: 'NO COMERCIAL',
  97: 'ALMACEN DE REMISIONES',
  98: 'NO COMERCIAL',
  99: 'NO COMERCIAL',
  100: 'NO COMERCIAL',
};

// Clasificación funcional para agrupar
const TIPO_ALMACEN = {
  1: 'General', 2: 'General', 3: 'General',
  16: 'Retail', 17: 'Retail',
  6: 'DECME', 19: 'DECME',
  25: 'E-commerce', 71: 'E-commerce',
  9: 'Mercado Libre',
  14: 'Página web',
  12: 'Refacciones',
  44: 'Empaque dañado', 64: 'Empaque dañado',
  15: 'Stock rotation',
  50: 'Muestras',
  97: 'Remisiones',
  10: 'Activo fijo',
  5: 'Refacturación',
};
const tipoDe = (n) => TIPO_ALMACEN[n] || 'No comercial';
const esComercial = (n) => TIPO_ALMACEN[n] && !['Activo fijo', 'Muestras', 'Remisiones', 'Refacturación'].includes(TIPO_ALMACEN[n]);

const COLOR_TIPO = {
  'General':        PALETTE.blue,
  'Retail':         PALETTE.purple,
  'DECME':          PALETTE.teal,
  'E-commerce':     PALETTE.coral,
  'Mercado Libre':  PALETTE.amber,
  'Página web':     PALETTE.pink,
  'Refacciones':    PALETTE.green,
  'Empaque dañado': PALETTE.red,
  'Stock rotation': PALETTE.gray,
  'Muestras':       PALETTE.gray,
  'Remisiones':     PALETTE.gray,
  'Activo fijo':    PALETTE.gray,
  'Refacturación':  PALETTE.gray,
  'No comercial':   PALETTE.gray,
};

const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  return (Number(n) < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';

export default function InventarioGlobal() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soloComerciales, setSoloComerciales] = useState(true);
  const [cedisFiltro, setCedisFiltro] = useState('TODOS');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const PAGE = 5000;
      let acc = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('inventario_acteck')
          .select('articulo, no_almacen, cedis, disponible, inventario, costopromedio, costodisponible, costoinventario')
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        acc = acc.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setFilas(acc);
      setLoading(false);
    })();
  }, []);

  // Filas efectivas según toggle
  const filasEfectivas = useMemo(() => {
    return filas.filter((r) => {
      if (!r.cedis) return false; // ignoramos sin CEDIS asignado
      if (soloComerciales && !esComercial(Number(r.no_almacen))) return false;
      if (cedisFiltro !== 'TODOS' && r.cedis !== cedisFiltro) return false;
      return true;
    });
  }, [filas, soloComerciales, cedisFiltro]);

  const kpis = useMemo(() => {
    let valor = 0, piezas = 0;
    const skus = new Set();
    const almacenes = new Set();
    filasEfectivas.forEach((r) => {
      valor  += Number(r.costoinventario) || 0;
      piezas += Number(r.inventario) || 0;
      if (r.articulo) skus.add(r.articulo);
      almacenes.add(r.no_almacen);
    });
    const nCEDIS = new Set(filasEfectivas.map((r) => r.cedis)).size;
    return { valor, piezas, skus: skus.size, almacenes: almacenes.size, nCEDIS };
  }, [filasEfectivas]);

  const porCedis = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const c = r.cedis;
      if (!m.has(c)) m.set(c, { cedis: c, valor: 0, piezas: 0, skus: new Set(), almacenes: new Set() });
      const it = m.get(c);
      it.valor  += Number(r.costoinventario) || 0;
      it.piezas += Number(r.inventario) || 0;
      if (r.articulo) it.skus.add(r.articulo);
      it.almacenes.add(r.no_almacen);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values())
      .map((it) => ({ ...it, skus: it.skus.size, almacenes: it.almacenes.size, share: total > 0 ? (it.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  const porTipo = useMemo(() => {
    const m = new Map();
    filasEfectivas.forEach((r) => {
      const t = tipoDe(Number(r.no_almacen));
      if (!m.has(t)) m.set(t, { tipo: t, valor: 0, piezas: 0, skus: new Set() });
      const it = m.get(t);
      it.valor  += Number(r.costoinventario) || 0;
      it.piezas += Number(r.inventario) || 0;
      if (r.articulo) it.skus.add(r.articulo);
    });
    const total = Array.from(m.values()).reduce((s, x) => s + x.valor, 0);
    return Array.from(m.values())
      .map((it) => ({ ...it, skus: it.skus.size, share: total > 0 ? (it.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [filasEfectivas]);

  // (Se quitaron: porAlmacen, concentración y topSkus a petición del usuario)

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Activity className="w-10 h-10 mx-auto mb-3" />
        Cargando inventario…
      </div>
    );
  }
  if (filas.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Inventario</h2>
        <p>No hay datos. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            Dirección Comercial · Snapshot actual
          </p>
          <h2 className="text-2xl font-medium text-gray-800">Inventario</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtInt(filas.length)} combinaciones SKU × almacén cargadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setSoloComerciales(true)}
              className={`px-3 py-1.5 rounded ${soloComerciales ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >Solo comerciales</button>
            <button
              onClick={() => setSoloComerciales(false)}
              className={`px-3 py-1.5 rounded ${!soloComerciales ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >Todos</button>
          </div>
          <select
            value={cedisFiltro}
            onChange={(e) => setCedisFiltro(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="TODOS">Todos los CEDIS</option>
            {Object.keys(CEDIS_CORTO).map((c) => (
              <option key={c} value={c}>{CEDIS_CORTO[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-4 gap-2.5">
        <KpiTile label="Valor inventario" valor={fmtCompact(kpis.valor)} subtitulo={`${fmtInt(kpis.piezas)} piezas`} />
        <KpiTile label="SKUs con inventario" valor={fmtInt(kpis.skus)} subtitulo="referencias distintas" />
        <KpiTile label="Almacenes activos" valor={String(kpis.almacenes)} subtitulo={`en ${kpis.nCEDIS} CEDIS`} />
        <KpiTile
          label="CEDIS principal"
          valor={porCedis[0] ? (CEDIS_CORTO[porCedis[0].cedis] || porCedis[0].cedis) : '—'}
          subtitulo={porCedis[0] ? `${fmtPct(porCedis[0].share)} del valor` : ''}
        />
      </div>

      {/* Distribución por CEDIS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> Distribución por CEDIS
          </h3>
          <span className="text-xs text-gray-500">
            {soloComerciales ? 'Solo almacenes de venta' : 'Todos los almacenes'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {porCedis.map((c) => {
            const pal = CEDIS_COLOR[c.cedis] || PALETTE.gray;
            return (
              <button
                key={c.cedis}
                onClick={() => setCedisFiltro(cedisFiltro === c.cedis ? 'TODOS' : c.cedis)}
                className="text-left rounded-xl p-4 transition-all"
                style={{
                  background: pal.bg,
                  border: cedisFiltro === c.cedis ? `2px solid ${pal.mid}` : '2px solid transparent',
                }}
              >
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: pal.mid }}>
                  {CEDIS_CORTO[c.cedis] || c.cedis}
                </div>
                <div className="text-2xl font-medium mt-1" style={{ color: pal.text }}>{fmtCompact(c.valor)}</div>
                <div className="text-[11px] mt-1" style={{ color: pal.mid }}>
                  {fmtPct(c.share)} del total
                </div>
                <div className="text-[11px] mt-2 pt-2 border-t" style={{ borderColor: pal.soft, color: pal.text }}>
                  {fmtInt(c.skus)} SKUs · {c.almacenes} almacenes · {fmtInt(c.piezas)} pz
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Distribución por tipo funcional */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800">Distribución por función</h3>
          <span className="text-xs text-gray-500">valor por tipo de almacén</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {porTipo.map((t) => {
            const pal = COLOR_TIPO[t.tipo] || PALETTE.gray;
            return (
              <div key={t.tipo} className="rounded-lg p-3" style={{ background: pal.bg }}>
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: pal.mid }}>
                  {t.tipo}
                </div>
                <div className="text-base font-medium mt-0.5" style={{ color: pal.text }}>
                  {fmtCompact(t.valor)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: pal.mid }}>
                  {fmtPct(t.share)} · {fmtInt(t.skus)} SKUs
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Placeholders: stock muerto + transferencias + reporte */}
      <div className="grid grid-cols-3 gap-2.5">
        <ProximoBloque
          icon={AlertTriangle}
          titulo="Stock muerto"
          nota="SKUs con valor alto y sin movimiento en +90 días. Requiere ventas por SKU × CEDIS."
        />
        <ProximoBloque
          icon={ArrowRightLeft}
          titulo="Transferencias sugeridas"
          nota="CEDIS con exceso vs otro agotado del mismo SKU. Requiere venta por CEDIS para priorizar."
        />
        <ProximoBloque
          icon={FileText}
          titulo="Reporte"
          nota="Exportable a Excel/PDF con el detalle por almacén, CEDIS y SKU."
        />
      </div>
    </div>
  );
}

function KpiTile({ label, valor, subtitulo, esWarning }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-xl font-medium mt-0.5 text-gray-800">{valor}</div>
      <div className={`text-[11px] mt-1 ${esWarning ? 'text-amber-600' : 'text-gray-500'}`}>{subtitulo}</div>
    </div>
  );
}

function ProximoBloque({ icon: Icon, titulo, nota }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-500">
        {Icon && <Icon className="w-4 h-4" />}
        <div className="text-sm font-medium">{titulo}</div>
      </div>
      <div className="text-xs text-gray-400 mt-1.5">Próximamente</div>
      <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">{nota}</div>
    </div>
  );
}
