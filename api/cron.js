// api/cron.js
// Endpoint unificado para cron jobs. Vercel Hobby limita a 12 funciones,
// así que consolido todos los cron en uno solo con ?task=xxx.
//
// Tareas:
//   ?task=sync-master-embarques  → descarga Google Sheet y upserta a embarques_compras
//   ?task=actualizar-fill-rates  → cruza OCs activas con ventas_erp
//   ?task=generar-alertas        → bandeja "qué atender hoy" (tabla alertas). Al final
//                                  manda por correo las críticas nuevas (salvo dryRun).
//   ?task=resumen-programado     → correo-resumen por usuario (perfiles.preferencias.notif)
//                                  con las alertas activas no críticas de las áreas en modo
//                                  'resumen' + críticas nuevas inmediatas. RESUMEN_DRY_RUN=1
//                                  (o ?dryRun=1) devuelve el HTML/JSON sin enviar.
//
// ENV:
//   SUPABASE_SERVICE_ROLE_KEY
//   MASTER_EMBARQUES_SHEET_ID    (solo para sync)
//   MASTER_EMBARQUES_SHEET_NAME  (opcional, default año actual)
//   CRON_SECRET                  (opcional, si está valida header)
//   RESUMEN_DRY_RUN=1            (no enviar correos en resumen-programado / críticas)

// PostgREST exige que todas las filas de un POST masivo traigan las MISMAS llaves.
function normalizarFilasAlertas(rows) {
  const llaves = new Set(); rows.forEach((r) => Object.keys(r).forEach((k) => llaves.add(k)));
  const ks = [...llaves];
  return rows.map((r) => Object.fromEntries(ks.map((k) => [k, r[k] === undefined ? null : r[k]])));
}

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHEET_ID   = process.env.MASTER_EMBARQUES_SHEET_ID;
const SHEET_NAME = process.env.MASTER_EMBARQUES_SHEET_NAME || String(new Date().getFullYear());

// Helpers de parseo/transformación compartidos con el puente (bridge/).
import { parseCSV, transformEmbarques, HOJAS_HISTORICAS, anioDeHoja } from './_embarques.js';
// Tracking Pedidos V3: la misma lógica pura que usa la pantalla (etapas derivadas, backorder, facturas sin OC).
import { calcularTodo, backorderPorSku, facturasSinOC } from '../src/modules/comercial/tracking/calculo.js';
import { ETAPA_LABEL as ETAPA_LABEL_TRACKING, DIAS_DETENIDA } from '../src/modules/comercial/tracking/textos.js';

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
  const HOJAS = HOJAS_HISTORICAS;
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
      const rows = transformEmbarques(rawRows, { anioDefault: anioDeHoja(sheet) });
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
// Desde 2026-09-11 la detección vive en `ocsTrackingPendientes()` y también
// alimenta la alerta `oc_sin_actualizar` (área operacion) del centro de
// notificaciones. Esta task se conserva por compatibilidad, pero si ya existe
// una alerta activa de ese tipo NO manda su propio correo: el aviso llega por
// el centro (campana) y por el resumen programado. Se puede retirar del
// vercel.json cuando Karolina confirme que le basta con el centro.
async function ocsTrackingPendientes() {
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  // 1. OCs desactualizadas > 24h (sin importar estado por ahora)
  const ocRes = await fetch(
    `${SB_URL}/rest/v1/oc_clientes?select=id,cliente_key,numero_oc,numero_oc_cliente,fecha_recibida,updated_at&updated_at=lt.${cutoffIso}&order=updated_at.asc`,
    { headers: { apikey: SRK, Authorization: 'Bearer ' + SRK } }
  );
  const ocs = await ocRes.json();
  // (oc_clientes no tiene monto_total; el select anterior lo pedía y PostgREST
  // devolvía error → la task vieja siempre hacía skip.)
  if (!Array.isArray(ocs)) throw new Error(`oc_clientes → ${JSON.stringify(ocs).slice(0, 200)}`);
  if (ocs.length === 0) return { pendientes: [], total: 0, cutoffIso };

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

  return { pendientes, total: ocs.length, cutoffIso };
}

async function taskRecordatorioTracking() {
  const { pendientes, total, cutoffIso } = await ocsTrackingPendientes();
  if (total === 0) return { skip: 'No hay OCs desactualizadas', cutoff: cutoffIso };
  if (pendientes.length === 0) {
    return { skip: 'Todas las desactualizadas ya están entregadas', total };
  }

  // 2b. Si el centro de notificaciones ya tiene la alerta activa, no duplicar correo.
  try {
    const r = await fetch(`${SB_URL}/rest/v1/alertas?select=id&tipo=eq.oc_sin_actualizar&resuelta_at=is.null&limit=1`, { headers: SB_HEADERS() });
    const activas = r.ok ? await r.json() : [];
    if (Array.isArray(activas) && activas.length) {
      return { skip: 'Alerta oc_sin_actualizar activa en el centro de notificaciones; no se manda correo aparte', pendientes: pendientes.length };
    }
  } catch { /* si falla la consulta, se manda el correo como antes */ }

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
  const diasSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  const lista = pendientes.slice(0, 20).map((oc) => {
    const d = diasSince(oc.updated_at);
    return `  · ${(NOMBRE[oc.cliente_key] || oc.cliente_key).padEnd(11)} ${(oc.numero_oc || oc.numero_oc_cliente || '—').padEnd(14)} · sin update hace ${d}d`;
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

// ═════════════════════ TASK · Generar alertas ("qué atender hoy") ══════════════
// Corre diario (13:00 UTC). Evalúa reglas sobre las vistas/tablas de datos y
// mantiene la tabla `alertas`:
//   · upsert por `clave` (hash estable tipo|cliente|sku|periodo) → no duplica
//   · alertas activas cuyo tipo se evaluó y cuya condición ya no se cumple →
//     resuelta_at = now(), resuelta_por = 'sistema'
//   · alertas resueltas por 'sistema' (o por un usuario hace > 36 h sin que la
//     condición se volviera a ver) se reabren si la condición reaparece.
// Cada regla es una función independiente y tolerante a datos faltantes: si
// una falla, las demás siguen y el error se reporta en `errores`.
// ══════════════════════════════════════════════════════════════════════════════
const SB_HEADERS = () => ({ apikey: SRK, Authorization: 'Bearer ' + SRK });
const CLIENTES_CUOTA = ['digitalife', 'pcel', 'dicotech'];
const NOMBRE_CLIENTE = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech', mayoreo: 'Mayoreo', distribuidor: 'Distribuidor', e_commerce: 'E-commerce', mostrador: 'Mostrador', retail_propios: 'Retail propios', retail_representados: 'Retail representados', otros: 'Otros' };
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fmtMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtN = (n) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(n) || 0);
const nombreCliente = (k) => NOMBRE_CLIENTE[k] || k;

async function sbGetAll(path, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { ...SB_HEADERS(), Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${path.split('?')[0]} → HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error(`${path.split('?')[0]} → respuesta no es array`);
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function hoyCDMX() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const anio = d.getFullYear(), mes = d.getMonth() + 1, dia = d.getDate();
  // iso se arma a mano: toISOString() convertiría a UTC y podría mover el día.
  return { d, anio, mes, dia, iso: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` };
}
function mesAnterior(anio, mes, n = 1) {
  let a = anio, m = mes;
  for (let i = 0; i < n; i++) { if (m === 1) { m = 12; a -= 1; } else m -= 1; }
  return { anio: a, mes: m };
}
function diasEnMes(anio, mes) { return new Date(anio, mes, 0).getDate(); }
function periodoLbl(anio, mes) { return `${MESES_CORTO[mes - 1]} ${anio}`; }
// Filtro PostgREST para varios (anio, mes)
function filtroMeses(pares) {
  return `or=(${pares.map(({ anio, mes }) => `and(anio.eq.${anio},mes.eq.${mes})`).join(',')})`;
}

// ─── a. stock_vs_transito ───
// Cobertura (días) = stock comercial ÷ promedio diario de piezas facturadas en
// los 3 meses cerrados previos (facturacion_clientes). Alerta cuando la
// cobertura es menor a los días que faltan para la primera PO en tránsito.
const MIN_PZ_DIA = 0.1;
async function reglaStockVsTransito(hoy) {
  const meses = [1, 2, 3].map((n) => mesAnterior(hoy.anio, hoy.mes, n));
  const dias = meses.reduce((s, { anio, mes }) => s + diasEnMes(anio, mes), 0);
  const [fact, inv, tra] = await Promise.all([
    sbGetAll(`facturacion_clientes?select=sku,piezas&${filtroMeses(meses)}`, 5000),
    sbGetAll('v_inventario_comercial?select=sku,disponible', 5000),
    sbGetAll('v_transito_sku?select=sku,cantidad,eta_mas_cercana,embarques,embarques_detalle&cantidad=gt.0', 2000),
  ]);
  const piezas = new Map();
  for (const f of fact) {
    const p = Number(f.piezas) || 0;
    if (p > 0 && f.sku) piezas.set(f.sku, (piezas.get(f.sku) || 0) + p);
  }
  const stock = new Map(inv.map((r) => [r.sku, Number(r.disponible) || 0]));
  const hoyMs = Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia);
  const out = [];
  for (const t of tra) {
    const vendidas = piezas.get(t.sku) || 0;
    const promDiario = vendidas / dias;
    if (promDiario < MIN_PZ_DIA) continue;                // sólo SKUs con venta real (≥ ~9 pz en 3 meses)
    const disp = stock.get(t.sku) || 0;
    const cobertura = disp / promDiario;
    const eta = t.eta_mas_cercana ? Date.UTC(...t.eta_mas_cercana.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x)))) : null;
    const diasLlegada = eta == null ? null : Math.max(0, Math.round((eta - hoyMs) / 86400000));
    if (diasLlegada == null || cobertura >= diasLlegada || cobertura >= 15) continue;
    const severidad = cobertura < 7 ? 'critica' : 'alta';
    const primerPO = Array.isArray(t.embarques_detalle) ? t.embarques_detalle.slice().sort((a, b) => String(a.eta || '').localeCompare(String(b.eta || '')))[0] : null;
    out.push({
      tipo: 'stock_vs_transito', severidad,
      clave: `stock_vs_transito|${t.sku}`,
      titulo: `${t.sku}: stock para ${cobertura.toFixed(1)} días, PO llega en ${diasLlegada}`,
      detalle: `${fmtN(disp)} pz disponibles · vende ${promDiario.toFixed(1)} pz/día · ${fmtN(t.cantidad)} pz en tránsito (${primerPO?.po || '—'}, ETA ${t.eta_mas_cercana}).`,
      cliente_key: null, sku: t.sku,
      area: 'inventario',
      accion: { tipo: 'navegar', clienteKey: null, pagina: 'inventarioGlobal', label: 'Ver inventario' },
      caduca_at: t.eta_mas_cercana ? new Date(eta + 2 * 86400000).toISOString() : null, // 2 días tras la ETA ya no aplica
      valor: Number(cobertura.toFixed(1)),
      meta: { cobertura_dias: Number(cobertura.toFixed(1)), dias_llegada: diasLlegada, stock: disp, prom_diario: Number(promDiario.toFixed(2)), transito_qty: t.cantidad, eta: t.eta_mas_cercana, po: primerPO?.po || null, estatus_po: primerPO?.estatus || null, ventana_meses: meses.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`) },
    });
  }
  return out;
}

