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
        const udf = [1, 2, 3, 4, 5].map((i) => f(`udf${i}`));
        const reverse = [
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
        if (!txnid) return new Response("ok");

        if (status === "success") {
          const { data: row } = await supabaseAdmin
            .from("payments")
            .select("amount_inr")
            .eq("order_id", txnid)
            .maybeSingle();
          if (row && Number(f("amount")) === Number(row.amount_inr)) {
            const { error } = await supabaseAdmin.rpc("apply_paid_order", { p_order_id: txnid });
            if (error) console.error("apply_paid_order failed", error.message);
          }
        } else if (status === "failure" || status === "failed") {
          await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", txnid);
        }
        return new Response("ok");
      },
    },
  },
});
