const PRODUCTION_API_BASE_URL = 'https://retro-vault-backend.onrender.com'

function getApiBaseUrl() {
  const configuredUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')

  if (configuredUrl) {
    return configuredUrl
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8787'
  }

  return PRODUCTION_API_BASE_URL
}

const API_BASE_URL = getApiBaseUrl()

export type SyncStatePayload = {
  library: Record<string, unknown>
  customCatalog: unknown[]
  currencyCode: string
  barcodeMappings: Record<string, string>
  activityEvents?: unknown[]
  clientUpdatedAt?: string
  version?: number
  profile?: {
    displayName?: string
    shelfTagline?: string
  }
}

export type AuthPayload = {
  token: string
  user: {
    id: string
    email: string
    displayName: string
    createdAt: string
  }
  syncState: SyncStatePayload & {
    updatedAt: string
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  let response: Response
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = controller ? window.setTimeout(() => controller.abort(), 12000) : 0

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: init.signal ?? controller?.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw new Error('Could not reach Retro Vault sync. Please check your connection and try again.')
  } finally {
    if (timeout) {
      window.clearTimeout(timeout)
    }
  }

  const parsed = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(parsed.error ?? 'Backend request failed.')
  }

  return parsed as T
}

export async function registerAccount(email: string, password: string, displayName = '') {
  return request<AuthPayload>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  })
}

