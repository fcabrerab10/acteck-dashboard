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
    unidades: num(g('Unidades')), piezas: num(g('Piezas')),
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

// ── Vista de cuotas (tabular) → cuotas_mensuales ────────────────────────────
const NORM_CLIENTE = { 'DICOTECH': 'dicotech', 'DIGITAL LIFE': 'digitalife', 'DIGITALIFE': 'digitalife', 'PCEL': 'pcel' };
const normalizarCliente = (nm) => {
  const up = String(nm || '').trim().toUpperCase();
  if (NORM_CLIENTE[up]) return NORM_CLIENTE[up];
  return up.toLowerCase().replace(/\s+/g, '_');
};
/** ctx.cols = ['cliente','anio','mes','cuota'] o ['cliente','anio','mes','cuota_min','cuota_ideal'] (nombres reales de la vista). */
export function cuotas(row, ctx) {
  const g = rowAccessor(row);
  const [cCli, cAnio, cMes, cMin, cIdeal] = ctx.cols;
  const cliente = normalizarCliente(g(cCli));
  if (!cliente || cliente === 'total_general') return null;
  const anio = int(g(cAnio)), mes = int(g(cMes));
  if (!anio || !mes || mes < 1 || mes > 12) return null;
  const cuota_min = num(g(cMin));
  const cuota_ideal = cIdeal ? num(g(cIdeal)) : cuota_min;
  if ((cuota_min ?? 0) <= 0 && (cuota_ideal ?? 0) <= 0) return null;
  return { cliente, anio, mes, cuota_min: cuota_min ?? cuota_ideal, cuota_ideal: cuota_ideal ?? cuota_min };
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
