// HomeCliente · dispatcher entre 3 layouts según theme.key.
// Ver docs/DESIGN_SYSTEM.md §9.1 para spec por tema.
//
// El código legacy (con drill-downs profundos, forms de edición, tarjetas
// TarjetaSellOutMarca/TarjetaTendenciaML para el caso ML) sigue en
// HomeClienteLegacy.jsx — se puede consultar como referencia mientras se
// migran las features avanzadas al nuevo sistema.
import React, { useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { useHomeClienteData } from './home/shared';
import LayoutClaro from './home/LayoutClaro';
import LayoutMidnight from './home/LayoutMidnight';
import LayoutMarfil from './home/LayoutMarfil';
import HomeClienteLegacy from './HomeClienteLegacy';
import { clientes } from '../../lib/constants';
import { TYPO } from '../../lib/themeTokens';

const CLIENTE_META = {
  digitalife: { label: 'Digitalife', color: '#EF4444' },
  pcel:       { label: 'PCEL',       color: '#EF4444' },
  dicotech:   { label: 'Dicotech',   color: '#0EA5E9' },
};

export default function HomeCliente({ cliente, clienteKey, onUploadComplete, isML }) {
  const { theme } = useTheme();
  const [kpiModal, setKpiModal] = useState(null);
  const anio = new Date().getFullYear();

  // Caso ML — sigue usando el layout legacy (data model muy diferente,
  // no encaja en el hook estándar de clientes propios).
  if (isML) {
    return <HomeClienteLegacy cliente={cliente} clienteKey={clienteKey} onUploadComplete={onUploadComplete} isML={true} />;
  }

  const {
    loading, mesActual,
    ventasPorMes, cuotasPorMes, kpis,
    invLatest, selloutSemana, topSkus,
    tareas, minutasList,
  } = useHomeClienteData(clienteKey, anio);

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: 80, color: theme.textMuted,
        fontFamily: TYPO.fontText, fontSize: 15,
      }}>Cargando datos del cliente…</div>
    );
  }

  const clienteInfo = {
    ...CLIENTE_META[clienteKey],
    ...cliente,
    ...(clientes[clienteKey] || {}),
  };

  const layoutProps = {
    theme, cliente: clienteInfo, clienteKey,
    kpis, mesActual, ventasPorMes, cuotasPorMes,
    invLatest, selloutSemana, topSkus,
    tareas, minutasList,
    onKpiClick: setKpiModal,
  };

  const Layout =
    theme.key === 'midnight' ? LayoutMidnight :
    theme.key === 'marfil'   ? LayoutMarfil   :
                               LayoutClaro;

  return <Layout {...layoutProps} />;
}
