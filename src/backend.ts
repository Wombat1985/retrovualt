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

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw new Error('Could not reach Retro Vault sync. Please check your connection and try again.')
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
