# Acteck Ciudad · plan por etapas y pendientes del agente nocturno

Lista viva para la tarea programada `acteck-ciudad-nocturno` (Mac mini, cada hora; ver horario y reserva de uso en CLAUDE.md).
Cada corrida toma el **primer pendiente sin marcar** (de arriba hacia abajo), lo termina, lo publica y
lo mueve a «Hecho» con fecha, versión y una línea de qué cambió. Si un pendiente no cabe en una
corrida, se parte aquí mismo en sub-pasos `- [ ]` y se hace sólo el primero. Fernando puede reordenar o
agregar renglones cuando quiera (desde la laptop: sólo este archivo).

## La idea (aprobada por Fernando 2026-10-05)

Referencias de juego: Hay Day, Clash of Clans y Simpsons Tapped Out (base, viajes, burbujas, misiones); SimCity (capas de información); Cities: Skylines (seguir personas/vehículos, bitácora); Two Point Hospital (interiores con personal); RollerCoaster Tycoon (pensamientos); Anno 1800, Factorio y OpenTTD (cadena de suministro y cargas); Mini Motorways y Townscaper (claridad y estética); Animal Crossing (tiempo y calendario reales); Gather (oficina con presencia).

Que la Ciudad se use como un juego de construir y visitar (Hay Day, Clash of Clans, Simpsons Tapped Out):
**tu base** (Acteck en Guadalajara: oficina, CEDIS, puerto) se ve de cerca y viva; un **mapa de México**
para viajar a cada ciudad y **visitar** sus tiendas; cada edificio se **toca** y muestra su información
con los mismos números del dashboard y un botón para abrir esa pestaña; lo que pide atención aparece
como **burbuja** encima del edificio. Tan fácil, entendible y rápida como el dashboard.

Principios que no se rompen en ninguna etapa:
- **Mismos números que el dashboard**: cada dato sale de la misma vista/medida que usa la pestaña equivalente (nunca cálculos propios que puedan no cuadrar).
- **Nada escala por tamaño de cliente**; lo que se ve es actividad y estado.
- **Rápida**: arranca en < 2 s con datos en caché, 60 fps en computadora y 30 en iPad; `three` y la escena siguen cargándose sólo al abrir la pestaña.
- **Cada capa falla sola** sin tirar la ciudad; errores visibles en pantalla, nunca lienzo negro.
- **Un toque = una respuesta**: todo lo tocable reacciona (resalta al pasar, se anima al tocar).

## Mapa edificio ↔ pestaña del dashboard (referencia para todas las etapas)

| En la ciudad | Pestaña / datos |
|---|---|
| Oficina (salas, escritorios) | Inicio, Agenda, Equipo, Minutas |
| CEDIS (racks, montacargas, andenes) | Inventario, Abasto/sugeridos de compra |
| Puerto (barcos, contenedores, grúa) | Embarques / tránsito, Compras OC |
| Banco / tesorería | Pagos, Cobranza, cartera vencida |
| Torre de pronóstico | Forecast, S&OP |
| Tiendas de cada ciudad | Sell out por cuenta y sucursal |
| Camiones en carretera | Facturas, guías, Tracking de OC de clientes |
| Vallas / espectaculares | Marketing, apoyos, spiffs |
| Mercado / tianguis | Precios |

## Pendientes (en orden)

### Etapa 1 · Cimientos: ordenar y hacerla rápida (antes de crecer)
- [x] Partir `escena.js` en módulos dentro de `src/modules/ciudad/escena/` (`camara.js`, `terreno.js`, `edificios.js`, `gente.js`, `vehiculos.js`, `etiquetas.js`, `interaccion.js`, `luz-clima.js`) sin cambiar nada visible; `escena.js` queda como orquestador. Verificar en el harness que se ve idéntico.
- [x] Dibujar sólo cuando hace falta: si no hay animación visible ni la cámara se mueve, bajar a ~10 fps; pausar del todo con la pestaña oculta (`document.hidden`). Limitar `devicePixelRatio` a 2.
- [ ] Objetos repetidos con `InstancedMesh` (árboles, personas, tiendas, coches) y materiales compartidos; medir antes/después (llamadas de dibujo y fps) con un contador en el harness (`?fps`).
- [ ] Nivel de detalle por zoom: lejos sólo volúmenes y etiquetas de ciudad; cerca, gente, ventanas y letreros. Las etiquetas se ocultan por prioridad para no encimarse.
- [ ] Liberar memoria al salir de la pestaña (geometrías, texturas, materiales) y comprobar que entrar y salir 5 veces no crece la memoria.

