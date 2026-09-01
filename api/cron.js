// api/cron.js
// Endpoint unificado para cron jobs. Vercel Hobby limita a 12 funciones,
// así que consolido todos los cron en uno solo con ?task=xxx.
//
// Tareas:
//   ?task=sync-master-embarques  → descarga Google Sheet y upserta a embarques_compras
//   ?task=actualizar-fill-rates  → cruza OCs activas con ventas_erp
//
// ENV:
//   SUPABASE_SERVICE_ROLE_KEY
//   MASTER_EMBARQUES_SHEET_ID    (solo para sync)
//   MASTER_EMBARQUES_SHEET_NAME  (opcional, default año actual)
//   CRON_SECRET                  (opcional, si está valida header)

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHEET_ID   = process.env.MASTER_EMBARQUES_SHEET_ID;
const SHEET_NAME = process.env.MASTER_EMBARQUES_SHEET_NAME || String(new Date().getFullYear());

// ═════════════════════ CSV parser ═════════════════════
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i+1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      cur += c;
    } else {
      if (c === '"') { inQuotes = true; continue; }
      if (c === ',') { row.push(cur); cur = ''; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
      if (c === '\r') continue;
      cur += c;
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

// ═════════════════════ Normalización ═════════════════════
function snake(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function toStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '#N/A' ? null : s;
}
function toNum(v) {
  if (v == null || v === '' || v === '#N/A') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}
function toInt(v) { const n = toNum(v); return n == null ? null : Math.round(n); }
function toISODate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/[A-Za-z]/.test(s) && !/\d{1,2}[\/\-]\d{1,2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  let [, a, b, c] = m;
  const year = c.length === 2 ? `20${c}` : c;
  return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
}
function classifyCedis(raw) {
  const s = (raw == null ? '' : String(raw)).trim();
  if (!s) return { cedis: null, entrega_directa_cliente: null };
  if (/^\d/.test(s)) return { cedis: s, entrega_directa_cliente: null };
  return { cedis: s, entrega_directa_cliente: s };
}

function transformEmbarques(rawRows) {
  if (rawRows.length < 2) return [];
  const header = rawRows[0].map(snake);
  const idx = (names) => {
    for (const n of Array.isArray(names) ? names : [names]) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const col = {
    po: idx('po'), fecha_emision: idx('fecha_emision'), grupo: idx('grupo'),
    cbm: idx('cbm'), f_a: idx(['f_a','fa']), porcentaje: idx('porcentaje'),
    familia: idx('familia'), codigo: idx('codigo'), descripcion: idx('descripcion'),
    po_qty: idx('po_qty'), shp_qty: idx('shp_qty'),
    unit_price: idx('unit_price'), total_amount: idx('total_amount'),
    metodo_pago: idx('metodo_de_pago'), supplier: idx('supplier'),
    fecha_ini_prod: idx('fecha_inicio_de_produccion'), fin_prod: idx('fin_de_produccion'),
    ref_ff: idx('ref_ff'), naviera: idx('naviera'),
    tipo_carga: idx('tipo_de_carga'), tipo_cont: idx('tipo_de_cont'),
    costo_flete: idx('costo_flete'), fdw: idx('fdw'), contenedor: idx('contenedor'),
    etd: idx('etd'), eta_puerto: idx('eta_puerto'),
    a_a: idx(['a_a','aa']), arribo_cedis: idx('arribo_a_cedis'),
    lt: idx('lt'), cedis: idx('cedis'), estatus: idx('estatus'),
    com_trafico: idx('comentarios_trafico'), com_diseno: idx('comentarios_diseno'),
  };
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const po = toStr(r[col.po]);
    const codigo = toStr(r[col.codigo]);
    if (!po || !codigo) continue;
    const { cedis, entrega_directa_cliente } = classifyCedis(r[col.cedis]);
    rows.push({
      po, codigo,
      fecha_emision:   toISODate(r[col.fecha_emision]),
      grupo:           toStr(r[col.grupo]),
      cbm:             toNum(r[col.cbm]),
      fraccion_arancelaria: toStr(r[col.f_a]),
      porcentaje:      toNum(r[col.porcentaje]),
      familia:         toStr(r[col.familia]),
      descripcion:     toStr(r[col.descripcion]),
      po_qty:          toInt(r[col.po_qty]),
      shp_qty:         toInt(r[col.shp_qty]),
      unit_price:      toNum(r[col.unit_price]),
      total_amount:    toNum(r[col.total_amount]),
      metodo_pago:     toStr(r[col.metodo_pago]),
      supplier:        toStr(r[col.supplier]),
      fecha_inicio_produccion: toISODate(r[col.fecha_ini_prod]),
      fin_produccion:  toISODate(r[col.fin_prod]),
      ref_ff:          toStr(r[col.ref_ff]),
      naviera:         toStr(r[col.naviera]),
      tipo_carga:      toStr(r[col.tipo_carga]),
      tipo_contenedor: toStr(r[col.tipo_cont]),
      costo_flete:     toNum(r[col.costo_flete]),
      fdw:             toStr(r[col.fdw]),
      contenedor:      toStr(r[col.contenedor]),
      etd:             toISODate(r[col.etd]),
      eta_puerto:      toISODate(r[col.eta_puerto]),
      agente_aduanal:  toStr(r[col.a_a]),
      arribo_cedis:    toISODate(r[col.arribo_cedis]),
      lt:              toStr(r[col.lt]),
      cedis, entrega_directa_cliente,
      estatus:         toStr(r[col.estatus]),
      comentarios_trafico: toStr(r[col.com_trafico]),
      comentarios_diseno:  toStr(r[col.com_diseno]),
    });
  }
  const seen = new Map();
  for (const r of rows) seen.set(`${r.po}||${r.codigo}`, r);
  return [...seen.values()];
}

async function upsertChunks(rows) {
  const CHUNK = 200;
  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const r = await fetch(`${SB_URL}/rest/v1/embarques_compras?on_conflict=po,codigo,arribo_cedis,shp_qty`, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (r.ok) ok += batch.length;
    else {
      fail += batch.length;
      errors.push({ batch: i, status: r.status, err: (await r.text()).slice(0, 300) });
    }
  }
  return { ok, fail, errors };
}

// ═════════════════════ Tareas ═════════════════════
async function taskSyncMasterEmbarques() {
  if (!SHEET_ID) return { error: 'MASTER_EMBARQUES_SHEET_ID no configurada', status: 500 };
  // Itera todas las hojas históricas: 2026, 2025, 2024, 2022-2023.
  // Si una hoja no existe en el Google Sheet, la respuesta dará HTTP 400 y la saltamos.
  const HOJAS = ['2026', '2025', '2024', '2022 - 2023', '2022-2023', '2023', '2022'];
  const resultados = [];
  let totalParsed = 0, totalValid = 0, totalUpserted = 0, totalFail = 0;
  const allErrors = [];

  for (const sheet of HOJAS) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    try {
      const resp = await fetch(url, { redirect: 'follow' });
      if (!resp.ok) {
        resultados.push({ sheet, status: 'skipped', http: resp.status });
        continue;
      }
      const csvText = await resp.text();
      // Google a veces regresa HTML de error con HTTP 200 cuando la hoja no existe
      if (csvText.startsWith('<') || csvText.length < 50) {
        resultados.push({ sheet, status: 'empty_or_missing' });
        continue;
      }
      const rawRows = parseCSV(csvText);
      if (rawRows.length < 2) {
        resultados.push({ sheet, status: 'empty', rows: 0 });
        continue;
      }
      const rows = transformEmbarques(rawRows);
      if (rows.length === 0) {
        resultados.push({ sheet, status: 'no_valid_rows', parsed: rawRows.length - 1 });
        continue;
      }
      const result = await upsertChunks(rows);
      totalParsed += rawRows.length - 1;
      totalValid += rows.length;
      totalUpserted += result.ok;
      totalFail += result.fail;
      if (result.errors.length) allErrors.push({ sheet, errors: result.errors.slice(0, 2) });
      resultados.push({
        sheet,
        status: 'ok',
        parsed: rawRows.length - 1,
        valid: rows.length,
        upserted: result.ok,
        failed: result.fail,
      });
    } catch (e) {
      resultados.push({ sheet, status: 'error', err: String(e?.message || e).slice(0, 200) });
    }
  }

  return {
    ok: totalFail === 0,
    rows_parsed: totalParsed,
    rows_valid: totalValid,
    upserted: totalUpserted,
    failed: totalFail,
    sheets: resultados,
    errors: allErrors.slice(0, 3),
  };
}

async function taskActualizarFillRates() {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/actualizar_fill_rate_todas`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: 'Bearer ' + SRK,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!r.ok) return { error: (await r.text()).slice(0, 500), status: 502 };
  const rows = await r.json();
  const totalSkus = rows.reduce((a, x) => a + (x.skus_actualizados || 0), 0);
  return {
    ok: true,
    ocs_procesadas: rows.length,
    skus_actualizados: totalSkus,
  };
}

// ═════════════════════ Handler ═════════════════════
// ═════════════════════════════════════════════════════════════════
// TASK: recordatorio-eval
// Corre diario a las 9 AM CDMX. Envía email a Fernando + Karolina el
// día 1 (primer aviso) y día 3 (vence hoy) del mes, si la evaluación
// del mes anterior no está cerrada.
// ═════════════════════════════════════════════════════════════════
async function taskRecordatorioEvaluacion() {
  // Fecha actual en CDMX
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const dia = hoy.getDate();

  // Solo enviamos día 1 y día 3
  if (dia !== 1 && dia !== 3) {
    return { skip: `Hoy es día ${dia}, solo enviamos día 1 y 3` };
  }

  // Mes a evaluar = mes anterior
  const anioEval = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  const mesEval  = hoy.getMonth() === 0 ? 12 : hoy.getMonth(); // getMonth es 0-11, mes 1-12
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // 1. Buscar usuarios internos con evaluación (Karolina)
  const perfRes = await fetch(`${SB_URL}/rest/v1/perfiles?select=user_id,nombre,email,rol,tipo&tipo=eq.interno&rol=neq.super_admin`, {
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
  });
  const perfiles = await perfRes.json();
  if (!Array.isArray(perfiles) || perfiles.length === 0) {
    return { skip: 'No hay usuarios internos con evaluación' };
  }

  // 2. Chequear cuáles NO tienen evaluación cerrada del mes anterior
  const pendientes = [];
  for (const p of perfiles) {
    const evRes = await fetch(
      `${SB_URL}/rest/v1/evaluaciones_mensuales?select=id,cerrada&user_id=eq.${p.user_id}&anio=eq.${anioEval}&mes=eq.${mesEval}`,
      { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }
    );
    const evs = await evRes.json();
    const cerrada = evs?.[0]?.cerrada === true;
    if (!cerrada) pendientes.push(p);
  }

  if (pendientes.length === 0) {
    return { skip: 'Todas las evaluaciones del mes anterior ya están cerradas' };
  }

  // 3. Enviar email
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const TO_FERNANDO = process.env.SMTP_TO_FERNANDO || 'fernando.cabrera@acteck.com';
  const TO_KAROLINA = process.env.SMTP_TO_KAROLINA || 'karolina.veliz@acteck.com';
  if (!SMTP_USER || !SMTP_PASS) {
    return { error: 'SMTP_USER y SMTP_PASS no configurados en Vercel env vars' };
  }

  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, '') },
  });

  const enviados = [];
  for (const p of pendientes) {
    const esDia1 = dia === 1;
    const asunto = esDia1
      ? `⏰ Pendiente evaluar a ${p.nombre} · ${MESES[mesEval - 1]} ${anioEval}`
      : `⚠️ Vence HOY · Evaluación ${p.nombre} · ${MESES[mesEval - 1]} ${anioEval}`;

    // Facturación del mes para dato rápido
    let factTotal = 0;
    try {
      const fRes = await fetch(
        `${SB_URL}/rest/v1/facturacion_clientes?select=monto&anio=eq.${anioEval}&mes=eq.${mesEval}&cliente_key=in.(digitalife,pcel,dicotech)`,
        { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }
      );
      const f = await fRes.json();
      factTotal = (f || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
    } catch {}

    const bonoBase = Math.max(3000, factTotal * 0.0004);
    const fmtMX = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

    const cuerpo = esDia1
      ? `Fernando,

Es día 1 y ya cerró ${MESES[mesEval - 1].toLowerCase()}. Toca cerrar la evaluación
de ${p.nombre} y pagar el bono antes del día 3.

Datos rápidos del mes:
· Facturación total:  ${fmtMX(factTotal)}
· Bono base calc.:    ${fmtMX(bonoBase)}

Ajusta ratings, tareas y ajustes en el dashboard:
https://acteck-dashboard.vercel.app/  → Administración Interna → Actividad del equipo

— Dashboard Acteck`
      : `Fernando,

⚠️ Recordatorio · HOY vence la evaluación de ${p.nombre}
de ${MESES[mesEval - 1].toLowerCase()} ${anioEval}. Si no cierras hoy, el bono
queda sin pagar en la fecha acordada.

Datos rápidos:
· Facturación total:  ${fmtMX(factTotal)}
· Bono base calc.:    ${fmtMX(bonoBase)}

Ciérrala ya:
https://acteck-dashboard.vercel.app/  → Administración Interna → Actividad del equipo

— Dashboard Acteck`;

    try {
      const info = await transporter.sendMail({
        from: `"Dashboard Acteck" <${SMTP_USER}>`,
        to: [TO_FERNANDO, TO_KAROLINA].join(','),
        subject: asunto,
        text: cuerpo,
      });
      enviados.push({ para: p.nombre, msg_id: info.messageId, dia });
    } catch (e) {
      enviados.push({ para: p.nombre, error: e.message });
    }
  }

  return { dia, mesEval, anioEval, pendientes: pendientes.length, enviados };
}

// ═════════════════════ TASK · Forecast avisos de arribo ════════════════════════
// Corre diario. Toma forecast_avisos con fecha_disparo <= hoy y sin
// email_enviado_at. Manda mail a Fernando + Karolina con los avisos del día
// (agrupados en un solo email por batch) y marca email_enviado_at.
// ══════════════════════════════════════════════════════════════════════════════
async function taskForecastAvisos() {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const hoyISO = hoy.toISOString().slice(0, 10);

  // Cargar avisos disparados sin email enviado
  const avRes = await fetch(
    `${SB_URL}/rest/v1/forecast_avisos?select=id,linea_id,propuesta_id,tipo,fecha_disparo,fecha_arribo,piezas_a_reservar&fecha_disparo=lte.${hoyISO}&email_enviado_at=is.null&order=fecha_arribo.asc`,
    { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }
  );
  const avisos = await avRes.json();
  if (!Array.isArray(avisos) || avisos.length === 0) {
    return { skip: 'No hay avisos pendientes de enviar', hoy: hoyISO };
  }

  // Enriquecer con datos del SKU y propuesta
  const lineIds = [...new Set(avisos.map(a => a.linea_id))];
  const propIds = [...new Set(avisos.map(a => a.propuesta_id))];
  const [linRes, propRes] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/forecast_propuesta_lineas?select=id,sku,descripcion,marca,reservo&id=in.(${lineIds.join(',')})`, { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }),
    fetch(`${SB_URL}/rest/v1/forecast_propuestas?select=id,nombre&id=in.(${propIds.join(',')})`, { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }),
  ]);
  const lineas = await linRes.json();
  const propuestas = await propRes.json();
  const lineaById = Object.fromEntries((lineas || []).map(l => [l.id, l]));
  const propById  = Object.fromEntries((propuestas || []).map(p => [p.id, p]));

  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const TO_FERNANDO = process.env.SMTP_TO_FERNANDO || 'fernando.cabrera@acteck.com';
  const TO_KAROLINA = process.env.SMTP_TO_KAROLINA || 'karolina.veliz@acteck.com';
  if (!SMTP_USER || !SMTP_PASS) {
    // Sin SMTP: marcamos los avisos igualmente para que no se acumulen
    // (Fernando los sigue viendo en el panel del dashboard).
    return { skip: 'SMTP_USER/SMTP_PASS no configurados — avisos NO marcados como enviados', avisos: avisos.length };
  }

  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, '') },
  });

  const fmtN = (n) => new Intl.NumberFormat('es-MX').format(Math.round(Number(n) || 0));
  const fmtF = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d} ${M[m - 1]} ${y}`;
  };

  // Partir avisos en dos grupos: HOY (dia) y anticipo (3dias)
  const hoyAvisos = avisos.filter(a => a.tipo === 'dia');
  const anticipoAvisos = avisos.filter(a => a.tipo === '3dias');

  const rowsHtml = (arr) => arr.map(a => {
    const l = lineaById[a.linea_id] || {};
    const p = propById[a.propuesta_id] || {};
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #EEE;font-family:monospace;color:#007AFF;font-weight:600">${l.sku || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #EEE">${(l.descripcion || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #EEE;text-align:right;font-family:monospace;font-weight:700">${fmtN(a.piezas_a_reservar)} pz</td>
      <td style="padding:8px 12px;border-bottom:1px solid #EEE;color:#666">${fmtF(a.fecha_arribo)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #EEE;color:#888;font-size:11px">${(p.nombre || '')}</td>
    </tr>`;
  }).join('');

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#111">
    <h1 style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin:0 0 4px">🔔 Avisos de arribo · Forecast</h1>
    <p style="font-size:13px;color:#666;margin:0 0 20px">${fmtF(hoyISO)} · ${avisos.length} aviso${avisos.length === 1 ? '' : 's'} pendiente${avisos.length === 1 ? '' : 's'}</p>

    ${hoyAvisos.length > 0 ? `
    <h2 style="font-size:14px;font-weight:700;color:#FF3B30;margin:16px 0 8px;letter-spacing:0.02em;text-transform:uppercase">🚨 Arriban HOY · ${hoyAvisos.length}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;background:#FDF3F2;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead><tr>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#FBECEA">SKU</th>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#FBECEA">Descripción</th>
        <th style="padding:8px 12px;text-align:right;font-size:10.5px;color:#888;font-weight:600;background:#FBECEA">Reservar</th>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#FBECEA">Arribo</th>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#FBECEA">Propuesta</th>
      </tr></thead>
      <tbody>${rowsHtml(hoyAvisos)}</tbody>
    </table>` : ''}

    ${anticipoAvisos.length > 0 ? `
    <h2 style="font-size:14px;font-weight:700;color:#007AFF;margin:16px 0 8px;letter-spacing:0.02em;text-transform:uppercase">📅 Arriban en 3 días · ${anticipoAvisos.length}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;background:#F3F7FF;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead><tr>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#E7EEFF">SKU</th>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#E7EEFF">Descripción</th>
        <th style="padding:8px 12px;text-align:right;font-size:10.5px;color:#888;font-weight:600;background:#E7EEFF">Reservar</th>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#E7EEFF">Arribo</th>
        <th style="padding:8px 12px;text-align:left;font-size:10.5px;color:#888;font-weight:600;background:#E7EEFF">Propuesta</th>
      </tr></thead>
      <tbody>${rowsHtml(anticipoAvisos)}</tbody>
    </table>` : ''}

    <p style="font-size:12px;color:#666;margin:24px 0 8px">
      Marca como visto y ejecuta las reservas en:<br>
      <a href="https://acteck-dashboard.vercel.app/" style="color:#007AFF;text-decoration:none;font-weight:600">Dashboard → Interno → Forecast → Propuestas</a>
    </p>
    <p style="font-size:10.5px;color:#AAA;margin-top:24px">Este correo se genera automáticamente por el cron diario de Forecast · Dashboard Acteck</p>
  </div>`;

  const texto = `Avisos de arribo · ${fmtF(hoyISO)}\n\n` +
    (hoyAvisos.length > 0 ? `ARRIBAN HOY (${hoyAvisos.length}):\n` + hoyAvisos.map(a => {
      const l = lineaById[a.linea_id] || {}; const p = propById[a.propuesta_id] || {};
      return `  · ${l.sku} — ${l.descripcion} — reservar ${fmtN(a.piezas_a_reservar)} pz · ${p.nombre}`;
    }).join('\n') + '\n\n' : '') +
    (anticipoAvisos.length > 0 ? `ARRIBAN EN 3 DÍAS (${anticipoAvisos.length}):\n` + anticipoAvisos.map(a => {
      const l = lineaById[a.linea_id] || {}; const p = propById[a.propuesta_id] || {};
      return `  · ${l.sku} — ${l.descripcion} — reservar ${fmtN(a.piezas_a_reservar)} pz · ${p.nombre} · arribo ${fmtF(a.fecha_arribo)}`;
    }).join('\n') + '\n\n' : '') +
    `Marca como visto y ejecuta las reservas: https://acteck-dashboard.vercel.app/`;

  const subject = hoyAvisos.length > 0
    ? `🚨 ${hoyAvisos.length} SKU${hoyAvisos.length === 1 ? '' : 's'} arriban HOY · Forecast`
    : `📅 ${anticipoAvisos.length} SKU${anticipoAvisos.length === 1 ? '' : 's'} arriban en 3 días · Forecast`;

  try {
    const info = await transporter.sendMail({
      from: `"Dashboard Acteck · Forecast" <${SMTP_USER}>`,
      to: [TO_FERNANDO, TO_KAROLINA].join(','),
      subject,
      text: texto,
      html,
    });
    // Marcar todos los avisos como enviados
    const ids = avisos.map(a => a.id);
    await fetch(
      `${SB_URL}/rest/v1/forecast_avisos?id=in.(${ids.join(',')})`,
      { method: 'PATCH', headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ email_enviado_at: new Date().toISOString() }) }
    );
    return { enviados: avisos.length, hoy_arriban: hoyAvisos.length, anticipo_3dias: anticipoAvisos.length, msg_id: info.messageId, to: [TO_FERNANDO, TO_KAROLINA] };
  } catch (e) {
    return { error: e.message, avisos: avisos.length };
  }
}

