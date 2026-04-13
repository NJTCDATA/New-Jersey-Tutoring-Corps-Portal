-- ============================================================
-- Step 1: Inspect — find the exact signatures of all
-- is_teacher_of_class overloads so we know what to drop
-- ============================================================
SELECT
  pg_proc.oid,
  pg_proc.proname,
  pg_get_function_identity_arguments(pg_proc.oid) AS args,
  pg_proc.proconfig
FROM pg_proc
JOIN pg_namespace ns ON ns.oid = pg_proc.pronamespace
WHERE ns.nspname = 'public'
  AND pg_proc.proname = 'is_teacher_of_class';


-- ============================================================
-- Step 2: Drop every overload by OID — no signature guessing
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pg_proc.oid
    FROM pg_proc
    JOIN pg_namespace ns ON ns.oid = pg_proc.pronamespace
    WHERE ns.nspname = 'public'
      AND pg_proc.proname = 'is_teacher_of_class'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.oid::regprocedure);
  END LOOP;
END;
$$;


-- ============================================================
-- Step 3: Recreate the single secured version
-- ============================================================
CREATE FUNCTION public.is_teacher_of_class(p_class_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classroom_sections cs
    WHERE cs.section_id = p_class_id
      AND cs.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_sections us
    WHERE us.section_id = p_class_id
      AND us.user_id = auth.uid()
  );
$$;


-- ============================================================
-- Verification — must return exactly 1 row with search_path=public
-- ============================================================
SELECT
  pg_proc.proname,
  pg_get_function_identity_arguments(pg_proc.oid) AS args,
  pg_proc.proconfig
FROM pg_proc
JOIN pg_namespace ns ON ns.oid = pg_proc.pronamespace
WHERE ns.nspname = 'public'
  AND pg_proc.proname = 'is_teacher_of_class';
