# MONEY.FYI 💸

A Gen-Z money tracker with AI savings coach, bill scanning, and voice insights — shipped as **two apps that share one backend**:

| App | Stack | Folder |
|-----|-------|--------|
| 🌐 Web / PWA | TanStack Start v1 + React 19 + Tailwind v4 | `/` (repo root) |
| 📱 Mobile (iOS + Android) | Expo SDK 51 + React Native 0.74 | `/mobile` |

> Live: **<https://mmoneyguru.lovable.app>**

---

## ✨ Features

- 📅 Daily / weekly / monthly income & expense tracking
- 📊 Analytics — bar charts + by-category breakdown
- 🤖 AI Savings Coach (Gemini via Lovable AI Gateway)
- 🔊 Voice playback — ElevenLabs (premium) + native TTS fallback
- 📸 Bill scanning — Gemini Vision auto-extracts amount + category
- 🌐 Multi-language UI — English, हिन्दी, Español, Français
- 🎨 Cyber Neon design — dark mode, lime + electric purple
- 💾 Local-first storage (localStorage on web, AsyncStorage on mobile)
- 📱 **PWA installable** on web · **real native binary** on mobile

---

## 🌐 Web App + PWA

### Run locally
```bash
bun install
bun run dev          # http://localhost:5173
bun run build        # production build
```

### Install as PWA
Open the live site (or your deployed URL) on a mobile browser → **Add to Home Screen**. The app launches in standalone mode (no browser chrome) with the MONEY.FYI icon.

Manifest: [`public/manifest.webmanifest`](public/manifest.webmanifest) · Icon: [`public/icon-512.png`](public/icon-512.png).

> No service worker is registered — this keeps the Lovable preview iframe stable. The app is installable and offline-ready via browser HTTP cache; for full offline support add a service worker after publishing.

### Environment variables

| Variable              | Required | Purpose |
|-----------------------|----------|---------|
| `LOVABLE_API_KEY`     | ✅ | AI advisor + bill scanning |
| `ELEVENLABS_API_KEY`  | optional | Premium AI coach voice |

Both are managed automatically inside Lovable. For local dev, put them in `.env`.

---

## 📱 Mobile App (Expo React Native)

The `/mobile` folder is an **independent Expo project**. It talks to the same backend endpoints (`/api/scan-bill`, `/api/tts`, `/api/ai-advice`) hosted on the deployed web app.

### Run on your phone (Expo Go)
```bash
cd mobile
npm install
npx expo start                # scan QR code with Expo Go app
```

### Platform-specific
```bash
npx expo start --android      # Android emulator / device
npx expo start --ios          # iOS simulator (macOS)
```

### Production build (EAS)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android          # APK / AAB for Play Store
eas build -p ios              # IPA for App Store
```

### Point at a different backend
Edit `mobile/app.json` → `expo.extra.apiBaseUrl`.

Full mobile docs: [`mobile/README.md`](mobile/README.md).

---

## 🧱 Repo Structure

```
/
├── src/                   # web app (TanStack Start)
│   ├── routes/            # file-based routing
│   ├── components/        # SplashScreen, BottomNav, AddTransactionSheet…
│   └── lib/               # store, i18n, ai functions
├── public/
│   ├── manifest.webmanifest   # PWA manifest
│   └── icon-512.png
├── mobile/                # Expo React Native app
│   ├── App.tsx
│   ├── app.json
│   └── src/{lib,screens}
└── README.md
```

---

## 📝 License

MIT.
