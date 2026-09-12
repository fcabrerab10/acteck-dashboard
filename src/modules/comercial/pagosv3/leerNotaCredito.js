// Lector de notas de crédito (PDF) · Pagos V3 (2026-09-12) · PURO
//
// No hay pdfjs-dist en node_modules y no valía la pena sumar 1 MB al bundle por un
// PDF de una página: este módulo hace lo mínimo necesario.
//   1. inflate de los streams FlateDecode  → DecompressionStream('deflate') en el
//      navegador, zlib en Node (los tests). Sin dependencias nuevas.
//   2. extrae el texto de los operadores (…) Tj / TJ del content stream, decodificando
//      WinAnsiEncoding y los escapes \( \) \\ \ooo.
//   3. lee los campos de la CADENA ORIGINAL del CFDI (serie, folio, fecha, UUID, RFC,
//      razón social, importe, IVA, total) y, del cuerpo, el concepto y la factura.
// Los PDFs de Revko (motor "Synopse PDF engine") usan fuentes TrueType sin subsetear,
// así que el texto sale legible. Si un PDF no se puede leer, `ok:false` y la pantalla
// pide captura manual con el PDF ya adjunto.

const WIN1252 = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };

const bytesToLatin1 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; };

async function inflate(u8) {
  // Navegador (y Node ≥ 18): DecompressionStream nativo.
  if (typeof DecompressionStream !== 'undefined') {
    for (const fmt of ['deflate', 'deflate-raw']) {
      try {
        const ds = new DecompressionStream(fmt);
        const stream = new Blob([u8]).stream().pipeThrough(ds);
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch { /* siguiente formato */ }
    }
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    // Especificador calculado: así el bundler del navegador no intenta resolver node:zlib.
    const zlib = await import(/* @vite-ignore */ 'node:' + 'zlib');
    try { return new Uint8Array(zlib.inflateSync(Buffer.from(u8))); }
    catch { return new Uint8Array(zlib.inflateRawSync(Buffer.from(u8))); }
  }
  throw new Error('Sin descompresor disponible');
}

/** Texto plano de un PDF simple (una página, FlateDecode, fuentes WinAnsi). */
export async function textoDePdf(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const crudo = bytesToLatin1(u8);
  const piezas = [];
  // (^|no-letra) evita que "endstream" vuelva a entrar como apertura de stream.
  const re = /(^|[^a-zA-Z])stream\r?\n/g;
  let m;
  while ((m = re.exec(crudo)) !== null) {
    const ini = m.index + m[0].length;
    const fin = crudo.indexOf('endstream', ini);
    if (fin < 0) break;
    let texto = null;
    try {
      const inflado = await inflate(u8.subarray(ini, fin));
      texto = bytesToLatin1(inflado);
    } catch { texto = null; }
    if (texto && /\bTj\b|\bTJ\b/.test(texto)) piezas.push(texto);
    re.lastIndex = fin;
  }
  if (piezas.length === 0) return '';
  return piezas.map(extraerTexto).join('\n');
}

function decodificarCadena(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      if (n === 'n') { out += '\n'; i++; continue; }
      if (n === 'r') { out += '\r'; i++; continue; }
      if (n === 't') { out += '\t'; i++; continue; }
      if (n >= '0' && n <= '7') {
        const oct = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0];
        const cod = parseInt(oct, 8);
        out += WIN1252[cod] || String.fromCharCode(cod);
        i += oct.length;
        continue;
      }
      out += n; i++; continue;
    }
    const cod = c.charCodeAt(0);
    out += WIN1252[cod] || c;
  }
  return out;
}

function extraerTexto(contenido) {
  const lineas = [];
  // (texto) Tj   y   [ (a) -20 (b) ] TJ
  const re = /(?:\[((?:[^\[\]\\]|\\.)*)\]\s*TJ)|(?:\(((?:[^()\\]|\\.)*)\)\s*Tj)/g;
  let m;
  while ((m = re.exec(contenido)) !== null) {
    if (m[2] !== undefined) lineas.push(decodificarCadena(m[2]));
    else {
      const partes = [...m[1].matchAll(/\(((?:[^()\\]|\\.)*)\)/g)].map((x) => decodificarCadena(x[1]));
      lineas.push(partes.join(''));
    }
  }
  return lineas.map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()).join('\n');
}

