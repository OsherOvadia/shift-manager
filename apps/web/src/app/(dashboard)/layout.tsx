'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore, isManager, isAdmin } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar,
  Users,
  Clock,
  Settings,
  Bell,
  LogOut,
  Menu,
  LayoutDashboard,
  DollarSign,
  UserPlus,
  Briefcase,
  X,
  ChefHat,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

const navigation = [
  { name: 'דשבורד', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'], mobileOrder: 1, color: 'bg-blue-500', textColor: 'text-blue-600' },
  { name: 'לוח משמרות', href: '/dashboard/schedule', icon: Calendar, roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'], mobileOrder: 2, color: 'bg-purple-500', textColor: 'text-purple-600' },
  { name: 'ניהול משמרות', href: '/dashboard/manage-schedule', icon: Calendar, roles: ['ADMIN', 'MANAGER'], mobileOrder: 3, color: 'bg-violet-500', textColor: 'text-violet-600' },
  { name: 'הזמינות שלי', href: '/dashboard/availability', icon: Clock, roles: ['EMPLOYEE'], mobileOrder: 2, color: 'bg-cyan-500', textColor: 'text-cyan-600' },
  { name: 'ניהול זמינויות', href: '/dashboard/manage-availability', icon: Clock, roles: ['ADMIN', 'MANAGER'], mobileOrder: 4, color: 'bg-teal-500', textColor: 'text-teal-600' },
  { name: 'עובדים', href: '/dashboard/employees', icon: Users, roles: ['ADMIN', 'MANAGER'], mobileOrder: 5, color: 'bg-green-500', textColor: 'text-green-600' },
  { name: 'בקשות הרשמה', href: '/dashboard/pending-users', icon: UserPlus, roles: ['ADMIN', 'MANAGER'], mobileOrder: 6, color: 'bg-amber-500', textColor: 'text-amber-600' },
  { name: 'קטגוריות', href: '/dashboard/job-categories', icon: Briefcase, roles: ['ADMIN', 'MANAGER'], mobileOrder: 7, color: 'bg-orange-500', textColor: 'text-orange-600' },
  { name: 'שכר טבחים', href: '/dashboard/cook-payroll', icon: ChefHat, roles: ['ADMIN', 'MANAGER'], mobileOrder: 8, color: 'bg-red-500', textColor: 'text-red-600' },
  { name: 'דוחות עלויות', href: '/dashboard/reports', icon: DollarSign, roles: ['ADMIN', 'MANAGER'], mobileOrder: 9, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
  { name: 'העלאת שעות', href: '/dashboard/import-hours', icon: Upload, roles: ['ADMIN', 'MANAGER'], mobileOrder: 10, color: 'bg-indigo-500', textColor: 'text-indigo-600' },
  { name: 'הגדרות', href: '/dashboard/settings', icon: Settings, roles: ['ADMIN'], mobileOrder: 11, color: 'bg-slate-500', textColor: 'text-slate-600' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, logout, _hasHydrated, refreshToken, accessToken } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Wait for client-side mount and attempt token refresh if needed
  useEffect(() => {
    setMounted(true)
    
    // Force check localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auth-storage')
      console.log('💾 LocalStorage check:', stored ? 'has data' : 'empty')
      
      // If we have refreshToken but not authenticated, try to refresh immediately
      if (stored && !isAuthenticated && refreshToken && !isRefreshing) {
        console.log('🔄 Attempting immediate token refresh on mount')
        setIsRefreshing(true)
        import('@/lib/auth').then(({ refreshAccessToken }) => {
          refreshAccessToken().finally(() => {
            setIsRefreshing(false)
          })
        })
      }
    }
  }, [])

  useEffect(() => {
    // Wait for mount, hydration, AND token refresh
    if (!mounted || !_hasHydrated || isRefreshing) {
      return
    }
    
    // Quick auth check without delay - much faster!
    const state = useAuthStore.getState()
    setAuthChecked(true)
    
    if (!state.isAuthenticated || !state.user) {
      router.push('/login')
    }
  }, [mounted, _hasHydrated, isRefreshing, router])

  // Show loading while waiting for hydration, refresh, and auth check
  if (!mounted || !_hasHydrated || isRefreshing || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // After all checks, if not authenticated, show nothing (already redirecting)
  if (!isAuthenticated || !user) {
    return null
  }

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(user.role)
  )

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const getInitials = () => {
    return `${user.firstName[0]}${user.lastName[0]}`
  }

  const getRoleLabel = () => {
    switch (user.role) {
      case 'ADMIN':
        return 'מנהל מערכת'
      case 'MANAGER':
        return 'מנהל'
      case 'EMPLOYEE':
        return 'עובד'
      default:
        return ''
    }
  }

  // Sort navigation for mobile by mobileOrder
  const mobileNavigation = [...filteredNavigation].sort((a: any, b: any) => (a.mobileOrder || 99) - (b.mobileOrder || 99)).slice(0, 5)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Left side - Logo */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-primary rounded-lg">
                <Logo size="sm" className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm sm:text-lg hidden xs:inline">מנהל משמרות</span>
            </Link>
          </div>

          {/* Right side - Actions and Menu (ordered for RTL: last in code = leftmost visually) */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* User Menu - Desktop (rightmost visually in RTL) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full hidden sm:flex">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start" side="bottom">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user.firstName} {user.lastName}</span>
                    <span className="text-xs text-muted-foreground">{getRoleLabel()}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="ml-2 h-4 w-4" />
                  התנתק
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" asChild className="h-9 w-9 sm:h-10 sm:w-10">
              <Link href="/dashboard/notifications">
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              </Link>
            </Button>
            
            {/* Mobile menu button (leftmost visually in RTL) - 3 lines hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-10 w-10 sm:h-11 sm:w-11 hover:bg-primary/10"
              onClick={() => setSidebarOpen(true)}
            >
              <div className="flex flex-col gap-1.5">
                <div className="w-5 h-0.5 bg-foreground rounded-full"></div>
                <div className="w-5 h-0.5 bg-foreground rounded-full"></div>
                <div className="w-5 h-0.5 bg-foreground rounded-full"></div>
              </div>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-row-reverse">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Right side for RTL */}
        <aside
          className={cn(
            'fixed md:sticky top-0 md:top-16 right-0 z-50 md:z-auto h-screen md:h-[calc(100vh-4rem)] w-72 sm:w-80 md:w-64 border-l bg-background shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out md:flex md:flex-col',
            sidebarOpen ? 'flex flex-col translate-x-0' : 'hidden translate-x-full md:translate-x-0'
          )}
        >
          {/* Mobile header */}
          <div className="flex items-center justify-between p-4 border-b md:hidden bg-primary/5">
            <span className="font-bold text-xl">תפריט</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-11 w-11 hover:bg-destructive/10 border border-destructive/20" 
              onClick={() => setSidebarOpen(false)}
            >
              <X className="block h-7 w-7 min-h-7 min-w-7 text-destructive" strokeWidth={2.5} />
            </Button>
          </div>
          
          {/* Mobile user info */}
          <div className="p-4 border-b md:hidden bg-muted/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{user.firstName} {user.lastName}</div>
                <div className="text-xs text-muted-foreground">{getRoleLabel()}</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-all active:scale-95',
                    isActive
                      ? `${item.color} text-white shadow-lg`
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted'
                  )}
                >
                  <item.icon className="h-6 w-6 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Mobile logout button */}
          <div className="p-4 border-t md:hidden">
            <Button 
              variant="outline" 
              size="lg"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-12"
              onClick={handleLogout}
            >
              <LogOut className="ml-2 h-5 w-5" />
              התנתק
            </Button>
          </div>

          {/* Organization name - Desktop only */}
          <div className="p-4 border-t hidden md:block">
            <div className="text-xs text-muted-foreground">
              {user.organization?.name || 'הארגון שלי'}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full md:min-w-0 p-4 sm:p-6 md:p-6 pb-28 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-background/98 backdrop-blur-lg z-40 safe-area-pb shadow-[0_-2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
        <div className="grid grid-cols-5 gap-0.5 py-2 px-1">
          {mobileNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] transition-all active:scale-95',
                  isActive 
                    ? `${item.textColor} bg-current/10` 
                    : 'text-muted-foreground active:bg-muted'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-lg transition-all',
                  isActive && `${item.color} text-white shadow-md`
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="truncate w-full text-center leading-tight font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
