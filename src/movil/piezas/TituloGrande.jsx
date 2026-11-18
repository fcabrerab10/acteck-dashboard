// Título grande estilo iOS (28/600) + subtítulo opcional (texto o nodo, p. ej. FrescuraPill).
// Encima del título va el nombre de la sección en su color (10.5 px, mayúsculas con tracking, 13 px de alto), como
// CabeceraPantalla de la web: lo pone <Pantalla seccion> (MovilApp) según la página actual. `seccion={false}` lo apaga.
import React from 'react';
import { useSeccion } from '../nav';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export default function TituloGrande({ titulo, sub, derecha, style, seccion }) {
  const { theme } = useTheme();
  const deContexto = useSeccion();
  const sec = seccion === false ? null : (seccion || deContexto);
  // Si la sección se llama igual que el título (Inicio › Inicio) no se repite.
  const verSeccion = sec?.grupo && String(sec.grupo).trim().toLowerCase() !== String(typeof titulo === 'string' ? titulo : '').trim().toLowerCase();
  return (
    <div style={{ padding: '6px 20px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, ...style }}>
      <div style={{ minWidth: 0 }}>
        {verSeccion && <div data-seccion style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: '13px', height: 13, color: sec.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sec.grupo}</div>}
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: theme.text }}>{titulo}</h1>
        {sub != null && (
          <div style={{ marginTop: 5, fontFamily: TYPO.fontText, fontSize: 13, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{sub}</div>
        )}
      </div>
      {derecha}
    </div>
  );
}
