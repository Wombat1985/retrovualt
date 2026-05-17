import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { setDefaultResultOrder } from 'node:dns'
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
setDefaultResultOrder('ipv4first')
const dataDir = process.env.DATA_DIR
  ? isAbsolute(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : join(process.cwd(), process.env.DATA_DIR)
  : join(__dirname, 'data')
const dbPath = join(dataDir, 'db.json')
const dbBackupPath = join(dataDir, 'db.backup.json')
const port = Number(process.env.PORT ?? 8787)
const sessionTtlMs = Number(process.env.SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000
const resetTtlMs = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30) * 60 * 1000
const supabaseUrl = String(process.env.SUPABASE_URL ?? '')
  .replace(/\s+/g, '')
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/$/, '')
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').replace(/\s+/g, '')
const supabaseStateTable = String(process.env.SUPABASE_STATE_TABLE ?? 'retro_vault_state')
const supabaseStateId = String(process.env.SUPABASE_STATE_ID ?? 'main')
const requestLimits = new Map()
const MAX_LIBRARY_ENTRIES = 10000
const MAX_CATALOG_ENTRIES = 1000
const MAX_BARCODE_MAPPINGS = 10000
let lastStorageStatus = {
  mode: 'local',
  ok: true,
  message: 'Using local JSON storage.',
  checkedAt: null,
}
const defaultAllowedOrigins = [
  'https://www.retrovaultelite.com',
  'https://retrovaultelite.com',
  'https://retro-vault-web.onrender.com',
]
const backendPublicUrl = String(process.env.BACKEND_PUBLIC_URL ?? 'https://retro-vault-backend.onrender.com').replace(/\/$/, '')
const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .concat(defaultAllowedOrigins)

mkdirSync(dataDir, { recursive: true })

function createEmptyDb() {
  return {
    users: [],
    sessions: [],
    passwordResets: [],
    newsletterSubscribers: [],
    emailCampaigns: [],
    emailSuppressions: [],
    sharedBarcodeMappings: {},
    analytics: createDefaultAnalyticsState(),
    tradeRequests: [],
    messages: [],
  }
}

function createDefaultAnalyticsState() {
  return {
    totalPageViews: 0,
    lifetimePageViews: 0,
    firstTrackedAt: null,
    lastTrackedAt: null,
    pages: {},
    days: {},
    referrers: {},
    userAgents: {},
    signedInPageViews: 0,
  }
}

function createId() {
  return randomBytes(16).toString('hex')
}

function normalizeDb(parsed) {
  return {
    users: Array.isArray(parsed?.users) ? parsed.users : [],
    sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
    passwordResets: Array.isArray(parsed?.passwordResets) ? parsed.passwordResets : [],
    newsletterSubscribers: Array.isArray(parsed?.newsletterSubscribers) ? parsed.newsletterSubscribers : [],
    emailCampaigns: Array.isArray(parsed?.emailCampaigns) ? parsed.emailCampaigns.map(normalizeEmailCampaign).filter(Boolean) : [],
    emailSuppressions: Array.isArray(parsed?.emailSuppressions) ? parsed.emailSuppressions.map(normalizeEmailSuppression).filter(Boolean) : [],
    sharedBarcodeMappings: normalizeSharedBarcodeMappings(parsed?.sharedBarcodeMappings),
    analytics: normalizeAnalyticsState(parsed?.analytics),
    tradeRequests: Array.isArray(parsed?.tradeRequests) ? parsed.tradeRequests.map(normalizeTradeRequest) : [],
    messages: Array.isArray(parsed?.messages) ? parsed.messages.map(normalizeMessage) : [],
  }
}

function normalizeBarcodeCode(code) {
  return String(code ?? '')
    .trim()
    .replace(/[\s-]+/g, '')
    .slice(0, 80)
}

function normalizeSharedBarcodeMappings(rawMappings) {
  if (!rawMappings || typeof rawMappings !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(rawMappings).flatMap(([rawCode, rawEntry]) => {
      const code = normalizeBarcodeCode(rawCode)

      if (!code || !rawEntry || typeof rawEntry !== 'object') {
        return []
      }

      const gameId = String(rawEntry.gameId ?? '').trim()

      if (!gameId) {
        return []
      }

      return [
        [
          code,
          {
            gameId,
            source: String(rawEntry.source ?? 'admin').trim().slice(0, 120) || 'admin',
            updatedAt:
              typeof rawEntry.updatedAt === 'string' && rawEntry.updatedAt
                ? rawEntry.updatedAt
                : new Date().toISOString(),
          },
        ],
      ]
    }),
  )
}

function getSharedBarcodeMapping(db, code) {
  return db.sharedBarcodeMappings?.[normalizeBarcodeCode(code)] ?? null
}

function upsertSharedBarcodeMappings(db, mappings, options = {}) {
  const nextMappings = options.replace ? {} : { ...(db.sharedBarcodeMappings ?? {}) }
  const updatedAt = new Date().toISOString()
  let importedCount = 0

  for (const entry of Array.isArray(mappings) ? mappings : []) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const code = normalizeBarcodeCode(entry.code)
    const gameId = String(entry.gameId ?? '').trim()

    if (!code || !gameId) {
      continue
    }

    nextMappings[code] = {
      gameId,
      source: String(entry.source ?? 'admin import').trim().slice(0, 120) || 'admin import',
      updatedAt,
    }
    importedCount += 1
  }

  db.sharedBarcodeMappings = nextMappings
  return importedCount
}

function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey)
}

function updateStorageStatus(status) {
  lastStorageStatus = {
    ...lastStorageStatus,
    ...status,
    checkedAt: new Date().toISOString(),
  }
}

function getErrorMessage(error, fallback) {
  if (!(error instanceof Error)) {
    return fallback
  }

  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : ''
  return `${error.message}${cause}`
}

function hasMeaningfulDbData(db) {
  return (
    db.users.length > 0 ||
    db.newsletterSubscribers.length > 0 ||
    Number(db.analytics?.lifetimePageViews) > 0 ||
    Number(db.analytics?.totalPageViews) > 0
  )
}

