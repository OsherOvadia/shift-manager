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

interface SettingsFormData {
  weekendDays: number[]
  submissionDeadlineDay: number
  submissionDeadlineHour: number
  closedPeriods: ClosedPeriod[]
  defaultHourlyWage: number
  defaultWages: DefaultWages
}

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
    },
  })

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
                        {SHIFT_TYPES.map((shift) => (
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
