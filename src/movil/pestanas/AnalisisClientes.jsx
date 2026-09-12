// Análisis por cliente (push) · buscador + lista de TODOS los clientes del ERP (propios y no propios) del año en curso,
// ordenada por facturación del mes en curso, con canal, MTD y pill YoY (a mismo día). Tocar → AnalisisFicha.
// Fuentes: facturacion_clientes agregada por cliente_nombre (mes en curso, 2 años) + v_vision_factura_clientes (YTD 2 años).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAll } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { canalLabel } from '../../modules/general/inicio/config';
import { useNav } from '../nav';
import { TituloGrande, ListaAgrupada, Fila, Cabecera, Skeleton, Vacio, CampoBusqueda, Segmented } from '../piezas';
import { PROPIOS, nombreCliente, colorCliente } from '../datos';
import { money, moneyCompact, deltaPct, tonoDelta, MESES, N } from '../util';
import AnalisisFicha, { nombreBonito } from './AnalisisFicha';

const STALE = 5 * 60 * 1000;
const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
/** % de cuota que toca enseñar según el orden elegido (mes o YTD). */
const pctCuotaDe = (o, orden) => (orden === 'mes' ? o.pctCuotaMes : o.pctCuotaYtd);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function useAnalisisClientes(anio, mes) {
  return useQuery({
    queryKey: ['movil', 'analisis-clientes', anio, mes], staleTime: STALE,
    queryFn: async () => {
      const anios = [anio - 1, anio];
      const [mesRows, ytdRows, cuotaRows] = await Promise.all([
        fetchAll('facturacion_clientes', 'cliente_nombre,cliente_key,canal,anio,monto,piezas', (q) => q.in('anio', anios).eq('mes', mes)),
        fetchAll('v_vision_factura_clientes', 'anio,canal,cliente_nombre,venta,piezas,meses_activos', (q) => q.in('anio', anios)),
        // Cuota por cliente del ERP (v_cuota_erp_mes). Esta pantalla agrupa por nombre, así que
        // los dos códigos de Ingram caen en la misma fila y sus cuotas se suman igual que su venta.
        fetchAll('v_cuota_erp_mes', 'cliente_nombre,anio,mes,cuota_venta', (q) => q.eq('anio', anio).lte('mes', mes)),
      ]);
      return { mesRows, ytdRows, cuotaRows };
    },
  });
}

