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
- [x] Objetos repetidos con `InstancedMesh` (árboles, personas, tiendas, coches) y materiales compartidos; medir antes/después (llamadas de dibujo y fps) con un contador en el harness (`?fps`).
  - [x] Medidor en el harness (`ciudad-dev?fps`, ojo: el servidor quita el `.html` y la query) y `esc.stats({ dibujar })`; árboles a 4 `InstancedMesh`. Base harness de ejemplo: 1092 llamadas · 1110 geometrías · ~2.2 ms CPU/cuadro → 905 · 886 · ~1.8 ms.
  - [x] Geometrías compartidas en `box()` y ventanas (hoy cada caja crea su `BoxGeometry`: 886 geometrías): caché por medidas o caja unitaria escalada.
  - [x] Tiendas y casitas de clientes finales instanciadas (cuidando que la tienda siga tocable: raycast con `instanceId` → tag).
  - [x] Personas y coches/camiones instanciados (se mueven: actualizar `instanceMatrix` por cuadro).
- [x] Nivel de detalle por zoom: lejos sólo volúmenes y etiquetas de ciudad; cerca, gente, ventanas y letreros. Las etiquetas se ocultan por prioridad para no encimarse.
  - [x] Capas `gente` y `fino` (ventanas, letreros, vitrinas y puertas) que se ocultan de lejos (`DETALLE` en `modelo.js`, `escena/detalle.js`); las instancias ocultas no se recalculan. Harness: lejos 415 → 328 llamadas.
  - [x] Etiquetas por prioridad: ocultar las que se enciman en pantalla dejando las de mayor prioridad (Guadalajara/Manzanillo > ciudades con venta > resto).
  - [x] Más piezas finas a la capa (árboles chicos, faroles, tarimas del puerto) si el medidor muestra que vale la pena.
- [x] Liberar memoria al salir de la pestaña (geometrías, texturas, materiales) y comprobar que entrar y salir 5 veces no crece la memoria.

### Etapa 2 · Base y mapa (dos niveles, como Clash of Clans)
- [x] **Vista Base**: Guadalajara de cerca con la oficina, el CEDIS y el puerto juntos en un «campus» con calles, más grande y detallado. Es la vista inicial.
  - [x] Arrancar en la Vista Base: la cámara encuadra oficina + CEDIS + puerto de cerca según el lienzo (`encuadre()` en `modelo.js`); el botón «Acteck» regresa ahí (`irA({ tipo: 'base' })`).
  - [x] Campus con calles: calles y banquetas uniendo oficina y CEDIS, patio de maniobras con andenes, y el distrito «Guadalajara» movido para que no se encime con el puerto.
  - [x] Más grande y detallado: estacionamiento, bardas, jardines y faroles en el campus (capa fina), revisando el medidor `?fps`.
  - [x] Distritos reales pegados al campus: León, Querétaro y Morelia quedan junto al patio de maniobras y al distrito GDL en la Vista Base; separarlos (o atenuarlos de cerca) sin mover su posición en el mapa.
- [x] **Vista Mapa de México**: país completo con cada ciudad como un pin/maqueta pequeña con su estado (tiendas activas, camiones llegando). Botón fijo «🗺 Mapa» / «🏠 Base».
  - [x] Botones fijos «Base» y «Mapa»: `irA({ tipo: 'mapa' })` encuadra México completo según giro y lienzo (`vistaMapa()` en `modelo.js`); zoom máximo 120 → 180 (`ZOOM_MAX`) para que quepa aun en pantallas angostas.
  - [x] Pin/maqueta por ciudad en la vista de mapa (lejos): marcador con el número de tiendas activas y camiones llegando, que crece por zoom para leerse; se oculta de cerca.
  - [x] El botón cambia según dónde estás («🗺 Mapa» cuando estás en la base, «🏠 Base» cuando estás lejos), en vez de los dos.
