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
- [x] **Viajar**: tocar una ciudad en el mapa → transición animada (acercamiento) a la **Vista Ciudad** con sus manzanas y tiendas; botón «← Volver al mapa». Sólo se dibuja el nivel visible (mejora el rendimiento).
  - [x] Tocar el pin (o las manzanas) de una ciudad desde lejos acerca la cámara a su **Vista Ciudad** (`vistaCiudad()` encuadra el distrito, zoom ≤ `DETALLE.gente`); el botón pasa a «← Volver al mapa» (`nivelVista()` → 'base' | 'ciudad' | 'lejos'). El buscador también usa ese encuadre.
  - [x] Sólo dibujar el nivel visible. Medido en el harness (2026-10-06, 3.90.16): Vista Ciudad 83 llamadas (el recorte por cámara ya deja fuera los distritos lejanos), Base 232, **Mapa 350**. El ahorro está en el mapa: de lejos (zoom > `DETALLE.pin`) dejar cada distrito como maqueta simple (piso + volúmenes juntos) y ocultar lo que no se distingue, medido con `?fps`.
    - [x] Capa `cerca` (3.90.17): con zoom > `DETALLE.pin` se ocultan las casitas de clientes finales y la calle de cada distrito.
    - [x] Maqueta simple por distrito en el mapa: piso + volúmenes de tiendas juntos en una sola malla, medido con `?fps` (Mapa 350 llamadas).
      - [x] Pisos de distrito (3.90.18): caja unitaria escalada y `instanciar()` con su tag → un solo InstancedMesh para todos los pisos (antes una llamada por distrito).
      - [x] Volúmenes de tiendas de lejos (3.90.19): ya iban instanciados desde 3.90.3 (un InstancedMesh por pieza+color para todos los distritos). Medido con un desglose en el harness: el gasto del mapa estaba en los 42 estados y las 36 carreteras sueltas → ahora una malla cada uno. Harness (ejemplo): Base 226 → 176 llamadas, Mapa 277 → ~200.
      - [x] Campus y barcos de lejos: ~94 cajas sueltas de oficina, CEDIS, patio y barcos (con su tag) siguen siendo una llamada cada una; en la Vista Mapa juntarlas o instanciarlas (cuidando que sigan tocables).
        - [x] CEDIS (3.90.20): racks, claraboyas y portones con `instanciar()` (tag del CEDIS, siguen tocables). Harness: Base 176 → 161, Mapa ~200 → ~185.
        - [x] Oficina, patio y puerto (3.90.21): ventanas de la oficina, andenes, cortinas, tráileres formados y patas de la grúa con `instanciar()` (cada una con su tag, siguen tocables). Harness: Base 160 → 131 llamadas, Mapa 187 → 178.
        - [x] Barcos y montacargas (3.90.22): sus piezas van como instancias dinámicas (proa y ruedas con geometría compartida), siguen tocables y animadas. Harness: Base 131 → 128 llamadas, Mapa 178 → 146.
- [x] Minimapa en una esquina con dónde estás y acceso rápido a Base, Mapa y las 5 ciudades con más actividad.
  - [x] Acceso rápido (3.90.23): fila de botones arriba a la izquierda con las 5 ciudades con más actividad (`ciudadesTop()` en `modelo.js`: tiendas activas + camiones llegando); tocar una viaja a su Vista Ciudad.
  - [x] Plano chico (3.90.24) en una esquina (SVG con el contorno `EXTREMOS_MEXICO` y un punto por ciudad) con un marcador de dónde está la cámara; tocarlo viaja ahí. Necesita que `crearEscena` avise el centro de la vista (p. ej. en `onNivel` o un `onVista`).
- [x] Guardar la última vista (nivel, ciudad, zoom) por usuario en `localStorage` con try/catch.

### Etapa 3 · Edificios visitables (tocar y ver)
- [x] **Tarjeta del edificio** al tocar (estilo menú de Hay Day, flotando junto al edificio, no panel lateral): nombre, 3–4 números clave de su pestaña, estado (verde/ámbar/rojo) y botón «Abrir en el dashboard». Una sola plantilla para todos.
  - [x] Plantilla única y tarjeta flotante (3.90.26): `tarjetaDe(tag, modelo)` en `modelo.js` (probada) da nombre, estado y hasta 4 números para oficina, CEDIS/montacargas, puerto, ciudad, tienda, persona y contenedor; `Ciudad.jsx` la dibuja junto a donde se tocó (si la cámara se mueve se acomoda arriba a la derecha). Umbrales de estado elegidos por el agente: CEDIS > 90 d ámbar / > 120 d rojo; ciudad ≥ 60 % tiendas activas verde / ≥ 30 % ámbar; tienda con cartera vencida o sin venta = rojo. Fernando puede ajustarlos.
  - [x] (3.90.27) Que la tarjeta siga al edificio mientras la cámara se mueve (la escena avisa la posición en pantalla del tag seleccionado, p. ej. `onSeleccion(pos)` cada ~15 cuadros) en vez de acomodarse en la esquina.
- [x] Banco/tesorería nuevo en la base (Pagos y cobranza: cartera vencida, pagos de la semana) y torre de pronóstico (Forecast: precisión, avisos), con datos de las vistas que ya usan esas pestañas.
  - [x] Banco/tesorería (3.90.28): edificio de columnas al norte del estacionamiento (`campus().banco`), tocable con tarjeta: cartera vencida (`v_vision_cartera_consolidada`, ya cargada) y pagos de Pagos V3 que vencen en 7 días o ya vencieron (`pagos` abiertos, reglas `venceEn`/`estaVencido` que `datos.js` inyecta a `resumenBanco()`); letrero verde/rojo y bandera roja si hay vencidos. «Abrir en el dashboard» → Pagos.
  - [x] Torre de pronóstico (3.90.29): torre de control al norte de la barda del CEDIS (`campus().torre`) con foco que parpadea verde/ámbar/rojo; tarjeta con propuestas abiertas, SKUs confirmados, comprados y arribos en 7 días (`forecast_propuestas` sin borradores + líneas y `forecast_avisos`, como Proyectos y forecast; `resumenTorre()` probado). «Abrir en el dashboard» → Proyectos y forecast.
  - [x] Precisión del pronóstico en la torre → movido a «Necesita a Fernando» (2026-10-07): `compararForecast()` vive en un `.jsx` con React y necesita la serie real por SKU de cada cliente.
- [x] **Interior del CEDIS**: al entrar, racks por familia/marca con su nivel de inventario y días de inventario (`v_medidas_inventario_*`), montacargas moviéndose si hubo salidas hoy.
  - [x] (3.90.30) Datos: inventario por marca con las mismas fuentes de Inventario (`v_inventario_almacen_medida` con `en_inv_actual = true` + marca de `roadmap_sku`) → `racksPorMarca()` puro en `modelo.js` (valor, piezas y SKUs por marca, top 8 + «otras»), probado.
  - [x] (3.90.31) «Entrar» al CEDIS: botón en su tarjeta que acerca la cámara y oculta el techo; un rack por marca con altura según su inventario y etiqueta; tocable con su tarjeta.
  - [x] (3.90.32) Días de inventario por marca (demanda de los 3 meses cerrados, `v_sellin_global_sku_anio`, como Inventario) y montacargas que sólo se mueven si hubo salidas hoy.
- [x] **Nubes sobre la base**: en la Vista Base las nubes bajas (y 62–74) a veces tapan el CEDIS u otros edificios; subirlas, hacerlas translúcidas o apartarlas del campus (vista agente 2026-10-07).
- [x] **Interior del puerto**: cada barco/contenedor tocable con PO, proveedor, ETA y piezas (`v_embarques_contenedor`).
  - [x] (3.90.34) Tarjeta del contenedor en el mar: proveedor, ETA (o arribo al CEDIS) con días, piezas y número de POs (`pos` de `v_embarques_contenedor`); ETA vencida sin arribo en rojo, sin ETA en ámbar.
  - [x] (3.90.35) Números de PO de cada contenedor (lista de `embarques_compras` por contenedor, sólo de los barcos dibujados) en la tarjeta.
  - [x] (3.90.36) Contenedores descargando en el puerto/CEDIS (`puerto.tarimas`) tocables uno por uno con la misma tarjeta.
- [x] **Interior de la oficina**: salas con las reuniones de hoy (agenda), escritorios por persona con su foto/nombre y su pendiente principal.
  - [x] (3.90.37) Datos: reuniones de hoy en orden con hora y estado (hecha / en curso / próxima) → `reunionesDelDia()` puro en `modelo.js` (`oficina.agenda`), probado; la tarjeta de la oficina dice «N · próxima HH:MM» o «en curso».
  - [x] (3.90.38) «Entrar» a la oficina (como el CEDIS): botón en su tarjeta que acerca la cámara y oculta el techo; sala de juntas con las reuniones de hoy (tocable) y un escritorio por persona con su nombre y pendiente principal (`oficina.personas[].actividad`), tocable.
  - [x] (3.90.39) Foto de cada persona (`avatar_url`) sobre su escritorio (textura cargada bajo demanda; si falla, la inicial).
- [x] **Presencia en la oficina** (como Gather): cada persona aparece en reunión, de viaje o disponible según su agenda de hoy.
- [x] **Tienda visitable**: tocar una tienda → su sell out del mes vs mes anterior, top 5 SKUs, inventario en tienda si hay, y «Abrir en Sell Out».

### Etapa 4 · Burbujas de atención y barra superior (que avise como juego)
- [x] **Barra superior tipo recursos**: Ventas del mes vs cuota (barra de progreso), Inventario comercial, Cartera vencida, Embarques en tránsito. Mismos números que Inicio. Tocar cada recurso lleva a su edificio.
- [x] **Burbujas sobre edificios** cuando algo pide atención (cartera vencida, inventario bajo de un SKU A, barco llegando en ≤ 3 días, OC de cliente atrasada, reunión en 15 min). Tocar la burbuja abre la tarjeta del edificio con ese tema.
  - [x] (3.90.43) Reglas: `burbujasAtencion()` puro en `modelo.js` (cartera/pagos vencidos → banco, ETA vencida o llegada en ≤ 3 días → puerto, reunión en ≤ 15 min → oficina), probado.
  - [x] (3.90.44) Dibujar las burbujas (sprite con icono sobre cada edificio, rojo/ámbar, que flota) y que tocarlas abra la tarjeta del edificio.
  - [x] (3.90.45) OC de cliente atrasada: alerta `oc_detenida` (la de la campana) → globo rojo sobre el CEDIS. Inventario bajo de SKU A → movido a «Necesita a Fernando».
- [x] **«Hoy en Acteck»** como lista de misiones del día (las mismas alertas y pendientes del dashboard), cada una con «Ir» que vuela al lugar.
  - [x] (3.90.46) `misionesDelDia()` puro (alertas de las burbujas + reuniones de hoy + contenedores descargando, hechas al final con ✓), probado; panel abajo a la derecha con «Ir» que vuela y abre la tarjeta.
- [x] **Capas de información** (como SimCity): botones «Ventas · Inventario · Cartera · Cuota» que pintan ciudades, manzanas y edificios con una escala de color de ese dato (leyenda visible, «Sin capa» para volver). Mismos números que su pestaña.
  - [x] (3.90.47) Reglas: `capaCiudades(modelo, capa)` puro en `modelo.js` — color por ciudad para 'ventas' (sell out del mes vs anterior) y 'cartera' (cuentas con vencido), con leyenda; probado.
  - [x] (3.90.48) Dibujar: botones «Sin capa · Ventas · Cartera» en `Ciudad.jsx` con leyenda; `escena.capa(nombre)` tiñe pin y piso de cada manzana con el tono (y la etiqueta/hover dice el texto de la capa).
  - [x] (3.90.49) Capa «Cuota»: `v_cuota_erp_mes` (cuota del mes con su `cuenta_sellout`) + `mv_analisis_cliente_mes` (venta del mes), como Análisis → `cuotasPorCuenta()`; tono por avance vs ritmo del mes. Capa «Inventario» → movida a «Necesita a Fernando» (no hay inventario por ciudad/sucursal).
- [x] **Bitácora en vivo** (como el Chirper de Cities: Skylines): tira de eventos recientes de la empresa — facturas grandes, contenedores que llegan, OCs surtidas, pagos registrados, reuniones que empiezan — cada uno con «Ver» que vuela al lugar. Sólo de tablas que ya existen (`sync_events`, facturas, embarques, pagos, agenda).
  - [x] (3.90.50) `bitacoraEventos()` puro con lo que ya trae el modelo (facturas → camiones, envíos surtidos del Tracking, contenedores que llegaron al CEDIS, reuniones de hoy que ya empezaron), probado; sección «Bitácora» en el panel con «Ver» que vuela al lugar (y abre la tarjeta del contenedor o de la sala).
  - [x] (3.90.51) Pagos registrados (`pagos` con estado pagado y su fecha, consulta chica) y última sincronización del puente (`sync_events`, si el dashboard ya la lee) como eventos de la bitácora.
- [x] **Pensamientos** (como RollerCoaster Tycoon): burbujas cortas sobre tiendas y clientes que resumen su situación en lenguaje natural («Me falta inventario de AC-944571», «30 días sin comprar», «Voy arriba de mi cuota»), generadas con reglas del modelo, máximo unas pocas visibles a la vez.
  - [x] (3.90.52) Reglas `pensamientos()` puras (cartera vencida, sin venta este mes, caída o alza > 30 % vs mes anterior, al ritmo de su cuota; una por ciudad, máximo 5), probadas; nube blanca con borde del tono sobre la tienda (`escena/edificios.js#pensar`), tocable → tarjeta de la tienda.

### Etapa 5 · Gente y vehículos con sentido
- [x] Vendedores con rutas reales entre las sedes de sus clientes (ya vienen en el modelo); su etiqueta dice a quién visitan; tocarlos muestra sus ventas del mes.
- [x] Camiones por guía real (`guias_erp` con destino) del CEDIS a la ciudad destino; facturas de 10 días como respaldo si la guía no trae ciudad. Tocar un camión → cliente, factura/guía, piezas.
  - [x] (3.90.54) Tocar un camión → tarjeta con cliente, factura (monto y piezas) o envío (paquetería), cuándo salió y destino; envío con más de 5 días en camino en ámbar.
  - [x] Camiones por guía real con destino: `guias_erp` no la consulta el dashboard desde `src/` (sólo entra a `oc_envios` por la RPC del Tracking) → movido a «Necesita a Fernando».
