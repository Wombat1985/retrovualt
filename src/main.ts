import './style.css'
import { priceSnapshotDate, sampleCatalog, type CatalogEntry, type RarityTier } from './data'
import { appConfig } from './appConfig'
import { getCurrentAccount, loginAccount, logoutAccount, pushSyncState, registerAccount, saveBarcodeMapping } from './backend'
import { initMobileBannerAd } from './mobileAds'

type OwnershipFilter = 'all' | 'owned' | 'wanted' | 'missing'
type SortMode = 'title' | 'year' | 'loose-high' | 'complete-high' | 'trend-high' | 'shelf-score'
type GameStatus = 'missing' | 'wanted' | 'owned'
type EditionStatus = 'loose' | 'boxed' | 'manual' | 'cib' | 'sealed' | 'graded'
type ConditionRating = 'mint' | 'excellent' | 'good' | 'fair'
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type GameRecord = {
  status: GameStatus
  completeInBox: boolean
  pricePaid: number | null
  favorite: boolean
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

type CollectorAchievement = {
  title: string
  detail: string
  tone: 'gold' | 'teal' | 'crimson'
}

type CatalogConsoleMeta = {
  console: string
  slug: string
  count: number
  file: string
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>
}

const LIBRARY_STORAGE_KEY = 'retro-game-collector-library'
const CUSTOM_STORAGE_KEY = 'retro-game-collector-custom-catalog'
const CURRENCY_STORAGE_KEY = 'retro-game-collector-currency'
const AUTH_TOKEN_STORAGE_KEY = 'retro-game-collector-auth-token'
const BARCODE_STORAGE_KEY = 'retro-game-collector-barcode-mappings'
const appElement = document.querySelector<HTMLDivElement>('#app')

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
  consoleFilter: 'Super Nintendo',
  ownershipFilter: 'all' as OwnershipFilter,
  sortMode: 'title' as SortMode,
  currencyCode: loadCurrencyCode(),
  authToken: loadAuthToken(),
  accountEmail: '',
  syncStatus: 'Saved on this device' as string,
  library: loadLibrary(),
  generatedCatalog: [] as CatalogEntry[],
  catalogMeta: [] as CatalogConsoleMeta[],
  loadedConsoles: [] as string[],
  customCatalog: loadCustomCatalog(),
  barcodeMappings: loadBarcodeMappings(),
  selectedGameId: null as string | null,
  scannerOpen: false,
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
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library))
  scheduleCloudSync()
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

function clearAuthToken() {
  state.authToken = ''
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
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

  if (
    typeof entry.id !== 'string' ||
    typeof entry.title !== 'string' ||
    typeof entry.console !== 'string' ||
    (typeof entry.year !== 'number' && entry.year !== null) ||
    typeof entry.region !== 'string' ||
    typeof entry.coverUrl !== 'string' ||
    typeof entry.priceLoose !== 'number' ||
    (typeof entry.priceComplete !== 'number' && entry.priceComplete !== null) ||
    typeof entry.priceSourceUrl !== 'string' ||
    typeof entry.coverSourceUrl !== 'string'
  ) {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    console: entry.console,
    year: entry.year,
    region: entry.region,
    coverUrl: entry.coverUrl,
    priceLoose: entry.priceLoose,
    priceComplete: entry.priceComplete,
    priceSourceUrl: entry.priceSourceUrl,
    coverSourceUrl: entry.coverSourceUrl,
    trendDelta: typeof entry.trendDelta === 'number' ? entry.trendDelta : 0,
    rarity: isRarityTier(entry.rarity) ? entry.rarity : 'Classic',
  } satisfies CatalogEntry
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
  return dedupeCatalog([...state.generatedCatalog, ...sampleCatalog, ...state.customCatalog])
}