### Etapa 2 · Base y mapa (dos niveles, como Clash of Clans)
- [ ] **Vista Base**: Guadalajara de cerca con la oficina, el CEDIS y el puerto juntos en un «campus» con calles, más grande y detallado. Es la vista inicial.
- [ ] **Vista Mapa de México**: país completo con cada ciudad como un pin/maqueta pequeña con su estado (tiendas activas, camiones llegando). Botón fijo «🗺 Mapa» / «🏠 Base».
- [ ] **Viajar**: tocar una ciudad en el mapa → transición animada (acercamiento) a la **Vista Ciudad** con sus manzanas y tiendas; botón «← Volver al mapa». Sólo se dibuja el nivel visible (mejora el rendimiento).
- [ ] Minimapa en una esquina con dónde estás y acceso rápido a Base, Mapa y las 5 ciudades con más actividad.
- [ ] Guardar la última vista (nivel, ciudad, zoom) por usuario en `localStorage` con try/catch.

### Etapa 3 · Edificios visitables (tocar y ver)
- [ ] **Tarjeta del edificio** al tocar (estilo menú de Hay Day, flotando junto al edificio, no panel lateral): nombre, 3–4 números clave de su pestaña, estado (verde/ámbar/rojo) y botón «Abrir en el dashboard». Una sola plantilla para todos.
- [ ] Banco/tesorería nuevo en la base (Pagos y cobranza: cartera vencida, pagos de la semana) y torre de pronóstico (Forecast: precisión, avisos), con datos de las vistas que ya usan esas pestañas.
- [ ] **Interior del CEDIS**: al entrar, racks por familia/marca con su nivel de inventario y días de inventario (`v_medidas_inventario_*`), montacargas moviéndose si hubo salidas hoy.
- [ ] **Interior del puerto**: cada barco/contenedor tocable con PO, proveedor, ETA y piezas (`v_embarques_contenedor`).
- [ ] **Interior de la oficina**: salas con las reuniones de hoy (agenda), escritorios por persona con su foto/nombre y su pendiente principal.
- [ ] **Presencia en la oficina** (como Gather): cada persona aparece en reunión, de viaje o disponible según su agenda de hoy.
- [ ] **Tienda visitable**: tocar una tienda → su sell out del mes vs mes anterior, top 5 SKUs, inventario en tienda si hay, y «Abrir en Sell Out».

### Etapa 4 · Burbujas de atención y barra superior (que avise como juego)
- [ ] **Barra superior tipo recursos**: Ventas del mes vs cuota (barra de progreso), Inventario comercial, Cartera vencida, Embarques en tránsito. Mismos números que Inicio. Tocar cada recurso lleva a su edificio.
- [ ] **Burbujas sobre edificios** cuando algo pide atención (cartera vencida, inventario bajo de un SKU A, barco llegando en ≤ 3 días, OC de cliente atrasada, reunión en 15 min). Tocar la burbuja abre la tarjeta del edificio con ese tema.
- [ ] **«Hoy en Acteck»** como lista de misiones del día (las mismas alertas y pendientes del dashboard), cada una con «Ir» que vuela al lugar.
- [ ] **Capas de información** (como SimCity): botones «Ventas · Inventario · Cartera · Cuota» que pintan ciudades, manzanas y edificios con una escala de color de ese dato (leyenda visible, «Sin capa» para volver). Mismos números que su pestaña.
- [ ] **Bitácora en vivo** (como el Chirper de Cities: Skylines): tira de eventos recientes de la empresa — facturas grandes, contenedores que llegan, OCs surtidas, pagos registrados, reuniones que empiezan — cada uno con «Ver» que vuela al lugar. Sólo de tablas que ya existen (`sync_events`, facturas, embarques, pagos, agenda).
- [ ] **Pensamientos** (como RollerCoaster Tycoon): burbujas cortas sobre tiendas y clientes que resumen su situación en lenguaje natural («Me falta inventario de AC-944571», «30 días sin comprar», «Voy arriba de mi cuota»), generadas con reglas del modelo, máximo unas pocas visibles a la vez.

