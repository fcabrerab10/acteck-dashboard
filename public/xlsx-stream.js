/* ─── xlsx-stream.js · Lector por streaming de UNA hoja de un .xlsx ─────────
 * Para hojas que SheetJS no puede abrir en el navegador (Vw_TablaH_Ventas:
 * 176K filas × 70 columnas ≈ 519 MB de XML). Usa fflate (Unzip streaming):
 *   pasada 1 → workbook.xml + rels + sharedStrings.xml
 *   pasada 2 → sólo el XML de la hoja objetivo, fila por fila
 * Nunca materializa la hoja completa. Mismo archivo se usa en uploads.html
 * (window.XlsxStream) y en scripts Node (require) para la carga inicial.
 * Requiere `fflate` global (CDN) o instalable por npm en Node.
 * ─────────────────────────────────────────────────────────────────────── */
(function (root) {
  // fflate: global del CDN (uploads.html) o inyectado vía root.__fflate (Node/ESM).
  const F = (typeof fflate !== 'undefined') ? fflate : root.__fflate;
  if (!F) throw new Error('xlsx-stream: fflate no disponible (carga el CDN o define globalThis.__fflate)');

  function colIndex(ref) { let n = 0; for (let i = 0; i < ref.length; i++) { const c = ref.charCodeAt(i); if (c < 65 || c > 90) break; n = n * 26 + c - 64; } return n - 1; }
  const unesc = (s) => s.indexOf('&') < 0 ? s : s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Recorre el zip; infla sólo las entradas que `want(name)` acepte y entrega
  // el texto por trozos a onChunk(name, text, final).
  function scanZip(u8, want, onChunk) {
    return new Promise((resolve, reject) => {
      const unz = new F.Unzip();
      unz.register(F.UnzipInflate);
      let pending = 0, ended = false, failed = false;
      const done = () => { if (ended && pending === 0 && !failed) resolve(); };
      unz.onfile = (file) => {
        if (!want(file.name)) return;
        pending++;
        const dec = new TextDecoder('utf-8');
        file.ondata = (err, chunk, final) => {
          if (failed) return;
          if (err) { failed = true; reject(err); return; }
          try { onChunk(file.name, dec.decode(chunk, { stream: !final }), final); }
          catch (e) { failed = true; reject(e); return; }
          if (final) { pending--; done(); }
        };
        file.start();
      };
      const STEP = 4 * 1024 * 1024;
      for (let i = 0; i < u8.length && !failed; i += STEP) unz.push(u8.subarray(i, Math.min(i + STEP, u8.length)), i + STEP >= u8.length);
      ended = true; done();
    });
  }

  // Convierte el stream XML de una worksheet en filas (array por índice de columna).
  function makeRowParser(onRow) {
    let buf = '';
    const cellRe = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    return function feed(text, final) {
      buf += text;
      const last = buf.lastIndexOf('</row>');
      if (last < 0) { if (final) buf = ''; return; }
      const chunk = buf.slice(0, last + 6); buf = buf.slice(last + 6);
      const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g; let rm;
      while ((rm = rowRe.exec(chunk))) {
        const cells = []; let cm; cellRe.lastIndex = 0;
        while ((cm = cellRe.exec(rm[1]))) {
          const inner = cm[3]; if (inner == null) continue;
          const idx = colIndex(cm[1]); const attrs = cm[2] || '';
          const tm = /\bt="([^"]*)"/.exec(attrs); const t = tm ? tm[1] : null;
          let v = null;
          if (t === 'inlineStr') { const im = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner); v = im ? unesc(im[1]) : null; }
          else { const vm = /<v>([\s\S]*?)<\/v>/.exec(inner); if (vm) v = t === 's' ? { s: +vm[1] } : t === 'str' ? unesc(vm[1]) : +vm[1]; }
          if (v != null) cells[idx] = v;
        }
        onRow(cells);
      }
      if (final) buf = '';
    };
  }

  /** Lee `sheetName` de un Uint8Array .xlsx. onRow(vals, header) por fila de datos
   *  (la primera fila es el encabezado). onProgress(n) cada 10K filas. */
  async function readSheetStream(u8, sheetName, onRow, onProgress) {
    let workbook = '', rels = '', ssBuf = ''; const ss = [];
    const ssRe = /<si>([\s\S]*?)<\/si>/g;
    await scanZip(u8, (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml', (n, txt) => {
      if (n === 'xl/workbook.xml') workbook += txt;
      else if (n === 'xl/_rels/workbook.xml.rels') rels += txt;
      else {
        ssBuf += txt; const last = ssBuf.lastIndexOf('</si>'); if (last < 0) return;
        const part = ssBuf.slice(0, last + 5); ssBuf = ssBuf.slice(last + 5); let m;
        while ((m = ssRe.exec(part))) { let s = ''; const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g; let tm; while ((tm = tRe.exec(m[1]))) s += tm[1]; ss.push(unesc(s)); }
      }
    });
    const sm = new RegExp('<sheet [^>]*name="' + reEsc(sheetName) + '"[^>]*r:id="([^"]+)"').exec(workbook)
            || new RegExp('<sheet [^>]*r:id="([^"]+)"[^>]*name="' + reEsc(sheetName) + '"').exec(workbook);
    if (!sm) throw new Error('Hoja no encontrada en el workbook: ' + sheetName);
    const rid = sm[1];
    const rm = new RegExp('<Relationship [^>]*Id="' + rid + '"[^>]*Target="([^"]+)"').exec(rels)
            || new RegExp('<Relationship [^>]*Target="([^"]+)"[^>]*Id="' + rid + '"').exec(rels);
    if (!rm) throw new Error('Relación no encontrada para ' + rid);
    const target = rm[1].startsWith('/') ? rm[1].slice(1) : 'xl/' + rm[1].replace(/^xl\//, '');
    let header = null, n = 0;
    const feed = makeRowParser((cells) => {
      const vals = new Array(cells.length);
      for (let i = 0; i < cells.length; i++) { const v = cells[i]; vals[i] = (v && typeof v === 'object') ? ss[v.s] : v; }
      if (!header) { header = vals.map((h) => h == null ? '' : String(h)); return; }
      n++; if (onProgress && n % 10000 === 0) onProgress(n);
      onRow(vals, header);
    });
    await scanZip(u8, (nm) => nm === target, (nm, txt, final) => feed(txt, final));
    return { header, rows: n, sharedStrings: ss.length, target };
  }

  // ── Mapeo Vw_TablaH_Ventas → public.erp_ventas ─────────────────────────
  // cliente_key sigue la misma regla que facturacion_clientes (uploads.html
  // mapearCliente + slugCanal) para que las policies por cliente coincidan.
  const mapearCliente = (nombre) => {
    const s = String(nombre || '').toUpperCase();
    if (s.includes('CAJADL01') || s.includes('API GLOBAL')) return 'digitalife';
    if (s.includes('PC ONLINE')) return 'pcel';
    if (s.includes('DICOTECH')) return 'dicotech';
    return null;
  };
  const slugCanal = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const num = (v) => (v == null || v === '' || Number.isNaN(+v)) ? null : +v;
  const int = (v) => { const n = num(v); return n == null ? null : Math.trunc(n); };
  const txt = (v) => (v == null ? null : String(v).trim() || null);
  const serialDate = (v) => { const n = num(v); if (n == null) return null; const d = new Date(Math.round((n - 25569) * 86400) * 1000); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); };

  const ERP_VENTAS_COLS = ['Articulo','Descripcion1','Marca','Familia','Rama','Grupo(Linea)','Categoria(SubLinea)','Cliente','ClienteNombre','Canal','Subcanal','Almacen','Vendedor','Folio','Referencia','ListaPreciosEsp','periodo','anio','mes','dia','Unidades','Piezas','MontoVentaPesos','CostoVentaPesos','PrecioPorUnidadPesos','CostoPorPiezaPesos','TipoCambio','Moneda','MovimientoVenta','MovimientoVentaID','Instruccion','estatusventa','VentaId','VentaRenglon'];

  function makeErpVentasMapper(header) {
    const ix = {}; for (const c of ERP_VENTAS_COLS) { const i = header.indexOf(c); if (i < 0) throw new Error('Vw_TablaH_Ventas: falta la columna ' + c); ix[c] = i; }
    return function mapRow(v) {
      const ventaId = int(v[ix.VentaId]), renglon = int(v[ix.VentaRenglon]);
      if (ventaId == null || renglon == null) return null;
      const clienteNombre = txt(v[ix.ClienteNombre]), canal = txt(v[ix.Canal]);
      return {
        venta_id: ventaId, venta_renglon: renglon,
        articulo: txt(v[ix.Articulo]), descripcion: txt(v[ix.Descripcion1]), marca: txt(v[ix.Marca]), familia: txt(v[ix.Familia]), rama: txt(v[ix.Rama]),
        grupo_linea: txt(v[ix['Grupo(Linea)']]), categoria: txt(v[ix['Categoria(SubLinea)']]),
        cliente: txt(v[ix.Cliente]), cliente_nombre: clienteNombre, cliente_key: mapearCliente(clienteNombre) || slugCanal(canal) || 'otros',
        canal, subcanal: txt(v[ix.Subcanal]), almacen: int(v[ix.Almacen]), vendedor: txt(v[ix.Vendedor]),
        folio: txt(v[ix.Folio]), referencia: txt(v[ix.Referencia]), lista_precios: txt(v[ix.ListaPreciosEsp]),
        periodo: serialDate(v[ix.periodo]), anio: int(v[ix.anio]), mes: int(v[ix.mes]), dia: int(v[ix.dia]),
        unidades: num(v[ix.Unidades]), piezas: num(v[ix.Piezas]),
        monto_venta_pesos: num(v[ix.MontoVentaPesos]), costo_venta_pesos: num(v[ix.CostoVentaPesos]),
        precio_unidad_pesos: num(v[ix.PrecioPorUnidadPesos]), costo_pieza_pesos: num(v[ix.CostoPorPiezaPesos]),
        tipo_cambio: num(v[ix.TipoCambio]), moneda: txt(v[ix.Moneda]),
        movimiento_venta: txt(v[ix.MovimientoVenta]), movimiento_venta_id: txt(v[ix.MovimientoVentaID]),
        instruccion: txt(v[ix.Instruccion]), estatus_venta: txt(v[ix.estatusventa]),
      };
    };
  }

  /** Lee Vw_TablaH_Ventas completa y devuelve { rows, anios, header }. */
  async function readErpVentas(u8, onProgress) {
    const rows = []; const anios = new Set(); let mapRow = null;
    const res = await readSheetStream(u8, 'Vw_TablaH_Ventas', (vals, header) => {
      if (!mapRow) mapRow = makeErpVentasMapper(header);
      const r = mapRow(vals); if (!r) return;
      rows.push(r); if (r.anio != null) anios.add(r.anio);
    }, onProgress);
    return { rows, anios: [...anios].sort(), header: res.header, target: res.target };
  }

  root.XlsxStream = { readSheetStream, readErpVentas, makeErpVentasMapper, colIndex, ERP_VENTAS_COLS };
})(typeof window !== 'undefined' ? window : globalThis);
