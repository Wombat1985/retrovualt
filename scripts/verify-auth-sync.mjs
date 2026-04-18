import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const port = 8799
const baseUrl = `http://127.0.0.1:${port}`

function startServer(dataDir) {
  let output = ''
  const child = spawn(process.execPath, ['server/server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      CORS_ORIGIN: 'http://127.0.0.1:4173',
      SESSION_TTL_DAYS: '30',
      ADMIN_KEY: 'test-admin-key',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.getOutput = () => output

  return child
}

async function waitForServer(server) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < 8000) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) {
        return
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
  }

  throw new Error(`Auth sync test server did not start.\n${server.getOutput?.() ?? ''}`)
}

async function request(pathname, init = {}, token = '') {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(json.error ?? `Request failed: ${response.status}`)
  }

  return json
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value).sort())
}

async function main() {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'retro-vault-auth-sync-'))
  const server = startServer(dataDir)

  try {
    await waitForServer(server)

    const email = `sync-${Date.now()}@example.com`
    const password = 'Vault12345'
    const syncPayload = {
      library: {
        'super-nintendo-actraiser': {
          status: 'owned',
          completeInBox: true,
          pricePaid: 42.5,
          favorite: true,
          editionStatus: 'cib',
          condition: 'excellent',
          targetPrice: null,
          notes: 'Regression test shelf piece',
        },
        'super-nintendo-zombies-ate-my-neighbors': {
          status: 'wanted',
          completeInBox: false,
          pricePaid: null,
          favorite: false,
          editionStatus: 'loose',
          condition: 'good',
          targetPrice: 30,
          notes: '',
        },
      },
      customCatalog: [],
      currencyCode: 'AUD',
      barcodeMappings: {
        '012345678905': 'super-nintendo-actraiser',
      },
      activityEvents: [
        {
          id: 'test-owned-added',
          type: 'owned_added',
          gameId: 'super-nintendo-actraiser',
          title: 'Game added to collection',
          detail: 'ActRaiser joined the vault.',
          createdAt: new Date().toISOString(),
        },
      ],
      clientUpdatedAt: new Date().toISOString(),
      version: 2,
      profile: {
        displayName: 'Sync Test Collector',
        shelfTagline: 'Regression proof',
      },
    }

    const registered = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName: 'Sync Test Collector' }),
    })

    await request('/sync', {
      method: 'PUT',
      body: JSON.stringify(syncPayload),
    }, registered.token)

    await request('/auth/logout', { method: 'POST' }, registered.token)

    const loggedIn = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const restored = loggedIn.syncState

    for (const [id, record] of Object.entries(syncPayload.library)) {
      if (stableJson(restored.library[id]) !== stableJson(record)) {
        throw new Error(`Restored record mismatch for ${id}.`)
      }
    }

    if (restored.currencyCode !== syncPayload.currencyCode) {
      throw new Error('Currency did not restore exactly.')
    }

    if (stableJson(restored.barcodeMappings) !== stableJson(syncPayload.barcodeMappings)) {
      throw new Error('Barcode mappings did not restore exactly.')
    }

    if (!Array.isArray(restored.activityEvents) || restored.activityEvents[0]?.id !== 'test-owned-added') {
      throw new Error('Activity events did not restore exactly.')
    }

    await request('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: `newsletter-${Date.now()}@example.com`, source: 'test' }),
    })

    await request('/analytics/page-view', {
      method: 'POST',
      body: JSON.stringify({ path: '/', referrer: '', signedIn: true }),
    })

    const stats = await request('/admin/stats', {
      method: 'GET',
      headers: { 'X-Admin-Key': 'test-admin-key' },
    })

    if (stats.userCount < 1 || stats.analytics.totalPageViews < 1 || stats.newsletterSubscriberCount < 1) {
      throw new Error('Admin stats did not include account and analytics totals.')
    }

    if (stats.users.some((user) => 'passwordHash' in user)) {
      throw new Error('Admin stats leaked password hashes.')
    }

    console.log('Auth sync regression passed.')
  } finally {
    server.kill()
    await rm(dataDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
