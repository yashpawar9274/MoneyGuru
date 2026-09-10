/**
 * Plan catalogue shared by the web app and the PayU checkout flow.
 * PayU is the only payment provider — see `src/lib/payu.functions.ts`.
 */
export type PaidPlan = "pro" | "lifetime";

export const PLAN_PRICE_INR: Record<PaidPlan, number> = { pro: 100, lifetime: 999 };

export const PLAN_LABEL: Record<PaidPlan, string> = {
  pro: "MoneyGuruAI Pro — 30 days",
  lifetime: "MoneyGuruAI Lifetime",
};
