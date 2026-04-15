# Retro Vault Elite Store Launch Checklist

Last updated: April 12, 2026

## What is already in place

- Shared web app built with Vite and TypeScript.
- Capacitor mobile projects created in `android/` and `ios/`.
- One AdMob banner integration added in test mode through `@capgo/capacitor-admob`.
- Privacy policy page added at `public/privacy.html`.
- Catalog, pricing, ownership tracking, currency conversion, and collection valuation are working in the shared app.

## Still required before release

### Developer accounts

- Apple Developer Program account.
- Google Play Console developer account.
- Real business support email and website.

### Ad monetization

- Create an AdMob app for Android and iOS.
- Replace the test AdMob app ids in:
  - `android/app/src/main/AndroidManifest.xml`
  - `ios/App/App/Info.plist`
- Replace the test banner ad unit ids in `src/mobileAds.ts`.
- Keep test mode on until live ad units are approved and store builds are ready.

### Privacy and compliance

- Host the privacy policy on a public HTTPS URL.
- Complete Apple App Privacy details.
- Complete Google Play Data safety form.
- Review whether ATT wording needs legal review for iOS.
- Confirm ad targeting settings for your audience and region.

### Store assets

- Final icon set.
- App screenshots for phone and tablet.
- Feature graphic for Google Play.
- App preview video if desired.
- Final app description, keywords, subtitle, promo text, and support URL.

### Release engineering

- Set production app version and build numbers.
- Create Android signing key / keystore.
- Configure Play App Signing.
- Open the iOS project on a Mac and configure signing in Xcode.
- Build Android App Bundle (`.aab`) for Google Play.
- Archive iOS app in Xcode and upload to App Store Connect.

## Recommended next work

1. Replace test ad ids with your real AdMob ids only after the apps are created in AdMob.
2. Add a proper support page and hosted privacy page on your own domain.
3. Create production icons and screenshots.
4. Test Android release build locally.
5. Open `ios/App/App.xcworkspace` or the generated Xcode project on a Mac for final iOS setup.

## Useful commands

```bash
npm run build
npm run cap:sync
npm run cap:open:android
npm run cap:open:ios
```

## Important note

This repository can be prepared for store release from here, but the final iOS archive and App Store submission still need Apple tooling on macOS.
