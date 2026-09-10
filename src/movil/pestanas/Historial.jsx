// Historial de cambios (push) · últimos 40 registros de auditoria_cambios. Nodo del árbol: interno → historialCambios.
import React from 'react';
import { History } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { useNav } from '../nav';
import { TituloGrande, ListaAgrupada, Fila, Cabecera, Skeleton, Vacio } from '../piezas';
import { useHistorial, nombreCliente } from '../datos';
import { relativo } from '../util';

const OPER = { INSERT: ['green', 'alta'], UPDATE: ['blue', 'cambio'], DELETE: ['red', 'baja'] };

export default function Historial() {
  const { theme } = useTheme();
  const nav = useNav();
  const { data, isLoading } = useHistorial(true);
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Historial" sub="Últimos cambios que la app escribió" />
      {isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={300} r={12} /></div>}
      {!isLoading && !data?.length && <Vacio icon={History} color={theme.textMuted} titulo="Sin cambios registrados" sub="O tu perfil no puede ver la auditoría." />}
      {!!data?.length && (
        <ListaAgrupada>
          {data.map((c) => {
            const [tone, label] = OPER[String(c.operacion).toUpperCase()] || ['gray', c.operacion];
            const campos = c.cambios && typeof c.cambios === 'object' ? Object.keys(c.cambios).slice(0, 4).join(', ') : '';
            return <Fila key={c.id} chevron={false} titulo={`${c.tabla}${c.cliente_key ? ` · ${nombreCliente(c.cliente_key)}` : ''}`} sub={`${c.usuario_email || 'sistema'} · ${relativo(c.creado_at)}${campos ? ` · ${campos}` : ''}`} pill={{ tone, label }} />;
          })}
        </ListaAgrupada>
      )}
    </>
  );
}
