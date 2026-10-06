// Botón «Sep 2026 ▾» + hoja con los meses (y «Año completo») del año en curso y los dos anteriores.
// Extraído de Inicio.jsx el 2026-10-05; lo usan Inicio y Análisis por cliente. `mes` = 1..12 | 'anio'.
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill } from '../../components/kit';
import HojaM from './HojaM';
import ListaAgrupada, { Fila } from './ListaAgrupada';
import { MESES } from '../util';

export default function SelectorPeriodoM({ anio, mes, anioHoy, mesHoy, onChange, conAnio = true, etiquetaAnio = 'Año' }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const anios = [anioHoy, anioHoy - 1, anioHoy - 2];
  const label = mes === 'anio' ? `${etiquetaAnio} ${anio}` : `${MESES[mes - 1]} ${anio}`;
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px 0 12px', borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>
        {label}<ChevronDown size={14} style={{ color: theme.textMuted }} />
      </button>
      <HojaM abierto={abierto} onClose={() => setAbierto(false)} titulo="Período" sub={conAnio ? 'Mes o año completo · se compara con el año anterior' : 'Mes · se compara con el mismo mes del año anterior'} alto="75vh">
        {anios.map((a) => (
          <ListaAgrupada key={a} titulo={String(a)} style={{ marginBottom: 14 }}>
            {conAnio && <Fila titulo={`${etiquetaAnio} ${a}`} sub={a === anioHoy ? 'Acumulado a hoy' : 'Año completo'} chevron={false} alto={44}
              trailing={anio === a && mes === 'anio' ? <Pill tone="blue">Elegido</Pill> : undefined} onClick={() => { onChange(a, 'anio'); setAbierto(false); }} />}
            {MESES.map((lbl, i) => {
              const m = i + 1;
              if (a === anioHoy && m > mesHoy) return null;
              const on = anio === a && mes === m;
              return <Fila key={m} titulo={`${lbl} ${a}`} sub={a === anioHoy && m === mesHoy ? 'Mes en curso' : undefined} chevron={false} alto={44}
                trailing={on ? <Pill tone="blue">Elegido</Pill> : undefined} onClick={() => { onChange(a, m); setAbierto(false); }} />;
            })}
          </ListaAgrupada>
        ))}
      </HojaM>
    </>
  );
}
