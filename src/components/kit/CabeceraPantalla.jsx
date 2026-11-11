// Cabecera común de pantalla (2026-11-11 · diseño D + color por sección). La pinta PaginaContenido arriba de cada
// pantalla web: sección en su color · título grande · a la derecha lo que la pantalla mande (frescura, exportar,
// botón principal). Una pantalla manda sus controles con <AccionesCabecera>…</AccionesCabecera> (portal al hueco
// de la derecha) y, si quiere una fila de filtros pegada arriba, con <ControlesCabecera>…</ControlesCabecera>.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

const Ctx = createContext(null);

export function ProveedorCabecera({ children }) {
  const [huecos, setHuecos] = useState({ acciones: null, controles: null });
  return <Ctx.Provider value={{ huecos, setHuecos }}>{children}</Ctx.Provider>;
}

function Portal({ donde, children }) {
  const ctx = useContext(Ctx);
  const el = ctx?.huecos?.[donde];
  if (!ctx) return <>{children}</>;          // sin cabecera (panel múltiple, celular): se pinta donde está
  return el ? createPortal(children, el) : null;
}
export const AccionesCabecera = ({ children }) => <Portal donde="acciones">{children}</Portal>;
export const ControlesCabecera = ({ children }) => <Portal donde="controles">{children}</Portal>;

export default function CabeceraPantalla({ seccion }) {
  const { theme } = useTheme();
  const ctx = useContext(Ctx);
  const [acc, setAcc] = useState(null);
  const [con, setCon] = useState(null);
  useEffect(() => { ctx?.setHuecos({ acciones: acc, controles: con }); }, [acc, con]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!seccion) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {seccion.grupo && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: seccion.color }}>{seccion.grupo}</div>}
          <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1, color: theme.text }}>{seccion.titulo}</h1>
        </div>
        <div ref={setAcc} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }} />
      </div>
      <div ref={setCon} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 3 }} />
    </div>
  );
}
