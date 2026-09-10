import { createFileRoute } from "@tanstack/react-router";

async function redirectFromPayU(request: Request) {
  let txnid = "";
  if (request.method === "POST") {
    const form = await request.formData();
    txnid = String(form.get("txnid") || "");
  } else {
    txnid = new URL(request.url).searchParams.get("txnid") || "";
  }
  if (txnid) {
    try {
      const { verifyAndApplyPayUOrder } = await import("@/lib/payu.server");
      await verifyAndApplyPayUOrder(txnid);
    } catch (error) {
      console.error("PayU return fulfilment failed", error);
    }
  }
  const origin = new URL(request.url).origin;
  const target = new URL("/pricing", origin);
  if (txnid) target.searchParams.set("payu_txnid", txnid);
  return Response.redirect(target.toString(), 303);
}

export const Route = createFileRoute("/api/public/payu-return")({
  server: { handlers: { GET: ({ request }) => redirectFromPayU(request), POST: ({ request }) => redirectFromPayU(request) } },
});