// ═════════════════════ TASK · Recordatorio tracking pedidos ═════════════════════
// Detecta OCs abiertas cuyo updated_at es > 24h y le manda email a Karolina
// (con Cc a Fernando) listando cuántas necesitan atención.
async function taskRecordatorioTracking() {
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  // 1. OCs desactualizadas > 24h (sin importar estado por ahora)
  const ocRes = await fetch(
    `${SB_URL}/rest/v1/oc_clientes?select=id,cliente_key,numero_oc,numero_oc_cliente,fecha_recibida,updated_at,monto_total&updated_at=lt.${cutoffIso}&order=updated_at.asc`,
    { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }
  );
  const ocs = await ocRes.json();
  if (!Array.isArray(ocs) || ocs.length === 0) {
    return { skip: 'No hay OCs desactualizadas', cutoff: cutoffIso };
  }

  // 2. Envíos para saber cuáles OCs ya están 100% entregadas (esas no cuentan)
  const ids = ocs.map((o) => o.id);
  const envRes = await fetch(
    `${SB_URL}/rest/v1/oc_envios?select=oc_id,fecha_entregada&oc_id=in.(${ids.join(',')})`,
    { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }
  );
  const envios = await envRes.json();
  const envPorOc = {};
  for (const e of (envios || [])) {
    if (!envPorOc[e.oc_id]) envPorOc[e.oc_id] = [];
    envPorOc[e.oc_id].push(e);
  }

  const pendientes = ocs.filter((oc) => {
    const evs = envPorOc[oc.id] || [];
    // Se considera "pendiente" si no tiene envíos O algún envío no tiene fecha_entregada
    if (evs.length === 0) return true;
    return evs.some((e) => !e.fecha_entregada);
  });

  if (pendientes.length === 0) {
    return { skip: 'Todas las desactualizadas ya están entregadas', total: ocs.length };
  }

  // 3. Enviar email
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const TO_KAROLINA = process.env.SMTP_TO_KAROLINA || 'karolina.veliz@acteck.com';
  const CC_FERNANDO = process.env.SMTP_TO_FERNANDO || 'fernando.cabrera@acteck.com';
  if (!SMTP_USER || !SMTP_PASS) {
    return { error: 'SMTP_USER y SMTP_PASS no configurados', pendientes: pendientes.length };
  }

  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, '') },
  });

  const NOMBRE = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
  const fmtMX = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
  const diasSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  const lista = pendientes.slice(0, 20).map((oc) => {
    const d = diasSince(oc.updated_at);
    return `  · ${(NOMBRE[oc.cliente_key] || oc.cliente_key).padEnd(11)} ${(oc.numero_oc || '—').padEnd(14)} · sin update hace ${d}d · ${fmtMX(oc.monto_total)}`;
  }).join('\n');
  const extra = pendientes.length > 20 ? `\n  ... y ${pendientes.length - 20} más` : '';

  const asunto = `⏰ ${pendientes.length} OC${pendientes.length === 1 ? '' : 's'} de tracking sin actualizar +1 día`;
  const cuerpo = `Karolina,

Estas OCs del Tracking Pedidos llevan más de 24h sin cambios en el dashboard.
Revisa si alguna ya avanzó y actualiza la fecha correspondiente (factura, envío, entrega):

${lista}${extra}

Total: ${pendientes.length} pendientes.

Entra al dashboard:
https://acteck-dashboard.vercel.app/  →  Comercial  →  Tracking Pedidos

— Dashboard Acteck (recordatorio automático)`;

  try {
    const info = await transporter.sendMail({
      from: `"Dashboard Acteck" <${SMTP_USER}>`,
      to: TO_KAROLINA,
      cc: CC_FERNANDO,
      subject: asunto,
      text: cuerpo,
    });
    return { pendientes: pendientes.length, msg_id: info.messageId, muestra: pendientes.slice(0, 5).map((o) => o.numero_oc) };
  } catch (e) {
    return { error: e.message, pendientes: pendientes.length };
  }
}

