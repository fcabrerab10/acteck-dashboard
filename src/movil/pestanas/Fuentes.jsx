// Importador (push, sólo lectura) · frescura por fuente de datos (v_fuentes_frescura). Página 'actualizacion'.
import React from 'react';
import { Upload } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { useFrescura, formatFrescura } from '../../lib/frescura';
import { useNav } from '../nav';
import { TituloGrande, ListaAgrupada, Fila, Cabecera, Skeleton, Vacio } from '../piezas';
import { int } from '../util';

const TONE = { ok: 'green', atrasada: 'orange', sin_datos: 'gray' };

export default function Fuentes() {
  const { theme } = useTheme();
  const nav = useNav();
  const { filas, cargando } = useFrescura(true);
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Importador" sub="Sólo lectura · las cargas se hacen desde la computadora" />
      {cargando && <div style={{ padding: '0 16px' }}><Skeleton h={300} r={12} /></div>}
      {!cargando && !filas.length && <Vacio icon={Upload} color={theme.textMuted} titulo="Sin fuentes visibles" sub="Tu perfil no puede ver el estado de las cargas." />}
      {!!filas.length && (
        <ListaAgrupada titulo="Fuentes" meta={filas.length} pie="Estado según el umbral de días de cada fuente (v_fuentes_frescura).">
          {[...filas].sort((a, b) => (b.estado === 'atrasada') - (a.estado === 'atrasada')).map((f) => (
            <Fila key={f.fuente} chevron={false} titulo={f.etiqueta || f.fuente} sub={`${f.ultima_carga ? formatFrescura(f.ultima_carga) : 'sin carga'}${f.periodo_max ? ` · hasta ${f.periodo_max}` : ''}${f.filas != null ? ` · ${int(f.filas)} filas` : ''}`}
              pill={{ tone: TONE[f.estado] || 'gray', label: f.estado === 'atrasada' ? `${f.dias} d` : f.estado === 'ok' ? 'al día' : 'sin datos' }} />
          ))}
        </ListaAgrupada>
      )}
      <div style={{ padding: '12px 28px 0', fontSize: 12, color: theme.textSubtle || theme.textMuted }}>
        {nav.perfil?.es_super_admin ? <a href="/uploads.html" target="_blank" rel="noopener" style={{ color: theme.accent, textDecoration: 'none' }}>Abrir el importador completo (uploads.html) ›</a> : 'Sólo el super admin carga datos.'}
      </div>
    </>
  );
}
