// Axon de México — nueva empresa para gestionar todos los e-commerce
// (Mercado Libre, Amazon, etc.) que antes vivían como "clientes" dentro
// de Acteck. Este módulo arranca como placeholder y se irá llenando con
// pestañas conforme se vayan migrando los flujos.
//
// Ubicación en sidebar: Administración Interna → Axon de México.

import React from 'react';
import { Building2, ShoppingCart, Construction } from 'lucide-react';

export default function AxonMexico() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-indigo-100 rounded-lg">
          <Building2 className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Axon de México</h1>
          <p className="text-sm text-gray-500">Gestión consolidada de e-commerce</p>
        </div>
      </div>

      {/* Banner "en construcción" */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 mb-6">
        <Construction className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900 mb-1">Empresa en constitución</p>
          <p className="text-amber-800">
            Axon de México es la nueva empresa para llevar todos los canales
            de e-commerce desde un solo lugar. Por ahora este módulo está vacío;
            iremos migrando las pestañas (Mercado Libre, Amazon, etc.) conforme
            se vayan habilitando.
          </p>
        </div>
      </div>

      {/* Roadmap de canales */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-800">Canales planeados</h2>
        </div>
        <div className="divide-y divide-gray-100">
          <CanalRow
            nombre="Mercado Libre"
            descripcion="Marketplace principal — antes vivía bajo Acteck."
            estado="Pendiente migración"
          />
          <CanalRow
            nombre="Amazon"
            descripcion="Por habilitar."
            estado="Próximamente"
          />
          <CanalRow
            nombre="Tienda propia"
            descripcion="Shopify / sitio directo a consumidor."
            estado="Por definir"
          />
        </div>
      </div>
    </div>
  );
}

function CanalRow({ nombre, descripcion, estado }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-4 h-4 text-gray-400" />
        <div>
          <div className="font-medium text-gray-800 text-sm">{nombre}</div>
          <div className="text-xs text-gray-500">{descripcion}</div>
        </div>
      </div>
      <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
        {estado}
      </span>
    </div>
  );
}
