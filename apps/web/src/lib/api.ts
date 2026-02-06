import { getAccessToken, refreshAccessToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface RequestOptions extends RequestInit {
  token?: string
  skipAuth?: boolean
}

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, skipAuth, ...fetchOptions } = options

  const isFormData = options.body instanceof FormData
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  }

  // Auto-attach token from auth store if not provided and not skipped
  if (!skipAuth) {
    const authToken = token || getAccessToken()
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
  }

  let response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  // If unauthorized, try to refresh token and retry
  if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/')) {
    console.log('🔓 Got 401, attempting token refresh...')
    const newToken = await refreshAccessToken()
    if (newToken) {
      console.log('✅ Token refreshed, retrying request')
      headers['Authorization'] = `Bearer ${newToken}`
      response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
      })
    } else {
      console.log('❌ Token refresh failed')
    }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message || 'שגיאה בשרת',
      data
    )
  }

  return data
}

export const api = {
  get: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, body?: any, token?: string) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      token,
    }),

  patch: <T>(endpoint: string, body: any, token?: string) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    }),

  delete: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'DELETE', token }),

  upload: <T>(endpoint: string, formData: FormData, token?: string) =>
    request<T>(endpoint, {
      method: 'POST',
      body: formData,
      token,
      headers: {}, // Let browser set Content-Type with boundary for multipart
    }),

  // For unauthenticated requests (login, signup, etc.)
  public: {
    post: <T>(endpoint: string, body: any) =>
      request<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        skipAuth: true,
      }),
    get: <T>(endpoint: string) =>
      request<T>(endpoint, { method: 'GET', skipAuth: true }),
  },
}

export { ApiError }