async function supabaseRequest(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Supabase request failed (${response.status}): ${errorText || response.statusText}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function loadSupabaseDb() {
  const rows = await supabaseRequest(
    `${encodeURIComponent(supabaseStateTable)}?id=eq.${encodeURIComponent(supabaseStateId)}&select=data&limit=1`,
  )

  if (Array.isArray(rows) && rows[0]?.data) {
    const remoteDb = normalizeDb(rows[0].data)
    const localDb = loadLocalDb()

    if (!hasMeaningfulDbData(remoteDb) && hasMeaningfulDbData(localDb)) {
      await saveSupabaseDb(localDb)
      return normalizeDb(localDb)
    }

    return remoteDb
  }

  const emptyDb = createEmptyDb()
  await saveSupabaseDb(emptyDb)
  return emptyDb
}

async function saveSupabaseDb(db) {
  const payload = {
    data: normalizeDb(db),
    updated_at: new Date().toISOString(),
  }

  try {
    await supabaseRequest(
      `${encodeURIComponent(supabaseStateTable)}?id=eq.${encodeURIComponent(supabaseStateId)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
      },
    )
    return
  } catch (error) {
    console.error(getErrorMessage(error, 'Supabase update failed.'))
  }

  await supabaseRequest(encodeURIComponent(supabaseStateTable), {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: supabaseStateId,
      ...payload,
    }),
  })
}

function loadLocalDb() {
  if (!existsSync(dbPath)) {
    const emptyDb = createEmptyDb()
    writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2))
    return emptyDb
  }

  try {
    const parsed = JSON.parse(readFileSync(dbPath, 'utf8'))
    return normalizeDb(parsed)
  } catch {
    if (existsSync(dbBackupPath)) {
      try {
        const parsed = JSON.parse(readFileSync(dbBackupPath, 'utf8'))
        const recoveredDb = normalizeDb(parsed)
        saveLocalDb(recoveredDb)
        return recoveredDb
      } catch {
        // Fall through to a clean database if both files are unreadable.
      }
    }

    const emptyDb = createEmptyDb()
    saveLocalDb(emptyDb)
    return emptyDb
  }
}

function saveLocalDb(db) {
  const tmpPath = `${dbPath}.tmp`
  const serialized = JSON.stringify(normalizeDb(db), null, 2)
  writeFileSync(tmpPath, serialized)
  renameSync(tmpPath, dbPath)
  writeFileSync(dbBackupPath, serialized)
}

async function loadDb(options = {}) {
  if (isSupabaseConfigured()) {
    try {
      const db = await loadSupabaseDb()
      updateStorageStatus({
        mode: 'supabase',
        ok: true,
        message: 'Supabase persistent storage is connected.',
      })
      return db
    } catch (error) {
      const message = getErrorMessage(error, 'Supabase storage failed.')
      updateStorageStatus({
        mode: 'supabase',
        ok: false,
        message,
      })
      console.error(message)

      if (options.required) {
        throw new Error('Permanent account database is not reachable. Please check the Supabase key in Render.')
      }

      return loadLocalDb()
    }
  }

  updateStorageStatus({
    mode: 'local',
    ok: true,
    message: isSupabaseConfigured()
      ? 'Using temporary local fallback because Supabase is unavailable.'
      : 'Using local JSON storage.',
  })
  return loadLocalDb()
}

async function saveDb(db, options = {}) {
  saveLocalDb(db)

  if (!isSupabaseConfigured()) {
    updateStorageStatus({
      mode: 'local',
      ok: true,
      message: 'Using local JSON storage.',
    })
    return
  }

  try {
    await saveSupabaseDb(db)
    updateStorageStatus({
      mode: 'supabase',
      ok: true,
      message: 'Supabase persistent storage is connected.',
    })
  } catch (error) {
    const message = getErrorMessage(error, 'Supabase save failed.')
    updateStorageStatus({
      mode: 'supabase',
      ok: false,
      message,
    })
    console.error(message)

    if (options.required) {
      throw new Error(`Permanent account database could not save. ${message}`)
    }
  }
}

function normalizeAnalyticsState(analytics) {
  const totalPageViews = Number(analytics?.totalPageViews) || 0
  const lifetimePageViews = Math.max(Number(analytics?.lifetimePageViews) || 0, totalPageViews)

  return {
    ...createDefaultAnalyticsState(),
    ...(analytics && typeof analytics === 'object' ? analytics : {}),
    totalPageViews,
    lifetimePageViews,
    pages: analytics?.pages && typeof analytics.pages === 'object' ? analytics.pages : {},
    days: analytics?.days && typeof analytics.days === 'object' ? analytics.days : {},
    referrers: analytics?.referrers && typeof analytics.referrers === 'object' ? analytics.referrers : {},
    userAgents: analytics?.userAgents && typeof analytics.userAgents === 'object' ? analytics.userAgents : {},
  }
}

function getCorsOrigin(request) {
  const requestOrigin = request.headers.origin ?? ''
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] ?? ''
}

function json(request, response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(data))
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hashedPassword] = stored.split(':')
  const hashBuffer = Buffer.from(hashedPassword, 'hex')
  const suppliedBuffer = scryptSync(password, salt, 64)
  return timingSafeEqual(hashBuffer, suppliedBuffer)
}

function generateToken() {
  return randomBytes(24).toString('hex')
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function pruneSecurityState(db) {
  const now = Date.now()
  db.sessions = db.sessions.filter((entry) => !entry.expiresAt || new Date(entry.expiresAt).getTime() > now)
  db.passwordResets = db.passwordResets.filter((entry) => new Date(entry.expiresAt).getTime() > now)
}

function rateLimit(request, key, limit, windowMs) {
  const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? request.socket.remoteAddress ?? 'unknown'
  const bucketKey = `${key}:${ip}`
  const now = Date.now()
  const bucket = requestLimits.get(bucketKey) ?? { count: 0, resetAt: now + windowMs }

  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + windowMs
  }

  bucket.count += 1
  requestLimits.set(bucketKey, bucket)
  return bucket.count <= limit
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePassword(password) {
  if (password.length < 8) {
    return 'Use at least 8 characters.'
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number.'
  }

  return ''
}

function normalizeDisplayName(displayName) {
  return String(displayName ?? '').trim().replace(/\s+/g, ' ')
}

function getDisplayNameKey(displayName) {
  return normalizeDisplayName(displayName).toLowerCase()
}

function isDisplayNameTaken(db, displayName, currentUserId = '') {
  const displayNameKey = getDisplayNameKey(displayName)

  if (!displayNameKey) {
    return false
  }

  return db.users.some((entry) => entry.id !== currentUserId && getDisplayNameKey(entry.displayName) === displayNameKey)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

async function getSessionUser(request, db) {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice('Bearer '.length)
  const session = db.sessions.find((entry) => entry.token === token)

  if (!session) {
    return null
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    db.sessions = db.sessions.filter((entry) => entry.token !== token)
    await saveDb(db)
    return null
  }

  return db.users.find((entry) => entry.id === session.userId) ?? null
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? '',
    createdAt: user.createdAt,
  }
}

function getAdminKey() {
  return String(process.env.ADMIN_KEY ?? '').trim()
}

function isAdminRequest(request, url) {
  const adminKey = getAdminKey()

  if (!adminKey) {
    return false
  }

  const suppliedKey = request.headers['x-admin-key'] ?? ''
  return timingSafeStringEqual(String(suppliedKey), adminKey)
}

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

function getSafeUserDetails(user) {
  const library = user.syncState?.library && typeof user.syncState.library === 'object' ? user.syncState.library : {}
  const records = Object.values(library).filter((record) => record && typeof record === 'object')
  const ownedCount = records.filter((record) => record.status === 'owned').length
  const wantedCount = records.filter((record) => record.status === 'wanted').length
  const favoriteCount = records.filter((record) => record.favorite === true).length
  const cibCount = records.filter((record) => record.completeInBox === true || record.editionStatus === 'cib').length
  const paidPriceCount = records.filter((record) => Number.isFinite(record.pricePaid)).length

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? '',
    createdAt: user.createdAt,
    lastSyncedAt: user.syncState?.updatedAt ?? null,
    currencyCode: user.syncState?.currencyCode ?? 'USD',
    ownedCount,
    wantedCount,
    favoriteCount,
    cibCount,
    paidPriceCount,
  }
}

function incrementCounter(bucket, key) {
  const safeKey = key || 'unknown'
  bucket[safeKey] = (Number(bucket[safeKey]) || 0) + 1
}

function normalizePagePath(path) {
  const rawPath = String(path ?? '/').trim() || '/'

  try {
    return new URL(rawPath, 'https://www.retrovaultelite.com').pathname || '/'
  } catch {
    return '/'
  }
}

function normalizeReferrer(referrer) {
  const rawReferrer = String(referrer ?? '').trim()

  if (!rawReferrer) {
    return 'direct'
  }

  try {
    const host = new URL(rawReferrer).hostname.replace(/^www\./, '')
    return host || 'direct'
  } catch {
    return 'unknown'
  }
}

function normalizeUserAgent(userAgent) {
  const value = String(userAgent ?? '').toLowerCase()

  if (value.includes('iphone') || value.includes('android') || value.includes('mobile')) {
    return 'mobile'
  }

  if (value.includes('ipad') || value.includes('tablet')) {
    return 'tablet'
  }

  if (value.includes('bot') || value.includes('crawl') || value.includes('spider')) {
    return 'bot'
  }

  return 'desktop'
}

function recordPageView(db, request, body) {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const analytics = normalizeAnalyticsState(db.analytics)
  const path = normalizePagePath(body.path)
  const referrer = normalizeReferrer(body.referrer)
  const userAgent = normalizeUserAgent(request.headers['user-agent'])
  const signedIn = Boolean(body.signedIn)

  analytics.totalPageViews = (Number(analytics.totalPageViews) || 0) + 1
  analytics.lifetimePageViews = Math.max(Number(analytics.lifetimePageViews) || 0, analytics.totalPageViews)
  analytics.firstTrackedAt = analytics.firstTrackedAt ?? now.toISOString()
  analytics.lastTrackedAt = now.toISOString()
  analytics.signedInPageViews = (Number(analytics.signedInPageViews) || 0) + (signedIn ? 1 : 0)
  incrementCounter(analytics.pages, path)
  incrementCounter(analytics.days, day)
  incrementCounter(analytics.referrers, referrer)
  incrementCounter(analytics.userAgents, userAgent)
  db.analytics = analytics
}

function getTopCounters(bucket, limit = 12) {
  return Object.entries(bucket ?? {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

function getAdminStats(db) {
  const analytics = normalizeAnalyticsState(db.analytics)
  const users = db.users.map(getSafeUserDetails).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const today = new Date().toISOString().slice(0, 10)
  const viewsToday = Number(analytics.days?.[today]) || 0
  const signupsToday = users.filter((user) => String(user.createdAt).startsWith(today)).length
  const newsletterToday = db.newsletterSubscribers.filter((entry) => String(entry.createdAt).startsWith(today)).length
  const recentEmailCampaigns = (db.emailCampaigns ?? [])
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 8)

  return {
    generatedAt: new Date().toISOString(),
    userCount: users.length,
    signupsToday,
    activeSessionCount: db.sessions.length,
    sharedBarcodeMappingCount: Object.keys(db.sharedBarcodeMappings ?? {}).length,
    storage: lastStorageStatus,
    newsletterSubscriberCount: db.newsletterSubscribers.length,
    newsletterToday,
    signupConversionRate: viewsToday ? Number(((signupsToday / viewsToday) * 100).toFixed(2)) : 0,
    users,
    recentEmailCampaigns,
    emailHealth: getEmailDeliveryHealth(),
    newsletterSubscribers: db.newsletterSubscribers
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((entry) => ({
        email: entry.email,
        source: entry.source,
        createdAt: entry.createdAt,
      })),
    analytics: {
      totalPageViews: analytics.totalPageViews,
      lifetimePageViews: analytics.lifetimePageViews,
      viewsToday,
      signedInPageViews: analytics.signedInPageViews,
      firstTrackedAt: analytics.firstTrackedAt,
      lastTrackedAt: analytics.lastTrackedAt,
      topPages: getTopCounters(analytics.pages),
      dailyViews: Object.entries(analytics.days ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, views]) => ({ date, views })),
      topReferrers: getTopCounters(analytics.referrers),
      deviceTypes: getTopCounters(analytics.userAgents),
    },
  }
}

function getPublicCommunityStats(db) {
  let trackedGamesCount = 0
  let tradeListingCount = 0

  for (const user of db.users) {
    const library = user?.syncState?.library && typeof user.syncState.library === 'object' ? user.syncState.library : {}
    const records = Object.values(library).filter((record) => record && typeof record === 'object')

    trackedGamesCount += records.filter((record) => record.status === 'owned' || record.status === 'wanted').length
    tradeListingCount += records.filter((record) => record.status === 'owned' && record.forTrade === true).length
  }

  return {
    userCount: db.users.length,
    trackedGamesCount,
    tradeListingCount,
    generatedAt: new Date().toISOString(),
  }
}
function createDefaultSyncState() {
  return {
    library: {},
    customCatalog: [],
    currencyCode: 'USD',
    barcodeMappings: {},
    activityEvents: [],
    clientUpdatedAt: new Date().toISOString(),
    version: 2,
    profile: {
      displayName: '',
      shelfTagline: '',
    },
    updatedAt: new Date().toISOString(),
  }
}

function getSafeResetAppUrl(rawAppUrl, requestOrigin) {
  const candidates = [rawAppUrl, requestOrigin].map((s) => String(s ?? '').replace(/\/$/, ''))
  return candidates.find((url) => defaultAllowedOrigins.includes(url)) ?? defaultAllowedOrigins[0]
}

function normalizeTradeRequest(raw) {
  return {
    id: String(raw?.id ?? ''),
    fromUserId: String(raw?.fromUserId ?? ''),
    toUserId: String(raw?.toUserId ?? ''),
    gameId: String(raw?.gameId ?? '').slice(0, 200),
    note: String(raw?.note ?? '').slice(0, 500),
    status: ['pending', 'accepted', 'declined'].includes(raw?.status) ? raw.status : 'pending',
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    tradeEdition: typeof raw?.tradeEdition === 'string' ? raw.tradeEdition : null,
    tradeCondition: typeof raw?.tradeCondition === 'string' ? raw.tradeCondition : null,
    tradeVariant: typeof raw?.tradeVariant === 'string' ? raw.tradeVariant.slice(0, 80) : null,
    tradeCopyIndex: Number.isInteger(raw?.tradeCopyIndex) ? raw.tradeCopyIndex : null,
  }
}

function normalizeMessage(raw) {
  return {
    id: String(raw?.id ?? ''),
    tradeRequestId: String(raw?.tradeRequestId ?? ''),
    senderUserId: String(raw?.senderUserId ?? ''),
    text: String(raw?.text ?? '').slice(0, 2000),
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    readAt: typeof raw?.readAt === 'string' ? raw.readAt : null,
  }
}

function normalizeEmailCampaign(raw) {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  return {
    id: String(raw.id ?? createId()),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    subject: String(raw.subject ?? '').slice(0, 140),
    audience: String(raw.audience ?? 'members').slice(0, 40),
    campaignType: String(raw.campaignType ?? 'site_update').slice(0, 40),
    recipientCount: Number(raw.recipientCount) || 0,
    sentCount: Number(raw.sentCount) || 0,
    failedCount: Number(raw.failedCount) || 0,
    skippedCount: Number(raw.skippedCount) || 0,
    testEmail: raw.testEmail ? String(raw.testEmail).toLowerCase() : null,
  }
}

function normalizeEmailSuppression(raw) {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const email = String(raw.email ?? '').trim().toLowerCase()

  if (!email) {
    return null
  }

  return {
    email,
    audience: ['members', 'newsletter', 'both'].includes(String(raw.audience ?? 'both'))
      ? String(raw.audience ?? 'both')
      : 'both',
    reason: String(raw.reason ?? 'manual').trim().slice(0, 120) || 'manual',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const blockedRecipientDomains = new Set([
  'example.com',
  'example.org',
  'example.net',
  'invalid',
  'localhost',
  'test.com',
])

const blockedRecipientLocalPatterns = [/^collector$/i, /^codex-test/i, /^example/i, /^test([+._-].*)?$/i]

function getEmailSuppressionSecret() {
  return String(
    process.env.EMAIL_UNSUBSCRIBE_SECRET ??
      process.env.RESEND_API_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      getAdminKey() ??
      'retro-vault-elite-email',
  )
}

function buildEmailSuppressionToken(email, audience) {
  return createHash('sha256')
    .update(`${String(email).trim().toLowerCase()}::${String(audience)}::${getEmailSuppressionSecret()}`)
    .digest('hex')
}

function buildUnsubscribeUrl(email, audience) {
  const params = new URLSearchParams({
    email: String(email).trim().toLowerCase(),
    audience: String(audience),
    token: buildEmailSuppressionToken(email, audience),
  })
  return `${backendPublicUrl}/email/unsubscribe?${params.toString()}`
}

function isSuppressedForAudience(entryAudience, requestedAudience) {
  return entryAudience === 'both' || requestedAudience === 'both' || entryAudience === requestedAudience
}

function isEmailSuppressed(db, email, audience = 'members') {
  return (db.emailSuppressions ?? []).some(
    (entry) => entry?.email === email && isSuppressedForAudience(String(entry.audience ?? 'both'), audience),
  )
}

function removeEmailSuppression(db, email, audience = 'newsletter') {
  db.emailSuppressions = (db.emailSuppressions ?? []).filter(
    (entry) => !(entry?.email === email && isSuppressedForAudience(String(entry.audience ?? 'both'), audience)),
  )
}

function addEmailSuppression(db, email, audience = 'both', reason = 'manual') {
  const normalized = normalizeEmailSuppression({
    email,
    audience,
    reason,
    createdAt: new Date().toISOString(),
  })

  if (!normalized) {
    return
  }

  const existing = (db.emailSuppressions ?? []).find(
    (entry) => entry.email === normalized.email && String(entry.audience ?? 'both') === normalized.audience,
  )

  if (existing) {
    existing.reason = normalized.reason
    existing.createdAt = normalized.createdAt
    return
  }

  db.emailSuppressions = [normalized, ...(db.emailSuppressions ?? [])].slice(0, 2000)
}

function getRecipientSkipReason(db, email, audience = 'members') {
  if (!isValidEmail(email)) {
    return 'invalid email format'
  }

  const [localPart = '', domain = ''] = email.split('@')

  if (blockedRecipientDomains.has(domain)) {
    return `blocked test domain (${domain})`
  }

  if (blockedRecipientLocalPatterns.some((pattern) => pattern.test(localPart))) {
    return 'blocked test address'
  }

  if (isEmailSuppressed(db, email, audience)) {
    return 'unsubscribed or previously suppressed'
  }

  return ''
}

function getRecipientLists(db) {
  const memberEmails = [...new Set(db.users.map((user) => String(user.email ?? '').trim().toLowerCase()).filter(Boolean))]
  const newsletterEmails = [
    ...new Set(db.newsletterSubscribers.map((entry) => String(entry.email ?? '').trim().toLowerCase()).filter(Boolean)),
  ]

  return { memberEmails, newsletterEmails }
}

function resolveCampaignRecipients(db, audience = 'members') {
  const { memberEmails, newsletterEmails } = getRecipientLists(db)
  const skipped = []

  const filterRecipients = (emails, targetAudience) =>
    emails.filter((email) => {
      const reason = getRecipientSkipReason(db, email, targetAudience)
      if (!reason) {
        return true
      }
      skipped.push({ email, reason, audience: targetAudience })
      return false
    })

  if (audience === 'newsletter') {
    return { recipients: filterRecipients(newsletterEmails, 'newsletter'), skipped }
  }

  if (audience === 'both') {
    return { recipients: filterRecipients([...new Set([...memberEmails, ...newsletterEmails])], 'both'), skipped }
  }

  return { recipients: filterRecipients(memberEmails, 'members'), skipped }
}

const blockedSenderDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
])

function extractSenderEmail(from) {
  const match = String(from ?? '').match(/<([^>]+)>/)
  return String(match?.[1] ?? from ?? '').trim().toLowerCase()
}

function getEmailDeliveryHealth() {
  const apiKey = String(process.env.RESEND_API_KEY ?? '').trim()
  const from = String(process.env.RESET_FROM_EMAIL ?? '').trim()
  const senderEmail = extractSenderEmail(from)
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@').pop() : ''
  const warnings = []

  if (!apiKey) {
    warnings.push('RESEND_API_KEY is missing on the backend.')
  }

  if (!from) {
    warnings.push('RESET_FROM_EMAIL is missing on the backend.')
  }

  if (senderDomain && blockedSenderDomains.has(senderDomain)) {
    warnings.push(`The sender domain ${senderDomain} is a mailbox domain. Resend usually requires a verified custom domain sender.`)
  }

  return {
    provider: 'Resend',
    ready: warnings.length === 0,
    apiKeyConfigured: Boolean(apiKey),
    fromConfigured: Boolean(from),
    from,
    senderEmail,
    senderDomain,
    warnings,
  }
}

function getRecentCommitSubjects(limit = 18) {
  try {
    const raw = execFileSync('git', ['log', '-n', String(limit), '--pretty=%s'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .toString('utf8')
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)

    return raw
  } catch {
    return []
  }
}

function pushUniqueLine(lines, line, limit = 6) {
  if (!line || lines.includes(line) || lines.length >= limit) {
    return
  }

  lines.push(line)
}

function getAdminEmailDraft(campaignType = 'site_update') {
  const subjects = getRecentCommitSubjects(18)
  const added = []
  const fixed = []
  const testing = []

  for (const subject of subjects) {
    const clean = String(subject).replace(/^\s+|\s+$/g, '')

    if (!clean) {
      continue
    }

    if (/^(fix|repair|tighten|refine|prewarm|show)\b/i.test(clean)) {
      pushUniqueLine(fixed, clean)
    } else {
      pushUniqueLine(added, clean)
    }

    if (/mobile|homepage|layout|hero/i.test(clean)) {
      pushUniqueLine(testing, 'Please test the homepage and mobile layout on phone and desktop.')
    }

    if (/cover|detail modal|details/i.test(clean)) {
      pushUniqueLine(testing, 'Please open a few game details and make sure cover art loads cleanly.')
    }

    if (/admin|newsletter|email/i.test(clean)) {
      pushUniqueLine(testing, 'Please test admin email sending and confirm updates arrive correctly.')
    }

    if (/trade|collector/i.test(clean)) {
      pushUniqueLine(testing, 'Please test trade discovery, inbox flow, and collector browsing again.')
    }
  }

  if (!added.length) {
    pushUniqueLine(added, 'Collector experience improvements are continuing across the vault.')
  }

  if (!fixed.length) {
    pushUniqueLine(fixed, 'Small polish and stability fixes were shipped across the site.')
  }

  if (!testing.length) {
    pushUniqueLine(testing, 'Please jump back in on desktop and mobile and let me know what still feels rough.')
  }

  if (campaignType === 'newsletter') {
    return {
      campaignType: 'newsletter',
      audience: 'newsletter',
      subject: 'Retro Vault Elite weekly collector watchlist',
      ctaLabel: 'Open the vault',
      intro:
        'Here is this week\'s Retro Vault Elite collector watchlist: a quick note on what changed in the vault, what collectors should keep an eye on, and what is worth checking this week.',
      added,
      fixed,
      testing,
      closing:
        'Thanks for following along. If anything feels off, rough, or missing, reach out through the site support page and let me know.',
      sourceCount: subjects.length,
    }
  }

  return {
    campaignType: 'site_update',
    audience: 'members',
    subject: 'Retro Vault Elite weekly member update',
    ctaLabel: 'Open Retro Vault Elite',
    intro:
      'Quick update from Retro Vault Elite. Thank you for signing up and helping shape the vault with your feedback. Here is what has been added, fixed, and what would still be useful to test.',
    added,
    fixed,
    testing,
    closing:
      'If you have a minute, please jump back in and let me know what still feels rough, confusing, or missing. Collector feedback is driving what gets improved next.',
    sourceCount: subjects.length,
  }
}

async function sendTradeNotificationEmail(email, subject, intro, ctaLabel = 'Open Trade Inbox') {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESET_FROM_EMAIL
  const appUrl = defaultAllowedOrigins[0] ?? 'https://www.retrovaultelite.com'

  if (!apiKey || !from) {
    console.log(`[trade-notify] ${email}: ${subject}`)
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: email,
        subject: `Retro Vault Elite  ${subject}`,
        html: `<p>${intro}</p><p><a href="${appUrl}">${ctaLabel}</a></p><p>Do not reply. Never share personal details over this system.</p>`,
      }),
    })
    if (!res.ok) console.error('Trade notification email failed:', res.status)
  } catch (err) {
    console.error('Trade notification email error:', err?.message)
  }
}

async function sendAdminBroadcastEmail(email, payload) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESET_FROM_EMAIL
  const appUrl = defaultAllowedOrigins[0] ?? 'https://www.retrovaultelite.com'

  if (!apiKey || !from) {
    throw new Error('Broadcast email is not configured. Add RESEND_API_KEY and RESET_FROM_EMAIL first.')
  }

  const {
    subject,
    intro,
    added,
    fixed,
    testing,
    closing,
    ctaLabel = 'Open Retro Vault Elite',
    campaignType = 'site_update',
    audience = 'members',
  } = payload

  const unsubscribeUrl = buildUnsubscribeUrl(email, audience)

  const sections =
    campaignType === 'newsletter'
      ? {
          addedTitle: 'Collector watchlist',
          fixedTitle: 'What changed in the vault',
          testingTitle: 'Worth checking this week',
          footer: 'You are receiving this because you joined the Retro Vault Elite newsletter.',
          unsubscribeLabel: 'Unsubscribe from these emails',
        }
      : {
          addedTitle: 'What is new',
          fixedTitle: 'What was fixed',
          testingTitle: 'What still needs testing',
          footer: 'You are receiving this because you created an account on Retro Vault Elite.',
          unsubscribeLabel: 'Stop member update emails',
        }

  const makeList = (items) => {
    if (!items.length) {
      return '<p style="margin:0 0 18px">Nothing listed in this section yet.</p>'
    }

    return `<ul style="margin:0 0 18px; padding-left:20px">${items
      .map((item) => `<li style="margin:0 0 8px">${item}</li>`)
      .join('')}</ul>`
  }

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif; color:#0f1724; line-height:1.6">
      <p>${intro}</p>
      <h2 style="margin:24px 0 10px; color:#0f1724">${sections.addedTitle}</h2>
      ${makeList(added)}
      <h2 style="margin:24px 0 10px; color:#0f1724">${sections.fixedTitle}</h2>
      ${makeList(fixed)}
      <h2 style="margin:24px 0 10px; color:#0f1724">${sections.testingTitle}</h2>
      ${makeList(testing)}
      <p>${closing}</p>
      <p style="margin:24px 0">
        <a href="${appUrl}" style="display:inline-block; padding:12px 18px; border-radius:999px; background:#ffcf63; color:#1a1004; text-decoration:none; font-weight:800">
          ${ctaLabel}
        </a>
      </p>
      <p style="color:#526072; font-size:13px">${sections.footer}</p>
      <p style="color:#526072; font-size:13px; margin-top:10px">
        <a href="${unsubscribeUrl}" style="color:#526072">${sections.unsubscribeLabel}</a>
      </p>
    </div>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: `Retro Vault Elite - ${subject}`,
      html,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Broadcast email failed (${response.status}): ${errorText || response.statusText}`)
  }
}

async function sendPasswordResetEmail(email, resetLink) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESET_FROM_EMAIL

  if (!apiKey || !from) {
    console.log(`Password reset link for ${email}: ${resetLink}`)
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Reset your Retro Vault Elite password',
      html: `<p>Use this secure link to reset your Retro Vault Elite password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  })

  if (!response.ok) {
    throw new Error('Password reset email could not be sent.')
  }
}

function isHardEmailFailure(message) {
  return /invalid|not found|unknown user|mailbox unavailable|recipient address rejected|suppressed|bounce|blacklist|does not exist|not verified/i.test(
    String(message ?? ''),
  )
}

function renderUnsubscribeResponse(email, audience, ok) {
  const safeEmail = String(email ?? '').replace(/[<&>"]/g, '')
  const safeAudience = String(audience ?? '').replace(/[<&>"]/g, '')
  const title = ok ? 'Email preference updated' : 'Unsubscribe link invalid'
  const message = ok
    ? `You will no longer receive ${safeAudience === 'newsletter' ? 'newsletter emails' : safeAudience === 'members' ? 'member update emails' : 'Retro Vault Elite campaign emails'} at ${safeEmail}.`
    : 'That unsubscribe link is missing something important or could not be verified.'

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        :root { color-scheme: dark; }
        body {
          margin: 0;
          font-family: "Segoe UI", Arial, sans-serif;
          color: #f5f8ff;
          background: linear-gradient(180deg, #132033 0%, #08111b 100%);
        }
        main {
          width: min(720px, calc(100% - 28px));
          margin: 0 auto;
          padding: 48px 0;
        }
        section {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(15, 25, 38, 0.94);
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 22px 80px rgba(0, 0, 0, 0.34);
        }
        h1 { margin: 0 0 12px; font-size: clamp(2rem, 5vw, 3rem); line-height: 0.96; }
        p { margin: 0 0 12px; color: #aebed0; line-height: 1.6; }
        a {
          display: inline-block;
          margin-top: 8px;
          padding: 12px 18px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 800;
          background: linear-gradient(135deg, #ff9f35, #ffd76b);
          color: #1a1004;
        }
      </style>
    </head>
    <body>
      <main>
        <section>
          <h1>${title}</h1>
          <p>${message}</p>
          <p>You can still browse the site any time.</p>
          <a href="${defaultAllowedOrigins[0]}">Open Retro Vault Elite</a>
        </section>
      </main>
    </body>
  </html>`
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    json(request, response, 404, { error: 'Not found.' })
    return
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    })
    response.end()
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)

  try {
    const accountRoute =
      url.pathname.startsWith('/auth') ||
      url.pathname === '/sync' ||
      request.method === 'PUT' && url.pathname.startsWith('/barcode/') ||
      url.pathname.startsWith('/admin/barcodes') ||
      url.pathname === '/admin/stats' ||
      url.pathname === '/admin/email-draft' ||
      url.pathname === '/admin/broadcast-email' ||
      url.pathname === '/email/unsubscribe' ||
      url.pathname.startsWith('/trade/')
    const db = await loadDb({ required: accountRoute })
    pruneSecurityState(db)

    if (request.method === 'GET' && url.pathname === '/health') {
      json(request, response, 200, { ok: true, storage: lastStorageStatus })
      return
    }

    if (request.method === 'POST' && url.pathname === '/analytics/page-view') {
      if (!rateLimit(request, 'analytics', 240, 60 * 1000)) {
        json(request, response, 429, { error: 'Too many analytics events.' })
        return
      }

      const body = await readBody(request)
      recordPageView(db, request, body)
      await saveDb(db)
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/newsletter/subscribe') {
      if (!rateLimit(request, 'newsletter', 8, 15 * 60 * 1000)) {
        json(request, response, 429, { error: 'Too many signup attempts. Please wait and try again.' })
        return
      }

      const body = await readBody(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const source = String(body.source ?? 'site').trim().slice(0, 80)

      if (!isValidEmail(email)) {
        json(request, response, 400, { error: 'Enter a valid email address.' })
        return
      }

      const existing = db.newsletterSubscribers.find((entry) => entry.email === email)

      if (existing) {
        existing.source = existing.source || source
        existing.updatedAt = new Date().toISOString()
      } else {
        db.newsletterSubscribers.push({
          email,
          source,
          createdAt: new Date().toISOString(),
        })
      }

      removeEmailSuppression(db, email, 'newsletter')

      await saveDb(db)
      json(request, response, 200, { ok: true, message: 'You are on the Retro Vault market movers list.' })
      return
    }

    if (request.method === 'GET' && url.pathname === '/email/unsubscribe') {
      const email = String(url.searchParams.get('email') ?? '').trim().toLowerCase()
      const audience = ['members', 'newsletter', 'both'].includes(String(url.searchParams.get('audience') ?? 'members'))
        ? String(url.searchParams.get('audience') ?? 'members')
        : 'members'
      const token = String(url.searchParams.get('token') ?? '').trim()
      const valid = Boolean(email) && token === buildEmailSuppressionToken(email, audience)

      if (valid) {
        addEmailSuppression(db, email, audience, 'unsubscribe-link')
        if (audience === 'newsletter' || audience === 'both') {
          db.newsletterSubscribers = db.newsletterSubscribers.filter((entry) => String(entry.email ?? '').trim().toLowerCase() !== email)
        }
        await saveDb(db)
      }

      response.writeHead(valid ? 200 : 400, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Cache-Control': 'no-store',
      })
      response.end(renderUnsubscribeResponse(email, audience, valid))
      return
    }

    if (request.method === 'GET' && url.pathname === '/admin/stats') {
      if (!getAdminKey()) {
        json(request, response, 503, { error: 'Admin reporting is not configured.' })
        return
      }

      if (!isAdminRequest(request, url)) {
        json(request, response, 401, { error: 'Admin key required.' })
        return
      }

      json(request, response, 200, getAdminStats(db))
      return
    }

    if (request.method === 'GET' && url.pathname === '/admin/email-draft') {
      if (!getAdminKey()) {
        json(request, response, 503, { error: 'Admin reporting is not configured.' })
        return
      }

      if (!isAdminRequest(request, url)) {
        json(request, response, 401, { error: 'Admin key required.' })
        return
      }

      const campaignType = ['site_update', 'newsletter'].includes(String(url.searchParams.get('campaignType') ?? 'site_update'))
        ? String(url.searchParams.get('campaignType') ?? 'site_update')
        : 'site_update'

      json(request, response, 200, getAdminEmailDraft(campaignType))
      return
    }

    if (request.method === 'GET' && url.pathname === '/stats/public') {
      json(request, response, 200, getPublicCommunityStats(db))
      return
    }

    if (request.method === 'POST' && url.pathname === '/admin/broadcast-email') {
      if (!getAdminKey()) {
        json(request, response, 503, { error: 'Admin reporting is not configured.' })
        return
      }

      if (!isAdminRequest(request, url)) {
        json(request, response, 401, { error: 'Admin key required.' })
        return
      }

      const body = await readBody(request)
      const subject = String(body.subject ?? '').trim().slice(0, 140)
      const intro = String(body.intro ?? '').trim().slice(0, 1200)
      const closing = String(body.closing ?? '').trim().slice(0, 800)
      const ctaLabel = String(body.ctaLabel ?? 'Open Retro Vault Elite').trim().slice(0, 60) || 'Open Retro Vault Elite'
      const audience = ['members', 'newsletter', 'both'].includes(String(body.audience ?? 'members'))
        ? String(body.audience ?? 'members')
        : 'members'
      const campaignType = ['site_update', 'newsletter'].includes(String(body.campaignType ?? 'site_update'))
        ? String(body.campaignType ?? 'site_update')
        : 'site_update'
      const testEmail = String(body.testEmail ?? '').trim().toLowerCase()
      const added = Array.isArray(body.added) ? body.added.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 12) : []
      const fixed = Array.isArray(body.fixed) ? body.fixed.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 12) : []
      const testing = Array.isArray(body.testing) ? body.testing.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 12) : []

      if (!subject) {
        json(request, response, 400, { error: 'Add an email subject first.' })
        return
      }

      if (!intro) {
        json(request, response, 400, { error: 'Add a short intro first.' })
        return
      }

      if (!closing) {
        json(request, response, 400, { error: 'Add a closing note first.' })
        return
      }

      if (testEmail && !isValidEmail(testEmail)) {
        json(request, response, 400, { error: 'Enter a valid test email address.' })
        return
      }

      const recipientPlan = testEmail
        ? { recipients: [testEmail], skipped: [] }
        : resolveCampaignRecipients(db, audience)
      const recipients = recipientPlan.recipients
      const skipped = recipientPlan.skipped

      if (!recipients.length) {
        json(request, response, 400, {
          error: skipped.length ? 'No eligible recipients were left after skipping suppressed or test addresses.' : 'No recipients were found for that audience.',
          skippedCount: skipped.length,
          skipped: skipped.slice(0, 20),
        })
        return
      }

      let sentCount = 0
      const failures = []
      const batchSize = 4
      const batchDelayMs = 1100

      for (let index = 0; index < recipients.length; index += batchSize) {
        const batch = recipients.slice(index, index + batchSize)
        const results = await Promise.allSettled(
          batch.map((email) =>
            sendAdminBroadcastEmail(email, {
              subject,
              intro,
              added,
              fixed,
              testing,
              closing,
              ctaLabel,
              campaignType,
              audience,
            }).then(() => email),
          ),
        )

        for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
          const result = results[resultIndex]
          const email = batch[resultIndex]

          if (result.status === 'fulfilled') {
            sentCount += 1
            continue
          }

          failures.push({
            email,
            message: result.reason instanceof Error ? result.reason.message : 'Unknown email error.',
          })

          if (!testEmail && isHardEmailFailure(result.reason instanceof Error ? result.reason.message : '')) {
            addEmailSuppression(db, email, audience, 'hard-email-failure')
          }
        }

        if (index + batchSize < recipients.length) {
          await sleep(batchDelayMs)
        }
      }

      if (!testEmail) {
        db.emailCampaigns = [
          normalizeEmailCampaign({
            id: createId(),
            createdAt: new Date().toISOString(),
            subject,
            audience,
            campaignType,
            recipientCount: recipients.length,
            sentCount,
            failedCount: failures.length,
            skippedCount: skipped.length,
          }),
          ...(db.emailCampaigns ?? []),
        ].filter(Boolean).slice(0, 40)
        await saveDb(db)
      }

      json(request, response, failures.length ? 207 : 200, {
        ok: failures.length === 0,
        mode: testEmail ? 'test' : 'broadcast',
        audience,
        campaignType,
        sentCount,
        failedCount: failures.length,
        skippedCount: skipped.length,
        totalCount: recipients.length,
        failures: failures.slice(0, 20),
        skipped: skipped.slice(0, 20),
        message: testEmail
          ? failures.length
            ? 'Test email finished with failures.'
            : 'Test email sent successfully.'
          : failures.length
            ? 'Broadcast finished with failures.'
            : 'Broadcast sent successfully.',
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/admin/barcodes') {
      if (!getAdminKey()) {
        json(request, response, 503, { error: 'Admin reporting is not configured.' })
        return
      }

      if (!isAdminRequest(request, url)) {
        json(request, response, 401, { error: 'Admin key required.' })
        return
      }

      const mappings = Object.entries(db.sharedBarcodeMappings ?? {})
        .map(([code, entry]) => ({
          code,
          gameId: entry.gameId,
          source: entry.source ?? 'admin',
          updatedAt: entry.updatedAt ?? null,
        }))
        .sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')))

      json(request, response, 200, {
        count: mappings.length,
        mappings,
      })
      return
    }

    if (request.method === 'PUT' && url.pathname === '/admin/barcodes') {
      if (!getAdminKey()) {
        json(request, response, 503, { error: 'Admin reporting is not configured.' })
        return
      }

      if (!isAdminRequest(request, url)) {
        json(request, response, 401, { error: 'Admin key required.' })
        return
      }

      const body = await readBody(request)
      const replace = body.replace === true
      const mappings = Array.isArray(body.mappings) ? body.mappings : []
      const importedCount = upsertSharedBarcodeMappings(db, mappings, { replace })

      if (!importedCount) {
        json(request, response, 400, { error: 'No valid barcode mappings were provided.' })
        return
      }

      await saveDb(db, { required: true })
      json(request, response, 200, {
        ok: true,
        importedCount,
        totalCount: Object.keys(db.sharedBarcodeMappings ?? {}).length,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      if (!rateLimit(request, 'register', 12, 15 * 60 * 1000)) {
        json(request, response, 429, { error: 'Too many sign-up attempts. Please wait and try again.' })
        return
      }

      const body = await readBody(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const displayName = normalizeDisplayName(body.displayName)

      if (!isValidEmail(email)) {
        json(request, response, 400, { error: 'Enter a valid email address.' })
        return
      }

      const passwordError = validatePassword(password)
      if (passwordError) {
        json(request, response, 400, { error: passwordError })
        return
      }

      if (db.users.some((entry) => entry.email === email)) {
        json(request, response, 409, { error: 'An account already exists for that email.' })
        return
      }

      if (isDisplayNameTaken(db, displayName)) {
        json(request, response, 409, { error: 'That display name is already taken.' })
        return
      }

      const user = {
        id: randomBytes(12).toString('hex'),
        email,
        displayName,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        syncState: createDefaultSyncState(),
      }
      user.syncState.profile.displayName = displayName

      db.users.push(user)
      const token = generateToken()
      db.sessions.push({
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
      })
      await saveDb(db, { required: true })
      json(request, response, 201, { token, user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      if (!rateLimit(request, 'login', 20, 15 * 60 * 1000)) {
        json(request, response, 429, { error: 'Too many sign-in attempts. Please wait and try again.' })
        return
      }

      const body = await readBody(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const user = db.users.find((entry) => entry.email === email)

      if (!user) {
        json(request, response, 404, { error: 'No account was found for that email.' })
        return
      }

      if (!verifyPassword(password, user.passwordHash)) {
        json(request, response, 401, { error: 'Incorrect password.' })
        return
      }

      const token = generateToken()
      db.sessions.push({
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
      })
      await saveDb(db, { required: true })
      json(request, response, 200, { token, user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      const authHeader = request.headers.authorization
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

      if (token) {
        db.sessions = db.sessions.filter((entry) => entry.token !== token)
        await saveDb(db, { required: true })
      }

      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/password-reset') {
      if (!rateLimit(request, 'password-reset', 5, 15 * 60 * 1000)) {
        json(request, response, 429, { error: 'Too many reset requests. Please wait and try again.' })
        return
      }

      const body = await readBody(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const appUrl = getSafeResetAppUrl(body.appUrl, request.headers.origin)

      if (!isValidEmail(email)) {
        json(request, response, 400, { error: 'Enter a valid email address.' })
        return
      }

      const user = db.users.find((entry) => entry.email === email)

      if (user) {
        const token = generateToken()
        db.passwordResets = db.passwordResets.filter((entry) => entry.userId !== user.id)
        db.passwordResets.push({
          tokenHash: hashToken(token),
          userId: user.id,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + resetTtlMs).toISOString(),
        })
        await saveDb(db, { required: true })
        const resetLink = `${appUrl}/?resetToken=${encodeURIComponent(token)}`
        await sendPasswordResetEmail(email, resetLink)
      }

      json(request, response, 200, { ok: true, message: 'If an account exists, a password reset email has been sent.' })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/password-reset/confirm') {
      if (!rateLimit(request, 'password-reset-confirm', 10, 15 * 60 * 1000)) {
        json(request, response, 429, { error: 'Too many attempts. Please wait and try again.' })
        return
      }

      const body = await readBody(request)
      const token = String(body.token ?? '').trim()
      const password = String(body.password ?? '')
      const reset = db.passwordResets.find((entry) => entry.tokenHash === hashToken(token))

      if (!reset || new Date(reset.expiresAt).getTime() < Date.now()) {
        json(request, response, 400, { error: 'That password reset link is invalid or expired.' })
        return
      }

      const passwordError = validatePassword(password)
      if (passwordError) {
        json(request, response, 400, { error: passwordError })
        return
      }

      const user = db.users.find((entry) => entry.id === reset.userId)
      if (!user) {
        json(request, response, 404, { error: 'Account not found.' })
        return
      }

      user.passwordHash = hashPassword(password)
      db.passwordResets = db.passwordResets.filter((entry) => entry.tokenHash !== hashToken(token))
      db.sessions = db.sessions.filter((entry) => entry.userId !== user.id)
      await saveDb(db, { required: true })
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && url.pathname === '/auth/me') {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      json(request, response, 200, { user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'PATCH' && url.pathname === '/auth/me') {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      const body = await readBody(request)
      const displayName = normalizeDisplayName(body.displayName)

      if (isDisplayNameTaken(db, displayName, user.id)) {
        json(request, response, 409, { error: 'That display name is already taken.' })
        return
      }

      user.displayName = displayName
      user.syncState = {
        ...createDefaultSyncState(),
        ...(user.syncState ?? {}),
        profile: {
          ...(user.syncState?.profile ?? {}),
          displayName,
        },
        updatedAt: new Date().toISOString(),
      }
      await saveDb(db, { required: true })
      json(request, response, 200, { user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/change-password') {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      const body = await readBody(request)
      const currentPassword = String(body.currentPassword ?? '')
      const nextPassword = String(body.nextPassword ?? '')

      if (!verifyPassword(currentPassword, user.passwordHash)) {
        json(request, response, 401, { error: 'Current password is incorrect.' })
        return
      }

      const passwordError = validatePassword(nextPassword)
      if (passwordError) {
        json(request, response, 400, { error: passwordError })
        return
      }

      user.passwordHash = hashPassword(nextPassword)
      await saveDb(db, { required: true })
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'DELETE' && url.pathname === '/auth/me') {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      db.users = db.users.filter((entry) => entry.id !== user.id)
      db.sessions = db.sessions.filter((entry) => entry.userId !== user.id)
      db.passwordResets = db.passwordResets.filter((entry) => entry.userId !== user.id)
      await saveDb(db, { required: true })
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && url.pathname === '/sync') {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      json(request, response, 200, { syncState: user.syncState })
      return
    }

    if (request.method === 'PUT' && url.pathname === '/sync') {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      const body = await readBody(request)
      const rawLibrary = body.library && typeof body.library === 'object' ? body.library : {}
      const rawBarcodes = body.barcodeMappings && typeof body.barcodeMappings === 'object' ? body.barcodeMappings : {}
      user.syncState = {
        library: Object.fromEntries(Object.entries(rawLibrary).slice(0, MAX_LIBRARY_ENTRIES)),
        customCatalog: Array.isArray(body.customCatalog) ? body.customCatalog.slice(0, MAX_CATALOG_ENTRIES) : [],
        currencyCode: body.currencyCode ?? 'USD',
        barcodeMappings: Object.fromEntries(Object.entries(rawBarcodes).slice(0, MAX_BARCODE_MAPPINGS)),
        activityEvents: Array.isArray(body.activityEvents) ? body.activityEvents.slice(0, 250) : user.syncState?.activityEvents ?? [],
        clientUpdatedAt: typeof body.clientUpdatedAt === 'string' ? body.clientUpdatedAt : new Date().toISOString(),
        version: typeof body.version === 'number' ? body.version : 1,
        profile: body.profile ?? user.syncState?.profile ?? { displayName: user.displayName ?? '', shelfTagline: '' },
        updatedAt: new Date().toISOString(),
      }
      await saveDb(db, { required: true })
      json(request, response, 200, { syncState: user.syncState })
      return
    }

    if (request.method === 'GET' && url.pathname.startsWith('/barcode/')) {
      const user = await getSessionUser(request, db)

      if (!user) {
        const code = decodeURIComponent(url.pathname.slice('/barcode/'.length))
        const sharedMapping = getSharedBarcodeMapping(db, code)

        if (!sharedMapping) {
          json(request, response, 200, { code: normalizeBarcodeCode(code), gameId: null, source: null })
          return
        }

        json(request, response, 200, {
          code: normalizeBarcodeCode(code),
          gameId: sharedMapping.gameId,
          source: sharedMapping.source ?? 'shared',
        })
        return
      }

      const code = decodeURIComponent(url.pathname.slice('/barcode/'.length))
      const normalizedCode = normalizeBarcodeCode(code)
      const gameId = user.syncState.barcodeMappings?.[normalizedCode] ?? getSharedBarcodeMapping(db, normalizedCode)?.gameId ?? null
      const source = user.syncState.barcodeMappings?.[normalizedCode] ? 'account' : getSharedBarcodeMapping(db, normalizedCode)?.source ?? null
      json(request, response, 200, { code: normalizedCode, gameId, source })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/barcode/')) {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      const code = normalizeBarcodeCode(decodeURIComponent(url.pathname.slice('/barcode/'.length)))
      const body = await readBody(request)
      const gameId = String(body.gameId ?? '').trim()

      if (!gameId) {
        json(request, response, 400, { error: 'A game id is required.' })
        return
      }

      user.syncState.barcodeMappings = {
        ...(user.syncState.barcodeMappings ?? {}),
        [code]: gameId,
      }
      user.syncState.updatedAt = new Date().toISOString()
      await saveDb(db, { required: true })
      json(request, response, 200, { code, gameId })
      return
    }

    function sanitizeTradeRequest(tr, viewingUserId, db) {
      const fromUser = db.users.find(u => u.id === tr.fromUserId)
      const toUser = db.users.find(u => u.id === tr.toUserId)
      const isIncoming = tr.toUserId === viewingUserId
      const unread = (db.messages ?? []).filter(m => m.tradeRequestId === tr.id && m.senderUserId !== viewingUserId && !m.readAt).length
      const tradeOwner = toUser?.syncState?.library?.[tr.gameId] ?? null
      const tradeOffer = tr.tradeEdition || tr.tradeCondition || tr.tradeVariant
        ? {
            editionStatus: tr.tradeEdition,
            condition: tr.tradeCondition,
            variant: tr.tradeVariant,
            tradeCopyIndex: tr.tradeCopyIndex ?? null,
          }
        : getTradeOfferDetails(tradeOwner)
      return {
        id: tr.id,
        gameId: tr.gameId,
        note: tr.note,
        status: tr.status,
        createdAt: tr.createdAt,
        updatedAt: tr.updatedAt,
        isIncoming,
        fromDisplayName: fromUser?.displayName ?? 'Unknown Collector',
        toDisplayName: toUser?.displayName ?? 'Unknown Collector',
        partnerDisplayName: isIncoming ? (fromUser?.displayName ?? 'Unknown Collector') : (toUser?.displayName ?? 'Unknown Collector'),
        partnerUserId: isIncoming ? (fromUser?.id ?? '') : (toUser?.id ?? ''),
        unreadCount: unread,
        tradeEdition: tradeOffer?.editionStatus ?? null,
        tradeCondition: tradeOffer?.condition ?? null,
        tradeVariant: tradeOffer?.variant ?? null,
        tradeCopyIndex: tradeOffer?.tradeCopyIndex ?? null,
      }
    }

    function getOwnedTradeGameIds(user) {
      const library = user.syncState?.library ?? {}
      return Object.entries(library)
        .filter(([, record]) => record?.status === 'owned' && record?.forTrade === true)
        .map(([gameId]) => gameId)
    }

    function getOwnedGameIds(user) {
      const library = user.syncState?.library ?? {}
      return Object.entries(library)
        .filter(([, record]) => record?.status === 'owned')
        .map(([gameId]) => gameId)
    }

    function getWantedGameIds(user) {
      const library = user.syncState?.library ?? {}
      return Object.entries(library)
        .filter(([, record]) => record?.status === 'wanted')
        .map(([gameId]) => gameId)
    }

    function getPreferredTradeOfferGameId(fromUser, toUser) {
      const offeredIds = getOwnedTradeGameIds(fromUser)
      const wantedIds = new Set(getWantedGameIds(toUser))
      return offeredIds.find((gameId) => wantedIds.has(gameId)) ?? null
    }

    function getTradeOfferDetails(record) {
      if (!record || record.status !== 'owned') return null
      const tradeCopyIndex = Array.isArray(record.copies) ? record.copies.findIndex((copy) => copy?.forTrade) : -1
      const tradeCopy = tradeCopyIndex >= 0 ? record.copies[tradeCopyIndex] : null
      const editionStatus = String(tradeCopy?.edition ?? record.editionStatus ?? 'loose')
      const condition = String(tradeCopy?.condition ?? record.condition ?? 'good')
      const variant = typeof tradeCopy?.variant === 'string' && tradeCopy.variant.trim()
        ? tradeCopy.variant.trim().slice(0, 80)
        : typeof record.variant === 'string' && record.variant.trim()
          ? record.variant.trim().slice(0, 80)
          : ''
      return {
        editionStatus,
        condition,
        variant,
        tradeCopyIndex: tradeCopyIndex >= 0 ? tradeCopyIndex : null,
      }
    }

    function hasPendingTradeForGame(db, viewerUserId, otherUserId, gameId) {
      return (db.tradeRequests ?? []).some((request) =>
        request.status === 'pending' &&
        request.gameId === gameId &&
        ((request.fromUserId === viewerUserId && request.toUserId === otherUserId) ||
          (request.fromUserId === otherUserId && request.toUserId === viewerUserId))
      )
    }

    function shuffleArray(values) {
      const clone = [...values]
      for (let index = clone.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]]
      }
      return clone
    }

    if (request.method === 'POST' && url.pathname === '/trade/availability') {
      const viewer = await getSessionUser(request, db)
      const body = await readBody(request)
      const gameIds = Array.isArray(body.gameIds) ? body.gameIds.map((value) => String(value ?? '').trim()).filter(Boolean) : []
      const viewerId = viewer?.id ?? null
      const availability = gameIds.map((gameId) => {
        const count = db.users.reduce((total, user) => {
          if (viewerId && user.id === viewerId) return total
          return total + (getOwnedTradeGameIds(user).includes(gameId) ? 1 : 0)
        }, 0)
        return { gameId, count }
      })
      json(request, response, 200, { availability })
      return
    }

    if (request.method === 'GET' && url.pathname === '/trade/availability-game-ids') {
      const viewer = await getSessionUser(request, db)
      const viewerId = viewer?.id ?? null
      const gameIds = [...new Set(db.users.flatMap((user) => {
        if (viewerId && user.id === viewerId) return []
        return getOwnedTradeGameIds(user)
      }))]
      json(request, response, 200, { gameIds })
      return
    }

    if (request.method === 'GET' && url.pathname === '/trade/wanted-game-ids') {
      const viewer = await getSessionUser(request, db)
      const viewerId = viewer?.id ?? null
      const gameIds = [...new Set(db.users.flatMap((user) => {
        if (viewerId && user.id === viewerId) return []
        return getWantedGameIds(user)
      }))]
      json(request, response, 200, { gameIds })
      return
    }

    if (request.method === 'GET' && url.pathname.startsWith('/trade/availability/') && url.pathname.endsWith('/owners')) {
      const viewer = await getSessionUser(request, db)
      if (!viewer) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const parts = url.pathname.split('/')
      const gameId = decodeURIComponent(parts[3] ?? '').trim()
      if (!gameId) { json(request, response, 400, { error: 'Game id is required.' }); return }

      const owners = db.users
        .filter((user) => user.id !== viewer.id && getOwnedTradeGameIds(user).includes(gameId))
        .map((user) => {
          const tradeOffer = getTradeOfferDetails(user.syncState?.library?.[gameId])
          return {
            userId: user.id,
            displayName: user.displayName ?? 'Unknown Collector',
            hasPendingRequest: hasPendingTradeForGame(db, viewer.id, user.id, gameId),
            tradeEdition: tradeOffer?.editionStatus ?? null,
            tradeCondition: tradeOffer?.condition ?? null,
            tradeVariant: tradeOffer?.variant ?? null,
          }
        })
      json(request, response, 200, { gameId, owners })
      return
    }

    if (request.method === 'POST' && url.pathname === '/trade/wanted') {
      const viewer = await getSessionUser(request, db)
      const body = await readBody(request)
      const gameIds = Array.isArray(body.gameIds) ? body.gameIds.map((value) => String(value ?? '').trim()).filter(Boolean) : []
      const viewerId = viewer?.id ?? null
      const demand = gameIds.map((gameId) => {
        const count = db.users.reduce((total, user) => {
          if (viewerId && user.id === viewerId) return total
          const wantedIds = getWantedGameIds(user)
          return total + (wantedIds.includes(gameId) ? 1 : 0)
        }, 0)
        return { gameId, count }
      })
      json(request, response, 200, { demand })
      return
    }
    if (request.method === 'GET' && url.pathname === '/trade/discovery') {
      const viewer = await getSessionUser(request, db)
      if (!viewer) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const myWanted = getWantedGameIds(viewer)
      const myWantedSet = new Set(myWanted)
      const opportunitiesByGameId = new Map()
      const discoveryCandidates = []

      for (const other of db.users) {
        if (other.id === viewer.id) continue

        const otherTradeIds = getOwnedTradeGameIds(other).filter((gameId) => myWantedSet.has(gameId))
        const otherOwnedIds = getOwnedGameIds(other).filter((gameId) => myWantedSet.has(gameId))

        for (const gameId of otherTradeIds) {
          if (!opportunitiesByGameId.has(gameId)) {
            opportunitiesByGameId.set(gameId, {
              gameId,
              ownerCount: 0,
              requestableOwnerCount: 0,
              owners: [],
            })
          }
          const entry = opportunitiesByGameId.get(gameId)
          entry.ownerCount += 1
          const pending = hasPendingTradeForGame(db, viewer.id, other.id, gameId)
          if (!pending) {
            entry.requestableOwnerCount += 1
          }
          entry.owners.push({
            userId: other.id,
            displayName: other.displayName ?? 'Unknown Collector',
            hasPendingRequest: pending,
          })
        }

        if (otherOwnedIds.length > 0) {
          discoveryCandidates.push({
            userId: other.id,
            displayName: other.displayName ?? 'Unknown Collector',
            matchingGameIds: otherOwnedIds,
            featuredGameId: otherOwnedIds[0],
            lastSyncedAt: other.syncState?.updatedAt ?? null,
          })
        }
      }

      const opportunities = Array.from(opportunitiesByGameId.values())
        .map((entry) => ({
          ...entry,
          owners: entry.owners.sort((left, right) => Number(left.hasPendingRequest) - Number(right.hasPendingRequest)).slice(0, 6),
        }))
        .sort((left, right) => {
          if (right.requestableOwnerCount !== left.requestableOwnerCount) {
            return right.requestableOwnerCount - left.requestableOwnerCount
          }
          return right.ownerCount - left.ownerCount
        })

      const opportunityOwnerIds = new Set(opportunities.flatMap((entry) => entry.owners.map((owner) => owner.userId)))
      const collectors = shuffleArray(discoveryCandidates)
        .filter((collector) => !opportunityOwnerIds.has(collector.userId))
        .slice(0, 10)

      json(request, response, 200, { opportunities, collectors })
      return
    }
    // -- Trade: compute matches ------------------------------
    if (request.method === 'GET' && url.pathname === '/trade/matches') {
      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const myLib = user.syncState?.library ?? {}
      const myForTrade = new Set(Object.entries(myLib).filter(([,r]) => r?.status === 'owned' && r?.forTrade === true).map(([id]) => id))
      const myWanted = new Set(Object.entries(myLib).filter(([,r]) => r?.status === 'wanted').map(([id]) => id))

      const matches = []
      for (const other of db.users) {
        if (other.id === user.id) continue
        const otherLib = other.syncState?.library ?? {}
        const otherOwned = new Set(Object.entries(otherLib).filter(([,r]) => r?.status === 'owned' && r?.forTrade === true).map(([id]) => id))
        const otherWanted = new Set(Object.entries(otherLib).filter(([,r]) => r?.status === 'wanted').map(([id]) => id))

        const theyHaveWhatIWant = [...myWanted].filter(id => otherOwned.has(id))
        const iHaveWhatTheyWant = [...myForTrade].filter(id => otherWanted.has(id))

        if (theyHaveWhatIWant.length === 0 && iHaveWhatTheyWant.length === 0) continue

        matches.push({
          userId: other.id,
          displayName: other.displayName ?? 'Unknown Collector',
          theyHaveWhatIWant,
          iHaveWhatTheyWant,
          isMutual: theyHaveWhatIWant.length > 0 && iHaveWhatTheyWant.length > 0,
        })
      }

      matches.sort((a, b) => (b.isMutual ? 1 : 0) - (a.isMutual ? 1 : 0))
      json(request, response, 200, { matches })
      return
    }

    // -- Trade: public profile -------------------------------
    if (request.method === 'GET' && url.pathname.startsWith('/trade/profile/')) {
      const viewer = await getSessionUser(request, db)
      if (!viewer) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const targetId = url.pathname.slice('/trade/profile/'.length)
      const target = db.users.find(u => u.id === targetId)
      if (!target) { json(request, response, 404, { error: 'User not found.' }); return }

      const lib = target.syncState?.library ?? {}
      const ownedGameIds = Object.entries(lib).filter(([,r]) => r?.status === 'owned').map(([id]) => id)
      const wantedGameIds = Object.entries(lib).filter(([,r]) => r?.status === 'wanted').map(([id]) => id)
      const forTradeGameIds = Object.entries(lib).filter(([,r]) => r?.status === 'owned' && r?.forTrade === true).map(([id]) => id)
      const tradeOffersByGameId = Object.fromEntries(
        forTradeGameIds.map((gameId) => [gameId, getTradeOfferDetails(lib[gameId]) ?? { editionStatus: 'loose', condition: 'good' }]),
      )

      json(request, response, 200, {
        userId: target.id,
        displayName: target.displayName ?? 'Unknown Collector',
        ownedGameIds,
        wantedGameIds,
        forTradeGameIds,
        tradeOffersByGameId,
      })
      return
    }

    // -- Trade: create request -------------------------------
    if (request.method === 'POST' && url.pathname === '/trade/requests') {
      if (!rateLimit(request, 'trade-create', 20, 60 * 60 * 1000)) {
        json(request, response, 429, { error: 'Too many trade requests. Try again later.' }); return
      }

      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const body = await readBody(request)
      const toUserId = String(body.toUserId ?? '').trim()
      const gameId = String(body.gameId ?? '').trim().slice(0, 200)
      const note = String(body.note ?? '').trim().slice(0, 500)

      if (!toUserId || !gameId) {
        json(request, response, 400, { error: 'toUserId and gameId are required.' }); return
      }
      if (toUserId === user.id) {
        json(request, response, 400, { error: 'You cannot trade with yourself.' }); return
      }
      const toUser = db.users.find(u => u.id === toUserId)
      if (!toUser) { json(request, response, 404, { error: 'User not found.' }); return }

      // Prevent duplicate pending requests for same game between same users
      const existing = db.tradeRequests.find(r =>
        r.status === 'pending' &&
        ((r.fromUserId === user.id && r.toUserId === toUserId) ||
         (r.fromUserId === toUserId && r.toUserId === user.id)) &&
        r.gameId === gameId
      )
      if (existing) {
        json(request, response, 409, { error: 'A pending trade request already exists for this game with that user.' }); return
      }

      const tradeOffer = getTradeOfferDetails(toUser.syncState?.library?.[gameId])
      const tradeRequest = normalizeTradeRequest({
        id: randomBytes(12).toString('hex'),
        fromUserId: user.id,
        toUserId,
        gameId,
        note,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tradeEdition: tradeOffer?.editionStatus ?? null,
        tradeCondition: tradeOffer?.condition ?? null,
        tradeVariant: tradeOffer?.variant ?? null,
        tradeCopyIndex: tradeOffer?.tradeCopyIndex ?? null,
      })

      if (!db.tradeRequests) db.tradeRequests = []
      db.tradeRequests.push(tradeRequest)

      if (note) {
        if (!db.messages) db.messages = []
        db.messages.push(normalizeMessage({
          id: randomBytes(12).toString('hex'),
          tradeRequestId: tradeRequest.id,
          senderUserId: user.id,
          text: note,
          createdAt: new Date().toISOString(),
          readAt: null,
        }))
      }

      await saveDb(db, { required: true })

      // Email notification  no personal details
      await sendTradeNotificationEmail(toUser.email, 'New trade request waiting in Retro Vault Elite', 'Another collector sent you a trade request. Please check your Trade Inbox to respond.').catch(() => {})

      json(request, response, 201, { tradeRequest: sanitizeTradeRequest(tradeRequest, user.id, db) })
      return
    }

    // -- Trade: inbox ----------------------------------------
    if (request.method === 'GET' && url.pathname === '/trade/requests') {
      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const userRequests = (db.tradeRequests ?? []).filter(r => {
        if (r.status === 'declined' && r.toUserId === user.id) return false
        return r.fromUserId === user.id || r.toUserId === user.id
      })
      const result = userRequests.map(r => sanitizeTradeRequest(r, user.id, db))
      result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

      const unreadCount = (db.messages ?? []).filter(m => {
        const req = (db.tradeRequests ?? []).find(r => r.id === m.tradeRequestId)
        return req && (req.fromUserId === user.id || req.toUserId === user.id) && m.senderUserId !== user.id && !m.readAt
      }).length

      const pendingCount = (db.tradeRequests ?? []).filter(r =>
        r.toUserId === user.id && r.status === 'pending'
      ).length

      json(request, response, 200, { requests: result, unreadCount, pendingCount })
      return
    }

    // -- Trade: accept / decline -----------------------------
    if (request.method === 'PATCH' && url.pathname.startsWith('/trade/requests/')) {
      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const requestId = url.pathname.slice('/trade/requests/'.length).split('/')[0]
      const tradeRequest = (db.tradeRequests ?? []).find(r => r.id === requestId)
      if (!tradeRequest) { json(request, response, 404, { error: 'Trade request not found.' }); return }
      if (tradeRequest.toUserId !== user.id) { json(request, response, 403, { error: 'Only the recipient can respond.' }); return }
      if (tradeRequest.status !== 'pending') { json(request, response, 409, { error: 'This request is no longer pending.' }); return }

      const body = await readBody(request)
      const newStatus = body.status === 'accepted' ? 'accepted' : 'declined'
      tradeRequest.status = newStatus
      tradeRequest.updatedAt = new Date().toISOString()
      await saveDb(db, { required: true })

      const fromUser = db.users.find(u => u.id === tradeRequest.fromUserId)
      if (fromUser) {
        const subj = newStatus === 'accepted'
          ? 'Your Retro Vault trade request was accepted'
          : 'Your Retro Vault trade request was declined'
        const intro = newStatus === 'accepted'
          ? 'Good news - your trade request was accepted. Please check the vault to continue the trade conversation.'
          : 'Your trade request was declined. Please check the vault for the latest status.'
        await sendTradeNotificationEmail(fromUser.email, subj, intro).catch(() => {})
      }

      json(request, response, 200, { tradeRequest: sanitizeTradeRequest(tradeRequest, user.id, db) })
      return
    }

    if (request.method === 'DELETE' && url.pathname.match(/^\/trade\/requests\/[^/]+$/)) {
      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const requestId = url.pathname.slice('/trade/requests/'.length)
      const tradeRequestIndex = (db.tradeRequests ?? []).findIndex(r => r.id === requestId)
      if (tradeRequestIndex === -1) { json(request, response, 404, { error: 'Trade request not found.' }); return }

      const tradeRequest = db.tradeRequests[tradeRequestIndex]
      if (tradeRequest.fromUserId !== user.id && tradeRequest.toUserId !== user.id) {
        json(request, response, 403, { error: 'Not part of this trade.' }); return
      }

      db.tradeRequests.splice(tradeRequestIndex, 1)
      if (db.messages) {
        db.messages = db.messages.filter(m => m.tradeRequestId !== requestId)
      }

      await saveDb(db, { required: true })
      json(request, response, 200, { ok: true })
      return
    }

    // -- Trade: get messages ---------------------------------
    if (request.method === 'GET' && url.pathname.match(/^\/trade\/requests\/[^/]+\/messages$/)) {
      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const requestId = url.pathname.split('/')[3]
      const tradeRequest = (db.tradeRequests ?? []).find(r => r.id === requestId)
      if (!tradeRequest) { json(request, response, 404, { error: 'Trade request not found.' }); return }
      if (tradeRequest.fromUserId !== user.id && tradeRequest.toUserId !== user.id) {
        json(request, response, 403, { error: 'Not part of this trade.' }); return
      }

      const msgs = (db.messages ?? []).filter(m => m.tradeRequestId === requestId)

      // Mark unread messages as read
      let changed = false
      for (const m of msgs) {
        if (m.senderUserId !== user.id && !m.readAt) {
          m.readAt = new Date().toISOString()
          changed = true
        }
      }
      if (changed) await saveDb(db)

      const otherUserId = tradeRequest.fromUserId === user.id ? tradeRequest.toUserId : tradeRequest.fromUserId
      const otherUser = db.users.find(u => u.id === otherUserId)
      const suggestedReplyGameId = otherUser ? getPreferredTradeOfferGameId(user, otherUser) : null

      json(request, response, 200, {
        tradeRequest: sanitizeTradeRequest(tradeRequest, user.id, db),
        otherUser: { id: otherUser?.id ?? '', displayName: otherUser?.displayName ?? 'Unknown Collector' },
        suggestedReplyGameId,
        messages: msgs.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map(m => ({
          id: m.id,
          senderUserId: m.senderUserId,
          senderDisplayName: m.senderUserId === user.id ? (user.displayName ?? 'You') : (otherUser?.displayName ?? 'Them'),
          text: m.text,
          createdAt: m.createdAt,
          readAt: m.readAt,
          isOwn: m.senderUserId === user.id,
        })),
      })
      return
    }

    // -- Trade: send message ---------------------------------
    if (request.method === 'POST' && url.pathname.match(/^\/trade\/requests\/[^/]+\/messages$/)) {
      if (!rateLimit(request, 'trade-msg', 60, 60 * 1000)) {
        json(request, response, 429, { error: 'Slow down  too many messages.' }); return
      }

      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const requestId = url.pathname.split('/')[3]
      const tradeRequest = (db.tradeRequests ?? []).find(r => r.id === requestId)
      if (!tradeRequest) { json(request, response, 404, { error: 'Trade request not found.' }); return }
      if (tradeRequest.fromUserId !== user.id && tradeRequest.toUserId !== user.id) {
        json(request, response, 403, { error: 'Not part of this trade.' }); return
      }
      if (tradeRequest.status !== 'accepted') {
        json(request, response, 403, { error: 'Trade must be accepted before messaging.' }); return
      }

      const body = await readBody(request)
      const text = String(body.text ?? '').trim().slice(0, 2000)
      if (!text) { json(request, response, 400, { error: 'Message text is required.' }); return }

      const message = normalizeMessage({
        id: randomBytes(12).toString('hex'),
        tradeRequestId: requestId,
        senderUserId: user.id,
        text,
        createdAt: new Date().toISOString(),
        readAt: null,
      })
      if (!db.messages) db.messages = []
      db.messages.push(message)
      await saveDb(db, { required: true })

      const otherUserId = tradeRequest.fromUserId === user.id ? tradeRequest.toUserId : tradeRequest.fromUserId
      const otherUser = db.users.find(u => u.id === otherUserId)
      if (otherUser) {
        await sendTradeNotificationEmail(otherUser.email, 'New trade message in Retro Vault Elite', 'You have a new trade message waiting. Please check the vault to reply.').catch(() => {})
      }

      json(request, response, 201, {
        message: { id: message.id, senderUserId: message.senderUserId, senderDisplayName: user.displayName ?? 'You', text: message.text, createdAt: message.createdAt, readAt: null, isOwn: true },
      })
      return
    }

    // -- Trade: delete message -------------------------------
    if (request.method === 'DELETE' && url.pathname.match(/^\/trade\/requests\/[^/]+\/messages\/[^/]+$/)) {
      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const requestId = url.pathname.split('/')[3]
      const messageId = url.pathname.split('/')[5]
      const tradeRequest = (db.tradeRequests ?? []).find(r => r.id === requestId)
      if (!tradeRequest) { json(request, response, 404, { error: 'Trade request not found.' }); return }
      if (tradeRequest.fromUserId !== user.id && tradeRequest.toUserId !== user.id) {
        json(request, response, 403, { error: 'Not part of this trade.' }); return
      }

      const messageIndex = (db.messages ?? []).findIndex(m => m.tradeRequestId === requestId && m.id === messageId)
      if (messageIndex === -1) { json(request, response, 404, { error: 'Message not found.' }); return }

      const message = db.messages[messageIndex]
      if (message.senderUserId !== user.id) {
        json(request, response, 403, { error: 'You can only delete your own messages.' }); return
      }

      db.messages.splice(messageIndex, 1)
      await saveDb(db, { required: true })
      json(request, response, 200, { ok: true })
      return
    }

    json(request, response, 404, { error: 'Not found.' })
  } catch (error) {
    json(request, response, 500, { error: error instanceof Error ? error.message : 'Unknown server error.' })
  }
})

server.listen(port, () => {
  console.log(`Retro Vault backend listening on http://127.0.0.1:${port}`)
})












