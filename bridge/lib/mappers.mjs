// Mapeo fila SQL → fila Supabase. Réplica 1:1 de los parsers de uploads.html
// y public/xlsx-stream.js (mismas reglas de cliente_key, filtros y nombres de
// columna). Si cambias uno, cambia el otro.
import { num, int, txt, isoDate, rowAccessor, snake } from './util.mjs';

// ── cliente_key: misma regla que facturacion_clientes / erp_ventas ──────────
const mapearCliente = (nombre) => {
  const s = String(nombre || '').toUpperCase();
  if (s.includes('CAJADL01') || s.includes('API GLOBAL')) return 'digitalife';
  if (s.includes('PC ONLINE')) return 'pcel';
  if (s.includes('DICOTECH')) return 'dicotech';
  return null;
};
const slugCanal = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ── Vw_TablaH_Ventas → erp_ventas ───────────────────────────────────────────
export const ERP_VENTAS_COLS = ['Articulo','Descripcion1','Marca','Familia','Rama','Grupo(Linea)','Categoria(SubLinea)','Cliente','ClienteNombre','Canal','Subcanal','Almacen','Vendedor','Folio','Referencia','ListaPreciosEsp','periodo','anio','mes','dia','Unidades','Piezas','MontoVentaPesos','CostoVentaPesos','PrecioPorUnidadPesos','CostoPorPiezaPesos','TipoCambio','Moneda','MovimientoVenta','MovimientoVentaID','Instruccion','estatusventa','VentaId','VentaRenglon'];

export function erpVentas(row) {
  const g = rowAccessor(row);
  const ventaId = int(g('VentaId')), renglon = int(g('VentaRenglon'));
  if (ventaId == null || renglon == null) return null;
  const clienteNombre = txt(g('ClienteNombre')), canal = txt(g('Canal'));
  return {
    venta_id: ventaId, venta_renglon: renglon,
    articulo: txt(g('Articulo')), descripcion: txt(g('Descripcion1')), marca: txt(g('Marca')), familia: txt(g('Familia')), rama: txt(g('Rama')),
    grupo_linea: txt(g('Grupo(Linea)', 'GrupoLinea')), categoria: txt(g('Categoria(SubLinea)', 'CategoriaSubLinea')),
    cliente: txt(g('Cliente')), cliente_nombre: clienteNombre, cliente_key: mapearCliente(clienteNombre) || slugCanal(canal) || 'otros',
    canal, subcanal: txt(g('Subcanal')), almacen: int(g('Almacen')), vendedor: txt(g('Vendedor')),
    folio: txt(g('Folio')), referencia: txt(g('Referencia')), lista_precios: txt(g('ListaPreciosEsp')),
    periodo: isoDate(g('periodo')), anio: int(g('anio')), mes: int(g('mes')), dia: int(g('dia')),
    // La vista del ERP devuelve Unidades en NULL (2026-09-09): Piezas es el respaldo.
    // Las medidas en Postgres también hacen COALESCE(unidades, piezas, 0).
    unidades: num(g('Unidades')) ?? num(g('Piezas')), piezas: num(g('Piezas')),
    monto_venta_pesos: num(g('MontoVentaPesos')), costo_venta_pesos: num(g('CostoVentaPesos')),
    precio_unidad_pesos: num(g('PrecioPorUnidadPesos')), costo_pieza_pesos: num(g('CostoPorPiezaPesos')),
    tipo_cambio: num(g('TipoCambio')), moneda: txt(g('Moneda')),
    movimiento_venta: txt(g('MovimientoVenta')), movimiento_venta_id: txt(g('MovimientoVentaID')),
    instruccion: txt(g('Instruccion')), estatus_venta: txt(g('estatusventa')),
  };
}

