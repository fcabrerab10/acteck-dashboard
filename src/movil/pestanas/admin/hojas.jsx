// Hojas inferiores de la ficha de usuario (celular):
//   · HojaCopiarDe: lista de usuarios de quien copiar TODOS los permisos (un toque = copiar, con Deshacer).
//   · HojaVerComo: el árbol del menú que vería ese usuario — construirArbol(perfil, { movil: true }),
//     con el nivel de cada pestaña y un aviso cuando la pantalla todavía no existe en el celular.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { AvatarImg } from '../../../lib/avatar';
import { CLIENTES, PAGINA_A_PERMISO_GLOBAL, nivelPestanaGlobal, nivelPestanaCliente, puedeVerInicio } from '../../../lib/permisos';
import { construirArbol } from '../../../components/nav/arbol';
import { NIVEL_LABEL, NIVEL_TONE, TIPO_LABEL, tipoDe, normalizarPermisos, contarNiveles, clientesConAcceso, plural } from '../../../modules/configuracion/comun';
import { HojaM, ListaAgrupada, Fila, Pill, Vacio } from '../../piezas';
import { tieneVersionMovil } from '../../rutas';

export function HojaCopiarDe({ abierto, onClose, u, usuarios, onElegir }) {
  const { theme } = useTheme();
  const candidatos = (usuarios || []).filter((x) => x.id !== u.id && !x.es_super_admin);
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Copiar permisos de…" alto="72vh"
      sub={`Sustituye TODOS los permisos de ${u.nombre || u.email}. El tipo no cambia.`}>
      {candidatos.length === 0
        ? <Vacio icon={null} titulo="No hay de quién copiar" sub="Todos los demás perfiles son super admin." />
        : (
          <ListaAgrupada>
            {candidatos.map((x) => {
              const p = normalizarPermisos(x.permisos); const c = contarNiveles(p); const cl = clientesConAcceso(p);
              return (
                <Fila key={x.id} avatar={<AvatarImg perfil={x} size={34} />} titulo={x.nombre || x.email}
                  sub={`${TIPO_LABEL[tipoDe(x)]} · ${c.edit} con edición · ${c.ver} sólo lectura · ${cl.length ? cl.map((k) => CLIENTES.find((q) => q.id === k)?.label).join(', ') : 'sin clientes'}`}
                  onClick={() => onElegir(x)} />
              );
            })}
          </ListaAgrupada>
        )}
      <div style={{ padding: '10px 28px 0', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, fontFamily: TYPO.fontText, lineHeight: 1.4 }}>
        Se guarda al instante; el toast trae "Deshacer".
      </div>
    </HojaM>
  );
}

export function HojaVerComo({ abierto, onClose, u }) {
  const { theme } = useTheme();
  const arbol = useMemo(() => (abierto ? construirArbol(u, { movil: true }) : []), [abierto, u]);
  const total = arbol.reduce((s, g) => s + g.nodos.length + (g.clientes || []).reduce((t, c) => t + c.nodos.length, 0), 0);

  const nivelGlobal = (n) => {
    if (n.pagina === 'inicio') return puedeVerInicio(u) ? 'ver' : 'oculto';
    const id = PAGINA_A_PERMISO_GLOBAL[n.pagina];
    return id === '__super_admin_only__' ? (u.es_super_admin ? 'edit' : 'oculto') : nivelPestanaGlobal(u, id);
  };

  const fila = (n, nivel) => {
    const enMovil = tieneVersionMovil({ pagina: n.pagina, clienteKey: n.clienteKey || null });
    return (
      <Fila key={n.id} chevron={false} alto={46} icon={n.icon} color={n.color || theme.textMuted}
        titulo={n.label} sub={enMovil ? undefined : 'sólo en la computadora'}
        pill={{ tone: NIVEL_TONE[nivel], label: NIVEL_LABEL[nivel] }} />
    );
  };

  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={`Ver como ${(u.nombre || u.email || '').split(' ')[0]}`} alto="78vh"
      sub={`Menú que vería en el celular · ${plural(total, 'pantalla')}. Tu sesión no cambia.`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
        {arbol.length === 0 && <Vacio icon={null} titulo="Sin acceso a ninguna pantalla" sub='Al entrar sólo vería el aviso "Sin acceso".' />}
        {arbol.map((g) => (
          <ListaAgrupada key={g.id} titulo={g.label} meta={String(g.nodos.length + (g.clientes || []).reduce((t, c) => t + c.nodos.length, 0))}>
            {g.nodos.map((n) => fila(n, nivelGlobal(n)))}
            {(g.clientes || []).flatMap((c) => c.nodos.map((n) => fila({ ...n, label: `${c.label} · ${n.label}`, color: c.color }, nivelPestanaCliente(u, c.key, n.pagina))))}
          </ListaAgrupada>
        ))}
      </div>
    </HojaM>
  );
}
