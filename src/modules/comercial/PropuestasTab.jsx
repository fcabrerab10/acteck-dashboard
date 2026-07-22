// PropuestasTab.jsx — Armador de propuestas de venta por cliente.
// Flujo wizard: landing → cliente → contexto → catálogo → ajustes → revisar.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';

// ═══ Constantes ═══
const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', color: '#8B5CF6', iniciales: 'DL' },
  { key: 'pcel',       label: 'PCEL',       color: '#10B981', iniciales: 'PC' },
  { key: 'dicotech',   label: 'Dicotech',   color: '#0EA5E9', iniciales: 'DT' },
];

const FAMILIA_DIGITALIFE_HOJA = {
  'Monitor':        'Monitores',
  'Sillas y Mesas': 'Sillas',
};
const familiaHoja = (familia) => FAMILIA_DIGITALIFE_HOJA[familia] || 'Todo lo demás';

const PASOS = ['Cliente', 'Contexto', 'Catálogo', 'Ajustes', 'Revisar'];

// Meses cerrados anteriores al actual (los últimos 3)
function mesesCerrados() {
  const hoy = new Date();
  const arr = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    arr.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return arr;
}
const MES_ACTUAL = { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
const MES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ═══ Componente principal ═══
export default function PropuestasTab() {
  // Estados del wizard
  const [paso, setPaso] = useState(0); // 0 = landing, 1..5 = pasos
  const [clienteKey, setClienteKey] = useState(null);
  const [propuesta, setPropuesta] = useState({}); // { sku: { piezas, precio, listaSel } }

  // Data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [skus, setSkus] = useState([]);
  const [contexto, setContexto] = useState(null); // { cuota, facturado, gap, topVendidos, cartera }

  // Fetch al pasar de paso 1 → 2
  useEffect(() => {
    if (paso < 2 || !clienteKey) return;
    if (skus.length > 0) return; // ya cargado
    fetchAll(clienteKey).then(({ skus: rows, contexto: ctx }) => {
      setSkus(rows);
      setContexto(ctx);
      setLoading(false);
    }).catch((e) => {
      console.warn('[Propuestas]', e);
      setError(e.message || 'Error al cargar');
      setLoading(false);
    });
    setLoading(true);
  }, [paso, clienteKey, skus.length]);

  // Reset al cambiar cliente
  const reiniciar = () => {
    setPaso(0);
    setClienteKey(null);
    setPropuesta({});
    setSkus([]);
    setContexto(null);
    setError(null);
  };

  const iniciar = (cli) => {
    // Limpia estado previo pero deja el paso avanzando al 2 (Contexto)
    setPropuesta({});
    setSkus([]);
    setContexto(null);
    setError(null);
    setClienteKey(cli);
    setPaso(2);
  };

  const cliente = CLIENTES.find((c) => c.key === clienteKey);

  // ═══ Landing ═══
  if (paso === 0) {
    return <Landing onIniciar={() => setPaso(1)} />;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header con back a landing */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={reiniciar} className="text-xs text-gray-500 hover:text-gray-800 mb-1">← Propuestas</button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Nueva propuesta</h1>
        </div>
      </div>

      {/* Stepper */}
      <Stepper paso={paso} />

      {/* Contexto card (visible desde paso 2) */}
      {paso >= 2 && contexto && (
        <ContextoCard cliente={cliente} contexto={contexto} />
      )}

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Cargando data de {cliente?.label}…</div>}
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-4 text-sm">{error}</div>}

      {/* Contenido por paso */}
      {!loading && !error && paso === 1 && (
        <Paso1Cliente onElegir={iniciar} />
      )}
      {!loading && !error && paso === 2 && contexto && (
        <Paso2Contexto contexto={contexto} onSiguiente={() => setPaso(3)} onPrev={() => setPaso(1)} />
      )}
      {!loading && !error && paso === 3 && (
        <Paso3Catalogo
          skus={skus}
          propuesta={propuesta}
          setPropuesta={setPropuesta}
          onSiguiente={() => setPaso(4)}
          onPrev={() => setPaso(2)}
        />
      )}
      {!loading && !error && paso === 4 && (
        <Paso4Ajustes
          skus={skus}
          propuesta={propuesta}
          setPropuesta={setPropuesta}
          cliente={cliente}
          onSiguiente={() => setPaso(5)}
          onPrev={() => setPaso(3)}
        />
      )}
      {!loading && !error && paso === 5 && (
        <Paso5Revisar
          skus={skus}
          propuesta={propuesta}
          cliente={cliente}
          onPrev={() => setPaso(4)}
        />
      )}
    </div>
  );
}

