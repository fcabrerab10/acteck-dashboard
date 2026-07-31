# RLS Policies — Última línea de defensa

## Qué es RLS y por qué importa

Row Level Security (RLS) es la capa de seguridad de Postgres/Supabase que se
aplica **directamente en la base**, no en la app. Con RLS activo, ni siquiera
un usuario que evita el frontend (o que hace peticiones directas al REST de
Supabase con su `access_token`) puede leer o escribir datos que no le
corresponden.

El frontend ya oculta pestañas y botones con `permisos.js`, pero eso solo
protege la **UI**. Si un atacante (o un colaborador curioso con las devtools
abiertas) hace `supabase.from('pagos').select('*')` desde la consola,
solamente RLS lo detiene. Por eso este documento existe.

## Modelo

Cada tabla queda protegida por dos policies:

- **SELECT** — el usuario puede leer si tiene nivel `ver` o `edit` en la
  pestaña que controla esa tabla (para el `cliente` de la fila, si aplica).
- **INSERT / UPDATE / DELETE** — solo si tiene nivel `edit`.

Fernando (super admin) siempre pasa via `es_super_admin = true`.

## Mapeo tabla → pestaña

| Tabla | Pestaña que la controla | Alcance |
|-------|-------------------------|---------|
| `sellout_sku`, `sellout_detalle`, `sellout_general` | `estrategia` (Sell Out) | por cliente |
| `sellout_pcel` | `estrategia` (cliente = pcel) | fijo pcel |
| `ventas_erp`, `facturacion_clientes` | `sellIn` + `analisis` | por cliente |
| `cuotas_mensuales`, `metas_anuales` | `sellIn` | por cliente |
| `pagos`, `fondos_mkt_movimientos`, `fondo_pcel_movimientos`, `lineamientos_cliente`, `inversion_marketing` | `pagos` | por cliente |
| `marketing_actividades` | `marketing` | por cliente |
| `estados_cuenta`, `estados_cuenta_detalle` | `cartera` | por cliente |
| `inventario_cliente` | `estrategia` + `home` | por cliente |
| `inventario_acteck`, `embarques_compras`, `transito_sku` | global `inventario_global` | global |
| `oc_clientes` | global `ordenes_compra` | global |
| `roadmap_sku`, `precios_sku` | global `estrategia_precios` | global |
| `perfiles` | solo super admin escribe; cada user lee su propio row | especial |

## Migraciones previas (columnas nuevas en `perfiles`)

Antes de aplicar las policies, corré esto una sola vez para agregar las
columnas de estado que usa el flujo de invitación:

```sql
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS estado text
  CHECK (estado IN ('pendiente','activo','suspendido')) DEFAULT 'activo';
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id);
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS invited_at timestamptz;

-- Marcar como pendientes a los usuarios sin es_super_admin y sin login (si aplicara)
-- (opcional, tu llamada). Los existentes quedan en 'activo' por default.
```

## Helper — función `puede_ver_cliente(cliente_id, pestana_id)`

Para no repetir la lógica en cada policy, definimos un helper SQL:

```sql
CREATE OR REPLACE FUNCTION puede_ver_cliente_pestana(cli text, pest text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.user_id = auth.uid()
      AND p.activo = true
      AND (
        p.es_super_admin = true
        OR (p.permisos->'clientes'->cli->>pest) IN ('ver','edit')
      )
  );
$$;

CREATE OR REPLACE FUNCTION puede_editar_cliente_pestana(cli text, pest text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.user_id = auth.uid()
      AND p.activo = true
      AND (
        p.es_super_admin = true
        OR (p.permisos->'clientes'->cli->>pest) = 'edit'
      )
  );
$$;

CREATE OR REPLACE FUNCTION puede_ver_global(pest text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.user_id = auth.uid()
      AND p.activo = true
      AND (
        p.es_super_admin = true
        OR (p.permisos->'globales'->>pest) IN ('ver','edit')
      )
  );
$$;

CREATE OR REPLACE FUNCTION puede_editar_global(pest text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.user_id = auth.uid()
      AND p.activo = true
      AND (
        p.es_super_admin = true
        OR (p.permisos->'globales'->>pest) = 'edit'
      )
  );
$$;
```

**Nota crítica**: las tablas deben tener una columna `cliente text` para
que la policy sepa a qué cliente pertenece la fila. Las que ya la tienen:
`sellout_sku`, `sellout_detalle`, `pagos`, `facturacion_clientes`,
`estados_cuenta`, `marketing_actividades`, etc. Verificá con
`\d nombre_tabla` en el SQL editor.

## Policies — copiar y pegar (por bloque)

### 1) Sell Out — controlado por pestaña `estrategia`

