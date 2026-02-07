'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useAuthStore, isManager } from '@/lib/auth'
import { getWeekStartDate, getWeekDates, getDayName, formatShortDate, isWeekend } from '@/lib/utils'
import { Loader2, ChevronRight, ChevronLeft, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const ALL_SHIFT_TYPES = [
  { value: 'MORNING', label: 'בוקר', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'EVENING', label: 'ערב', color: 'bg-blue-100 text-blue-800' },
  { value: 'EVENING_CLOSE', label: 'ערב + סגירה', color: 'bg-purple-100 text-purple-800' },
]

export default function SchedulePage() {
  const { accessToken, user } = useAuthStore()
  const isManagerRole = isManager()
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekendDays, setWeekendDays] = useState<number[]>([4, 5, 6]) // Thu, Fri, Sat

  const currentWeekStart = getWeekStartDate(new Date())
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

  const SHIFT_TYPES = ALL_SHIFT_TYPES.filter(st =>
    (settings?.enabledShiftTypes || ['MORNING', 'EVENING']).includes(st.value)
  )

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const data = await api.get<any[]>('/schedules', accessToken!)
      console.log('[Schedules] All schedules loaded:', data?.length, 'schedules')
      console.log('[Schedules] Week dates:', data?.map((s: any) => s.weekStartDate))
      return data
    },
    enabled: !!accessToken,
  })

  // Find schedule for current week
  const currentSchedule = schedules?.find((s) => {
    const scheduleDate = new Date(s.weekStartDate)
    return scheduleDate.getTime() === targetWeekStart.getTime()
  })

  console.log('[CurrentSchedule] Selected schedule for week:', targetWeekStart.toISOString(), currentSchedule ? `Found (ID: ${currentSchedule.id})` : 'NOT FOUND')

  const { data: scheduleDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['schedule', currentSchedule?.id],
    queryFn: async () => {
      const data = await api.get<any>(`/schedules/${currentSchedule.id}`, accessToken!)
      console.log('[ScheduleDetails] API Response:', {
        scheduleId: currentSchedule?.id,
        weekStart: currentSchedule?.weekStartDate,
        totalAssignments: data?.shiftAssignments?.length || 0,
        hasData: !!data,
        sampleAssignments: data?.shiftAssignments?.slice(0, 3).map((a: any) => ({
          user: `${a.user.firstName} ${a.user.lastName}`,
          date: a.shiftDate,
          category: a.user.jobCategory?.name,
        })),
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbe505a0-ffe1-4fcf-8c1f-fb1a1a44ef4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'schedule/page.tsx:75',message:'All assignment user IDs and categories',data:{allUserIds:data?.shiftAssignments?.map((a:any)=>({userId:a.userId,name:`${a.user.firstName} ${a.user.lastName}`,category:a.user.jobCategory?.name})),totalAssignments:data?.shiftAssignments?.length},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      
      return data
    },
    enabled: !!currentSchedule?.id && !!accessToken,
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0, // Don't cache
  })

  // Fetch employees for kitchen staff section
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<any[]>('/users/employees', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  })

  const kitchenCategories = ['cook', 'טבח', 'chef', 'sushiman', 'סושימן', 'sushi', 'kitchen', 'מטבח']

  const kitchenStaff = useMemo(() => {
    if (!employees) return []
    
    console.log('[KitchenFilter] Total employees:', employees.length)
    
    const filtered = employees.filter((emp: any) => {
      const categoryName = emp.jobCategory?.name?.toLowerCase() || ''
      const categoryNameHe = emp.jobCategory?.nameHe?.toLowerCase() || ''
      
      console.log(`[KitchenFilter] ${emp.firstName} ${emp.lastName}:`, {
        categoryName,
        categoryNameHe,
        jobCategory: emp.jobCategory,
      })
      
      const isKitchen = kitchenCategories.some(kitchen =>
        categoryName.includes(kitchen) || categoryNameHe.includes(kitchen)
      )
      
      if (isKitchen) {
        console.log(`[KitchenFilter] ✅ ${emp.firstName} identified as kitchen staff`)
      }
      
      return isKitchen
    })
    
    console.log('[KitchenFilter] Found kitchen staff:', filtered.length, filtered.map((k: any) => k.firstName))
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbe505a0-ffe1-4fcf-8c1f-fb1a1a44ef4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'schedule/page.tsx:106',message:'Kitchen staff identified from employees',data:{kitchenStaffIds:filtered.map((k:any)=>({userId:k.id,name:`${k.firstName} ${k.lastName}`,category:k.jobCategory?.name})),count:filtered.length},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    return filtered
  }, [employees])

  const getKitchenWorkerAssignment = (userId: string, date: Date) => {
    if (!scheduleDetails?.shiftAssignments) {
      console.log('[KitchenAssignment] No shift assignments in scheduleDetails')
      return null
    }
    
    // #region agent log
    if (date.getDate() === 4) {
      fetch('http://127.0.0.1:7242/ingest/bbe505a0-ffe1-4fcf-8c1f-fb1a1a44ef4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'schedule/page.tsx:124',message:'Kitchen assignment lookup',data:{searchingForUserId:userId,dateSearching:date.toISOString().split('T')[0],totalAssignmentsInSchedule:scheduleDetails.shiftAssignments.length,allUserIdsInAssignments:scheduleDetails.shiftAssignments.map((a:any)=>a.userId).slice(0,10)},timestamp:Date.now(),hypothesisId:'B,D'})}).catch(()=>{});
    }
    // #endregion
    
    const dateStr = date.toISOString().split('T')[0]
    const userAssignments = scheduleDetails.shiftAssignments.filter((a: any) => a.userId === userId)
    
    console.log(`[KitchenAssignment] Looking for user ${userId} on ${dateStr}, found ${userAssignments.length} total assignments for user`)
    
    const assignment = scheduleDetails.shiftAssignments.find((a: any) => {
      const assignmentDate = new Date(a.shiftDate).toISOString().split('T')[0]
      return assignmentDate === dateStr && a.userId === userId
    })
    
    if (assignment) {
      console.log(`[KitchenAssignment] ✅ Found assignment for ${dateStr}:`, {
        worker: `${assignment.user.firstName} ${assignment.user.lastName}`,
        start: assignment.actualStartTime || assignment.shiftTemplate?.startTime,
        end: assignment.actualEndTime || assignment.shiftTemplate?.endTime,
      })
    }
    
    return assignment || null
  }

  const calculateHoursFromTimes = (start: string, end: string): number => {
    if (!start || !end) return 0
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    let hours = (endH + endM / 60) - (startH + startM / 60)
    if (hours < 0) hours += 24
    return Math.round(hours * 100) / 100
  }

  const isLoading = schedulesLoading || detailsLoading

  const getAssignmentsForDateAndShift = (date: Date, shiftType: string) => {
    if (!scheduleDetails?.shiftAssignments) return []
    const dateStr = date.toISOString().split('T')[0]
    
    // Filter to exclude kitchen staff (they appear in separate table)
    const kitchenCategories = ['cook', 'טבח', 'chef', 'sushi', 'סוש', 'kitchen', 'מטבח', 'dishwash', 'כלים']
    
    return scheduleDetails.shiftAssignments.filter((a: any) => {
      const assignmentDate = new Date(a.shiftDate).toISOString().split('T')[0]
      if (assignmentDate !== dateStr || a.shiftTemplate.shiftType !== shiftType) return false
      
      // Exclude kitchen staff from main waiter table
      const categoryName = a.user?.jobCategory?.name?.toLowerCase() || ''
      const categoryNameHe = a.user?.jobCategory?.nameHe?.toLowerCase() || ''
      const isKitchen = kitchenCategories.some(kitchen =>
        categoryName.includes(kitchen) || categoryNameHe.includes(kitchen)
      )
      
      return !isKitchen
    })
  }

  const getMyAssignments = () => {
    if (!scheduleDetails?.shiftAssignments) return []
    return scheduleDetails.shiftAssignments.filter((a: any) => a.userId === user?.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">לוח משמרות</h1>
          <p className="text-muted-foreground">
            {currentSchedule?.status === 'PUBLISHED'
              ? 'לוח המשמרות השבועי'
              : 'טרם פורסם לוח משמרות לשבוע זה'}
          </p>
        </div>
        {isManagerRole && (
          <Button asChild>
            <Link href={`/dashboard/manage-schedule?week=${targetWeekStart.toISOString()}`}>
              <Plus className="h-4 w-4 ml-2" />
              ערוך לוח
            </Link>
          </Button>
        )}
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setWeekOffset((prev) => prev - 1)}
          disabled={weekOffset <= -4}
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
          disabled={weekOffset >= 4}
        >
          שבוע הבא
          <ChevronLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>

      {/* My Shifts Summary (for employees) */}
      {!isManagerRole && scheduleDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">המשמרות שלי השבוע</CardTitle>
          </CardHeader>
          <CardContent>
            {getMyAssignments().length > 0 ? (
              <div className="space-y-2">
                {getMyAssignments().map((assignment: any) => {
                  const shiftType = SHIFT_TYPES.find((s) => s.value === assignment.shiftTemplate.shiftType)
                  return (
                    <div key={assignment.id} className="flex items-center gap-4 p-2 bg-muted rounded-lg">
                      <div className="font-medium">
                        {getDayName(assignment.shiftDate)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatShortDate(assignment.shiftDate)}
                      </div>
                      <Badge className={shiftType?.color}>
                        {shiftType?.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">אין משמרות משובצות לשבוע זה</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schedule Grid */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
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
                          'p-4 text-center font-medium min-w-[140px]',
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
                        return (
                          <td
                            key={date.toISOString()}
                            className={cn(
                              'p-4 text-center align-top',
                              isWeekend(date, weekendDays) && 'bg-blue-100 dark:bg-blue-950'
                            )}
                          >
                            {assignments.length > 0 ? (
                              <div className="space-y-1">
                                {assignments.map((a: any) => {
                                  const scheduledStart = a.shiftTemplate?.startTime || ''
                                  const scheduledEnd = a.shiftTemplate?.endTime || ''
                                  const displayStart = a.actualStartTime || scheduledStart
                                  const displayEnd = a.actualEndTime || scheduledEnd
                                  const displayHours = a.actualHours || calculateHoursFromTimes(displayStart, displayEnd)
                                  
                                  return (
                                    <div
                                      key={a.id}
                                      className={cn(
                                        'text-sm p-2 rounded',
                                        a.userId === user?.id
                                          ? 'bg-primary text-primary-foreground font-medium'
                                          : 'bg-muted'
                                      )}
                                    >
                                      <div className="font-medium">
                                        {a.user.firstName} {a.user.lastName[0]}.
                                      </div>
                                      {(displayStart || displayEnd) && (
                                        <div className={cn(
                                          "text-xs mt-0.5",
                                          a.actualStartTime ? "font-semibold text-green-700 dark:text-green-400" : "opacity-70"
                                        )}>
                                          {displayStart}-{displayEnd}
                                          {displayHours > 0 && ` (${displayHours.toFixed(1)}ש)`}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
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

        {/* Kitchen Staff Table */}
        {kitchenStaff.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                🍳 טבחים וסושימנים
              </CardTitle>
              <CardDescription>
                שעות עבודה של צוות מטבח
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
                          <div className="text-sm">{getDayName(date)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatShortDate(date)}
                          </div>
                        </th>
                      ))}
                      <th className="p-3 text-center font-medium min-w-[80px]">סה״כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kitchenStaff.map((worker: any) => {
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
                                  <div className="text-xs p-1.5 bg-orange-100 dark:bg-orange-900/40 rounded">
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
      )}
    </div>
  )
}
