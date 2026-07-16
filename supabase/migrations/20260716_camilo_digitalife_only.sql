-- Migration: restringir a Camilo únicamente al cliente Digitalife.
-- Reemplaza el JSON de permisos completo para que no tenga acceso a nada más.
--
-- Ejecutar DESPUÉS de 20260716_rls_cliente_scope.sql
-- Ajusta el email si es diferente.

UPDATE public.perfiles
SET
  tipo = 'externo',
  permisos = '{
    "clientes": {
      "digitalife": {
        "home":       "ver",
        "analisis":   "ver",
        "sellIn":     "oculto",
        "estrategia": "ver",
        "marketing":  "ver",
        "pagos":      "oculto",
        "cartera":    "oculto"
      }
    },
    "globales": {}
  }'::jsonb
WHERE lower(email) LIKE 'camilo%'
   OR lower(nombre) LIKE 'camilo%';

-- Verificar
SELECT user_id, email, nombre, tipo, es_super_admin, permisos
FROM public.perfiles
WHERE lower(email) LIKE 'camilo%' OR lower(nombre) LIKE 'camilo%';
