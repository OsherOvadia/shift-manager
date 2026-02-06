'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { getWeekStartDate, getWeekDates, getDayName, formatShortDate, isWeekend, formatDateLocal, parseLocalDate, isShiftClosed } from '@/lib/utils'
import { Loader2, ChevronRight, ChevronLeft, Save, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const SHIFT_TYPES = [
  { value: 'MORNING', label: 'בוקר', time: '11:00-18:00' },
  { value: 'EVENING', label: 'ערב', time: '18:00-22:00' },
  { value: 'EVENING_CLOSE', label: 'ערב + סגירה', time: '18:00-00:00' },
]

interface AvailabilitySlot {
  shiftDate: string
  shiftType: string
  preferenceRank?: number
}

export default function AvailabilityPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { accessToken, user } = useAuthStore()
  const [weekOffset, setWeekOffset] = useState(1) // Start with next week
  const [selectedSlots, setSelectedSlots] = useState<Map<string, AvailabilitySlot>>(new Map())
  const [weekendDays, setWeekendDays] = useState<number[]>([4, 5, 6]) // Thu, Fri, Sat
  const [closedPeriods, setClosedPeriods] = useState<Array<{ day: number; shiftTypes: string[] }>>([])
  
  const currentWeekStart = getWeekStartDate(new Date())
  const targetWeekStart = new Date(currentWeekStart)
  targetWeekStart.setDate(targetWeekStart.getDate() + weekOffset * 7)
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
      console.log('📅 Loaded weekend days from settings:', settings.weekendDays)
      setWeekendDays(settings.weekendDays)
    }
    if (settings?.closedPeriods) {
      console.log('🚫 Loaded closed periods from settings:', settings.closedPeriods)
      setClosedPeriods(settings.closedPeriods)
    }
  }, [settings])

  // Debug: Log current weekend days
  useEffect(() => {
    console.log('🔍 Current weekendDays state:', weekendDays)
  }, [weekendDays])

  const { data: existingSubmission, isLoading } = useQuery({
    queryKey: ['availability', targetWeekStart.toISOString()],
    queryFn: () => api.get<any>(`/availability/week/${targetWeekStart.toISOString()}`, accessToken!),
    enabled: !!accessToken,
  })

  // Load existing submission into state
  useEffect(() => {
    if (existingSubmission?.slots) {
      const slots = new Map<string, AvailabilitySlot>()
      existingSubmission.slots.forEach((slot: any) => {
        const key = `${slot.shiftDate}_${slot.shiftType}`
        slots.set(key, {
          shiftDate: slot.shiftDate,
          shiftType: slot.shiftType,
          preferenceRank: slot.preferenceRank,
        })
      })
      setSelectedSlots(slots)
    } else {
      setSelectedSlots(new Map())
    }
  }, [existingSubmission])

  const submitMutation = useMutation({
    mutationFn: (slots: AvailabilitySlot[]) =>
      api.post('/availability', {
        weekStartDate: targetWeekStart.toISOString(),
        slots,
      }, accessToken!),
    onSuccess: async () => {
      toast({
        title: 'הזמינות נשמרה בהצלחה',
        description: 'הזמינות שלך הוגשה לאישור המנהל',
      })
      // Invalidate and refetch all availability-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: ['my-availability'] }),
        queryClient.invalidateQueries({ queryKey: ['all-availability'] }),
      ])
      // Force immediate refetch of current query
      queryClient.refetchQueries({ queryKey: ['availability', targetWeekStart.toISOString()] })
    },
    onError: (error: any) => {
      const violations = error.data?.violations
      if (violations) {
        toast({
          variant: 'destructive',
          title: 'הזמינות אינה תקינה',
          description: violations.map((v: any) => v.message).join('\n'),
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'שגיאה',
          description: error.message,
        })
      }
    },
  })

  const toggleSlot = (date: Date, shiftType: string) => {
    const dateStr = formatDateLocal(date) // Use local date format
    const key = `${dateStr}_${shiftType}`
    
    setSelectedSlots((prev) => {
      const next = new Map(prev)
      
      if (next.has(key)) {
        // Remove this slot
        next.delete(key)
      } else {
        // Add the slot
        next.set(key, {
          shiftDate: dateStr,
          shiftType,
          preferenceRank: 1,
        })
        
        // Smart logic: If selecting EVENING_CLOSE, remove EVENING (they're mutually exclusive)
        // If selecting EVENING, remove EVENING_CLOSE (they're mutually exclusive)
        if (shiftType === 'EVENING_CLOSE') {
          const eveningKey = `${dateStr}_EVENING`
          next.delete(eveningKey)
        } else if (shiftType === 'EVENING') {
          const eveningCloseKey = `${dateStr}_EVENING_CLOSE`
          next.delete(eveningCloseKey)
        }
      }
      return next
    })
  }

  const isSlotSelected = (date: Date, shiftType: string) => {
    const dateStr = formatDateLocal(date) // Use local date format
    const key = `${dateStr}_${shiftType}`
    return selectedSlots.has(key)
  }

  const handleSubmit = () => {
    const slots = Array.from(selectedSlots.values())
    submitMutation.mutate(slots)
  }

  const getMinShifts = () => {
    return user?.employmentType === 'FULL_TIME' ? 5 : 3
  }

  const getMinWeekendShifts = () => {
    return user?.employmentType === 'FULL_TIME' ? 2 : 1
  }

  const weekendSlots = Array.from(selectedSlots.values()).filter((slot) => {
    const date = parseLocalDate(slot.shiftDate) // Parse as local date
    const dayOfWeek = date.getDay()
    const isWeekendDay = isWeekend(date, weekendDays)
    console.log('🗓️ Slot date:', slot.shiftDate, 'Day:', dayOfWeek, 'Is weekend?', isWeekendDay, 'Weekend days:', weekendDays)
    return isWeekendDay
  }).length

  const isValid = selectedSlots.size >= getMinShifts() && weekendSlots >= getMinWeekendShifts()

  const getStatusBadge = () => {
    if (!existingSubmission) return null
    switch (existingSubmission.status) {
      case 'PENDING':
        return <Badge variant="warning">ממתין לאישור</Badge>
      case 'APPROVED':
        return <Badge variant="success">אושר</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">נדחה</Badge>
      case 'REQUIRES_CHANGES':
        return <Badge variant="warning">נדרשים שינויים</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">הגשת זמינות</h1>
          <p className="text-muted-foreground">
            סמן את המשמרות שאתה זמין לעבוד בהן
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setWeekOffset((prev) => prev - 1)}
          disabled={weekOffset <= 0}
        >
          <ChevronRight className="h-4 w-4 ml-2" />
          שבוע קודם
        </Button>
        <span className="font-medium">
          {formatShortDate(weekDates[0])} - {formatShortDate(weekDates[6])}
        </span>
        <Button
          variant="outline"
          onClick={() => setWeekOffset((prev) => prev + 1)}
          disabled={weekOffset >= 4}
        >
          שבוע הבא
          <ChevronLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>

      {/* Requirements Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className={cn(
                'h-4 w-4',
                selectedSlots.size >= getMinShifts() ? 'text-green-500' : 'text-yellow-500'
              )} />
              <span className="text-sm">
                משמרות: {selectedSlots.size} / {getMinShifts()} (מינימום)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className={cn(
                'h-4 w-4',
                weekendSlots >= getMinWeekendShifts() ? 'text-green-500' : 'text-yellow-500'
              )} />
              <span className="text-sm">
                סופ"ש: {weekendSlots} / {getMinWeekendShifts()} (מינימום)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Grid */}
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
                          'p-4 text-center font-medium min-w-[100px]',
                          isWeekend(date, weekendDays) && 'bg-blue-100 dark:bg-blue-950'
                        )}
                      >
                        <div className="text-foreground">{getDayName(date)}</div>
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
                        <div className="font-medium">{shift.label}</div>
                        <div className="text-sm text-muted-foreground">{shift.time}</div>
                      </td>
                      {weekDates.map((date) => {
                        const isClosed = isShiftClosed(date, shift.value, closedPeriods)
                        return (
                          <td
                            key={date.toISOString()}
                            className={cn(
                              'p-4 text-center',
                              isWeekend(date, weekendDays) && 'bg-blue-100 dark:bg-blue-950',
                              isClosed && 'bg-muted opacity-50'
                            )}
                          >
                            {isClosed ? (
                              <div className="text-xs text-muted-foreground">סגור</div>
                            ) : (
                              <Checkbox
                                checked={isSlotSelected(date, shift.value)}
                                onCheckedChange={() => toggleSlot(date, shift.value)}
                                className="h-6 w-6"
                              />
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

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitMutation.isPending}
          size="lg"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" />
              שמור והגש זמינות
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