- [ ] **Viajar**: tocar una ciudad en el mapa → transición animada (acercamiento) a la **Vista Ciudad** con sus manzanas y tiendas; botón «← Volver al mapa». Sólo se dibuja el nivel visible (mejora el rendimiento).
  - [x] Tocar el pin (o las manzanas) de una ciudad desde lejos acerca la cámara a su **Vista Ciudad** (`vistaCiudad()` encuadra el distrito, zoom ≤ `DETALLE.gente`); el botón pasa a «← Volver al mapa» (`nivelVista()` → 'base' | 'ciudad' | 'lejos'). El buscador también usa ese encuadre.
  - [ ] Sólo dibujar el nivel visible: en la Vista Ciudad ocultar los distritos lejanos (y en el mapa las piezas finas que ya no se ven), medido con `?fps`.
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
- 2026-10-06 22:20 · v3.90.16 · Viajar (paso 1): tocar una ciudad en el mapa (pin o manzanas) acerca la cámara a su Vista Ciudad (`vistaCiudad()`), el pin ya es tocable y el botón ofrece «← Volver al mapa» (`nivelVista()`); harness con `window.nivel`.
- 2026-10-06 21:46 · v3.90.15 · Vista Mapa (paso 3, cierra la Vista Mapa): un solo botón que cambia según dónde estás, «🗺 Mapa» en la base y «🏠 Base» cuando estás lejos (`enLaBase()` en `modelo.js` con pruebas; la escena avisa con `onNivel` cada 10 cuadros). Probado en el harness: lejos al ir al mapa, base al volver.
- 2026-10-06 21:40 · v3.90.14 · Vista Mapa (paso 2): con el zoom por arriba de `DETALLE.pin` (90) la etiqueta de cada ciudad se cambia por su pin «Ciudad · 🏬 tiendas activas · 🚚 camiones llegando» (`pinCiudad()` en `modelo.js`, con pruebas; tiendas virtuales no cuentan). Probado en el harness con todo México.
- 2026-10-06 21:37 · v3.90.13 · Vista Mapa (paso 1): botones «Base» y «Mapa» en la barra; «Mapa» encuadra todo México con `vistaMapa()` (puntas del país, con pruebas para varios giros y lienzos) y el zoom máximo sube de 120 a 180 (`ZOOM_MAX`/`zoomEnRango` compartidos con rueda y pellizco). Probado en el harness: país completo sin errores.
- 2026-10-06 21:09 · v3.90.12 · Vista Base (paso 4, cierra la Vista Base): los distritos reales que caen sobre el campus o el distrito GDL (León, Querétaro, Morelia, y cualquiera que caiga ahí) van en una capa nueva `mapa` (`DETALLE.mapa` 45, `encimaDelCampus()`/`juntarCapas()`/`capaVisible()` puros en `modelo.js`, con pruebas): de cerca no se dibujan ni se tocan (raycast ignora lo oculto) y de lejos aparecen en su lugar de siempre; tiendas, casitas, gente, árboles y etiqueta (`desdeZoom`) siguen la capa. Verificado en el harness.
- 2026-10-06 21:01 · v3.90.11 · Vista Base (paso 3): detalle del campus en `campus()` (con pruebas): estacionamiento al norte de la oficina con un coche por persona del equipo de hoy (tocable), barda al norte y oriente del CEDIS y patio, jardín con árboles chicos al poniente de la oficina y 8 faroles en la banqueta de la avenida; cajones, cabinas, faroles y árboles chicos en la capa fina e instanciados. Medidor harness: 241 → 252 llamadas.
- 2026-10-06 20:58 · v3.90.10 · Vista Base (paso 2): campus con calles: `campus()` puro en `modelo.js` (con pruebas de que nada se encima) separa oficina y CEDIS con una calle interior, avenida al frente con banquetas y raya punteada (capa fina, instanciada), patio de maniobras al oriente del CEDIS con 3 andenes y un tráiler por envío reciente (tocable, tipo `patio`), y el distrito «Guadalajara» bajo la avenida, lejos del puerto.
- 2026-10-06 20:24 · v3.90.9 · Vista Base (paso 1): la Ciudad arranca de cerca encuadrando oficina, CEDIS y puerto según el tamaño del lienzo y el giro (`encuadre()` puro en `modelo.js`, con pruebas; zoom ≈ 16 en 1024×768, con gente y ventanas visibles); el botón «Acteck» regresa a la base. «Vista Base» partida en 3 sub-pasos.
- 2026-10-06 20:20 · v3.90.8 · Liberar memoria al salir: los eventos del canvas (pointer, rueda, touch) ya se quitan con un `AbortController` — Ciudad.jsx rearma la escena sobre el mismo canvas y cada escena vieja quedaba retenida por sus listeners; `destruir()` libera cada geometría/material/textura una vez (escena + cachés), buffers de instancias y sombras, vacía listas y regresa lo que quedó vivo. Harness: 0 geometrías · 0 texturas tras destruir; 10 rearmados siguen en 363 llamadas · 188 geometrías.
- 2026-10-06 20:16 · v3.90.7 · Más piezas en la capa fina (paso 3 del nivel de detalle): faroles (poste + foco con esfera compartida) y tarimas del CEDIS pasan a `InstancedMesh` y se ocultan de lejos; árboles chicos (`esChico`, escala < 1) van en su propio `InstancedMesh` de capa fina. Harness de ejemplo, todo visible: 415 → 363 llamadas · 216 → 188 geometrías.
- 2026-10-06 19:49 · v3.90.6 · Etiquetas sin encimarse (paso 2 del nivel de detalle): cada cuadro se proyectan a pantalla y se esconden las que chocan con otra de más prioridad (`etiquetasSinEncimar` en `modelo.js`; acteck 4 > Manzanillo 3 > ciudades con venta 2 + tiendas/100 > resto 1).
- 2026-10-06 19:46 · v3.90.5 · Nivel de detalle por zoom (paso 1): gente y piezas finas (ventanas, letreros, vitrinas, puertas) se ocultan con zoom > 50 / > 65 (`DETALLE`/`capasVisibles` en `modelo.js`, `escena/detalle.js`); de lejos la escena baja de 415 a 328 llamadas de dibujo.
- 2026-10-06 19:41 · v3.90.4 · Personas, camiones y coches del equipo comercial instanciados como piezas dinámicas (la malla original queda invisible en su grupo y `actualizarInstancias()` copia su `matrixWorld` al `instanceMatrix` cada cuadro; geometrías compartidas con `geo()`): harness 571 → 415 llamadas, 339 → 216 geometrías. Cierra el pendiente de `InstancedMesh` (905 → 415 llamadas en total).
- 2026-10-06 19:37 · v3.90.3 · Tiendas y casitas de clientes finales como `InstancedMesh` por pieza+color (`escena/instancias.js`: `instanciar`/`plantarInstancias`, tocables por `instanceId` → `userData.tags`, `tagDe` en la interacción): harness 905 → 571 llamadas, 971 → 586 mallas. Arreglo: desde 3.76.9 `ultimo = now; tiempo += dt` había quedado dentro de un comentario y la gente, camiones y banderas no se movían.
- 2026-10-06 12:05 · v3.87.1 · Caché de `BoxGeometry` por medidas (`ctx.G`) en `box()`, ventanas, puertas y vitrinas: 886 → 364 geometrías en el harness, sin cambios visibles ni errores.
- 2026-10-06 10:48 · v3.86.1 · Medidor `?fps` en el harness + `stats()` en la escena; árboles con `InstancedMesh` y geometrías compartidas (−187 llamadas de dibujo, −224 geometrías; ya no son tocables).
- 2026-10-05 15:20 · v3.76.8 · `escena.js` partido en `escena/` (camara, luz-clima, terreno, edificios, gente, vehiculos, etiquetas, interaccion) con un `ctx` compartido; `escena.js` sólo orquesta. Sin cambios visibles (harness día/noche sin errores). `preparar-harness.mjs` copia también `escena/`.
- 2026-10-05 15:40 · v3.76.9 · Dibujar sólo cuando hace falta: pausa total con la pestaña oculta (`visibilitychange`), modo calma a ~10 fps tras 15 s sin gestos y con la cámara quieta, cualquier gesto vuelve a 60 (medido en harness con reloj simulado: 60 → 10 → 60 fps). `devicePixelRatio` ya estaba topado en 2.
