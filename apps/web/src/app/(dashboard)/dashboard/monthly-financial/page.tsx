'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths } from 'date-fns'
import { he } from 'date-fns/locale'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import {
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Utensils,
  Package,
  Save,
  Coins,
  Calendar,
} from 'lucide-react'
import { 
  PageTransition, 
  StaggerContainer, 
  StaggerItem,
  motion
} from '@/components/ui/animations'

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
]

export default function MonthlyFinancialPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [foodCosts, setFoodCosts] = useState('')
  const [extras, setExtras] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()

  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth() + 1

  // Fetch monthly overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['monthly-overview', year, month],
    queryFn: () => api.get(`/reports/monthly-overview?year=${year}&month=${month}`, accessToken!),
    enabled: !!accessToken,
  })

  // Fetch monthly expenses
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['monthly-expenses', year, month],
    queryFn: () => api.get(`/monthly-expenses?year=${year}&month=${month}`, accessToken!),
    enabled: !!accessToken,
  })

  // Initialize form when expenses data loads
  useMemo(() => {
    if (expenses) {
      setFoodCosts(expenses.foodCosts?.toString() || '')
      setExtras(expenses.extras?.toString() || '')
      setNotes(expenses.notes || '')
    } else {
      // Reset form when no data
      setFoodCosts('')
      setExtras('')
      setNotes('')
    }
  }, [expenses])

  const saveMutation = useMutation({
    mutationFn: async (data: { year: number; month: number; foodCosts?: number; extras?: number; notes?: string }) => {
      return api.post('/monthly-expenses', data, accessToken!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['monthly-overview'] })
      toast({
        title: 'נשמר בהצלחה',
        description: 'הוצאות החודש נשמרו',
      })
      setSaving(false)
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את הנתונים',
        variant: 'destructive',
      })
      setSaving(false)
    },
  })

  const handleSave = () => {
    const food = parseFloat(foodCosts || '0')
    const ext = parseFloat(extras || '0')

    if (isNaN(food) || isNaN(ext) || food < 0 || ext < 0) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן סכומים תקינים',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    saveMutation.mutate({
      year,
      month,
      foodCosts: food,
      extras: ext,
      notes: notes || undefined,
    })
  }

  const previousMonth = () => setSelectedDate(subMonths(selectedDate, 1))
  const nextMonth = () => setSelectedDate(addMonths(selectedDate, 1))

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const isLoading = overviewLoading || expensesLoading
  const summary = overview?.summary

  return (
    <PageTransition className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">סיכום כספי חודשי</h1>
          <p className="text-muted-foreground">
            ניהול והצגת הוצאות והכנסות חודשיות
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="h-10 w-10 rounded-lg hover:bg-background"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2 min-w-[140px] justify-center">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={previousMonth}
            className="h-10 w-10 rounded-lg hover:bg-background"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
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
        <StaggerContainer className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StaggerItem>
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-400">סה״כ הכנסות</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(summary?.totalRevenue || 0)}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 border-red-200 dark:border-red-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-5 w-5 text-red-600" />
                    <span className="text-sm text-red-700 dark:text-red-400">עלות עובדים</span>
                  </div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {formatCurrency(summary?.employeeCost || 0)}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Utensils className="h-5 w-5 text-orange-600" />
                    <span className="text-sm text-orange-700 dark:text-orange-400">עלות מזון</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    {formatCurrency(summary?.foodCosts || 0)}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-5 w-5 text-purple-600" />
                    <span className="text-sm text-purple-700 dark:text-purple-400">הוצאות נוספות</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                    {formatCurrency(summary?.extrasCosts || 0)}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </div>

          {/* Profit/Loss Summary */}
          <StaggerItem>
            <Card className={`border-2 ${
              (summary?.profit || 0) >= 0 
                ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-300 dark:border-emerald-700'
                : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-300 dark:border-red-700'
            }`}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {(summary?.profit || 0) >= 0 ? (
                      <TrendingUp className="h-8 w-8 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-600" />
                    )}
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {(summary?.profit || 0) >= 0 ? 'רווח' : 'הפסד'}
                      </div>
                      <div className={`text-3xl font-bold ${
                        (summary?.profit || 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                      }`}>
                        {formatCurrency(summary?.profit || 0)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">סה״כ הוצאות</div>
                      <div className="font-bold text-lg">{formatCurrency(summary?.totalCosts || 0)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">מרווח רווח</div>
                      <div className="font-bold text-lg">
                        {summary?.profitMargin?.toFixed(1) || 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Tips Summary */}
          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-6 w-6 text-amber-500" />
                  סיכום טיפים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">טיפים כרטיס</div>
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                      {formatCurrency(summary?.cardTips || 0)}
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">טיפים מזומן</div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(summary?.cashTips || 0)}
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">סה״כ טיפים</div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {formatCurrency(summary?.totalTips || 0)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Employee Breakdown */}
          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-blue-500" />
                  פירוט עובדים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">מלצרים - שעות</span>
                      <span className="font-medium">{summary?.waiterHours?.toFixed(1) || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">מלצרים - עלות</span>
                      <span className="font-medium">{formatCurrency(summary?.waiterCost || 0)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">טבחים - שעות</span>
                      <span className="font-medium">{summary?.cookHours?.toFixed(1) || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">טבחים - עלות</span>
                      <span className="font-medium">{formatCurrency(summary?.cookCost || 0)}</span>
                    </div>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t">
                    <div className="flex justify-between font-semibold">
                      <span>סה״כ עובדים</span>
                      <span>{summary?.employeeCount || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Expense Input Form */}
          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-emerald-500" />
                  הזן הוצאות חודשיות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="foodCosts" className="text-base">
                        עלות מזון (₪)
                      </Label>
                      <Input
                        id="foodCosts"
                        type="number"
                        placeholder="הזן סכום"
                        value={foodCosts}
                        onChange={(e) => setFoodCosts(e.target.value)}
                        className="h-12 text-lg"
                        min="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="extras" className="text-base">
                        הוצאות נוספות (₪)
                      </Label>
                      <Input
                        id="extras"
                        type="number"
                        placeholder="הזן סכום"
                        value={extras}
                        onChange={(e) => setExtras(e.target.value)}
                        className="h-12 text-lg"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-base">
                      הערות
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="הערות נוספות..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  <Button 
                    size="lg"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full h-14 text-lg font-semibold"
                  >
                    {saving ? (
                      <motion.div 
                        className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <>
                        <Save className="h-5 w-5 ml-2" />
                        שמור הוצאות
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>
      )}
    </PageTransition>
  )
}