```sql
ALTER TABLE sellout_sku ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sellout_sku_read  ON sellout_sku;
DROP POLICY IF EXISTS sellout_sku_write ON sellout_sku;
CREATE POLICY sellout_sku_read  ON sellout_sku FOR SELECT
  USING (puede_ver_cliente_pestana(cliente, 'estrategia'));
CREATE POLICY sellout_sku_write ON sellout_sku FOR ALL
  USING (puede_editar_cliente_pestana(cliente, 'estrategia'))
  WITH CHECK (puede_editar_cliente_pestana(cliente, 'estrategia'));

ALTER TABLE sellout_detalle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sellout_detalle_read  ON sellout_detalle;
DROP POLICY IF EXISTS sellout_detalle_write ON sellout_detalle;
CREATE POLICY sellout_detalle_read  ON sellout_detalle FOR SELECT
  USING (puede_ver_cliente_pestana(COALESCE(cliente,'digitalife'), 'estrategia'));
CREATE POLICY sellout_detalle_write ON sellout_detalle FOR ALL
  USING (puede_editar_cliente_pestana(COALESCE(cliente,'digitalife'), 'estrategia'));

-- sellout_pcel: cliente fijo
ALTER TABLE sellout_pcel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sellout_pcel_read  ON sellout_pcel;
DROP POLICY IF EXISTS sellout_pcel_write ON sellout_pcel;
CREATE POLICY sellout_pcel_read  ON sellout_pcel FOR SELECT
  USING (puede_ver_cliente_pestana('pcel', 'estrategia'));
CREATE POLICY sellout_pcel_write ON sellout_pcel FOR ALL
  USING (puede_editar_cliente_pestana('pcel', 'estrategia'));
```

### 2) Sell In / Análisis

```sql
ALTER TABLE ventas_erp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ventas_erp_read  ON ventas_erp;
DROP POLICY IF EXISTS ventas_erp_write ON ventas_erp;
CREATE POLICY ventas_erp_read  ON ventas_erp FOR SELECT
  USING (puede_ver_cliente_pestana(cliente, 'sellIn')
         OR puede_ver_cliente_pestana(cliente, 'analisis'));
CREATE POLICY ventas_erp_write ON ventas_erp FOR ALL
  USING (puede_editar_cliente_pestana(cliente, 'sellIn'));

ALTER TABLE facturacion_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fc_read  ON facturacion_clientes;
DROP POLICY IF EXISTS fc_write ON facturacion_clientes;
CREATE POLICY fc_read  ON facturacion_clientes FOR SELECT
  USING (puede_ver_cliente_pestana(cliente, 'sellIn')
         OR puede_ver_cliente_pestana(cliente, 'analisis'));
CREATE POLICY fc_write ON facturacion_clientes FOR ALL
  USING (puede_editar_cliente_pestana(cliente, 'sellIn'));

ALTER TABLE cuotas_mensuales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cm_read  ON cuotas_mensuales;
DROP POLICY IF EXISTS cm_write ON cuotas_mensuales;
CREATE POLICY cm_read  ON cuotas_mensuales FOR SELECT
  USING (puede_ver_cliente_pestana(cliente, 'sellIn'));
CREATE POLICY cm_write ON cuotas_mensuales FOR ALL
  USING (puede_editar_cliente_pestana(cliente, 'sellIn'));
```

### 3) Pagos + fondos + lineamientos + marketing $$

```sql
DO $$ BEGIN
  FOREACH tbl IN ARRAY ARRAY['pagos','fondos_mkt_movimientos','fondo_pcel_movimientos','lineamientos_cliente','inversion_marketing']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
    EXECUTE format($f$
      CREATE POLICY %I_read ON %I FOR SELECT
        USING (puede_ver_cliente_pestana(cliente, 'pagos'));
      CREATE POLICY %I_write ON %I FOR ALL
        USING (puede_editar_cliente_pestana(cliente, 'pagos'));
    $f$, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
```

### 4) Marketing actividades

```sql
ALTER TABLE marketing_actividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mkt_read  ON marketing_actividades;
DROP POLICY IF EXISTS mkt_write ON marketing_actividades;
CREATE POLICY mkt_read  ON marketing_actividades FOR SELECT
  USING (puede_ver_cliente_pestana(cliente, 'marketing'));
CREATE POLICY mkt_write ON marketing_actividades FOR ALL
  USING (puede_editar_cliente_pestana(cliente, 'marketing'));
```

### 5) Cartera / Estados de cuenta