// ─── b. cuota_en_riesgo ───
// A partir del día 10: facturado MTD ÷ (cuota_ideal × día/díasMes) < 0.85 → alta; < 0.60 → crítica.
async function reglaCuotaEnRiesgo(hoy) {
  if (hoy.dia < 10) return [];
  const [cuotas, fact] = await Promise.all([
    sbGetAll(`cuotas_mensuales?select=cliente,cuota_min,cuota_ideal&anio=eq.${hoy.anio}&mes=eq.${hoy.mes}&cliente=in.(${CLIENTES_CUOTA.join(',')})`),
    sbGetAll(`v_fact_cliente_mes?select=cliente_key,monto&anio=eq.${hoy.anio}&mes=eq.${hoy.mes}&cliente_key=in.(${CLIENTES_CUOTA.join(',')})`),
  ]);
  const mtd = new Map(fact.map((r) => [r.cliente_key, Number(r.monto) || 0]));
  const diasMes = diasEnMes(hoy.anio, hoy.mes);
  const out = [];
  for (const c of cuotas) {
    const ideal = Number(c.cuota_ideal) || Number(c.cuota_min) || 0;
    if (ideal <= 0) continue;
    const esperado = ideal * (hoy.dia / diasMes);
    const facturado = mtd.get(c.cliente) || 0;
    const ritmo = facturado / esperado;
    if (ritmo >= 0.85) continue;
    const severidad = ritmo < 0.6 ? 'critica' : 'alta';
    const proyeccion = facturado / hoy.dia * diasMes;
    out.push({
      tipo: 'cuota_en_riesgo', severidad,
      clave: `cuota_en_riesgo|${c.cliente}|${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`,
      titulo: `${nombreCliente(c.cliente)} va al ${Math.round(ritmo * 100)} % del ritmo de cuota`,
      detalle: `${fmtMXN(facturado)} facturado al día ${hoy.dia} vs ${fmtMXN(esperado)} esperado · cuota ideal ${fmtMXN(ideal)} · proyección ${fmtMXN(proyeccion)}.`,
      cliente_key: c.cliente, sku: null,
      area: 'ventas',
      accion: { tipo: 'navegar', clienteKey: c.cliente, pagina: 'sellIn', label: 'Ver sell-in' },
      caduca_at: new Date(Date.UTC(hoy.anio, hoy.mes, 1, 6)).toISOString(), // cierre de mes (00:00 CDMX del día 1)
      valor: Number((ritmo * 100).toFixed(1)),
      meta: { anio: hoy.anio, mes: hoy.mes, dia: hoy.dia, facturado_mtd: Math.round(facturado), esperado_mtd: Math.round(esperado), cuota_ideal: Math.round(ideal), cuota_min: Math.round(Number(c.cuota_min) || 0), proyeccion: Math.round(proyeccion), ritmo_pct: Number((ritmo * 100).toFixed(1)) },
    });
  }
  return out;
}

// ─── c. devoluciones_anormales ───
// Mes cerrado más reciente por cliente_key: (devoluciones + rmas) ÷ fact_bruta
// > 2× su promedio (ponderado) de los 6 meses previos y > 2 %.
async function reglaDevolucionesAnormales(hoy) {
  const cerrado = mesAnterior(hoy.anio, hoy.mes, 1);
  const previos = [2, 3, 4, 5, 6, 7].map((n) => mesAnterior(hoy.anio, hoy.mes, n));
  const rows = await sbGetAll(`v_erp_medidas_cliente_mes?select=anio,mes,cliente_key,fact_bruta,devoluciones,rmas&${filtroMeses([cerrado, ...previos])}`, 5000);
  const porCliente = new Map();
  for (const r of rows) {
    if (!r.cliente_key) continue;
    const e = porCliente.get(r.cliente_key) || { actual: null, prevBruta: 0, prevDev: 0, prevMeses: 0 };
    const bruta = Number(r.fact_bruta) || 0;
    const dev = Math.abs(Number(r.devoluciones) || 0) + Math.abs(Number(r.rmas) || 0);
    if (r.anio === cerrado.anio && r.mes === cerrado.mes) e.actual = { bruta, dev };
    else { e.prevBruta += bruta; e.prevDev += dev; e.prevMeses += 1; }
    porCliente.set(r.cliente_key, e);
  }
  const out = [];
  for (const [ck, e] of porCliente) {
    if (!e.actual || e.actual.bruta <= 0 || e.prevMeses < 3 || e.prevBruta <= 0) continue;
    const ratio = e.actual.dev / e.actual.bruta;
    const base = e.prevDev / e.prevBruta;
    if (ratio <= 0.02 || ratio <= 2 * base) continue;
    const severidad = ratio > 0.05 || ratio > 4 * base ? 'alta' : 'media';
    out.push({
      tipo: 'devoluciones_anormales', severidad,
      clave: `devoluciones_anormales|${ck}|${cerrado.anio}-${String(cerrado.mes).padStart(2, '0')}`,
      titulo: `${nombreCliente(ck)}: devoluciones + RMA al ${(ratio * 100).toFixed(1)} % en ${periodoLbl(cerrado.anio, cerrado.mes)}`,
      detalle: `${fmtMXN(e.actual.dev)} sobre ${fmtMXN(e.actual.bruta)} de fact. bruta · promedio 6 meses previos ${(base * 100).toFixed(1)} % (${(base > 0 ? ratio / base : 0).toFixed(1)}×).`,
      cliente_key: ck, sku: null,
      area: 'ventas',
      accion: { tipo: 'navegar', clienteKey: CLIENTES_CUOTA.includes(ck) ? ck : null, pagina: 'sellIn', label: 'Ver sell-in' },
      caduca_at: null,
      valor: Number((ratio * 100).toFixed(2)),
      meta: { anio: cerrado.anio, mes: cerrado.mes, fact_bruta: Math.round(e.actual.bruta), devoluciones_rmas: Math.round(e.actual.dev), ratio_pct: Number((ratio * 100).toFixed(2)), base_pct: Number((base * 100).toFixed(2)), veces: Number((base > 0 ? ratio / base : 0).toFixed(1)), meses_base: e.prevMeses },
    });
  }
  return out;
}

// ─── d. rebate_por_generar ───
// Dicotech: rebate mensual (lineamientos_cliente.rebate.frecuencia = mensual).
// PagosCliente.generarRebateDicotech / marcarRebateDicotechNoAplica guardan en
// `pagos` con cliente='dicotech', categoria='rebate' y concepto
// 'Rebate MM <MesLargo> YYYY[ — override| — No aplica]'. Se revisan los 3 meses
// cerrados previos con sell-in > 0 que no tengan registro (de cualquier estatus).
async function reglaRebatePorGenerar(hoy) {
  const meses = [1, 2, 3].map((n) => mesAnterior(hoy.anio, hoy.mes, n));
  const [pagos, fact] = await Promise.all([
    sbGetAll(`pagos?select=concepto,estatus,monto&cliente=eq.dicotech&concepto=ilike.Rebate*`),
    sbGetAll(`v_fact_cliente_mes?select=anio,mes,monto&cliente_key=eq.dicotech&${filtroMeses(meses)}`),
  ]);
  const registrados = new Set();
  for (const p of pagos) {
    const m = String(p.concepto || '').match(/^Rebate\s+(\d{1,2})\s+\S+\s+(\d{4})/i);
    if (m) registrados.add(`${m[2]}-${String(Number(m[1])).padStart(2, '0')}`);
  }
  const sellIn = new Map(fact.map((r) => [`${r.anio}-${String(r.mes).padStart(2, '0')}`, Number(r.monto) || 0]));
  const out = [];
  for (const { anio, mes } of meses) {
    const key = `${anio}-${String(mes).padStart(2, '0')}`;
    const monto = sellIn.get(key) || 0;
    if (monto <= 0 || registrados.has(key)) continue;
    out.push({
      tipo: 'rebate_por_generar', severidad: 'info',
      clave: `rebate_por_generar|dicotech|${key}`,
      titulo: `Rebate Dicotech de ${MESES_LARGO[mes - 1]} ${anio} sin generar`,
      detalle: `Sell-in del mes ${fmtMXN(monto)} · no hay registro 'Rebate ${String(mes).padStart(2, '0')} ${MESES_LARGO[mes - 1]} ${anio}' en Pagos (ni generado ni "No aplica").`,
      cliente_key: 'dicotech', sku: null,
      area: 'pagos',
      accion: { tipo: 'navegar', clienteKey: 'dicotech', pagina: 'pagos', label: 'Generar' },
      caduca_at: null,
      valor: Math.round(monto),
      meta: { anio, mes, sell_in: Math.round(monto), concepto_esperado: `Rebate ${String(mes).padStart(2, '0')} ${MESES_LARGO[mes - 1]} ${anio}` },
    });
  }
  return out;
}

