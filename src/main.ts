import './style.css'
import { playItemGet, playUnmark, playWanted } from './chiptune'
import { priceSnapshotDate, sampleCatalog, type CatalogEntry, type RarityTier, type ReleaseType } from './data'
import { appConfig } from './appConfig'
import { catalogEntryOverrides, extraCatalogEntries, getReleaseTypeLabel } from './catalogEnhancements'
import { famicomReferenceByGameId } from './famicomReference'
import {
  changePassword,
  confirmPasswordReset,
  createTradeRequest,
  getTradeAvailability,
  getTradeAvailabilityOwners,
  getTradeInboxDiscovery,
  getPublicCommunityStats,
  getTradeWantedDemand,
  getTradeableNowGameIds,
  getWantedNowGameIds,
  deleteAccount,
  deleteTradeRequest,
  deleteTradeMessage,
  getCurrentAccount,
  getTradeMatches,
  getTradeMessages,
  getTradeProfile,
  getTradeRequests,
  loginAccount,
  lookupBarcodeMapping,
  logoutAccount,
  pushSyncState,
  registerAccount,
  requestPasswordReset,
  respondToTradeRequest,
  saveBarcodeMapping,
  sendTradeMessage,
  subscribeToNewsletter,
  trackPageView,
  updateAccountProfile,
  type TradeMatch,
  type TradeAvailabilityOwner,
  type TradeInboxOpportunity,
  type TradeDiscoveryCollector,
  type TradeMessage,
  type PublicCommunityStats,
  type TradeProfile,
  type TradeRequest,
} from './backend'
import { initMobileBannerAd } from './mobileAds'

type OwnershipFilter = 'all' | 'owned' | 'wanted' | 'missing' | 'tradeable-now' | 'wanted-now'
type ReleaseTypeFilter = 'All release types' | 'Licensed' | 'Unlicensed' | 'Homebrew' | 'Custom'
type SortMode = 'title' | 'year' | 'loose-high' | 'complete-high' | 'trend-high' | 'shelf-score' | 'trade-recent'
type GameStatus = 'missing' | 'wanted' | 'owned'
type EditionStatus =
  | 'loose'
  | 'boxed'
  | 'manual'
  | 'box-only'
  | 'manual-only'
  | 'box-manual'
  | 'cib'
  | 'sealed'
  | 'graded'
type ConditionRating = 'mint' | 'excellent' | 'good' | 'fair'
type AuthView = 'none' | 'register' | 'login' | 'reset' | 'account' | 'confirm-reset'
type ImportStep = 'none' | 'preview' | 'done'
type ImportRow = {
  rawTitle: string
  rawConsole: string
  game: CatalogEntry | null
  confidence: 'exact' | 'fuzzy' | 'none'
  editionStatus: EditionStatus
  condition: ConditionRating
  pricePaid: number | null
  notes: string
  dateAcquired: string | null
  include: boolean
}
type GameCopy = {
  edition: EditionStatus
  condition: ConditionRating
  variant?: string
  gradedLabel?: string
  appraisedValue?: number | null
  pricePaid: number | null
  forTrade: boolean
}

type GameRecord = {
  status: GameStatus
  completeInBox: boolean
  pricePaid: number | null
  favorite: boolean
  ownedCopies: number
  editionStatus: EditionStatus
  condition: ConditionRating
  variant?: string
  gradedLabel?: string
  appraisedValue?: number | null
  targetPrice: number | null
  notes: string
  dateAcquired: string | null
  acquiredFrom: string
  forTrade?: boolean
  tradeListedAt?: string | null
  copies?: GameCopy[]
}

type ExportEntry = CatalogEntry & {
  status: GameStatus
  completeInBox: boolean
  pricePaid: number | null
  favorite: boolean
  ownedCopies: number
  editionStatus: EditionStatus
  condition: ConditionRating
  variant?: string
  gradedLabel?: string
  appraisedValue?: number | null
  targetPrice: number | null
  notes: string
  dateAcquired: string | null
  acquiredFrom: string
}

type Spotlight = {
  game: CatalogEntry
  label: string
  copy: string
}

type VariantTarget = {
  copyIndex: number | null
  existingVariant: string
}

type GradeTarget = {
  copyIndex: number | null
  existingLabel: string
  existingValue: number | null
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

type HeroStatsSnapshot = {
  accountEmail: string
  ownedCount: number
  wantedCount: number
  ownedTrackedValueUsd: number
  ownedCompleteValueUsd: number
  wishlistValueUsd: number
  completionPercentage: number
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

type CatalogSnapshot = {
  version: string
  savedAt: string
  metaSignature: string
  generatedCatalog: CatalogEntry[]
  catalogMeta: CatalogConsoleMeta[]
  loadedConsoles: string[]
}

type CoverMatchSuggestion = {
  gameId: string
  distance: number
}

type BarcodeReaderResult = {
  getText: () => string
}

type BarcodeScannerControls = {
  stop: () => void
}

type BarcodeReaderInstance = {
  decodeFromImageElement: (source: string | HTMLImageElement) => Promise<BarcodeReaderResult>
  decodeFromVideoDevice: (
    deviceId: string | undefined,
    previewElem: string | HTMLVideoElement | undefined,
    callbackFn: (result: BarcodeReaderResult | undefined) => void,
  ) => Promise<BarcodeScannerControls>
}

const LIBRARY_STORAGE_KEY = 'retro-game-collector-library'
const CUSTOM_STORAGE_KEY = 'retro-game-collector-custom-catalog'
const CURRENCY_STORAGE_KEY = 'retro-game-collector-currency'
const AUTH_TOKEN_STORAGE_KEY = 'retro-game-collector-auth-token'
const AUTH_PROFILE_STORAGE_KEY = 'retro-game-collector-auth-profile'
const BARCODE_STORAGE_KEY = 'retro-game-collector-barcode-mappings'
const DELETED_GAME_IDS_STORAGE_KEY = 'retro-game-collector-deleted-game-ids'
const ONBOARDING_STORAGE_KEY = 'retro-game-collector-onboarding-dismissed'
const STREAK_STORAGE_KEY = 'retro-game-collector-visit-streak'
const ACTIVITY_STORAGE_KEY = 'retro-game-collector-activity-events'
const TRADE_OPPORTUNITY_SEEN_KEY = 'retro-game-collector-trade-opportunities-seen'
const TRADE_HIDE_ARCHIVED_KEY = 'retro-game-collector-trade-hide-archived'
const PUBLIC_COMMUNITY_STATS_STORAGE_KEY = 'retro-game-collector-community-stats'
const RECENT_VIEWED_STORAGE_KEY = 'retro-game-collector-recent-viewed'
const HERO_STATS_STORAGE_KEY = 'retro-game-collector-hero-stats'
const DEFAULT_CATALOG_TOTAL_GAMES = 40593
const DEFAULT_CATALOG_TOTAL_CONSOLES = 100
const STARTUP_VISUAL_SETTLE_MS = 20000
const CATALOG_CACHE_DB_NAME = 'retro-vault-catalog-cache'
const CATALOG_CACHE_STORE = 'snapshots'
const COVER_HASH_CACHE_STORE = 'cover-hashes'
const CATALOG_CACHE_SNAPSHOT_KEY = 'all-consoles'
const CATALOG_CACHE_VERSION = '2026-04-25-v2'
const COVER_MATCH_MAX_SCOPE = 1500
const MAX_LIBRARY_ENTRIES = 10000
const MAX_ACTIVITY_EVENTS = 250
const LEGENDS_FILTER = 'Legends'
// Only North American first-party console releases count as Legends
const LEGENDS_CONSOLES = new Set([
  'NES', 'Super Nintendo', 'Nintendo 64', 'GameCube', 'Nintendo DS',
  'Game Boy', 'Game Boy Color', 'Game Boy Advance',
  'Sega Genesis', 'Sega Master System', 'Sega CD', 'Sega Saturn', 'Dreamcast',
  'PlayStation', 'PlayStation 2',
  'Atari 2600', 'Atari 7800', 'TurboGrafx-16', 'TurboGrafx CD',
  'Neo Geo AES', '3DO',
])
const LEGENDS_PATTERNS: readonly string[] = [
  // Nintendo flagships
  'super mario', 'legend of zelda', 'metroid', 'donkey kong',
  'mario kart', 'super smash bros', 'star fox', 'kid icarus',
  'fire emblem', 'advance wars', 'pikmin', 'earthbound',
  'paper mario', 'kirby',
  // NES classics
  'mega man', 'castlevania', 'contra', 'ninja gaiden', 'battletoads',
  'double dragon', 'duck hunt', 'excitebike', 'punch-out',
  'tecmo super bowl', 'galaga', 'pac-man',
  'space invaders', 'asteroids', 'pitfall', 'breakout',
  // 3D platformers
  'crash bandicoot', 'banjo-kazooie', 'banjo-tooie',
  "conker's bad fur day", 'earthworm jim', 'spyro the dragon',
  "spyro ripto", 'spyro year of the dragon',
  // RPGs
  'final fantasy', 'chrono trigger', 'kingdom hearts',
  // Sega
  'sonic the hedgehog', 'sonic adventure', 'sonic cd',
  'streets of rage', 'golden axe', 'altered beast',
  'shenmue', 'crazy taxi', 'jet set radio', 'skies of arcadia',
  // Fighting
  'street fighter', 'mortal kombat', 'tekken', 'soulcalibur',
  'soul blade', 'soul calibur', 'marvel vs capcom',
  // Action / shooters
  '007 goldeneye', 'perfect dark', 'metal gear solid',
  "tony hawk's pro skater", 'tomb raider',
  // Horror
  'resident evil', 'silent hill',
  // Racing
  'gran turismo', 'f-zero', 'diddy kong racing',
  // Open world
  'grand theft auto san andreas', 'grand theft auto vice city',
  'grand theft auto iii',
  // Action
  'god of war', 'devil may cry',
  // Artistic
  'ico', 'shadow of the colossus',
  // Portable icons
  'pokemon red', 'pokemon blue', 'pokemon yellow',
  'pokemon gold', 'pokemon silver', 'pokemon crystal',
  'pokemon ruby', 'pokemon sapphire', 'pokemon emerald',
  'pokemon firered', 'pokemon leafgreen',
  "link's awakening", 'metroid fusion', 'metroid ii',
  // Key GameCube
  "luigi's mansion", 'tetris',
]
const TRUSTED_COVER_HOSTS = new Set(['storage.googleapis.com', 'images.pricecharting.com'])
const COVER_FALLBACK_PREFIX = 'data:image/svg+xml;charset=UTF-8,'
const INITIAL_VISIBLE_GAME_COUNT = 48
const VISIBLE_GAME_INCREMENT = 48
const COMPACT_VISIBLE_GAME_COUNT = 32
const COMPACT_VISIBLE_GAME_INCREMENT = 32
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
let barcodeReader: BarcodeReaderInstance | null = null
let barcodeCameraControls: BarcodeScannerControls | null = null
let barcodeCameraStartPromise: Promise<void> | null = null
let barcodeModulePromise: Promise<{ BrowserMultiFormatReader: new () => BarcodeReaderInstance }> | null = null
const coverHashMemoryCache = new Map<string, string>()
let pendingCatalogSnapshotSave = 0
let pendingLibrarySave = 0
let pendingSearchRender = 0
let pendingBarcodeSearchRender = 0
let pendingTradeAvailabilityRefresh = 0
let pendingCollectorInsightRefresh = 0
let pendingTradePromptTimeout = 0
let publicCommunityStatsFetchPromise: Promise<void> | null = null
let tradeAvailabilityFetchSequence = 0
let libraryRevision = 0
let detailCoverPrewarmObserver: IntersectionObserver | null = null
let appEventsBound = false
let lastInputFocusSnapshot: FocusSnapshot | null = null
let bodyScrollLocked = false
let bodyScrollLockY = 0
let selectedGameModalRenderedId: string | null = null
const prewarmedDetailCoverUrls = new Set<string>()
let renderedBackdropSignature = ''
let backgroundVisualRefreshReady = false
let pendingBackgroundCatalogRefresh = false
let pendingBackgroundFullRefresh = false

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
const pendingConsoleLoads = new Map<string, Promise<void>>()
let syncTimeout: number | null = null
let catalogSnapshotDbPromise: Promise<IDBDatabase> | null = null
const editionOptions: EditionStatus[] = ['loose', 'boxed', 'manual', 'box-only', 'manual-only', 'box-manual', 'cib', 'sealed', 'graded']
const conditionOptions: ConditionRating[] = ['mint', 'excellent', 'good', 'fair']
const variantSuggestions = ['Standard', "Player's Choice", '3-screw', '5-screw', 'Revision A', 'Black label', 'Greatest Hits']
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
  heroSearchDraft: '',
  consoleFilter: LEGENDS_FILTER,
  regionFilter: 'All regions',
  yearFilter: 'All years',
  releaseTypeFilter: 'All release types' as ReleaseTypeFilter,
  ownershipFilter: 'all' as OwnershipFilter,
  sortMode: 'title' as SortMode,
  letterFilter: '',
  visibleGameCount: getInitialVisibleGameCount(),
  currencyCode: loadCurrencyCode(),
  authToken: loadAuthToken(),
  accountEmail: loadAuthProfile().email,
  accountDisplayName: loadAuthProfile().displayName,
  accountHydrationPending: Boolean(loadAuthToken()),
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
  catalogTotalGames: DEFAULT_CATALOG_TOTAL_GAMES,
  catalogTotalConsoles: DEFAULT_CATALOG_TOTAL_CONSOLES,
  loadedConsoles: [] as string[],
  customCatalog: loadCustomCatalog(),
  barcodeMappings: loadBarcodeMappings(),
  deletedGameIds: loadDeletedGameIds(),
  onboardingDismissed: loadOnboardingDismissed(),
  hideArchivedTrades: loadHideArchivedTrades(),
  publicCommunityStats: loadPublicCommunityStatsCache(),
  recentViewedGameIds: loadRecentViewedGameIds(),
  cachedHeroStats: loadHeroStatsSnapshot(),
  visitStreak: recordDailyVisit(),
  activityEvents: loadActivityEvents(),
  cachedOwnedGames: [] as CatalogEntry[],
  cachedWantedGames: [] as CatalogEntry[],
  cachedCatalogStatsKey: '',
  cachedConsoleProgress: [] as ConsoleProgress[],
  cachedConsoleProgressKey: '',
  selectedGameId: null as string | null,
  selectedGameModalScrollTop: 0,
  badgesOpen: false,
  ownershipPickerGameId: null as string | null,
  justOwnedGameId: null as string | null,
  customEntryOpen: false,
  customEntryError: '',
  scannerOpen: false,
  scannerLiveActive: false,
  scannerStatus: 'Scan a barcode with your camera or upload a clear barcode photo.' as string,
  coverScanStatus: '' as string,
  coverScanRunning: false,
  coverScanMatches: [] as CoverMatchSuggestion[],
  barcodeLinkCode: null as string | null,
  barcodeSearch: '',
  backdropReady: false,
  isCatalogLoading: true,
  catalogLoadError: false,
  viewMode: 'grid' as 'grid' | 'shelf',
  tradeView: false,
  tradeThreadId: null as string | null,
  tradeMatches: [] as TradeMatch[],
  tradeMatchesLoading: false,
  tradeRequests: [] as TradeRequest[],
  tradeUnread: 0,
  tradePending: 0,
  tradeInboxOpportunities: [] as TradeInboxOpportunity[],
  tradeInboxCollectors: [] as TradeDiscoveryCollector[],
  tradeAvailabilityByGameId: {} as Record<string, number>,
  tradeWantedByGameId: {} as Record<string, number>,
  tradeableNowIds: null as Set<string> | null,
  wantedNowIds: null as Set<string> | null,
  tradeAvailabilityOwnersGameId: null as string | null,
  tradeAvailabilityOwners: [] as TradeAvailabilityOwner[],
  tradeAvailabilityOwnersLoading: false,
  tradeInboxLoading: false,
  tradeInboxError: '',
  tradeThread: null as { messages: TradeMessage[]; tradeRequest: TradeRequest; otherUser: { id: string; displayName: string }; suggestedReplyGameId: string | null } | null,
  tradeThreadLoading: false,
  tradeSendError: '',
  tradeInterestGameId: null as string | null,
  tradeInterestUserId: null as string | null,
  tradeProfileUserId: null as string | null,
  tradeProfile: null as TradeProfile | null,
  tradeProfileLoading: false,
  tradePromptGameId: null as string | null,
  tradePromptIsDuplicate: false,
  tradePromptPickingCopy: false,
  importStep: 'none' as ImportStep,
  importRows: [] as ImportRow[],
  importSourceName: '',
  importDoneCount: 0,
  ownershipConfirmId: null as string | null,
  tradeInboxFreshOpportunityIds: new Set<string>(),
}

unregisterServiceWorker()

function defaultRecord(): GameRecord {
  return {
    status: 'missing',
    completeInBox: false,
    pricePaid: null,
    favorite: false,
    ownedCopies: 1,
    editionStatus: 'loose',
    condition: 'good',
    variant: '',
    gradedLabel: '',
    appraisedValue: null,
    targetPrice: null,
    notes: '',
    dateAcquired: null,
    acquiredFrom: '',
    forTrade: false,
    tradeListedAt: null,
  }
}

function loadSeenTradeOpportunityIds() {
  try {
    const raw = localStorage.getItem(TRADE_OPPORTUNITY_SEEN_KEY)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0) : [])
  } catch {
    return new Set<string>()
  }
}

function saveSeenTradeOpportunityIds(ids: Iterable<string>) {
  try {
    localStorage.setItem(TRADE_OPPORTUNITY_SEEN_KEY, JSON.stringify([...new Set(ids)].slice(-300)))
  } catch {
    // Seen-state should never block the app.
  }
}

function loadPublicCommunityStatsCache() {
  try {
    const raw = localStorage.getItem(PUBLIC_COMMUNITY_STATS_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<PublicCommunityStats> | null

    if (
      !parsed ||
      typeof parsed.userCount !== 'number' ||
      typeof parsed.trackedGamesCount !== 'number' ||
      typeof parsed.tradeListingCount !== 'number' ||
      typeof parsed.generatedAt !== 'string'
    ) {
      return null
    }

    return {
      userCount: parsed.userCount,
      trackedGamesCount: parsed.trackedGamesCount,
      tradeListingCount: parsed.tradeListingCount,
      generatedAt: parsed.generatedAt,
    } satisfies PublicCommunityStats
  } catch {
    return null
  }
}

function savePublicCommunityStatsCache(stats: PublicCommunityStats) {
  try {
    localStorage.setItem(PUBLIC_COMMUNITY_STATS_STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // Social proof cache should never block the app.
  }
}

function loadRecentViewedGameIds() {
  try {
    const raw = localStorage.getItem(RECENT_VIEWED_STORAGE_KEY)
    if (!raw) return [] as string[]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 24)
      : []
  } catch {
    return [] as string[]
  }
}

function saveRecentViewedGameIds() {
  try {
    localStorage.setItem(RECENT_VIEWED_STORAGE_KEY, JSON.stringify(state.recentViewedGameIds.slice(0, 24)))
  } catch {
    // Continue-hunting memory should never block the vault.
  }
}

function loadHeroStatsSnapshot(): HeroStatsSnapshot | null {
  try {
    const raw = localStorage.getItem(HERO_STATS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const accountEmail = typeof parsed.accountEmail === 'string' ? parsed.accountEmail : ''
    const ownedCount = typeof parsed.ownedCount === 'number' ? parsed.ownedCount : null
    const wantedCount = typeof parsed.wantedCount === 'number' ? parsed.wantedCount : null
    const ownedTrackedValueUsd = typeof parsed.ownedTrackedValueUsd === 'number' ? parsed.ownedTrackedValueUsd : null
    const ownedCompleteValueUsd = typeof parsed.ownedCompleteValueUsd === 'number' ? parsed.ownedCompleteValueUsd : null
    const wishlistValueUsd = typeof parsed.wishlistValueUsd === 'number' ? parsed.wishlistValueUsd : null
    const completionPercentage = typeof parsed.completionPercentage === 'number' ? parsed.completionPercentage : null

    if (
      ownedCount === null ||
      wantedCount === null ||
      ownedTrackedValueUsd === null ||
      ownedCompleteValueUsd === null ||
      wishlistValueUsd === null ||
      completionPercentage === null
    ) {
      return null
    }

    return {
      accountEmail,
      ownedCount,
      wantedCount,
      ownedTrackedValueUsd,
      ownedCompleteValueUsd,
      wishlistValueUsd,
      completionPercentage,
    }
  } catch {
    return null
  }
}

function saveHeroStatsSnapshot(snapshot: HeroStatsSnapshot) {
  state.cachedHeroStats = snapshot
  try {
    localStorage.setItem(HERO_STATS_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Top hero stats cache should never block startup.
  }
}

function getHeroStatsSnapshotForSync() {
  const counts = getInstantLibraryCounts()

  if (hasCompleteCatalogLoaded()) {
    const dashboard = getDashboardSummary(getCatalog())
    return {
      accountEmail: state.accountEmail || '',
      ownedCount: counts.ownedCount,
      wantedCount: counts.wantedCount,
      ownedTrackedValueUsd: dashboard.ownedTrackedValue,
      ownedCompleteValueUsd: dashboard.ownedCompleteValue,
      wishlistValueUsd: dashboard.wishlistValue,
      completionPercentage: dashboard.completionPercentage,
    } satisfies HeroStatsSnapshot
  }

  if (state.cachedHeroStats && state.cachedHeroStats.accountEmail === (state.accountEmail || '')) {
    return state.cachedHeroStats
  }

  return {
    accountEmail: state.accountEmail || '',
    ownedCount: counts.ownedCount,
    wantedCount: counts.wantedCount,
    ownedTrackedValueUsd: 0,
    ownedCompleteValueUsd: 0,
    wishlistValueUsd: 0,
    completionPercentage: 0,
  } satisfies HeroStatsSnapshot
}

function rememberRecentViewedGame(gameId: string) {
  state.recentViewedGameIds = [gameId, ...state.recentViewedGameIds.filter((id) => id !== gameId)].slice(0, 24)
  saveRecentViewedGameIds()
}

async function ensurePublicCommunityStatsLoaded() {
  if (publicCommunityStatsFetchPromise) {
    return publicCommunityStatsFetchPromise
  }

  publicCommunityStatsFetchPromise = (async () => {
    try {
      const previousGeneratedAt = state.publicCommunityStats?.generatedAt ?? ''
      const stats = await getPublicCommunityStats()
      state.publicCommunityStats = stats
      savePublicCommunityStatsCache(stats)
      if (stats.generatedAt !== previousGeneratedAt) {
        patchPublicCommunityStatSurfaces()
      }
    } catch {
      // Public social proof should never block the vault.
    } finally {
      publicCommunityStatsFetchPromise = null
    }
  })()

  return publicCommunityStatsFetchPromise
}

function renderHeroAudienceCard() {
  const stats = state.publicCommunityStats
  const signedIn = Boolean(state.authToken)
  const headline = stats
    ? `${stats.userCount.toLocaleString()} collectors signed up`
    : 'Collector count loading'
  const supportingCopy = signedIn
    ? 'That is your pool for trade replies, wanted matches, and collector activity.'
    : 'Real collectors are already tracking games here and listing duplicates for trade.'
  const trackedGamesText = stats
    ? `${stats.trackedGamesCount.toLocaleString()} games tracked`
    : 'Library activity loading'
  const tradeListingsText = stats
    ? `${stats.tradeListingCount.toLocaleString()} trade listings live`
    : 'Trade listing count loading'

  return `
    <aside class="hero-audience-card" data-hero-community-card>
      <span class="hero-audience-card__label">Collector network</span>
      <strong class="hero-audience-card__value">${headline}</strong>
      <p class="hero-audience-card__copy">${supportingCopy}</p>
      <div class="hero-audience-card__meta">
        <span>${trackedGamesText}</span>
        <span>${tradeListingsText}</span>
      </div>
    </aside>
  `
}

function patchPublicCommunityStatSurfaces() {
  const heroCard = app.querySelector<HTMLElement>('[data-hero-community-card]')

  if (heroCard) {
    heroCard.outerHTML = renderHeroAudienceCard()
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
        const variant = entry.variant
        const gradedLabel = entry.gradedLabel
        const appraisedValue = entry.appraisedValue
        const targetPrice = entry.targetPrice
        const notes = entry.notes
        const dateAcquired = entry.dateAcquired
        const acquiredFrom = entry.acquiredFrom
        const forTrade = entry.forTrade
        const tradeListedAt = entry.tradeListedAt
        const rawCopies = entry.copies

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
              variant: normalizeVariantLabel(variant),
              gradedLabel: typeof gradedLabel === 'string' ? gradedLabel.slice(0, 80).trim() : '',
              appraisedValue: typeof appraisedValue === 'number' ? appraisedValue : null,
              targetPrice: typeof targetPrice === 'number' ? targetPrice : null,
              notes: typeof notes === 'string' ? notes : '',
              dateAcquired: typeof dateAcquired === 'string' && dateAcquired ? dateAcquired : null,
              acquiredFrom: typeof acquiredFrom === 'string' ? acquiredFrom.slice(0, 80) : '',
              forTrade: typeof forTrade === 'boolean' ? forTrade : false,
              tradeListedAt: typeof tradeListedAt === 'string' && tradeListedAt ? tradeListedAt : null,
              copies: Array.isArray(rawCopies) ? rawCopies.map(normalizeCopy).filter((c): c is GameCopy => c !== null) : undefined,
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
  state.accountHydrationPending = Boolean(token)
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

function loadHideArchivedTrades() {
  return localStorage.getItem(TRADE_HIDE_ARCHIVED_KEY) === 'true'
}

function saveHideArchivedTrades(value: boolean) {
  state.hideArchivedTrades = value
  localStorage.setItem(TRADE_HIDE_ARCHIVED_KEY, value ? 'true' : 'false')
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
  state.accountHydrationPending = false
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

  state.library = {}
  state.customCatalog = []
  state.barcodeMappings = {}
  state.deletedGameIds = []
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
  localStorage.setItem(DELETED_GAME_IDS_STORAGE_KEY, JSON.stringify(state.deletedGameIds))
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

function loadDeletedGameIds() {
  const raw = localStorage.getItem(DELETED_GAME_IDS_STORAGE_KEY)

  if (!raw) {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(raw)

    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim()))].slice(0, MAX_LIBRARY_ENTRIES)
      : []
  } catch {
    return []
  }
}

function saveDeletedGameIds() {
  localStorage.setItem(DELETED_GAME_IDS_STORAGE_KEY, JSON.stringify(state.deletedGameIds.slice(0, MAX_LIBRARY_ENTRIES)))
  scheduleCloudSync()
}

function markGameDeleted(id: string) {
  if (!id || state.deletedGameIds.includes(id)) {
    return
  }

  state.deletedGameIds = [...state.deletedGameIds, id].slice(-MAX_LIBRARY_ENTRIES)
  saveDeletedGameIds()
}

function clearDeletedGameId(id: string) {
  if (!id || !state.deletedGameIds.includes(id)) {
    return
  }

  state.deletedGameIds = state.deletedGameIds.filter((entry) => entry !== id)
  saveDeletedGameIds()
}

function normalizeCatalogEntry(value: unknown): CatalogEntry | null {
  if (Array.isArray(value)) {
    const [
      id,
      title,
      consoleName,
      year,
      region,
      coverUrlValue,
      priceLoose,
      priceComplete,
      priceSealed,
      priceSourceUrlValue,
      coverSourceUrlValue,
      trendDelta,
      rarity,
    ] = value

    const coverUrl = typeof coverUrlValue === 'string' ? normalizeCoverUrl(coverUrlValue) : ''
    const priceSourceUrl = typeof priceSourceUrlValue === 'string' ? normalizeExternalUrl(priceSourceUrlValue) : ''
    const coverSourceUrl = typeof coverSourceUrlValue === 'string' ? normalizeExternalUrl(coverSourceUrlValue) : ''

    if (
      typeof id !== 'string' ||
      typeof title !== 'string' ||
      typeof consoleName !== 'string' ||
      (typeof year !== 'number' && year !== null) ||
      typeof region !== 'string' ||
      typeof priceLoose !== 'number' ||
      (typeof priceComplete !== 'number' && priceComplete !== null) ||
      (typeof priceSealed !== 'number' && priceSealed !== null) ||
      !priceSourceUrl ||
      !coverSourceUrl
    ) {
      return null
    }

    return {
      id,
      title,
      console: consoleName,
      year,
      region,
      coverUrl,
      priceLoose,
      priceComplete,
      priceSealed,
      priceSourceUrl,
      coverSourceUrl,
      trendDelta: typeof trendDelta === 'number' ? trendDelta : 0,
      rarity: isRarityTier(rarity) ? rarity : 'Classic',
      releaseType: undefined,
      variantLabel: undefined,
    } satisfies CatalogEntry
  }

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
    (typeof entry.priceSealed !== 'number' && entry.priceSealed !== null && typeof entry.priceSealed !== 'undefined') ||
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
    priceSealed: typeof entry.priceSealed === 'number' ? entry.priceSealed : null,
    priceSourceUrl,
    coverSourceUrl,
    trendDelta: typeof entry.trendDelta === 'number' ? entry.trendDelta : 0,
    rarity: isRarityTier(entry.rarity) ? entry.rarity : 'Classic',
    releaseType: normalizeReleaseType(entry.releaseType),
    variantLabel: typeof entry.variantLabel === 'string' && entry.variantLabel.trim() ? entry.variantLabel.trim() : undefined,
  } satisfies CatalogEntry
}

type PackedLiteCatalog = {
  version?: number
  coverPrefix?: string
  sourcePrefix?: string
  rows?: unknown
}

function normalizePackedLiteCatalog(value: unknown): CatalogEntry[] {
  if (!value || typeof value !== 'object') {
    return []
  }

  const payload = value as PackedLiteCatalog
  const rows = Array.isArray(payload.rows) ? payload.rows : null

  if (!rows) {
    return []
  }

  const coverPrefix = typeof payload.coverPrefix === 'string' ? payload.coverPrefix : ''
  const sourcePrefix = typeof payload.sourcePrefix === 'string' ? payload.sourcePrefix : ''

  return rows
    .flatMap((row) => {
      if (!Array.isArray(row)) {
        return []
      }

      const isNewLiteRow = row.length >= 15
      const [
        id,
        title,
        consoleName,
        year,
        region,
        coverRef,
        priceLoose,
        priceComplete,
        priceSealedOrSource,
        sourceOrTrend,
        coverSourceOrRarity,
        trendOrReleaseType,
        rarityOrVariant,
        releaseTypeMaybe,
        variantLabelMaybe,
      ] = row
      const priceSealed = isNewLiteRow ? priceSealedOrSource : null
      const sourceRef = isNewLiteRow ? sourceOrTrend : priceSealedOrSource
      const coverSourceRef = isNewLiteRow ? coverSourceOrRarity : sourceRef
      const trendDelta = isNewLiteRow ? trendOrReleaseType : sourceOrTrend
      const rarity = isNewLiteRow ? rarityOrVariant : coverSourceOrRarity
      const releaseType = isNewLiteRow ? releaseTypeMaybe : trendOrReleaseType
      const variantLabel = isNewLiteRow ? variantLabelMaybe : rarityOrVariant

      const coverUrl =
        typeof coverRef === 'string'
          ? normalizeCoverUrl(coverRef.startsWith('http') ? coverRef : `${coverPrefix}${coverRef}`)
          : ''
      const priceSourceUrl =
        typeof sourceRef === 'string'
          ? normalizeExternalUrl(sourceRef.startsWith('http') ? sourceRef : `${sourcePrefix}${sourceRef}`)
          : ''
      const coverSourceUrl =
        typeof coverSourceRef === 'string'
          ? normalizeExternalUrl(coverSourceRef.startsWith('http') ? coverSourceRef : `${sourcePrefix}${coverSourceRef}`)
          : priceSourceUrl

      if (
        typeof id !== 'string' ||
        typeof title !== 'string' ||
        typeof consoleName !== 'string' ||
        (typeof year !== 'number' && year !== null) ||
        typeof region !== 'string' ||
        typeof priceLoose !== 'number' ||
        (typeof priceComplete !== 'number' && priceComplete !== null) ||
        (typeof priceSealed !== 'number' && priceSealed !== null) ||
        !priceSourceUrl
      ) {
        return []
      }

      return [
        {
          id,
          title,
          console: consoleName,
          year,
          region,
          coverUrl,
          priceLoose,
          priceComplete,
          priceSealed,
          priceSourceUrl,
          coverSourceUrl,
          trendDelta: typeof trendDelta === 'number' ? trendDelta : 0,
          rarity: isRarityTier(rarity) ? rarity : 'Classic',
          releaseType: normalizeReleaseType(releaseType),
          variantLabel: typeof variantLabel === 'string' && variantLabel.trim() ? variantLabel.trim() : undefined,
        } satisfies CatalogEntry,
      ]
    })
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

function normalizeReleaseType(value: unknown): ReleaseType | undefined {
  return value === 'licensed' || value === 'unlicensed' || value === 'homebrew' || value === 'custom' ? value : undefined
}

function applyCatalogEntryOverride(entry: CatalogEntry) {
  const override = catalogEntryOverrides[entry.id]

  if (!override) {
    return entry
  }

  return {
    ...entry,
    ...override,
  }
}

function applyCatalogEnhancements(entries: CatalogEntry[]) {
  const merged = [...entries.map(applyCatalogEntryOverride), ...extraCatalogEntries.map(applyCatalogEntryOverride)]

  return merged.map((entry) => {
    if (entry.coverUrl) {
      return entry
    }

    const sibling = merged.find(
      (candidate) =>
        candidate.id !== entry.id &&
        candidate.console === entry.console &&
        candidate.region === entry.region &&
        normalizeSearchText(candidate.title) === normalizeSearchText(entry.title) &&
        Boolean(candidate.coverUrl),
    )

    return sibling ? { ...entry, coverUrl: sibling.coverUrl } : entry
  })
}

function normalizeCustomCoverUrl(value: string) {
  return normalizeExternalUrl(value)
}

function normalizeBarcodeValue(value: string) {
  return value.trim().replace(/[\s-]+/g, '')
}

function getCatalogMetaSignature(metaEntries: CatalogConsoleMeta[]) {
  return metaEntries
    .map((entry) => `${entry.console}|${entry.region}|${entry.count}|${entry.file}`)
    .sort((left, right) => left.localeCompare(right))
    .join('||')
}

function openCatalogSnapshotDb() {
  if (catalogSnapshotDbPromise) {
    return catalogSnapshotDbPromise
  }

  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available.'))
  }

  catalogSnapshotDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CATALOG_CACHE_DB_NAME, 2)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(CATALOG_CACHE_STORE)) {
        db.createObjectStore(CATALOG_CACHE_STORE)
      }

      if (!db.objectStoreNames.contains(COVER_HASH_CACHE_STORE)) {
        db.createObjectStore(COVER_HASH_CACHE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Catalog cache database could not be opened.'))
  })

  return catalogSnapshotDbPromise
}

