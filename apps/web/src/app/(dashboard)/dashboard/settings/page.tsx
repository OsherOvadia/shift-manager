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

interface SettingsFormData {
  weekendDays: number[]
  submissionDeadlineDay: number
  submissionDeadlineHour: number
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
      weekendDays: [5, 6],
      submissionDeadlineDay: 4,
      submissionDeadlineHour: 18,
    },
  })

  const weekendDays = watch('weekendDays')

  useEffect(() => {
    if (settings) {
      reset({
        weekendDays: settings.weekendDays || [5, 6],
        submissionDeadlineDay: settings.submissionDeadlineDay ?? 4,
        submissionDeadlineHour: settings.submissionDeadlineHour ?? 18,
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
