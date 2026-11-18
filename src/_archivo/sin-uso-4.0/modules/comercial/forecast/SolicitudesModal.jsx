// SolicitudesModal — modal "Mis solicitudes" con histórico del año actual.
//
// Lista las solicitudes cerradas (no borradores) agrupadas por mes.
// Permite:
//   - Ver el detalle de líneas de cada solicitud
//   - Cambiar estado: pendiente → colocada / cancelada
//   - Editar líneas si está pendiente
//   - Exportar a Excel (S&OP Ferru <Mes> <Año>)

import React, { useMemo, useState } from 'react';
import { X, Download, Edit3, FileCheck, FileX, FileText } from 'lucide-react';
import { exportarSolicitudExcel } from './excelSOP';
import { toast } from '../../../lib/toast';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');

const ESTADOS_INFO = {
  pendiente: { label: 'Pendiente', bg: 'bg-amber-100', text: 'text-amber-700' },
  colocada:  { label: 'Colocada',  bg: 'bg-blue-100',  text: 'text-blue-700' },
  cancelada: { label: 'Cancelada', bg: 'bg-gray-100',  text: 'text-gray-500' },
};

export default function SolicitudesModal({
  abierto, onCerrar,
  cerradas, lineasDe,
  puedeEditar,
  onCambiarEstado,
  onEditarLinea, onEliminarLinea,
  onEliminarSolicitud,
}) {
  const [solExpandida, setSolExpandida] = useState(null);

  const porMes = useMemo(() => {
    const map = new Map(); // key 'YYYY-MM' → array
    (cerradas || []).forEach((s) => {
      const k = `${s.anio}-${String(s.mes).padStart(2, '0')}`;
      if (!map.has(k)) map.set(k, { anio: s.anio, mes: s.mes, items: [] });
      map.get(k).items.push(s);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio;
      return b.mes - a.mes;
    });
  }, [cerradas]);

  if (!abierto) return null;

  const handleExport = async (solicitud) => {
    try {
      const filename = await exportarSolicitudExcel(solicitud, lineasDe(solicitud.id));
      toast.success(`Excel descargado: ${filename}`);
    } catch (err) {
      toast.error(`Error exportando: ${err.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-700" />
          <h2 className="font-semibold text-gray-800">Mis solicitudes — {new Date().getFullYear()}</h2>
          <button onClick={onCerrar} className="ml-auto p-1.5 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {porMes.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm italic">
              Sin solicitudes cerradas este año
            </div>
          ) : (
            porMes.map((mes) => (
              <div key={`${mes.anio}-${mes.mes}`}>
                <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
                  {MESES[mes.mes - 1]} {mes.anio} · {mes.items.length} solicitud{mes.items.length !== 1 ? 'es' : ''}
                </h3>
                <div className="space-y-2">
                  {mes.items.map((s) => {
                    const lineas = lineasDe(s.id);
                    const totalPzs = lineas.reduce((a, l) => a + Number(l.cantidad || 0), 0);
                    const totalUsd = lineas.reduce((a, l) =>
                      a + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0);
                    const expandida = solExpandida === s.id;
                    const info = ESTADOS_INFO[s.estado] || ESTADOS_INFO.pendiente;
                    return (
                      <div key={s.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                          className="px-3 py-2 flex items-center gap-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSolExpandida(expandida ? null : s.id)}
                        >
                          <span className="font-mono text-xs text-gray-600">#{s.id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${info.bg} ${info.text}`}>
                            {info.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {lineas.length} SKU{lineas.length !== 1 ? 's' : ''} · {FMT_N(totalPzs)} pzs · ${FMT_N(totalUsd)} USD
                          </span>
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {s.fecha_cerrada ? new Date(s.fecha_cerrada).toLocaleDateString('es-MX') : ''}
                          </span>
                        </div>

                        {expandida && (
                          <div className="border-t border-gray-100 p-3 bg-gray-50/50 space-y-2">
                            {/* Acciones */}
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => handleExport(s)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                              >
                                <Download className="w-3 h-3" /> Exportar Excel
                              </button>
                              {puedeEditar && s.estado === 'pendiente' && (
                                <>
                                  <button
                                    onClick={() => {
                                      if (confirm('¿Marcar esta solicitud como colocada?')) {
                                        onCambiarEstado(s.id, 'colocada');
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                  >
                                    <FileCheck className="w-3 h-3" /> Marcar colocada
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('¿Cancelar esta solicitud?')) {
                                        onCambiarEstado(s.id, 'cancelada');
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs"
                                  >
                                    <FileX className="w-3 h-3" /> Cancelar
                                  </button>
                                </>
                              )}
                              {puedeEditar && s.estado === 'colocada' && (
                                <button
                                  onClick={() => {
                                    if (confirm('¿Regresar esta solicitud a pendiente?')) {
                                      onCambiarEstado(s.id, 'pendiente');
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs"
                                >
                                  Regresar a pendiente
                                </button>
                              )}
                            </div>

                            {/* Líneas */}
                            <div className="bg-white rounded border border-gray-100">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50/50 text-[10px] text-gray-500">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left">SKU</th>
                                    <th className="px-2 py-1.5 text-left">Descripción</th>
                                    <th className="px-2 py-1.5 text-right">Cantidad</th>
                                    <th className="px-2 py-1.5 text-left">Proveedor</th>
                                    <th className="px-2 py-1.5 text-left">Fecha est.</th>
                                    <th className="px-2 py-1.5 text-right">USD/u</th>
                                    <th className="px-2 py-1.5"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lineas.map((l) => (
                                    <tr key={l.id} className="border-t border-gray-100">
                                      <td className="px-2 py-1 font-mono">{l.sku}</td>
                                      <td className="px-2 py-1 truncate max-w-[180px]" title={l.descripcion}>{l.descripcion}</td>
                                      <td className="px-2 py-1 text-right tabular-nums">{FMT_N(l.cantidad)}</td>
                                      <td className="px-2 py-1 truncate max-w-[120px]" title={l.proveedor}>{l.proveedor || '—'}</td>
                                      <td className="px-2 py-1">{l.fecha_estimada || '—'}</td>
                                      <td className="px-2 py-1 text-right tabular-nums">
                                        {l.ultimo_costo_usd ? `$${Number(l.ultimo_costo_usd).toFixed(2)}` : '—'}
                                      </td>
                                      <td className="px-2 py-1 text-right">
                                        {puedeEditar && s.estado === 'pendiente' && (
                                          <button
                                            onClick={() => {
                                              if (confirm(`¿Eliminar línea ${l.sku}?`)) onEliminarLinea(l.id);
                                            }}
                                            className="text-red-500 hover:bg-red-50 rounded p-0.5"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
