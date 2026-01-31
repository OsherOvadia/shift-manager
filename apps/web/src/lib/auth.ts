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
        // Also save tokens to cookies as backup
        if (typeof document !== 'undefined') {
          const expires = rememberMe 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString() // 30 days
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString(); // 1 day
          
          document.cookie = `refreshToken=${refreshToken}; expires=${expires}; path=/; SameSite=Strict`;
          document.cookie = `rememberMe=${rememberMe}; expires=${expires}; path=/; SameSite=Strict`;
        }
        
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
        
        // Clear cookies
        if (typeof document !== 'undefined') {
          document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          document.cookie = 'rememberMe=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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
          // Try localStorage first
          const localData = localStorage.getItem(name)
          if (localData) {
            try {
              const parsed = JSON.parse(localData)
              // Check if rememberMe is true, if so use it
              if (parsed.state?.rememberMe === true) {
                return localData
              }
            } catch {}
          }
          
          // Then try sessionStorage
          const sessionData = sessionStorage.getItem(name)
          if (sessionData) return sessionData
          
          // Finally, try to restore from cookies as fallback
          if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
              const [key, value] = cookie.trim().split('=')
              acc[key] = value
              return acc
            }, {} as Record<string, string>)
            
            if (cookies.refreshToken && cookies.rememberMe === 'true') {
              // Reconstruct basic auth state from cookies
              return JSON.stringify({
                state: {
                  refreshToken: cookies.refreshToken,
                  rememberMe: true,
                  isAuthenticated: true,
                },
                version: 0,
              })
            }
          }
          
          return null
        },
        setItem: (name, value) => {
          try {
            const parsedValue = JSON.parse(value)
            const rememberMe = parsedValue.state?.rememberMe ?? true // Default to true
            
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
            // Fallback to localStorage
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
  let { refreshToken, rememberMe, setAuth, logout } = useAuthStore.getState()

  // If no refresh token in state, try to get it from cookies
  if (!refreshToken && typeof document !== 'undefined') {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    
    refreshToken = cookies.refreshToken || null
    rememberMe = cookies.rememberMe === 'true'
  }

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