- [x] Barcos que entran al puerto según su ETA real y descargan contenedores al llegar.
  - [x] (3.90.55) `rumboBarcos()` puro: ETA vencida/hoy → en el puerto (el más atrasado atraca y descarga, los demás en fila mar adentro), ≤ 7 días → se acerca, resto en mar abierto; el atracado baja sus cajas una por una al muelle. Harness `?atracar`.
- [x] Cuentas sin sucursal repartidas por estado (`CIUDAD_POR_ESTADO`) para que ninguna ciudad con ventas quede vacía.
  - [x] (3.90.56) `repartoPorEstado()` puro con su sell out a clientes finales por estado (`mv_sellout_cliente_final_mes`, ya consultada): una tienda «Clientes en <ciudad>» (`reparto: true`) por ciudad del estado, sin la sede (ahí sigue su Matriz), top 6; no cuentan en los KPIs de tiendas ni piensan.
- [x] **Seguir a alguien** (como Cities: Skylines): en la tarjeta de un vendedor, camión o barco, botón «Seguir» que deja la cámara pegada a él con una ficha de su recorrido; cualquier arrastre o «Esc» lo suelta.
  - [x] (3.90.57) `escena.seguir(tag|null)` + `onSiguiendo`: la cámara sigue la malla fuente del vendedor/camión/barco; clic/arrastre en el lienzo o «Esc» lo suelta. Botón «Seguir» en su tarjeta y ficha «Siguiendo … · Soltar» arriba al centro. Sin prueba de clic en el harness (sólo carga sin errores): revisarlo a mano.
- [x] **Flujo de mercancía de punta a punta** (como Anno 1800 / Factorio): vista «Cadena» que dibuja el recorrido barco → puerto → CEDIS → camión → tienda → cliente final con el volumen de cada tramo, y marca en rojo dónde se atora (barco atrasado, días de inventario altos, tienda sin inventario).
  - [x] (3.90.58) `cadenaSuministro()` puro (mar, puerto, CEDIS, camiones, tiendas, clientes finales: volumen, tono y motivo; `atasco` = primer tramo rojo/ámbar) y botón «Cadena» abajo a la izquierda con la tira de tramos (borde y motivo en rojo/ámbar donde se atora). «Tienda sin inventario» no se puede: no hay inventario por sucursal (ver «Necesita a Fernando»).
  - [x] (3.90.59) Dibujar la cadena en la escena: con «Cadena» activa, flechas/cintas barco → puerto → CEDIS → ciudades con grosor por volumen y en rojo el tramo atorado (`escena.cadena(on)`, se arma al primer uso como las capas); tocar un tramo de la tira lleva la cámara a ese punto. Hecho con `cintasCadena()` puro (mar → puerto → CEDIS → 8 ciudades con más camiones/tiendas, peso 1–4) + `escena.cadena(on)`; harness `?cadena` (ojo: `serve` redirige `ciudad-dev.html` → `ciudad-dev` y tira el `?…`; usar `/ciudad-dev?cadena`).

### Etapa 6 · Dinero, tiempo y celebraciones
- [x] Cuota vs ritmo por ciudad/cuenta: banderín o halo verde-ámbar-rojo en la manzana y el dato en su tarjeta (vista de cuotas que ya usa el dashboard).
  - [x] (3.90.60) `cuotaRitmo(m, cuentas)` puro (lo usan la capa «Cuota» y las tarjetas): «Cuota del mes» en la tarjeta de la ciudad y «Cuota de la cuenta» en la de la tienda (% · ritmo), con `t.cuota` = tono.
  - [x] (3.90.61) Banderín verde-ámbar-rojo en cada manzana con cuota (siempre visible de cerca, sin prender la capa), con el tono de `cuotaRitmo()`; se toca → tarjeta de la ciudad. Harness `?cuota` (cuotas de ejemplo).
- [x] Celebraciones discretas: fuegos artificiales sobre la base al cruzar la cuota del mes; confeti en una tienda que vuelve a vender tras 30 días sin venta.
  - [x] (3.90.62) `celebraciones()` puro: cuota cruzada = total de `m.cuotas` ≥ 100 % → 3 cohetes de puntos sobre la base; «volvió a vender» = vendió este mes y nada el anterior (aprox. de 30 días: no hay fecha de última venta por sucursal) → confeti en bucle sobre la tienda (máx. 5). Harness `?fiesta`.
- [x] Barra de tiempo: «Hoy / Ayer / Hace 7 días / Inicio de mes» que reconstruye la ciudad con los datos de esa fecha.
  - [x] (3.90.63) `momentosTiempo(hoy)` (Hoy / Ayer / Hace 7 días / Inicio de mes, sin días repetidos) y `datosEnFecha(d, fecha)` puros, probados: quitan facturas/envíos/contenedores posteriores, des-entregan envíos y des-arriban contenedores que llegaron después, ventas mensuales hasta ese mes (el mes cuenta completo: no hay venta diaria por sucursal), agenda vacía; inventario, cartera, pagos y forecast quedan como hoy (`_aprox`).
  - [x] (3.90.64) Barra en `Ciudad.jsx`: `datos.js` guarda los crudos en el modelo; al elegir un momento, `construirModelo(datosEnFecha(crudos, fecha), fecha)` (+ pagosHechos/ultimaSync; cuotas sólo si es el mismo mes) y la escena se rearma; aviso «Viendo <momento> · aproximado: …» y botón «Volver a hoy».
- [x] **Eventos del calendario comercial** (como Animal Crossing): decoración y avisos según la fecha real — cierre de mes (cuenta regresiva en la base), Buen Fin, regreso a clases, Navidad — con su efecto en la ciudad (más camiones, letreros de promoción) usando sólo fechas y datos existentes.
  - [x] (3.90.65) `eventosCalendario(hoy)` puro y probado (cierre de mes con cuenta regresiva los últimos 7 días, Buen Fin = viernes–lunes del 3.er lunes de noviembre con aviso 14 días antes, regreso a clases 15 jul–31 ago, Navidad 1–25 dic) y chips arriba de «Hoy en Acteck» (siguen la barra de tiempo).
  - [x] (3.90.66) En la escena (`escena/edificios.js#calendario`): letrero flotante «⏳ Cierre de mes en N días» sobre la oficina, banderín «🏷️ BUEN FIN» sobre cada ciudad con tiendas que venden (máx. 8, de cerca) y guirnalda de foquitos alrededor de la oficina en temporada navideña; sigue la barra de tiempo. Harness `?fecha=AAAA-MM-DD`.
  - [x] (3.90.67) `camionesTemporada()` puro y probado (facturas de `m.camiones` que salieron con Buen Fin ya empezado o en la semana del cierre) → caja roja y «· Buen Fin / · Cierre de mes» en el título del camión. Sin prueba visual: en el harness las facturas de ejemplo no caen en esas fechas.

### Etapa 7 · Arte y sensación de juego
- [x] Kit de piezas low-poly propio (edificios con bordes biselados, techos, ventanas iluminadas de noche, árboles variados) en lugar de cajas lisas; paleta cálida consistente con el sistema de diseño del dashboard (`docs/DESIGN_SYSTEM.md`).
  - [x] (3.90.68) Tiendas: cuerpo con esquinas y orillas biseladas (`cajaBiselada()` en `escena/edificios.js`, geometría compartida e instanciada) y 2 ventanas por costado que se prenden de noche (todas si la tienda vendió, una sí y una no si no).
  - [x] (3.90.69) Techos: pretil al frente de cada tienda, tinaco negro en 2 de cada 3 y antena + platito en el resto; casitas de clientes finales alternan techo de cuatro aguas y de dos aguas (`techoDosAguas()`). Todo instanciado y en capa fina.
  - [x] (3.90.70) Oficina y nave del CEDIS con `cajaBiselada()`; ventanas de la oficina prendidas según presencia con `ventanasOficina()` puro y probado (todos menos los de viaje, repartidas parejo; sin personas, 2 de cada 3 como antes).
  - [x] (3.90.71) Árboles variados: `formaArbol(x, z)` puro y probado (pino / redondo / palma / arbusto y tono, estable por posición) y `plantarArboles()` con una pieza instanciada por forma.
  - [x] (3.90.72) Paleta de día alineada al tema Marfil: oficina = `#F7F3EC`, banquetas = `#EEE7DA`, cielo/niebla `#EEF1EF` (sin azul frío; también el fondo de `Ciudad.jsx` y del harness). La de noche ya era neutra, sin cambios.
- [x] Animaciones de respuesta: el edificio «rebota» al tocarlo, burbujas que flotan, transiciones suaves de cámara con easing, gente que saluda al pasar el cursor.
  - [x] (3.90.73) Rebote al tocar: `rebote(t)` puro y probado (aplasta/estira 0.5 s) y `escena/rebote.js`: todas las piezas instanciadas con el mismo tag rebotan alrededor de un pivote común en el suelo; oficina/CEDIS escalan su grupo. Gente y camiones no (son dinámicos). La cámara ya tenía suavizado exponencial al viajar.
  - [x] Burbujas que flotan: ya lo hacían `burbujas()` y `pensar()` (seno desfasado por burbuja); sin cambios.
  - [x] (3.90.74) Gente que saluda: `saltito(t)` puro y probado; `crearSaludo()` en `escena/rebote.js` hace dar dos saltitos a la persona bajo el cursor (mueve su grupo; la instancia lo sigue).
- [x] Recorrido de bienvenida la primera vez (3 pasos: así se mueve, así se toca un edificio, así se viaja) y botón «?» para repetirlo.
  - [x] (3.90.75) `RECORRIDO` / `recorridoVisto()` en `modelo.js` (probados) y tarjeta abajo al centro en `Ciudad.jsx` al terminar la carga (Saltar / Siguiente / ¡Listo!; visto = `acteck-ciudad-recorrido` en localStorage, sin almacenamiento sale una vez por sesión) + botón «?» junto al de nivel. Sin prueba visual: el harness no dibuja `Ciudad.jsx`.
- [x] Sonido ambiente opcional (apagado por defecto, interruptor en la esquina).
  - [x] (3.90.76) `capasSonido()` puro y probado + `sonido.js` (WebAudio sintetizado, sin archivos: rumor de ciudad, lluvia, pájaros de día, grillos de noche, según el clima real o el tema) y botón 🔇/🔊 junto al «?»; se arma en el clic y se apaga al salir de la pestaña. Probado en Chrome headless (bundle aparte); la UI sin prueba visual.

### Etapa 8 · iPad, celular y para el equipo
- [x] Gestos táctiles completos (un dedo mueve, pellizco acerca, dos dedos giran, toque largo = info) y botones grandes; versión ligera automática en `pointer: coarse` (menos gente, sin sombras).
  - [x] (3.90.77) `gestoDosDedos()` puro y probado; en `escena/interaccion.js`: dos dedos = pellizco + giro (el arrastre de un dedo se pausa), toque largo (550 ms, vibra) = globo de info mientras se sostiene, el toque corto elige lo que está bajo el dedo (antes podía usar el último hover) y en táctil el globo ya no se queda pegado. Probado en el harness con toques emulados (CDP).
  - [x] (3.90.79) Botones grandes en táctil: con `pointer: coarse`, `Ciudad.jsx` pone la clase `ciudad-tactil` (botones ≥ 40 px y letra 14 px; buscador a 16 px para que iOS no haga zoom). Sin prueba visual: el harness no dibuja `Ciudad.jsx`.
  - [x] (3.90.78) Versión ligera: `crearEscena(..., { ligera })` (sin sombras, pixel ratio ≤ 1.5, paseantes con `paseantesDistrito()` probado: máx. 1 por manzana); `Ciudad.jsx` la prende con `matchMedia('(pointer: coarse)')`. Harness `?ligera`.
- [ ] Abrir la Ciudad a más usuarios respetando sus permisos: cada quien ve sólo los edificios de las pestañas a las que tiene acceso (requiere que Fernando apruebe quién entra).

