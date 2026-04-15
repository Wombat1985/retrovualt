import { Capacitor } from '@capacitor/core'
import { AdMob, BannerAd, MaxAdContentRating, TrackingAuthorizationStatus } from '@capgo/capacitor-admob'

const TEST_MODE = true
const ANDROID_BANNER_AD_UNIT = 'ca-app-pub-3940256099942544/6300978111'
const IOS_BANNER_AD_UNIT = 'ca-app-pub-3940256099942544/2435281174'

let started = false
let bannerShown = false
let bannerAd: BannerAd | null = null

function getBannerAdUnitId() {
  const platform = Capacitor.getPlatform()

  if (platform === 'android') {
    return ANDROID_BANNER_AD_UNIT
  }

  if (platform === 'ios') {
    return IOS_BANNER_AD_UNIT
  }

  return null
}

export async function initMobileBannerAd() {
  if (!Capacitor.isNativePlatform() || bannerShown) {
    return
  }

  const adUnitId = getBannerAdUnitId()

  if (!adUnitId) {
    return
  }

  try {
    if (!started) {
      await AdMob.start()
      await AdMob.configure({
        appMuted: true,
        appVolume: 0,
      })
      await AdMob.configRequest({
        maxAdContentRating: MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        testDeviceIds: TEST_MODE ? ['EMULATOR'] : [],
      })

      if (Capacitor.getPlatform() === 'ios') {
        const { status } = await AdMob.trackingAuthorizationStatus()

        if (status === TrackingAuthorizationStatus.notDetermined) {
          await AdMob.requestTrackingAuthorization()
        }
      }

      started = true
    }

    bannerAd = new BannerAd({
      adUnitId,
      position: 'bottom',
    })

    await bannerAd.show()
    bannerShown = true
  } catch (error) {
    console.warn('AdMob banner could not be shown.', error)
  }
}

export async function hideMobileBannerAd() {
  if (!bannerAd) {
    return
  }

  try {
    await bannerAd.hide()
  } catch (error) {
    console.warn('AdMob banner could not be hidden.', error)
  }
}
