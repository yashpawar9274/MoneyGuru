import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  name: z.string().default(""),
  lang: z.enum(["en", "hi", "es", "fr"]).default("hi"),
  kind: z.enum(["expired", "warning"]).default("expired"),
  minutesLeft: z.number().default(0),
});

const LANG_LINE: Record<string, string> = {
  hi: "Bol Hinglish me (Roman script, Hindi + English mix), respectful lekin friendly tone.",
  en: "Speak in polite, friendly English.",
  es: "Habla en español cortés y amable.",
  fr: "Parle en français poli et amical.",
};

export const getTrialVoiceLine = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const who = data.name ? data.name : "Sir ya Madam";
    const base =
      data.kind === "expired"
        ? `User ka 24 ghante ka free trial khatam ho gaya hai. Politely bata aur ₹100 ka 1 month subscription lene ko keh.`
        : `User ke free trial me sirf ${Math.max(1, Math.round(data.minutesLeft))} minute bache hain. Politely remind kar aur ₹100 ka 1 month subscription suggest kar.`;

    const prompt = `Tu MONEY.FYI ka polite voice assistant hai.
${LANG_LINE[data.lang] ?? LANG_LINE.hi}
User ko "${who}" keh ke address kar.
${base}
Max 2 chhote sentence. Koi emoji, quotes ya markdown nahi. Sirf wahi lines return kar.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    const line = text.replace(/```[a-z]*|```/gi, "").replace(/^["']|["']$/g, "").trim();
    return {
      line:
        line ||
        `${who}, aapka free trial khatam ho gaya hai. Aage use karne ke liye ₹100 ka 1 month subscription le lijiye.`,
    };
  });
