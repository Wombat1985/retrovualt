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
const allowedOrigins = (process.env.CORS_ORIGIN ?? '*')
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
    analytics: createDefaultAnalyticsState(),
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
    analytics: normalizeAnalyticsState(parsed?.analytics),
  }
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
  await supabaseRequest(encodeURIComponent(supabaseStateTable), {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: supabaseStateId,
      data: normalizeDb(db),
      updated_at: new Date().toISOString(),
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
      throw new Error('Permanent account database could not save. Please check the Supabase service role key in Render.')
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

  if (allowedOrigins.includes('*')) {
    return '*'
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] ?? '*'
}

function json(request, response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

  const suppliedKey = request.headers['x-admin-key'] ?? url.searchParams.get('key') ?? ''
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
    })
    response.end()
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)

  try {
    const accountRoute =
      url.pathname.startsWith('/auth') ||
      url.pathname === '/sync' ||
      url.pathname.startsWith('/barcode/') ||
      url.pathname === '/admin/stats'
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

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      if (!rateLimit(request, 'register', 12, 15 * 60 * 1000)) {
        json(request, response, 429, { error: 'Too many sign-up attempts. Please wait and try again.' })
        return
      }

      const body = await readBody(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const displayName = String(body.displayName ?? '').trim()

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
      const appUrl = String(body.appUrl ?? request.headers.origin ?? '').replace(/\/$/, '')

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
        const resetLink = `${appUrl || `http://${request.headers.host}`}/?resetToken=${encodeURIComponent(token)}`
        await sendPasswordResetEmail(email, resetLink)
      }

      json(request, response, 200, { ok: true, message: 'If an account exists, a password reset email has been sent.' })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/password-reset/confirm') {
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
      const displayName = String(body.displayName ?? '').trim()
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
      user.syncState = {
        library: body.library ?? {},
        customCatalog: body.customCatalog ?? [],
        currencyCode: body.currencyCode ?? 'USD',
        barcodeMappings: body.barcodeMappings ?? {},
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
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      const code = decodeURIComponent(url.pathname.slice('/barcode/'.length))
      const gameId = user.syncState.barcodeMappings?.[code] ?? null
      json(request, response, 200, { code, gameId })
      return
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/barcode/')) {
      const user = await getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      const code = decodeURIComponent(url.pathname.slice('/barcode/'.length))
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

    json(request, response, 404, { error: 'Not found.' })
  } catch (error) {
    json(request, response, 500, { error: error instanceof Error ? error.message : 'Unknown server error.' })
  }
})

server.listen(port, () => {
  console.log(`Retro Vault backend listening on http://127.0.0.1:${port}`)
})