// ── Vw_TablaH_Inventario → inventario_acteck (replace completo) ─────────────
const ALM_META = {
  1:{nombre:'VENTAS GENERAL GUADALAJARA',cedis:'ALMACENES GUADALAJARA'}, 2:{nombre:'VENTAS GENERAL COLOTLAN',cedis:'ALMACENES COLOTLAN'},
  3:{nombre:'VENTAS GENERAL MEXICO',cedis:'ALMACENES MEXICO'}, 4:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'},
  5:{nombre:'REFACTURACION',cedis:'ALMACENES GUADALAJARA'}, 6:{nombre:'VENTAS DECME MEXICO',cedis:'ALMACENES MEXICO'},
  9:{nombre:'VENTAS CONSIGNACION MERCADO LIBRE',cedis:'ALMACENES GUADALAJARA'}, 10:{nombre:'ACTIVO FIJO',cedis:'ALMACENES GUADALAJARA'},
  11:{nombre:'NO COMERCIAL',cedis:'ALMACENES MEXICO'}, 12:{nombre:'VENTAS REFACCIONES',cedis:'ALMACENES GUADALAJARA'},
  13:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'}, 14:{nombre:'VENTAS PAGINA WEB DROSHIPPING',cedis:'ALMACENES GUADALAJARA'},
  15:{nombre:'STOCK ROTATION TEMPORAL',cedis:'ALMACENES GUADALAJARA'}, 16:{nombre:'VENTAS RETAIL GUADALAJARA',cedis:'ALMACENES GUADALAJARA'},
  17:{nombre:'VENTAS RETAIL MEXICO',cedis:'ALMACENES MEXICO'}, 19:{nombre:'VENTAS DECME GUADALAJARA',cedis:'ALMACENES GUADALAJARA'},
  20:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'}, 25:{nombre:'VENTAS APARTADO ECOMMERCE',cedis:'ALMACENES GUADALAJARA'},
  30:{nombre:'NO COMERCIAL',cedis:'ALMACENES MEXICO'}, 41:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'},
  42:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'}, 43:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'},
  44:{nombre:'VENTAS EMPAQUE DANADO GUADALAJARA',cedis:'ALMACENES GUADALAJARA'}, 50:{nombre:'ALMACEN MUESTRAS',cedis:'ALMACENES GUADALAJARA'},
  62:{nombre:'NO COMERCIAL',cedis:'ALMACENES MEXICO'}, 63:{nombre:'NO COMERCIAL',cedis:'ALMACENES MEXICO'},
  64:{nombre:'VENTAS EMPAQUE DANADO MEXICO',cedis:'ALMACENES MEXICO'}, 70:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'},
  71:{nombre:'VENTAS APARTADO ECOMMERCE TULTITLAN',cedis:'ALMACENES MEXICO'}, 90:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'},
  97:{nombre:'ALMACEN DE REMISIONES',cedis:'ALMACENES GUADALAJARA'}, 98:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'},
  99:{nombre:'NO COMERCIAL',cedis:'ALMACENES MEXICO'}, 100:{nombre:'NO COMERCIAL',cedis:'ALMACENES GUADALAJARA'},
};
export function erpInventario(row) {
  const g = rowAccessor(row);
  const articulo = txt(g('articulo'));
  if (!articulo) return null;
  const no_almacen = int(g('No_Almacen', 'no_almacen'));
  if (no_almacen == null) return null;
  const inventario = num(g('inventario')), disponible = num(g('disponible'));
  const costopromedio = num(g('costopromedio')), costodisponible = num(g('CostoDisponible')), costoinventario = num(g('CostoInventario'));
  if ((inventario ?? 0) === 0 && (disponible ?? 0) === 0 && (costoinventario ?? 0) === 0) return null;
  const meta = ALM_META[no_almacen] || {};
  return {
    articulo, no_almacen,
    no_cedis: int(g('No_cedis')) ?? 0,
    almacen_nombre: txt(g('Almacen_nombre')) || meta.nombre || `ALMACEN ${no_almacen}`,
    cedis: txt(g('cedis')) || meta.cedis || null,
    disponible, inventario, costopromedio, costodisponible, costoinventario,
  };
}

// ── Vw_TablaM_Precios → precios_sku (replace completo, mes actual) ──────────
const LISTAS_INCLUIDAS = new Set(['API PROVISIONAL', 'DECME PROVISIONAL', 'DICOTECH', 'Mayoreo AAA', 'PCEL PROVISIONAL']);
export function preciosERP(row, ctx) {
  const g = rowAccessor(row);
  const lista = txt(g('Lista'));
  if (!lista || !LISTAS_INCLUIDAS.has(lista)) return null;
  const sku = txt(g('Articulo', 'SKU'));
  if (!sku) return null;
  const precio = num(g('Precio'));
  if (precio == null || precio <= 0) return null;
  return { sku, lista, moneda: txt(g('Moneda')) || 'PESOS', anio: ctx.anio, mes: ctx.mes, precio };
}

