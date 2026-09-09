import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import type { SafeToSpendSettings } from "./money";

export interface MoneySettings extends SafeToSpendSettings {
  currency: string;
}

const EMPTY: MoneySettings = {
  monthlyIncome: null,
  monthlyBudget: null,
  savingsTarget: null,
  fixedExpenses: null,
  currency: "INR",
};

/** Reads the user's own money plan (income, savings target, fixed bills, budget). */
export function useMoneySettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<MoneySettings>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setSettings(EMPTY);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_settings")
      .select("monthly_income,monthly_budget,savings_target,fixed_expenses,currency")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setSettings({
        monthlyIncome: data.monthly_income,
        monthlyBudget: data.monthly_budget,
        savingsTarget: data.savings_target,
        fixedExpenses: data.fixed_expenses,
        currency: data.currency ?? "INR",
      });
    } else {
      setSettings(EMPTY);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<MoneySettings>) => {
      if (!user) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          monthly_income: next.monthlyIncome ?? null,
          monthly_budget: next.monthlyBudget ?? null,
          savings_target: next.savingsTarget ?? null,
          fixed_expenses: next.fixedExpenses ?? null,
          currency: next.currency,
        } as never,
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    [settings, user],
  );

  return { settings, loading, save, reload: load };
}
