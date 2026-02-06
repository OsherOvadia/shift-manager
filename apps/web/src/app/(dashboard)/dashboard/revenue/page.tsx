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
  Calendar,
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
  EVENING_COMBINED: { label: 'ערב (כולל סגירה)', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  NIGHT: { label: 'לילה', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
}

export default function RevenuePage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStartDate(new Date()))
  const [selectedDay, setSelectedDay] = useState<number>(0)
  // Track data per shift-time (date_shiftType), not per worker
  const [sittingRevenue, setSittingRevenue] = useState<{ [shiftKey: string]: string }>({})
  const [takeawayRevenue, setTakeawayRevenue] = useState<{ [shiftKey: string]: string }>({})
  const [deliveryRevenue, setDeliveryRevenue] = useState<{ [shiftKey: string]: string }>({})
  const [tips, setTips] = useState<{ [shiftKey: string]: string }>({})
  // Track cash tips per assignment (per worker)
  const [cashTips, setCashTips] = useState<{ [assignmentId: string]: string }>({})
  const [savingData, setSavingData] = useState<string | null>(null)
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

  // Initialize shift data from schedule (using shift keys, not assignment IDs)
  useEffect(() => {
    if (scheduleData?.shiftAssignments) {
      const newSitting: { [key: string]: string } = {}
      const newTakeaway: { [key: string]: string } = {}
      const newDelivery: { [key: string]: string } = {}
      const newTips: { [key: string]: string } = {}
      const newCashTips: { [key: string]: string } = {}
      
      // Group by shift (date + type) and take first assignment's values
      const shiftMap = new Map<string, any>()
      
      scheduleData.shiftAssignments.forEach((a: any) => {
        const dateStr = getDateStr(a.shiftDate)
        const originalType = a.shiftTemplate.shiftType
        // Combine EVENING and EVENING_CLOSE
        const shiftType = (originalType === 'EVENING_CLOSE') ? 'EVENING' : originalType
        const shiftKey = `${dateStr}_${shiftType}`
        
        // Store cash tips per assignment (per worker)
        newCashTips[a.id] = (a.cashTips || 0).toString()
        
        // Only store first occurrence (all workers in shift have same values)
        if (!shiftMap.has(shiftKey)) {
          shiftMap.set(shiftKey, a)
          // Always set values, even when 0, to prevent form reset
          newSitting[shiftKey] = (a.sittingTips || 0).toString()
          newTakeaway[shiftKey] = (a.takeawayTips || 0).toString()
          newDelivery[shiftKey] = (a.deliveryTips || 0).toString()
          newTips[shiftKey] = (a.tipsEarned || 0).toString()
        }
      })
      
      setSittingRevenue(newSitting)
      setTakeawayRevenue(newTakeaway)
      setDeliveryRevenue(newDelivery)
      setTips(newTips)
      setCashTips(newCashTips)
    }
  }, [scheduleData])

  const updateShiftDataMutation = useMutation({
    mutationFn: async ({ assignmentIds, sitting, takeaway, delivery, tips, cashTipsMap }: { 
      assignmentIds: string[]; 
      sitting: number; 
      takeaway: number; 
      delivery: number;
      tips: number;
      cashTipsMap: { [assignmentId: string]: number };
    }) => {
      console.log('Saving revenue data:', { assignmentIds, sitting, takeaway, delivery, tips, cashTipsMap })
      // Update all workers in the shift - same revenue values but individual cash tips
      const results = await Promise.all(assignmentIds.map(id =>
        api.patch(`/assignments/${id}`, { 
          sittingTips: sitting,
          takeawayTips: takeaway,
          deliveryTips: delivery,
          tipsEarned: tips,
          cashTips: cashTipsMap[id] || 0
        }, accessToken!)
      ))
      console.log('Save results:', results)
      return results
    },
    onSuccess: async () => {
      console.log('Save successful, invalidating caches...')
      // Invalidate and refetch all related queries
      await queryClient.invalidateQueries({ queryKey: ['schedule-week'] })
      await queryClient.invalidateQueries({ queryKey: ['weekly-costs'] })
      await queryClient.invalidateQueries({ queryKey: ['daily-revenues'] })
      
      // Force refetch the specific week's data
      await queryClient.refetchQueries({ queryKey: ['schedule-week', weekStart.toISOString()] })
      
      toast({
        title: 'נשמר בהצלחה',
        description: 'נתוני המשמרת נשמרו',
      })
      setSavingData(null)
    },
    onError: (error: any) => {
      console.error('Save error:', error)
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את הנתונים',
        variant: 'destructive',
      })
      setSavingData(null)
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

  const handleSaveShiftData = (date: Date, shiftType: string, assignmentIds: string[]) => {
    const dateStr = getDateStr(date)
    const shiftKey = `${dateStr}_${shiftType}`
    
    const sitting = parseFloat(sittingRevenue[shiftKey] || '0')
    const takeaway = parseFloat(takeawayRevenue[shiftKey] || '0')
    const delivery = parseFloat(deliveryRevenue[shiftKey] || '0')
    const tipsValue = parseFloat(tips[shiftKey] || '0')
    
    // Build cash tips map for all assignments
    const cashTipsMap: { [id: string]: number } = {}
    for (const id of assignmentIds) {
      const cashTipValue = parseFloat(cashTips[id] || '0')
      if (isNaN(cashTipValue) || cashTipValue < 0) {
        toast({
          title: 'שגיאה',
          description: 'אנא הזן סכומי טיפים מזומן תקינים',
          variant: 'destructive',
        })
        return
      }
      cashTipsMap[id] = cashTipValue
    }
    
    if (isNaN(sitting) || isNaN(takeaway) || isNaN(delivery) || isNaN(tipsValue) ||
        sitting < 0 || takeaway < 0 || delivery < 0 || tipsValue < 0) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן סכומים תקינים',
        variant: 'destructive',
      })
      return
    }

    setSavingData(shiftKey)
    updateShiftDataMutation.mutate({
      assignmentIds,
      sitting,
      takeaway,
      delivery,
      tips: tipsValue,
      cashTipsMap,
    })
  }

  // Get shifts grouped by shift type for a specific date
  const getShiftsForDate = (date: Date) => {
    if (!scheduleData?.shiftAssignments) return []
    
    const dateStr = getDateStr(date)
    const assignments = scheduleData.shiftAssignments.filter((a: any) => {
      const assignmentDateStr = getDateStr(a.shiftDate)
      return assignmentDateStr === dateStr
    })
    
    // Group by shift type - combine EVENING and EVENING_CLOSE into one "EVENING" group
    const grouped = new Map<string, { 
      shiftType: string; 
      displayType: string; // Original type for display
      shiftTemplate: any; 
      workers: any[];
      assignmentIds: string[];
    }>()
    
    assignments.forEach((a: any) => {
      const originalType = a.shiftTemplate.shiftType
      // Combine EVENING and EVENING_CLOSE into EVENING for revenue entry
      const shiftType = (originalType === 'EVENING_CLOSE') ? 'EVENING' : originalType
      
      if (!grouped.has(shiftType)) {
        grouped.set(shiftType, {
          shiftType,
          displayType: originalType,
          shiftTemplate: a.shiftTemplate,
          workers: [],
          assignmentIds: []
        })
      } else {
        // If we already have EVENING and now adding EVENING_CLOSE (or vice versa),
        // update the display to show it includes both
        if ((originalType === 'EVENING' || originalType === 'EVENING_CLOSE') && 
            grouped.get(shiftType)!.displayType !== originalType) {
          grouped.get(shiftType)!.displayType = 'EVENING_COMBINED'
        }
      }
      
      grouped.get(shiftType)!.workers.push(a.user)
      grouped.get(shiftType)!.assignmentIds.push(a.id)
    })
    
    return Array.from(grouped.values())
  }

  // Get revenue for a specific date
  const getRevenueForDate = (date: Date) => {
    if (!revenueData || !Array.isArray(revenueData)) return null
    const dateStr = getDateStr(date)
    return revenueData.find((r: any) => getDateStr(r.date) === dateStr)
  }

  // Calculate totals for summary (count each shift once, not per worker!)
  const weeklyTotals = useMemo(() => {
    let totalSitting = 0
    let totalTakeaway = 0
    let totalDelivery = 0
    let totalRevenue = 0
    let totalTips = 0
    let totalShifts = 0

    if (scheduleData?.shiftAssignments) {
      // Group by shift to avoid counting same shift multiple times
      const shiftMap = new Map<string, any>()
      
      scheduleData.shiftAssignments.forEach((a: any) => {
        const dateStr = getDateStr(a.shiftDate)
        const originalType = a.shiftTemplate.shiftType
        const shiftType = (originalType === 'EVENING_CLOSE') ? 'EVENING' : originalType
        const shiftKey = `${dateStr}_${shiftType}`
        
        // Only count each unique shift once
        if (!shiftMap.has(shiftKey) && a.status !== 'CANCELLED') {
          shiftMap.set(shiftKey, a)
          
          const sitting = a.sittingTips || 0
          const takeaway = a.takeawayTips || 0
          const delivery = a.deliveryTips || 0
          
          totalSitting += sitting
          totalTakeaway += takeaway
          totalDelivery += delivery
          totalRevenue += sitting + takeaway + delivery
          totalTips += a.tipsEarned || 0
          totalShifts++
        }
      })
    }

    return { totalSitting, totalTakeaway, totalDelivery, totalRevenue, totalTips, totalShifts }
  }, [scheduleData])

  const shiftsForSelectedDay = getShiftsForDate(selectedDate)
  
  // Helper to get shift key for data tracking
  const getShiftKey = (date: Date, shiftType: string) => {
    return `${getDateStr(date)}_${shiftType}`
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
              <Utensils className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              קופה וטיפים
            </h1>
            <p className="text-sm text-muted-foreground">ניהול הכנסות יומיות וטיפים למשמרות</p>
          </motion.div>

          {/* Week Navigation */}
          <motion.div 
            className="flex items-center gap-2 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-2 shadow-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <ScaleOnTap>
              <Button variant="ghost" size="icon" onClick={previousWeek} className="h-10 w-10 hover:bg-primary/20">
                <div className="flex items-center gap-1">
                  <ChevronRight className="h-5 w-5" />
                  <ChevronRight className="h-4 w-4 -mr-4" />
                </div>
              </Button>
            </ScaleOnTap>
            <AnimatePresence mode="wait">
              <motion.div
                key={weekStart.toISOString()}
                className="flex items-center gap-2 min-w-[140px] sm:min-w-[180px] justify-center px-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-sm sm:text-base font-bold text-primary">
                  {format(weekStart, 'dd MMM', { locale: he })} - {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: he })}
                </span>
              </motion.div>
            </AnimatePresence>
            <ScaleOnTap>
              <Button variant="ghost" size="icon" onClick={nextWeek} className="h-10 w-10 hover:bg-primary/20">
                <div className="flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4 -ml-4" />
                  <ChevronLeft className="h-5 w-5" />
                </div>
              </Button>
            </ScaleOnTap>
          </motion.div>
        </div>

        {/* Weekly Summary Cards */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StaggerItem>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Utensils className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-700 dark:text-blue-400">ישיבה</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-400">
                  {formatCurrency(weeklyTotals.totalSitting)}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          
          <StaggerItem>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-purple-700 dark:text-purple-400">טייק אווי</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-400">
                  {formatCurrency(weeklyTotals.totalTakeaway)}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          
          <StaggerItem>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-orange-700 dark:text-orange-400">משלוחים</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-orange-700 dark:text-orange-400">
                  {formatCurrency(weeklyTotals.totalDelivery)}
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          
          <StaggerItem>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
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
              <TabsList className="w-full grid grid-cols-7 h-auto p-1 gap-1">
                {weekDates.map((date, index) => {
                  const dayShifts = getShiftsForDate(date)
                  const dayRevenue = getRevenueForDate(date)
                  const hasData = dayShifts.length > 0 || dayRevenue
                  
                  return (
                    <TabsTrigger
                      key={index}
                      value={index.toString()}
                      className="flex flex-col gap-1 py-3 px-1 min-h-[60px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                    >
                      <span className="text-xs sm:text-sm font-medium">{HEBREW_DAYS[date.getDay()]}</span>
                      <span className="text-[11px] text-muted-foreground data-[state=active]:text-primary-foreground/70">
                        {format(date, 'd/M')}
                      </span>
                      {hasData && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 data-[state=active]:bg-emerald-300" />
                      )}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {weekDates.map((date, index) => (
                <TabsContent key={index} value={index.toString()} className="mt-4 space-y-4">
                  {/* Shifts Tips Entry */}
                  <Card>
                    <CardHeader className="p-4 sm:p-6 pb-3">
                      <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                        <Coins className="h-6 w-6 text-amber-500" />
                        טיפים למשמרות ({shiftsForSelectedDay.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      {shiftsForSelectedDay.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                          <p>אין משמרות ביום זה</p>
                          <p className="text-sm">שבץ עובדים למשמרות כדי להזין טיפים</p>
                        </div>
                      ) : (
                        <div className="space-y-4 sm:space-y-6">
                          {shiftsForSelectedDay.map((shiftGroup: any) => {
                            const shiftKey = getShiftKey(date, shiftGroup.shiftType)
                            
                            return (
                              <div 
                                key={shiftGroup.shiftType} 
                                className="p-4 sm:p-6 bg-muted/50 rounded-xl border-2"
                              >
                                {/* Shift Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <Badge 
                                      className={`text-sm py-1.5 px-3 ${SHIFT_TYPES[shiftGroup.displayType]?.color || SHIFT_TYPES[shiftGroup.shiftType]?.color || 'bg-gray-100'}`}
                                    >
                                      {SHIFT_TYPES[shiftGroup.displayType]?.label || SHIFT_TYPES[shiftGroup.shiftType]?.label || shiftGroup.shiftTemplate.name}
                                    </Badge>
                                    <span className="text-sm sm:text-base text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      {shiftGroup.shiftTemplate.startTime} - {shiftGroup.shiftTemplate.endTime}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="h-4 w-4" />
                                    <span className="font-medium">{shiftGroup.workers.length} עובדים:</span>
                                    <span className="text-xs sm:text-sm">{shiftGroup.workers.map((w: any) => w.firstName).join(', ')}</span>
                                  </div>
                                </div>

                                {/* Shift Revenue & Tips Inputs - ENHANCED FOR MOBILE */}
                                <div className="space-y-4">
                                  {/* Real-time Total Calculation Display */}
                                  <motion.div 
                                    className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800"
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">סה"כ הכנסות משמרת:</span>
                                      <motion.span 
                                        key={`${sittingRevenue[shiftKey]}-${takeawayRevenue[shiftKey]}-${deliveryRevenue[shiftKey]}-${tips[shiftKey]}`}
                                        className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400"
                                        initial={{ scale: 1.3, color: '#10b981' }}
                                        animate={{ scale: 1, color: 'inherit' }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        {formatCurrency(
                                          (parseFloat(sittingRevenue[shiftKey] || '0') +
                                           parseFloat(takeawayRevenue[shiftKey] || '0') +
                                           parseFloat(deliveryRevenue[shiftKey] || '0') +
                                           parseFloat(tips[shiftKey] || '0'))
                                        )}
                                      </motion.span>
                                    </div>
                                  </motion.div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    {/* Sitting Revenue */}
                                    <motion.div 
                                      className="space-y-2"
                                      whileTap={{ scale: 0.98 }}
                                    >
                                      <Label className="text-base sm:text-lg font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                        <Utensils className="h-5 w-5 sm:h-6 sm:w-6" />
                                        ישיבה
                                      </Label>
                                      <div className="relative">
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={sittingRevenue[shiftKey] || ''}
                                          onChange={(e) => setSittingRevenue(prev => ({
                                            ...prev,
                                            [shiftKey]: e.target.value
                                          }))}
                                          className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold pr-12 border-2 focus:border-blue-500 transition-colors"
                                          min="0"
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-medium">₪</span>
                                      </div>
                                      {sittingRevenue[shiftKey] && parseFloat(sittingRevenue[shiftKey]) > 0 && (
                                        <motion.p 
                                          initial={{ opacity: 0, y: -5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="text-sm text-blue-600 dark:text-blue-400 font-medium"
                                        >
                                          {formatCurrency(parseFloat(sittingRevenue[shiftKey]))}
                                        </motion.p>
                                      )}
                                    </motion.div>
                                    
                                    {/* Takeaway Revenue */}
                                    <motion.div 
                                      className="space-y-2"
                                      whileTap={{ scale: 0.98 }}
                                    >
                                      <Label className="text-base sm:text-lg font-semibold flex items-center gap-2 text-purple-600 dark:text-purple-400">
                                        <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
                                        TA
                                      </Label>
                                      <div className="relative">
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={takeawayRevenue[shiftKey] || ''}
                                          onChange={(e) => setTakeawayRevenue(prev => ({
                                            ...prev,
                                            [shiftKey]: e.target.value
                                          }))}
                                          className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold pr-12 border-2 focus:border-purple-500 transition-colors"
                                          min="0"
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-medium">₪</span>
                                      </div>
                                      {takeawayRevenue[shiftKey] && parseFloat(takeawayRevenue[shiftKey]) > 0 && (
                                        <motion.p 
                                          initial={{ opacity: 0, y: -5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="text-sm text-purple-600 dark:text-purple-400 font-medium"
                                        >
                                          {formatCurrency(parseFloat(takeawayRevenue[shiftKey]))}
                                        </motion.p>
                                      )}
                                    </motion.div>
                                    
                                    {/* Delivery Revenue */}
                                    <motion.div 
                                      className="space-y-2"
                                      whileTap={{ scale: 0.98 }}
                                    >
                                      <Label className="text-base sm:text-lg font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                        <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                                        משלוחים
                                      </Label>
                                      <div className="relative">
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={deliveryRevenue[shiftKey] || ''}
                                          onChange={(e) => setDeliveryRevenue(prev => ({
                                            ...prev,
                                            [shiftKey]: e.target.value
                                          }))}
                                          className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold pr-12 border-2 focus:border-orange-500 transition-colors"
                                          min="0"
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-medium">₪</span>
                                      </div>
                                      {deliveryRevenue[shiftKey] && parseFloat(deliveryRevenue[shiftKey]) > 0 && (
                                        <motion.p 
                                          initial={{ opacity: 0, y: -5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="text-sm text-orange-600 dark:text-orange-400 font-medium"
                                        >
                                          {formatCurrency(parseFloat(deliveryRevenue[shiftKey]))}
                                        </motion.p>
                                      )}
                                    </motion.div>
                                    
                                    {/* Card Tips */}
                                    <motion.div 
                                      className="space-y-2"
                                      whileTap={{ scale: 0.98 }}
                                    >
                                      <Label className="text-base sm:text-lg font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                        <Coins className="h-5 w-5 sm:h-6 sm:w-6" />
                                        טיפ כרטיס
                                      </Label>
                                      <div className="relative">
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          placeholder="0"
                                          value={tips[shiftKey] || ''}
                                          onChange={(e) => setTips(prev => ({
                                            ...prev,
                                            [shiftKey]: e.target.value
                                          }))}
                                          className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold pr-12 border-2 focus:border-amber-500 transition-colors"
                                          min="0"
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-medium">₪</span>
                                      </div>
                                      {tips[shiftKey] && parseFloat(tips[shiftKey]) > 0 && (
                                        <motion.p 
                                          initial={{ opacity: 0, y: -5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="text-sm text-amber-600 dark:text-amber-400 font-medium"
                                        >
                                          {formatCurrency(parseFloat(tips[shiftKey]))}
                                        </motion.p>
                                      )}
                                    </motion.div>
                                  </div>

                                  {/* Cash Tips Per Worker - MOBILE OPTIMIZED */}
                                  <div className="mt-6 pt-6 border-t-2">
                                    <Label className="text-base sm:text-lg font-bold flex items-center gap-2 text-green-600 dark:text-green-400 mb-4">
                                      <DollarSign className="h-6 w-6" />
                                      טיפים מזומן לכל מלצר
                                    </Label>
                                    <div className="grid grid-cols-1 gap-3">
                                      {shiftGroup.workers.map((worker: any, idx: number) => {
                                        const assignmentId = shiftGroup.assignmentIds[idx]
                                        const cashTipValue = cashTips[assignmentId] || ''
                                        return (
                                          <motion.div 
                                            key={assignmentId} 
                                            className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 rounded-xl border-2 border-green-200 dark:border-green-800"
                                            whileTap={{ scale: 0.98 }}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                          >
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                              <Label className="text-base sm:text-lg font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">
                                                  {worker.firstName[0]}{worker.lastName[0]}
                                                </div>
                                                {worker.firstName} {worker.lastName}
                                              </Label>
                                            </div>
                                            <div className="relative">
                                              <Input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="0"
                                                value={cashTipValue}
                                                onChange={(e) => setCashTips(prev => ({
                                                  ...prev,
                                                  [assignmentId]: e.target.value
                                                }))}
                                                className="h-14 text-xl font-bold pr-12 border-2 focus:border-green-500 bg-white dark:bg-slate-950"
                                                min="0"
                                              />
                                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-medium">₪</span>
                                            </div>
                                            {cashTipValue && parseFloat(cashTipValue) > 0 && (
                                              <motion.p 
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-sm text-green-600 dark:text-green-400 font-bold mt-2"
                                              >
                                                ✓ {formatCurrency(parseFloat(cashTipValue))}
                                              </motion.p>
                                            )}
                                          </motion.div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  
                                  {/* Total and Save */}
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t-2">
                                    <div className="text-xl sm:text-2xl font-bold text-emerald-600 py-2">
                                      סה״כ: {formatCurrency(
                                        (parseFloat(sittingRevenue[shiftKey] || '0') +
                                         parseFloat(takeawayRevenue[shiftKey] || '0') +
                                         parseFloat(deliveryRevenue[shiftKey] || '0') +
                                         parseFloat(tips[shiftKey] || '0'))
                                      )}
                                    </div>
                                    <Button 
                                      size="lg"
                                      onClick={() => handleSaveShiftData(date, shiftGroup.shiftType, shiftGroup.assignmentIds)}
                                      disabled={savingData === shiftKey}
                                      className="h-14 px-8 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                                    >
                                      {savingData === shiftKey ? (
                                        <motion.div 
                                          className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                                          animate={{ rotate: 360 }}
                                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        />
                                      ) : (
                                        <>
                                          <Save className="h-5 w-5 ml-2" />
                                          שמור
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Daily Financial Summary */}
                  {shiftsForSelectedDay.length > 0 && (
                    <Card className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 border-2 border-emerald-200 dark:border-emerald-800 shadow-lg">
                      <CardHeader className="p-4 sm:p-6 pb-3">
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                          <DollarSign className="h-6 w-6 text-emerald-600" />
                          סיכום יומי - {HEBREW_DAYS[date.getDay()]} {format(date, 'd/M')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 pt-0">
                        {(() => {
                          // Calculate daily totals
                          let totalRevenue = 0
                          let totalTips = 0
                          let totalWorkerWages = 0
                          
                          shiftsForSelectedDay.forEach((shiftGroup: any) => {
                            const shiftKey = getShiftKey(date, shiftGroup.shiftType)
                            
                            // Revenue
                            const sitting = parseFloat(sittingRevenue[shiftKey] || '0')
                            const takeaway = parseFloat(takeawayRevenue[shiftKey] || '0')
                            const delivery = parseFloat(deliveryRevenue[shiftKey] || '0')
                            const tipsValue = parseFloat(tips[shiftKey] || '0')
                            
                            totalRevenue += sitting + takeaway + delivery
                            totalTips += tipsValue
                            
                            // Worker wages (calculate based on shift hours and wage)
                            shiftGroup.workers.forEach((worker: any) => {
                              const startTime = shiftGroup.shiftTemplate.startTime
                              const endTime = shiftGroup.shiftTemplate.endTime
                              
                              // Parse times (format: "HH:MM")
                              const [startH, startM] = startTime.split(':').map(Number)
                              const [endH, endM] = endTime.split(':').map(Number)
                              
                              let hours = (endH + endM / 60) - (startH + startM / 60)
                              // Handle overnight shifts (e.g., 18:00 - 00:00)
                              if (hours < 0) hours += 24
                              
                              const hourlyWage = worker.hourlyWage || 0
                              totalWorkerWages += hours * hourlyWage
                            })
                          })
                          
                          const netToPayWorkers = totalWorkerWages - totalTips
                          
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="p-4 sm:p-5 bg-white/80 dark:bg-gray-900/60 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 shadow-md">
                                <div className="text-sm font-medium text-muted-foreground mb-2">הכנסה כוללת</div>
                                <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mb-1">
                                  {formatCurrency(totalRevenue)}
                                </div>
                                <div className="text-xs text-muted-foreground">ישיבה + TA + משלוחים</div>
                              </div>
                              
                              <div className="p-4 sm:p-5 bg-white/80 dark:bg-gray-900/60 rounded-xl border-2 border-amber-200 dark:border-amber-800 shadow-md">
                                <div className="text-sm font-medium text-muted-foreground mb-2">טיפים כולל</div>
                                <div className="text-2xl sm:text-3xl font-bold text-amber-600 mb-1">
                                  {formatCurrency(totalTips)}
                                </div>
                                <div className="text-xs text-muted-foreground">לקזז משכר</div>
                              </div>
                              
                              <div className="p-4 sm:p-5 bg-white/80 dark:bg-gray-900/60 rounded-xl border-2 border-blue-200 dark:border-blue-800 shadow-md">
                                <div className="text-sm font-medium text-muted-foreground mb-2">שכר עובדים</div>
                                <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                                  {formatCurrency(totalWorkerWages)}
                                </div>
                                <div className="text-xs text-muted-foreground">לפני קיזוז טיפים</div>
                              </div>
                              
                              <div className="p-4 sm:p-5 bg-white/80 dark:bg-gray-900/60 rounded-xl border-2 border-purple-200 dark:border-purple-800 shadow-md">
                                <div className="text-sm font-medium text-muted-foreground mb-2">לתשלום נטו</div>
                                <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
                                  {formatCurrency(netToPayWorkers)}
                                </div>
                                <div className="text-xs text-muted-foreground">שכר - טיפים</div>
                              </div>
                            </div>
                          )
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
    </PageTransition>
  )
}