// ─── e. datos_sin_actualizar ───
// Lee v_fuentes_frescura (migración 20260911): una sola consulta con
// ultima_carga / periodo_max / filas / umbral_dias / estado / dias por fuente.
// Sólo se alertan fuentes que se cargan por uploads.html; las tablas que
// captura la propia app (sellout_sku, inventario_cliente, cuotas_mensuales,
// roadmap_sku) no aplican al mensaje "sube el archivo".
const FUENTES_UPLOAD = [
  'facturacion_clientes', 'erp_ventas', 'inventario_acteck', 'sellout_general', 'sellout_detalle',
  'sellout_pcel', 'precios_sku', 'compras_oc', 'embarques_compras', 'estados_cuenta', 'guias_erp',
  'programacion_arribos',
];
async function reglaDatosSinActualizar() {
  const filas = await sbGetAll(
    `v_fuentes_frescura?select=fuente,etiqueta,ultima_carga,periodo_max,filas,umbral_dias,estado,dias`
    + `&estado=eq.atrasada&fuente=in.(${FUENTES_UPLOAD.join(',')})`,
  );
  const out = [];
  for (const f of filas) {
    const dias = Number(f.dias);
    if (!f.ultima_carga || !Number.isFinite(dias)) continue;
    const ts = String(f.ultima_carga);
    out.push({
      tipo: 'datos_sin_actualizar', severidad: 'media',
      clave: `datos_sin_actualizar|${f.fuente}`,
      titulo: `${f.etiqueta} (${f.fuente}) lleva ${dias} días sin cargarse`,
      detalle: `Última carga ${ts.slice(0, 10)} · umbral ${f.umbral_dias} días`
        + (f.periodo_max ? ` · último periodo con datos ${f.periodo_max}` : '')
        + '. Sube el archivo en uploads.html.',
      cliente_key: null, sku: null,
      area: 'datos',
      accion: { tipo: 'navegar', clienteKey: null, pagina: 'actualizacion', label: 'Abrir importador' },
      caduca_at: null,
      valor: dias,
      meta: { fuente: f.fuente, ultima_carga: ts, umbral_dias: f.umbral_dias, dias, periodo_max: f.periodo_max || null, filas: f.filas ?? null },
    });
  }
  return out;
}


// ─── f. oc_sin_actualizar ───
// OCs del Tracking Pedidos con > 24 h sin cambios y no entregadas al 100 %
// (misma detección que taskRecordatorioTracking). Una alerta por cliente,
// agrupable, con la lista en meta.ocs. Área operacion, severidad media.
async function reglaOcSinActualizar() {
  const { pendientes } = await ocsTrackingPendientes();
  const porCliente = new Map();
  for (const oc of pendientes) {
    const k = oc.cliente_key || 'otros';
    if (!porCliente.has(k)) porCliente.set(k, []);
    porCliente.get(k).push(oc);
  }
  const out = [];
  for (const [ck, ocs] of porCliente) {
    ocs.sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));
    const masVieja = Math.floor((Date.now() - new Date(ocs[0].updated_at).getTime()) / 86400000);
    out.push({
      tipo: 'oc_sin_actualizar', severidad: 'media',
      clave: `oc_sin_actualizar|${ck}`,
      titulo: `${nombreCliente(ck)}: ${ocs.length} OC${ocs.length === 1 ? '' : 's'} de tracking sin actualizar +24 h`,
      detalle: `La más antigua lleva ${masVieja} d sin cambios. Revisa factura, envío o entrega en Tracking Pedidos.`,
      cliente_key: ck, sku: null,
      area: 'operacion',
      accion: { tipo: 'navegar', clienteKey: null, pagina: 'ordenesCompra', label: 'Ver tracking' },
      caduca_at: null,
      valor: ocs.length,
      meta: {
        total: ocs.length, dias_max: masVieja,
        ocs: ocs.slice(0, 50).map((o) => ({ id: o.id, oc: o.numero_oc || o.numero_oc_cliente || null, dias: Math.floor((Date.now() - new Date(o.updated_at).getTime()) / 86400000) })),
      },
    });
  }
  return out;
}

// ─── g. reserva_3dias / reserva_dia (Forecast › Reservas) ───
// Líneas de propuestas marcadas como Compradas con fecha de arribo estimada
// (forecast_propuesta_lineas.comprado_at + fecha_arribo_estimada). Sustituyen a
// forecast_avisos: una alerta 3 días antes del arribo (media) y otra el día del
// arribo (alta), área forecast. Cada tipo se evalúa por separado para que la de
// "3 días" se resuelva sola cuando llega el día; caduca_at = arribo + 3 d.
// Sólo el cron escribe en `alertas` (la app no tiene INSERT), por eso viven aquí.
async function reglaReservasArribo(hoy, tipo) {
  const lineas = await sbGetAll('forecast_propuesta_lineas?select=id,sku,descripcion,reservo,piezas_a_reservar_arribo,fecha_arribo_estimada,necesidad_dgl,necesidad_pce,necesidad_dct,estado,propuesta_id,forecast_propuestas(nombre,estatus)&comprado_at=not.is.null&fecha_arribo_estimada=not.is.null&estado=neq.arribado', 1000);
  const hoyMs = Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia);
  const out = [];
  for (const l of lineas) {
    const f = String(l.fecha_arribo_estimada).slice(0, 10);
    const [a, m, d] = f.split('-').map(Number);
    if (!a || !m || !d) continue;
    const arriboMs = Date.UTC(a, m - 1, d);
    const dias = Math.round((arriboMs - hoyMs) / 86400000);   // > 0 faltan días · 0 hoy · < 0 ya pasó
    const es3d = dias >= 1 && dias <= 3;
    const esDia = dias <= 0 && dias >= -3;
    if ((tipo === 'reserva_3dias' && !es3d) || (tipo === 'reserva_dia' && !esDia)) continue;
    const piezas = Number(l.piezas_a_reservar_arribo ?? l.reservo) || 0;
    const nec = { digitalife: Number(l.necesidad_dgl) || 0, pcel: Number(l.necesidad_pce) || 0, dicotech: Number(l.necesidad_dct) || 0 };
    const conNec = Object.entries(nec).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    const clienteKey = conNec.length === 1 ? conNec[0][0] : null;   // un solo cliente → alerta del cliente; varios → global
    const paraQuien = conNec.length ? conNec.map(([k]) => nombreCliente(k)).join(' · ') : 'clientes propios';
    const fArr = `${d} ${MESES_CORTO[m - 1]}`;
    out.push({
      tipo, severidad: tipo === 'reserva_dia' ? 'alta' : 'media',
      clave: `${tipo}|${l.id}`,
      titulo: tipo === 'reserva_dia'
        ? `${l.sku}: hoy llega el arribo · reservar ${fmtN(piezas)} pz`
        : `${l.sku}: arribo en ${dias} día${dias === 1 ? '' : 's'} (${fArr}) · reservar ${fmtN(piezas)} pz`,
      detalle: `${l.descripcion || l.sku} · ${paraQuien} · propuesta "${l.forecast_propuestas?.nombre || '—'}". Aparta las piezas en Acteck al llegar el embarque.`,
      cliente_key: clienteKey, sku: l.sku,
      area: 'forecast',
      accion: { tipo: 'navegar', clienteKey: null, pagina: 'forecastReservas', label: 'Ver reservas' },
      caduca_at: new Date(arriboMs + 3 * 86400000).toISOString(),
      valor: piezas,
      meta: { linea_id: l.id, propuesta_id: l.propuesta_id, propuesta: l.forecast_propuestas?.nombre || null, fecha_arribo: f, dias, piezas, necesidad: nec, estado_linea: l.estado },
    });
  }
  return out;
}

// ─── h. Tracking Pedidos V3: oc_detenida · oc_backorder_sin_po · factura_sin_oc ───
// Misma lógica que la pantalla (src/modules/comercial/tracking/calculo.js). Antes de evaluar se corre la RPC
// oc_sincronizar_erp() (idempotente) para que facturas y guías del ERP estén ligadas. Área tracking → ordenesCompra.
let _datosTracking = null;
async function datosTracking() {
  if (_datosTracking) return _datosTracking;
  _datosTracking = (async () => {
    try {
      await fetch(`${SB_URL}/rest/v1/rpc/oc_sincronizar_erp`, { method: 'POST', headers: { ...SB_HEADERS(), 'Content-Type': 'application/json' }, body: '{}' });
    } catch (e) { console.warn('[tracking] oc_sincronizar_erp:', e?.message || e); }
    const desde = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const [ocs, ocSkus, envios, envioSkus, cotizaciones, facturas, facturaSkus, transitoRows, stockRows, erpFacturas] = await Promise.all([
      sbGetAll('oc_clientes?select=*'), sbGetAll('oc_clientes_skus?select=*'), sbGetAll('oc_envios?select=*'), sbGetAll('oc_envio_skus?select=*'),
      sbGetAll('oc_cotizaciones?select=*'), sbGetAll('oc_facturas?select=*'), sbGetAll('oc_factura_skus?select=*'),
      sbGetAll('v_transito_sku?select=sku,cantidad,eta_mas_cercana,embarques_detalle&cantidad=gt.0', 2000),
      sbGetAll('v_inventario_comercial?select=sku,disponible', 5000),
      sbGetAll(`v_erp_facturas_oc?select=cliente_key,folio,referencia,fecha,piezas,monto,n_partidas&fecha=gte.${desde}`, 2000),
    ]);
    const transito = new Map(transitoRows.map((t) => { const det = Array.isArray(t.embarques_detalle) ? [...t.embarques_detalle].sort((a, b) => String(a.eta || '').localeCompare(String(b.eta || ''))) : []; return [t.sku, { cantidad: Number(t.cantidad) || 0, eta: t.eta_mas_cercana || det[0]?.eta || null, po: det[0]?.po || null }]; }));
    const stock = new Map(stockRows.map((r) => [r.sku, { disponible: Number(r.disponible) || 0 }]));
    return { ocs, ocSkus, envios, envioSkus, cotizaciones, facturas, facturaSkus, erpFacturas, transito, stock, roadmap: new Map() };
  })();
  try { return await _datosTracking; } catch (e) { _datosTracking = null; throw e; }
}
const ACCION_TRACKING = { tipo: 'navegar', clienteKey: null, pagina: 'ordenesCompra', label: 'Ver tracking' };

