import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
// Isolated UI fixtures. This config is never loaded by the production build.
export default defineConfig({
  root: here("."),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      ...[
        "@tanstack/react-start",
        "@tanstack/react-router",
        "@/lib/auth",
        "@/lib/i18n",
        "@/lib/guru-chat.functions",
        "@/lib/guru-speech.functions",
        "@/lib/guru-audio",
      ].map((find) => ({ find, replacement: here("./fixtures.tsx") })),
      { find: "@", replacement: here("../../src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
});
