# Architecture rules

- Package the existing hosted TanStack Start app for Android using Capacitor; keep SSR, authentication and payments on the existing HTTPS origin rather than attempting a static file build.
- Keep the independent Expo project separate from the Android web-app wrapper so existing native source remains available.