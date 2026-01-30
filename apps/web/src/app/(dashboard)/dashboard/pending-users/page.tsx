'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Check, X, UserPlus, PartyPopper } from 'lucide-react'
import { 
  PageTransition, 
  StaggerContainer, 
  StaggerItem, 
  ScaleOnTap,
  GridSkeleton,
  motion,
  AnimatePresence,
  Confetti
} from '@/components/ui/animations'

export default function PendingUsersPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [approvalData, setApprovalData] = useState({
    jobCategoryId: '',
    hourlyWage: '',
    employmentType: 'FULL_TIME',
  })
  const [showConfetti, setShowConfetti] = useState(false)

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => api.get('/users/pending'),
  })

  const { data: jobCategories } = useQuery({
    queryKey: ['job-categories'],
    queryFn: () => api.get('/job-categories/active'),
  })

  const approveMutation = useMutation({
    mutationFn: (data: { userId: string; body: any }) =>
      api.post(`/users/${data.userId}/approve`, data.body),
    onSuccess: () => {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1000)
      toast({ 
        title: '🎉 המשתמש אושר בהצלחה!',
        description: 'העובד יכול להתחבר למערכת כעת'
      })
      queryClient.invalidateQueries({ queryKey: ['pending-users'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setApproveDialogOpen(false)
      setSelectedUser(null)
    },
    onError: () => {
      toast({ title: 'שגיאה באישור המשתמש', variant: 'destructive' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}/reject`),
    onSuccess: () => {
      toast({ title: 'הבקשה נדחתה' })
      queryClient.invalidateQueries({ queryKey: ['pending-users'] })
    },
    onError: () => {
      toast({ title: 'שגיאה בדחיית הבקשה', variant: 'destructive' })
    },
  })

  const handleApproveClick = (user: any) => {
    setSelectedUser(user)
    setApprovalData({
      jobCategoryId: user.jobCategory?.id || '',
      hourlyWage: '',
      employmentType: 'FULL_TIME',
    })
    setApproveDialogOpen(true)
  }

  const handleApprove = () => {
    if (!selectedUser) return
    approveMutation.mutate({
      userId: selectedUser.id,
      body: {
        ...(approvalData.jobCategoryId && { jobCategoryId: approvalData.jobCategoryId }),
        ...(approvalData.hourlyWage && { hourlyWage: parseFloat(approvalData.hourlyWage) }),
        employmentType: approvalData.employmentType,
      },
    })
  }

  return (
    <PageTransition>
      <Confetti trigger={showConfetti} />
      <div className="space-y-4 sm:space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-xl sm:text-2xl font-bold">בקשות הרשמה</h1>
          <p className="text-sm text-muted-foreground">אשר או דחה בקשות הרשמה של עובדים חדשים</p>
        </motion.div>

        {isLoading ? (
          <GridSkeleton count={3} />
        ) : pendingUsers?.length > 0 ? (
          <StaggerContainer className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {pendingUsers.map((user: any) => (
                <StaggerItem key={user.id}>
                  <motion.div
                    layout
                    exit={{ opacity: 0, x: -100, transition: { duration: 0.3 } }}
                    whileHover={{ scale: 1.01, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <motion.div 
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center"
                              animate={{ 
                                scale: [1, 1.1, 1],
                                rotate: [0, 5, -5, 0]
                              }}
                              transition={{ 
                                duration: 2,
                                repeat: Infinity,
                                repeatDelay: 3
                              }}
                            >
                              <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                            </motion.div>
                            <div>
                              <h3 className="font-medium text-base sm:text-lg">
                                {user.firstName} {user.lastName}
                              </h3>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                נרשם ב-{format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm', { locale: he })}
                              </p>
                              {user.jobCategory && (
                                <p className="text-xs mt-1">
                                  קטגוריה מבוקשת: <span className="font-medium">{user.jobCategory.nameHe}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 self-end sm:self-center">
                            <ScaleOnTap>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => rejectMutation.mutate(user.id)}
                                disabled={rejectMutation.isPending}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4 ml-1" />
                                דחה
                              </Button>
                            </ScaleOnTap>
                            <ScaleOnTap>
                              <Button
                                size="sm"
                                onClick={() => handleApproveClick(user)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="h-4 w-4 ml-1" />
                                אשר
                              </Button>
                            </ScaleOnTap>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </StaggerItem>
              ))}
            </AnimatePresence>
          </StaggerContainer>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Card>
              <CardContent className="py-12 text-center">
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                >
                  <PartyPopper className="h-12 w-12 mx-auto text-green-500 mb-4" />
                </motion.div>
                <h3 className="font-medium text-lg mb-2">אין בקשות הרשמה ממתינות</h3>
                <p className="text-sm text-muted-foreground">
                  כל בקשות ההרשמה טופלו 🎉
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>אישור עובד חדש</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>

              <div className="space-y-2">
                <Label>קטגוריית תפקיד</Label>
                <Select
                  value={approvalData.jobCategoryId}
                  onValueChange={(value) => setApprovalData({ ...approvalData, jobCategoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobCategories?.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nameHe}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>שכר לשעה (₪)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={approvalData.hourlyWage}
                  onChange={(e) => setApprovalData({ ...approvalData, hourlyWage: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>סוג העסקה</Label>
                <Select
                  value={approvalData.employmentType}
                  onValueChange={(value) => setApprovalData({ ...approvalData, employmentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">משרה מלאה</SelectItem>
                    <SelectItem value="PART_TIME">משרה חלקית</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                  ביטול
                </Button>
                <Button onClick={handleApprove} disabled={approveMutation.isPending}>
                  אשר עובד
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </PageTransition>
  )
}
