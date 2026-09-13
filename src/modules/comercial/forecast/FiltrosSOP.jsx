// Filtros del S&OP · adaptador sobre el componente del kit (un botón por grupo):
// Estado · Proveedor · Familia · Marca · Cliente (cientos: el popover trae buscador) · Roadmap,
// más la bandera "Sólo con sugerido". Los conteos (n) los calcula motorFiltros con los DEMÁS
// filtros aplicados: "si además marco esto, quedan N SKUs".
import React from 'react';
import { Filtros } from '../../../components/kit';
import { roadmapTone } from '../sellin/textos';
import { ESTADOS_SOP } from './motorFiltros';

export default function FiltrosSOP({ f, facetas, onToggle, onSoloSugerido, nActivos, onLimpiar, resumen, acciones, buscador, style }) {
  const grupos = [
    { id: 'estado', label: 'Estado', seleccion: f.estado, opciones: ESTADOS_SOP.map((e) => ({ id: e.id, label: e.label, tone: e.tone, title: e.title, n: facetas.estado.get(e.id) || 0 })) },
    { id: 'proveedor', label: 'Proveedor', seleccion: f.proveedor, opciones: facetas.proveedor },
    { id: 'familia', label: 'Familia', seleccion: f.familia, opciones: facetas.familia },
    { id: 'marca', label: 'Marca', seleccion: f.marca, opciones: facetas.marca },
    { id: 'cliente', label: 'Cliente', seleccion: f.cliente, opciones: facetas.cliente.map((o) => ({ ...o, title: 'Clientes ERP con consumo del SKU en los últimos 6 meses' })) },
    { id: 'roadmap', label: 'Roadmap', seleccion: f.roadmap, opciones: facetas.roadmap.map((o) => ({ ...o, tone: roadmapTone(o.id) })) },
  ];
  const toggles = [{ id: 'soloSugerido', label: 'Sólo con sugerido', on: f.soloSugerido, n: facetas.sugerido, title: 'Mostrar sólo SKUs con sugerido de compra > 0' }];
  return (
    <Filtros grupos={grupos} toggles={toggles} onToggle={onToggle} onToggleFlag={() => onSoloSugerido(!f.soloSugerido)}
      onLimpiar={onLimpiar} activos={nActivos} resumen={resumen} acciones={acciones} buscador={buscador} style={style} />
  );
}
