// Propuestas móvil (push · nodo propuestas) · lista de propuestas_borradores por mes (cliente, estado
// Borrador/Exportada/Enviada y total), buscador, filtro por cliente y "+ Nueva". Misma tabla y mismo esquema
// que el armador de escritorio (PropuestasTab.jsx): lo que se guarda aquí aparece allá y viceversa.
// propuestas_borradores la escribe la app → se lee con supabase directo bajo useQuery (sin cachedQuery).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ClipboardList, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { supabase } from '../../lib/supabase';
import { puedeVerPestanaGlobal } from '../../lib/permisos';
import { CLIENTES, MES_FULL } from '../../modules/comercial/propuestas/constantes';
import { useNav } from '../nav';
import { TituloGrande, Cabecera, ListaAgrupada, Fila, CampoBusqueda, Segmented, Vacio, Skeleton, BotonGrande } from '../piezas';
import { colorCliente } from '../datos';
import { money, int, N } from '../util';
import PropuestaEditor, { QK_PROPUESTAS, TONO_ESTADO } from './PropuestaEditor';

export function usePropuestas(enabled = true) {
  return useQuery({
    queryKey: QK_PROPUESTAS, staleTime: 60 * 1000, enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('propuestas_borradores')
        .select('id,cliente_key,cliente_label,nombre,estado,tstamp,resumen,exported_filename,origen,updated_at')
        .order('tstamp', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Propuestas() {
  const { theme } = useTheme();
  const nav = useNav();
  const puedeVer = puedeVerPestanaGlobal(nav.perfil, 'propuestas');
  const { data, isLoading, error } = usePropuestas(puedeVer);
  const [q, setQ] = useState('');
  const [cliente, setCliente] = useState('todos');

  const grupos = useMemo(() => {
    const nq = norm(q.trim());
    const terms = nq.split(/\s+/).filter(Boolean);
    const filas = (data || []).filter((r) => {
      if (cliente !== 'todos' && r.cliente_key !== cliente) return false;
      if (!terms.length) return true;
      const t = norm(`${r.nombre} ${r.cliente_label} ${r.cliente_key} ${r.estado}`);
      return terms.every((w) => t.includes(w));
    });
    const m = new Map();
    filas.forEach((r) => {
      const d = new Date(N(r.tstamp) || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!m.has(key)) m.set(key, { key, label: `${MES_FULL[d.getMonth()]} ${d.getFullYear()}`, items: [] });
      m.get(key).items.push(r);
    });
    return [...m.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [data, q, cliente]);

  const abrir = (r) => nav.push(<PropuestaEditor id={r.id} />, `propuesta-${r.id}`);
  const nueva = () => nav.push(<PropuestaEditor />, 'propuesta-nueva');
  const botonNueva = (
    <button type="button" onClick={nueva} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 44, padding: '0 10px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 15, cursor: 'pointer' }}>
      <Plus size={18} strokeWidth={2.4} />Nueva
    </button>
  );

  if (!puedeVer) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Propuestas" /><Vacio icon={ClipboardList} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña Propuestas." /></>);
  }
  const total = data?.length || 0;
  const enviadas = (data || []).filter((r) => r.estado === 'Enviada').length;
  return (
    <>
      <Cabecera onVolver={nav.pop} derecha={botonNueva} />
      <TituloGrande titulo="Propuestas" sub={isLoading ? 'Cargando…' : `${total} propuesta${total === 1 ? '' : 's'}${enviadas ? ` · ${enviadas} enviada${enviadas === 1 ? '' : 's'}` : ''}`} />
      <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CampoBusqueda value={q} onChange={setQ} placeholder="Nombre, cliente o estado" />
        <Segmented value={cliente} onChange={setCliente} style={{ alignSelf: 'flex-start' }}
          options={[{ id: 'todos', label: 'Todos' }, ...CLIENTES.map((c) => ({ id: c.key, label: c.label }))]} />
      </div>

      {error && <Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar las propuestas" sub={error.message} />}
      {isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={260} r={12} /></div>}
      {!isLoading && !error && grupos.length === 0 && (
        <Vacio icon={ClipboardList} color={theme.textMuted} titulo={q || cliente !== 'todos' ? 'Nada coincide' : 'Sin propuestas'} sub={q || cliente !== 'todos' ? 'Prueba con otro nombre o cliente.' : 'Arma la primera con “+ Nueva”: eliges cliente, lista de precios y SKUs, y la exportas a Excel para mandarla.'}
          accion={!q && cliente === 'todos' && <BotonGrande primario icon={Plus} onClick={nueva} style={{ width: 'auto', padding: '0 22px' }}>Nueva propuesta</BotonGrande>} />
      )}
      {grupos.map((g) => (
        <ListaAgrupada key={g.key} titulo={g.label} meta={g.items.length} style={{ marginBottom: 16 }}>
          {g.items.map((r) => {
            const res = r.resumen || {};
            const cli = CLIENTES.find((c) => c.key === r.cliente_key);
            return <Fila key={r.id} tono={colorCliente(r.cliente_key, theme)} titulo={r.nombre || 'Cierre'}
              sub={[cli?.label || r.cliente_label || r.cliente_key, res.skus != null ? `${int(res.skus)} SKUs` : null, res.piezas != null ? `${int(res.piezas)} pz` : null, r.origen].filter(Boolean).join(' · ')}
              valor={res.total != null ? money(res.total) : '—'} pill={{ tone: TONO_ESTADO[r.estado] || 'gray', label: r.estado || 'Borrador' }} onClick={() => abrir(r)} />;
          })}
        </ListaAgrupada>
      ))}
    </>
  );
}
