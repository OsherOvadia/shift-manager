'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { getWeekStartDate, getWeekDates, getDayName, formatShortDate, isWeekend } from '@/lib/utils'
import { Loader2, ChevronRight, ChevronLeft, Plus, Trash2, Send, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const SHIFT_TYPES = [
  { value: 'MORNING', label: 'בוקר', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'EVENING', label: 'ערב', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'EVENING_CLOSE', label: 'ערב + סגירה', color: 'bg-purple-100 text-purple-800 border-purple-300' },
]

export default function ManageSchedulePage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedShiftTemplate, setSelectedShiftTemplate] = useState<string>('')
  const [weekendDays, setWeekendDays] = useState<number[]>([4, 5, 6]) // Thu, Fri, Sat

  // Parse week from URL or use current week
  const urlWeek = searchParams.get('week')
  const currentWeekStart = urlWeek ? getWeekStartDate(new Date(urlWeek)) : getWeekStartDate(new Date())
  const targetWeekStart = new Date(currentWeekStart)
  targetWeekStart.setDate(targetWeekStart.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(targetWeekStart)

  // Fetch business settings to get actual weekend days
  const { data: settings } = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => api.get<any>('/settings', accessToken!),
    enabled: !!accessToken,
  })

  // Update weekend days when settings are loaded
  useEffect(() => {
    if (settings?.weekendDays) {
      setWeekendDays(settings.weekendDays)
    }
  }, [settings])

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<any[]>('/users/employees', accessToken!),
    enabled: !!accessToken,
  })

  // Fetch shift templates
  const { data: shiftTemplates } = useQuery({
    queryKey: ['shift-templates'],
    queryFn: () => api.get<any[]>('/shift-templates/active', accessToken!),
    enabled: !!accessToken,
  })

  // Fetch schedules
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get<any[]>('/schedules', accessToken!),
    enabled: !!accessToken,
  })

  // Find or create schedule for current week
  const currentSchedule = schedules?.find((s) => {
    const scheduleDate = new Date(s.weekStartDate)
    const targetDate = new Date(targetWeekStart)
    
    // Normalize both dates to midnight for comparison
    scheduleDate.setHours(0, 0, 0, 0)
    targetDate.setHours(0, 0, 0, 0)
    
    const match = scheduleDate.getTime() === targetDate.getTime()
    console.log('🗓️ Schedule comparison:', {
      scheduleDate: scheduleDate.toISOString().split('T')[0],
      targetDate: targetDate.toISOString().split('T')[0],
      match
    })
    return match
  })

  console.log('📋 Current schedule found:', currentSchedule ? 'YES' : 'NO', currentSchedule?.id)

  // Fetch schedule details
  const { data: scheduleDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['schedule', currentSchedule?.id],
    queryFn: () => api.get<any>(`/schedules/${currentSchedule.id}`, accessToken!),
    enabled: !!currentSchedule?.id && !!accessToken,
  })

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: () =>
      api.post('/schedules', { weekStartDate: targetWeekStart.toISOString() }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast({
        title: 'לוח משמרות נוצר בהצלחה',
        description: 'כעת תוכל להוסיף משמרות',
      })
    },
    onError: async (error: any) => {
      // If schedule already exists, just refresh the data
      if (error.message?.includes('כבר קיים')) {
        console.log('⚠️ Schedule already exists, refreshing data...')
        toast({
          title: 'לוח משמרות כבר קיים',
          description: 'טוען את הלוח הקיים...',
        })
        // Force immediate refetch of schedules
        await queryClient.refetchQueries({ queryKey: ['schedules'] })
      } else {
        toast({
          variant: 'destructive',
          title: 'שגיאה',
          description: error.message,
        })
      }
    },
  })

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: (data: { scheduleId: string; userId: string; shiftTemplateId: string; shiftDate: string }) =>
      api.post('/assignments', data, accessToken!),
    onSuccess: () => {
      toast({ title: 'השיבוץ נוסף בהצלחה' })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assignments/${id}`, accessToken!),
    onSuccess: () => {
      toast({ title: 'השיבוץ הוסר' })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  // Publish schedule mutation
  const publishMutation = useMutation({
    mutationFn: () => api.post(`/schedules/${currentSchedule!.id}/publish`, {}, accessToken!),
    onSuccess: () => {
      toast({ title: 'לוח המשמרות פורסם בהצלחה' })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  // Check conflicts
  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', currentSchedule?.id],
    queryFn: () => api.get<any[]>(`/assignments/conflicts?scheduleId=${currentSchedule!.id}`, accessToken!),
    enabled: !!currentSchedule?.id && !!accessToken,
  })

  const isLoading = schedulesLoading || detailsLoading

  const getAssignmentsForDateAndShift = (date: Date, shiftType: string) => {
    if (!scheduleDetails?.shiftAssignments) return []
    const dateStr = date.toISOString().split('T')[0]
    return scheduleDetails.shiftAssignments.filter((a: any) => {
      const assignmentDate = new Date(a.shiftDate).toISOString().split('T')[0]
      return assignmentDate === dateStr && a.shiftTemplate.shiftType === shiftType
    })
  }

  const handleAddAssignment = (date: Date, shiftType: string) => {
    if (!currentSchedule || !selectedEmployee || !selectedShiftTemplate) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'יש לבחור עובד ומשמרת',
      })
      return
    }

    createAssignmentMutation.mutate({
      scheduleId: currentSchedule.id,
      userId: selectedEmployee,
      shiftTemplateId: selectedShiftTemplate,
      shiftDate: date.toISOString(),
    })
  }

  const getShiftTemplateByType = (shiftType: string) => {
    return shiftTemplates?.find((t) => t.shiftType === shiftType)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ניהול לוח משמרות</h1>
          <p className="text-muted-foreground">
            שבץ עובדים למשמרות השבוע
          </p>
        </div>
        <div className="flex gap-2">
          {currentSchedule && currentSchedule.status === 'DRAFT' && (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 ml-2" />
                  פרסם לוח
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setWeekOffset((prev) => prev - 1)}
        >
          <ChevronRight className="h-4 w-4 ml-2" />
          שבוע קודם
        </Button>
        <div className="text-center">
          <span className="font-medium">
            {formatShortDate(weekDates[0])} - {formatShortDate(weekDates[6])}
          </span>
          {currentSchedule && (
            <div className="mt-1">
              <Badge variant={currentSchedule.status === 'PUBLISHED' ? 'success' : 'secondary'}>
                {currentSchedule.status === 'PUBLISHED' ? 'פורסם' : 'טיוטה'}
              </Badge>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => setWeekOffset((prev) => prev + 1)}
        >
          שבוע הבא
          <ChevronLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>

      {/* Conflicts Warning */}
      {conflicts && conflicts.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              התראות
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700">
            {conflicts.map((c: any, i: number) => (
              <div key={i}>{c.message}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create Schedule Button */}
      {!currentSchedule && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              אין לוח משמרות לשבוע זה
            </p>
            <Button onClick={() => createScheduleMutation.mutate()}>
              <Plus className="h-4 w-4 ml-2" />
              צור לוח משמרות
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assignment Controls */}
      {currentSchedule && currentSchedule.status === 'DRAFT' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">הוסף שיבוץ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר עובד" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Select value={selectedShiftTemplate} onValueChange={setSelectedShiftTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר משמרת" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTemplates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.startTime} - {template.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Grid */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : currentSchedule ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-right font-medium">משמרת</th>
                    {weekDates.map((date) => (
                      <th
                        key={date.toISOString()}
                        className={cn(
                          'p-4 text-center font-medium min-w-[160px]',
                          isWeekend(date, weekendDays) && 'bg-blue-100 dark:bg-blue-950'
                        )}
                      >
                        <div>{getDayName(date)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatShortDate(date)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHIFT_TYPES.map((shift) => (
                    <tr key={shift.value} className="border-b">
                      <td className="p-4">
                        <Badge className={shift.color}>{shift.label}</Badge>
                      </td>
                      {weekDates.map((date) => {
                        const assignments = getAssignmentsForDateAndShift(date, shift.value)
                        const template = getShiftTemplateByType(shift.value)
                        return (
                          <td
                            key={date.toISOString()}
                            className={cn(
                              'p-4 text-center align-top',
                              isWeekend(date, weekendDays) && 'bg-blue-100 dark:bg-blue-950'
                            )}
                          >
                            <div className="space-y-1">
                              {assignments.map((a: any) => (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-between text-sm p-2 bg-muted rounded group"
                                >
                                  <span>
                                    {a.user.firstName} {a.user.lastName[0]}.
                                  </span>
                                  {currentSchedule.status === 'DRAFT' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                      onClick={() => deleteAssignmentMutation.mutate(a.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {currentSchedule.status === 'DRAFT' &&
                                selectedEmployee &&
                                selectedShiftTemplate &&
                                template?.id === selectedShiftTemplate && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleAddAssignment(date, shift.value)}
                                    disabled={createAssignmentMutation.isPending}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