// ═══ Landing ═══
function Landing({ onIniciar }) {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Propuestas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Arma propuestas de venta por cliente y expórtalas a Excel.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center max-w-2xl mx-auto shadow-sm">
        <div className="text-5xl mb-3">📋</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Iniciar una propuesta nueva</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
          Elige el cliente, revisa su contexto de venta y arma la propuesta paso a paso.
        </p>
        <button onClick={onIniciar}
          className="px-8 py-3 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 shadow-md transition">
          + Nueva propuesta
        </button>
      </div>
    </div>
  );
}

// ═══ Stepper ═══
function Stepper({ paso }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-1 overflow-x-auto">
      {PASOS.map((label, i) => {
        const n = i + 1;
        const state = paso > n ? 'done' : paso === n ? 'active' : 'pending';
        return (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-2 flex-shrink-0 text-xs font-semibold ${
              state === 'done' ? 'text-emerald-600' :
              state === 'active' ? 'text-gray-900' :
              'text-gray-300'
            }`}>
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                state === 'done' ? 'bg-emerald-500 text-white' :
                state === 'active' ? 'bg-black text-white' :
                'bg-gray-100 text-gray-400'
              }`}>{state === 'done' ? '✓' : n}</span>
              {label}
            </div>
            {i < PASOS.length - 1 && <div className={`flex-1 h-px min-w-[24px] ${paso > n ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ═══ Card contexto cliente (persiste en pasos 2-5) ═══
function ContextoCard({ cliente, contexto }) {
  const cuotaPct = contexto.cuota > 0 ? (contexto.facturado / contexto.cuota * 100) : 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4"
      style={{ background: `${cliente.color}08` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: cliente.color }}>{cliente.iniciales}</div>
          <div>
            <div className="font-bold text-gray-900">{cliente.label}</div>
            <div className="text-[11px] text-gray-500">{MES_LABEL[MES_ACTUAL.mes - 1]} {MES_ACTUAL.anio}</div>
          </div>
        </div>
        <div className="text-[11px] text-gray-500">Contexto de venta del mes</div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        <KpiMini label="Cuota" value={formatMXN(contexto.cuota)} />
        <KpiMini label="Facturado" value={formatMXN(contexto.facturado)} sub={`${cuotaPct.toFixed(0)}%`} />
        <KpiMini label="Gap" value={formatMXN(Math.max(0, contexto.cuota - contexto.facturado))}
          tone={cuotaPct >= 100 ? 'pos' : cuotaPct >= 70 ? 'warn' : 'bad'} />
        <KpiMini label="Días restantes" value={contexto.diasRestantes} />
        <KpiMini label="SKUs disponibles" value={contexto.skusConInv?.toLocaleString('es-MX') || '—'} sub="con inv Acteck" />
      </div>
      {contexto.topVendidos && contexto.topVendidos.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-600">
          <span className="text-gray-400 font-semibold uppercase tracking-wider mr-2">Top 5 vendidos 90d:</span>
          {contexto.topVendidos.slice(0, 5).map((s, i) => (
            <span key={s.sku}>
              {i > 0 && <span className="text-gray-300 mx-1.5">·</span>}
              <span className="font-medium">{s.sku}</span> <span className="text-gray-400">({s.piezas}pz)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiMini({ label, value, sub, tone }) {
  const color = tone === 'pos' ? '#10B981' : tone === 'warn' ? '#F59E0B' : tone === 'bad' ? '#EF4444' : '#111827';
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-gray-400 font-bold">{label}</div>
      <div className="text-[15px] font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

// ═══ Paso 1: Elegir cliente ═══
function Paso1Cliente({ onElegir }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
      <h2 className="text-lg font-bold text-gray-900 mb-2">¿Para qué cliente?</h2>
      <p className="text-sm text-gray-500 mb-6">Selecciona el cliente para el que armarás la propuesta.</p>
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        {CLIENTES.map((c) => (
          <button key={c.key} onClick={() => onElegir(c.key)}
            className="p-6 border-2 border-gray-200 rounded-xl hover:border-gray-900 hover:shadow-md transition text-left group">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold mb-3"
              style={{ background: c.color }}>{c.iniciales}</div>
            <div className="font-bold text-gray-900">{c.label}</div>
            <div className="text-xs text-gray-500 group-hover:text-gray-700 mt-1">Iniciar propuesta →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══ Paso 2: Confirmar contexto ═══
function Paso2Contexto({ contexto, onSiguiente, onPrev }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">Contexto del cliente</h2>
      <p className="text-sm text-gray-500 mb-4">
        Revisa la información de venta antes de elegir SKUs. La card de arriba muestra cuota, facturado, gap
        y los productos que más se están moviendo en los últimos 90 días.
      </p>
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-xs text-gray-600 space-y-1">
        <div><strong>Cuota del mes:</strong> lo que te propusiste facturar en {MES_LABEL[MES_ACTUAL.mes - 1]}</div>
        <div><strong>Facturado:</strong> lo que llevas facturado hasta hoy</div>
        <div><strong>Gap:</strong> lo que falta para cerrar la cuota</div>
        <div><strong>Top vendidos 90d:</strong> productos con más venta en los últimos 3 meses cerrados</div>
      </div>
      <NavBotones onPrev={onPrev} onSiguiente={onSiguiente} labelNext="Ver catálogo →" />
    </div>
  );
}

// ═══ Paso 3: Elegir SKUs ═══
function Paso3Catalogo({ skus, propuesta, setPropuesta, onSiguiente, onPrev }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');
  const [soloConInv, setSoloConInv] = useState(false);

  const familias = useMemo(() => {
    const s = new Set();
    for (const r of skus) if (r.familia) s.add(r.familia);
    return ['todas', ...Array.from(s).sort()];
  }, [skus]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return skus.filter((r) => {
      if (filtroFamilia !== 'todas' && r.familia !== filtroFamilia) return false;
      if (soloConInv && (r.invActeck || 0) <= 0) return false;
      if (q && !(String(r.sku).toUpperCase().includes(q) || String(r.descripcion).toUpperCase().includes(q))) return false;
      return true;
    });
  }, [skus, busqueda, filtroFamilia, soloConInv]);

  const toggleSku = (sku) => {
    setPropuesta((prev) => {
      const next = { ...prev };
      if (sku in next) { delete next[sku]; return next; }
      const meta = skus.find((r) => r.sku === sku);
      const precioDefault = meta ? Object.values(meta.precios)[0] || 0 : 0;
      const listaDefault = meta ? Object.keys(meta.precios)[0] || '' : '';
      next[sku] = {
        piezas: Math.max(1, meta?.promSellout || 1),
        precio: precioDefault,
        listaSel: listaDefault,
      };
      return next;
    });
  };

  const seleccionados = Object.keys(propuesta).length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">Elige los productos</h2>
        <div className="text-sm text-gray-500">
          <strong className="text-gray-900">{seleccionados}</strong> seleccionado{seleccionados !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar SKU o descripción…"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400" />
        <select value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-white cursor-pointer">
          {familias.map((f) => <option key={f} value={f}>{f === 'todas' ? 'Todas las familias' : f}</option>)}
        </select>
        <label className="text-sm text-gray-600 cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg">
          <input type="checkbox" checked={soloConInv} onChange={(e) => setSoloConInv(e.target.checked)} />
          Solo con inventario
        </label>
        <div className="text-xs text-gray-500 whitespace-nowrap">{filtrados.length.toLocaleString('es-MX')}</div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div style={{ maxHeight: 'calc(100vh - 460px)', overflow: 'auto' }}>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-gray-600">
                <th className="text-left px-2 py-2 font-semibold w-8"></th>
                <th className="text-left px-2 py-2 font-semibold" style={{ width: 100 }}>SKU</th>
                <th className="text-left px-2 py-2 font-semibold">Descripción</th>
                <th className="text-left px-2 py-2 font-semibold" style={{ width: 100 }}>Familia</th>
                <th className="text-right px-2 py-2 font-semibold" style={{ width: 60 }}>Inv cli</th>
                <th className="text-right px-2 py-2 font-semibold" style={{ width: 60 }}>Inv Ack</th>
                <th className="text-right px-2 py-2 font-semibold" style={{ width: 70 }}>Prom SO 90d</th>
                <th className="text-right px-2 py-2 font-semibold" style={{ width: 80 }}>Precio ref.</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const sel = r.sku in propuesta;
                const precioRef = Object.values(r.precios)[0];
                return (
                  <tr key={r.sku}
                    onClick={() => toggleSku(r.sku)}
                    className={`border-t border-gray-100 cursor-pointer ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    style={{ height: 30 }}>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={sel} readOnly className="cursor-pointer" />
                    </td>
                    <td className="px-2 py-1 font-mono text-gray-700 whitespace-nowrap text-[10px]">{r.sku}</td>
                    <td className="px-2 py-1 text-gray-800" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>
                      {r.descripcion || '—'}
                    </td>
                    <td className="px-2 py-1 text-gray-500 text-[10px] whitespace-nowrap">{r.familia || '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.invCliente || <span className="text-gray-300">0</span>}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.invActeck || <span className="text-gray-300">0</span>}</td>
                    <td className="px-2 py-1 text-right tabular-nums font-medium">{r.promSellout || <span className="text-gray-300">0</span>}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-gray-600">{precioRef != null ? formatMXN(precioRef) : <span className="text-gray-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <NavBotones
        onPrev={onPrev}
        onSiguiente={onSiguiente}
        disabledSiguiente={seleccionados === 0}
        labelNext={`Ajustar precios (${seleccionados}) →`}
      />
    </div>
  );
}

// ═══ Paso 4: Ajustar piezas y precio ═══
function Paso4Ajustes({ skus, propuesta, setPropuesta, cliente, onSiguiente, onPrev }) {
  const propuestaLista = useMemo(() => Object.entries(propuesta)
    .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
    .filter((r) => r.sku), [propuesta, skus]);
  const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
  const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);

  const editPropuesta = (sku, patch) => setPropuesta((prev) => ({ ...prev, [sku]: { ...(prev[sku] || {}), ...patch } }));
  const removePropuesta = (sku) => setPropuesta((prev) => { const n = { ...prev }; delete n[sku]; return n; });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Ajusta piezas y precio</h2>
        <div className="text-sm">
          <span className="text-gray-500">{propuestaLista.length} SKU · {piezas} pz · </span>
          <strong className="text-gray-900 tabular-nums">{formatMXN(total)}</strong>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-gray-600">
              <th className="text-left px-3 py-2 font-semibold" style={{ width: 100 }}>SKU</th>
              <th className="text-left px-3 py-2 font-semibold">Descripción</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ width: 60 }}>Inv cli</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ width: 60 }}>Inv Ack</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ width: 90 }}>Piezas</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ width: 220 }}>Precio</th>
              <th className="text-right px-3 py-2 font-semibold" style={{ width: 110 }}>Total</th>
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {propuestaLista.map((r) => (
              <AjusteRow key={r.sku} r={r}
                onEdit={(patch) => editPropuesta(r.sku, patch)}
                onRemove={() => removePropuesta(r.sku)} />
            ))}
            <tr className="bg-gray-900 text-white">
              <td colSpan={4} className="px-3 py-2 font-bold text-right">Total propuesta</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold">{piezas}</td>
              <td></td>
              <td className="px-3 py-2 text-right tabular-nums font-bold">{formatMXN(total)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <NavBotones
        onPrev={onPrev}
        onSiguiente={onSiguiente}
        disabledSiguiente={propuestaLista.length === 0}
        labelNext="Revisar propuesta →"
      />
    </div>
  );
}

