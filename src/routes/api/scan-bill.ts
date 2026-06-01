import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText, Output } from "ai";
import { z } from "zod";

const Schema = z.object({
  merchant: z.string(),
  total: z.number(),
  category: z.enum([
    "food", "transport", "shopping", "entertainment", "bills", "health", "education", "other",
  ]),
  date: z.string().optional(),
});

export const Route = createFileRoute("/api/scan-bill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { imageBase64 } = (await request.json()) as { imageBase64?: string };
          if (!imageBase64) return new Response("Missing imageBase64", { status: 400 });

          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const gateway = createLovableAiGatewayProvider(key);
          const dataUrl = imageBase64.startsWith("data:")
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`;

          const { output } = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            output: Output.object({
              schema: Schema,
            }),
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract the merchant name, total amount (just the number, no currency), and best-fit category from this bill/receipt. If unsure, use 'other'.",
                  },
                  { type: "image", image: dataUrl },
                ],
              },
            ],
          });

          return Response.json(output);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Scan failed";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
