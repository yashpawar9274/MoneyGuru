import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
<<<<<<< HEAD
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey },
  });
}

export function getGuruModelId() {
  return process.env["GURU_AI_MODEL"]?.trim() || "google/gemini-3.8-flash";
}
=======
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}
>>>>>>> 19a84892e6f43cd67650f8aa890fa56bd5a38256
