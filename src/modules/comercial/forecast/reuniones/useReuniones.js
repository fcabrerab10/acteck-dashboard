// useReuniones — lectura y escritura del repositorio de reuniones S&OP (sop_reuniones + sop_reuniones_lineas).
// Tablas que la app ESCRIBE: sin cachedQuery; invalidateDataCache() tras cada escritura (CLAUDE.md · Rendimiento).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { invalidateDataCache } from '../../../../lib/queries';
import { proponerFolio } from './parserCorreo';

const COLS_LINEA = ['orden', 'marca', 'familia', 'sku', 'descripcion', 'cantidad', 'comentario'];
const limpiarLinea = (l, i) => ({
  orden: i + 1, marca: l.marca || null, familia: l.familia || null, sku: String(l.sku || '').trim().toUpperCase(),
  descripcion: l.descripcion || null, cantidad: Number(l.cantidad) || 0, comentario: l.comentario || null,
});

export function useReuniones() {
  const [reuniones, setReuniones] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, lRes] = await Promise.all([
        supabase.from('sop_reuniones').select('*').order('anio', { ascending: false }).order('mes', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('sop_reuniones_lineas').select(COLS_LINEA.concat(['id', 'reunion_id']).join(', ')).order('reunion_id').order('orden'),
      ]);
      if (rRes.error) throw rRes.error;
      if (lRes.error) throw lRes.error;
      setReuniones(rRes.data || []);
      setLineas(lRes.data || []);
      setError(null);
    } catch (e) {
      console.error('[S&OP reuniones] carga', e);
      setError(e?.message || String(e));
      setReuniones([]); setLineas([]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const lineasDe = useCallback((reunionId) => lineas.filter((l) => l.reunion_id === reunionId), [lineas]);
  const folios = reuniones.map((r) => r.folio);

  /** Crea la reunión con sus líneas. `form` = salida del parser ya editada. Devuelve la fila creada. */
  const guardar = useCallback(async (form) => {
    const lineasOk = (form.lineas || []).filter((l) => l.sku).map(limpiarLinea);
    const folioBase = (form.folio || '').trim().toUpperCase() || proponerFolio(form.anio, form.mes, folios);
    const folio = folios.includes(folioBase) ? proponerFolio(form.anio, form.mes, folios) : folioBase;
    const payload = {
      folio, anio: Number(form.anio), mes: Number(form.mes), fecha_reunion: form.fecha || null,
      titulo: form.titulo || null, solicita: form.solicita || null, nota: form.nota || null, nota_autor: form.nota_autor || null,
      siguientes: (form.siguientes || []).filter((s) => s.rol || s.accion), fuente: form.fuente || 'correo', correo_raw: form.correo_raw || null,
      total_skus: new Set(lineasOk.map((l) => l.sku)).size, total_piezas: lineasOk.reduce((a, l) => a + l.cantidad, 0),
    };
    const { data, error: e1 } = await supabase.from('sop_reuniones').insert(payload).select().single();
    if (e1) throw e1;
    if (lineasOk.length) {
      const { error: e2 } = await supabase.from('sop_reuniones_lineas').insert(lineasOk.map((l) => ({ ...l, reunion_id: data.id })));
      if (e2) throw e2;
    }
    invalidateDataCache();
    await recargar();
    return data;
  }, [folios, recargar]);

  /** Actualiza cabecera y reemplaza las líneas. */
  const actualizar = useCallback(async (id, form) => {
    const lineasOk = (form.lineas || []).filter((l) => l.sku).map(limpiarLinea);
    const payload = {
      folio: (form.folio || '').trim().toUpperCase() || undefined, anio: Number(form.anio), mes: Number(form.mes), fecha_reunion: form.fecha || null,
      titulo: form.titulo || null, solicita: form.solicita || null, nota: form.nota || null, nota_autor: form.nota_autor || null,
      siguientes: (form.siguientes || []).filter((s) => s.rol || s.accion), fuente: form.fuente || 'manual',
      total_skus: new Set(lineasOk.map((l) => l.sku)).size, total_piezas: lineasOk.reduce((a, l) => a + l.cantidad, 0),
    };
    if (form.correo_raw != null) payload.correo_raw = form.correo_raw;
    const { error: e1 } = await supabase.from('sop_reuniones').update(payload).eq('id', id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('sop_reuniones_lineas').delete().eq('reunion_id', id);
    if (e2) throw e2;
    if (lineasOk.length) {
      const { error: e3 } = await supabase.from('sop_reuniones_lineas').insert(lineasOk.map((l) => ({ ...l, reunion_id: id })));
      if (e3) throw e3;
    }
    invalidateDataCache();
    await recargar();
  }, [recargar]);

  const eliminar = useCallback(async (id) => {
    const { error: e } = await supabase.from('sop_reuniones').delete().eq('id', id);
    if (e) throw e;
    invalidateDataCache();
    await recargar();
  }, [recargar]);

  return { reuniones, lineas, lineasDe, folios, loading, error, recargar, guardar, actualizar, eliminar };
}
