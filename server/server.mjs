import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR ? join(process.cwd(), process.env.DATA_DIR) : join(__dirname, 'data')
const dbPath = join(dataDir, 'db.json')
const port = Number(process.env.PORT ?? 8787)
const allowedOrigins = (process.env.CORS_ORIGIN ?? '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

mkdirSync(dataDir, { recursive: true })

function createEmptyDb() {
  return {
    users: [],
    sessions: [],
  }
}

function loadDb() {
  if (!existsSync(dbPath)) {
    const emptyDb = createEmptyDb()
    writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2))
    return emptyDb
  }

  try {
    return JSON.parse(readFileSync(dbPath, 'utf8'))
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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

  return db.users.find((entry) => entry.id === session.userId) ?? null
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  }
}

function createDefaultSyncState() {
  return {
    library: {},
    customCatalog: [],
    currencyCode: 'USD',
    barcodeMappings: {},
    updatedAt: new Date().toISOString(),
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    })
    response.end()
    return
  }

  const db = loadDb()
  const url = new URL(request.url, `http://${request.headers.host}`)

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      json(request, response, 200, { ok: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      const body = await readBody(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')

      if (!email || !password || password.length < 6) {
        json(request, response, 400, { error: 'Use a valid email and a password of at least 6 characters.' })
        return
      }

      if (db.users.some((entry) => entry.email === email)) {
        json(request, response, 409, { error: 'An account already exists for that email.' })
        return
      }

      const user = {
        id: randomBytes(12).toString('hex'),
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        syncState: createDefaultSyncState(),
      }

      db.users.push(user)
      const token = generateToken()
      db.sessions.push({
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
      })
      saveDb(db)
      json(request, response, 201, { token, user: sanitizeUser(user), syncState: user.syncState })
      return
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      const body = await readBody(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const user = db.users.find((entry) => entry.email === email)

      if (!user || !verifyPassword(password, user.passwordHash)) {
        json(request, response, 401, { error: 'Email or password was incorrect.' })
        return
      }

      const token = generateToken()
      db.sessions.push({
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
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

    if (request.method === 'GET' && url.pathname === '/auth/me') {
      const user = getSessionUser(request, db)

      if (!user) {
        json(request, response, 401, { error: 'Not signed in.' })
        return
      }

      json(request, response, 200, { user: sanitizeUser(user), syncState: user.syncState })
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
