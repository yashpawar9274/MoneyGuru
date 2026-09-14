# Guru Voice AI — Premium

Latest uploaded MoneyGuru source mein Guru Voice AI implement kiya hai. Feature existing web/PWA ke **AI** page par hai. Is update mein separate Expo `mobile/` app ya signed Android APK build nahi kiya gaya.

## Pehle ye 3 steps karo

1. ZIP extract karo aur project root VS Code mein kholo: jahan `package.json` hai. Apni existing `.env` file retain/copy karo. ZIP mein real keys include nahi hain; `.env.example` mein names diye hain.
2. Apne existing Supabase project ke SQL Editor mein **`supabase/migrations/20260913143000_guru_voice_quota.sql`** ka poora content run karo. Existing migrations, including `20260912110000_add_weekly_seven_rupee_plan.sql`, pehle se applied honi chahiye. Guru migration koi transaction/debt/payment record modify nahi karti. Fresh database par saari migrations timestamp order mein run karo.
3. Deployment ke **server secrets** mein `LOVABLE_API_KEY` aur `ELEVENLABS_API_KEY` set karo; existing Supabase variables retain karo. Restart/redeploy your existing server app. Sirf `.output/public` static hosting se server functions nahi chalengi. Existing TanStack Start/Nitro deployment use karo.

Migration aur production deploy is workspace se execute nahi hue. Live AI/ElevenLabs requests ke liye valid keys, provider access aur funded usage balance chahiye. Coding-workspace credits aur runtime AI usage alag hain.

## VS Code / PowerShell

Project root se:

```powershell
npm ci
npm test
npm run typecheck
npm run lint:guru
npm run build
npm run dev
```

Existing `.env` nahi hai tab:

```powershell
Copy-Item .env.example .env
```

Phir `.env` ke placeholders replace karo. Existing `.env` ko template se overwrite mat karo. Browser mein terminal ka local URL open karo. Phone microphone ke liye deployed **HTTPS** URL use karo; laptop ka plain HTTP LAN address secure microphone context nahi hai. Chrome Android mein test karo; browser/WebView speech support vary karta hai. Unsupported recognition ya denied permission mein typing available hai.

## Feature behavior

- **Active Weekly (₹7/7 days), Pro, Lifetime** eligible. Free/trial, canceled, past-due, expired, missing/invalid paid expiry denied. Lifetime must still have `status = active`. Admin bhi apne subscription ke hisaab se access karta hai.
- Server har chat aur premium speech request par subscription check karta hai, aur provider response return karne se pehle dobara check karta hai. Client preview eligibility enforcement ka replacement nahi hai.
- User identity verified session se aati hai. Browser se IDs, subscription claims, transaction lists ya debt totals accept nahi hote. Queries user JWT/RLS use karti hain aur explicit owner filter bhi lagati hain, admin session ke liye bhi.
- Separate chat/speech quotas: **60 requests each per UTC day**, chat 8/minute, speech 12/minute. Count database mein atomic row lock se update hota hai; reload/multiple devices reset nahi kar sakte. Reset **05:30 IST**. Failed provider attempts also consume quota; access checks do not.
- Complete loaded ledger se income, expenses, recorded net, month/category totals, savings pattern, planning safe-to-spend, Udhari payable/receivable, EMI and history calculate hoti hai. Recorded net bank balance nahi hai. Data missing ho toh Guru ko clearly bolne ko kaha gaya hai.
- Totals up to 20,000 rows per finance table; larger ledgers fail explicitly instead of reporting partial totals. Provider ko limited details milti hain: 20 recent transactions, 20 largest monthly categories, 30 debts, 3 latest entries/payments per debt. Complete totals in bounds remain available.
- Mic sirf **Start Conversation** ke baad. Guru bolte waqt recognition paused. Audio end ke baad next listening turn. End, page leave/background, language change, offline, sign-out or expiry par microphone, requests and audio stopped; temporary audio URLs revoked.
- Typed questions can receive spoken replies without starting recognition. Playback restrictions may require a fresh user gesture on some phones. End stops pending speech; Clear also removes the in-memory transcript.
- Hindi, Hinglish, English supported. Hinglish response Hindi words Devanagari mein likhta hai for clearer pronunciation. Device fallback voice quality depends on installed voices.
- App recordings/transcripts database ya localStorage mein save nahi karta. Browser recognition services and AI/speech providers process content under their own retention policies. Provider zero-retention is not promised.
- Existing AI cards, transaction voice, tracking, Udhari, auth and payments remain. Shared voices yield to Guru to prevent overlapping speech. The old `/api/tts` integration remains separate; new Guru speech does not accept a browser-supplied ElevenLabs key.

## Optional server configuration

| Variable                   | Default / purpose                                                           |
| -------------------------- | --------------------------------------------------------------------------- |
| `GURU_AI_MODEL`            | `google/gemini-3.8-flash`, through the existing Lovable gateway             |
| `GURU_ELEVENLABS_VOICE_ID` | `EXAVITQu4vr4xnSDxMaL`; choose a voice available to your ElevenLabs account |
| `ELEVENLABS_API_KEY`       | Premium speech; if absent/unavailable, device voice fallback is used        |
| `LOVABLE_API_KEY`          | Required for real grounded Guru replies                                     |

ElevenLabs uses `eleven_flash_v2_5`, language `hi` or `en`, MP3. Secrets are server-only. AI gateway errors for exhausted credits (402), limits (429), or invalid credentials are sanitized and explained in the UI.

## Live acceptance check after deployment

1. Sign out: AI page should require login; direct Guru functions must reject missing/invalid session.
2. Sign in with free/expired/canceled subscription: upgrade preview, no Guru access. Test Weekly, Pro and Lifetime with real active subscriptions.
3. Save a known small income, expense and Udhari entry in **your test account**, then ask the month total and Udhari balance. Compare to the ledger. Ask about missing data and verify Guru admits the gap.
4. Start, allow microphone, ask one short question in each language. Confirm reply finishes before mic restarts. Check typed fallback, denied microphone, End, navigation away, language change and offline.
5. Confirm invalid keys, credits exhausted and quota responses show an error rather than invented financial data. Check a near-expiry subscription stops access.

Local automated test results and current verification limits are in `GURU_VOICE_VERIFICATION.md`. A test-only UI fixture is available with `npm run verify:ui` at the URL shown in the terminal. It uses **synthetic data and mocked speech**, and is never used by the production build. It is for UI inspection, not a real AI or authentication test.

References checked during implementation: [Lovable AI](https://docs.lovable.dev/features/ai), [Lovable adapter](https://tanstack.com/ai/latest/docs/adapters/lovable), [ElevenLabs TTS](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
