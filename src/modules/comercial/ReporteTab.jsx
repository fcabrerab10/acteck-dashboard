// Página dedicada "Reporte" — reutiliza ReporteSection (única fuente de
// verdad para la tabla maestra de SKUs).
//
// Antes este archivo tenía su propio cálculo, con varios bugs vs el reporte
// que Fernando llevaba en Excel:
//   · usaba `disponible` en lugar de `inventario` (números no cuadraban)
//   · DECME incluía alm 19 (no debería)
//   · Total INCLUÍA Empaque Dañado (debería excluirlo)
//   · No tenía EAN13, Código SAT, roadmap colors, ni filtros
// Solución: que esta pestaña sea un wrapper de ReporteSection.

import React from 'react';
import ReporteSection from './ReporteSection';

export default function ReporteTab() {
  return (
    <div className="p-4">
      <ReporteSection standalone />
    </div>
  );
}
