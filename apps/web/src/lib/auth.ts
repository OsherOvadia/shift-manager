import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  employmentType: 'FULL_TIME' | 'PART_TIME'
  organizationId: string
  organization?: {
    id: string
    name: string
  }
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        })
      },

      logout: () => {
        const { refreshToken } = get()
        if (refreshToken) {
          api.post('/auth/logout', { refreshToken }).catch(() => {})
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      // Custom storage that checks both localStorage and sessionStorage
      storage: {
        getItem: (name) => {
          // Check localStorage first (for "Remember Me")
          const localData = localStorage.getItem(name)
          if (localData) return localData
          
          // Then check sessionStorage (for current session only)
          const sessionData = sessionStorage.getItem(name)
          return sessionData || null
        },
        setItem: (name, value) => {
          // By default, save to localStorage (zustand persist does this)
          localStorage.setItem(name, value)
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
          sessionStorage.removeItem(name)
        },
      },
    }
  )
)

export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAuth, logout } = useAuthStore.getState()

  if (!refreshToken) {
    logout()
    return null
  }

  try {
    const response = await api.post<{
      accessToken: string
      refreshToken: string
      user: User
    }>('/auth/refresh', { refreshToken })

    setAuth(response.user, response.accessToken, response.refreshToken)
    return response.accessToken
  } catch {
    logout()
    return null
  }
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken
}

export function isManager(): boolean {
  const { user } = useAuthStore.getState()
  return user?.role === 'ADMIN' || user?.role === 'MANAGER'
}

export function isAdmin(): boolean {
  const { user } = useAuthStore.getState()
  return user?.role === 'ADMIN'
}
