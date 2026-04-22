-- pagos_audit — bitácora de cambios sobre la tabla pagos
-- Registra quién cambió qué campo y cuándo. Útil para rastrear por qué un
-- pago cambió de estatus o monto, y quién fue.

CREATE TABLE IF NOT EXISTS public.pagos_audit (
  id           BIGSERIAL PRIMARY KEY,
  pago_id      UUID REFERENCES public.pagos(id) ON DELETE CASCADE,
  user_id      UUID,
  user_email   TEXT,
  user_name    TEXT,
  accion       TEXT NOT NULL CHECK (accion IN ('insert', 'update', 'delete')),
  field_name   TEXT,          -- solo para update
  old_value    TEXT,
  new_value    TEXT,
  snapshot     JSONB,          -- snapshot completo del row en insert / delete
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_audit_pago ON public.pagos_audit(pago_id, changed_at DESC);

ALTER TABLE public.pagos_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pagos_audit_select ON public.pagos_audit;
CREATE POLICY pagos_audit_select ON public.pagos_audit
  FOR SELECT TO authenticated USING (true);

-- Solo service role / trigger puede insertar (el trigger corre como SECURITY DEFINER)
DROP POLICY IF EXISTS pagos_audit_no_write ON public.pagos_audit;
CREATE POLICY pagos_audit_no_write ON public.pagos_audit
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Trigger: se dispara en INSERT / UPDATE / DELETE sobre pagos.
-- Para UPDATE: genera una fila por cada campo que cambió (mejor UX que un blob).
CREATE OR REPLACE FUNCTION public.tg_pagos_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  uemail TEXT;
  uname TEXT;
  perfil_row public.perfiles%ROWTYPE;
  campos TEXT[] := ARRAY[
    'concepto','categoria','monto','estatus','fecha_compromiso','fecha_pago_real',
    'responsable','folio','notas','promocion_id','mes_sellout','anio_sellout','mes_fijo','anio_fijo'
  ];
  campo TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NOT NULL THEN
    SELECT * INTO perfil_row FROM public.perfiles WHERE user_id = uid LIMIT 1;
    uname  := perfil_row.nombre;
    uemail := perfil_row.email;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pagos_audit(pago_id, user_id, user_email, user_name, accion, snapshot)
    VALUES (NEW.id, uid, uemail, uname, 'insert', to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.pagos_audit(pago_id, user_id, user_email, user_name, accion, snapshot)
    VALUES (OLD.id, uid, uemail, uname, 'delete', to_jsonb(OLD));
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    FOREACH campo IN ARRAY campos LOOP
      v_old := (to_jsonb(OLD) ->> campo);
      v_new := (to_jsonb(NEW) ->> campo);
      IF v_old IS DISTINCT FROM v_new THEN
        INSERT INTO public.pagos_audit(pago_id, user_id, user_email, user_name, accion, field_name, old_value, new_value)
        VALUES (NEW.id, uid, uemail, uname, 'update', campo, v_old, v_new);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagos_audit ON public.pagos;
CREATE TRIGGER trg_pagos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.tg_pagos_audit();
