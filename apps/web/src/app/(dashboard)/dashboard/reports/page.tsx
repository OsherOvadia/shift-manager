'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { he } from 'date-fns/locale'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Clock,
  Users,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { 
  PageTransition, 
  StaggerContainer, 
  StaggerItem, 
  ScaleOnTap,
  motion,
  AnimatePresence
} from '@/components/ui/animations'

export default function ReportsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ['weekly-costs', weekStart.toISOString()],
    queryFn: () => api.get(`/reports/weekly-costs?date=${weekStart.toISOString()}`),
    staleTime: 1000 * 60 * 5,
  })

  const previousWeek = () => setWeekStart(subWeeks(weekStart, 1))
  const nextWeek = () => setWeekStart(addWeeks(weekStart, 1))

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount)
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              דוחות עלויות
            </h1>
            <p className="text-sm text-muted-foreground">סקירת עלויות עובדים לפי שבוע</p>
          </motion.div>

          {/* Week Navigation */}
          <motion.div 
            className="flex items-center gap-2 bg-muted rounded-lg p-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <ScaleOnTap>
              <Button variant="ghost" size="icon" onClick={previousWeek} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </ScaleOnTap>
            <AnimatePresence mode="wait">
              <motion.span 
                key={weekStart.toISOString()}
                className="min-w-[120px] sm:min-w-[160px] text-center text-xs sm:text-sm font-medium"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {format(weekStart, 'dd/MM', { locale: he })} - {format(addWeeks(weekStart, 1), 'dd/MM/yy', { locale: he })}
              </motion.span>
            </AnimatePresence>
            <ScaleOnTap>
              <Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </ScaleOnTap>
            {isFetching && (
              <motion.div 
                className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </motion.div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2 mb-3" />
                  <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : report ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StaggerItem>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs sm:text-sm font-medium">סה״כ עלות</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg sm:text-xl font-bold text-green-600">
                      {formatCurrency(report.summary.totalCost)}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs sm:text-sm font-medium">שעות עבודה</CardTitle>
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg sm:text-xl font-bold text-blue-600">
                      {report.summary.totalHours.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs sm:text-sm font-medium">עובדים</CardTitle>
                      <Users className="h-4 w-4 text-purple-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg sm:text-xl font-bold text-purple-600">
                      {report.summary.employeeCount}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs sm:text-sm font-medium">משמרות</CardTitle>
                      <Calendar className="h-4 w-4 text-orange-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-lg sm:text-xl font-bold text-orange-600">
                      {report.summary.shiftCount}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>

            {/* Cost by Category */}
            <Card>
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="text-sm sm:text-base">עלות לפי קטגוריה</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {report.byCategory.length > 0 ? (
                  <div className="space-y-2">
                    {report.byCategory.map((cat: any) => (
                      <motion.div 
                        key={cat.category.id} 
                        className="flex items-center justify-between p-2.5 bg-muted rounded-lg"
                        whileHover={{ scale: 1.01 }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.category.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{cat.category.nameHe}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              {cat.employeeCount} עובדים • {cat.totalHours.toFixed(1)} שעות
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-sm flex-shrink-0">{formatCurrency(cat.totalCost)}</div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4 text-sm">אין נתונים</p>
                )}
              </CardContent>
            </Card>

            {/* Cost by Employee */}
            <Card>
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="text-sm sm:text-base">עלות לפי עובד</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {report.byEmployee.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {report.byEmployee.map((emp: any) => (
                      <div 
                        key={emp.user.id} 
                        className="flex items-center justify-between p-2.5 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {emp.user.jobCategory && (
                            <div
                              className="w-1.5 h-6 rounded-full flex-shrink-0"
                              style={{ backgroundColor: emp.user.jobCategory.color }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {emp.user.firstName} {emp.user.lastName}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                              {emp.user.jobCategory?.nameHe || 'ללא'} • {emp.totalHours.toFixed(1)} שעות
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-sm flex-shrink-0">{formatCurrency(emp.totalCost)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4 text-sm">אין נתונים</p>
                )}
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            <Card>
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="text-sm sm:text-base">פירוט יומי</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
                  {report.byDay.map((day: any, index: number) => (
                    <motion.div 
                      key={index} 
                      className="p-2 bg-muted rounded-lg text-center"
                      whileHover={{ scale: 1.05 }}
                    >
                      <div className="text-[10px] text-muted-foreground truncate">
                        {format(new Date(day.date), 'EEE', { locale: he })}
                      </div>
                      <div className="font-bold text-xs sm:text-sm mt-0.5">
                        {formatCurrency(day.totalCost).replace('₪', '')}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                        {day.totalHours.toFixed(0)}ש׳
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              אין נתונים להצגה
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  )
}
