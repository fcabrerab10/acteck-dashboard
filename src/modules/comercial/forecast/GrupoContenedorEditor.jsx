// GrupoContenedorEditor — modal para asociar varias líneas (SKUs distintos)
// que comparten un contenedor.
//
// Caso típico: medio contenedor color A + medio contenedor color B = 1
// contenedor consolidado entre 2 SKUs hermanos. Sirve para que el equipo
// de compras sepa que ese contenedor lleva múltiples SKUs.
//
// Detección automática de "SKUs hermanos": misma palabra base de la
// descripción (sin la última palabra que típicamente es el color).

import React, { useState, useMemo } from 'react';
import { X, Combine, Check } from 'lucide-react';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');

// Devuelve la "raíz" de la descripción quitando el final (ej. último 1-2 tokens
// que suelen ser color/variante: "Negro", "Blanco", "Rojo", etc.).
function descripcionBase(desc) {
  if (!desc) return '';
  const norm = String(desc).trim().toUpperCase().replace(/\s+/g, ' ');
  // Quitamos puntuación y dejamos los primeros 6 tokens significativos
  const tokens = norm.split(/[\s/,.\-]+/).filter(Boolean);
  return tokens.slice(0, Math.max(3, tokens.length - 2)).join(' ');
}

// Sugiere "SKUs hermanos" entre las líneas del borrador: comparten descripción
// base con el SKU dado.
function sugerirHermanos(linea, todasLineas) {
  if (!linea?.descripcion) return [];
  const base = descripcionBase(linea.descripcion);
  if (!base) return [];
  return todasLineas.filter((l) => {
    if (l.id === linea.id) return false;
    return descripcionBase(l.descripcion) === base;
  });
}

export default function GrupoContenedorEditor({ linea, lineasDelBorrador, onClose, onGuardar }) {
  // SKUs ya en el grupo actual (incluyendo la línea base)
  const grupoActual = linea?.grupo_contenedor || null;
  const [seleccionadas, setSeleccionadas] = useState(() => {
    if (!grupoActual) return new Set([linea.id]);
    return new Set(
      lineasDelBorrador
        .filter((l) => l.grupo_contenedor === grupoActual)
        .map((l) => l.id)
    );
  });
  const [enviando, setEnviando] = useState(false);

  const sugerencias = useMemo(
    () => sugerirHermanos(linea, lineasDelBorrador),
    [linea, lineasDelBorrador]
  );
  const otras = useMemo(
    () => lineasDelBorrador.filter((l) => l.id !== linea.id && !sugerencias.find((s) => s.id === l.id)),
    [linea, lineasDelBorrador, sugerencias]
  );

  const toggle = (id) => {
    const next = new Set(seleccionadas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSeleccionadas(next);
  };

  const totalPiezas = useMemo(() =>
    lineasDelBorrador
      .filter((l) => seleccionadas.has(l.id))
      .reduce((a, l) => a + (Number(l.cantidad) || 0), 0)
  , [lineasDelBorrador, seleccionadas]);

  const handleGuardar = async () => {
    setEnviando(true);
    try {
      // Si quedan ≥ 2 líneas seleccionadas, generamos un grupo nuevo (o
      // mantenemos el actual). Si solo queda 1, eliminamos el grupo.
      let nuevoGrupo = null;
      if (seleccionadas.size >= 2) {
        nuevoGrupo = grupoActual || `G${Date.now().toString(36).slice(-6).toUpperCase()}`;
      }
      // Construir cambios: cada línea afectada
      const idsViejoGrupo = grupoActual
        ? lineasDelBorrador.filter((l) => l.grupo_contenedor === grupoActual).map((l) => l.id)
        : [];
      const cambios = [];
      // Líneas que ahora están seleccionadas → asignar al nuevo grupo
      seleccionadas.forEach((id) => {
        cambios.push({ id, grupo_contenedor: nuevoGrupo });
      });
      // Líneas que estaban en el viejo grupo y ya no → quitar grupo
      idsViejoGrupo.forEach((id) => {
        if (!seleccionadas.has(id)) {
          cambios.push({ id, grupo_contenedor: null });
        }
      });
      await onGuardar(cambios);
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
          <Combine className="w-4 h-4 text-purple-600" />
          <h2 className="font-semibold text-gray-800">Agrupar contenedor</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100" disabled={enviando}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 text-xs">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Línea base</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-gray-800">{linea.sku}</span>
            <span className="text-gray-600 truncate flex-1" title={linea.descripcion}>
              {linea.descripcion || ''}
            </span>
            <span className="font-semibold tabular-nums">{FMT_N(linea.cantidad)} pzs</span>
          </div>
          <div className="mt-1 text-[10px] text-gray-500 italic">
            Selecciona los SKUs que compartirán contenedor con esta línea.
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* SKUs hermanos sugeridos */}
          {sugerencias.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-purple-700 font-semibold mb-1.5">
                ⓘ Hermanos sugeridos (descripción similar)
              </div>
              <div className="space-y-1">
                {sugerencias.map((s) => (
                  <SkuRow
                    key={s.id}
                    sku={s}
                    selected={seleccionadas.has(s.id)}
                    onToggle={() => toggle(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Otros SKUs del borrador */}
          {otras.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                Otros SKUs del borrador
              </div>
              <div className="space-y-1">
                {otras.map((s) => (
                  <SkuRow
                    key={s.id}
                    sku={s}
                    selected={seleccionadas.has(s.id)}
                    onToggle={() => toggle(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {sugerencias.length === 0 && otras.length === 0 && (
            <div className="text-xs text-gray-400 italic text-center py-4">
              No hay otros SKUs en este borrador para agrupar
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/40">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-600">
              {seleccionadas.size} SKU{seleccionadas.size !== 1 ? 's' : ''} en grupo
            </span>
            <span className="font-bold tabular-nums">
              Total: {FMT_N(totalPiezas)} pzs
            </span>
          </div>
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
              onClick={handleGuardar}
              disabled={enviando}
              className="flex-1 px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : (seleccionadas.size <= 1 ? 'Quitar agrupación' : 'Agrupar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkuRow({ sku, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition border',
        selected
          ? 'bg-purple-50 border-purple-300'
          : 'bg-white border-gray-200 hover:bg-gray-50',
      ].join(' ')}
    >
      <span className={[
        'w-4 h-4 rounded border flex items-center justify-center shrink-0',
        selected ? 'bg-purple-600 border-purple-600' : 'border-gray-300',
      ].join(' ')}>
        {selected && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="font-mono font-semibold text-gray-800">{sku.sku}</span>
      <span className="text-gray-500 truncate flex-1 text-left" title={sku.descripcion}>
        {sku.descripcion || ''}
      </span>
      <span className="text-gray-500 tabular-nums shrink-0">{FMT_N(sku.cantidad)} pzs</span>
      {sku.grupo_contenedor && (
        <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 shrink-0">
          {sku.grupo_contenedor}
        </span>
      )}
    </button>
  );
}
