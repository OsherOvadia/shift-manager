'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useAuthStore, isManager } from '@/lib/auth'
import { getWeekStartDate, getWeekDates, getDayName, formatShortDate, isWeekend } from '@/lib/utils'
import { Loader2, ChevronRight, ChevronLeft, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const SHIFT_TYPES = [
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

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get<any[]>('/schedules', accessToken!),
    enabled: !!accessToken,
  })

  // Find schedule for current week
  const currentSchedule = schedules?.find((s) => {
    const scheduleDate = new Date(s.weekStartDate)
    return scheduleDate.getTime() === targetWeekStart.getTime()
  })

  const { data: scheduleDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['schedule', currentSchedule?.id],
    queryFn: () => api.get<any>(`/schedules/${currentSchedule.id}`, accessToken!),
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
                                {assignments.map((a: any) => (
                                  <div
                                    key={a.id}
                                    className={cn(
                                      'text-sm p-1 rounded',
                                      a.userId === user?.id
                                        ? 'bg-primary text-primary-foreground font-medium'
                                        : 'bg-muted'
                                    )}
                                  >
                                    {a.user.firstName} {a.user.lastName[0]}.
                                  </div>
                                ))}
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
      )}
    </div>
  )
}
