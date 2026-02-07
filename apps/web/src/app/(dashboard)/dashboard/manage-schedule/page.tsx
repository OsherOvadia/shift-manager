'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { getWeekStartDate, getWeekDates, getDayName, getDayLetter, formatShortDate, isWeekend, formatDateLocal, isShiftClosed } from '@/lib/utils'
import { Loader2, ChevronRight, ChevronLeft, Plus, Trash2, Send, AlertTriangle, Clock, Edit2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ALL_SHIFT_TYPES = [
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
  
  const [weekOffset, setWeekOffset] = useState(0) // Default to current week
  const [weekendDays, setWeekendDays] = useState<number[]>([4, 5, 6]) // Thu, Fri, Sat
  const [closedPeriods, setClosedPeriods] = useState<Array<{ day: number; shiftTypes: string[] }>>([])
  const [selectedShift, setSelectedShift] = useState<{ date: Date; shiftType: string } | null>(null)
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([])
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null)
  const [actualStartTime, setActualStartTime] = useState('')
  const [actualEndTime, setActualEndTime] = useState('')
  const [actualHours, setActualHours] = useState('')

  // Parse week from URL or use current week  
  const urlWeek = searchParams.get('week')
  const currentWeekStart = urlWeek ? getWeekStartDate(new Date(urlWeek)) : getWeekStartDate(new Date())
  const targetWeekStart = new Date(currentWeekStart)
  // Use UTC date arithmetic to avoid timezone issues
  targetWeekStart.setUTCDate(targetWeekStart.getUTCDate() + weekOffset * 7)
  const weekDates = getWeekDates(targetWeekStart)

  // Fetch business settings to get actual weekend days and closed periods
  const { data: settings } = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => api.get<any>('/settings', accessToken!),
    enabled: !!accessToken,
  })

  // Update weekend days and closed periods when settings are loaded
  useEffect(() => {
    if (settings?.weekendDays) {
      setWeekendDays(settings.weekendDays)
    }
    if (settings?.closedPeriods) {
      setClosedPeriods(settings.closedPeriods)
    }
  }, [settings])

  const SHIFT_TYPES = ALL_SHIFT_TYPES.filter(st =>
    (settings?.enabledShiftTypes || ['MORNING', 'EVENING']).includes(st.value)
  )

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<any[]>('/users/employees', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes - static data
  })

  // Fetch shift templates
  const { data: shiftTemplates } = useQuery({
    queryKey: ['shift-templates'],
    queryFn: () => api.get<any[]>('/shift-templates/active', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes - static data
  })

  // Fetch schedules
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get<any[]>('/schedules', accessToken!),
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Fetch availability submissions for the week
  const { data: availabilitySubmissions } = useQuery({
    queryKey: ['availability-submissions', targetWeekStart.toISOString()],
    queryFn: () => api.get<any[]>(`/availability/week/${targetWeekStart.toISOString()}/all`, accessToken!),
    enabled: !!accessToken,
    staleTime: 3 * 60 * 1000, // 3 minutes
  })

  // Find or create schedule for current week
  const currentSchedule = schedules?.find((s) => {
    // Compare dates as strings to avoid timezone issues
    const scheduleDateStr = new Date(s.weekStartDate).toISOString().split('T')[0]
    const targetDateStr = targetWeekStart.toISOString().split('T')[0]
    
    console.log('🔍 Schedule comparison:', {
      scheduleId: s.id,
      scheduleDate: scheduleDateStr,
      targetDate: targetDateStr,
      rawScheduleDate: s.weekStartDate,
      rawTargetDate: targetWeekStart.toISOString(),
      match: scheduleDateStr === targetDateStr
    })
    
    return scheduleDateStr === targetDateStr
  })
  
  console.log('📋 Found schedule:', currentSchedule?.id, 'Total schedules:', schedules?.length)
  
  if (schedules && schedules.length > 0 && !currentSchedule) {
    console.log('⚠️ WARNING: Have schedules but none match current week!')
    console.log('Available schedules:', schedules.map(s => ({
      id: s.id,
      weekStart: new Date(s.weekStartDate).toISOString().split('T')[0],
      status: s.status
    })))
    console.log('Looking for week:', targetWeekStart.toISOString().split('T')[0])
  }

  // Fetch schedule details
  const { data: scheduleDetails, isLoading: detailsLoading, error: detailsError } = useQuery({
    queryKey: ['schedule', currentSchedule?.id],
    queryFn: async () => {
      console.log('📥 Fetching schedule details for:', currentSchedule.id)
      const result = await api.get<any>(`/schedules/${currentSchedule.id}`, accessToken!)
      console.log('✅ Schedule details received:', {
        id: result.id,
        assignmentsCount: result.shiftAssignments?.length || 0
      })
      return result
    },
    enabled: !!currentSchedule?.id && !!accessToken,
  })
  
  console.log('📊 Schedule details:', {
    loading: detailsLoading,
    hasData: !!scheduleDetails,
    error: detailsError,
    assignmentsCount: scheduleDetails?.shiftAssignments?.length
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

  // Helper to refresh schedule data
  const refreshScheduleData = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] })
    if (currentSchedule?.id) {
      queryClient.invalidateQueries({ queryKey: ['schedule', currentSchedule.id] })
    }
  }

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: (data: { scheduleId: string; userId: string; shiftTemplateId: string; shiftDate: string }) =>
      api.post('/assignments', data, accessToken!),
    onSuccess: () => {
      // Don't show toast here - we'll show it after all assignments are added
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
      refreshScheduleData()
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  // Update actual times mutation
  const updateActualTimesMutation = useMutation({
    mutationFn: (data: { id: string; actualStartTime?: string; actualEndTime?: string; actualHours?: number }) =>
      api.patch(`/assignments/${data.id}`, {
        actualStartTime: data.actualStartTime || null,
        actualEndTime: data.actualEndTime || null,
        actualHours: data.actualHours ? parseFloat(data.actualHours.toString()) : null,
      }, accessToken!),
    onSuccess: () => {
      toast({ title: 'זמני נוכחות עודכנו' })
      refreshScheduleData()
      setEditingAssignment(null)
      setActualStartTime('')
      setActualEndTime('')
      setActualHours('')
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  // Open edit times dialog
  const openEditTimesDialog = (assignment: any) => {
    setEditingAssignment(assignment)
    setActualStartTime(assignment.actualStartTime || assignment.shiftTemplate?.startTime || '')
    setActualEndTime(assignment.actualEndTime || assignment.shiftTemplate?.endTime || '')
    setActualHours(assignment.actualHours?.toString() || '')
  }

  // Calculate hours from times
  const calculateHoursFromTimes = (start: string, end: string): number => {
    if (!start || !end) return 0
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    let hours = (endH + endM / 60) - (startH + startM / 60)
    if (hours < 0) hours += 24
    return Math.round(hours * 100) / 100
  }

  // Handle save actual times
  const handleSaveActualTimes = () => {
    if (!editingAssignment) return
    
    const hours = actualHours 
      ? parseFloat(actualHours) 
      : calculateHoursFromTimes(actualStartTime, actualEndTime)
    
    updateActualTimesMutation.mutate({
      id: editingAssignment.id,
      actualStartTime: actualStartTime || undefined,
      actualEndTime: actualEndTime || undefined,
      actualHours: hours || undefined,
    })
  }

  // Publish schedule mutation
  const publishMutation = useMutation({
    mutationFn: () => api.post(`/schedules/${currentSchedule!.id}/publish`, {}, accessToken!),
    onSuccess: () => {
      toast({ title: 'לוח המשמרות פורסם בהצלחה' })
      refreshScheduleData()
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  // Check conflicts (only for draft schedules)
  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', currentSchedule?.id],
    queryFn: () => api.get<any[]>(`/assignments/conflicts?scheduleId=${currentSchedule!.id}`, accessToken!),
    enabled: !!currentSchedule?.id && !!accessToken && currentSchedule.status === 'DRAFT',
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  const isLoading = schedulesLoading || detailsLoading

  const getAssignmentsForDateAndShift = (date: Date, shiftType: string) => {
    if (!scheduleDetails?.shiftAssignments) return []
    const dateStr = formatDateLocal(date) // Use local date format
    return scheduleDetails.shiftAssignments.filter((a: any) => {
      const assignmentDate = a.shiftDate.split('T')[0]
      return assignmentDate === dateStr && a.shiftTemplate.shiftType === shiftType
    })
  }

  const handleAddAssignments = async () => {
    if (!currentSchedule || !selectedShift || selectedWorkers.length === 0) return

    const template = getShiftTemplateByType(selectedShift.shiftType)
    if (!template) return

    // Format date as YYYY-MM-DD to avoid timezone issues
    const dateStr = formatDateLocal(selectedShift.date)

    // Add all selected workers to the shift
    for (const userId of selectedWorkers) {
      await createAssignmentMutation.mutateAsync({
        scheduleId: currentSchedule.id,
        userId,
        shiftTemplateId: template.id,
        shiftDate: dateStr, // Use local date string instead of ISO
      })
    }

    // Refresh schedule data first
    await queryClient.refetchQueries({ queryKey: ['schedule', currentSchedule.id] })

    toast({
      title: 'השיבוצים נוספו בהצלחה',
      description: `${selectedWorkers.length} עובדים שובצו למשמרת`,
    })

    // Close dialog and reset
    setSelectedShift(null)
    setSelectedWorkers([])
  }

  const openShiftDialog = (date: Date, shiftType: string) => {
    setSelectedShift({ date, shiftType })
    setSelectedWorkers([])
  }

  const toggleWorker = (userId: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const getShiftTemplateByType = (shiftType: string) => {
    return shiftTemplates?.find((t) => t.shiftType === shiftType)
  }

  // Memoize availability map for better performance
  const availabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    availabilitySubmissions?.forEach((submission: any) => {
      submission.slots?.forEach((slot: any) => {
        const slotDate = slot.shiftDate.split('T')[0]
        const key = `${slotDate}_${slot.shiftType}`
        if (!map.has(key)) {
          map.set(key, new Set())
        }
        map.get(key)!.add(submission.userId)
      })
    })
    return map
  }, [availabilitySubmissions])

  // Get employees sorted by availability for a specific date/shift
  // Filter out chefs, sushimen, and other kitchen staff - only show waiters
  const getEmployeesForShift = (date: Date, shiftType: string) => {
    if (!employees) return []
    
    const dateStr = formatDateLocal(date)
    const key = `${dateStr}_${shiftType}`
    const employeesWithAvailability = availabilityMap.get(key) || new Set()

    // Filter out kitchen staff (cooks, chefs, sushimen)
    const kitchenCategories = ['cook', 'טבח', 'chef', 'sushiman', 'סושימן', 'kitchen', 'מטבח']
    const waitersOnly = employees.filter(emp => {
      const categoryName = emp.jobCategory?.name?.toLowerCase() || ''
      const categoryNameHe = emp.jobCategory?.nameHe?.toLowerCase() || ''
      return !kitchenCategories.some(kitchen => 
        categoryName.includes(kitchen) || categoryNameHe.includes(kitchen)
      )
    })

    // Sort: employees with availability first, then others
    return [...waitersOnly].sort((a, b) => {
      const aHasAvailability = employeesWithAvailability.has(a.id)
      const bHasAvailability = employeesWithAvailability.has(b.id)
      
      if (aHasAvailability && !bHasAvailability) return -1
      if (!aHasAvailability && bHasAvailability) return 1
      
      // If both have or both don't have availability, sort alphabetically
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'he')
    })
  }

  // Get kitchen staff (cooks, sushi, dishwashers)
  const kitchenCategories = ['cook', 'טבח', 'chef', 'sushiman', 'סושימן', 'sushi', 'kitchen', 'מטבח']
  
  const kitchenStaff = useMemo(() => {
    if (!employees) return []
    return employees.filter(emp => {
      const categoryName = emp.jobCategory?.name?.toLowerCase() || ''
      const categoryNameHe = emp.jobCategory?.nameHe?.toLowerCase() || ''
      return kitchenCategories.some(kitchen =>
        categoryName.includes(kitchen) || categoryNameHe.includes(kitchen)
      )
    })
  }, [employees])

  // Get all kitchen staff assignments for a date (across all shift types)
  const getKitchenAssignmentsForDate = (date: Date) => {
    if (!scheduleDetails?.shiftAssignments) return []
    const dateStr = formatDateLocal(date)
    return scheduleDetails.shiftAssignments.filter((a: any) => {
      const assignmentDate = a.shiftDate.split('T')[0]
      if (assignmentDate !== dateStr) return false
      // Check if this worker is kitchen staff
      const categoryName = a.user?.jobCategory?.name?.toLowerCase() || ''
      const categoryNameHe = a.user?.jobCategory?.nameHe?.toLowerCase() || ''
      return kitchenCategories.some(kitchen =>
        categoryName.includes(kitchen) || categoryNameHe.includes(kitchen)
      )
    })
  }

  // Get assignment for a specific kitchen worker on a specific date
  const getKitchenWorkerAssignment = (userId: string, date: Date) => {
    if (!scheduleDetails?.shiftAssignments) return null
    const dateStr = formatDateLocal(date)
    return scheduleDetails.shiftAssignments.find((a: any) => {
      const assignmentDate = a.shiftDate.split('T')[0]
      return assignmentDate === dateStr && a.userId === userId
    }) || null
  }

  // Check if an employee submitted availability for a specific shift (optimized)
  const hasAvailability = (userId: string, date: Date, shiftType: string) => {
    const dateStr = formatDateLocal(date)
    const key = `${dateStr}_${shiftType}`
    const employeesWithAvailability = availabilityMap.get(key)
    return employeesWithAvailability?.has(userId) || false
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
            <div className="mt-1 flex flex-col items-center gap-1">
              <Badge variant={currentSchedule.status === 'PUBLISHED' ? 'success' : 'secondary'}>
                {currentSchedule.status === 'PUBLISHED' ? 'פורסם' : 'טיוטה'}
              </Badge>
              {currentSchedule.status === 'PUBLISHED' && (
                <span className="text-xs text-muted-foreground">שינויים ישלחו התראה לעובדים</span>
              )}
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


      {/* Schedule Grid */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : currentSchedule ? (
        <>
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
                          'p-4 text-center font-medium min-w-[120px]',
                          isWeekend(date, weekendDays) && 'bg-blue-100 dark:bg-blue-950'
                        )}
                      >
                        <div className="text-lg">{getDayLetter(date)}</div>
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
                        const isClosed = isShiftClosed(date, shift.value, closedPeriods)
                        const assignments = getAssignmentsForDateAndShift(date, shift.value)
                        const template = getShiftTemplateByType(shift.value)
                        return (
                          <td
                            key={date.toISOString()}
                            className={cn(
                              'p-4 text-center align-top',
                              isWeekend(date, weekendDays) && 'bg-blue-100 dark:bg-blue-950',
                              isClosed && 'bg-muted opacity-50'
                            )}
                          >
                            {isClosed ? (
                              <div className="text-xs text-muted-foreground py-2">סגור</div>
                            ) : (
                              <div className="space-y-1 min-w-[180px]">
                                {assignments.map((a: any) => {
                                  const hasActualTimes = a.actualStartTime || a.actualEndTime || a.actualHours
                                  const scheduledStart = a.shiftTemplate?.startTime || ''
                                  const scheduledEnd = a.shiftTemplate?.endTime || ''
                                  const displayStart = a.actualStartTime || scheduledStart
                                  const displayEnd = a.actualEndTime || scheduledEnd
                                  const displayHours = a.actualHours || calculateHoursFromTimes(scheduledStart, scheduledEnd)
                                  
                                  return (
                                    <div
                                      key={a.id}
                                      className="text-sm p-2 bg-muted rounded group"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">
                                          {a.user.firstName} {a.user.lastName[0]}.
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => openEditTimesDialog(a)}
                                            title="עריכת זמנים"
                                          >
                                            <Clock className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => deleteAssignmentMutation.mutate(a.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      {/* Always show times - either actual or scheduled */}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        <span className={cn(
                                          hasActualTimes && a.actualStartTime && a.actualStartTime !== scheduledStart && 'text-amber-600 font-semibold'
                                        )}>
                                          {displayStart}
                                        </span>
                                        {' - '}
                                        <span className={cn(
                                          hasActualTimes && a.actualEndTime && a.actualEndTime !== scheduledEnd && 'text-amber-600 font-semibold'
                                        )}>
                                          {displayEnd}
                                        </span>
                                        {displayHours > 0 && (
                                          <span className="mr-1">
                                            ({displayHours.toFixed(1)}ש)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                {template && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-8 text-xs"
                                    onClick={() => openShiftDialog(date, shift.value)}
                                  >
                                    <Plus className="h-3 w-3 ml-1" />
                                    הוסף עובדים
                                  </Button>
                                )}
                              </div>
                            )}
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

        {/* Kitchen Staff Table (Cooks & Sushi) */}
        {kitchenStaff.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                🍳 טבחים וסושימנים
              </CardTitle>
              <CardDescription>
                שעות עבודה של צוות מטבח לשבוע זה
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-3 text-right font-medium min-w-[120px]">עובד</th>
                      {weekDates.map((date) => (
                        <th
                          key={date.toISOString()}
                          className={cn(
                            'p-3 text-center font-medium min-w-[100px]',
                            isWeekend(date, weekendDays) && 'bg-orange-50 dark:bg-orange-950'
                          )}
                        >
                          <div className="text-sm">{getDayLetter(date)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatShortDate(date)}
                          </div>
                        </th>
                      ))}
                      <th className="p-3 text-center font-medium min-w-[80px]">סה״כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kitchenStaff.map((worker) => {
                      let weekTotalHours = 0
                      return (
                        <tr key={worker.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div className="font-medium text-sm">
                              {worker.firstName} {worker.lastName?.[0] || ''}.
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {worker.jobCategory?.nameHe || worker.jobCategory?.name || 'מטבח'}
                            </div>
                          </td>
                          {weekDates.map((date) => {
                            const assignment = getKitchenWorkerAssignment(worker.id, date)
                            if (assignment) {
                              const scheduledStart = assignment.shiftTemplate?.startTime || ''
                              const scheduledEnd = assignment.shiftTemplate?.endTime || ''
                              const displayStart = assignment.actualStartTime || scheduledStart
                              const displayEnd = assignment.actualEndTime || scheduledEnd
                              const hours = assignment.actualHours || calculateHoursFromTimes(displayStart, displayEnd)
                              weekTotalHours += hours || 0
                              return (
                                <td
                                  key={date.toISOString()}
                                  className={cn(
                                    'p-2 text-center align-middle',
                                    isWeekend(date, weekendDays) && 'bg-orange-50 dark:bg-orange-950'
                                  )}
                                >
                                  <div
                                    className="text-xs p-1.5 bg-orange-100 dark:bg-orange-900/40 rounded cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
                                    onClick={() => openEditTimesDialog(assignment)}
                                    title="לחץ לעריכת זמנים"
                                  >
                                    <div className="font-medium text-orange-800 dark:text-orange-200">
                                      {displayStart && displayEnd ? `${displayStart}-${displayEnd}` : '—'}
                                    </div>
                                    {hours > 0 && (
                                      <div className="text-orange-600 dark:text-orange-300 mt-0.5">
                                        {hours.toFixed(1)}ש׳
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )
                            }
                            return (
                              <td
                                key={date.toISOString()}
                                className={cn(
                                  'p-2 text-center align-middle text-muted-foreground text-xs',
                                  isWeekend(date, weekendDays) && 'bg-orange-50 dark:bg-orange-950'
                                )}
                              >
                                —
                              </td>
                            )
                          })}
                          <td className="p-3 text-center">
                            <div className="font-bold text-sm">
                              {weekTotalHours.toFixed(1)}ש׳
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        </>
      ) : null}

      {/* Worker Selection Dialog */}
      <Dialog open={!!selectedShift} onOpenChange={(open) => !open && setSelectedShift(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>בחר עובדים למשמרת</DialogTitle>
            <DialogDescription>
              {selectedShift && (
                <>
                  {getDayName(selectedShift.date)} - {formatShortDate(selectedShift.date)}
                  <br />
                  {SHIFT_TYPES.find((s) => s.value === selectedShift.shiftType)?.label}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {/* Workers who submitted availability */}
            {selectedShift && (() => {
              const sortedEmployees = getEmployeesForShift(selectedShift.date, selectedShift.shiftType)
              const withAvailability = sortedEmployees.filter((emp) => 
                hasAvailability(emp.id, selectedShift.date, selectedShift.shiftType)
              )
              const withoutAvailability = sortedEmployees.filter((emp) => 
                !hasAvailability(emp.id, selectedShift.date, selectedShift.shiftType)
              )

              return (
                <>
                  {withAvailability.length > 0 && (
                    <>
                      <div className="px-3 py-2 mb-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 rounded-lg border-2 border-green-400 dark:border-green-600">
                        <div className="text-sm font-bold text-green-800 dark:text-green-200 flex items-center gap-2">
                          <span className="text-xl">✓</span>
                          ביקשו משמרת זו ({withAvailability.length})
                        </div>
                      </div>
                      <div className="space-y-2 mb-6">
                        {withAvailability.map((emp) => {
                          const isAssigned = scheduleDetails?.shiftAssignments?.some(
                            (a: any) =>
                              a.userId === emp.id &&
                              formatDateLocal(new Date(a.shiftDate)) === formatDateLocal(selectedShift.date) &&
                              a.shiftTemplate.shiftType === selectedShift.shiftType
                          )
                          
                          return (
                            <div
                              key={emp.id}
                              className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all shadow-sm',
                                selectedWorkers.includes(emp.id)
                                  ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 border-green-600 shadow-md ring-2 ring-green-200'
                                  : 'bg-green-50 dark:bg-green-950/50 border-green-400 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40 hover:border-green-500 hover:shadow',
                                isAssigned && 'opacity-50 cursor-not-allowed'
                              )}
                              onClick={() => !isAssigned && toggleWorker(emp.id)}
                            >
                              <Checkbox
                                checked={selectedWorkers.includes(emp.id)}
                                disabled={isAssigned}
                                className="border-2 border-green-700 data-[state=checked]:bg-green-600 pointer-events-none"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-base text-green-900 dark:text-green-100">
                                    {emp.firstName} {emp.lastName}
                                  </span>
                                  <span className="text-lg text-green-600 dark:text-green-400">✓</span>
                                </div>
                                {isAssigned && (
                                  <span className="text-xs text-muted-foreground">כבר משובץ</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {withoutAvailability.length > 0 && (
                    <>
                      {withAvailability.length > 0 && (
                        <div className="px-3 py-2 mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400 border-t-2 pt-4">
                          עובדים נוספים ({withoutAvailability.length})
                        </div>
                      )}
                      <div className="space-y-2">
                        {withoutAvailability.map((emp) => {
                          const isAssigned = scheduleDetails?.shiftAssignments?.some(
                            (a: any) =>
                              a.userId === emp.id &&
                              formatDateLocal(new Date(a.shiftDate)) === formatDateLocal(selectedShift.date) &&
                              a.shiftTemplate.shiftType === selectedShift.shiftType
                          )
                          
                          return (
                            <div
                              key={emp.id}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors bg-background',
                                selectedWorkers.includes(emp.id)
                                  ? 'bg-primary/10 border-primary shadow-sm'
                                  : 'hover:bg-muted border-muted-foreground/20',
                                isAssigned && 'opacity-50 cursor-not-allowed'
                              )}
                              onClick={() => !isAssigned && toggleWorker(emp.id)}
                            >
                              <Checkbox
                                checked={selectedWorkers.includes(emp.id)}
                                disabled={isAssigned}
                                className="pointer-events-none"
                              />
                              <div className="flex-1">
                                <span className="font-medium">
                                  {emp.firstName} {emp.lastName}
                                </span>
                                {isAssigned && (
                                  <div className="text-xs text-muted-foreground">כבר משובץ</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedShift(null)
                setSelectedWorkers([])
              }}
            >
              ביטול
            </Button>
            <Button
              onClick={handleAddAssignments}
              disabled={selectedWorkers.length === 0 || createAssignmentMutation.isPending}
            >
              {createAssignmentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  משבץ...
                </>
              ) : (
                <>
                  שבץ {selectedWorkers.length} עובדים
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Actual Times Dialog */}
      <Dialog open={!!editingAssignment} onOpenChange={(open) => !open && setEditingAssignment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              עריכת זמני נוכחות
            </DialogTitle>
            <DialogDescription>
              {editingAssignment && (
                <>
                  {editingAssignment.user?.firstName} {editingAssignment.user?.lastName}
                  <br />
                  <span className="text-muted-foreground">
                    משמרת מתוכננת: {editingAssignment.shiftTemplate?.startTime} - {editingAssignment.shiftTemplate?.endTime}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שעת כניסה בפועל</Label>
                <Input
                  type="time"
                  value={actualStartTime}
                  onChange={(e) => setActualStartTime(e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
              <div className="space-y-2">
                <Label>שעת יציאה בפועל</Label>
                <Input
                  type="time"
                  value={actualEndTime}
                  onChange={(e) => setActualEndTime(e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>שעות בפועל (או הזנה ידנית)</Label>
              <Input
                type="number"
                value={actualHours || (actualStartTime && actualEndTime 
                  ? calculateHoursFromTimes(actualStartTime, actualEndTime).toString() 
                  : '')}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder="הזן מספר שעות"
                min="0"
                step="0.5"
              />
              <p className="text-xs text-muted-foreground">
                אם מוזנות שעות כניסה ויציאה, השעות יחושבו אוטומטית. ניתן לדרוס ידנית.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingAssignment(null)
                setActualStartTime('')
                setActualEndTime('')
                setActualHours('')
              }}
            >
              ביטול
            </Button>
            <Button
              onClick={handleSaveActualTimes}
              disabled={updateActualTimesMutation.isPending}
            >
              {updateActualTimesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  שומר...
                </>
              ) : (
                'שמור'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