function getConsoles() {
  const names = state.catalogMeta.length
    ? state.catalogMeta.map((entry) => entry.console)
    : [...new Set(getCatalog().map((game) => game.console))]

  return ['All consoles', ...names]
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

function getRecord(gameId: string) {
  return state.library[gameId] ?? defaultRecord()
}

function getGameById(gameId: string) {
  return getCatalog().find((game) => game.id === gameId) ?? null
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

function getFilteredGames() {
  const searchValue = state.search.trim().toLowerCase()

  return getCatalog()
    .filter((game) => state.consoleFilter === 'All consoles' || game.console === state.consoleFilter)
    .filter((game) => {
      if (!searchValue) {
        return true
      }

      return [game.title, game.console, game.region, game.rarity].some((field) =>
        field.toLowerCase().includes(searchValue),
      )
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
}

function getOwnedGames() {
  return getCatalog().filter((game) => getRecord(game.id).status === 'owned')
}

function getWantedGames() {
  return getCatalog().filter((game) => getRecord(game.id).status === 'wanted')
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

function getNearCompleteConsoles() {
  return getConsoleProgress()
    .filter((entry) => entry.owned > 0 && entry.owned < entry.total)
    .sort((left, right) => (left.total - left.owned) - (right.total - right.owned) || right.progress - left.progress)
    .slice(0, 4)
}

function getCollectionDelta() {
  return getOwnedGames().reduce((total, game) => {
    const pricePaid = getRecord(game.id).pricePaid
    return total + (pricePaid === null ? 0 : game.priceLoose - pricePaid)
  }, 0)
}

function getPrestigeScore() {
  return getOwnedGames().reduce((total, game) => total + getShelfScore(game), 0)
}

function getRarestOwnedGame() {
  return [...getOwnedGames()].sort((left, right) => getReferencePrice(right) - getReferencePrice(left))[0] ?? null
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
    detail: 'The foundation is there, and every pickup is starting to define the shelf.',
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
  return getConsoles()
    .filter((consoleName) => consoleName !== 'All consoles')
    .map((consoleName) => {
      const games = getCatalog().filter((game) => game.console === consoleName)
      const owned = games.filter((game) => getRecord(game.id).status === 'owned').length

      return {
        consoleName,
        total: games.length,
        owned,
        progress: games.length ? Math.round((owned / games.length) * 100) : 0,
      }
    })
    .sort((left, right) => right.progress - left.progress || left.consoleName.localeCompare(right.consoleName))
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

function getCardCoverUrl(game: CatalogEntry) {
  return game.coverUrl
}

function getDetailCoverUrl(game: CatalogEntry) {
  return game.coverUrl.replace('/240.jpg', '/1600.jpg')
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

function getConditionLabel(condition: ConditionRating) {
  return condition.charAt(0).toUpperCase() + condition.slice(1)
}

function getSyncPayload() {
  return {
    library: state.library,
    customCatalog: state.customCatalog,
    currencyCode: state.currencyCode,
    barcodeMappings: state.barcodeMappings,
  }
}

function applyRemoteSyncState(syncState: {
  library: Record<string, unknown>
  customCatalog: unknown[]
  currencyCode: string
  barcodeMappings: Record<string, string>
}) {
  const parsedLibrary = syncState.library && typeof syncState.library === 'object' ? syncState.library : {}
  state.library = Object.fromEntries(
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
        {
          status,
          completeInBox: typeof entry.completeInBox === 'boolean' ? entry.completeInBox : false,
          pricePaid: typeof entry.pricePaid === 'number' ? entry.pricePaid : null,
          favorite: typeof entry.favorite === 'boolean' ? entry.favorite : false,
          editionStatus: isEditionStatus(entry.editionStatus) ? entry.editionStatus : 'loose',
          condition: isConditionRating(entry.condition) ? entry.condition : 'good',
          targetPrice: typeof entry.targetPrice === 'number' ? entry.targetPrice : null,
          notes: typeof entry.notes === 'string' ? entry.notes : '',
        } satisfies GameRecord,
      ]]
    }),
  )

  state.customCatalog = Array.isArray(syncState.customCatalog)
    ? syncState.customCatalog.map(normalizeCatalogEntry).filter(isCatalogEntry)
    : []

  if (typeof syncState.currencyCode === 'string' && currencyOptions.some((currency) => currency.code === syncState.currencyCode)) {
    state.currencyCode = syncState.currencyCode
  }

  state.barcodeMappings = syncState.barcodeMappings && typeof syncState.barcodeMappings === 'object'
    ? Object.fromEntries(
        Object.entries(syncState.barcodeMappings).flatMap(([code, gameId]) =>
          typeof code === 'string' && typeof gameId === 'string' ? [[code, gameId]] : [],
        ),
      )
    : {}

  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library))
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(state.customCatalog))
  localStorage.setItem(CURRENCY_STORAGE_KEY, state.currencyCode)
  localStorage.setItem(BARCODE_STORAGE_KEY, JSON.stringify(state.barcodeMappings))
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
    return
  }

  state.syncStatus = 'Syncing...'
  render()

  try {
    await pushSyncState(state.authToken, getSyncPayload())
    state.syncStatus = 'Cloud synced'
  } catch (error) {
    state.syncStatus = error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed'
  }

  render()
}