// ── Vw_TablaH_Compras → compras_oc (opcional; sólo CantidadPendiente > 0) ───
export function comprasOC(row) {
  const obj = {}; for (const k of Object.keys(row)) obj[snake(k)] = row[k];
  const articulo = txt(obj.articulo), movid = txt(obj.movid);
  if (!articulo || !movid) return null;
  const cantPend = num(obj.cantidad_pendiente ?? obj.cantidadpendiente);
  if (cantPend == null || cantPend <= 0) return null;
  return {
    articulo, movid,
    fabricante:         txt(obj.fabricante),
    prov_id:            txt(obj.prov_id ?? obj.provid),
    proveedor:          txt(obj.nombre),
    estatus:            txt(obj.estatus),
    descripcion:        txt(obj.descripcion1 ?? obj.descripcion),
    mov_tipo:           txt(obj.mov),
    cantidad_orden:     num(obj.cantidad_orden ?? obj.cantidadorden),
    cantidad_pendiente: cantPend,
    costo_usd:          num(obj.costo),
    tipocambio:         num(obj.tipocambio),
    fecha_emision:      isoDate(obj.fecha_emision ?? obj.fechaemision),
  };
}

// ── Cuotas (RevkoBi · dbo.BP) → cuotas_mensuales ───────────────────────────
// BP trae una fila por cliente/SKU/mes. Por (IDCLIENTE, año, mes) se SUMAN:
//   · CUOTAMINIMA   → cuota_min   (cuota mínima: mide a vendedores, facturación neta / cuota mínima)
//   · IMPORTEDEVENTA → cuota_ideal (cuota vendor: mide los apoyos del cliente; el dashboard la usa como meta)
// Verificado contra las cuotas que ya estaban en Supabase (CT 2025-09, PCEL 2025-03,
// ARROBA y TECHS MART 2026): la suma de CUOTAMINIMA coincide al centavo.
// La identidad del cliente es su número de 5 dígitos (CT = 00183; catálogo en
// ERP dbo.Vw_TablaM_Clientes: Cliente, NombreCorto, Nombre, Canal, Vendor).
// La columna `cliente` de cuotas_mensuales es la clave que usa el dashboard
// (nombre en minúsculas con "_"); se obtiene del nombre de BP con la MISMA
// normalización que uploads.html, salvo los casos fijados por número en CLIENTE_POR_ID.
const NORM_CLIENTE = { 'DICOTECH': 'dicotech', 'DIGITAL LIFE': 'digitalife', 'DIGITALIFE': 'digitalife', 'PCEL': 'pcel' };
const normalizarCliente = (nm) => {
  const up = String(nm || '').trim().toUpperCase();
  if (NORM_CLIENTE[up]) return NORM_CLIENTE[up];
  return up.toLowerCase().replace(/\s+/g, '_');
};
/** Clave del dashboard por número de cliente (manda sobre el nombre). Agregar aquí si BP renombra un cliente. */
export const CLIENTE_POR_ID = {
  '00183': 'ct', '00417': 'cva', '00473': 'pcel', '00708': 'dicotech', '00764': 'digitalife',
  '00514': 'techs_mart', '00682': 'techsmart',   // son dos clientes distintos en BP
};
const padId = (v) => { const s = String(v ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(5, '0') : s; };

/**
 * Agrega las filas de BP a una por (cliente, año, mes).
 * ctx.cols = [idcliente, nombrecliente, fecha, cuota_minima, cuota_vendor, cuota_piezas, cuota_costo]
 *            (nombres reales de la vista; las dos últimas son opcionales).
 *
 * Medidas del director que salen de aquí (docs/MEDIDAS_DIRECTOR.md §2):
 *   Cuota Minima  = SUM(BP[CUOTAMINIMA])    → cuota_min
 *   Cuota Venta   = SUM(BP[IMPORTEDEVENTA]) → cuota_ideal
 *   Cuota Piezas  = SUM(BP[UNIDADES])       → cuota_piezas   (null si la columna no viene)
 *   Cuota Costo   = SUM(BP[COSTODEVENTA])   → cuota_costo    (null si la columna no viene)
 * Regla: si la columna no está configurada en CUOTAS_COLS, el campo va **null**, nunca 0
 * (en pantalla sale "—" en vez de una meta inventada).
 */
export function cuotasDesdeBP(rows, ctx) {
  const [cId, cNom, cFecha, cMin, cVendor, cPiezas, cCosto] = ctx.cols;
  const acc = new Map();
  for (const row of rows) {
    const g = rowAccessor(row);
    const id = padId(g(cId));
    const min = num(g(cMin)) ?? 0, vendor = cVendor ? (num(g(cVendor)) ?? 0) : 0;
    if (!id || (min <= 0 && vendor <= 0)) continue;
    const f = g(cFecha); const d = f instanceof Date ? f : new Date(f);
    if (Number.isNaN(d.getTime())) continue;
    const anio = d.getUTCFullYear(), mes = d.getUTCMonth() + 1;
    const key = `${id}|${anio}|${mes}`;
    const cur = acc.get(key) || { id, nombre: g(cNom), anio, mes, min: 0, vendor: 0, piezas: null, costo: null };
    cur.min += Math.max(min, 0); cur.vendor += Math.max(vendor, 0); if (g(cNom)) cur.nombre = g(cNom);
    if (cPiezas) { const v = num(g(cPiezas)); if (v != null) cur.piezas = (cur.piezas ?? 0) + Math.max(v, 0); }
    if (cCosto)  { const v = num(g(cCosto));  if (v != null) cur.costo  = (cur.costo  ?? 0) + Math.max(v, 0); }
    acc.set(key, cur);
  }
  const out = [];
  for (const c of acc.values()) {
    const cliente = CLIENTE_POR_ID[c.id] || normalizarCliente(c.nombre);
    if (!cliente || cliente === 'total_general') continue;
    // Sólo cliente-mes con cuota mínima: en BP hay IMPORTEDEVENTA sin CUOTAMINIMA (2019-2022,
    // canal MOSTRADOR…) que no son cuotas. Sin cuota vendor la meta cae a la mínima, como antes.
    if (c.min <= 0) continue;
    out.push({ cliente, anio: c.anio, mes: c.mes, cuota_min: c.min, cuota_ideal: c.vendor > 0 ? c.vendor : c.min,
               cuota_piezas: c.piezas, cuota_costo: c.costo });
  }
  return out;
}

// ── Vista de Sell Out General → sellout_general (upsert por id) ─────────────
const MAYORISTAS = {
  183:'CT INTERNACIONAL', 417:'CVA', 335:'GRUPO UNIDADES DE COMPUTO', 683:'INGRAM MICRO', 1145:'ARROBA COMPUTERS',
  514:'TECHS MART', 708:'DICOTECH', 226:'EXEL DEL NORTE', 662:'DC MAYORISTA', 870:'GROUP NSSTORE',
  676:'GRUPO LOMA DEL NORTE', 106:'PCH MAYOREO', 7424:'INTEGRADORA KABIK',
};
export function selloutGeneral(row) {
  const obj = {}; for (const k of Object.keys(row)) obj[snake(k)] = row[k];
  const id = int(obj.id);
  if (!id) return null;
  const idcli = int(obj.idcliente);
  const fecha = isoDate(obj.fecha);
  let anio = null, mes = null;
  if (fecha) { anio = parseInt(fecha.slice(0, 4), 10); mes = parseInt(fecha.slice(5, 7), 10); }
  return {
    id, idcliente: idcli, mayorista: MAYORISTAS[idcli] || `MAYORISTA ${idcli}`,
    fecha, anio, mes,
    sku: txt(obj.sku), sku_cliente: txt(obj.sku_cliente ?? obj.skucliente), descripcion: txt(obj.descripcion),
    cliente_codigo: txt(obj.cliente), cliente_nombre: txt(obj.clientenombre ?? obj.cliente_nombre), cliente_rfc: txt(obj.clienterfc ?? obj.cliente_rfc),
    vendedor: txt(obj.vendedor), vendedor_nombre: txt(obj.vendedornombre ?? obj.vendedor_nombre),
    almacen: txt(obj.almacen), sucursal: txt(obj.sucursal),
    cantidad: num(obj.cantidad), precio_unitario: num(obj.preciounitario ?? obj.precio_unitario), importe: num(obj.importe),
    factura: txt(obj.factura), marca: txt(obj.marca), estado: txt(obj.estado), linea: txt(obj.linea), moneda: txt(obj.moneda),
    importe_usd: num(obj.importeusd ?? obj.importe_usd), tipocambio: num(obj.tipocambio ?? obj.tipo_cambio),
  };
}
