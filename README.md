# MONEY.FYI 💸

A modern, Gen-Z money tracking web app with AI savings coach, bill scanning, voice insights, and multi-language support. Built with **TanStack Start**, **React 19**, **Tailwind v4**, and the **Lovable AI Gateway**.

> Live preview: deployed via [Lovable](https://lovable.dev).

---

## ✨ Features

- 📅 **Daily / Weekly / Monthly income & expense tracking** with a day-by-day timeline
- 📊 **Analytics** — bar charts (weekly/monthly) + category donut chart (Recharts)
- 🤖 **AI Savings Coach** — Gen-Z tone, powered by Gemini via the Lovable AI Gateway
- 🔊 **Voice playback** — premium ElevenLabs TTS with selectable voices, fallback to native Web Speech
- 📸 **Bill scanning (OCR)** — snap a receipt, Gemini Vision auto-categorizes & extracts the amount
- 🌐 **Multi-language UI** — English, हिन्दी, Español, Français
- 🎨 **Cyber Neon Gen-Z design** — dark mode, lime + electric purple, Space Grotesk
- 💾 **Local-first persistence** via `localStorage` (no signup needed)
- 📱 **Mobile-first PWA-ready** with animated splash screen and no pinch-zoom

---

## 🧱 Tech Stack

| Layer        | Tech |
|--------------|------|
| Framework    | TanStack Start v1 + Vite 7 |
| UI           | React 19, Tailwind CSS v4, framer-motion |
| Charts       | Recharts |
| AI           | Lovable AI Gateway (Gemini text + vision) |
| Voice (TTS)  | ElevenLabs API (premium) + Web Speech (fallback) |
| State        | React Context + localStorage |
| Icons        | lucide-react |

---

## 🚀 Getting Started

```bash
# install
bun install

# dev server
bun run dev

# production build
bun run build
```

Open <http://localhost:5173>.

---

## 🔑 Environment Variables

Both keys are managed automatically inside Lovable. For local dev outside Lovable, set them in `.env`:

| Variable              | Required | Purpose |
|-----------------------|----------|---------|
| `LOVABLE_API_KEY`     | ✅ | AI advisor + bill scanning |
| `ELEVENLABS_API_KEY`  | optional | Premium AI coach voice |

Without `ELEVENLABS_API_KEY`, the app falls back to the device's built-in voice.

---

## 📁 Project Structure

```
src/
├── components/        # SplashScreen, BottomNav, AIAdvisorCard, ScanBillButton, AddTransactionSheet
├── lib/
│   ├── store.tsx      # transactions context + selectors
│   ├── i18n.tsx       # multi-language dictionary
│   ├── voices.ts      # ElevenLabs voice presets
│   ├── ai.functions.ts # AI advisor server function
│   └── ai-gateway.server.ts
├── routes/
│   ├── index.tsx      # home — daily timeline & balances
│   ├── analytics.tsx  # weekly/monthly + category charts
│   ├── ai.tsx         # AI coach screen
│   ├── settings.tsx   # language, voice picker, API key status
│   └── api/
│       ├── tts.ts         # ElevenLabs TTS proxy
│       └── scan-bill.ts   # OCR + Gemini Vision
└── styles.css         # Tailwind v4 + design tokens
```

---

## 📱 Native App?

This repo is a **web app** (Cyber Neon mobile-first PWA). It is **not** a React Native project. If you want a real iOS/Android binary:

- **Easiest:** wrap with [Capacitor](https://capacitorjs.com/) — keeps this codebase.
- **From scratch:** port screens to React Native + Expo (separate project).

---

## 📝 License

MIT — do whatever, just don't blame us if you overspend on coffee.
