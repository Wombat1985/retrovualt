import './style.css'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { priceSnapshotDate, sampleCatalog, type CatalogEntry, type RarityTier } from './data'
import { appConfig } from './appConfig'
import {
  changePassword,
  confirmPasswordReset,
  deleteAccount,
  getCurrentAccount,
  loginAccount,
  lookupBarcodeMapping,
  logoutAccount,
  pushSyncState,
  registerAccount,
  requestPasswordReset,
  saveBarcodeMapping,
  subscribeToNewsletter,
  trackPageView,
  updateAccountProfile,
} from './backend'
import { initMobileBannerAd } from './mobileAds'

type OwnershipFilter = 'all' | 'owned' | 'wanted' | 'missing'
type SortMode = 'title' | 'year' | 'loose-high' | 'complete-high' | 'trend-high' | 'shelf-score'
type GameStatus = 'missing' | 'wanted' | 'owned'
type EditionStatus = 'loose' | 'boxed' | 'manual' | 'cib' | 'sealed' | 'graded'
type ConditionRating = 'mint' | 'excellent' | 'good' | 'fair'
type AuthView = 'none' | 'register' | 'login' | 'reset' | 'account' | 'confirm-reset'
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type GameRecord = {
  status: GameStatus
  completeInBox: boolean
  pricePaid: number | null
  favorite: boolean
  ownedCopies: number
  editionStatus: EditionStatus
  condition: ConditionRating
  targetPrice: number | null
  notes: string
}

type ExportEntry = CatalogEntry & {
  status: GameStatus
  completeInBox: boolean
  pricePaid: number | null
  favorite: boolean
  ownedCopies: number
  editionStatus: EditionStatus
  condition: ConditionRating
  targetPrice: number | null
  notes: string
}

type Spotlight = {
  game: CatalogEntry
  label: string
  copy: string
}

type DailyHuntItem = {
  label: string
  title: string
  detail: string
  meta: string
  actionLabel: string
  action: string
  game?: CatalogEntry
  consoleName?: string
  tone: 'gold' | 'teal' | 'crimson' | 'blue'
}

type VisitStreak = {
  current: number
  best: number
  lastVisitDate: string
  weekStartDate: string
}

type ActivityType =
  | 'owned_added'
  | 'wanted_added'
  | 'cib_upgraded'
  | 'paid_price_added'
  | 'favorite_added'
  | 'target_price_added'
  | 'badge_unlocked'

type ActivityEvent = {
  id: string
  type: ActivityType
  gameId?: string
  title: string
  detail: string
  createdAt: string
}

type CollectorBadge = {
  id: string
  title: string
  detail: string
  hint: string
  icon: string
  progress: number
  target: number
  unlocked: boolean
  tone: 'gold' | 'teal' | 'crimson' | 'blue'
}

type CollectorAchievement = {
  title: string
  detail: string
  tone: 'gold' | 'teal' | 'crimson'
}

type ConsoleProgress = {
  consoleName: string
  total: number
  owned: number
  progress: number
}

type DashboardSummary = {
  ownedGames: CatalogEntry[]
  wantedGames: CatalogEntry[]
  ownedTrackedValue: number
  ownedCompleteValue: number
  completionPercentage: number
  wishlistValue: number
  collectionDelta: number
  prestigeScore: number
  spotlight: Spotlight | null
  alertMatches: CatalogEntry[]
  nearCompleteConsoles: ConsoleProgress[]
  collectorRank: {
    title: string
    detail: string
  }
}

type OnboardingStep = {
  label: string
  detail: string
  done: boolean
  action: string
  actionLabel: string
}

type CatalogConsoleMeta = {
  console: string
  slug: string
  region: string
  market?: string
  count: number
  file: string
}

const LIBRARY_STORAGE_KEY = 'retro-game-collector-library'
const CUSTOM_STORAGE_KEY = 'retro-game-collector-custom-catalog'
const CURRENCY_STORAGE_KEY = 'retro-game-collector-currency'
const AUTH_TOKEN_STORAGE_KEY = 'retro-game-collector-auth-token'
const AUTH_PROFILE_STORAGE_KEY = 'retro-game-collector-auth-profile'
const BARCODE_STORAGE_KEY = 'retro-game-collector-barcode-mappings'
const ONBOARDING_STORAGE_KEY = 'retro-game-collector-onboarding-dismissed'
const STREAK_STORAGE_KEY = 'retro-game-collector-visit-streak'
const ACTIVITY_STORAGE_KEY = 'retro-game-collector-activity-events'
const MAX_ACTIVITY_EVENTS = 250
const TRUSTED_COVER_HOSTS = new Set(['storage.googleapis.com', 'images.pricecharting.com'])
const COVER_FALLBACK_PREFIX = 'data:image/svg+xml;charset=UTF-8,'
const INITIAL_VISIBLE_GAME_COUNT = 96
const VISIBLE_GAME_INCREMENT = 96
const COMPACT_VISIBLE_GAME_COUNT = 48
const COMPACT_VISIBLE_GAME_INCREMENT = 48
const SEARCH_RENDER_DELAY_MS = 180
const appElement = document.querySelector<HTMLDivElement>('#app')
let catalogCache: CatalogEntry[] | null = null
let catalogCacheKey = ''
let catalogByIdCache = new Map<string, CatalogEntry>()
let filteredGamesCache: CatalogEntry[] | null = null
let filteredGamesCacheKey = ''
const searchHaystackCache = new Map<string, string>()
let dashboardSummaryCache: DashboardSummary | null = null
let dashboardSummaryCacheKey = ''
let renderFrame = 0
let pendingCatalogScrollRestore: number | null = null
let barcodeReader: BrowserMultiFormatReader | null = null
let barcodeCameraControls: IScannerControls | null = null
let barcodeCameraStartPromise: Promise<void> | null = null
let pendingLibrarySave = 0
let pendingSyncStatusRender = 0
let pendingSearchRender = 0
let pendingBarcodeSearchRender = 0
let libraryRevision = 0
let appEventsBound = false
let lastInputFocusSnapshot: FocusSnapshot | null = null

type FocusSnapshot = {
  id: string
  value: string
  selectionStart: number | null
  selectionEnd: number | null
}

if (!appElement) {
  throw new Error('App root was not found.')
}

const app = appElement
let deferredInstallPrompt: InstallPromptEvent | null = null
const pendingConsoleLoads = new Map<string, Promise<void>>()
let syncTimeout: number | null = null
const editionOptions: EditionStatus[] = ['loose', 'boxed', 'manual', 'cib', 'sealed', 'graded']
const conditionOptions: ConditionRating[] = ['mint', 'excellent', 'good', 'fair']
const currencyOptions = [
  { code: 'USD', label: 'US Dollar', symbol: '$', perEuro: 1.1711 },
  { code: 'EUR', label: 'Euro', symbol: '€', perEuro: 1 },
  { code: 'GBP', label: 'British Pound', symbol: '£', perEuro: 0.87105 },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$', perEuro: 1.6561 },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$', perEuro: 1.6187 },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥', perEuro: 186.43 },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: 'NZ$', perEuro: 2.0034 },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$', perEuro: 1.4919 },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF', perEuro: 0.9241 },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'SEK', perEuro: 10.836 },
  { code: 'NOK', label: 'Norwegian Krone', symbol: 'NOK', perEuro: 11.1165 },
  { code: 'DKK', label: 'Danish Krone', symbol: 'DKK', perEuro: 7.4727 },
  { code: 'PLN', label: 'Polish Zloty', symbol: 'PLN', perEuro: 4.2435 },
  { code: 'CZK', label: 'Czech Koruna', symbol: 'CZK', perEuro: 24.365 },
  { code: 'HUF', label: 'Hungarian Forint', symbol: 'HUF', perEuro: 377.2 },
  { code: 'RON', label: 'Romanian Leu', symbol: 'RON', perEuro: 5.0915 },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$', perEuro: 5.9191 },
  { code: 'MXN', label: 'Mexican Peso', symbol: 'MX$', perEuro: 20.3184 },
  { code: 'CNY', label: 'Chinese Yuan', symbol: 'CN¥', perEuro: 7.9967 },
  { code: 'HKD', label: 'Hong Kong Dollar', symbol: 'HK$', perEuro: 9.1729 },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', perEuro: 108.7795 },
  { code: 'KRW', label: 'South Korean Won', symbol: '₩', perEuro: 1737.06 },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM', perEuro: 4.6434 },
  { code: 'PHP', label: 'Philippine Peso', symbol: '₱', perEuro: 70.088 },
  { code: 'THB', label: 'Thai Baht', symbol: '฿', perEuro: 37.592 },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R', perEuro: 19.2389 },
  { code: 'TRY', label: 'Turkish Lira', symbol: '₺', perEuro: 52.3147 },
] as const

const state = {
  search: '',
  consoleFilter: 'All consoles',
  regionFilter: 'All regions',
  yearFilter: 'All years',
  ownershipFilter: 'all' as OwnershipFilter,
  sortMode: 'title' as SortMode,
  visibleGameCount: getInitialVisibleGameCount(),
  currencyCode: loadCurrencyCode(),
  authToken: loadAuthToken(),
  accountEmail: loadAuthProfile().email,
  accountDisplayName: loadAuthProfile().displayName,
  syncStatus: loadAuthToken() ? 'Restoring account session...' : 'Saved on this device',
  authView: getInitialAuthView(),
  authLoading: false,
  authError: '',
  authSuccess: '',
  authEmailDraft: '',
  newsletterStatus: '',
  resetToken: getPasswordResetToken(),
  library: loadLibrary(),
  generatedCatalog: [] as CatalogEntry[],
  catalogMeta: [] as CatalogConsoleMeta[],
  loadedConsoles: [] as string[],
  customCatalog: loadCustomCatalog(),
  barcodeMappings: loadBarcodeMappings(),
  onboardingDismissed: loadOnboardingDismissed(),
  visitStreak: recordDailyVisit(),
  activityEvents: loadActivityEvents(),
  cachedOwnedGames: [] as CatalogEntry[],
  cachedWantedGames: [] as CatalogEntry[],
  cachedCatalogStatsKey: '',
  cachedConsoleProgress: [] as ConsoleProgress[],
  cachedConsoleProgressKey: '',
  selectedGameId: null as string | null,
  badgesOpen: false,
  ownershipPickerGameId: null as string | null,
  justOwnedGameId: null as string | null,
  customEntryOpen: false,
  customEntryError: '',
  scannerOpen: false,
  scannerLiveActive: false,
  scannerStatus: 'Scan a barcode with your camera or upload a clear barcode photo.' as string,
  barcodeLinkCode: null as string | null,
  barcodeSearch: '',
  isCatalogLoading: true,
  catalogLoadError: false,
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event as InstallPromptEvent
  render()
})

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null
  render()
})

registerServiceWorker()

function defaultRecord(): GameRecord {
  return {
    status: 'missing',
    completeInBox: false,
    pricePaid: null,
    favorite: false,
    ownedCopies: 1,
    editionStatus: 'loose',
    condition: 'good',
    targetPrice: null,
    notes: '',
  }
}

function loadLibrary() {
  const raw = localStorage.getItem(LIBRARY_STORAGE_KEY)

  if (!raw) {
    return {} as Record<string, GameRecord>
  }

  try {
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([id, value]) => {
        if (!value || typeof value !== 'object') {
          return []
        }

        const entry = value as Record<string, unknown>
        const status = entry.status
        const completeInBox = entry.completeInBox
        const pricePaid = entry.pricePaid
        const favorite = entry.favorite
        const ownedCopies = entry.ownedCopies
        const editionStatus = entry.editionStatus
        const condition = entry.condition
        const targetPrice = entry.targetPrice
        const notes = entry.notes

        if (status !== 'missing' && status !== 'wanted' && status !== 'owned') {
          return []
        }

        return [
          [
            id,
            {
              status,
              completeInBox: typeof completeInBox === 'boolean' ? completeInBox : false,
              pricePaid: typeof pricePaid === 'number' ? pricePaid : null,
              favorite: typeof favorite === 'boolean' ? favorite : false,
              ownedCopies: typeof ownedCopies === 'number' && ownedCopies >= 1 ? Math.min(Math.round(ownedCopies), 99) : 1,
              editionStatus: isEditionStatus(editionStatus) ? editionStatus : 'loose',
              condition: isConditionRating(condition) ? condition : 'good',
              targetPrice: typeof targetPrice === 'number' ? targetPrice : null,
              notes: typeof notes === 'string' ? notes : '',
            } satisfies GameRecord,
          ],
        ]
      }),
    )
  } catch {
    return {} as Record<string, GameRecord>
  }
}

function saveLibrary() {
  if (pendingLibrarySave) {
    window.clearTimeout(pendingLibrarySave)
  }

  pendingLibrarySave = window.setTimeout(() => {
    flushLibrarySave()
  }, 120)

  scheduleCloudSync()
}

function flushLibrarySave() {
  if (pendingLibrarySave) {
    window.clearTimeout(pendingLibrarySave)
    pendingLibrarySave = 0
  }

  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library))
}

function loadCustomCatalog(): CatalogEntry[] {
  const raw = localStorage.getItem(CUSTOM_STORAGE_KEY)

  if (!raw) {
    return [] as CatalogEntry[]
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeCatalogEntry).filter(isCatalogEntry) : []
  } catch {
    return [] as CatalogEntry[]
  }
}

function saveCustomCatalog() {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(state.customCatalog))
  scheduleCloudSync()
}

function loadCurrencyCode(): string {
  const saved = localStorage.getItem(CURRENCY_STORAGE_KEY)
  return saved && currencyOptions.some((currency) => currency.code === saved) ? saved : 'USD'
}

function saveCurrencyCode() {
  localStorage.setItem(CURRENCY_STORAGE_KEY, state.currencyCode)
  scheduleCloudSync()
}

function loadAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? ''
}

function saveAuthToken(token: string) {
  state.authToken = token
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

function loadAuthProfile() {
  const raw = localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)

  if (!raw) {
    return { email: '', displayName: '' }
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      email: typeof parsed.email === 'string' ? parsed.email : '',
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
    }
  } catch {
    return { email: '', displayName: '' }
  }
}

function saveAuthProfile(email: string, displayName = '') {
  state.accountEmail = email
  state.accountDisplayName = displayName
  localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify({ email, displayName }))
}

function getAccountIdentityLabel() {
  if (!state.authToken) {
    return ''
  }

  return state.accountDisplayName
    ? `${state.accountDisplayName} (${state.accountEmail})`
    : state.accountEmail || 'collector'
}

function loadOnboardingDismissed() {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
}

function saveOnboardingDismissed() {
  state.onboardingDismissed = true
  localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
}

function isActivityType(value: unknown): value is ActivityType {
  return (
    value === 'owned_added' ||
    value === 'wanted_added' ||
    value === 'cib_upgraded' ||
    value === 'paid_price_added' ||
    value === 'favorite_added' ||
    value === 'target_price_added' ||
    value === 'badge_unlocked'
  )
}

function normalizeActivityEvent(value: unknown): ActivityEvent | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const event = value as Partial<ActivityEvent>

  if (!event.id || !isActivityType(event.type) || !event.title || !event.detail || !event.createdAt) {
    return null
  }

  return {
    id: String(event.id),
    type: event.type,
    gameId: typeof event.gameId === 'string' ? event.gameId : undefined,
    title: String(event.title),
    detail: String(event.detail),
    createdAt: String(event.createdAt),
  }
}

function loadActivityEvents() {
  const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY)

  if (!raw) {
    return [] as ActivityEvent[]
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(normalizeActivityEvent).filter((event): event is ActivityEvent => event !== null).slice(0, MAX_ACTIVITY_EVENTS)
      : []
  } catch {
    return []
  }
}

function saveActivityEvents() {
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(state.activityEvents.slice(0, MAX_ACTIVITY_EVENTS)))
}

function mergeActivityEvents(remoteEvents: ActivityEvent[]) {
  return [...new Map([...state.activityEvents, ...remoteEvents].map((event) => [event.id, event])).values()]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, MAX_ACTIVITY_EVENTS)
}