export default async function handler(req, res) {
  // CRON_SECRET es OBLIGATORIO. Si no está configurado, el endpoint rechaza todo.
  // Vercel Cron manda `authorization: Bearer <CRON_SECRET>` automáticamente
  // cuando la env var está seteada en el proyecto.
  if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET no configurada — endpoint deshabilitado' });
  const got = req.headers.authorization?.replace(/^Bearer\s+/, '') || req.headers['x-cron-secret'];
  if (got !== process.env.CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' });

  const task = req.query?.task || (req.url?.split('?')[1] || '').split('&').find((p) => p.startsWith('task='))?.slice(5);

  try {
    let result;
    if (task === 'sync-master-embarques') {
      result = await taskSyncMasterEmbarques();
    } else if (task === 'actualizar-fill-rates') {
      result = await taskActualizarFillRates();
    } else if (task === 'recordatorio-eval') {
      result = await taskRecordatorioEvaluacion();
    } else if (task === 'recordatorio-tracking') {
      result = await taskRecordatorioTracking();
    } else if (task === 'forecast-avisos') {
      result = await taskForecastAvisos();
    } else {
      return res.status(400).json({
        error: 'task inválido',
        usage: 'GET /api/cron?task=sync-master-embarques | actualizar-fill-rates | recordatorio-eval | recordatorio-tracking | forecast-avisos',
      });
    }
    if (result.status && result.error) return res.status(result.status).json(result);
    return res.status(200).json({ ...result, ts: new Date().toISOString(), task });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message, task });
  }
}
