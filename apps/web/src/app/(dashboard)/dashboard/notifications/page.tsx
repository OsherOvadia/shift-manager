'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { Loader2, Bell, Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<any[]>('/notifications', accessToken!),
    enabled: !!accessToken,
  })

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SCHEDULE_PUBLISHED':
        return '📅'
      case 'SHIFT_APPROVED':
        return '✅'
      case 'SHIFT_REJECTED':
        return '❌'
      case 'SHIFT_CHANGED':
        return '🔄'
      case 'SUBMISSION_REMINDER':
        return '⏰'
      case 'RULE_VIOLATION':
        return '⚠️'
      default:
        return '📢'
    }
  }

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">התראות</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} התראות שלא נקראו` : 'אין התראות חדשות'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCheck className="h-4 w-4 ml-2" />
                סמן הכל כנקרא
              </>
            )}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'transition-colors',
                !notification.isRead && 'border-primary bg-primary/5'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                    {!notification.isRead && (
                      <Badge variant="default" className="mr-2">חדש</Badge>
                    )}
                  </div>
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsReadMutation.mutate(notification.id)}
                      disabled={markAsReadMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {formatDate(notification.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>{notification.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">אין התראות</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
