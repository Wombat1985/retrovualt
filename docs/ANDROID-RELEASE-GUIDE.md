# Android Release Guide

Last updated: April 12, 2026

## Current status

Prepared:

- Android Capacitor project exists in `android/`
- App id: `com.retrovault.elite`
- AdMob plugin installed
- Test AdMob app id added to Android manifest

Still needed:

- Your real AdMob Android app id and banner ad unit id
- Your signing key / keystore
- Google Play Console listing details
- Final screenshots and icon review

## 1. Create a signing key

Run this on your machine when you are ready:

```powershell
keytool -genkeypair -v -keystore retro-vault-release.keystore -alias retrovault -keyalg RSA -keysize 2048 -validity 10000
```

Store the generated keystore somewhere safe outside casual shared folders.

## 2. Create a local signing properties file

Create `android/keystore.properties` using the example file in this repo:

- `android/keystore.properties.example`

Do not commit your real passwords or keystore file.

## 3. Replace AdMob test ids

Replace test ids before production:

- `android/app/src/main/AndroidManifest.xml`
- `src/mobileAds.ts`

## 4. Build the web app and sync Capacitor

```powershell
npm run build
npm run cap:sync
```

## 5. Open Android Studio

```powershell
npm run cap:open:android
```

## 6. Build release bundle

In Android Studio:

- Open `Build > Generate Signed Bundle / APK`
- Choose `Android App Bundle`
- Select your keystore
- Build release bundle

Google Play prefers an `.aab` upload.

## 7. Upload to Google Play

In Play Console:

- Create app
- Complete store listing
- Complete App content items
- Upload the `.aab`
- Run internal testing first

## Policy notes

Official references:

- [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Google Mobile Ads SDK data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Google Play Console signup](https://play.google.com/console/signup)

As of the current Google Play help page, new app submissions must target Android 15 (API level 35) or higher. This project currently targets SDK 36, which is above that requirement.