### Siempre (cuando no quede nada arriba)
- [ ] Pulido: rendimiento, legibilidad de etiquetas, pruebas nuevas en `scripts/test-ciudad-modelo.mjs`, comparar números de cada tarjeta contra su pestaña del dashboard.
  - [x] (3.90.81) Pruebas de coherencia: proyección (GDL en el origen, rumbos de Monterrey/Mérida/Tijuana), coordenadas del catálogo dentro de México, cada cuenta con color y sede existente, `CIUDAD_POR_ESTADO` válido, `hexCss` y `norm`.
  - [x] (3.90.82) Legibilidad de nombres: `nombreCiudad()` puro y probado (acentos «San Luis Potosí», «Ciudad Juárez», conectores en minúscula «Lagos de Moreno», CDMX) en etiquetas, pines, tarjetas de ciudad/camión/vendedor, buscador y minimapa.
  - [x] (4.12.1) Tarjeta de la oficina: pendientes/hechas/genéricos en texto o negativos ya no se concatenan ni restan.
  - [x] (3.90.83) Cifras cortas: `cifraCorta()` pura y probada (999 600 ya no sale «1000 K» sino «1.0 M», negativos con signo) en etiquetas, tarjetas y `pesosCorto`; la cartera vencida del panel usa `pesosCorto` (antes «$0.0 M» para montos chicos).
  - [x] (3.90.84) Listas cortas sin vacíos ni repetidos: `listaCorta()` limpia espacios, quita nulos/duplicados y el «+N» cuenta sólo lo que falta (POs del barco en la tarjeta del puerto).
  - [x] (3.90.85) `cuotaRitmo()` aguanta fecha inválida (usa hoy) y venta faltante (0): ya no sale «NaN %» en rojo en la capa/tarjeta de cuota.
  - [x] (3.90.86) Barra de recursos: `recursosBarra()` ya no muestra «NaN d» / «Infinity d» cuando la cobertura de inventario viene sin ritmo; redondea los días.
  - [x] (3.90.87) `cuotasPorCuenta()` empata clientes aunque traigan espacios (` 10 ` = `10`), para que la venta no se pierda en la capa de cuota.
  - [x] (3.110.3) `racksPorMarca()` / `demanda3Meses()` limpian el SKU (espacios y minúsculas): un SKU ya no cuenta doble en los racks del CEDIS y encuentra su marca y su demanda (días de inventario).
  - [x] (3.110.4) `resumenTorre()` / `resumenBanco()` aguantan renglones nulos (cartera, líneas de forecast) y una fecha inválida (usa hoy): antes lanzaban error y tumbaban el modelo de la Ciudad.
  - [x] (3.111.1) `presenciaPersonas()` salta personas nulas (antes lanzaba error) y, junto con `reunionesDelDia()`, usa ahora si `hoy` es inválida (antes todos «disponible» y las reuniones siempre «próxima»).
  - [x] (4.3.1) `fechaHoy()` pura y probada: misiones, bitácora, burbujas, calendario, momentos de la barra de tiempo, camiones de temporada, demanda de 3 meses y `construirModelo()` aceptan «hoy» nulo, texto o inválido (usan ahora; 'AAAA-MM-DD' a mediodía local) en vez de lanzar error y tumbar la Ciudad.
  - [x] (4.3.2) Cadena y circuito: `cadenaSuministro()` / `cintasCadena()` saltan barcos, camiones, distritos y tiendas nulos (antes lanzaban error) y `tramoActual()` ya no da NaN con ciclo/paradas inválidos (vendedores sin posición).
  - [x] (4.3.3) `pensamientos()`, `celebraciones()`, `burbujasAtencion()` y `bitacoraEventos()` saltan cartera, distritos, tiendas, cuotas, barcos y reuniones nulos (antes lanzaban error) y los pensamientos usan `fechaHoy()` (hoyIso inválido ya no da ritmo NaN).
  - [x] (4.3.4) `sinNulos()` pura y probada: `construirModelo()` limpia los renglones nulos de cada lista de datos (cuentas, envíos, contenedores, facturas, sucursales, clientes finales, vendedores, perfiles, reuniones, cartera…; antes un null tumbaba toda la Ciudad) y acepta `d` nulo; `etiquetasSinEncimar()` y `ventanasOficina()` también saltan nulos.
  - [x] (4.3.5) `pinCiudad()`, `ciudadesTop()` y `ponerPosEnPuerto()` saltan tiendas, distritos y barcos/tarimas nulos (antes lanzaban error en el minimapa, los pines y la tarjeta del puerto).
  - [x] (4.3.6) `capaCiudades()` (discos de ventas/cartera/cuota) y `datosEnFecha()` (barra de tiempo, corre con los datos crudos antes de `sinNulos()`) saltan distritos, tiendas, cartera, facturas, envíos, contenedores y renglones mensuales nulos (antes lanzaban error).
  - [x] (4.3.7) `repartoPorEstado()` empata la cuenta aunque traiga espacios o venga como número (` 10 ` = `10`) y el año/mes aunque vengan en texto; cuenta vacía no junta nada. Antes los clientes finales de esas cuentas no salían como tiendas por estado.
  - [x] (4.3.8) `misionesDelDia()` salta reuniones y tarimas nulas (antes lanzaba error), una reunión sin hora de inicio ya no dice «en NaN min» (va tras las de hoy) y una ya pasada no dice «en -N min».
  - [x] (4.3.9) `tarjetaDe()` usa `pesosCorto()` (999 600 ya no sale «$1000 K» sino «$1.0 M»; negativos «-$5 K») y salta personas, reuniones, racks, barcos, tarimas, distritos, tiendas, camiones, vendedores y destinos nulos (antes lanzaba error al tocar el edificio).
  - [x] (4.3.10) `rumboBarcos()` toma la ETA en texto («3», « 4 ») y trata la vacía o basura como sin ETA (antes «» se leía como 0 y el barco salía atracado) y acepta algo que no es lista; `acomodoEscritorios()` redondea n (3.7 → 3) y `cols` 0 ya no da NaN.
  - [x] (4.3.11) `acomodoRacks()` aguanta `cols` 0/decimal (antes x NaN/Infinity en los racks del CEDIS), `maxNiveles` inválido, marcas vacías y algo que no es lista; `circuitoVendedor()` acepta `tieneRuta` que no es función y `max` 0/decimal.
  - [x] (4.3.12) `encuadre()` (y `vistaCiudad()`) usa los valores de omisión con ángulo, margen, alto, min/max inválidos (max < min → min) y algo que no es lista; `planoMini()` aguanta ancho/alto/margen inválidos (contorno y marcador sin NaN en el minimapa); `topSkus()` acepta `n` en texto/decimal/inválido, SKU numérico y algo que no es lista.
  - [x] (4.3.13) `fechaIso()` pura y probada: en el puerto una ETA/arribo/ETD ilegible («pendiente», '2026-99-99') cuenta como sin fecha (antes progreso y «llega en» NaN: barco fuera del mar); envío con salida ilegible ya no sale como camión con progreso NaN; factura/envío con fecha futura ya no da progreso negativo; la tarjeta del camión ya no dice «hace NaN d».
  - [x] (4.7.79) `listasDatos()` pura y probada: `construirModelo()` toma vacía cualquier lista de datos que llegue como objeto, texto o número (cuentas, perfiles, envíos, facturas, sucursales, clientes finales…; antes `.map`/`.filter`/`for…of` lanzaban error); `reglasPagos` (objeto) y `marcasSku` (Map) se respetan.
  - [x] (4.7.7) `cifraCorta()` / `pesosCorto()`: ≥ mil millones sale «1.2 B» como `moneyCompact` del dashboard (antes «1000.0 M») y el texto con «$», comas o espacios («$1,200») se lee como número (antes «0»); booleanos y listas → «0».
  - [x] (4.7.5) `llegaBarco()` pura y probada: el barco y el panel de avisos dicen «llega hoy», «llega mañana» o «2 d tarde» (antes «llega en 0 d» / «llega en -2 d», y el panel decía «hoy» a uno atrasado).
  - [x] (4.7.6) Tarjeta del contenedor: la ETA usa `llegaBarco()` («21 nov · mañana», «· hoy», «· 2 d tarde»; antes «en 1 d»).
  - [x] (4.3.14) `gestoDosDedos()` con pareja incompleta o coordenadas que no son número regresa sin cambio (antes zoom/giro NaN: pantalla negra); `rebote()`/`saltito()` aguantan duración/alto inválidos; `capasSonido(null)` ya no lanza error; `ventanasOficina()` acepta `total` en texto/decimal/inválido.
  - [x] (4.3.15) `etiquetasSinEncimar()` aguanta margen inválido (NaN/negativo/texto: antes ninguna chocaba y se encimaban todas) y prioridad en texto o basura (antes desordenaba el sort); `formaArbol()` con posición inválida ya no da tono NaN (color indefinido del árbol).
  - [x] (4.3.16) `ciudadDeSucursal()` ya no adivina ciudad con nombres de menos de 4 letras («A», «LA» caían en Guadalajara; «MEX» en CDMX); `encimaDelCampus()` con margen inválido (NaN/negativo/texto) usa el de omisión (antes ninguna ciudad chocaba y se dibujaban encima de la base); `enLaBase()` con centro inválido cuenta como base (antes el botón saltaba a «lejos»).
  - [x] (4.3.17) Barra de tiempo: `datosEnFecha()` usa `fechaIso()`: una factura/envío/contenedor con fecha ilegible («pendiente») cuenta como sin fecha y se queda (antes se comparaba como texto, salía «posterior» y desaparecía); `camionesTemporada()` lee la fecha con `fechaIso()` (con espacios cuenta, basura no); `vistaMapa()`, `vistaCiudad()` y `planoMini()` aceptan opciones null (antes lanzaban error).
  - [x] (4.3.18) Calendario: a un día de Navidad dice «falta 1 día» (antes «faltan 1 días»); `ciudadesTop()` acepta `n` en texto/decimal/basura (antes NaN → acceso rápido vacío).
  - [x] (4.3.19) `comoLista()` pura y probada: banco, torre, cuotas, reuniones, presencia, racks, demanda, reparto por estado, puerto y pines aceptan algo que no es lista (null, texto, número) en vez de lanzar error; `encuadre()`, `repartoPorEstado()`, `acomodoEscritorios()` y `acomodoRacks()` aceptan opciones null.
  - [x] (4.3.20) `cuantos()` pura y probada: misiones, bitácora, pensamientos, celebraciones, cintas de la cadena, racks del CEDIS, reparto por estado y `listaCorta()` aceptan `max`/`n` en texto, decimal o basura (NaN, negativo, null → la omisión); antes `slice(0, NaN)` dejaba la lista vacía y «+NaN» en la tarjeta del puerto.
  - [x] (4.3.21) `posDe()` con lon/lat ilegibles (null, texto, NaN) cae en el origen en vez de dar x/z NaN (objeto fuera de la escena); `hexCss()` con color inválido (tono desconocido, texto, negativo) da gris en vez de «#000NaN» (CSS inválido en la tira de la cadena y la leyenda).
  - [x] (4.3.22) Barra de tiempo: `datosEnFecha()` (corre con los datos crudos, antes de `sinNulos()`) acepta facturas, envíos, contenedores y ventas mensuales que no son lista (texto, objeto, número: quedan vacías) en vez de lanzar error; `camionesTemporada()` igual con `camiones`.
  - [x] (4.3.23) `nivelVista()` ya no dice «ciudad» con una ciudad o cámara sin centro legible (antes `enLaBase()` daba true sin datos); la barra de recursos dice «1 PO» en singular y ya no muestra «0 POs» / «NaN POs» con POs en tránsito ilegibles.
  - [x] (4.3.24) Capa de cuota: `cuotaRitmo()` suma la cuota en texto como número (antes «1000» se concatenaba y el % salía disparatado), ignora cuotas ilegibles y lee `hoyIso` con `fechaHoy()`; `cuotasPorCuenta()` empata la cuenta aunque traiga espacios (« ct » = «ct») y salta la vacía.
  - [x] (4.3.25) `aPx()` / `pxAEscena()` (proyección del terreno y de `posDe()`) con lon/lat o X/Y ilegibles (null, texto, NaN, Infinity, objetos) caen en el origen en vez de dar NaN (contorno de México o un objeto fuera de la escena); un número en texto se lee.
  - [x] (4.3.26) Pines y acceso rápido: `pinCiudad()` / `ciudadesTop()` aceptan distritos y tiendas que no son lista (antes lanzaban error o NaN en el orden), la ciudad del camión empata con `norm()` (« León » = «LEON») y un distrito sin ciudad ya no junta los camiones sin ciudad (antes undefined === undefined).
  - [x] (4.3.27) Torre de pronóstico: `resumenTorre()` lee fechas de arribo y «hoy» con `fechaIso()` (« 2026-10-08» con espacios ya no sale atrasado, una fecha ilegible no suma piezas, un Date sí cuenta) y las líneas de propuesta que no son lista ya no cuentan como línea.
  - [x] (4.3.28) Banco: `resumenBanco()` lee «hoy» y las fechas de pago con `fechaIso()` (hoy inválido usa hoy: antes ningún pago contaba; « 2026-10-09» o un Date ya cuentan; programada ilegible cae a la de compromiso), el estado con espacios/mayúsculas («Rechazado », « pagado ») y una regla que lanza error o no es función ya no tira el banco.
  - [x] (4.3.29) Días entre fechas (camiones de facturas, envíos lentos de la cadena, barcos y tarimas del puerto, «hace N d» del camión) con `fechaIso()`: una fecha con espacios (« 2026-10-03») o un Date ya cuenta (antes NaN: el camión o el barco desaparecía); ilegible sigue sin contar.
  - [x] (4.3.30) Bitácora en vivo y tarjeta del barco con `fechaIso()`: «hoy» del modelo con espacios, fechas de facturas/envíos/arribos con espacios o Date ya cuentan y una ilegible se salta (antes «hace NaN d»); la tarjeta del contenedor con ETA ilegible dice «s/f» en vez de «Invalid Date».
  - [x] (4.3.31) Reuniones y presencia: `reunionesDelDia()` / `presenciaPersonas()` ya no leen una fecha nula o vacía como 1970 (antes la reunión salía a las 18:00 «hecha» y un viaje sin fecha contaba), una fecha sola 'AAAA-MM-DD' es ese día local (antes UTC: el viaje terminaba un día antes en Guadalajara) y una duración 0, negativa o en basura usa 60 min.
  - [x] (4.3.32) La reunión en curso de la oficina (ventana iluminada de la sala) usa `instante()` / `duracionMin()`: una fecha nula o vacía ya no es 1970 (a las 18:00 salía «en curso») y una duración negativa o basura usa 60 min; fecha con espacios cuenta.
  - [x] (4.3.33) Bitácora en vivo: los montos usan `pesosCorto()` (999 600 ya no sale «$1000 K» sino «$1.0 M»; negativos «-$5 K») y la hora de los pagos/sincronización usa `instante()` (un `pagado_at` 'AAAA-MM-DD' ya no sale «ayer» por UTC; espacios y Date cuentan; ilegible se salta).
  - [x] (4.3.34) `plural()` pura y probada: la cadena de suministro y la tarjeta de racks dicen «1 barco», «1 día», «1 tienda sin venta», «1 marca» (antes «1 barcos», «1 días»…).
  - [x] (4.3.35) `Ciudad.jsx` usa `plural()`: buscador «1 tienda» y panel de la oficina «1 persona · 1 reunión». Harness sin errores (no dibuja `Ciudad.jsx`; el build valida el JSX).
  - [x] (4.3.36) Globos de los edificios con `plural()`: oficina «1 persona · 1 reunión», CEDIS y racks «1 día», «1 SKU de 1 marca», patio «1 andén · 1 tráiler · 1 envío reciente», puerto «1 contenedor navegando», ciudad «1 tienda · 1 vendedor»; resumen del panel «de 1 tienda activas». Harness sin errores.
  - [x] (4.3.37) Tarjetas de la escena con `plural()`: vendedor en ruta «1 cliente», estacionamiento «de 1 cajón», tienda «1 vendedor» (antes «1 clientes», «1 vendedores»). Harness sin errores.
  - [x] (4.3.38) Globo de las casas de clientes finales con `plural()`: «1 cliente compró» y «vía 1 mayorista» (antes «1 clientes compraron»); cuentas faltantes ya no lanzan error. Harness sin errores.
  - [x] (4.7.2) Cadena de suministro en singular con `plural()`: «1 pz» (antes «1 pzs»), «1 recién llegado», «1 barco con más de 3 días de atraso»; tarimas del puerto que no son lista (o con nulos) ya no truenan ni cuentan.
  - [x] (4.7.3) `enMinutos()` pura y probada: la misión y la burbuja de la reunión dicen «empieza ya» a la hora exacta (antes «en 0 min») y una cuenta ≥ 60 min diría «en 1 h 5 min»; ilegible o negativa no pone texto.
  - [x] (4.7.4) Calendario comercial: «Mañana cierra el mes» (antes «en 1 día»), «Buen Fin empieza mañana» y el lunes final «Buen Fin · hoy es el último día» (antes «hasta el lunes 16» el mismo lunes).
  - [x] (4.7.8) Burbuja del banco («Cartera vencida») y capa de ventas/cartera de las ciudades usan `pesosCorto()` (999 600 ya no sale «$1000 K» sino «$1.0 M»; miles de millones «B»; negativos «-$5 K»).
  - [x] (4.7.9) Burbuja del banco con `plural()`: pagos vencidos que vienen en texto («1») dicen «1 pago vencido» (antes «1 pagos vencidos»).
  - [x] (4.7.10) Burbujas del CEDIS y del puerto, motivo de camiones lentos y capas de cuota/cartera con `plural()`: «1» en texto o 1.4 ya no dice «1 pedidos de cliente detenidos» / «1.4 pedidos», miles con coma es-MX («1,200 pedidos»).
  - [x] (4.7.11) Globos de la escena con `pesosCorto()`: banco, racks, tiendas, clientes finales, vendedores y camiones de factura ya no dicen «$-5 K» con negativos (ahora «-$5 K»), igual que tarjetas y bitácora; `fmtK` ya no se usa en la escena. Harness sin errores.
  - [x] (4.7.12) CEDIS con `pesosCorto()`: el globo del CEDIS y el resumen del panel (CEDIS y tarjetas de valor) ya no dicen «$0.0 M» con montos chicos ni «$-0.5 M» con negativos (ahora «$85 K», «-$500 K», «1.2 B»); se quitó `fmtM` de `Ciudad.jsx`. Harness sin errores.
  - [x] (4.7.13) Panel de la Ciudad: los días del CEDIS usan `plural()` como el globo («1 día», «12 días»; antes «12 d» y «NaN d» sin ritmo); se quitó `fmtK` (ya nadie lo usaba) de `escena/etiquetas.js`. Harness sin errores.
  - [x] (4.7.14) Barra de recursos: `recursosBarra()` lee montos en texto con «$», comas o espacios («$5,000»): antes valían 0, la cartera vencida salía en verde y el % de ventas contra cuota en 0.
  - [x] (4.7.15) `numero()` pura y probada (el `N()` interno del modelo): banco, torre, CEDIS, racks, puerto, ventas y cartera de las ciudades leen montos/conteos en texto con «$», comas o espacios («$5,000») como número (antes valían 0 y no sumaban); vacío, booleano, objeto o Infinity → 0.
  - [x] (4.7.16) Capa de cuota, celebraciones y reparto por estado con `numero()`: `cuotasPorCuenta()` (cuota_venta, fact_neta), `cuotaRitmo()`, `celebraciones()` y `repartoPorEstado()` leen «$1,000» / « 2,500 » como número (antes la cuota en texto con «$» no contaba y la venta valía 0).
  - [x] (4.7.17) Capa de ventas/cartera de las ciudades y pensamientos de las tiendas con `numero()`: importe/previo y cartera vencida en texto («$5,000», « 1,200 ») ya cuentan (antes la venta valía 0, el % salía vacío y la cuenta con vencido en texto salía «Sin cartera vencida»).
  - [x] (4.7.18) Tarjetas del CEDIS, racks, contenedor y ciudad, top SKUs, cadena de suministro y bitácora (piezas de tarimas/arribos) con `numero()`: piezas, días, valor e importe en texto («1,200», «$85,000», « 95 ») ya cuentan (antes 0: CEDIS en verde con 95 días, «0 pz», % del rack en 0).
  - [x] (4.7.19) Burbujas y bitácora con `numero()`: la burbuja del banco lee cartera vencida y pagos vencidos en texto («$5,000», « 1 »; antes no salía), los pedidos detenidos del CEDIS en texto («1,200») ya cuentan y una factura o pago de «$750,000» en texto ya sale «grande» en la bitácora.
  - [x] (4.7.20) Salidas de hoy del CEDIS con `fechaIso()`: una factura con fecha con espacios (« 2026-10-07T10:00») o Date ya cuenta (antes se comparaba como texto y no contaba); facturas que no son lista o nulas no truenan. El montacargas usa `numero()`/`plural()` («1 salida», «1,200 salidas» en texto ya cuenta). Harness sin errores.
  - [x] (4.7.21) `unirTexto()` pura y probada: los globos del contenedor («naviera · 1,200 pz · llega hoy»), del camión de factura/envío y del tráiler en el patio saltan naviera/proveedor, cliente, paquetería, fecha o ciudad vacíos (antes «null · 820 pz», «salió undefined») y las piezas en texto o nulas usan `numero()` (antes un null tronaba el globo). Harness sin errores.
  - [x] (4.7.22) Globos sin «null» y en singular: banco «1 pago esta semana · 1 vencido» y torre «1 propuesta abierta · 1 arribo» con `plural()` (aguantan texto/decimal); tienda y vendedor usan la clave de la cuenta si no trae nombre (antes «null · Matriz»); tarimas con `numero()` y contenedor sin id ya no dice «Contenedor undefined». Harness sin errores.
  - [x] (4.7.23) Tarjetas con `numero()`/`fechaIso()`: torre «1 atrasado» con «1» en texto (y estado rojo), tienda con cartera vencida en texto («$5,000») ya sale y en rojo, sin «Vendedores 0»; camión con fecha Date ya no dice «Wed Oct 07» (ilegible → «—»); ruta del vendedor sin destinos nulos; «Tiendas activas» con miles es-MX.
  - [x] (4.7.24) `porcentaje()` pura y probada: capa de ventas («+2,250 % vs mes anterior», antes «2250 %»), cuota del mes en la capa, tarjetas de ciudad/tienda y banderín de la manzana, pensamientos de las tiendas y % del rack usan miles es-MX y signo; ilegible dice «—» en vez de «NaN %». Harness sin errores.
  - [x] (4.7.25) Barra de recursos con `porcentaje()`: «Ventas del mes · 1,250 %» (antes «1250%» pegado; ilegible no pinta barra) y cobertura «1,200 d»; panel de la Ciudad con miles es-MX en tiendas, ciudades, contenedores y camiones («1,200 de 3,400 vendieron»). Harness sin errores.
  - [x] (4.7.26) `dsoTexto()` pura y probada: el aviso de cartera vencida del panel dice «DSO 46 días» / «DSO 1 día» (antes «DSO 45.678 d») y sin DSO (0 o ilegible) ya no pone «DSO 0 d». Harness sin errores.
  - [x] (4.7.27) `piezasTexto()` pura y probada: globos del contenedor, tarima, tráiler y puerto, misión de descarga, bitácora de arribos y top SKUs de la tienda dicen piezas enteras con miles es-MX («1,201 pz»; antes «1,200.5 pz», y en la tienda «NaN pz» con cantidad en texto). Harness sin errores.
  - [x] (4.7.28) `haceDias()` pura y probada: bitácora (camiones/arribos) y tarjeta del camión dicen «hace 1,200 d» con miles es-MX y redondeada (antes «hace 1200 d»); ilegible ya no da «hace NaN d».
  - [x] (4.7.29) `llegaBarco()` / `enMinutos()` con miles es-MX («llega en 1,200 d», «1,500 d tarde», «en 1,200 h») y leen «1,200» en texto (antes «sin ETA»); booleanos ya no cuentan como 1 día/minuto.
  - [x] (4.7.30) Cadena de suministro con miles es-MX («1,200 con ETA vencida», «1,200 en ruta», «1,200 de 1,500 vendieron»; antes «1200»); sala de juntas «1 reunión hoy · todas hechas» y «Hoy en Acteck · 1 pendiente» con `plural()` (miles es-MX). Harness sin errores.
  - [x] (4.7.31) Bitácora en vivo con `unirTexto()`: factura/envío sin cliente o folio, contenedor sin id, pago sin cliente/concepto, sincronización sin estado y reunión sin título ya no dicen «null» («Factura · $1 K», «Salió un envío a pcel · DHL», «Llegó un contenedor al CEDIS», «Fue una reunión»).
  - [x] (4.7.32) `diaLocal()` pura y probada: «hoy» es el día local de Guadalajara. Antes `datos.js` y `construirModelo()` usaban `toISOString()` (UTC) y de 18:00 a 23:59 la Ciudad pedía la agenda, reuniones y viajes de MAÑANA (sala de juntas, misiones y presencia equivocadas) y el banco/bitácora contaban «hoy» un día adelantado; las reuniones se filtran con el rango [inicio, fin) del día local.
  - [x] (4.7.33) `piezasMes()` pura y probada: `demanda3Meses()` (días de inventario de los racks del CEDIS) lee `piezas` en texto JSON «[10,20]» o arreglo Postgres «{10,NULL,20}» (antes indexaba caracteres: «[10,20,30]» sumaba dígitos sueltos); null, objeto o basura → sin demanda y una pieza negativa ya no resta.
  - [x] (4.7.34) Barra de recursos: POs en tránsito y cobertura de inventario en texto con comas («1,200») ya se leen (antes sin POs / sin días) y salen con miles es-MX y `plural()` («1,200 POs»; antes «1200 POs»); booleanos ya no son «1 d». Montos con `numero()`.
  - [x] (4.7.35) Misión «Descargar» del puerto: una tarima sin id dice «Descargar un contenedor · 1,200 pz» (antes «Descargar undefined» y tarjeta «Contenedor undefined»), el id con espacios se limpia y tarimas que no son lista ya no truenan; globo de la ciudad «1,200 de 3,400 tiendas vendieron» con miles es-MX. Harness sin errores.
  - [x] (4.7.36) Títulos de reunión vacíos, con espacios o nulos dicen «Reunión» / «Viaje» con `unirTexto()`: misiones «11:10 · Reunión · en 10 min» (antes «11:10 · null»), burbuja de la oficina, sala de juntas, presencia y tarjeta de la persona («De viaje», antes «De viaje · null»).
  - [x] (4.7.37) `tituloCamion()` / `vaA()` puras y probadas: el camión sin folio dice «Factura» / «Envío» (antes «Factura null», «Envío · null»), el vendedor sin cliente «va a León» (antes «va a null (León)») y sin nombre «Vendedor». Harness sin errores.
  - [x] (4.7.38) `nombrePersona()` pura y probada: la persona de la oficina sin nombre usa la parte del correo antes de «@» y sin nada dice «Persona» (antes `null` en escritorio, globo y tarjeta); nombre y puesto con espacios se limpian y el rol ya no se busca en «null null».
  - [x] (4.7.39) `nombreTienda()` pura y probada: la tienda sin sucursal o sin nombre de cuenta ya no dice «Pcel · null» en pensamientos, buscador y lista del distrito, la tienda en línea sin sucursal dice «En línea» (antes «null (en línea)»), y la tarjeta encuentra la tienda tocada con la misma llave que su edificio (antes salía vacía). Harness sin errores.
  - [x] (4.7.40) `leyendaCuentas()` pura y probada: la leyenda de colores de cuentas sale una vez por cuenta (antes se repetía si el nombre venía con espacios distintos y chocaba la clave de React), un nombre con «|» ya no se parte y una cuenta nula ya no dice «null». Sin prueba visual: el harness no dibuja `Ciudad.jsx`.
  - [x] (4.7.41) Tarjeta del camión: el destino usa `nombreCiudad()` («San Luis Potosí», «León», CDMX; antes «San Luis Potosi», «Leon») y cliente/paquetería vacíos o «null» dicen «—»; el estatus del contenedor con espacios o «null» ya no sale como renglón vacío.
  - [x] (4.7.42) `fechaCorta()` pura y probada: las tarjetas del contenedor en el mar dicen «ETA puerto 23 nov» / «Llega a CEDIS 25 nov» (antes «2026-11-23» crudo, y una fecha ilegible salía tal cual); proveedor vacío o con espacios dice «—».
  - [x] (4.7.43) Tarjeta del camión: «Salió» con `fechaCorta()` («6 oct · ayer», «30 sep · hace 7 d»; antes «2026-10-06» crudo); fecha ilegible sigue en «—».
  - [x] (4.7.44) Vendedores del ERP se juntan por nombre normalizado (« JUAN  PEREZ » = «Juan Perez»): antes el mismo vendedor con espacios o mayúsculas distintas salía como dos coches con la misma tarjeta y sus ventas partidas; sin nombre se salta.
  - [x] (4.7.45) `temperaturaTexto()` pura y probada: el clima del panel dice «24° en Guadalajara» (0 y bajo cero valen) y sin temperatura sólo «Guadalajara» (antes «NaN° en Guadalajara»); las tiendas activas por ciudad del panel salen con miles es-MX («1,200 de 3,400 tiendas»). Sin prueba visual: el harness no dibuja `Ciudad.jsx`.
  - [x] (4.7.46) `pendientesTexto()` pura y probada: el globo de la persona (oficina y de viaje) dice «1 pendiente hoy · 1,200 hechas» con `plural()` (antes «undefined pendientes hoy · NaN hechas» sin dato y sin miles es-MX); el globo del camión de envío dice «salió 6 oct» con `fechaCorta()` (antes «2026-10-06» crudo; ilegible ya no sale). Harness base/mapa/oficina sin errores.
  - [x] (4.7.47) Sucursales se juntan por cuenta sin espacios y nombre con `norm()` (« hermosillo » = «HERMOSILLO»): antes la misma sucursal con espacios o mayúsculas distintas salía como dos tiendas encimadas con la venta partida.
  - [x] (4.7.48) Vendedores de los mayoristas se juntan por cuenta sin espacios y nombre normalizado (« juan  perez » = «JUAN PEREZ»): antes el mismo vendedor con espacios o mayúsculas distintas salía dos veces en la ciudad con la venta partida; sin nombre se salta.
  - [x] (4.7.49) Cartera y clientes finales con la cuenta limpia: un renglón de cartera « digitalife » ya empata con su tienda y su sede (antes no salía en rojo ni en los KPIs con la clave limpia) y una cuenta vacía se salta; las casas de clientes finales cuentan «vía 1 mayorista» aunque la cuenta venga con espacios (antes «vía 2 mayoristas»).
  - [x] (4.7.50) Cuentas sin sucursal con la cuenta limpia: una cuenta « pcel » en la lista de cuentas ya empata sus ventas mensuales (antes la Matriz salía apagada con venta 0) y su nombre; una cuenta con espacios que ya tiene sucursales ya no saca una Matriz doble; la cuenta vacía se salta.
  - [x] (4.7.51) Clave ERP limpia (« 01234 » = «01234») en camiones de facturas y de envíos y en los destinos de los vendedores: antes una clave con espacios mandaba el camión a CDMX con la clave cruda como cliente y el vendedor sin destino; la cuenta sale con la clave limpia del mapa (sede correcta aunque `cuenta` traiga espacios).
  - [x] (4.7.52) `carteraPorCuenta()` pura y probada: si la cartera trae la misma cuenta dos veces (« digitalife » y «digitalife», cortes distintos) gana el `fecha_corte` más reciente (antes el último renglón que llegara, podía ser el corte viejo: vencido y DSO equivocados en la tienda, el banco y los KPIs); fecha ilegible pierde contra legible.
  - [x] (4.7.53) `ciudadDeSucursal()` empata palabras completas y el alias/ciudad más largo primero: «NAPOLEON» ya no cae en León ni «MONTE» en Monterrey, «SUC ESTADO DE MEXICO» va a Toluca (antes CDMX) y «Baja California Sur …» a La Paz (antes Tijuana); «GDL1», «MTY-SUR» y palabras cortadas de ≥ 6 letras («AGUASCAL») siguen empatando.
  - [x] (4.7.54) Sucursal virtual (e-commerce, CEDIS, matriz…) por palabra completa: «WEBER PUEBLA» ya cae en Puebla y «General Escobedo» en Monterrey (alias `ESCOBEDO`), antes ambas salían virtuales y sin ciudad.
  - [x] (4.7.55) `plural()` y `porcentaje()` leen texto con comas, espacios o «%» («1,200» → «1,200 pedidos», « 45 % » → «45 %»; antes «0 pedidos» y «—»); en `plural()` un booleano ya no cuenta como 1.
  - [x] (4.7.56) Sin «-0»: `plural()` y `piezasTexto()` redondean -0.4 a «0 días» / «0 pz» (antes «-0 días», «-0 pz»); `listaCorta()` con n = 0 dice «+3» (antes « +3» con espacio al inicio).
  - [x] (4.7.57) `fechaIso()` con hora y zona («…T03:00:00Z», «… 03:00:00+00» de Postgres) cuenta el día local de Guadalajara, no el de UTC: después de las 18:00 una fecha con hora salía un día adelantada (camión «salió mañana», arribo «llega mañana» siendo hoy). Sin zona se queda el día escrito.
  - [x] (4.7.58) Barra de recursos: la cobertura de inventario -0.4 dice «0 d» (antes «-0 d») y una cobertura negativa (inventario negativo) ya no sale como días («-5 d»): sin texto.
  - [x] (4.7.59) `burbujasAtencion()`: pedidos detenidos negativos ya no dan la burbuja roja «-3 pedidos de cliente detenidos» y barcos/agenda que no son lista no lanzan error.
  - [x] (4.7.60) `rebote()` con t NaN (un `dt` inválido) termina (`fin: true`): antes el rebote al tocar quedaba activo para siempre y nunca restauraba la escala.
  - [x] (4.7.61) Bitácora: facturas, envíos y contenedores sin folio/id llevan cada uno su id (antes todos «factura-null» / «arribo-null» y el filtro de repetidos dejaba sólo uno); el contenedor sin id ya no abre la tarjeta «Contenedor null» y un folio con espacios cuenta igual que sin ellos.
  - [x] (4.7.62) `porcentaje()` con opciones null o que no son objeto ya no lanza error (sin signo) y `plural()` sin palabra (null, vacía, número) dice sólo el número (antes «0 undefineds» / «2 null»); `varios` nulo usa la palabra + «s».
  - [x] (4.7.63) Pin de la ciudad con miles es-MX («León · 🏬 1,200 · 🚚 1,050»; antes «🏬 1200») y `pinCiudad()` regresa `nombre`: el acceso rápido ya no toma el nombre partiendo el texto (una ciudad en blanco salía como «🏬 3») y la ciudad en blanco no entra al top.
  - [x] (4.7.64) Camiones de envíos: la salida es la primera fecha legible (un `fecha_envio_erp` ilegible ya no esconde el camión si `fecha_surtida` es buena) y una entrega en blanco (« ») ya no cuenta como entregado.
  - [x] (4.7.65) `camionesTemporada()` salta facturas sin folio legible (null, vacío): antes la clave null hacía que, si una caía en Buen Fin o en la semana del cierre, TODOS los camiones sin folio se pintaran de promoción; el folio numérico 0 sí cuenta.
  - [x] (4.7.66) Reuniones de la oficina: `reunionesDelDia()` junta las repetidas (mismo id, o mismo título y hora) y «Reuniones hoy» y la reunión en curso salen de esa agenda limpia: una reunión con fecha ilegible o repetida ya no suma en la tarjeta sin aparecer en la sala, y la reunión en curso ya no lleva título «null» (dice «Reunión»).
  - [x] (4.7.67) Acceso rápido de ciudades: el número del botón sale con miles es-MX («León 1,250»; antes «1250») y el título usa `plural()` desde `ciudadesTop()` («Ir a León: 1,200 tiendas activas · 1 camión llegando», «1 tienda activa»; antes «1200 tiendas» y el plural se armaba a mano en `Ciudad.jsx`). Harness sin errores.
  - [x] (4.7.68) Cadena de suministro: `cadenaSuministro()` acepta barcos, camiones, distritos y tiendas que no son lista (antes lanzaba error), lee la ETA en días en texto (« -5 » cuenta como atrasado) y una ETA vacía o ilegible deja el barco en el mar (antes «» valía 0 y salía en puerto); el tramo de clientes finales dice «120 clientes · $2.5 M» (antes «120 · $2.5 M»).
  - [x] (4.7.69) `cuotaRitmo()` empata la cuenta aunque traiga espacios o venga como número (« ct », 10 = «10») sin contar doble si llega en dos formas; `celebraciones()` acepta distritos/tiendas que no son lista (antes lanzaba error).
  - [x] (4.7.70) `cintasCadena()` (cintas mar → puerto → CEDIS → ciudades) acepta barcos, tarimas, camiones, distritos y tiendas que no son lista (antes lanzaba error) y empata la ciudad del camión con `norm()` (« monterrey » = «MONTERREY», antes no engrosaba la cinta); camión o distrito sin ciudad no hace cinta («cedis → undefined»).
  - [x] (4.7.71) `pensamientos()` y `misionesDelDia()` aceptan cartera, distritos, tiendas y agenda que no son lista (antes lanzaban error); la cartera vencida empata la cuenta con espacios (« pcel » = «pcel») y la cuota/venta en texto («1,000», «$900») ya cuenta para «Voy arriba de mi cuota».
  - [x] (4.7.72) `numero()` lee «12%» / « 45 % » (antes 0; igual que `porcentaje()`) y `porcentaje()` con lista u objeto da «—» (antes `[]` salía «0 %»).
  - [x] (4.7.73) `norm()` y `listaCorta()` ya no dejan pasar objetos, listas, booleanos ni Infinity: una cuenta/ciudad/nombre que llega como objeto ya no sale «[OBJECT OBJECT]» / «TRUE» (vacío) y la lista de POs del barco ya no dice «[object Object]».
  - [x] (4.7.74) `carteraPorCuenta()` pone la cuenta en minúsculas («PCEL» / « Digitalife » = `pcel` / `digitalife`, como las cuentas de la Ciudad; antes la cartera vencida no encontraba su tienda ni su sede) y salta clientes que no son texto ni número (antes clave «[object Object]» / «true»).
  - [x] (4.7.75) `claveVista()` limpia el user_id (« u1 » = «u1») y con objeto, lista, booleano, NaN o en blanco usa «anon» (antes la última vista se guardaba en «acteck.ciudad.vista.[object Object]»).
  - [x] (4.7.76) `juntarCapas()` / `capaVisible()` sólo aceptan nombres de capa en texto y sin espacios: un objeto ya no da la capa «[object Object]» y ' mapa ' empata con 'mapa' (antes se repetía y el objeto de la capa mapa se veía de cerca).

  - [x] (4.7.77) `llegaBarco()`, `enMinutos()` y `haceDias()` sólo leen número o texto: una ETA/minutos/antigüedad que llega como lista u objeto ya no sale «llega hoy» / «empieza ya» / «hoy» (`[]` valía 0) y `haceDias(' ')` en blanco ya no dice «hoy».
  - [x] (4.7.78) `hexCss()` sólo acepta enteros 0..0xFFFFFF: un color decimal (255.7, -0.4) ya no se redondea a otro color (#000100 / negro), sale gris como dato roto.
  - [x] (4.7.80) `bitacoraEventos()` y `ponerPosEnPuerto()` aceptan camiones, barcos, tarimas, pagos y agenda que no son lista (antes un objeto o número lanzaba error y tumbaba la bitácora / las POs del puerto; un texto se partía en letras); encontrado con un barrido de datos basura sobre todo `modelo.js`.
  - [x] (4.7.81) Banco cuadra con la cartera de Inicio: `resumenBanco()` da saldo total, % vencido y DSO ponderado por saldo (sólo cuentas con saldo > 0 y DSO, como `dsoPonderado(…, { soloConSaldo: true })`); la tarjeta dice «Cartera vencida $500 · 10 % del saldo» y «Cuentas con vencido 2 · DSO 53 días». `carteraPorCuenta()` deja el DSO vacío/ilegible en null (antes 0 y bajaba el promedio).
  - [x] (4.7.82) `resumenTorre()`: estatus « Borrador » (espacios/mayúsculas) sigue fuera, un `cerrado_at` en blanco ya no cierra la propuesta, `confirmado: 'false'`/`0` ya no cuenta como confirmada, un `comprado_at` en blanco no cuenta como comprada, piezas negativas no restan y renglones que no son objeto se saltan.
  - [x] (4.7.83) CEDIS sin medida de días como Inventario: `diasCedis()` / `diasTexto()` / `tonoDias()` puras y probadas; `dias_inv` null (sin costo de venta de 3 meses) ya no es «0 días» en verde: globo, tarjeta («sin medida», sin color), panel y cadena («sin medida de días», gris). Harness sin errores.
  - [x] (4.7.84) `estatusBarco()` pura y probada: la tarjeta del contenedor dice el estatus con los nombres cortos del Plan de compras (`ESTATUS_CORTO`: «TRANSITO MARITIMO» → «En el mar», «PROXIMO A ZARPAR» → «Por zarpar»; acepta acentos, espacios y minúsculas). Antes la tarjeta del puerto no lo mostraba y la de respaldo salía en mayúsculas crudas; sin ETA dice «sin ETA · por zarpar».
  - [x] (4.7.85) Cuota como Análisis: `cuotasPorCuenta()` junta la cuota por cliente ERP y sólo los clientes con cuota > 0 suman su venta (antes la venta de un cliente con cuota 0 inflaba el % de la cuenta en la capa «Cuota», pensamientos y celebraciones); renglón sin cliente ERP ya no suma cuota.
  - [x] (4.7.86) `nombrePersona()`: sin nombre, el correo sale legible («ana.lopez» / «juan_perez-ruiz» → «Ana Lopez» / «Juan Perez Ruiz»; antes «ana.lopez» en el escritorio, la tarjeta y el globo); números o separadores solos → «Persona».
  - [x] (4.7.87) `pendientesTexto()`: un conteo negativo o infinito cuenta 0 (antes «-2 hechas» en el globo de la persona).

## Necesita a Fernando (el agente no lo hace)

- Nombres del personal de almacén/ventas que no está en el dashboard.
- Cualquier vista o tabla nueva en Supabase (el agente no corre migraciones).
- `~/acteck/ciudad/.env.local` con `SUPABASE_ACCESS_TOKEN` para probar con datos reales en el harness.
- Etapa 8: quién más puede entrar a la Ciudad.
- Camiones por guía real (Etapa 5): `guias_erp` no la lee el frontend (sólo la RPC `oc_sincronizar_erp` la liga a `oc_envios`, que la Ciudad ya dibuja). Para usar el destino de la guía hace falta una vista con ciudad/estado destino (o permitir que la Ciudad lea `guias_erp`).
- Capa «Inventario» por ciudad (Capas de información): no hay vista de inventario en tienda por sucursal/ciudad (sólo `v_sellout_inventario_cuenta_sku` por cuenta). Opciones: pintar por cuenta con esa vista (mismo tono en todas las ciudades de la cuenta) o crear una vista por sucursal; decidir.
- Burbuja «inventario bajo de un SKU A»: la alerta `stock_vs_transito` está apagada para todos (def 'off') y no hay clasificación ABC a la mano; decidir la fuente (¿prender la alerta?) y el agente la conecta al CEDIS.
- Inventario en tienda (Tienda visitable): no hay vista de inventario por sucursal (sólo `v_sellout_inventario_cuenta_sku` por cuenta); si existe una, el agente la agrega a la tarjeta de la tienda.
- Precisión del pronóstico en la torre (Etapa 3): mover `compararForecast()` de `comercial/proyectos/ForecastSeguimiento.jsx` a un archivo puro (p. ej. `forecastCalc.js`) y decir de dónde sale la serie real por SKU que usa «Forecast vs real»; con eso el agente la muestra en la tarjeta de la torre.

## Hecho

- 2026-11-23 15:16 · v4.12.1 · Pulido: tarjeta de la oficina suma pendientes/hechas/genéricos como número ≥ 0 (antes «2» en texto se concatenaba y los negativos restaban); +1 prueba.
- 2026-11-23 05:56 · v4.7.86 · Pulido: `nombrePersona()` convierte el correo en nombre legible («Ana Lopez») cuando la persona no trae nombre.
- 2026-11-23 06:16 · v4.7.87 · Pulido: `pendientesTexto()` ya no muestra conteos negativos («-2 hechas» → «0 hechas»).
- 2026-11-23 05:37 · v4.7.85 · Cuota por cuenta cuadra con Análisis: venta sólo de clientes ERP con cuota > 0; +1 prueba.
- 2026-11-23 05:17 · v4.7.84 · Tarjeta del contenedor con estatus «En el mar» / «Por zarpar» como el Plan de compras (`estatusBarco()`; antes no salía o salía crudo); +1 prueba. El pendiente de Etapa 8 (más usuarios) sigue esperando a Fernando.
- 2026-11-23 04:58 · v4.7.83 · CEDIS con `dias_inv` null dice «sin medida de días» (antes «0 días» en verde) en globo, tarjeta, panel y cadena; +1 prueba.
- 2026-11-23 03:36 · v4.7.79 · `listasDatos()`: si una lista de datos llega como objeto/texto/número se toma vacía (antes `construirModelo()` lanzaba error y tumbaba la Ciudad).
- 2026-11-23 03:15 · v4.7.78 · `hexCss()` con decimal → gris (antes color redondeado).

- 2026-11-23 02:36 · v4.7.76 · `juntarCapas()` / `capaVisible()` sin «[object Object]» y con capas sin espacios; +1 prueba.

- 2026-11-23 02:16 · v4.7.75 · `claveVista()` sin «[object Object]» y con el id sin espacios; +1 prueba.

- 2026-11-23 01:56 · v4.7.74 · `carteraPorCuenta()` empata la cuenta en mayúsculas y salta clientes que no son texto; +1 prueba.

- 2026-11-23 01:36 · v4.7.73 · `norm()` / `listaCorta()` sin «[object Object]» ni «TRUE» con datos que no son texto (pruebas nuevas).

- 2026-11-23 00:56 · v4.7.71 · `pensamientos()` / `misionesDelDia()` sin errores con listas raras; cartera vencida con cuenta con espacios y cuota en texto; +1 prueba.
- 2026-11-23 00:37 · v4.7.70 · cintasCadena() sin errores con listas raras y ciudad del camión normalizada.

- 2026-11-22 23:56 · v4.7.68 · `cadenaSuministro()`: listas que no son lista sin error, ETA en texto/vacía bien leída y «N clientes» en el tramo de clientes finales; +1 prueba.
- 2026-11-22 23:36 · v4.7.67 · Acceso rápido de ciudades con miles es-MX y título con `plural()` desde `ciudadesTop()`; +1 prueba.
- 2026-11-22 23:17 · v4.7.66 · Reuniones de la oficina sin repetidas; conteo y reunión en curso desde la agenda limpia.
- 2026-11-22 22:57 · v4.7.65 · `camionesTemporada()`: factura sin folio ya no pinta de promoción a todos los camiones sin folio; +1 prueba.
- 2026-11-22 22:35 · v4.7.64 · Camiones de envíos: salida = primera fecha legible (ERP ilegible cae a la surtida) y entrega en blanco no cuenta como entregado.
- 2026-11-22 22:16 · v4.7.63 · pinCiudad()/ciudadesTop(): miles es-MX en el pin y acceso rápido sin ciudad en blanco.
- 2026-11-22 15:56 · v4.7.62 · `porcentaje()` con opciones null sin error y `plural()` sin palabra sin «undefineds»/«null»; +1 prueba.
- 2026-11-22 15:15 · v4.7.60 · `rebote()`: t NaN termina el rebote al tocar (antes nunca se soltaba); +3 pruebas.
- 2026-11-22 06:16 · v4.7.59 · Burbujas de atención sin pedidos detenidos negativos y sin error con barcos/agenda que no son lista.
- 2026-11-22 05:56 · v4.7.58 · Cobertura de inventario sin «-0 d» ni días negativos en la barra de recursos.
- 2026-11-22 05:37 · v4.7.57 · `fechaIso()` con hora y zona usa el día local (antes, de noche, camiones/arribos salían un día adelantados).
- 2026-11-22 04:56 · v4.7.55 · `plural()`/`porcentaje()` leen «1,200» y «45 %» en texto; booleanos ya no son «1».
- 2026-11-22 04:39 · v4.7.54 · Sucursales virtuales por palabra completa («General Escobedo» → Monterrey, «Weber Puebla» → Puebla).
- 2026-11-22 04:37 · v4.7.53 · Sucursales → ciudad por palabras completas y alias más largo primero (sin León por «Napoleón» ni CDMX por «Estado de México»).
- 2026-11-22 04:16 · v4.7.52 · Cartera: con la misma cuenta dos veces gana el corte más reciente (`carteraPorCuenta()`).

- 2026-11-22 03:56 · v4.7.51 · Camiones y destinos de vendedores empatan la clave ERP sin espacios (sede y nombre correctos); +1 prueba.
- 2026-11-22 03:36 · v4.7.50 · Cuentas sin sucursal empatan cuenta/ventas mensuales sin espacios (sin Matriz apagada ni doble); +1 prueba.
- 2026-11-22 02:56 · v4.7.48 · Vendedores de mayoristas juntados por cuenta/nombre normalizado (sin duplicados ni venta partida); +1 prueba.
- 2026-11-22 02:24 · v4.7.47 · Sucursales juntadas por cuenta/nombre normalizado (sin tiendas duplicadas ni venta partida); +1 prueba.
- 2026-11-22 01:36 · v4.7.43 · Tarjeta del camión: «Salió» con fecha corta es-MX («6 oct · ayer») (+1 prueba).
- 2026-11-22 01:18 · v4.7.42 · `fechaCorta()`: ETA y llegada a CEDIS del contenedor en «23 nov» (antes ISO crudo); proveedor vacío «—»; +1 prueba.
- 2026-11-22 01:16 · v4.7.41 · Tarjeta del camión: destino con acentos (`nombreCiudad()`), cliente/paquetería sin «null»; estatus del contenedor limpio; +1 prueba.
- 2026-11-22 00:56 · v4.7.40 · Leyenda de cuentas sin repetidos, sin «null» ni nombres partidos con `leyendaCuentas()`; +1 prueba.
- 2026-11-22 00:37 · v4.7.39 · Tiendas sin sucursal/nombre de cuenta ya no dicen «null» y su tarjeta vuelve a mostrar números; +1 prueba.
- 2026-11-22 00:16 · v4.7.38 · Oficina: persona sin nombre usa su correo o «Persona» (antes null).
- 2026-11-21 23:56 · v4.7.37 · Camión sin folio y vendedor sin cliente/nombre ya no dicen «null» en sus globos; +1 prueba.
- 2026-11-21 23:36 · v4.7.36 · Títulos de reunión/viaje vacíos o nulos ya no dicen «null» en misiones, burbujas, presencia y tarjeta de la persona.
- 2026-11-21 23:17 · v4.7.35 · Misión «Descargar» sin «undefined» con tarimas sin id; globo de la ciudad con miles es-MX; +1 prueba.
- 2026-11-21 22:56 · v4.7.34 · Barra de recursos: POs y cobertura en texto con comas se leen; «1,200 POs» con miles es-MX; +1 prueba. (El pendiente de permisos de Etapa 8 sigue esperando a Fernando.)
- 2026-11-21 22:36 · v4.7.33 · `piezasMes()`: la demanda de 3 meses (días de inventario por marca) lee piezas en texto JSON/Postgres; basura y negativas no suman.
- 2026-11-21 22:17 · v4.7.32 · `diaLocal()`: agenda, reuniones, viajes y «hoy» del modelo en día local (antes UTC: después de las 18:00 era mañana); +1 prueba.
- 2026-11-21 15:56 · v4.7.31 · Bitácora en vivo sin «null» con `unirTexto()` (cliente, folio, contenedor, concepto, estado, título vacíos); +1 prueba.
- 2026-11-21 15:37 · v4.7.30 · Cadena de suministro con miles es-MX; sala de juntas y misiones pendientes con `plural()`; +1 prueba.
- 2026-11-21 15:16 · v4.7.29 · `llegaBarco()`/`enMinutos()` con miles es-MX y ETA/minutos en texto con comas.

- 2026-11-21 06:15 · v4.7.28 · `haceDias()`: antigüedad «hoy/ayer/hace N d» con miles es-MX en bitácora y tarjeta del camión; +1 prueba.
- 2026-11-21 05:57 · v4.7.27 · `piezasTexto()`: piezas enteras con miles es-MX en globos del puerto/patio, misión, bitácora y top SKUs; +1 prueba.
- 2026-11-21 05:36 · v4.7.26 · `dsoTexto()`: DSO del aviso de cartera del panel redondeado y en días («DSO 46 días»), sin «DSO 0 d»; +1 prueba.
- 2026-11-21 05:17 · v4.7.25 · Barra de recursos con `porcentaje()` («1,250 %») y cobertura «1,200 d»; panel con miles es-MX; +1 prueba.
- 2026-11-21 04:56 · v4.7.24 · `porcentaje()`: % de capas, tarjetas, banderín de cuota, pensamientos y racks con miles es-MX, signo y «—» si es ilegible; +1 prueba. Se movió la nota 4.7.23 de «Necesita a Fernando» a Pulido.
- 2026-11-21 04:24 · v4.7.23 · Tarjetas de torre, tienda, camión, vendedor y ciudad leen texto/Date con `numero()`/`fechaIso()`; +1 prueba.
- 2026-11-21 04:20 · v4.7.22 · Globos del banco, torre, tienda, vendedor y tarimas sin «null»/«undefined» y con `plural()`; +1 prueba.
- 2026-11-21 04:17 · v4.7.21 · Globos de contenedor, camión y tráiler con `unirTexto()`: sin «null · …» ni «salió undefined»; piezas con `numero()`.
- 2026-11-21 03:56 · v4.7.20 · salidas de hoy del CEDIS leen la fecha con `fechaIso()` y el montacargas usa `numero()`/`plural()`; +1 prueba.
- 2026-11-21 03:16 · v4.7.18 · tarjetas (CEDIS, racks, contenedor, ciudad), top SKUs y piezas de la cadena/bitácora leen montos en texto con `numero()`; +1 prueba.
- 2026-11-21 02:56 · v4.7.17 · capa de ventas/cartera y pensamientos leen montos en texto («$5,000») con `numero()`; +1 prueba.
- 2026-11-21 02:36 · v4.7.16 · capa de cuota, celebraciones y reparto por estado leen montos en texto («$1,000») con `numero()`; +5 pruebas.
- 2026-11-21 02:16 · v4.7.15 · `numero()` (antes `N()`): montos en texto («$5,000», « 1,200 ») ya suman en banco, torre, CEDIS, puerto y ciudades; +1 prueba.
- 2026-11-21 01:55 · v4.7.14 · barra de recursos: montos en texto («$5,000») ya no valen 0 (cartera vencida en verde, % de ventas 0); +2 pruebas.
- 2026-11-21 01:36 · v4.7.13 · panel: días del CEDIS con `plural()` (sin «NaN d»); adiós `fmtK`.
- 2026-11-21 01:16 · v4.7.12 · globo del CEDIS y resumen del panel con `pesosCorto()` (sin «$0.0 M» ni «$-0.5 M»); adiós `fmtM`.
- 2026-11-21 00:56 · v4.7.11 · globos de la escena (banco, racks, tiendas, clientes finales, vendedores, camiones) con `pesosCorto()`: negativos «-$5 K» en vez de «$-5 K».
- 2026-11-21 00:36 · v4.7.10 · burbujas CEDIS/puerto, camiones lentos y capas de cuota/cartera con `plural()` (conteos en texto/decimal); +5 pruebas.
- 2026-11-21 00:17 · v4.7.9 · burbuja del banco: «1 pago vencido» aunque el conteo venga en texto; +1 prueba.
- 2026-11-21 00:16 · v4.7.8 · burbuja del banco y capa de ventas/cartera con `pesosCorto()` (sin «$1000 K»); +1 prueba.
- 2026-11-20 23:55 · v4.7.7 · Cifras cortas: miles de millones en «B» (como el dashboard) y montos en texto con «$»/comas ya no salen «$0» en etiquetas y tarjetas.
- 2026-11-20 23:35 · v4.7.6 · tarjeta del contenedor: ETA «mañana» en vez de «en 1 d» (`llegaBarco()`); +1 prueba.
- 2026-11-20 23:16 · v4.7.5 · barcos: «llega hoy», «llega mañana» y «N d tarde» (`llegaBarco()`); +1 prueba.
- 2026-11-20 22:55 · v4.7.4 · calendario: «Mañana cierra el mes», «Buen Fin empieza mañana» y «hoy es el último día»; +6 pruebas.
- 2026-11-20 22:36 · v4.7.3 · reuniones a la hora exacta dicen «empieza ya» (antes «en 0 min»), `enMinutos()` probado.
- 2026-11-20 22:16 · v4.7.2 · cadena de suministro en singular («1 pz», «1 recién llegado»); tarimas que no son lista no truenan.
- 2026-11-20 06:05 · v4.3.38 · globo de clientes finales en singular con 1 (`plural()`).
- 2026-11-20 04:55 · v4.3.37 · tarjetas de vendedor en ruta, estacionamiento y tienda en singular con 1 (`plural()`); +1 prueba.
- 2026-11-20 04:26 · v4.3.36 · globos de oficina, CEDIS, racks, patio, puerto y ciudad en singular con 1 (`plural()`); +1 prueba.
- 2026-11-20 03:08 · v4.3.35 · buscador y panel de la oficina en singular con 1 («1 tienda», «1 reunión»).
- 2026-11-20 03:05 · v4.3.34 · `plural()`: cadena y racks en singular con 1 («1 barco», «1 día»); +1 prueba.
- 2026-11-20 01:56 · v4.3.33 · bitácora: montos con `pesosCorto()` y pagos con fecha sola/espacios/Date sin corrimiento UTC; +1 prueba.
- 2026-11-20 01:36 · v4.3.32 · reunión en curso de la oficina aguanta fecha nula y duración mala; +1 prueba.
- 2026-11-20 01:16 · v4.3.31 · reuniones y presencia aguantan fechas nulas, solo-día y duraciones malas.
- 2026-11-20 00:56 · v4.3.30 · Pulido: bitácora en vivo y tarjeta del barco aguantan fechas sucias (sin «hace NaN d» ni «Invalid Date»); +1 prueba.
- 2026-11-20 00:36 · v4.3.29 · Pulido: días entre fechas (camiones, cadena, puerto) usan `fechaIso()`: fechas con espacios o Date ya no desaparecen el camión/barco; +1 prueba.
- 2026-11-20 00:16 · v4.3.28 · Pulido: banco aguanta fechas y estados sucios en pagos, «hoy» inválido y reglas que fallan (`resumenBanco()` usa `fechaIso()`); +1 prueba.
- 2026-11-19 23:56 · v4.3.27 · Pulido: torre de pronóstico con fechas de arribo sucias (espacios, ilegibles, Date) y líneas que no son lista; `resumenTorre()` usa `fechaIso()`.
- 2026-11-19 23:36 · v4.3.26 · Pulido: pines de ciudad y acceso rápido aguantan distritos/tiendas no-lista, empatan la ciudad del camión con `norm()` y ya no juntan camiones sin ciudad; +2 pruebas.
- 2026-11-19 23:17 · v4.3.25 · Pulido: proyección `aPx()` / `pxAEscena()` aguanta coordenadas ilegibles (caen en el origen, sin NaN en el terreno ni en objetos); +1 prueba.
- 2026-11-19 22:56 · v4.3.24 · Pulido: capa de cuota aguanta cuota en texto y cuenta con espacios (`cuotaRitmo()` / `cuotasPorCuenta()`); +1 prueba.
- 2026-11-19 22:36 · v4.3.23 · Pulido: `nivelVista()` sin centro legible ya no dice «ciudad»; POs en tránsito en singular y sin «0/NaN POs» en la barra de recursos; +1 prueba.
- 2026-11-19 22:16 · v4.3.22 · Pulido: barra de tiempo y camiones de temporada aguantan listas crudas que no son lista (`comoLista()`); +1 prueba.
- 2026-11-19 15:56 · v4.3.21 · Pulido: `posDe()` y `hexCss()` aguantan entradas inválidas (sin posiciones NaN ni «#000NaN»); +1 prueba.
- 2026-11-19 15:36 · v4.3.20 · Pulido: `cuantos()` para `max`/`n` inválidos en las listas del modelo (antes salían vacías); +1 prueba.
- 2026-11-19 15:16 · v4.3.19 · Pulido: funciones del modelo aguantan listas que no son lista y opciones null (`comoLista()`; +1 prueba).
- 2026-11-19 06:15 · v4.3.18 · Pulido: aviso de Navidad en singular a un día y top de ciudades con `n` inválido; pruebas nuevas.
- 2026-11-19 05:56 · v4.3.17 · Pulido: barra de tiempo y camiones de temporada con fechas ilegibles; vistas/minimapa con opciones null; pruebas nuevas.
- 2026-11-19 05:15 · v4.3.15 · Pulido: etiquetas sin encimar con margen/prioridad inválidos y árboles sin tono NaN (pruebas nuevas).
- 2026-11-19 04:56 · v4.3.14 · Pulido: gesto de dos dedos sin NaN con toques incompletos (evita pantalla negra), rebote/saltito con duración inválida, `capasSonido(null)` y `ventanasOficina()` con total inválido; pruebas nuevas.
- 2026-11-19 04:36 · v4.3.13 · Pulido: fechas ilegibles en contenedores/envíos/facturas ya no dan NaN (barco fuera del mar, camión perdido, «hace NaN d»); `fechaIso()` probada.

<!-- El agente agrega aquí: - AAAA-MM-DD HH:MM · vX.Y.Z · qué cambió (una línea) -->
- 2026-11-19 04:15 · v4.3.12 · Pulido: encuadre de cámara, minimapa y top SKUs a prueba de parámetros inválidos.
- 2026-11-19 03:56 · v4.3.11 · racks del CEDIS y circuito de vendedores a prueba de parámetros inválidos (cols 0/decimal, maxNiveles NaN, tieneRuta nulo, max 0).
- 2026-11-19 03:35 · v4.3.10 · barcos con ETA vacía o en texto ya no salen atracados por error; escritorios aguantan n decimal y cols 0.
- 2026-11-19 03:06 · v4.3.9 · tarjetas de edificio con pesos cortos uniformes y a prueba de renglones nulos.
- 2026-11-19 01:57 · v4.3.8 · «Hoy en Acteck» (`misionesDelDia()`) salta reuniones/tarimas nulas y ya no dice «en NaN min» ni «en -N min».
- 2026-11-19 01:56 · v4.3.7 · `repartoPorEstado()` empata cuentas con espacios o numéricas y año/mes en texto (clientes finales por estado ya no se pierden).
- 2026-11-19 01:36 · v4.3.6 · Capas de ciudades y barra de tiempo aguantan renglones nulos (`capaCiudades()`, `datosEnFecha()`; +2 pruebas).
- 2026-11-19 01:15 · v4.3.5 · `pinCiudad()`, `ciudadesTop()` y `ponerPosEnPuerto()` aguantan tiendas, distritos y barcos nulos (antes tumbaban minimapa, pines y tarjeta del puerto).
- 2026-11-19 00:56 · v4.3.4 · `construirModelo()`, etiquetas y ventanas de la oficina aguantan renglones nulos (`sinNulos()`).
- 2026-11-19 00:26 · v4.3.3 · Pensamientos, celebraciones, burbujas y bitácora aguantan renglones nulos y fecha inválida (+1 prueba).
- 2026-11-18 23:35 · v4.3.2 · Cadena de suministro y circuito de vendedores aguantan renglones nulos y ciclos inválidos (+1 prueba).
- 2026-11-18 23:06 · v4.3.1 · `fechaHoy()`: las capas con fecha (misiones, bitácora, burbujas, calendario, camiones de temporada, demanda) y el modelo aguantan un «hoy» nulo/inválido (+1 prueba).
- 2026-11-18 15:55 · v3.111.1 · Presencia y reuniones de la oficina aguantan personas nulas y fecha inválida (+1 prueba).
- 2026-11-18 15:35 · v3.110.4 · Pulido: torre y banco ya no truenan con renglones nulos o fecha inválida (pruebas nuevas).
- 2026-11-18 15:15 · v3.110.3 · Racks del CEDIS: SKU limpio (espacios/minúsculas) en `racksPorMarca()` y `demanda3Meses()`, con prueba.
- 2026-10-08 02:57 · v3.90.87 · Pulido: `cuotasPorCuenta()` empata clientes con espacios.
- 2026-10-08 02:55 · v3.90.86 · Pulido: `recursosBarra()` sin «NaN d»/«Infinity d» en la cobertura de inventario.
- 2026-10-08 02:37 · v3.90.85 · Pulido: `cuotaRitmo()` sin «NaN %» con fecha inválida o venta faltante.
- 2026-10-08 02:35 · v3.90.84 · Pulido: `listaCorta()` sin vacíos ni repetidos (POs del barco).
- 2026-10-08 02:17 · v3.90.83 · Pulido: cifras cortas sin «1000 K» ni «$0.0 M» (borde K→M, negativos) en etiquetas, tarjetas y cartera vencida.
- 2026-10-08 01:57 · v3.90.82 · Pulido: nombres de ciudad con acentos y conectores en minúscula (San Luis Potosí, Ciudad Juárez, Lagos de Moreno) en etiquetas, pines y tarjetas.
- 2026-10-08 01:23 · v3.90.81 · Pulido: pruebas de coherencia de la proyección y de los catálogos de ciudades/cuentas.
- 2026-10-08 01:22 · v3.90.80 · Nota «Acteck Ciudad» de CLAUDE.md al día (kit low-poly, rebote/saludo, sonido, versión ligera, recorrido).
- 2026-10-08 01:20 · v3.90.79 · Botones grandes en iPad/celular (cierra «Gestos táctiles completos»).
- 2026-10-08 01:18 · v3.90.78 · Versión ligera automática en iPad/celular: sin sombras, menos resolución y menos paseantes.
- 2026-10-08 01:15 · v3.90.77 · Gestos táctiles: dos dedos giran y acercan, toque largo muestra la info, el toque corto elige lo que está bajo el dedo.
- 2026-10-08 01:14 · v3.90.76 · Sonido ambiente opcional (apagado por defecto): ciudad, pájaros o grillos y lluvia según el clima; cierra la Etapa 7.
- 2026-10-08 01:10 · v3.90.75 · Recorrido de bienvenida de 3 pasos la primera vez y botón «?» para repetirlo.
- 2026-10-08 01:07 · v3.90.74 · Animaciones de respuesta, paso 2 (cierra el pendiente): la gente da dos saltitos al pasarle el cursor.
- 2026-10-08 01:04 · v3.90.73 · Animaciones de respuesta, paso 1: lo que tocas rebota (tiendas completas, oficina, CEDIS).
- 2026-10-08 01:01 · v3.90.72 · Kit low-poly, paso 5 (cierra el pendiente): paleta de día alineada al tema Marfil del sistema de diseño.
- 2026-10-08 00:59 · v3.90.71 · Kit low-poly, paso 4: árboles variados (pinos, copas redondas, palmas y arbustos) por posición, todos instanciados.
- 2026-10-08 00:57 · v3.90.70 · Kit low-poly, paso 3: oficina y CEDIS biselados; las ventanas de la oficina se prenden según quién está (los de viaje apagan la suya).
- 2026-10-08 00:55 · v3.90.69 · Kit low-poly, paso 2: azoteas con tinacos, antenas y pretil; casitas con techo de dos aguas alternado.
- 2026-10-08 00:51 · v3.90.68 · Kit low-poly, paso 1: tiendas con cuerpo biselado (facetado) y ventanas laterales que se iluminan de noche.
- 2026-10-08 00:46 · v3.90.67 · Calendario comercial, paso 3: camiones de facturas de Buen Fin o de la semana del cierre van con caja roja de promoción y lo dicen en su título.
- 2026-10-08 00:43 · v3.90.66 · Calendario comercial, paso 2: letrero del cierre de mes sobre la oficina, banderines de Buen Fin por ciudad y foquitos navideños en la escena (harness `?fecha=`).
- 2026-10-08 00:36 · v3.90.65 · Calendario comercial, paso 1: `eventosCalendario()` (cierre de mes, Buen Fin, regreso a clases, Navidad) y sus chips en el panel «Hoy en Acteck».
- 2026-10-08 00:33 · v3.90.64 · Barra de tiempo en la UI (junto a las capas): Hoy / Ayer / Hace 7 días / Inicio de mes rearma la ciudad con `datosEnFecha(modelo.crudos, fecha)`; aviso «Viendo … · aproximado» arriba al centro con «Volver a hoy». Harness `?momento=ayer|semana|mes`.
- 2026-10-08 00:32 · v3.90.63 · Barra de tiempo, paso 1: `momentosTiempo()` y `datosEnFecha()` puros y probados (reconstruyen facturas, envíos, contenedores y ventas mensuales a Ayer / Hace 7 días / Inicio de mes); falta la barra en la UI.
- 2026-10-08 00:28 · v3.90.62 · Celebraciones: fuegos artificiales sobre la base cuando la cuota del mes ya se cruzó y confeti sobre las tiendas que volvieron a vender este mes tras no vender el anterior.
- 2026-10-08 00:25 · v3.90.61 · Banderín de cuota: cada manzana con cuota lleva un banderín verde/ámbar/rojo (avance de cuota vs ritmo del mes) visible de cerca; al tocarlo abre la tarjeta de la ciudad.
- 2026-10-08 00:23 · v3.90.60 · Cuota vs ritmo en tarjetas: la ciudad muestra «Cuota del mes» de sus cuentas y la tienda «Cuota de la cuenta» (% de la cuota · ritmo del mes), con la misma regla que la capa «Cuota».
- 2026-10-08 00:21 · v3.90.59 · Cadena en la escena: con «Cadena» activa se dibujan cintas mar → puerto → CEDIS → ciudades, más gruesas con más volumen y en rojo/ámbar donde se atora; tocar un tramo de la tira lleva la cámara al puerto, la base o el mapa.
- 2026-10-08 00:16 · v3.90.58 · Cadena de punta a punta (paso 1): botón «Cadena» con la tira mar → puerto → CEDIS → camiones → tiendas → clientes finales, volumen de cada tramo y en rojo/ámbar dónde se atora (ETA vencida, días de inventario, envíos lentos, tiendas sin venta).
- 2026-10-07 23:59 · v3.90.57 · Seguir a alguien: botón «Seguir» en la tarjeta de vendedores, camiones y barcos; la cámara se queda pegada a él con una ficha «Siguiendo … · Soltar»; arrastrar, tocar el mapa o «Esc» lo suelta.
- 2026-10-07 23:57 · v3.90.56 · Cuentas sin sucursal repartidas por estado: además de su Matriz en la sede, una tienda «Clientes en <ciudad>» en cada estado donde venden a clientes finales (mes actual y anterior, top 6), sin contar en los KPIs de tiendas.
- 2026-10-07 23:54 · v3.90.55 · Barcos por ETA real: el más atrasado atraca en Manzanillo y descarga sus cajas una por una; los demás con ETA vencida esperan en fila; los que llegan en ≤ 7 días se acercan; el hover dice «descargando», «esperando muelle» o «llega en N d».
- 2026-10-07 23:51 · v3.90.54 · Tarjeta del camión: factura (cliente, monto, piezas, salió) o envío del Tracking (cliente, paquetería, salió, destino; ámbar si lleva > 5 días). Guías reales (`guias_erp`) → «Necesita a Fernando».
- 2026-10-07 23:49 · v3.90.53 · Vendedores del ERP en circuito real: CEDIS → sedes de sus 3 clientes principales (ciudades únicas, `circuitoVendedor` / `tramoActual` puros) → CEDIS; el hover dice a quién van ahora y su tarjeta muestra ventas del mes y del año, clientes y ruta (`v_ventas_vendedor_cliente_mes` ahora con `mes`).
- 2026-10-07 23:45 · v3.90.52 · Pensamientos: hasta 5 nubes de «pensar» sobre tiendas («Tengo pagos vencidos», «Este mes no he vendido nada», «Vendo N % menos…», «¡Voy N % arriba…!», «Voy arriba de mi cuota») con reglas puras `pensamientos()`; una por ciudad, lo urgente primero; tocar abre la tarjeta de la tienda.
- 2026-10-07 23:43 · v3.90.51 · Bitácora en vivo (paso 2): pagos registrados de los últimos 3 días (Pagos V3, `pagado_at`; «Ver» vuela al banco) y la última sincronización del puente (`sync_events`, como Configuración) como eventos; cada consulta falla sola.
- 2026-10-07 23:41 · v3.90.50 · Bitácora en vivo (paso 1): `bitacoraEventos()` — facturas que salieron (en negritas ≥ $500 K), envíos surtidos, contenedores que llegaron al CEDIS y reuniones de hoy, lo más nuevo primero con «hoy / ayer / hace N d» u hora; sección «Bitácora» en el panel derecho con «Ver» (reemplaza las líneas de camiones).
- 2026-10-07 23:38 · v3.90.49 · Capas de información (paso 3): botón «Cuota» — avance del mes de las cuentas con tiendas en cada ciudad (venta ÷ cuota sumadas, `v_cuota_erp_mes` + `mv_analisis_cliente_mes` como Análisis) contra el ritmo del mes: verde al ritmo, ámbar hasta 20 % abajo, rojo peor, gris sin cuota. Capa Inventario → «Necesita a Fernando».
- 2026-10-07 23:36 · v3.90.48 · Capas de información (paso 2): botones «Sin capa · Ventas · Cartera» abajo a la izquierda con leyenda; `escena.capa(nombre)` pone un disco translúcido del tono bajo cada ciudad (crece con el zoom para leerse en el mapa) y el hover de la ciudad dice el dato de la capa. Harness: `?capa=ventas` / `?capa=cartera&mapa`.
- 2026-10-07 23:32 · v3.90.47 · Capas de información (paso 1): `capaCiudades()` puro — tono por ciudad para Ventas (sell out del mes vs anterior: verde ≥ 0, ámbar hasta −20 %, rojo peor, gris sin venta) y Cartera (cuentas con vencido entre sus tiendas), con leyenda; probado. Aún sin dibujar.
- 2026-10-07 23:29 · v3.90.46 · «Hoy en Acteck»: lista de misiones del día (`misionesDelDia()`: cartera/pagos vencidos, contenedores con ETA vencida o por llegar, pedidos detenidos, reuniones de hoy y contenedores por descargar; rojo → ámbar → por hora, hechas tachadas) en el panel de abajo a la derecha, cada una con «Ir» que vuela al edificio y abre su tarjeta.
- 2026-10-07 23:26 · v3.90.45 · Burbujas de atención (paso 3): pedidos de cliente detenidos (alerta `oc_detenida`, consulta chica) → globo rojo sobre el CEDIS que abre su tarjeta; inventario bajo SKU A queda para Fernando
- 2026-10-07 23:23 · v3.90.44 · Burbujas de atención (paso 2): globo rojo/ámbar con icono flotando sobre banco, puerto u oficina cuando `burbujasAtencion()` lo pide; tocarlo abre la tarjeta del edificio con el motivo. Harness `?burbujas`
- 2026-10-07 23:21 · v3.90.43 · Burbujas de atención (paso 1): `burbujasAtencion()` decide qué edificio pide atención (banco, puerto, oficina) y por qué; probado, aún sin dibujar
- 2026-10-07 23:18 · v3.90.42 · Barra superior de recursos (arriba a la derecha, en lugar de la ayuda, que pasa a tooltip): ventas del mes vs cuota con barrita, inventario con cobertura, cartera vencida y en tránsito con POs, con los mismos números que Inicio (`useInicioData` + `calcular`; `recursosBarra()` probado); tocar uno vuela a oficina/CEDIS/banco/puerto. Sin verificación visual (el harness no dibuja la UI de React)
- 2026-10-07 23:15 · v3.90.41 · Tienda visitable: la tarjeta de la tienda pide al tocarla su top 5 SKUs del mes (o del anterior si aún no vende) con la misma consulta que Análisis (`v_sellout_general_cuenta` por sucursal; `topSkus()` probado) y el botón dice «Abrir en Sell Out». Inventario por tienda → Necesita a Fernando
- 2026-10-07 23:12 · v3.90.40 · Presencia en la oficina: `presenciaPersonas()` (probado) marca a cada quien en reunión (en curso, por `asistentes`/`creado_por`), de viaje (tipo 'viaje' vigente hoy, consulta chica aparte) o disponible; de viaje no camina por la base y su silla queda vacía, en reunión espera junto a la sala; la tarjeta de la persona dice «Ahora». Harness `?presencia`
- 2026-10-07 23:08 · v3.90.39 · Interior de la oficina (paso 3, cierra la etapa): sobre cada escritorio un círculo con la inicial (color de su rol) que, al entrar por primera vez, carga la foto (`avatar_url`); si no carga se queda la inicial
- 2026-10-07 23:05 · v3.90.38 · Interior de la oficina (paso 2): botón «Entrar» en la tarjeta de la oficina quita cascarón y sala; escritorio por persona con nombre y pendiente principal (tocable) y mesa de la sala de juntas con las reuniones de hoy (`acomodoEscritorios()` y tarjeta «sala» probados); `entrar('cedis'|'oficina'|false)` en la escena; harness `?oficina`
- 2026-10-07 22:59 · v3.90.37 · Interior de la oficina (paso 1): reuniones de hoy con hora y estado en el modelo (`reunionesDelDia()` probado) y la tarjeta de la oficina muestra la próxima reunión o «en curso»
- 2026-10-07 22:57 · v3.90.36 · Interior del puerto (paso 3, cierra la etapa): cada tarima/contenedor descargando en el CEDIS es tocable y abre la tarjeta de su contenedor (proveedor, arribo, piezas, POs)
- 2026-10-07 22:55 · v3.90.35 · Interior del puerto (paso 2): la tarjeta del contenedor lista sus números de PO (`embarques_compras` sólo de los contenedores dibujados; 3 + «+N»; si falla queda el conteo). `ponerPosEnPuerto()`/`listaCorta()` probados
- 2026-10-07 22:49 · v3.90.34 · Interior del puerto (paso 1): tarjeta propia del barco/contenedor con proveedor, ETA con días (o «N d tarde»), piezas y POs; estado verde/ámbar/rojo
- 2026-10-07 22:46 · v3.90.33 · Nubes como capa 'mapa': sólo se ven de lejos (zoom > 45); en la Vista Base y dentro del CEDIS ya no tapan los edificios
- 2026-10-07 22:44 · v3.90.32 · Interior del CEDIS (paso 3): días de inventario por marca (piezas / demanda de los 3 meses cerrados de `v_sellin_global_sku_anio` × 90, `demanda3Meses()` probado) en la etiqueta y tarjeta del rack con estado verde/ámbar/rojo (90/120 d como el CEDIS); el montacargas sólo se mueve si hubo facturas hoy (`cedis.salidasHoy`, hora local)
- 2026-10-07 22:40 · v3.90.31 · Interior del CEDIS (paso 2): botón «Entrar» en la tarjeta del CEDIS oculta el cascarón (y las nubes), acerca la cámara y muestra un rack por marca (niveles según su inventario, `acomodoRacks()` probado) con etiqueta y tarjeta propia (inventario, piezas, SKUs, % del CEDIS); «← Salir del CEDIS» o alejarse lo cierra. Raycast ahora respeta la visibilidad de los padres
- 2026-10-07 22:34 · v3.90.30 · Interior del CEDIS (paso 1, datos): `racksPorMarca()` en `modelo.js` (valor, piezas y SKUs por marca, top 8 + «OTRAS», probado) con `v_inventario_almacen_medida` [Inv Actual] + marca de `roadmap_sku`; queda en `modelo.cedis.racksMarca` (capa que falla sola)
- 2026-10-07 22:30 · v3.90.29 · Torre de pronóstico en la base: propuestas de forecast, SKUs confirmados/comprados y arribos de 7 días (atrasados en rojo), con tarjeta y foco de estado
- 2026-10-07 22:26 · v3.90.28 · Banco/tesorería en la base: cartera vencida + pagos de la semana/vencidos (mismas reglas de Pagos V3), tarjeta con estado, bandera roja si hay vencidos; entra al encuadre de la Vista Base
- 2026-10-07 22:20 · v3.90.27 · Tarjeta del edificio (paso 2): la escena avisa con `onSeleccion(pos)` dónde está en pantalla lo tocado (`posPantalla()` en `interaccion.js`, cada 3 cuadros y sólo si cambió) y la tarjeta lo sigue al mover la cámara o si es un vehículo; fuera de cuadro se acomoda arriba a la derecha
- 2026-10-07 22:17 · v3.90.26 · Tarjeta del edificio (paso 1): plantilla única `tarjetaDe()` con estado verde/ámbar/rojo y 4 números del modelo; tarjeta flotante junto a lo tocado en lugar del panel lateral
- 2026-10-07 16:00 · v3.90.25 · Última vista por usuario: `Ciudad.jsx` guarda centro y zoom de la cámara en `localStorage` (`acteck.ciudad.vista.<user_id>`, con try/catch) y la escena arranca ahí (`vistaInicial` de `crearEscena`), también al cambiar tema o clima; `leerVista()` probado descarta textos rotos o fuera de México. El nivel (base/ciudad/lejos) se recalcula solo.
- 2026-10-07 15:57 · v3.90.24 · Minimapa (paso 2): plano chico abajo a la izquierda (`planoMini()` probado en `modelo.js`: contorno de México, un punto por ciudad, las 5 más activas resaltadas) con un círculo rojo donde está la cámara (`onVista` de `crearEscena`); tocar junto a una ciudad viaja a su Vista Ciudad, tocar otro punto mueve la cámara ahí (`irA({ tipo: 'punto', x, z })`).
- 2026-10-07 15:32 · v3.90.23 · Minimapa (paso 1): acceso rápido a las 5 ciudades con más actividad (`ciudadesTop()` probado en `modelo.js`) como botones arriba a la izquierda; cada uno viaja a su Vista Ciudad.
- 2026-10-07 15:30 · v3.90.22 · Sólo el nivel visible (paso 2e): barcos y montacargas como instancias dinámicas (proa y ruedas con geometría compartida), siguen tocables y animados. Harness: Base 131 → 128 llamadas, Mapa 178 → 146, sin errores.
- 2026-10-07 15:27 · v3.90.21 · Sólo el nivel visible (paso 2d): ventanas de la oficina, andenes y cortinas del patio, tráileres formados y patas de la grúa van instanciados con su tag (siguen tocables). Harness: Base 160 → 131 llamadas, Mapa 187 → 178, sin errores.
- 2026-10-07 15:21 · v3.90.20 · Sólo el nivel visible (paso 2c): racks, claraboyas y portones del CEDIS van instanciados con el tag del CEDIS (siguen tocables). Harness: Base 176 → 161 llamadas, Mapa ~200 → ~185, sin errores.
- 2026-10-07 15:17 · v3.90.19 · Sólo el nivel visible (paso 2b): los 42 estados de México van en una sola ExtrudeGeometry y todas las carreteras en una sola malla (`plantarCarreteras()`); las tiendas ya estaban instanciadas. Harness: Base 226 → 176 llamadas, Mapa 277 → ~200, sin errores.
- 2026-10-07 13:58 · v3.90.18 · Sólo el nivel visible (paso 2a): los pisos de todos los distritos van en un solo InstancedMesh (caja unitaria escalada, tag por instancia, siguen tocables); una llamada de dibujo por distrito menos.
- 2026-10-07 13:36 · v3.90.17 · Sólo el nivel visible (paso 1): nueva capa `cerca` en `capasVisibles()`; en la Vista Mapa (zoom > `DETALLE.pin`) se ocultan casitas de clientes finales y calles de distrito (menos llamadas de dibujo); pruebas nuevas.
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
- 2026-11-21 03:36 · v4.7.19 · Burbujas del banco/CEDIS y bitácora («grande») leen montos en texto con `numero()`.
- 2026-11-22 01:55 · v4.7.44 · Vendedores del ERP juntados por nombre normalizado (sin coches duplicados ni ventas partidas).
- 2026-11-22 02:16 · v4.7.45 · Clima del panel sin «NaN°» (`temperaturaTexto()`) y tiendas activas por ciudad con miles es-MX.
- 2026-11-22 02:20 · v4.7.46 · Globo de la persona con `pendientesTexto()` (sin «undefined pendientes») y camión de envío «salió 6 oct».
- 2026-11-22 03:16 · v4.7.49 · cartera y clientes finales empatan la cuenta aunque traiga espacios.
- 2026-11-22 05:16 · v4.7.56 · Pulido: `plural()` / `piezasTexto()` sin «-0» y `listaCorta()` con n = 0 sin espacio al inicio.
- 2026-11-22 15:37 · v4.7.61 · Bitácora sin eventos perdidos por folio/id vacío ni «Contenedor null».
- 2026-11-23 00:16 · v4.7.69 · Cuota por ciudad/tienda empata cuentas con espacios o numéricas; celebraciones sin error con listas raras.
- 2026-11-23 01:18 · v4.7.72 · Pulido: `numero()` lee «12%» y `porcentaje()` con lista/objeto da «—».
- 2026-11-23 02:55 · v4.7.77 · `llegaBarco()`/`enMinutos()`/`haceDias()` sólo leen número o texto (lista/objeto/blanco ya no dan «llega hoy», «empieza ya», «hoy»).
- 2026-11-23 03:57 · v4.7.80 · Bitácora y POs del puerto sin error cuando camiones/barcos/tarimas/pagos/agenda no son lista.
- 2026-11-23 04:19 · v4.7.81 · Tarjeta del banco con % vencido del saldo y DSO ponderado, igual que la cartera de Inicio.

- 2026-11-23 04:37 · v4.7.82 · Torre de pronóstico: borradores con espacios, cierres/compras en blanco, «false» y piezas negativas ya no inflan ni restan sus números; +1 prueba.