### Etapa 5 · Gente y vehículos con sentido
- [ ] Vendedores con rutas reales entre las sedes de sus clientes (ya vienen en el modelo); su etiqueta dice a quién visitan; tocarlos muestra sus ventas del mes.
- [ ] Camiones por guía real (`guias_erp` con destino) del CEDIS a la ciudad destino; facturas de 10 días como respaldo si la guía no trae ciudad. Tocar un camión → cliente, factura/guía, piezas.
- [ ] Barcos que entran al puerto según su ETA real y descargan contenedores al llegar.
- [ ] Cuentas sin sucursal repartidas por estado (`CIUDAD_POR_ESTADO`) para que ninguna ciudad con ventas quede vacía.
- [ ] **Seguir a alguien** (como Cities: Skylines): en la tarjeta de un vendedor, camión o barco, botón «Seguir» que deja la cámara pegada a él con una ficha de su recorrido; cualquier arrastre o «Esc» lo suelta.
- [ ] **Flujo de mercancía de punta a punta** (como Anno 1800 / Factorio): vista «Cadena» que dibuja el recorrido barco → puerto → CEDIS → camión → tienda → cliente final con el volumen de cada tramo, y marca en rojo dónde se atora (barco atrasado, días de inventario altos, tienda sin inventario).

### Etapa 6 · Dinero, tiempo y celebraciones
- [ ] Cuota vs ritmo por ciudad/cuenta: banderín o halo verde-ámbar-rojo en la manzana y el dato en su tarjeta (vista de cuotas que ya usa el dashboard).
- [ ] Celebraciones discretas: fuegos artificiales sobre la base al cruzar la cuota del mes; confeti en una tienda que vuelve a vender tras 30 días sin venta.
- [ ] Barra de tiempo: «Hoy / Ayer / Hace 7 días / Inicio de mes» que reconstruye la ciudad con los datos de esa fecha.
- [ ] **Eventos del calendario comercial** (como Animal Crossing): decoración y avisos según la fecha real — cierre de mes (cuenta regresiva en la base), Buen Fin, regreso a clases, Navidad — con su efecto en la ciudad (más camiones, letreros de promoción) usando sólo fechas y datos existentes.

### Etapa 7 · Arte y sensación de juego
- [ ] Kit de piezas low-poly propio (edificios con bordes biselados, techos, ventanas iluminadas de noche, árboles variados) en lugar de cajas lisas; paleta cálida consistente con el sistema de diseño del dashboard (`docs/DESIGN_SYSTEM.md`).
- [ ] Animaciones de respuesta: el edificio «rebota» al tocarlo, burbujas que flotan, transiciones suaves de cámara con easing, gente que saluda al pasar el cursor.
- [ ] Recorrido de bienvenida la primera vez (3 pasos: así se mueve, así se toca un edificio, así se viaja) y botón «?» para repetirlo.
- [ ] Sonido ambiente opcional (apagado por defecto, interruptor en la esquina).

### Etapa 8 · iPad, celular y para el equipo
- [ ] Gestos táctiles completos (un dedo mueve, pellizco acerca, dos dedos giran, toque largo = info) y botones grandes; versión ligera automática en `pointer: coarse` (menos gente, sin sombras).
- [ ] Abrir la Ciudad a más usuarios respetando sus permisos: cada quien ve sólo los edificios de las pestañas a las que tiene acceso (requiere que Fernando apruebe quién entra).

### Siempre (cuando no quede nada arriba)
- [ ] Pulido: rendimiento, legibilidad de etiquetas, pruebas nuevas en `scripts/test-ciudad-modelo.mjs`, comparar números de cada tarjeta contra su pestaña del dashboard.

## Necesita a Fernando (el agente no lo hace)

- Nombres del personal de almacén/ventas que no está en el dashboard.
- Cualquier vista o tabla nueva en Supabase (el agente no corre migraciones).
- `~/acteck/ciudad/.env.local` con `SUPABASE_ACCESS_TOKEN` para probar con datos reales en el harness.
- Etapa 8: quién más puede entrar a la Ciudad.

## Hecho

<!-- El agente agrega aquí: - AAAA-MM-DD HH:MM · vX.Y.Z · qué cambió (una línea) -->
- 2026-10-05 15:20 · v3.76.8 · `escena.js` partido en `escena/` (camara, luz-clima, terreno, edificios, gente, vehiculos, etiquetas, interaccion) con un `ctx` compartido; `escena.js` sólo orquesta. Sin cambios visibles (harness día/noche sin errores). `preparar-harness.mjs` copia también `escena/`.
- 2026-10-05 15:40 · v3.76.9 · Dibujar sólo cuando hace falta: pausa total con la pestaña oculta (`visibilitychange`), modo calma a ~10 fps tras 15 s sin gestos y con la cámara quieta, cualquier gesto vuelve a 60 (medido en harness con reloj simulado: 60 → 10 → 60 fps). `devicePixelRatio` ya estaba topado en 2.
