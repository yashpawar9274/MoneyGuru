import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number(),
  category: z.string(),
  note: z.string().default(""),
  todaySpend: z.number().default(0),
  todayIncome: z.number().default(0),
  balance: z.number().default(0),
  lang: z.enum(["en", "hi", "es", "fr"]).default("hi"),
});

const LANG_LINE: Record<string, string> = {
  hi: "Bol Hinglish me (Roman script, Hindi + English mix), Gen-Z casual tone.",
  en: "Speak in casual Gen-Z English.",
  es: "Habla en español casual (tono Gen-Z).",
  fr: "Parle en français décontracté (ton Gen-Z).",
};

export const getTxVoiceLine = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `Tu MONEY.FYI ka voice money coach hai.
${LANG_LINE[data.lang] ?? LANG_LINE.hi}
Ek hi chhota sentence bol (max 16 words), jaise dost bol raha ho. Koi emoji, koi quotes, koi markdown nahi.

Abhi ka event: ${data.type === "expense" ? "kharcha hua" : "paisa aaya"} ₹${Math.round(data.amount)} — ${data.category}${data.note ? ` (${data.note})` : ""}.
Aaj total kharcha ₹${Math.round(data.todaySpend)}, aaj income ₹${Math.round(data.todayIncome)}, balance ₹${Math.round(data.balance)}.

Agar kharcha zyada ya faltu lag raha hai to halke se warn kar, warna hype kar. Sirf wahi ek line return kar.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    const line = text.replace(/["`*_#]/g, "").trim().split("\n")[0].slice(0, 200);
    return { line: line || (data.type === "expense" ? "Kharcha note kar liya bhai." : "Paisa aaya, nice!") };
  });
