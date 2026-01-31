'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addWeeks, subWeeks, addDays } from 'date-fns'
import { he } from 'date-fns/locale'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { getWeekStartDate } from '@/lib/utils'
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
  const [weekStart, setWeekStart] = useState(() => getWeekStartDate(new Date()))
  const [selectedDay, setSelectedDay] = useState<number>(0)
  const [revenueInputs, setRevenueInputs] = useState<{ [key: string]: string }>({})
  const [sittingInputs, setSittingInputs] = useState<{ [key: string]: string }>({})
  const [takeawayInputs, setTakeawayInputs] = useState<{ [key: string]: string }>({})
  const [deliveryInputs, setDeliveryInputs] = useState<{ [key: string]: string }>({})
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
    queryFn: async () => {
      const result = await api.get(`/schedules/week/${weekStart.toISOString()}`, accessToken!)
      return result
    },
    enabled: !!accessToken,
  })

  // Fetch daily revenues for the week
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['daily-revenues', weekStart.toISOString()],
    queryFn: () => api.get(`/daily-revenues?startDate=${weekStart.toISOString()}&endDate=${addWeeks(weekStart, 1).toISOString()}`, accessToken!),
    enabled: !!accessToken,
  })

  const isLoading = scheduleLoading || revenueLoading

  // Helper to extract date string
  const getDateStr = (date: Date | string) => {
    if (typeof date === 'string') {
      return date.split('T')[0]
    }
    return formatDateLocal(date)
  }

  // Initialize revenue inputs from fetched data
  useEffect(() => {
    if (revenueData && Array.isArray(revenueData)) {
      const newRevenueInputs: { [key: string]: string } = {}
      const newSittingInputs: { [key: string]: string } = {}
      const newTakeawayInputs: { [key: string]: string } = {}
      const newDeliveryInputs: { [key: string]: string } = {}
      
      revenueData.forEach((r: any) => {
        const dateKey = getDateStr(r.date)
        newRevenueInputs[dateKey] = r.totalRevenue.toString()
        newSittingInputs[dateKey] = (r.sittingRevenue || 0).toString()
        newTakeawayInputs[dateKey] = (r.takeawayRevenue || 0).toString()
        newDeliveryInputs[dateKey] = (r.deliveryRevenue || 0).toString()
      })
      
      setRevenueInputs(prev => ({ ...newRevenueInputs, ...prev }))
      setSittingInputs(prev => ({ ...newSittingInputs, ...prev }))
      setTakeawayInputs(prev => ({ ...newTakeawayInputs, ...prev }))
      setDeliveryInputs(prev => ({ ...newDeliveryInputs, ...prev }))
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
    const sitting = parseFloat(sittingInputs[dateKey] || '0')
    const takeaway = parseFloat(takeawayInputs[dateKey] || '0')
    const delivery = parseFloat(deliveryInputs[dateKey] || '0')
    const total = sitting + takeaway + delivery
    
    if (isNaN(sitting) || isNaN(takeaway) || isNaN(delivery) || 
        sitting < 0 || takeaway < 0 || delivery < 0) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן סכומים תקינים',
        variant: 'destructive',
      })
      return
    }

    setSavingRevenue(dateKey)
    saveDailyRevenueMutation.mutate({
      date: dateKey,
      totalRevenue: total,
      sittingRevenue: sitting,
      takeawayRevenue: takeaway,
      deliveryRevenue: delivery,
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
    
    const dateStr = getDateStr(date)
    return scheduleData.shiftAssignments.filter((a: any) => {
      const assignmentDateStr = getDateStr(a.shiftDate)
      return assignmentDateStr === dateStr
    })
  }

  // Get revenue for a specific date
  const getRevenueForDate = (date: Date) => {
    if (!revenueData || !Array.isArray(revenueData)) return null
    const dateStr = getDateStr(date)
    return revenueData.find((r: any) => getDateStr(r.date) === dateStr)
  }

  // Calculate totals for summary
  const weeklyTotals = useMemo(() => {
    let totalRevenue = 0
    let totalSitting = 0
    let totalTakeaway = 0
    let totalDelivery = 0
    let totalTips = 0
    let totalShifts = 0

    if (revenueData && Array.isArray(revenueData)) {
      totalRevenue = revenueData.reduce((sum: number, r: any) => sum + (r.totalRevenue || 0), 0)
      totalSitting = revenueData.reduce((sum: number, r: any) => sum + (r.sittingRevenue || 0), 0)
      totalTakeaway = revenueData.reduce((sum: number, r: any) => sum + (r.takeawayRevenue || 0), 0)
      totalDelivery = revenueData.reduce((sum: number, r: any) => sum + (r.deliveryRevenue || 0), 0)
    }

    if (scheduleData?.shiftAssignments) {
      totalTips = scheduleData.shiftAssignments.reduce((sum: number, a: any) => sum + (a.tipsEarned || 0), 0)
      totalShifts = scheduleData.shiftAssignments.filter((a: any) => a.status !== 'CANCELLED').length
    }

    return { totalRevenue, totalSitting, totalTakeaway, totalDelivery, totalTips, totalShifts }
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Total Revenue Card */}
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">סה״כ הכנסות השבוע</span>
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-3">
                {formatCurrency(weeklyTotals.totalRevenue)}
              </div>
              
              {/* Revenue Breakdown */}
              <div className="space-y-2 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700/80 dark:text-emerald-400/80">
                    <Utensils className="h-3 w-3" />
                    ישיבה
                  </span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(weeklyTotals.totalSitting)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700/80 dark:text-emerald-400/80">
                    <Receipt className="h-3 w-3" />
                    טייק אווי
                  </span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(weeklyTotals.totalTakeaway)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-700/80 dark:text-emerald-400/80">
                    <Clock className="h-3 w-3" />
                    משלוחים
                  </span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(weeklyTotals.totalDelivery)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips and Shifts Card */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">טיפים ומשמרות</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-amber-700/70 dark:text-amber-400/70 mb-1">סה״כ טיפים</div>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    {formatCurrency(weeklyTotals.totalTips)}
                  </div>
                </div>
                <div className="pt-3 border-t border-amber-200 dark:border-amber-800">
                  <div className="text-xs text-amber-700/70 dark:text-amber-400/70 mb-1">סה״כ משמרות</div>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    {weeklyTotals.totalShifts}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                        <Receipt className="h-5 w-5 text-emerald-500" />
                        הכנסת קופה - יום {HEBREW_DAYS[date.getDay()]} {format(date, 'd בMMMM', { locale: he })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                      {/* Revenue Category Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Utensils className="h-3 w-3 text-blue-500" />
                            ישיבה (₪)
                          </Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={sittingInputs[formatDateLocal(date)] || ''}
                            onChange={(e) => setSittingInputs(prev => ({
                              ...prev,
                              [formatDateLocal(date)]: e.target.value
                            }))}
                            className="h-10"
                            min="0"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Receipt className="h-3 w-3 text-purple-500" />
                            טייק אווי (₪)
                          </Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={takeawayInputs[formatDateLocal(date)] || ''}
                            onChange={(e) => setTakeawayInputs(prev => ({
                              ...prev,
                              [formatDateLocal(date)]: e.target.value
                            }))}
                            className="h-10"
                            min="0"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3 text-orange-500" />
                            משלוחים (₪)
                          </Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={deliveryInputs[formatDateLocal(date)] || ''}
                            onChange={(e) => setDeliveryInputs(prev => ({
                              ...prev,
                              [formatDateLocal(date)]: e.target.value
                            }))}
                            className="h-10"
                            min="0"
                          />
                        </div>
                      </div>

                      {/* Total and Save */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-lg font-bold text-emerald-600">
                          סה״כ: {formatCurrency(
                            (parseFloat(sittingInputs[formatDateLocal(date)] || '0') +
                             parseFloat(takeawayInputs[formatDateLocal(date)] || '0') +
                             parseFloat(deliveryInputs[formatDateLocal(date)] || '0'))
                          )}
                        </div>
                        <Button 
                          size="lg"
                          onClick={() => handleSaveRevenue(date)}
                          disabled={savingRevenue === formatDateLocal(date)}
                          className="h-10 px-6"
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
                          {shiftsForSelectedDay.map((assignment: any) => {
                            const isTipBased = assignment.user?.isTipBased
                            
                            return (
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
                                    {isTipBased && (
                                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                        טיפים
                                      </Badge>
                                    )}
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

                                {/* Tips Input - only for tip-based employees */}
                                {isTipBased ? (
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
                                      title="שמור טיפ"
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
                                ) : (
                                  <div className="text-xs text-muted-foreground px-3">
                                    לא נדרש טיפ
                                  </div>
                                )}
                              </div>
                            )
                          })}
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
