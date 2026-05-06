// EnviosEditor — modal para dividir una línea en N envíos parciales.
//
// Cada envío tiene cantidad y fecha estimada. El usuario define el
// intervalo (en semanas) entre envíos para autocalcular fechas, pero
// puede ajustar individualmente cualquier fecha.
//
// Total de envíos no puede exceder la cantidad original de la línea.

import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Calendar } from 'lucide-react';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');

function addWeeks(dateStr, weeks) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function EnviosEditor({ linea, onClose, onGuardar }) {
  // Si la línea ya tiene envíos, los cargamos. Si no, partimos de un solo envío
  // con la cantidad y fecha originales.
  const [envios, setEnvios] = useState(() => {
    if (Array.isArray(linea.envios) && linea.envios.length > 0) {
      return linea.envios.map((e) => ({
        cantidad: Number(e.cantidad) || 0,
        fecha_estimada: e.fecha_estimada || '',
      }));
    }
    return [{
      cantidad: Number(linea.cantidad) || 0,
      fecha_estimada: linea.fecha_estimada || '',
    }];
  });
  const [semanasEntre, setSemanasEntre] = useState(2);
  const [enviando, setEnviando] = useState(false);

  const totalCantidad = useMemo(
    () => envios.reduce((a, e) => a + (Number(e.cantidad) || 0), 0),
    [envios]
  );
  const cantidadOriginal = Number(linea.cantidad) || 0;
  const diff = totalCantidad - cantidadOriginal;

  const agregarEnvio = () => {
    const ultimo = envios[envios.length - 1];
    const nuevaFecha = addWeeks(ultimo?.fecha_estimada, semanasEntre);
    setEnvios([...envios, { cantidad: 0, fecha_estimada: nuevaFecha || '' }]);
  };

  const quitarEnvio = (idx) => {
    if (envios.length === 1) return;
    setEnvios(envios.filter((_, i) => i !== idx));
  };

  const editarEnvio = (idx, campo, valor) => {
    const next = [...envios];
    next[idx] = { ...next[idx], [campo]: valor };
    setEnvios(next);
  };

  const dividirEquitativo = () => {
    if (envios.length === 0) return;
    const partes = envios.length;
    const base = Math.floor(cantidadOriginal / partes);
    const sobrante = cantidadOriginal - base * partes;
    setEnvios(envios.map((e, i) => ({
      ...e,
      cantidad: base + (i === 0 ? sobrante : 0), // sobrante al primero
    })));
  };

  // Auto-calcular fechas a partir del primer envío + semanasEntre
  const recalcularFechas = () => {
    if (envios.length <= 1 || !envios[0]?.fecha_estimada) return;
    const next = [...envios];
    for (let i = 1; i < next.length; i++) {
      next[i] = {
        ...next[i],
        fecha_estimada: addWeeks(next[i - 1].fecha_estimada, semanasEntre) || next[i].fecha_estimada,
      };
    }
    setEnvios(next);
  };

  const handleGuardar = async () => {
    if (totalCantidad !== cantidadOriginal) {
      // eslint-disable-next-line no-alert
      if (!confirm(`El total (${FMT_N(totalCantidad)}) no coincide con la cantidad original (${FMT_N(cantidadOriginal)}). ¿Actualizar la cantidad de la línea a ${FMT_N(totalCantidad)} y guardar los envíos?`)) {
        return;
      }
    }
    setEnviando(true);
    try {
      // Si solo es 1 envío, guardar como envíos = null (no dividida)
      const enviosFinal = envios.length > 1
        ? envios.map((e) => ({
            cantidad: Number(e.cantidad) || 0,
            fecha_estimada: e.fecha_estimada || null,
          }))
        : null;
      await onGuardar({
        cantidad: totalCantidad,
        envios: enviosFinal,
        // La fecha_estimada de la línea = fecha del primer envío (referencia)
        fecha_estimada: envios[0]?.fecha_estimada || null,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-gray-800">Dividir en envíos</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100" disabled={enviando}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Header SKU */}
        <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-gray-800">{linea.sku}</span>
            <span className="text-gray-500 truncate flex-1" title={linea.descripcion}>
              {linea.descripcion || ''}
            </span>
          </div>
          <div className="text-gray-500 mt-1">
            Cantidad original: <span className="font-bold tabular-nums text-gray-800">{FMT_N(cantidadOriginal)} pzs</span>
          </div>
        </div>

        {/* Controles globales */}
        <div className="p-4 space-y-3">
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                Semanas entre envíos
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={semanasEntre}
                onChange={(e) => setSemanasEntre(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded tabular-nums"
              />
            </div>
            <button
              type="button"
              onClick={recalcularFechas}
              className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
              title="Auto-calcular las fechas siguientes desde la primera"
            >
              ↻ Recalcular fechas
            </button>
            <button
              type="button"
              onClick={dividirEquitativo}
              className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
              title={`Dividir ${FMT_N(cantidadOriginal)} pzs en partes iguales`}
            >
              ÷ Partes iguales
            </button>
          </div>

          {/* Lista de envíos */}
          <div className="space-y-1.5">
            {envios.map((e, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <span className="text-[10px] text-gray-500 w-12 shrink-0 font-semibold">
                  Envío {idx + 1}/{envios.length}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={e.cantidad}
                  onChange={(ev) => editarEnvio(idx, 'cantidad', Number(ev.target.value) || 0)}
                  placeholder="Piezas"
                  className="w-24 px-2 py-1 text-sm border border-gray-200 rounded tabular-nums bg-white"
                />
                <span className="text-[10px] text-gray-400">pzs</span>
                <input
                  type="date"
                  value={e.fecha_estimada || ''}
                  onChange={(ev) => editarEnvio(idx, 'fecha_estimada', ev.target.value)}
                  className="px-2 py-1 text-sm border border-gray-200 rounded bg-white flex-1"
                />
                {envios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarEnvio(idx)}
                    className="p-1 rounded text-red-500 hover:bg-red-50"
                    title="Quitar envío"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={agregarEnvio}
            className="w-full py-1.5 rounded border border-dashed border-gray-300 text-blue-600 hover:bg-blue-50 text-xs font-medium flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar envío
          </button>

          {/* Total / verificación */}
          <div className={[
            'rounded p-2 text-xs',
            diff === 0
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700',
          ].join(' ')}>
            <div className="flex items-center justify-between">
              <span>Total envíos:</span>
              <span className="font-bold tabular-nums">{FMT_N(totalCantidad)} pzs</span>
            </div>
            {diff !== 0 && (
              <div className="text-[10px] mt-1">
                {diff > 0
                  ? `Excede en ${FMT_N(diff)} pzs vs cantidad original`
                  : `Faltan ${FMT_N(-diff)} pzs para igualar la original`}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="flex-1 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={enviando || envios.length === 0 || totalCantidad <= 0}
              className="flex-1 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : 'Guardar envíos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
