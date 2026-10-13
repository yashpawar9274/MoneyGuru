# MoneyGuruAI Android APK

Electron does not support Android. Capacitor displays the **current web app**, including credit cards, cloud sign-in, subscriptions and AI, inside an Android app. The separate `mobile/` Expo project is unchanged.

## Requirements

- Android Studio with Android SDK API 35, Android SDK Build Tools and JDK 21.
- Run `bun install` at the repository root.
- Set `ANDROID_HOME` to your Android SDK directory, or set `sdk.dir` in the untracked `android/local.properties` file.

## Build an installable APK

```sh
bun run android:sync
bun run android:open
```

In Android Studio, wait for Gradle sync, then choose **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

Alternatively, on Linux/macOS with the prerequisites installed:

```sh
bun run android:apk
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This is a development-signed APK for testing, not a signed Play Store release. On Windows, run `gradlew.bat assembleDebug` from `android/`.

## Release

Use Android Studio **Generate Signed App Bundle / APK**, create or select your private keystore, and select APK for direct installation or AAB for Play Store. Keep the keystore and passwords outside version control. Never commit signing credentials.

## Hosted app and connectivity

`capacitor.config.ts` loads `https://moneyguruai.dev` over HTTPS because TanStack Start needs its hosted server for authentication, AI and checkout. Do not change Vite's base path or attempt to load a static SSR build via `file://`. Internet access is required; this is not an offline app. Publish web changes before testing them in the APK; rebuild the APK only for native configuration changes.

## Device verification before release

- Test sign-in, existing data, card +/− actions, trial and subscription access.
- Test narrow phones, tablets, landscape, scrolling, keyboard and Android system navigation; system bars remain visible.
- Test microphone permission and voice playback on a physical phone. Browser speech recognition is not supported in every Android WebView; typing remains the fallback.
- Test Google sign-in on-device. OAuth providers can reject embedded browsers; email sign-in is the fallback until native OAuth handoff is configured.
- Test receipt downloads/sharing, camera uploads, external WhatsApp/call actions, and PayU/UPI return on-device. Browser-only download, speech and payment behavior is not guaranteed in WebView.

## Verification status

The Android project can be generated here. APK compilation requires JDK 21 and the Android SDK, which are not installed in the Lovable sandbox. Physical-device flows and signed distribution require your Android build environment.