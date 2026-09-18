CREATE TABLE public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  last_four text NOT NULL CHECK (last_four ~ '^[0-9]{4}$'),
  credit_limit numeric(14,2) NOT NULL CHECK (credit_limit > 0),
  statement_day integer CHECK (statement_day BETWEEN 1 AND 28),
  due_day integer CHECK (due_day BETWEEN 1 AND 28),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credit cards" ON public.credit_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own credit cards" ON public.credit_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credit cards" ON public.credit_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own credit cards" ON public.credit_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.credit_card_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('purchase', 'repayment')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 160),
  entry_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_entries TO authenticated;
GRANT ALL ON public.credit_card_entries TO service_role;
ALTER TABLE public.credit_card_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own card entries" ON public.credit_card_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own card entries" ON public.credit_card_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = card_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can update own card entries" ON public.credit_card_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = card_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can delete own card entries" ON public.credit_card_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER set_credit_cards_updated_at BEFORE UPDATE ON public.credit_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_credit_card_entries_updated_at BEFORE UPDATE ON public.credit_card_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));