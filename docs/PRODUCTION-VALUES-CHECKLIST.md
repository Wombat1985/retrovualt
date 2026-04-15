# Production Values Checklist

Last updated: April 13, 2026

Use this checklist when swapping the project from test/demo values to real production values.

## AdMob

Replace test ids in these files:

- `src/mobileAds.ts`
  - Android banner ad unit id
  - iOS banner ad unit id
- `android/app/src/main/AndroidManifest.xml`
  - Android AdMob app id
- `ios/App/App/Info.plist`
  - iOS AdMob app id

## Business identity

Replace placeholders in these files:

- `src/appConfig.ts`
  - `businessEmail`
  - `supportUrl`
  - `privacyUrl`
- `public/support.html`
  - support email
  - website
  - privacy URL
- `public/privacy.html`
  - contact section
  - hosted production URL note

## Android release signing

Create these local-only files or assets:

- `android/keystore.properties`
- your keystore file such as `retro-vault-release.keystore`

Do not commit either of them.

## Store assets

Before submission, prepare:

- final launcher icon
- phone screenshots
- tablet screenshots
- feature graphic for Google Play
- store description text
- support URL
- privacy policy URL
