/**
 * Where Cashfree checkout is allowed to run.
 *
 * Cashfree only launches checkout from domains whitelisted in the merchant
 * dashboard (Developers → Whitelisting). Configure the live domain with
 * `VITE_CASHFREE_CHECKOUT_ORIGIN` (no secrets here — only a public origin).
 * Cashfree API keys stay server-side in CASHFREE_APP_ID / CASHFREE_SECRET_KEY
 * / CASHFREE_ENV and are never exposed to the browser.
 */
export const CHECKOUT_ORIGIN = (
  (import.meta.env["VITE_CASHFREE_CHECKOUT_ORIGIN"] as string | undefined) || "https://moneyguruai.dev"
).replace(/\/+$/, "");

/** Extra origins that may run checkout (apex + www + local dev in test mode). */
function allowedHosts(): string[] {
  const host = CHECKOUT_ORIGIN.replace(/^https?:\/\//, "");
  const bare = host.replace(/^www\./, "");
  return [bare, `www.${bare}`];
}

/**
 * True when the current origin is whitelisted for Cashfree checkout.
 * In sandbox/test mode localhost is also allowed so the flow is testable.
 */
export function isCheckoutOrigin(mode: string): boolean {
  const h = window.location.hostname;
  if (mode !== "production" && (h === "localhost" || h === "127.0.0.1")) return true;
  return allowedHosts().includes(h);
}
