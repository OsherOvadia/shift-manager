'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addWeeks, subWeeks } from 'date-fns'
import { he } from 'date-fns/locale'
import { api } from '@/lib/api'
import { useAuthStore, isAdmin, isManager } from '@/lib/auth'
import { getWeekStartDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Clock,
  Users,
  Calendar,
  Save,
  ChefHat,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { 
  PageTransition, 
  StaggerContainer, 
  StaggerItem, 
  ScaleOnTap,
  motion,
} from '@/components/ui/animations'
import { useRouter } from 'next/navigation'

interface CookPayroll {
  userId: string
  firstName: string
  lastName: string
  jobCategory: {
    id: string
    name: string
    nameHe: string
    color: string
  } | null
  hourlyWage: number
  totalHours: number
  totalEarnings: number
  notes: string
  entryId: string | null
}

interface PayrollData {
  weekStart: string
  cooks: CookPayroll[]
  totals: {
    totalHours: number
    totalEarnings: number
    cookCount: number
  }
}

export default function CookPayrollPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(() => getWeekStartDate(new Date()))
  const [editedHours, setEditedHours] = useState<{ [key: string]: string }>({})
  const [editedWages, setEditedWages] = useState<{ [key: string]: string }>({})
  const [editedNotes, setEditedNotes] = useState<{ [key: string]: string }>({})
  const [savedHours, setSavedHours] = useState<{ [key: string]: string }>({})
  const [savedWages, setSavedWages] = useState<{ [key: string]: string }>({})
  const [savedNotes, setSavedNotes] = useState<{ [key: string]: string }>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  const isAdminOrManager = isAdmin() || isManager()

  // Redirect non-admin/manager users
  useEffect(() => {
    if (!isAdminOrManager) {
      router.push('/dashboard')
    }
  }, [isAdminOrManager, router])

  // Fetch payroll data for the week (from CookWeeklyHours table)
  const { data: payrollData, isLoading } = useQuery<PayrollData>({
    queryKey: ['cook-payroll', weekStart.toISOString()],
    queryFn: () => api.get(`/cook-payroll/week/${weekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken && isAdminOrManager,
  })

  // FALLBACK: Fetch hours from shift assignments if CookWeeklyHours is empty
  const hasMissingHours = payrollData?.cooks?.some(c => c.totalHours === 0) || false
  const { data: shiftBasedHours } = useQuery<PayrollData>({
    queryKey: ['cook-shift-hours', weekStart.toISOString()],
    queryFn: () => api.get(`/cook-payroll/week/${weekStart.toISOString()}/from-shifts`, accessToken!),
    enabled: !!accessToken && isAdminOrManager && hasMissingHours,
  })

  // Merge payroll data with shift-based fallback
  const mergedPayrollData = payrollData ? {
    ...payrollData,
    cooks: payrollData.cooks.map(cook => {
      if (cook.totalHours > 0) return cook // Already has data from CookWeeklyHours
      
      // Find fallback data from shifts
      const fallback = shiftBasedHours?.cooks?.find(fb => fb.userId === cook.userId)
      if (fallback) {
        console.log(`[CookPayroll] Using fallback hours for ${cook.firstName}: ${fallback.totalHours}h`)
        return {
          ...cook,
          totalHours: fallback.totalHours,
          totalEarnings: fallback.totalEarnings,
          notes: fallback.notes,
        }
      }
      
      return cook // No fallback available
    })
  } : null

  // Fetch weekly comparison data
  const { data: comparisonData } = useQuery<any[]>({
    queryKey: ['cook-payroll-comparison'],
    queryFn: () => api.get('/cook-payroll/comparison?weeks=4', accessToken!),
    enabled: !!accessToken && isAdminOrManager,
  })

  // Initialize edited values when data loads
  useEffect(() => {
    if (mergedPayrollData?.cooks) {
      const hours: { [key: string]: string } = {}
      const wages: { [key: string]: string } = {}
      const notes: { [key: string]: string } = {}
      
      mergedPayrollData.cooks.forEach(cook => {
        hours[cook.userId] = cook.totalHours.toString()
        wages[cook.userId] = cook.hourlyWage.toString()
        notes[cook.userId] = cook.notes || ''
      })
      
      setEditedHours(hours)
      setEditedWages(wages)
      setEditedNotes(notes)
      
      // Also set saved values (initial state)
      setSavedHours(hours)
      setSavedWages(wages)
      setSavedNotes(notes)
    }
  }, [mergedPayrollData])

  // Save cook hours mutation
  const saveCookHoursMutation = useMutation({
    mutationFn: (data: { userId: string; weekStart: string; totalHours: number; hourlyWage: number; notes?: string }) =>
      api.post('/cook-payroll', data, accessToken!),
    onSuccess: (_, variables) => {
      toast({
        title: 'נשמר בהצלחה',
        description: 'שעות העבודה נשמרו',
      })
      queryClient.invalidateQueries({ queryKey: ['cook-payroll'] })
      queryClient.invalidateQueries({ queryKey: ['cook-payroll-comparison'] })
      
      // Update saved state to match current edited state
      setSavedHours(prev => ({ ...prev, [variables.userId]: editedHours[variables.userId] }))
      setSavedWages(prev => ({ ...prev, [variables.userId]: editedWages[variables.userId] }))
      setSavedNotes(prev => ({ ...prev, [variables.userId]: editedNotes[variables.userId] }))
      
      setSavingUserId(null)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message || 'שגיאה בשמירת שעות',
      })
      setSavingUserId(null)
    },
  })

  const handleSaveCook = (userId: string) => {
    setSavingUserId(userId)
    saveCookHoursMutation.mutate({
      userId,
      weekStart: weekStart.toISOString(),
      totalHours: parseFloat(editedHours[userId] || '0'),
      hourlyWage: parseFloat(editedWages[userId] || '0'),
      notes: editedNotes[userId] || '',
    })
  }

  const calculateEarnings = (userId: string): number => {
    const hours = parseFloat(editedHours[userId] || '0')
    const wage = parseFloat(editedWages[userId] || '0')
    return Math.round(hours * wage * 100) / 100
  }

  const calculateTotals = () => {
    if (!mergedPayrollData?.cooks) return { totalHours: 0, totalEarnings: 0 }
    
    let totalHours = 0
    let totalEarnings = 0
    
    mergedPayrollData.cooks.forEach(cook => {
      const hours = parseFloat(editedHours[cook.userId] || '0')
      const wage = parseFloat(editedWages[cook.userId] || '0')
      totalHours += hours
      totalEarnings += hours * wage
    })
    
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Check if cook data has been modified since last save
  const hasUnsavedChanges = (userId: string): boolean => {
    return (
      editedHours[userId] !== savedHours[userId] ||
      editedWages[userId] !== savedWages[userId] ||
      editedNotes[userId] !== savedNotes[userId]
    )
  }

  if (!isAdminOrManager) {
    return null
  }

  const totals = calculateTotals()

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-primary" />
              שכר טבחים
            </h1>
            <p className="text-sm text-muted-foreground">
              ניהול שעות ושכר עובדי מטבח
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekStart(prev => subWeeks(prev, 1))}
              >
                <ChevronRight className="h-4 w-4 ml-1" />
                שבוע קודם
              </Button>
              <div className="flex items-center gap-2 text-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">
                  {format(weekStart, 'dd/MM/yyyy', { locale: he })} - {format(addWeeks(weekStart, 1), 'dd/MM/yyyy', { locale: he })}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekStart(prev => addWeeks(prev, 1))}
              >
                שבוע הבא
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StaggerItem>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  טבחים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mergedPayrollData?.cooks?.length || 0}</div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  סה"כ שעות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalHours}</div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  סה"כ לתשלום
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(totals.totalEarnings)}</div>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        {/* Cook Hours Table */}
        <Card>
          <CardHeader>
            <CardTitle>שעות עבודה</CardTitle>
            <CardDescription>הזן את שעות העבודה לכל טבח</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : mergedPayrollData?.cooks?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                לא נמצאו עובדי מטבח
              </div>
            ) : (
              <div className="space-y-4">
                {mergedPayrollData?.cooks?.map((cook) => (
                  <motion.div
                    key={cook.userId}
                    className="p-4 border rounded-lg space-y-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {/* Cook Info Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <ChefHat className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {cook.firstName} {cook.lastName}
                          </div>
                          {cook.jobCategory && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: cook.jobCategory.color, color: cook.jobCategory.color }}
                            >
                              {cook.jobCategory.nameHe || cook.jobCategory.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm text-muted-foreground">סה"כ</div>
                        <div className="text-lg font-bold text-primary">
                          {formatCurrency(calculateEarnings(cook.userId))}
                        </div>
                      </div>
                    </div>

                    {/* Input Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">שעות</Label>
                        <Input
                          type="number"
                          placeholder="הזן שעות"
                          value={editedHours[cook.userId] || ''}
                          onChange={(e) => setEditedHours(prev => ({
                            ...prev,
                            [cook.userId]: e.target.value
                          }))}
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">שכר לשעה (₪)</Label>
                        <Input
                          type="number"
                          placeholder="שכר לשעה"
                          value={editedWages[cook.userId] || ''}
                          onChange={(e) => setEditedWages(prev => ({
                            ...prev,
                            [cook.userId]: e.target.value
                          }))}
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">הערות</Label>
                        <Input
                          type="text"
                          placeholder="הערות (אופציונלי)"
                          value={editedNotes[cook.userId] || ''}
                          onChange={(e) => setEditedNotes(prev => ({
                            ...prev,
                            [cook.userId]: e.target.value
                          }))}
                        />
                      </div>
                    </div>

                    {/* Save Button - Only show if there are unsaved changes */}
                    {hasUnsavedChanges(cook.userId) && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSaveCook(cook.userId)}
                          disabled={savingUserId === cook.userId}
                        >
                          {savingUserId === cook.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-2" />
                          ) : (
                            <Save className="h-4 w-4 ml-2" />
                          )}
                          שמור
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Comparison */}
        {comparisonData && comparisonData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                השוואה שבועית
              </CardTitle>
              <CardDescription>
                השוואת עלויות שכר טבחים בין השבועות האחרונים
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comparisonData.map((week, index) => (
                  <div key={week.weekStart} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium">{week.weekLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {week.cookCount} טבחים • {week.totalHours} שעות
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold">
                        {formatCurrency(week.totalEarnings)}
                      </div>
                      {index > 0 && comparisonData[index - 1] && (
                        <div className={cn(
                          "text-xs",
                          week.totalEarnings > comparisonData[index - 1].totalEarnings
                            ? "text-red-500"
                            : "text-green-500"
                        )}>
                          {week.totalEarnings > comparisonData[index - 1].totalEarnings ? '↑' : '↓'}
                          {Math.abs(Math.round(
                            ((week.totalEarnings - comparisonData[index - 1].totalEarnings) / 
                            (comparisonData[index - 1].totalEarnings || 1)) * 100
                          ))}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  )
}
