import { createFileRoute } from "@tanstack/react-router";
import { getAiAdvice } from "@/lib/ai.functions";

// Public REST endpoint for the mobile (Expo) app.
export const Route = createFileRoute("/api/public/ai-advice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const result = await getAiAdvice({ data: body });
          return Response.json(result, {
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "error", { status: 500 });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});
