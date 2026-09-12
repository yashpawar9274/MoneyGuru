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

function productionOrigin(returnUrl: string, env: string) {
  if (env !== "production") return returnUrl.replace(/\/$/, "");
  return "https://moneyguruai.dev";
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
    const callback = `${productionOrigin(data.returnUrl, env)}/api/public/payu-return`;
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
    const { key, salt, env } = payuCreds();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("payments").select("user_id,plan,status,amount_inr,provider").eq("order_id", data.txnid).maybeSingle();
    if (!row || row.user_id !== context.userId || row.provider !== "payu") return { status: "unknown" as const };
    if (row.status === "paid") return { status: "paid" as const, plan: row.plan as PaidPlan };

    const command = "verify_payment";
    const body = new URLSearchParams({ key, command, var1: data.txnid, hash: sha512(`${key}|${command}|${data.txnid}|${salt}`) });
    const url = env === "production" ? "https://info.payu.in/merchant/postservice.php?form=2" : "https://test.payu.in/merchant/postservice.php?form=2";
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const payload = await res.json().catch(() => ({}));
    const transactionDetails = payload && typeof payload === "object" && "transaction_details" in payload
      ? (payload.transaction_details as Record<string, Record<string, unknown>> | undefined)
      : undefined;
    const tx = transactionDetails?.[data.txnid];
    if (!res.ok || !tx) return { status: "pending" as const };

    const paid = ["success", "captured"].includes(String(tx.status || tx.unmappedstatus || "").toLowerCase());
    const amountMatches = Math.abs(Number(tx.amt ?? tx.amount) - Number(row.amount_inr)) < 0.001;
    if (paid && amountMatches) {
      const { error } = await supabaseAdmin.rpc("apply_paid_order", { p_order_id: data.txnid });
      if (error) throw new Error(error.message);
      return { status: "paid" as const, plan: row.plan as PaidPlan };
    }
    if (["failure", "failed"].includes(String(tx.status || "").toLowerCase())) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", data.txnid);
      return { status: "failed" as const };
    }
    return { status: "pending" as const };
  });
