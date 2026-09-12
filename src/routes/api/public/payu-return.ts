import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const sha512 = (value: string) => createHash("sha512").update(value).digest("hex");

function redirectToPricing(request: Request, txnid: string, result?: string) {
  const requestOrigin = new URL(request.url).origin;
  const targetOrigin = process.env["PAYU_ENV"]?.trim().toLowerCase() === "production"
    ? "https://moneyguruai.dev"
    : requestOrigin;
  const target = new URL("/pricing", targetOrigin);
  if (txnid) target.searchParams.set("payu_txnid", txnid);
  if (result) target.searchParams.set("payu_result", result);
  return Response.redirect(target.toString(), 303);
}

async function handlePayUReturn(request: Request) {
  // GET is only a browser fallback. A successful PayU Hosted Checkout normally
  // POSTs the signed payment response to surl/furl.
  if (request.method === "GET") {
    const url = new URL(request.url);
    return redirectToPricing(request, url.searchParams.get("txnid") || "");
  }

  const key = process.env["PAYU_MERCHANT_KEY"]?.trim();
  const salt = process.env["PAYU_MERCHANT_SALT"]?.trim();
  if (!key || !salt) return redirectToPricing(request, "", "config_error");

  const form = await request.formData();
  const f = (name: string) => String(form.get(name) ?? "");
  const txnid = f("txnid");
  if (!txnid) return redirectToPricing(request, "", "missing_txnid");

  const status = f("status").toLowerCase();
  const additionalCharges = f("additionalCharges") || f("additional_charges");

  // PayU generic reverse hash:
  // SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  const reverseParts = [
    salt,
    f("status"),
    "", "", "", "", "",
    f("udf5"), f("udf4"), f("udf3"), f("udf2"), f("udf1"),
    f("email"), f("firstname"), f("productinfo"), f("amount"), txnid, key,
  ];
  let reverse = reverseParts.join("|");
  if (additionalCharges) reverse = `${additionalCharges}|${reverse}`;
  const validHash = sha512(reverse) === f("hash").toLowerCase();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!validHash) {
    await supabaseAdmin.from("webhook_logs").insert({
      provider: "payu", event_type: "browser_return", order_id: txnid,
      status, signature_valid: false, http_status: 401, message: "Invalid PayU return hash",
    });
    return redirectToPricing(request, txnid, "invalid_hash");
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("order_id,amount_inr,provider,status")
    .eq("order_id", txnid)
    .maybeSingle();

  if (paymentError || !payment || payment.provider !== "payu") {
    await supabaseAdmin.from("webhook_logs").insert({
      provider: "payu", event_type: "browser_return", order_id: txnid,
      status, signature_valid: true, http_status: 404, message: "PayU order not found",
    });
    return redirectToPricing(request, txnid, "order_not_found");
  }

  const amountMatches = Math.abs(Number(f("amount")) - Number(payment.amount_inr)) < 0.001;
  if (status === "success" && amountMatches) {
    const { error } = await supabaseAdmin.rpc("apply_paid_order", { p_order_id: txnid });
    if (error) {
      console.error("PayU fulfilment failed:", error.message);
      await supabaseAdmin.from("webhook_logs").insert({
        provider: "payu", event_type: "browser_return", order_id: txnid,
        status, signature_valid: true, http_status: 500, message: `Fulfilment failed: ${error.message}`.slice(0, 500),
      });
      return redirectToPricing(request, txnid, "fulfilment_error");
    }
    await supabaseAdmin.from("webhook_logs").insert({
      provider: "payu", event_type: "browser_return", order_id: txnid,
      status: "paid", signature_valid: true, http_status: 200, message: "Subscription activated",
    });
    return redirectToPricing(request, txnid, "paid");
  }

  if (status === "failure" || status === "failed") {
    await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", txnid);
    await supabaseAdmin.from("webhook_logs").insert({
      provider: "payu", event_type: "browser_return", order_id: txnid,
      status: "failed", signature_valid: true, http_status: 200, message: "Payment failed",
    });
    return redirectToPricing(request, txnid, "failed");
  }

  await supabaseAdmin.from("webhook_logs").insert({
    provider: "payu", event_type: "browser_return", order_id: txnid,
    status, signature_valid: true, http_status: 202,
    message: amountMatches ? "Payment pending" : "Payment amount mismatch",
  });
  return redirectToPricing(request, txnid, amountMatches ? "pending" : "amount_mismatch");
}

export const Route = createFileRoute("/api/public/payu-return")({
  server: {
    handlers: {
      GET: ({ request }) => handlePayUReturn(request),
      POST: ({ request }) => handlePayUReturn(request),
    },
  },
});