async function readCatalogSnapshot() {
  try {
    const db = await openCatalogSnapshotDb()

    return await new Promise<CatalogSnapshot | null>((resolve, reject) => {
      const transaction = db.transaction(CATALOG_CACHE_STORE, 'readonly')
      const store = transaction.objectStore(CATALOG_CACHE_STORE)
      const request = store.get(CATALOG_CACHE_SNAPSHOT_KEY)

      request.onsuccess = () => {
        const value = request.result

        if (!value || typeof value !== 'object') {
          resolve(null)
          return
        }

        const snapshot = value as Partial<CatalogSnapshot>

        if (
          snapshot.version !== CATALOG_CACHE_VERSION ||
          !Array.isArray(snapshot.generatedCatalog) ||
          !Array.isArray(snapshot.catalogMeta) ||
          !Array.isArray(snapshot.loadedConsoles) ||
          typeof snapshot.metaSignature !== 'string'
        ) {
          resolve(null)
          return
        }

        resolve({
          version: snapshot.version,
          savedAt: typeof snapshot.savedAt === 'string' ? snapshot.savedAt : '',
          metaSignature: snapshot.metaSignature,
          generatedCatalog: snapshot.generatedCatalog.map(normalizeCatalogEntry).filter(isCatalogEntry),
          catalogMeta: snapshot.catalogMeta
            .flatMap((entry) => {
              if (!entry || typeof entry !== 'object') {
                return []
              }

              const meta = entry as Partial<CatalogConsoleMeta>

              if (
                typeof meta.console !== 'string' ||
                typeof meta.slug !== 'string' ||
                typeof meta.region !== 'string' ||
                typeof meta.count !== 'number' ||
                typeof meta.file !== 'string'
              ) {
                return []
              }

              return [
                {
                  console: meta.console,
                  slug: meta.slug,
                  region: meta.region,
                  market: typeof meta.market === 'string' ? meta.market : undefined,
                  count: meta.count,
                  file: meta.file,
                } satisfies CatalogConsoleMeta,
              ]
            }),
          loadedConsoles: snapshot.loadedConsoles.filter((value): value is string => typeof value === 'string'),
        })
      }

      request.onerror = () => reject(request.error ?? new Error('Catalog snapshot could not be read.'))
    })
  } catch {
    return null
  }
}

async function writeCatalogSnapshot() {
  if (!state.generatedCatalog.length || !state.catalogMeta.length) {
    return
  }

  const snapshot: CatalogSnapshot = {
    version: CATALOG_CACHE_VERSION,
    savedAt: new Date().toISOString(),
    metaSignature: getCatalogMetaSignature(state.catalogMeta),
    generatedCatalog: state.generatedCatalog,
    catalogMeta: state.catalogMeta,
    loadedConsoles: state.loadedConsoles,
  }

  try {
    const db = await openCatalogSnapshotDb()

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CATALOG_CACHE_STORE, 'readwrite')
      const store = transaction.objectStore(CATALOG_CACHE_STORE)
      const request = store.put(snapshot, CATALOG_CACHE_SNAPSHOT_KEY)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Catalog snapshot could not be saved.'))
    })
  } catch {
    // Warm catalog caching must never block the app.
  }
}

function getCoverHashCacheKey(game: CatalogEntry) {
  return `${game.id}|${game.coverUrl}`
}

async function readCoverHash(cacheKey: string) {
  if (coverHashMemoryCache.has(cacheKey)) {
    return coverHashMemoryCache.get(cacheKey) ?? ''
  }

  try {
    const db = await openCatalogSnapshotDb()

    const storedValue = await new Promise<string>((resolve, reject) => {
      const transaction = db.transaction(COVER_HASH_CACHE_STORE, 'readonly')
      const store = transaction.objectStore(COVER_HASH_CACHE_STORE)
      const request = store.get(cacheKey)

      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : '')
      request.onerror = () => reject(request.error ?? new Error('Cover hash cache could not be read.'))
    })

    coverHashMemoryCache.set(cacheKey, storedValue)
    return storedValue
  } catch {
    return ''
  }
}

async function writeCoverHash(cacheKey: string, hash: string) {
  coverHashMemoryCache.set(cacheKey, hash)

  try {
    const db = await openCatalogSnapshotDb()

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(COVER_HASH_CACHE_STORE, 'readwrite')
      const store = transaction.objectStore(COVER_HASH_CACHE_STORE)
      const request = store.put(hash, cacheKey)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Cover hash cache could not be saved.'))
    })
  } catch {
    // Cover hash caching must never block the scanner.
  }
}

function getCoverScanScopeGames() {
  const scopeGames = getCatalog().filter((game) => {
    if (state.consoleFilter !== 'All consoles' && state.consoleFilter !== LEGENDS_FILTER && game.console !== state.consoleFilter) {
      return false
    }

    if (state.regionFilter !== 'All regions' && game.region !== state.regionFilter) {
      return false
    }

    return true
  })

  if (scopeGames.length > COVER_MATCH_MAX_SCOPE) {
    return {
      games: [] as CatalogEntry[],
      error: 'Pick a console or region first so cover matching stays fast and accurate.',
    }
  }

  return {
    games: scopeGames,
    error: '',
  }
}

function getCoverScanStatusHint() {
  const scope = getCoverScanScopeGames()

  if (scope.error) {
    return scope.error
  }

  if (!scope.games.length) {
    return 'No games are in the current cover-scan scope yet.'
  }

  return `Front-cover matching is ready for ${scope.games.length.toLocaleString()} game${scope.games.length === 1 ? '' : 's'} in the current scope.`
}

async function loadImageFromUrl(sourceUrl: string, options: { crossOrigin?: string } = {}) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'

    if (options.crossOrigin) {
      image.crossOrigin = options.crossOrigin
    }

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That cover image could not be loaded.'))
    image.src = sourceUrl
  })
}

function computeImageDHash(image: CanvasImageSource) {
  const canvas = document.createElement('canvas')
  canvas.width = 9
  canvas.height = 8
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('Image processing is not available in this browser.')
  }

  context.drawImage(image, 0, 0, 9, 8)
  const pixels = context.getImageData(0, 0, 9, 8).data
  let hash = ''

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const leftIndex = (row * 9 + column) * 4
      const rightIndex = (row * 9 + column + 1) * 4
      const leftLuma = pixels[leftIndex] * 0.299 + pixels[leftIndex + 1] * 0.587 + pixels[leftIndex + 2] * 0.114
      const rightLuma =
        pixels[rightIndex] * 0.299 + pixels[rightIndex + 1] * 0.587 + pixels[rightIndex + 2] * 0.114
      hash += leftLuma > rightLuma ? '1' : '0'
    }
  }

  return hash
}

function getHammingDistance(left: string, right: string) {
  if (!left || !right || left.length !== right.length) {
    return Number.POSITIVE_INFINITY
  }

  let distance = 0

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      distance += 1
    }
  }

  return distance
}

async function getGameCoverHash(game: CatalogEntry) {
  const cacheKey = getCoverHashCacheKey(game)
  const cached = await readCoverHash(cacheKey)

  if (cached) {
    return cached
  }

  if (!game.coverUrl) {
    await writeCoverHash(cacheKey, '')
    return ''
  }

  try {
    const image = await loadImageFromUrl(game.coverUrl, { crossOrigin: 'anonymous' })
    const hash = computeImageDHash(image)
    await writeCoverHash(cacheKey, hash)
    return hash
  } catch {
    await writeCoverHash(cacheKey, '')
    return ''
  }
}

function scheduleCatalogSnapshotSave() {
  if (pendingCatalogSnapshotSave) {
    window.clearTimeout(pendingCatalogSnapshotSave)
  }

  pendingCatalogSnapshotSave = window.setTimeout(() => {
    pendingCatalogSnapshotSave = 0
    void writeCatalogSnapshot()
  }, 700)
}

function flushCatalogSnapshotSave() {
  if (pendingCatalogSnapshotSave) {
    window.clearTimeout(pendingCatalogSnapshotSave)
    pendingCatalogSnapshotSave = 0
  }

  void writeCatalogSnapshot()
}

