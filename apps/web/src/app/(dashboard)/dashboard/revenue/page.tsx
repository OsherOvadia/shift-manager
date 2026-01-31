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
  const [sittingTips, setSittingTips] = useState<{ [assignmentId: string]: string }>({})
  const [takeawayTips, setTakeawayTips] = useState<{ [assignmentId: string]: string }>({})
  const [deliveryTips, setDeliveryTips] = useState<{ [assignmentId: string]: string }>({})
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

  // Initialize tips from schedule data
  useEffect(() => {
    if (scheduleData?.shiftAssignments) {
      const newSitting: { [key: string]: string } = {}
      const newTakeaway: { [key: string]: string } = {}
      const newDelivery: { [key: string]: string } = {}
      
      scheduleData.shiftAssignments.forEach((a: any) => {
        if (a.sittingTips) newSitting[a.id] = a.sittingTips.toString()
        if (a.takeawayTips) newTakeaway[a.id] = a.takeawayTips.toString()
        if (a.deliveryTips) newDelivery[a.id] = a.deliveryTips.toString()
      })
      
      setSittingTips(prev => ({ ...newSitting, ...prev }))
      setTakeawayTips(prev => ({ ...newTakeaway, ...prev }))
      setDeliveryTips(prev => ({ ...newDelivery, ...prev }))
    }
  }, [scheduleData])

  const updateTipsMutation = useMutation({
    mutationFn: ({ assignmentId, sitting, takeaway, delivery, total }: { 
      assignmentId: string; 
      sitting: number; 
      takeaway: number; 
      delivery: number; 
      total: number 
    }) =>
      api.patch(`/assignments/${assignmentId}`, { 
        sittingTips: sitting,
        takeawayTips: takeaway,
        deliveryTips: delivery,
        tipsEarned: total 
      }, accessToken!),
    onSuccess: () => {
      toast({
        title: 'נשמר',
        description: 'טיפים נשמרו בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['schedule-week'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-costs'] })
      setSavingTips(null)
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור טיפים',
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

  const handleSaveTips = (assignmentId: string) => {
    const sitting = parseFloat(sittingTips[assignmentId] || '0')
    const takeaway = parseFloat(takeawayTips[assignmentId] || '0')
    const delivery = parseFloat(deliveryTips[assignmentId] || '0')
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

    setSavingTips(assignmentId)
    updateTipsMutation.mutate({
      assignmentId,
      sitting,
      takeaway,
      delivery,
      total,
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
    let totalSitting = 0
    let totalTakeaway = 0
    let totalDelivery = 0
    let totalTips = 0
    let totalShifts = 0

    if (scheduleData?.shiftAssignments) {
      scheduleData.shiftAssignments.forEach((a: any) => {
        totalSitting += a.sittingTips || 0
        totalTakeaway += a.takeawayTips || 0
        totalDelivery += a.deliveryTips || 0
        totalTips += a.tipsEarned || 0
      })
      totalShifts = scheduleData.shiftAssignments.filter((a: any) => a.status !== 'CANCELLED').length
    }

    return { totalSitting, totalTakeaway, totalDelivery, totalTips, totalShifts }
  }, [scheduleData])

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
                                  <div className="flex-1">
                                    <div className="grid grid-cols-4 gap-2 items-end">
                                      {/* Sitting Tips */}
                                      <div className="space-y-1">
                                        <Label className="text-[10px] font-medium flex items-center gap-0.5">
                                          <Utensils className="h-2.5 w-2.5" />
                                          ישיבה
                                        </Label>
                                        <Input
                                          type="number"
                                          placeholder="0"
                                          value={sittingTips[assignment.id] || ''}
                                          onChange={(e) => setSittingTips(prev => ({
                                            ...prev,
                                            [assignment.id]: e.target.value
                                          }))}
                                          className="h-9 text-sm"
                                          min="0"
                                        />
                                      </div>
                                      
                                      {/* Takeaway Tips */}
                                      <div className="space-y-1">
                                        <Label className="text-[10px] font-medium flex items-center gap-0.5">
                                          <Receipt className="h-2.5 w-2.5" />
                                          TA
                                        </Label>
                                        <Input
                                          type="number"
                                          placeholder="0"
                                          value={takeawayTips[assignment.id] || ''}
                                          onChange={(e) => setTakeawayTips(prev => ({
                                            ...prev,
                                            [assignment.id]: e.target.value
                                          }))}
                                          className="h-9 text-sm"
                                          min="0"
                                        />
                                      </div>
                                      
                                      {/* Delivery Tips */}
                                      <div className="space-y-1">
                                        <Label className="text-[10px] font-medium flex items-center gap-0.5">
                                          <Clock className="h-2.5 w-2.5" />
                                          משלוחים
                                        </Label>
                                        <Input
                                          type="number"
                                          placeholder="0"
                                          value={deliveryTips[assignment.id] || ''}
                                          onChange={(e) => setDeliveryTips(prev => ({
                                            ...prev,
                                            [assignment.id]: e.target.value
                                          }))}
                                          className="h-9 text-sm"
                                          min="0"
                                        />
                                      </div>
                                      
                                      {/* Total and Save Button */}
                                      <div className="space-y-1">
                                        <Label className="text-[10px] font-medium text-amber-600">
                                          סה״כ: ₪{(
                                            (parseFloat(sittingTips[assignment.id] || '0') +
                                             parseFloat(takeawayTips[assignment.id] || '0') +
                                             parseFloat(deliveryTips[assignment.id] || '0'))
                                          ).toFixed(0)}
                                        </Label>
                                        <Button 
                                          size="sm"
                                          onClick={() => handleSaveTips(assignment.id)}
                                          disabled={savingTips === assignment.id}
                                          className="h-9 w-full"
                                        >
                                          {savingTips === assignment.id ? (
                                            <motion.div 
                                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                              animate={{ rotate: 360 }}
                                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            />
                                          ) : (
                                            <>
                                              <Save className="h-3 w-3 ml-1" />
                                              שמור
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    </div>
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
