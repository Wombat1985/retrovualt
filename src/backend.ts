const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://127.0.0.1:8787'

export type SyncStatePayload = {
  library: Record<string, unknown>
  customCatalog: unknown[]
  currencyCode: string
  barcodeMappings: Record<string, string>
}

export type AuthPayload = {
  token: string
  user: {
    id: string
    email: string
    createdAt: string
  }
  syncState: SyncStatePayload & {
    updatedAt: string
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })

  const parsed = await response.json()

  if (!response.ok) {
    throw new Error(parsed.error ?? 'Backend request failed.')
  }

  return parsed as T
}

export async function registerAccount(email: string, password: string) {
  return request<AuthPayload>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
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
