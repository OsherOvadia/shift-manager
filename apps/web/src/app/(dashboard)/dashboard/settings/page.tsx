'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { useAuthStore, isAdmin } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Loader2, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

const DAYS = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`,
}))

const SHIFT_TYPES = [
  { value: 'MORNING', label: 'בוקר' },
  { value: 'EVENING', label: 'ערב' },
  { value: 'EVENING_CLOSE', label: 'ערב + סגירה' },
]

interface ClosedPeriod {
  day: number
  shiftTypes: string[]
}

interface DefaultWages {
  waiter: number
  cook: number
  sushi: number
  dishwasher: number
  [key: string]: number
}

interface ShiftRules {
  minShifts: number
  minWeekendShifts: number
}

interface ShiftRequirements {
  FULL_TIME: ShiftRules
  PART_TIME: ShiftRules
}

interface SettingsFormData {
  weekendDays: number[]
  submissionDeadlineDay: number
  submissionDeadlineHour: number
  closedPeriods: ClosedPeriod[]
  defaultHourlyWage: number
  defaultWages: DefaultWages
  shiftRequirements: ShiftRequirements
  enabledShiftTypes: string[]
  // Feature Toggles
  enableAvailabilitySubmission: boolean
  requireShiftApproval: boolean
  enableTipTracking: boolean
  enableCashTipTracking: boolean
  enableRevenueBreakdown: boolean
  enableDailyRevenue: boolean
  enableFinancialReports: boolean
  enableMonthlyOverview: boolean
  enableCookPayroll: boolean
  enableExcelImport: boolean
  enableNotifications: boolean
  enableEmailNotifications: boolean
  enableJobCategories: boolean
  enableKitchenStaffSeparation: boolean
  enableMonthlyExpenses: boolean
  enableAutomaticScheduling: boolean
  enableShiftSwapping: boolean
  enableOvertimeTracking: boolean
}

const ALL_SHIFT_TYPES = [
  { value: 'MORNING', label: 'בוקר', description: 'משמרת בוקר (11:00-18:00)' },
  { value: 'EVENING', label: 'ערב', description: 'משמרת ערב (18:00-סגירה)' },
  { value: 'EVENING_CLOSE', label: 'ערב + סגירה', description: 'משמרת ערב עם סגירה (18:00-00:00)' },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  const isAdminRole = isAdmin()

  // Redirect non-admin users
  useEffect(() => {
    if (!isAdminRole) {
      router.push('/dashboard')
    }
  }, [isAdminRole, router])

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<any>('/settings', accessToken!),
    enabled: !!accessToken && isAdminRole,
  })

  const { register, handleSubmit, setValue, watch, reset } = useForm<SettingsFormData>({
    defaultValues: {
      weekendDays: [4, 5, 6],
      submissionDeadlineDay: 3,
      submissionDeadlineHour: 18,
      closedPeriods: [],
      defaultHourlyWage: 30,
      defaultWages: { waiter: 30, cook: 35, sushi: 40, dishwasher: 28 },
      shiftRequirements: {
        FULL_TIME: { minShifts: 5, minWeekendShifts: 2 },
        PART_TIME: { minShifts: 3, minWeekendShifts: 1 },
      },
      enabledShiftTypes: ['MORNING', 'EVENING'],
      enableAvailabilitySubmission: true,
      requireShiftApproval: false,
      enableTipTracking: true,
      enableCashTipTracking: true,
      enableRevenueBreakdown: true,
      enableDailyRevenue: true,
      enableFinancialReports: true,
      enableMonthlyOverview: true,
      enableCookPayroll: true,
      enableExcelImport: true,
      enableNotifications: true,
      enableEmailNotifications: false,
      enableJobCategories: true,
      enableKitchenStaffSeparation: true,
      enableMonthlyExpenses: true,
      enableAutomaticScheduling: false,
      enableShiftSwapping: false,
      enableOvertimeTracking: false,
    },
  })

  const enabledShiftTypes = watch('enabledShiftTypes')

  const weekendDays = watch('weekendDays')
  const closedPeriods = watch('closedPeriods')

  useEffect(() => {
    if (settings) {
      reset({
        weekendDays: settings.weekendDays || [4, 5, 6],
        submissionDeadlineDay: settings.submissionDeadlineDay ?? 3,
        submissionDeadlineHour: settings.submissionDeadlineHour ?? 18,
        closedPeriods: settings.closedPeriods || [],
        defaultHourlyWage: settings.defaultHourlyWage ?? 30,
        defaultWages: {
          waiter: settings.defaultWages?.waiter ?? 30,
          cook: settings.defaultWages?.cook ?? 35,
          sushi: settings.defaultWages?.sushi ?? 40,
          dishwasher: settings.defaultWages?.dishwasher ?? 28,
          ...settings.defaultWages,
        },
        shiftRequirements: {
          FULL_TIME: {
            minShifts: settings.shiftRequirements?.FULL_TIME?.minShifts ?? 5,
            minWeekendShifts: settings.shiftRequirements?.FULL_TIME?.minWeekendShifts ?? 2,
          },
          PART_TIME: {
            minShifts: settings.shiftRequirements?.PART_TIME?.minShifts ?? 3,
            minWeekendShifts: settings.shiftRequirements?.PART_TIME?.minWeekendShifts ?? 1,
          },
        },
        enabledShiftTypes: settings.enabledShiftTypes || ['MORNING', 'EVENING'],
        enableAvailabilitySubmission: settings.enableAvailabilitySubmission ?? true,
        requireShiftApproval: settings.requireShiftApproval ?? false,
        enableTipTracking: settings.enableTipTracking ?? true,
        enableCashTipTracking: settings.enableCashTipTracking ?? true,
        enableRevenueBreakdown: settings.enableRevenueBreakdown ?? true,
        enableDailyRevenue: settings.enableDailyRevenue ?? true,
        enableFinancialReports: settings.enableFinancialReports ?? true,
        enableMonthlyOverview: settings.enableMonthlyOverview ?? true,
        enableCookPayroll: settings.enableCookPayroll ?? true,
        enableExcelImport: settings.enableExcelImport ?? true,
        enableNotifications: settings.enableNotifications ?? true,
        enableEmailNotifications: settings.enableEmailNotifications ?? false,
        enableJobCategories: settings.enableJobCategories ?? true,
        enableKitchenStaffSeparation: settings.enableKitchenStaffSeparation ?? true,
        enableMonthlyExpenses: settings.enableMonthlyExpenses ?? true,
        enableAutomaticScheduling: settings.enableAutomaticScheduling ?? false,
        enableShiftSwapping: settings.enableShiftSwapping ?? false,
        enableOvertimeTracking: settings.enableOvertimeTracking ?? false,
      })
    }
  }, [settings, reset])

  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormData) =>
      api.patch('/settings', data, accessToken!),
    onSuccess: () => {
      toast({
        title: 'ההגדרות נשמרו בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  const toggleWeekendDay = (day: number) => {
    const current = weekendDays || []
    if (current.includes(day)) {
      setValue(
        'weekendDays',
        current.filter((d) => d !== day)
      )
    } else {
      setValue('weekendDays', [...current, day])
    }
  }

  const isShiftClosed = (day: number, shiftType: string): boolean => {
    const periods = closedPeriods || []
    const period = periods.find((p) => p.day === day)
    return period ? period.shiftTypes.includes(shiftType) : false
  }

  const toggleClosedShift = (day: number, shiftType: string) => {
    const periods = closedPeriods || []
    const existingPeriodIndex = periods.findIndex((p) => p.day === day)

    if (existingPeriodIndex >= 0) {
      const existingPeriod = periods[existingPeriodIndex]
      if (existingPeriod.shiftTypes.includes(shiftType)) {
        // Remove this shift type
        const newShiftTypes = existingPeriod.shiftTypes.filter((t) => t !== shiftType)
        if (newShiftTypes.length === 0) {
          // Remove the entire period if no shift types left
          setValue(
            'closedPeriods',
            periods.filter((_, i) => i !== existingPeriodIndex)
          )
        } else {
          // Update with remaining shift types
          const newPeriods = [...periods]
          newPeriods[existingPeriodIndex] = { day, shiftTypes: newShiftTypes }
          setValue('closedPeriods', newPeriods)
        }
      } else {
        // Add this shift type
        const newPeriods = [...periods]
        newPeriods[existingPeriodIndex] = {
          day,
          shiftTypes: [...existingPeriod.shiftTypes, shiftType],
        }
        setValue('closedPeriods', newPeriods)
      }
    } else {
      // Create new period with this shift type
      setValue('closedPeriods', [...periods, { day, shiftTypes: [shiftType] }])
    }
  }

  const toggleShiftType = (shiftType: string) => {
    const current = enabledShiftTypes || []
    if (current.includes(shiftType)) {
      // Don't allow removing if it's the last one
      if (current.length <= 1) return
      setValue('enabledShiftTypes', current.filter((t) => t !== shiftType))
    } else {
      setValue('enabledShiftTypes', [...current, shiftType])
    }
  }

  // Filter the shift types shown in the closed periods section
  const activeShiftTypes = SHIFT_TYPES.filter(st => (enabledShiftTypes || []).includes(st.value))

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data)
  }

  if (!isAdminRole) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות מערכת</h1>
        <p className="text-muted-foreground">
          הגדר את פרמטרי העבודה של המערכת
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Weekend Days */}
          <Card>
            <CardHeader>
              <CardTitle>ימי סוף שבוע</CardTitle>
              <CardDescription>
                בחר את הימים שנחשבים כסוף שבוע (נדרשים משמרות סוף שבוע)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {DAYS.map((day) => (
                  <div key={day.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={weekendDays?.includes(day.value)}
                      onCheckedChange={() => toggleWeekendDay(day.value)}
                    />
                    <Label htmlFor={`day-${day.value}`} className="cursor-pointer">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enabled Shift Types */}
          <Card>
            <CardHeader>
              <CardTitle>סוגי משמרות פעילים</CardTitle>
              <CardDescription>
                בחר אילו סוגי משמרות יוצגו במערכת. ברירת מחדל: בוקר + ערב (ללא הפרדה בין ערב לערב+סגירה)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ALL_SHIFT_TYPES.map((st) => (
                  <div key={st.value} className="flex items-center gap-3">
                    <Checkbox
                      id={`shift-type-${st.value}`}
                      checked={(enabledShiftTypes || []).includes(st.value)}
                      onCheckedChange={() => toggleShiftType(st.value)}
                      disabled={(enabledShiftTypes || []).length <= 1 && (enabledShiftTypes || []).includes(st.value)}
                    />
                    <div>
                      <Label htmlFor={`shift-type-${st.value}`} className="cursor-pointer font-medium">
                        {st.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{st.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                אם &quot;ערב + סגירה&quot; כבוי, כל משמרות הערב יטופלו כמשמרת ערב אחת מאוחדת
              </p>
            </CardContent>
          </Card>

          {/* Shift Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>דרישות הגשת משמרות</CardTitle>
              <CardDescription>
                מספר משמרות מינימלי שכל עובד צריך להגיש לפי סוג משרה
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Full Time */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    משרה מלאה
                  </Label>
                  <div className="grid gap-4 sm:grid-cols-2 mr-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">מינימום משמרות בשבוע</Label>
                      <Input
                        type="number"
                        min={0}
                        max={21}
                        {...register('shiftRequirements.FULL_TIME.minShifts', { valueAsNumber: true })}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">מינימום משמרות סוף שבוע</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        {...register('shiftRequirements.FULL_TIME.minWeekendShifts', { valueAsNumber: true })}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Part Time */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                    משרה חלקית
                  </Label>
                  <div className="grid gap-4 sm:grid-cols-2 mr-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">מינימום משמרות בשבוע</Label>
                      <Input
                        type="number"
                        min={0}
                        max={21}
                        {...register('shiftRequirements.PART_TIME.minShifts', { valueAsNumber: true })}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">מינימום משמרות סוף שבוע</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        {...register('shiftRequirements.PART_TIME.minWeekendShifts', { valueAsNumber: true })}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submission Deadline */}
          <Card>
            <CardHeader>
              <CardTitle>מועד אחרון להגשת זמינות</CardTitle>
              <CardDescription>
                הגדר את המועד האחרון שבו עובדים יכולים להגיש זמינות לשבוע הבא
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>יום בשבוע</Label>
                  <Select
                    value={watch('submissionDeadlineDay')?.toString()}
                    onValueChange={(value) =>
                      setValue('submissionDeadlineDay', parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שעה</Label>
                  <Select
                    value={watch('submissionDeadlineHour')?.toString()}
                    onValueChange={(value) =>
                      setValue('submissionDeadlineHour', parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={hour.value.toString()}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Default Wages per Category */}
          <Card>
            <CardHeader>
              <CardTitle>שכר שעתי ברירת מחדל לפי תפקיד</CardTitle>
              <CardDescription>
                שכר שייקבע אוטומטית לעובדים חדשים לפי התפקיד שזוהה מקובץ השעות. ניתן לערוך לכל עובד בנפרד בעמוד העובדים.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-blue-500" />
                    מלצר / אחראי משמרת
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      {...register('defaultWages.waiter', { valueAsNumber: true })}
                      className="h-10"
                    />
                    <span className="text-muted-foreground text-sm whitespace-nowrap">₪/שעה</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-orange-500" />
                    טבח
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      {...register('defaultWages.cook', { valueAsNumber: true })}
                      className="h-10"
                    />
                    <span className="text-muted-foreground text-sm whitespace-nowrap">₪/שעה</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-pink-500" />
                    סושימן
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      {...register('defaultWages.sushi', { valueAsNumber: true })}
                      className="h-10"
                    />
                    <span className="text-muted-foreground text-sm whitespace-nowrap">₪/שעה</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-teal-500" />
                    שוטף כלים
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      {...register('defaultWages.dishwasher', { valueAsNumber: true })}
                      className="h-10"
                    />
                    <span className="text-muted-foreground text-sm whitespace-nowrap">₪/שעה</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Label className="text-muted-foreground text-sm">שכר כללי (עובדים ללא תפקיד מזוהה)</Label>
                <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    {...register('defaultHourlyWage', { valueAsNumber: true })}
                    className="h-10"
                  />
                  <span className="text-muted-foreground text-sm whitespace-nowrap">₪/שעה</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Closed Periods */}
          <Card>
            <CardHeader>
              <CardTitle>תקופות סגורות</CardTitle>
              <CardDescription>
                בחר משמרות שלא יוצגו במערכת (למשל: שישי ערב, שבת בוקר)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4">
                  {DAYS.map((day) => (
                    <div key={day.value} className="space-y-2">
                      <Label className="font-semibold">{day.label}</Label>
                      <div className="flex flex-wrap gap-4 mr-4">
                        {activeShiftTypes.map((shift) => (
                          <div key={shift.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`closed-${day.value}-${shift.value}`}
                              checked={isShiftClosed(day.value, shift.value)}
                              onCheckedChange={() => toggleClosedShift(day.value, shift.value)}
                            />
                            <Label
                              htmlFor={`closed-${day.value}-${shift.value}`}
                              className="cursor-pointer text-sm"
                            >
                              {shift.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  משמרות סגורות לא יוצגו בהגשת זמינות ובניהול לוח המשמרות
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Toggles */}
          <Card>
            <CardHeader>
              <CardTitle>תכונות מערכת</CardTitle>
              <CardDescription>
                הפעל או כבה תכונות לפי הצורך של הארגון שלך
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Availability & Scheduling */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">זמינות ותזמון משמרות</h3>
                  <div className="space-y-2 mr-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableAvailabilitySubmission"
                        checked={watch('enableAvailabilitySubmission') ?? true}
                        onCheckedChange={(checked) => setValue('enableAvailabilitySubmission', !!checked)}
                      />
                      <Label htmlFor="enableAvailabilitySubmission" className="cursor-pointer">
                        הגשת זמינות עובדים
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="requireShiftApproval"
                        checked={watch('requireShiftApproval') ?? false}
                        onCheckedChange={(checked) => setValue('requireShiftApproval', !!checked)}
                      />
                      <Label htmlFor="requireShiftApproval" className="cursor-pointer">
                        נדרש אישור מנהל למשמרות
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableAutomaticScheduling"
                        checked={watch('enableAutomaticScheduling') ?? false}
                        onCheckedChange={(checked) => setValue('enableAutomaticScheduling', !!checked)}
                      />
                      <Label htmlFor="enableAutomaticScheduling" className="cursor-pointer">
                        תזמון אוטומטי של משמרות (בפיתוח)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableShiftSwapping"
                        checked={watch('enableShiftSwapping') ?? false}
                        onCheckedChange={(checked) => setValue('enableShiftSwapping', !!checked)}
                      />
                      <Label htmlFor="enableShiftSwapping" className="cursor-pointer">
                        החלפת משמרות בין עובדים (בפיתוח)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Tips & Revenue */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">טיפים והכנסות</h3>
                  <div className="space-y-2 mr-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableTipTracking"
                        checked={watch('enableTipTracking') ?? true}
                        onCheckedChange={(checked) => setValue('enableTipTracking', !!checked)}
                      />
                      <Label htmlFor="enableTipTracking" className="cursor-pointer">
                        מעקב אחר טיפים
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableCashTipTracking"
                        checked={watch('enableCashTipTracking') ?? true}
                        onCheckedChange={(checked) => setValue('enableCashTipTracking', !!checked)}
                      />
                      <Label htmlFor="enableCashTipTracking" className="cursor-pointer">
                        מעקב אחר טיפים במזומן למלצרים
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableRevenueBreakdown"
                        checked={watch('enableRevenueBreakdown') ?? true}
                        onCheckedChange={(checked) => setValue('enableRevenueBreakdown', !!checked)}
                      />
                      <Label htmlFor="enableRevenueBreakdown" className="cursor-pointer">
                        פירוט הכנסות (ישיבה/טייק-אווי/משלוחים)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableDailyRevenue"
                        checked={watch('enableDailyRevenue') ?? true}
                        onCheckedChange={(checked) => setValue('enableDailyRevenue', !!checked)}
                      />
                      <Label htmlFor="enableDailyRevenue" className="cursor-pointer">
                        דיווח הכנסות יומי
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Reports & Analytics */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">דוחות וניתוח</h3>
                  <div className="space-y-2 mr-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableFinancialReports"
                        checked={watch('enableFinancialReports') ?? true}
                        onCheckedChange={(checked) => setValue('enableFinancialReports', !!checked)}
                      />
                      <Label htmlFor="enableFinancialReports" className="cursor-pointer">
                        דוחות כספיים
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableMonthlyOverview"
                        checked={watch('enableMonthlyOverview') ?? true}
                        onCheckedChange={(checked) => setValue('enableMonthlyOverview', !!checked)}
                      />
                      <Label htmlFor="enableMonthlyOverview" className="cursor-pointer">
                        סיכום חודשי
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableCookPayroll"
                        checked={watch('enableCookPayroll') ?? true}
                        onCheckedChange={(checked) => setValue('enableCookPayroll', !!checked)}
                      />
                      <Label htmlFor="enableCookPayroll" className="cursor-pointer">
                        שכר טבחים
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableMonthlyExpenses"
                        checked={watch('enableMonthlyExpenses') ?? true}
                        onCheckedChange={(checked) => setValue('enableMonthlyExpenses', !!checked)}
                      />
                      <Label htmlFor="enableMonthlyExpenses" className="cursor-pointer">
                        הוצאות חודשיות
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableOvertimeTracking"
                        checked={watch('enableOvertimeTracking') ?? false}
                        onCheckedChange={(checked) => setValue('enableOvertimeTracking', !!checked)}
                      />
                      <Label htmlFor="enableOvertimeTracking" className="cursor-pointer">
                        מעקב שעות נוספות (בפיתוח)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Import & Categories */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">ייבוא נתונים וקטגוריות</h3>
                  <div className="space-y-2 mr-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableExcelImport"
                        checked={watch('enableExcelImport') ?? true}
                        onCheckedChange={(checked) => setValue('enableExcelImport', !!checked)}
                      />
                      <Label htmlFor="enableExcelImport" className="cursor-pointer">
                        ייבוא שעות מאקסל
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableJobCategories"
                        checked={watch('enableJobCategories') ?? true}
                        onCheckedChange={(checked) => setValue('enableJobCategories', !!checked)}
                      />
                      <Label htmlFor="enableJobCategories" className="cursor-pointer">
                        קטגוריות תפקידים
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableKitchenStaffSeparation"
                        checked={watch('enableKitchenStaffSeparation') ?? true}
                        onCheckedChange={(checked) => setValue('enableKitchenStaffSeparation', !!checked)}
                      />
                      <Label htmlFor="enableKitchenStaffSeparation" className="cursor-pointer">
                        הפרדת צוות מטבח בלוח משמרות
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Notifications */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">התראות</h3>
                  <div className="space-y-2 mr-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableNotifications"
                        checked={watch('enableNotifications') ?? true}
                        onCheckedChange={(checked) => setValue('enableNotifications', !!checked)}
                      />
                      <Label htmlFor="enableNotifications" className="cursor-pointer">
                        התראות במערכת
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="enableEmailNotifications"
                        checked={watch('enableEmailNotifications') ?? false}
                        onCheckedChange={(checked) => setValue('enableEmailNotifications', !!checked)}
                      />
                      <Label htmlFor="enableEmailNotifications" className="cursor-pointer">
                        שליחת התראות במייל (בפיתוח)
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" />
                  שמור הגדרות
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
