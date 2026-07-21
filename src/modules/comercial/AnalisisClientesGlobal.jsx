// AnalisisClientesGlobal · dispatcher entre 3 layouts según theme.key.
// Manual §9.3 · Comparativo agregado de todos los clientes.
// El legacy (con canonización compleja, filtros por canal, modal de
// drill-down por cliente, búsqueda) sigue en AnalisisClientesGlobalLegacy.jsx.
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { useAnalisisData } from './analisis/shared';
import LayoutClaro from './analisis/LayoutClaro';
import LayoutMidnight from './analisis/LayoutMidnight';
import LayoutMarfil from './analisis/LayoutMarfil';
import { TYPO } from '../../lib/themeTokens';
import { Activity } from 'lucide-react';

export default function AnalisisClientesGlobal() {
  const { theme } = useTheme();
  const data = useAnalisisData();

  if (data.loading) {
    return (
      <div style={{
        padding: 80, textAlign: 'center', color: theme.textMuted,
        fontFamily: TYPO.fontText, fontSize: 15,
      }}>
        <Activity style={{ width: 32, height: 32, margin: '0 auto 16px', strokeWidth: 1.5, opacity: 0.5 }} />
        Cargando análisis por cliente…
      </div>
    );
  }

  if (!data.canales.length) {
    return (
      <div style={{ padding: 80, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        <div style={{ ...({ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em' }), color: theme.text, marginBottom: 8, fontFamily: TYPO.fontDisplay }}>
          Análisis por cliente
        </div>
        <div>No hay datos para {data.anio}. Sube el archivo ERP en /uploads.html.</div>
      </div>
    );
  }

  const layoutProps = { theme, ...data };

  const Layout =
    theme.key === 'midnight' ? LayoutMidnight :
    theme.key === 'marfil'   ? LayoutMarfil   :
                               LayoutClaro;

  return <Layout {...layoutProps} />;
}
