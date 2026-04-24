# Pendientes del proyecto

Última actualización: 2026-04-24

## 🔴 Infraestructura — URGENTE (Fernando pidió revisar mañana)

### Problema detectado hoy
Vercel Hobby limita a **12 serverless functions**. Ya estamos en el límite (12/12). El próximo endpoint que necesite una función serverless rompe los deploys.

### Plan Vercel actual
- **Hobby** (gratuito): 12 funciones, 1 cron job schedule (recientemente expandido a 2), 100 GB-hours de ejecución, timeout 10s.

### Opciones a evaluar
1. **Vercel Pro** (~$20/mes por miembro):
   - 1000 GB-hours
   - Funciones ilimitadas
   - 40 cron jobs, cualquier schedule (no solo diario)
   - Timeout 60s
   - Análisis más profundos de uso
   - Passwords en preview deployments (útil para testear OCs antes de producción)

2. **Migrar a otro hosting**:
   - Railway, Render, Fly.io — pero implica más trabajo manual.
   - Supabase Edge Functions (ya lo tenemos pago mensual): podríamos mover lógica de API a Edge Functions y liberar funciones de Vercel.

### Recomendación mía
**Vercel Pro** por estas razones:
- El proyecto va a crecer (Estado de Resultados, RRHH, Finanzas, Operaciones, KPIs Ejecutivos están en roadmap).
- Cada módulo nuevo probablemente necesita 1-2 funciones serverless.
- $20/mes es bajo para la criticidad del sistema.
- Sin cambios de código, todo sigue funcionando igual.
- Permite cron jobs con schedule arbitrario (útil para sincronizaciones más frecuentes).

### Cambios que habilitaría upgrade a Pro
- Separar el `/api/cron.js` en endpoints distintos otra vez (más limpio).
- Sincronizar Master Embarques cada hora en vez de diario.
- Cron de cruce OCs↔ERP cada 2 horas (para que fill rate esté actualizado en tiempo real).
- Otros endpoints específicos (ej. webhook de WhatsApp para notificaciones).

### Aparte del hosting
- **Supabase**: probablemente tenemos plan gratuito. Para proyecto serio conviene verificar el plan. Pro cuesta $25/mes y da:
  - 8 GB DB + auto-backup diario
  - 100 GB bandwidth
  - Edge Functions pagadas
  - Mejor soporte
- **Mercado Libre API**: sin costo, pero bloqueado por OAuth + datos. Pendiente activar.
- **Google Sheets (Master Embarques)**: gratis. Solo requiere compartir el sheet como "anyone with link".

### Pregunta para Fernando
1. ¿Upgradeo a Vercel Pro? ($20/mes)
2. ¿Upgradeo a Supabase Pro? ($25/mes — recomendado por auto-backups)
3. ¿Quieres que documente una estrategia de backup/restore por si algo falla?

---

## 🟡 Pendientes funcionales

### Sprint siguiente (cuando prueben Resumen/Forecast/OCs)
- [ ] Verificar que métricas de Resumen Clientes cuadren 1:1 con HomeCliente y CreditoCobranza.
- [ ] Validar parser PCEL PDF con varias OCs reales.
- [ ] Validar parser Digitalife Excel con 2-3 pedidos distintos.

### Configuración de auto-sync (bloqueado por Fernando)
- [ ] En Vercel → Settings → Environment Variables agregar:
  - `MASTER_EMBARQUES_SHEET_ID` = ID del Google Sheet de Master Embarques
  - `MASTER_EMBARQUES_SHEET_NAME` (opcional, default año actual)
  - `CRON_SECRET` = string random para proteger el endpoint
- [ ] Compartir el Google Sheet como "Anyone with the link can view"
- [ ] Probar botón "⚡ Auto-sync ahora" en `/uploads.html`

### Datos faltantes (Fase 2)
- [ ] **Datos de otros clientes** para canibalización cross-empresa real (Fernando dijo "después")
- [ ] **Integración ML OAuth** + primera carga de datos (bloqueado por credenciales)
- [ ] **Sellout Digitalife** histórico completo en `sellout_detalle`
- [ ] **Re-upload ERP** (la primera carga falló antes del fix de `cantidad`)

### Módulos futuros (Roadmap)
- [ ] Estado de Resultados
- [ ] Operaciones
- [ ] Compras (consolidar lo del Forecast)
- [ ] RRHH
- [ ] Finanzas
- [ ] KPIs Ejecutivos

### Mejoras menores de UI
- [ ] Tareas recurrentes de Karolina (Fernando dijo que me las pasa)
- [ ] Link desde Forecast Clientes → Órdenes de Compra filtradas por SKU
- [ ] Botón "Ver en Forecast" desde la tarjeta de cliente en Resumen

---

## ✅ Ya completado esta semana

### Administración Interna (3 fases)
- Tabs dinámicos, multi-responsable + responsables libres
- Subtareas con auto-complete
- Botón posponer al siguiente día hábil
- Minutas con acuerdos vinculados a pendientes
- Tareas recurrentes con cron de auto-generación
- Mini-menú de filtros
- Notification API
- Filtros avanzados

### Dashboard ejecutivo (3 sprints)
- **Resumen Clientes v2**: Health Score con 5 componentes ponderados, alertas cross-cliente, cuota YTD vs YTD, DSO real considerando plazo de 90 días, cobertura de inventario en días con umbrales bidireccionales, trend 12 meses consolidado.
- **Forecast Clientes v2**: demanda agregada DGL+PCEL+ML, inventario comercial (whitelist 9 almacenes), tránsito desde Master Embarques, brecha, preventa, canibalización, prorrateo PCEL/DGL (ML excluido), sugeridos con auto-close, export Excel para junta de compras.
- **Órdenes de Compra** (nueva pestaña): parser PCEL PDF, parser Digitalife Excel con colores = facturas, preview editable, cruce automático con ventas_erp por referencia de OC, fill rate por línea/OC, estados (abierta/parcial/completa/vencida), auto-cierre a 15 días + 95%.

### Infraestructura
- Migraciones SQL (9 nuevas): almacenes_config, ordenes_compra, ordenes_compra_detalle, sugeridos_compra, vistas v_inventario_comercial, v_transito_sku, v_lead_time_sku, v_lead_time_supplier, v_sku_metadata, v_demanda_sku, v_ventas_mensuales_agg, v_dso_real.
- Master Embarques cargado (462 registros) con parser que detecta entregas directas a clientes externos (DECME).
- Cron diario para sync Master Embarques + cruce OCs↔ERP.
