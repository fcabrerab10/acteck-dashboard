-- Fix: borrar pagos fallaba por trigger AFTER DELETE de auditoría
-- Fecha: 2026-04-27
--
-- Problema: cuando se intentaba borrar un pago, el trigger AFTER DELETE de
-- auditoría intentaba INSERTAR un row en pagos_audit con pago_id = OLD.id.
-- Pero la FK pagos_audit.pago_id → pagos.id (con ON DELETE CASCADE) rechazaba
-- ese INSERT porque el pago ya no existía en ese momento.
--
-- Solución:
-- 1) Cambiar la FK a ON DELETE SET NULL — así audits viejos quedan huérfanos
--    pero conservan el snapshot (el dato real está ahí).
-- 2) Mover el trigger de DELETE de AFTER a BEFORE — el trigger se dispara
--    antes de que el row se borre, así el INSERT del audit puede referenciar
--    al pago aún existente.

-- 1) FK con SET NULL
ALTER TABLE public.pagos_audit DROP CONSTRAINT IF EXISTS pagos_audit_pago_id_fkey;
ALTER TABLE public.pagos_audit
  ADD CONSTRAINT pagos_audit_pago_id_fkey
  FOREIGN KEY (pago_id) REFERENCES public.pagos(id) ON DELETE SET NULL;

-- 2) Separar triggers: AFTER para INSERT/UPDATE (cuando NEW está disponible)
--    y BEFORE para DELETE (cuando OLD aún tiene FK válida).
DROP TRIGGER IF EXISTS trg_pagos_audit ON public.pagos;
DROP TRIGGER IF EXISTS trg_pagos_audit_before_delete ON public.pagos;

CREATE TRIGGER trg_pagos_audit
  AFTER INSERT OR UPDATE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.tg_pagos_audit();

CREATE TRIGGER trg_pagos_audit_before_delete
  BEFORE DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.tg_pagos_audit();
