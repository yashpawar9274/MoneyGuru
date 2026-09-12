# Roadmap

- [x] Payments: PayU checkout and server-side fulfilment
- [x] Auth email templates setup (scaffolded, branded neon lime)
- [x] Email infra: managed service, domain verified — needs publish to activate
- [x] Mobile APK: 24h trial countdown, lock paywall, native Pricing tab
- [ ] User action: set PayU webhook URL and complete a live verification payment
- [ ] User action: run `eas build -p android --profile preview` and install the APK


## Payments (live)
- [x] PayU credentials stored server-side with test/live environment support
- [x] Signed PayU browser return and webhook verification
- [x] Idempotent Pro/Lifetime subscription fulfilment
- [ ] User: add `https://moneyguruai.dev/api/public/payu-webhook` in PayU and complete a live payment
- [x] Admin dashboard: customers, payments, subscriptions and webhook logs with live refresh
- [ ] User: run `eas build -p android --profile preview` and verify trial->Pro on the APK