async function getBarcodeReader() {
  if (!barcodeModulePromise) {
    barcodeModulePromise = import('@zxing/browser')
  }

  if (!barcodeReader) {
    const barcodeModule = await barcodeModulePromise
    barcodeReader = new barcodeModule.BrowserMultiFormatReader()
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
      barcodeCameraControls = await (await getBarcodeReader()).decodeFromVideoDevice(undefined, preview, (result) => {
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

function normalizeVariantLabel(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 80) : ''
}

function normalizeCopy(raw: unknown): GameCopy | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  return {
    edition: isEditionStatus(c.edition) ? c.edition : 'loose',
    condition: isConditionRating(c.condition) ? c.condition : 'good',
    variant: normalizeVariantLabel(c.variant),
    gradedLabel: typeof c.gradedLabel === 'string' ? c.gradedLabel.slice(0, 80).trim() : '',
    appraisedValue: typeof c.appraisedValue === 'number' ? c.appraisedValue : null,
    pricePaid: typeof c.pricePaid === 'number' ? c.pricePaid : null,
    forTrade: typeof c.forTrade === 'boolean' ? c.forTrade : false,
  }
}

function getRecordCopies(record: GameRecord): GameCopy[] {
  if (record.copies && record.copies.length > 0) return record.copies
  if (record.status !== 'owned') return []
  return [{
    edition: record.editionStatus,
    condition: record.condition,
    variant: normalizeVariantLabel(record.variant),
    gradedLabel: typeof record.gradedLabel === 'string' ? record.gradedLabel.slice(0, 80).trim() : '',
    appraisedValue: typeof record.appraisedValue === 'number' ? record.appraisedValue : null,
    pricePaid: record.pricePaid,
    forTrade: record.forTrade ?? false,
  }]
}

const EDITION_RANK: Record<EditionStatus, number> = {
  loose: 0,
  'manual-only': 1,
  'box-only': 2,
  manual: 3,
  boxed: 4,
  'box-manual': 5,
  cib: 6,
  sealed: 7,
  graded: 8,
}

function isCompleteEditionStatus(editionStatus: EditionStatus) {
  return editionStatus === 'cib' || editionStatus === 'sealed' || editionStatus === 'graded'
}

function bestCopyEdition(copies: GameCopy[]): EditionStatus {
  return copies.reduce<EditionStatus>(
    (best, c) => (EDITION_RANK[c.edition] > EDITION_RANK[best] ? c.edition : best),
    'loose',
  )
}

function getCopiesSummary(record: GameRecord): string {
  const copies = getRecordCopies(record)
  if (copies.length <= 1) return ''
  const counts = new Map<EditionStatus, number>()
  for (const c of copies) counts.set(c.edition, (counts.get(c.edition) ?? 0) + 1)
  return [...counts.entries()].map(([ed, n]) => `${n}× ${getEditionLabel(ed)}`).join(', ')
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

  const catalogEntries = applyCatalogEnhancements([...state.generatedCatalog, ...sampleCatalog, ...state.customCatalog])
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

  return [LEGENDS_FILTER, 'All consoles', ...[...new Set([...metaNames, ...customNames])]]
}

function getConsoleFamilyLabel(consoleName: string) {
  const name = consoleName.toLowerCase()

  if (
    name.includes('nintendo') ||
    name.includes('famicom') ||
    name.includes('game boy') ||
    name.includes('gamecube') ||
    name.includes('virtual boy') ||
    name.includes('pokemon mini') ||
    name === 'ds' ||
    name === '3ds' ||
    name.includes('satellaview')
  ) {
    return 'Nintendo'
  }

  if (
    name.includes('sega') ||
    name.includes('mega drive') ||
    name.includes('genesis') ||
    name.includes('dreamcast') ||
    name.includes('saturn') ||
    name.includes('game gear') ||
    name.includes('master system') ||
    name.includes('32x') ||
    name.includes('sg-1000')
  ) {
    return 'Sega'
  }

  if (
    name.includes('playstation') ||
    name === 'ps1' ||
    name === 'ps2' ||
    name === 'ps3' ||
    name === 'ps4' ||
    name === 'ps5' ||
    name.includes('psp') ||
    name.includes('vita')
  ) {
    return 'Sony'
  }

  if (name.includes('xbox')) {
    return 'Microsoft'
  }

  if (name.includes('atari') || name.includes('jaguar') || name.includes('lynx')) {
    return 'Atari'
  }

  if (
    name.includes('pc engine') ||
    name.includes('turbografx') ||
    name.includes('turbografx') ||
    name.includes('supergrafx')
  ) {
    return 'NEC / Hudson'
  }

  if (name.includes('neo geo')) {
    return 'SNK'
  }

  if (name.includes('wonderswan')) {
    return 'Bandai'
  }

  if (
    name.includes('amiga') ||
    name.includes('commodore') ||
    name.includes('msx') ||
    name.includes('apple') ||
    name.includes('mac') ||
    name.includes('dos')
  ) {
    return 'Computers'
  }

  return 'Other systems'
}

function renderConsoleFilterOptions() {
  const consoles = getConsoles()
  const pinned = consoles.filter((consoleName) => consoleName === LEGENDS_FILTER || consoleName === 'All consoles')
  const pinnedSet = new Set<string>(pinned)
  const grouped = new Map<string, string[]>()

  consoles
    .filter((consoleName) => !pinnedSet.has(consoleName))
    .forEach((consoleName) => {
      const family = getConsoleFamilyLabel(consoleName)
      const existing = grouped.get(family) ?? []
      existing.push(consoleName)
      grouped.set(family, existing)
    })

  const orderedFamilies = [
    'Nintendo',
    'Sega',
    'Sony',
    'Microsoft',
    'Atari',
    'NEC / Hudson',
    'SNK',
    'Bandai',
    'Computers',
    'Other systems',
  ]

  const pinnedOptions = pinned
    .map(
      (consoleName) =>
        `<option value="${escapeHtml(consoleName)}" ${consoleName === state.consoleFilter ? 'selected' : ''}>${escapeHtml(getConsoleOptionLabel(consoleName))}</option>`,
    )
    .join('')

  const groupedOptions = orderedFamilies
    .filter((family) => (grouped.get(family) ?? []).length > 0)
    .map((family) => {
      const options = (grouped.get(family) ?? [])
        .sort((left, right) => left.localeCompare(right))
        .map(
          (consoleName) =>
            `<option value="${escapeHtml(consoleName)}" ${consoleName === state.consoleFilter ? 'selected' : ''}>${escapeHtml(getConsoleOptionLabel(consoleName))}</option>`,
        )
        .join('')

      return `<optgroup label="${escapeHtml(family)}">${options}</optgroup>`
    })
    .join('')

  return `${pinnedOptions}${groupedOptions}`
}

function getReleaseTypeOptions() {
  const available = new Set<ReleaseTypeFilter>(['All release types'])

  getCatalog().forEach((game) => {
    switch (getEffectiveReleaseType(game)) {
      case 'licensed':
        available.add('Licensed')
        break
      case 'unlicensed':
        available.add('Unlicensed')
        break
      case 'homebrew':
        available.add('Homebrew')
        break
      case 'custom':
        available.add('Custom')
        break
      default:
        break
    }
  })

  return ['All release types', 'Licensed', 'Unlicensed', 'Homebrew', 'Custom'].filter((option) =>
    available.has(option as ReleaseTypeFilter),
  )
}

function getEffectiveReleaseType(game: CatalogEntry): ReleaseType {
  if (game.priceSourceUrl.includes('/custom-entry')) {
    return 'custom'
  }

  return game.releaseType ?? 'licensed'
}

function getConsoleMeta(consoleName: string) {
  return state.catalogMeta.find((entry) => entry.console === consoleName)
}

function getConsoleOptionLabel(consoleName: string) {
  if (consoleName === LEGENDS_FILTER) return '★ Legends'
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

  const query = state.barcodeSearch.trim()
  const catalog = getCatalog().filter((game) => {
    if (state.consoleFilter !== 'All consoles' && state.consoleFilter !== LEGENDS_FILTER && game.console !== state.consoleFilter) {
      return false
    }

    if (state.regionFilter !== 'All regions' && game.region !== state.regionFilter) {
      return false
    }

    return true
  })

  if (!query) {
    if ((state.consoleFilter === 'All consoles' || state.consoleFilter === LEGENDS_FILTER) && state.regionFilter === 'All regions') {
      return []
    }

    return catalog.slice(0, 12)
  }

  return catalog.filter((game) => matchesSearchValue(game, query, true)).slice(0, 12)
}

function getGameReference(game: CatalogEntry) {
  return famicomReferenceByGameId[game.id]
}

function getGameReferenceCode(game: CatalogEntry) {
  return getGameReference(game)?.productId ?? ''
}

const primaryIdentifierCache = new Map<string, { label: string; value: string }>()
const identifierRowsCache = new Map<string, Array<{ label: string; value: string }>>()

function getPrimaryIdentifier(game: CatalogEntry) {
  let cached = primaryIdentifierCache.get(game.id)

  if (!cached) {
    const referenceCode = getGameReferenceCode(game)
    cached = {
      label: referenceCode ? 'Reference ID' : 'Vault ID',
      value: referenceCode || game.id,
    }
    primaryIdentifierCache.set(game.id, cached)
  }

  return cached
}

function getGameIdentifierRows(game: CatalogEntry) {
  const cached = identifierRowsCache.get(game.id)

  if (cached) {
    return cached
  }

  const rows: Array<{ label: string; value: string }> = [{ label: 'Vault ID', value: game.id }]
  const reference = getGameReference(game)
  const referenceCode = reference?.productId ?? ''
  const alias = reference?.alias ?? ''
  const publisher = reference?.publisher ?? ''
  const releaseDate = reference?.releaseDate ?? ''

  if (referenceCode) {
    rows.unshift({ label: 'Reference ID', value: referenceCode })
  }

  if (alias) {
    rows.push({ label: 'Alternate title', value: alias })
  }

  if (publisher) {
    rows.push({ label: 'Publisher', value: publisher })
  }

  if (releaseDate) {
    rows.push({ label: 'Release date', value: releaseDate })
  }

  identifierRowsCache.set(game.id, rows)
  return rows
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

function getEditionMarketValue(game: CatalogEntry, editionStatus: EditionStatus, appraisedValue?: number | null) {
  const looseValue = game.priceLoose
  const completeValue = getReferencePrice(game)
  const extrasValue = Math.max(0, completeValue - looseValue)
  const fallbackExtrasValue = extrasValue > 0 ? extrasValue : Math.max(0, looseValue * 0.6)

  switch (editionStatus) {
    case 'boxed':
      return looseValue + fallbackExtrasValue * 0.55
    case 'manual':
      return looseValue + fallbackExtrasValue * 0.3
    case 'box-only':
      return fallbackExtrasValue * 0.7
    case 'manual-only':
      return fallbackExtrasValue * 0.3
    case 'box-manual':
      return fallbackExtrasValue
    case 'cib':
      return completeValue
    case 'sealed':
      return typeof game.priceSealed === 'number' ? game.priceSealed : completeValue
    case 'graded':
      return typeof appraisedValue === 'number' && appraisedValue > 0
        ? appraisedValue
        : (typeof game.priceSealed === 'number' ? game.priceSealed : completeValue)
    case 'loose':
    default:
      return looseValue
  }
}

function isCompleteEdition(record: GameRecord) {
  return record.completeInBox || isCompleteEditionStatus(record.editionStatus)
}

function getOwnedMarketPrice(game: CatalogEntry) {
  const record = getRecord(game.id)
  const copies = getRecordCopies(record)

  if (copies.length > 0) {
    return copies.reduce((total, copy) => total + getEditionMarketValue(game, copy.edition, copy.appraisedValue), 0)
  }

  return getEditionMarketValue(game, record.editionStatus, record.appraisedValue) * getOwnedCopyCount(record)
}

function getOwnedValueLabel(game: CatalogEntry) {
  const record = getRecord(game.id)
  const editionLabel = getEditionLabel(record.editionStatus)
  const baseLabel =
    record.editionStatus === 'graded'
      ? 'Appraised value'
      : isCompleteEdition(record)
        ? 'Complete value'
        : `${editionLabel} value`
  return getOwnedCopyCount(record) > 1 ? `${baseLabel} x${getOwnedCopyCount(record)}` : baseLabel
}

function getOwnedCopyCount(record: GameRecord) {
  if (record.copies && record.copies.length > 0) return record.copies.length
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

function matchesSearchValue(game: CatalogEntry, searchValue: string, includeIdFields = false) {
  const normalizedSearch = normalizeSearchText(searchValue)

  if (!normalizedSearch) {
    return true
  }

  const cacheKey = `${includeIdFields ? '1' : '0'}|${game.id}|${game.title}|${game.console}|${game.region}|${game.rarity}|${game.releaseType ?? ''}|${game.variantLabel ?? ''}`
  let haystack = searchHaystackCache.get(cacheKey)

  if (!haystack) {
    const reference = getGameReference(game)
    haystack = normalizeSearchText(
      [
        game.title,
        game.console,
        game.region,
        game.rarity,
        game.variantLabel ?? '',
        getReleaseTypeLabel(getEffectiveReleaseType(game)),
        ...(includeIdFields ? [game.id, reference?.productId ?? ''] : []),
        reference?.alias ?? '',
        reference?.publisher ?? '',
      ].join(
        ' ',
      ),
    )
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

function getAlphaKey(title: string): string {
  const stripped = title.replace(/^(the|a|an)\s+/i, '').trim()
  const first = stripped[0]?.toUpperCase() ?? '#'
  return /[A-Z]/.test(first) ? first : '#'
}

// Lower number = higher cultural priority for picking the "definitive" release
const LEGEND_CONSOLE_RANK: Record<string, number> = {
  'NES': 1, 'Atari 2600': 2, 'Sega Master System': 3, 'TurboGrafx-16': 4,
  'Sega Genesis': 5, 'Super Nintendo': 6, 'Game Boy': 7, 'Sega CD': 8,
  'Nintendo 64': 9, 'PlayStation': 10, 'Sega Saturn': 11, 'Atari 7800': 12,
  'Dreamcast': 13, 'Game Boy Color': 14, 'PlayStation 2': 15, 'GameCube': 16,
  'Game Boy Advance': 17, 'Nintendo DS': 18, 'Neo Geo AES': 19,
  '3DO': 20, 'TurboGrafx CD': 21,
}

function isLegendGame(game: CatalogEntry): boolean {
  if (!LEGENDS_CONSOLES.has(game.console)) return false
  const t = game.title.toLowerCase()
  return LEGENDS_PATTERNS.some((p) => t.includes(p))
}

function deduplicateLegends(games: CatalogEntry[]): CatalogEntry[] {
  const best = new Map<string, CatalogEntry>()
  for (const game of games) {
    const key = game.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    const existing = best.get(key)
    if (!existing) {
      best.set(key, game)
      continue
    }
    const gameYear = game.year ?? 9999
    const existYear = existing.year ?? 9999
    const gameRank = LEGEND_CONSOLE_RANK[game.console] ?? 99
    const existRank = LEGEND_CONSOLE_RANK[existing.console] ?? 99
    if (gameYear < existYear || (gameYear === existYear && gameRank < existRank)) {
      best.set(key, game)
    }
  }
  return [...best.values()]
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
    state.releaseTypeFilter,
    state.ownershipFilter,
    state.sortMode,
    state.letterFilter,
  ].join(':')

  if (filteredGamesCache && filteredGamesCacheKey === key) {
    return filteredGamesCache
  }

  const searchValue = state.search.trim()
  const activeCatalog =
    state.consoleFilter === 'All consoles'
      ? getCatalog()
      : state.consoleFilter === LEGENDS_FILTER
        ? deduplicateLegends(getCatalog().filter(isLegendGame))
        : getCatalog().filter((game) => game.console === state.consoleFilter)

  filteredGamesCache = activeCatalog
    .filter((game) => state.regionFilter === 'All regions' || game.region === state.regionFilter)
    .filter((game) => state.yearFilter === 'All years' || String(game.year ?? '') === state.yearFilter)
    .filter((game) => {
      const releaseType = getEffectiveReleaseType(game)

      switch (state.releaseTypeFilter) {
        case 'Licensed':
          return releaseType === 'licensed'
        case 'Unlicensed':
          return releaseType === 'unlicensed'
        case 'Homebrew':
          return releaseType === 'homebrew'
        case 'Custom':
          return releaseType === 'custom'
        case 'All release types':
        default:
          return true
      }
    })
    .filter((game) => {
      if (!searchValue) {
        return true
      }

      return matchesSearchValue(game, searchValue, true)
    })
    .filter((game) => {
      switch (state.ownershipFilter) {
        case 'all':
          return true
        case 'tradeable-now':
          return !!getTradeableNowSet()?.has(game.id)
        case 'wanted-now':
          return !!getWantedNowSet()?.has(game.id)
        default:
          return getRecord(game.id).status === state.ownershipFilter
      }
    })
    .filter((game) => {
      if (!state.letterFilter) return true
      return getAlphaKey(game.title) === state.letterFilter
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
        case 'trade-recent':
          return getTradeListedTimestamp(right.id) - getTradeListedTimestamp(left.id) || left.title.localeCompare(right.title)
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

function hasCompleteCatalogLoaded() {
  return (
    state.catalogMeta.length > 0 &&
    state.generatedCatalog.length > 0 &&
    state.loadedConsoles.length >= state.catalogMeta.length &&
    !state.catalogLoadError
  )
}

function getInstantLibraryCounts() {
  let ownedCount = 0
  let wantedCount = 0

  for (const record of Object.values(state.library)) {
    if (record.status === 'owned') {
      ownedCount += 1
    } else if (record.status === 'wanted') {
      wantedCount += 1
    }
  }

  return { ownedCount, wantedCount }
}

function getHeroCollectionCounts() {
  const instantCounts = getInstantLibraryCounts()
  const cachedHeroStats =
    state.cachedHeroStats && state.cachedHeroStats.accountEmail === (state.accountEmail || '')
      ? state.cachedHeroStats
      : null

  return {
    ownedCount: Math.max(instantCounts.ownedCount, cachedHeroStats?.ownedCount ?? 0),
    wantedCount: Math.max(instantCounts.wantedCount, cachedHeroStats?.wantedCount ?? 0),
    cachedHeroStats,
  }
}

function updateHeroStatsSnapshot(summary: DashboardSummary) {
  if (!hasCompleteCatalogLoaded()) {
    return
  }

  const counts = getInstantLibraryCounts()
  const nextSnapshot: HeroStatsSnapshot = {
    accountEmail: state.accountEmail || '',
    ownedCount: counts.ownedCount,
    wantedCount: counts.wantedCount,
    ownedTrackedValueUsd: summary.ownedTrackedValue,
    ownedCompleteValueUsd: summary.ownedCompleteValue,
    wishlistValueUsd: summary.wishlistValue,
    completionPercentage: summary.completionPercentage,
  }

  const current = state.cachedHeroStats
  if (
    current &&
    current.accountEmail === nextSnapshot.accountEmail &&
    current.ownedCount === nextSnapshot.ownedCount &&
    current.wantedCount === nextSnapshot.wantedCount &&
    current.ownedTrackedValueUsd === nextSnapshot.ownedTrackedValueUsd &&
    current.ownedCompleteValueUsd === nextSnapshot.ownedCompleteValueUsd &&
    current.wishlistValueUsd === nextSnapshot.wishlistValueUsd &&
    current.completionPercentage === nextSnapshot.completionPercentage
  ) {
    return
  }

  saveHeroStatsSnapshot(nextSnapshot)
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
  updateHeroStatsSnapshot(dashboardSummaryCache)

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
      actionLabel: 'Browse Games Library',
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
void getCollectionCompletenessScore

function getOnboardingSteps(): OnboardingStep[] {
  return [
    {
      label: 'Create your vault account',
      detail: 'Protect the collection so it follows you across devices.',
      done: state.authToken !== '',
      action: state.authToken ? 'open-account-settings' : 'open-register',
      actionLabel: state.authToken ? 'Account' : 'Create Free Vault',
    },
    {
      label: 'Mark your first owned game',
      detail: 'Unlock shelf value, completion progress, and collector rank.',
      done: getOwnedGames().length > 0,
      action: 'browse-library',
      actionLabel: 'Browse Games Library',
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
void getOnboardingSteps

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

function getDetailCoverUpgradeUrl(game: CatalogEntry) {
  if (!game.coverUrl) {
    return ''
  }

  const immediateCoverUrl = getCardCoverUrl(game)
  const detailCoverUrl = getDetailCoverUrl(game)
  return detailCoverUrl !== immediateCoverUrl ? detailCoverUrl : ''
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

function getBackdropSignature(games: CatalogEntry[]) {
  return games
    .map((game) => `${game.id}|${game.coverUrl || ''}|${game.title}|${game.console}|${game.region}`)
    .join('||')
}

function renderBackdropWallFromGames(games: CatalogEntry[]) {
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

function renderBackdropWall(visibleGames: CatalogEntry[], catalog: CatalogEntry[]) {
  if (!state.backdropReady) {
    return ''
  }

  return renderBackdropWallFromGames(getBackdropGames(visibleGames, catalog))
}

function syncBackdropWall(visibleGames: CatalogEntry[], catalog: CatalogEntry[]) {
  const backdrop = app.querySelector('.collection-backdrop')

  if (!state.backdropReady) {
    if (backdrop) {
      backdrop.remove()
    }
    renderedBackdropSignature = ''
    return
  }

  const games = getBackdropGames(visibleGames, catalog)
  const signature = getBackdropSignature(games)

  if (!games.length) {
    if (backdrop) {
      backdrop.remove()
    }
    renderedBackdropSignature = ''
    return
  }

  if (backdrop && renderedBackdropSignature === signature) {
    return
  }

  const nextBackdropMarkup = renderBackdropWallFromGames(games)

  if (backdrop) {
    backdrop.outerHTML = nextBackdropMarkup
  } else {
    app.insertAdjacentHTML('afterbegin', nextBackdropMarkup)
  }

  renderedBackdropSignature = signature
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

function hasExternalMarketSource(game: CatalogEntry) {
  return Boolean(game.priceSourceUrl) && !game.priceSourceUrl.includes('/custom-entry')
}

function getMarketCoverageSummary(game: CatalogEntry) {
  const sourcedFields = [
    { label: 'Loose', ready: typeof game.priceLoose === 'number' && game.priceLoose > 0 },
    { label: 'Complete', ready: typeof game.priceComplete === 'number' && game.priceComplete > 0 },
    { label: 'Sealed', ready: typeof game.priceSealed === 'number' && game.priceSealed > 0 },
  ]

  const sourcedCount = sourcedFields.filter((field) => field.ready).length
  const sourcedLabels = sourcedFields.filter((field) => field.ready).map((field) => field.label)
  const missingLabels = sourcedFields.filter((field) => !field.ready).map((field) => field.label)
  const customEntry = !hasExternalMarketSource(game)

  if (customEntry) {
    return {
      tone: 'manual',
      title: 'Collector-entered market data',
      detail: 'This entry was added manually, so values should be treated as your own reference until a sourced market link exists.',
      sourcedLabels,
      missingLabels,
    }
  }

  if (sourcedCount === 3) {
    return {
      tone: 'strong',
      title: 'Strong market coverage',
      detail: 'Loose, complete, and sealed reference values are all available for this title.',
      sourcedLabels,
      missingLabels,
    }
  }

  if (sourcedCount === 2) {
    return {
      tone: 'good',
      title: 'Collector-grade reference coverage',
      detail: `${sourcedLabels.join(' + ')} values are sourced. ${missingLabels.join(' / ')} still needs deeper market coverage.`,
      sourcedLabels,
      missingLabels,
    }
  }

  return {
    tone: 'light',
    title: 'Early market coverage',
    detail: 'This title still needs deeper condition coverage, so use the current market number as a starting reference instead of the final word.',
    sourcedLabels,
    missingLabels,
  }
}

function getOwnedButtonLabel(record: GameRecord): string {
  if (record.status !== 'owned') return 'Mark owned'
  const count = getOwnedCopyCount(record)
  if (count > 1) return `${count} in collection`
  return `Owned: ${getEditionLabel(record.editionStatus)}`
}

function chooseVariantTarget(record: GameRecord): VariantTarget | null {
  const copies = getRecordCopies(record)

  if (copies.length <= 1) {
    return {
      copyIndex: copies.length === 1 ? 0 : null,
      existingVariant: normalizeVariantLabel(copies[0]?.variant ?? record.variant),
    }
  }

  const response = window.prompt(
    `Choose which copy variant to update (1-${copies.length}).`,
    '1',
  )

  if (response === null) {
    return null
  }

  const copyIndex = Math.max(1, Math.min(copies.length, Number.parseInt(response.trim(), 10) || 1)) - 1

  return {
    copyIndex,
    existingVariant: normalizeVariantLabel(copies[copyIndex]?.variant),
  }
}

function chooseGradeTarget(record: GameRecord): GradeTarget | null {
  const copies = getRecordCopies(record)

  if (copies.length <= 1) {
    return {
      copyIndex: copies.length === 1 ? 0 : null,
      existingLabel: typeof copies[0]?.gradedLabel === 'string' && copies[0].gradedLabel.trim()
        ? copies[0].gradedLabel.trim()
        : typeof record.gradedLabel === 'string' ? record.gradedLabel.trim() : '',
      existingValue: typeof copies[0]?.appraisedValue === 'number'
        ? copies[0].appraisedValue
        : (typeof record.appraisedValue === 'number' ? record.appraisedValue : null),
    }
  }

  const gradedIndexes = copies
    .map((copy, index) => ({ copy, index }))
    .filter(({ copy }) => copy.edition === 'graded')

  const eligible = gradedIndexes.length > 0 ? gradedIndexes : copies.map((copy, index) => ({ copy, index }))
  const response = window.prompt(
    `Choose which copy grade to update (${eligible.map(({ index }) => index + 1).join(', ')}).`,
    String((eligible[0]?.index ?? 0) + 1),
  )

  if (response === null) {
    return null
  }

  const wanted = Number.parseInt(response.trim(), 10) || (eligible[0]?.index ?? 0) + 1
  const chosen = eligible.find(({ index }) => index === wanted - 1) ?? eligible[0]

  return {
    copyIndex: chosen?.index ?? 0,
    existingLabel: typeof chosen?.copy?.gradedLabel === 'string' ? chosen.copy.gradedLabel.trim() : '',
    existingValue: typeof chosen?.copy?.appraisedValue === 'number' ? chosen.copy.appraisedValue : null,
  }
}

function getOwnershipLabel(status: GameStatus, record?: GameRecord) {
  if (status === 'owned') {
    const count = record ? getOwnedCopyCount(record) : 1
    return count > 1 ? `${count} in collection` : 'Owned'
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
      return 'Cart + manual'
    case 'box-only':
      return 'Box only'
    case 'manual-only':
      return 'Manual only'
    case 'box-manual':
      return 'Box + manual'
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

  const copies = getRecordCopies(record)
  if (copies.length > 1) {
    const counts = new Map<EditionStatus, number>()
    for (const c of copies) counts.set(c.edition, (counts.get(c.edition) ?? 0) + 1)
    return [...counts.entries()].map(([ed, n]) => `${n}× ${getEditionLabel(ed)}`).join(', ')
  }

  return `${getEditionLabel(record.editionStatus)} owned`
}

function getOwnedVariantSummary(record: GameRecord) {
  if (record.status !== 'owned') {
    return normalizeVariantLabel(record.variant)
  }

  const copies = getRecordCopies(record)
  const variants = [...new Set(copies.map((copy) => normalizeVariantLabel(copy.variant)).filter(Boolean))]

  if (!variants.length) {
    return normalizeVariantLabel(record.variant)
  }

  return variants.join(', ')
}

function getConditionLabel(condition: ConditionRating) {
  return condition.charAt(0).toUpperCase() + condition.slice(1)
}

function isTradeEditionStatus(value: string | undefined | null): value is EditionStatus {
  return !!value && editionOptions.includes(value as EditionStatus)
}

function isTradeConditionRating(value: string | undefined | null): value is ConditionRating {
  return !!value && conditionOptions.includes(value as ConditionRating)
}

function getTradeEditionStatus(value: string | undefined | null) {
  return isTradeEditionStatus(value) ? value : 'loose'
}

function getTradeConditionRating(value: string | undefined | null) {
  return isTradeConditionRating(value) ? value : 'good'
}

function getTradeMarketValue(game: CatalogEntry, editionStatus: string | undefined | null) {
  const safeEdition = getTradeEditionStatus(editionStatus)
  return getEditionMarketValue(game, safeEdition)
}

function getTradeWantedCount(gameId: string) {
  return state.tradeWantedByGameId[gameId] ?? 0
}

function hasHighTradeDemand(gameId: string) {
  return getTradeWantedCount(gameId) >= 3
}

function getTradeableNowSet() {
  return state.tradeableNowIds
}

function getWantedNowSet() {
  return state.wantedNowIds
}

function getTradeListedTimestamp(gameId: string) {
  const value = getRecord(gameId).tradeListedAt
  return value ? new Date(value).getTime() || 0 : 0
}

function updateTradeListingState(record: GameRecord, forTrade: boolean) {
  const copies = getRecordCopies(record)
  const normalizedCopies = copies.length <= 1
    ? (copies.length
      ? [{ ...copies[0], forTrade }]
      : (record.status === 'owned'
        ? [{
            edition: record.editionStatus,
            condition: record.condition,
            pricePaid: record.pricePaid,
            forTrade,
          }]
        : undefined))
    : (forTrade ? copies : copies.map((copy) => ({ ...copy, forTrade: false })))

  return {
    ...record,
    forTrade,
    tradeListedAt: forTrade ? (record.forTrade ? record.tradeListedAt ?? new Date().toISOString() : new Date().toISOString()) : null,
    copies: normalizedCopies,
  }
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return ''
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(diffMs / 3_600_000)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(diffMs / 86_400_000)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function formatTitleList(gameIds: string[], limit = 2) {
  const titles = gameIds
    .map((gameId) => getGameById(gameId)?.title ?? gameId)
    .filter(Boolean)
  const picked = titles.slice(0, limit)
  if (!picked.length) return ''
  if (titles.length <= limit) return picked.join(', ')
  return `${picked.join(', ')} +${titles.length - limit} more`
}

function getTradeMatchReason(match: TradeMatch) {
  if (!match.isMutual) return ''
  const theyHave = formatTitleList(match.theyHaveWhatIWant, 2)
  const theyWant = formatTitleList(match.iHaveWhatTheyWant, 2)
  if (theyHave && theyWant) {
    return `Why this match works: they have ${theyHave}, and they want ${theyWant}.`
  }
  return ''
}

function hasPendingTradeWithCollector(userId: string, gameId?: string) {
  return state.tradeRequests.some((request) => {
    if (request.status !== 'pending') return false
    if (request.partnerUserId !== userId) return false
    if (gameId && request.gameId !== gameId) return false
    return true
  })
}

function renderTradeGameSnapshot(
  gameId: string,
  tradeEdition?: string | null,
  tradeCondition?: string | null,
  tradeVariant?: string | null,
) {
  const game = getGameById(gameId)

  if (!game) {
    return ''
  }

  const safeEdition = getTradeEditionStatus(tradeEdition)
  const safeCondition = getTradeConditionRating(tradeCondition)
  const safeVariant = normalizeVariantLabel(tradeVariant ?? '')
  const cover = game.coverUrl ? `<img class="trade-game-cover" src="${escapeHtml(game.coverUrl)}" alt="" loading="lazy" decoding="async" />` : '<div class="trade-game-cover trade-game-cover--blank"></div>'

  return `
    <div class="trade-game-snapshot">
      ${cover}
      <div class="trade-game-snapshot-copy">
        <strong>${escapeHtml(game.title)}${hasHighTradeDemand(gameId) ? ' <span class="trade-high-demand-badge">High demand</span>' : ''}</strong>
        <span>${escapeHtml(game.console)}</span>
        <span>${escapeHtml(getEditionLabel(safeEdition))} / ${escapeHtml(getConditionLabel(safeCondition))}</span>
        ${safeVariant ? `<span>${escapeHtml(safeVariant)}</span>` : ''}
        <span>Trade value ${escapeHtml(formatPrice(getTradeMarketValue(game, safeEdition)))}</span>
        ${getTradeWantedCount(gameId) > 0 ? `<span>Wanted by ${getTradeWantedCount(gameId)} collector${getTradeWantedCount(gameId) === 1 ? '' : 's'}</span>` : ''}
      </div>
    </div>
  `
}

function renderLocalTradeGameSnapshot(gameId: string) {
  const record = getRecord(gameId)
  const tradeCopy = getRecordCopies(record).find((copy) => copy.forTrade)
  return renderTradeGameSnapshot(
    gameId,
    tradeCopy?.edition ?? record.editionStatus,
    tradeCopy?.condition ?? record.condition,
    tradeCopy?.variant ?? record.variant,
  )
}

function getSyncPayload() {
  return {
    library: state.library,
    customCatalog: state.customCatalog,
    currencyCode: state.currencyCode,
    barcodeMappings: state.barcodeMappings,
    deletedGameIds: state.deletedGameIds,
    activityEvents: state.activityEvents,
    heroStats: getHeroStatsSnapshotForSync(),
    clientUpdatedAt: new Date().toISOString(),
    version: 3,
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
    variant: normalizeVariantLabel(record.variant),
    gradedLabel: typeof record.gradedLabel === 'string' ? record.gradedLabel.slice(0, 80).trim() : '',
    appraisedValue: typeof record.appraisedValue === 'number' ? record.appraisedValue : null,
    targetPrice: typeof record.targetPrice === 'number' ? record.targetPrice : null,
    notes: typeof record.notes === 'string' ? record.notes : '',
    dateAcquired: typeof record.dateAcquired === 'string' && record.dateAcquired ? record.dateAcquired : null,
    acquiredFrom: typeof record.acquiredFrom === 'string' ? record.acquiredFrom : '',
    forTrade: typeof record.forTrade === 'boolean' ? record.forTrade : false,
    tradeListedAt: typeof record.tradeListedAt === 'string' && record.tradeListedAt ? record.tradeListedAt : null,
    copies: Array.isArray(record.copies) ? record.copies.map(normalizeCopy).filter((c): c is GameCopy => c !== null) : undefined,
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
    safeRecord.variant !== '' ||
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
    state.deletedGameIds.length > 0 ||
    state.activityEvents.length > 0
  )
}

function mergeGameRecord(localRecord: GameRecord | undefined, remoteRecord: GameRecord) {
  const safeRemoteRecord = normalizeGameRecord(remoteRecord)

  if (!localRecord) {
    return safeRemoteRecord
  }

  const safeLocalRecord = normalizeGameRecord(localRecord)

  const localCopies = safeLocalRecord.copies
  const remoteCopies = safeRemoteRecord.copies
  const mergedCopies = localCopies && remoteCopies
    ? localCopies.length >= remoteCopies.length ? localCopies : remoteCopies
    : localCopies ?? remoteCopies

  return {
    status: safeLocalRecord.status !== 'missing' ? safeLocalRecord.status : safeRemoteRecord.status,
    completeInBox: safeLocalRecord.completeInBox || safeRemoteRecord.completeInBox,
    pricePaid: safeLocalRecord.pricePaid ?? safeRemoteRecord.pricePaid,
    favorite: safeLocalRecord.favorite || safeRemoteRecord.favorite,
    ownedCopies: Math.max(getOwnedCopyCount(safeLocalRecord), getOwnedCopyCount(safeRemoteRecord)),
    editionStatus: safeLocalRecord.editionStatus !== 'loose' ? safeLocalRecord.editionStatus : safeRemoteRecord.editionStatus,
    condition: safeLocalRecord.condition !== 'good' ? safeLocalRecord.condition : safeRemoteRecord.condition,
    variant: safeLocalRecord.variant?.trim() ? safeLocalRecord.variant : safeRemoteRecord.variant,
    gradedLabel: safeLocalRecord.gradedLabel?.trim() ? safeLocalRecord.gradedLabel : safeRemoteRecord.gradedLabel,
    appraisedValue: safeLocalRecord.appraisedValue ?? safeRemoteRecord.appraisedValue,
    targetPrice: safeLocalRecord.targetPrice ?? safeRemoteRecord.targetPrice,
    notes: safeLocalRecord.notes.trim() ? safeLocalRecord.notes : safeRemoteRecord.notes,
    dateAcquired: safeLocalRecord.dateAcquired ?? safeRemoteRecord.dateAcquired,
    acquiredFrom: safeLocalRecord.acquiredFrom.trim() ? safeLocalRecord.acquiredFrom : safeRemoteRecord.acquiredFrom,
    forTrade: safeLocalRecord.forTrade || safeRemoteRecord.forTrade,
    tradeListedAt:
      (safeLocalRecord.forTrade ? safeLocalRecord.tradeListedAt : null) ??
      (safeRemoteRecord.forTrade ? safeRemoteRecord.tradeListedAt : null) ??
      null,
    copies: mergedCopies,
  } satisfies GameRecord
}

function mergeDeletedGameIds(remoteDeletedGameIds: string[]) {
  const incoming = remoteDeletedGameIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim())
  return [...new Set([...incoming, ...state.deletedGameIds])].slice(-MAX_LIBRARY_ENTRIES)
}

function mergeLibraryData(remoteLibrary: Record<string, GameRecord>, deletedGameIds: string[] = []) {
  const merged = { ...remoteLibrary }
  const deletedSet = new Set(deletedGameIds)

  for (const deletedId of deletedSet) {
    delete merged[deletedId]
  }

  for (const [id, localRecord] of Object.entries(state.library)) {
    if (deletedSet.has(id)) {
      continue
    }

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
  deletedGameIds?: string[]
  activityEvents?: unknown[]
  heroStats?: {
    accountEmail?: string
    ownedCount?: unknown
    wantedCount?: unknown
    ownedTrackedValueUsd?: unknown
    ownedCompleteValueUsd?: unknown
    wishlistValueUsd?: unknown
    completionPercentage?: unknown
  } | null
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
  const remoteDeletedGameIds = Array.isArray(syncState.deletedGameIds)
    ? [...new Set(syncState.deletedGameIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))].slice(0, MAX_LIBRARY_ENTRIES)
    : []
  const rawHeroStats = syncState.heroStats && typeof syncState.heroStats === 'object' ? syncState.heroStats : null
  const remoteHeroStats =
    rawHeroStats &&
    typeof rawHeroStats.ownedCount === 'number' &&
    typeof rawHeroStats.wantedCount === 'number' &&
    typeof rawHeroStats.ownedTrackedValueUsd === 'number' &&
    typeof rawHeroStats.ownedCompleteValueUsd === 'number' &&
    typeof rawHeroStats.wishlistValueUsd === 'number' &&
    typeof rawHeroStats.completionPercentage === 'number'
      ? {
          accountEmail:
            typeof rawHeroStats.accountEmail === 'string' && rawHeroStats.accountEmail.trim().length > 0
              ? rawHeroStats.accountEmail.trim().toLowerCase()
              : (state.accountEmail || '').toLowerCase(),
          ownedCount: rawHeroStats.ownedCount,
          wantedCount: rawHeroStats.wantedCount,
          ownedTrackedValueUsd: rawHeroStats.ownedTrackedValueUsd,
          ownedCompleteValueUsd: rawHeroStats.ownedCompleteValueUsd,
          wishlistValueUsd: rawHeroStats.wishlistValueUsd,
          completionPercentage: rawHeroStats.completionPercentage,
        } satisfies HeroStatsSnapshot
      : null

  const shouldMerge = options.mergeWithLocal && hasLocalCollectionData()
  state.deletedGameIds = shouldMerge ? mergeDeletedGameIds(remoteDeletedGameIds) : remoteDeletedGameIds

  state.library = shouldMerge ? mergeLibraryData(remoteLibrary, state.deletedGameIds) : Object.fromEntries(
    Object.entries(remoteLibrary).filter(([id]) => !state.deletedGameIds.includes(id)),
  )
  state.customCatalog = shouldMerge ? mergeCustomCatalogData(remoteCustomCatalog) : remoteCustomCatalog
  state.activityEvents = shouldMerge ? mergeActivityEvents(remoteActivityEvents) : remoteActivityEvents.slice(0, MAX_ACTIVITY_EVENTS)

  if (remoteHeroStats && remoteHeroStats.accountEmail === (state.accountEmail || '').toLowerCase()) {
    saveHeroStatsSnapshot(remoteHeroStats)
  }

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
  localStorage.setItem(DELETED_GAME_IDS_STORAGE_KEY, JSON.stringify(state.deletedGameIds))
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
}

async function hydrateAccount() {
  if (!state.authToken) {
    state.accountHydrationPending = false
    return
  }

  state.accountHydrationPending = true
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

  state.accountHydrationPending = false
  render()
  void fetchTradeNotifications()
}

async function fetchTradeNotifications() {
  if (!state.authToken) return
  try {
    const result = await getTradeRequests(state.authToken)
    const prevTotal = state.tradePending + state.tradeUnread
    state.tradeUnread = result.unreadCount
    state.tradePending = result.pendingCount ?? 0
    if (state.tradePending + state.tradeUnread !== prevTotal) {
      render()
    }
  } catch {
    // silent — badge just stays at 0
  }
}

let tradeNotificationTimer = 0

function startTradeNotificationPoll() {
  if (tradeNotificationTimer) return
  tradeNotificationTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && state.authToken) {
      void fetchTradeNotifications()
    }
  }, 60_000)
}

function stopTradeNotificationPoll() {
  if (tradeNotificationTimer) {
    window.clearInterval(tradeNotificationTimer)
    tradeNotificationTimer = 0
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.authToken) {
    void fetchTradeNotifications()
  }
})

function renderFilterChip(filter: OwnershipFilter, label: string) {
  const active = state.ownershipFilter === filter ? 'is-active' : ''
  return `<button class="chip ${active}" data-action="ownership-filter" data-filter="${filter}" type="button">${label}</button>`
}


function getTradeAvailabilityCount(gameId: string) {
  return state.tradeAvailabilityByGameId[gameId] ?? 0
}

async function fetchTradeAvailabilityForGames(
  gameIds: string[],
  rerenderMode: 'catalog' | 'full' | 'none' = 'catalog',
) {
  const uniqueIds = [...new Set(gameIds.map((gameId) => gameId.trim()).filter(Boolean))]
  const missingIds = uniqueIds.filter((gameId) => state.tradeAvailabilityByGameId[gameId] === undefined)

  if (!missingIds.length) {
    return false
  }

  const fetchSequence = ++tradeAvailabilityFetchSequence

  try {
    const result = await getTradeAvailability(missingIds, state.authToken ?? undefined)

    if (fetchSequence !== tradeAvailabilityFetchSequence) {
      return false
    }

    const nextCounts = { ...state.tradeAvailabilityByGameId }
    let changed = false

    for (const gameId of missingIds) {
      if (nextCounts[gameId] !== 0) {
        nextCounts[gameId] = 0
        changed = true
      }
    }

    for (const entry of result.availability) {
      if (!entry || typeof entry.gameId !== 'string') {
        continue
      }

      const nextCount = typeof entry.count === 'number' ? entry.count : 0
      if (nextCounts[entry.gameId] !== nextCount) {
        nextCounts[entry.gameId] = nextCount
        changed = true
      }
    }

    if (!changed) {
      return false
    }

    state.tradeAvailabilityByGameId = nextCounts
    if (rerenderMode === 'full') {
      requestBackgroundFullRefresh()
    } else if (rerenderMode === 'catalog') {
      requestBackgroundCatalogRefresh()
    }
    return true
  } catch {
    // Trade hints should never interrupt browsing.
    return false
  }
}

async function fetchTradeWantedDemandForGames(
  gameIds: string[],
  rerenderMode: 'details' | 'catalog' | 'full' | 'none' = 'details',
) {
  const uniqueIds = [...new Set(gameIds.filter(Boolean))]

  if (!uniqueIds.length) {
    return false
  }

  const missingIds = uniqueIds.filter((gameId) => state.tradeWantedByGameId[gameId] === undefined)

  if (!missingIds.length) {
    return false
  }

  try {
    const result = await getTradeWantedDemand(missingIds, state.authToken ?? undefined)
    const nextCounts = { ...state.tradeWantedByGameId }
    let changed = false
    for (const item of result.demand) {
      if (nextCounts[item.gameId] !== item.count) {
        nextCounts[item.gameId] = item.count
        changed = true
      }
    }
    for (const gameId of missingIds) {
      if (nextCounts[gameId] === undefined) {
        nextCounts[gameId] = 0
        changed = true
      }
    }

    if (!changed) {
      return false
    }

    state.tradeWantedByGameId = nextCounts
    if (rerenderMode === 'full') {
      requestBackgroundFullRefresh()
    } else if (rerenderMode === 'catalog') {
      requestBackgroundCatalogRefresh()
    } else if (rerenderMode === 'details' && state.selectedGameId && missingIds.includes(state.selectedGameId)) {
      requestBackgroundFullRefresh()
    }
    return true
  } catch {
    // Leave demand quiet if lookup fails.
    return false
  }
}

async function ensureTradeNowFilterData(filter: OwnershipFilter) {
  if (filter === 'tradeable-now') {
    if (state.tradeableNowIds) {
      return
    }
    try {
      const result = await getTradeableNowGameIds(state.authToken ?? undefined)
      state.tradeableNowIds = new Set(result.gameIds)
    } catch {
      state.tradeableNowIds = new Set()
    }
  }

  if (filter === 'wanted-now') {
    if (state.wantedNowIds) {
      return
    }
    try {
      const result = await getWantedNowGameIds(state.authToken ?? undefined)
      state.wantedNowIds = new Set(result.gameIds)
    } catch {
      state.wantedNowIds = new Set()
    }
  }
}

function scheduleTradeAvailabilityRefresh(games: CatalogEntry[]) {
  if (pendingTradeAvailabilityRefresh) {
    window.clearTimeout(pendingTradeAvailabilityRefresh)
  }

  const gameIds = games.map((game) => game.id)

  pendingTradeAvailabilityRefresh = window.setTimeout(() => {
    pendingTradeAvailabilityRefresh = 0
    void fetchTradeAvailabilityForGames(gameIds)
  }, 120)
}

function scheduleCollectorInsightRefresh() {
  if (pendingCollectorInsightRefresh) {
    window.clearTimeout(pendingCollectorInsightRefresh)
  }

  const ownedIds = getOwnedGames().map((game) => game.id).slice(0, 32)
  const wantedIds = getWantedGames().map((game) => game.id).slice(0, 32)

  if (!ownedIds.length && !wantedIds.length) {
    return
  }

  pendingCollectorInsightRefresh = window.setTimeout(() => {
    pendingCollectorInsightRefresh = 0
    void Promise.all([
      wantedIds.length
        ? fetchTradeAvailabilityForGames(wantedIds, 'none')
        : Promise.resolve(false),
      ownedIds.length
        ? fetchTradeWantedDemandForGames(ownedIds, 'none')
        : Promise.resolve(false),
    ]).then((results) => {
      if (results.some(Boolean)) {
        if (state.selectedGameId || state.tradeView || state.ownershipPickerGameId || state.customEntryOpen || state.authView !== 'none') {
          requestBackgroundFullRefresh()
        } else {
          requestBackgroundCatalogRefresh()
        }
      }
    })
  }, 160)
}

async function openTradeRequestFlow(gameId: string) {
  if (!state.authToken) {
    state.authView = 'login'
    render()
    return
  }

  state.tradeAvailabilityOwnersGameId = gameId
  state.tradeAvailabilityOwners = []
  state.tradeAvailabilityOwnersLoading = true
  state.tradeInterestGameId = gameId
  state.tradeInterestUserId = null
  state.tradeSendError = ''
  render()

  try {
    const result = await getTradeAvailabilityOwners(state.authToken, gameId)
    state.tradeAvailabilityOwners = result.owners
    const firstReadyOwner = result.owners.find((owner) => !owner.hasPendingRequest)
    state.tradeInterestUserId = result.owners.length === 1 ? (firstReadyOwner?.userId ?? null) : null
  } catch (error) {
    state.tradeAvailabilityOwners = []
    state.tradeSendError = error instanceof Error ? error.message : 'Could not load collectors offering this game.'
  } finally {
    state.tradeAvailabilityOwnersLoading = false
    render()
  }
}

function renderCard(game: CatalogEntry) {
  const record = getRecord(game.id)
  const isWanted = record.status === 'wanted'
  const completeText = game.priceComplete === null ? 'Listing price only' : formatPrice(game.priceComplete)
  const yearText = game.year === null ? 'Release year unavailable' : `Released ${game.year}`
  const isOwned = record.status === 'owned'
  const ownedEditionText = getOwnedEditionSummary(record)
  const variantSummary = getVariantSummary(game)
  const ownedPulseClass = state.justOwnedGameId === game.id ? 'just-owned' : ''
  const safeGameId = escapeHtml(game.id)
  const tradeAvailabilityCount = getTradeAvailabilityCount(game.id)
  const tradeWantedCount = getTradeWantedCount(game.id)
  const showTradeAvailability = tradeAvailabilityCount > 0 && record.status !== 'owned'
  const collectorSignal = showTradeAvailability
    ? (tradeAvailabilityCount === 1 ? '1 live trader' : `${tradeAvailabilityCount} live traders`)
    : isOwned && tradeWantedCount > 0
      ? (tradeWantedCount === 1 ? '1 collector wants this' : `${tradeWantedCount} collectors want this`)
      : game.trendDelta > 0.12
        ? `Market moving +${Math.round(game.trendDelta * 100)}%`
        : isWanted
          ? 'On your wishlist'
          : 'Track value, condition, and notes'
  const editorialLabel = isOwned
    ? (record.forTrade ? 'Listed for trade' : 'In your collection')
    : isWanted
      ? 'On your wishlist'
      : 'Library'
  const editorialCopy = isOwned
    ? (record.forTrade
        ? 'This copy is listed for trade.'
        : `${getCopiesSummary(record) || 'Tracked'} / ${getOwnedEditionSummary(record)}`)
    : isWanted
      ? (record.targetPrice === null ? 'Saved to your wishlist.' : `Target ${formatPrice(record.targetPrice)}`)
      : (showTradeAvailability
          ? `${tradeAvailabilityCount === 1 ? 'One trade listing is live now.' : `${tradeAvailabilityCount} trade listings are live now.`}`
          : 'Open to track condition, value, notes, and variants.')

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
          <span class="ownership-pill ${getOwnershipTone(record.status)}">${getOwnershipLabel(record.status, record)}</span>
          <span class="rarity-badge rarity-badge--${game.rarity.toLowerCase()}">${game.rarity}</span>
          ${isOwned && record.forTrade ? `<span class="for-trade-chip">Trade live</span>` : ''}
          ${showTradeAvailability ? `<span class="trade-available-chip">${tradeAvailabilityCount === 1 ? '1 live trader' : `${tradeAvailabilityCount} live traders`}</span>` : ''}
        </div>
        ${isOwned ? `<div class="owned-stamp"><strong>Owned</strong><span>${escapeHtml(ownedEditionText)}</span></div>` : ''}
      </div>
      <div class="game-copy">
        <div class="game-meta">
          <p class="eyebrow">${escapeHtml(game.console)} / ${escapeHtml(game.region)}</p>
          <h3>${escapeHtml(game.title)}</h3>
          <p class="subtle">${yearText}</p>
          ${variantSummary ? `<p class="subtle">${escapeHtml(variantSummary)}</p>` : ''}
          <p class="collector-line">${escapeHtml(ownedEditionText)} / ${getConditionLabel(record.condition)}</p>
          <p class="collector-signal">${escapeHtml(collectorSignal)}</p>
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
        <div class="card-editorial-row">
          <span class="card-editorial-chip">${escapeHtml(editorialLabel)}</span>
          <p class="card-editorial-text">${escapeHtml(editorialCopy)}</p>
        </div>
        ${isOwned && record.notes.trim() ? `<div class="card-note-preview"><p class="card-note-text">${escapeHtml(record.notes)}</p></div>` : ''}
        <div class="card-actions">
          <button class="toggle-button ${isOwned ? 'is-confirmed' : ''}" data-action="toggle-owned" data-id="${safeGameId}" type="button">${escapeHtml(getOwnedButtonLabel(record))}</button>
            <button class="ghost-button ${isWanted ? 'is-active' : ''}" data-action="toggle-wanted" data-id="${safeGameId}" type="button">${isWanted ? 'Wanted' : 'Want'}</button>
            <button class="ghost-button ${record.favorite ? 'is-active' : ''}" data-action="toggle-favorite" data-id="${safeGameId}" type="button">Favorite</button>
            <button class="ghost-button" data-action="open-details" data-id="${safeGameId}" type="button">Open details</button>
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
  const safeCoverSourceUrl = escapeHtml(game.coverSourceUrl)
  const variantSummary = getVariantSummary(game)
  const identifierRows = getGameIdentifierRows(game)
  const coverUrl = getCardCoverUrl(game)
  const detailCoverUpgradeUrl = getDetailCoverUpgradeUrl(game)
  const hasLinkedCover = Boolean(game.coverUrl)
  const tradeAvailabilityCount = getTradeAvailabilityCount(game.id)
  const marketCoverage = getMarketCoverageSummary(game)
  const valueGap =
    record.pricePaid === null ? null : getOwnedMarketPrice(game) - record.pricePaid
  const tradeDemandCount = getTradeWantedCount(game.id)

  return `
    <div class="game-modal-backdrop" data-action="close-details">
      <section class="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
        <button class="modal-close" type="button" data-action="close-details" aria-label="Close details">Close</button>
        <div class="game-modal-media ${hasLinkedCover ? '' : 'game-modal-media--fallback'}">
          <img
            class="game-modal-cover"
            src="${coverUrl}"
            alt="${escapeHtml(game.title)} cover art"
            loading="eager"
            decoding="async"
            referrerpolicy="no-referrer"
            ${detailCoverUpgradeUrl ? `data-detail-src="${escapeHtml(detailCoverUpgradeUrl)}"` : ''}
            ${getCoverFallbackAttributes(game)}
          />
        </div>
        <div class="game-modal-copy">
          <p class="kicker">Game details</p>
          <h2 id="game-modal-title">${escapeHtml(game.title)}</h2>
          <p class="modal-subtitle">${escapeHtml(game.console)} / ${escapeHtml(game.region)} / ${game.year ?? 'Release year unavailable'}</p>
          <div class="modal-pill-row">
            <span class="ownership-pill ${getOwnershipTone(record.status)}">${getOwnershipLabel(record.status, record)}</span>
            <span class="rarity-badge rarity-badge--${game.rarity.toLowerCase()}">${game.rarity}</span>
            ${variantSummary ? `<span class="detail-chip">${escapeHtml(variantSummary)}</span>` : ''}
            ${getOwnedVariantSummary(record) ? `<span class="detail-chip">${escapeHtml(getOwnedVariantSummary(record))}</span>` : ''}
            ${record.editionStatus === 'graded' && record.gradedLabel ? `<span class="detail-chip">${escapeHtml(record.gradedLabel)}</span>` : ''}
            <span class="detail-chip">${escapeHtml(getOwnedEditionSummary(record))}</span>
            <span class="detail-chip">Shelf score ${getShelfScore(game)}</span>
            ${getCopiesSummary(record) ? `<span class="detail-chip detail-chip--copies">${escapeHtml(getCopiesSummary(record))}</span>` : `<span class="detail-chip">${getEditionLabel(record.editionStatus)}</span>`}
            <span class="detail-chip">${getConditionLabel(record.condition)}</span>
            ${hasHighTradeDemand(game.id) ? `<span class="detail-chip detail-chip--trade">${getTradeWantedCount(game.id)} collectors want this</span>` : ''}
          </div>
          ${record.status === 'owned' ? `
            <div class="copies-section">
              <p class="modal-section-label">Copies (${getOwnedCopyCount(record)})</p>
              <div class="copies-list">
                ${getRecordCopies(record).map((c, i) => `
                  <span class="copy-chip">
                    <span>${escapeHtml(getEditionLabel(c.edition))} · ${escapeHtml(getConditionLabel(c.condition))}${c.variant ? ` · ${escapeHtml(c.variant)}` : ''}</span>
                    ${c.forTrade ? '<span class="copy-trade-tag">For Trade</span>' : ''}
                    <button class="copy-chip__remove" type="button" data-action="remove-copy" data-id="${safeGameId}" data-copy-index="${i}" aria-label="${getOwnedCopyCount(record) === 1 ? 'Remove from collection' : 'Remove this copy'}">×</button>
                  </span>`).join('')}
              </div>
            </div>
          ` : ''}
          <div class="modal-primary-actions">
            <button class="toggle-button ${record.status === 'owned' ? 'is-confirmed' : ''}" data-action="toggle-owned" data-id="${safeGameId}" type="button">${getOwnedButtonLabel(record)}</button>
            <button class="ghost-button ${record.status === 'wanted' ? 'is-active' : ''}" data-action="toggle-wanted" data-id="${safeGameId}" type="button">${record.status === 'wanted' ? 'Wanted' : 'Want'}</button>
            <button class="ghost-button ${record.favorite ? 'is-active' : ''}" data-action="toggle-favorite" data-id="${safeGameId}" type="button">Favorite</button>
            ${record.status === 'owned' && state.authToken ? `<button class="ghost-button for-trade-btn ${record.forTrade ? 'is-active' : ''}" data-action="toggle-for-trade" data-id="${safeGameId}" type="button">${record.forTrade ? 'Trade live' : 'Offer for trade'}</button>` : ''}
          </div>
          ${record.status === 'owned' && (getTradeWantedCount(game.id) > 0 || record.forTrade) ? `
            <div class="trade-availability-panel">
              <strong>${getTradeWantedCount(game.id) > 0 ? (getTradeWantedCount(game.id) === 1 ? '1 collector currently wants this game.' : `${getTradeWantedCount(game.id)} collectors currently want this game.`) : 'This game is live in your trade list.'}</strong>
              <span>${record.forTrade ? 'This game is currently listed for trade.' : 'Turn trade on if you want other collectors to see it.'}</span>
              ${record.forTrade && record.tradeListedAt ? `<span class="trade-availability-meta">You listed this ${escapeHtml(formatRelativeTime(record.tradeListedAt))}.</span>` : ''}
            </div>
          ` : ''}
          ${tradeAvailabilityCount > 0 && record.status !== 'owned' ? `
            <div class="trade-availability-panel">
              <strong>${tradeAvailabilityCount === 1 ? '1 collector has this marked for trade right now.' : `${tradeAvailabilityCount} collectors have this marked for trade right now.`}</strong>
              <span>${state.authToken ? 'Open the trade request flow from here.' : 'Sign in to contact a collector who listed this game.'}</span>
              <button class="ghost-button trade-availability-panel__button" data-action="open-trade-request" data-id="${safeGameId}" type="button">${state.authToken ? 'Request trade' : 'Sign in to request trade'}</button>
            </div>
          ` : ''}
          <div class="modal-summary-strip">
            <article class="modal-summary-card">
              <span>Status</span>
              <strong>${escapeHtml(getOwnershipLabel(record.status, record))}</strong>
              <p>${escapeHtml(record.status === 'owned' ? `${getCopiesSummary(record) || 'Single copy tracked'} / ${getOwnedEditionSummary(record)}` : record.status === 'wanted' ? 'Saved to your wishlist.' : 'Not in your collection yet.')}</p>
            </article>
            <article class="modal-summary-card">
              <span>Value</span>
              <strong>${escapeHtml(game.priceComplete === null ? formatPrice(game.priceLoose) : formatPrice(game.priceComplete))}</strong>
              <p>${escapeHtml(game.priceComplete === null ? 'Loose price is the best source available right now.' : `Loose ${formatPrice(game.priceLoose)} / Complete ${formatPrice(game.priceComplete)}`)}</p>
            </article>
            <article class="modal-summary-card">
              <span>Trade</span>
              <strong>${escapeHtml(tradeAvailabilityCount > 0 ? `${tradeAvailabilityCount} live` : tradeDemandCount > 0 ? `${tradeDemandCount} hunting` : 'Quiet now')}</strong>
              <p>${escapeHtml(tradeAvailabilityCount > 0 ? 'Collectors currently have this listed for trade.' : tradeDemandCount > 0 ? 'Collectors are already looking for this game.' : 'No live trade activity right now.')}</p>
            </article>
          </div>
          <p class="modal-description">Everything for this game in one place.</p>
          <section class="modal-market-panel" aria-label="Market snapshot">
            <p class="modal-section-label">Market snapshot</p>
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
                <span>Sealed market</span>
                <strong>${typeof game.priceSealed === 'number' ? formatPrice(game.priceSealed) : 'Not sourced yet'}</strong>
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
          </section>
          <section class="modal-identifier-panel" aria-label="Identifiers">
            <p class="modal-section-label">Identifiers</p>
            <div class="identifier-chip-list">
              ${identifierRows
                .map(
                  (row) => `
                    <article class="identifier-chip">
                      <span>${escapeHtml(row.label)}</span>
                      <strong>${escapeHtml(row.value)}</strong>
                    </article>
                  `,
                )
                .join('')}
            </div>
          </section>
          <section class="modal-evidence-panel modal-evidence-panel--${marketCoverage.tone}" aria-label="Market evidence">
            <p class="modal-section-label">Market evidence</p>
            <div class="modal-evidence-grid">
              <article class="modal-evidence-card">
                <span>Coverage</span>
                <strong>${escapeHtml(marketCoverage.title)}</strong>
                <p>${escapeHtml(marketCoverage.detail)}</p>
              </article>
              <article class="modal-evidence-card">
                <span>Snapshot</span>
                <strong>${priceSnapshotDate}</strong>
                <p>${hasExternalMarketSource(game) ? 'Reference values are linked back to the external market source for this title.' : 'This entry is custom, so the market source still needs to be added.'}</p>
              </article>
              <article class="modal-evidence-card">
                <span>Tracking</span>
                <strong>${tradeAvailabilityCount > 0 ? 'Trade listing available' : 'Ready to track'}</strong>
                <p>${tradeAvailabilityCount > 0 ? `${tradeAvailabilityCount} collector${tradeAvailabilityCount === 1 ? '' : 's'} currently have this marked for trade.` : 'Track status, copies, notes, variants, and paid price here.'}</p>
              </article>
            </div>
            <div class="modal-evidence-links">
              <a class="link-button" href="${safePriceSourceUrl}" target="_blank" rel="noreferrer">Open market source</a>
              <a class="ghost-button" href="${safeCoverSourceUrl}" target="_blank" rel="noreferrer">Open cover source</a>
            </div>
          </section>
          <div class="modal-notes modal-notes-panel">
            <p class="modal-section-label">Notes</p>
            <p><strong>Price snapshot:</strong> ${priceSnapshotDate}</p>
            <p><strong>Market edge:</strong> ${valueGap === null ? 'Add your paid price to see gain or loss.' : `${valueGap >= 0 ? 'Ahead' : 'Behind'} ${formatPrice(Math.abs(valueGap))} versus ${getOwnedValueLabel(game).toLowerCase()}.`}</p>
            <p><strong>Alert target:</strong> ${record.targetPrice === null ? 'No target set.' : `Notify yourself when loose value hits ${formatPrice(record.targetPrice)} or less.`}</p>
            ${record.editionStatus === 'graded' ? `<p><strong>Graded copy:</strong> ${record.gradedLabel ? escapeHtml(record.gradedLabel) : 'No grade entered yet.'}${typeof record.appraisedValue === 'number' ? ` / Appraised ${formatPrice(record.appraisedValue)}` : ''}</p>` : ''}
            <p><strong>Date found:</strong> ${record.dateAcquired ? escapeHtml(record.dateAcquired) : 'Not recorded.'}</p>
            <p><strong>Found at:</strong> ${record.acquiredFrom ? escapeHtml(record.acquiredFrom) : 'Not recorded.'}</p>
            <p><strong>Art source:</strong> ${getCoverSourceLabel(game)}</p>
            <p><strong>Market note:</strong> ${appConfig.marketDisclaimer}</p>
          </div>
          <div class="modal-collector-notes${record.notes ? ' has-notes' : ''}">
            <span class="modal-collector-notes-label">Your notes</span>
            <p class="modal-collector-notes-text">${record.notes ? escapeHtml(record.notes) : 'No notes yet. Use the Notes button below to add one.'}</p>
          </div>
          <div class="card-actions">
            <button class="ghost-button" data-action="set-price-paid" data-id="${safeGameId}" type="button">Set paid</button>
            <button class="ghost-button" data-action="set-target-price" data-id="${safeGameId}" type="button">Set alert</button>
            <button class="ghost-button" data-action="set-edition" data-id="${safeGameId}" type="button">Edition</button>
            ${record.editionStatus === 'graded' ? `<button class="ghost-button" data-action="set-grade" data-id="${safeGameId}" type="button">Grade</button>` : ''}
            <button class="ghost-button" data-action="set-variant" data-id="${safeGameId}" type="button">Variant</button>
            ${record.status === 'owned' ? `<button class="ghost-button danger-ghost" data-action="confirm-remove-owned" data-id="${safeGameId}" type="button">${getOwnedCopyCount(record) > 1 ? 'Remove all copies' : 'Remove from collection'}</button>` : ''}
            <button class="ghost-button" data-action="set-condition" data-id="${safeGameId}" type="button">Condition</button>
            <button class="ghost-button" data-action="edit-notes" data-id="${safeGameId}" type="button">Notes</button>
            <button class="ghost-button" data-action="set-date-acquired" data-id="${safeGameId}" type="button">Date found</button>
            <button class="ghost-button" data-action="set-acquired-from" data-id="${safeGameId}" type="button">Source</button>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderTrustStrip() {
  return `
    <section class="trust-strip" aria-label="Collector setup and trading overview">
      <article>
        <span>Private vault</span>
        <strong>Your collection stays tied to your own vault, not a public marketplace profile.</strong>
      </article>
      <article>
        <span>No payment handling</span>
        <strong>Retro Vault Elite does not process money, escrow, or shipping.</strong>
      </article>
      <article>
        <span>Collector-to-collector trading</span>
        <strong>Trade discovery and messaging stay between collectors once both sides accept.</strong>
      </article>
      <article>
        <span>Your data stays yours</span>
        <strong>Track it, sync it, export it, and keep control of your own data.</strong>
      </article>
    </section>
  `
}

function renderHeroTrustBadges() {
  const badges = ['No Download Needed', 'Desktop & Mobile', 'Collector Built', 'Private Trading']

  return `
    <div class="hero-badges" aria-label="Trust signals">
      ${badges.map((badge) => `<span class="hero-badge">${escapeHtml(badge)}</span>`).join('')}
    </div>
  `
}

function renderHeroValueStrip() {
  const items = [
    {
      title: 'Track exact copies',
      detail: 'Loose, boxed, manual, CiB, sealed, graded, and duplicates stay separate.',
    },
    {
      title: 'Build a wanted list',
      detail: 'Keep your hunt list, target prices, and next upgrades tied to the same vault.',
    },
    {
      title: 'Trade duplicates',
      detail: 'Mark spare copies for trade and surface collector matches without leaving the vault.',
    },
  ]

  return `
    <section class="hero-value-strip" aria-label="What Retro Vault Elite helps collectors do">
      ${items.map((item) => `
        <article class="hero-value-card">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.detail)}</span>
        </article>
      `).join('')}
    </section>
  `
}

function renderHeroSearchBlock() {
  const heroSearchValue = state.heroSearchDraft || state.search
  return `
    <section class="hero-search" aria-label="Search the games library">
      <div class="hero-search__header">
        <p class="kicker">Search the games library</p>
        <p class="subtle">Find games, consoles, variants, prices, and trade listings.</p>
      </div>
      <div class="hero-search__controls">
        <label class="hero-search__field" for="hero-search-input">
          <span class="sr-only">Search the games library</span>
          <input
            id="hero-search-input"
            type="search"
            value="${escapeHtml(heroSearchValue)}"
            placeholder="Search Mario, Zelda, Pokemon, Sonic..."
            autocomplete="off"
          />
        </label>
        <button class="install-button hero-search__button" type="button" data-action="submit-hero-search">Search Games</button>
      </div>
      <div id="hero-search-suggestions">
        ${renderHeroSearchSuggestions(heroSearchValue)}
      </div>
    </section>
  `
}

function getHeroSearchSuggestions(query: string) {
  const trimmed = query.trim()

  if (trimmed.length < 2) {
    return [] as CatalogEntry[]
  }

  return getCatalog()
    .filter((game) => matchesSearchValue(game, trimmed, true))
    .slice(0, 5)
}

function renderHeroSearchSuggestions(query: string) {
  const trimmed = query.trim()

  if (trimmed.length < 2) {
    return ''
  }

  const suggestions = getHeroSearchSuggestions(trimmed)

  if (suggestions.length === 0) {
    return `
      <div class="hero-search__empty">
        <p>No instant match for <strong>${escapeHtml(trimmed)}</strong> yet.</p>
        <div class="hero-search__empty-actions">
          <button class="ghost-button" type="button" data-action="submit-hero-search">Search full library</button>
          <button class="ghost-button" type="button" data-action="open-custom-entry">Report missing game</button>
        </div>
      </div>
    `
  }

  return `
    <div class="hero-search__suggestions" aria-label="Instant game results">
      ${suggestions.map((game) => `
        <button class="hero-search-result" type="button" data-action="open-details" data-id="${escapeHtml(game.id)}">
          <img class="hero-search-result__cover" src="${escapeHtml(getCardCoverUrl(game))}" alt="${escapeHtml(game.title)} cover art" loading="lazy" decoding="async" ${getCoverFallbackAttributes(game)} />
          <div class="hero-search-result__copy">
            <span>${escapeHtml(game.console)}</span>
            <strong>${escapeHtml(game.title)}</strong>
            <em>Loose ${formatPrice(game.priceLoose)} / CiB ${formatPrice(game.priceComplete ?? game.priceLoose ?? 0)}</em>
          </div>
        </button>
      `).join('')}
      <button class="ghost-button hero-search__view-all" type="button" data-action="submit-hero-search">Search full library for "${escapeHtml(trimmed)}"</button>
    </div>
  `
}

function getHeroPreviewEntries() {
  const catalog = getCatalog()
  const items: Array<{ game: CatalogEntry; label: string; detail: string }> = []
  const seen = new Set<string>()
  const push = (game: CatalogEntry | null | undefined, label: string, detail: string) => {
    if (!game || seen.has(game.id)) {
      return
    }

    seen.add(game.id)
    items.push({ game, label, detail })
  }

  const recentGames = state.recentViewedGameIds
    .map((id) => catalog.find((game) => game.id === id) ?? null)
    .filter((game): game is CatalogEntry => game !== null)

  const wantedGames = [...getWantedGames()].sort((left, right) => getReferencePrice(right) - getReferencePrice(left))
  const ownedGames = [...getOwnedGames()].sort((left, right) => getOwnedMarketPrice(right) - getOwnedMarketPrice(left))

  for (const game of wantedGames) {
    const record = getRecord(game.id)
    const targetValue = typeof record.targetPrice === 'number' ? formatPrice(record.targetPrice) : formatPrice(getReferencePrice(game))
    push(game, `Wanted / ${game.console}`, `Target ${targetValue}`)
  }

  for (const game of recentGames) {
    push(game, `Recent / ${game.console}`, `Loose ${formatPrice(game.priceLoose)} / CiB ${formatPrice(game.priceComplete ?? game.priceLoose ?? 0)}`)
  }

  for (const game of ownedGames) {
    push(game, `Owned / ${game.console}`, getOwnedValueLabel(game))
  }

  if (items.length >= 4) {
    return {
      title: 'From your vault',
      subtitle: 'Wanted games, recent views, and owned highlights.',
      items,
    }
  }

  const searchTerms = [
    'super mario world',
    'pokemon red',
    'sonic the hedgehog 2',
    'the legend of zelda',
    'final fantasy vii',
    'metal gear solid',
  ]
  const previews = searchTerms
    .map((term) => catalog.find((game) => game.title.toLowerCase().includes(term) && Boolean(game.coverUrl)))
    .filter((game): game is CatalogEntry => game !== undefined)
    .slice(0, 6)
    .map((game) => ({
      game,
      label: game.console,
      detail: `Loose ${formatPrice(game.priceLoose)} / CiB ${formatPrice(game.priceComplete ?? game.priceLoose ?? 0)}`,
    }))

  return {
    title: 'Popular games in the library',
    subtitle: 'A few real titles from the catalog.',
    items: previews,
  }
}

function renderHeroPreviewStrip() {
  const preview = getHeroPreviewEntries()

  return `
    <section class="hero-preview" aria-label="${escapeHtml(preview.title)}">
      <div class="hero-preview__header">
        <p class="kicker">${escapeHtml(preview.title)}</p>
        <p class="subtle">${escapeHtml(preview.subtitle)}</p>
      </div>
      <div class="hero-preview__grid">
        ${preview.items.slice(0, 6).map(({ game, label, detail }) => `
          <button class="hero-preview-card" type="button" data-action="open-details" data-id="${escapeHtml(game.id)}">
            <img class="hero-preview-card__cover" src="${escapeHtml(getCardCoverUrl(game))}" alt="${escapeHtml(game.title)} cover art" loading="lazy" decoding="async" ${getCoverFallbackAttributes(game)} />
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(game.title)}</strong>
            <em>${escapeHtml(detail)}</em>
          </button>
        `).join('')}
      </div>
    </section>
  `
}

function syncHeroSearchSuggestions() {
  const suggestionsRoot = document.querySelector<HTMLElement>('#hero-search-suggestions')
  const input = document.querySelector<HTMLInputElement>('#hero-search-input')

  if (!suggestionsRoot || !input) {
    return
  }

  suggestionsRoot.innerHTML = renderHeroSearchSuggestions(input.value)
}

function renderPlatformProofStrip() {
  const desktopGames = getCatalogRunwayGames(getCatalog(), 3)
  const mobileGames = getCatalogRunwayGames(getCatalog().slice().reverse(), 2)

  return `
    <section class="platform-proof" aria-label="Built for desktop and mobile">
      <div class="platform-proof__intro">
        <p class="kicker">Built for desktop and mobile</p>
        <h2>Use it at home, at a market, in a game shop, or while checking your shelf.</h2>
      </div>
      <div class="platform-proof__grid">
        <article class="platform-proof__card">
          <span class="stat-label">Desktop view</span>
          <div class="platform-proof__frame platform-proof__frame--desktop">
            <div class="platform-proof__bar"></div>
            <div class="platform-proof__cards">
              ${desktopGames.map((game) => `
                <div class="platform-proof__mini-card">
                  <img src="${escapeHtml(getCardCoverUrl(game))}" alt="" loading="lazy" decoding="async" ${getCoverFallbackAttributes(game)} />
                  <strong>${escapeHtml(game.title)}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        </article>
        <article class="platform-proof__card">
          <span class="stat-label">Phone view</span>
          <div class="platform-proof__frame platform-proof__frame--phone">
            <div class="platform-proof__stack">
              ${mobileGames.map((game) => `
                <div class="platform-proof__mini-row">
                  <img src="${escapeHtml(getCardCoverUrl(game))}" alt="" loading="lazy" decoding="async" ${getCoverFallbackAttributes(game)} />
                  <div>
                    <strong>${escapeHtml(game.title)}</strong>
                    <span>${escapeHtml(game.console)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </article>
      </div>
    </section>
  `
}
void renderPlatformProofStrip

function getCatalogRunwayGames(games: CatalogEntry[], limit = 4) {
  return [...games]
    .filter((game) => Boolean(game.coverUrl))
    .sort((left, right) => {
      const ownedDelta = Number(getRecord(right.id).status === 'owned') - Number(getRecord(left.id).status === 'owned')
      if (ownedDelta !== 0) return ownedDelta

      const wantedDelta = Number(getRecord(right.id).status === 'wanted') - Number(getRecord(left.id).status === 'wanted')
      if (wantedDelta !== 0) return wantedDelta

      const tradeDelta = getTradeAvailabilityCount(right.id) - getTradeAvailabilityCount(left.id)
      if (tradeDelta !== 0) return tradeDelta

      return getReferencePrice(right) - getReferencePrice(left)
    })
    .slice(0, limit)
}

function getCatalogRunwayLabel(game: CatalogEntry) {
  const record = getRecord(game.id)
  if (record.status === 'owned') {
    return `Owned - ${game.console}`
  }
  if (record.status === 'wanted') {
    return `Wanted - ${game.console}`
  }
  if (getTradeAvailabilityCount(game.id) > 0) {
    return `Trade live - ${game.console}`
  }
  return game.console
}

function getCatalogRunwayDetail(game: CatalogEntry) {
  const record = getRecord(game.id)
  if (record.status === 'owned') {
    return getOwnedValueLabel(game)
  }
  if (record.status === 'wanted') {
    return record.targetPrice === null ? `Loose ${formatPrice(game.priceLoose)}` : `Target ${formatPrice(record.targetPrice)}`
  }
  if (getTradeAvailabilityCount(game.id) > 0) {
    const count = getTradeAvailabilityCount(game.id)
    return `${count} live trader${count === 1 ? '' : 's'}`
  }
  return `Loose ${formatPrice(game.priceLoose)} / CiB ${formatPrice(game.priceComplete ?? game.priceLoose ?? 0)}`
}

function renderCatalogRunway(filteredGames: CatalogEntry[]) {
  const railGames = getCatalogRunwayGames(filteredGames, 4)

  if (!railGames.length) {
    return ''
  }

  const title = 'Library highlights'
  const subtitle = 'A few real titles from the library.'

  return `
    <section class="catalog-rail" aria-label="${escapeHtml(title)}">
      <div class="catalog-rail__header">
        <div>
          <p class="kicker">${escapeHtml(title)}</p>
          <h3>Open anything and start browsing.</h3>
        </div>
        <p class="subtle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="catalog-rail__track">
        ${railGames
          .map(
            (game) => `
              <button class="catalog-rail-card" type="button" data-action="open-details" data-id="${escapeHtml(game.id)}">
                <img class="catalog-rail-card__cover" src="${escapeHtml(getCardCoverUrl(game))}" alt="${escapeHtml(game.title)} cover art" loading="lazy" decoding="async" ${getCoverFallbackAttributes(game)} />
                <div class="catalog-rail-card__copy">
                  <span>${escapeHtml(getCatalogRunwayLabel(game))}</span>
                  <strong>${escapeHtml(game.title)}</strong>
                  <em>${escapeHtml(getCatalogRunwayDetail(game))}</em>
                </div>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderContinueHuntingStrip() {
  if (!state.authToken) {
    return ''
  }

  const games = state.recentViewedGameIds
    .map((id) => getGameById(id))
    .filter((game): game is CatalogEntry => game !== null)
    .slice(0, 4)

  if (!games.length) {
    return ''
  }

  return `
    <section class="catalog-rail" aria-label="Continue where you left off">
      <div class="catalog-rail__header">
        <div>
          <p class="kicker">Recent games</p>
          <h3>Open one again</h3>
        </div>
        <p class="subtle">The last few games you opened.</p>
      </div>
      <div class="catalog-rail__track">
        ${games
          .map(
            (game) => `
              <button class="catalog-rail-card" type="button" data-action="open-details" data-id="${escapeHtml(game.id)}">
                <img class="catalog-rail-card__cover" src="${escapeHtml(getCardCoverUrl(game))}" alt="${escapeHtml(game.title)} cover art" loading="lazy" decoding="async" ${getCoverFallbackAttributes(game)} />
                <div class="catalog-rail-card__copy">
                  <span>${escapeHtml(game.console)}</span>
                  <strong>${escapeHtml(game.title)}</strong>
                  <em>${escapeHtml(getCatalogRunwayDetail(game))}</em>
                </div>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderBecauseYouCollectStrip() {
  if (!state.authToken) {
    return ''
  }

  const dominantConsole = getDominantConsole()

  if (!dominantConsole) {
    return ''
  }

  const suggestions = getMissingGamesForConsole(dominantConsole.consoleName, 4)

  if (!suggestions.length) {
    return ''
  }

  return `
    <section class="catalog-rail" aria-label="Because you collect ${escapeHtml(dominantConsole.consoleName)}">
      <div class="catalog-rail__header">
        <div>
          <p class="kicker">Because you collect ${escapeHtml(dominantConsole.consoleName)}</p>
          <h3>More of that shelf to check next</h3>
        </div>
        <p class="subtle">${dominantConsole.owned}/${dominantConsole.total} tracked on this console.</p>
      </div>
      <div class="catalog-rail__track">
        ${suggestions
          .map(
            (game) => `
              <button class="catalog-rail-card catalog-rail-card--because" type="button" data-action="open-details" data-id="${escapeHtml(game.id)}">
                <img class="catalog-rail-card__cover" src="${escapeHtml(getCardCoverUrl(game))}" alt="${escapeHtml(game.title)} cover art" loading="lazy" decoding="async" ${getCoverFallbackAttributes(game)} />
                <div class="catalog-rail-card__copy">
                  <span>${escapeHtml(game.rarity)} - ${escapeHtml(game.console)}</span>
                  <strong>${escapeHtml(game.title)}</strong>
                  <em>Loose ${formatPrice(game.priceLoose)} / CiB ${formatPrice(game.priceComplete ?? game.priceLoose ?? 0)}</em>
                </div>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}
void renderBecauseYouCollectStrip

function renderWorkspaceRail() {
  const items = [
    {
      label: 'Browse games',
      title: 'Search the full library right away.',
      detail: `${getCatalog().length.toLocaleString()} games ready to open.`,
      action: 'browse-library',
      tone: '',
    },
    {
      label: 'Track collection',
      title: 'Mark owned copies and keep the shelf clean.',
      detail: 'Loose, boxed, CiB, sealed, graded, and duplicates stay separate.',
      action: 'browse-library',
      tone: '',
    },
    {
      label: 'Wanted list',
      title: 'Keep the hunt list in the same place.',
      detail: 'Targets, notes, and next upgrades stay tied to the game.',
      action: 'browse-library',
      tone: '',
    },
    {
      label: 'Trade live',
      title: 'Browse copies collectors have listed for trade.',
      detail: 'Request private trades once you create an account.',
      action: 'browse-tradeable-now',
      tone: '',
    },
    {
      label: 'Scan barcode',
      title: 'Catalog faster when you already have games in hand.',
      detail: 'Use the built-in camera flow on desktop or phone.',
      action: 'open-scanner',
      tone: '',
    },
    {
      label: 'Save your vault',
      title: 'Create an account when you want sync and trade inbox.',
      detail: 'No rebuild needed later.',
      action: 'open-register',
      tone: ' workspace-chip--setup',
    },
  ]

  return `
    <section class="workspace-rail" aria-label="What you can do here">
      <div class="workspace-rail__header">
        <div>
          <p class="kicker">What you can do here</p>
          <h2>Use the library first. Save the vault when you are ready.</h2>
        </div>
        <p class="subtle">Track what you own, keep a wanted list, and move into trade only when it helps.</p>
      </div>
      <div class="workspace-rail__grid">
        ${items
          .map(
            (item) => `
              <button class="workspace-chip${item.tone}" type="button" data-action="${item.action}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <em>${escapeHtml(item.detail)}</em>
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}
void renderWorkspaceRail

function renderCollectorActivityStrip() {
  const events = state.activityEvents.slice(0, 3)

  if (!events.length) {
    return ''
  }

  return `
    <section class="activity-strip" aria-label="Recent vault changes">
      <div class="activity-strip__intro">
        <p class="kicker">Recent vault changes</p>
        <h2>Your latest tracked changes</h2>
        <p class="subtle">A quick read on what you actually changed, without burying the catalog under more promo.</p>
      </div>
      <div class="activity-strip__grid">
        ${events
          .map((event) => {
            const target = event.gameId ? ` data-id="${escapeHtml(event.gameId)}"` : ''
            const action = event.gameId ? 'open-details' : 'browse-library'
            return `
              <article class="activity-card">
                <span>${escapeHtml(event.type.replace(/_/g, ' '))}</span>
                <strong>${escapeHtml(event.title)}</strong>
                <em>${escapeHtml(event.detail)}</em>
                <p class="subtle">${escapeHtml(formatRelativeTime(event.createdAt))}</p>
                <button class="ghost-button" type="button" data-action="${action}"${target}>${event.gameId ? 'Open details' : 'Browse library'}</button>
              </article>
            `
          })
          .join('')}
      </div>
    </section>
  `
}
void renderCollectorActivityStrip

function renderGuestSafeguardStrip() {
  if (state.authToken) {
    return ''
  }

  const trackedCount = getOwnedGames().length + getWantedGames().length

  if (trackedCount === 0) {
    return ''
  }

  return `
    <section class="guest-safeguard-strip" aria-label="Save your guest vault">
      <div class="guest-safeguard-strip__copy">
        <p class="kicker">Keep what you already started</p>
        <h2>Save this vault before you lose the work.</h2>
        <p class="subtle">${trackedCount.toLocaleString()} game${trackedCount === 1 ? '' : 's'} already have owned or wanted data in this browser.</p>
      </div>
      <div class="guest-safeguard-strip__stats">
        <span>${getOwnedGames().length.toLocaleString()} owned</span>
        <span>${getWantedGames().length.toLocaleString()} wanted</span>
        <span>${formatPrice(getOwnedGames().reduce((total, game) => total + getOwnedMarketPrice(game), 0))} tracked</span>
      </div>
      <div class="guest-safeguard-strip__actions">
        <button class="secondary-button" type="button" data-action="open-login">Sign In</button>
        <button class="install-button" type="button" data-action="open-register">Create Free Vault</button>
        <button class="ghost-button" type="button" data-action="export-catalog">Export vault</button>
      </div>
    </section>
  `
}

function renderVaultLanesStrip() {
  const laneItems = state.authToken
    ? [
        {
          label: 'Games library',
          title: `${getCatalog().length.toLocaleString()} in library`,
          detail: 'Open anything',
          action: 'browse-library',
          active: state.ownershipFilter === 'all' && !state.search.trim(),
        },
        {
          label: 'Owned shelf',
          title: `${getOwnedGames().length.toLocaleString()} tracked`,
          detail: 'Your collection',
          action: 'browse-owned-games',
          active: state.ownershipFilter === 'owned',
        },
        {
          label: 'Wanted list',
          title: `${getWantedGames().length.toLocaleString()} hunting`,
          detail: 'Target games',
          action: 'ownership-filter',
          active: state.ownershipFilter === 'wanted',
          filter: 'wanted',
        },
        {
          label: 'Ready to trade',
          title: state.publicCommunityStats ? `${state.publicCommunityStats.tradeListingCount.toLocaleString()} listed` : 'Live listings',
          detail: 'Live copies',
          action: 'browse-tradeable-now',
          active: state.ownershipFilter === 'tradeable-now',
        },
        {
          label: 'Price alerts',
          title: `${getAlertMatches().length.toLocaleString()} hits`,
          detail: 'Target prices',
          action: 'ownership-filter',
          active: state.ownershipFilter === 'wanted-now',
          filter: 'wanted-now',
        },
      ]
    : [
        {
          label: 'Games library',
          title: `${getCatalog().length.toLocaleString()} games`,
          detail: 'Search the full catalog',
          action: 'browse-library',
          active: state.ownershipFilter === 'all' && !state.search.trim(),
        },
        {
          label: 'Ready to trade',
          title: state.publicCommunityStats ? `${state.publicCommunityStats.tradeListingCount.toLocaleString()} listed` : 'Live listings',
          detail: 'Browse tradeable copies',
          action: 'browse-tradeable-now',
          active: state.ownershipFilter === 'tradeable-now',
        },
        {
          label: 'Create vault',
          title: 'Save owned and wanted games',
          detail: 'Sync across devices',
          action: 'open-register',
          active: false,
        },
      ]

  return `
    <section class="vault-lanes" aria-label="Quick lanes">
      <div class="vault-lanes__header">
        <div>
          <p class="kicker">${state.authToken ? 'Quick lanes' : 'Start here'}</p>
          <p class="subtle">${state.authToken ? 'Jump straight to the part of the vault you need.' : 'Jump straight into the part of the vault that matters right now.'}</p>
        </div>
      </div>
      <div class="vault-lanes__list">
        ${laneItems
          .map((item) => `
            <button
              class="vault-lane${item.active ? ' is-active' : ''}"
              type="button"
              data-action="${item.action}"
              ${item.filter ? `data-filter="${item.filter}"` : ''}
            >
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <em>${escapeHtml(item.detail)}</em>
            </button>
          `)
          .join('')}
      </div>
    </section>
  `
}

function renderFeaturedSystemsStrip() {
  return `
    <section class="featured-systems" aria-label="Featured systems">
      <p class="kicker">Featured systems</p>
      <div class="featured-systems__list">
        ${FEATURED_SYSTEMS.map((system) => `<button class="chip featured-systems__chip" type="button" data-action="browse-console-library" data-console="${escapeHtml(system.consoleName)}">${escapeHtml(system.label)}</button>`).join('')}
      </div>
    </section>
  `
}

function renderFeatureStrip() {
  const liveTradeSignal = state.authToken
    ? state.tradeInboxFreshOpportunityIds.size > 0
      ? `${state.tradeInboxFreshOpportunityIds.size} new trade opportunit${state.tradeInboxFreshOpportunityIds.size === 1 ? 'y is' : 'ies are'} waiting in Trade Inbox right now.`
      : state.tradePending + state.tradeUnread > 0
        ? `${state.tradePending + state.tradeUnread} active trade request${state.tradePending + state.tradeUnread === 1 ? ' is' : 's are'} already moving in your inbox.`
        : 'When collectors mark games for trade, Trade Inbox brings those matches back to your wanted list.'
    : 'Collectors can browse tradeable games now, then create an account when they want to send private trade requests.'

  return `
    <section class="feature-strip" aria-label="What Retro Vault Elite does">
      <article class="feature-strip__card">
        <span>Track what you own</span>
        <strong>Keep your collection in one place.</strong>
      </article>
      <article class="feature-strip__card">
        <span>Build a wanted list</span>
        <strong>Know what you are still hunting for.</strong>
      </article>
      <article class="feature-strip__card feature-strip__card--trade">
        <span>Mark duplicates for trade</span>
        <strong>Turn extra copies into real trade listings.</strong>
        ${
          state.authToken
            ? `<button class="ghost-button feature-strip__button" type="button" data-action="trade-open-inbox">Open Trade Inbox${state.tradeInboxFreshOpportunityIds.size > 0 ? ` <span class="trade-inbox-badge trade-inbox-badge--fresh">New</span>` : ''}</button>`
            : '<button class="ghost-button feature-strip__button" type="button" data-action="browse-tradeable-now">Ready to Trade</button>'
        }
      </article>
      <article class="feature-strip__card">
        <span>Find collector matches</span>
        <strong>See who has what you want and who wants what you own.</strong>
      </article>
      <div class="feature-strip__flow">
        <p class="kicker">How it works</p>
        <strong>Add games, mark wanted or tradeable, then check Trade Inbox for matches.</strong>
        <p class="subtle feature-strip__signal">${escapeHtml(liveTradeSignal)}</p>
        ${
          state.publicCommunityStats
            ? `<div class="feature-strip__proof" aria-label="Community activity">
                <article>
                  <strong>${state.publicCommunityStats.userCount.toLocaleString()}</strong>
                  <span>collectors signed up</span>
                </article>
                <article>
                  <strong>${state.publicCommunityStats.trackedGamesCount.toLocaleString()}</strong>
                  <span>games tracked</span>
                </article>
                <article>
                  <strong>${state.publicCommunityStats.tradeListingCount.toLocaleString()}</strong>
                  <span>games listed for trade</span>
                </article>
              </div>`
            : ''
        }
      </div>
    </section>
  `
}
void renderFeatureStrip

function renderOnboardingPanel() {
  const trackedCount = getOwnedGames().length + getWantedGames().length

  if (state.onboardingDismissed || trackedCount > 0) {
    return ''
  }

  return `
    <section class="onboarding-panel">
      <div class="onboarding-copy">
        <p class="kicker">Get started</p>
        <h2>Nothing here yet.</h2>
        <p class="subtle">Browse the library or scan a barcode to add your first game.</p>
      </div>
      <div class="onboarding-steps onboarding-steps--simple">
        <article class="onboarding-step">
          <div>
            <strong>Add your first game</strong>
            <span>Owned, wanted, and favorites all start from the same game page.</span>
          </div>
          <button class="ghost-button" type="button" data-action="browse-library">Browse Games Library</button>
        </article>
        <article class="onboarding-step">
          <div>
            <strong>Use the camera if it is faster</strong>
            <span>Good for shelf cleanups, markets, and game shop visits.</span>
          </div>
          <button class="ghost-button" type="button" data-action="open-scanner">Scan Barcode</button>
        </article>
      </div>
      <button class="link-button onboarding-dismiss" type="button" data-action="dismiss-onboarding">Hide checklist</button>
    </section>
  `
}

function renderControlSummary(resultCount: number, visibleCount: number) {
  const activeFilters = [
    state.regionFilter !== 'All regions' ? getRegionOptionLabel(state.regionFilter) : '',
    state.consoleFilter !== 'All consoles' && state.consoleFilter !== LEGENDS_FILTER ? getConsoleOptionLabel(state.consoleFilter) : '',
    state.yearFilter !== 'All years' ? `Release year ${state.yearFilter}` : '',
    state.releaseTypeFilter !== 'All release types' ? state.releaseTypeFilter : '',
    state.ownershipFilter !== 'all' ? state.ownershipFilter : '',
    state.search.trim() ? `Search: ${state.search.trim()}` : '',
  ].filter(Boolean)

  return `
    <section class="control-summary">
      <div>
        <p class="kicker">Filters</p>
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
  const totalCounts = getInstantLibraryCounts()
  const hiddenOwnedCount = Math.max(0, totalCounts.ownedCount - ownedGames.length)
  const hiddenWantedCount = Math.max(0, totalCounts.wantedCount - wantedGames.length)
  const ownedTrackedValue = ownedGames.reduce((total, game) => total + getReferencePrice(game), 0)
  const paidTotal = ownedGames.reduce((total, game) => total + (getRecord(game.id).pricePaid ?? 0), 0)
  const marketEdge = ownedTrackedValue - paidTotal
  const completeOwned = ownedGames.filter((game) => isCompleteEdition(getRecord(game.id))).length

  return `
    <section class="view-summary">
      <article>
        <span class="stat-label">Owned shown here</span>
        <strong>${ownedGames.length.toLocaleString()}</strong>
        <span class="stat-note">${hiddenOwnedCount > 0 ? `${hiddenOwnedCount.toLocaleString()} owned game${hiddenOwnedCount === 1 ? '' : 's'} outside this view` : `${completeOwned.toLocaleString()} complete copies tracked`}</span>
      </article>
      <article>
        <span class="stat-label">Wanted shown here</span>
        <strong>${wantedGames.length.toLocaleString()}</strong>
        <span class="stat-note">${hiddenWantedCount > 0 ? `${hiddenWantedCount.toLocaleString()} wanted game${hiddenWantedCount === 1 ? '' : 's'} outside this view` : `${formatPrice(wantedGames.reduce((total, game) => total + getReferencePrice(game), 0))} target value`}</span>
      </article>
      <article>
        <span class="stat-label">Tracked value shown here</span>
        <strong>${formatPrice(ownedTrackedValue)}</strong>
        <span class="stat-note">Based on your loose or complete ownership choices</span>
      </article>
      <article>
        <span class="stat-label">Paid total shown here</span>
        <strong>${formatPrice(paidTotal)}</strong>
        <span class="stat-note">${paidTotal ? `${marketEdge >= 0 ? 'Ahead' : 'Behind'} ${formatPrice(Math.abs(marketEdge))}` : 'Add paid prices to compare pickups versus market'}</span>
      </article>
    </section>
  `
}

// ── Collection Import ─────────────────────────────────────────────────────────

const CONSOLE_ALIASES: Record<string, string> = {
  // NES
  'nes': 'NES', 'nintendo entertainment system': 'NES', 'nintendo entertainment system (nes)': 'NES',
  // Super Nintendo
  'snes': 'Super Nintendo', 'super nintendo': 'Super Nintendo', 'super nes': 'Super Nintendo',
  'super nintendo entertainment system': 'Super Nintendo', 'super nintendo entertainment system (snes)': 'Super Nintendo',
  // Nintendo 64
  'n64': 'Nintendo 64', 'nintendo 64': 'Nintendo 64', 'nintendo64': 'Nintendo 64',
  // GameCube
  'gamecube': 'GameCube', 'nintendo gamecube': 'GameCube', 'gcn': 'GameCube', 'gc': 'GameCube',
  // Game Boy
  'gb': 'Game Boy', 'game boy': 'Game Boy', 'nintendo game boy': 'Game Boy',
  'gameboy': 'Game Boy', 'original game boy': 'Game Boy', 'game boy original': 'Game Boy',
  // Game Boy Color
  'gbc': 'Game Boy Color', 'game boy color': 'Game Boy Color', 'nintendo game boy color': 'Game Boy Color', 'gameboy color': 'Game Boy Color',
  // Game Boy Advance
  'gba': 'Game Boy Advance', 'game boy advance': 'Game Boy Advance', 'nintendo game boy advance': 'Game Boy Advance',
  'gameboy advance': 'Game Boy Advance', 'game boy advance sp': 'Game Boy Advance',
  // Nintendo DS
  'ds': 'Nintendo DS', 'nds': 'Nintendo DS', 'nintendo ds': 'Nintendo DS',
  // Famicom
  'famicom': 'Famicom', 'family computer': 'Famicom', 'fc': 'Famicom', 'nintendo famicom': 'Famicom',
  // Super Famicom
  'super famicom': 'Super Famicom', 'sfc': 'Super Famicom',
  // Sega Genesis / Mega Drive
  'sega genesis': 'Sega Genesis', 'genesis': 'Sega Genesis', 'mega drive': 'Sega Genesis',
  'sega mega drive': 'Sega Genesis', 'sega mega drive / genesis': 'Sega Genesis',
  'megadrive': 'Sega Genesis', 'md': 'Sega Genesis',
  // Sega Master System
  'sega master system': 'Sega Master System', 'master system': 'Sega Master System', 'sms': 'Sega Master System',
  // Sega Saturn
  'sega saturn': 'Sega Saturn', 'saturn': 'Sega Saturn',
  // Dreamcast
  'dreamcast': 'Dreamcast', 'sega dreamcast': 'Dreamcast', 'dc': 'Dreamcast',
  // Sega CD
  'sega cd': 'Sega CD', 'mega cd': 'Sega CD', 'sega mega cd': 'Sega CD',
  // Game Gear
  'game gear': 'Game Gear', 'sega game gear': 'Game Gear', 'gg': 'Game Gear',
  // Sega 32X
  '32x': 'Sega 32X', 'sega 32x': 'Sega 32X', 'mega drive 32x': 'Sega 32X', 'genesis 32x': 'Sega 32X',
  // TurboGrafx
  'turbografx-16': 'TurboGrafx-16', 'turbografx 16': 'TurboGrafx-16', 'tg16': 'TurboGrafx-16',
  'tg-16': 'TurboGrafx-16', 'pc engine': 'TurboGrafx-16', 'pce': 'TurboGrafx-16', 'turbografx': 'TurboGrafx-16',
  'turbografx cd': 'TurboGrafx CD', 'turbografx-cd': 'TurboGrafx CD',
  'pc engine cd': 'TurboGrafx CD', 'pc engine cd-rom': 'TurboGrafx CD',
  // PlayStation
  'playstation': 'PlayStation', 'sony playstation': 'PlayStation', 'ps1': 'PlayStation',
  'psx': 'PlayStation', 'playstation 1': 'PlayStation',
  // PlayStation 2
  'playstation 2': 'PlayStation 2', 'sony playstation 2': 'PlayStation 2', 'ps2': 'PlayStation 2',
  // PSP
  'psp': 'PSP', 'playstation portable': 'PSP', 'sony psp': 'PSP',
  // Xbox
  'xbox': 'Xbox', 'microsoft xbox': 'Xbox', 'xbox original': 'Xbox',
  // Atari
  'atari 2600': 'Atari 2600', 'atari vcs': 'Atari 2600',
  'atari 7800': 'Atari 7800',
  'atari lynx': 'Atari Lynx', 'lynx': 'Atari Lynx',
  'atari jaguar': 'Jaguar', 'jaguar': 'Jaguar',
  'jaguar cd': 'Jaguar CD', 'atari jaguar cd': 'Jaguar CD',
  // Neo Geo
  'neo geo aes': 'Neo Geo AES', 'neo-geo aes': 'Neo Geo AES', 'neogeo aes': 'Neo Geo AES',
  'neo geo cd': 'Neo Geo CD', 'neo-geo cd': 'Neo Geo CD',
  'neo geo mvs': 'Neo Geo MVS',
  'neo geo pocket color': 'Neo Geo Pocket Color', 'neo-geo pocket color': 'Neo Geo Pocket Color', 'ngpc': 'Neo Geo Pocket Color',
  // 3DO
  '3do': '3DO', '3do interactive multiplayer': '3DO', 'panasonic 3do': '3DO',
  // Others
  'intellivision': 'Intellivision', 'mattel intellivision': 'Intellivision',
  'colecovision': 'ColecoVision',
  'commodore 64': 'Commodore 64', 'c64': 'Commodore 64',
  'virtual boy': 'Virtual Boy', 'nintendo virtual boy': 'Virtual Boy',
  'vectrex': 'Vectrex',
  'wonderswan': 'WonderSwan', 'wonder swan': 'WonderSwan',
  'wonderswan color': 'WonderSwan Color', 'wonder swan color': 'WonderSwan Color',
  'amiga': 'Amiga', 'commodore amiga': 'Amiga',
  'amiga cd32': 'Amiga CD32',
}

function normalizeImportConsole(raw: string): string | null {
  const key = raw.toLowerCase().trim().replace(/\s+/g, ' ')
  return CONSOLE_ALIASES[key] ?? null
}

function normalizeImportTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the (.+)$/, '$1 the')
}

function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 3 || b.length < 3) return a === b ? 1 : 0
  const getTrigrams = (s: string): Set<string> => {
    const t = new Set<string>()
    for (let i = 0; i <= s.length - 3; i++) t.add(s.slice(i, i + 3))
    return t
  }
  const ta = getTrigrams(a)
  const tb = getTrigrams(b)
  let intersection = 0
  for (const t of ta) { if (tb.has(t)) intersection++ }
  return (2 * intersection) / (ta.size + tb.size)
}

function findImportMatch(title: string, consoleFilter: string | null): { game: CatalogEntry | null; confidence: 'exact' | 'fuzzy' | 'none' } {
  const normTitle = normalizeImportTitle(title)
  if (!normTitle) return { game: null, confidence: 'none' }
  const pool = consoleFilter
    ? state.generatedCatalog.filter((g) => g.console === consoleFilter)
    : state.generatedCatalog
  if (!pool.length) return { game: null, confidence: 'none' }
  for (const entry of pool) {
    if (normalizeImportTitle(entry.title) === normTitle) return { game: entry, confidence: 'exact' }
  }
  let bestScore = 0
  let bestEntry: CatalogEntry | null = null
  for (const entry of pool) {
    const score = trigramSimilarity(normTitle, normalizeImportTitle(entry.title))
    if (score > bestScore) { bestScore = score; bestEntry = entry }
  }
  if (bestScore >= 0.72) return { game: bestEntry, confidence: 'fuzzy' }
  return { game: null, confidence: 'none' }
}

function mapImportCondition(raw: string): ConditionRating {
  const n = raw.toLowerCase().trim()
  if (n.includes('mint') && !n.includes('near')) return 'mint'
  if (n.includes('near mint') || n.includes('nm') || n.includes('excellent') || n === '9' || n === '10') return 'excellent'
  if (n.includes('very good') || n.includes('vg') || n.includes('good') || n === '7' || n === '8') return 'good'
  if (n.includes('fair') || n.includes('poor') || n.includes('bad') || n.includes('acceptable') || n === '4' || n === '5' || n === '6') return 'fair'
  return 'good'
}

function mapImportEdition(complete: string): EditionStatus {
  const n = complete.toLowerCase().trim()
  if (n === 'true' || n === 'yes' || n === '1' || n === 'cib' || n === 'complete' || n === 'complete in box') return 'cib'
  if (n === 'sealed' || n === 'new' || n === 'sealed/new') return 'sealed'
  if (n === 'boxed' || n === 'box' || n === 'cart + box' || n === 'cartridge + box') return 'boxed'
  if (n === 'box only') return 'box-only'
  if (n === 'graded') return 'graded'
  if (n === 'manual only') return 'manual-only'
  if (n === 'manual' || n === 'cart + manual' || n === 'cartridge + manual') return 'manual'
  if (n === 'box + manual' || n === 'box and manual' || n === 'box/manual' || n === 'box + manual no game') return 'box-manual'
  return 'loose'
}

function parseImportDate(raw: string): string | null {
  if (!raw?.trim()) return null
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const slash = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) {
    const [, m, d, y] = slash
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []
  function parseLine(line: string): string[] {
    const result: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else { inQ = !inQ }
      } else if (ch === ',' && !inQ) {
        result.push(cur); cur = ''
      } else { cur += ch }
    }
    result.push(cur)
    return result
  }
  const headers = parseLine(lines[0]).map((h) => h.trim().replace(/^﻿/, ''))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = vals[idx]?.trim() ?? '' })
    rows.push(row)
  }
  return rows
}

function findImportCol(headers: string[], candidates: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\.]/g, '')
  const normHeaders = headers.map(norm)
  for (const c of candidates) {
    const idx = normHeaders.indexOf(norm(c))
    if (idx !== -1) return headers[idx]
  }
  return null
}

function detectImportCols(headers: string[]) {
  return {
    title: findImportCol(headers, ['title', 'name', 'game', 'game title', 'game name', 'item name', 'game_title', 'Title', 'Name', 'Game']),
    console: findImportCol(headers, ['platform', 'console', 'system', 'console/system', 'game system', 'Platform', 'Console', 'System']),
    complete: findImportCol(headers, ['complete', 'cib', 'complete in box', 'is_complete', 'is complete', 'boxed', 'completeness', 'Complete', 'CIB']),
    condition: findImportCol(headers, ['condition', 'grade', 'quality', 'game condition', 'Condition']),
    pricePaid: findImportCol(headers, ['price paid', 'buy price', 'buy_price', 'paid', 'purchase price', 'price', 'cost', 'amount paid']),
    notes: findImportCol(headers, ['notes', 'note', 'comment', 'comments', 'description', 'memo', 'Notes']),
    date: findImportCol(headers, ['date added', 'added on', 'added_on', 'purchase date', 'acquired date', 'date acquired', 'date', 'date of purchase', 'dateacquired']),
  }
}

async function processImportFile(file: File): Promise<void> {
  const text = await file.text()
  let rows: Record<string, string>[]
  try {
    rows = parseCSV(text)
  } catch {
    window.alert('Could not parse the file. Make sure it is a valid CSV.')
    return
  }
  if (rows.length === 0) {
    window.alert('The file appears to be empty or has no data rows.')
    return
  }
  const headers = Object.keys(rows[0])
  const cols = detectImportCols(headers)
  if (!cols.title) {
    window.alert('Could not find a Title or Name column. Please check that the file is a valid collection export.')
    return
  }
  const importRows: ImportRow[] = []
  for (const row of rows) {
    const rawTitle = (row[cols.title] ?? '').trim()
    if (!rawTitle) continue
    const rawConsole = cols.console ? (row[cols.console] ?? '').trim() : ''
    const catalogConsole = rawConsole ? normalizeImportConsole(rawConsole) : null
    const completeRaw = cols.complete ? (row[cols.complete] ?? '') : ''
    const conditionRaw = cols.condition ? (row[cols.condition] ?? '') : ''
    const priceRaw = cols.pricePaid ? (row[cols.pricePaid] ?? '') : ''
    const notesRaw = cols.notes ? (row[cols.notes] ?? '') : ''
    const dateRaw = cols.date ? (row[cols.date] ?? '') : ''
    const { game, confidence } = findImportMatch(rawTitle, catalogConsole)
    const priceParsed = parseFloat(priceRaw.replace(/[^0-9.]/g, ''))
    importRows.push({
      rawTitle,
      rawConsole,
      game,
      confidence,
      editionStatus: mapImportEdition(completeRaw),
      condition: mapImportCondition(conditionRaw),
      pricePaid: isNaN(priceParsed) ? null : Math.round(priceParsed * 100) / 100,
      notes: notesRaw.slice(0, 500),
      dateAcquired: parseImportDate(dateRaw),
      include: confidence !== 'none',
    })
  }
  if (importRows.length === 0) {
    window.alert('No games were found in the file.')
    return
  }
  state.importStep = 'preview'
  state.importRows = importRows
  state.importSourceName = file.name.replace(/\.(csv|json|xlsx?)$/i, '')
  render()
}

function executeImport(): void {
  const toImport = state.importRows.filter((r) => r.include && r.game)
  for (const row of toImport) {
    if (!row.game) continue
    const { editionStatus, condition, pricePaid, notes, dateAcquired } = row
    const completeInBox = isCompleteEditionStatus(editionStatus)
    state.library[row.game.id] = (() => {
      const existing = getRecord(row.game!.id)
      if (existing.status === 'owned') return existing
      return {
        ...existing,
        status: 'owned',
        editionStatus,
        completeInBox,
        condition,
        pricePaid,
        notes: notes || existing.notes,
        dateAcquired: dateAcquired || existing.dateAcquired,
        ownedCopies: 1,
        copies: [{ edition: editionStatus, condition, variant: '', pricePaid, forTrade: false }],
      } satisfies GameRecord
    })()
  }
  libraryRevision += 1
  state.cachedCatalogStatsKey = ''
  state.importDoneCount = toImport.filter((r) => r.game).length
  state.importStep = 'done'
  saveLibrary()
  render()
}

function renderImportModal(): string {
  if (state.importStep === 'none') return ''
  if (state.importStep === 'done') {
    return `
      <div class="game-modal-backdrop" data-action="close-import-modal">
        <section class="import-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <button class="modal-close" type="button" data-action="close-import-modal">Close</button>
          <p class="kicker">Import complete</p>
          <h2>${state.importDoneCount} game${state.importDoneCount === 1 ? '' : 's'} added to your vault</h2>
          <p class="auth-helper">Your collection has been updated. Games you already owned were not overwritten.</p>
          <button class="install-button" type="button" data-action="close-import-modal">Done</button>
        </section>
      </div>`
  }
  const rows = state.importRows
  const exact = rows.filter((r) => r.confidence === 'exact').length
  const fuzzy = rows.filter((r) => r.confidence === 'fuzzy').length
  const unmatched = rows.filter((r) => r.confidence === 'none').length
  const selected = rows.filter((r) => r.include && r.game).length
  const allIncluded = rows.filter((r) => r.game).every((r) => r.include)
  return `
    <div class="game-modal-backdrop" data-action="close-import-modal">
      <section class="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-modal-title" onclick="event.stopPropagation()">
        <button class="modal-close" type="button" data-action="close-import-modal">Close</button>
        <p class="kicker">Import collection — ${escapeHtml(state.importSourceName)}</p>
        <h2 id="import-modal-title">Review ${rows.length} game${rows.length === 1 ? '' : 's'}</h2>
        <div class="import-stats">
          <span class="import-stat import-stat--exact">${exact} exact</span>
          <span class="import-stat import-stat--fuzzy">${fuzzy} likely</span>
          <span class="import-stat import-stat--none">${unmatched} unmatched</span>
        </div>
        <p class="auth-helper">Unmatched games are excluded by default. Games you already own won't be overwritten.</p>
        <div class="import-table-wrap">
          <table class="import-table">
            <thead>
              <tr>
                <th><input type="checkbox" data-action="import-toggle-all" ${allIncluded ? 'checked' : ''}></th>
                <th>From your file</th>
                <th>Matched in vault</th>
                <th>Edition</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, i) => `
                <tr class="import-row import-row--${row.confidence}${!row.include ? ' import-row--excluded' : ''}">
                  <td><input type="checkbox" data-action="import-toggle-row" data-index="${i}" ${row.include ? 'checked' : ''}${!row.game ? ' disabled' : ''}></td>
                  <td>
                    <span class="import-raw-title">${escapeHtml(row.rawTitle)}</span>
                    ${row.rawConsole ? `<span class="import-raw-console">${escapeHtml(row.rawConsole)}</span>` : ''}
                  </td>
                  <td>
                    ${row.game
                      ? `<span class="import-match-title">${escapeHtml(row.game.title)}</span><span class="import-match-console">${escapeHtml(row.game.console)}</span>${row.confidence === 'fuzzy' ? ' <span class="import-badge import-badge--fuzzy">likely</span>' : ''}`
                      : '<span class="import-no-match">No match found</span>'}
                  </td>
                  <td><span class="import-edition-chip">${row.editionStatus}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="import-actions">
          <button class="install-button" type="button" data-action="execute-import"${selected === 0 ? ' disabled' : ''}>Import ${selected} game${selected === 1 ? '' : 's'}</button>
          <button class="ghost-button" type="button" data-action="close-import-modal">Cancel</button>
        </div>
      </section>
    </div>`
}

function renderFiltersSection() {
  return `
    <section class="filters">
      <div class="filters__primary">
        ${renderFilterChip('all', 'All')}
        ${renderFilterChip('owned', 'Owned')}
        ${renderFilterChip('wanted', 'Wanted')}
        ${renderFilterChip('missing', 'Missing')}
        ${renderFilterChip('tradeable-now', 'Tradeable now')}
        ${renderFilterChip('wanted-now', 'Wanted now')}
        <button class="secondary-button mobile-only-action" data-action="open-custom-entry" type="button">Add your own game</button>
      </div>
      <div class="filters__utility">
        <span class="filters__utility-label">Library tools</span>
        <button class="secondary-button" data-action="reset-library" type="button">Clear filters</button>
        <button class="secondary-button" data-action="import-collection" type="button">Import collection</button>
        <button class="secondary-button" data-action="import-catalog" type="button">Import catalog</button>
        <button class="secondary-button" data-action="export-catalog" type="button">Export vault</button>
      </div>
      <input id="catalog-import" type="file" accept=".json,application/json" hidden />
      <input id="collection-import-input" type="file" accept=".csv,text/csv" hidden />
    </section>
  `
}

function getVariantSummary(game: CatalogEntry) {
  const parts = [game.variantLabel ?? '', getReleaseTypeLabel(game.releaseType)].filter(Boolean)
  return parts.join(' / ')
}

function getConsoleSpineColor(consoleName: string): { bg: string; text: string; accent: string } {
  const n = consoleName.toLowerCase()
  if ((n.includes('famicom') && !n.includes('super')) || n.includes(' nes') || n === 'nes') return { bg: '#c8102e', text: '#fff1c4', accent: '#f1c95f' }
  if (n.includes('super famicom') || n.includes('snes')) return { bg: '#6a0dad', text: '#fff', accent: '#c9a8ff' }
  if (n.includes('game boy advance') || n.includes('gba')) return { bg: '#7b4fa0', text: '#fff', accent: '#ffd66e' }
  if (n.includes('game boy color') || n.includes('gbc')) return { bg: '#007a33', text: '#fff', accent: '#ffd66e' }
  if (n.includes('game boy') || n.includes(' gb')) return { bg: '#3a3a3a', text: '#e0e0e0', accent: '#a8b8ca' }
  if (n.includes('n64') || n.includes('nintendo 64')) return { bg: '#006699', text: '#fff', accent: '#f1c95f' }
  if (n.includes('gamecube')) return { bg: '#5b2a8c', text: '#fff', accent: '#00c8ff' }
  if (n.includes('genesis') || n.includes('mega drive')) return { bg: '#0f2c67', text: '#c9d4e8', accent: '#5ac8fa' }
  if (n.includes('master system')) return { bg: '#cc0000', text: '#fff', accent: '#ffd66e' }
  if (n.includes('game gear')) return { bg: '#222', text: '#5ac8fa', accent: '#5ac8fa' }
  if (n.includes('saturn')) return { bg: '#232f3e', text: '#c9a8ff', accent: '#9b59b6' }
  if (n.includes('dreamcast')) return { bg: '#e8501a', text: '#fff', accent: '#ffd66e' }
  if (n.includes('playstation') || n.includes('ps1') || n.includes('psx')) return { bg: '#003087', text: '#fff', accent: '#00c8ff' }
  if (n.includes('ps2')) return { bg: '#00439c', text: '#fff', accent: '#c9a8ff' }
  if (n.includes('atari')) return { bg: '#b22222', text: '#fff1c4', accent: '#f1c95f' }
  return { bg: '#1e2a3a', text: '#f4f8ff', accent: '#f1c95f' }
}

function renderSpine(game: CatalogEntry) {
  const status = getRecord(game.id).status
  const rarity = game.rarity.toLowerCase()
  const colors = getConsoleSpineColor(game.console)
  const coverSrc = game.coverUrl ? escapeHtml(game.coverUrl) : ''
  return `<div class="spine-wrap">
    <button
      class="spine-card spine-card--${status} spine-card--${rarity}"
      data-action="open-details"
      data-id="${escapeHtml(game.id)}"
      type="button"
      aria-label="${escapeHtml(game.title)}"
      style="--spine-bg:${colors.bg};--spine-text:${colors.text};--spine-accent:${colors.accent}"
    >${coverSrc ? `<img class="spine-img" src="${coverSrc}" alt="" decoding="async" loading="lazy" />` : ''}<div class="spine-top"><span class="spine-dot spine-dot--${rarity}"></span></div><span class="spine-title">${escapeHtml(game.title)}</span></button>
    <div class="spine-label"><span>${escapeHtml(game.title)}</span><em>${escapeHtml(game.console)}</em></div>
  </div>`
}

function renderShelfView(games: CatalogEntry[]) {
  if (!games.length) {
    return '<div class="empty-state"><h3>No matches</h3><p>Add it as a custom entry if it is missing from the library.</p><button class="toggle-button" data-action="open-custom-entry" type="button">Add this game</button></div>'
  }
  return `<div class="shelf-stage">${games.map(renderSpine).join('')}</div>`
}

function renderTradeInbox() {
  const reqs = state.tradeRequests
  const pending = reqs.filter((r) => r.status === 'pending')
  const accepted = reqs.filter((r) => r.status === 'accepted')
  const declined = reqs.filter((r) => r.status === 'declined')
  const visibleDeclined = state.hideArchivedTrades ? [] : declined
  const opportunities = state.tradeInboxOpportunities
  const collectors = state.tradeInboxCollectors
  const freshOpportunityIds = state.tradeInboxFreshOpportunityIds
  const recentActiveCollectors = collectors
    .filter((collector) => collector.lastSyncedAt)
    .sort((left, right) => String(right.lastSyncedAt ?? '').localeCompare(String(left.lastSyncedAt ?? '')))
    .slice(0, 4)
  const recentActiveCollectorIds = new Set(recentActiveCollectors.map((collector) => collector.userId))
  const rotatingCollectors = collectors.filter((collector) => !recentActiveCollectorIds.has(collector.userId))

  function gameTitle(gameId: string) {
    return getGameById(gameId)?.title ?? gameId
  }

  function renderReqCard(r: TradeRequest) {
    const statusLabel = r.status === 'pending' ? 'Pending' : r.status === 'accepted' ? 'Accepted' : 'Declined'
    const statusClass = r.status === 'pending' ? 'trade-status--pending' : r.status === 'accepted' ? 'trade-status--accepted' : 'trade-status--declined'
    const dir = r.isIncoming ? `From <strong>${escapeHtml(r.fromDisplayName)}</strong>` : `To <strong>${escapeHtml(r.toDisplayName)}</strong>`
    const dismissLabel = r.status === 'declined' ? 'Archive' : 'Delete'
    return `
      <div class="trade-req-card">
        <div class="trade-req-meta">
          <span class="trade-status ${statusClass}">${statusLabel}</span>
          <span class="trade-req-dir">${dir}</span>
          ${r.unreadCount ? `<span class="trade-unread-badge">${r.unreadCount} new</span>` : ''}
        </div>
        ${renderTradeGameSnapshot(r.gameId, r.tradeEdition, r.tradeCondition, r.tradeVariant) || `<p class="trade-req-game">${escapeHtml(getGameById(r.gameId)?.title ?? r.gameId)}</p>`}
        ${r.note ? `<p class="trade-req-note">${escapeHtml(r.note)}</p>` : ''}
        <div class="trade-req-actions">
          ${r.status === 'pending' && r.isIncoming ? `
            <button class="toggle-button" data-action="trade-accept" data-id="${escapeHtml(r.id)}" type="button">Accept</button>
            <button class="ghost-button" data-action="trade-decline" data-id="${escapeHtml(r.id)}" type="button">Decline</button>
          ` : ''}
          ${r.status === 'accepted' ? `
            <button class="toggle-button" data-action="trade-open-thread" data-id="${escapeHtml(r.id)}" type="button">${r.unreadCount ? `View messages (${r.unreadCount} new)` : 'View messages'}</button>
          ` : ''}
          <button class="ghost-button trade-delete-request-btn" data-action="trade-delete-request" data-id="${escapeHtml(r.id)}" type="button">${dismissLabel}</button>
        </div>
      </div>`
  }

  const tradeNotice = `
    <div class="trade-responsibility-note" role="note" aria-label="Trade responsibility notice">
      <strong>Collector-to-collector only.</strong>
      <span>Retro Vault Elite only provides discovery and messaging tools. Trades, payments, shipping, item checks, and standard safety precautions are entirely the responsibility of the users involved.</span>
    </div>
  `

  return `
    <section class="trade-inbox">
      <div class="section-heading">
        <div>
          <p class="kicker">Trade Inbox</p>
          <h2>Your trade requests</h2>
        </div>
        <button class="ghost-button" data-action="trade-close" type="button">&#8592; Back to collection</button>
      </div>
      ${tradeNotice}

      ${declined.length ? `
        <label class="trade-archive-toggle">
          <input type="checkbox" data-action="toggle-hide-archived-trades" ${state.hideArchivedTrades ? 'checked' : ''} />
          <span>Hide archived</span>
        </label>
      ` : ''}
      ${declined.length && state.hideArchivedTrades ? `<p class="subtle trade-archived-note">${declined.length} archived trade${declined.length === 1 ? '' : 's'} hidden. <button class="link-button trade-archived-link" data-action="show-archived-trades" type="button">Show</button></p>` : ''}

      ${state.tradeInboxLoading ? '<p class="subtle">Loading...</p>' : ''}

      ${!state.tradeInboxLoading && state.tradeInboxError ? `<p class="error-note">${escapeHtml(state.tradeInboxError)}</p>` : ''}
      ${opportunities.length > 0 ? `
        <div class="trade-matches-panel">
          <p class="kicker">Trading games you want</p>
          <p class="subtle">Collectors who already marked your wanted games as available for trade.${freshOpportunityIds.size ? ` <span class="trade-fresh-inline">${freshOpportunityIds.size} new</span>` : ''}</p>
          <div class="trade-match-list">
            ${opportunities.map((opportunity) => `
              <div class="trade-match-card trade-match-card--mutual">
                <div class="trade-match-name">
                  <strong>${escapeHtml(gameTitle(opportunity.gameId))}</strong>
                  ${freshOpportunityIds.has(opportunity.gameId) ? '<span class="trade-fresh-badge">New</span>' : ''}
                </div>
                ${renderTradeGameSnapshot(opportunity.gameId)}
                <p class="subtle">${opportunity.requestableOwnerCount} collector${opportunity.requestableOwnerCount === 1 ? '' : 's'} ready to hear from you now.</p>
                ${opportunity.ownerCount > opportunity.requestableOwnerCount ? `<p class="subtle">${opportunity.ownerCount} total collector${opportunity.ownerCount === 1 ? '' : 's'} have this in their trade list.</p>` : ''}
                <button class="toggle-button trade-view-profile-btn" data-action="open-trade-request" data-id="${escapeHtml(opportunity.gameId)}" type="button">Request this game</button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      ${state.tradeMatches.length > 0 ? `
        <div class="trade-matches-panel">
          <p class="kicker">Best matches</p>
          <p class="subtle">Collectors offering games you want, or wanting games you're trading.</p>
          <div class="trade-match-list">
            ${state.tradeMatches.map((m) => `
              <div class="trade-match-card${m.isMutual ? ' trade-match-card--mutual' : ''}">
                <div class="trade-match-name">
                  ${m.isMutual ? '<span class="trade-mutual-badge">Mutual match</span>' : ''}
                  <strong>${escapeHtml(m.displayName)}</strong>
                </div>
                ${m.isMutual && getTradeMatchReason(m) ? `<p class="trade-match-reason">${escapeHtml(getTradeMatchReason(m))}</p>` : ''}
                ${m.theyHaveWhatIWant.length ? `<p class="subtle">Offering ${m.theyHaveWhatIWant.length} game${m.theyHaveWhatIWant.length > 1 ? 's' : ''} for trade that you want.</p>` : ''}
                ${m.iHaveWhatTheyWant.length ? `<p class="subtle">Wants ${m.iHaveWhatTheyWant.length} game${m.iHaveWhatTheyWant.length > 1 ? 's' : ''} you have for trade.</p>` : ''}
                <button class="toggle-button trade-view-profile-btn" data-action="trade-view-profile" data-user-id="${escapeHtml(m.userId)}" type="button">View their trade list</button>
              </div>`).join('')}
          </div>
        </div>
      ` : ''}
      ${recentActiveCollectors.length > 0 ? `
        <div class="trade-matches-panel">
          <p class="kicker">Recently active collectors</p>
          <p class="subtle">Collectors who recently synced and already own games from your wanted list.</p>
          <div class="trade-match-list">
            ${recentActiveCollectors.map((collector) => `
              <div class="trade-match-card">
                <div class="trade-match-name">
                  <strong>${escapeHtml(collector.displayName)}</strong>
                </div>
                ${renderTradeGameSnapshot(collector.featuredGameId)}
                <p class="subtle">Owns ${collector.matchingGameIds.length} wanted game${collector.matchingGameIds.length === 1 ? '' : 's'} of yours, including ${escapeHtml(gameTitle(collector.featuredGameId))}.</p>
                <p class="subtle trade-active-meta">Active ${escapeHtml(formatRelativeTime(collector.lastSyncedAt))}</p>
                <button class="ghost-button trade-view-profile-btn" data-action="trade-view-profile" data-user-id="${escapeHtml(collector.userId)}" type="button">View collector</button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      ${rotatingCollectors.length > 0 ? `
        <div class="trade-matches-panel">
          <p class="kicker">More collectors to browse</p>
          <p class="subtle">A rotating mix of collectors who own games from your wanted list. Browse first, then request trades only where someone has opted in.</p>
          <div class="trade-match-list">
            ${rotatingCollectors.map((collector) => `
              <div class="trade-match-card">
                <div class="trade-match-name">
                  <strong>${escapeHtml(collector.displayName)}</strong>
                </div>
                ${renderTradeGameSnapshot(collector.featuredGameId)}
                <p class="subtle">Owns ${collector.matchingGameIds.length} wanted game${collector.matchingGameIds.length === 1 ? '' : 's'} of yours, including ${escapeHtml(gameTitle(collector.featuredGameId))}.</p>
                <button class="ghost-button trade-view-profile-btn" data-action="trade-view-profile" data-user-id="${escapeHtml(collector.userId)}" type="button">View collector</button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${state.tradeInterestGameId && state.tradeInterestUserId ? `
        <div class="trade-compose">
          <p class="kicker">New trade request</p>
          <p>Requesting from <strong>${escapeHtml(state.tradeMatches.find((m) => m.userId === state.tradeInterestUserId)?.displayName ?? '')}</strong></p>
          ${renderTradeGameSnapshot(state.tradeInterestGameId)}
          <textarea id="trade-note-input" class="trade-note-input" placeholder="Add a note (optional, max 500 chars)" maxlength="500" rows="3"></textarea>
          <div class="trade-compose-actions">
            <button class="toggle-button" data-action="trade-send-request" type="button">Send trade request</button>
            <button class="ghost-button" data-action="trade-interest-cancel" type="button">Cancel</button>
          </div>
          ${state.tradeSendError ? `<p class="error-note">${escapeHtml(state.tradeSendError)}</p>` : ''}
        </div>
      ` : ''}

      ${!state.tradeInboxLoading && reqs.length === 0 && state.tradeMatches.length === 0 && opportunities.length === 0 && collectors.length === 0 ? `
        <div class="empty-state">
          <h3>No trades yet</h3>
          <p>Trade matches appear when another collector owns games you want, or wants games you own. Make sure your collection is synced.</p>
        </div>
      ` : ''}

      ${pending.length ? `<h3 class="trade-section-title">Pending (${pending.length})</h3>${pending.map(renderReqCard).join('')}` : ''}
      ${accepted.length ? `<h3 class="trade-section-title">Active Trades (${accepted.length})</h3>${accepted.map(renderReqCard).join('')}` : ''}
      ${visibleDeclined.length ? `<h3 class="trade-section-title">Declined (${declined.length})</h3>${visibleDeclined.map(renderReqCard).join('')}` : ''}
    </section>`
}

function renderTradePromptToast() {
  const gameId = state.tradePromptGameId
  if (!gameId) return ''
  const game = getGameById(gameId)
  const title = game?.title ?? gameId
  const isDuplicate = state.tradePromptIsDuplicate

  if (state.tradePromptPickingCopy && isDuplicate) {
    const record = state.library[gameId] ?? null
    const copies = record ? getRecordCopies(record) : []
    const copyButtons = copies
      .map((c, i) => `<button class="toggle-button" data-action="trade-prompt-pick-copy" data-id="${escapeHtml(gameId)}" data-copy-index="${i}" type="button">Copy ${i + 1}: ${escapeHtml(getEditionLabel(c.edition))}</button>`)
      .join('')
    return `<div class="trade-prompt-toast">
      <div class="trade-prompt-toast-text">
        <strong>${escapeHtml(title)}</strong> — which copy do you want to offer?
      </div>
      <div class="trade-prompt-toast-actions">
        ${copyButtons}
        <button class="ghost-button trade-prompt-no" data-action="trade-prompt-no" type="button">Cancel</button>
      </div>
    </div>`
  }

  return `<div class="trade-prompt-toast">
    <div class="trade-prompt-toast-text">
      <strong>${escapeHtml(title)}</strong>${isDuplicate ? ' — you now have multiple copies.' : ' added to your collection.'}<br>
      <span>${isDuplicate ? 'Want to offer one of your copies for trade?' : 'Would you like to offer it for trade with other collectors?'}</span>
    </div>
    <div class="trade-prompt-toast-actions">
      <button class="toggle-button trade-prompt-yes" data-action="trade-prompt-yes" data-id="${escapeHtml(gameId)}" type="button">${isDuplicate ? 'Yes, choose copy' : 'Yes, offer it'}</button>
      <button class="ghost-button trade-prompt-no" data-action="trade-prompt-no" type="button">No thanks</button>
    </div>
  </div>`
}

function renderTradeRequestModal() {
  const gameId = state.tradeAvailabilityOwnersGameId

  if (!gameId) {
    return ''
  }

  const game = getGameById(gameId)
  const gameTitle = game?.title ?? gameId
  const selectedOwner = state.tradeAvailabilityOwners.find((owner) => owner.userId === state.tradeInterestUserId) ?? null
  const tradeNotice = `
    <div class="trade-responsibility-note trade-responsibility-note--compact" role="note" aria-label="Trade responsibility notice">
      <strong>Collector-to-collector only.</strong>
      <span>Retro Vault Elite does not broker, verify, ship, or take payment for trades. Standard safety precautions are the responsibility of the users involved.</span>
    </div>
  `

  return `
    <div class="trade-request-backdrop" data-action="trade-request-close">
      <section class="trade-request-modal" role="dialog" aria-modal="true" aria-labelledby="trade-request-title">
        <button class="modal-close" type="button" data-action="trade-request-close" aria-label="Close trade request">Close</button>
        <p class="kicker">Trade opportunity</p>
        <h2 id="trade-request-title">${escapeHtml(gameTitle)}</h2>
        <p class="modal-description">Collectors offering this game can be contacted from here without leaving the vault.</p>
        ${tradeNotice}
        ${state.tradeAvailabilityOwnersLoading ? `
          <p class="subtle">Loading...</p>
        ` : ''}
        ${!state.tradeAvailabilityOwnersLoading && !state.tradeAvailabilityOwners.length ? `
          <div class="empty-state">
            <h3>No current offers</h3>
            <p>No one has this marked for trade right now. Keep it on your wanted list and check back.</p>
          </div>
        ` : ''}
        ${!state.tradeAvailabilityOwnersLoading && state.tradeAvailabilityOwners.length > 0 && !selectedOwner ? `
          <div class="trade-owner-list">
            ${state.tradeAvailabilityOwners.map((owner) => `
              <article class="trade-owner-card">
                <div>
                  <strong>${escapeHtml(owner.displayName)}</strong>
                  <span>${owner.hasPendingRequest ? 'Pending request already open' : 'Available for trade right now'}</span>
                  <span>${escapeHtml(getEditionLabel(getTradeEditionStatus(owner.tradeEdition)))} / ${escapeHtml(getConditionLabel(getTradeConditionRating(owner.tradeCondition)))}${owner.tradeVariant ? ` / ${escapeHtml(owner.tradeVariant)}` : ''}${game ? ` / ${escapeHtml(formatPrice(getTradeMarketValue(game, owner.tradeEdition)))}` : ''}</span>
                </div>
                <button
                  class="ghost-button"
                  data-action="${owner.hasPendingRequest ? 'trade-open-inbox' : 'trade-interest-select'}"
                  data-game-id="${escapeHtml(gameId)}"
                  data-user-id="${escapeHtml(owner.userId)}"
                  type="button"
                >${owner.hasPendingRequest ? 'Open inbox' : 'Request trade'}</button>
              </article>
            `).join('')}
          </div>
        ` : ''}
        ${selectedOwner ? `
          <div class="trade-request-compose">
            <p class="modal-section-label">Requesting from ${escapeHtml(selectedOwner.displayName)}</p>
            ${renderTradeGameSnapshot(gameId, selectedOwner.tradeEdition, selectedOwner.tradeCondition, selectedOwner.tradeVariant)}
            <textarea id="trade-note-input" class="trade-note-input" maxlength="500" rows="4"></textarea>
            <div class="trade-compose-actions">
              <button class="toggle-button" data-action="trade-send-request" type="button">Send trade request</button>
              <button class="ghost-button" data-action="trade-interest-cancel" type="button">Choose another collector</button>
            </div>
          </div>
        ` : ''}
        ${state.tradeSendError ? `<p class="auth-error">${escapeHtml(state.tradeSendError)}</p>` : ''}
      </section>
    </div>
  `
}

function renderTradeProfile() {
  const profile = state.tradeProfile
  const catalog = getCatalog()

  function gameCard(gameId: string, badge: string) {
    const game = catalog.find((g) => g.id === gameId)
    const title = game?.title ?? gameId
    const cover = game?.coverUrl ? escapeHtml(game.coverUrl) : ''
    const consoleName = game ? escapeHtml(game.console) : ''
    const tradeOffer = profile?.tradeOffersByGameId?.[gameId]
    const tradeEdition = tradeOffer?.editionStatus ?? null
    const tradeCondition = tradeOffer?.condition ?? null
    const tradeValue = game ? formatPrice(getTradeMarketValue(game, tradeEdition)) : ''
    const localRecord = getRecord(gameId)
    const canQuickWant = badge === 'owned' && localRecord.status === 'missing'
    const pendingWithCollector = hasPendingTradeWithCollector(state.tradeProfileUserId ?? '', gameId)
    return `<div class="trade-profile-game">
      ${cover ? `<img class="trade-profile-cover" src="${cover}" alt="" loading="lazy" />` : '<div class="trade-profile-cover trade-profile-cover--blank"></div>'}
      <div class="trade-profile-game-info">
        <span class="trade-profile-game-title">${escapeHtml(title)}</span>
        ${consoleName ? `<span class="trade-profile-game-console">${consoleName}</span>` : ''}
        <span class="trade-profile-badge trade-profile-badge--${badge}">${badge === 'owned' ? 'Has it' : 'Wants it'}</span>
        ${badge === 'owned' && tradeOffer ? `<span class="trade-profile-game-console">${escapeHtml(getEditionLabel(getTradeEditionStatus(tradeEdition)))} / ${escapeHtml(getConditionLabel(getTradeConditionRating(tradeCondition)))}${tradeOffer.variant ? ` / ${escapeHtml(tradeOffer.variant)}` : ''} / ${escapeHtml(tradeValue)}</span>` : ''}
        ${pendingWithCollector ? '<span class="trade-profile-game-console trade-profile-pending">Pending with this collector</span>' : ''}
      </div>
      <div class="trade-profile-actions">
        ${canQuickWant ? `<button class="ghost-button trade-profile-wanted-btn" data-action="toggle-wanted" data-id="${escapeHtml(gameId)}" type="button">Want it</button>` : ''}
        <button class="toggle-button trade-profile-request-btn" data-action="${pendingWithCollector ? 'trade-open-inbox' : 'trade-interest-select'}" data-game-id="${escapeHtml(gameId)}" data-user-id="${escapeHtml(state.tradeProfileUserId ?? '')}" type="button">${pendingWithCollector ? 'Open inbox' : 'Trade'}</button>
      </div>
    </div>`
  }

  if (state.tradeProfileLoading) {
    return `<button class="trade-back-btn" data-action="trade-back-to-inbox" type="button">&#8592; Back</button>
      <p class="subtle" style="margin-top:16px">Loading collection...</p>`
  }
  if (!profile) {
    return `<button class="trade-back-btn" data-action="trade-back-to-inbox" type="button">&#8592; Back</button>
      <p class="subtle" style="margin-top:16px">Could not load profile.</p>`
  }

  const myForTrade = new Set(catalog.filter((g) => getRecord(g.id).forTrade).map((g) => g.id))
  const myWanted = new Set(catalog.filter((g) => getRecord(g.id).status === 'wanted').map((g) => g.id))

  const theyHaveIWant = profile.forTradeGameIds.filter((id) => myWanted.has(id))
  const iHaveTheyWant = profile.wantedGameIds.filter((id) => myForTrade.has(id))
  const theirOtherForTrade = profile.forTradeGameIds.filter((id) => !myWanted.has(id))
  const hasPendingWithCollector = hasPendingTradeWithCollector(profile.userId)

  return `<section class="trade-profile-view">
    <button class="trade-back-btn" data-action="trade-back-to-inbox" type="button">&#8592; Back</button>
    <h2 class="trade-profile-name">${escapeHtml(profile.displayName)}'s Trade List</h2>
    <div class="trade-responsibility-note trade-responsibility-note--compact" role="note" aria-label="Trade responsibility notice">
      <strong>Collector-to-collector only.</strong>
      <span>Retro Vault Elite only provides discovery and messaging tools. Trades, payments, shipping, item checks, and standard safety precautions are the responsibility of the users involved.</span>
    </div>
    ${hasPendingWithCollector ? '<p class="subtle trade-profile-pending-note">You already have a pending request with this collector. Opening inbox will show the current thread.</p>' : ''}

    ${theyHaveIWant.length ? `
      <h3 class="trade-section-title trade-section-title--match">They're offering - you want these (${theyHaveIWant.length})</h3>
      <div class="trade-profile-game-list">${theyHaveIWant.map((id) => gameCard(id, 'owned')).join('')}</div>` : ''}

    ${iHaveTheyWant.length ? `
      <h3 class="trade-section-title trade-section-title--match">They want - you're offering these (${iHaveTheyWant.length})</h3>
      <div class="trade-profile-game-list">${iHaveTheyWant.map((id) => gameCard(id, 'wanted')).join('')}</div>` : ''}

    ${theirOtherForTrade.length ? `
      <h3 class="trade-section-title">Also available to trade (${theirOtherForTrade.length})</h3>
      <div class="trade-profile-game-list">${theirOtherForTrade.map((id) => gameCard(id, 'owned')).join('')}</div>` : ''}

    ${!profile.forTradeGameIds.length ? '<p class="subtle">This collector hasn\'t marked any games for trade yet.</p>' : ''}
  </section>`
}

function renderTradeThread() {
  const thread = state.tradeThread
  if (!thread) return '<p class="subtle">Loading...</p>'
  const { messages, tradeRequest: tr, otherUser, suggestedReplyGameId } = thread

  return `
    <section class="trade-thread">
      <div class="section-heading">
        <div>
          <p class="kicker">Trade conversation</p>
          <h2>With ${escapeHtml(otherUser.displayName)}</h2>
        </div>
        <button class="ghost-button" data-action="trade-back-to-inbox" type="button">&#8592; Back to inbox</button>
      </div>
      <div class="trade-responsibility-note trade-responsibility-note--compact" role="note" aria-label="Trade responsibility notice">
        <strong>Collector-to-collector only.</strong>
        <span>Retro Vault Elite does not broker, verify, ship, or take payment for trades. Standard safety precautions are the responsibility of the users involved.</span>
      </div>
      <div class="trade-thread-meta">
        <p class="subtle">${escapeHtml(getGameById(tr.gameId)?.title ?? tr.gameId)} &middot; <span class="trade-status-inline trade-status-inline--${tr.status}">${tr.status}</span></p>
        <button class="trade-delete-full-btn ghost-button" data-action="trade-delete-request" data-id="${escapeHtml(tr.id)}" type="button">Delete trade</button>
      </div>
      <div class="trade-thread-snapshots">
        ${renderTradeGameSnapshot(tr.gameId, tr.tradeEdition, tr.tradeCondition, tr.tradeVariant)}
        ${tr.status === 'accepted' && suggestedReplyGameId ? renderLocalTradeGameSnapshot(suggestedReplyGameId) : ''}
      </div>
      <p class="subtle trade-privacy-note">Never share your email, phone, or address here. Arrange trades safely.</p>

      <div class="trade-messages">
        ${messages.length === 0 ? '<p class="subtle">No messages yet. Say hello!</p>' : ''}
        ${messages.map((m) => `
          <div class="trade-msg${m.isOwn ? ' trade-msg--own' : ''}">
            <div class="trade-msg-header">
              <span class="trade-msg-sender">${escapeHtml(m.senderDisplayName)}</span>
              ${m.isOwn ? `<button class="trade-msg-delete" data-action="trade-delete-message" data-id="${escapeHtml(tr.id)}" data-message-id="${escapeHtml(m.id)}" type="button" aria-label="Delete message" title="Delete message">Delete</button>` : ''}
            </div>
            <p class="trade-msg-text">${escapeHtml(m.text)}</p>
            <span class="trade-msg-time">${new Date(m.createdAt).toLocaleString()}</span>
          </div>`).join('')}
      </div>

      <div class="trade-compose">
        <textarea id="trade-msg-input" class="trade-note-input" maxlength="2000" rows="3"></textarea>
        <div class="trade-compose-actions">
          <button class="toggle-button" data-action="trade-send-message" data-id="${escapeHtml(tr.id)}" type="button">Send</button>
        </div>
        ${state.tradeSendError ? `<p class="error-note">${escapeHtml(state.tradeSendError)}</p>` : ''}
      </div>
    </section>`
}

const ALPHA_LETTERS = ['#', 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']

function renderAlphabetBar() {
  const active = state.letterFilter
  return `<div class="alpha-bar" role="group" aria-label="Filter by first letter">
    ${ALPHA_LETTERS.map((l) => `<button class="alpha-chip${active === l ? ' is-active' : ''}" data-action="set-letter-filter" data-letter="${l}" type="button" aria-pressed="${active === l}">${l}</button>`).join('')}
    ${active ? `<button class="alpha-chip alpha-chip--clear" data-action="set-letter-filter" data-letter="" type="button">Clear</button>` : ''}
  </div>`
}

function renderCatalogSkeleton() {
  return `
    <div class="catalog-grid catalog-grid--skeleton" aria-label="Loading games">
      ${Array.from({ length: 12 }, () => `
        <article class="game-card skeleton-card" aria-hidden="true">
          <div class="cover-wrap skeleton-card__cover"></div>
          <div class="game-copy skeleton-card__copy">
            <span class="skeleton-line skeleton-line--short"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line skeleton-line--tiny"></span>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderCatalogSection(filteredGames: CatalogEntry[], visibleGames: CatalogEntry[]) {
  const isShelf = state.viewMode === 'shelf'
  const trackedCount = getOwnedGames().length + getWantedGames().length
  const showGuestRunway = !state.authToken && !state.search.trim() && state.ownershipFilter === 'all'
  const showRecentStrip = Boolean(state.authToken && !state.search.trim() && state.ownershipFilter === 'all' && state.recentViewedGameIds.length)
  const emptyState = state.ownershipFilter === 'tradeable-now'
    ? '<div class="empty-state"><p class="empty-state__eyebrow">Trade live</p><h3>No live trade copies in this view</h3><p>Nothing here is currently listed by other collectors. Widen the console or region filters, or open Trade Inbox for fresher matches.</p><div class="empty-state__actions"><button class="ghost-button" data-action="trade-open-inbox" type="button">Open Trade Inbox</button><button class="secondary-button" data-action="ownership-filter" data-filter="all" type="button">Show all games</button></div></div>'
    : state.ownershipFilter === 'wanted-now'
      ? '<div class="empty-state"><p class="empty-state__eyebrow">Demand</p><h3>No live wanted signals here</h3><p>No collectors in this view are actively chasing these games right now. Try another console, clear a filter, or mark more of your own copies for trade.</p><div class="empty-state__actions"><button class="secondary-button" data-action="ownership-filter" data-filter="all" type="button">Show all games</button><button class="ghost-button" data-action="browse-tradeable-now" type="button">Browse trade live</button></div></div>'
      : trackedCount === 0
        ? '<div class="empty-state"><p class="empty-state__eyebrow">Nothing here yet</p><h3>Add your first game</h3><p>Browse the library or scan a barcode to start building your collection.</p><div class="empty-state__actions"><button class="toggle-button" data-action="browse-library" type="button">Browse Games Library</button><button class="ghost-button" data-action="open-scanner" type="button">Scan Barcode</button></div></div>'
        : '<div class="empty-state"><p class="empty-state__eyebrow">No matches</p><h3>Nothing matches this view yet</h3><p>Clear a filter, switch consoles, or add the missing title yourself and keep the vault moving.</p><div class="empty-state__actions"><button class="toggle-button" data-action="open-custom-entry" type="button">Add missing game</button><button class="ghost-button" data-action="reset-library" type="button">Clear filters</button></div></div>'
  const showSkeleton = state.isCatalogLoading && visibleGames.length === 0
  return `
    <section class="catalog-section">
      ${showGuestRunway ? renderCatalogRunway(filteredGames) : ''}
      ${showRecentStrip ? renderContinueHuntingStrip() : ''}
      <div class="section-heading">
        <div>
          <div class="catalog-kicker-row">
            <p class="kicker">${state.consoleFilter === LEGENDS_FILTER ? '★ Legends' : `Collection ${isShelf ? 'shelf' : 'grid'}`}</p>
            <div class="view-toggle-group">
              <button class="view-toggle-btn${!isShelf ? ' is-active' : ''}" data-action="view-grid" type="button" aria-label="Grid view" title="Grid view">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
              </button>
              <button class="view-toggle-btn${isShelf ? ' is-active' : ''}" data-action="view-shelf" type="button" aria-label="Shelf view" title="Shelf view">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="2" height="14" rx="1"/><rect x="4" y="1" width="2" height="14" rx="1"/><rect x="7" y="1" width="2" height="14" rx="1"/><rect x="10" y="1" width="2" height="14" rx="1"/><rect x="13" y="1" width="2" height="14" rx="1"/></svg>
              </button>
            </div>
          </div>
          ${state.consoleFilter === LEGENDS_FILTER
            ? `<h2>Featured games</h2><p class="legends-sub">A smaller set to start with. Switch to <em>All consoles</em> to browse the full library.</p>`
            : `<h2>${showSkeleton ? 'Loading the Games Library' : `${filteredGames.length} game${filteredGames.length === 1 ? '' : 's'} in view`}</h2>`}
        </div>
        <div class="catalog-section__actions">
          <button class="ghost-button" data-action="open-custom-entry" type="button">Report Missing Game</button>
        </div>
      </div>
      ${renderAlphabetBar()}
      ${
        showSkeleton
          ? renderCatalogSkeleton()
          : isShelf
          ? renderShelfView(visibleGames)
          : `<div class="catalog-grid">${visibleGames.length ? visibleGames.map(renderCard).join('') : emptyState}</div>`
      }
      ${
        filteredGames.length > visibleGames.length
          ? `<div class="load-more-row"><button class="secondary-button" data-action="load-more-games" type="button">Load more games (${(filteredGames.length - visibleGames.length).toLocaleString()} left)</button></div>`
          : ''
      }
    </section>
  `
}

function getMissingGamesForConsole(consoleName: string, limit = 6) {
  const rarityRank: Record<string, number> = { Grail: 0, Classic: 1, Common: 2 }
  return getCatalog()
    .filter((g) => g.console === consoleName && getRecord(g.id).status !== 'owned')
    .sort((a, b) => {
      const rd = (rarityRank[a.rarity] ?? 2) - (rarityRank[b.rarity] ?? 2)
      if (rd !== 0) return rd
      return (b.priceLoose ?? 0) - (a.priceLoose ?? 0)
    })
    .slice(0, limit)
}

void [getTodayHuntItems, getWeeklyRecapHighlights, getCollectionEraLabel, getCollectorAchievements]

function renderOwnershipPickerModal() {
  if (!state.ownershipPickerGameId) {
    return ''
  }

  const game = getGameById(state.ownershipPickerGameId)

  if (!game) {
    return ''
  }

  const completeValue = game.priceComplete === null ? getReferencePrice(game) : game.priceComplete
  const sealedValue = typeof game.priceSealed === 'number' ? game.priceSealed : null
  const boxedValue = getEditionMarketValue(game, 'boxed')
  const manualValue = getEditionMarketValue(game, 'manual')
  const boxOnlyValue = getEditionMarketValue(game, 'box-only')
  const manualOnlyValue = getEditionMarketValue(game, 'manual-only')
  const boxManualValue = getEditionMarketValue(game, 'box-manual')
  const safeGameId = escapeHtml(game.id)
  const existingRecord = getRecord(game.id)
  const gradedDisplayValue = typeof existingRecord.appraisedValue === 'number' ? formatPrice(existingRecord.appraisedValue) : 'Set value'
  const isAddingCopy = existingRecord.status === 'owned'
  const copiesSummary = isAddingCopy ? getCopiesSummary(existingRecord) || getEditionLabel(existingRecord.editionStatus) : ''

  return `
    <div class="game-modal-backdrop" data-action="close-ownership-picker">
      <section class="ownership-picker" role="dialog" aria-modal="true" aria-labelledby="ownership-picker-title" onclick="event.stopPropagation()">
        <button class="modal-close" type="button" data-action="close-ownership-picker" aria-label="Close ownership picker">Close</button>
        <p class="kicker">${isAddingCopy ? 'Add another copy' : 'Add to collection'}</p>
        <h2 id="ownership-picker-title">${escapeHtml(game.title)}</h2>
        ${isAddingCopy ? `<p class="modal-description">Already have: <strong>${escapeHtml(copiesSummary)}</strong>. Choose the edition of the new copy.</p>` : `<p class="modal-description">Choose the version you own so Retro Vault uses the right market value for your collection.</p>`}
        <div class="ownership-choice-grid ownership-choice-grid--wide">
          <button class="ownership-choice" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="loose">
            <span>Loose</span>
            <strong>${formatPrice(game.priceLoose)}</strong>
            <em>Cart, disc, or card only</em>
          </button>
          <button class="ownership-choice" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="boxed">
            <span>Boxed</span>
            <strong>${formatPrice(boxedValue)}</strong>
            <em>Box + cart, no manual</em>
          </button>
          <button class="ownership-choice" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="manual">
            <span>Cart + manual</span>
            <strong>${formatPrice(manualValue)}</strong>
            <em>Cart + manual, no box</em>
          </button>
          <button class="ownership-choice" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="box-only">
            <span>Box only</span>
            <strong>${formatPrice(boxOnlyValue)}</strong>
            <em>Packaging only, no game</em>
          </button>
          <button class="ownership-choice" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="manual-only">
            <span>Manual only</span>
            <strong>${formatPrice(manualOnlyValue)}</strong>
            <em>Instruction manual only</em>
          </button>
          <button class="ownership-choice" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="box-manual">
            <span>Box + manual</span>
            <strong>${formatPrice(boxManualValue)}</strong>
            <em>No game included</em>
          </button>
          <button class="ownership-choice ownership-choice--premium" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="cib">
            <span>Complete (CiB)</span>
            <strong>${formatPrice(completeValue)}</strong>
            <em>Box, cart, and manual</em>
          </button>
          <button class="ownership-choice ownership-choice--premium" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="sealed">
            <span>Sealed</span>
            <strong>${sealedValue === null ? 'No market price' : formatPrice(sealedValue)}</strong>
            <em>${sealedValue === null ? 'Factory sealed - source price not available yet' : 'Factory sealed'}</em>
          </button>
          <button class="ownership-choice ownership-choice--premium" type="button" data-action="confirm-owned" data-id="${safeGameId}" data-edition="graded">
            <span>Graded</span>
            <strong>${gradedDisplayValue}</strong>
            <em>Enter grade and appraised value</em>
          </button>
        </div>
        <p class="subtle">You can refine condition, paid price, grade, and notes from the Details panel.</p>
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
            <label><span>Edition</span><select name="editionStatus"><option value="loose">Loose</option><option value="boxed">Boxed</option><option value="manual">Cart + manual</option><option value="box-only">Box only</option><option value="manual-only">Manual only</option><option value="box-manual">Box + manual</option><option value="cib">Complete in box</option><option value="sealed">Sealed</option><option value="graded">Graded</option></select></label>
          </div>
          <label><span>Notes</span><input name="notes" maxlength="220" /></label>
          <button class="toggle-button" type="submit">Add to my collection</button>
        </form>
      </section>
    </div>
  `
}

function renderMobileAccountBar() {
  const accountIdentity = getAccountIdentityLabel()

  return `
    <section class="mobile-account-bar" aria-label="Account access">
      <div>
        <span>${state.authToken ? 'Signed in' : 'Account'}</span>
        <strong>${state.authToken ? escapeHtml(accountIdentity) : 'Save your vault across devices'}</strong>
      </div>
      <div class="mobile-account-actions">
        ${
          state.authToken
            ? '<button class="install-button" type="button" data-action="open-account-settings">Account</button>'
            : '<button class="install-button" type="button" data-action="open-login">Sign In</button><button class="ghost-button" type="button" data-action="open-register">Create</button>'
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
    login: 'Sign In',
    reset: 'Reset your password',
    account: 'Account Settings',
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
      return 'Welcome back. Sign in to restore your saved collection.'
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
        <button class="toggle-button" type="submit" ${disabled}>${buttonText('Create Free Vault')}</button>
        <button class="ghost-button" type="button" data-action="open-login">Already have an account?</button>
      </form>
    `
  }

  if (state.authView === 'login') {
    return `
      <form class="auth-form" data-auth-form="login">
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required value="${emailDraft}" /></label>
        <label><span>Password</span><input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="toggle-button" type="submit" ${disabled}>${buttonText('Sign In')}</button>
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
  const coverMatchGames = state.coverScanMatches
    .map((match) => {
      const game = getGameById(match.gameId)

      if (!game) {
        return null
      }

      return {
        game,
        distance: match.distance,
      }
    })
    .filter((entry): entry is { game: CatalogEntry; distance: number } => entry !== null)

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
            <label class="toggle-button scanner-upload">
              Front cover photo
              <input id="cover-scan-input" type="file" accept="image/*" capture="environment" hidden />
            </label>
            <button class="ghost-button" data-action="manual-barcode" type="button">Enter barcode or ID</button>
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
                  <p><strong>Scanned barcode or ID:</strong> ${escapeHtml(state.barcodeLinkCode)}</p>
                  ${
                    linkedGame
                      ? `<p><strong>Linked game:</strong> ${escapeHtml(linkedGame.title)} on ${escapeHtml(linkedGame.console)}</p>`
                      : '<p><strong>Status:</strong> No saved match yet. Keep going by searching for the game title, barcode, or reference ID below, then link the right match once.</p>'
                  }
                </div>
                <label class="search-field">
                  <span>Search game to link by title, barcode, or ID</span>
                  <input id="barcode-search" type="search" aria-label="Search a title, console, barcode, or reference ID" value="${escapeHtml(state.barcodeSearch)}" />
                </label>
                <p class="subtle scanner-search-note">Every game has a Vault ID. Some games also have product or reference IDs like KSC-TS.</p>
                <div class="barcode-match-list">
                  ${
                    matches.length
                      ? matches
                          .map(
                            (game) => {
                              const identifier = getPrimaryIdentifier(game)

                              return `
                              <button class="barcode-match" type="button" data-action="link-barcode" data-id="${escapeHtml(game.id)}">
                                <strong>${escapeHtml(game.title)}</strong>
                                <span>${escapeHtml(game.console)} / ${escapeHtml(identifier.label)}: ${escapeHtml(identifier.value)} / ${formatPrice(game.priceLoose)}</span>
                              </button>
                            `
                            },
                          )
                          .join('')
                      : `<p class="subtle">${
                          state.barcodeSearch.trim()
                            ? 'No match yet. Search by title, console, barcode, or reference ID.'
                            : state.consoleFilter === 'All consoles' && state.regionFilter === 'All regions'
                              ? 'Start typing a title, barcode, or ID, or narrow the vault to a console first so the list stays useful.'
                              : 'Start typing to narrow the list further.'
                        }</p>`
                  }
                </div>
              `
              : '<p class="subtle">Use live camera scan, a saved barcode photo, or manual entry. You can link by barcode or reference ID, and Retro Vault will remember that match for future scans.</p>'
          }
          <div class="scanner-result">
            <p><strong>Front cover match beta</strong></p>
            <p>${escapeHtml(state.coverScanStatus || getCoverScanStatusHint())}</p>
            ${
              coverMatchGames.length
                ? `
                  <div class="barcode-match-list">
                    ${coverMatchGames
                      .map(
                        ({ game, distance }) => `
                          <button class="barcode-match" type="button" data-action="open-cover-match" data-id="${escapeHtml(game.id)}">
                            <strong>${escapeHtml(game.title)}</strong>
                            <span>${escapeHtml(game.console)} / ${escapeHtml(game.region)} / Match score ${Math.max(1, 64 - distance)}/64</span>
                          </button>
                        `,
                      )
                      .join('')}
                  </div>
                `
                : ''
            }
          </div>
        </div>
      </section>
    </div>
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
  const currentModal = app.querySelector<HTMLElement>('.game-modal')
  if (currentModal && state.selectedGameId) {
    state.selectedGameModalScrollTop = currentModal.scrollTop
  }
  const focusSnapshot = captureFocusSnapshot()
  const catalog = getCatalog()
  const filteredGames = getFilteredGames()
  const visibleGames = filteredGames.slice(0, state.visibleGameCount)
  const dashboard = getDashboardSummary(catalog)
  const ownedTrackedValue = dashboard.ownedTrackedValue
  const ownedCompleteValue = dashboard.ownedCompleteValue
  const estimatedSellValue = ownedTrackedValue
  const completionPercentage = dashboard.completionPercentage
  const wishlistValue = dashboard.wishlistValue
  const consoleCount = new Set(catalog.map((game) => game.console)).size
  const loadedConsoleCount = state.loadedConsoles.length
  const totalConsoleCount = state.catalogMeta.length || state.catalogTotalConsoles || consoleCount
  const totalCatalogGames = state.catalogTotalGames || catalog.length || DEFAULT_CATALOG_TOTAL_GAMES
  const selectedCurrency = getSelectedCurrency()
  const accountIdentity = getAccountIdentityLabel()
  const compactCatalogWindow = useCompactCatalogWindow()
  const isSignedIn = Boolean(state.authToken)
  const heroStatsReady = !isSignedIn || (!state.accountHydrationPending && hasCompleteCatalogLoaded())
  const { ownedCount: directOwnedCount, wantedCount: directWantedCount, cachedHeroStats } = getHeroCollectionCounts()
  const heroOwnedCount = directOwnedCount
  const heroWantedCount = directWantedCount
  const heroCompletionPercentage = heroStatsReady ? completionPercentage : (cachedHeroStats?.completionPercentage ?? completionPercentage)
  const heroWishlistValueUsd = heroStatsReady ? wishlistValue : (cachedHeroStats?.wishlistValueUsd ?? wishlistValue)
  const heroEstimatedSellValueUsd = heroStatsReady ? estimatedSellValue : (cachedHeroStats?.ownedTrackedValueUsd ?? estimatedSellValue)
  const heroCollectionPremiumUsd = heroStatsReady ? ownedCompleteValue : (cachedHeroStats?.ownedCompleteValueUsd ?? ownedCompleteValue)
  const hasTrackedGames = directOwnedCount + directWantedCount > 0
  const catalogStatusText = state.isCatalogLoading
    ? `Loading the library. ${loadedConsoleCount} of ${totalConsoleCount} console lists are ready so far.`
    : state.catalogLoadError
      ? `Using the latest reference snapshot from ${priceSnapshotDate} while the rest of the catalog catches up.`
      : `${totalCatalogGames} games across ${totalConsoleCount || consoleCount} retro consoles, with ${loadedConsoleCount} of ${totalConsoleCount} console lists ready. Latest snapshot ${priceSnapshotDate}.`

  const preCatalogCollectorMarkup = ''

  const postCatalogCollectorMarkup = isSignedIn
    ? `
      ${!hasTrackedGames ? renderOnboardingPanel() : ''}
    `
    : `
      ${renderTrustStrip()}
      ${hasTrackedGames ? renderGuestSafeguardStrip() : ''}
    `

  app.innerHTML = `
    ${renderBackdropWall(visibleGames, catalog)}
    <div class="app-shell">
      ${renderMobileAccountBar()}
      <header class="hero-panel">
        <div class="hero-copy">
          <a href="/" class="site-logo" aria-label="Retro Vault Elite home">
            <img class="site-logo__image" src="/retro-vault-elite-logo.png" alt="Retro Vault Elite" width="320" height="320" decoding="async" fetchpriority="high" />
          </a>
          <div class="hero-copy-layout">
            <div class="hero-copy-main">
              <h1>${isSignedIn ? 'Your collection' : 'Track your collection, build a wanted list, and trade duplicates with other collectors.'}</h1>
              <p class="hero-text">
                ${isSignedIn
                  ? 'Search the library, update owned and wanted games, and keep everything in one place.'
                  : 'Search the library, open any game, and decide later if you want to save your collection, keep a wanted list, or trade duplicates.'}
              </p>
              <p class="hero-authority">${isSignedIn ? 'Search first, then open any game to update it.' : 'Built for collectors who care about condition, variants, paid price, and duplicate tracking.'}</p>
              <p class="hero-text hero-text--tiny">${catalogStatusText}${isSignedIn ? ' Collection values convert from USD market data using ECB reference rates from 30 April 2026.' : ''}</p>
              ${
                state.authToken
                  ? `<p class="account-status-pill"><span>Signed in</span><strong>${escapeHtml(accountIdentity)}</strong></p>`
                  : '<p class="account-status-pill account-status-pill--guest"><span>Guest Mode</span><strong>Save your vault across devices.</strong></p>'
              }
              <div class="hero-actions">
                <button class="install-button" type="button" data-action="browse-library">Browse Games Library</button>
                ${state.authToken ? `<button class="secondary-button trade-inbox-btn trade-inbox-btn--hero" data-action="trade-open-inbox" type="button">Trade Inbox${state.tradeInboxFreshOpportunityIds.size > 0 ? ' <span class="trade-inbox-badge trade-inbox-badge--fresh">New</span>' : ''}${(state.tradePending + state.tradeUnread) > 0 ? ` <span class="trade-inbox-badge">${state.tradePending + state.tradeUnread}</span>` : ''}</button><button class="secondary-button" type="button" data-action="open-account-settings">Account Settings</button>` : '<button class="secondary-button" type="button" data-action="open-register">Create Free Vault</button><button class="secondary-button" type="button" data-action="open-login">Sign In</button>'}
                <button class="secondary-button" type="button" data-action="open-scanner">Scan Barcode</button>
                <button class="secondary-button" type="button" data-action="browse-tradeable-now">Ready to Trade</button>
              </div>
              <p class="hero-action-note">${isSignedIn ? 'Open a game to mark it owned, wanted, favorite, or for trade.' : 'No account needed &mdash; browse first, save your collection later.'}</p>
            </div>
            ${renderHeroAudienceCard()}
          </div>
        </div>
        <div class="hero-stats">
          ${
            isSignedIn
              ? `
                <article class="hero-stat-card hero-stat-card--count">
                  <span class="stat-label">Owned</span>
                  <strong class="hero-stat-value hero-stat-value--count">${heroOwnedCount.toLocaleString()}</strong>
                  <span class="stat-note">${heroCompletionPercentage}% collection completion</span>
                </article>
                <article class="hero-stat-card hero-stat-card--count">
                  <span class="stat-label">Wishlist</span>
                  <strong class="hero-stat-value hero-stat-value--count">${heroWantedCount.toLocaleString()}</strong>
                  <span class="stat-note">${formatPrice(heroWishlistValueUsd)} target value</span>
                </article>
                <article class="hero-stat-card hero-stat-card--money">
                  <span class="stat-label">Estimated sell value</span>
                  <strong class="hero-stat-value hero-stat-value--money">${formatPrice(heroEstimatedSellValueUsd)}</strong>
                  <span class="stat-note">Uses your loose/complete ownership choices in ${selectedCurrency.code}</span>
                </article>
                <article class="hero-stat-card hero-stat-card--money">
                  <span class="stat-label">Collection premium</span>
                  <strong class="hero-stat-value hero-stat-value--money">${formatPrice(heroCollectionPremiumUsd)}</strong>
                  <span class="stat-note">Complete market total in ${selectedCurrency.code}</span>
                </article>
              `
              : `
                <article class="hero-stat-card hero-stat-card--count">
                  <span class="stat-label">Library</span>
                  <strong class="hero-stat-value hero-stat-value--count">${totalCatalogGames.toLocaleString()}</strong>
                  <span class="stat-note">games ready to browse</span>
                </article>
                <article class="hero-stat-card hero-stat-card--count">
                  <span class="stat-label">Systems</span>
                  <strong class="hero-stat-value hero-stat-value--count">${totalConsoleCount}</strong>
                  <span class="stat-note">retro consoles covered</span>
                </article>
                <article class="hero-stat-card hero-stat-card--guest">
                  <span class="stat-label">Tracking</span>
                  <strong class="hero-stat-value hero-stat-value--guest">Loose to graded</strong>
                  <span class="stat-note">condition, variants, notes, and paid price</span>
                </article>
                <article class="hero-stat-card hero-stat-card--guest">
                  <span class="stat-label">Trading</span>
                  <strong class="hero-stat-value hero-stat-value--guest">Private collector trades</strong>
                  <span class="stat-note">browse live listings before you create an account</span>
                </article>
              `
          }
        </div>
        <div class="hero-bottom">
          ${renderHeroTrustBadges()}
          <div class="hero-proof-grid">
            <div class="hero-proof-main">
              ${renderHeroSearchBlock()}
              <p class="hero-text hero-text--trade">${
                state.authToken
                  ? 'Trade Inbox keeps requests, replies, and trade matches in one place.'
                  : 'Browse trade listings now. Create an account only when you want to save data or contact someone.'
              }</p>
            </div>
            <div class="hero-proof-side">
              ${renderHeroPreviewStrip()}
              ${renderFeaturedSystemsStrip()}
            </div>
          </div>
          ${isSignedIn ? renderHeroValueStrip() : ''}
        </div>
      </header>

      ${compactCatalogWindow ? '' : preCatalogCollectorMarkup}
      ${renderVaultLanesStrip()}
      <section class="toolbar">
        <label class="search-field">
          <span>${isSignedIn ? 'Search the vault' : 'Search the library'}</span>
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
            ${renderConsoleFilterOptions()}
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
            <option value="trade-recent" ${state.sortMode === 'trade-recent' ? 'selected' : ''}>Recently listed for trade</option>
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
          <span>Release type</span>
          <select id="release-type-filter">
            ${getReleaseTypeOptions()
              .map(
                (option) =>
                  `<option value="${escapeHtml(option)}" ${option === state.releaseTypeFilter ? 'selected' : ''}>${escapeHtml(option)}</option>`,
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
        <div class="toolbar-action toolbar-action--desktop">
          <span>Trading</span>
          <div class="toolbar-action__buttons">
            <button class="secondary-button" data-action="browse-tradeable-now" type="button">Ready to Trade</button>
            ${
              state.authToken
                ? `<button class="secondary-button trade-inbox-btn" data-action="trade-open-inbox" type="button">Trade Inbox${state.tradeInboxFreshOpportunityIds.size > 0 ? ' <span class="trade-inbox-badge trade-inbox-badge--fresh">New</span>' : ''}${(state.tradePending + state.tradeUnread) > 0 ? ` <span class="trade-inbox-badge">${state.tradePending + state.tradeUnread}</span>` : ''}</button>`
                : '<button class="secondary-button" data-action="open-register" type="button">Create Free Vault</button>'
            }
          </div>
        </div>
      </section>

      ${renderControlSummary(filteredGames.length, visibleGames.length)}
      ${renderViewSummary(filteredGames)}
      ${renderFiltersSection()}
      ${renderCatalogSection(filteredGames, visibleGames)}

      ${compactCatalogWindow ? `${preCatalogCollectorMarkup}${postCatalogCollectorMarkup}` : postCatalogCollectorMarkup}
      <footer class="app-footer">
        <a href="${appConfig.supportUrl}" target="_blank" rel="noreferrer">Support</a>
        <a href="${appConfig.privacyUrl}" target="_blank" rel="noreferrer">Privacy</a>
        <a href="${appConfig.termsUrl}" target="_blank" rel="noreferrer">Terms</a>
        <span>${appConfig.marketDisclaimer}</span>
        <span>Cover artwork is used for game identification with visible source links; rights remain with their owners.</span>
        <span class="app-footer__copyright">${appConfig.copyrightNotice} ${appConfig.reuseNotice}</span>
      </footer>
      ${renderScannerModal()}
      ${renderSelectedGameModal()}
      ${renderOwnershipPickerModal()}
      ${renderCustomEntryModal()}
      ${renderBadgesModal()}
      ${renderAuthModal()}
      ${renderImportModal()}
      ${renderTradePromptToast()}
      ${renderTradeRequestModal()}
      ${state.tradeView ? `
        <div class="trade-panel-backdrop" data-action="trade-close"></div>
        <aside class="trade-panel">
          <div class="trade-panel-header">
            <span class="trade-panel-title">Trade Inbox${state.tradeInboxFreshOpportunityIds.size > 0 ? ' <span class="trade-panel-badge trade-panel-badge--fresh">New</span>' : ''}${(state.tradePending + state.tradeUnread) > 0 ? ` <span class="trade-panel-badge">${state.tradePending + state.tradeUnread}</span>` : ''}</span>
            <button class="trade-panel-close" data-action="trade-close" type="button" aria-label="Close">&#x2715;</button>
          </div>
          <div class="trade-panel-body">
            ${currentTradePanelContent()}
          </div>
        </aside>` : ''}
    </div>
  `

  renderedBackdropSignature = state.backdropReady ? getBackdropSignature(getBackdropGames(visibleGames, catalog)) : ''

  bindEvents()
  hydrateSelectedGameCover()
  setupDetailCoverPrewarmObserver()
  const nextModal = app.querySelector<HTMLElement>('.game-modal')
  if (nextModal && state.selectedGameId) {
    nextModal.scrollTop = state.selectedGameId === selectedGameModalRenderedId ? state.selectedGameModalScrollTop : 0
  }
  selectedGameModalRenderedId = state.selectedGameId
  syncBodyScrollLock()
  restoreFocusSnapshot(focusSnapshot)
  void syncLiveBarcodeScan()
  scheduleTradeAvailabilityRefresh(visibleGames)
  scheduleCollectorInsightRefresh()
}

function hydrateSelectedGameCover() {
  const modalCover = app.querySelector<HTMLImageElement>('.game-modal-cover[data-detail-src]')

  if (!modalCover) {
    return
  }

  const detailSrc = modalCover.dataset.detailSrc

  if (!detailSrc || modalCover.src === detailSrc || modalCover.dataset.detailStatus === 'loading' || modalCover.dataset.detailStatus === 'ready') {
    return
  }

  modalCover.dataset.detailStatus = 'loading'
  modalCover.classList.add('is-upgrading-cover')

  const image = new Image()
  image.decoding = 'async'
  image.referrerPolicy = 'no-referrer'

  const finalizeUpgrade = () => {
    if (!modalCover.isConnected || modalCover.dataset.detailSrc !== detailSrc) {
      return
    }

    modalCover.src = detailSrc
    modalCover.dataset.detailStatus = 'ready'
    modalCover.classList.remove('is-upgrading-cover')
  }

  image.addEventListener('load', finalizeUpgrade, { once: true })
  image.addEventListener(
    'error',
    () => {
      if (!modalCover.isConnected || modalCover.dataset.detailSrc !== detailSrc) {
        return
      }

      modalCover.dataset.detailStatus = 'failed'
      modalCover.classList.remove('is-upgrading-cover')
    },
    { once: true },
  )

  image.src = detailSrc
}

function prewarmDetailCoverForGameId(gameId: string | null | undefined) {
  if (!gameId) {
    return
  }

  const game = getGameById(gameId)

  if (!game) {
    return
  }

  const detailSrc = getDetailCoverUpgradeUrl(game) || getCardCoverUrl(game)

  if (!detailSrc || prewarmedDetailCoverUrls.has(detailSrc)) {
    return
  }

  prewarmedDetailCoverUrls.add(detailSrc)

  const image = new Image()
  image.decoding = 'async'
  image.referrerPolicy = 'no-referrer'
  image.src = detailSrc
}

function setupDetailCoverPrewarmObserver() {
  if (detailCoverPrewarmObserver) {
    detailCoverPrewarmObserver.disconnect()
    detailCoverPrewarmObserver = null
  }

  if (typeof IntersectionObserver === 'undefined') {
    return
  }

  detailCoverPrewarmObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }

        const target = entry.target as HTMLElement
        prewarmDetailCoverForGameId(target.dataset.id)
        detailCoverPrewarmObserver?.unobserve(target)
      }
    },
    {
      rootMargin: '280px 0px',
      threshold: 0.12,
    },
  )

  const prewarmTargets = app.querySelectorAll<HTMLElement>(
    '.game-card[data-id], .catalog-rail-card[data-id], .hero-preview-card[data-id], .hero-search-result[data-id]',
  )

  prewarmTargets.forEach((target) => detailCoverPrewarmObserver?.observe(target))
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

function scheduleDeferredStartupWork() {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      void initMobileBannerAd()
    })
  } else {
    setTimeout(() => {
      void initMobileBannerAd()
    }, 900)
  }

  setTimeout(() => {
    startTradeNotificationPoll()
  }, 1500)
}

function flushDeferredBackgroundRefresh() {
  if (pendingBackgroundFullRefresh) {
    pendingBackgroundFullRefresh = false
    pendingBackgroundCatalogRefresh = false
    render()
    return
  }

  if (pendingBackgroundCatalogRefresh) {
    pendingBackgroundCatalogRefresh = false
    renderCatalogOnly()
  }
}

function allowBackgroundVisualRefresh() {
  if (backgroundVisualRefreshReady) {
    return
  }

  backgroundVisualRefreshReady = true
  flushDeferredBackgroundRefresh()
}

function requestBackgroundCatalogRefresh() {
  if (backgroundVisualRefreshReady) {
    renderCatalogOnly()
    return
  }

  pendingBackgroundCatalogRefresh = true
}

function requestBackgroundFullRefresh() {
  if (backgroundVisualRefreshReady) {
    render()
    return
  }

  pendingBackgroundFullRefresh = true
}

function scheduleStartupVisualSettle() {
  const unlock = () => {
    allowBackgroundVisualRefresh()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('touchstart', unlock)
  }

  window.addEventListener('pointerdown', unlock, { once: true, passive: true })
  window.addEventListener('keydown', unlock, { once: true })
  window.addEventListener('touchstart', unlock, { once: true, passive: true })
  window.setTimeout(unlock, STARTUP_VISUAL_SETTLE_MS)
}

function currentTradePanelContent() {
  if (state.tradeThreadId) return renderTradeThread()
  if (state.tradeProfileUserId) return renderTradeProfile()
  return renderTradeInbox()
}

function hasBlockingOverlayOpen() {
  return Boolean(
    state.selectedGameId ||
    state.ownershipPickerGameId ||
    state.customEntryOpen ||
    state.badgesOpen ||
    state.authView !== 'none' ||
    state.importStep !== 'none' ||
    state.scannerOpen ||
    state.tradeAvailabilityOwnersGameId ||
    state.tradeView,
  )
}

function syncBodyScrollLock() {
  if (typeof document === 'undefined') {
    return
  }

  const shouldLock = hasBlockingOverlayOpen()

  if (shouldLock && !bodyScrollLocked) {
    bodyScrollLockY = window.scrollY || window.pageYOffset || 0
    document.body.style.position = 'fixed'
    document.body.style.top = `-${bodyScrollLockY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    bodyScrollLocked = true
    return
  }

  if (!shouldLock && bodyScrollLocked) {
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.width = ''
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
    window.scrollTo(0, bodyScrollLockY)
    bodyScrollLocked = false
  }
}

function patchTradePanel() {
  const body = document.querySelector<HTMLElement>('.trade-panel-body')
  if (body) {
    body.innerHTML = currentTradePanelContent()
  }
  const total = state.tradePending + state.tradeUnread
  const badge = document.querySelector<HTMLElement>('.trade-panel-badge')
  if (badge) {
    badge.textContent = total ? String(total) : ''
    badge.style.display = total ? '' : 'none'
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    }),
  ])
}

function renderCatalogOnlyNow() {
  const catalog = getCatalog()
  const filteredGames = getFilteredGames()
  const visibleGames = filteredGames.slice(0, state.visibleGameCount)
  const controlSummary = app.querySelector('.control-summary')
  const filters = app.querySelector('.filters')
  const catalogSection = app.querySelector('.catalog-section')
  const viewSummary = app.querySelector('.view-summary')
  const toolbarConsole = app.querySelector<HTMLSelectElement>('#console-filter')
  const toolbarRegion = app.querySelector<HTMLSelectElement>('#region-filter')
  const toolbarSort = app.querySelector<HTMLSelectElement>('#sort-mode')
  const toolbarYear = app.querySelector<HTMLSelectElement>('#year-filter')
  const toolbarReleaseType = app.querySelector<HTMLSelectElement>('#release-type-filter')

  if (!controlSummary || !filters || !catalogSection || !viewSummary) {
    render()
    return
  }

  controlSummary.outerHTML = renderControlSummary(filteredGames.length, visibleGames.length)
  viewSummary.outerHTML = renderViewSummary(filteredGames)
  filters.outerHTML = renderFiltersSection()
  catalogSection.outerHTML = renderCatalogSection(filteredGames, visibleGames)

  syncBackdropWall(visibleGames, catalog)

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

  if (toolbarReleaseType) {
    toolbarReleaseType.value = state.releaseTypeFilter
  }

  if (pendingCatalogScrollRestore !== null) {
    window.scrollTo({ top: pendingCatalogScrollRestore, behavior: 'auto' })
    pendingCatalogScrollRestore = null
  }

  scheduleTradeAvailabilityRefresh(visibleGames)
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
    } else if (target.id === 'hero-search-input') {
      state.heroSearchDraft = target.value
      syncHeroSearchSuggestions()
    } else if (target.id === 'barcode-search') {
      rememberInputFocus(target)
      scheduleBarcodeSearchRender(target.value)
    } else if (target.closest('[data-custom-entry-form]')) {
      updateCustomEntryCoverPreview(target.form)
    }
  })

  app.addEventListener(
    'mouseover',
    (event) => {
      const target = event.target as HTMLElement
      const hoverTarget = target.closest<HTMLElement>('.game-card[data-id], .catalog-rail-card[data-id], .hero-preview-card[data-id], .hero-search-result[data-id]')

      if (!hoverTarget) {
        return
      }

      prewarmDetailCoverForGameId(hoverTarget.dataset.id)
    },
    true,
  )

  app.addEventListener(
    'focusin',
    (event) => {
      const target = event.target as HTMLElement
      const focusTarget = target.closest<HTMLElement>('.game-card[data-id], .catalog-rail-card[data-id], .hero-preview-card[data-id], .hero-search-result[data-id]')

      if (!focusTarget) {
        return
      }

      prewarmDetailCoverForGameId(focusTarget.dataset.id)
    },
    true,
  )

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
        priceSourceUrl: 'https://retrovaultelite.com/custom-entry',
        coverSourceUrl: 'https://retrovaultelite.com/custom-entry',
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

    const gameId = resolveGameId(card.dataset.id) ?? null
    if (gameId) {
      rememberRecentViewedGame(gameId)
    }
    state.selectedGameId = gameId
    render()
  }, { capture: true })

  app.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement

    if (event.key === 'Enter' && target instanceof HTMLInputElement && target.id === 'hero-search-input') {
      event.preventDefault()
      const query = target.value.trim()
      state.heroSearchDraft = query
      state.search = query
      state.consoleFilter = 'All consoles'
      state.regionFilter = 'All regions'
      state.ownershipFilter = 'all'
      state.letterFilter = ''
      resetVisibleGameCount()
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const card = target.closest<HTMLElement>('.game-card[data-id]')

    if (!card || target.closest('.card-actions')) {
      return
    }

    event.preventDefault()
    const gameId = resolveGameId(card.dataset.id) ?? null
    if (gameId) {
      rememberRecentViewedGame(gameId)
    }
    state.selectedGameId = gameId
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

  if (target.id === 'release-type-filter') {
    state.releaseTypeFilter = target.value as ReleaseTypeFilter
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

  if (target.id === 'cover-scan-input' && target instanceof HTMLInputElement) {
    const file = target.files?.[0]

    if (!file) {
      return
    }

    await detectCoverMatchesFromFile(file)
    target.value = ''
    return
  }

  if (target.id === 'catalog-import' && target instanceof HTMLInputElement) {
    await importCatalogFile(target)
  }

  if (target.id === 'collection-import-input' && target instanceof HTMLInputElement) {
    const file = target.files?.[0]
    target.value = ''
    if (file) await processImportFile(file)
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
      const completeInBox = isCompleteEditionStatus(editionStatus)

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
    priceSealed: null,
    priceSourceUrl: 'https://retrovaultelite.com/custom-entry',
    coverSourceUrl: 'https://retrovaultelite.com/custom-entry',
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
    priceSealed: null,
    priceSourceUrl: 'https://retrovaultelite.com/custom-entry',
    coverSourceUrl: 'https://retrovaultelite.com/custom-entry',
    trendDelta: 0,
    rarity: 'Classic',
    releaseType: 'custom',
  } satisfies CatalogEntry
}

function dedupeCatalog(entries: CatalogEntry[]) {
  return [...new Map(entries.map((entry) => [getCatalogDedupeKey(entry), entry])).values()]
}

function getCatalogDedupeKey(entry: CatalogEntry) {
  if (entry.priceSourceUrl.includes('/custom-entry')) {
    return `custom|${normalizeSearchText(entry.id)}`
  }

  if (entry.priceSourceUrl) {
    return `source|${normalizeSearchText(entry.priceSourceUrl)}`
  }

  return [entry.title, entry.console, entry.region, entry.variantLabel ?? '', entry.releaseType ?? '']
    .map(normalizeSearchText)
    .join('|')
}

async function handleAction(element: HTMLElement) {
  const action = element.dataset.action
  const id = resolveGameId(element.dataset.id)

  switch (action) {
    case 'toggle-owned':
      if (!id) {
        return
      }

      state.ownershipPickerGameId = id
      state.selectedGameId = null
      render()
      break
    case 'confirm-remove-owned':
      if (!id) return
      playUnmark()
      setRecord(id, (record) => ({
        ...record,
        status: 'missing',
        ownedCopies: 1,
        variant: '',
        gradedLabel: '',
        appraisedValue: null,
        copies: undefined,
      }))
      if (!hasMeaningfulRecord(getRecord(id))) {
        markGameDeleted(id)
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

      const newCopyIndex = markGameOwned(id, edition)
      if (edition === 'graded') {
        updateGradeStatus(id, newCopyIndex)
      }
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

      const wasWanted = getRecord(id).status === 'wanted'

      if (wasWanted) {
        playUnmark()
      } else {
        playWanted()
      }

      setRecord(id, (record) => ({
        ...record,
        status: record.status === 'wanted' ? 'missing' : 'wanted',
        completeInBox: record.status === 'wanted' ? record.completeInBox : false,
      }))
      if (wasWanted && !hasMeaningfulRecord(getRecord(id))) {
        markGameDeleted(id)
      }

      if (!wasWanted && getTradeAvailabilityCount(id) > 0) {
        void openTradeRequestFlow(id)
      }
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
        editionStatus: !record.completeInBox ? 'cib' : record.editionStatus,
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
      state.coverScanRunning = false
      state.coverScanMatches = []
      state.coverScanStatus = getCoverScanStatusHint()
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
      state.heroSearchDraft = ''
      state.consoleFilter = 'All consoles'
      state.regionFilter = 'All regions'
      state.ownershipFilter = 'all'
      state.letterFilter = ''
      resetVisibleGameCount()
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    case 'submit-hero-search': {
      const heroSearchInput = document.querySelector<HTMLInputElement>('#hero-search-input')
      const query = heroSearchInput?.value.trim() ?? ''
      state.heroSearchDraft = query
      state.search = query
      state.consoleFilter = 'All consoles'
      state.regionFilter = 'All regions'
      state.ownershipFilter = 'all'
      state.letterFilter = ''
      resetVisibleGameCount()
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
    case 'hero-search-fill': {
      const query = element.dataset.query ?? ''
      state.heroSearchDraft = query
      const heroSearchInput = document.querySelector<HTMLInputElement>('#hero-search-input')
      if (heroSearchInput) {
        heroSearchInput.value = query
        heroSearchInput.focus()
      }
      syncHeroSearchSuggestions()
      break
    }
    case 'browse-owned-games':
      state.ownershipFilter = 'owned'
      resetVisibleGameCount()
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    case 'browse-wanted-games':
      state.ownershipFilter = 'wanted'
      resetVisibleGameCount()
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    case 'browse-tradeable-now':
      state.ownershipFilter = 'tradeable-now'
      resetVisibleGameCount()
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    case 'browse-alert-hits':
      state.ownershipFilter = 'wanted-now'
      resetVisibleGameCount()
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    case 'browse-console-library': {
      const consoleName = element.dataset.console

      if (!consoleName) {
        return
      }

      state.consoleFilter = consoleName
      state.regionFilter = 'All regions'
      state.ownershipFilter = 'all'
      state.search = ''
      resetVisibleGameCount()
      await ensureConsoleCatalogLoaded(consoleName)
      render()
      document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
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
      state.coverScanRunning = false
      state.coverScanMatches = []
      state.coverScanStatus = ''
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
    case 'open-cover-match':
      if (!id) {
        return
      }

      stopLiveBarcodeScan()
      state.scannerOpen = false
      state.scannerLiveActive = false
      state.coverScanRunning = false
      state.selectedGameId = id
      render()
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
    case 'set-variant':
      if (!id) {
        return
      }

      updateVariantStatus(id)
      break
    case 'set-grade':
      if (!id) {
        return
      }

      updateGradeStatus(id)
      break
    case 'set-copies':
      if (!id) {
        return
      }

      updateOwnedCopies(id)
      break
    case 'add-copy':
      if (!id) return
      state.ownershipPickerGameId = id
      state.selectedGameId = null
      render()
      break
    case 'remove-copy': {
      if (!id) return
      const copyIdx = parseInt(element.dataset.copyIndex ?? '', 10)
      if (isNaN(copyIdx)) return
      const currentCopies = getRecordCopies(getRecord(id))
      if (currentCopies.length <= 1) {
        playUnmark()
        setRecord(id, (record) => ({ ...record, status: 'missing', ownedCopies: 1, variant: '', gradedLabel: '', appraisedValue: null, copies: undefined, forTrade: false, tradeListedAt: null }))
        if (!hasMeaningfulRecord(getRecord(id))) {
          markGameDeleted(id)
        }
      } else {
        setRecord(id, (record) => {
          const copies = getRecordCopies(record)
          const next = copies.filter((_, i) => i !== copyIdx)
          const best = bestCopyEdition(next)
          const nextForTrade = next.some((c) => c.forTrade)
          return {
            ...record,
            copies: next,
            ownedCopies: next.length,
            editionStatus: best,
            completeInBox: isCompleteEditionStatus(best),
            condition: next[0].condition,
            variant: normalizeVariantLabel(next[0].variant),
            gradedLabel: typeof next[0].gradedLabel === 'string' ? next[0].gradedLabel.trim() : '',
            appraisedValue: typeof next[0].appraisedValue === 'number' ? next[0].appraisedValue : null,
            pricePaid: next[0].pricePaid,
            forTrade: nextForTrade,
            tradeListedAt: nextForTrade ? record.tradeListedAt ?? new Date().toISOString() : null,
          }
        })
      }
      break
    }
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
    case 'set-date-acquired':
      if (!id) {
        return
      }

      updateDateAcquired(id)
      break
    case 'set-acquired-from':
      if (!id) {
        return
      }

      updateAcquiredFrom(id)
      break
    case 'open-details':
      if (!id) {
        return
      }

      rememberRecentViewedGame(id)
      state.selectedGameId = id
      state.ownershipConfirmId = null
      render()
      void fetchTradeAvailabilityForGames([id])
      void fetchTradeWantedDemandForGames([id])
      break
    case 'close-details':
      state.selectedGameId = null
      state.ownershipConfirmId = null
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
      if (filter === 'tradeable-now' && state.sortMode === 'title') {
        state.sortMode = 'trade-recent'
      }
      resetVisibleGameCount()
      renderCatalogOnly()
      if (filter === 'tradeable-now' || filter === 'wanted-now') {
        void ensureTradeNowFilterData(filter).then(() => {
          renderCatalogOnly()
        })
      }
      break
    }
    case 'view-grid':
      state.viewMode = 'grid'
      renderCatalogOnly()
      break
    case 'view-shelf':
      state.viewMode = 'shelf'
      renderCatalogOnly()
      break
    case 'set-letter-filter':
      state.letterFilter = element.dataset.letter ?? ''
      state.visibleGameCount = getInitialVisibleGameCount()
      renderCatalogOnly()
      break
    case 'trade-open-inbox': {
      state.tradeAvailabilityOwnersGameId = null
      state.tradeAvailabilityOwners = []
      state.tradeAvailabilityOwnersLoading = false
      state.tradeView = true
      state.tradeThreadId = null
      state.tradeThread = null
      state.tradeSendError = ''
      state.tradeInboxError = ''
      state.tradeMatches = []
      state.tradeInboxOpportunities = []
      state.tradeInboxCollectors = []
      state.tradeInboxFreshOpportunityIds = new Set()
      render()
      if (state.authToken) {
        state.tradeInboxLoading = true
        patchTradePanel()
        try {
          const inboxResult = await withTimeout(
            getTradeRequests(state.authToken),
            8000,
            'Trade Inbox took too long to load. Please try again.',
          )
          state.tradeRequests = inboxResult.requests
          state.tradeUnread = inboxResult.unreadCount
          state.tradePending = inboxResult.pendingCount ?? 0
        } catch (error) {
          state.tradeRequests = []
          state.tradeUnread = 0
          state.tradePending = 0
          state.tradeInboxError = error instanceof Error ? error.message : 'Trade Inbox could not load.'
        } finally {
          state.tradeInboxLoading = false
          patchTradePanel()
        }

        const [matchResult, discoveryResult] = await Promise.allSettled([
          withTimeout(
            getTradeMatches(state.authToken),
            8000,
            'Trade matches took too long to load.',
          ),
          withTimeout(
            getTradeInboxDiscovery(state.authToken),
            8000,
            'Trade opportunities took too long to load.',
          ),
        ])

        state.tradeMatches = matchResult.status === 'fulfilled' ? matchResult.value.matches : []
        state.tradeInboxOpportunities =
          discoveryResult.status === 'fulfilled' ? discoveryResult.value.opportunities : []
        state.tradeInboxCollectors =
          discoveryResult.status === 'fulfilled' ? discoveryResult.value.collectors : []
        const seenOpportunityIds = loadSeenTradeOpportunityIds()
        const loadedOpportunityIds = state.tradeInboxOpportunities.map((opportunity) => opportunity.gameId)
        state.tradeInboxFreshOpportunityIds = new Set(loadedOpportunityIds.filter((gameId) => !seenOpportunityIds.has(gameId)))
        saveSeenTradeOpportunityIds([...seenOpportunityIds, ...loadedOpportunityIds])
        void fetchTradeWantedDemandForGames([
          ...state.tradeRequests.map((request) => request.gameId),
          ...state.tradeInboxOpportunities.map((opportunity) => opportunity.gameId),
          ...state.tradeInboxCollectors.map((collector) => collector.featuredGameId),
        ])
        patchTradePanel()
      }
      break
    }
    case 'trade-close':
      state.tradeView = false
      state.tradeInboxFreshOpportunityIds = new Set()
      state.tradeThreadId = null
      state.tradeThread = null
      state.tradeAvailabilityOwnersGameId = null
      state.tradeAvailabilityOwners = []
      state.tradeAvailabilityOwnersLoading = false
      state.tradeInterestGameId = null
      state.tradeInterestUserId = null
      state.tradeProfileUserId = null
      state.tradeProfile = null
      state.tradeSendError = ''
      render()
      break
    case 'trade-back-to-inbox':
      state.tradeThreadId = null
      state.tradeThread = null
      state.tradeProfileUserId = null
      state.tradeProfile = null
      state.tradeSendError = ''
      patchTradePanel()
      break
    case 'trade-view-profile': {
      const userId = element.dataset.userId ?? ''
      if (!userId || !state.authToken) break
      state.tradeProfileUserId = userId
      state.tradeProfile = null
      state.tradeProfileLoading = true
      patchTradePanel()
      try {
        const profile = await getTradeProfile(state.authToken, userId)
        state.tradeProfile = profile
        void fetchTradeWantedDemandForGames(profile.forTradeGameIds)
      } catch {
        state.tradeProfile = null
      } finally {
        state.tradeProfileLoading = false
        patchTradePanel()
      }
      break
    }
    case 'trade-accept':
    case 'trade-decline': {
      if (!id || !state.authToken) break
      const newStatus = action === 'trade-accept' ? 'accepted' : 'declined'
      try {
        const result = await respondToTradeRequest(state.authToken, id, newStatus)
        state.tradeRequests = state.tradeRequests
          .map((r) => r.id === id ? result.tradeRequest : r)
          .filter((request) => !(request.status === 'declined' && request.isIncoming))
        render()
      } catch (err) {
        state.tradeSendError = err instanceof Error ? err.message : 'Could not update trade request.'
        render()
      }
      break
    }
    case 'trade-open-thread': {
      if (!id || !state.authToken) break
      state.tradeThreadId = id
      state.tradeThread = null
      state.tradeSendError = ''
      render()
      state.tradeThreadLoading = true
      try {
        const result = await getTradeMessages(state.authToken, id)
        state.tradeThread = result
        void fetchTradeWantedDemandForGames([result.tradeRequest.gameId])
        state.tradeRequests = state.tradeRequests.map((request) =>
          request.id === id ? { ...request, unreadCount: result.tradeRequest.unreadCount } : request,
        )
        state.tradeUnread = state.tradeRequests.reduce((total, request) => total + (request.unreadCount ?? 0), 0)
      } catch {
        state.tradeSendError = 'Could not load messages.'
      } finally {
        state.tradeThreadLoading = false
        render()
      }
      break
    }
    case 'trade-send-message': {
      if (!id || !state.authToken) break
      const textarea = document.querySelector<HTMLTextAreaElement>('#trade-msg-input')
      const text = textarea?.value.trim() ?? ''
      if (!text) break
      state.tradeSendError = ''
      try {
        const result = await sendTradeMessage(state.authToken, id, text)
        if (state.tradeThread) {
          state.tradeThread = { ...state.tradeThread, messages: [...state.tradeThread.messages, result.message] }
        }
        if (textarea) textarea.value = ''
        render()
      } catch (err) {
        state.tradeSendError = err instanceof Error ? err.message : 'Could not send message.'
        render()
      }
      break
    }
    case 'trade-delete-message': {
      const messageId = element.dataset.messageId ?? ''
      if (!id || !messageId || !state.authToken) break
      try {
        await deleteTradeMessage(state.authToken, id, messageId)
        if (state.tradeThread) {
          state.tradeThread = {
            ...state.tradeThread,
            messages: state.tradeThread.messages.filter((m) => m.id !== messageId),
          }
        }
        render()
      } catch (err) {
        state.tradeSendError = err instanceof Error ? err.message : 'Could not delete message.'
        render()
      }
      break
    }
    case 'trade-delete-request': {
      if (!id || !state.authToken) break
      const confirmed = window.confirm('Delete this trade request and its messages?')
      if (!confirmed) break
      try {
        await deleteTradeRequest(state.authToken, id)
        state.tradeRequests = state.tradeRequests.filter((request) => request.id !== id)
        state.tradeUnread = state.tradeRequests.reduce((total, request) => total + (request.unreadCount ?? 0), 0)
        state.tradePending = state.tradeRequests.filter((request) => request.isIncoming && request.status === 'pending').length
        if (state.tradeThreadId === id) {
          state.tradeThreadId = null
          state.tradeThread = null
        }
        render()
      } catch (err) {
        state.tradeSendError = err instanceof Error ? err.message : 'Could not delete trade request.'
        render()
      }
      break
    }
    case 'trade-interest-select': {
      const gameId = element.dataset.gameId ?? ''
      const userId = element.dataset.userId ?? ''
      if (!gameId || !userId) break
      state.tradeInterestGameId = gameId
      state.tradeInterestUserId = userId
      state.tradeProfileUserId = null
      state.tradeProfile = null
      state.tradeSendError = ''
      patchTradePanel()
      break
    }
    case 'trade-interest-cancel':
      state.tradeInterestGameId = state.tradeAvailabilityOwnersGameId
      state.tradeInterestUserId = null
      state.tradeSendError = ''
      render()
      break
    case 'toggle-hide-archived-trades': {
      const input = element as HTMLInputElement
      saveHideArchivedTrades(input.checked)
      patchTradePanel()
      break
    }
    case 'show-archived-trades':
      saveHideArchivedTrades(false)
      patchTradePanel()
      break
    case 'open-trade-request':
      if (!id) {
        return
      }

      void openTradeRequestFlow(id)
      break
    case 'trade-request-close':
      state.tradeAvailabilityOwnersGameId = null
      state.tradeAvailabilityOwners = []
      state.tradeAvailabilityOwnersLoading = false
      state.tradeInterestGameId = null
      state.tradeInterestUserId = null
      state.tradeSendError = ''
      render()
      break
    case 'toggle-for-trade':
      if (!id) break
      {
        const record = getRecord(id)
        const copies = getRecordCopies(record)
        if (!record.forTrade && copies.length > 1) {
          state.tradePromptGameId = id
          state.tradePromptIsDuplicate = true
          state.tradePromptPickingCopy = true
          render()
          break
        }
        setRecord(id, (nextRecord) => updateTradeListingState(nextRecord, !(nextRecord.forTrade ?? false)))
      }
      break
    case 'trade-prompt-yes':
      if (!id) break
      if (pendingTradePromptTimeout) {
        window.clearTimeout(pendingTradePromptTimeout)
        pendingTradePromptTimeout = 0
      }
      if (state.tradePromptIsDuplicate) {
        state.tradePromptPickingCopy = true
        render()
      } else {
        state.tradePromptGameId = null
        state.tradePromptIsDuplicate = false
        state.tradePromptPickingCopy = false
        setRecord(id, (record) => updateTradeListingState(record, true))
      }
      break
    case 'trade-prompt-pick-copy': {
      if (!id) break
      if (pendingTradePromptTimeout) {
        window.clearTimeout(pendingTradePromptTimeout)
        pendingTradePromptTimeout = 0
      }
      const copyIdx = parseInt(element.dataset.copyIndex ?? '', 10)
      state.tradePromptGameId = null
      state.tradePromptIsDuplicate = false
      state.tradePromptPickingCopy = false
      setRecord(id, (record) => {
        const copies = getRecordCopies(record)
        if (!isNaN(copyIdx) && copies[copyIdx]) {
          const updated = copies.map((c, i) => ({ ...c, forTrade: i === copyIdx }))
          return {
            ...record,
            copies: updated,
            forTrade: true,
            tradeListedAt: record.tradeListedAt ?? new Date().toISOString(),
          }
        }
        return updateTradeListingState(record, true)
      })
      break
    }
    case 'trade-prompt-no':
      if (pendingTradePromptTimeout) {
        window.clearTimeout(pendingTradePromptTimeout)
        pendingTradePromptTimeout = 0
      }
      state.tradePromptGameId = null
      state.tradePromptIsDuplicate = false
      state.tradePromptPickingCopy = false
      render()
      break
    case 'trade-send-request': {
      if (!state.tradeInterestGameId || !state.tradeInterestUserId || !state.authToken) break
      const noteEl = document.querySelector<HTMLTextAreaElement>('#trade-note-input')
      const note = noteEl?.value.trim() ?? ''
      state.tradeSendError = ''
      try {
        const result = await createTradeRequest(state.authToken, state.tradeInterestUserId, state.tradeInterestGameId, note)
        state.tradeRequests = [result.tradeRequest, ...state.tradeRequests]
        state.tradeAvailabilityOwnersGameId = null
        state.tradeAvailabilityOwners = []
        state.tradeAvailabilityOwnersLoading = false
        state.tradeInterestGameId = null
        state.tradeInterestUserId = null
        render()
      } catch (err) {
        state.tradeSendError = err instanceof Error ? err.message : 'Could not send trade request.'
        render()
      }
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
      state.releaseTypeFilter = 'All release types'
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
    case 'import-collection':
      document.querySelector<HTMLInputElement>('#collection-import-input')?.click()
      break
    case 'close-import-modal':
      state.importStep = 'none'
      state.importRows = []
      render()
      break
    case 'import-toggle-all': {
      const allOn = state.importRows.filter((r) => r.game).every((r) => r.include)
      state.importRows = state.importRows.map((r) => ({ ...r, include: r.game ? !allOn : false }))
      render()
      break
    }
    case 'import-toggle-row': {
      const idx = parseInt(element.dataset.index ?? '', 10)
      if (!isNaN(idx) && state.importRows[idx]) {
        state.importRows = state.importRows.map((r, i) => i === idx ? { ...r, include: !r.include } : r)
        render()
      }
      break
    }
    case 'execute-import':
      executeImport()
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

  if (hasMeaningfulRecord(nextRecord)) {
    clearDeletedGameId(id)
    if (decodedAlias !== id) {
      clearDeletedGameId(decodedAlias)
    }
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
  const completeInBox = isCompleteEditionStatus(editionStatus)
  const existing = getRecord(id)
  const isAddingDuplicate = existing.status === 'owned'
  const newCopyIndex = isAddingDuplicate ? getRecordCopies(existing).length : 0

  playItemGet()
  if (pendingTradePromptTimeout) {
    window.clearTimeout(pendingTradePromptTimeout)
    pendingTradePromptTimeout = 0
  }
  state.tradePromptGameId = null
  state.tradePromptIsDuplicate = false
  state.tradePromptPickingCopy = false
  state.ownershipPickerGameId = null
  state.justOwnedGameId = id

  setRecord(id, (record) => {
    const newCopy: GameCopy = {
      edition: editionStatus,
      condition: 'good',
      variant: '',
      gradedLabel: '',
      appraisedValue: null,
      pricePaid: null,
      forTrade: false,
    }
    if (isAddingDuplicate) {
      const existingCopies = getRecordCopies(record)
      const allCopies = [...existingCopies, newCopy]
      const best = bestCopyEdition(allCopies)
      return {
        ...record,
        status: 'owned',
        copies: allCopies,
        ownedCopies: allCopies.length,
        editionStatus: best,
        completeInBox: isCompleteEditionStatus(best),
      }
    }
    return {
      ...record,
      status: 'owned',
      editionStatus,
      completeInBox,
      ownedCopies: 1,
      copies: [newCopy],
    }
  })

  pendingTradePromptTimeout = window.setTimeout(() => {
    pendingTradePromptTimeout = 0
    if (state.justOwnedGameId === id) {
      state.justOwnedGameId = null
      let needsRender = false
      if (state.authToken) {
        if (isAddingDuplicate) {
          state.tradePromptGameId = id
          state.tradePromptIsDuplicate = true
          state.tradePromptPickingCopy = false
          needsRender = true
        } else if (!getRecord(id).forTrade) {
          const hasWanted = Object.values(state.library).some((r) => (r as GameRecord).status === 'wanted')
          if (hasWanted) {
            state.tradePromptGameId = id
            state.tradePromptIsDuplicate = false
            needsRender = true
          }
        }
      }
      if (needsRender) {
        render()
      }
    }
  }, 1300)

  return newCopyIndex
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
    window.alert('Please enter one of: loose, boxed, manual, box-only, manual-only, box-manual, cib, sealed, graded.')
    return
  }

  setRecord(id, (record) => ({
    ...record,
    editionStatus: next,
    completeInBox: isCompleteEditionStatus(next),
  }))

  if (next === 'graded') {
    updateGradeStatus(id)
  }
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

function updateVariantStatus(id: string) {
  const current = getRecord(id)
  const target = chooseVariantTarget(current)

  if (!target) {
    return
  }

  const suggestionText = variantSuggestions.join(', ')
  const response = window.prompt(
    `Set variant label. Examples: ${suggestionText}. Leave blank to clear it.`,
    target.existingVariant,
  )

  if (response === null) {
    return
  }

  const nextVariant = normalizeVariantLabel(response)

  setRecord(id, (record) => {
    if (target.copyIndex === null || !record.copies?.length || !record.copies[target.copyIndex]) {
      return {
        ...record,
        variant: nextVariant,
      }
    }

    const updatedCopies = record.copies.map((copy, index) =>
      index === target.copyIndex ? { ...copy, variant: nextVariant } : copy,
    )

    const primaryVariant = normalizeVariantLabel(updatedCopies[0]?.variant)

    return {
      ...record,
      copies: updatedCopies,
      variant: primaryVariant,
    }
  })
}

function updateGradeStatus(id: string, preferredCopyIndex?: number | null) {
  const current = getRecord(id)
  const hasEligibleCopy =
    typeof preferredCopyIndex === 'number' ||
    current.editionStatus === 'graded' ||
    getRecordCopies(current).some((copy) => copy.edition === 'graded')

  if (!hasEligibleCopy) {
    window.alert('Set a copy to graded first, then add the grade and appraised value.')
    return
  }

  const target =
    typeof preferredCopyIndex === 'number'
      ? {
          copyIndex: preferredCopyIndex,
          existingLabel: getRecordCopies(current)[preferredCopyIndex]?.gradedLabel?.trim() ?? '',
          existingValue: typeof getRecordCopies(current)[preferredCopyIndex]?.appraisedValue === 'number'
            ? getRecordCopies(current)[preferredCopyIndex].appraisedValue
            : null,
        }
      : chooseGradeTarget(current)

  if (!target) {
    return
  }

  const labelResponse = window.prompt(
    'Enter the graded label, like WATA 9.4 A+, VGA 85, or CGC 9.6. Leave blank to clear it.',
    target.existingLabel,
  )

  if (labelResponse === null) {
    return
  }

  const nextLabel = labelResponse.trim().slice(0, 80)
  const selectedCurrency = getSelectedCurrency()
  const currentValue = typeof target.existingValue === 'number' ? convertUsdAmount(target.existingValue).toFixed(2) : ''
  const valueResponse = window.prompt(
    `Enter the appraised value in ${selectedCurrency.code}. Leave blank to clear it.`,
    currentValue,
  )

  if (valueResponse === null) {
    return
  }

  const trimmedValue = valueResponse.trim()
  const nextAppraisedValue =
    trimmedValue === ''
      ? null
      : Number.isNaN(Number(trimmedValue)) || Number(trimmedValue) < 0
        ? NaN
        : (selectedCurrency.code === 'USD'
            ? Number(trimmedValue)
            : (Number(trimmedValue) / selectedCurrency.perEuro) * currencyOptions[0].perEuro)

  if (Number.isNaN(nextAppraisedValue)) {
    window.alert('Please enter a valid positive appraised value.')
    return
  }

  setRecord(id, (record) => {
    if (target.copyIndex === null || !record.copies?.length || !record.copies[target.copyIndex]) {
      return {
        ...record,
        gradedLabel: nextLabel,
        appraisedValue: nextAppraisedValue,
      }
    }

    const updatedCopies = record.copies.map((copy, index) =>
      index === target.copyIndex
        ? { ...copy, gradedLabel: nextLabel, appraisedValue: nextAppraisedValue }
        : copy,
    )

    const primaryGradedLabel = typeof updatedCopies[0]?.gradedLabel === 'string' ? updatedCopies[0].gradedLabel.trim() : ''
    const primaryAppraisedValue = typeof updatedCopies[0]?.appraisedValue === 'number' ? updatedCopies[0].appraisedValue : null

    return {
      ...record,
      copies: updatedCopies,
      gradedLabel: primaryGradedLabel,
      appraisedValue: primaryAppraisedValue,
    }
  })
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

function updateDateAcquired(id: string) {
  const current = getRecord(id)
  const response = window.prompt(
    'When did you find this? Enter any date format (e.g. 15 March 2024, April 2024, or 2024-03-15). Leave blank to clear.',
    current.dateAcquired ?? '',
  )

  if (response === null) {
    return
  }

  setRecord(id, (record) => ({
    ...record,
    dateAcquired: response.trim() || null,
  }))
}

function updateAcquiredFrom(id: string) {
  const current = getRecord(id)
  const response = window.prompt(
    'Where did you find this? e.g. eBay, flea market, trade, game store, gift, convention. Leave blank to clear.',
    current.acquiredFrom,
  )

  if (response === null) {
    return
  }

  setRecord(id, (record) => ({
    ...record,
    acquiredFrom: response.trim().slice(0, 80),
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
      state.accountHydrationPending = false
      state.syncStatus = 'Your collection is synced to your account'
      state.authView = 'none'
      void fetchTradeNotifications()
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
      state.accountHydrationPending = false
      state.syncStatus = 'Your collection is synced to your account'
      state.authSuccess = 'Signed in successfully.'
      state.authView = 'none'
      void fetchTradeNotifications()
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
      state.accountHydrationPending = false
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
  const response = window.prompt('Enter a barcode number, or a game reference ID like CAP-XR or HVC-KI.')

  if (!response) {
    return
  }

  const trimmed = response.trim()

  // Try direct vault ID match (e.g. "famicom-rockman-2")
  const gameById = getGameById(trimmed)

  if (gameById) {
    stopLiveBarcodeScan()
    state.scannerOpen = false
    state.scannerLiveActive = false
    state.barcodeLinkCode = null
    state.barcodeSearch = ''
    state.selectedGameId = gameById.id
    render()
    return
  }

  // Try reference code match — strip hyphens/spaces for comparison (e.g. "CAP-XR" → "CAPXR")
  const normalizedInput = normalizeBarcodeValue(trimmed).toUpperCase()
  const gameByRef = getCatalog().find((game) => {
    const ref = getGameReference(game)
    return ref?.productId ? normalizeBarcodeValue(ref.productId).toUpperCase() === normalizedInput : false
  })

  if (gameByRef) {
    stopLiveBarcodeScan()
    state.scannerOpen = false
    state.scannerLiveActive = false
    state.barcodeLinkCode = null
    state.barcodeSearch = ''
    state.selectedGameId = gameByRef.id
    render()
    return
  }

  await handleBarcodeDetected(normalizeBarcodeValue(trimmed))
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

    const result = await (await getBarcodeReader()).decodeFromImageElement(image)
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

async function detectCoverMatchesFromFile(file: File) {
  const scope = getCoverScanScopeGames()

  if (scope.error) {
    state.coverScanRunning = false
    state.coverScanMatches = []
    state.coverScanStatus = scope.error
    render()
    return
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    state.coverScanRunning = true
    state.coverScanMatches = []
    state.coverScanStatus = `Reading your cover photo and checking ${scope.games.length.toLocaleString()} possible matches...`
    render()

    const scanImage = await loadImageFromUrl(objectUrl)
    const scanHash = computeImageDHash(scanImage)
    const matches: CoverMatchSuggestion[] = []

    for (let index = 0; index < scope.games.length; index += 6) {
      const batch = scope.games.slice(index, index + 6)
      const hashes = await Promise.all(batch.map((game) => getGameCoverHash(game)))

      for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
        const hash = hashes[batchIndex]

        if (!hash) {
          continue
        }

        matches.push({
          gameId: batch[batchIndex].id,
          distance: getHammingDistance(scanHash, hash),
        })
      }

      if (index === 0 || (index + batch.length) % 48 === 0 || index + batch.length >= scope.games.length) {
        state.coverScanStatus = `Checking cover matches... ${Math.min(index + batch.length, scope.games.length).toLocaleString()} / ${scope.games.length.toLocaleString()}`
        render()
      }

      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }

    const topMatches = matches
      .filter((match) => Number.isFinite(match.distance))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 6)

    state.coverScanRunning = false
    state.coverScanMatches = topMatches
    state.coverScanStatus = topMatches.length
      ? 'Likely cover matches ready. Pick the right game below.'
      : 'No strong cover matches yet. Try a straighter photo or narrow the console scope first.'
    render()
  } catch (error) {
    state.coverScanRunning = false
    state.coverScanMatches = []
    state.coverScanStatus =
      error instanceof Error ? error.message : 'That cover photo could not be matched. Try another photo.'
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
      variant: normalizeVariantLabel(record.variant),
      gradedLabel: typeof record.gradedLabel === 'string' ? record.gradedLabel.trim() : '',
      appraisedValue: typeof record.appraisedValue === 'number' ? record.appraisedValue : null,
      targetPrice: record.targetPrice,
      notes: record.notes,
      dateAcquired: record.dateAcquired,
      acquiredFrom: record.acquiredFrom,
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

function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => void r.unregister())
  })
}

async function loadGeneratedCatalog() {
  const cachedSnapshotPromise = readCatalogSnapshot()
  try {
    const metaPromise = fetch('/catalogs/retro-catalog-meta.json')
    const startupPromise = fetch('/catalogs/retro-catalog-startup.json')
    const hydrateFullCatalog = async (parsedMeta: CatalogConsoleMeta[]) => {
      try {
        const liteResponse = await fetch('/catalogs/retro-catalog-lite.json')

        if (!liteResponse.ok) {
          throw new Error(`Catalog request failed: ${liteResponse.status}`)
        }

        const liteText = await liteResponse.text()
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        const parsedLite = liteText ? JSON.parse(liteText) as unknown : []
        const liteCatalog = Array.isArray(parsedLite)
          ? parsedLite.map(normalizeCatalogEntry).filter(isCatalogEntry)
          : normalizePackedLiteCatalog(parsedLite)

        if (!liteCatalog.length) {
          return
        }

        state.generatedCatalog = dedupeCatalog(liteCatalog)
        state.loadedConsoles = [...new Set(parsedMeta.map((entry) => entry.console))]
        state.catalogLoadError = false
        invalidateCatalogCache()
        scheduleCatalogSnapshotSave()
        requestBackgroundCatalogRefresh()
      } catch {
        state.catalogLoadError = true
        requestBackgroundCatalogRefresh()
      }
    }

    const startupResponse = await startupPromise

    if (startupResponse?.ok) {
      const startupText = await startupResponse.text()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const parsedStartup = startupText ? JSON.parse(startupText) as unknown : []
      const startupCatalog = Array.isArray(parsedStartup)
        ? parsedStartup.map(normalizeCatalogEntry).filter(isCatalogEntry)
        : normalizePackedLiteCatalog(parsedStartup)

      if (startupCatalog.length && !state.generatedCatalog.length) {
        state.generatedCatalog = dedupeCatalog(startupCatalog)
        state.loadedConsoles = [...new Set(state.generatedCatalog.map((entry) => entry.console))]
        state.catalogLoadError = false
        state.isCatalogLoading = false
        invalidateCatalogCache()
        render()
      }
    }

    const cachedSnapshot = await cachedSnapshotPromise
    const hasCompleteCachedCatalog =
      Boolean(cachedSnapshot?.generatedCatalog.length) &&
      Boolean(cachedSnapshot?.catalogMeta.length) &&
      (cachedSnapshot?.loadedConsoles.length ?? 0) >= (cachedSnapshot?.catalogMeta.length ?? 0)

    if (cachedSnapshot && hasCompleteCachedCatalog) {
      state.generatedCatalog = cachedSnapshot.generatedCatalog
      state.catalogMeta = cachedSnapshot.catalogMeta
      state.loadedConsoles = cachedSnapshot.loadedConsoles
      state.catalogLoadError = false
      state.isCatalogLoading = false
      invalidateCatalogCache()
      render()
    }

    const metaResponse = await metaPromise

    if (!metaResponse.ok) {
      throw new Error(`Catalog request failed: ${metaResponse.status}`)
    }

    const metaText = await metaResponse.text()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const parsed = JSON.parse(metaText) as unknown

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { consoles?: unknown }).consoles)) {
      throw new Error('Catalog metadata payload was invalid.')
    }

    state.catalogTotalGames =
      typeof (parsed as { totalGames?: unknown }).totalGames === 'number'
        ? (parsed as { totalGames: number }).totalGames
        : state.catalogTotalGames

    const parsedMeta = ((parsed as { consoles: unknown[] }).consoles as unknown[])
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

    const nextMetaSignature = getCatalogMetaSignature(parsedMeta)
    state.catalogTotalConsoles = parsedMeta.length || state.catalogTotalConsoles
    const hasCompleteWarmCatalog =
      Boolean(cachedSnapshot?.generatedCatalog.length) &&
      cachedSnapshot?.metaSignature === nextMetaSignature &&
      parsedMeta.every((entry) => cachedSnapshot.loadedConsoles.includes(entry.console))

    state.catalogMeta = parsedMeta

    if (hasCompleteWarmCatalog) {
      state.generatedCatalog = cachedSnapshot?.generatedCatalog ?? state.generatedCatalog
      state.loadedConsoles = cachedSnapshot?.loadedConsoles ?? state.loadedConsoles
      invalidateCatalogCache()
    } else if (cachedSnapshot?.generatedCatalog.length) {
      state.generatedCatalog = cachedSnapshot?.generatedCatalog ?? []
      state.loadedConsoles = cachedSnapshot?.loadedConsoles ?? []
      invalidateCatalogCache()
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
          void hydrateFullCatalog(parsedMeta)
        })
      } else {
        setTimeout(() => {
          void hydrateFullCatalog(parsedMeta)
        }, 600)
      }
    } else {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
          void hydrateFullCatalog(parsedMeta)
        })
      } else {
        setTimeout(() => {
          void hydrateFullCatalog(parsedMeta)
        }, 600)
      }
    }

    state.catalogLoadError = false
    scheduleCatalogSnapshotSave()
  } catch {
    state.generatedCatalog = []
    state.catalogMeta = []
    state.loadedConsoles = []
    state.catalogLoadError = true
  } finally {
    state.isCatalogLoading = false
    renderCatalogOnly()
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

const POPULAR_CONSOLE_ORDER = [
  'NES', 'Super Nintendo', 'Game Boy', 'Sega Genesis',
  'Game Boy Advance', 'Nintendo 64', 'PlayStation', 'PlayStation 2',
  'Game Boy Color', 'Dreamcast', 'Nintendo DS', 'Sega Saturn',
  'Atari 2600', 'Sega Master System', 'PSP', 'GameCube',
]

const FEATURED_SYSTEMS = [
  { label: 'NES', consoleName: 'NES' },
  { label: 'SNES', consoleName: 'Super Nintendo' },
  { label: 'N64', consoleName: 'Nintendo 64' },
  { label: 'Game Boy', consoleName: 'Game Boy' },
  { label: 'Mega Drive', consoleName: 'Sega Genesis' },
  { label: 'PS1', consoleName: 'PlayStation' },
  { label: 'PS2', consoleName: 'PlayStation 2' },
  { label: 'GameCube', consoleName: 'GameCube' },
] as const

async function ensureAllConsoleCatalogsLoaded(rerenderAfterBatch: boolean) {
  const remaining = state.catalogMeta
    .map((entry) => entry.console)
    .filter((consoleName) => !state.loadedConsoles.includes(consoleName))

  remaining.sort((a, b) => {
    const ai = POPULAR_CONSOLE_ORDER.indexOf(a)
    const bi = POPULAR_CONSOLE_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return 0
  })

  await ensureConsoleBatchLoaded(remaining, rerenderAfterBatch)
}

async function ensureConsoleBatchLoaded(consoleNames: string[], rerenderAfterBatch: boolean) {
  const batchSize = 4

  for (let index = 0; index < consoleNames.length; index += batchSize) {
    const batch = consoleNames.slice(index, index + batchSize)
    await Promise.all(batch.map((consoleName) => ensureConsoleCatalogLoaded(consoleName, false)))

    if (rerenderAfterBatch) {
      renderCatalogOnly()
    }

    await new Promise((resolve) => window.setTimeout(resolve, 0))
  }
}

async function ensureConsoleCatalogLoaded(consoleName: string, rerenderAfterLoad = true) {
  if (!state.catalogMeta.length) {
    return
  }

  if (consoleName === 'All consoles' || consoleName === LEGENDS_FILTER) {
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
    scheduleCatalogSnapshotSave()
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
window.addEventListener('pagehide', flushCatalogSnapshotSave)
window.addEventListener('pagehide', stopLiveBarcodeScan)
window.addEventListener('pagehide', stopTradeNotificationPoll)

render()
scheduleStartupVisualSettle()

// Back-to-top button — lives outside #app so it survives innerHTML replacement
const backToTopEl = document.createElement('button')
backToTopEl.className = 'back-to-top-btn'
backToTopEl.setAttribute('type', 'button')
backToTopEl.setAttribute('aria-label', 'Back to top')
backToTopEl.innerHTML = '<span class="back-to-top-label">back to top</span>&#8679;'
document.body.appendChild(backToTopEl)
backToTopEl.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
window.addEventListener('scroll', () => {
  backToTopEl.classList.toggle('is-visible', window.scrollY > 400)
}, { passive: true })

void loadGeneratedCatalog()   // static files — different server, start immediately
scheduleDeferredStartupWork()

window.requestAnimationFrame(() => {
  void ensurePublicCommunityStatsLoaded()
})

// Defer page view tracking so the page paints before hitting Render (which may be cold-starting)
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => {
    void trackPageView(Boolean(loadAuthToken()))
  })
} else {
  setTimeout(() => {
    void trackPageView(Boolean(loadAuthToken()))
  }, 1200)
}

if (state.authToken) {
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      void hydrateAccount()
    }, 80)
  })
}