export async function loginAccount(email: string, password: string) {
  return request<AuthPayload>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function logoutAccount(token: string) {
  return request<{ ok: boolean }>('/auth/logout', { method: 'POST' }, token)
}

export async function getCurrentAccount(token: string) {
  return request<AuthPayload>('/auth/me', { method: 'GET' }, token)
}

export async function updateAccountProfile(token: string, displayName: string) {
  return request<AuthPayload>(
    '/auth/me',
    {
      method: 'PATCH',
      body: JSON.stringify({ displayName }),
    },
    token,
  )
}

export async function requestPasswordReset(email: string) {
  return request<{ ok: boolean; message: string }>('/auth/password-reset', {
    method: 'POST',
    body: JSON.stringify({ email, appUrl: window.location.origin }),
  })
}

export async function confirmPasswordReset(token: string, password: string) {
  return request<{ ok: boolean }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export async function changePassword(token: string, currentPassword: string, nextPassword: string) {
  return request<{ ok: boolean }>(
    '/auth/change-password',
    {
      method: 'POST',
      body: JSON.stringify({ currentPassword, nextPassword }),
    },
    token,
  )
}

export async function deleteAccount(token: string) {
  return request<{ ok: boolean }>('/auth/me', { method: 'DELETE' }, token)
}

export async function pushSyncState(token: string, syncState: SyncStatePayload) {
  return request<{ syncState: SyncStatePayload & { updatedAt: string } }>(
    '/sync',
    {
      method: 'PUT',
      body: JSON.stringify(syncState),
    },
    token,
  )
}

export async function saveBarcodeMapping(token: string, code: string, gameId: string) {
  return request<{ code: string; gameId: string }>(
    `/barcode/${encodeURIComponent(code)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ gameId }),
    },
    token,
  )
}

export async function lookupBarcodeMapping(code: string, token?: string) {
  return request<{ code: string; gameId: string | null; source: string | null }>(
    `/barcode/${encodeURIComponent(code)}`,
    {
      method: 'GET',
    },
    token,
  )
}

export async function trackPageView(signedIn = false) {
  try {
    await request<{ ok: boolean }>('/analytics/page-view', {
      method: 'POST',
      keepalive: true,
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer,
        title: document.title,
        signedIn,
      }),
    })
  } catch {
    // Analytics must never block the app.
  }
}

export async function subscribeToNewsletter(email: string, source = 'app') {
  return request<{ ok: boolean; message: string }>('/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email, source }),
  })
}

// ── Trade types ─────────────────────────────────────────────────────────────

export type TradeMatch = {
  userId: string
  displayName: string
  theyHaveWhatIWant: string[]
  iHaveWhatTheyWant: string[]
  isMutual: boolean
}

export type TradeRequest = {
  id: string
  gameId: string
  note: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  updatedAt: string
  isIncoming: boolean
  fromDisplayName: string
  toDisplayName: string
  partnerDisplayName: string
  unreadCount: number
}

export type TradeMessage = {
  id: string
  senderUserId: string
  senderDisplayName: string
  text: string
  createdAt: string
  readAt: string | null
  isOwn: boolean
}

export async function getTradeMatches(token: string) {
  return request<{ matches: TradeMatch[] }>('/trade/matches', { method: 'GET' }, token)
}

export type TradeAvailability = {
  gameId: string
  count: number
}

export type TradeAvailabilityOwner = {
  userId: string
  displayName: string
  hasPendingRequest: boolean
}

export type TradeInboxOpportunity = {
  gameId: string
  ownerCount: number
  requestableOwnerCount: number
  owners: TradeAvailabilityOwner[]
}

export type TradeDiscoveryCollector = {
  userId: string
  displayName: string
  matchingGameIds: string[]
  featuredGameId: string
}

export async function getTradeAvailability(gameIds: string[], token?: string) {
  return request<{ availability: TradeAvailability[] }>(
    '/trade/availability',
    {
      method: 'POST',
      body: JSON.stringify({ gameIds }),
    },
    token,
  )
}

export async function getTradeAvailabilityOwners(token: string, gameId: string) {
  return request<{ gameId: string; owners: TradeAvailabilityOwner[] }>(
    `/trade/availability/${encodeURIComponent(gameId)}/owners`,
    { method: 'GET' },
    token,
  )
}

export async function getTradeInboxDiscovery(token: string) {
  return request<{ opportunities: TradeInboxOpportunity[]; collectors: TradeDiscoveryCollector[] }>(
    '/trade/discovery',
    { method: 'GET' },
    token,
  )
}

export async function createTradeRequest(token: string, toUserId: string, gameId: string, note = '') {
  return request<{ tradeRequest: TradeRequest }>(
    '/trade/requests',
    { method: 'POST', body: JSON.stringify({ toUserId, gameId, note }) },
    token,
  )
}

export async function getTradeRequests(token: string) {
  return request<{ requests: TradeRequest[]; unreadCount: number; pendingCount: number }>('/trade/requests', { method: 'GET' }, token)
}

export async function respondToTradeRequest(token: string, requestId: string, status: 'accepted' | 'declined') {
  return request<{ tradeRequest: TradeRequest }>(
    `/trade/requests/${encodeURIComponent(requestId)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    token,
  )
}

export async function deleteTradeRequest(token: string, requestId: string) {
  return request<{ ok: boolean }>(
    `/trade/requests/${encodeURIComponent(requestId)}`,
    { method: 'DELETE' },
    token,
  )
}

export async function getTradeMessages(token: string, requestId: string) {
  return request<{ tradeRequest: TradeRequest; otherUser: { id: string; displayName: string }; messages: TradeMessage[] }>(
    `/trade/requests/${encodeURIComponent(requestId)}/messages`,
    { method: 'GET' },
    token,
  )
}

export async function sendTradeMessage(token: string, requestId: string, text: string) {
  return request<{ message: TradeMessage }>(
    `/trade/requests/${encodeURIComponent(requestId)}/messages`,
    { method: 'POST', body: JSON.stringify({ text }) },
    token,
  )
}

export async function deleteTradeMessage(token: string, requestId: string, messageId: string) {
  return request<{ ok: boolean }>(
    `/trade/requests/${encodeURIComponent(requestId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
    token,
  )
}

export type TradeProfile = {
  userId: string
  displayName: string
  ownedGameIds: string[]
  wantedGameIds: string[]
  forTradeGameIds: string[]
}

export async function getTradeProfile(token: string, userId: string) {
  return request<TradeProfile>(`/trade/profile/${encodeURIComponent(userId)}`, {}, token)
}