```sql
ALTER TABLE estados_cuenta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ec_read  ON estados_cuenta;
DROP POLICY IF EXISTS ec_write ON estados_cuenta;
CREATE POLICY ec_read  ON estados_cuenta FOR SELECT
  USING (puede_ver_cliente_pestana(cliente, 'cartera'));
CREATE POLICY ec_write ON estados_cuenta FOR ALL
  USING (puede_editar_cliente_pestana(cliente, 'cartera'));

ALTER TABLE estados_cuenta_detalle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ecd_read  ON estados_cuenta_detalle;
DROP POLICY IF EXISTS ecd_write ON estados_cuenta_detalle;
-- detalle: hereda via join a estados_cuenta.id
CREATE POLICY ecd_read ON estados_cuenta_detalle FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM estados_cuenta e
    WHERE e.id = estados_cuenta_detalle.estado_cuenta_id
      AND puede_ver_cliente_pestana(e.cliente, 'cartera')
  ));
CREATE POLICY ecd_write ON estados_cuenta_detalle FOR ALL
  USING (EXISTS (
    SELECT 1 FROM estados_cuenta e
    WHERE e.id = estados_cuenta_detalle.estado_cuenta_id
      AND puede_editar_cliente_pestana(e.cliente, 'cartera')
  ));
```

### 6) Inventario cliente / Acteck / embarques

```sql
ALTER TABLE inventario_cliente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ic_read  ON inventario_cliente;
DROP POLICY IF EXISTS ic_write ON inventario_cliente;
CREATE POLICY ic_read  ON inventario_cliente FOR SELECT
  USING (puede_ver_cliente_pestana(cliente, 'estrategia')
         OR puede_ver_cliente_pestana(cliente, 'home'));
CREATE POLICY ic_write ON inventario_cliente FOR ALL
  USING (puede_editar_cliente_pestana(cliente, 'estrategia'));

-- Inventario Acteck y afines son globales
DO $$ BEGIN
  FOREACH tbl IN ARRAY ARRAY['inventario_acteck','embarques_compras','transito_sku']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
    EXECUTE format($f$
      CREATE POLICY %I_read ON %I FOR SELECT
        USING (puede_ver_global('inventario_global'));
      CREATE POLICY %I_write ON %I FOR ALL
        USING (puede_editar_global('inventario_global'));
    $f$, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
```

### 7) Órdenes de compra (Tracking Pedidos)

```sql
ALTER TABLE oc_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oc_read  ON oc_clientes;
DROP POLICY IF EXISTS oc_write ON oc_clientes;
CREATE POLICY oc_read  ON oc_clientes FOR SELECT
  USING (puede_ver_global('ordenes_compra'));
CREATE POLICY oc_write ON oc_clientes FOR ALL
  USING (puede_editar_global('ordenes_compra'));
```

### 8) Roadmap y precios

```sql
DO $$ BEGIN
  FOREACH tbl IN ARRAY ARRAY['roadmap_sku','precios_sku']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
    EXECUTE format($f$
      CREATE POLICY %I_read ON %I FOR SELECT
        USING (puede_ver_global('estrategia_precios'));
      CREATE POLICY %I_write ON %I FOR ALL
        USING (puede_editar_global('estrategia_precios'));
    $f$, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
```

### 9) `perfiles` — el más delicado

```sql
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS perfiles_self_read  ON perfiles;
DROP POLICY IF EXISTS perfiles_super_read ON perfiles;
DROP POLICY IF EXISTS perfiles_super_write ON perfiles;

-- Cada user lee su propio perfil
CREATE POLICY perfiles_self_read ON perfiles FOR SELECT
  USING (user_id = auth.uid());

-- Super admin lee todo
CREATE POLICY perfiles_super_read ON perfiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));

-- Solo super admin escribe (los endpoints /api/admin/* usan service_role
-- que bypassa RLS, así que la UI real no queda afectada)
CREATE POLICY perfiles_super_write ON perfiles FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.user_id = auth.uid() AND p.es_super_admin = true));
```

## Cómo activar RLS en tu proyecto Supabase

1. Ir a Supabase Dashboard → **SQL Editor** → New Query.
2. **Primero**: correr las migraciones de la sección "Migraciones previas".
3. **Segundo**: correr los helpers de la sección "Helper" (crea las 4 funciones).
4. **Tercero**: correr las policies bloque por bloque (secciones 1 a 9).
   Si alguna tabla no existe en tu esquema, salteá ese bloque.
5. **Verificar** con una cuenta que **no** sea super admin: abrir el
   dashboard con Karolina, tratar de acceder por URL directa a una pestaña
   que no tiene, y confirmar que la query devuelve 0 filas (no error, 0
   filas → RLS funcionando). También abrir devtools y probar
   `await supabase.from('pagos').select('*')` — debería devolver `[]`.
6. Si algo revienta, podés revertir con `ALTER TABLE tabla DISABLE ROW LEVEL SECURITY`
   temporalmente y ajustar.

## Riesgo conocido

Los endpoints `/api/admin/*` usan `SUPABASE_SERVICE_ROLE_KEY` que **bypassa
RLS**. Eso es intencional para poder crear usuarios y suspender. La única
línea de defensa ahí es la verificación explícita de `es_super_admin` que
hace cada endpoint. Auditar esos endpoints (`create-user.js`,
`update-user.js`, `resend-invitation.js`, `toggle-suspend.js`) antes de
agregar nuevos.
