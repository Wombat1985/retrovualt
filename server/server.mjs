import { createServer } from 'node:http'
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

function normalizeDb(parsed) {
  return {
    users: Array.isArray(parsed?.users) ? parsed.users : [],
    sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
    passwordResets: Array.isArray(parsed?.passwordResets) ? parsed.passwordResets : [],
    newsletterSubscribers: Array.isArray(parsed?.newsletterSubscribers) ? parsed.newsletterSubscribers : [],
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
        subject: `Retro Vault Elite — ${subject}`,
        html: `<p>${intro}</p><p><a href="${appUrl}">${ctaLabel}</a></p><p>Do not reply. Never share personal details over this system.</p>`,
      }),
    })
    if (!res.ok) console.error('Trade notification email failed:', res.status)
  } catch (err) {
    console.error('Trade notification email error:', err?.message)
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

      await saveDb(db)
      json(request, response, 200, { ok: true, message: 'You are on the Retro Vault market movers list.' })
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
      const tradeOffer = getTradeOfferDetails(tradeOwner)
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
        unreadCount: unread,
        tradeEdition: tradeOffer?.editionStatus ?? null,
        tradeCondition: tradeOffer?.condition ?? null,
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

    function getTradeOfferDetails(record) {
      if (!record || record.status !== 'owned') return null
      const tradeCopy = Array.isArray(record.copies) ? record.copies.find((copy) => copy?.forTrade) : null
      const editionStatus = String(tradeCopy?.edition ?? record.editionStatus ?? 'loose')
      const condition = String(tradeCopy?.condition ?? record.condition ?? 'good')
      return { editionStatus, condition }
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

    if (request.method === 'GET' && url.pathname.startsWith('/trade/availability/') && url.pathname.endsWith('/owners')) {
      const viewer = await getSessionUser(request, db)
      if (!viewer) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const parts = url.pathname.split('/')
      const gameId = decodeURIComponent(parts[3] ?? '').trim()
      if (!gameId) { json(request, response, 400, { error: 'Game id is required.' }); return }

      const owners = db.users
        .filter((user) => user.id !== viewer.id && getOwnedTradeGameIds(user).includes(gameId))
        .map((user) => ({
          userId: user.id,
          displayName: user.displayName ?? 'Unknown Collector',
          hasPendingRequest: hasPendingTradeForGame(db, viewer.id, user.id, gameId),
        }))

      json(request, response, 200, { gameId, owners })
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

      const tradeRequest = normalizeTradeRequest({
        id: randomBytes(12).toString('hex'),
        fromUserId: user.id,
        toUserId,
        gameId,
        note,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

      // Email notification — no personal details
      await sendTradeNotificationEmail(toUser.email, 'New trade request waiting in Retro Vault Elite', 'Another collector sent you a trade request. Please check your Trade Inbox to respond.').catch(() => {})

      json(request, response, 201, { tradeRequest: sanitizeTradeRequest(tradeRequest, user.id, db) })
      return
    }

    // -- Trade: inbox ----------------------------------------
    if (request.method === 'GET' && url.pathname === '/trade/requests') {
      const user = await getSessionUser(request, db)
      if (!user) { json(request, response, 401, { error: 'Not signed in.' }); return }

      const userRequests = (db.tradeRequests ?? []).filter(r => r.fromUserId === user.id || r.toUserId === user.id)
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

      json(request, response, 200, {
        tradeRequest: sanitizeTradeRequest(tradeRequest, user.id, db),
        otherUser: { id: otherUser?.id ?? '', displayName: otherUser?.displayName ?? 'Unknown Collector' },
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
        json(request, response, 429, { error: 'Slow down — too many messages.' }); return
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



