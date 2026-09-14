export type PremiumSubscription = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

/** Shared UI/server eligibility. Missing dates and canceled plans fail closed. */
export function hasActivePremium(
  subscription: PremiumSubscription | null | undefined,
  now = Date.now(),
): boolean {
  if (!subscription || subscription.status !== "active") return false;
  if (subscription.plan === "lifetime") return true;
  if (subscription.plan !== "weekly" && subscription.plan !== "pro") return false;
  const end = subscription.current_period_end ? Date.parse(subscription.current_period_end) : NaN;
  return Number.isFinite(end) && end > now;
}
