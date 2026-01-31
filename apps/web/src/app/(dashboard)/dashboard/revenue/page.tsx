'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import {
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Coins,
  Save,
  Users,
  Clock,
  CalendarDays,
  Utensils,
  Receipt,
} from 'lucide-react'
import { 
  PageTransition, 
  StaggerContainer, 
  StaggerItem, 
  ScaleOnTap,
  motion,
  AnimatePresence
} from '@/components/ui/animations'
import { formatDateLocal } from '@/lib/utils'

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const SHIFT_TYPES: Record<string, { label: string; color: string }> = {
  MORNING: { label: 'בוקר', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  AFTERNOON: { label: 'צהריים', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  EVENING: { label: 'ערב', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  NIGHT: { label: 'לילה', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
}

export default function RevenuePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [selectedDay, setSelectedDay] = useState<number>(0)
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

  const selectedDate = weekDates[selectedDay]

  // Fetch schedule with shift assignments for the week
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule-week', weekStart.toISOString()],
    queryFn: () => api.get(`/schedules/week/${weekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken,
  })

  // Fetch daily revenues for the week
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['daily-revenues', weekStart.toISOString()],
    queryFn: () => api.get(`/daily-revenues?startDate=${weekStart.toISOString()}&endDate=${addWeeks(weekStart, 1).toISOString()}`, accessToken!),
    enabled: !!accessToken,
  })

  const isLoading = scheduleLoading || revenueLoading

  // Initialize revenue inputs from fetched data
  useEffect(() => {
    if (revenueData && Array.isArray(revenueData)) {
      const newInputs: { [key: string]: string } = {}
      revenueData.forEach((r: any) => {
        const dateKey = formatDateLocal(new Date(r.date))
        newInputs[dateKey] = r.totalRevenue.toString()
      })
      setRevenueInputs(prev => ({ ...newInputs, ...prev }))
    }
  }, [revenueData])

  // Initialize tips inputs from schedule data
  useEffect(() => {
    if (scheduleData?.shiftAssignments) {
      const newInputs: { [key: string]: string } = {}
      scheduleData.shiftAssignments.forEach((a: any) => {
        if (a.tipsEarned && a.tipsEarned > 0) {
          newInputs[a.id] = a.tipsEarned.toString()
        }
      })
      setTipsInputs(prev => ({ ...newInputs, ...prev }))
    }
  }, [scheduleData])

  const saveDailyRevenueMutation = useMutation({
    mutationFn: (data: { date: string; totalRevenue: number }) =>
      api.post('/daily-revenues', data, accessToken!),
    onSuccess: () => {
      toast({
        title: 'נשמר בהצלחה',
        description: 'הכנסת היום נשמרה',
      })
      queryClient.invalidateQueries({ queryKey: ['daily-revenues'] })
      setSavingRevenue(null)
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את ההכנסה',
        variant: 'destructive',
      })
      setSavingRevenue(null)
    },
  })

  const updateTipsMutation = useMutation({
    mutationFn: ({ assignmentId, tips }: { assignmentId: string; tips: number }) =>
      api.patch(`/assignments/${assignmentId}`, { tipsEarned: tips }, accessToken!),
    onSuccess: () => {
      toast({
        title: 'נשמר',
        description: 'הטיפ נשמר בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['schedule-week'] })
      setSavingTips(null)
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את הטיפ',
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
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleSaveRevenue = (date: Date) => {
    const dateKey = formatDateLocal(date)
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

  const handleSaveTips = (assignmentId: string) => {
    const amount = parseFloat(tipsInputs[assignmentId] || '0')
    
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

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date) => {
    if (!scheduleData?.shiftAssignments) return []
    const dateStr = formatDateLocal(date)
    return scheduleData.shiftAssignments.filter((a: any) => 
      formatDateLocal(new Date(a.shiftDate)) === dateStr && a.status !== 'CANCELLED'
    )
  }

  // Get revenue for a specific date
  const getRevenueForDate = (date: Date) => {
    if (!revenueData || !Array.isArray(revenueData)) return null
    const dateStr = formatDateLocal(date)
    return revenueData.find((r: any) => formatDateLocal(new Date(r.date)) === dateStr)
  }

  // Calculate totals for summary
  const weeklyTotals = useMemo(() => {
    let totalRevenue = 0
    let totalTips = 0
    let totalShifts = 0

    if (revenueData && Array.isArray(revenueData)) {
      totalRevenue = revenueData.reduce((sum: number, r: any) => sum + (r.totalRevenue || 0), 0)
    }

    if (scheduleData?.shiftAssignments) {
      totalTips = scheduleData.shiftAssignments.reduce((sum: number, a: any) => sum + (a.tipsEarned || 0), 0)
      totalShifts = scheduleData.shiftAssignments.filter((a: any) => a.status !== 'CANCELLED').length
    }

    return { totalRevenue, totalTips, totalShifts }
  }, [revenueData, scheduleData])

  const shiftsForSelectedDay = getShiftsForDate(selectedDate)

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
              <Utensils className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              קופה וטיפים
            </h1>
            <p className="text-sm text-muted-foreground">ניהול הכנסות יומיות וטיפים למשמרות</p>
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
                className="min-w-[140px] sm:min-w-[180px] text-center text-xs sm:text-sm font-medium"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {format(weekStart, 'dd MMM', { locale: he })} - {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: he })}
              </motion.span>
            </AnimatePresence>
            <ScaleOnTap>
              <Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </ScaleOnTap>
          </motion.div>
        </div>

        {/* Weekly Summary Cards */}
        <StaggerContainer className="grid grid-cols-3 gap-3 sm:gap-4">
          <StaggerItem>
            <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">סה״כ קופה</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(weeklyTotals.totalRevenue)}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-amber-700 dark:text-amber-400">סה״כ טיפים</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-400">
                  {formatCurrency(weeklyTotals.totalTips)}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-700 dark:text-blue-400">משמרות</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-400">
                  {weeklyTotals.totalShifts}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-2">
                <motion.div 
                  className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <span className="text-muted-foreground">טוען נתונים...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Day Selector Tabs */}
            <Tabs value={selectedDay.toString()} onValueChange={(v) => setSelectedDay(parseInt(v))} className="w-full">
              <TabsList className="w-full grid grid-cols-7 h-auto p-1">
                {weekDates.map((date, index) => {
                  const dayShifts = getShiftsForDate(date)
                  const dayRevenue = getRevenueForDate(date)
                  const hasData = dayShifts.length > 0 || dayRevenue
                  
                  return (
                    <TabsTrigger
                      key={index}
                      value={index.toString()}
                      className="flex flex-col gap-0.5 py-2 px-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span className="text-[10px] sm:text-xs font-medium">{HEBREW_DAYS[date.getDay()]}</span>
                      <span className="text-[10px] text-muted-foreground data-[state=active]:text-primary-foreground/70">
                        {format(date, 'd/M')}
                      </span>
                      {hasData && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 data-[state=active]:bg-emerald-300" />
                      )}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {weekDates.map((date, index) => (
                <TabsContent key={index} value={index.toString()} className="mt-4 space-y-4">
                  {/* Daily Revenue Card */}
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-emerald-500" />
                        הכנסת קופה - יום {HEBREW_DAYS[date.getDay()]} {format(date, 'd בMMMM', { locale: he })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="flex items-end gap-3">
                        <div className="flex-1 max-w-xs">
                          <Label className="text-sm text-muted-foreground mb-1 block">סכום הכנסה מהקופה (₪)</Label>
                          <Input
                            type="number"
                            placeholder="הזן סכום..."
                            value={revenueInputs[formatDateLocal(date)] || ''}
                            onChange={(e) => setRevenueInputs(prev => ({
                              ...prev,
                              [formatDateLocal(date)]: e.target.value
                            }))}
                            className="h-12 text-lg"
                            min="0"
                          />
                        </div>
                        <Button 
                          size="lg"
                          onClick={() => handleSaveRevenue(date)}
                          disabled={savingRevenue === formatDateLocal(date)}
                          className="h-12 px-6"
                        >
                          {savingRevenue === formatDateLocal(date) ? (
                            <motion.div 
                              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                          ) : (
                            <>
                              <Save className="h-4 w-4 ml-2" />
                              שמור
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shifts Tips Entry */}
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Coins className="h-5 w-5 text-amber-500" />
                        טיפים למשמרות ({shiftsForSelectedDay.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      {shiftsForSelectedDay.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                          <p>אין משמרות ביום זה</p>
                          <p className="text-sm">שבץ עובדים למשמרות כדי להזין טיפים</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {shiftsForSelectedDay.map((assignment: any) => (
                            <div 
                              key={assignment.id} 
                              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                            >
                              {/* Employee Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium truncate">
                                    {assignment.user?.firstName} {assignment.user?.lastName}
                                  </span>
                                  <Badge 
                                    className={SHIFT_TYPES[assignment.shiftTemplate?.shiftType]?.color || 'bg-gray-100'}
                                  >
                                    {SHIFT_TYPES[assignment.shiftTemplate?.shiftType]?.label || assignment.shiftTemplate?.name}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {assignment.shiftTemplate?.startTime} - {assignment.shiftTemplate?.endTime}
                                  </span>
                                  {assignment.user?.jobCategory && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {assignment.user.jobCategory.nameHe || assignment.user.jobCategory.name}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Tips Input */}
                              <div className="flex items-center gap-2">
                                <div className="w-24">
                                  <Input
                                    type="number"
                                    placeholder="טיפ ₪"
                                    value={tipsInputs[assignment.id] || ''}
                                    onChange={(e) => setTipsInputs(prev => ({
                                      ...prev,
                                      [assignment.id]: e.target.value
                                    }))}
                                    className="h-9 text-center"
                                    min="0"
                                  />
                                </div>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveTips(assignment.id)}
                                  disabled={savingTips === assignment.id}
                                  className="h-9 w-9 p-0"
                                >
                                  {savingTips === assignment.id ? (
                                    <motion.div 
                                      className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
    </PageTransition>
  )
}
