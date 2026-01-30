'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { getWeekStartDate, getWeekDates, getDayName, formatShortDate } from '@/lib/utils'
import { Loader2, ChevronRight, ChevronLeft, Check, X, AlertTriangle } from 'lucide-react'

const SHIFT_TYPES = [
  { value: 'MORNING', label: 'בוקר' },
  { value: 'EVENING', label: 'ערב' },
  { value: 'EVENING_CLOSE', label: 'ערב + סגירה' },
]

export default function ManageAvailabilityPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  const [weekOffset, setWeekOffset] = useState(1)

  const currentWeekStart = getWeekStartDate(new Date())
  const targetWeekStart = new Date(currentWeekStart)
  targetWeekStart.setDate(targetWeekStart.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(targetWeekStart)

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['submissions', targetWeekStart.toISOString()],
    queryFn: () =>
      api.get<any[]>(
        `/availability/submissions?weekStartDate=${targetWeekStart.toISOString()}`,
        accessToken!
      ),
    enabled: !!accessToken,
  })

  const { data: missingEmployees, isLoading: missingLoading } = useQuery({
    queryKey: ['missing-submissions', targetWeekStart.toISOString()],
    queryFn: () =>
      api.get<any[]>(
        `/availability/missing?weekStartDate=${targetWeekStart.toISOString()}`,
        accessToken!
      ),
    enabled: !!accessToken,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/availability/${id}/status`, { status }, accessToken!),
    onSuccess: () => {
      toast({
        title: 'הסטטוס עודכן בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  const isLoading = submissionsLoading || missingLoading

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">ממתין</Badge>
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

  const getEmploymentLabel = (type: string) => {
    return type === 'FULL_TIME' ? 'משרה מלאה' : 'משרה חלקית'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ניהול זמינויות</h1>
        <p className="text-muted-foreground">
          צפה ואשר את הזמינויות שהוגשו על ידי העובדים
        </p>
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
        <span className="font-medium">
          {formatShortDate(weekDates[0])} - {formatShortDate(weekDates[6])}
        </span>
        <Button
          variant="outline"
          onClick={() => setWeekOffset((prev) => prev + 1)}
        >
          שבוע הבא
          <ChevronLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">הוגשו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submissions?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ממתינים לאישור</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions?.filter((s) => s.status === 'PENDING').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">טרם הגישו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {missingEmployees?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              ממתינים ({submissions?.filter((s) => s.status === 'PENDING').length || 0})
            </TabsTrigger>
            <TabsTrigger value="all">כל ההגשות</TabsTrigger>
            <TabsTrigger value="missing">
              חסרים ({missingEmployees?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {submissions
              ?.filter((s) => s.status === 'PENDING')
              .map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  weekDates={weekDates}
                  onApprove={() =>
                    updateStatusMutation.mutate({
                      id: submission.id,
                      status: 'APPROVED',
                    })
                  }
                  onReject={() =>
                    updateStatusMutation.mutate({
                      id: submission.id,
                      status: 'REJECTED',
                    })
                  }
                  isUpdating={updateStatusMutation.isPending}
                />
              ))}
            {submissions?.filter((s) => s.status === 'PENDING').length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  אין הגשות ממתינות
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {submissions?.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                weekDates={weekDates}
                onApprove={() =>
                  updateStatusMutation.mutate({
                    id: submission.id,
                    status: 'APPROVED',
                  })
                }
                onReject={() =>
                  updateStatusMutation.mutate({
                    id: submission.id,
                    status: 'REJECTED',
                  })
                }
                isUpdating={updateStatusMutation.isPending}
              />
            ))}
          </TabsContent>

          <TabsContent value="missing">
            {missingEmployees && missingEmployees.length > 0 ? (
              <Card>
                <CardContent className="py-4">
                  <div className="space-y-2">
                    {missingEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {employee.email}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {getEmploymentLabel(employee.employmentType)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  כל העובדים הגישו זמינות
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function SubmissionCard({
  submission,
  weekDates,
  onApprove,
  onReject,
  isUpdating,
}: {
  submission: any
  weekDates: Date[]
  onApprove: () => void
  onReject: () => void
  isUpdating: boolean
}) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">ממתין</Badge>
      case 'APPROVED':
        return <Badge variant="success">אושר</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">נדחה</Badge>
      default:
        return null
    }
  }

  const getSlotsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return submission.slots?.filter(
      (s: any) => new Date(s.shiftDate).toISOString().split('T')[0] === dateStr
    ) || []
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {submission.user.firstName} {submission.user.lastName}
            </CardTitle>
            <CardDescription>
              {submission.user.employmentType === 'FULL_TIME' ? 'משרה מלאה' : 'משרה חלקית'} •{' '}
              {submission.slots?.length || 0} משמרות
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(submission.status)}
            {submission.status === 'PENDING' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReject}
                  disabled={isUpdating}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={onApprove} disabled={isUpdating}>
                  <Check className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-sm">
          {weekDates.map((date) => {
            const slots = getSlotsForDate(date)
            return (
              <div key={date.toISOString()} className="space-y-1">
                <div className="font-medium text-xs">{getDayName(date).slice(0, 3)}</div>
                {slots.length > 0 ? (
                  slots.map((slot: any) => (
                    <Badge
                      key={slot.id}
                      variant="secondary"
                      className="text-xs w-full justify-center"
                    >
                      {SHIFT_TYPES.find((s) => s.value === slot.shiftType)?.label || slot.shiftType}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
