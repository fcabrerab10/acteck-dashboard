// Precio y costo del SKU en el drill de Sell Out (2026-09-29, Fernando: «para mí es importante poder ver el costo
// promedio; en Digitalife debe ser el costo convenio»). Cuatro cifras y un mini trazo:
//   · Digitalife: costo convenio (foto semanal de `inventario_cliente`, cambia cuando se da un apoyo) · nuestra última
//     factura · diferencia (= apoyo ya aplicado) · precio de venta de Digitalife. Trazo: convenio por semana del año.
//   · PCEL / Dicotech (no reportan costo): costo promedio facturado por Acteck en 90 d · última factura · lista.
// Abajo, los apoyos registrados en Pagos › Apoyos por producto para ese SKU, con «Ver en Pagos» y «Registrar apoyo»
// (abre Pagos con el cliente y el SKU ya puestos en el formulario: `acteck:navegar` extra `{ apoyoSku }`).
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll, cachedQuery } from '../../../lib/queries';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { GraficaLineas, Pill, Boton } from '../../../components/kit';
import { useApoyosPorSku } from '../pagosv3/datosApoyos';
import { puedeEditarPagos } from '../pagosv3/datos';
import { usePerfil } from '../../../lib/perfilContext';
import { isoLocal, fechaCorta } from '../../../lib/format';

