import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR ? join(process.cwd(), process.env.DATA_DIR) : join(__dirname, 'data')
const dbPath = join(dataDir, 'db.json')
const port = Number(process.env.PORT ?? 8787)
const sessionTtlMs = Number(process.env.SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000
const resetTtlMs = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30) * 60 * 1000
const requestLimits = new Map()
const allowedOrigins = (process.env.CORS_ORIGIN ?? '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

mkdirSync(dataDir, { recursive: true })

function createEmptyDb() {
  return {
    users: [],
    sessions: [],
    passwordResets: [],
  }
}

function loadDb() {
  if (!existsSync(dbPath)) {
    const emptyDb = createEmptyDb()
    writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2))
    return emptyDb
  }

  try {
    const parsed = JSON.parse(readFileSync(dbPath, 'utf8'))
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      passwordResets: Array.isArray(parsed.passwordResets) ? parsed.passwordResets : [],
    }
  } catch {
    const emptyDb = createEmptyDb()
    writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2))
    return emptyDb
  }
}

function saveDb(db) {
  writeFileSync(dbPath, JSON.stringify(db, null, 2))
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

function getSessionUser(request, db) {
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
    saveDb(db)
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

function createDefaultSyncState() {
  return {
    library: {},
    customCatalog: [],
    currencyCode: 'USD',
    barcodeMappings: {},
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    })
    response.end()
    return
  }

  const db = loadDb()
  pruneSecurityState(db)
  const url = new URL(request.url, `http://${request.headers.host}`)

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      json(request, response, 200, { ok: true })
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
      saveDb(db)
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
      saveDb(db)
      json(request, response, 200, { token, user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      const authHeader = request.headers.authorization
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

      if (token) {
        db.sessions = db.sessions.filter((entry) => entry.token !== token)
        saveDb(db)
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
        saveDb(db)
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
      saveDb(db)
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && url.pathname === '/auth/me') {
      const user = getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      json(request, response, 200, { user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'PATCH' && url.pathname === '/auth/me') {
      const user = getSessionUser(request, db)

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
      saveDb(db)
      json(request, response, 200, { user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/change-password') {
      const user = getSessionUser(request, db)

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
      saveDb(db)
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'DELETE' && url.pathname === '/auth/me') {
      const user = getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      db.users = db.users.filter((entry) => entry.id !== user.id)
      db.sessions = db.sessions.filter((entry) => entry.userId !== user.id)
      db.passwordResets = db.passwordResets.filter((entry) => entry.userId !== user.id)
      saveDb(db)
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && url.pathname === '/sync') {
      const user = getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      json(request, response, 200, { syncState: user.syncState })
      return
    }

    if (request.method === 'PUT' && url.pathname === '/sync') {
      const user = getSessionUser(request, db)

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
        profile: body.profile ?? user.syncState?.profile ?? { displayName: user.displayName ?? '', shelfTagline: '' },
        updatedAt: new Date().toISOString(),
      }
      saveDb(db)
      json(request, response, 200, { syncState: user.syncState })
      return
    }

    if (request.method === 'GET' && url.pathname.startsWith('/barcode/')) {
      const user = getSessionUser(request, db)

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
      const user = getSessionUser(request, db)

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
      saveDb(db)
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
