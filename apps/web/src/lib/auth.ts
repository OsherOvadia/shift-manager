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
  rememberMe: boolean
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  setAuth: (user: User, accessToken: string, refreshToken: string, rememberMe?: boolean) => void
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
      rememberMe: true, // Default to true for persistence
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      setAuth: (user, accessToken, refreshToken, rememberMe = true) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          rememberMe,
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
          rememberMe: true,
        })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      // Custom storage that uses localStorage for "Remember Me" or sessionStorage for current session only
      storage: {
        getItem: (name) => {
          // Check sessionStorage first (most recent if both exist)
          const sessionData = sessionStorage.getItem(name)
          if (sessionData) return sessionData
          
          // Then check localStorage (for "Remember Me")
          const localData = localStorage.getItem(name)
          return localData || null
        },
        setItem: (name, value) => {
          try {
            // Parse the value to check rememberMe flag
            const parsedValue = JSON.parse(value)
            const rememberMe = parsedValue.state?.rememberMe ?? true
            
            if (rememberMe) {
              // Save to localStorage (persists across browser sessions)
              localStorage.setItem(name, value)
              sessionStorage.removeItem(name)
            } else {
              // Save to sessionStorage (cleared when browser closes)
              sessionStorage.setItem(name, value)
              localStorage.removeItem(name)
            }
          } catch {
            // Fallback to localStorage if parsing fails
            localStorage.setItem(name, value)
          }
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
          sessionStorage.removeItem(name)
        },
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, rememberMe, setAuth, logout } = useAuthStore.getState()

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

    // Preserve the rememberMe setting when refreshing tokens
    setAuth(response.user, response.accessToken, response.refreshToken, rememberMe)
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
