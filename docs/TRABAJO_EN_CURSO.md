# Trabajo en curso · celular y Agenda (desde 2026-10-05)

Lista viva de todo lo acordado con Fernando. Se marca al publicar y verificar en producción. Regla: nada se da por hecho sin verlo con la sesión de Fernando en el Browser pane.

## Publicado
- [x] Inicio del celular rápido de leer (3.77.0–3.77.1): hero, gráfica 2026 vs 2025 con lectura al arrastrar, 4 tarjetas, pay del mix; sin agenda ni «requiere decisión».
- [x] Agenda «que te lleva» (3.78.0–3.78.1): armar el día desde el negocio, guía una a la vez, cierre; hilos Mis clientes · Área de ventas · Internos · Personales; horas 9/15/17/22; web y celular.
- [x] iPad mini: vertical = celular, horizontal = web (3.76.11).
- [x] Historial de cambios sin ruido, lista de precios en una petición, Propuestas 9,653 precios, etc. (3.76.x).

- [x] Recordatorios de la Agenda a las 9:00 y 22:00; «Mi ritmo»; «Su día» en Actividad del equipo (3.79.0).
- [x] Análisis por cliente (celular) (3.79.0–3.79.1), mockup aprobado (artifact 6ecfc3fe): lista estándar · Resumen del cliente (hero, 4 tarjetas, sell in vs sell out, «Dónde está el movimiento», categorías como pay, cuotas por Q) · Sell In con Piezas · $ · Sell Out por cuenta según lo que reporta + detalle por SKU · «Abrir sell out completo» = la cuenta frente al resto (ranking, peso, SO/SI vs promedio, oportunidades, inventario en cuenta, clientes finales nuevos/perdidos).

- [x] Sell Out global y Sell In global con tabla por SKU (3.80.0–3.80.1).
- [x] Producto 360 (3.81.0–3.81.1).
- [x] Inventario (3.81.0) y Estrategia de Precios con calculadora y propuesta (3.81.0).
- [x] S&OP del celular en blanco: corregido (3.80.1).
- [x] S&OP (celular) Empresa · Mis clientes, Lo que viene con PO abrible, Producto 360 · Abasto, Proyectos y forecast con «Los tres» y captura del forecast en formato CRM desde el celular (3.83.0).
- [x] «Resumen de Clientes» fuera del menú web (3.83.0).
- [x] Clientes propios (celular): ficha nueva Resumen · Sell In · Sell Out · Marketing · Cobranza para Digitalife, PCEL y Dicotech con las reglas de Fernando (3.84.0–3.84.2; verificada con su sesión el 6-oct).

- [x] Velocidad y «cada rato carga» en el iPad (3.89.0): la caché de datos ya sobrevive a los deploys, las pestañas abren al instante con lo cacheado y refrescan atrás, y un deploy ya no recarga la pestaña que está en otra app.

- [x] Del celular a la web (3.90.0–3.90.1): ticket promedio por cuenta en Sell Out, buscador que entiende (Propuestas · Inventario · Precios), calculadora de precio con propuesta en curso, «Qué le falta» en el Resumen del cliente, S&OP «Mis clientes» y «por qué N pz», Inventario con cambio mensual y stock al cierre por SKU, conversión ponderada en Propuestas, Actividad del equipo con 4 semanas, ritmo, WhatsApp y reasignar.

- [x] Seguridad de externos a nivel de datos (3.91.0, 8-oct): Camilo (Digitalife) ya sólo puede leer lo de Digitalife y sin costos ni márgenes, también por la API; internos sin cambios.

- [x] «Dónde está el movimiento» (Resumen y Sell Out del cliente) y «<Cuenta> frente al resto» (Sell Out del cliente) en la web (3.92.0).

## Web pestaña por pestaña (desde el 8-oct, orden del árbol del menú)
- [x] Inicio (3.93.0): propuesta B con el orden que fijó Fernando (1 este mes · 2 el año · 3 para decidir y resumen del negocio).
- [x] Agenda V6 «que te lleva» (3.94.0, 8-oct): pop-up «Organiza tu día» en toda la app (cierra ayer primero), Hoy único que cambia con la hora, captura libre sin etiquetas (personas, clientes, mandar a varios), Lo que mandé, Por cliente, acciones optimistas con Deshacer, teclado 1–6/H/M/↵ y gestos; verificada web y celular con la sesión de Fernando.
- [ ] Siguen: Pendientes (dentro de la Agenda, con las reglas de la V6) → Estado de Resultados → Análisis por Cliente → Sell In → Sell Out → Inventario → Estrategia de Precios → S&OP → Proyectos y forecast → Propuestas → Tracking → Pagos → Crédito y Cobranza → clientes propios → Actividad del equipo → Administración.

