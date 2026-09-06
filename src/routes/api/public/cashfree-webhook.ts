import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/** Cashfree payment webhook — verifies the provider signature, then activates the plan. */
export const Route = createFileRoute("/api/public/cashfree-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CASHFREE_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const ts = request.headers.get("x-webhook-timestamp") ?? "";
        const sig = request.headers.get("x-webhook-signature") ?? "";
        const expected = createHmac("sha256", secret).update(ts + raw).digest("base64");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          type?: string;
          data?: { order?: { order_id?: string }; payment?: { payment_status?: string } };
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const orderId = payload.data?.order?.order_id;
        const status = payload.data?.payment?.payment_status;
        if (!orderId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (status === "SUCCESS") {
          const { error } = await supabaseAdmin.rpc("apply_paid_order", { p_order_id: orderId });
          if (error) console.error("apply_paid_order failed", error.message);
        } else if (status === "FAILED" || status === "USER_DROPPED") {
          await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", orderId);
        }
        return new Response("ok");
      },
    },
  },
});
