import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';

const MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmtCompact = (n) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};

const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};

// Subcuenta: inicia con asterisco (limpio "*Costo Ecommerce" o "*Arrendamiento")
const esSubcuenta = (cuenta) => /^\s*\*/.test(cuenta || '');

export default function EstadoResultados() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowsPrev, setRowsPrev] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carga lista de años disponibles
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('estados_resultados')
        .select('anio')
        .order('anio', { ascending: false });
      if (error) { console.error(error); return; }
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
      if (unique.length > 0 && !unique.includes(anio)) setAnio(unique[0]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carga datos del año seleccionado + año anterior
  useEffect(() => {
    setLoading(true);
    (async () => {
      const [{ data: act }, { data: prev }] = await Promise.all([
        supabase.from('estados_resultados').select('*').eq('anio', anio).order('orden'),
        supabase.from('estados_resultados').select('cuenta_norm,mes,valor').eq('anio', anio - 1),
      ]);
      setRows(act || []);
      setRowsPrev(prev || []);
      setLoading(false);
    })();
  }, [anio]);

  // Pivote: cuenta_norm → { cuenta, orden, es_subtotal, valores: {1..12}, total }
  const filas = useMemo(() => {
    const byCuenta = new Map();
    rows.forEach((r) => {
      const key = r.cuenta_norm;
      if (!byCuenta.has(key)) {
        byCuenta.set(key, {
          cuenta_norm: key,
          cuenta: r.cuenta,
          orden: r.orden ?? 999,
          es_subtotal: !!r.es_subtotal,
          valores: {},
        });
      }
      byCuenta.get(key).valores[Number(r.mes)] = Number(r.valor);
    });
    return Array.from(byCuenta.values())
      .map((f) => ({
        ...f,
        total: Object.values(f.valores).reduce((a, b) => a + (Number(b) || 0), 0),
      }))
      .sort((a, b) => a.orden - b.orden);
  }, [rows]);

  // Mes máximo con datos
  const mesMax = useMemo(() => {
    let m = 0;
    rows.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [rows]);

  // KPIs YTD
  const kpis = useMemo(() => {
    const sumYTD = (slug) => {
      let s = 0;
      rows.forEach((r) => {
        if (r.cuenta_norm === slug && Number(r.mes) <= mesMax) s += Number(r.valor) || 0;
      });
      return s;
    };
    const sumYTDPrev = (slug) => {
      let s = 0;
      rowsPrev.forEach((r) => {
        if (r.cuenta_norm === slug && Number(r.mes) <= mesMax) s += Number(r.valor) || 0;
      });
      return s;
    };
    const ventaNeta   = sumYTD('venta_neta');
    const utilBruta   = sumYTD('utilidad_bruta');
    const uafir       = sumYTD('uafir_sin_proyectos');
    const ventaPrev   = sumYTDPrev('venta_neta');
    const utilPrev    = sumYTDPrev('utilidad_bruta');
    const uafirPrev   = sumYTDPrev('uafir_sin_proyectos');
    return {
      ventaNeta, utilBruta, uafir,
      pctBruta: ventaNeta > 0 ? (utilBruta / ventaNeta) * 100 : null,
      pctUafir: ventaNeta > 0 ? (uafir / ventaNeta) * 100 : null,
      deltaVenta: ventaPrev > 0 ? ((ventaNeta - ventaPrev) / ventaPrev) * 100 : null,
      deltaUtil:  utilPrev  > 0 ? ((utilBruta - utilPrev) / utilPrev) * 100 : null,
      deltaUafir: uafirPrev > 0 ? ((uafir - uafirPrev) / uafirPrev) * 100 : null,
      ventaPrev, utilPrev, uafirPrev,
    };
  }, [rows, rowsPrev, mesMax]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Calculator className="w-10 h-10 mx-auto mb-3" />
        Cargando estado de resultados…
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Estado de Resultados</h2>
        <p>No hay datos para {anio}. Sube los cierres mensuales en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Estado de Resultados</h2>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">
          REVKO TECHNOLOGY SA DE CV · YTD ene–{MESES_LBL[mesMax - 1]} {anio}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          icon="💰" titulo="Venta Neta YTD" color="#3B82F6"
          valor={fmtCompact(kpis.ventaNeta)}
          delta={kpis.deltaVenta}
          prevLabel={`${anio - 1}: ${fmtCompact(kpis.ventaPrev)}`}
        />
        <KpiCard
          icon="📊" titulo="Utilidad Bruta YTD" color="#10B981"
          valor={fmtCompact(kpis.utilBruta)}
          delta={kpis.deltaUtil}
          prevLabel={kpis.pctBruta != null ? `Margen ${kpis.pctBruta.toFixed(1)}%` : ''}
        />
        <KpiCard
          icon="🏁" titulo="UAFIR sin Proyectos YTD" color="#8B5CF6"
          valor={fmtCompact(kpis.uafir)}
          delta={kpis.deltaUafir}
          prevLabel={kpis.pctUafir != null ? `% Venta ${kpis.pctUafir.toFixed(1)}%` : ''}
        />
        <KpiCard
          icon="🔄" titulo={`Δ Venta vs ${anio - 1}`}
          color={kpis.deltaVenta == null ? '#94A3B8' : kpis.deltaVenta >= 0 ? '#10B981' : '#EF4444'}
          valor={kpis.deltaVenta == null ? '—' : (kpis.deltaVenta >= 0 ? '+' : '') + kpis.deltaVenta.toFixed(1) + '%'}
          prevLabel={kpis.ventaPrev > 0 ? `Δ ${fmtCompact(kpis.ventaNeta - kpis.ventaPrev)}` : 'Sin comparativo'}
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', position: 'sticky', left: 0, background: '#F8FAFC', minWidth: 260 }}>
                  Cuenta
                </th>
                {MESES_LBL.map((m, i) => (
                  <th
                    key={m}
                    style={{
                      padding: '10px 8px', textAlign: 'right', fontWeight: 600,
                      color: i + 1 === mesMax ? '#1D4ED8' : '#475569', whiteSpace: 'nowrap',
                    }}
                  >
                    {m}
                  </th>
                ))}
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#065F46', background: '#ECFDF5', borderLeft: '2px solid #A7F3D0' }}>
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const isSub = f.es_subtotal;
                const isSubcuenta = esSubcuenta(f.cuenta);
                return (
                  <tr
                    key={f.cuenta_norm}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: isSub ? '#F1F5F9' : 'transparent',
                      fontWeight: isSub ? 700 : 400,
                    }}
                  >
                    <td
                      style={{
                        padding: isSub ? '8px 12px' : '6px 12px',
                        color: isSub ? '#0F172A' : isSubcuenta ? '#94A3B8' : '#334155',
                        paddingLeft: isSubcuenta ? 28 : 12,
                        fontStyle: isSubcuenta ? 'italic' : 'normal',
                        position: 'sticky', left: 0, background: isSub ? '#F1F5F9' : '#FFFFFF',
                        whiteSpace: 'nowrap', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                      title={f.cuenta}
                    >
                      {f.cuenta}
                    </td>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => {
                      const v = f.valores[m];
                      return (
                        <td
                          key={m}
                          style={{
                            padding: '6px 8px', textAlign: 'right',
                            color: v == null ? '#CBD5E1' : v < 0 ? '#B91C1C' : '#1E293B',
                            background: m === mesMax && !isSub ? '#EFF6FF' : undefined,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {v == null ? '—' : fmtMoney(v)}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '6px 12px', textAlign: 'right',
                        background: isSub ? '#D1FAE5' : '#ECFDF5',
                        color: f.total < 0 ? '#B91C1C' : '#065F46',
                        fontWeight: 700, borderLeft: '2px solid #A7F3D0', whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtMoney(f.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 px-2">
        Fuente: tabla <code>estados_resultados</code> · alimentada desde /uploads.html
      </p>
    </div>
  );
}

function KpiCard({ icon, titulo, color, valor, delta, prevLabel }) {
  return (
    <div
      style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
        borderLeft: '4px solid ' + color, padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <p style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, margin: 0 }}>
        {icon} {titulo}
      </p>
      <p style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', lineHeight: 1.1, margin: '6px 0 0 0' }}>{valor}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {delta != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: delta >= 0 ? '#10B981' : '#EF4444' }}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {(delta >= 0 ? '+' : '') + delta.toFixed(1) + '%'}
          </span>
        )}
        {prevLabel && (
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{prevLabel}</span>
        )}
      </div>
    </div>
  );
}
