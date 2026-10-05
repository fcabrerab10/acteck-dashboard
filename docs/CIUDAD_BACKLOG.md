# Acteck Ciudad · pendientes del agente nocturno

Lista viva para la tarea programada `acteck-ciudad-nocturno` (Mac mini, cada hora de 22:00 a 08:00).
Cada corrida toma el **primer pendiente sin marcar** que quepa en una corrida, lo termina, lo publica
y lo mueve a «Hecho» con fecha, versión y una línea de qué cambió. Si un pendiente es muy grande, se
parte en pasos aquí mismo y se hace sólo el primero. Fernando puede reordenar o agregar renglones
cuando quiera (desde la laptop: sólo este archivo).

Recordatorio del objetivo: réplica viva del negocio en estilo isométrico low-poly cálido. Nada escala
por tamaño de cliente; lo que se ve es actividad. Ver la nota «Acteck Ciudad» de `CLAUDE.md`.

## Pendientes (en orden)

- [ ] **Dinero · cuota vs ritmo**: cada distrito/ciudad muestra si sus cuentas van arriba o abajo de la cuota del mes (`v_medidas_cuota_cliente_mes` o la vista que ya use el dashboard): banderín/halo verde-ámbar-rojo en la manzana y el dato en el panel al hacer clic. Sin escalar por tamaño.
- [ ] **Vendedores con rutas reales**: los vendedores del ERP caminan/manejan entre las sedes de sus 3 clientes reales (ya vienen en el modelo) en vez de moverse al azar; su etiqueta muestra a quién visitan.
- [ ] **Camiones por guía real**: si `guias_erp` trae destino, los camiones salen del CEDIS por guía real (origen → ciudad destino) en lugar de facturas de 10 días; mantener facturas como respaldo si la guía no trae ciudad.
- [ ] **Cuentas sin sucursal**: distribuir por estado (`CIUDAD_POR_ESTADO`) a las cuentas que hoy no tienen sucursales para que no queden vacías.
- [ ] **Barra de tiempo**: control para ver la ciudad «ayer / hace 7 días / inicio de mes» (los datos ya son por fecha/mes).
- [ ] **Visor iPad/celular**: versión de sólo lectura que cargue rápido (menos gente/objetos, sin sombras) cuando `matchMedia('(pointer: coarse)')`.
- [ ] **Pulido continuo** (sólo cuando no quede nada arriba): rendimiento (FPS estable con la escena grande), legibilidad de etiquetas, animaciones de gente y vehículos, transiciones día/noche, pruebas nuevas en `scripts/test-ciudad-modelo.mjs`.

## Necesita a Fernando (el agente no lo hace)

- Nombres del personal de almacén/ventas que no está en el dashboard.
- Cualquier vista o tabla nueva en Supabase (el agente no corre migraciones).
- `~/acteck/ciudad/.env.local` con `SUPABASE_ACCESS_TOKEN` para probar con datos reales en el harness.

## Hecho

<!-- El agente agrega aquí: - AAAA-MM-DD HH:MM · vX.Y.Z · qué cambió (una línea) -->
