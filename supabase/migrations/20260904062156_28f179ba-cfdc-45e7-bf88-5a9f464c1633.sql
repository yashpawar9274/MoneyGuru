CREATE TABLE public.debt_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  note text,
  proof_path text,
  given_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_entries TO authenticated;
GRANT ALL ON public.debt_entries TO service_role;

ALTER TABLE public.debt_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own debt entries" ON public.debt_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX debt_entries_debt_id_idx ON public.debt_entries(debt_id);

ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS proof_path text;