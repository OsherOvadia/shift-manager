'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore, isManager, isAdmin } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  { name: 'דוחות עלויות', href: '/dashboard/reports', icon: DollarSign, roles: ['ADMIN', 'MANAGER'], mobileOrder: 8, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
  { name: 'הגדרות', href: '/dashboard/settings', icon: Settings, roles: ['ADMIN'], mobileOrder: 9, color: 'bg-slate-500', textColor: 'text-slate-600' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, logout, _hasHydrated } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Only check auth after hydration is complete
    if (_hasHydrated && !isAuthenticated) {
      router.push('/login')
    }
  }, [_hasHydrated, isAuthenticated, router])

  // Show nothing while waiting for hydration
  if (!_hasHydrated || !isAuthenticated || !user) {
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
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
          {/* Right side - Logo and menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-primary rounded-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm sm:text-lg hidden xs:inline">מנהל משמרות</span>
            </Link>
          </div>

          {/* Left side - Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 sm:h-9 sm:w-9">
              <Link href="/dashboard/notifications">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            </Button>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* User Menu - Desktop */}
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
            'fixed md:sticky top-0 md:top-16 right-0 z-50 md:z-auto h-screen md:h-[calc(100vh-4rem)] w-64 flex-col border-s bg-background transition-transform duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
            'md:flex'
          )}
        >
          {/* Mobile header */}
          <div className="flex items-center justify-between p-4 border-b md:hidden">
            <span className="font-bold text-lg">תפריט</span>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
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

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? `${item.color} text-white shadow-lg`
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Mobile logout button */}
          <div className="p-3 border-t md:hidden">
            <Button 
              variant="outline" 
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="ml-2 h-4 w-4" />
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
        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur z-40 safe-area-pb">
        <div className="grid grid-cols-5 gap-1 py-2 px-2">
          {mobileNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={true}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[10px] transition-colors',
                  isActive 
                    ? `${item.textColor} bg-current/10` 
                    : 'text-muted-foreground active:bg-muted'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isActive && `${item.color} text-white`
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
