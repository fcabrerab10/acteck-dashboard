// Sección plegada del celular (2026-11-18): una fila tocable (52 px) que despliega su contenido debajo. Los hijos SÓLO
// se montan al abrir, así lo que lleve dentro (consultas, cálculo, un lazy()) no cuesta nada mientras está plegado.
//   <PlegadoM icon={ArrowLeftRight} titulo="Comparador de periodos" sub="…">{contenido}</PlegadoM>
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import ListaAgrupada, { Fila } from './ListaAgrupada';

export default function PlegadoM({ icon, color, titulo, sub, abiertoInicial = false, children, style }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <section data-plegado={abierto ? 'abierto' : 'cerrado'} style={{ marginTop: 18, ...style }}>
      <ListaAgrupada>
        <Fila icon={icon} color={color || theme.accent} titulo={titulo} sub={abierto ? 'Toca para plegar' : sub} chevron={false} onClick={() => setAbierto((v) => !v)}
          trailing={<ChevronDown size={18} style={{ color: theme.textMuted, flexShrink: 0, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />} />
      </ListaAgrupada>
      {abierto && <div style={{ marginTop: 12 }}>{children}</div>}
    </section>
  );
}
