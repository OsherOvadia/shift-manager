'use client'

import { useMemo } from 'react'
import { useAuthStore, isManager } from '@/lib/auth'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { startOfWeek, addWeeks } from 'date-fns'
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  Briefcase,
  DollarSign,
  TrendingUp,
  Coins,
} from 'lucide-react'
import { PageTransition, StaggerContainer, StaggerItem, motion } from '@/components/ui/animations'

export default function DashboardPage() {
  const { user, accessToken } = useAuthStore()
  const isManagerRole = isManager()
  
  // Get current week start date
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 })
  const nextWeekStart = addWeeks(currentWeekStart, 1)

  // Fetch user's shifts for this week (only for employees, not managers/admins)
  const { data: mySchedule } = useQuery({
    queryKey: ['my-schedule', currentWeekStart.toISOString()],
    queryFn: () => api.get(`/schedules/my-week/${currentWeekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken && !!user && !isManagerRole,
  })

  // Fetch user's availability status for next week (only for employees, not managers/admins)
  const { data: myAvailability } = useQuery({
    queryKey: ['my-availability', nextWeekStart.toISOString()],
    queryFn: () => api.get(`/availability/week/${nextWeekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken && !!user && !isManagerRole,
  })

  // Fetch worker hours summary (only for employees, not managers/admins)
  const { data: hoursSummary } = useQuery({
    queryKey: ['worker-hours-summary'],
    queryFn: () => api.get('/reports/worker-hours-summary', accessToken!),
    enabled: !!accessToken && !!user && !isManagerRole,
  })

  // Fetch employee monthly cash tips (only for employees, not managers/admins)
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const { data: monthlyCashTips } = useQuery({
    queryKey: ['employee-monthly-cash-tips', currentYear, currentMonth],
    queryFn: () => api.get(`/reports/employee-monthly-cash-tips?year=${currentYear}&month=${currentMonth}`, accessToken!),
    enabled: !!accessToken && !!user && !isManagerRole,
  })

  // Fetch employees (for managers)
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<any[]>('/users/employees', accessToken!),
    enabled: !!accessToken && isManagerRole,
  })

  // Fetch all availability submissions for next week (for managers)
  const { data: allAvailability } = useQuery({
    queryKey: ['all-availability', nextWeekStart.toISOString()],
    queryFn: () => api.get<any[]>(`/availability/week/${nextWeekStart.toISOString()}/all`, accessToken!),
    enabled: !!accessToken && isManagerRole,
  })

  // Calculate stats
  const myShiftsCount = mySchedule?.shiftAssignments?.length || 0
  // API /users/employees already filters by isActive and isApproved, so just count the length
  const activeEmployeesCount = employees?.length || 0
  const totalEmployees = employees?.length || 0
  const pendingAvailability = allAvailability?.filter((a: any) => a.status === 'PENDING' || !a.submittedAt).length || 0
  const availabilityStatus = myAvailability?.status || 'NOT_SUBMITTED'

  // Identify employees who haven't submitted availability for next week
  const employeesWithoutAvailability = useMemo(() => {
    if (!employees || !allAvailability || !isManagerRole) return []
    
    const submittedUserIds = new Set(
      allAvailability.map((a: any) => a.userId || a.user?.id).filter(Boolean)
    )
    
    return employees.filter(emp => !submittedUserIds.has(emp.id))
  }, [employees, allAvailability, isManagerRole])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'בוקר טוב'
    if (hour < 18) return 'צהריים טובים'
    return 'ערב טוב'
  }

  const getEmploymentTypeLabel = () => {
    return user?.employmentType === 'FULL_TIME' ? 'משרה מלאה' : 'משרה חלקית'
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6">
        {/* Welcome Section */}
        <motion.div 
          className="flex flex-col gap-1"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="text-sm text-muted-foreground">
            ברוך הבא למערכת ניהול המשמרות
          </p>
        </motion.div>

        {/* Quick Stats - MOBILE OPTIMIZED */}
        <StaggerContainer className="grid grid-cols-1 xs:grid-cols-2 gap-4 lg:grid-cols-5">
          {!isManagerRole && (
            <>
              <StaggerItem>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5 pb-3">
                    <CardTitle className="text-sm sm:text-base font-semibold">המשמרות שלי השבוע</CardTitle>
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <div className="text-3xl sm:text-4xl font-bold text-blue-600">{myShiftsCount}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      משמרות מתוכננות
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium leading-tight">סטטוס זמינות</CardTitle>
                    <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    {availabilityStatus === 'APPROVED' ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] sm:text-xs">
                        אושר
                      </Badge>
                    ) : availabilityStatus === 'PENDING' ? (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] sm:text-xs">
                        ממתין לאישור
                      </Badge>
                    ) : availabilityStatus === 'REJECTED' ? (
                      <Badge variant="destructive" className="text-[10px] sm:text-xs">
                        נדחה
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] sm:text-xs">
                        טרם הוגש
                      </Badge>
                    )}
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">
                      {availabilityStatus === 'APPROVED' ? 'הזמינות לשבוע הבא אושרה' : 
                       availabilityStatus === 'PENDING' ? 'הזמינות שלך ממתינה לאישור' :
                       availabilityStatus === 'REJECTED' ? 'יש לעדכן את הזמינות' :
                       'יש להגיש זמינות לשבוע הבא'}
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium leading-tight">שעות השבוע</CardTitle>
                    <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                      {hoursSummary?.weeklyHours || 0}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      שעות עבודה השבוע
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium leading-tight">שעות החודש</CardTitle>
                    <DollarSign className="h-4 w-4 text-purple-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="text-xl sm:text-2xl font-bold text-purple-600">
                      {hoursSummary?.monthlyHours || 0}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      שעות עבודה החודש
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="h-full bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium leading-tight text-amber-700 dark:text-amber-400">טיפים מזומן חודשי</CardTitle>
                    <Coins className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="text-xl sm:text-2xl font-bold text-amber-700 dark:text-amber-400">
                      ₪{monthlyCashTips?.totalCashTips?.toFixed(0) || 0}
                    </div>
                    <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-500">
                      מ-{monthlyCashTips?.shiftCount || 0} משמרות
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            </>
          )}

          {isManagerRole && (
            <>
              <StaggerItem>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium leading-tight">עובדים פעילים</CardTitle>
                    <Users className="h-4 w-4 text-green-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="text-xl sm:text-2xl font-bold text-green-600">{activeEmployeesCount}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      מתוך {totalEmployees} עובדים במערכת
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium leading-tight">זמינויות ממתינות</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="text-xl sm:text-2xl font-bold text-orange-600">{pendingAvailability}</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      זמינויות ממתינות לאישור
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            </>
          )}
        </StaggerContainer>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold">פעולות מהירות</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {!isManagerRole && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link href="/dashboard/availability">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 sm:p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base">הגשת זמינות</div>
                        <div className="text-xs text-muted-foreground truncate">הגש את הזמינות לשבוע הקרוב</div>
                      </div>
                      <ChevronLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/dashboard/schedule">
                <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                      <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm sm:text-base">לוח המשמרות</div>
                      <div className="text-xs text-muted-foreground truncate">צפה בלוח המשמרות השבועי</div>
                    </div>
                    <ChevronLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>

            {isManagerRole && (
              <>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link href="/dashboard/employees">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 sm:p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm sm:text-base">ניהול עובדים</div>
                          <div className="text-xs text-muted-foreground truncate">הוסף, ערוך או הסר עובדים</div>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link href="/dashboard/job-categories">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 sm:p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                          <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm sm:text-base">קטגוריות תפקידים</div>
                          <div className="text-xs text-muted-foreground truncate">נהל את סוגי התפקידים</div>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link href="/dashboard/reports">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 sm:p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                          <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm sm:text-base">דוחות עלויות</div>
                          <div className="text-xs text-muted-foreground truncate">צפה בעלויות שבועיות</div>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link href="/dashboard/revenue">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 sm:p-3 rounded-xl bg-teal-100 dark:bg-teal-900/30">
                          <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm sm:text-base">הכנסות וטיפים</div>
                          <div className="text-xs text-muted-foreground truncate">הזנת הכנסות יומיות וטיפים</div>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Missing Availability Submissions - for managers only */}
        {isManagerRole && employeesWithoutAvailability.length > 0 && (
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                עובדים שטרם הגישו זמינות לשבוע הבא
              </CardTitle>
              <CardDescription className="text-orange-600/80 dark:text-orange-500/80">
                {employeesWithoutAvailability.length} עובדים טרם הגישו זמינות
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {employeesWithoutAvailability.map((emp: any) => (
                  <div 
                    key={emp.id}
                    className="flex items-center justify-between p-2 bg-background rounded-lg border border-orange-200 dark:border-orange-800"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {emp.firstName} {emp.lastName}
                        </div>
                        {emp.jobCategory && (
                          <div className="text-xs text-muted-foreground truncate">
                            {emp.jobCategory.nameHe || emp.jobCategory.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 flex-shrink-0">
                      טרם הגיש
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Info Card */}
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">פרטי המשתמש</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">שם מלא</p>
                <p className="font-medium text-sm sm:text-base">{user?.firstName} {user?.lastName}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">אימייל</p>
                <p className="font-medium text-sm sm:text-base truncate">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">סוג העסקה</p>
                <Badge variant="secondary" className="text-xs">{getEmploymentTypeLabel()}</Badge>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">תפקיד</p>
                <Badge className="text-xs">
                  {user?.role === 'ADMIN' ? 'מנהל מערכת' : user?.role === 'MANAGER' ? 'מנהל' : 'עובד'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
