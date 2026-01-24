# Capacitor Setup (iOS + Android)

This project can be wrapped with Capacitor using the root Next.js app.

## Prerequisites
- Xcode (for iOS)
- Android Studio + SDKs (for Android)
- Node.js and npm

## Install Dependencies
```bash
npm install
```

## Build + Sync
```bash
npm run build:cap
npm run cap:sync
```

## Create Native Projects (first time only)
```bash
npm run cap:add:ios
npm run cap:add:android
```

## Open Native Projects
```bash
npm run cap:open:ios
npm run cap:open:android
```

## OAuth Redirects (Supabase)
Add these redirect URLs in Supabase → Authentication → URL Configuration:
- `bookreview://auth/callback`
- Your web URLs (localhost, GitHub Pages, etc.)

## Deep Links
Custom scheme is `bookreview://`. This is configured in:
- `ios/App/App/Info.plist` (`CFBundleURLTypes`)
- `android/app/src/main/AndroidManifest.xml` (intent filter)

## Push Notifications
Capacitor includes the push plugin, but native setup is still required:
- iOS: enable Push Notifications capability in Xcode, configure APNs.
- Android: add `google-services.json` and configure Firebase Cloud Messaging.

## Camera + Photos
Usage descriptions are defined in `ios/App/App/Info.plist`.
Permissions are defined in `android/app/src/main/AndroidManifest.xml`.

## Updating Web Assets
After any web changes:
```bash
npm run build:cap
npm run cap:sync
```