const mxn2 = (n) => (n == null || !isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// «26 nov» si es de este año; «26 nov 25» si no (la última factura de un SKU puede ser de hace meses).
const fechaAnio = (iso) => { const y = String(iso || '').slice(0, 4); return y && y !== String(new Date().getFullYear()) ? `${fechaCorta(iso)} ${y.slice(2)}` : fechaCorta(iso); };

async function precioCostoSku(clienteKey, sku, anio) {
  const desde = isoLocal(new Date(Date.now() - 90 * 86400000));
  const [conv, fact] = await Promise.all([
    clienteKey === 'digitalife'
      ? fetchAll('inventario_cliente', 'anio,semana,costo_convenio,precio_venta', (q) => q.eq('cliente', clienteKey).eq('sku', sku).gte('anio', anio - 1))
      : Promise.resolve([]),
    cachedQuery(supabase.from('erp_ventas').select('periodo,unidades,precio_unidad_pesos,monto_venta_pesos,lista_precios')
      .eq('cliente_key', clienteKey).eq('articulo', sku).eq('movimiento_venta', 'Factura').gt('unidades', 0)
      .order('periodo', { ascending: false }).limit(60)).then((r) => r.data || []),
  ]);
  const fotos = (conv || []).map((r) => ({ anio: N(r.anio), semana: N(r.semana), convenio: N(r.costo_convenio), venta: N(r.precio_venta) }))
    .sort((a, b) => a.anio - b.anio || a.semana - b.semana);
  const ultimaFoto = fotos[fotos.length - 1] || null;
  // ¿Desde qué semana está igual el convenio actual?
  let igualDesde = null;
  if (ultimaFoto) {
    for (let i = fotos.length - 1; i >= 0; i--) { if (Math.abs(fotos[i].convenio - ultimaFoto.convenio) > 0.005) break; igualDesde = fotos[i]; }
  }
  const facturas = (fact || []).map((r) => ({ fecha: String(r.periodo || '').slice(0, 10), pz: N(r.unidades), precio: N(r.precio_unidad_pesos), monto: N(r.monto_venta_pesos), lista: r.lista_precios || null }));
  const ultima = facturas[0] || null;
  const en90 = facturas.filter((f) => f.fecha >= desde);
  const base = en90.length ? en90 : facturas;
  const pz = base.reduce((s, f) => s + f.pz, 0), monto = base.reduce((s, f) => s + (f.monto || f.pz * f.precio), 0);
  return {
    fotos: fotos.filter((f) => f.anio === anio), ultimaFoto, igualDesde,
    ultima, promFacturado: pz > 0 ? monto / pz : null, promBase: en90.length ? '90 d' : facturas.length ? `últimas ${facturas.length}` : null, promPz: pz,
  };
}

export function usePrecioCostoSku(clienteKey, sku, anio) {
  return useQuery({ queryKey: ['precio_costo_sku', clienteKey, sku, anio], queryFn: () => precioCostoSku(clienteKey, sku, anio), enabled: !!clienteKey && !!sku, staleTime: 5 * 60 * 1000 });
}

function Cifra({ theme, k, v, s, color, borde }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${borde || theme.border}`, borderRadius: 6, padding: '6px 8px', minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 700, color: color || theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{v}</div>
      {s && <div style={{ fontSize: 9.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>}
    </div>
  );
}

const navegarPagos = (clienteKey, extra) => window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { pagina: 'pagos', clienteKey, extra } }));

export default function BloquePrecioCosto({ clienteKey, sku, anio, P = {}, isDark }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const puedeRegistrar = puedeEditarPagos(perfil, clienteKey);
  const { data, isLoading } = usePrecioCostoSku(clienteKey, sku, anio);
  const { data: apoyos } = useApoyosPorSku(clienteKey);
  const apoyo = apoyos?.get?.(sku) || null;
  const esDigitalife = clienteKey === 'digitalife';
  const green = P.green || '#34C759', red = P.red || '#FF3B30';

  const serie = useMemo(() => (data?.fotos || []).map((f) => ({ x: `S${f.semana}`, convenio: f.convenio, venta: f.venta || null })), [data]);
  const conv = data?.ultimaFoto?.convenio || null;
  const ultima = data?.ultima || null;
  const dif = conv && ultima?.precio ? conv - ultima.precio : null;
  const difPct = dif != null && ultima.precio ? (dif / ultima.precio) * 100 : null;
  const margenCli = conv && data?.ultimaFoto?.venta ? ((data.ultimaFoto.venta - conv) / data.ultimaFoto.venta) * 100 : null;

  const titulo = esDigitalife ? 'Precio y costo · costo convenio de Digitalife' : 'Precio y costo · facturado por Acteck';
  const meta = esDigitalife
    ? (data?.ultimaFoto ? `foto semana ${data.ultimaFoto.semana} · ${data.ultimaFoto.anio}` : 'sin foto de inventario')
    : (data?.promBase ? `promedio ponderado ${data.promBase}` : 'sin facturas');

  return (
    <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{titulo}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>{isLoading ? 'cargando…' : meta}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {esDigitalife ? (
          <>
            <Cifra theme={theme} k="Costo convenio" v={mxn2(conv)} borde={P.accent || '#007AFF'}
              s={data?.igualDesde && data.ultimaFoto && (data.igualDesde.semana !== data.ultimaFoto.semana || data.igualDesde.anio !== data.ultimaFoto.anio) ? `igual desde sem ${data.igualDesde.semana}` : (data?.fotos?.length > 1 ? 'cambió esta semana' : null)} />
            <Cifra theme={theme} k="Nuestra última factura" v={mxn2(ultima?.precio)} s={ultima ? `${fechaAnio(ultima.fecha)}${ultima.lista ? ` · ${ultima.lista}` : ''}` : 'sin facturas'} />
            <Cifra theme={theme} k="Diferencia" v={dif == null ? '—' : `${dif > 0 ? '+' : '−'}${mxn2(Math.abs(dif))}${difPct != null ? ` · ${difPct > 0 ? '+' : '−'}${Math.abs(difPct).toFixed(0)}%` : ''}`}
              color={dif == null ? undefined : dif < -0.5 ? green : dif > 0.5 ? red : undefined} s={dif == null ? 'convenio vs factura' : dif < -0.5 ? 'apoyo ya aplicado en su costo' : dif > 0.5 ? 'compró más caro que hoy' : 'igual a la factura'} />
            <Cifra theme={theme} k="Precio venta Digitalife" v={mxn2(data?.ultimaFoto?.venta || null)} s={margenCli != null ? `margen del cliente ${margenCli.toFixed(0)}%` : null} />
          </>
        ) : (
          <>
            <Cifra theme={theme} k="Costo prom. facturado" v={mxn2(data?.promFacturado)} borde={P.accent || '#007AFF'} s={data?.promPz ? `${data.promPz.toLocaleString('es-MX')} pz ${data.promBase}` : null} />
            <Cifra theme={theme} k="Última factura" v={mxn2(ultima?.precio)} s={ultima ? `${fechaAnio(ultima.fecha)} · ${ultima.pz.toLocaleString('es-MX')} pz` : 'sin facturas'} />
            <Cifra theme={theme} k="Lista" v={ultima?.lista || '—'} s="de la última factura" />
            <Cifra theme={theme} k="Apoyos en Pagos" v={apoyo ? mxn2(apoyo.monto) : '—'} s={apoyo ? `${apoyo.n} apoyo${apoyo.n === 1 ? '' : 's'} · ${apoyo.piezas.toLocaleString('es-MX')} pz` : 'sin apoyos registrados'} color={apoyo ? green : undefined} />
          </>
        )}
      </div>
      {esDigitalife && serie.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <GraficaLineas compacto alto={72} desdeCero={false} mostrarMinMax={false} puntos={false} formato={mxn2} datos={serie}
            series={[{ key: 'convenio', label: 'Convenio', tipo: 'principal' }, { key: 'venta', label: 'Venta Digitalife', tipo: 'lectura', formato: mxn2 }]} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${theme.divider || theme.border}` }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Apoyos por producto</span>
        {apoyo
          ? <Pill tone="green" size="xs" title={apoyo.folios.length ? `NC ${apoyo.folios.join(', ')}` : undefined}>{apoyo.n} apoyo{apoyo.n === 1 ? '' : 's'} · {apoyo.piezas.toLocaleString('es-MX')} pz · {mxn2(apoyo.monto)} · último {apoyo.ultimo ? fechaAnio(apoyo.ultimo) : '—'}</Pill>
          : <Pill tone="gray" size="xs">sin apoyos registrados en Pagos</Pill>}
        <span style={{ flex: 1 }} />
        <Boton onClick={(e) => { e.stopPropagation(); navegarPagos(clienteKey, { sku }); }}>Ver en Pagos</Boton>
        {puedeRegistrar && <Boton primario onClick={(e) => { e.stopPropagation(); navegarPagos(clienteKey, { apoyoSku: sku }); }}>Registrar apoyo</Boton>}
      </div>
    </div>
  );
}

