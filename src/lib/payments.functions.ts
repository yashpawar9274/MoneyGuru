import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaidPlan = "pro" | "lifetime";

export const PLAN_PRICE_INR: Record<PaidPlan, number> = { pro: 100, lifetime: 999 };

function cashfreeBase(env: string) {
  return env === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
}

function creds() {
  const appId = process.env["CASHFREE_APP_ID"];
  const secret = process.env["CASHFREE_SECRET_KEY"];
  const env = (process.env["CASHFREE_ENV"] || "sandbox").trim().toLowerCase();
  if (!appId || !secret) throw new Error("Cashfree is not configured yet. Add your Cashfree keys.");
  return { appId: appId.trim(), secret: secret.trim(), env };
}

function cfHeaders(appId: string, secret: string) {
  return {
    "x-client-id": appId,
    "x-client-secret": secret,
    "x-api-version": "2023-08-01",
    "Content-Type": "application/json",
  };
}

/**
 * Calls the Cashfree PG API. In production we never fall back to sandbox, so a
 * successful checkout always means a real payment was accepted.
 */
async function cfFetch(path: string, init: RequestInit = {}) {
  const { appId, secret, env } = creds();
  const order: string[] = env === "production" ? ["production"] : ["sandbox", "production"];
  let last: { status: number; body: any; env: string } | null = null;
  for (const e of order) {
    const res = await fetch(`${cashfreeBase(e)}${path}`, {
      ...init,
      headers: { ...cfHeaders(appId, secret), ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true as const, body, env: e };
    last = { status: res.status, body, env: e };
    const msg = String(body?.message || "").toLowerCase();
    if (!(res.status === 401 || res.status === 403 || msg.includes("authentication"))) break;
  }
  return { ok: false as const, ...last! };
}


/** Creates a Cashfree order and returns the payment session used by the checkout SDK. */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan: PaidPlan; returnUrl: string; phone?: string }) => {
    if (data.plan !== "pro" && data.plan !== "lifetime") throw new Error("Invalid plan");
    if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid return URL");
    return data;
  })
  .handler(async ({ data, context }) => {
    const amount = PLAN_PRICE_INR[data.plan];
    const orderId = `mfy_${data.plan}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = context.claims?.email as string | undefined;
    const phone = (data.phone || "").replace(/\D/g, "").slice(-10) || "9999999999";

    const res = await cfFetch("/pg/orders", {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: context.userId,
          customer_email: email || "user@money.fyi",
          customer_phone: phone,
        },
        order_meta: {
          return_url: `${data.returnUrl}?order_id={order_id}`,
        },
        order_note: data.plan === "lifetime" ? "MONEY.FYI Lifetime" : "MONEY.FYI Pro monthly",
      }),
    });

    const sessionId = res.ok ? (res.body as { payment_session_id?: string }).payment_session_id : undefined;
    if (!res.ok || !sessionId) {
      const msg = String((res.body as { message?: string })?.message || "");
      console.error("cashfree order failed", res.ok ? 200 : res.status, msg);
      if (/authentication/i.test(msg)) {
        throw new Error(
          "Cashfree rejected the API keys. Check that CASHFREE_APP_ID / CASHFREE_SECRET_KEY match CASHFREE_ENV (sandbox vs production).",
        );
      }
      throw new Error(msg || "Could not start checkout. Please try again.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      order_id: orderId,
      plan: data.plan,
      amount_inr: amount,
      status: "created",
    });
    if (error) throw new Error(error.message);

    return {
      orderId,
      paymentSessionId: sessionId,
      mode: (res.env === "production" ? "production" : "sandbox") as "production" | "sandbox",
    };
  });


/** Verifies an order with Cashfree and activates the plan when it is paid. */
export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => {
    if (!data.orderId || data.orderId.length > 120) throw new Error("Invalid order");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("payments")
      .select("user_id, plan, status")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) return { status: "unknown" as const };
    if (row.status === "paid") return { status: "paid" as const, plan: row.plan as PaidPlan };

    const res = await cfFetch(`/pg/orders/${encodeURIComponent(data.orderId)}`);
    const order = (res.body || {}) as { order_status?: string };
    if (!res.ok) return { status: "pending" as const };


    if (order.order_status === "PAID") {
      const { error } = await supabaseAdmin.rpc("apply_paid_order", { p_order_id: data.orderId });
      if (error) throw new Error(error.message);
      return { status: "paid" as const, plan: row.plan as PaidPlan };
    }
    if (order.order_status === "EXPIRED" || order.order_status === "TERMINATED") {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", data.orderId);
      return { status: "failed" as const };
    }
    return { status: "pending" as const };
  });

/** Tells the UI whether Cashfree keys are present, without exposing them. */
export const paymentsStatus = createServerFn({ method: "GET" }).handler(async () => ({
  ready: Boolean(process.env["CASHFREE_APP_ID"] && process.env["CASHFREE_SECRET_KEY"]),
  mode: (process.env["CASHFREE_ENV"] || "sandbox").trim().toLowerCase(),
}));
