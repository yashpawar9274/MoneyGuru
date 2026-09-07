import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/gemini-live-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = getRequestAuthorization();
        if (!authorization) return Response.json({ error: "Sign in required" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(authorization);
        if (authError || !authData.user) return Response.json({ error: "Invalid session" }, { status: 401 });
        const { data: subscription } = await supabaseAdmin.from("subscriptions").select("plan,status,current_period_end").eq("user_id", authData.user.id).maybeSingle();
        const activePro = subscription?.status === "active" && (subscription.plan === "lifetime" || (subscription.plan === "pro" && (!subscription.current_period_end || +new Date(subscription.current_period_end) > Date.now())));
        if (!activePro) return Response.json({ error: "Gemini Live is a Pro feature" }, { status: 403 });
        const body = await request.json().catch(() => ({})) as { apiKey?: string };
        const apiKey = body.apiKey?.trim() || process.env["GEMINI_API_KEY"];
        if (!apiKey) return Response.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
        const expires = new Date(Date.now() + 10 * 60_000).toISOString();
        const response = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            uses: 1,
            expireTime: expires,
            newSessionExpireTime: expires,
            liveConnectConstraints: {
              model: "models/gemini-2.0-flash-live-001",
              config: {
                responseModalities: ["AUDIO"],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: "You are MoneyFYI Live, a concise Hindi-English money assistant. Help users understand spending. Never claim an action happened unless the app confirms it. For adding income or expense, ask for amount and category clearly.",
              },
            },
          }),
        });
        if (!response.ok) return new Response(await response.text(), { status: response.status });
        return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});

function getRequestAuthorization() {
  const value = getRequest()?.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}