// Administración → Datos. Reutiliza PestanaDatos (tiles Puente SQL · Al día X/Y · barra · atrasadas/por vencer
// · botón al importador) y añade el contexto de cómo se cargan las fuentes. No repite la página del importador.
import React from 'react';
import { ArrowRight, Clock, Upload, Cpu } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Boton } from '../../components/kit';
import PestanaDatos from '../../components/perfil/PestanaDatos';
import { irAPagina } from './useAdminData';

const FILAS = [
  { icon: Cpu, t: 'Automáticas · puente SQL (Mac mini)', d: 'Ventas, inventario y precios cada hora 8–19 L–S y a las 06:30; cuotas y sell out a las 06:30; Master Embarques a las 07:00. Escriben sync_status/sync_events como "Puente SQL (Mac mini)".' },
  { icon: Upload, t: 'Manuales · importador central', d: 'Sell out por cliente, inventario del cliente, estados de cuenta, roadmap, precios y estados de resultados. Cada fuente tiene su cadencia (fuentes_config) y su anillo de frescura.' },
  { icon: Clock, t: 'Frescura por pantalla', d: 'La vista v_fuentes_frescura resume cada fuente (última carga, umbral en días, estado) y alimenta el pill de frescura del Hero de cada pantalla y las alertas "datos sin actualizar".' },
];

export default function SeccionDatos() {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, alignItems: 'start' }}>
      <Panel titulo="Estado de las fuentes" meta="puente + manuales" padding="4px 12px 10px">
        <PestanaDatos activo onNavegar={(_c, pagina) => irAPagina(pagina)} />
      </Panel>
      <Panel titulo="Cómo se cargan los datos" padding="6px 12px 12px"
        acciones={<Boton primario icon={ArrowRight} onClick={() => irAPagina('actualizacion')}>Abrir importador</Boton>}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FILAS.map((f, i) => (
            <div key={f.t} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: i ? `1px solid ${theme.border}` : 0 }}>
              <f.icon size={15} strokeWidth={1.8} style={{ color: theme.textMuted, flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{f.t}</div>
                <div style={{ fontSize: 11.5, color: theme.textMuted, lineHeight: 1.45, marginTop: 2 }}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 6 }}>
          Las cargas, el log del puente y "Pedir corrida" viven en el importador; aquí sólo se resume el estado.
        </div>
      </Panel>
    </div>
  );
}
