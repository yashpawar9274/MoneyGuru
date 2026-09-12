/**
 * Plan catalogue shared by the web app and the PayU checkout flow.
 * PayU is the only payment provider — see `src/lib/payu.functions.ts`.
 */
export type PaidPlan = "weekly" | "pro" | "lifetime";

export const PLAN_PRICE_INR: Record<PaidPlan, number> = { weekly: 7, pro: 100, lifetime: 999 };

export const PLAN_LABEL: Record<PaidPlan, string> = {
  weekly: "MoneyGuruAI Starter — 7 days",
  pro: "MoneyGuruAI Pro — 30 days",
  lifetime: "MoneyGuruAI Lifetime",
};
