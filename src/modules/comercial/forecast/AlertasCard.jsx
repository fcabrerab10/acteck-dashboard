// AlertasCard — puntos importantes detectados automáticamente.
//
// Tipos de alerta:
//   1. Stockout en riesgo (cobertura < 30 días)
//   2. Sobreinventario (cobertura > 180 días)
//   3. Brecha sin tránsito (alta brecha y nada en camino)
//   4. Canibalización (PCEL + Digi compiten por el mismo SKU con stock corto)
//   5. SKU en roadmap próximamente sin compra colocada
//   6. Lead time desconocido en SKU con brecha (riesgo de cálculo)

import React, { useMemo } from 'react';
import { AlertTriangle, ShoppingCart, Package, Users, Sparkles, Clock } from 'lucide-react';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');

export default function AlertasCard({ rows, roadmap, embarques }) {
  const alertas = useMemo(() => {
    const out = [];
    const skusEnEmbarques = new Set((embarques || []).map((e) => (e.codigo || '').trim()));

    (rows || []).forEach((r) => {
      // 1) Stockout: cobertura < 30d
      if (r.coberturaDias != null && r.coberturaDias < 30 && r.demandaMesTotal > 0) {
        out.push({
          tipo: 'stockout',
          severidad: 'alta',
          sku: r.sku,
          mensaje: `Cobertura ${r.coberturaDias}d — sugerido ${FMT_N(r.sugerido)} pzs`,
          icono: 'package',
        });
      }
      // 2) Sobreinventario: cobertura > 180d
      else if (r.coberturaDias != null && r.coberturaDias > 180) {
        out.push({
          tipo: 'sobreinventario',
          severidad: 'media',
          sku: r.sku,
          mensaje: `Cobertura ${r.coberturaDias}d (sobreinv) · ${FMT_N(r.inv)} pzs en stock`,
          icono: 'package',
        });
      }
      // 3) Brecha sin tránsito
      if (r.brecha > 0 && r.traCant === 0 && r.demandaMesTotal > 0) {
        out.push({
          tipo: 'brecha_sin_transito',
          severidad: 'alta',
          sku: r.sku,
          mensaje: `Brecha ${FMT_N(r.brecha)} pzs y nada en tránsito`,
          icono: 'cart',
        });
      }
      // 4) Canibalización con stock corto
      if (r.canibalizacion && r.coberturaDias != null && r.coberturaDias < 60) {
        out.push({
          tipo: 'canibalizacion',
          severidad: 'media',
          sku: r.sku,
          mensaje: `Digi y PCEL compiten · cobertura ${r.coberturaDias}d`,
          icono: 'users',
        });
      }
      // 6) Lead time desconocido con brecha
      if (r.brecha > 0 && !r.ltDias) {
        out.push({
          tipo: 'lt_desconocido',
          severidad: 'baja',
          sku: r.sku,
          mensaje: `Lead time desconocido · sugerido ${FMT_N(r.sugerido)} pzs`,
          icono: 'clock',
        });
      }
    });

    // 5) Roadmap próximamente sin compra
    (roadmap || []).forEach((rm) => {
      const estado = String(rm.estado || rm.estatus || '').toLowerCase();
      if (!estado.includes('proxim') && !estado.includes('camino')) return;
      if (!skusEnEmbarques.has((rm.sku || '').trim())) {
        out.push({
          tipo: 'lanzamiento_sin_compra',
          severidad: 'media',
          sku: rm.sku,
          mensaje: `En roadmap pero sin compra colocada`,
          icono: 'sparkles',
        });
      }
    });

    // Ordenar: alta > media > baja
    const sevOrden = { alta: 0, media: 1, baja: 2 };
    out.sort((a, b) => (sevOrden[a.severidad] ?? 9) - (sevOrden[b.severidad] ?? 9));
    return out;
  }, [rows, roadmap, embarques]);

  if (alertas.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-emerald-500" />
          Puntos importantes
        </h3>
        <p className="text-xs text-emerald-700 mt-2 italic">
          ✓ Sin alertas — todo el portafolio está en buena salud
        </p>
      </div>
    );
  }

  // Agrupar por severidad para conteo
  const contadores = alertas.reduce((acc, a) => {
    acc[a.severidad] = (acc[a.severidad] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-gray-800 text-sm">Puntos importantes</h3>
        <span className="ml-auto text-xs text-gray-500">
          {contadores.alta > 0 && <span className="text-red-600 font-semibold mr-2">{contadores.alta} altas</span>}
          {contadores.media > 0 && <span className="text-amber-600 mr-2">{contadores.media} medias</span>}
          {contadores.baja > 0 && <span className="text-gray-500">{contadores.baja} info</span>}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {alertas.slice(0, 30).map((a, i) => (
          <AlertaRow key={i} alerta={a} />
        ))}
        {alertas.length > 30 && (
          <div className="px-4 py-2 text-[10px] text-gray-400 italic text-center">
            +{alertas.length - 30} alertas adicionales (filtra la tabla para verlas en contexto)
          </div>
        )}
      </div>
    </div>
  );
}

function AlertaRow({ alerta }) {
  const COLORS = {
    alta:  { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: 'text-red-500' },
    media: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: 'text-amber-500' },
    baja:  { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   icon: 'text-gray-400' },
  };
  const c = COLORS[alerta.severidad] || COLORS.media;
  const Icon = {
    package: Package,
    cart: ShoppingCart,
    users: Users,
    sparkles: Sparkles,
    clock: Clock,
    alert: AlertTriangle,
  }[alerta.icono] || AlertTriangle;

  return (
    <div className="px-4 py-2 flex items-start gap-2 text-xs">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${c.icon}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-gray-800">{alerta.sku}</span>
          <span className={`text-[9px] px-1 rounded ${c.bg} ${c.text}`}>
            {alerta.severidad}
          </span>
        </div>
        <div className="text-gray-600 truncate">{alerta.mensaje}</div>
      </div>
    </div>
  );
}
