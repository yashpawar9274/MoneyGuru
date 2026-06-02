# MONEY.FYI — Mobile (Expo React Native)

Real native iOS + Android build of MONEY.FYI. Shares the **same backend** as the web app (`/api/scan-bill`, `/api/tts`, `/api/ai-advice`) hosted on `https://mmoneyguru.lovable.app`.

## Stack
- Expo SDK 51 + React Native 0.74
- TanStack Query · AsyncStorage · expo-image-picker · expo-speech
- Pure-RN UI (no web/Tailwind)

## Quick Start

```bash
cd mobile
npm install            # or: bun install / yarn
npx expo start         # scan QR with Expo Go on your phone
```

Run on a specific platform:
```bash
npx expo start --android
npx expo start --ios       # macOS only
```

## Production Build (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android       # APK / AAB
eas build -p ios           # IPA (Apple Developer account required)
```

## Configuration

Edit `app.json` → `expo.extra.apiBaseUrl` to point at a different backend (e.g. your own Lovable deployment).

```json
"extra": { "apiBaseUrl": "https://mmoneyguru.lovable.app" }
```

## Project Structure

```
mobile/
├── App.tsx                  # tab navigator + providers
├── app.json                 # Expo config
├── src/
│   ├── lib/
│   │   ├── store.tsx        # transactions context (AsyncStorage)
│   │   ├── types.ts         # shared with web
│   │   └── api.ts           # calls web backend
│   └── screens/
│       ├── Home.tsx         # balance + add tx + timeline
│       ├── Analytics.tsx    # weekly/monthly + by-category bars
│       ├── AI.tsx           # AI coach + bill scan + TTS
│       └── Settings.tsx
└── assets/icon.png
```

## Notes
- Voice playback uses `expo-speech` (native TTS). For ElevenLabs premium voice, pipe `/api/tts` response into `expo-av` `Audio.Sound`.
- The web project (parent folder) and mobile project are **separate** — they share a backend, not a codebase.
