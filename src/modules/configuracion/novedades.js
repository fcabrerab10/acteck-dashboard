// Novedades cortas por versión (Administración → Sistema). Lista estática: se agrega una entrada
// por cada minor/major que sube package.json (regla de versionado en CLAUDE.md → Flujo de trabajo).
// Orden: la más reciente primero.
export const NOVEDADES = [
  {
    version: '3.16.0', fecha: '2026-09-11', titulo: 'Sell In consolidado en el celular',
    items: [
      'Sell In de toda la empresa en el móvil: mes actual o cualquier mes, MTD vs cuota, por canal con tendencia, composición por categoría y marca, top SKUs y "Compartir resumen del mes por canal".',
      'Ficha del SKU: heatmap de 6 meses, qué clientes lo compran y cuántas piezas al mes, disponibilidad con próximo arribo y "Compartir disponibilidad".',
      'Pills de frescura por fuente (ERP, Sell In, Inventario, Estados de cuenta) con su propia última carga; Estado de Resultados fuera del menú móvil; permiso sensible aplicado en todas las pantallas.',
    ],
  },
  {
    version: '3.15.0', fecha: '2026-09-11', titulo: 'Gráficas lineales y trimestres combinables',
    items: [
      'Todas las gráficas de evolución mensual (antes barras) usan la misma gráfica de líneas: punto por mes, año anterior punteado, cuota, máximo y mínimo, y valores del mes en la cabecera al pasar el cursor.',
      'Selector de trimestres combinable (Q1 a Q4 y Año) en Sell In, Sell Out y Home por cliente; KPIs y tablas suman los meses marcados y la gráfica atenúa los demás. La selección se recuerda por pantalla.',
    ],
  },
  {
    version: '3.14.0', fecha: '2026-09-10', titulo: 'Agenda en el celular',
    items: [
      'Hoy en lista (deslizar a la derecha = hecho, a la izquierda = posponer) o Tablero deslizable por cliente, persona o categoría; elegible en Preferencias.',
      'Captura rápida con texto o voz entendiendo #cliente, @persona y fechas en lenguaje natural ("el viernes", "en 3 días", "15 sep").',
      'Minuta en vivo con guardado al momento, Cerrar reunión, Clientes con lo abierto de cada uno y Semana de sólo lectura.',
      'Historial de cambios con acciones en lenguaje de negocio y filtros con conteo.',
    ],
  },
  {
    version: '3.13.0', fecha: '2026-09-10', titulo: 'Agenda, Estado de Resultados y Actividad del equipo',
    items: [
      'Agenda (debajo de Inicio) sustituye a Pendientes & Calendario: bandeja Hoy o tablero por etiqueta (elegible en Preferencias), #cliente y @persona, reuniones con línea del tiempo y puntos clasificados, minuta con guardado al momento, arrastre de lo abierto, avisos por responsable y conexión con Google Calendar.',
      'Bloque "Hoy" en Inicio con la bandeja de la Agenda.',
      'Estado de Resultados en kit V3: Mes y acumulado con comparativo, puente ventas del ERP vs P&L, ficha del mes como hoja lateral; toda la pestaña es información sensible.',
      'Actividad del equipo: pulso del equipo, qué hizo cada quien (auditoría en lenguaje de negocio), cumplimiento de pendientes, inactividad con alerta y evaluación sólo para quien se marque "Se evalúa".',
    ],
  },
  {
    version: '3.12.0', fecha: '2026-09-10', titulo: 'Tracking Pedidos',
    items: [
      'Pestaña rehecha desde cero conservando las 105 OCs capturadas: embudo cotización → OC → facturada → enviada → entregada, backorder por SKU, surtir hoy, tiempos por etapa.',
      'Facturas del ERP ligadas solas por referencia o por folio, con sus partidas (SKU, piezas, precio y total): ya no se capturan producto por producto.',
      'Guías del ERP con captura manual cuando no lleguen y aviso de desfase de fechas; "Pegar correo" para registrar una OC; alertas de OC detenida, backorder sin PO y factura sin OC.',
    ],
  },
  {
    version: '3.11.0', fecha: '2026-09-10', titulo: 'Forecast',
    items: [
      'Reservas en kit V3: buscador y filtros con conteo, método 3 meses · 6 meses · ponderado, drill del SKU con arribos, stock del cliente y reservas anteriores, propuesta de reserva como hoja lateral con "Compartir".',
      'Avisos de arribo (3 días antes y el día) ahora llegan por la central de notificaciones.',
      'Forecast CRM: captura de forecast por cliente y SKU a 6 meses con justificación, sugerido del motor, autoguardado y exportación en la plantilla exacta del CRM.',
      'PCEL ahora toma su sell-out del reporte semanal (antes salía en cero).',
    ],
  },
  {
    version: '3.10.0', fecha: '2026-09-10', titulo: 'Estrategia de Precios',
    items: [
      'Kit V3, buscador por palabras y filtros con conteo; Mayoreo AAA primero y las demás listas a la derecha.',
      'Histórico de precios que se llena solo con cada carga del puente (desde el 10 sep 2026): cambios del mes y evolución por lista en el drill.',
      'Margen por lista sólo con permiso sensible; precio bajo accionable por cliente con lo dejado en la mesa, exportable.',
      'Drill del SKU: precio real por cliente vs su lista, "Compartir precio", elasticidad por cambio de precio, simulador de precio con venta estimada, precio de la competencia y precio bajo por SKU.',
    ],
  },
  {
    version: '3.9.0', fecha: '2026-09-10', titulo: 'Propuestas',
    items: [
      'Kit V3 en todo el flujo: tarjetas de cliente en la portada, entrada directa a armar, catálogo con buscador y filtros con conteo, revisar como hoja lateral.',
      'Propuestas guardadas en la base con estados Borrador · Enviada · Cerrada (cierre automático al facturar) y % de conversión contra la facturación.',
      'Sugeridos al principio del catálogo (sombreados, se aceptan uno a uno o todos), autoguardado, memoria de precio por SKU, duplicar y compartir por WhatsApp.',
      'Margen y costo sólo con permiso sensible; vigencia automática a fin de mes.',
    ],
  },
  {
    version: '3.8.0', fecha: '2026-09-10', titulo: 'S&OP y Resumen de Clientes',
    items: [
      'S&OP en el kit V3: buscador por palabras, filtros con conteo, costos sólo con permiso sensible, drill con demanda 12 meses y cobertura proyectada, carrito de export como hoja lateral con "Compartir export".',
      'S&OP · Reuniones: repositorio de la reunión mensual pegando el correo del CRM, con cruce por línea contra sugerido, stock, tránsito y PO, y cumplimiento de la reunión.',
      'Resumen de Clientes: selector de mes, doble cuota (mínima e ideal), alertas desde la central, MC % sensible, "Compartir avance" y menú "Ir a".',
    ],
  },
  {
    version: '3.7.0', fecha: '2026-09-10', titulo: 'Inventario',
    items: [
      'Buscador por palabras sin acentos y filtros con conteo (estado, CEDIS, marca, familia, roadmap, con stock, con tránsito).',
      'Costos y valor a costo sólo con el permiso "Información sensible"; sin él la pantalla se lee en piezas y días.',
      'Drill del SKU con "Compartir disponibilidad" (lista de precios obligatoria), precios vigentes por lista y quién lo compra.',
      'Canasta de SKUs para compartir varios en un solo mensaje, panel de próximos arribos (7/14/30 días) e histórico diario del inventario.',
    ],
  },
  {
    version: '3.6.0', fecha: '2026-09-10', titulo: 'Visión General, Análisis por Cliente y Sell In consolidado',
    items: [
      'Permiso "Información sensible" en Administración: sin él no se ven márgenes, contribución ni costos.',
      'Visión General: cuota del mes en el hero, mix por canal, marca y categoría, rentabilidad en líneas e inventario con KPIs básicos.',
      'Análisis por Cliente: tabla por código ERP con medidas completas, drill con tendencia, grupo "Otros · compra ocasional" y Pareto.',
      'Sell In consolidado: tabla por SKU multi-año, buscador por palabras sin acentos, filtros con conteo, drill del SKU con clientes, disponibilidad y precios, y "Compartir resumen del mes por canal".',
    ],
  },
  {
    version: '3.3.0', fecha: '2026-09-10', titulo: 'Administración',
    items: [
      'Configuración pasa a Administración: Usuarios y permisos · Datos · Notificaciones del equipo · Sistema.',
      'Permisos por pestaña con guardado al instante, "Copiar permisos de…" y "Ver como" (menú que vería el usuario).',
      'Preferencias de notificación de cada usuario interno editables por el super admin.',
      'Retención de auditoría (purga a 365 días) y estado de servicios desde el dashboard.',
    ],
  },
  {
    version: '3.2.0', fecha: '2026-09-10', titulo: 'Importador central',
    items: [
      'El importador vive dentro del dashboard: automáticas con latido del puente y "Pedir corrida", manuales por grupo con anillo de frescura y arrastrar y soltar.',
      'Parsers compartidos en src/lib/parsers/; uploads.html queda como respaldo técnico.',
    ],
  },
  {
    version: '3.1.0', fecha: '2026-09-11', titulo: 'Menú, Inicio, notificaciones y perfil',
    items: [
      'Menú de tres modos (Barra · iPad · iPhone) y paleta ⌘K; preferencias guardadas en el perfil.',
      'Pestaña Inicio de dirección general (Mes/Año) sobre las medidas del ERP.',
      'Centro de notificaciones estilo iOS con pilas por área y resumen programado a las 09/13/18.',
      'Perfil con foto ilustrada y panel rápido desde el avatar.',
    ],
  },
  {
    version: '3.0.0', fecha: '2026-09-09', titulo: 'V3',
    items: [
      'Kit de piezas (Hero, KPI, Pill, Segmented, Panel, Tabla compacta, Toast) y loader de silueta.',
      'Home único por cliente, frescura de datos por pantalla y versionado visible.',
      'Ferruteck retirado de la interfaz; arranque 6× más ligero (bundle por pantalla).',
    ],
  },
];
