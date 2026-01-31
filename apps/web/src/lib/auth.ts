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
        console.log('✅ Setting auth:', { user: user.email, rememberMe })
        
        // Save tokens to cookies as backup
        if (typeof document !== 'undefined') {
          const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString() // 30 days
          document.cookie = `refreshToken=${refreshToken}; expires=${expires}; path=/; SameSite=Lax; Secure`
          document.cookie = `rememberMe=true; expires=${expires}; path=/; SameSite=Lax; Secure`
        }
        
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          rememberMe: true, // Always persist
        })
      },

      logout: () => {
        console.log('🚪 Logging out')
        const { refreshToken } = get()
        if (refreshToken) {
          api.post('/auth/logout', { refreshToken }).catch(() => {})
        }
        
        // Clear everything
        if (typeof document !== 'undefined') {
          localStorage.clear()
          sessionStorage.clear()
          document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
          document.cookie = 'rememberMe=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
        }
        
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          rememberMe: false,
        })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      // Always use localStorage for persistence
      storage: {
        getItem: (name) => {
          try {
            // Always read from localStorage
            return localStorage.getItem(name)
          } catch (error) {
            console.error('Failed to get auth from storage:', error)
            return null
          }
        },
        setItem: (name, value) => {
          try {
            // Always save to localStorage
            localStorage.setItem(name, value)
          } catch (error) {
            console.error('Failed to save auth to storage:', error)
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name)
            sessionStorage.removeItem(name)
            // Clear cookies
            if (typeof document !== 'undefined') {
              document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
              document.cookie = 'rememberMe=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
            }
          } catch (error) {
            console.error('Failed to remove auth from storage:', error)
          }
        },
      },
      onRehydrateStorage: () => (state) => {
        console.log('🔄 Hydrating auth state:', state ? 'has state' : 'no state')
        if (state) {
          state.setHasHydrated(true)
        }
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
