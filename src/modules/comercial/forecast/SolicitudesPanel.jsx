// SolicitudesPanel — panel lateral fijo a la derecha con borradores activos.
//
// Muestra los borradores abiertos en pestañas. Click en un borrador →
// expande sus líneas, editables in-line. Botón "Cerrar solicitud" para
// pasar a estado 'pendiente'.

import React, { useState } from 'react';
import { Plus, X, FileCheck, Trash2, Edit3 } from 'lucide-react';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');

export default function SolicitudesPanel({
  borradores,
  lineasDe,
  activoId,
  setActivoId,
  onCrearNuevo,
  onEditarLinea,
  onEliminarLinea,
  onCerrar,
  onEliminarSolicitud,
}) {
  if (!borradores || borradores.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p className="text-xs text-gray-500 mb-2">Sin borradores abiertos</p>
        <button
          onClick={onCrearNuevo}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo borrador
        </button>
      </div>
    );
  }

  const activo = borradores.find((b) => b.id === activoId) || borradores[0];
  const lineas = activo ? lineasDe(activo.id) : [];
  const totalPiezas = lineas.reduce((a, l) => a + Number(l.cantidad || 0), 0);
  const totalUsd = lineas.reduce((a, l) =>
    a + Number(l.cantidad || 0) * Number(l.ultimo_costo_usd || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tabs de borradores */}
      <div className="border-b border-gray-100 bg-gray-50/50 flex items-center overflow-x-auto">
        {borradores.map((b) => {
          const ls = lineasDe(b.id);
          const esActivo = b.id === activo.id;
          return (
            <button
              key={b.id}
              onClick={() => setActivoId(b.id)}
              className={[
                'px-3 py-2 text-xs whitespace-nowrap border-r border-gray-100 transition',
                esActivo
                  ? 'bg-white text-blue-700 font-semibold border-b-2 border-b-blue-500'
                  : 'text-gray-600 hover:bg-white',
              ].join(' ')}
            >
              Borrador #{b.id} <span className="text-gray-400">· {ls.length} SKU{ls.length !== 1 ? 's' : ''}</span>
            </button>
          );
        })}
        <button
          onClick={onCrearNuevo}
          className="px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 ml-auto whitespace-nowrap"
          title="Nuevo borrador"
        >
          <Plus className="w-3.5 h-3.5 inline" /> Nuevo
        </button>
      </div>

      {/* Detalle del borrador activo */}
      <div className="p-3">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-semibold text-gray-800 text-sm">
            Borrador activo · #{activo.id}
          </h3>
          <span className="text-[10px] text-gray-400">
            creado {new Date(activo.fecha_creacion).toLocaleDateString('es-MX')}
          </span>
        </div>

        {lineas.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded">
            Agrega SKUs con el botón "+" de la tabla principal
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {lineas.map((l) => (
              <LineaRow
                key={l.id}
                linea={l}
                onEditar={onEditarLinea}
                onEliminar={onEliminarLinea}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {lineas.length > 0 && (
          <div className="border-t border-gray-100 mt-3 pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Total piezas:</span>
              <span className="font-bold tabular-nums">{FMT_N(totalPiezas)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Total USD (estimado):</span>
              <span className="font-bold tabular-nums text-emerald-700">${FMT_N(totalUsd)}</span>
            </div>
            <div className="flex gap-2 pt-1.5">
              <button
                onClick={() => {
                  if (confirm('¿Cerrar este borrador como solicitud pendiente?')) {
                    onCerrar(activo.id);
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                <FileCheck className="w-3.5 h-3.5" /> Cerrar como solicitud
              </button>
              <button
                onClick={() => {
                  if (confirm('¿Eliminar este borrador completo?')) {
                    onEliminarSolicitud(activo.id);
                  }
                }}
                className="px-2 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700"
                title="Eliminar borrador"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LineaRow({ linea, onEditar, onEliminar }) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState({
    cantidad: linea.cantidad || 0,
    proveedor: linea.proveedor || '',
    fecha_estimada: linea.fecha_estimada || '',
    ultimo_costo_usd: linea.ultimo_costo_usd || 0,
  });

  const guardar = async () => {
    await onEditar(linea.id, {
      cantidad: Number(draft.cantidad) || 0,
      proveedor: draft.proveedor || null,
      fecha_estimada: draft.fecha_estimada || null,
      ultimo_costo_usd: draft.ultimo_costo_usd ? Number(draft.ultimo_costo_usd) : null,
    });
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="border border-blue-200 bg-blue-50/30 rounded p-2 space-y-1.5 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="font-mono font-semibold">{linea.sku}</span>
          <span className="text-gray-500 truncate ml-2 max-w-[200px]" title={linea.descripcion}>
            {linea.descripcion}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <span className="text-[10px] text-gray-500">Cantidad</span>
            <input type="number" value={draft.cantidad}
              onChange={(e) => setDraft({ ...draft, cantidad: e.target.value })}
              className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs tabular-nums" />
          </label>
          <label className="block">
            <span className="text-[10px] text-gray-500">Costo USD</span>
            <input type="number" step="0.01" value={draft.ultimo_costo_usd}
              onChange={(e) => setDraft({ ...draft, ultimo_costo_usd: e.target.value })}
              className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs tabular-nums" />
          </label>
          <label className="block col-span-2">
            <span className="text-[10px] text-gray-500">Proveedor</span>
            <input type="text" value={draft.proveedor}
              onChange={(e) => setDraft({ ...draft, proveedor: e.target.value })}
              className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs" />
          </label>
          <label className="block col-span-2">
            <span className="text-[10px] text-gray-500">Fecha estimada de arribo</span>
            <input type="date" value={draft.fecha_estimada}
              onChange={(e) => setDraft({ ...draft, fecha_estimada: e.target.value })}
              className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-xs" />
          </label>
        </div>
        <div className="flex gap-1.5">
          <button onClick={guardar}
            className="flex-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium">
            Guardar
          </button>
          <button onClick={() => setEditando(false)}
            className="flex-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px]">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-100 bg-gray-50/30 rounded px-2 py-1.5 text-xs hover:border-gray-300 transition">
      <div className="flex items-baseline gap-2">
        <span className="font-mono font-semibold text-gray-800 shrink-0">{linea.sku}</span>
        <span className="font-bold tabular-nums text-emerald-700 shrink-0">
          {FMT_N(linea.cantidad)}
        </span>
        {linea.contenedores > 0 && (
          <span className="text-[9px] text-gray-400 shrink-0">{linea.contenedores} cnt</span>
        )}
        <span className="text-gray-500 truncate flex-1" title={linea.descripcion}>
          {linea.descripcion || ''}
        </span>
        <button
          onClick={() => setEditando(true)}
          className="text-blue-600 hover:bg-blue-50 rounded p-0.5"
          title="Editar"
        >
          <Edit3 className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            if (confirm(`¿Eliminar línea de ${linea.sku}?`)) onEliminar(linea.id);
          }}
          className="text-red-500 hover:bg-red-50 rounded p-0.5"
          title="Eliminar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-baseline gap-3 text-[10px] text-gray-500 mt-0.5">
        {linea.proveedor && <span>📦 {linea.proveedor}</span>}
        {linea.fecha_estimada && <span>📅 {linea.fecha_estimada}</span>}
        {linea.ultimo_costo_usd > 0 && (
          <span>${Number(linea.ultimo_costo_usd).toFixed(2)} USD/u</span>
        )}
      </div>
    </div>
  );
}
