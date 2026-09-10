-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  currency text NOT NULL DEFAULT 'INR',
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','lifetime')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled')),
  price_inr integer NOT NULL DEFAULT 0,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription read" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  amount numeric NOT NULL CHECK (amount >= 0),
  category text NOT NULL DEFAULT 'other',
  note text,
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_date_idx ON public.transactions (user_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- DEBTS
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('udhari_given','udhari_taken','emi')),
  title text NOT NULL,
  principal numeric NOT NULL CHECK (principal >= 0),
  monthly numeric,
  due_date date,
  plan_amount numeric,
  plan_freq text CHECK (plan_freq IN ('daily','weekly','monthly')),
  interest_rate numeric NOT NULL DEFAULT 0,
  reason text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX debts_user_idx ON public.debts (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debts" ON public.debts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- DEBT PAYMENTS
CREATE TABLE public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.debts (id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  paid_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX debt_payments_debt_idx ON public.debt_payments (debt_id, paid_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_payments TO authenticated;
GRANT ALL ON public.debt_payments TO service_role;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debt payments" ON public.debt_payments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- BUDGETS
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  category text NOT NULL,
  limit_amount numeric NOT NULL CHECK (limit_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- GOALS
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  saved_amount numeric NOT NULL DEFAULT 0,
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RECURRING
CREATE TABLE public.recurring_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  amount numeric NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'other',
  note text,
  freq text NOT NULL CHECK (freq IN ('daily','weekly','monthly')),
  next_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_items TO authenticated;
GRANT ALL ON public.recurring_items TO service_role;
ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring" ON public.recurring_items FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- BOOTSTRAP HELPER (profile + plan on first sign-in, lifetime for founder email)
CREATE OR REPLACE FUNCTION public.bootstrap_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.profiles (id, email)
  VALUES (uid, mail)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  INSERT INTO public.subscriptions (user_id, plan, price_inr)
  VALUES (uid, 'free', 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF mail = 'theyashpawar92@gmail.com' THEN
    UPDATE public.subscriptions
      SET plan = 'lifetime', status = 'active', price_inr = 0,
          current_period_end = NULL, updated_at = now()
    WHERE user_id = uid;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_account() TO authenticated;

-- START PRO SUBSCRIPTION (Rs 100 / month)
CREATE OR REPLACE FUNCTION public.activate_pro()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.subscriptions (user_id, plan, status, price_inr, current_period_end)
  VALUES (uid, 'pro', 'active', 100, now() + interval '30 days')
  ON CONFLICT (user_id) DO UPDATE
    SET plan = CASE WHEN public.subscriptions.plan = 'lifetime' THEN 'lifetime' ELSE 'pro' END,
        status = 'active',
        price_inr = CASE WHEN public.subscriptions.plan = 'lifetime' THEN 0 ELSE 100 END,
        current_period_end = CASE WHEN public.subscriptions.plan = 'lifetime' THEN NULL ELSE now() + interval '30 days' END,
        updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_pro() TO authenticated;