function AjusteRow({ r, onEdit, onRemove }) {
  const listas = Object.entries(r.precios);
  const [modo, setModo] = useState(r.listaSel === 'personalizado' || !r.listaSel ? 'personalizado' : r.listaSel);

  const setLista = (l) => {
    setModo(l);
    if (l === 'personalizado') { onEdit({ listaSel: 'personalizado' }); return; }
    const precio = r.precios[l];
    if (precio != null) onEdit({ listaSel: l, precio });
    else onEdit({ listaSel: l });
  };
  const subtotal = (Number(r.piezas) || 0) * (Number(r.precio) || 0);

  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 font-mono text-[10px] text-gray-700">{r.sku}</td>
      <td className="px-3 py-2 text-gray-800" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>
        {r.descripcion}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.invCliente || 0}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.invActeck || 0}</td>
      <td className="px-3 py-2">
        <input type="number" min="0" value={r.piezas ?? ''}
          onChange={(e) => onEdit({ piezas: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-full px-2 py-1 text-right text-xs border border-gray-200 rounded outline-none focus:border-gray-400 tabular-nums" />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <select value={modo} onChange={(e) => setLista(e.target.value)}
            className="flex-1 min-w-0 px-1 py-1 text-[10px] border border-gray-200 rounded outline-none bg-white cursor-pointer">
            {listas.map(([l, p]) => (
              <option key={l} value={l}>{l} · ${Math.round(p).toLocaleString('es-MX')}</option>
            ))}
            <option value="personalizado">Personalizado…</option>
          </select>
          {modo === 'personalizado' && (
            <input type="number" min="0" step="0.01" value={r.precio ?? ''}
              onChange={(e) => onEdit({ precio: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
              className="w-20 px-2 py-1 text-right text-[10px] border border-gray-200 rounded outline-none focus:border-gray-400 tabular-nums"
              placeholder="$" />
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMXN(subtotal)}</td>
      <td className="px-3 py-2 text-center">
        <button onClick={onRemove} className="text-gray-400 hover:text-rose-500 text-sm">✕</button>
      </td>
    </tr>
  );
}

// ═══ Paso 5: Revisar + Exportar ═══
function Paso5Revisar({ skus, propuesta, cliente, onPrev }) {
  const propuestaLista = useMemo(() => Object.entries(propuesta)
    .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
    .filter((r) => r.sku), [propuesta, skus]);
  const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
  const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);

  // Para Digitalife agrupamos por hoja (Monitores/Sillas/Todo lo demás)
  const grupos = useMemo(() => {
    if (cliente.key !== 'digitalife') return { 'Propuesta': propuestaLista };
    const g = { 'Monitores': [], 'Sillas': [], 'Todo lo demás': [] };
    for (const r of propuestaLista) g[familiaHoja(r.familia)].push(r);
    return g;
  }, [propuestaLista, cliente]);

  const exportar = () => alert('Export Excel — próximo push. Ya podemos verificar el flujo.');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Revisar propuesta</h2>
        <button onClick={exportar}
          className="px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 shadow-md">
          📥 Exportar Excel
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4 grid grid-cols-3 gap-6 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">SKUs</div>
          <div className="text-xl font-bold text-gray-900 tabular-nums">{propuestaLista.length}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Piezas</div>
          <div className="text-xl font-bold text-gray-900 tabular-nums">{piezas.toLocaleString('es-MX')}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Total propuesta</div>
          <div className="text-xl font-bold text-gray-900 tabular-nums">{formatMXN(total)}</div>
        </div>
      </div>

      {Object.entries(grupos).map(([nombreGrupo, filas]) => {
        if (filas.length === 0) return null;
        const totalGrupo = filas.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
        const piezasGrupo = filas.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
        return (
          <div key={nombreGrupo} className="mb-4">
            {cliente.key === 'digitalife' && (
              <div className="text-sm font-bold text-gray-700 mb-2 px-1">
                {nombreGrupo} <span className="text-gray-400 font-normal">· {filas.length} SKU · {piezasGrupo}pz · {formatMXN(totalGrupo)}</span>
              </div>
            )}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold" style={{ width: 100 }}>SKU</th>
                    <th className="text-left px-3 py-2 font-semibold">Descripción</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ width: 70 }}>Inv cli</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ width: 70 }}>Inv propio</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ width: 80 }}>Prom SO 90d</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ width: 70 }}>Piezas</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ width: 90 }}>Precio</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ width: 110 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r) => (
                    <tr key={r.sku} className="border-t border-gray-100" style={{ height: 32 }}>
                      <td className="px-3 py-1 font-mono text-[10px] text-gray-700">{r.sku}</td>
                      <td className="px-3 py-1 text-gray-800" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
                      <td className="px-3 py-1 text-right tabular-nums">{r.invCliente || 0}</td>
                      <td className="px-3 py-1 text-right tabular-nums">{r.invActeck || 0}</td>
                      <td className="px-3 py-1 text-right tabular-nums">{r.promSellout || 0}</td>
                      <td className="px-3 py-1 text-right tabular-nums font-semibold">{r.piezas}</td>
                      <td className="px-3 py-1 text-right tabular-nums">{formatMXN(r.precio)}</td>
                      <td className="px-3 py-1 text-right tabular-nums font-semibold">{formatMXN((r.piezas || 0) * (r.precio || 0))}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td colSpan={5} className="px-3 py-2 text-right font-bold text-gray-700">Total {cliente.key === 'digitalife' ? nombreGrupo.toLowerCase() : 'propuesta'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{piezasGrupo}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{formatMXN(totalGrupo)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <NavBotones onPrev={onPrev} hideNext />
    </div>
  );
}

// ═══ Navegación paso ═══
function NavBotones({ onPrev, onSiguiente, labelNext = 'Siguiente →', disabledSiguiente = false, hideNext = false }) {
  return (
    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
      <button onClick={onPrev}
        className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
        ← Atrás
      </button>
      {!hideNext && (
        <button onClick={onSiguiente} disabled={disabledSiguiente}
          className={`px-5 py-2 text-sm font-semibold rounded-lg ${disabledSiguiente
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-black text-white hover:bg-gray-800 shadow-sm'}`}>
          {labelNext}
        </button>
      )}
    </div>
  );
}

// ═══ Fetch principal ═══
async function fetchAll(clienteKey) {
  const mm = mesesCerrados();
  const anioMin = Math.min(...mm.map((m) => m.anio));
  const anioMax = Math.max(...mm.map((m) => m.anio));

  const [roadmapRes, invAckRes, invCliRes, preciosRes, sellout90, selloutMes, cuotaRes] = await Promise.all([
    supabase.from('roadmap_sku').select('sku,marca,familia,categoria,descripcion,rdmp'),
    supabase.from('inventario_acteck').select('articulo,disponible'),
    supabase.from('inventario_cliente').select('sku,stock,titulo,anio,semana').eq('cliente', clienteKey),
    supabase.from('precios_sku')
      .select('sku,lista,precio,anio,mes')
      .gte('anio', anioMax - 1)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false }),
    fetchSellout(clienteKey, mm, anioMin, anioMax),
    fetchSelloutMesActual(clienteKey),
    supabase.from('cuotas_mensuales')
      .select('cuota_min,cuota_meta')
      .eq('cliente', clienteKey)
      .eq('anio', MES_ACTUAL.anio).eq('mes', MES_ACTUAL.mes),
  ]);

  // Índices
  const invAck = new Map();
  for (const r of invAckRes.data || []) {
    invAck.set(r.articulo, (invAck.get(r.articulo) || 0) + (Number(r.disponible) || 0));
  }
  const invCli = new Map();
  const invCliTitulos = new Map();
  for (const r of invCliRes.data || []) {
    const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
    const prev = invCli.get(r.sku);
    if (!prev || prev.key < key) {
      invCli.set(r.sku, { key, stock: Number(r.stock) || 0 });
      if (r.titulo) invCliTitulos.set(r.sku, r.titulo);
    }
  }
  const preciosPorSku = new Map();
  for (const r of preciosRes.data || []) {
    if (!preciosPorSku.has(r.sku)) preciosPorSku.set(r.sku, {});
    const lst = preciosPorSku.get(r.sku);
    if (!(r.lista in lst)) lst[r.lista] = Number(r.precio) || 0;
  }
  const sellout = new Map();
  for (const r of sellout90) sellout.set(r.sku, (sellout.get(r.sku) || 0) + (Number(r.cantidad) || 0));

  const rows = (roadmapRes.data || []).map((r) => ({
    sku: r.sku,
    marca: r.marca || '',
    familia: r.familia || '',
    categoria: r.categoria || '',
    descripcion: r.descripcion || invCliTitulos.get(r.sku) || '',
    rdmp: r.rdmp || '',
    invActeck: invAck.get(r.sku) || 0,
    invCliente: invCli.get(r.sku)?.stock || 0,
    sellout90: sellout.get(r.sku) || 0,
    promSellout: Math.round((sellout.get(r.sku) || 0) / 3),
    precios: preciosPorSku.get(r.sku) || {},
  }));
  rows.sort((a, b) => b.sellout90 - a.sellout90);

  // Contexto
  const cuota = (cuotaRes.data || []).reduce((s, r) => s + (Number(r.cuota_min) || Number(r.cuota_meta) || 0), 0);
  const facturado = selloutMes;
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasRestantes = Math.max(0, Math.ceil((finMes - hoy) / 86400000));
  const skusConInv = rows.filter((r) => r.invActeck > 0).length;
  const topVendidos = rows.slice(0, 5).map((r) => ({ sku: r.sku, piezas: r.sellout90 }));

  return {
    skus: rows,
    contexto: { cuota, facturado, gap: Math.max(0, cuota - facturado), diasRestantes, skusConInv, topVendidos },
  };
}