async function hydrateAccount() {
  if (!state.authToken) {
    return
  }

  try {
    const payload = await getCurrentAccount(state.authToken)
    state.accountEmail = payload.user.email
    applyRemoteSyncState(payload.syncState)
    state.syncStatus = 'Cloud synced'
  } catch {
    clearAuthToken()
    state.accountEmail = ''
    state.syncStatus = 'Signed out'
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
  const paidText = record.pricePaid === null ? 'Not set' : formatPrice(record.pricePaid)
  const completeText = game.priceComplete === null ? 'Listing price only' : formatPrice(game.priceComplete)
  const yearText = game.year === null ? 'Release year unavailable' : `Released ${game.year}`
  const marketGap =
    record.pricePaid === null ? 'Add your paid price' : `${record.pricePaid <= game.priceLoose ? 'Up' : 'Down'} ${formatPrice(Math.abs(game.priceLoose - record.pricePaid))}`
  const targetText = record.targetPrice === null ? 'No alert' : `Alert ${formatPrice(record.targetPrice)}`

  return `
    <article class="game-card ${record.status === 'owned' ? 'is-owned' : ''}" data-game-card="true" data-id="${game.id}" role="button" tabindex="0" aria-label="Open details for ${escapeHtml(game.title)}">
      <div class="cover-wrap">
        <img
          class="game-cover"
          src="${getCardCoverUrl(game)}"
          alt="${escapeHtml(game.title)} cover art"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <div class="cover-chips">
          <span class="ownership-pill ${getOwnershipTone(record.status)}">${getOwnershipLabel(record.status)}</span>
          <span class="rarity-badge">${game.rarity}</span>
        </div>
        ${record.status === 'owned' ? '<div class="owned-stamp">In collection</div>' : ''}
      </div>
      <div class="game-copy">
        <div class="game-meta">
          <p class="eyebrow">${escapeHtml(game.console)} / ${escapeHtml(game.region)}</p>
          <h3>${escapeHtml(game.title)}</h3>
          <p class="subtle">${yearText} / Market trend ${formatDelta(game.trendDelta)} / Shelf score ${getShelfScore(game)}</p>
          <p class="collector-line">${getEditionLabel(record.editionStatus)} / ${getConditionLabel(record.condition)} / ${targetText}</p>
        </div>
        <dl class="price-grid">
          <div>
            <dt>Loose</dt>
            <dd>${formatPrice(game.priceLoose)}</dd>
          </div>
          <div>
            <dt>Complete</dt>
            <dd>${completeText}</dd>
          </div>
          <div>
            <dt>You paid</dt>
            <dd>${paidText}</dd>
          </div>
          <div>
            <dt>Value gap</dt>
            <dd>${marketGap}</dd>
          </div>
        </dl>
        <div class="card-actions">
          <button class="toggle-button" data-action="toggle-owned" data-id="${game.id}" type="button">${record.status === 'owned' ? 'Remove owned' : 'Mark owned'}</button>
          <button class="ghost-button ${isWanted ? 'is-active' : ''}" data-action="toggle-wanted" data-id="${game.id}" type="button">${isWanted ? 'Remove wanted' : 'Want it'}</button>
          <button class="ghost-button ${record.favorite ? 'is-active' : ''}" data-action="toggle-favorite" data-id="${game.id}" type="button">${record.favorite ? 'Top shelf' : 'Favorite'}</button>
          <button class="ghost-button" data-action="toggle-cib" data-id="${game.id}" type="button">${record.completeInBox ? 'Unset CIB' : 'Mark CIB'}</button>
          <button class="ghost-button" data-action="set-price-paid" data-id="${game.id}" type="button">Set paid</button>
          <button class="ghost-button" data-action="open-details" data-id="${game.id}" type="button">Details</button>
          <a class="link-button" href="${game.priceSourceUrl}" target="_blank" rel="noreferrer">Price source</a>
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
  const valueGap =
    record.pricePaid === null ? null : game.priceLoose - record.pricePaid

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
            referrerpolicy="no-referrer"
          />
        </div>
        <div class="game-modal-copy">
          <p class="kicker">Collector detail</p>
          <h2 id="game-modal-title">${escapeHtml(game.title)}</h2>
        <p class="modal-subtitle">${escapeHtml(game.console)} / ${escapeHtml(game.region)} / ${game.year ?? 'Release year unavailable'}</p>
          <div class="modal-pill-row">
            <span class="ownership-pill ${getOwnershipTone(record.status)}">${getOwnershipLabel(record.status)}</span>
            <span class="rarity-badge">${game.rarity}</span>
            <span class="detail-chip">CIB ${record.completeInBox ? 'tracked' : 'not tracked'}</span>
            <span class="detail-chip">Shelf score ${getShelfScore(game)}</span>
            <span class="detail-chip">${getEditionLabel(record.editionStatus)}</span>
            <span class="detail-chip">${getConditionLabel(record.condition)}</span>
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
            <p><strong>Market edge:</strong> ${valueGap === null ? 'Add your paid price to see gain or loss.' : `${valueGap >= 0 ? 'Ahead' : 'Behind'} ${formatPrice(Math.abs(valueGap))} versus loose market.`}</p>
            <p><strong>Alert target:</strong> ${record.targetPrice === null ? 'No target set.' : `Notify yourself when loose value hits ${formatPrice(record.targetPrice)} or less.`}</p>
            <p><strong>Art source:</strong> Live cover from the linked listing source below.</p>
            <p><strong>Market note:</strong> ${appConfig.marketDisclaimer}</p>
            <p><strong>Collector notes:</strong> ${record.notes ? escapeHtml(record.notes) : 'No collector notes yet.'}</p>
          </div>
          <div class="card-actions">
            <button class="toggle-button" data-action="toggle-owned" data-id="${game.id}" type="button">${record.status === 'owned' ? 'Remove owned' : 'Mark owned'}</button>
            <button class="ghost-button ${record.status === 'wanted' ? 'is-active' : ''}" data-action="toggle-wanted" data-id="${game.id}" type="button">${record.status === 'wanted' ? 'Remove wanted' : 'Want it'}</button>
            <button class="ghost-button ${record.favorite ? 'is-active' : ''}" data-action="toggle-favorite" data-id="${game.id}" type="button">${record.favorite ? 'Top shelf' : 'Favorite'}</button>
            <button class="ghost-button" data-action="set-price-paid" data-id="${game.id}" type="button">Set paid</button>
            <button class="ghost-button" data-action="set-target-price" data-id="${game.id}" type="button">Set alert</button>
            <button class="ghost-button" data-action="set-edition" data-id="${game.id}" type="button">Edition</button>
            <button class="ghost-button" data-action="set-condition" data-id="${game.id}" type="button">Condition</button>
            <button class="ghost-button" data-action="edit-notes" data-id="${game.id}" type="button">Notes</button>
            <a class="link-button" href="${game.priceSourceUrl}" target="_blank" rel="noreferrer">Open market source</a>
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

function renderAccountCard() {
  return `
    <article class="smart-card">
      <h3>Cloud sync</h3>
      <p class="subtle">${state.authToken ? `Signed in as ${escapeHtml(state.accountEmail || 'collector')}. Your collection, custom links, and barcode matches are ready to follow you across devices.` : 'Save your collection to an account so your shelf, custom barcode matches, and collector data stay with you.'}</p>
      <div class="account-meta">
        <span class="detail-chip">${escapeHtml(state.syncStatus)}</span>
        <span class="detail-chip">${state.authToken ? 'Account enabled' : 'Offline mode'}</span>
      </div>
      <div class="card-actions">
        ${state.authToken
          ? '<button class="toggle-button" data-action="sync-now" type="button">Sync now</button><button class="ghost-button" data-action="logout-account" type="button">Sign out</button>'
          : '<button class="toggle-button" data-action="register-account" type="button">Create account</button><button class="ghost-button" data-action="login-account" type="button">Sign in</button>'}
      </div>
    </article>
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
            <label class="toggle-button scanner-upload">
              Camera or photo
              <input id="barcode-file-input" type="file" accept="image/*" capture="environment" hidden />
            </label>
            <button class="ghost-button" data-action="manual-barcode" type="button">Enter barcode</button>
          </div>
          ${
            state.barcodeLinkCode
              ? `
                <div class="scanner-result">
                  <p><strong>Scanned code:</strong> ${escapeHtml(state.barcodeLinkCode)}</p>
                  ${
                    linkedGame
                      ? `<p><strong>Linked game:</strong> ${escapeHtml(linkedGame.title)} on ${escapeHtml(linkedGame.console)}</p>`
                      : '<p><strong>Status:</strong> No saved match yet. Search below to link it.</p>'
                  }
                </div>
                <label class="search-field">
                  <span>Search game to link</span>
                  <input id="barcode-search" type="search" placeholder="Search a title or console..." value="${escapeHtml(state.barcodeSearch)}" />
                </label>
                <div class="barcode-match-list">
                  ${matches
                    .map(
                      (game) => `
                        <button class="barcode-match" type="button" data-action="link-barcode" data-id="${game.id}">
                          <strong>${escapeHtml(game.title)}</strong>
                          <span>${escapeHtml(game.console)} / ${formatPrice(game.priceLoose)}</span>
                        </button>
                      `,
                    )
                    .join('')}
                </div>
              `
              : '<p class="subtle">Use your camera, a saved barcode photo, or manual entry. If a code is unknown, you can link it once and it will work next time.</p>'
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
      <img class="spotlight-cover" src="${spotlight.game.coverUrl}" alt="${escapeHtml(spotlight.game.title)} cover art" loading="lazy" referrerpolicy="no-referrer" />
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

function render() {
  const catalog = getCatalog()
  const filteredGames = getFilteredGames()
  const ownedGames = getOwnedGames()
  const wantedGames = getWantedGames()
  const ownedLooseValue = ownedGames.reduce((total, game) => total + game.priceLoose, 0)
  const ownedCompleteValue = ownedGames.reduce((total, game) => total + getReferencePrice(game), 0)
  const estimatedSellValue = ownedLooseValue
  const completionPercentage = catalog.length === 0 ? 0 : Math.round((ownedGames.length / catalog.length) * 100)
  const wishlistValue = wantedGames.reduce((total, game) => total + getReferencePrice(game), 0)
  const collectionDelta = getCollectionDelta()
  const prestigeScore = getPrestigeScore()
  const spotlight = getSpotlightGame()
  const consoleCount = new Set(catalog.map((game) => game.console)).size
  const loadedConsoleCount = state.loadedConsoles.length
  const totalConsoleCount = state.catalogMeta.length || consoleCount
  const selectedCurrency = getSelectedCurrency()
  const alertMatches = getAlertMatches()
  const nearCompleteConsoles = getNearCompleteConsoles()
  const collectorRank = getCollectorRank()
  const catalogStatusText = state.isCatalogLoading
    ? `Loading retro catalog data... ${loadedConsoleCount}/${totalConsoleCount} console libraries ready.`
    : state.catalogLoadError
      ? `Showing curated fallback data from ${priceSnapshotDate}.`
      : `Loaded ${catalog.length} games across ${consoleCount} retro consoles. ${loadedConsoleCount}/${totalConsoleCount} console libraries synced. Snapshot ${priceSnapshotDate}.`

  app.innerHTML = `
    <div class="app-shell">
      <header class="hero-panel">
        <div class="hero-copy">
          <p class="kicker">Retro Vault Elite</p>
          <h1>Track, value, and showcase your retro collection with confidence.</h1>
          <p class="hero-text">
            Browse complete console libraries, follow current market values, and manage your collection in a way that feels polished, informed, and genuinely built for collectors.
          </p>
          <p class="hero-text hero-text--tiny">${catalogStatusText} Collection values convert from USD market data using ECB reference rates from 10 April 2026.</p>
          <div class="hero-actions">
            ${renderInstallButton()}
            <button class="secondary-button" type="button" data-action="export-catalog">Export collection</button>
            <button class="secondary-button" type="button" data-action="share-recap">Share recap</button>
            <button class="secondary-button" type="button" data-action="open-scanner">Scan barcode</button>
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
            <span class="stat-note">Loose market total in ${selectedCurrency.code}</span>
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

      ${renderAchievementStrip()}

      <section class="toolbar">
        <label class="search-field">
          <span>Search the vault</span>
          <input id="search-input" type="search" placeholder="Mario, Chrono, Castlevania..." value="${escapeHtml(state.search)}" />
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
      </section>

      <section class="filters">
        ${renderFilterChip('all', 'All')}
        ${renderFilterChip('owned', 'Owned')}
        ${renderFilterChip('wanted', 'Wanted')}
        ${renderFilterChip('missing', 'Missing')}
        <button class="secondary-button" data-action="reset-library" type="button">Reset library</button>
        <button class="secondary-button" data-action="import-catalog" type="button">Import JSON catalog</button>
        <input id="catalog-import" type="file" accept=".json,application/json" hidden />
      </section>

      <section class="smart-grid">
        ${renderSmartList('Top grails still missing', getMissingGrails(), 'You already own every seeded grail.')}
        ${renderAccountCard()}
        ${renderConsoleCompletionCard()}
      </section>

      <section class="showcase-grid">
        ${renderSpotlight(spotlight)}
        <div class="insight-grid">
          ${renderInsightCard('Shelf prestige', prestigeScore.toString(), 'Weighted by rarity, market heat, CIB, and top-shelf picks.')}
          ${renderInsightCard('Market edge', formatPrice(collectionDelta), `Current loose value minus paid value in ${selectedCurrency.code}.`)}
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

      <section class="catalog-section">
        <div class="section-heading">
          <div>
            <p class="kicker">Collection grid</p>
            <h2>${filteredGames.length} game${filteredGames.length === 1 ? '' : 's'} in view</h2>
          </div>
          <p class="section-note">Every cover stays in full color now. Ownership is shown with a clean collection stamp, status pill, and stronger card treatment.</p>
        </div>
        <div class="catalog-grid">
          ${
            filteredGames.length
              ? filteredGames.map(renderCard).join('')
              : '<div class="empty-state"><h3>No matches</h3><p>Try another search, console, or collector filter.</p></div>'
          }
        </div>
      </section>

      <section class="roadmap-strip">
        <article class="roadmap-card">
          <h3>Designed to feel considered</h3>
          <p>Every part of the app is tuned around the collector experience: clean cover browsing, stronger ownership cues, richer game detail, and smarter views of what matters next without visual clutter.</p>
        </article>
        <article class="roadmap-card">
          <h3>Built to keep improving</h3>
          <p>The foundation is now in place for richer price history, deeper metadata, hosted sync, region-specific editions, and sharper collector alerts while keeping the product cohesive as it grows.</p>
        </article>
      </section>
      <footer class="app-footer">
        <a href="${appConfig.supportUrl}" target="_blank" rel="noreferrer">Support</a>
        <a href="${appConfig.privacyUrl}" target="_blank" rel="noreferrer">Privacy</a>
        <span>${appConfig.marketDisclaimer}</span>
      </footer>
      ${renderScannerModal()}
      ${renderSelectedGameModal()}
    </div>
  `

  bindEvents()
}

function bindEvents() {
  const searchInput = document.querySelector<HTMLInputElement>('#search-input')
  const consoleFilter = document.querySelector<HTMLSelectElement>('#console-filter')
  const sortMode = document.querySelector<HTMLSelectElement>('#sort-mode')
  const currencyCode = document.querySelector<HTMLSelectElement>('#currency-code')
  const importInput = document.querySelector<HTMLInputElement>('#catalog-import')
  const barcodeFileInput = document.querySelector<HTMLInputElement>('#barcode-file-input')
  const barcodeSearch = document.querySelector<HTMLInputElement>('#barcode-search')

  searchInput?.addEventListener('input', (event) => {
    state.search = (event.currentTarget as HTMLInputElement).value
    render()
  })

  consoleFilter?.addEventListener('change', async (event) => {
    state.consoleFilter = (event.currentTarget as HTMLSelectElement).value
    await ensureConsoleCatalogLoaded(state.consoleFilter)
    render()
  })

  sortMode?.addEventListener('change', (event) => {
    state.sortMode = (event.currentTarget as HTMLSelectElement).value as SortMode
    render()
  })

  currencyCode?.addEventListener('change', (event) => {
    state.currencyCode = (event.currentTarget as HTMLSelectElement).value
    saveCurrencyCode()
    render()
  })

  barcodeSearch?.addEventListener('input', (event) => {
    state.barcodeSearch = (event.currentTarget as HTMLInputElement).value
    render()
  })

  barcodeFileInput?.addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]

    if (!file) {
      return
    }

    await detectBarcodeFromFile(file)
    barcodeFileInput.value = ''
  })

  importInput?.addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]

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

      if (!imported.length) {
        throw new Error('No valid games were found in the file.')
      }

      state.customCatalog = dedupeCatalog([...state.customCatalog, ...imported])
      saveCustomCatalog()
      render()
      alert(`Imported ${imported.length} games into Retro Vault Elite.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.'
      alert(message)
    } finally {
      importInput.value = ''
    }
  })

  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => {
    element.addEventListener('click', () => {
      void handleAction(element)
    })
  })

  app.querySelectorAll<HTMLElement>('.game-card[data-id]').forEach((element) => {
    element.addEventListener('click', (event) => {
      const target = event.target as HTMLElement

      if (target.closest('.card-actions')) {
        return
      }

      state.selectedGameId = element.dataset.id ?? null
      render()
    })

    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      const card = event.currentTarget as HTMLElement
      state.selectedGameId = card.dataset.id ?? null
      render()
    })
  })
}

function dedupeCatalog(entries: CatalogEntry[]) {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()]
}

async function handleAction(element: HTMLElement) {
  const action = element.dataset.action
  const id = element.dataset.id

  switch (action) {
    case 'toggle-owned':
      if (!id) {
        return
      }

      setRecord(id, (record) => ({
        ...record,
        status: record.status === 'owned' ? 'missing' : 'owned',
      }))
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
      state.scannerOpen = true
  state.scannerStatus = 'Scan a barcode with your camera or upload a clear barcode photo.'
      render()
      break
    case 'close-scanner':
      state.scannerOpen = false
      state.barcodeLinkCode = null
      state.barcodeSearch = ''
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
    case 'register-account':
      await registerWithPrompt()
      break
    case 'login-account':
      await loginWithPrompt()
      break
    case 'logout-account':
      await logoutCurrentAccount()
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
    case 'ownership-filter': {
      const filter = element.dataset.filter as OwnershipFilter | undefined

      if (!filter) {
        return
      }

      state.ownershipFilter = filter
      render()
      break
    }
    case 'reset-library':
      state.library = {}
      saveLibrary()
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
    case 'install-app':
      await promptInstall()
      break
    default:
      break
  }
}

function setRecord(id: string, updater: (record: GameRecord) => GameRecord) {
  state.library = {
    ...state.library,
    [id]: updater(getRecord(id)),
  }
  saveLibrary()
  render()
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
    completeInBox: next === 'cib' ? true : record.completeInBox,
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

async function registerWithPrompt() {
  const email = window.prompt('Enter your email for Retro Vault Elite cloud sync.')

  if (!email) {
    return
  }

  const password = window.prompt('Choose a password with at least 6 characters.')

  if (!password) {
    return
  }

  try {
    const payload = await registerAccount(email, password)
    saveAuthToken(payload.token)
    state.accountEmail = payload.user.email
    applyRemoteSyncState(payload.syncState)
    await syncToCloud()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Account registration failed.')
  }
}

async function loginWithPrompt() {
  const email = window.prompt('Enter your account email.')

  if (!email) {
    return
  }

  const password = window.prompt('Enter your password.')

  if (!password) {
    return
  }

  try {
    const payload = await loginAccount(email, password)
    saveAuthToken(payload.token)
    state.accountEmail = payload.user.email
    applyRemoteSyncState(payload.syncState)
    state.syncStatus = 'Cloud synced'
    render()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Sign in failed.')
  }
}

async function logoutCurrentAccount() {
  if (!state.authToken) {
    return
  }

  try {
    await logoutAccount(state.authToken)
  } catch {
    // even if logout request fails, clear the local token
  }

  clearAuthToken()
  state.accountEmail = ''
  state.syncStatus = 'Signed out'
  render()
}

async function enterBarcodeManually() {
  const response = window.prompt('Enter the UPC or barcode number.')

  if (!response) {
    return
  }

  await handleBarcodeDetected(response.trim())
}

async function detectBarcodeFromFile(file: File) {
  const barcodeDetectorCtor = (window as Window & { BarcodeDetector?: { new (): BarcodeDetectorLike } }).BarcodeDetector

  if (!barcodeDetectorCtor) {
    state.scannerStatus = 'Barcode detection is not supported in this browser. Use manual entry instead.'
    render()
    return
  }

  try {
    const bitmap = await createImageBitmap(file)
    const detector = new barcodeDetectorCtor()
    const results = await detector.detect(bitmap)
    const code = results.find((result) => typeof result.rawValue === 'string' && result.rawValue.trim())?.rawValue?.trim()

    if (!code) {
      state.scannerStatus = 'No barcode was detected in that image. Try another photo or use manual entry.'
      render()
      return
    }

    await handleBarcodeDetected(code)
  } catch (error) {
    state.scannerStatus = error instanceof Error ? error.message : 'Barcode detection failed.'
    render()
  }
}

async function handleBarcodeDetected(code: string) {
  const mappedGameId = state.barcodeMappings[code]

  state.scannerOpen = true
  state.barcodeLinkCode = code
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

  state.scannerStatus = 'Barcode found, but not linked yet. Search below and save the match once.'
  render()
}

async function linkBarcodeToGame(code: string, gameId: string) {
  state.barcodeMappings = {
    ...state.barcodeMappings,
    [code]: gameId,
  }
  saveBarcodeMappings()

  if (state.authToken) {
    try {
      await saveBarcodeMapping(state.authToken, code, gameId)
      state.syncStatus = 'Cloud synced'
    } catch (error) {
      state.syncStatus = error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed'
    }
  }

  const game = getGameById(gameId)
  state.scannerStatus = game ? `Linked ${code} to ${game.title}.` : 'Barcode linked.'
  state.selectedGameId = gameId
  render()
}

async function shareCollectionRecap() {
  const ownedGames = getOwnedGames()
  const wantedGames = getWantedGames()
  const rank = getCollectorRank()
  const recap = [
    'Retro Vault Elite Collection Recap',
    `Collector rank: ${rank.title}`,
    `${ownedGames.length} owned / ${wantedGames.length} wanted`,
    `Estimated sell value: ${formatPrice(ownedGames.reduce((total, game) => total + game.priceLoose, 0))}`,
    `Collection premium: ${formatPrice(ownedGames.reduce((total, game) => total + getReferencePrice(game), 0))}`,
    ...getViralShareLines(),
  ].join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Retro Vault Elite recap',
        text: recap,
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
    const response = await fetch('/catalogs/retro-catalog-meta.json', { cache: 'no-store' })

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
          } satisfies CatalogConsoleMeta,
        ]
      })

    await ensureConsoleCatalogLoaded(state.consoleFilter)
    void warmCatalogInBackground()
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

async function warmCatalogInBackground() {
  const remaining = state.catalogMeta
    .map((entry) => entry.console)
    .filter((consoleName) => !state.loadedConsoles.includes(consoleName))

  for (const consoleName of remaining) {
    await ensureConsoleCatalogLoaded(consoleName, false)
  }
}

async function ensureConsoleCatalogLoaded(consoleName: string, rerenderAfterLoad = true) {
  if (!state.catalogMeta.length) {
    return
  }

  if (consoleName === 'All consoles') {
    await Promise.all(state.catalogMeta.map((entry) => ensureConsoleCatalogLoaded(entry.console, false)))

    if (rerenderAfterLoad) {
      render()
    }

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
    const response = await fetch(meta.file, { cache: 'no-store' })

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

render()
void loadGeneratedCatalog()
void hydrateAccount()
void initMobileBannerAd()