export default function AnalisisClientes() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('mes');
  const [verTodo, setVerTodo] = useState(false);
  const { data, isLoading, error } = useAnalisisClientes(anio, mes);

  const lista = useMemo(() => {
    if (!data) return [];
    const factor = Math.min(1, Math.max(1, hoy.getDate()) / new Date(anio, mes, 0).getDate());
    const by = new Map();
    const get = (n) => by.get(n) || (by.set(n, { nombre: n, canal: null, ck: null, mtd: 0, mtdPrev: 0, piezas: 0, ytd: 0, ytdPrev: 0, meses: 0 }), by.get(n));
    data.mesRows.forEach((r) => { const o = get(r.cliente_nombre || 'SIN NOMBRE'); if (r.canal && !o.canal) o.canal = r.canal; if (r.cliente_key && !o.ck) o.ck = r.cliente_key; if (N(r.anio) === anio) { o.mtd += N(r.monto); o.piezas += N(r.piezas); } else o.mtdPrev += N(r.monto); });
    const cuotaMes = new Map(), cuotaYtd = new Map();
    (data.cuotaRows || []).forEach((r) => {
      const n = r.cliente_nombre || 'SIN NOMBRE';
      cuotaYtd.set(n, N(cuotaYtd.get(n)) + N(r.cuota_venta));
      if (N(r.mes) === mes) cuotaMes.set(n, N(cuotaMes.get(n)) + N(r.cuota_venta));
    });
    data.ytdRows.forEach((r) => { const o = get(r.cliente_nombre || 'SIN NOMBRE'); if (r.canal && !o.canal) o.canal = r.canal; if (N(r.anio) === anio) { o.ytd += N(r.venta); o.meses = N(r.meses_activos); } else o.ytdPrev += N(r.venta); });
    return [...by.values()].filter((o) => o.mtd || o.ytd || o.mtdPrev).map((o) => ({
      ...o, propio: PROPIOS.includes(o.ck), label: PROPIOS.includes(o.ck) ? nombreCliente(o.ck) : nombreBonito(o.nombre),
      yoy: delta(o.mtd, o.mtdPrev * factor),
      // % de alcance de cuota; los % no se suman, se recalculan (src/lib/medidas.js).
      cuotaMes: cuotaMes.get(o.nombre) ?? null,
      pctCuotaMes: cuotaMes.get(o.nombre) ? (o.mtd / cuotaMes.get(o.nombre)) * 100 : null,
      pctCuotaYtd: cuotaYtd.get(o.nombre) ? (o.ytd / cuotaYtd.get(o.nombre)) * 100 : null,
    }));
  }, [data, anio, mes, hoy]);

  const filtrados = useMemo(() => {
    const nq = norm(q.trim());
    const base = nq ? lista.filter((o) => { const t = norm(`${o.nombre} ${o.label} ${canalLabel(o.canal)}`); return nq.split(/\s+/).every((w) => t.includes(w)); }) : lista;
    return [...base].sort((a, b) => (orden === 'mes' ? (b.mtd - a.mtd) || (b.ytd - a.ytd) : (b.ytd - a.ytd) || (b.mtd - a.mtd)));
  }, [lista, q, orden]);
  const visibles = verTodo || q ? filtrados : filtrados.slice(0, 40);
  const totalMes = sum(lista, (o) => o.mtd), conVenta = lista.filter((o) => o.mtd > 0).length;

  const abrir = (o) => nav.push(<AnalisisFicha clienteNombre={o.nombre} canal={o.canal} label={o.label} />, `analisis-${o.nombre}`);

  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Análisis por cliente" sub={data ? `${MESES[mes - 1]} ${anio} · ${moneyCompact(totalMes)} en ${conVenta} clientes con venta` : `${MESES[mes - 1]} ${anio}`}
        derecha={<Segmented value={orden} onChange={setOrden} options={[{ id: 'mes', label: 'Mes' }, { id: 'ytd', label: 'YTD' }]} />} />
      <div style={{ padding: '0 16px 12px' }}><CampoBusqueda value={q} onChange={setQ} placeholder="Cliente o canal" /></div>
      {error && <Vacio titulo="No se pudieron cargar los clientes" sub={error.message} color={theme.red} />}
      {(isLoading || !data) && !error && <div style={{ padding: '0 16px' }}><Skeleton h={480} r={12} /></div>}
      {data && (
        <ListaAgrupada titulo={orden === 'mes' ? `Por facturación de ${MESES[mes - 1]}` : `Por acumulado ${anio}`} meta={q ? `${filtrados.length} de ${lista.length}` : `${lista.length}`}
          pie="Facturación del ERP (facturacion_clientes) · pill = mes vs mismo mes del año anterior a mismo día. Toca un cliente para su ficha.">
          {visibles.length === 0 && <Vacio icon={null} titulo="Sin coincidencias" />}
          {visibles.map((o) => (
            <Fila key={o.nombre} tono={o.propio ? colorCliente(o.ck, theme) : (o.mtd > 0 ? theme.accent : theme.textSubtle || theme.textMuted)}
              titulo={<span>{o.label}{o.propio && <span style={{ fontSize: 10.5, color: theme.textMuted, marginLeft: 6, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '0.04em' }}>PROPIO</span>}</span>}
              sub={`${canalLabel(o.canal || 'otros')} · YTD ${moneyCompact(o.ytd)}${pctCuotaDe(o, orden) == null ? '' : ` · cuota ${Math.round(pctCuotaDe(o, orden))} %`}${o.meses ? ` · ${o.meses} meses activo` : ''}`}
              valor={o.mtd > 0 ? money(o.mtd) : '—'} valorSub={orden === 'mes' ? undefined : moneyCompact(o.ytd)}
              pill={{ tone: tonoDelta(o.yoy), label: o.yoy != null ? deltaPct(o.yoy) : o.mtd > 0 ? 'nuevo' : 'sin venta' }} onClick={() => abrir(o)} />
          ))}
          {!verTodo && !q && filtrados.length > 40 && (
            <button type="button" onClick={() => setVerTodo(true)} style={{ width: '100%', height: 44, border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Ver los {filtrados.length} clientes</button>
          )}
        </ListaAgrupada>
      )}
    </>
  );
}