## Aprobado, por construir
- [x] Pagos del cliente propio (celular): pestaña Pagos en la ficha con flujo del mes, rebate según la regla, apoyo por producto, apoyos por costo convenio y reglas editables (% y base) (3.85.0–3.85.1).
- [x] Cobranza general (celular) rehecha con el formato estándar sobre los tres propios (3.86.0).
- [ ] **Cartera de TODO el ERP** (Fernando: se trabaja hasta noviembre 2026): la base sólo tiene estados de cuenta de los tres propios; falta una vista de cuentas por cobrar del ERP por el puente (no tocar `bridge/` en el viaje). Cuando exista, Cobranza general la toma sin cambiar de formato.
- [x] Propuestas (celular) rehechas: lista estándar, sugeridos en el armador, Revisar con lista por SKU y sus otros precios, WhatsApp · Excel · Enviar (3.87.0).
- [x] Actividad del equipo (celular) rehecha según el mockup 2c58bf4c aprobado: Equipo (hero, 4 tarjetas, actividad por día 4 semanas, umbral en chips, lista con ritmo · día armado · plan vs real · vencidos · estado, externos plegados) · Persona (ritmo en el sub, Su día · Semana · Pendientes · Evaluación, hero del día, 4 tarjetas, mandar mensaje, reasignar pendientes) · Evaluación (hero con resultado y bono, dictado, «Cerrar evaluación», abre en el mes por cerrar) (3.88.0–3.88.1; verificada con la sesión de Fernando el 6-oct). 3.88.2: celular en el perfil (Preferencias › Yo y Administración) para que «Mandar mensaje» abra WhatsApp directo.
- [x] Correos: plantilla del dashboard en todos (vigilante, reservas y arribos pasaban en texto plano) (3.85.2); prueba del vigilante pedida para la corrida de las 07:20.
- [ ] Revisión de Fernando de lo publicado del 6 al 8 de octubre: S&OP y Proyectos y forecast (3.83), ficha de clientes propios con Pagos (3.84–3.85), Cobranza general (3.86), Propuestas (3.87), Actividad del equipo (3.88) y lo traído a la web (3.90).
- [x] Sell Out global (celular) (3.80.0), mockup 2b9599a5: hero, 4 tarjetas, gráfica vs año anterior, pay del mix, **tabla de detalle por SKU × 12 m** con Piezas · $, ordenar por cualquier columna y buscador que entiende (chips con lo entendido). Sin cuentas.
- [x] Sell In global (celular) (3.80.0): mismo esqueleto con cuota, margen y clientes que compraron; tabla por SKU igual. Sin tabla de clientes.
- [x] Producto 360 (3.81.0): hero completo (sell in, sell out, SO/SI, inventario nuestro, en cuentas, en camino), gráfica sell in vs sell out, Segmented «Quién lo desplaza · Quién lo compra» (ranking con piezas, Δ, semanas de inventario; clientes que dejaron de comprarlo), dónde se vende. Botones conectados: Preparar propuesta (canasta precargada + cliente + sugerido), Proponer (cliente puesto + pendiente en la Agenda), Ver en Inventario (buscador con el SKU), Precios (Ficha de producto). Cuentas y clientes tocables → Análisis por cliente.

## Responsivo (lo que Fernando reportó el 5-oct)
- [x] Inicio celular: gráfica y pay con sus 16 px; gráfica medida al ancho con altura fija (GraficaScrub, 2026-10-05).
- [x] Misma regla en Agenda Día y en las pantallas nuevas (todas usan la GraficaScrub genérica).
- [x] Auditoría sin capturas (8-oct, 3.92.1): a 393×852 (iPhone) y 744×1133 (iPad mini vertical) no hay desbordes ni contenido tapado; los botones de texto que medían 17–23 px (chips de pay, «Año completo ›», «hora de cerrar el día») ya tienen 30–34 px de área táctil. Si en el iPhone real algo sigue mal, una sola captura basta para reproducirlo.

## Reportado el 5-oct, por atender
- [x] S&OP en el celular «ni siquiera me deja verla» (corregido 3.80.1 y rehecha en 3.83.0): reproducir con la sesión de Fernando y corregir.

## Siguiente en la web (pedido el 8-oct, noche)
- [x] Análisis por cliente (3.95.1): fuera Pareto y Comparador; dentro «Quién se mueve» y «A quién llamar hoy» (eligió sólo esos dos del mockup b6c25d79). Siguiente: Sell In (quiere el sell in por día del mes).

## Pendientes de Fernando
- [ ] Pasarme los celulares de Karolina y David (con lada) para capturarlos en Administración → Editar datos; así «WhatsApp» en Actividad del equipo abre directo su chat.
- [ ] Semana de ensambles 31 ago–6 sep 2026 (está en el correo de Alejandro del 7-sep; Google pide verificación para bajarla desde Chrome).
- [ ] Lista completa de empleados y puestos (para la Ciudad).
- [ ] Folio de sell out mutilado: se corrige en la base SELLOUT de la oficina.
- [ ] Dudas de medidas del director (§6 de docs/MEDIDAS_DIRECTOR.md).
