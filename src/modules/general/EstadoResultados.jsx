// Estado de Resultados · dispatcher entre 3 layouts según theme.key.
// Los datos se computan aquí una sola vez; cada layout renderiza a su manera.
// Ver docs/DESIGN_SYSTEM.md §8 para la spec por tema.
import React, { useState } from 'react';
import AppleLoader from '../../components/apple/AppleLoader';
import { useTheme } from '../../lib/themeContext';
import { Calculator } from 'lucide-react';
import {
  useEdRData, computeAlertas, computeFichaMes, FichaMesModal, typo,
} from './edr/shared';
import { TYPO } from '../../lib/themeTokens';
import LayoutClaro from './edr/LayoutClaro';
import LayoutMidnight from './edr/LayoutMidnight';
import LayoutMarfil from './edr/LayoutMarfil';

export default function EstadoResultados() {
  const { theme } = useTheme();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mesDrillDown, setMesDrillDown] = useState(null);
  const [alertasDescartadas, setAlertasDescartadas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('edr_alertas_descartadas') || '[]')); }
    catch { return new Set(); }
  });
  const persistirDescartadas = (next) => {
    setAlertasDescartadas(next);
    try { localStorage.setItem('edr_alertas_descartadas', JSON.stringify(Array.from(next))); } catch {}
  };
  const onDismissAlerta = (id) => persistirDescartadas(new Set([...alertasDescartadas, id]));

  const {
    rows, loading, aniosDisponibles,
    byCuenta, byCuentaPrev, mesMax,
    kpis, trendData,
  } = useEdRData(anio);

  // Ajustar anio si no está en los disponibles (post-load)
  React.useEffect(() => {
    if (aniosDisponibles.length > 0 && !aniosDisponibles.includes(anio)) {
      setAnio(aniosDisponibles[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aniosDisponibles]);

  if (loading) return <AppleLoader label="Cargando estado de resultados…" />;

  if (rows.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: theme.textMuted }}>
        <Calculator style={{ width: 48, height: 48, margin: '0 auto 16px', color: theme.textSubtle, strokeWidth: 1.2 }} />
        <div style={{ ...typo(TYPO.h2), color: theme.text, marginBottom: 8 }}>Estado de resultados</div>
        <div style={{ ...typo(TYPO.body), color: theme.textMuted }}>
          No hay datos para {anio}. Sube los cierres en <code>/uploads.html</code>.
        </div>
      </div>
    );
  }

  const alertas = computeAlertas(byCuenta, byCuentaPrev, mesMax, anio);
  const alertasActivas = alertas.filter((a) => !alertasDescartadas.has(a.id));
  const fichaMes = computeFichaMes(byCuenta, byCuentaPrev, mesDrillDown);

  // Props compartidos entre los 3 layouts
  const layoutProps = {
    theme, anio, setAnio, aniosDisponibles, mesMax,
    byCuenta, byCuentaPrev, kpis, trendData,
    alertasActivas, onDismissAlerta, setMesDrillDown,
  };

  // Dispatcher por tema
  const Layout =
    theme.key === 'midnight' ? LayoutMidnight :
    theme.key === 'marfil'   ? LayoutMarfil   :
                               LayoutClaro;   // default = claro

  return (
    <>
      <Layout {...layoutProps} />
      {fichaMes && (
        <FichaMesModal theme={theme} ficha={fichaMes} anio={anio} anioPrev={anio - 1}
          onClose={() => setMesDrillDown(null)} />
      )}
      <style>{`
        @media print {
          .edr-no-print { display: none !important; }
          @page { size: A3 landscape; margin: 12mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </>
  );
}