const aNumero = (s) => {
  const n = Number(String(s ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Campos de una nota de crédito a partir de su texto.
 * La CADENA ORIGINAL del CFDI (||4.0|Serie|Folio|Fecha|…) manda; el cuerpo completa
 * concepto y factura aplicada.
 */
export function camposDeNotaCredito(texto) {
  const t = String(texto || '');
  const crudas = t.split('\n');                 // sin recortar: la cadena original parte palabras al saltar de línea
  const lineas = crudas.map((l) => l.trim());
  const campos = {
    nc_folio: null, nc_uuid: null, nc_fecha: null, nc_factura: null,
    nc_importe: null, nc_iva: null, nc_total: null,
    nc_razon_social: null, nc_rfc: null, nc_concepto: null, emisor: null, emisor_rfc: null,
  };

  // ── Cadena original del CFDI (puede venir partida en varias líneas) ──
  const iCad = lineas.findIndex((l) => /CADENA ORIGINAL/i.test(l));
  if (iCad >= 0) {
    const cad = crudas.slice(iCad + 1).join('').replace(/[ \t]{2,}/g, ' ');
    const c = cad.split('|');
    // ||4.0|B|13719|2026-09-09T13:45:44|15|cert|6000.00|MXN|1|6960.00|E|01|PUE|CP|01|UUID|RFCemisor|Emisor|regimen|RFCreceptor|Receptor|…
    const iVer = c.findIndex((x) => /^\d\.\d$/.test(x));
    if (iVer >= 0) {
      const serie = c[iVer + 1] || '';
      const folio = c[iVer + 2] || '';
      campos.nc_folio = `${serie}${folio}`.trim() || null;
      const fecha = c[iVer + 3] || '';
      if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) campos.nc_fecha = fecha.slice(0, 10);
      campos.nc_importe = aNumero(c[iVer + 6]);
      campos.nc_total = aNumero(c[iVer + 9]);
    }
    const uuid = cad.match(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i);
    if (uuid) campos.nc_uuid = uuid[0].toUpperCase();
    const rfcs = [...cad.matchAll(/\|([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\|([^|]+)\|/g)];
    if (rfcs[0]) { campos.emisor_rfc = rfcs[0][1]; campos.emisor = rfcs[0][2].trim(); }
    if (rfcs[1]) { campos.nc_rfc = rfcs[1][1]; campos.nc_razon_social = rfcs[1][2].trim(); }
  }

  // ── Receptor por el cuerpo ("RFC : DMT0911105L5") si la cadena no alcanzó ──
  if (!campos.nc_rfc) {
    const m = t.match(/RFC\s*:?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/);
    if (m) campos.nc_rfc = m[1];
  }
  if (!campos.nc_razon_social) {
    const i = lineas.findIndex((l) => /^Cliente$/i.test(l));
    if (i >= 0 && lineas[i + 1]) campos.nc_razon_social = lineas[i + 1];
  }

  // ── Folio visible en grande (p. ej. "B13719") si la cadena falló ──
  if (!campos.nc_folio) {
    const m = t.match(/\b([A-Z]{1,3}\d{4,8})\b/);
    if (m) campos.nc_folio = m[1];
  }

  // ── Concepto: bloque a la derecha del cliente ("Bonificación / Nota Credito 13890 / CAMPAÑA …") ──
  const iBon = lineas.findIndex((l) => /^Bonificaci[óo]n/i.test(l));
  if (iBon >= 0) {
    const bloque = [lineas[iBon]];
    for (let k = iBon + 1; k < Math.min(iBon + 4, lineas.length); k++) {
      const l = lineas[k];
      if (!l || /^(Concepto|Importe|Impuestos|Total|Factura)$/i.test(l)) break;
      bloque.push(l);
    }
    campos.nc_concepto = bloque.join(' · ');
  }

  // ── Factura a la que se aplicó: la línea "Factura" y la siguiente ("A10379702") ──
  const iFac = lineas.findIndex((l) => /^Factura$/i.test(l));
  if (iFac >= 0 && lineas[iFac + 1] && /^[A-Z]?\d{4,}/.test(lineas[iFac + 1])) {
    campos.nc_factura = lineas[iFac + 1];
  } else {
    const m = t.match(/Factura\s+([A-Z]?\d{5,})/);
    if (m) campos.nc_factura = m[1];
  }

  // ── Importes por etiqueta del resumen (confirma/rellena los de la cadena) ──
  const montoTras = (etiqueta) => {
    const i = lineas.findIndex((l) => new RegExp(`^${etiqueta}$`, 'i').test(l));
    for (let k = i + 1; i >= 0 && k < Math.min(i + 4, lineas.length); k++) {
      if (/^\$[\d,]+\.\d{2}$/.test(lineas[k])) return aNumero(lineas[k]);
    }
    return null;
  };
  const montos = [...t.matchAll(/\$[\d,]+\.\d{2}/g)].map((x) => aNumero(x[0]));
  campos.nc_importe = campos.nc_importe ?? montoTras('Importe') ?? montos[0] ?? null;
  campos.nc_iva = montoTras('Impuestos') ?? (montos.length > 1 ? montos[1] : null);
  campos.nc_total = campos.nc_total ?? montoTras('Total') ?? (montos.length > 2 ? montos[2] : null);
  if (campos.nc_iva == null && campos.nc_total != null && campos.nc_importe != null) {
    campos.nc_iva = Math.round((campos.nc_total - campos.nc_importe) * 100) / 100;
  }

  return campos;
}

/** Lee un File/ArrayBuffer de nota de crédito y devuelve { ok, campos, texto, motivo }. */
export async function leerNotaCredito(entrada) {
  try {
    const buf = entrada instanceof Uint8Array || entrada instanceof ArrayBuffer
      ? entrada
      : new Uint8Array(await entrada.arrayBuffer());
    const texto = await textoDePdf(buf);
    if (!texto || texto.length < 20) {
      return { ok: false, motivo: 'No se pudo leer texto del PDF (¿es un escaneo?). Captura los datos a mano; el PDF queda adjunto.', texto: texto || '', campos: {} };
    }
    const campos = camposDeNotaCredito(texto);
    const ok = !!(campos.nc_folio || campos.nc_total);
    return { ok, campos, texto, motivo: ok ? null : 'El PDF se leyó pero no se reconocieron los campos; confírmalos a mano.' };
  } catch (e) {
    return { ok: false, motivo: `No se pudo abrir el PDF: ${e.message}`, texto: '', campos: {} };
  }
}

export default { leerNotaCredito, camposDeNotaCredito, textoDePdf };
