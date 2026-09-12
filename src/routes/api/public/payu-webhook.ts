import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const sha512 = (v: string) => createHash("sha512").update(v).digest("hex");

/**
 * PayU server-to-server callback. PayU signs every response with the merchant
 * salt, so we recompute the reverse hash before touching the database.
 */
export const Route = createFileRoute("/api/public/payu-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["PAYU_MERCHANT_KEY"]?.trim();
        const salt = process.env["PAYU_MERCHANT_SALT"]?.trim();
        if (!key || !salt) return new Response("Not configured", { status: 503 });

        const form = await request.formData();
        const f = (name: string) => String(form.get(name) ?? "");
        const txnid = f("txnid");
        const status = f("status").toLowerCase();
        const additionalCharges = f("additionalCharges") || f("additional_charges");
        const udf = [1, 2, 3, 4, 5].map((i) => f(`udf${i}`));
        let reverse = [
          salt,
          f("status"),
          "",
          "",
          "",
          "",
          "",
          ...udf.slice().reverse(),
          f("email"),
          f("firstname"),
          f("productinfo"),
          f("amount"),
          txnid,
          key,
        ].join("|");
        if (additionalCharges) reverse = `${additionalCharges}|${reverse}`;
        const valid = sha512(reverse) === f("hash").toLowerCase();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("webhook_logs").insert({
          provider: "payu",
          event_type: status || null,
          order_id: txnid || null,
          status: status || null,
          signature_valid: valid,
          http_status: valid ? 200 : 401,
          message: valid ? "verified" : "Invalid hash",
        });
        if (!valid) return new Response("Invalid signature", { status: 401 });
        if (!txnid) return new Response("Missing transaction", { status: 400 });

        if (status === "success") {
          const { data: row } = await supabaseAdmin
            .from("payments")
            .select("amount_inr,provider")
            .eq("order_id", txnid)
            .maybeSingle();
          const amountMatches = row && Math.abs(Number(f("amount")) - Number(row.amount_inr)) < 0.001;
          if (row?.provider === "payu" && amountMatches) {
            const { error } = await supabaseAdmin.rpc("apply_paid_order", { p_order_id: txnid });
            if (error) {
              console.error("apply_paid_order failed", error.message);
              await supabaseAdmin.from("webhook_logs").insert({
                provider: "payu", event_type: "fulfilment", order_id: txnid,
                status: "error", signature_valid: true, http_status: 500,
                message: `Fulfilment failed: ${error.message}`.slice(0, 500),
              });
              return new Response("Fulfilment failed", { status: 500 });
            }
            await supabaseAdmin.from("webhook_logs").insert({
              provider: "payu", event_type: "fulfilment", order_id: txnid,
              status: "paid", signature_valid: true, http_status: 200,
              message: "Subscription activated",
            });
          } else {
            await supabaseAdmin.from("webhook_logs").insert({
              provider: "payu", event_type: "fulfilment", order_id: txnid,
              status: "rejected", signature_valid: true, http_status: 422,
              message: !row ? "Order not found" : row.provider !== "payu" ? "Wrong payment provider" : "Amount mismatch",
            });
            return new Response("Order validation failed", { status: 422 });
          }
        } else if (status === "failure" || status === "failed") {
          await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", txnid);
        }
        return new Response("ok");
      },
    },
  },
});
