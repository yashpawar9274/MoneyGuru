import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const TxSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number(),
  category: z.string(),
  note: z.string(),
  date: z.string(),
});

const AdviceInput = z.object({
  transactions: z.array(TxSchema).max(200),
  lang: z.enum(["en", "hi", "es", "fr"]).default("en"),
});

const langName: Record<string, string> = {
  en: "English",
  hi: "Hindi (in Devanagari, casual Gen-Z tone, can mix some English words)",
  es: "Spanish",
  fr: "French",
};

export const getAiAdvice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdviceInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const summary = summarize(data.transactions);
    const prompt = `You are a sharp Gen-Z money coach. Be punchy, friendly, max 2 sentences.
Respond in ${langName[data.lang]}.
Identify the top wasteful spending category and give one concrete savings tip.
If income is healthy and overspending is low, hype the user up.

USER SPENDING SUMMARY (last 30 days):
${summary}

Return ONLY a single JSON object (no markdown fences, no prose) with EXACTLY these keys:
{
  "message": string,      // the short spoken message (max 2 sentences), plain text, no leading emoji
  "alertLevel": "good" | "watch" | "danger",
  "tipCategory": string   // the category the tip is about
}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    const parsed = ResultSchema.safeParse(extractJson(text));
    if (parsed.success) return parsed.data;

    const fallback = text.replace(/```[a-z]*|```/gi, "").trim();
    if (!fallback) throw new Error("AI returned an empty response. Try again.");
    return { message: fallback.slice(0, 400), alertLevel: "good" as const, tipCategory: "general" };
  });

const ResultSchema = z.object({
  message: z.string(),
  alertLevel: z.enum(["good", "watch", "danger"]).catch("good"),
  tipCategory: z.string().catch("general"),
});

function extractJson(text: string): unknown {
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[{[]/);
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  cleaned = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(
        cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, ""),
      );
    } catch {
      return null;
    }
  }
}

function summarize(txs: z.infer<typeof TxSchema>[]) {
  const byCat: Record<string, number> = {};
  let income = 0, expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else {
      expense += t.amount;
      byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
    }
  }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, v]) => `  - ${c}: ₹${v.toFixed(0)}`).join("\n");
  return `Total income: ₹${income.toFixed(0)}
Total expense: ₹${expense.toFixed(0)}
Balance: ₹${(income - expense).toFixed(0)}
Top expense categories:
${top || "  (none)"}`;
}
