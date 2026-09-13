# Guru Voice AI — Premium Finance Conversation

## Goal

Add a mobile-first “Guru Voice AI — Premium” experience to the existing AI page without replacing working tracking, Udhari, payments, or authentication. Guru will hold short Hindi, Hinglish, or English voice conversations grounded only in the signed-in user’s real MoneyFYI data.

## Implementation

1. **Secure premium access**
   - Add an authenticated server function protected by the existing session middleware.
   - Re-check the subscription on every turn: allow active Weekly, Pro, and Lifetime plans; reject free, canceled, past-due, and expired access.
   - Add a persistent per-user request quota so refreshes or multiple devices cannot bypass the rate limit.
   - Never accept a user ID, subscription state, transaction list, or debt totals from the browser.

2. **Truthful finance context**
   - Load the current user’s profile, money settings, transactions, debts, debt entries, and debt payments through their authenticated database session.
   - Calculate income, expenses, balance, monthly/category totals, savings pattern, safe-to-spend, Udhari given/taken, EMI balances, due dates, and payment history on the server.
   - Keep recent history bounded and instruct Guru to state when data is missing rather than inventing values.

3. **Guru conversation service**
   - Reuse the Lovable AI gateway server integration and update its shared configuration to the supported low-latency model setup.
   - Validate all inputs with Zod, cap message count/length and response length, and return clear gateway errors.
   - Give Guru a concise, supportive Indian money-coach personality with safe financial guidance and natural Indian rupee language.
   - Keep transcripts in browser memory for the current session only; do not save recordings or transcripts.

4. **Protected natural speech**
   - Add a premium-protected server speech function using the server-side ElevenLabs key, with no key or secret sent to the browser.
   - Clean spoken text, use the selected language, and return short natural audio; use device speech only as a graceful fallback.
   - Track and stop the active audio object, revoke temporary audio URLs, cancel speech synthesis, and pause recognition while Guru speaks.

5. **Premium voice interface**
   - Replace the current basic live-voice card with a polished “Guru Voice AI — Premium” panel using the existing visual tokens.
   - Add Start Conversation, End Conversation, animated listening/speaking waveform, compact transcript, typing fallback, and explicit Connecting, Listening, Thinking, Speaking, Connected, Microphone denied, and Offline states.
   - Ask for microphone permission only after Start is tapped, restart listening only after playback ends, and clean up recognition/audio when stopped or when leaving the page.
   - Show free and expired users a premium preview with an Unlock Premium action to Pricing.

6. **Verification**
   - Add focused tests for subscription eligibility, expiry handling, finance-context calculations, and quota behavior.
   - Verify signed-out/free/expired denial and Weekly/Pro/Lifetime access, all three language modes, real transaction/Udhari grounding, typed fallback, and microphone/audio cleanup.
   - Run the existing tests, lint, and the production build; check the AI page on mobile and desktop with no browser errors.

## Technical details

- Add a non-destructive migration for the server-enforced Guru request quota, with explicit grants, RLS, and an authenticated security-definer quota function based on `auth.uid()`.
- Keep the existing transaction/debt tables unchanged and rely on their owner-only policies.
- Existing environment variables remain server-only: `LOVABLE_API_KEY` for Guru replies and `ELEVENLABS_API_KEY` for premium speech.
- The existing general AI cards and automatic transaction voice remain intact unless a shared gateway correctness fix is required.