// Una alerta por OC detenida reciente (recibida en los últimos 30 días); las más viejas se agrupan en una por cliente
// para no inundar la central con el histórico capturado sin envío.
const DIAS_OC_RECIENTE = 30;
async function reglaOcDetenida(hoy) {
  const datos = await datosTracking();
  const filas = calcularTodo(datos, hoy.d);
  const detenidas = filas.filter((o) => o.detenida);
  const esReciente = (o) => !o.fecha_recibida || (hoy.d - new Date(o.fecha_recibida)) / 86400000 <= DIAS_OC_RECIENTE;
  const viejas = new Map();
  for (const o of detenidas.filter((x) => !esReciente(x))) { if (!viejas.has(o.cliente_key)) viejas.set(o.cliente_key, []); viejas.get(o.cliente_key).push(o); }
  const agrupadas = [...viejas].map(([ck, ocs]) => ({
    tipo: 'oc_detenida', severidad: 'media',
    clave: `oc_detenida|antiguas|${ck}`,
    titulo: `${nombreCliente(ck)}: ${ocs.length} OC${ocs.length === 1 ? '' : 's'} antigua${ocs.length === 1 ? '' : 's'} sin envío ni entrega registrada`,
    detalle: `Recibidas hace más de ${DIAS_OC_RECIENTE} días y detenidas en ${[...new Set(ocs.map((o) => (ETAPA_LABEL_TRACKING[o.etapa] || o.etapa).toLowerCase()))].join(' / ')}: ${ocs.slice(0, 6).map((o) => o.numero_oc_cliente).join(', ')}${ocs.length > 6 ? '…' : ''}. Registra el envío/entrega o ciérralas en Tracking.`,
    cliente_key: ck, sku: null, area: 'tracking', accion: ACCION_TRACKING, caduca_at: null, valor: ocs.length,
    meta: { total: ocs.length, ocs: ocs.slice(0, 50).map((o) => ({ id: o.id, oc: o.numero_oc_cliente, etapa: o.etapa, dias: Math.floor(o.diasEnEtapa) })) },
  }));
  return agrupadas.concat(detenidas.filter(esReciente).map((o) => {
    const d = Math.floor(o.diasEnEtapa);
    const etapa = (ETAPA_LABEL_TRACKING[o.etapa] || o.etapa).toLowerCase();
    const bo = o.backorderSkus?.length ? ` · backorder ${fmtN(o.backorder)} pz` : '';
    return {
      tipo: 'oc_detenida', severidad: d > DIAS_DETENIDA * 2 ? 'alta' : 'media',
      clave: `oc_detenida|${o.id}`,
      titulo: `${nombreCliente(o.cliente_key)}: ${o.esCotizacion ? 'cotización' : 'OC'} ${o.numero_oc_cliente} lleva ${d} d en ${etapa}`,
      detalle: `${fmtN(o.pedido)} pz pedidas · ${fmtN(o.facturado)} facturadas${bo}. ${o.etapa === 'recibida' ? 'Sin factura del ERP todavía.' : o.etapa === 'facturada' ? 'Facturada sin guía: registra el envío o espera la guía del ERP.' : 'Cotización sin respuesta del cliente.'}`,
      cliente_key: o.cliente_key, sku: null, area: 'tracking', accion: ACCION_TRACKING, caduca_at: null, valor: d,
      meta: { oc_id: o.esCotizacion ? null : o.id, oc: o.numero_oc_cliente, etapa: o.etapa, dias: d, pedido: o.pedido, facturado: o.facturado, backorder: o.backorder },
    };
  }));
}
async function reglaOcBackorderSinPo(hoy) {
  const datos = await datosTracking();
  const filas = calcularTodo(datos, hoy.d);
  return backorderPorSku(filas).filter((b) => !b.cubre && b.stock < b.backorder).map((b) => ({
    tipo: 'oc_backorder_sin_po', severidad: 'media',
    clave: `oc_backorder_sin_po|${b.sku}`,
    titulo: `${b.sku}: ${fmtN(b.backorder)} pz en backorder sin PO en tránsito`,
    detalle: `${b.descripcion || b.sku} · ${b.clientes.map(nombreCliente).join(', ')} · OC ${b.ocs.slice(0, 3).join(', ')}${b.ocs.length > 3 ? '…' : ''} · stock hoy ${fmtN(b.stock)} · ${Math.round(b.dias)} d esperando. Revisa compras o avisa al cliente.`,
    cliente_key: b.clientes.length === 1 ? b.clientes[0] : null, sku: b.sku, area: 'tracking', accion: ACCION_TRACKING, caduca_at: null, valor: b.backorder,
    meta: { sku: b.sku, backorder: b.backorder, stock: b.stock, clientes: b.clientes, ocs: b.ocs.slice(0, 20), dias: Math.round(b.dias) },
  }));
}
async function reglaFacturaSinOc(hoy) {
  const datos = await datosTracking();
  const sin = facturasSinOC(datos.erpFacturas, datos.facturas, hoy.d);
  const porCliente = new Map();
  for (const f of sin) { if (!porCliente.has(f.cliente_key)) porCliente.set(f.cliente_key, []); porCliente.get(f.cliente_key).push(f); }
  return [...porCliente].map(([ck, fs]) => ({
    tipo: 'factura_sin_oc', severidad: 'media',
    clave: `factura_sin_oc|${ck}`,
    titulo: `${nombreCliente(ck)}: ${fs.length} factura${fs.length === 1 ? '' : 's'} del ERP sin OC registrada`,
    detalle: `${fs.slice(0, 5).map((f) => `${f.folio}${f.referencia ? ` (${f.referencia})` : ''} · ${fmtN(f.piezas)} pz`).join(' · ')}${fs.length > 5 ? ` · +${fs.length - 5}` : ''}. En Tracking: «Crear OC desde factura» o «Ligar a OC».`,
    cliente_key: ck, sku: null, area: 'tracking', accion: ACCION_TRACKING, caduca_at: null, valor: fs.length,
    meta: { total: fs.length, folios: fs.slice(0, 50).map((f) => ({ folio: f.folio, referencia: f.referencia, fecha: f.fecha, piezas: f.piezas })) },
  }));
}


// ═════════════════════ Agenda (V3 · 2026-09-11) ═══════════════════════════════
// Tres reglas sobre agenda_items (tareas y puntos de reunión). Las alertas van DIRIGIDAS a una
// persona (alertas.para_usuario): la central sólo se las muestra a ella y el resumen por correo
// también. La app nunca inserta en `alertas`: deja `notificar_a` en el ítem y aquí se convierte.
//   · agenda_vencida   una alerta por (ítem vencido, responsable); severidad alta si > 7 días.
//   · agenda_asignado  cuando alguien asigna un punto/tarea a otro (notificar_motivo 'asignado') o
//                      al cerrar una reunión con puntos abiertos ('cierre'); se limpia notificar_a.
//   · agenda_hoy       (task agenda-hoy, 08:30 CDMX) resumen del día por persona: vencidas + hoy +
//                      reuniones; caduca al final del día; correo si prefs.notif.areas.agenda ≠ silencio.
const ACCION_AGENDA = { tipo: 'navegar', clienteKey: null, pagina: 'agenda', label: 'Abrir Agenda' };
const finDelDiaCDMX = (hoy) => new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia, 6 + 24)).toISOString(); // 00:00 del día siguiente CDMX
let _agenda = null;
async function datosAgenda() {
  if (_agenda) return _agenda;
  _agenda = (async () => {
    const [items, reuniones, perfiles] = await Promise.all([
      sbGetAll('agenda_items?select=id,tipo,titulo,estado,categoria,prioridad,fecha_limite,cliente_key,responsables,reunion_id,notificar_a,notificar_motivo,creado_por,updated_at&estado=in.(abierta,arrastrada)', 2000),
      sbGetAll('agenda_reuniones?select=id,titulo,cliente_key,fecha,tipo,estado&estado=neq.cerrada', 500),
      sbGetAll('perfiles?select=user_id,nombre,email,tipo,activo,estado,preferencias&activo=eq.true'),
    ]);
    return { items, reuniones, perfiles, porUsuario: new Map(perfiles.map((p) => [p.user_id, p])) };
  })();
  try { return await _agenda; } catch (e) { _agenda = null; throw e; }
}
const primerNombre = (p) => String(p?.nombre || p?.email || '').split(' ')[0];
async function reglaAgendaVencida(hoy) {
  const { items, reuniones, porUsuario } = await datosAgenda();
  const reu = new Map(reuniones.map((r) => [r.id, r]));
  const out = [];
  for (const it of items) {
    if (it.estado !== 'abierta' || !it.fecha_limite || it.fecha_limite >= hoy.iso) continue;
    const dias = Math.round((new Date(hoy.iso) - new Date(it.fecha_limite)) / 86400000);
    for (const u of it.responsables || []) {
      if (!porUsuario.has(u)) continue;
      out.push({
        tipo: 'agenda_vencida', severidad: dias > 7 ? 'alta' : 'media', clave: `agenda_vencida|${it.id}|${u}`, para_usuario: u,
        titulo: `${it.tipo === 'punto' ? 'Punto' : 'Tarea'} vencid${it.tipo === 'punto' ? 'o' : 'a'} hace ${dias} d: ${it.titulo.slice(0, 80)}`,
        detalle: `${it.cliente_key ? `${nombreCliente(it.cliente_key)} · ` : ''}límite ${it.fecha_limite}${it.reunion_id && reu.get(it.reunion_id) ? ` · de la reunión «${reu.get(it.reunion_id).titulo}»` : ''}. Márcala como hecha o muévela de fecha en la Agenda.`,
        cliente_key: ['digitalife', 'pcel', 'dicotech'].includes(it.cliente_key) ? it.cliente_key : null, sku: null, area: 'agenda', accion: ACCION_AGENDA, caduca_at: null, valor: dias,
        meta: { item_id: it.id, tipo_item: it.tipo, fecha_limite: it.fecha_limite, dias },
      });
    }
  }
  return out;
}
async function reglaAgendaAsignado(hoy) {
  const { items, reuniones, porUsuario } = await datosAgenda();
  const reu = new Map(reuniones.map((r) => [r.id, r]));
  const pendientes = items.filter((it) => Array.isArray(it.notificar_a) && it.notificar_a.length);
  const out = [];
  const ahora = new Date().toISOString();
  for (const it of pendientes) {
    const quien = porUsuario.get(it.creado_por);
    for (const u of it.notificar_a) {
      if (!porUsuario.has(u)) continue;
      const cierre = it.notificar_motivo === 'cierre';
      const recordatorio = it.notificar_motivo === 'recordatorio'; // "Recordar pendientes" desde Actividad del equipo (móvil)
      out.push({
        tipo: 'agenda_asignado', severidad: recordatorio ? 'alta' : 'media', clave: `agenda_asignado|${it.id}|${u}|${it.updated_at?.slice(0, 16) || ahora.slice(0, 16)}`, para_usuario: u,
        titulo: recordatorio ? `Recordatorio · pendiente vencido: ${it.titulo.slice(0, 80)}` : cierre ? `Quedó a tu cargo al cerrar la reunión: ${it.titulo.slice(0, 80)}` : `${quien ? primerNombre(quien) : 'Alguien'} te asignó: ${it.titulo.slice(0, 80)}`,
        detalle: `${it.cliente_key ? `${nombreCliente(it.cliente_key)} · ` : ''}${it.fecha_limite ? `límite ${it.fecha_limite}` : 'sin fecha'}${it.reunion_id && reu.get(it.reunion_id) ? ` · reunión «${reu.get(it.reunion_id).titulo}»` : ''}.`,
        cliente_key: ['digitalife', 'pcel', 'dicotech'].includes(it.cliente_key) ? it.cliente_key : null, sku: null, area: 'agenda', accion: ACCION_AGENDA,
        caduca_at: new Date(Date.now() + 7 * 86400000).toISOString(), valor: null, meta: { item_id: it.id, motivo: it.notificar_motivo || 'asignado', por: it.creado_por || null },
      });
    }
  }
  // Se limpia notificar_a en cuanto se generó la alerta (idempotente: si el upsert falla, la próxima corrida lo reintenta).
  if (pendientes.length) {
    const r = await fetch(`${SB_URL}/rest/v1/agenda_items?id=in.(${pendientes.map((i) => i.id).join(',')})`, {
      method: 'PATCH', headers: { ...SB_HEADERS(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ notificar_a: [], notificar_motivo: null }),
    });
    if (!r.ok) console.warn('[agenda_asignado] no se limpió notificar_a:', r.status);
  }
  return out;
}
// Resumen del día por persona (task agenda-hoy). Devuelve las alertas agenda_hoy y manda correo.
// ── Tipo de cambio oficial (FIX Banxico publicado en el DOF, serie SF43718) → tabla tipo_cambio ──
// Corre dentro de generar-alertas (diario 07:00 CDMX) y también con ?task=tipo-cambio. Trae los últimos
// 10 días y hace upsert por fecha; sin BANXICO_TOKEN no falla: avisa y deja el último valor cargado.
async function taskTipoCambio() {
  const tok = process.env.BANXICO_TOKEN;
  if (!tok) return { ok: false, motivo: 'BANXICO_TOKEN no configurado' };
  const hoy = new Date(); const desde = new Date(hoy.getTime() - 10 * 86400000);
  const f = (d) => d.toISOString().slice(0, 10);
  const r = await fetch(`https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/${f(desde)}/${f(hoy)}`, { headers: { 'Bmx-Token': tok } });
  if (!r.ok) return { ok: false, motivo: `Banxico HTTP ${r.status}` };
  const j = await r.json();
  const datos = (j?.bmx?.series?.[0]?.datos || []).filter((d) => /^\d/.test(String(d.dato))).map((d) => {
    const [dd, mm, yy] = String(d.fecha).split('/');
    return { fecha: `${yy}-${mm}-${dd}`, valor: Number(d.dato), fuente: 'banxico_fix_dof' };
  });
  if (!datos.length) return { ok: true, filas: 0 };
  const up = await fetch(`${SB_URL}/rest/v1/tipo_cambio?on_conflict=fecha`, {
    method: 'POST', headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(datos),
  });
  if (!up.ok) return { ok: false, motivo: `upsert ${up.status}: ${(await up.text()).slice(0, 200)}` };
  return { ok: true, filas: datos.length, ultimo: datos[datos.length - 1] };
}

