'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addWeeks, subWeeks } from 'date-fns'
import { he } from 'date-fns/locale'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { getWeekStartDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { ComparisonMetric } from '@/components/comparison-metric'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Clock,
  Users,
  Calendar,
  TrendingUp,
  Edit,
  Coins,
  PieChart,
  BarChart3,
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
  const [weekStart, setWeekStart] = useState(() => getWeekStartDate(new Date()))
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly')
  const [showComparison, setShowComparison] = useState(true)
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false)
  const [tipsDialogOpen, setTipsDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [revenueAmount, setRevenueAmount] = useState('')
  const [tipsAmount, setTipsAmount] = useState<{ [key: string]: string }>({})
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()

  const prevWeekStart = subWeeks(weekStart, 1)

  const { data: report, isLoading, isFetching, error } = useQuery({
    queryKey: ['weekly-costs', weekStart.toISOString()],
    queryFn: () => api.get(`/reports/weekly-costs?date=${weekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5,
  })

  const { data: prevWeekReport } = useQuery({
    queryKey: ['weekly-costs', prevWeekStart.toISOString()],
    queryFn: () => api.get(`/reports/weekly-costs?date=${prevWeekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken && showComparison,
    staleTime: 1000 * 60 * 5,
  })

  const saveDailyRevenueMutation = useMutation({
    mutationFn: (data: { date: string; totalRevenue: number }) =>
      api.post('/daily-revenues', data),
    onSuccess: () => {
      toast({
        title: 'הצלחה',
        description: 'הכנסה יומית נשמרה בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['weekly-costs'] })
      setRevenueDialogOpen(false)
      setRevenueAmount('')
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'שגיאה בשמירת הכנסה יומית',
        variant: 'destructive',
      })
    },
  })

  const updateTipsMutation = useMutation({
    mutationFn: ({ assignmentId, tips }: { assignmentId: string; tips: number }) =>
      api.patch(`/assignments/${assignmentId}`, { tipsEarned: tips }),
    onSuccess: () => {
      toast({
        title: 'הצלחה',
        description: 'טיפים עודכנו בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['weekly-costs'] })
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'שגיאה בעדכון טיפים',
        variant: 'destructive',
      })
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

  const handleSaveDailyRevenue = () => {
    if (!selectedDate || !revenueAmount) {
      toast({
        title: 'שגיאה',
        description: 'אנא מלא את כל השדות',
        variant: 'destructive',
      })
      return
    }

    saveDailyRevenueMutation.mutate({
      date: selectedDate.toISOString(),
      totalRevenue: parseFloat(revenueAmount),
    })
  }

  const openRevenueDialog = (date: Date) => {
    setSelectedDate(date)
    // Find existing revenue for this date
    const dayData = report?.byDay?.find(
      (d: any) => new Date(d.date).toDateString() === date.toDateString()
    )
    setRevenueAmount(dayData?.revenue ? dayData.revenue.toString() : '')
    setRevenueDialogOpen(true)
  }

  const openTipsDialog = (employee: any) => {
    setSelectedEmployee(employee)
    // Initialize tips amounts from employee shifts
    const initialTips: { [key: string]: string } = {}
    employee.shifts?.forEach((shift: any) => {
      initialTips[shift.date] = shift.tips?.toString() || '0'
    })
    setTipsAmount(initialTips)
    setTipsDialogOpen(true)
  }

  const handleSaveTips = async () => {
    if (!selectedEmployee) return

    try {
      // Update tips for each shift
      const promises = selectedEmployee.shifts.map((shift: any) => {
        const tips = parseFloat(tipsAmount[shift.date] || '0')
        // You'll need to pass the assignment ID through the shift data
        // For now, we'll need to fetch assignments separately or include IDs in report
        return updateTipsMutation.mutateAsync({
          assignmentId: shift.assignmentId, // This needs to be included in the report
          tips,
        })
      })

      await Promise.all(promises)
      setTipsDialogOpen(false)
      setSelectedEmployee(null)
    } catch (error) {
      // Error handled by mutation
    }
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
                  {format(weekStart, 'dd/MM', { locale: he })} - {format(addWeeks(weekStart, 1), 'dd/MM/yy', { locale: he })}
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
            {isFetching && (
              <motion.div 
                className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
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
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-500 font-medium mb-2">שגיאה בטעינת הנתונים</p>
              <p className="text-sm text-muted-foreground">{(error as any)?.message || 'נסה לרענן את הדף'}</p>
            </CardContent>
          </Card>
        ) : report ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StaggerItem>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-semibold">סה״כ הכנסות</CardTitle>
                      <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
                      {formatCurrency(report.summary.totalRevenue || 0)}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-semibold">עלות שכר</CardTitle>
                      <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-red-600">
                      {formatCurrency(report.summary.totalCost)}
                    </div>
                    {report.summary.totalRevenue > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {report.summary.salaryPercentage.toFixed(1)}% מההכנסות
                      </div>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-semibold">טיפים</CardTitle>
                      <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-amber-600">
                      {formatCurrency(report.summary.totalTips || 0)}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-semibold">רווח</CardTitle>
                      <PieChart className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-green-600">
                      {report.summary.profitMargin.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-semibold">שעות</CardTitle>
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                      {report.summary.totalHours.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              <StaggerItem>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-semibold">עובדים</CardTitle>
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 pt-0">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-600">
                      {report.summary.employeeCount}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>

            {/* Week vs Week Comparison */}
            {prevWeekReport && (
              <Card>
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      השוואה לשבוע שעבר
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowComparison(!showComparison)}
                      className="text-xs"
                    >
                      {showComparison ? 'הסתר' : 'הצג'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <ComparisonMetric
                      label="הכנסות"
                      current={report.summary.totalRevenue || 0}
                      previous={prevWeekReport.summary?.totalRevenue}
                      format="currency"
                    />
                    <ComparisonMetric
                      label="עלות שכר"
                      current={report.summary.totalCost || 0}
                      previous={prevWeekReport.summary?.totalCost}
                      format="currency"
                    />
                    <ComparisonMetric
                      label="טיפים"
                      current={report.summary.totalTips || 0}
                      previous={prevWeekReport.summary?.totalTips}
                      format="currency"
                    />
                    <ComparisonMetric
                      label="רווח"
                      current={report.summary.profitMargin || 0}
                      previous={prevWeekReport.summary?.profitMargin}
                      format="percentage"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

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
                        className="p-2.5 bg-muted rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {emp.user.jobCategory && (
                              <div
                                className="w-1.5 h-6 rounded-full flex-shrink-0"
                                style={{ backgroundColor: emp.user.jobCategory.color }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">
                                {emp.user.firstName} {emp.user.lastName}
                                {emp.user.isTipBased && (
                                  <span className="mr-1 text-xs text-amber-600">(טיפים)</span>
                                )}
                              </div>
                              <div className="text-[10px] sm:text-xs text-muted-foreground">
                                {emp.user.jobCategory?.nameHe || 'ללא'} • {emp.totalHours.toFixed(1)} שעות
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {emp.user.isTipBased && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => openTipsDialog(emp)}
                              >
                                <Coins className="h-3 w-3" />
                              </Button>
                            )}
                            <div className="text-left flex-shrink-0">
                              <div className="font-bold text-sm">{formatCurrency(emp.totalCost)}</div>
                              {emp.user.isTipBased && emp.totalTips > 0 && (
                                <div className="text-[10px] text-amber-600">
                                  טיפים: {formatCurrency(emp.totalTips)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {emp.user.isTipBased && (
                          <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-1">
                            <div className="flex justify-between text-muted-foreground">
                              <span>שכר בסיס ({emp.user.baseHourlyWage} ₪ × {emp.totalHours.toFixed(1)} שעות):</span>
                              <span className="font-medium">{formatCurrency(emp.baseWageTotal || 0)}</span>
                            </div>
                            <div className="flex justify-between text-amber-600">
                              <span>טיפים שהתקבלו:</span>
                              <span className="font-medium">+{formatCurrency(emp.totalTips)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>תשלום נדרש ממנהל:</span>
                              <span className={cn("font-medium", emp.tipsCoverSalary ? 'text-green-600' : 'text-orange-600')}>
                                {emp.tipsCoverSalary ? '₪0 (טיפים מכסים)' : formatCurrency(emp.managerPayment)}
                              </span>
                            </div>
                            <div className="h-px bg-border my-1"></div>
                            <div className="flex justify-between font-bold text-foreground">
                              <span>סה״כ תשלום לעובד:</span>
                              <span>{formatCurrency(emp.totalWorkerPayment || emp.baseWageTotal || 0)}</span>
                            </div>
                          </div>
                        )}
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
                <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
                  {report.byDay.map((day: any, index: number) => (
                    <motion.div 
                      key={index} 
                      className="p-3 sm:p-4 bg-gradient-to-br from-muted to-muted/50 rounded-lg border"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="mb-2">
                        <div className="text-sm sm:text-base font-bold text-center">
                          {format(new Date(day.date), 'EEE dd/MM', { locale: he })}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm sm:text-base">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">הכנסה:</span>
                          <span className="font-bold text-emerald-600 text-base sm:text-lg">
                            {day.revenue ? formatCurrency(day.revenue).replace('₪', '') : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">טיפים:</span>
                          <span className="font-bold text-blue-600 text-base sm:text-lg">
                            {day.tips ? formatCurrency(day.tips).replace('₪', '') : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">שכר:</span>
                          <span className="font-bold text-red-600 text-base sm:text-lg">
                            {formatCurrency(day.totalCost).replace('₪', '')}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                          {day.totalHours.toFixed(0)} שעות • {day.employeeCount} עובדים
                        </div>
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

        {/* Daily Revenue Dialog */}
        <Dialog open={revenueDialogOpen} onOpenChange={setRevenueDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>עדכון הכנסה יומית</DialogTitle>
              <DialogDescription>
                {selectedDate && `תאריך: ${format(selectedDate, 'dd/MM/yyyy', { locale: he })}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="revenue">סכום הכנסה (₪)</Label>
                <Input
                  id="revenue"
                  type="number"
                  placeholder="0.00"
                  value={revenueAmount}
                  onChange={(e) => setRevenueAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRevenueDialogOpen(false)}
              >
                ביטול
              </Button>
              <Button
                onClick={handleSaveDailyRevenue}
                disabled={saveDailyRevenueMutation.isPending}
              >
                {saveDailyRevenueMutation.isPending ? 'שומר...' : 'שמור'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tips Entry Dialog */}
        <Dialog open={tipsDialogOpen} onOpenChange={setTipsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>עדכון טיפים</DialogTitle>
              <DialogDescription>
                {selectedEmployee && `${selectedEmployee.user.firstName} ${selectedEmployee.user.lastName}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
              {selectedEmployee?.shifts?.map((shift: any, index: number) => (
                <div key={index} className="space-y-2 p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">
                      {format(new Date(shift.date), 'EEE dd/MM', { locale: he })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {shift.shiftTemplate.name} • {shift.hours.toFixed(1)}ש׳
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`tips-${index}`} className="text-xs">טיפים (₪)</Label>
                    <Input
                      id={`tips-${index}`}
                      type="number"
                      placeholder="0.00"
                      value={tipsAmount[shift.date] || '0'}
                      onChange={(e) => setTipsAmount(prev => ({
                        ...prev,
                        [shift.date]: e.target.value
                      }))}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTipsDialogOpen(false)}
              >
                ביטול
              </Button>
              <Button
                onClick={handleSaveTips}
                disabled={updateTipsMutation.isPending}
              >
                {updateTipsMutation.isPending ? 'שומר...' : 'שמור הכל'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
