# Google Play Data Safety Draft

Last updated: April 12, 2026

This is a practical draft for the current build of Retro Vault Elite. Final answers in Play Console are still your responsibility and should be reviewed against the exact release build.

## Current app behavior

- The app stores collection data locally on device.
- The app loads remote images and market data references.
- The Android and iOS mobile builds include one AdMob banner integration in test mode.
- The app does not currently include account login, cloud sync, or custom analytics.

## Likely Data safety answers to review

### Does your app collect or share any of the required user data types?

Yes.

Reason:
- AdMob SDK data handling.
- Remote market/image requests.
- Local collection tracking may count as app activity or user-provided info depending on how you classify it.

## Data types likely relevant

### Personal info

- Not intentionally collected by the app itself in the current build.
- Review whether your support email or future account system changes this answer later.

### App activity

- User interactions may be collected by the ads SDK.

### App info and performance

- Diagnostic information may be collected by the ads SDK.

### Device or other IDs

- Advertising ID and related identifiers may be collected by the ads SDK.

### Approximate location

- IP address may be used by the ads SDK to estimate general location.

## Purposes likely relevant

- Advertising or marketing
- Analytics
- Fraud prevention, security, and compliance

## Data handling notes

- Local collection data is stored on device by the app.
- AdMob documentation says the Mobile Ads SDK automatically collects and shares IP address, user product interactions, diagnostic information, and device/account identifiers.
- Ad ID collection can be limited depending on configuration and user/device settings.

Official source used:
- [Google Mobile Ads SDK data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)

## Security answers likely relevant

### Is all user data collected by your app encrypted in transit?

Likely yes for network traffic handled by remote requests and the ads SDK.

### Do you provide a way for users to request that their data is deleted?

For current local-only app data:
- Users can reset collection data inside the app.

Important nuance:
- If you later add cloud sync or accounts, this answer will need to become more formal and include actual deletion workflow.

## Before submitting the form

Review these items in the final release build:

1. Whether live AdMob IDs are enabled.
2. Whether any additional SDKs are added.
3. Whether cloud sync, login, analytics, crash reporting, or push notifications have been added.
4. Whether your privacy policy exactly matches the shipped app behavior.
