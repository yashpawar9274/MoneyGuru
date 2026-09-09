ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS receipt_created_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS debts_receipt_number_unique
  ON public.debts (receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_debt_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  day_stamp text := to_char(current_date, 'YYYYMMDD');
  next_number integer;
BEGIN
  IF NEW.receipt_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('moneyfyi-receipt-' || day_stamp));
    SELECT coalesce(max((right(receipt_number, 4))::integer), 0) + 1
      INTO next_number
      FROM public.debts
      WHERE receipt_number LIKE 'MFYI-UDHARI-' || day_stamp || '-%';
    NEW.receipt_number := format('MFYI-UDHARI-%s-%s', day_stamp, lpad(next_number::text, 4, '0'));
    NEW.receipt_created_at := coalesce(NEW.receipt_created_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS debts_assign_receipt_number ON public.debts;
CREATE TRIGGER debts_assign_receipt_number
  BEFORE INSERT OR UPDATE OF receipt_number ON public.debts
  FOR EACH ROW
  WHEN (NEW.receipt_number IS NULL)
  EXECUTE FUNCTION public.assign_debt_receipt_number();

UPDATE public.debts
SET receipt_number = NULL
WHERE receipt_number IS NULL;