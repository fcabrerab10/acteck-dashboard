// AgregarLineaModal — al hacer "+" en un SKU de la tabla, abre un modal
// que pregunta cuánto agregar al borrador.
//
// Opciones:
//   · Por contenedores (1, 2, 3, ...) — multiplica piezas_por_contenedor
//   · Cantidad personalizada (input directo)
//
// Si el SKU NO tiene piezas_por_contenedor (no se ha comprado antes),
// solo permite cantidad personalizada con un mensaje de aviso.

import React, { useState, useMemo, useEffect } from 'react';
import { X, Package } from 'lucide-react';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');
const FMT_USD = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

export default function AgregarLineaModal({ row, onConfirm, onClose }) {
  const piezasPorCnt = Number(row?.piezasPorContenedor || 0);
  const sugeridoCnt  = Number(row?.contenedoresSugeridos || 0);
  const sugeridoPzs  = Number(row?.sugerido || 0);
  const tieneCnt = piezasPorCnt > 0;

  // Modo: 'contenedor' = N contenedores · 'custom' = cantidad libre
  const [modo, setModo] = useState(tieneCnt ? 'contenedor' : 'custom');
  const [contenedores, setContenedores] = useState(Math.max(1, sugeridoCnt));
  const [piezasCustom, setPiezasCustom] = useState(sugeridoPzs > 0 ? sugeridoPzs : '');
  const [enviando, setEnviando] = useState(false);

  // Reset cuando cambia el SKU
  useEffect(() => {
    setModo(tieneCnt ? 'contenedor' : 'custom');
    setContenedores(Math.max(1, sugeridoCnt));
    setPiezasCustom(sugeridoPzs > 0 ? sugeridoPzs : '');
  }, [row?.sku, tieneCnt, sugeridoCnt, sugeridoPzs]);

  // Cantidad final a agregar
  const cantidadFinal = useMemo(() => {
    if (modo === 'contenedor' && tieneCnt) {
      return Math.max(0, Math.round(contenedores)) * piezasPorCnt;
    }
    return Math.max(0, Math.round(Number(piezasCustom) || 0));
  }, [modo, contenedores, piezasCustom, piezasPorCnt, tieneCnt]);

  const valorEstUsd = cantidadFinal * Number(row?.ultimoCostoUsd || row?.costoUnitUsd || 0);

  if (!row) return null;

  const handleConfirm = async () => {
    if (cantidadFinal <= 0) return;
    setEnviando(true);
    try {
      await onConfirm(cantidadFinal);
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
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600" />
          <h2 className="font-semibold text-gray-800">Agregar a solicitud</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100" disabled={enviando}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* SKU info */}
        <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-gray-800 text-sm">{row.sku}</span>
            <span className="text-xs text-gray-500 truncate" title={row.descripcion}>
              {row.descripcion || ''}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
            <div>
              <div className="text-gray-500">Pzs/contenedor</div>
              <div className="font-semibold tabular-nums">
                {tieneCnt ? FMT_N(piezasPorCnt) : <span className="text-amber-600 italic">no se ha comprado</span>}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Sugerido</div>
              <div className="font-semibold tabular-nums">
                {sugeridoPzs > 0 ? `${FMT_N(sugeridoPzs)} pzs` : '—'}
                {sugeridoCnt > 0 && (
                  <span className="text-[10px] text-gray-500 ml-1">({sugeridoCnt} cnt)</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Último costo USD</div>
              <div className="font-semibold tabular-nums">
                {row.ultimoCostoUsd > 0 ? `$${Number(row.ultimoCostoUsd).toFixed(2)}` : '—'}
              </div>
            </div>
          </div>
          {row.esConsolidado && (
            <div className="mt-1.5 text-[10px] text-amber-700 italic">
              ⓘ Este SKU es consolidado (comparte contenedor con otros SKUs)
            </div>
          )}
        </div>

        {/* Selector de modo */}
        <div className="p-5 space-y-4">
          {tieneCnt && (
            <div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setModo('contenedor')}
                  className={[
                    'px-3 py-2 rounded-md text-sm font-medium border transition',
                    modo === 'contenedor'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  Por contenedor
                </button>
                <button
                  type="button"
                  onClick={() => setModo('custom')}
                  className={[
                    'px-3 py-2 rounded-md text-sm font-medium border transition',
                    modo === 'custom'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  Piezas personalizadas
                </button>
              </div>
            </div>
          )}

          {modo === 'contenedor' && tieneCnt ? (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                ¿Cuántos contenedores quieres pedir?
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setContenedores(Math.max(1, contenedores - 1))}
                  className="w-9 h-9 rounded border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold"
                >−</button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={contenedores}
                  onChange={(e) => setContenedores(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 text-center text-lg font-bold tabular-nums border border-gray-200 rounded py-1.5"
                />
                <button
                  type="button"
                  onClick={() => setContenedores(contenedores + 1)}
                  className="w-9 h-9 rounded border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold"
                >+</button>
                <span className="text-sm text-gray-500 ml-2">
                  contenedor{contenedores !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 mt-2">
                {contenedores} × {FMT_N(piezasPorCnt)} pzs = <span className="font-bold text-gray-800">{FMT_N(cantidadFinal)} piezas</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Cantidad personalizada (piezas)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={piezasCustom}
                onChange={(e) => setPiezasCustom(e.target.value)}
                placeholder="Escribe la cantidad en piezas"
                className="w-full px-3 py-2 border border-gray-200 rounded text-lg font-bold tabular-nums"
                autoFocus
              />
              {tieneCnt && cantidadFinal > 0 && (
                <div className="text-[10px] text-gray-500 mt-1">
                  ≈ {(cantidadFinal / piezasPorCnt).toFixed(2)} contenedor{cantidadFinal / piezasPorCnt !== 1 ? 'es' : ''}
                  {cantidadFinal % piezasPorCnt !== 0 && (
                    <span className="text-amber-600 ml-1">
                      (no completa contenedor exacto)
                    </span>
                  )}
                </div>
              )}
              {!tieneCnt && (
                <div className="text-[10px] text-amber-700 italic mt-1">
                  Este SKU no tiene historial de compra — no podemos calcular el contenedor automáticamente.
                </div>
              )}
            </div>
          )}

          {/* Resumen final */}
          <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-emerald-700">Total a agregar</span>
              <span className="text-xl font-bold text-emerald-800 tabular-nums">
                {FMT_N(cantidadFinal)} <span className="text-xs font-normal">pzs</span>
              </span>
            </div>
            {valorEstUsd > 0 && (
              <div className="flex items-baseline justify-between mt-1 text-[11px] text-emerald-700">
                <span>Costo estimado</span>
                <span className="font-semibold tabular-nums">{FMT_USD(valorEstUsd)} USD</span>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-2">
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
              onClick={handleConfirm}
              disabled={enviando || cantidadFinal <= 0}
              className="flex-1 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {enviando ? 'Agregando…' : 'Agregar a borrador'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
