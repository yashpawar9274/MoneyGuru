import { createHash } from "crypto";
import { PLAN_PRICE_INR, type PaidPlan } from "@/lib/payments.functions";

function payuCreds() {
  const key = process.env["PAYU_MERCHANT_KEY"]?.trim();
  const salt = process.env["PAYU_MERCHANT_SALT"]?.trim();
  const env = (process.env["PAYU_ENV"] || "test").trim().toLowerCase();
  if (!key || !salt) throw new Error("PayU is not configured yet. Add PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT.");
  return { key, salt, env };
}

const sha512 = (value: string) => createHash("sha512").update(value).digest("hex");

export async function verifyAndApplyPayUOrder(txnid: string) {
  const { key, salt, env } = payuCreds();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("payments")
    .select("plan,status,amount_inr,provider")
    .eq("order_id", txnid)
    .maybeSingle();
  if (!row || row.provider !== "payu") return { status: "unknown" as const };
  if (row.status === "paid") return { status: "paid" as const, plan: row.plan as PaidPlan };

  const command = "verify_payment";
  const body = new URLSearchParams({ key, command, var1: txnid, hash: sha512(`${key}|${command}|${txnid}|${salt}`) });
  const url = env === "production" ? "https://info.payu.in/merchant/postservice.php?form=2" : "https://test.payu.in/merchant/postservice.php?form=2";
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const payload = await res.json().catch(() => ({}));
  const tx = payload?.transaction_details?.[txnid];
  if (!res.ok || !tx) return { status: "pending" as const };

  const paid = String(tx.status || "").toLowerCase() === "success";
  const amountMatches = Number(tx.amt ?? tx.amount) === Number(row.amount_inr);
  if (paid && amountMatches) {
    const { error } = await supabaseAdmin.rpc("apply_paid_order", { p_order_id: txnid });
    if (error) throw new Error(error.message);
    return { status: "paid" as const, plan: row.plan as PaidPlan };
  }
  if (["failure", "failed"].includes(String(tx.status || "").toLowerCase())) {
    await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", txnid);
    return { status: "failed" as const };
  }
  return { status: "pending" as const };
}
