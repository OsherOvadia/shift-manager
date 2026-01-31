'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns'
import { he } from 'date-fns/locale'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Coins,
  Save,
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

const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export default function RevenuePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [revenueInputs, setRevenueInputs] = useState<{ [key: string]: string }>({})
  const [tipsInputs, setTipsInputs] = useState<{ [key: string]: string }>({})
  const [savingRevenue, setSavingRevenue] = useState<string | null>(null)
  const [savingTips, setSavingTips] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()

  // Generate week dates
  const weekDates = useMemo(() => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(weekStart, i))
    }
    return dates
  }, [weekStart])

  // Fetch weekly report for the selected week
  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: ['weekly-costs', weekStart.toISOString()],
    queryFn: () => api.get(`/reports/weekly-costs?date=${weekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5,
  })

  // Fetch shift assignments for tips entry
  const { data: scheduleData } = useQuery({
    queryKey: ['schedule-for-week', weekStart.toISOString()],
    queryFn: () => api.get(`/schedules/week/${weekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken,
  })

  const saveDailyRevenueMutation = useMutation({
    mutationFn: (data: { date: string; totalRevenue: number }) =>
      api.post('/daily-revenues', data, accessToken!),
    onSuccess: () => {
      toast({
        title: 'נשמר',
        description: 'הכנסה יומית נשמרה בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['weekly-costs'] })
      setSavingRevenue(null)
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'שגיאה בשמירת הכנסה',
        variant: 'destructive',
      })
      setSavingRevenue(null)
    },
  })

  const updateTipsMutation = useMutation({
    mutationFn: ({ assignmentId, tips }: { assignmentId: string; tips: number }) =>
      api.patch(`/assignments/${assignmentId}`, { tipsEarned: tips }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-costs'] })
      setSavingTips(null)
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'שגיאה בשמירת טיפים',
        variant: 'destructive',
      })
      setSavingTips(null)
    },
  })

  const previousWeek = () => setWeekStart(subWeeks(weekStart, 1))
  const nextWeek = () => setWeekStart(addWeeks(weekStart, 1))

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount)
  }

  const handleSaveRevenue = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0]
    const amount = parseFloat(revenueInputs[dateKey] || '0')
    
    if (isNaN(amount) || amount < 0) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן סכום תקין',
        variant: 'destructive',
      })
      return
    }

    setSavingRevenue(dateKey)
    saveDailyRevenueMutation.mutate({
      date: date.toISOString(),
      totalRevenue: amount,
    })
  }

  const handleSaveTips = (assignmentId: string, dateKey: string) => {
    const amount = parseFloat(tipsInputs[`${assignmentId}`] || '0')
    
    if (isNaN(amount) || amount < 0) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן סכום תקין',
        variant: 'destructive',
      })
      return
    }

    setSavingTips(assignmentId)
    updateTipsMutation.mutate({
      assignmentId,
      tips: amount,
    })
  }

  // Get existing revenue for a date
  const getRevenueForDate = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0]
    const dayData = report?.byDay?.find(
      (d: any) => new Date(d.date).toISOString().split('T')[0] === dateKey
    )
    return dayData?.revenue || 0
  }

  // Get waiter shifts for a specific date
  const getWaiterShiftsForDate = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0]
    const shifts: any[] = []
    
    report?.byEmployee?.forEach((emp: any) => {
      if (emp.user.isTipBased) {
        emp.shifts?.forEach((shift: any) => {
          const shiftDateKey = new Date(shift.date).toISOString().split('T')[0]
          if (shiftDateKey === dateKey) {
            shifts.push({
              ...shift,
              employee: emp.user,
            })
          }
        })
      }
    })
    
    return shifts
  }

  // Initialize inputs when report loads
  useMemo(() => {
    if (report?.byDay) {
      const newRevenueInputs: { [key: string]: string } = {}
      report.byDay.forEach((day: any) => {
        const dateKey = new Date(day.date).toISOString().split('T')[0]
        if (day.revenue > 0) {
          newRevenueInputs[dateKey] = day.revenue.toString()
        }
      })
      setRevenueInputs(prev => ({ ...newRevenueInputs, ...prev }))
    }
    
    if (report?.byEmployee) {
      const newTipsInputs: { [key: string]: string } = {}
      report.byEmployee.forEach((emp: any) => {
        emp.shifts?.forEach((shift: any) => {
          if (shift.tips > 0) {
            newTipsInputs[shift.assignmentId] = shift.tips.toString()
          }
        })
      })
      setTipsInputs(prev => ({ ...newTipsInputs, ...prev }))
    }
  }, [report])

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
              הכנסות וטיפים
            </h1>
            <p className="text-sm text-muted-foreground">הזנת הכנסות יומיות וטיפים לעובדים</p>
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
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/4 mb-3" />
                  <div className="h-10 bg-muted rounded animate-pulse w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Daily Revenue Entry */}
            <Card>
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  הכנסות יומיות
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                  {weekDates.map((date, index) => {
                    const dateKey = date.toISOString().split('T')[0]
                    const existingRevenue = getRevenueForDate(date)
                    const dayData = report?.byDay?.find(
                      (d: any) => new Date(d.date).toISOString().split('T')[0] === dateKey
                    )
                    
                    return (
                      <div key={index} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {HEBREW_DAYS[date.getDay()]} {format(date, 'dd/MM', { locale: he })}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">הכנסה (₪)</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              placeholder="0"
                              value={revenueInputs[dateKey] ?? (existingRevenue > 0 ? existingRevenue.toString() : '')}
                              onChange={(e) => setRevenueInputs(prev => ({
                                ...prev,
                                [dateKey]: e.target.value
                              }))}
                              className="h-8 text-sm"
                              min="0"
                            />
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-2"
                              onClick={() => handleSaveRevenue(date)}
                              disabled={savingRevenue === dateKey}
                            >
                              {savingRevenue === dateKey ? (
                                <motion.div 
                                  className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {dayData && (
                          <div className="text-[10px] text-muted-foreground pt-1 border-t">
                            שכר: {formatCurrency(dayData.totalCost || 0)}
                            {dayData.revenue > 0 && (
                              <span className={dayData.salaryPercentage > 50 ? ' text-red-500' : ' text-green-500'}>
                                {' '}({dayData.salaryPercentage?.toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tips Entry for Waiters */}
            <Card>
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-500" />
                  טיפים למלצרים
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2">
                {weekDates.map((date, dayIndex) => {
                  const waiterShifts = getWaiterShiftsForDate(date)
                  
                  if (waiterShifts.length === 0) return null
                  
                  return (
                    <div key={dayIndex} className="mb-4 last:mb-0">
                      <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Badge variant="outline">{HEBREW_DAYS[date.getDay()]}</Badge>
                        {format(date, 'dd/MM', { locale: he })}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {waiterShifts.map((shift: any, shiftIndex: number) => (
                          <div key={shiftIndex} className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">
                                {shift.employee.firstName} {shift.employee.lastName}
                              </span>
                              <Badge variant="secondary" className="text-[10px]">
                                {shift.shiftTemplate.name}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground">טיפים (₪)</Label>
                                <div className="flex gap-1">
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={tipsInputs[shift.assignmentId] ?? (shift.tips > 0 ? shift.tips.toString() : '')}
                                    onChange={(e) => setTipsInputs(prev => ({
                                      ...prev,
                                      [shift.assignmentId]: e.target.value
                                    }))}
                                    className="h-8 text-sm"
                                    min="0"
                                  />
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 px-2"
                                    onClick={() => handleSaveTips(shift.assignmentId, date.toISOString())}
                                    disabled={savingTips === shift.assignmentId}
                                  >
                                    {savingTips === shift.assignmentId ? (
                                      <motion.div 
                                        className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                      />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {shift.hours.toFixed(1)} שעות | בסיס: {shift.employee.baseHourlyWage} ₪/שעה
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                
                {!report?.byEmployee?.some((emp: any) => emp.user.isTipBased) && (
                  <p className="text-muted-foreground text-center py-4 text-sm">
                    אין עובדים מבוססי טיפים במערכת
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            {report?.summary && (
              <Card>
                <CardHeader className="p-4 sm:p-6 pb-2">
                  <CardTitle className="text-base sm:text-lg">סיכום שבועי</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <div className="text-lg font-bold text-emerald-600">
                        {formatCurrency(report.summary.totalRevenue || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">סה״כ הכנסות</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-lg font-bold text-red-600">
                        {formatCurrency(report.summary.totalCost || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">סה״כ שכר</div>
                    </div>
                    <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <div className="text-lg font-bold text-amber-600">
                        {formatCurrency(report.summary.totalTips || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">סה״כ טיפים</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {report.summary.profitMargin?.toFixed(1) || 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">רווח</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
