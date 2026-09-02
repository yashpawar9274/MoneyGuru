# Roadmap

- [ ] Payments: Paddle recommended — waiting for user confirmation to enable
- [x] Auth email templates setup (scaffolded, branded neon lime)
- [x] Email infra: managed service, domain verified — needs publish to activate
- [x] Mobile APK: 24h trial countdown, lock paywall, native Pricing tab → Cashfree checkout
- [ ] User action: add webhook URL in Cashfree dashboard + place sandbox test order
- [ ] User action: run `eas build -p android --profile preview` and install the APK


## Payments (live)
- [x] Cashfree production keys + CASHFREE_ENV=production, no sandbox fallback
- [x] Preview/lovableproject.com origin blocked by Cashfree whitelisting -> checkout redirects to live domain
- [ ] User: whitelist moneyguruai.dev + www in Cashfree dashboard, add production webhook URL
- [ ] User: run `eas build -p android --profile preview` and verify trial->Pro on the APK
