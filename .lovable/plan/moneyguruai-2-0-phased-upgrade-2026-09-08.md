# MoneyGuruAI 2.0 — phased upgrade

## What I found in the current app (audit)

Working and worth keeping:
- Sign-in, 24-hour trial, paid plans and payment handling
- Income/expense entries with categories, saved to your account
- Udhari/EMI with a per-person ledger, proofs, receipts, sharing
- AI debt coach + chat, bill scan, voice read-out, analytics charts
- Installable app files (icon, manifest, offline worker)

Problems to fix:
- The home screen is thin: no available balance, no "safe to spend", no insight
- Udhari still keeps a separate stored total next to the ledger, so old records can disagree with the transaction list
- Money given/received live in two separate lists, which makes one clean statement harder
- Money entries have no payment method, attachment or source, and no search/filter screen
- Bottom bar mixes a calculator button in with navigation
- No goals, bills, money score, monthly wrap, challenges, export or theme switch (some tables exist but are unused)
- No tests on the money math

## Plan

**Phase 1 — Clean up and money math (this turn)**
Balance/total/udhari calculations moved into one shared file, ledger becomes the only source of truth for a person's due amount, and automated tests cover: multiple lendings, part repayment, edits, deletions, balance after reload. Fix any type/build errors.

**Phase 2 — Entries upgrade**
Payment method, time, attachment and source on every entry. New Transactions screen with search and filters (today / week / month / custom / income / expense / category), edit and delete with a confirm step.

**Phase 3 — New home + navigation**
Available balance, income, spent, udhari at the top; Guru Insight from real numbers; Safe to Spend per day with the working shown; recent entries with View All. Bottom bar becomes Home · Transactions · + · Udhari · Guru, with the + opening Add Expense / Add Income / Give Money / Receive Money. Calculator moves off the bar.

**Phase 4 — Udhari + receipts + sharing**
One permanent page per person: balance, history, give more, receive, edit, delete, call, WhatsApp, share statement, receipt. Receipts numbered MGA-YYYYMMDD-0001 with previous due / new amount / remaining due, preview, PDF, image, share.

**Phase 5 — Analytics, goals, bills**
Savings rate, top category, daily average, income-vs-expense, category split, monthly trend. Goals with contributions history. Bills/EMI with upcoming, due today, overdue, paid — a bill only counts as spending once marked paid.

**Phase 6 — Guru AI**
Guru answers from figures calculated in the app first, then explains. Handles "how much does Dipti owe me", "can I spend ₹5,000", "compare with last month". Money Score out of 100 with the reasons listed. Short, friendly, no scolding. Only a small summary is sent to the AI, never your full data.

**Phase 7 — Voice and scan**
Speak "250 rupees petrol mein gaya" to add an entry, always with a confirm screen. Bill photo extraction with a confirm screen and a manual fallback.

**Phase 8 — Polish**
Light/dark theme, empty states, skeletons, error and retry states, CSV/PDF export, offline shell, install check, speed pass, and the free vs premium limits kept in one settings file.

## Technical notes

- Existing tables are reused; new ones (goals, bills, contributions, settings, ai usage) are added by migration only — nothing dropped, no data loss.
- Person due amount is derived from ledger rows; the stored `principal` column stays for legacy rows only and is no longer written for new money.
- Shared calculation module + Vitest suite for every money formula.
- AI calls stay on the server with a compact computed context; keys never reach the browser.

I will run type checks and a production build at the end of each phase and report what is done.
