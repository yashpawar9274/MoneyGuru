import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";
import { hasActivePremium } from "./premium";
import { buildGuruFinance } from "./guru-finance";
import type { GuruErrorCode, GuruResult } from "./guru-contract";

export type GuruSession = { supabase: SupabaseClient<Database>; userId: string };
type QuotaRow = { allowed: boolean; reason: string; retry_after: number; remaining_today: number };
type GuruDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      consume_guru_quota: { Args: { p_kind: string }; Returns: QuotaRow[] };
    };
  };
};

export class GuruError extends Error {
  constructor(
    public code: GuruErrorCode,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export function guruFailure(error: unknown): GuruResult<never> {
  if (error instanceof GuruError)
    return { ok: false, code: error.code, message: error.message, retryAfter: error.retryAfter };
  // Do not log provider request bodies, bearer tokens or personal financial context.
  const status =
    error && typeof error === "object" && "statusCode" in error ? error.statusCode : null;
  if (status === 402)
    return {
      ok: false,
      code: "CREDITS_EXHAUSTED",
      message: "Guru's AI credits are exhausted. Ask the app owner to top up.",
    };
  if (status === 429)
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "AI is busy. Please try again in a minute.",
      retryAfter: 60,
    };
  if (status === 401 || status === 403)
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Guru's provider credentials need attention. Contact the app owner.",
    };
  return {
    ok: false,
    code: "UNAVAILABLE",
    message: "Guru could not respond. Please try again shortly.",
  };
}

export async function requireGuruPremium({ supabase, userId }: GuruSession) {
  if (!userId) throw new GuruError("PREMIUM_REQUIRED", "Sign in to use Guru.");
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new GuruError("UNAVAILABLE", "Could not verify your subscription. Please retry.");
  if (!hasActivePremium(data))
    throw new GuruError(
      "PREMIUM_REQUIRED",
      "Guru Voice AI requires an active Weekly, Pro or Lifetime plan.",
    );
  return { expiresAt: data!.plan === "lifetime" ? null : data!.current_period_end };
}

export async function consumeGuruQuota(session: GuruSession, kind: "chat" | "speech") {
  const db = session.supabase as unknown as SupabaseClient<GuruDatabase>;
  const { data, error } = await db.rpc("consume_guru_quota", { p_kind: kind });
  if (error || !data?.[0])
    throw new GuruError(
      "UNAVAILABLE",
      "Guru quota is unavailable. Ask the owner to apply the Guru migration.",
    );
  const row = data[0];
  if (!row.allowed) {
    if (row.reason === "premium_required")
      throw new GuruError("PREMIUM_REQUIRED", "Your premium plan is no longer active.");
    throw new GuruError(
      "RATE_LIMITED",
      row.reason === "daily_limit"
        ? "Daily Guru limit reached. It resets at 00:00 UTC (05:30 IST)."
        : "Please pause a moment before your next question.",
      row.retry_after,
    );
  }
  return row.remaining_today;
}

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;
/** Supabase default row limits must never silently turn a partial ledger into a total. */
export async function loadGuruPages<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; from <= 20000; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error || !result.data)
      throw new GuruError(
        "CONTEXT_UNAVAILABLE",
        "Could not load your financial records. No figures have been guessed.",
      );
    rows.push(...result.data);
    if (rows.length > 20000)
      throw new GuruError(
        "CONTEXT_UNAVAILABLE",
        "This ledger is too large for Guru's current context limit. Your records are unchanged.",
      );
    if (result.data.length < size) return rows;
  }
  throw new GuruError("CONTEXT_UNAVAILABLE", "Your complete ledger could not be loaded.");
}

export async function loadGuruContext({ supabase: db, userId }: GuruSession) {
  const now = new Date();
  const [profile, settings, transactions, debts, entries, payments] = await Promise.all([
    db.from("profiles").select("full_name,language,currency").eq("id", userId).maybeSingle(),
    db
      .from("user_settings")
      .select("monthly_income,monthly_budget,savings_target,fixed_expenses,currency")
      .eq("user_id", userId)
      .maybeSingle(),
    loadGuruPages((a, b) =>
      db
        .from("transactions")
        .select("id,type,amount,category,note,date")
        .eq("user_id", userId)
        .lte("date", now.toISOString())
        .order("id")
        .range(a, b),
    ),
    loadGuruPages((a, b) =>
      db
        .from("debts")
        .select("id,kind,title,principal,monthly,due_date,interest_rate,created_at")
        .eq("user_id", userId)
        .order("id")
        .range(a, b),
    ),
    loadGuruPages((a, b) =>
      db
        .from("debt_entries")
        .select("id,debt_id,amount,given_at,note")
        .eq("user_id", userId)
        .order("id")
        .range(a, b),
    ),
    loadGuruPages((a, b) =>
      db
        .from("debt_payments")
        .select("id,debt_id,amount,paid_at,note")
        .eq("user_id", userId)
        .order("id")
        .range(a, b),
    ),
  ]);
  if (profile.error || settings.error)
    throw new GuruError("CONTEXT_UNAVAILABLE", "Profile or money settings could not be loaded.");
  return {
    language: profile.data?.language,
    finance: buildGuruFinance(
      { profile: profile.data, settings: settings.data, transactions, debts, entries, payments },
      now,
    ),
  };
}
