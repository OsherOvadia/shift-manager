'use client'

import { useAuthStore } from '@/lib/auth'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChefHat, Clock, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import { PageTransition, StaggerContainer, StaggerItem, motion } from '@/components/ui/animations'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

export default function KitchenDashboardPage() {
  const { user, accessToken } = useAuthStore()
  
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // Fetch kitchen staff monthly summary
  const { data: monthlySummary, isLoading } = useQuery({
    queryKey: ['kitchen-monthly-summary', currentYear, currentMonth],
    queryFn: () => api.get(`/reports/kitchen-monthly-summary?year=${currentYear}&month=${currentMonth}`, accessToken!),
    enabled: !!accessToken && !!user,
  })

  // Fetch recent weekly hours
  const { data: recentWeeks } = useQuery({
    queryKey: ['kitchen-recent-weeks'],
    queryFn: () => api.get('/reports/kitchen-recent-weeks', accessToken!),
    enabled: !!accessToken && !!user,
  })

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'בוקר טוב'
    if (hour < 18) return 'צהריים טובים'
    return 'ערב טוב'
  }

  const getJobLabel = () => {
    if (user?.jobCategory?.nameHe) return user.jobCategory.nameHe
    if (user?.jobCategory?.name === 'cook') return 'טבח'
    if (user?.jobCategory?.name === 'sushi') return 'סושיה'
    return 'מטבח'
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
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
              {getGreeting()}, {user?.firstName}!
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {getJobLabel()} • לוח שעות עבודה
          </p>
        </motion.div>

        {/* Monthly Summary Cards */}
        <StaggerContainer className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4">
          <StaggerItem>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5 pb-3">
                <CardTitle className="text-sm sm:text-base font-semibold">שעות החודש</CardTitle>
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 flex-shrink-0" />
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                {isLoading ? (
                  <div className="text-2xl sm:text-3xl font-bold text-gray-400">...</div>
                ) : (
                  <>
                    <div className="text-3xl sm:text-4xl font-bold text-blue-600">
                      {monthlySummary?.totalHours?.toFixed(1) || '0'}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      שעות עבודה
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5 pb-3">
                <CardTitle className="text-sm sm:text-base font-semibold">שכר החודש</CardTitle>
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 flex-shrink-0" />
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                {isLoading ? (
                  <div className="text-2xl sm:text-3xl font-bold text-gray-400">...</div>
                ) : (
                  <>
                    <div className="text-3xl sm:text-4xl font-bold text-green-600">
                      ₪{monthlySummary?.totalEarnings?.toFixed(0) || '0'}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      סה"כ משוער
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-5 pb-3">
                <CardTitle className="text-sm sm:text-base font-semibold">שכר לשעה</CardTitle>
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500 flex-shrink-0" />
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                <div className="text-3xl sm:text-4xl font-bold text-purple-600">
                  ₪{user?.hourlyWage?.toFixed(0) || '0'}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  לשעה
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        {/* Recent Weeks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              שעות לפי שבוע
            </CardTitle>
            <CardDescription>
              סיכום שעות העבודה שלך בשבועות האחרונים
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!recentWeeks || recentWeeks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>אין נתונים עדיין</p>
                <p className="text-sm mt-1">שעות העבודה שלך יופיעו כאן</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentWeeks.map((week: any, idx: number) => (
                  <motion.div
                    key={week.weekStart}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <div>
                      <div className="font-medium">
                        שבוע {format(new Date(week.weekStart), 'dd/MM/yyyy', { locale: he })}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {week.totalHours.toFixed(1)} שעות • ₪{week.totalEarnings.toFixed(0)}
                      </div>
                    </div>
                    <Badge variant={week.totalHours >= 40 ? 'default' : 'secondary'}>
                      {week.totalHours >= 40 ? 'משרה מלאה' : 'משרה חלקית'}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-orange-900 dark:text-orange-100 flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              מידע חשוב
            </CardTitle>
          </CardHeader>
          <CardContent className="text-orange-900 dark:text-orange-100 space-y-2 text-sm">
            <p>• שעות העבודה מתעדכנות אוטומטית על ידי המנהל</p>
            <p>• השכר מחושב לפי {user?.hourlyWage}₪ לשעה</p>
            <p>• לשאלות או בעיות, פנה למנהל</p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