function addActivityEvent(event: Omit<ActivityEvent, 'id' | 'createdAt'>) {
  const createdAt = new Date().toISOString()
  state.activityEvents = [
    {
      ...event,
      id: `${createdAt}-${event.type}-${event.gameId ?? event.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      createdAt,
    },
    ...state.activityEvents,
  ].slice(0, MAX_ACTIVITY_EVENTS)
  saveActivityEvents()
}

function getLocalDateKey(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function getWeekStartDateKey() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return date.toISOString().slice(0, 10)
}

function loadVisitStreak(): VisitStreak {
  const fallback = {
    current: 0,
    best: 0,
    lastVisitDate: '',
    weekStartDate: getWeekStartDateKey(),
  }
  const raw = localStorage.getItem(STREAK_STORAGE_KEY)

  if (!raw) {
    return fallback
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>

    return {
      current: typeof parsed.current === 'number' ? parsed.current : fallback.current,
      best: typeof parsed.best === 'number' ? parsed.best : fallback.best,
      lastVisitDate: typeof parsed.lastVisitDate === 'string' ? parsed.lastVisitDate : fallback.lastVisitDate,
      weekStartDate: typeof parsed.weekStartDate === 'string' ? parsed.weekStartDate : fallback.weekStartDate,
    }
  } catch {
    return fallback
  }
}

function saveVisitStreak(streak: VisitStreak) {
  localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streak))
}

function recordDailyVisit() {
  const today = getLocalDateKey()
  const yesterday = getLocalDateKey(-1)
  const weekStartDate = getWeekStartDateKey()
  const streak = loadVisitStreak()

  if (streak.lastVisitDate === today) {
    return {
      ...streak,
      weekStartDate,
    }
  }

  const current = streak.lastVisitDate === yesterday ? streak.current + 1 : 1
  const nextStreak = {
    current,
    best: Math.max(streak.best, current),
    lastVisitDate: today,
    weekStartDate,
  }
  saveVisitStreak(nextStreak)
  return nextStreak
}

function clearAuthToken() {
  state.authToken = ''
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

function clearAuthProfile() {
  state.accountEmail = ''
  state.accountDisplayName = ''
  localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY)
}

function clearExpiredAccountSession(message = 'Session expired. Please sign in again to sync.') {
  clearAuthToken()
  clearAuthProfile()
  state.syncStatus = message
  state.authView = 'login'
}

function getPasswordResetToken() {
  const params = new URLSearchParams(window.location.search)
  return params.get('resetToken') ?? ''
}

function getInitialAuthView(): AuthView {
  return getPasswordResetToken() ? 'confirm-reset' : 'none'
}

function clearAuthFeedback() {
  state.authError = ''
  state.authSuccess = ''
}

function resetLocalCollectionState() {
  if (syncTimeout !== null) {
    window.clearTimeout(syncTimeout)
    syncTimeout = null
  }

  if (pendingSyncStatusRender) {
    window.clearTimeout(pendingSyncStatusRender)
    pendingSyncStatusRender = 0
  }

  state.library = {}
  state.customCatalog = []
  state.barcodeMappings = {}
  state.activityEvents = []
  state.justOwnedGameId = ''
  state.selectedGameId = ''
  libraryRevision += 1
  invalidateCatalogCache()
  saveLocalCollectionState()
}

function saveLocalCollectionState() {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library))
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(state.customCatalog))
  localStorage.setItem(BARCODE_STORAGE_KEY, JSON.stringify(state.barcodeMappings))
  saveActivityEvents()
}

function loadBarcodeMappings() {
  const raw = localStorage.getItem(BARCODE_STORAGE_KEY)

  if (!raw) {
    return {} as Record<string, string>
  }

  try {
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([code, gameId]) => {
        if (typeof code !== 'string' || typeof gameId !== 'string') {
          return []
        }

        return [[code, gameId]]
      }),
    )
  } catch {
    return {}
  }
}

function saveBarcodeMappings() {
  localStorage.setItem(BARCODE_STORAGE_KEY, JSON.stringify(state.barcodeMappings))
  scheduleCloudSync()
}

function normalizeCatalogEntry(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entry = value as Record<string, unknown>
  const coverUrl = typeof entry.coverUrl === 'string' ? normalizeCoverUrl(entry.coverUrl) : ''
  const priceSourceUrl = typeof entry.priceSourceUrl === 'string' ? normalizeExternalUrl(entry.priceSourceUrl) : ''
  const coverSourceUrl = typeof entry.coverSourceUrl === 'string' ? normalizeExternalUrl(entry.coverSourceUrl) : ''

  if (
    typeof entry.id !== 'string' ||
    typeof entry.title !== 'string' ||
    typeof entry.console !== 'string' ||
    (typeof entry.year !== 'number' && entry.year !== null) ||
    typeof entry.region !== 'string' ||
    typeof entry.priceLoose !== 'number' ||
    (typeof entry.priceComplete !== 'number' && entry.priceComplete !== null) ||
    !priceSourceUrl ||
    !coverSourceUrl
  ) {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    console: entry.console,
    year: entry.year,
    region: entry.region,
    coverUrl,
    priceLoose: entry.priceLoose,
    priceComplete: entry.priceComplete,
    priceSourceUrl,
    coverSourceUrl,
    trendDelta: typeof entry.trendDelta === 'number' ? entry.trendDelta : 0,
    rarity: isRarityTier(entry.rarity) ? entry.rarity : 'Classic',
  } satisfies CatalogEntry
}

function normalizeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function normalizeCoverUrl(value: string) {
  const url = normalizeExternalUrl(value)

  if (!url) {
    return ''
  }

  return isTrustedCoverUrl(url) ? url : ''
}

function normalizeCustomCoverUrl(value: string) {
  return normalizeExternalUrl(value)
}

function normalizeBarcodeValue(value: string) {
  return value.trim().replace(/[\s-]+/g, '')
}

function getBarcodeReader() {
  if (!barcodeReader) {
    barcodeReader = new BrowserMultiFormatReader()
  }

  return barcodeReader
}

function canUseLiveBarcodeCamera() {
  return window.isSecureContext && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

function stopLiveBarcodeScan() {
  barcodeCameraControls?.stop()
  barcodeCameraControls = null
  barcodeCameraStartPromise = null
}

async function syncLiveBarcodeScan() {
  if (!state.scannerOpen || !state.scannerLiveActive) {
    stopLiveBarcodeScan()
    return
  }

  if (barcodeCameraControls || barcodeCameraStartPromise) {
    return
  }

  const preview = document.querySelector<HTMLVideoElement>('[data-barcode-camera-preview]')

  if (!preview || !canUseLiveBarcodeCamera()) {
    return
  }

  barcodeCameraStartPromise = (async () => {
    try {
      barcodeCameraControls = await getBarcodeReader().decodeFromVideoDevice(undefined, preview, (result) => {
        if (!result) {
          return
        }

        stopLiveBarcodeScan()
        state.scannerLiveActive = false
        void handleBarcodeDetected(result.getText())
      })
    } catch (error) {
      stopLiveBarcodeScan()
      state.scannerLiveActive = false
      state.scannerStatus =
        error instanceof Error
          ? error.message
          : 'Camera scanning is not available right now. Try a saved photo or manual entry.'
      render()
    } finally {
      barcodeCameraStartPromise = null
    }
  })()

  await barcodeCameraStartPromise
}

function isTrustedCoverUrl(value: string) {
  try {
    const url = new URL(value)

    if (!TRUSTED_COVER_HOSTS.has(url.hostname)) {
      return false
    }

    if (url.hostname === 'storage.googleapis.com') {
      return url.pathname.startsWith('/images.pricecharting.com/')
    }

    return true
  } catch {
    return false
  }
}

function isCatalogEntry(value: CatalogEntry | null): value is CatalogEntry {
  return value !== null
}

function isRarityTier(value: unknown): value is RarityTier {
  return value === 'Common' || value === 'Classic' || value === 'Grail'
}

function isEditionStatus(value: unknown): value is EditionStatus {
  return editionOptions.includes(value as EditionStatus)
}

function isConditionRating(value: unknown): value is ConditionRating {
  return conditionOptions.includes(value as ConditionRating)
}

function getCatalog() {
  const key = [
    state.generatedCatalog.length,
    state.customCatalog.length,
    state.loadedConsoles.join('|'),
    state.customCatalog.map((game) => game.id).join('|'),
  ].join(':')

  if (catalogCache && catalogCacheKey === key) {
    return catalogCache
  }

  const catalogEntries = [...state.generatedCatalog, ...sampleCatalog, ...state.customCatalog]
  catalogCache = dedupeCatalog(catalogEntries)
  catalogByIdCache = new Map(catalogCache.map((game) => [game.id, game]))
  catalogCacheKey = key
  return catalogCache
}

function invalidateCatalogCache() {
  catalogCache = null
  catalogCacheKey = ''
  catalogByIdCache = new Map()
  filteredGamesCache = null
  filteredGamesCacheKey = ''
  state.cachedCatalogStatsKey = ''
  state.cachedConsoleProgressKey = ''
}

function getConsoles() {
  const metaNames = state.catalogMeta.length
    ? state.catalogMeta
        .filter((entry) => state.regionFilter === 'All regions' || entry.region === state.regionFilter)
        .map((entry) => entry.console)
    : getCatalog().map((game) => game.console)
  const customNames = state.customCatalog
    .filter((entry) => state.regionFilter === 'All regions' || entry.region === state.regionFilter)
    .map((entry) => entry.console)

  return ['All consoles', ...[...new Set([...metaNames, ...customNames])]]
}

function getConsoleMeta(consoleName: string) {
  return state.catalogMeta.find((entry) => entry.console === consoleName)
}

function getConsoleOptionLabel(consoleName: string) {
  if (consoleName === 'All consoles') {
    const total = state.catalogMeta.reduce((sum, entry) => sum + entry.count, 0)
    return total ? `All consoles (${total.toLocaleString()})` : consoleName
  }

  const meta = getConsoleMeta(consoleName)
  return meta ? `${meta.console} (${meta.count.toLocaleString()})` : consoleName
}

function getRegions() {
  const regions = state.catalogMeta.length
    ? [...state.catalogMeta.map((entry) => entry.region), ...state.customCatalog.map((entry) => entry.region)]
    : [...new Set(getCatalog().map((game) => game.region))]

  return ['All regions', ...[...new Set(regions.filter(Boolean))].sort((left, right) => left.localeCompare(right))]
}

function getRegionOptionLabel(regionName: string) {
  if (regionName === 'All regions') {
    return regionName
  }

  const total = state.catalogMeta
    .filter((entry) => entry.region === regionName)
    .reduce((sum, entry) => sum + entry.count, 0)

  return total ? `${regionName} (${total.toLocaleString()})` : regionName
}

function getYears() {
  const years = [...new Set(getCatalog().map((game) => game.year).filter((year): year is number => Number.isFinite(year)))]
  return ['All years', ...years.sort((left, right) => right - left).map(String)]
}

function getRecord(gameId: string) {
  return state.library[gameId] ?? defaultRecord()
}

function getGameById(gameId: string) {
  getCatalog()
  return catalogByIdCache.get(gameId) ?? null
}

function decodeHtmlEntities(value: string) {
  const element = document.createElement('textarea')
  element.innerHTML = value
  return element.value
}

function resolveGameId(rawId: string | undefined) {
  if (!rawId) {
    return undefined
  }

  if (getGameById(rawId)) {
    return rawId
  }

  const catalog = getCatalog()
  const match = catalog.find((game) => decodeHtmlEntities(game.id) === rawId)
  return match?.id ?? rawId
}

function getLinkedBarcodeGame() {
  if (!state.barcodeLinkCode) {
    return null
  }

  const mappedGameId = state.barcodeMappings[state.barcodeLinkCode]
  return mappedGameId ? getGameById(mappedGameId) : null
}

function getBarcodeSearchMatches() {
  if (!state.barcodeLinkCode) {
    return [] as CatalogEntry[]
  }

  const query = state.barcodeSearch.trim().toLowerCase()
  const catalog = getCatalog()

  if (!query) {
    return catalog.slice(0, 12)
  }

  return catalog
    .filter((game) => [game.title, game.console, game.region].some((field) => field.toLowerCase().includes(query)))
    .slice(0, 12)
}

function getSelectedCurrency() {
  return currencyOptions.find((currency) => currency.code === state.currencyCode) ?? currencyOptions[0]
}

function getShelfScore(game: CatalogEntry) {
  const record = getRecord(game.id)
  const rarityBonus = game.rarity === 'Grail' ? 60 : game.rarity === 'Classic' ? 30 : 10
  const cibBonus = record.completeInBox ? 18 : 0
  const ownedBonus = record.status === 'owned' ? 25 : 0
  const favoriteBonus = record.favorite ? 20 : 0

  return rarityBonus + cibBonus + ownedBonus + favoriteBonus + Math.round(game.trendDelta * 3)
}

function getReferencePrice(game: CatalogEntry) {
  return game.priceComplete ?? game.priceLoose
}

function isCompleteEdition(record: GameRecord) {
  return record.completeInBox || record.editionStatus === 'cib' || record.editionStatus === 'sealed' || record.editionStatus === 'graded'
}

function getOwnedMarketPrice(game: CatalogEntry) {
  const record = getRecord(game.id)
  const singleCopyValue = isCompleteEdition(record) ? getReferencePrice(game) : game.priceLoose
  return singleCopyValue * getOwnedCopyCount(record)
}

function getOwnedValueLabel(game: CatalogEntry) {
  const record = getRecord(game.id)
  const baseLabel = isCompleteEdition(record) ? 'Complete value' : 'Loose value'
  return getOwnedCopyCount(record) > 1 ? `${baseLabel} x${getOwnedCopyCount(record)}` : baseLabel
}

function getOwnedCopyCount(record: GameRecord) {
  return record.status === 'owned' ? Math.max(1, Math.min(Math.round(record.ownedCopies || 1), 99)) : 1
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\biii\b/g, ' 3 ')
    .replace(/\bii\b/g, ' 2 ')
    .replace(/\biv\b/g, ' 4 ')
    .replace(/\bv\b/g, ' 5 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugifyCustomValue(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, '-')
}

function matchesSearchValue(game: CatalogEntry, searchValue: string) {
  const normalizedSearch = normalizeSearchText(searchValue)

  if (!normalizedSearch) {
    return true
  }

  const cacheKey = `${game.id}|${game.title}|${game.console}|${game.region}|${game.rarity}`
  let haystack = searchHaystackCache.get(cacheKey)

  if (!haystack) {
    haystack = normalizeSearchText([game.title, game.console, game.region, game.rarity, game.id].join(' '))
    searchHaystackCache.set(cacheKey, haystack)
  }

  const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean)
  const paddedHaystack = ` ${haystack} `

  return haystack.includes(normalizedSearch) || searchTokens.every((token) => paddedHaystack.includes(` ${token} `))
}

function useCompactCatalogWindow() {
  return window.innerWidth <= 900
}

function getInitialVisibleGameCount() {
  return useCompactCatalogWindow() ? COMPACT_VISIBLE_GAME_COUNT : INITIAL_VISIBLE_GAME_COUNT
}

function getVisibleGameIncrement() {
  return useCompactCatalogWindow() ? COMPACT_VISIBLE_GAME_INCREMENT : VISIBLE_GAME_INCREMENT
}

function getFilteredGames() {
  getCatalog()
  const key = [
    catalogCacheKey,
    getLibraryStatsKey(),
    state.search.trim().toLowerCase(),
    state.consoleFilter,
    state.regionFilter,
    state.yearFilter,
    state.ownershipFilter,
    state.sortMode,
  ].join(':')

  if (filteredGamesCache && filteredGamesCacheKey === key) {
    return filteredGamesCache
  }

  const searchValue = state.search.trim()
  const activeCatalog =
    state.consoleFilter === 'All consoles'
      ? getCatalog()
      : getCatalog().filter((game) => game.console === state.consoleFilter)

  filteredGamesCache = activeCatalog
    .filter((game) => state.regionFilter === 'All regions' || game.region === state.regionFilter)
    .filter((game) => state.yearFilter === 'All years' || String(game.year ?? '') === state.yearFilter)
    .filter((game) => {
      if (!searchValue) {
        return true
      }

      return matchesSearchValue(game, searchValue)
    })
    .filter((game) => {
      if (state.ownershipFilter === 'all') {
        return true
      }

      return getRecord(game.id).status === state.ownershipFilter
    })
    .sort((left, right) => {
      switch (state.sortMode) {
        case 'year':
          return (left.year ?? 0) - (right.year ?? 0) || left.title.localeCompare(right.title)
        case 'loose-high':
          return right.priceLoose - left.priceLoose || left.title.localeCompare(right.title)
        case 'complete-high':
          return getReferencePrice(right) - getReferencePrice(left) || left.title.localeCompare(right.title)
        case 'trend-high':
          return right.trendDelta - left.trendDelta || left.title.localeCompare(right.title)
        case 'shelf-score':
          return getShelfScore(right) - getShelfScore(left) || left.title.localeCompare(right.title)
        case 'title':
        default:
          return left.title.localeCompare(right.title)
      }
    })
  filteredGamesCacheKey = key

  return filteredGamesCache
}

function resetVisibleGameCount() {
  state.visibleGameCount = getInitialVisibleGameCount()
}

function getOwnedGames() {
  refreshCollectionStats()
  return state.cachedOwnedGames
}

function getWantedGames() {
  refreshCollectionStats()
  return state.cachedWantedGames
}

function getLibraryStatsKey() {
  return `${catalogCacheKey}:${libraryRevision}`
}

function getDashboardSummary(catalog: CatalogEntry[]) {
  const key = `${getLibraryStatsKey()}:${state.regionFilter}`

  if (dashboardSummaryCache && dashboardSummaryCacheKey === key) {
    return dashboardSummaryCache
  }

  const ownedGames = getOwnedGames()
  const wantedGames = getWantedGames()
  const ownedTrackedValue = ownedGames.reduce((total, game) => total + getOwnedMarketPrice(game), 0)
  const ownedCompleteValue = ownedGames.reduce((total, game) => total + getReferencePrice(game), 0)
  const completionPercentage = catalog.length === 0 ? 0 : Math.round((ownedGames.length / catalog.length) * 100)
  const wishlistValue = wantedGames.reduce((total, game) => total + getReferencePrice(game), 0)

  dashboardSummaryCache = {
    ownedGames,
    wantedGames,
    ownedTrackedValue,
    ownedCompleteValue,
    completionPercentage,
    wishlistValue,
    collectionDelta: getCollectionDelta(),
    prestigeScore: getPrestigeScore(),
    spotlight: getSpotlightGame(),
    alertMatches: getAlertMatches(),
    nearCompleteConsoles: getNearCompleteConsoles(),
    collectorRank: getCollectorRank(),
  }
  dashboardSummaryCacheKey = key

  return dashboardSummaryCache
}

function refreshCollectionStats() {
  getCatalog()
  const key = getLibraryStatsKey()

  if (state.cachedCatalogStatsKey === key) {
    return
  }

  const ownedGames: CatalogEntry[] = []
  const wantedGames: CatalogEntry[] = []

  for (const game of getCatalog()) {
    const status = getRecord(game.id).status

    if (status === 'owned') {
      ownedGames.push(game)
    } else if (status === 'wanted') {
      wantedGames.push(game)
    }
  }

  state.cachedOwnedGames = ownedGames
  state.cachedWantedGames = wantedGames
  state.cachedCatalogStatsKey = key
}

function getMissingGrails() {
  return getCatalog()
    .filter((game) => game.rarity === 'Grail' && getRecord(game.id).status !== 'owned')
    .sort((left, right) => getReferencePrice(right) - getReferencePrice(left))
    .slice(0, 4)
}

function getMarketMovers() {
  return [...getCatalog()].sort((left, right) => right.trendDelta - left.trendDelta).slice(0, 4)
}

function getDailySeed() {
  return Math.floor(new Date().getTime() / 86_400_000)
}

function pickDailyGame(games: CatalogEntry[], offset = 0) {
  if (!games.length) {
    return null
  }

  return games[(getDailySeed() + offset) % games.length]
}

function getTodayHuntItems(): DailyHuntItem[] {
  const missingGrail = pickDailyGame(getMissingGrails(), 1)
  const marketMover = pickDailyGame(getMarketMovers(), 2)
  const alertMatch = pickDailyGame(getAlertMatches(), 3)
  const nearComplete = getNearCompleteConsoles()[0]
  const wantedGame = pickDailyGame(getWantedGames(), 4)
  const ownedGames = getOwnedGames()
  const items: DailyHuntItem[] = []

  if (missingGrail) {
    items.push({
      label: 'Today\'s grail',
      title: missingGrail.title,
      detail: `${missingGrail.console} ${missingGrail.year ?? 'release year unknown'} is still missing from your vault.`,
      meta: `Reference value ${formatPrice(getReferencePrice(missingGrail))}`,
      actionLabel: 'Open details',
      action: 'open-details',
      game: missingGrail,
      tone: 'gold',
    })
  }

  if (marketMover) {
    items.push({
      label: 'Market heat',
      title: marketMover.title,
      detail: 'One of the hottest movers in your tracked market right now.',
      meta: `${formatDelta(marketMover.trendDelta)} trend / Loose ${formatPrice(marketMover.priceLoose)}`,
      actionLabel: 'Inspect mover',
      action: 'open-details',
      game: marketMover,
      tone: 'crimson',
    })
  }

  if (nearComplete) {
    const remaining = nearComplete.total - nearComplete.owned
    items.push({
      label: 'Milestone push',
      title: nearComplete.consoleName,
      detail: `You are ${remaining.toLocaleString()} game${remaining === 1 ? '' : 's'} away from completing this library.`,
      meta: `${nearComplete.owned}/${nearComplete.total} owned / ${nearComplete.progress}% complete`,
      actionLabel: 'View console',
      action: 'daily-console',
      consoleName: nearComplete.consoleName,
      tone: 'teal',
    })
  } else {
    items.push({
      label: 'Milestone push',
      title: ownedGames.length ? 'Pick your next console' : 'Start your shelf',
      detail: ownedGames.length
        ? 'Choose a system to chase next and your completion milestones will start surfacing here.'
        : 'Mark your first owned game to unlock completion goals and collector rank progress.',
      meta: ownedGames.length ? `${ownedGames.length} owned so far` : 'First pickup unlocks the hunt loop',
      actionLabel: 'Browse library',
      action: 'browse-library',
      tone: 'teal',
    })
  }

  if (alertMatch) {
    const target = getRecord(alertMatch.id).targetPrice
    items.push({
      label: 'Deal watch',
      title: alertMatch.title,
      detail: 'This wanted game is currently at or below your target price.',
      meta: `Loose ${formatPrice(alertMatch.priceLoose)}${target === null ? '' : ` / Target ${formatPrice(target)}`}`,
      actionLabel: 'Check deal',
      action: 'open-details',
      game: alertMatch,
      tone: 'blue',
    })
  } else if (wantedGame) {
    items.push({
      label: 'Deal watch',
      title: wantedGame.title,
      detail: 'Set a target price on this wanted game so the vault can surface deal hits.',
      meta: `Wanted grail value ${formatPrice(getReferencePrice(wantedGame))}`,
      actionLabel: 'Set target',
      action: 'set-target-price',
      game: wantedGame,
      tone: 'blue',
    })
  } else {
    items.push({
      label: 'Deal watch',
      title: 'Add a wanted game',
      detail: 'Build a hunt list and set target prices to catch future bargains.',
      meta: 'Wishlist alerts unlock once wanted games have targets',
      actionLabel: 'Find grails',
      action: 'browse-library',
      tone: 'blue',
    })
  }

  items.push({
    label: 'Share spark',
    title: 'Collector challenge',
    detail: 'Share your vault progress and invite another retro nerd to compare collector rank.',
    meta: `${ownedGames.length} owned / ${getWantedGames().length} wanted / ${getCollectorRank().title}`,
    actionLabel: 'Share challenge',
    action: 'share-challenge',
    tone: 'gold',
  })

  return items.slice(0, 5)
}

function getWeeklyRecapLines() {
  const ownedGames = getOwnedGames()
  const wantedGames = getWantedGames()
  const weeklyEvents = getWeeklyActivityEvents()
  const addedOwned = countWeeklyEvents(weeklyEvents, 'owned_added')
  const addedWanted = countWeeklyEvents(weeklyEvents, 'wanted_added')
  const cibUpgrades = countWeeklyEvents(weeklyEvents, 'cib_upgraded')
  const paidPrices = countWeeklyEvents(weeklyEvents, 'paid_price_added')
  const newFavorites = countWeeklyEvents(weeklyEvents, 'favorite_added')
  const completeCount = ownedGames.filter((game) => isCompleteEdition(getRecord(game.id))).length
  const favoriteCount = getFavoriteCount()
  const alertMatches = getAlertMatches()
  const rarestOwned = getRarestOwnedGame()
  const dominantConsole = getDominantConsole()
  const estimatedSellValue = ownedGames.reduce((total, game) => total + getOwnedMarketPrice(game), 0)
  const rank = getCollectorRank()

  return [
    `Weekly vault recap from ${state.visitStreak.weekStartDate}`,
    `Collector rank: ${rank.title}`,
    `Daily streak: ${state.visitStreak.current} day${state.visitStreak.current === 1 ? '' : 's'} / best ${state.visitStreak.best}`,
    `Added this week: ${addedOwned} owned / ${addedWanted} wanted`,
    `CIB upgrades this week: ${cibUpgrades}`,
    `Paid prices entered this week: ${paidPrices}`,
    `Top shelf picks this week: ${newFavorites}`,
    `Owned: ${ownedGames.length}`,
    `Wishlist: ${wantedGames.length}`,
    `Complete/CIB tracked: ${completeCount}`,
    `Favorites: ${favoriteCount}`,
    `Estimated sell value: ${formatPrice(estimatedSellValue)}`,
    dominantConsole ? `Strongest console: ${dominantConsole.consoleName} (${dominantConsole.owned} owned)` : 'Strongest console: still forming',
    rarestOwned ? `Rarest owned: ${rarestOwned.title} (${formatPrice(getOwnedMarketPrice(rarestOwned))})` : 'Rarest owned: still building',
    `Price alert hits: ${alertMatches.length}`,
  ]
}

function getWeeklyRecapHighlights() {
  const lines = getWeeklyRecapLines()
  return {
    streak: lines[2],
    added: lines[3],
    owned: lines[7],
    value: lines[11],
    strongest: lines[12],
    rarest: lines[13],
    alerts: lines[14],
  }
}

function getWeeklyActivityEvents() {
  const weekStart = new Date(`${state.visitStreak.weekStartDate}T00:00:00`)
  return state.activityEvents.filter((event) => new Date(event.createdAt).getTime() >= weekStart.getTime())
}

function countWeeklyEvents(events: ActivityEvent[], type: ActivityType) {
  return events.filter((event) => event.type === type).length
}

function createBadge(
  id: string,
  title: string,
  detail: string,
  hint: string,
  icon: string,
  progress: number,
  target: number,
  tone: CollectorBadge['tone'],
): CollectorBadge {
  const safeProgress = Math.max(0, Math.min(progress, target))

  return {
    id,
    title,
    detail,
    hint,
    icon,
    progress: safeProgress,
    target,
    unlocked: safeProgress >= target,
    tone,
  }
}

function getCollectorBadges(): CollectorBadge[] {
  const ownedGames = getOwnedGames()
  const wantedGames = getWantedGames()
  const grailsOwned = ownedGames.filter((game) => game.rarity === 'Grail').length
  const cibCount = ownedGames.filter((game) => isCompleteEdition(getRecord(game.id))).length
  const paidPriceCount = getPaidPriceCount()
  const favoriteCount = getFavoriteCount()
  const alertCount = getAlertMatches().length
  const dominantConsole = getDominantConsole()
  const completionProgress = dominantConsole?.progress ?? 0
  const positiveDelta = getCollectionDelta() > 0 ? 1 : 0

  return [
    createBadge('first-pickup', 'First Pickup', 'Your first game is officially on the shelf.', 'Mark any game as owned.', 'I', ownedGames.length, 1, 'gold'),
    createBadge('ten-owned', '10 Owned', 'The shelf is starting to look real.', 'Own 10 games.', '10', ownedGames.length, 10, 'teal'),
    createBadge('fifty-owned', '50 Owned', 'A proper collector library is forming.', 'Own 50 games.', '50', ownedGames.length, 50, 'teal'),
    createBadge('hundred-owned', '100 Owned', 'A serious vault with real depth.', 'Own 100 games.', '100', ownedGames.length, 100, 'gold'),
    createBadge('first-grail', 'First Grail', 'You secured a true standout piece.', 'Own one Grail rarity game.', 'G', grailsOwned, 1, 'crimson'),
    createBadge('grail-keeper', 'Grail Keeper', 'Multiple grails now live in your vault.', 'Own 5 Grail rarity games.', 'GK', grailsOwned, 5, 'crimson'),
    createBadge('cib-collector', 'CIB Collector', 'Condition tracking is becoming part of your collector identity.', 'Track 10 complete, sealed, or graded games.', 'CIB', cibCount, 10, 'gold'),
    createBadge('wishlist-hunter', 'Wishlist Hunter', 'Your hunt list has real targets.', 'Add 10 wanted games.', 'W', wantedGames.length, 10, 'blue'),
    createBadge('value-tracker', 'Value Tracker', 'You are tracking paid prices like a market-minded collector.', 'Add paid prices to 10 owned games.', '$', paidPriceCount, 10, 'teal'),
    createBadge('bargain-finder', 'Bargain Finder', 'Your tracked paid prices show market edge.', 'Enter paid prices until your market edge turns positive.', 'B', positiveDelta, 1, 'blue'),
    createBadge('top-shelf-built', 'Top Shelf Built', 'Your favorites row has personality.', 'Favorite 5 standout games.', 'TS', favoriteCount, 5, 'gold'),
    createBadge('deal-watcher', 'Deal Watcher', 'Your wishlist is watching for price hits.', 'Create at least one target price alert hit.', 'DW', alertCount, 1, 'blue'),
    createBadge('console-specialist', 'Console Specialist', `${dominantConsole?.consoleName ?? 'One console'} is becoming your signature shelf.`, 'Reach 25% completion on any console.', '25', completionProgress, 25, 'teal'),
    createBadge('daily-seven', '7-Day Streak', 'You kept the collector rhythm alive for a full week.', 'Open the vault 7 days in a row.', '7', state.visitStreak.current, 7, 'crimson'),
    createBadge('daily-thirty', '30-Day Streak', 'A month-long vault habit. Serious collector energy.', 'Open the vault 30 days in a row.', '30', state.visitStreak.current, 30, 'gold'),
  ]
}

function getUnlockedBadges() {
  return getCollectorBadges().filter((badge) => badge.unlocked)
}

function getNextBadges() {
  return getCollectorBadges()
    .filter((badge) => !badge.unlocked)
    .sort((left, right) => right.progress / right.target - left.progress / left.target)
    .slice(0, 4)
}

function getBadgePercent(badge: CollectorBadge) {
  return Math.min(100, Math.round((badge.progress / badge.target) * 100))
}

function getTopShelfGames() {
  return getCatalog()
    .filter((game) => getRecord(game.id).favorite || getRecord(game.id).status === 'owned')
    .sort((left, right) => getShelfScore(right) - getShelfScore(left) || left.title.localeCompare(right.title))
    .slice(0, 4)
}

function getAlertMatches() {
  return getWantedGames()
    .filter((game) => {
      const target = getRecord(game.id).targetPrice
      return target !== null && game.priceLoose <= target
    })
    .sort((left, right) => left.priceLoose - right.priceLoose || left.title.localeCompare(right.title))
    .slice(0, 4)
}

function getPaidPriceCount() {
  return getOwnedGames().filter((game) => getRecord(game.id).pricePaid !== null).length
}

function getFavoriteCount() {
  return getCatalog().filter((game) => getRecord(game.id).favorite).length
}

function getCollectionCompletenessScore() {
  const checks = [
    state.authToken !== '',
    getOwnedGames().length > 0,
    getWantedGames().length > 0,
    getPaidPriceCount() > 0,
    getFavoriteCount() > 0,
  ]

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function getOnboardingSteps(): OnboardingStep[] {
  return [
    {
      label: 'Create your vault account',
      detail: 'Protect the collection so it follows you across devices.',
      done: state.authToken !== '',
      action: state.authToken ? 'open-account-settings' : 'open-register',
      actionLabel: state.authToken ? 'Account' : 'Create account',
    },
    {
      label: 'Mark your first owned game',
      detail: 'Unlock shelf value, completion progress, and collector rank.',
      done: getOwnedGames().length > 0,
      action: 'browse-library',
      actionLabel: 'Browse games',
    },
    {
      label: 'Add a wanted grail',
      detail: 'Build a hunt list and let price alerts start working for you.',
      done: getWantedGames().length > 0,
      action: 'browse-library',
      actionLabel: 'Find grails',
    },
    {
      label: 'Set one paid price',
      detail: 'Track your market edge and see which pickups were bargains.',
      done: getPaidPriceCount() > 0,
      action: 'browse-library',
      actionLabel: 'Set paid',
    },
    {
      label: 'Favorite a top-shelf title',
      detail: 'Build the brag row that makes your profile feel personal.',
      done: getFavoriteCount() > 0,
      action: 'browse-library',
      actionLabel: 'Choose favorite',
    },
  ]
}

function getNearCompleteConsoles() {
  return getConsoleProgress()
    .filter((entry) => entry.owned > 0 && entry.owned < entry.total)
    .sort((left, right) => (left.total - left.owned) - (right.total - right.owned) || right.progress - left.progress)
    .slice(0, 4)
}

function getCollectionDelta() {
  return getOwnedGames().reduce((total, game) => {
    const pricePaid = getRecord(game.id).pricePaid
    return total + (pricePaid === null ? 0 : getOwnedMarketPrice(game) - pricePaid)
  }, 0)
}

function getPrestigeScore() {
  return getOwnedGames().reduce((total, game) => total + getShelfScore(game), 0)
}

function getRarestOwnedGame() {
  return [...getOwnedGames()].sort((left, right) => getOwnedMarketPrice(right) - getOwnedMarketPrice(left))[0] ?? null
}

function getDominantConsole() {
  return getConsoleProgress()
    .filter((entry) => entry.owned > 0)
    .sort((left, right) => right.owned - left.owned || right.progress - left.progress)[0] ?? null
}

function getCollectionEraLabel() {
  const years = getOwnedGames().map((game) => game.year).filter((year): year is number => typeof year === 'number')

  if (!years.length) {
    return 'Era still forming'
  }

  const averageYear = years.reduce((total, year) => total + year, 0) / years.length

  if (averageYear < 1990) {
    return 'Arcade-age hunter'
  }

  if (averageYear < 1995) {
    return '16-bit loyalist'
  }

  if (averageYear < 2000) {
    return 'Late-90s curator'
  }

  return 'Millennium finisher'
}

function getCollectorRank() {
  const ownedGames = getOwnedGames()
  const prestigeScore = getPrestigeScore()
  const grailsOwned = ownedGames.filter((game) => game.rarity === 'Grail').length

  if (prestigeScore >= 9000 || grailsOwned >= 25 || ownedGames.length >= 500) {
    return {
      title: 'Legendary curator',
      detail: 'A collection with serious depth, prestige, and bragging rights.',
    }
  }

  if (prestigeScore >= 3500 || grailsOwned >= 10 || ownedGames.length >= 180) {
    return {
      title: 'Top-shelf collector',
      detail: 'A polished shelf with real heat, standout grails, and a clear point of view.',
    }
  }

  if (prestigeScore >= 1200 || grailsOwned >= 4 || ownedGames.length >= 60) {
    return {
      title: 'Serious game hunter',
      detail: 'The collection is taking shape and starting to feel intentional.',
    }
  }

  return {
    title: 'Rising retro scout',
    detail: 'A focused starter shelf with clear priorities and room for the next great pickup.',
  }
}

function getCollectionMood() {
  const ownedGames = getOwnedGames()
  const favorites = ownedGames.filter((game) => getRecord(game.id).favorite).length
  const wantedGrails = getWantedGames().filter((game) => game.rarity === 'Grail').length
  const cibTracked = ownedGames.filter((game) => getRecord(game.id).completeInBox).length

  if (favorites >= 8) {
    return 'Built like a showcase shelf'
  }

  if (cibTracked >= 10) {
    return 'Precision-built collector setup'
  }

  if (wantedGrails >= 5) {
    return 'Always hunting the next grail'
  }

  return 'Clean, focused collector energy'
}

function getCollectorAchievements(): CollectorAchievement[] {
  const ownedGames = getOwnedGames()
  const wantedGames = getWantedGames()
  const grailsOwned = ownedGames.filter((game) => game.rarity === 'Grail').length
  const cibTracked = ownedGames.filter((game) => getRecord(game.id).completeInBox).length
  const noteCount = ownedGames.filter((game) => getRecord(game.id).notes.trim()).length
  const alertCount = getAlertMatches().length
  const dominantConsole = getDominantConsole()
  const achievements: CollectorAchievement[] = []

  if (grailsOwned > 0) {
    achievements.push({
      title: 'Grail keeper',
      detail: `${grailsOwned} grail${grailsOwned === 1 ? '' : 's'} already secured in the collection.`,
      tone: 'gold',
    })
  }

  if (dominantConsole && dominantConsole.owned >= 10) {
    achievements.push({
      title: 'Console specialist',
      detail: `${dominantConsole.consoleName} is your strongest shelf with ${dominantConsole.owned} owned.`,
      tone: 'teal',
    })
  }

  if (cibTracked >= 5) {
    achievements.push({
      title: 'Condition minded',
      detail: `${cibTracked} titles already tracked as complete in box.`,
      tone: 'teal',
    })
  }

  if (noteCount >= 5 || wantedGames.length >= 20) {
    achievements.push({
      title: 'Collector brain',
      detail: noteCount >= 5 ? `${noteCount} games include collector notes.` : `${wantedGames.length} games are lined up on the hunt list.`,
      tone: 'crimson',
    })
  }

  if (alertCount > 0) {
    achievements.push({
      title: 'Deal watcher',
      detail: `${alertCount} wishlist alert${alertCount === 1 ? '' : 's'} are already live.`,
      tone: 'gold',
    })
  }

  return achievements.slice(0, 4)
}

function getViralShareLines() {
  const rank = getCollectorRank()
  const dominantConsole = getDominantConsole()
  const rarestOwned = getRarestOwnedGame()
  const topShelf = getTopShelfGames()

  return [
    `Collector rank: ${rank.title}`,
    dominantConsole ? `Strongest shelf: ${dominantConsole.consoleName} (${dominantConsole.owned} owned)` : 'Strongest shelf: still taking shape',
    rarestOwned ? `Rarest flex: ${rarestOwned.title} at ${formatPrice(getReferencePrice(rarestOwned))}` : 'Rarest flex: still loading',
    `Shelf mood: ${getCollectionMood()}`,
    `Top shelf picks: ${topShelf.map((game) => game.title).slice(0, 3).join(', ') || 'None yet'}`,
  ]
}

function getConsoleProgress() {
  getCatalog()
  const key = `${getLibraryStatsKey()}:${state.regionFilter}`

  if (state.cachedConsoleProgressKey === key) {
    return state.cachedConsoleProgress
  }

  const progressByConsole = new Map<string, ConsoleProgress>()

  for (const entry of state.catalogMeta) {
    if (state.regionFilter !== 'All regions' && entry.region !== state.regionFilter) {
      continue
    }

    progressByConsole.set(entry.console, {
      consoleName: entry.console,
      total: entry.count,
      owned: 0,
      progress: 0,
    })
  }

  for (const game of getCatalog()) {
    if (state.regionFilter !== 'All regions' && game.region !== state.regionFilter) {
      continue
    }

    const hasMetaTotal = progressByConsole.has(game.console)
    const existing = progressByConsole.get(game.console) ?? {
      consoleName: game.console,
      total: 0,
      owned: 0,
      progress: 0,
    }

    existing.total = hasMetaTotal && state.catalogMeta.length ? existing.total : existing.total + 1
    existing.owned += getRecord(game.id).status === 'owned' ? 1 : 0
    progressByConsole.set(game.console, existing)
  }

  state.cachedConsoleProgress = [...progressByConsole.values()]
    .map((entry) => ({
      ...entry,
      progress: entry.total ? Math.round((entry.owned / entry.total) * 100) : 0,
    }))
    .sort((left, right) => right.progress - left.progress || left.consoleName.localeCompare(right.consoleName))
  state.cachedConsoleProgressKey = key

  return state.cachedConsoleProgress
}

function getSpotlightGame(): Spotlight | null {
  const wantedGrail = getWantedGames()
    .filter((game) => game.rarity === 'Grail')
    .sort((left, right) => getReferencePrice(right) - getReferencePrice(left))[0]

  if (wantedGrail) {
    return {
      game: wantedGrail,
      label: 'Dream hunt',
      copy: 'A grail on your wanted list. This is the kind of target collectors build alerts, wishlists, and road trips around.',
    }
  }

  const topOwned = getOwnedGames().sort((left, right) => getShelfScore(right) - getShelfScore(left))[0]

  if (topOwned) {
    return {
      game: topOwned,
      label: 'Top shelf piece',
      copy: 'One of your standout collection pieces based on rarity, ownership, market heat, and shelf prestige.',
    }
  }

  const mover = getMarketMovers()[0]

  if (!mover) {
    return null
  }

  return {
    game: mover,
    label: 'Market mover',
    copy: 'A fast-rising title that helps the app feel alive and gives collectors a reason to check in often.',
  }
}

function convertUsdAmount(value: number) {
  const usdPerEuro = currencyOptions[0].perEuro
  const selectedCurrency = getSelectedCurrency()
  return (value / usdPerEuro) * selectedCurrency.perEuro
}

function formatPrice(value: number) {
  const selectedCurrency = getSelectedCurrency()

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: selectedCurrency.code,
    maximumFractionDigits: 2,
  }).format(convertUsdAmount(value))
}

function formatDelta(value: number) {
  const amount = Math.abs(value).toFixed(1)
  return `${value >= 0 ? '+' : '-'}${amount}%`
}

function getCoverFallbackDataUri(game: CatalogEntry) {
  const title = escapeHtml(game.title.trim()).slice(0, 80)
  const consoleName = escapeHtml(game.console.trim()).slice(0, 48)
  const region = escapeHtml(game.region.trim()).slice(0, 48)
  const fallbackLabel = game.id.startsWith('custom-') ? 'CUSTOM ENTRY' : 'RETRO VAULT'
  const sourceLabel = ''
  const titleLine = title ? `<text x="72" y="420" fill="#f4f8ff" font-family="Arial, sans-serif" font-size="48" font-weight="900">${title}</text>` : ''
  const consoleLine = consoleName ? `<text x="72" y="496" fill="#a8b8ca" font-family="Arial, sans-serif" font-size="30">${consoleName}</text>` : ''
  const regionLine = region ? `<text x="72" y="542" fill="#a8b8ca" font-family="Arial, sans-serif" font-size="26">${region}</text>` : ''
  const sourceLine = sourceLabel ? `<text x="72" y="760" fill="#58d8aa" font-family="Arial, sans-serif" font-size="24" font-weight="700">${sourceLabel}</text>` : ''
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#1f2d42"/>
          <stop offset="0.55" stop-color="#0b1520"/>
          <stop offset="1" stop-color="#261400"/>
        </linearGradient>
        <radialGradient id="glow" cx="35%" cy="18%" r="60%">
          <stop offset="0" stop-color="#ffd66e" stop-opacity="0.35"/>
          <stop offset="1" stop-color="#ffd66e" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="720" height="900" rx="44" fill="url(#bg)"/>
      <rect width="720" height="900" rx="44" fill="url(#glow)"/>
      <rect x="52" y="52" width="616" height="796" rx="34" fill="none" stroke="#ffd66e" stroke-opacity="0.45" stroke-width="4"/>
      <text x="72" y="116" fill="#ffd66e" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="7">${fallbackLabel}</text>
      ${titleLine}
      ${consoleLine}
      ${regionLine}
      ${sourceLine}
    </svg>
  `.trim()

  return `${COVER_FALLBACK_PREFIX}${encodeURIComponent(svg)}`
}

function getCardCoverUrl(game: CatalogEntry) {
  return game.coverUrl || getCoverFallbackDataUri(game)
}

function getDetailCoverUrl(game: CatalogEntry) {
  return game.coverUrl ? game.coverUrl.replace('/240.jpg', '/1600.jpg') : getCoverFallbackDataUri(game)
}

function getBackdropGames(visibleGames: CatalogEntry[], catalog: CatalogEntry[]) {
  const picks: CatalogEntry[] = []
  const seen = new Set<string>()
  const sources = [visibleGames.filter((game) => Boolean(game.coverUrl)), catalog.filter((game) => Boolean(game.coverUrl)), visibleGames, catalog]

  for (const source of sources) {
    for (const game of source) {
      const key = `${game.coverUrl || ''}|${game.title}|${game.console}|${game.region}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      picks.push(game)
      if (picks.length >= 10) {
        return picks
      }
    }
  }

  return picks
}

function renderBackdropWall(visibleGames: CatalogEntry[], catalog: CatalogEntry[]) {
  const games = getBackdropGames(visibleGames, catalog)

  if (games.length === 0) {
    return ''
  }

  return `
    <div class="collection-backdrop" aria-hidden="true">
      <div class="collection-backdrop__wall">
        ${games
          .map(
            (game, index) => `
              <figure class="collection-backdrop__tile collection-backdrop__tile--${index % 6}">
                <img src="${escapeHtml(getCardCoverUrl(game))}" alt="" decoding="async" fetchpriority="low" />
              </figure>`,
          )
          .join('')}
      </div>
    </div>
  `
}

function getCoverFallbackAttributes(game: CatalogEntry) {
  if (!game.coverUrl) {
    return `data-fallback-src="${getCoverFallbackDataUri(game)}"`
  }

  return [
    `data-fallback-title="${escapeHtml(game.title)}"`,
    `data-fallback-console="${escapeHtml(game.console)}"`,
    `data-fallback-region="${escapeHtml(game.region)}"`,
    `data-fallback-custom="${game.id.startsWith('custom-') ? 'true' : 'false'}"`,
  ].join(' ')
}

function getCoverSourceLabel(game: CatalogEntry) {
  if (!game.coverUrl) {
    return 'Collector cover tile shown until a linked cover image is available.'
  }

  return 'Cover displayed from the linked source for identification. Artwork rights remain with their owners.'
}

function getOwnershipLabel(status: GameStatus) {
  if (status === 'owned') {
    return 'Owned'
  }

  if (status === 'wanted') {
    return 'Wanted'
  }

  return 'Not owned'
}

function getOwnershipTone(status: GameStatus) {
  if (status === 'owned') {
    return 'ownership-pill--owned'
  }

  if (status === 'wanted') {
    return 'ownership-pill--wanted'
  }

  return 'ownership-pill--missing'
}

function getEditionLabel(editionStatus: EditionStatus) {
  switch (editionStatus) {
    case 'boxed':
      return 'Boxed'
    case 'manual':
      return 'Manual'
    case 'cib':
      return 'CIB'
    case 'sealed':
      return 'Sealed'
    case 'graded':
      return 'Graded'
    case 'loose':
    default:
      return 'Loose'
  }
}

function getOwnedEditionSummary(record: GameRecord) {
  if (record.status !== 'owned') {
    return getEditionLabel(record.editionStatus)
  }

  const copyText = getOwnedCopyCount(record) > 1 ? ` x${getOwnedCopyCount(record)}` : ''

  if (isCompleteEdition(record)) {
    return `${getEditionLabel(record.editionStatus)} owned${copyText}`
  }

  return `Loose owned${copyText}`
}

function getConditionLabel(condition: ConditionRating) {
  return condition.charAt(0).toUpperCase() + condition.slice(1)
}

function getSyncPayload() {
  return {
    library: state.library,
    customCatalog: state.customCatalog,
    currencyCode: state.currencyCode,
    barcodeMappings: state.barcodeMappings,
    activityEvents: state.activityEvents,
    clientUpdatedAt: new Date().toISOString(),
    version: 2,
    profile: {
      displayName: state.accountDisplayName,
      shelfTagline: getCollectionMood(),
    },
  }
}

function normalizeGameRecord(value: unknown): GameRecord {
  if (!value || typeof value !== 'object') {
    return defaultRecord()
  }

  const record = value as Partial<GameRecord>

  return {
    status: record.status === 'owned' || record.status === 'wanted' || record.status === 'missing' ? record.status : 'missing',
    completeInBox: typeof record.completeInBox === 'boolean' ? record.completeInBox : false,
    pricePaid: typeof record.pricePaid === 'number' ? record.pricePaid : null,
    favorite: typeof record.favorite === 'boolean' ? record.favorite : false,
    ownedCopies: typeof record.ownedCopies === 'number' && record.ownedCopies >= 1 ? Math.min(Math.round(record.ownedCopies), 99) : 1,
    editionStatus: isEditionStatus(record.editionStatus) ? record.editionStatus : 'loose',
    condition: isConditionRating(record.condition) ? record.condition : 'good',
    targetPrice: typeof record.targetPrice === 'number' ? record.targetPrice : null,
    notes: typeof record.notes === 'string' ? record.notes : '',
  }
}

function hasMeaningfulRecord(record: GameRecord) {
  const safeRecord = normalizeGameRecord(record)

  return (
    safeRecord.status !== 'missing' ||
    safeRecord.completeInBox ||
    safeRecord.favorite ||
    safeRecord.ownedCopies !== 1 ||
    safeRecord.editionStatus !== 'loose' ||
    safeRecord.condition !== 'good' ||
    safeRecord.pricePaid !== null ||
    safeRecord.targetPrice !== null ||
    safeRecord.notes.trim() !== ''
  )
}

function hasLocalCollectionData() {
  return (
    Object.values(state.library).some(hasMeaningfulRecord) ||
    state.customCatalog.length > 0 ||
    Object.keys(state.barcodeMappings).length > 0 ||
    state.activityEvents.length > 0
  )
}

function mergeGameRecord(localRecord: GameRecord | undefined, remoteRecord: GameRecord) {
  const safeRemoteRecord = normalizeGameRecord(remoteRecord)

  if (!localRecord) {
    return safeRemoteRecord
  }

  const safeLocalRecord = normalizeGameRecord(localRecord)

  return {
    status: safeLocalRecord.status !== 'missing' ? safeLocalRecord.status : safeRemoteRecord.status,
    completeInBox: safeLocalRecord.completeInBox || safeRemoteRecord.completeInBox,
    pricePaid: safeLocalRecord.pricePaid ?? safeRemoteRecord.pricePaid,
    favorite: safeLocalRecord.favorite || safeRemoteRecord.favorite,
    ownedCopies: Math.max(getOwnedCopyCount(safeLocalRecord), getOwnedCopyCount(safeRemoteRecord)),
    editionStatus: safeLocalRecord.editionStatus !== 'loose' ? safeLocalRecord.editionStatus : safeRemoteRecord.editionStatus,
    condition: safeLocalRecord.condition !== 'good' ? safeLocalRecord.condition : safeRemoteRecord.condition,
    targetPrice: safeLocalRecord.targetPrice ?? safeRemoteRecord.targetPrice,
    notes: safeLocalRecord.notes.trim() ? safeLocalRecord.notes : safeRemoteRecord.notes,
  } satisfies GameRecord
}

function mergeLibraryData(remoteLibrary: Record<string, GameRecord>) {
  const merged = { ...remoteLibrary }

  for (const [id, localRecord] of Object.entries(state.library)) {
    if (!hasMeaningfulRecord(localRecord)) {
      continue
    }

    merged[id] = mergeGameRecord(localRecord, merged[id])
  }

  return merged
}

function mergeCustomCatalogData(remoteCatalog: CatalogEntry[]) {
  return dedupeCatalog([...remoteCatalog, ...state.customCatalog])
}

function mergeBarcodeMappingsData(remoteMappings: Record<string, string>) {
  return {
    ...remoteMappings,
    ...state.barcodeMappings,
  }
}

function applyRemoteSyncState(syncState: {
  library: Record<string, unknown>
  customCatalog: unknown[]
  currencyCode: string
  barcodeMappings: Record<string, string>
  activityEvents?: unknown[]
  profile?: {
    displayName?: string
    shelfTagline?: string
  }
}, options: { mergeWithLocal?: boolean } = {}) {
  const parsedLibrary = syncState.library && typeof syncState.library === 'object' ? syncState.library : {}
  const remoteLibrary = Object.fromEntries(
    Object.entries(parsedLibrary).flatMap(([id, value]) => {
      if (!value || typeof value !== 'object') {
        return []
      }

      const entry = value as Record<string, unknown>
      const status = entry.status

      if (status !== 'missing' && status !== 'wanted' && status !== 'owned') {
        return []
      }

      return [[
        id,
        normalizeGameRecord(entry),
      ]]
    }),
  )

  const remoteCustomCatalog = Array.isArray(syncState.customCatalog)
    ? syncState.customCatalog.map(normalizeCatalogEntry).filter(isCatalogEntry)
    : []

  const remoteBarcodeMappings = syncState.barcodeMappings && typeof syncState.barcodeMappings === 'object'
    ? Object.fromEntries(
        Object.entries(syncState.barcodeMappings).flatMap(([code, gameId]) =>
          typeof code === 'string' && typeof gameId === 'string' ? [[code, gameId]] : [],
        ),
      )
    : {}

  const remoteActivityEvents = Array.isArray(syncState.activityEvents)
    ? syncState.activityEvents.map(normalizeActivityEvent).filter((event): event is ActivityEvent => event !== null)
    : []

  const shouldMerge = options.mergeWithLocal && hasLocalCollectionData()

  state.library = shouldMerge ? mergeLibraryData(remoteLibrary) : remoteLibrary
  state.customCatalog = shouldMerge ? mergeCustomCatalogData(remoteCustomCatalog) : remoteCustomCatalog
  state.activityEvents = shouldMerge ? mergeActivityEvents(remoteActivityEvents) : remoteActivityEvents.slice(0, MAX_ACTIVITY_EVENTS)

  if (typeof syncState.currencyCode === 'string' && currencyOptions.some((currency) => currency.code === syncState.currencyCode)) {
    state.currencyCode = options.mergeWithLocal && state.currencyCode ? state.currencyCode : syncState.currencyCode
  }

  state.barcodeMappings = shouldMerge ? mergeBarcodeMappingsData(remoteBarcodeMappings) : remoteBarcodeMappings

  state.accountDisplayName = typeof syncState.profile?.displayName === 'string' ? syncState.profile.displayName : state.accountDisplayName
  libraryRevision += 1
  invalidateCatalogCache()

  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library))
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(state.customCatalog))
  localStorage.setItem(CURRENCY_STORAGE_KEY, state.currencyCode)
  localStorage.setItem(BARCODE_STORAGE_KEY, JSON.stringify(state.barcodeMappings))
  saveActivityEvents()
}

function scheduleCloudSync() {
  if (!state.authToken) {
    state.syncStatus = 'Saved on this device'
    return
  }

  state.syncStatus = 'Sync pending'

  if (syncTimeout !== null) {
    window.clearTimeout(syncTimeout)
  }

  syncTimeout = window.setTimeout(() => {
    void syncToCloud()
  }, 600)
}

async function syncToCloud() {
  if (!state.authToken) {
    state.syncStatus = 'Sign in to sync your collection'
    state.authView = 'login'
    render()
    return
  }

  state.syncStatus = 'Syncing...'
  scheduleStatusRender()

  try {
    await pushSyncState(state.authToken, getSyncPayload())
    state.syncStatus = 'Cloud synced'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'

    if (message.toLowerCase().includes('not signed in')) {
      clearExpiredAccountSession()
    } else {
      state.syncStatus = `Sync failed: ${message}`
    }
  }

  scheduleStatusRender()
}

function scheduleStatusRender() {
  if (pendingSyncStatusRender) {
    window.clearTimeout(pendingSyncStatusRender)
  }

  pendingSyncStatusRender = window.setTimeout(() => {
    pendingSyncStatusRender = 0
    render()
  }, 180)
}

async function hydrateAccount() {
  if (!state.authToken) {
    return
  }

  state.syncStatus = 'Checking account...'

  try {
    const payload = await getCurrentAccount(state.authToken)
    saveAuthProfile(payload.user.email, payload.user.displayName ?? '')
    applyRemoteSyncState(payload.syncState)
    state.syncStatus = 'Your collection is synced to your account'
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (message.toLowerCase().includes('not signed in')) {
      clearExpiredAccountSession()
    } else {
      state.syncStatus = 'Still signed in on this device. Sync will reconnect when the server is ready.'
    }
  }

  render()
}

function renderFilterChip(filter: OwnershipFilter, label: string) {
  const active = state.ownershipFilter === filter ? 'is-active' : ''
  return `<button class="chip ${active}" data-action="ownership-filter" data-filter="${filter}" type="button">${label}</button>`
}

function renderInstallButton() {
  if (!deferredInstallPrompt) {
    return ''
  }

  return '<button class="install-button" type="button" data-action="install-app">Install app</button>'
}

function renderCard(game: CatalogEntry) {
  const record = getRecord(game.id)
  const isWanted = record.status === 'wanted'
  const completeText = game.priceComplete === null ? 'Listing price only' : formatPrice(game.priceComplete)
  const yearText = game.year === null ? 'Release year unavailable' : `Released ${game.year}`
  const isOwned = record.status === 'owned'
  const ownedEditionText = getOwnedEditionSummary(record)
  const ownedPulseClass = state.justOwnedGameId === game.id ? 'just-owned' : ''
  const safeGameId = escapeHtml(game.id)

  return `
    <article class="game-card ${isOwned ? 'is-owned' : ''} ${ownedPulseClass}" data-game-card="true" data-id="${safeGameId}" role="button" tabindex="0" aria-label="Open details for ${escapeHtml(game.title)}">
      <div class="cover-wrap">
        <img
          class="game-cover"
          src="${getCardCoverUrl(game)}"
          alt="${escapeHtml(game.title)} cover art"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          ${getCoverFallbackAttributes(game)}
        />
        <div class="cover-chips">
          <span class="ownership-pill ${getOwnershipTone(record.status)}">${getOwnershipLabel(record.status)}</span>
          <span class="rarity-badge">${game.rarity}</span>
        </div>
        ${isOwned ? `<div class="owned-stamp"><strong>Owned</strong><span>${escapeHtml(ownedEditionText)}</span></div>` : ''}
      </div>
      <div class="game-copy">
        <div class="game-meta">
          <p class="eyebrow">${escapeHtml(game.console)} / ${escapeHtml(game.region)}</p>
          <h3>${escapeHtml(game.title)}</h3>
          <p class="subtle">${yearText}</p>
          <p class="collector-line">${escapeHtml(ownedEditionText)} / ${getConditionLabel(record.condition)}</p>
        </div>
        <dl class="price-grid">
          <div>
            <dt>Loose</dt>
            <dd>${formatPrice(game.priceLoose)}</dd>
          </div>
          <div>
            <dt>${isOwned ? getOwnedValueLabel(game) : 'Complete'}</dt>
            <dd>${isOwned ? formatPrice(getOwnedMarketPrice(game)) : completeText}</dd>
          </div>
        </dl>
        <div class="card-actions">
          <button class="toggle-button ${isOwned ? 'is-confirmed' : ''}" data-action="toggle-owned" data-id="${safeGameId}" type="button">${isOwned ? `Owned: ${escapeHtml(getEditionLabel(record.editionStatus))}` : 'Mark owned'}</button>
          <button class="ghost-button ${isWanted ? 'is-active' : ''}" data-action="toggle-wanted" data-id="${safeGameId}" type="button">${isWanted ? 'Remove wanted' : 'Want it'}</button>
          <button class="ghost-button ${record.favorite ? 'is-active' : ''}" data-action="toggle-favorite" data-id="${safeGameId}" type="button">${record.favorite ? 'Top shelf' : 'Favorite'}</button>
          <button class="ghost-button" data-action="open-details" data-id="${safeGameId}" type="button">Details</button>
        </div>
      </div>
    </article>
  `
}

function renderSelectedGameModal() {
  if (!state.selectedGameId) {
    return ''
  }

  const game = getGameById(state.selectedGameId)

  if (!game) {
    return ''
  }

  const record = getRecord(game.id)
  const safeGameId = escapeHtml(game.id)
  const safePriceSourceUrl = escapeHtml(game.priceSourceUrl)
  const valueGap =
    record.pricePaid === null ? null : getOwnedMarketPrice(game) - record.pricePaid

  return `
    <div class="game-modal-backdrop" data-action="close-details">
      <section class="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
        <button class="modal-close" type="button" data-action="close-details" aria-label="Close details">Close</button>
        <div class="game-modal-media">
          <img
            class="game-modal-cover"
            src="${getDetailCoverUrl(game)}"
            alt="${escapeHtml(game.title)} cover art"
            loading="eager"
            decoding="async"
            referrerpolicy="no-referrer"
            ${getCoverFallbackAttributes(game)}
          />
        </div>
        <div class="game-modal-copy">
          <p class="kicker">Collector detail</p>
          <h2 id="game-modal-title">${escapeHtml(game.title)}</h2>
          <p class="modal-subtitle">${escapeHtml(game.console)} / ${escapeHtml(game.region)} / ${game.year ?? 'Release year unavailable'}</p>
          <div class="modal-pill-row">
            <span class="ownership-pill ${getOwnershipTone(record.status)}">${getOwnershipLabel(record.status)}</span>
            <span class="rarity-badge">${game.rarity}</span>
            <span class="detail-chip">${escapeHtml(getOwnedEditionSummary(record))}</span>
            <span class="detail-chip">Shelf score ${getShelfScore(game)}</span>
            <span class="detail-chip">${getEditionLabel(record.editionStatus)}</span>
            <span class="detail-chip">${getConditionLabel(record.condition)}</span>
          </div>
          <div class="modal-primary-actions">
            <button class="toggle-button ${record.status === 'owned' ? 'is-confirmed' : ''}" data-action="toggle-owned" data-id="${safeGameId}" type="button">${record.status === 'owned' ? `Owned: ${escapeHtml(getEditionLabel(record.editionStatus))}` : 'Mark owned'}</button>
            <button class="ghost-button ${record.status === 'wanted' ? 'is-active' : ''}" data-action="toggle-wanted" data-id="${safeGameId}" type="button">${record.status === 'wanted' ? 'Remove wanted' : 'Want it'}</button>
            <button class="ghost-button ${record.favorite ? 'is-active' : ''}" data-action="toggle-favorite" data-id="${safeGameId}" type="button">${record.favorite ? 'Top shelf' : 'Favorite'}</button>
          </div>
          <p class="modal-description">
            This collector view keeps the market snapshot, ownership state, and source art together in one place so the title feels like a real piece of your collection.
          </p>
          <div class="modal-market-grid">
            <article>
              <span>Loose market</span>
              <strong>${formatPrice(game.priceLoose)}</strong>
            </article>
            <article>
              <span>Complete market</span>
              <strong>${game.priceComplete === null ? 'Listing only' : formatPrice(game.priceComplete)}</strong>
            </article>
            <article>
              <span>Your tracked value</span>
              <strong>${record.status === 'owned' ? formatPrice(getOwnedMarketPrice(game)) : 'Mark owned'}</strong>
            </article>
            <article>
              <span>You paid</span>
              <strong>${record.pricePaid === null ? 'Not set' : formatPrice(record.pricePaid)}</strong>
            </article>
            <article>
              <span>Market movement</span>
              <strong>${formatDelta(game.trendDelta)}</strong>
            </article>
          </div>
          <div class="modal-notes">
            <p><strong>Price snapshot:</strong> ${priceSnapshotDate}</p>
            <p><strong>Market edge:</strong> ${valueGap === null ? 'Add your paid price to see gain or loss.' : `${valueGap >= 0 ? 'Ahead' : 'Behind'} ${formatPrice(Math.abs(valueGap))} versus ${getOwnedValueLabel(game).toLowerCase()}.`}</p>
            <p><strong>Alert target:</strong> ${record.targetPrice === null ? 'No target set.' : `Notify yourself when loose value hits ${formatPrice(record.targetPrice)} or less.`}</p>
            <p><strong>Art source:</strong> ${getCoverSourceLabel(game)}</p>
            <p><strong>Market note:</strong> ${appConfig.marketDisclaimer}</p>
            <p><strong>Collector notes:</strong> ${record.notes ? escapeHtml(record.notes) : 'No collector notes yet.'}</p>
          </div>
          <div class="card-actions">
            <button class="ghost-button" data-action="set-price-paid" data-id="${safeGameId}" type="button">Set paid</button>
            <button class="ghost-button" data-action="set-target-price" data-id="${safeGameId}" type="button">Set alert</button>
            <button class="ghost-button" data-action="set-edition" data-id="${safeGameId}" type="button">Edition</button>
            <button class="ghost-button" data-action="set-copies" data-id="${safeGameId}" type="button">Copies ${getOwnedCopyCount(record)}</button>
            <button class="ghost-button" data-action="set-condition" data-id="${safeGameId}" type="button">Condition</button>
            <button class="ghost-button" data-action="edit-notes" data-id="${safeGameId}" type="button">Notes</button>
            <a class="link-button" href="${safePriceSourceUrl}" target="_blank" rel="noreferrer">Open market source</a>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderSmartList(title: string, games: CatalogEntry[], emptyText: string) {
  return `
    <article class="smart-card">
      <h3>${title}</h3>
      ${
        games.length
          ? `<ul class="smart-list">${games
              .map(
                (game) =>
                  `<li><strong>${escapeHtml(game.title)}</strong><span>${escapeHtml(game.console)} / ${formatPrice(getReferencePrice(game))}</span></li>`,
              )
              .join('')}</ul>`
          : `<p class="subtle">${emptyText}</p>`
      }
    </article>
  `
}

function renderInsightCard(title: string, value: string, note: string) {
  return `
    <article class="insight-card">
      <span class="stat-label">${title}</span>
      <strong>${value}</strong>
      <span class="stat-note">${note}</span>
    </article>
  `
}

function renderTrustStrip() {
  const syncCopy = state.authToken
    ? state.syncStatus
    : 'Device-only until you create an account'
  const accountIdentity = getAccountIdentityLabel()
  const ownershipMode = getOwnedGames().some((game) => isCompleteEdition(getRecord(game.id)))
    ? 'Loose and complete values active'
    : 'Loose values active'

  return `
    <section class="trust-strip" aria-label="Retro Vault trust signals">
      <article>
        <span>Secure sync</span>
        <strong>${escapeHtml(syncCopy)}</strong>
      </article>
      <article>
        <span>Account</span>
        <strong>${state.authToken ? `Signed in as ${escapeHtml(accountIdentity)}` : 'Not signed in'}</strong>
      </article>
      <article>
        <span>Market snapshot</span>
        <strong>${priceSnapshotDate}</strong>
      </article>
      <article>
        <span>Collection pricing</span>
        <strong>${ownershipMode}</strong>
      </article>
      <article>
        <span>Your data</span>
        <strong>Owned by you, exportable anytime</strong>
      </article>
    </section>
  `
}

function renderOnboardingPanel() {
  const steps = getOnboardingSteps()
  const completed = steps.filter((step) => step.done).length
  const setupScore = getCollectionCompletenessScore()

  if (state.onboardingDismissed) {
    return ''
  }

  return `
    <section class="onboarding-panel">
      <div class="onboarding-copy">
        <p class="kicker">Collector setup</p>
        <h2>${completed === steps.length ? 'Your vault is ready to show off.' : 'Build a collection people want to come back to.'}</h2>
        <p class="subtle">${completed}/${steps.length} core setup steps complete. Vault readiness ${setupScore}%. Finish these to unlock stronger stats, better value tracking, and a more personal collector profile.</p>
      </div>
      <div class="onboarding-steps">
        ${steps
          .map(
            (step) => `
              <article class="onboarding-step ${step.done ? 'is-done' : ''}">
                <div>
                  <strong>${step.done ? 'Done' : 'Next'}: ${escapeHtml(step.label)}</strong>
                  <span>${escapeHtml(step.detail)}</span>
                </div>
                <button class="ghost-button" type="button" data-action="${step.action}">${escapeHtml(step.done ? 'Review' : step.actionLabel)}</button>
              </article>
            `,
          )
          .join('')}
      </div>
      <button class="link-button onboarding-dismiss" type="button" data-action="dismiss-onboarding">Hide checklist</button>
    </section>
  `
}

function renderControlSummary(resultCount: number, visibleCount: number) {
  const activeFilters = [
    state.regionFilter !== 'All regions' ? getRegionOptionLabel(state.regionFilter) : '',
    state.consoleFilter !== 'All consoles' ? getConsoleOptionLabel(state.consoleFilter) : '',
    state.yearFilter !== 'All years' ? `Release year ${state.yearFilter}` : '',
    state.ownershipFilter !== 'all' ? state.ownershipFilter : '',
    state.search.trim() ? `Search: ${state.search.trim()}` : '',
  ].filter(Boolean)

  return `
    <section class="control-summary">
      <div>
        <p class="kicker">Control center</p>
        <strong>${resultCount.toLocaleString()} results</strong>
        <span class="subtle">Showing ${visibleCount.toLocaleString()} now. Filters update without leaving the collection grid.</span>
      </div>
      <div class="filter-chip-row">
        ${
          activeFilters.length
            ? activeFilters.map((filter) => `<span>${escapeHtml(filter)}</span>`).join('')
            : '<span>All games in the selected vault view</span>'
        }
        <button class="ghost-button" type="button" data-action="clear-filters">Clear filters</button>
      </div>
    </section>
  `
}

function renderViewSummary(filteredGames: CatalogEntry[]) {
  const ownedGames = filteredGames.filter((game) => getRecord(game.id).status === 'owned')
  const wantedGames = filteredGames.filter((game) => getRecord(game.id).status === 'wanted')
  const ownedTrackedValue = ownedGames.reduce((total, game) => total + getReferencePrice(game), 0)
  const paidTotal = ownedGames.reduce((total, game) => total + (getRecord(game.id).pricePaid ?? 0), 0)
  const marketEdge = ownedTrackedValue - paidTotal
  const completeOwned = ownedGames.filter((game) => isCompleteEdition(getRecord(game.id))).length

  return `
    <section class="view-summary">
      <article>
        <span class="stat-label">Owned in this view</span>
        <strong>${ownedGames.length.toLocaleString()}</strong>
        <span class="stat-note">${completeOwned.toLocaleString()} complete copies tracked</span>
      </article>
      <article>
        <span class="stat-label">Wanted in this view</span>
        <strong>${wantedGames.length.toLocaleString()}</strong>
        <span class="stat-note">${formatPrice(wantedGames.reduce((total, game) => total + getReferencePrice(game), 0))} target value</span>
      </article>
      <article>
        <span class="stat-label">Tracked value in this view</span>
        <strong>${formatPrice(ownedTrackedValue)}</strong>
        <span class="stat-note">Based on your loose or complete ownership choices</span>
      </article>
      <article>
        <span class="stat-label">Paid total in this view</span>
        <strong>${formatPrice(paidTotal)}</strong>
        <span class="stat-note">${paidTotal ? `${marketEdge >= 0 ? 'Ahead' : 'Behind'} ${formatPrice(Math.abs(marketEdge))}` : 'Add paid prices to compare pickups versus market'}</span>
      </article>
    </section>
  `
}

function renderFiltersSection() {
  return `
    <section class="filters">
      ${renderFilterChip('all', 'All')}
      ${renderFilterChip('owned', 'Owned')}
      ${renderFilterChip('wanted', 'Wanted')}
      ${renderFilterChip('missing', 'Missing')}
      <button class="secondary-button mobile-only-action" data-action="open-custom-entry" type="button">Add your own game</button>
      <button class="secondary-button" data-action="reset-library" type="button">Reset library</button>
      <button class="secondary-button" data-action="import-catalog" type="button">Import JSON catalog</button>
      <button class="secondary-button" data-action="export-catalog" type="button">Export collection</button>
      <input id="catalog-import" type="file" accept=".json,application/json" hidden />
    </section>
  `
}

function renderCatalogSection(filteredGames: CatalogEntry[], visibleGames: CatalogEntry[]) {
  return `
    <section class="catalog-section">
      <div class="section-heading">
        <div>
          <p class="kicker">Collection grid</p>
          <h2>${filteredGames.length} game${filteredGames.length === 1 ? '' : 's'} in view</h2>
        </div>
        <p class="section-note">Showing ${visibleGames.length.toLocaleString()} at a time for speed. Every cover stays in full color, and owned games get a strong vault stamp.</p>
      </div>
      <div class="catalog-grid">
        ${
          visibleGames.length
            ? visibleGames.map(renderCard).join('')
            : '<div class="empty-state"><h3>No matches</h3><p>Add it as a custom entry and keep building your collection immediately.</p><button class="toggle-button" data-action="open-custom-entry" type="button">Add this game</button></div>'
        }
      </div>
      ${
        filteredGames.length > visibleGames.length
          ? `<div class="load-more-row"><button class="secondary-button" data-action="load-more-games" type="button">Load more games (${(filteredGames.length - visibleGames.length).toLocaleString()} left)</button></div>`
          : ''
      }
    </section>
  `
}

function renderConsolePush(title: string, entries: ReturnType<typeof getNearCompleteConsoles>, emptyText: string) {
  return `
    <article class="smart-card">
      <h3>${title}</h3>
      ${
        entries.length
          ? `<ul class="smart-list">${entries
              .map(
                (entry) =>
                  `<li><strong>${escapeHtml(entry.consoleName)}</strong><span>${entry.owned}/${entry.total} owned / ${entry.progress}% complete</span></li>`,
              )
              .join('')}</ul>`
          : `<p class="subtle">${emptyText}</p>`
      }
    </article>
  `
}

function renderConsoleProgress() {
  return getConsoleProgress()
    .map(
      (entry) => `
        <div class="progress-row">
          <div class="progress-copy">
            <strong>${escapeHtml(entry.consoleName)}</strong>
            <span>${entry.owned}/${entry.total} owned</span>
          </div>
          <div class="progress-bar" aria-hidden="true"><span style="width:${entry.progress}%"></span></div>
          <span class="progress-percent">${entry.progress}%</span>
        </div>
      `,
    )
    .join('')
}

function renderConsoleCompletionCard() {
  const progress = getConsoleProgress()
  const topProgress = progress.slice(0, 3)

  return `
    <article class="smart-card">
      <details class="completion-panel">
        <summary class="completion-summary">
          <div>
            <h3>Console completion</h3>
            <p class="subtle">A clean snapshot of your progress across each system, with the full breakdown tucked neatly behind one tap.</p>
          </div>
          <span class="completion-toggle">Open</span>
        </summary>
        <div class="completion-preview">
          ${topProgress
            .map(
              (entry) =>
                `<div class="completion-preview-row"><strong>${escapeHtml(entry.consoleName)}</strong><span>${entry.owned}/${entry.total} owned</span></div>`,
            )
            .join('')}
        </div>
        <div class="progress-stack">${renderConsoleProgress()}</div>
      </details>
    </article>
  `
}

function renderOwnershipPickerModal() {
  if (!state.ownershipPickerGameId) {
    return ''
  }

  const game = getGameById(state.ownershipPickerGameId)

  if (!game) {
    return ''
  }

  const completeValue = game.priceComplete === null ? getReferencePrice(game) : game.priceComplete
  const safeGameId = escapeHtml(game.id)

  return `
    <div class="game-modal-backdrop" data-action="close-ownership-picker">
      <section class="ownership-picker" role="dialog" aria-modal="true" aria-labelledby="ownership-picker-title" onclick="event.stopPropagation()">
        <button class="modal-close" type="button" data-action="close-ownership-picker" aria-label="Close ownership picker">Close</button>
        <p class="kicker">Add to collection</p>
        <h2 id="ownership-picker-title">${escapeHtml(game.title)}</h2>
        <p class="modal-description">Choose the version you own so Retro Vault uses the right market value for your collection.</p>
        <div class="ownership-choice-grid">
          <button class="ownership-choice" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="loose">
            <span>Loose game</span>
            <strong>${formatPrice(game.priceLoose)}</strong>
            <em>Cart, disc, or card only</em>
          </button>
          <button class="ownership-choice ownership-choice--premium" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="cib">
            <span>Complete in box</span>
            <strong>${formatPrice(completeValue)}</strong>
            <em>Box and manual tracked</em>
          </button>
        </div>
        <p class="subtle">You can refine this later to boxed, manual, sealed, graded, paid price, notes, and condition from Details.</p>
      </section>
    </div>
  `
}

function renderCustomEntryModal() {
  if (!state.customEntryOpen) {
    return ''
  }

  const rawTitleDraft = state.search.trim()
  const rawConsoleDraft = state.consoleFilter === 'All consoles' ? '' : state.consoleFilter
  const rawRegionDraft = state.regionFilter === 'All regions' ? 'North America' : state.regionFilter
  const titleDraft = escapeHtml(rawTitleDraft)
  const consoleDraft = escapeHtml(rawConsoleDraft)
  const regionDraft = escapeHtml(rawRegionDraft)
  const previewGame = createCustomEntryPreviewGame(rawTitleDraft, rawConsoleDraft, rawRegionDraft)
  const previewFallback = getCoverFallbackDataUri(previewGame)

  return `
    <div class="game-modal-backdrop" data-action="close-custom-entry">
      <section class="auth-modal custom-entry-modal" role="dialog" aria-modal="true" aria-labelledby="custom-entry-title" onclick="event.stopPropagation()">
        <button class="modal-close" type="button" data-action="close-custom-entry" aria-label="Close custom entry">Close</button>
        <p class="kicker">Custom catalog entry</p>
        <h2 id="custom-entry-title">Add missing game</h2>
        <p class="auth-helper">Create a private entry now. It appears in your collection immediately, counts in your stats, and syncs with your account.</p>
        ${state.customEntryError ? `<div class="auth-message auth-message--error">${escapeHtml(state.customEntryError)}</div>` : ''}
        <form class="auth-form custom-entry-form" data-custom-entry-form="true">
          <div class="custom-entry-preview">
            <img
              src="${previewFallback}"
              alt="${escapeHtml(previewGame.title)} generated cover preview"
              data-custom-entry-cover-preview="true"
              data-fallback-src="${previewFallback}"
            />
            <div>
              <strong>Cover preview</strong>
              <span data-custom-entry-cover-status="true">Generated cover tile. Add an image URL whenever you have one.</span>
            </div>
          </div>
          <label><span>Title</span><input name="title" required maxlength="120" value="${titleDraft}" /></label>
          <label><span>Console</span><input name="console" required maxlength="80" value="${consoleDraft}" /></label>
          <div class="auth-settings-grid">
            <label><span>Region</span><input name="region" required maxlength="60" value="${regionDraft}" /></label>
            <label><span>Year</span><input name="year" inputmode="numeric" maxlength="4" /></label>
          </div>
          <div class="auth-settings-grid">
            <label><span>Loose value</span><input name="priceLoose" inputmode="decimal" /></label>
            <label><span>Complete value</span><input name="priceComplete" inputmode="decimal" /></label>
          </div>
          <label><span>Cover image URL</span><input name="coverUrl" type="text" inputmode="url" /><small>Leave blank to keep the generated cover tile, or paste any https image URL.</small></label>
          <div class="auth-settings-grid">
            <label><span>Status</span><select name="status"><option value="owned">Owned</option><option value="wanted">Wanted</option><option value="missing">Just add entry</option></select></label>
            <label><span>Edition</span><select name="editionStatus"><option value="loose">Loose</option><option value="cib">Complete in box</option><option value="boxed">Boxed</option><option value="manual">Manual</option><option value="sealed">Sealed</option><option value="graded">Graded</option></select></label>
          </div>
          <label><span>Notes</span><input name="notes" maxlength="220" /></label>
          <button class="toggle-button" type="submit">Add to my collection</button>
        </form>
      </section>
    </div>
  `
}

function renderAccountCard() {
  return `
    <article class="smart-card">
      <h3>Account sync</h3>
      <p class="subtle">${state.authToken ? `Signed in as ${escapeHtml(state.accountDisplayName || state.accountEmail || 'collector')}. Your owned games, wishlist, CIB marks, paid prices, favorites, alerts, and profile are protected in your account.` : 'Create an account so your collection, wishlist, paid prices, favorites, alerts, and brag profile are safely synced.'}</p>
      <div class="account-meta">
        <span class="detail-chip">${escapeHtml(state.syncStatus)}</span>
        <span class="detail-chip">${state.authToken ? 'Account protected' : 'Device-only mode'}</span>
      </div>
      <div class="card-actions">
        ${state.authToken
          ? '<button class="toggle-button" data-action="sync-now" type="button">Sync now</button><button class="ghost-button" data-action="open-account-settings" type="button">Account settings</button><button class="ghost-button" data-action="logout-account" type="button">Sign out</button>'
          : '<button class="toggle-button" data-action="open-register" type="button">Create account</button><button class="ghost-button" data-action="open-login" type="button">Sign in</button>'}
      </div>
    </article>
  `
}

function renderMobileAccountBar() {
  const accountIdentity = getAccountIdentityLabel()

  return `
    <section class="mobile-account-bar" aria-label="Account access">
      <div>
        <span>${state.authToken ? 'Signed in' : 'Account'}</span>
        <strong>${state.authToken ? escapeHtml(accountIdentity) : 'Sign in to sync your vault'}</strong>
      </div>
      <div class="mobile-account-actions">
        ${
          state.authToken
            ? '<button class="install-button" type="button" data-action="open-account-settings">Account</button>'
            : '<button class="install-button" type="button" data-action="open-login">Sign in</button><button class="ghost-button" type="button" data-action="open-register">Create</button>'
        }
      </div>
    </section>
  `
}

function renderAuthModal() {
  if (state.authView === 'none') {
    return ''
  }

  const titleByView: Record<Exclude<AuthView, 'none'>, string> = {
    register: 'Create your account',
    login: 'Sign in',
    reset: 'Reset your password',
    account: 'Account settings',
    'confirm-reset': 'Choose a new password',
  }
  const title = titleByView[state.authView]

  return `
    <div class="game-modal-backdrop" data-action="close-auth">
      <section class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onclick="event.stopPropagation()">
        <button class="modal-close" type="button" data-action="close-auth" aria-label="Close account dialog">Close</button>
        <p class="kicker">Retro Vault account</p>
        <h2 id="auth-title">${title}</h2>
        <p class="auth-helper">${getAuthHelperText()}</p>
        ${state.authError ? `<div class="auth-message auth-message--error">${escapeHtml(state.authError)}</div>` : ''}
        ${state.authSuccess ? `<div class="auth-message auth-message--success">${escapeHtml(state.authSuccess)}</div>` : ''}
        ${renderAuthForm()}
      </section>
    </div>
  `
}

function getAuthHelperText() {
  switch (state.authView) {
    case 'register':
      return 'Save your collection to your account before you start tracking serious value.'
    case 'login':
      return 'Welcome back. Sign in to restore your synced collection and collector profile.'
    case 'reset':
      return 'Enter your email and we will send a reset link if the account exists.'
    case 'confirm-reset':
      return 'Use a strong password with at least 8 characters, one letter, and one number.'
    case 'account':
      return 'Manage your display name, password, sync state, and account ownership.'
    case 'none':
    default:
      return ''
  }
}

function renderAuthForm() {
  const disabled = state.authLoading ? 'disabled' : ''
  const buttonText = (label: string) => (state.authLoading ? 'Working...' : label)
  const emailDraft = escapeHtml(state.authEmailDraft)

  if (state.authView === 'register') {
    return `
      <form class="auth-form" data-auth-form="register">
        <label><span>Display name</span><input name="displayName" autocomplete="name" /><small>Display names must be unique. Your email must also be unique and protects the account.</small></label>
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required value="${emailDraft}" /></label>
        <label><span>Password</span><input name="password" type="password" autocomplete="new-password" required minlength="8" /></label>
        <button class="toggle-button" type="submit" ${disabled}>${buttonText('Create account')}</button>
        <button class="ghost-button" type="button" data-action="open-login">Already have an account?</button>
      </form>
    `
  }

  if (state.authView === 'login') {
    return `
      <form class="auth-form" data-auth-form="login">
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required value="${emailDraft}" /></label>
        <label><span>Password</span><input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="toggle-button" type="submit" ${disabled}>${buttonText('Sign in')}</button>
        <button class="ghost-button" type="button" data-action="open-reset">Forgot password?</button>
        <button class="ghost-button" type="button" data-action="open-register">Create or recover account</button>
      </form>
    `
  }

  if (state.authView === 'reset') {
    return `
      <form class="auth-form" data-auth-form="reset">
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required value="${emailDraft}" /></label>
        <button class="toggle-button" type="submit" ${disabled}>${buttonText('Send reset email')}</button>
        <button class="ghost-button" type="button" data-action="open-login">Back to sign in</button>
      </form>
    `
  }

  if (state.authView === 'confirm-reset') {
    return `
      <form class="auth-form" data-auth-form="confirm-reset">
        <label><span>New password</span><input name="password" type="password" autocomplete="new-password" required minlength="8" /></label>
        <button class="toggle-button" type="submit" ${disabled}>${buttonText('Reset password')}</button>
      </form>
    `
  }

  return `
    <form class="auth-form" data-auth-form="account">
      <label><span>Display name</span><input name="displayName" autocomplete="name" value="${escapeHtml(state.accountDisplayName)}" /><small>Display names and emails must be unique across Retro Vault accounts.</small></label>
      <label><span>Email</span><input value="${escapeHtml(state.accountEmail)}" disabled /></label>
      <div class="auth-settings-grid">
        <button class="toggle-button" type="submit" ${disabled}>${buttonText('Save profile')}</button>
        <button class="ghost-button" type="button" data-action="sync-now">Sync now</button>
        <button class="ghost-button" type="button" data-action="open-reset">Send password reset</button>
        <button class="ghost-button" type="button" data-action="change-password">Change password</button>
        <button class="ghost-button" type="button" data-action="logout-account">Sign out</button>
        <button class="ghost-button danger-button" type="button" data-action="delete-account">Delete account</button>
      </div>
    </form>
  `
}

function renderCollectionIdentityCard() {
  const rank = getCollectorRank()
  const dominantConsole = getDominantConsole()
  const rarestOwned = getRarestOwnedGame()

  return `
    <article class="identity-card">
      <div class="identity-copy">
        <p class="kicker">Collector identity</p>
        <h2>${rank.title}</h2>
        <p class="identity-summary">${rank.detail}</p>
        <div class="identity-metrics">
          <article>
            <span>Collection era</span>
            <strong>${getCollectionEraLabel()}</strong>
          </article>
          <article>
            <span>Shelf mood</span>
            <strong>${getCollectionMood()}</strong>
          </article>
          <article>
            <span>Strongest console</span>
            <strong>${dominantConsole ? escapeHtml(dominantConsole.consoleName) : 'Still building'}</strong>
          </article>
          <article>
            <span>Rarest flex</span>
            <strong>${rarestOwned ? escapeHtml(rarestOwned.title) : 'Still hunting'}</strong>
          </article>
        </div>
      </div>
      <div class="identity-share">
        <p class="kicker">Share-ready brag card</p>
        <div class="share-card">
          <strong>Retro Vault Elite</strong>
          <span>${rank.title}</span>
          <span>${dominantConsole ? `${escapeHtml(dominantConsole.consoleName)} specialist` : 'Shelf in progress'}</span>
          <span>${rarestOwned ? `Flex: ${escapeHtml(rarestOwned.title)}` : 'Flex: loading'}</span>
        </div>
        <div class="card-actions">
          <button class="toggle-button" type="button" data-action="share-challenge">Share collector challenge</button>
          <a class="link-button" href="/collector-challenge.html">Open challenge page</a>
        </div>
      </div>
    </article>
  `
}

function renderAchievementStrip() {
  const achievements = getCollectorAchievements()

  if (!achievements.length) {
    return ''
  }

  return `
    <section class="achievement-strip">
      ${achievements
        .map(
          (achievement) => `
            <article class="achievement-pill achievement-pill--${achievement.tone}">
              <span class="achievement-title">${achievement.title}</span>
              <span class="achievement-detail">${achievement.detail}</span>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderTodayHunt() {
  const items = getTodayHuntItems()

  return `
    <section class="daily-hunt" aria-labelledby="daily-hunt-title">
      <div class="daily-hunt-header">
        <div>
          <p class="kicker">Today's collector hunt</p>
          <h2 id="daily-hunt-title">Five reasons to check the vault today.</h2>
        </div>
        <p class="subtle">A fresh daily mix of grails, market movement, milestones, deal prompts, and share fuel.</p>
      </div>
      <div class="daily-hunt-grid">
        ${items
          .map((item) => {
            const dataId = item.game ? ` data-id="${escapeHtml(item.game.id)}"` : ''
            const dataConsole = item.consoleName ? ` data-console="${escapeHtml(item.consoleName)}"` : ''

            return `
              <article class="hunt-card hunt-card--${item.tone}">
                <span class="hunt-label">${escapeHtml(item.label)}</span>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.detail)}</p>
                <strong>${escapeHtml(item.meta)}</strong>
                <button class="link-button" type="button" data-action="${item.action}"${dataId}${dataConsole}>${escapeHtml(item.actionLabel)}</button>
              </article>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderRetentionRecap() {
  const highlights = getWeeklyRecapHighlights()

  return `
    <section class="retention-grid" aria-label="Daily streak and weekly recap">
      <article class="streak-card">
        <p class="kicker">Daily streak</p>
        <strong>${state.visitStreak.current}</strong>
        <span>day${state.visitStreak.current === 1 ? '' : 's'} in a row</span>
        <p class="subtle">Best streak ${state.visitStreak.best}. Check the vault daily to keep your collector rhythm alive.</p>
      </article>
      <article class="weekly-recap-card">
        <div class="weekly-recap-copy">
          <p class="kicker">Weekly recap</p>
          <h2>Your vault story for the week.</h2>
          <p class="subtle">A shareable snapshot of your collection, hunt list, value, strongest console, and rarest flex.</p>
        </div>
        <div class="weekly-recap-stats">
          <span>${escapeHtml(highlights.owned)}</span>
          <span>${escapeHtml(highlights.added)}</span>
          <span>${escapeHtml(highlights.value)}</span>
          <span>${escapeHtml(highlights.strongest)}</span>
          <span>${escapeHtml(highlights.rarest)}</span>
          <span>${escapeHtml(highlights.alerts)}</span>
        </div>
        <div class="card-actions">
          <button class="toggle-button" type="button" data-action="share-weekly-recap">Share weekly recap</button>
          <button class="ghost-button" type="button" data-action="browse-library">Improve next week</button>
        </div>
      </article>
    </section>
  `
}

function renderBadgePreview() {
  const unlockedBadges = getUnlockedBadges()
  const nextBadges = getNextBadges()
  const previewBadges = unlockedBadges.slice(0, 4)
  const totalBadges = getCollectorBadges().length

  return `
    <section class="badge-preview" aria-label="Collector badges">
      <div class="badge-preview-copy">
        <p class="kicker">Collector badges</p>
        <h2>${unlockedBadges.length}/${totalBadges} unlocked</h2>
        <p class="subtle">Badges turn collection habits into goals: owned counts, grails, CIB tracking, wishlist alerts, streaks, value tracking, and console mastery.</p>
        <div class="card-actions">
          <button class="toggle-button" type="button" data-action="open-badges">View badges</button>
          <button class="ghost-button" type="button" data-action="share-badges">Share badges</button>
        </div>
      </div>
      <div class="badge-preview-list">
        ${
          previewBadges.length
            ? previewBadges.map(renderBadgePill).join('')
            : '<p class="subtle">No badges unlocked yet. Mark your first owned game to start the shelf.</p>'
        }
      </div>
      <div class="next-badge-list">
        <strong>Closest next</strong>
        ${
          nextBadges.length
            ? nextBadges
                .map(
                  (badge) => `
                    <div class="next-badge">
                      <span>${escapeHtml(badge.title)}</span>
                      <em>${badge.progress}/${badge.target}</em>
                      <div class="badge-progress" aria-hidden="true"><span style="width:${getBadgePercent(badge)}%"></span></div>
                    </div>
                  `,
                )
                .join('')
            : '<p class="subtle">Every badge is unlocked. Legendary shelf behavior.</p>'
        }
      </div>
    </section>
  `
}

function renderNewsletterCapture() {
  return `
    <section class="newsletter-card" aria-label="Weekly retro market movers email">
      <div>
        <p class="kicker">Collector market notes</p>
        <h2>Get the weekly retro watchlist.</h2>
        <p class="subtle">A short collector email with notable market movers, grail alerts, checklist ideas, and Retro Vault updates worth knowing about.</p>
        ${state.newsletterStatus ? `<p class="newsletter-status">${escapeHtml(state.newsletterStatus)}</p>` : ''}
      </div>
      <form class="newsletter-form" data-newsletter-form>
        <label>
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" required value="${escapeHtml(state.accountEmail)}" />
        </label>
        <button class="toggle-button" type="submit">Join the watchlist</button>
      </form>
    </section>
  `
}

function renderBadgePill(badge: CollectorBadge) {
  return `
    <article class="badge-pill badge-pill--${badge.tone}">
      <div class="badge-medal" aria-hidden="true"><span>${escapeHtml(badge.icon)}</span></div>
      <div class="badge-pill-copy">
        <span>${badge.unlocked ? 'Unlocked' : `${badge.progress}/${badge.target}`}</span>
        <strong>${escapeHtml(badge.title)}</strong>
      </div>
    </article>
  `
}

function renderBadgesModal() {
  if (!state.badgesOpen) {
    return ''
  }

  const badges = getCollectorBadges()
  const unlockedCount = badges.filter((badge) => badge.unlocked).length

  return `
    <div class="game-modal-backdrop" data-action="close-badges">
      <section class="badges-modal" role="dialog" aria-modal="true" aria-labelledby="badges-title" onclick="event.stopPropagation()">
        <button class="modal-close" type="button" data-action="close-badges" aria-label="Close badges">Close</button>
        <p class="kicker">Collector badges</p>
        <h2 id="badges-title">${unlockedCount}/${badges.length} badges unlocked</h2>
        <p class="modal-description">Every badge is a reason to keep building: own more games, track condition, chase grails, add wanted targets, and keep your daily streak alive.</p>
        <div class="card-actions">
          <button class="toggle-button" type="button" data-action="share-badges">Share my badges</button>
          <button class="ghost-button" type="button" data-action="browse-library">Chase next badge</button>
        </div>
        <div class="badge-grid">
          ${badges
            .map(
              (badge) => `
                <article class="badge-card ${badge.unlocked ? 'is-unlocked' : 'is-locked'} badge-card--${badge.tone}">
                  <div class="badge-card-top">
                    <div class="badge-medal badge-medal--large" aria-hidden="true"><span>${escapeHtml(badge.icon)}</span></div>
                    <span class="badge-state">${badge.unlocked ? 'Unlocked' : 'Locked'}</span>
                  </div>
                  <div class="badge-card-copy">
                    <h3>${escapeHtml(badge.title)}</h3>
                    <p>${escapeHtml(badge.unlocked ? badge.detail : badge.hint)}</p>
                  </div>
                  <div class="badge-progress" aria-label="${escapeHtml(badge.title)} progress ${badge.progress} of ${badge.target}">
                    <span style="width:${getBadgePercent(badge)}%"></span>
                  </div>
                  <strong>${badge.progress}/${badge.target}</strong>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `
}

function renderScannerModal() {
  if (!state.scannerOpen) {
    return ''
  }

  const linkedGame = getLinkedBarcodeGame()
  const matches = getBarcodeSearchMatches()

  return `
    <div class="game-modal-backdrop" data-action="close-scanner">
      <section class="game-modal scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        <button class="modal-close" type="button" data-action="close-scanner" aria-label="Close scanner">Close</button>
        <div class="game-modal-copy scanner-copy">
          <p class="kicker">Barcode scanner</p>
          <h2 id="scanner-title">Scan and link game barcodes</h2>
          <p class="modal-description">${escapeHtml(state.scannerStatus)}</p>
          <div class="card-actions">
            ${
              canUseLiveBarcodeCamera()
                ? state.scannerLiveActive
                  ? '<button class="secondary-button" data-action="stop-live-barcode" type="button">Stop live camera</button>'
                  : '<button class="secondary-button" data-action="start-live-barcode" type="button">Start live camera</button>'
                : ''
            }
            <label class="toggle-button scanner-upload">
              Upload photo
              <input id="barcode-file-input" type="file" accept="image/*" capture="environment" hidden />
            </label>
            <button class="ghost-button" data-action="manual-barcode" type="button">Enter barcode</button>
          </div>
          ${
            state.scannerLiveActive
              ? `
                <div class="scanner-preview">
                  <video class="scanner-video" data-barcode-camera-preview autoplay muted playsinline></video>
                  <div class="scanner-frame" aria-hidden="true"></div>
                </div>
              `
              : ''
          }
          ${
            state.barcodeLinkCode
              ? `
                <div class="scanner-result">
                  <p><strong>Scanned code:</strong> ${escapeHtml(state.barcodeLinkCode)}</p>
                  ${
                    linkedGame
                      ? `<p><strong>Linked game:</strong> ${escapeHtml(linkedGame.title)} on ${escapeHtml(linkedGame.console)}</p>`
                      : '<p><strong>Status:</strong> No saved match yet. Search below to link it and it will remember that code next time.</p>'
                  }
                </div>
                <label class="search-field">
                  <span>Search game to link</span>
                  <input id="barcode-search" type="search" aria-label="Search a title or console" value="${escapeHtml(state.barcodeSearch)}" />
                </label>
                <div class="barcode-match-list">
                  ${matches
                    .map(
                      (game) => `
                        <button class="barcode-match" type="button" data-action="link-barcode" data-id="${escapeHtml(game.id)}">
                          <strong>${escapeHtml(game.title)}</strong>
                          <span>${escapeHtml(game.console)} / ${formatPrice(game.priceLoose)}</span>
                        </button>
                      `,
                    )
                    .join('')}
                </div>
              `
              : '<p class="subtle">Use live camera scan, a saved barcode photo, or manual entry. Once you link a barcode to the right game, Retro Vault will remember it for future scans.</p>'
          }
        </div>
      </section>
    </div>
  `
}

function renderSpotlight(spotlight: Spotlight | null) {
  if (!spotlight) {
    return '<article class="spotlight-card"><div class="spotlight-copy"><h2>No spotlight yet</h2><p>Mark games as wanted or owned to build your collector spotlight.</p></div></article>'
  }

  return `
    <article class="spotlight-card">
      <img class="spotlight-cover" src="${getCardCoverUrl(spotlight.game)}" alt="${escapeHtml(spotlight.game.title)} cover art" loading="lazy" decoding="async" referrerpolicy="no-referrer" ${getCoverFallbackAttributes(spotlight.game)} />
      <div class="spotlight-copy">
        <p class="kicker">${spotlight.label}</p>
        <h2>${escapeHtml(spotlight.game.title)}</h2>
                  <p class="subtle">${escapeHtml(spotlight.game.console)} / ${spotlight.game.year ?? 'Release year unavailable'} / ${spotlight.game.rarity}</p>
                  <p>${spotlight.copy}</p>
                  <div class="spotlight-stats">
                    <span>Loose ${formatPrice(spotlight.game.priceLoose)}</span>
                    <span>Complete ${spotlight.game.priceComplete === null ? 'n/a' : formatPrice(spotlight.game.priceComplete)}</span>
                    <span>Trend ${formatDelta(spotlight.game.trendDelta)}</span>
                  </div>
      </div>
    </article>
  `
}

function captureFocusSnapshot(): FocusSnapshot | null {
  const activeElement = document.activeElement

  if (!(activeElement instanceof HTMLInputElement) || !app.contains(activeElement) || !activeElement.id) {
    return lastInputFocusSnapshot
  }

  if (!['search-input', 'barcode-search'].includes(activeElement.id)) {
    return null
  }

  return {
    id: activeElement.id,
    value: activeElement.value,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd,
  }
}

function restoreFocusSnapshot(snapshot: FocusSnapshot | null) {
  if (!snapshot) {
    return
  }

  const element = document.getElementById(snapshot.id)

  if (!(element instanceof HTMLInputElement)) {
    return
  }

  element.value = snapshot.value
  element.focus({ preventScroll: true })

  if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
    element.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
  }

  lastInputFocusSnapshot = null
}

function rememberInputFocus(input: HTMLInputElement) {
  lastInputFocusSnapshot = {
    id: input.id,
    value: input.value,
    selectionStart: input.selectionStart,
    selectionEnd: input.selectionEnd,
  }
}

function renderNow() {
  const focusSnapshot = captureFocusSnapshot()
  const catalog = getCatalog()
  const filteredGames = getFilteredGames()
  const visibleGames = filteredGames.slice(0, state.visibleGameCount)
  const dashboard = getDashboardSummary(catalog)
  const ownedGames = dashboard.ownedGames
  const wantedGames = dashboard.wantedGames
  const ownedTrackedValue = dashboard.ownedTrackedValue
  const ownedCompleteValue = dashboard.ownedCompleteValue
  const estimatedSellValue = ownedTrackedValue
  const completionPercentage = dashboard.completionPercentage
  const wishlistValue = dashboard.wishlistValue
  const collectionDelta = dashboard.collectionDelta
  const prestigeScore = dashboard.prestigeScore
  const spotlight = dashboard.spotlight
  const consoleCount = new Set(catalog.map((game) => game.console)).size
  const loadedConsoleCount = state.loadedConsoles.length
  const totalConsoleCount = state.catalogMeta.length || consoleCount
  const selectedCurrency = getSelectedCurrency()
  const alertMatches = dashboard.alertMatches
  const nearCompleteConsoles = dashboard.nearCompleteConsoles
  const collectorRank = dashboard.collectorRank
  const accountIdentity = getAccountIdentityLabel()
  const catalogStatusText = state.isCatalogLoading
    ? `Loading the library. ${loadedConsoleCount} of ${totalConsoleCount} console lists are ready so far.`
    : state.catalogLoadError
      ? `Using the latest reference snapshot from ${priceSnapshotDate} while the rest of the catalog catches up.`
      : `${catalog.length} games across ${consoleCount} retro consoles, with ${loadedConsoleCount} of ${totalConsoleCount} console lists ready. Latest snapshot ${priceSnapshotDate}.`

  app.innerHTML = `
    ${renderBackdropWall(visibleGames, catalog)}
    <div class="app-shell">
      ${renderMobileAccountBar()}
      <header class="hero-panel">
        <div class="hero-copy">
          <p class="kicker">Retro Vault Elite</p>
          <h1>Keep up with the collection you have, and the games you still want to find.</h1>
          <p class="hero-text">
            Keep track of what you own, what you still want, what you paid, and all the oddball pieces that make your collection yours, without wrestling with a giant spreadsheet.
          </p>
          <p class="hero-text hero-text--tiny">${catalogStatusText} Collection values convert from USD market data using ECB reference rates from 10 April 2026.</p>
          ${
            state.authToken
              ? `<p class="account-status-pill"><span>Signed in</span><strong>${escapeHtml(accountIdentity)}</strong></p>`
              : '<p class="account-status-pill account-status-pill--guest"><span>Guest mode</span><strong>Make an account when you want your collection synced across devices.</strong></p>'
          }
          <div class="hero-actions">
            ${state.authToken ? '<button class="install-button" type="button" data-action="open-account-settings">Account settings</button>' : '<button class="install-button" type="button" data-action="open-register">Create account</button>'}
            <button class="secondary-button" type="button" data-action="browse-library">Browse library</button>
            <button class="secondary-button" type="button" data-action="open-scanner">Scan barcode</button>
            ${renderInstallButton()}
          </div>
        </div>
        <div class="hero-stats">
          <article>
            <span class="stat-label">Owned</span>
            <strong>${ownedGames.length}</strong>
            <span class="stat-note">${completionPercentage}% collection completion</span>
          </article>
          <article>
            <span class="stat-label">Wishlist</span>
            <strong>${wantedGames.length}</strong>
            <span class="stat-note">${formatPrice(wishlistValue)} target value</span>
          </article>
          <article>
            <span class="stat-label">Estimated sell value</span>
            <strong>${formatPrice(estimatedSellValue)}</strong>
            <span class="stat-note">Uses your loose/complete ownership choices in ${selectedCurrency.code}</span>
          </article>
          <article>
            <span class="stat-label">Collection premium</span>
            <strong>${formatPrice(ownedCompleteValue)}</strong>
            <span class="stat-note">Complete market total in ${selectedCurrency.code}</span>
          </article>
          <article>
            <span class="stat-label">Collector rank</span>
            <strong>${collectorRank.title}</strong>
            <span class="stat-note">${collectorRank.detail}</span>
          </article>
        </div>
      </header>

      ${renderTrustStrip()}

      <section class="toolbar">
        <label class="search-field">
          <span>Search the vault</span>
          <input id="search-input" type="search" value="${escapeHtml(state.search)}" />
        </label>
        <label class="select-field">
          <span>Region</span>
          <select id="region-filter">
            ${getRegions()
              .map(
                (regionName) =>
                  `<option value="${escapeHtml(regionName)}" ${regionName === state.regionFilter ? 'selected' : ''}>${escapeHtml(getRegionOptionLabel(regionName))}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="select-field">
          <span>Console</span>
          <select id="console-filter">
            ${getConsoles()
              .map(
                (consoleName) =>
                  `<option value="${escapeHtml(consoleName)}" ${consoleName === state.consoleFilter ? 'selected' : ''}>${escapeHtml(getConsoleOptionLabel(consoleName))}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="select-field">
          <span>Sort</span>
          <select id="sort-mode">
            <option value="title" ${state.sortMode === 'title' ? 'selected' : ''}>Title</option>
            <option value="year" ${state.sortMode === 'year' ? 'selected' : ''}>Release year</option>
            <option value="loose-high" ${state.sortMode === 'loose-high' ? 'selected' : ''}>Loose price</option>
            <option value="complete-high" ${state.sortMode === 'complete-high' ? 'selected' : ''}>Complete price</option>
            <option value="trend-high" ${state.sortMode === 'trend-high' ? 'selected' : ''}>Market trend</option>
            <option value="shelf-score" ${state.sortMode === 'shelf-score' ? 'selected' : ''}>Shelf score</option>
          </select>
        </label>
        <label class="select-field">
          <span>Release year</span>
          <select id="year-filter">
            ${getYears()
              .map(
                (yearValue) =>
                  `<option value="${escapeHtml(yearValue)}" ${yearValue === state.yearFilter ? 'selected' : ''}>${escapeHtml(yearValue)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="select-field">
          <span>Currency</span>
          <select id="currency-code">
            ${currencyOptions
              .map(
                (currency) =>
                  `<option value="${currency.code}" ${currency.code === state.currencyCode ? 'selected' : ''}>${currency.code} · ${escapeHtml(currency.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <div class="toolbar-action toolbar-action--desktop">
          <span>Add missing game</span>
          <button class="secondary-button" data-action="open-custom-entry" type="button">Add your own game</button>
        </div>
      </section>

      ${renderControlSummary(filteredGames.length, visibleGames.length)}
      ${renderViewSummary(filteredGames)}
      ${renderFiltersSection()}
      ${renderCatalogSection(filteredGames, visibleGames)}

      ${renderOnboardingPanel()}

      <section class="smart-grid">
        ${renderSmartList('Top grails still missing', getMissingGrails(), 'You already own every seeded grail.')}
        ${renderAccountCard()}
        ${renderConsoleCompletionCard()}
      </section>

      <section class="showcase-grid">
        ${renderSpotlight(spotlight)}
        <div class="insight-grid">
          ${renderInsightCard('Shelf prestige', prestigeScore.toString(), 'Weighted by rarity, market heat, CIB, and top-shelf picks.')}
          ${renderInsightCard('Market edge', formatPrice(collectionDelta), `Tracked owned value minus paid value in ${selectedCurrency.code}.`)}
          ${renderInsightCard('Price alerts', alertMatches.length.toString(), 'Wanted games currently at or below your target price.')}
          ${renderInsightCard('Top shelf', getTopShelfGames().length.toString(), 'Favorites and standout owned games that deserve a hero row.')}
        </div>
      </section>

      ${renderCollectionIdentityCard()}

      <section class="smart-grid smart-grid--secondary">
        ${renderSmartList('Top shelf', getTopShelfGames(), 'Favorite or own some games to build your brag shelf.')}
        ${renderSmartList('Price alert hits', alertMatches, 'Set a target price on wanted games to surface deals here.')}
        ${renderConsolePush('Close to completion', nearCompleteConsoles, 'Own some games on a console and this will surface the easiest set to finish next.')}
      </section>

      ${renderAchievementStrip()}
      ${renderTodayHunt()}
      ${renderRetentionRecap()}
      ${renderBadgePreview()}
      ${renderNewsletterCapture()}

      <section class="roadmap-strip">
        <article class="roadmap-card">
          <h3>Collector-first browsing</h3>
          <p>Browse clean cover grids, jump between console libraries, and see owned, wanted, favorite, loose, CIB, sealed, graded, paid-price, and alert states without losing the thread of the hunt.</p>
        </article>
        <article class="roadmap-card">
          <h3>Account-backed collection sync</h3>
          <p>Sign in to protect your collection, wishlist, paid prices, favorites, alerts, barcode links, notes, profile details, and regional library progress across devices.</p>
        </article>
      </section>
      <footer class="app-footer">
        <a href="${appConfig.supportUrl}" target="_blank" rel="noreferrer">Support</a>
        <a href="${appConfig.privacyUrl}" target="_blank" rel="noreferrer">Privacy</a>
        <span>${appConfig.marketDisclaimer}</span>
        <span>Cover artwork is used for game identification with visible source links; rights remain with their owners.</span>
      </footer>
      ${renderScannerModal()}
      ${renderSelectedGameModal()}
      ${renderOwnershipPickerModal()}
      ${renderCustomEntryModal()}
      ${renderBadgesModal()}
      ${renderAuthModal()}
    </div>
  `

  bindEvents()
  restoreFocusSnapshot(focusSnapshot)
  void syncLiveBarcodeScan()
}

function render() {
  if (renderFrame) {
    window.cancelAnimationFrame(renderFrame)
  }

  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = 0
    renderNow()
  })
}

function renderCatalogOnlyNow() {
  const catalog = getCatalog()
  const filteredGames = getFilteredGames()
  const visibleGames = filteredGames.slice(0, state.visibleGameCount)
  const controlSummary = app.querySelector('.control-summary')
  const filters = app.querySelector('.filters')
  const catalogSection = app.querySelector('.catalog-section')
  const viewSummary = app.querySelector('.view-summary')
  const backdrop = app.querySelector('.collection-backdrop')
  const toolbarConsole = app.querySelector<HTMLSelectElement>('#console-filter')
  const toolbarRegion = app.querySelector<HTMLSelectElement>('#region-filter')
  const toolbarSort = app.querySelector<HTMLSelectElement>('#sort-mode')
  const toolbarYear = app.querySelector<HTMLSelectElement>('#year-filter')

  if (!controlSummary || !filters || !catalogSection || !viewSummary) {
    render()
    return
  }

  controlSummary.outerHTML = renderControlSummary(filteredGames.length, visibleGames.length)
  viewSummary.outerHTML = renderViewSummary(filteredGames)
  filters.outerHTML = renderFiltersSection()
  catalogSection.outerHTML = renderCatalogSection(filteredGames, visibleGames)

  const nextBackdropMarkup = renderBackdropWall(visibleGames, catalog)

  if (backdrop && nextBackdropMarkup) {
    backdrop.outerHTML = nextBackdropMarkup
  } else if (backdrop && !nextBackdropMarkup) {
    backdrop.remove()
  } else if (!backdrop && nextBackdropMarkup) {
    app.insertAdjacentHTML('afterbegin', nextBackdropMarkup)
  }

  if (toolbarConsole) {
    toolbarConsole.value = state.consoleFilter
  }

  if (toolbarRegion) {
    toolbarRegion.value = state.regionFilter
  }

  if (toolbarSort) {
    toolbarSort.value = state.sortMode
  }

  if (toolbarYear) {
    toolbarYear.value = state.yearFilter
  }

  if (pendingCatalogScrollRestore !== null) {
    window.scrollTo({ top: pendingCatalogScrollRestore, behavior: 'auto' })
    pendingCatalogScrollRestore = null
  }
}

function renderCatalogOnly() {
  if (renderFrame) {
    window.cancelAnimationFrame(renderFrame)
  }

  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = 0
    renderCatalogOnlyNow()
  })
}

function scheduleSearchRender(value: string) {
  state.search = value
  resetVisibleGameCount()

  if (pendingSearchRender) {
    window.clearTimeout(pendingSearchRender)
  }

  pendingSearchRender = window.setTimeout(() => {
    pendingSearchRender = 0
    renderCatalogOnly()
  }, SEARCH_RENDER_DELAY_MS)
}

function scheduleBarcodeSearchRender(value: string) {
  state.barcodeSearch = value

  if (pendingBarcodeSearchRender) {
    window.clearTimeout(pendingBarcodeSearchRender)
  }

  pendingBarcodeSearchRender = window.setTimeout(() => {
    pendingBarcodeSearchRender = 0
    render()
  }, 140)
}

function bindEvents() {
  if (appEventsBound) {
    return
  }

  appEventsBound = true

  app.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement

    if (target.id === 'search-input') {
      rememberInputFocus(target)
      scheduleSearchRender(target.value)
    } else if (target.id === 'barcode-search') {
      rememberInputFocus(target)
      scheduleBarcodeSearchRender(target.value)
    } else if (target.closest('[data-custom-entry-form]')) {
      updateCustomEntryCoverPreview(target.form)
    }
  })

  app.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement

      if (!(target instanceof HTMLImageElement)) {
        return
      }

      const fallbackSrc = target.dataset.fallbackSrc || getCoverFallbackDataUri({
        id: target.dataset.fallbackCustom === 'true' ? 'custom-image-error' : 'catalog-image-error',
        title: target.dataset.fallbackTitle || target.alt.replace(/\s+cover art$/i, '') || 'Retro game',
        console: target.dataset.fallbackConsole || 'Retro console',
        year: null,
        region: target.dataset.fallbackRegion || '',
        coverUrl: '',
        priceLoose: 0,
        priceComplete: null,
        priceSourceUrl: 'https://www.retrovaultelite.com/custom-entry',
        coverSourceUrl: 'https://www.retrovaultelite.com/custom-entry',
        trendDelta: 0,
        rarity: 'Classic',
      })

      if (target.src === fallbackSrc) {
        return
      }

      target.src = fallbackSrc
      target.classList.add('is-fallback-cover')
    },
    true,
  )

  app.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement

    void handleFormControlChange(target)
  })

  app.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement

    if (form.matches('[data-newsletter-form]')) {
      event.preventDefault()
      void handleNewsletterForm(form)
      return
    }

    if (form.matches('[data-custom-entry-form]')) {
      event.preventDefault()
      handleCustomEntryForm(form)
      return
    }

    if (!form.matches('[data-auth-form]')) {
      return
    }

    event.preventDefault()
    void handleAuthForm(form)
  })

  app.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const actionElement = target.closest<HTMLElement>('[data-action]')

    if (actionElement) {
      if (actionElement.classList.contains('game-modal-backdrop') && target !== actionElement) {
        return
      }

      void handleAction(actionElement)
      return
    }

    const card = target.closest<HTMLElement>('.game-card[data-id]')

    if (!card || target.closest('.card-actions')) {
      return
    }

    state.selectedGameId = resolveGameId(card.dataset.id) ?? null
    render()
  }, { capture: true })

  app.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const target = event.target as HTMLElement
    const card = target.closest<HTMLElement>('.game-card[data-id]')

    if (!card || target.closest('.card-actions')) {
      return
    }

    event.preventDefault()
    state.selectedGameId = resolveGameId(card.dataset.id) ?? null
    render()
  })
}

async function handleFormControlChange(target: HTMLInputElement | HTMLSelectElement) {
  if (target.id === 'console-filter') {
    state.consoleFilter = target.value
    resetVisibleGameCount()
    await ensureConsoleCatalogLoaded(state.consoleFilter)
    renderCatalogOnly()
    return
  }

  if (target.id === 'region-filter') {
    state.regionFilter = target.value

    if (state.regionFilter !== 'All regions' && state.consoleFilter !== 'All consoles') {
      const selectedConsole = getConsoleMeta(state.consoleFilter)

      if (selectedConsole && selectedConsole.region !== state.regionFilter) {
        state.consoleFilter = 'All consoles'
      }
    }

    resetVisibleGameCount()
    await ensureRegionCatalogsLoaded(state.regionFilter)
    renderCatalogOnly()
    return
  }

  if (target.id === 'sort-mode') {
    state.sortMode = target.value as SortMode
    resetVisibleGameCount()
    renderCatalogOnly()
    return
  }

  if (target.id === 'year-filter') {
    state.yearFilter = target.value
    resetVisibleGameCount()
    renderCatalogOnly()
    return
  }

  if (target.id === 'currency-code') {
    state.currencyCode = target.value
    saveCurrencyCode()
    render()
    return
  }

  if (target.id === 'barcode-file-input' && target instanceof HTMLInputElement) {
    const file = target.files?.[0]

    if (!file) {
      return
    }

    await detectBarcodeFromFile(file)
    target.value = ''
    return
  }

  if (target.id === 'catalog-import' && target instanceof HTMLInputElement) {
    await importCatalogFile(target)
  }
}

async function importCatalogFile(input: HTMLInputElement) {
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const content = await file.text()
    const parsed = JSON.parse(content)

    if (!Array.isArray(parsed)) {
      throw new Error('The JSON file must contain an array of games.')
    }

    const imported = parsed.map(normalizeCatalogEntry).filter(isCatalogEntry)
    const restoredRecords = new Map<string, GameRecord>()

    for (const item of parsed) {
      const catalogEntry = normalizeCatalogEntry(item)

      if (!catalogEntry) {
        continue
      }

      const restoredRecord = normalizeGameRecord(item)

      if (hasMeaningfulRecord(restoredRecord)) {
        restoredRecords.set(catalogEntry.id, restoredRecord)
      }
    }

    if (!imported.length) {
      throw new Error('No valid games were found in the file.')
    }

    state.customCatalog = dedupeCatalog([...state.customCatalog, ...imported])
    for (const [id, record] of restoredRecords) {
      state.library[id] = mergeGameRecord(state.library[id], record)
    }
    invalidateCatalogCache()
    saveCustomCatalog()
    saveLibrary()
    render()
    alert(`Imported ${imported.length} games and restored ${restoredRecords.size} collection record${restoredRecords.size === 1 ? '' : 's'} into Retro Vault Elite.`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed.'
    alert(message)
  } finally {
    input.value = ''
  }
}

function handleCustomEntryForm(form: HTMLFormElement) {
  try {
    const formData = new FormData(form)
    const title = getFormText(formData, 'title')
    const consoleName = getFormText(formData, 'console')
    const region = getFormText(formData, 'region')
    const year = getOptionalYear(formData, 'year')
    const priceLoose = getOptionalPrice(formData, 'priceLoose') ?? 0
    const priceComplete = getOptionalPrice(formData, 'priceComplete')
    const coverUrlInput = getFormText(formData, 'coverUrl')
    const coverUrl = coverUrlInput ? normalizeCustomCoverUrl(coverUrlInput) : ''
    const status = getCustomEntryStatus(getFormText(formData, 'status'))
    const editionStatus = getCustomEntryEdition(getFormText(formData, 'editionStatus'))
    const notes = getFormText(formData, 'notes')

    if (!title || !consoleName || !region) {
      state.customEntryError = 'Add a title, console, and region.'
      render()
      return
    }

    if (year === undefined) {
      state.customEntryError = 'Use a four digit release year or leave it blank.'
      render()
      return
    }

    if (coverUrlInput && !coverUrl) {
      state.customEntryError = 'Use a valid https image URL, or leave the cover blank for now.'
      render()
      return
    }

    const draftEntry = createCustomCatalogEntry({
      title,
      consoleName,
      region,
      year,
      priceLoose,
      priceComplete,
      coverUrl,
    })
    const existingEntry = getCatalog().find((entry) => getCatalogDedupeKey(entry) === getCatalogDedupeKey(draftEntry))
    const entry = existingEntry ?? draftEntry

    if (!existingEntry) {
      state.customCatalog = dedupeCatalog([...state.customCatalog, entry])
      saveCustomCatalog()
      invalidateCatalogCache()
    }

    state.customEntryOpen = false
    state.customEntryError = ''
    state.search = title
    state.consoleFilter = consoleName
    state.regionFilter = region
    state.ownershipFilter = status === 'missing' ? 'all' : status
    resetVisibleGameCount()

    if (status === 'missing') {
      saveLibrary()
      render()
      return
    }

    setRecord(entry.id, (record) => {
      const completeInBox = editionStatus === 'cib' || editionStatus === 'sealed' || editionStatus === 'graded'

      return {
        ...record,
        status,
        completeInBox: status === 'owned' && completeInBox,
        editionStatus,
        notes: notes || record.notes,
        ownedCopies: status === 'owned' ? Math.max(1, record.ownedCopies || 1) : record.ownedCopies,
      }
    })
  } catch (error) {
    state.customEntryError = error instanceof Error ? error.message : 'Could not save that custom entry. Please try again.'
    render()
  }
}

function updateCustomEntryCoverPreview(form: HTMLFormElement | null) {
  if (!form) {
    return
  }

  const formData = new FormData(form)
  const title = getFormText(formData, 'title')
  const consoleName = getFormText(formData, 'console')
  const region = getFormText(formData, 'region')
  const coverUrlInput = getFormText(formData, 'coverUrl')
  const coverUrl = coverUrlInput ? normalizeCustomCoverUrl(coverUrlInput) : ''
  const previewGame = createCustomEntryPreviewGame(title, consoleName, region)
  const fallbackSrc = getCoverFallbackDataUri(previewGame)
  const previewImage = form.querySelector<HTMLImageElement>('[data-custom-entry-cover-preview]')
  const previewStatus = form.querySelector<HTMLElement>('[data-custom-entry-cover-status]')

  if (!previewImage) {
    return
  }

  previewImage.classList.remove('is-fallback-cover')
  previewImage.dataset.fallbackSrc = fallbackSrc
  previewImage.alt = `${previewGame.title} cover preview`
  previewImage.src = coverUrl || fallbackSrc

  if (previewStatus) {
    previewStatus.textContent = coverUrl
      ? 'Trusted external image URL selected.'
      : 'Generated cover tile. Add an image URL whenever you have one.'
  }
}

function createCustomEntryPreviewGame(title: string, consoleName: string, region: string) {
  return {
    id: 'custom-preview',
    title,
    console: consoleName,
    year: null,
    region,
    coverUrl: '',
    priceLoose: 0,
    priceComplete: null,
    priceSourceUrl: 'https://www.retrovaultelite.com/custom-entry',
    coverSourceUrl: 'https://www.retrovaultelite.com/custom-entry',
    trendDelta: 0,
    rarity: 'Classic',
  } satisfies CatalogEntry
}

function getFormText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function getOptionalPrice(formData: FormData, name: string) {
  const value = getFormText(formData, name)

  if (!value) {
    return null
  }

  const parsed = Number(value.replace(/[$,]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
}

function getOptionalYear(formData: FormData, name: string) {
  const value = getFormText(formData, name)

  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1950 && parsed <= new Date().getFullYear() + 2 ? parsed : undefined
}

function getCustomEntryStatus(value: string): GameStatus {
  return value === 'wanted' || value === 'missing' || value === 'owned' ? value : 'owned'
}

function getCustomEntryEdition(value: string): EditionStatus {
  return isEditionStatus(value) ? value : 'loose'
}

function createCustomCatalogEntry(options: {
  title: string
  consoleName: string
  region: string
  year: number | null
  priceLoose: number
  priceComplete: number | null
  coverUrl: string
}) {
  const baseId = ['custom', options.consoleName, options.title, options.region].map(slugifyCustomValue).filter(Boolean).join('-')
  const existingIds = new Set(getCatalog().map((entry) => entry.id))
  let id = baseId || `custom-entry-${Date.now()}`
  let suffix = 2

  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  return {
    id,
    title: options.title,
    console: options.consoleName,
    year: options.year,
    region: options.region,
    coverUrl: options.coverUrl,
    priceLoose: options.priceLoose,
    priceComplete: options.priceComplete,
    priceSourceUrl: 'https://www.retrovaultelite.com/custom-entry',
    coverSourceUrl: 'https://www.retrovaultelite.com/custom-entry',
    trendDelta: 0,
    rarity: 'Classic',
  } satisfies CatalogEntry
}

function dedupeCatalog(entries: CatalogEntry[]) {
  return [...new Map(entries.map((entry) => [getCatalogDedupeKey(entry), entry])).values()]
}

function getCatalogDedupeKey(entry: CatalogEntry) {
  return [entry.title, entry.console, entry.region].map(normalizeSearchText).join('|')
}

async function handleAction(element: HTMLElement) {
  const action = element.dataset.action
  const id = resolveGameId(element.dataset.id)

  switch (action) {
    case 'toggle-owned':
      if (!id) {
        return
      }

      if (getRecord(id).status === 'owned') {
        setRecord(id, (record) => ({
          ...record,
          status: 'missing',
          ownedCopies: 1,
        }))
      } else {
        state.ownershipPickerGameId = id
        state.selectedGameId = null
        render()
      }
      break
    case 'confirm-owned': {
      if (!id) {
        return
      }

      const edition = element.dataset.edition

      if (!isEditionStatus(edition)) {
        return
      }

      markGameOwned(id, edition)
      break
    }
    case 'close-ownership-picker':
      state.ownershipPickerGameId = null
      render()
      break
    case 'toggle-wanted':
      if (!id) {
        return
      }

      setRecord(id, (record) => ({
        ...record,
        status: record.status === 'wanted' ? 'missing' : 'wanted',
        completeInBox: record.status === 'wanted' ? record.completeInBox : false,
      }))
      break
    case 'toggle-favorite':
      if (!id) {
        return
      }

      setRecord(id, (record) => ({
        ...record,
        favorite: !record.favorite,
      }))
      break
    case 'toggle-cib':
      if (!id) {
        return
      }

      setRecord(id, (record) => ({
        ...record,
        status: record.status === 'missing' ? 'owned' : record.status,
        completeInBox: !record.completeInBox,
      }))
      break
    case 'set-price-paid':
      if (!id) {
        return
      }

      updatePricePaid(id)
      break
    case 'open-scanner':
      stopLiveBarcodeScan()
      state.scannerOpen = true
      state.scannerLiveActive = false
      state.scannerStatus = 'Scan a barcode with your camera or upload a clear barcode photo.'
      render()
      break
    case 'open-custom-entry':
      state.customEntryOpen = true
      state.customEntryError = ''
      render()
      break
    case 'close-custom-entry':
      state.customEntryOpen = false
      state.customEntryError = ''
      render()
      break
    case 'browse-library':
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    case 'daily-console': {
      const consoleName = element.dataset.console

      if (!consoleName) {
        return
      }

      state.consoleFilter = consoleName
      state.ownershipFilter = 'missing'
      state.sortMode = 'complete-high'
      resetVisibleGameCount()
      await ensureConsoleCatalogLoaded(consoleName)
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
    case 'close-scanner':
      stopLiveBarcodeScan()
      state.scannerOpen = false
      state.scannerLiveActive = false
      state.barcodeLinkCode = null
      state.barcodeSearch = ''
      render()
      break
    case 'start-live-barcode':
      if (!canUseLiveBarcodeCamera()) {
        state.scannerStatus = 'Live camera scanning is not supported in this browser. Try a photo or manual entry.'
        render()
        return
      }

      stopLiveBarcodeScan()
      state.scannerLiveActive = true
      state.scannerStatus = 'Point the camera at the barcode and hold still for a moment.'
      render()
      break
    case 'stop-live-barcode':
      stopLiveBarcodeScan()
      state.scannerLiveActive = false
      state.scannerStatus = 'Live camera stopped. You can upload a photo or enter the barcode manually.'
      render()
      break
    case 'manual-barcode':
      await enterBarcodeManually()
      break
    case 'link-barcode':
      if (!id || !state.barcodeLinkCode) {
        return
      }

      await linkBarcodeToGame(state.barcodeLinkCode, id)
      break
    case 'open-register':
      openAuthView('register')
      break
    case 'open-login':
      openAuthView('login')
      break
    case 'open-reset':
      openAuthView('reset')
      break
    case 'open-account-settings':
      openAuthView('account')
      break
    case 'close-auth':
      if (state.authLoading) {
        return
      }

      state.authView = 'none'
      clearAuthFeedback()
      render()
      break
    case 'logout-account':
      await logoutCurrentAccount()
      break
    case 'change-password':
      await changePasswordWithPrompt()
      break
    case 'delete-account':
      await deleteCurrentAccount()
      break
    case 'sync-now':
      await syncToCloud()
      break
    case 'set-target-price':
      if (!id) {
        return
      }

      updateTargetPrice(id)
      break
    case 'set-edition':
      if (!id) {
        return
      }

      updateEditionStatus(id)
      break
    case 'set-copies':
      if (!id) {
        return
      }

      updateOwnedCopies(id)
      break
    case 'set-condition':
      if (!id) {
        return
      }

      updateCondition(id)
      break
    case 'edit-notes':
      if (!id) {
        return
      }

      updateNotes(id)
      break
    case 'open-details':
      if (!id) {
        return
      }

      state.selectedGameId = id
      render()
      break
    case 'close-details':
      state.selectedGameId = null
      render()
      break
    case 'open-badges':
      state.badgesOpen = true
      render()
      break
    case 'close-badges':
      state.badgesOpen = false
      render()
      break
    case 'ownership-filter': {
      const filter = element.dataset.filter as OwnershipFilter | undefined

      if (!filter) {
        return
      }

      state.ownershipFilter = filter
      if (element.textContent?.toLowerCase().includes('grail')) {
        state.sortMode = 'complete-high'
      }
      resetVisibleGameCount()
      renderCatalogOnly()
      break
    }
    case 'load-more-games':
      pendingCatalogScrollRestore = window.scrollY
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      state.visibleGameCount += getVisibleGameIncrement()
      renderCatalogOnly()
      break
    case 'reset-library':
      if (!window.confirm('Reset your local collection view? This clears owned, wanted, paid prices, notes, and favorites on this device.')) {
        return
      }

      state.library = {}
      libraryRevision += 1
      state.cachedCatalogStatsKey = ''
      state.cachedConsoleProgressKey = ''
      saveLibrary()
      render()
      break
    case 'clear-filters':
      state.search = ''
      state.regionFilter = 'All regions'
      state.consoleFilter = 'All consoles'
      state.yearFilter = 'All years'
      state.ownershipFilter = 'all'
      state.sortMode = 'title'
      resetVisibleGameCount()
      await ensureConsoleCatalogLoaded(state.consoleFilter)
      renderCatalogOnly()
      break
    case 'dismiss-onboarding':
      saveOnboardingDismissed()
      render()
      break
    case 'import-catalog':
      document.querySelector<HTMLInputElement>('#catalog-import')?.click()
      break
    case 'export-catalog':
      exportCatalog()
      break
    case 'share-recap':
      await shareCollectionRecap()
      break
    case 'share-weekly-recap':
      await shareWeeklyRecap()
      break
    case 'share-badges':
      await shareBadges()
      break
    case 'share-challenge':
      await shareCollectorChallenge()
      break
    case 'install-app':
      await promptInstall()
      break
    default:
      break
  }
}

function setRecord(id: string, updater: (record: GameRecord) => GameRecord) {
  const decodedAlias = decodeHtmlEntities(id)
  const previousBadgeIds = new Set(getUnlockedBadges().map((badge) => badge.id))
  const previousRecord = getRecord(id)
  const nextRecord = updater(previousRecord)

  state.library = {
    ...state.library,
    [id]: nextRecord,
  }

  if (decodedAlias !== id) {
    delete state.library[decodedAlias]
  }

  libraryRevision += 1
  state.cachedCatalogStatsKey = ''
  state.cachedConsoleProgressKey = ''
  recordCollectionActivity(id, previousRecord, nextRecord)
  recordNewBadgeUnlocks(previousBadgeIds)
  saveLibrary()
  render()
}

function recordCollectionActivity(id: string, previousRecord: GameRecord, nextRecord: GameRecord) {
  const game = getGameById(id)
  const title = game?.title ?? id

  if (previousRecord.status !== 'owned' && nextRecord.status === 'owned') {
    addActivityEvent({
      type: 'owned_added',
      gameId: id,
      title: 'Game added to collection',
      detail: `${title} joined the vault as ${getEditionLabel(nextRecord.editionStatus)}.`,
    })
  }

  if (previousRecord.status !== 'wanted' && nextRecord.status === 'wanted') {
    addActivityEvent({
      type: 'wanted_added',
      gameId: id,
      title: 'Wanted game added',
      detail: `${title} was added to the hunt list.`,
    })
  }

  if (!isCompleteEdition(previousRecord) && isCompleteEdition(nextRecord)) {
    addActivityEvent({
      type: 'cib_upgraded',
      gameId: id,
      title: 'Condition upgraded',
      detail: `${title} is now tracked as ${getEditionLabel(nextRecord.editionStatus)}.`,
    })
  }

  if (previousRecord.pricePaid === null && nextRecord.pricePaid !== null) {
    addActivityEvent({
      type: 'paid_price_added',
      gameId: id,
      title: 'Paid price tracked',
      detail: `${title} now has a paid price for market edge tracking.`,
    })
  }

  if (!previousRecord.favorite && nextRecord.favorite) {
    addActivityEvent({
      type: 'favorite_added',
      gameId: id,
      title: 'Top shelf pick',
      detail: `${title} was added to the showcase shelf.`,
    })
  }

  if (previousRecord.targetPrice === null && nextRecord.targetPrice !== null) {
    addActivityEvent({
      type: 'target_price_added',
      gameId: id,
      title: 'Deal target set',
      detail: `${title} now has a wishlist target price.`,
    })
  }
}

function recordNewBadgeUnlocks(previousBadgeIds: Set<string>) {
  for (const badge of getUnlockedBadges()) {
    if (previousBadgeIds.has(badge.id)) {
      continue
    }

    addActivityEvent({
      type: 'badge_unlocked',
      title: 'Badge unlocked',
      detail: `${badge.title}: ${badge.detail}`,
    })
  }
}

function markGameOwned(id: string, editionStatus: EditionStatus) {
  const completeInBox = editionStatus === 'cib' || editionStatus === 'sealed' || editionStatus === 'graded'

  state.ownershipPickerGameId = null
  state.justOwnedGameId = id

  setRecord(id, (record) => ({
    ...record,
    status: 'owned',
    editionStatus,
    completeInBox,
    ownedCopies: Math.max(1, record.ownedCopies || 1),
  }))

  window.setTimeout(() => {
    if (state.justOwnedGameId === id) {
      state.justOwnedGameId = null
      render()
    }
  }, 1300)
}

function updatePricePaid(id: string) {
  const current = getRecord(id)
  const selectedCurrency = getSelectedCurrency()
  const currentValue = current.pricePaid === null ? '' : convertUsdAmount(current.pricePaid).toFixed(2)
  const response = window.prompt(
    `Enter the price you paid in ${selectedCurrency.code}. Leave blank to clear it.`,
    currentValue,
  )

  if (response === null) {
    return
  }

  const trimmed = response.trim()

  if (!trimmed) {
    setRecord(id, (record) => ({ ...record, pricePaid: null }))
    return
  }

  const value = Number(trimmed)

  if (Number.isNaN(value) || value < 0) {
    window.alert('Please enter a valid positive number.')
    return
  }

  const usdValue = selectedCurrency.code === 'USD' ? value : (value / selectedCurrency.perEuro) * currencyOptions[0].perEuro

  setRecord(id, (record) => ({
    ...record,
    status: record.status === 'missing' ? 'owned' : record.status,
    pricePaid: usdValue,
  }))
}

function updateTargetPrice(id: string) {
  const current = getRecord(id)
  const selectedCurrency = getSelectedCurrency()
  const currentValue = current.targetPrice === null ? '' : convertUsdAmount(current.targetPrice).toFixed(2)
  const response = window.prompt(
    `Enter your target buy price in ${selectedCurrency.code}. Leave blank to clear it.`,
    currentValue,
  )

  if (response === null) {
    return
  }

  const trimmed = response.trim()

  if (!trimmed) {
    setRecord(id, (record) => ({ ...record, targetPrice: null }))
    return
  }

  const value = Number(trimmed)

  if (Number.isNaN(value) || value < 0) {
    window.alert('Please enter a valid positive number.')
    return
  }

  const usdValue = selectedCurrency.code === 'USD' ? value : (value / selectedCurrency.perEuro) * currencyOptions[0].perEuro

  setRecord(id, (record) => ({
    ...record,
    status: record.status === 'missing' ? 'wanted' : record.status,
    targetPrice: usdValue,
  }))
}

function updateOwnedCopies(id: string) {
  const current = getRecord(id)
  const response = window.prompt(
    'How many copies of this game do you own? Use notes for copy-specific details like one loose and one CIB.',
    String(getOwnedCopyCount(current)),
  )

  if (response === null) {
    return
  }

  const value = Number(response.trim())

  if (!Number.isInteger(value) || value < 1 || value > 99) {
    window.alert('Please enter a whole number from 1 to 99.')
    return
  }

  setRecord(id, (record) => ({
    ...record,
    status: 'owned',
    ownedCopies: value,
  }))
}

function updateEditionStatus(id: string) {
  const current = getRecord(id)
  const response = window.prompt(
    `Choose edition: ${editionOptions.join(', ')}`,
    current.editionStatus,
  )

  if (response === null) {
    return
  }

  const next = response.trim().toLowerCase()

  if (!isEditionStatus(next)) {
    window.alert('Please enter one of: loose, boxed, manual, cib, sealed, graded.')
    return
  }

  setRecord(id, (record) => ({
    ...record,
    editionStatus: next,
    completeInBox: next === 'cib' || next === 'sealed' || next === 'graded',
  }))
}

function updateCondition(id: string) {
  const current = getRecord(id)
  const response = window.prompt(
    `Choose condition: ${conditionOptions.join(', ')}`,
    current.condition,
  )

  if (response === null) {
    return
  }

  const next = response.trim().toLowerCase()

  if (!isConditionRating(next)) {
    window.alert('Please enter one of: mint, excellent, good, fair.')
    return
  }

  setRecord(id, (record) => ({
    ...record,
    condition: next,
  }))
}

function updateNotes(id: string) {
  const current = getRecord(id)
  const response = window.prompt('Add collector notes for this game.', current.notes)

  if (response === null) {
    return
  }

  setRecord(id, (record) => ({
    ...record,
    notes: response.trim(),
  }))
}

function openAuthView(view: AuthView) {
  clearAuthFeedback()
  state.authView = view
  render()
}

function validateAuthEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address.'
}

function validateAuthPassword(password: string) {
  if (password.length < 8) {
    return 'Use at least 8 characters.'
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number.'
  }

  return ''
}

function getFriendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'

  if (message.toLowerCase().includes('no account was found')) {
    return 'No account was found for that email. If you created it before, the hosted backend may have reset. Tap "Create or recover account" and use the same email to sync the collection saved on this device.'
  }

  if (message.toLowerCase().includes('could not reach')) {
    return 'Retro Vault sync could not be reached. Your collection is still safe on this device; try again in a moment.'
  }

  if (message.toLowerCase().includes('failed to fetch')) {
    return 'Network connection failed. Check the backend is awake, then try again.'
  }

  return message
}

async function handleAuthForm(form: HTMLFormElement) {
  if (state.authLoading) {
    return
  }

  const formType = form.dataset.authForm
  const formData = new FormData(form)
  clearAuthFeedback()
  state.authLoading = true
  render()

  try {
    if (formType === 'register') {
      const displayName = String(formData.get('displayName') ?? '').trim()
      const email = String(formData.get('email') ?? '').trim().toLowerCase()
      const password = String(formData.get('password') ?? '')
      state.authEmailDraft = email
      const emailError = validateAuthEmail(email)
      const passwordError = validateAuthPassword(password)

      if (emailError || passwordError) {
        throw new Error(emailError || passwordError)
      }

      const payload = await registerAccount(email, password, displayName)
      saveAuthToken(payload.token)
      saveAuthProfile(payload.user.email, payload.user.displayName ?? displayName)
      state.syncStatus = 'Syncing your collection...'
      state.authSuccess = 'Account created. Your collection is being synced.'
      applyRemoteSyncState(payload.syncState, { mergeWithLocal: true })
      await syncToCloud()
      state.syncStatus = 'Your collection is synced to your account'
      state.authView = 'none'
      return
    }

    if (formType === 'login') {
      const email = String(formData.get('email') ?? '').trim().toLowerCase()
      const password = String(formData.get('password') ?? '')
      state.authEmailDraft = email
      const emailError = validateAuthEmail(email)

      if (emailError) {
        throw new Error(emailError)
      }

      const payload = await loginAccount(email, password)
      saveAuthToken(payload.token)
      saveAuthProfile(payload.user.email, payload.user.displayName ?? '')
      applyRemoteSyncState(payload.syncState, { mergeWithLocal: true })
      await syncToCloud()
      state.syncStatus = 'Your collection is synced to your account'
      state.authSuccess = 'Signed in successfully.'
      state.authView = 'none'
      return
    }

    if (formType === 'reset') {
      const email = String(formData.get('email') ?? '').trim().toLowerCase()
      state.authEmailDraft = email
      const emailError = validateAuthEmail(email)

      if (emailError) {
        throw new Error(emailError)
      }

      const response = await requestPasswordReset(email)
      state.authSuccess = response.message
      return
    }

    if (formType === 'confirm-reset') {
      const password = String(formData.get('password') ?? '')
      const passwordError = validateAuthPassword(password)

      if (passwordError) {
        throw new Error(passwordError)
      }

      await confirmPasswordReset(state.resetToken, password)
      state.resetToken = ''
      window.history.replaceState({}, document.title, window.location.pathname)
      state.authSuccess = 'Password reset. You can sign in now.'
      state.authView = 'login'
      return
    }

    if (formType === 'account') {
      if (!state.authToken) {
        clearExpiredAccountSession('Please sign in again before updating account settings.')
        throw new Error('Sign in before updating account settings.')
      }

      const displayName = String(formData.get('displayName') ?? '').trim()
      const payload = await updateAccountProfile(state.authToken, displayName)
      saveAuthProfile(payload.user.email, payload.user.displayName ?? displayName)
      applyRemoteSyncState(payload.syncState)
      state.authSuccess = 'Account settings saved.'
      state.syncStatus = 'Your collection is synced to your account'
      return
    }
  } catch (error) {
    state.authError = getFriendlyAuthError(error)
  } finally {
    state.authLoading = false
    render()
  }
}

async function handleNewsletterForm(form: HTMLFormElement) {
  const formData = new FormData(form)
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const emailError = validateAuthEmail(email)

  if (emailError) {
    state.newsletterStatus = emailError
    render()
    return
  }

  state.newsletterStatus = 'Joining the weekly movers list...'
  render()

  try {
    const response = await subscribeToNewsletter(email, 'app-dashboard')
    state.newsletterStatus = response.message
  } catch (error) {
    state.newsletterStatus = getFriendlyAuthError(error)
  }

  render()
}

async function logoutCurrentAccount() {
  if (!state.authToken) {
    return
  }

  state.authLoading = true
  state.syncStatus = 'Signing out...'
  render()

  try {
    await logoutAccount(state.authToken)
  } catch {
    // even if logout request fails, clear the local token
  }

  clearAuthToken()
  clearAuthProfile()
  resetLocalCollectionState()
  state.syncStatus = 'Signed out'
  state.authView = 'none'
  state.authLoading = false
  render()
}

async function changePasswordWithPrompt() {
  if (!state.authToken || state.authLoading) {
    return
  }

  const currentPassword = window.prompt('Enter your current password.')

  if (!currentPassword) {
    return
  }

  const nextPassword = window.prompt('Enter your new password. Use at least 8 characters with one letter and one number.')

  if (!nextPassword) {
    return
  }

  const passwordError = validateAuthPassword(nextPassword)

  if (passwordError) {
    state.authError = passwordError
    render()
    return
  }

  state.authLoading = true
  clearAuthFeedback()
  render()

  try {
    await changePassword(state.authToken, currentPassword, nextPassword)
    state.authSuccess = 'Password changed successfully.'
  } catch (error) {
    state.authError = error instanceof Error ? error.message : 'Password change failed.'
  } finally {
    state.authLoading = false
    render()
  }
}

async function deleteCurrentAccount() {
  if (!state.authToken || state.authLoading) {
    return
  }

  const confirmed = window.confirm('Delete your Retro Vault Elite account and synced collection data? This cannot be undone.')

  if (!confirmed) {
    return
  }

  state.authLoading = true
  clearAuthFeedback()
  render()

  try {
    await deleteAccount(state.authToken)
    clearAuthToken()
    clearAuthProfile()
    resetLocalCollectionState()
    state.syncStatus = 'Account deleted'
    state.authView = 'none'
  } catch (error) {
    state.authError = error instanceof Error ? error.message : 'Account deletion failed.'
  } finally {
    state.authLoading = false
    render()
  }
}

async function enterBarcodeManually() {
  const response = window.prompt('Enter the UPC or barcode number.')

  if (!response) {
    return
  }

  await handleBarcodeDetected(normalizeBarcodeValue(response))
}

async function detectBarcodeFromFile(file: File) {
  stopLiveBarcodeScan()
  state.scannerLiveActive = false
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('That image could not be read. Try another photo or use manual entry.'))
      image.src = objectUrl
    })

    const result = await getBarcodeReader().decodeFromImageElement(image)
    const code = normalizeBarcodeValue(result.getText())

    if (!code) {
      state.scannerStatus = 'No barcode was detected in that image. Try another photo or use manual entry.'
      render()
      return
    }

    await handleBarcodeDetected(code)
  } catch (error) {
    state.scannerStatus = error instanceof Error ? error.message : 'Barcode detection failed. Try another photo or use manual entry.'
    render()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function handleBarcodeDetected(code: string) {
  const normalizedCode = normalizeBarcodeValue(code)

  if (!normalizedCode) {
    state.scannerStatus = 'Enter a valid barcode number.'
    render()
    return
  }

  const mappedGameId = state.barcodeMappings[normalizedCode]

  state.scannerOpen = true
  state.barcodeLinkCode = normalizedCode
  state.barcodeSearch = ''

  if (mappedGameId) {
    const game = getGameById(mappedGameId)

    if (game) {
      state.scannerStatus = `Matched ${game.title}.`
      state.selectedGameId = game.id
      render()
      return
    }
  }

  try {
    const remoteMatch = await lookupBarcodeMapping(normalizedCode, state.authToken || undefined)

    if (remoteMatch.gameId) {
      state.barcodeMappings = {
        ...state.barcodeMappings,
        [normalizedCode]: remoteMatch.gameId,
      }
      saveBarcodeMappings()

      const game = getGameById(remoteMatch.gameId)

      if (game) {
        state.scannerStatus =
          remoteMatch.source === 'account'
            ? `Matched ${game.title} from your saved barcode links.`
            : `Matched ${game.title} from the shared barcode index.`
        state.selectedGameId = game.id
        render()
        return
      }
    }
  } catch {
    // Lookup failures must never block the scanner flow.
  }

  state.scannerStatus = 'Barcode found. Search below and link it once, then it will work automatically next time.'
  render()
}

async function linkBarcodeToGame(code: string, gameId: string) {
  const normalizedCode = normalizeBarcodeValue(code)

  state.barcodeMappings = {
    ...state.barcodeMappings,
    [normalizedCode]: gameId,
  }
  saveBarcodeMappings()

  if (state.authToken) {
    try {
      await saveBarcodeMapping(state.authToken, normalizedCode, gameId)
      state.syncStatus = 'Cloud synced'
    } catch (error) {
      state.syncStatus = error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed'
    }
  }

  const game = getGameById(gameId)
  state.scannerStatus = game ? `Linked ${normalizedCode} to ${game.title}.` : 'Barcode linked.'
  state.selectedGameId = gameId
  render()
}

async function shareCollectionRecap() {
  const ownedGames = getOwnedGames()
  const wantedGames = getWantedGames()
  const rank = getCollectorRank()
  const challengeUrl = `${window.location.origin}/collector-challenge.html`
  const recap = [
    'Retro Vault Elite Collection Recap',
    `Collector rank: ${rank.title}`,
    `${ownedGames.length} owned / ${wantedGames.length} wanted`,
    `Estimated sell value: ${formatPrice(ownedGames.reduce((total, game) => total + game.priceLoose, 0))}`,
    `Collection premium: ${formatPrice(ownedGames.reduce((total, game) => total + getReferencePrice(game), 0))}`,
    ...getViralShareLines(),
    '',
    `Build your vault and compare rank: ${challengeUrl}`,
  ].join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Retro Vault Elite recap',
        text: recap,
        url: challengeUrl,
      })
      return
    } catch {
      // fall through to clipboard
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(recap)
    window.alert('Collection recap copied to your clipboard.')
    return
  }

  window.alert(recap)
}

async function shareWeeklyRecap() {
  const recapUrl = `${window.location.origin}/collector-challenge.html`
  const recap = [
    'Retro Vault Elite Weekly Recap',
    ...getWeeklyRecapLines(),
    '',
    `Build your own vault: ${recapUrl}`,
  ].join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Retro Vault Elite weekly recap',
        text: recap,
        url: recapUrl,
      })
      return
    } catch {
      // fall through to clipboard
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(recap)
    window.alert('Weekly recap copied to your clipboard.')
    return
  }

  window.alert(recap)
}

async function shareBadges() {
  const badgesUrl = `${window.location.origin}/collector-challenge.html`
  const unlockedBadges = getUnlockedBadges()
  const nextBadges = getNextBadges()
  const badgeText = [
    'Retro Vault Elite Badge Shelf',
    `${unlockedBadges.length}/${getCollectorBadges().length} badges unlocked`,
    `Collector rank: ${getCollectorRank().title}`,
    `Unlocked: ${unlockedBadges.map((badge) => badge.title).slice(0, 6).join(', ') || 'First badge still loading'}`,
    `Next target: ${nextBadges[0] ? `${nextBadges[0].title} (${nextBadges[0].progress}/${nextBadges[0].target})` : 'All badges unlocked'}`,
    '',
    `Build your own badge shelf: ${badgesUrl}`,
  ].join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Retro Vault Elite badge shelf',
        text: badgeText,
        url: badgesUrl,
      })
      return
    } catch {
      // fall through to clipboard
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(badgeText)
    window.alert('Badge shelf copied to your clipboard.')
    return
  }

  window.alert(badgeText)
}

async function shareCollectorChallenge() {
  const challengeUrl = `${window.location.origin}/collector-challenge.html`
  const shareText = [
    'I track my retro game vault on Retro Vault Elite.',
    ...getViralShareLines(),
    '',
    'Start yours, build your shelf, and compare collector rank.',
  ].join('\n')
  const clipboardText = `${shareText}\n${challengeUrl}`

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Retro Vault Elite Collector Challenge',
        text: shareText,
        url: challengeUrl,
      })
      return
    } catch {
      // fall through to clipboard
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(clipboardText)
    window.alert('Collector challenge copied to your clipboard.')
    return
  }

  window.alert(clipboardText)
}

async function promptInstall() {
  if (!deferredInstallPrompt) {
    return
  }

  await deferredInstallPrompt.prompt()
  await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  render()
}

function exportCatalog() {
  const payload: ExportEntry[] = getCatalog().map((game) => {
    const record = getRecord(game.id)

    return {
      ...game,
      status: record.status,
      completeInBox: record.completeInBox,
      pricePaid: record.pricePaid,
      favorite: record.favorite,
      ownedCopies: getOwnedCopyCount(record),
      editionStatus: record.editionStatus,
      condition: record.condition,
      targetPrice: record.targetPrice,
      notes: record.notes,
    }
  })

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'retro-vault-elite-export.json'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister()
        })
      })
      return
    }

    void navigator.serviceWorker.register('/sw.js')
  })
}

async function loadGeneratedCatalog() {
  try {
    const response = await fetch('/catalogs/retro-catalog-meta.json')

    if (!response.ok) {
      throw new Error(`Catalog request failed: ${response.status}`)
    }

    const parsed = await response.json()

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { consoles?: unknown }).consoles)) {
      throw new Error('Catalog metadata payload was invalid.')
    }

    state.catalogMeta = ((parsed as { consoles: unknown[] }).consoles as unknown[])
      .flatMap((entry) => {
        if (!entry || typeof entry !== 'object') {
          return []
        }

        const meta = entry as Record<string, unknown>

        if (
          typeof meta.console !== 'string' ||
          typeof meta.slug !== 'string' ||
          typeof meta.count !== 'number' ||
          typeof meta.file !== 'string'
        ) {
          return []
        }

        return [
          {
            console: meta.console,
            slug: meta.slug,
            count: meta.count,
            file: meta.file,
            region: typeof meta.region === 'string' ? meta.region : 'North America',
            market: typeof meta.market === 'string' ? meta.market : undefined,
          } satisfies CatalogConsoleMeta,
        ]
      })

    await ensureConsoleCatalogLoaded(state.consoleFilter)
    state.catalogLoadError = false
  } catch {
    state.generatedCatalog = []
    state.catalogMeta = []
    state.loadedConsoles = []
    state.catalogLoadError = true
  } finally {
    state.isCatalogLoading = false
    render()
  }
}

async function ensureRegionCatalogsLoaded(regionName: string) {
  if (regionName === 'All regions') {
    return
  }

  const consoles = state.catalogMeta
    .filter((entry) => entry.region === regionName)
    .map((entry) => entry.console)

  await ensureConsoleBatchLoaded(consoles, true)
}

async function ensureAllConsoleCatalogsLoaded(rerenderAfterBatch: boolean) {
  const remaining = state.catalogMeta
    .map((entry) => entry.console)
    .filter((consoleName) => !state.loadedConsoles.includes(consoleName))

  await ensureConsoleBatchLoaded(remaining, rerenderAfterBatch)
}

async function ensureConsoleBatchLoaded(consoleNames: string[], rerenderAfterBatch: boolean) {
  const batchSize = 4

  for (let index = 0; index < consoleNames.length; index += batchSize) {
    const batch = consoleNames.slice(index, index + batchSize)
    await Promise.all(batch.map((consoleName) => ensureConsoleCatalogLoaded(consoleName, false)))

    if (rerenderAfterBatch) {
      render()
    }

    await new Promise((resolve) => window.setTimeout(resolve, 0))
  }
}

async function ensureConsoleCatalogLoaded(consoleName: string, rerenderAfterLoad = true) {
  if (!state.catalogMeta.length) {
    return
  }

  if (consoleName === 'All consoles') {
    await ensureAllConsoleCatalogsLoaded(rerenderAfterLoad)
    return
  }

  if (state.loadedConsoles.includes(consoleName)) {
    return
  }

  const meta = getConsoleMeta(consoleName)

  if (!meta) {
    return
  }

  const existingLoad = pendingConsoleLoads.get(consoleName)

  if (existingLoad) {
    await existingLoad
    return
  }

  const loadPromise = (async () => {
    const response = await fetch(meta.file)

    if (!response.ok) {
      throw new Error(`Console catalog request failed: ${response.status}`)
    }

    const parsed = await response.json()

    if (!Array.isArray(parsed)) {
      throw new Error('Console catalog payload was not an array.')
    }

    const consoleEntries = parsed.map(normalizeCatalogEntry).filter(isCatalogEntry)

    state.generatedCatalog = dedupeCatalog([...state.generatedCatalog, ...consoleEntries])
    state.loadedConsoles = [...state.loadedConsoles, consoleName]
    invalidateCatalogCache()
    state.catalogLoadError = false
  })()

  pendingConsoleLoads.set(consoleName, loadPromise)

  try {
    await loadPromise
  } catch {
    state.catalogLoadError = true
  } finally {
    pendingConsoleLoads.delete(consoleName)
    if (rerenderAfterLoad) {
      render()
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

window.addEventListener('pagehide', flushLibrarySave)
window.addEventListener('pagehide', stopLiveBarcodeScan)

render()
void trackPageView(Boolean(loadAuthToken()))
void loadGeneratedCatalog()
void hydrateAccount()
void initMobileBannerAd()
