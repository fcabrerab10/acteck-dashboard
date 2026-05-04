// useSolicitudes — hook para CRUD de solicitudes_compra y sus líneas.
//
// Estados de una solicitud:
//   - borrador: solo Fernando ve, mientras arma la lista
//   - pendiente: cerrada, exportable a Excel, Karolina la ve
//   - colocada: marcada manualmente cuando se mandó al proveedor
//   - cancelada: descartada
//
// Permite múltiples borradores simultáneos (cada uno un row con estado='borrador').

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

const ANIO_ACTUAL = new Date().getFullYear();

export function useSolicitudes(perfil) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tablaExiste, setTablaExiste] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      const [solRes, linRes] = await Promise.all([
        supabase
          .from('solicitudes_compra')
          .select('*')
          .eq('anio', ANIO_ACTUAL)
          .order('fecha_creacion', { ascending: false }),
        supabase
          .from('solicitudes_compra_lineas')
          .select('*')
          .order('orden', { ascending: true }),
      ]);
      if (solRes.error) {
        // Tabla probablemente no existe aún
        setTablaExiste(false);
        setSolicitudes([]);
        setLineas([]);
      } else {
        setTablaExiste(true);
        setSolicitudes(solRes.data || []);
        setLineas(linRes.data || []);
      }
    } catch {
      setTablaExiste(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  // Crear nuevo borrador
  const crearBorrador = useCallback(async (notas = null) => {
    const { data, error } = await supabase
      .from('solicitudes_compra')
      .insert({
        estado: 'borrador',
        notas,
        creado_por: perfil?.id || null,
      })
      .select()
      .single();
    if (error) throw error;
    await recargar();
    return data;
  }, [perfil, recargar]);

  // Agregar línea a un borrador
  const agregarLinea = useCallback(async (solicitudId, linea) => {
    // Calcular orden — siguiente número en la solicitud
    const lineasExistentes = lineas.filter((l) => l.solicitud_id === solicitudId);
    const orden = (Math.max(0, ...lineasExistentes.map((l) => l.orden || 0))) + 1;

    const payload = {
      solicitud_id: solicitudId,
      sku: linea.sku,
      descripcion: linea.descripcion || null,
      cantidad: Number(linea.cantidad) || 0,
      proveedor: linea.proveedor || null,
      fecha_estimada: linea.fecha_estimada || null,
      ultimo_costo_usd: linea.ultimo_costo_usd != null ? Number(linea.ultimo_costo_usd) : null,
      piezas_por_contenedor: linea.piezas_por_contenedor != null ? Number(linea.piezas_por_contenedor) : null,
      contenedores: linea.contenedores != null ? Number(linea.contenedores) : null,
      es_consolidado: !!linea.es_consolidado,
      orden,
    };

    const { data, error } = await supabase
      .from('solicitudes_compra_lineas')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    await recargar();
    return data;
  }, [lineas, recargar]);

  // Editar línea
  const editarLinea = useCallback(async (lineaId, cambios) => {
    const { error } = await supabase
      .from('solicitudes_compra_lineas')
      .update(cambios)
      .eq('id', lineaId);
    if (error) throw error;
    await recargar();
  }, [recargar]);

  // Eliminar línea
  const eliminarLinea = useCallback(async (lineaId) => {
    const { error } = await supabase
      .from('solicitudes_compra_lineas')
      .delete()
      .eq('id', lineaId);
    if (error) throw error;
    await recargar();
  }, [recargar]);

  // Cerrar borrador → pasa a 'pendiente'
  const cerrarBorrador = useCallback(async (solicitudId) => {
    const { error } = await supabase
      .from('solicitudes_compra')
      .update({
        estado: 'pendiente',
        fecha_cerrada: new Date().toISOString(),
      })
      .eq('id', solicitudId);
    if (error) throw error;
    await recargar();
  }, [recargar]);

  // Cambiar estado (manual: colocada / cancelada)
  const cambiarEstado = useCallback(async (solicitudId, nuevoEstado) => {
    const { error } = await supabase
      .from('solicitudes_compra')
      .update({ estado: nuevoEstado })
      .eq('id', solicitudId);
    if (error) throw error;
    await recargar();
  }, [recargar]);

  // Eliminar solicitud completa (con sus líneas)
  const eliminarSolicitud = useCallback(async (solicitudId) => {
    const { error } = await supabase
      .from('solicitudes_compra')
      .delete()
      .eq('id', solicitudId);
    if (error) throw error;
    await recargar();
  }, [recargar]);

  // Helpers derivados
  const borradores = solicitudes.filter((s) => s.estado === 'borrador');
  const cerradas   = solicitudes.filter((s) => s.estado !== 'borrador');
  const lineasDe = (solicitudId) => lineas.filter((l) => l.solicitud_id === solicitudId);

  return {
    solicitudes, lineas, loading, tablaExiste,
    borradores, cerradas, lineasDe,
    crearBorrador, agregarLinea, editarLinea, eliminarLinea,
    cerrarBorrador, cambiarEstado, eliminarSolicitud,
    recargar,
  };
}