async function taskAgendaHoy({ dryRun = esDryRun() } = {}) {
  const hoy = hoyCDMX();
  _agenda = null;
  const { items, reuniones, perfiles } = await datosAgenda();
  const ahora = new Date().toISOString();
  const caduca = finDelDiaCDMX(hoy);
  const alertas = [], correos = [], omitidos = [];
  const transporte = dryRun ? null : await crearTransporte().catch(() => null);
  for (const p of perfiles.filter((x) => x.tipo === 'interno' && (x.estado == null || x.estado === 'activo'))) {
    const mios = items.filter((it) => it.estado === 'abierta' && (it.responsables || []).includes(p.user_id));
    const venc = mios.filter((it) => it.fecha_limite && it.fecha_limite < hoy.iso).sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));
    const deHoy = mios.filter((it) => it.fecha_limite === hoy.iso);
    const reus = reuniones.filter((r) => r.tipo === 'reunion' && new Date(r.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }) === hoy.iso).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (!venc.length && !deHoy.length && !reus.length) { omitidos.push({ to: p.email, motivo: 'nada para hoy' }); continue; }
    const linea = (it) => `• ${it.titulo}${it.cliente_key ? ` (#${it.cliente_key})` : ''}${it.fecha_limite && it.fecha_limite < hoy.iso ? ` · vencida ${it.fecha_limite}` : ''}`;
    const horaDe = (r) => new Date(r.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
    const titulo = `Tu agenda de hoy: ${deHoy.length} para hoy${venc.length ? ` · ${venc.length} vencida${venc.length === 1 ? '' : 's'}` : ''}${reus.length ? ` · ${reus.length} reunión${reus.length === 1 ? '' : 'es'}` : ''}`;
    const detalle = [venc.length ? `Vencidas: ${venc.slice(0, 4).map((i) => i.titulo.slice(0, 40)).join(' · ')}${venc.length > 4 ? ` · +${venc.length - 4}` : ''}` : null, deHoy.length ? `Hoy: ${deHoy.slice(0, 4).map((i) => i.titulo.slice(0, 40)).join(' · ')}` : null, reus.length ? `Reuniones: ${reus.map((r) => `${horaDe(r)} ${nombreCliente(r.cliente_key || 'interno')}`).join(' · ')}` : null].filter(Boolean).join('. ');
    alertas.push({ tipo: 'agenda_hoy', severidad: venc.length ? 'media' : 'info', clave: `agenda_hoy|${p.user_id}|${hoy.iso}`, para_usuario: p.user_id, titulo, detalle, cliente_key: null, sku: null, area: 'agenda', accion: ACCION_AGENDA, caduca_at: caduca, valor: deHoy.length + venc.length, meta: { vencidas: venc.length, hoy: deHoy.length, reuniones: reus.length }, generada_at: ahora, actualizada_at: ahora });
    // Correo (preferencias.notif.areas.agenda ≠ 'silencio' y resumen.correo)
    const prefs = prefsNotif(p);
    if (!p.email || prefs.areas.agenda === 'silencio' || !prefs.resumen.correo) { omitidos.push({ to: p.email, motivo: 'agenda en silencio o sin correo' }); continue; }
    const text = `${titulo}\n\n${venc.length ? `VENCIDAS (${venc.length})\n${venc.map(linea).join('\n')}\n\n` : ''}${deHoy.length ? `HOY (${deHoy.length})\n${deHoy.map(linea).join('\n')}\n\n` : ''}${reus.length ? `REUNIONES\n${reus.map((r) => `• ${horaDe(r)} · ${r.titulo} (${nombreCliente(r.cliente_key || 'interno')})`).join('\n')}\n\n` : ''}${APP_URL}`;
    const cuerpo = [venc.length ? htmlSeccion('Vencidas', `${venc.length}`, venc.map((i) => ({ severidad: 'alta', titulo: i.titulo, detalle: `límite ${i.fecha_limite}`, accion: ACCION_AGENDA }))) : '', deHoy.length ? htmlSeccion('Hoy', `${deHoy.length}`, deHoy.map((i) => ({ severidad: 'info', titulo: i.titulo, detalle: i.cliente_key ? nombreCliente(i.cliente_key) : null, accion: ACCION_AGENDA }))) : '', reus.length ? htmlSeccion('Reuniones', `${reus.length}`, reus.map((r) => ({ severidad: 'info', titulo: `${horaDe(r)} · ${r.titulo}`, detalle: nombreCliente(r.cliente_key || 'interno'), accion: ACCION_AGENDA }))) : ''].join('');
    const html = htmlCorreo({ titulo: `Agenda del ${hoy.dia} de ${MESES_LARGO[hoy.mes - 1].toLowerCase()}`, intro: titulo, cuerpo });
    const subject = `${titulo} · Dashboard Acteck`;
    if (dryRun || !transporte) { correos.push({ to: p.email, subject, dryRun: true }); continue; }
    try { const info = await transporte.transporter.sendMail({ from: transporte.from, to: p.email, subject, text, html }); correos.push({ to: p.email, subject, msg_id: info.messageId }); }
    catch (e) { correos.push({ to: p.email, subject, error: e.message }); }
  }
  let upsert = null;
  if (alertas.length && !dryRun) {
    const r = await fetch(`${SB_URL}/rest/v1/alertas?on_conflict=clave`, { method: 'POST', headers: { ...SB_HEADERS(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(normalizarFilasAlertas(alertas)) });
    upsert = r.ok ? 'ok' : `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
  }
  return { ok: !upsert || upsert === 'ok', dryRun, hoy: hoy.iso, alertas: alertas.length, upsert, correos, omitidos };
}

// ═══ Actividad del equipo · equipo_inactivo (2026-09-11) ═══════════════════════
// Una alerta por usuario INTERNO y ACTIVO que lleve ≥ umbral días hábiles (L-V)
// sin entrar al dashboard (último evento de eventos_usuario) o, teniendo pendientes
// abiertos en agenda_items, sin cerrar ninguno. El umbral es el mismo que se elige
// en la pantalla: perfiles.preferencias.equipo.umbralInactividad del super admin
// (default 3; ver src/modules/interno/equipo/datos.js). Área 'equipo', severidad
// media (alta si duplica el umbral), acción → pantalla telemetria. Sin agenda_items
// (tabla ausente / error) sólo evalúa "sin entrar". Sólo el cron escribe alertas.
const UMBRAL_INACTIVIDAD_DEFAULT = 3;
function diasHabilesDesde(iso, hoy) {
  if (!iso) return null;
  const desde = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  desde.setHours(12, 0, 0, 0);
  const fin = new Date(hoy.anio, hoy.mes - 1, hoy.dia, 12);
  let n = 0;
  for (let d = new Date(desde); d < fin;) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n += 1; }
  return n;
}
async function reglaEquipoInactivo(hoy) {
  const [perfiles, admins] = await Promise.all([
    sbGetAll('perfiles?select=user_id,nombre,email,tipo,activo,estado&activo=eq.true&tipo=eq.interno&user_id=not.is.null'),
    sbGetAll('perfiles?select=preferencias&es_super_admin=eq.true&limit=1'),
  ]);
  const raw = Number(admins?.[0]?.preferencias?.equipo?.umbralInactividad);
  const umbral = [2, 3, 5].includes(raw) ? raw : UMBRAL_INACTIVIDAD_DEFAULT;
  const internos = perfiles.filter((p) => p.estado == null || p.estado === 'activo');
  if (!internos.length) return [];
  // Último evento por usuario (una consulta limit 1 por persona: el equipo interno es pequeño).
  const ultimos = await Promise.all(internos.map(async (p) => {
    const rows = await sbGetAll(`eventos_usuario?select=ts&user_id=eq.${p.user_id}&order=ts.desc&limit=1`, 1).catch(() => []);
    return [p.user_id, rows?.[0]?.ts || null];
  }));
  const ultimoPor = new Map(ultimos);
  // Agenda (tolerante): abiertos y último cierre por responsable.
  let agendaPor = null;
  try {
    const items = await sbGetAll('agenda_items?select=estado,responsables,completado_en&or=(estado.in.(abierta,arrastrada),completado_en.not.is.null)', 5000);
    agendaPor = new Map();
    for (const it of items) {
      for (const uid of it.responsables || []) {
        if (!agendaPor.has(uid)) agendaPor.set(uid, { abiertos: 0, ultimoCierre: null });
        const a = agendaPor.get(uid);
        if (it.estado === 'abierta' || it.estado === 'arrastrada') a.abiertos += 1;
        if (it.completado_en && (!a.ultimoCierre || it.completado_en > a.ultimoCierre)) a.ultimoCierre = it.completado_en;
      }
    }
  } catch { agendaPor = null; }
  const out = [];
  for (const p of internos) {
    const dSin = diasHabilesDesde(ultimoPor.get(p.user_id), hoy);
    const sinEntrar = dSin == null || dSin >= umbral;
    const ag = agendaPor?.get(p.user_id) || null;
    const dCierre = ag && ag.abiertos > 0 ? diasHabilesDesde(ag.ultimoCierre, hoy) : null;
    const sinCerrar = !!ag && ag.abiertos > 0 && (dCierre == null || dCierre >= umbral);
    if (!sinEntrar && !sinCerrar) continue;
    const nombre = p.nombre || p.email;
    const dias = sinEntrar ? (dSin ?? umbral) : dCierre ?? umbral;
    const titulo = sinEntrar
      ? `${nombre} lleva ${dSin == null ? 'más de 28' : dSin} día${dSin === 1 ? '' : 's'} hábil${dSin === 1 ? '' : 'es'} sin entrar al dashboard`
      : `${nombre} lleva ${dCierre == null ? 'más de 28' : dCierre} día${dCierre === 1 ? '' : 's'} hábil${dCierre === 1 ? '' : 'es'} sin cerrar pendientes (${ag.abiertos} abierto${ag.abiertos === 1 ? '' : 's'})`;
    out.push({
      tipo: 'equipo_inactivo', severidad: dias >= umbral * 2 ? 'alta' : 'media',
      clave: `equipo_inactivo|${p.user_id}`,
      titulo,
      detalle: `${sinEntrar ? `Última sesión ${ultimoPor.get(p.user_id) ? String(ultimoPor.get(p.user_id)).slice(0, 10) : 'sin registro en 28 días'}` : `Último cierre ${ag.ultimoCierre ? String(ag.ultimoCierre).slice(0, 10) : 'sin registro'}`} · umbral ${umbral} días hábiles. Revisa su tarjeta en Actividad del equipo.`,
      cliente_key: null, sku: null,
      area: 'equipo',
      accion: { tipo: 'navegar', clienteKey: null, pagina: 'telemetria', label: 'Ver actividad' },
      caduca_at: null,
      valor: dias,
      meta: { user_id: p.user_id, sin_entrar: sinEntrar, dias_sin_entrar: dSin, sin_cerrar: sinCerrar, dias_sin_cerrar: dCierre, abiertos: ag?.abiertos ?? null, umbral },
    });
  }
  return out;
}
// ═══ /equipo_inactivo ═══════════════════════════════════════════════════════════

export { taskResumenProgramado, enviarCriticasNuevas, taskAgendaHoy };
export async function taskGenerarAlertas({ notificarCriticas = false } = {}) {
  const hoy = hoyCDMX();
  const REGLAS = [
    ['stock_vs_transito',      () => reglaStockVsTransito(hoy)],
    ['cuota_en_riesgo',        () => reglaCuotaEnRiesgo(hoy)],
    ['devoluciones_anormales', () => reglaDevolucionesAnormales(hoy)],
    ['rebate_por_generar',     () => reglaRebatePorGenerar(hoy)],
    ['datos_sin_actualizar',   () => reglaDatosSinActualizar()],
    ['oc_sin_actualizar',      () => reglaOcSinActualizar()],
    ['reserva_3dias',          () => reglaReservasArribo(hoy, 'reserva_3dias')],
    ['reserva_dia',            () => reglaReservasArribo(hoy, 'reserva_dia')],
    ['oc_detenida',            () => reglaOcDetenida(hoy)],
    ['oc_backorder_sin_po',    () => reglaOcBackorderSinPo(hoy)],
    ['factura_sin_oc',         () => reglaFacturaSinOc(hoy)],
    ['agenda_vencida',         () => reglaAgendaVencida(hoy)],
    ['agenda_asignado',        () => reglaAgendaAsignado(hoy)],
    ['equipo_inactivo',        () => reglaEquipoInactivo(hoy)],   // Actividad del equipo (bloque al final de las reglas)
  ];
  _datosTracking = null;
  _agenda = null;   // datos frescos por corrida (la instancia serverless puede reutilizarse)
  const errores = [];
  const tiposEvaluados = new Set();
  const candidatas = [];
  const settled = await Promise.allSettled(REGLAS.map(([, fn]) => fn()));
  settled.forEach((r, i) => {
    const tipo = REGLAS[i][0];
    if (r.status === 'fulfilled') { tiposEvaluados.add(tipo); candidatas.push(...r.value); }
    else errores.push({ tipo, error: String(r.reason?.message || r.reason).slice(0, 300) });
  });

  // Estado actual de la tabla
  const existentes = await sbGetAll('alertas?select=id,clave,tipo,resuelta_at,resuelta_por,actualizada_at,caduca_at,meta,para_usuario', 5000);
  const porClave = new Map(existentes.map((a) => [a.clave, a]));
  const ahora = new Date().toISOString();
  const REABRIR_MS = 36 * 3600 * 1000;

  const resumen = {};
  const cnt = (tipo, k) => { resumen[tipo] = resumen[tipo] || { generadas: 0, actualizadas: 0, resueltas: 0 }; resumen[tipo][k] += 1; };
  // Tres lotes porque PostgREST exige las mismas llaves en todas las filas de
  // un bulk (PGRST102): nuevas llevan generada_at, actualizadas no, reaperturas
  // además limpian resuelta_*/snooze.
  const nuevas = [], upserts = [], reaperturas = [];
  const clavesVigentes = new Set();
  for (const c of candidatas) {
    clavesVigentes.add(c.clave);
    const ex = porClave.get(c.clave);
    // meta.notificada_at lo escribe resumen-programado; se conserva al re-upsertear
    // (si la alerta se reabre tras resolverse, vuelve a contar como no notificada).
    const notificada = ex && !ex.resuelta_at ? ex.meta?.notificada_at : null;
    const base = { ...c, meta: notificada ? { ...c.meta, notificada_at: notificada } : c.meta, actualizada_at: ahora };
    if (!ex) { nuevas.push({ ...base, generada_at: ahora }); cnt(c.tipo, 'generadas'); continue; }
    if (ex.resuelta_at) {
      const lapso = Date.now() - new Date(ex.actualizada_at || 0).getTime();
      if (ex.resuelta_por === 'sistema' || lapso > REABRIR_MS) {
        reaperturas.push({ ...base, generada_at: ahora, resuelta_at: null, resuelta_por: null, snooze_hasta: null });
        cnt(c.tipo, 'generadas');
        continue;
      }
    }
    upserts.push(base); cnt(c.tipo, 'actualizadas');
  }

  // PostgREST exige que todas las filas de un mismo POST traigan las MISMAS llaves: las reglas nuevas
  // (agenda, tracking, equipo) agregan campos (para_usuario, meta…) que las viejas no traen. Se normaliza.
  const postUpsert = async (rowsSinNormalizar) => {
    const rows = normalizarFilasAlertas(rowsSinNormalizar);
    for (let i = 0; i < rows.length; i += 200) {
      const r = await fetch(`${SB_URL}/rest/v1/alertas?on_conflict=clave`, {
        method: 'POST',
        headers: { ...SB_HEADERS(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(i, i + 200)),
      });
      if (!r.ok) errores.push({ tipo: 'upsert', error: `HTTP ${r.status} ${(await r.text()).slice(0, 300)}` });
    }
  };
  if (nuevas.length) await postUpsert(nuevas);
  if (upserts.length) await postUpsert(upserts);
  if (reaperturas.length) await postUpsert(reaperturas);

  // Auto-resolver: activas de tipos evaluados cuya condición ya no se cumple,
  // más las que ya caducaron (caduca_at < ahora) aunque su regla haya fallado.
  // agenda_asignado es un aviso puntual (sólo es candidata en la corrida que la genera): vive hasta caduca_at o hasta que
  // la persona la resuelva, no se auto-resuelve por "ya no está en la lista".
  const aResolver = existentes.filter((a) => !a.resuelta_at && (
    (tiposEvaluados.has(a.tipo) && a.tipo !== 'agenda_asignado' && !clavesVigentes.has(a.clave))
    || (a.caduca_at && a.caduca_at < ahora && !clavesVigentes.has(a.clave))
  ));
  if (aResolver.length) {
    const r = await fetch(`${SB_URL}/rest/v1/alertas?id=in.(${aResolver.map((a) => a.id).join(',')})`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ resuelta_at: ahora, resuelta_por: 'sistema', actualizada_at: ahora }),
    });
    if (!r.ok) errores.push({ tipo: 'auto-resolver', error: `HTTP ${r.status} ${(await r.text()).slice(0, 300)}` });
    else aResolver.forEach((a) => cnt(a.tipo, 'resueltas'));
  }

  const totales = Object.values(resumen).reduce((t, v) => ({ generadas: t.generadas + v.generadas, actualizadas: t.actualizadas + v.actualizadas, resueltas: t.resueltas + v.resueltas }), { generadas: 0, actualizadas: 0, resueltas: 0 });

  // Críticas nuevas → correo inmediato (sólo desde el cron real; la corrida
  // local o con RESUMEN_DRY_RUN=1 no envía nada).
  let criticas = null;
  if (notificarCriticas) {
    try { criticas = await enviarCriticasNuevas({ dryRun: esDryRun() }); }
    catch (e) { errores.push({ tipo: 'criticas', error: String(e.message || e).slice(0, 300) }); }
  }
  return { ok: errores.length === 0, hoy: hoy.iso, candidatas: candidatas.length, totales, por_tipo: resumen, errores, ...(criticas ? { criticas } : {}) };
}


// ═════════════════════ TASK · Resumen programado (centro de notificaciones) ═══
// Corre a la hora del resumen (vercel.json: 19:00 UTC = 13:00 CDMX; CDMX ya no
// tiene horario de verano). Para cada perfil interno activo con correo:
//   · preferencias.notif = { areas:{area:'inmediato'|'resumen'|'silencio'},
//     clientes:[..]|null, resumen:{hora:'13:00', correo:true}, criticas_correo:true }
//   · UN correo con las alertas activas NO críticas de las áreas en modo
//     'resumen' (agrupadas por área, conteos, lo nuevo del día, lo resuelto solo)
//   · críticas nuevas (sin meta.notificada_at) → correo aparte, inmediato, a
//     quienes tengan criticas_correo (también lo dispara generar-alertas).
// Registra meta.notificada_at en cada alerta enviada.
// dryRun (RESUMEN_DRY_RUN=1 o ?dryRun=1): arma todo y lo devuelve sin enviar
// ni marcar notificada_at.
// ══════════════════════════════════════════════════════════════════════════════
const AREAS_NOTIF = ['agenda', 'inventario', 'ventas', 'pagos', 'cobranza', 'datos', 'operacion', 'forecast', 'tracking'];
const AREA_LABEL = { agenda: 'Agenda', inventario: 'Inventario', ventas: 'Ventas', pagos: 'Pagos', cobranza: 'Cobranza', datos: 'Datos', operacion: 'Operación', forecast: 'Forecast', tracking: 'Tracking' };
const SEV_ORDEN_N = { critica: 0, alta: 1, media: 2, info: 3 };
const SEV_COLOR = { critica: '#FF3B30', alta: '#FF9500', media: '#FFCC00', info: '#007AFF' };
const APP_URL = process.env.APP_URL || 'https://acteck-dashboard.vercel.app';
const esDryRun = () => process.env.RESUMEN_DRY_RUN === '1';

function prefsNotif(perfil) {
  const n = perfil?.preferencias?.notif || {};
  const areas = {};
  for (const a of AREAS_NOTIF) areas[a] = ['inmediato', 'resumen', 'silencio'].includes(n.areas?.[a]) ? n.areas[a] : 'resumen';
  return {
    areas,
    clientes: Array.isArray(n.clientes) && n.clientes.length ? n.clientes : null,
    resumen: { hora: n.resumen?.hora || '13:00', correo: n.resumen?.correo !== false },
    criticas_correo: n.criticas_correo !== false,
  };
}
const areaDe = (a) => a.area || ({ agenda_vencida: 'agenda', agenda_hoy: 'agenda', agenda_asignado: 'agenda', stock_vs_transito: 'inventario', cuota_en_riesgo: 'ventas', devoluciones_anormales: 'ventas', rebate_por_generar: 'pagos', datos_sin_actualizar: 'datos', oc_sin_actualizar: 'operacion' })[a.tipo] || 'operacion';
const aplicaCliente = (a, prefs) => !prefs.clientes || !a.cliente_key || prefs.clientes.includes(a.cliente_key);
// Alertas dirigidas (Agenda): sólo a su destinatario.
const aplicaPersona = (a, p) => !a.para_usuario || a.para_usuario === p.user_id;
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ordenSev = (a, b) => (SEV_ORDEN_N[a.severidad] ?? 9) - (SEV_ORDEN_N[b.severidad] ?? 9) || String(b.actualizada_at || '').localeCompare(String(a.actualizada_at || ''));

async function perfilesNotificables() {
  const rows = await sbGetAll('perfiles?select=user_id,nombre,email,tipo,activo,estado,preferencias&activo=eq.true&tipo=eq.interno&email=not.is.null');
  return rows.filter((p) => p.email && (p.estado == null || p.estado === 'activo'));
}
async function alertasActivas() {
  const ahora = new Date().toISOString();
  return sbGetAll(`alertas?select=id,tipo,severidad,titulo,detalle,cliente_key,sku,valor,meta,area,accion,generada_at,actualizada_at,snooze_hasta,para_usuario&resuelta_at=is.null&or=(snooze_hasta.is.null,snooze_hasta.lt.${ahora})`, 2000);
}
async function marcarNotificadas(alertas, ahora) {
  const ids = alertas.map((a) => a.id);
  for (let i = 0; i < alertas.length; i += 10) {
    await Promise.all(alertas.slice(i, i + 10).map((a) => fetch(`${SB_URL}/rest/v1/alertas?id=eq.${a.id}`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ meta: { ...(a.meta || {}), notificada_at: ahora } }),
    })));
  }
  return ids.length;
}
function crearTransporte() {
  const SMTP_USER = process.env.SMTP_USER, SMTP_PASS = process.env.SMTP_PASS;
  if (!SMTP_USER || !SMTP_PASS) return null;
  return import('nodemailer').then(({ default: nodemailer }) => ({
    from: `"Dashboard Acteck" <${SMTP_USER}>`,
    transporter: nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, '') } }),
  }));
}

// HTML de correo: tabla simple estilo iOS (inline styles, sin imágenes).
function htmlAlerta(a) {
  const acc = a.accion || {};
  const href = acc.tipo === 'url' ? `${APP_URL}${acc.url}` : APP_URL;
  const pill = a.sku || (a.cliente_key ? nombreCliente(a.cliente_key) : '');
  return `<tr>
    <td style="padding:8px 0 8px 14px;vertical-align:top;width:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${SEV_COLOR[a.severidad] || '#8E8E93'}"></span></td>
    <td style="padding:6px 10px;vertical-align:top;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1D1D1F">
      <div style="font-weight:600">${escapeHtml(a.titulo)}${pill ? ` <span style="font-weight:500;font-size:10.5px;color:#6E6E73;border:1px solid rgba(0,0,0,.1);border-radius:99px;padding:1px 7px;margin-left:4px">${escapeHtml(pill)}</span>` : ''}</div>
      ${a.detalle ? `<div style="color:#6E6E73;font-size:12px;margin-top:2px">${escapeHtml(a.detalle)}</div>` : ''}
    </td>
    <td style="padding:6px 14px 6px 6px;vertical-align:top;text-align:right;white-space:nowrap"><a href="${href}" style="font:12px -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#007AFF;text-decoration:none">${escapeHtml(acc.label || 'Ver')} ›</a></td>
  </tr>`;
}
function htmlSeccion(titulo, sub, alertas, max = 12) {
  const filas = alertas.slice(0, max).map(htmlAlerta).join('');
  const mas = alertas.length > max ? `<tr><td colspan="3" style="padding:6px 14px 10px;font:12px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#6E6E73">y ${alertas.length - max} más en el dashboard</td></tr>` : '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid rgba(0,0,0,.06);border-radius:12px;margin:0 0 12px">
    <tr><td colspan="3" style="padding:12px 14px 8px;border-bottom:1px solid rgba(0,0,0,.06)">
      <span style="font:600 14px -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1D1D1F;letter-spacing:-.01em">${escapeHtml(titulo)}</span>
      ${sub ? `<span style="font:12px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#6E6E73;margin-left:8px">${escapeHtml(sub)}</span>` : ''}
    </td></tr>${filas}${mas}</table>`;
}
function htmlCorreo({ titulo, intro, cuerpo }) {
  return `<!doctype html><html><body style="margin:0;background:#F5F5F7;padding:24px 12px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
    <tr><td style="padding:0 4px 14px">
      <div style="font:600 22px -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1D1D1F;letter-spacing:-.025em">${escapeHtml(titulo)}</div>
      <div style="font:13px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#6E6E73;margin-top:4px">${escapeHtml(intro)}</div>
    </td></tr>
    <tr><td>${cuerpo}</td></tr>
    <tr><td style="padding:10px 4px 0;font:11.5px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#86868B">
      Abre el <a href="${APP_URL}" style="color:#007AFF;text-decoration:none">dashboard</a> y toca la campana para resolver o posponer. Cambia qué recibes en ⚙️ del centro de notificaciones.
    </td></tr>
  </table></td></tr></table></body></html>`;
}
const textoAlertas = (alertas) => alertas.map((a) => `  · [${a.severidad}] ${a.titulo}${a.detalle ? ` — ${a.detalle}` : ''}`).join('\n');

// Críticas nuevas (sin meta.notificada_at) → correo inmediato a quienes tengan criticas_correo.
async function enviarCriticasNuevas({ dryRun = esDryRun() } = {}) {
  const [perfiles, activas] = await Promise.all([perfilesNotificables(), alertasActivas()]);
  const nuevas = activas.filter((a) => a.severidad === 'critica' && !a.meta?.notificada_at).sort(ordenSev);
  if (!nuevas.length) return { skip: 'Sin críticas nuevas', enviados: [] };
  const ahora = new Date().toISOString();
  const transporte = dryRun ? null : await crearTransporte();
  if (!dryRun && !transporte) return { error: 'SMTP_USER y SMTP_PASS no configurados', criticas: nuevas.length };
  const enviados = [], previews = [];
  const alcanzadas = new Set();
  for (const p of perfiles) {
    const prefs = prefsNotif(p);
    if (!prefs.criticas_correo) continue;
    const mias = nuevas.filter((a) => prefs.areas[areaDe(a)] !== 'silencio' && aplicaCliente(a, prefs) && aplicaPersona(a, p));
    if (!mias.length) continue;
    mias.forEach((a) => alcanzadas.add(a.id));
    const porArea = new Map();
    for (const a of mias) { const k = areaDe(a); if (!porArea.has(k)) porArea.set(k, []); porArea.get(k).push(a); }
    const cuerpo = [...porArea].map(([k, arr]) => htmlSeccion(AREA_LABEL[k] || k, `${arr.length} crítica${arr.length === 1 ? '' : 's'}`, arr, 15)).join('');
    const subject = `🔴 ${mias.length} alerta${mias.length === 1 ? '' : 's'} crítica${mias.length === 1 ? '' : 's'} nueva${mias.length === 1 ? '' : 's'} · Dashboard Acteck`;
    const html = htmlCorreo({ titulo: 'Alertas críticas', intro: `${mias.length} nueva${mias.length === 1 ? '' : 's'} desde el último aviso. Requieren decisión hoy.`, cuerpo });
    const text = `Alertas críticas nuevas (${mias.length}):\n\n${textoAlertas(mias)}\n\n${APP_URL}`;
    if (dryRun) { previews.push({ to: p.email, subject, ids: mias.map((a) => a.id), html, text }); continue; }
    try {
      const info = await transporte.transporter.sendMail({ from: transporte.from, to: p.email, subject, text, html });
      enviados.push({ to: p.email, n: mias.length, msg_id: info.messageId });
    } catch (e) { enviados.push({ to: p.email, n: mias.length, error: e.message }); }
  }
  let marcadas = 0;
  if (!dryRun && alcanzadas.size) marcadas = await marcarNotificadas(nuevas.filter((a) => alcanzadas.has(a.id)), ahora);
  return { dryRun, criticas_nuevas: nuevas.length, destinatarios: dryRun ? previews.length : enviados.length, marcadas, enviados, ...(dryRun ? { previews } : {}) };
}

async function taskResumenProgramado({ dryRun = esDryRun(), hora = null } = {}) {
  const hoy = hoyCDMX();
  const horaCDMX = hora ?? hoy.d.getHours();
  const inicioDia = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia, 6)).toISOString(); // 00:00 CDMX (UTC-6)
  const hace24 = new Date(Date.now() - 86400000).toISOString();
  const ahora = new Date().toISOString();

  const [perfiles, activas, resueltasSolas] = await Promise.all([
    perfilesNotificables(),
    alertasActivas(),
    sbGetAll(`alertas?select=id,tipo,severidad,titulo,detalle,cliente_key,sku,area,resuelta_at&resuelta_por=eq.sistema&resuelta_at=gte.${hace24}&order=resuelta_at.desc`, 500),
  ]);
  activas.sort(ordenSev);
  const transporte = dryRun ? null : await crearTransporte();
  if (!dryRun && !transporte) return { error: 'SMTP_USER y SMTP_PASS no configurados' };

  const enviados = [], previews = [], omitidos = [];
  const incluidas = new Set();
  for (const p of perfiles) {
    const prefs = prefsNotif(p);
    if (!prefs.resumen.correo) { omitidos.push({ to: p.email, motivo: 'resumen.correo = false' }); continue; }
    const horaPref = Number(String(prefs.resumen.hora).split(':')[0]);
    if (Number.isFinite(horaPref) && horaPref !== horaCDMX) { omitidos.push({ to: p.email, motivo: `hora ${prefs.resumen.hora} ≠ ${horaCDMX}:00` }); continue; }
    const mias = activas.filter((a) => a.severidad !== 'critica' && prefs.areas[areaDe(a)] === 'resumen' && aplicaCliente(a, prefs) && aplicaPersona(a, p));
    const criticasPend = activas.filter((a) => a.severidad === 'critica' && prefs.areas[areaDe(a)] !== 'silencio' && aplicaCliente(a, prefs) && aplicaPersona(a, p));
    const resueltas = resueltasSolas.filter((a) => prefs.areas[areaDe(a)] !== 'silencio' && aplicaCliente(a, prefs));
    if (!mias.length && !resueltas.length && !criticasPend.length) { omitidos.push({ to: p.email, motivo: 'sin alertas para su configuración' }); continue; }

    const porArea = new Map();
    for (const a of mias) { const k = areaDe(a); if (!porArea.has(k)) porArea.set(k, []); porArea.get(k).push(a); }
    const nuevasHoy = mias.filter((a) => a.generada_at >= inicioDia);
    const secciones = [];
    if (criticasPend.length) secciones.push(`<div style="font:12px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#B00020;padding:0 4px 10px">${criticasPend.length} crítica${criticasPend.length === 1 ? '' : 's'} sigue${criticasPend.length === 1 ? '' : 'n'} abierta${criticasPend.length === 1 ? '' : 's'} (avisadas por separado).</div>`);
    for (const k of AREAS_NOTIF) {
      const arr = porArea.get(k); if (!arr) continue;
      const nuevas = arr.filter((a) => a.generada_at >= inicioDia).length;
      secciones.push(htmlSeccion(AREA_LABEL[k], `${arr.length} activa${arr.length === 1 ? '' : 's'}${nuevas ? ` · ${nuevas} nueva${nuevas === 1 ? '' : 's'} hoy` : ''}`, arr));
    }
    if (resueltas.length) secciones.push(htmlSeccion('Se resolvieron solas', `${resueltas.length} en las últimas 24 h`, resueltas.map((a) => ({ ...a, severidad: 'info', detalle: null, accion: { label: 'Ver' } })), 8));
    const conteos = [...porArea].map(([k, arr]) => `${AREA_LABEL[k]} ${arr.length}`).join(' · ');
    const subject = `Resumen ${hoy.dia} ${MESES_CORTO[hoy.mes - 1]} · ${mias.length} pendiente${mias.length === 1 ? '' : 's'}${nuevasHoy.length ? ` · ${nuevasHoy.length} nueva${nuevasHoy.length === 1 ? '' : 's'}` : ''} · Dashboard Acteck`;
    const html = htmlCorreo({ titulo: `Resumen del ${hoy.dia} de ${MESES_LARGO[hoy.mes - 1].toLowerCase()}`, intro: conteos || 'Nada pendiente en tus áreas.', cuerpo: secciones.join('') });
    const text = `Resumen ${hoy.iso}\n${conteos}\n\n${[...porArea].map(([k, arr]) => `${AREA_LABEL[k]} (${arr.length})\n${textoAlertas(arr)}`).join('\n\n')}${resueltas.length ? `\n\nSe resolvieron solas (${resueltas.length}):\n${textoAlertas(resueltas)}` : ''}\n\n${APP_URL}`;
    mias.forEach((a) => incluidas.add(a.id));
    const resumenJson = { to: p.email, subject, total: mias.length, nuevas_hoy: nuevasHoy.length, criticas_abiertas: criticasPend.length, resueltas_solas: resueltas.length, por_area: Object.fromEntries([...porArea].map(([k, arr]) => [k, arr.length])) };
    if (dryRun) { previews.push({ ...resumenJson, html, text }); continue; }
    try {
      const info = await transporte.transporter.sendMail({ from: transporte.from, to: p.email, subject, text, html });
      enviados.push({ ...resumenJson, msg_id: info.messageId });
    } catch (e) { enviados.push({ ...resumenJson, error: e.message }); }
  }

  let marcadas = 0;
  if (!dryRun && incluidas.size) marcadas = await marcarNotificadas(activas.filter((a) => incluidas.has(a.id) && !a.meta?.notificada_at), ahora);

  // Críticas nuevas que no se hayan avisado aún (por si generar-alertas no las mandó).
  const criticas = await enviarCriticasNuevas({ dryRun });
  return { dryRun, hoy: hoy.iso, hora: horaCDMX, perfiles: perfiles.length, enviados, omitidos, marcadas, criticas, ...(dryRun ? { previews } : {}) };
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
    } else if (task === 'generar-alertas') {
      let tipoCambio = null;
      try { tipoCambio = await taskTipoCambio(); } catch (e) { tipoCambio = { ok: false, motivo: String(e.message || e) }; }
      result = { ...(await taskGenerarAlertas({ notificarCriticas: true })), tipoCambio };
    } else if (task === 'tipo-cambio') {
      result = await taskTipoCambio();
    } else if (task === 'resumen-programado') {
      const q = req.query || {};
      const dryRun = esDryRun() || q.dryRun === '1';
      const hora = q.hora != null && q.hora !== '' ? Number(q.hora) : null;
      result = await taskResumenProgramado({ dryRun, hora: Number.isFinite(hora) ? hora : null });
    } else if (task === 'agenda-hoy') {
      // Agenda (V3): resumen diario por persona a las 08:30 CDMX (vercel.json: 30 14 * * 1-6 UTC)
      result = await taskAgendaHoy({ dryRun: esDryRun() || req.query?.dryRun === '1' });
    } else {
      return res.status(400).json({
        error: 'task inválido',
        usage: 'GET /api/cron?task=sync-master-embarques | actualizar-fill-rates | recordatorio-eval | recordatorio-tracking | forecast-avisos | generar-alertas | tipo-cambio | resumen-programado[&dryRun=1&hora=13] | agenda-hoy[&dryRun=1]',
      });
    }
    if (result.status && result.error) return res.status(result.status).json(result);
    return res.status(200).json({ ...result, ts: new Date().toISOString(), task });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message, task });
  }
}
