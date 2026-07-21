// SellInCliente · dispatcher entre 3 layouts según theme.key.
// Manual §9.4 · Cuota anual + progress + KPI mensual + tabla top SKUs.
// El legacy (con filtros multi-select, tabla SKU × mes expandible, drill-down
// por SKU) sigue en SellInClienteLegacy.jsx para migración v2.
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { useSellInData } from './sellin/shared';
import LayoutClaro from './sellin/LayoutClaro';
import LayoutMidnight from './sellin/LayoutMidnight';
import LayoutMarfil from './sellin/LayoutMarfil';
import { TYPO } from '../../lib/themeTokens';

export default function SellInCliente({ clienteKey }) {
  const { theme } = useTheme();
  const data = useSellInData(clienteKey);

  if (data.loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: 80, color: theme.textMuted,
        fontFamily: TYPO.fontText, fontSize: 15,
      }}>Cargando Sell In…</div>
    );
  }

  const layoutProps = { theme, clienteKey, ...data };

  const Layout =
    theme.key === 'midnight' ? LayoutMidnight :
    theme.key === 'marfil'   ? LayoutMarfil   :
                               LayoutClaro;

  return <Layout {...layoutProps} />;
}
