import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const Input = z.object({
  messages: z.array(Msg).min(1).max(24),
  lang: z.enum(["en", "hi", "es", "fr"]).default("en"),
  income30: z.number().default(0),
  expense30: z.number().default(0),
  topCategories: z.array(z.object({ category: z.string(), amount: z.number() })).max(8).default([]),
});

const LANG_LINE: Record<"en" | "hi" | "es" | "fr", string> = {
  en: "Reply in short, friendly spoken English.",
  hi: "Reply in casual spoken Hinglish (Devanagari mixed with English).",
  es: "Responde en español hablado, breve y amistoso.",
  fr: "Réponds en français parlé, court et amical.",
};

/** Low-latency conversational turn for the live voice coach on /ai. */
export const guruTalk = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured yet.");
    const gateway = createLovableAiGatewayProvider(key);

    const cats = data.topCategories
      .map((c) => `- ${c.category}: ₹${c.amount.toFixed(0)}`)
      .join("\n");

    const system = `You are Guru, a live voice money coach for an Indian user of MoneyGuruAI.
${LANG_LINE[data.lang]}
This is a spoken conversation: answer in 1-3 short sentences, no markdown, no bullet points, no emoji.
Give concrete rupee numbers when useful. Ask one short follow-up question when you need more info.

USER SNAPSHOT (last 30 days):
Income ₹${data.income30.toFixed(0)}, expense ₹${data.expense30.toFixed(0)}, balance ₹${(data.income30 - data.expense30).toFixed(0)}
Top spend categories:
${cats || "(no data yet)"}

Never invent transactions that are not listed.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return { reply: text.replace(/[*_`#]/g, "").trim() };
  });
