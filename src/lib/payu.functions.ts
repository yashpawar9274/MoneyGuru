import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_PRICE_INR, type PaidPlan } from "@/lib/payments.functions";

function payuCreds() {
  const key = process.env["PAYU_MERCHANT_KEY"]?.trim();
  const salt = process.env["PAYU_MERCHANT_SALT"]?.trim();
  const env = (process.env["PAYU_ENV"] || "test").trim().toLowerCase();
  if (!key || !salt) throw new Error("PayU is not configured yet. Add PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT.");
  return { key, salt, env, action: env === "production" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment" };
}

const sha512 = (value: string) => createHash("sha512").update(value).digest("hex");

export const payuStatus = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["PAYU_MERCHANT_KEY"]?.trim();
  const salt = process.env["PAYU_MERCHANT_SALT"]?.trim();
  const mode = (process.env["PAYU_ENV"] || "test").trim().toLowerCase();
  return { ready: Boolean(key && salt), mode, error: key && salt ? "" : "PayU keys missing" };
});

export const createPayUCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan: PaidPlan; returnUrl: string; phone?: string; firstName?: string }) => {
    if (data.plan !== "pro" && data.plan !== "lifetime") throw new Error("Invalid plan");
    if (!/^https:\/\//.test(data.returnUrl) && !/^http:\/\/localhost/.test(data.returnUrl)) throw new Error("Invalid return URL");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { key, salt, env, action } = payuCreds();
    const amount = PLAN_PRICE_INR[data.plan].toFixed(2);
    const txnid = `mfy_${data.plan}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const email = String(context.claims?.email || "").trim();
    if (!email) throw new Error("Your account email is required for PayU checkout.");
    const firstname = (data.firstName || String(context.claims?.user_metadata?.full_name || "MoneyGuru User")).trim().slice(0, 60);
    const phone = (data.phone || "").replace(/\D/g, "").slice(-10) || "9999999999";
    const productinfo = data.plan === "lifetime" ? "MoneyGuruAI Lifetime" : "MoneyGuruAI Pro 30 Days";
    const callback = `${data.returnUrl.replace(/\/$/, "")}/api/public/payu-return`;
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = sha512(hashString);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId, order_id: txnid, plan: data.plan, amount_inr: PLAN_PRICE_INR[data.plan], status: "created", provider: "payu",
    });
    if (error) throw new Error(error.message);

    return {
      action,
      mode: env === "production" ? "production" : "test",
      fields: { key, txnid, amount, productinfo, firstname, email, phone, surl: callback, furl: callback, hash },
    };
  });

export const confirmPayUCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { txnid: string }) => {
    if (!data.txnid || data.txnid.length > 120) throw new Error("Invalid transaction");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("payments").select("user_id,plan,status,amount_inr,provider").eq("order_id", data.txnid).maybeSingle();
    if (!row || row.user_id !== context.userId || row.provider !== "payu") return { status: "unknown" as const };
    const { verifyAndApplyPayUOrder } = await import("@/lib/payu.server");
    return verifyAndApplyPayUOrder(data.txnid);
  });