async function fetchSelloutMesActual(clienteKey) {
  const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
  if (clienteKey === 'digitalife') {
    const ini = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const finM = new Date(anio, mes, 0);
    const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(finM.getDate()).padStart(2, '0')}`;
    const { data } = await supabase.from('sellout_detalle')
      .select('cantidad,precio')
      .eq('cliente', 'digitalife')
      .gte('fecha', ini).lte('fecha', fin)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.cantidad) || 0) * (Number(r.precio) || 0), 0);
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('importe')
      .eq('mayorista', 'DICOTECH')
      .eq('anio', anio).eq('mes', mes)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.importe) || 0), 0);
  }
  // pcel — usa sellout_pcel última semana con vta_mes_1 aprox del mes actual (imperfecto pero servible)
  return 0;
}

async function fetchSellout(clienteKey, mm, anioMin, anioMax) {
  const meses = new Set(mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`));

  if (clienteKey === 'digitalife') {
    const { data } = await supabase.from('sellout_detalle')
      .select('no_parte,cantidad,fecha')
      .eq('cliente', 'digitalife')
      .gte('fecha', `${anioMin}-01-01`).limit(200000);
    return (data || [])
      .filter((r) => meses.has(String(r.fecha).slice(0, 7)))
      .map((r) => ({ sku: r.no_parte, cantidad: r.cantidad }));
  }
  if (clienteKey === 'pcel') {
    const { data } = await supabase.from('sellout_pcel')
      .select('sku,anio,semana,vta_mes_1,vta_mes_2,vta_mes_3')
      .gte('anio', anioMax - 1).limit(50000);
    const byKey = new Map();
    for (const r of data || []) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = byKey.get(r.sku);
      if (!prev || prev.key < key) byKey.set(r.sku, { key, r });
    }
    const out = [];
    for (const { r } of byKey.values()) {
      const total = (Number(r.vta_mes_1) || 0) + (Number(r.vta_mes_2) || 0) + (Number(r.vta_mes_3) || 0);
      if (total > 0) out.push({ sku: r.sku, cantidad: total });
    }
    return out;
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('sku,cantidad,anio,mes')
      .eq('mayorista', 'DICOTECH')
      .gte('anio', anioMin).limit(200000);
    return (data || [])
      .filter((r) => meses.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.cantidad }));
  }
  return [];
}
