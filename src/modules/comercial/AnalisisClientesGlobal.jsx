import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, TrendingUp, TrendingDown, Minus, Search, X, Users,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6', soft: '#B5D4F4' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75', soft: '#9FE1CB' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD', soft: '#CECBF6' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30', soft: '#F5C4B3' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517', soft: '#FAC775' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E', soft: '#F4C0D1' },
  green:  { bg: '#EAF3DE', text: '#173404', mid: '#3B6D11', strong: '#639922', soft: '#C0DD97' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780', soft: '#D3D1C7' },
};
const CANAL_COLOR = {
  'DISTRIBUIDOR':         PALETTE.teal,
  'MAYOREO':              PALETTE.blue,
  'MERCADO LIBRE':        PALETTE.amber,
  'AMAZON':               PALETTE.coral,
  'E-COMMERCE':           PALETTE.coral,
  'SITIO WEB':            PALETTE.teal,
  'MOSTRADOR':            PALETTE.amber,
  'RETAIL REPRESENTADOS': PALETTE.purple,
  'RETAIL PROPIOS':       PALETTE.pink,
  'RETAIL':               PALETTE.purple,
};
const colorCanal = (k) => CANAL_COLOR[String(k || '').toUpperCase()] || PALETTE.gray;

// Reglas de canonización: muchos canales (MOSTRADOR, E-COMMERCE) tienen
// un cliente_nombre distinto por venta. Se colapsan a entidades reales.
//   - MOSTRADOR  → todo el canal a "Mostrador"
//   - E-COMMERCE → match por substring del nombre a 4 marketplaces conocidos
//                  (Mercado Libre / Amazon / Sitio Web / Cyberpuerta), resto → "Otros e-commerce"
//   - Resto      → cliente_nombre tal cual
const ECOM_RULES = [
  { match: ['MERCADO LIBRE', 'MERCADOLIBRE', 'MELI'], nombre: 'MERCADO LIBRE' },
  { match: ['AMAZON'], nombre: 'AMAZON' },
  { match: ['CYBERPU'], nombre: 'CYBERPUERTA' },
  { match: ['SITIO WEB', 'SITIOWEB', 'PAGINA WEB', 'PÁGINA WEB', 'TIENDA EN LINEA', 'TIENDA EN LÍNEA'], nombre: 'SITIO WEB' },
];
const clienteCanonico = (clienteNombre, canal) => {
  const c = String(canal || '').toUpperCase();
  const n = String(clienteNombre || '').toUpperCase();
  if (c === 'MOSTRADOR') return 'MOSTRADOR';
  if (c === 'E-COMMERCE') {
    for (const r of ECOM_RULES) {
      if (r.match.some((m) => n.includes(m))) return r.nombre;
    }
    return 'OTROS E-COMMERCE';
  }
  return clienteNombre || '';
};
const esColapsado = (nombre, canal) => {
  const c = String(canal || '').toUpperCase();
  return c === 'MOSTRADOR' || c === 'E-COMMERCE';
};
// Para la query del modal: dado el cliente canónico, devuelve los predicados
// que matchean a las filas raw de facturacion_clientes.
const filtroRawParaCanonico = (nombreCanonico, canal) => {
  const c = String(canal || '').toUpperCase();
  if (c === 'MOSTRADOR') return { canal: 'MOSTRADOR' };
  if (c === 'E-COMMERCE') {
    const regla = ECOM_RULES.find((r) => r.nombre === nombreCanonico);
    if (regla) return { canal: 'E-COMMERCE', ilike: regla.match };
    return { canal: 'E-COMMERCE', excludeIlike: ECOM_RULES.flatMap((r) => r.match) };
  }
  return { clienteExacto: nombreCanonico };
};
const chipCanal = (canal) => {
  const s = String(canal || '').toUpperCase();
  if (s.startsWith('DISTRIBU')) return 'DIST';
  if (s.startsWith('MAYO')) return 'MAYO';
  if (s.startsWith('RETAIL')) return 'RETAIL';
  if (s.startsWith('E-COM') || s === 'MERCADO LIBRE' || s === 'AMAZON') return 'E-COM';
  if (s.startsWith('MOSTRA')) return 'MOST';
  if (s.startsWith('SITIO')) return 'WEB';
  return s.slice(0, 6);
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
const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');

export default function AnalisisClientesGlobal() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [canalAct, setCanalAct] = useState([]);
  const [canalPrev, setCanalPrev] = useState([]);
  const [clientesAct, setClientesAct] = useState([]);
  const [clientesPrev, setClientesPrev] = useState([]);
  const [clientesMes, setClientesMes] = useState([]);
  const [cuotas, setCuotas] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [canalFiltro, setCanalFiltro] = useState('TODOS');
  const [orden, setOrden] = useState('ytd');
  const [limite, setLimite] = useState(60);
  const [clienteAbierto, setClienteAbierto] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v_vision_factura_canal').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
      if (unique.length > 0 && !unique.includes(anio)) setAnio(unique[0]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    setClienteAbierto(null);
    (async () => {
      const mesActualAprox = new Date().getMonth() + 1;
      const [a, p, c, cp, q] = await Promise.all([
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio),
        supabase.from('v_vision_factura_canal').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_factura_clientes').select('*').eq('anio', anio),
        supabase.from('v_vision_factura_clientes').select('*').eq('anio', anio - 1),
        supabase.from('cuotas_canales').select('*').eq('anio', anio),
      ]);
      setCanalAct(a.data || []);
      setCanalPrev(p.data || []);
      setClientesAct(c.data || []);
      setClientesPrev(cp.data || []);
      setCuotas(q.data || []);

      const mesMaxCanal = Math.max(...((a.data || []).map((r) => Number(r.mes)).filter(Boolean)), 0) || mesActualAprox;
      let acc = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data: page, error } = await supabase
          .from('facturacion_clientes')
          .select('cliente_nombre, monto, canal')
          .eq('anio', anio)
          .eq('mes', mesMaxCanal)
          .range(from, from + PAGE - 1);
        if (error || !page || page.length === 0) break;
        acc = acc.concat(page);
        if (page.length < PAGE) break;
        from += PAGE;
      }
      setClientesMes(acc);
      setLoading(false);
    })();
  }, [anio]);

  const mesMax = useMemo(() => {
    let m = 0;
    canalAct.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [canalAct]);

  const kpis = useMemo(() => {
    const ventaYTD = canalAct.filter((r) => Number(r.mes) <= mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaYTDPrev = canalPrev.filter((r) => Number(r.mes) <= mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaMes = canalAct.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const ventaMesPrev = canalPrev.filter((r) => Number(r.mes) === mesMax).reduce((s, r) => s + (Number(r.venta) || 0), 0);
    const activos = new Set(
      clientesAct.map((c) => clienteCanonico(c.cliente_nombre, c.canal)).filter(Boolean)
    ).size;
    const total = activos;
    const cuotaTotal = cuotas.find((c) => c.dimension_tipo === 'TOTAL')?.meta_facturacion;
    const cumpl = cuotaTotal > 0 ? (ventaYTD / cuotaTotal) * 100 : null;
    const gap = cuotaTotal > 0 ? cuotaTotal - ventaYTD : null;
    return {
      ventaYTD, ventaMes, ventaMesPrev, ventaYTDPrev,
      deltaYTD: ventaYTDPrev > 0 ? ((ventaYTD - ventaYTDPrev) / ventaYTDPrev) * 100 : null,
      deltaMes: ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null,
      activos, total, cuotaTotal, cumpl, gap,
    };
  }, [canalAct, canalPrev, clientesAct, cuotas, mesMax]);

  const yoyMensual = useMemo(() => {
    const sumarPorMes = (rows) => {
      const arr = Array(12).fill(null);
      rows.forEach((r) => {
        const m = Number(r.mes);
        if (m < 1 || m > 12) return;
        arr[m - 1] = (arr[m - 1] || 0) + (Number(r.venta) || 0);
      });
      return arr;
    };
    const act = sumarPorMes(canalAct);
    const prv = sumarPorMes(canalPrev);
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      actual: act[i],
      anterior: prv[i],
    }));
  }, [canalAct, canalPrev]);

  const canales = useMemo(() => {
    const m = new Map();
    canalAct.filter((r) => Number(r.mes) <= mesMax).forEach((r) => {
      const k = r.canal || 'Otros';
      m.set(k, (m.get(k) || 0) + (Number(r.venta) || 0));
    });
    const mPrev = new Map();
    canalPrev.filter((r) => Number(r.mes) <= mesMax).forEach((r) => {
      const k = r.canal || 'Otros';
      mPrev.set(k, (mPrev.get(k) || 0) + (Number(r.venta) || 0));
    });
    const total = Array.from(m.values()).reduce((s, v) => s + v, 0);
    return Array.from(m.entries())
      .map(([canal, venta]) => {
        const prev = mPrev.get(canal) || 0;
        return {
          canal,
          venta,
          share: total > 0 ? (venta / total) * 100 : 0,
          deltaYoY: prev > 0 ? ((venta - prev) / prev) * 100 : null,
        };
      })
      .sort((a, b) => b.venta - a.venta);
  }, [canalAct, canalPrev, mesMax]);

  const mesPorCliente = useMemo(() => {
    const m = new Map();
    clientesMes.forEach((r) => {
      const k = clienteCanonico(r.cliente_nombre, r.canal);
      if (!k) return;
      m.set(k, (m.get(k) || 0) + (Number(r.monto) || 0));
    });
    return m;
  }, [clientesMes]);

  const ventaTotalAct = useMemo(() =>
    clientesAct.reduce((s, c) => s + (Number(c.venta) || 0), 0), [clientesAct]);

  const clientesRanking = useMemo(() => {
    // Agregar año actual: si el canal está en CANALES_AGREGADOS, todos colapsan a un solo "cliente"
    const actMap = new Map();
    clientesAct.forEach((c) => {
      const nombre = clienteCanonico(c.cliente_nombre, c.canal);
      if (!nombre || nombre === 'Sin nombre') return;
      const k = nombre;
      if (!actMap.has(k)) actMap.set(k, { cliente: nombre, canal: c.canal || 'Otros', ytd: 0 });
      actMap.get(k).ytd += Number(c.venta) || 0;
    });
    const prevMap = new Map();
    clientesPrev.forEach((c) => {
      const nombre = clienteCanonico(c.cliente_nombre, c.canal);
      if (!nombre) return;
      prevMap.set(nombre, (prevMap.get(nombre) || 0) + (Number(c.venta) || 0));
    });
    let lista = Array.from(actMap.values()).map((c) => {
      const ytdPrev = prevMap.get(c.cliente) || 0;
      return {
        cliente: c.cliente,
        canal: c.canal,
        ytd: c.ytd,
        mes: mesPorCliente.get(c.cliente) || 0,
        ytdPrev,
        deltaYoY: ytdPrev > 0 ? ((c.ytd - ytdPrev) / ytdPrev) * 100 : null,
        share: ventaTotalAct > 0 ? (c.ytd / ventaTotalAct) * 100 : 0,
      };
    });
    if (canalFiltro !== 'TODOS') {
      lista = lista.filter((c) => c.canal === canalFiltro);
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toUpperCase();
      lista = lista.filter((c) => c.cliente.toUpperCase().includes(q));
    }
    lista.sort((a, b) => orden === 'mes' ? b.mes - a.mes : b.ytd - a.ytd);
    return lista;
  }, [clientesAct, clientesPrev, mesPorCliente, ventaTotalAct, canalFiltro, busqueda, orden]);

  const canalesOpciones = useMemo(() =>
    Array.from(new Set(clientesAct.map((c) => c.canal).filter(Boolean))).sort()
  , [clientesAct]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Activity className="w-10 h-10 mx-auto mb-3" />
        Cargando análisis por cliente…
      </div>
    );
  }
  if (canalAct.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Análisis por cliente</h2>
        <p>No hay datos para {anio}. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            Dirección Comercial · YTD ene–{MESES_LBL[mesMax - 1]} {anio}
          </p>
          <h2 className="text-2xl font-medium text-gray-800">Análisis por cliente</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {kpis.activos.toLocaleString('es-MX')} clientes activos en facturación
          </p>
        </div>
        <label className="flex flex-col text-[11px] text-gray-500">
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {/* Buscador + filtro de canal */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-lg h-10">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente (CT INTERNACIONAL, DICOTECH, PCEL…)"
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={canalFiltro}
          onChange={(e) => setCanalFiltro(e.target.value)}
          className="h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="TODOS">Todos los canales</option>
          {canalesOpciones.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-4 gap-2.5">
        <KpiTile
          label={`Facturación ${MESES_FULL[mesMax - 1].toLowerCase()}`}
          valor={fmtCompact(kpis.ventaMes)}
          delta={kpis.deltaMes}
          subtitulo={`vs ${MESES_LBL[mesMax - 1]} ${anio - 1}: ${fmtCompact(kpis.ventaMesPrev)}`}
        />
        <KpiTile
          label={`YTD ${anio}`}
          valor={fmtCompact(kpis.ventaYTD)}
          delta={kpis.deltaYTD}
          subtitulo={`vs YTD ${anio - 1}: ${fmtCompact(kpis.ventaYTDPrev)}`}
        />
        <KpiTile
          label="Clientes activos"
          valor={kpis.activos.toLocaleString('es-MX')}
          delta={null}
          subtitulo={`de ${kpis.total.toLocaleString('es-MX')} en cartera`}
        />
        <KpiTile
          label="Cumplimiento cuota"
          valor={kpis.cumpl != null ? fmtPct(kpis.cumpl) : 'Pendiente'}
          delta={null}
          subtitulo={kpis.gap > 0 ? `Faltan ${fmtCompact(kpis.gap)}` : 'Cuota anual pendiente'}
          esWarning={kpis.cumpl != null && kpis.cumpl < 80}
        />
      </div>

      {/* Gráfica YoY mensual */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800">Facturación mensual vs {anio - 1}</h3>
          <span className="text-xs text-gray-500">
            {MESES_FULL[mesMax - 1]} {anio}: {fmtPctDelta(kpis.deltaMes)} YoY
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={yoyMensual} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#888' }} width={50} />
            <Tooltip formatter={(v) => fmtMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="anterior" name={`${anio - 1}`} fill={PALETTE.blue.soft} radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name={`${anio}`} fill={PALETTE.blue.mid} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Canales */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800">Canales</h3>
          <span className="text-xs text-gray-500">YTD {anio}</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {canales.map((c) => {
            const pal = colorCanal(c.canal);
            return (
              <button
                key={c.canal}
                onClick={() => setCanalFiltro(canalFiltro === c.canal ? 'TODOS' : c.canal)}
                className="text-left rounded-xl p-3 transition-all hover:ring-2"
                style={{
                  background: pal.bg,
                  ringColor: pal.mid,
                  border: canalFiltro === c.canal ? `2px solid ${pal.mid}` : '2px solid transparent',
                }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: pal.mid }}>
                  {c.canal}
                </div>
                <div className="text-lg font-medium mt-0.5" style={{ color: pal.text }}>
                  {fmtCompact(c.venta)}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: pal.mid }}>
                  {c.deltaYoY != null && (
                    <span>{fmtPctDelta(c.deltaYoY)} YoY · </span>
                  )}
                  {fmtPct(c.share)} del total
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clientes ranking */}
      <div className="flex items-baseline justify-between mt-2 px-1">
        <h3 className="text-sm font-medium text-gray-800">
          Todos los clientes
          {canalFiltro !== 'TODOS' && (
            <span className="ml-2 text-xs font-normal text-gray-500">· {canalFiltro}</span>
          )}
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-400">
            Mostrando {Math.min(limite, clientesRanking.length).toLocaleString('es-MX')} de {clientesRanking.length.toLocaleString('es-MX')}
          </span>
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setOrden('ytd')}
              className={`px-2.5 py-1 rounded text-xs ${orden === 'ytd' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >YTD</button>
            <button
              onClick={() => setOrden('mes')}
              className={`px-2.5 py-1 rounded text-xs ${orden === 'mes' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >Mes</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {clientesRanking.slice(0, limite).map((c, i) => (
          <TarjetaCliente
            key={c.cliente}
            ranking={i + 1}
            cliente={c}
            onClick={() => setClienteAbierto({ cliente: c.cliente, canal: c.canal })}
          />
        ))}
      </div>

      {clientesRanking.length > limite && (
        <div className="text-center pt-2">
          <button
            onClick={() => setLimite((l) => l + 60)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Ver más ({(clientesRanking.length - limite).toLocaleString('es-MX')} restantes)
          </button>
        </div>
      )}

      {clienteAbierto && (
        <ModalCliente
          clienteNombre={clienteAbierto.cliente}
          canalCliente={clienteAbierto.canal}
          anio={anio}
          mesMax={mesMax}
          onClose={() => setClienteAbierto(null)}
        />
      )}
    </div>
  );
}

function KpiTile({ label, valor, delta, subtitulo, esWarning }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-xl font-medium mt-0.5 text-gray-800">{valor}</div>
      <div className="text-[11px] mt-1 flex items-center gap-1">
        {delta != null && (
          <span className={delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3 inline -mt-0.5" /> : <TrendingDown className="w-3 h-3 inline -mt-0.5" />}
            {' '}{fmtPctDelta(delta)}
          </span>
        )}
        <span className={esWarning ? 'text-amber-600' : 'text-gray-500'}>{subtitulo}</span>
      </div>
    </div>
  );
}

function TarjetaCliente({ ranking, cliente, onClick }) {
  const pal = colorCanal(cliente.canal);
  const deltaColor = cliente.deltaYoY == null ? 'text-gray-500'
    : cliente.deltaYoY > 3 ? 'text-emerald-600'
    : cliente.deltaYoY < -3 ? 'text-rose-600'
    : 'text-gray-500';
  const DeltaIcon = cliente.deltaYoY == null ? Minus
    : cliente.deltaYoY > 3 ? TrendingUp
    : cliente.deltaYoY < -3 ? TrendingDown
    : Minus;
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-gray-400 font-medium">#{ranking}</span>
          <span className="text-[13px] font-medium text-gray-800 truncate">{cliente.cliente}</span>
        </div>
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
          style={{ background: pal.bg, color: pal.text }}
          title={cliente.canal}
        >
          {chipCanal(cliente.canal)}
        </span>
      </div>
      <div className="text-[10px] text-gray-500">
        YTD · mes {fmtCompact(cliente.mes)}
      </div>
      <div className="text-xl font-medium text-gray-800 leading-tight">
        {fmtCompact(cliente.ytd)}
      </div>
      <div className="mt-1.5">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className={deltaColor}>
            <DeltaIcon className="w-3 h-3 inline -mt-0.5" /> {fmtPctDelta(cliente.deltaYoY)}
          </span>
          <span className="text-gray-700 font-medium">{fmtPct(cliente.share)} del total</span>
        </div>
        <div className="bg-gray-100 h-1 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: pal.mid,
              width: `${Math.min(100, Math.max(2, cliente.share * 6))}%`,
            }}
          />
        </div>
      </div>
    </button>
  );
}

function ModalCliente({ clienteNombre, canalCliente, anio, mesMax, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const filtro = filtroRawParaCanonico(clienteNombre, canalCliente);
      let acc = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let query = supabase
          .from('facturacion_clientes')
          .select('anio, mes, sku, monto, piezas, canal, cliente_nombre')
          .gte('anio', anio - 1)
          .lte('anio', anio)
          .range(from, from + PAGE - 1);
        if (filtro.clienteExacto) {
          query = query.eq('cliente_nombre', filtro.clienteExacto);
        } else if (filtro.canal) {
          query = query.eq('canal', filtro.canal);
          if (filtro.ilike && filtro.ilike.length) {
            const or = filtro.ilike.map((p) => `cliente_nombre.ilike.%${p}%`).join(',');
            query = query.or(or);
          }
        }
        const { data: page, error } = await query;
        if (error || !page || page.length === 0) break;
        let filtered = page;
        if (filtro.excludeIlike && filtro.excludeIlike.length) {
          filtered = page.filter((r) => {
            const n = String(r.cliente_nombre || '').toUpperCase();
            return !filtro.excludeIlike.some((p) => n.includes(p));
          });
        }
        acc = acc.concat(filtered);
        if (page.length < PAGE) break;
        from += PAGE;
      }
      setDatos(acc);
      setCargando(false);
    })();
  }, [clienteNombre, canalCliente, anio]);

  const detalle = useMemo(() => {
    if (!datos) return null;
    const sumMensual = Array(12).fill(0);
    const sumMensualPrev = Array(12).fill(0);
    let canal = 'Otros';
    const skuMap = new Map();
    const mesesActivos = new Set();
    datos.forEach((r) => {
      const m = Number(r.mes) - 1;
      if (m < 0 || m > 11) return;
      const imp = Number(r.monto) || 0;
      if (Number(r.anio) === anio) {
        sumMensual[m] += imp;
        if (imp > 0) mesesActivos.add(m + 1);
      } else {
        sumMensualPrev[m] += imp;
      }
      if (r.canal) canal = r.canal;
      if (r.sku && Number(r.anio) === anio) {
        skuMap.set(r.sku, (skuMap.get(r.sku) || 0) + imp);
      }
    });
    const ytd = sumMensual.slice(0, mesMax).reduce((s, v) => s + v, 0);
    const ytdPrev = sumMensualPrev.slice(0, mesMax).reduce((s, v) => s + v, 0);
    const mesActual = sumMensual[mesMax - 1] || 0;
    const mesAnterior = mesMax >= 2 ? sumMensual[mesMax - 2] : 0;
    const mesActualPrev = sumMensualPrev[mesMax - 1] || 0;
    const cierreMesAnterior = mesMax >= 2 ? sumMensual[mesMax - 2] : null;
    const cierreMesAnteriorPrev = mesMax >= 2 ? sumMensualPrev[mesMax - 2] : null;
    const topSkus = Array.from(skuMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sku, importe]) => ({ sku, importe }));
    const serie = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_LBL[i],
      [`${anio}`]: sumMensual[i],
      [`${anio - 1}`]: sumMensualPrev[i],
    }));
    return {
      canal, ytd, ytdPrev,
      mesActual, mesActualPrev, mesAnterior,
      cierreMesAnterior, cierreMesAnteriorPrev,
      topSkus,
      mesesActivos: mesesActivos.size,
      skusDistintos: skuMap.size,
      serie,
      deltaYTD: ytdPrev > 0 ? ((ytd - ytdPrev) / ytdPrev) * 100 : null,
      deltaMes: mesActualPrev > 0 ? ((mesActual - mesActualPrev) / mesActualPrev) * 100 : null,
      deltaCierre: cierreMesAnteriorPrev > 0 ? ((cierreMesAnterior - cierreMesAnteriorPrev) / cierreMesAnteriorPrev) * 100 : null,
    };
  }, [datos, anio, mesMax]);

  const pal = detalle ? colorCanal(detalle.canal) : PALETTE.gray;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 flex items-center justify-between rounded-t-2xl"
          style={{ background: pal.bg, borderBottom: `1px solid ${pal.soft}` }}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest" style={{ color: pal.mid }}>
              {detalle?.canal || '—'}
            </div>
            <h3 className="text-lg font-medium truncate" style={{ color: pal.text }}>
              {clienteNombre}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50">
            <X className="w-5 h-5" style={{ color: pal.text }} />
          </button>
        </div>

        {cargando || !detalle ? (
          <div className="p-12 text-center text-gray-400">
            <Activity className="w-8 h-8 mx-auto mb-2" />
            Cargando datos del cliente…
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* KPIs principales */}
            <div className="grid grid-cols-4 gap-2.5">
              <KpiTile
                label={`${MESES_FULL[mesMax - 1]} ${anio}`}
                valor={fmtCompact(detalle.mesActual)}
                delta={detalle.deltaMes}
                subtitulo={`vs ${MESES_LBL[mesMax - 1]} ${anio - 1}: ${fmtCompact(detalle.mesActualPrev)}`}
              />
              <KpiTile
                label={`Cierre ${mesMax >= 2 ? MESES_FULL[mesMax - 2] : '—'}`}
                valor={mesMax >= 2 ? fmtCompact(detalle.cierreMesAnterior) : '—'}
                delta={detalle.deltaCierre}
                subtitulo={mesMax >= 2 ? `vs ${MESES_LBL[mesMax - 2]} ${anio - 1}: ${fmtCompact(detalle.cierreMesAnteriorPrev)}` : ''}
              />
              <KpiTile
                label={`YTD ${anio}`}
                valor={fmtCompact(detalle.ytd)}
                delta={detalle.deltaYTD}
                subtitulo={`vs YTD ${anio - 1}: ${fmtCompact(detalle.ytdPrev)}`}
              />
              <KpiTile
                label="Actividad"
                valor={`${detalle.mesesActivos} meses`}
                delta={null}
                subtitulo={`${detalle.skusDistintos} SKUs distintos`}
              />
            </div>

            {/* Sparkline / línea 12m */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-sm font-medium text-gray-800">Facturación mensual</div>
                <div className="text-[11px] text-gray-500">
                  <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: pal.mid }} />
                  {anio}
                  <span className="ml-3 inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: pal.soft }} />
                  {anio - 1}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={detalle.serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: '#888' }} width={50} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Line type="monotone" dataKey={`${anio - 1}`} stroke={pal.soft} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${anio}`} stroke={pal.mid} strokeWidth={2.5} dot={{ r: 3, fill: pal.mid }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top SKUs */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm font-medium text-gray-800 mb-3">Top SKUs facturados ({anio})</div>
              {detalle.topSkus.length === 0 ? (
                <div className="text-xs text-gray-500">Sin SKUs este año.</div>
              ) : (
                <div className="space-y-1.5">
                  {detalle.topSkus.map((s, i) => {
                    const pct = detalle.ytd > 0 ? (s.importe / detalle.ytd) * 100 : 0;
                    return (
                      <div key={s.sku} className="flex items-center gap-2.5 text-xs">
                        <span className="text-gray-400 w-5">#{i + 1}</span>
                        <span className="font-mono w-28 truncate text-gray-700">{s.sku}</span>
                        <div className="flex-1 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full" style={{ background: pal.mid, width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <span className="w-20 text-right font-medium text-gray-800">{fmtCompact(s.importe)}</span>
                        <span className="w-12 text-right text-gray-500">{fmtPct(pct)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Nota cuota */}
            <div className="text-[11px] text-gray-500 px-1">
              Cuota anual por cliente: pendiente de cargar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
