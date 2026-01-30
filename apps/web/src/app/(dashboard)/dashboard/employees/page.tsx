'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Loader2, Plus, UserPlus, Trash2, DollarSign } from 'lucide-react'

export default function EmployeesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  const isAdminRole = isAdmin()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'EMPLOYEE' as string,
    employmentType: 'FULL_TIME' as string,
    jobCategoryId: '' as string,
    hourlyWage: '' as string,
  })

  const { data: employees, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<any[]>('/users', accessToken!),
    enabled: !!accessToken,
  })

  const { data: jobCategories } = useQuery({
    queryKey: ['job-categories'],
    queryFn: () => api.get('/job-categories/active', accessToken!),
    enabled: !!accessToken,
  })

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/auth/register', {
        ...data,
        ...(data.jobCategoryId && { jobCategoryId: data.jobCategoryId }),
        ...(data.hourlyWage && { hourlyWage: parseFloat(data.hourlyWage) }),
      }, accessToken!),
    onSuccess: () => {
      toast({
        title: 'העובד נוסף בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsAddDialogOpen(false)
      setNewEmployee({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'EMPLOYEE',
        employmentType: 'FULL_TIME',
        jobCategoryId: '',
        hourlyWage: '',
      })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`, accessToken!),
    onSuccess: () => {
      toast({
        title: 'העובד הושבת בהצלחה',
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message,
      })
    },
  })

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'מנהל מערכת'
      case 'MANAGER':
        return 'מנהל'
      case 'EMPLOYEE':
        return 'עובד'
      default:
        return role
    }
  }

  const getEmploymentLabel = (type: string) => {
    return type === 'FULL_TIME' ? 'משרה מלאה' : 'משרה חלקית'
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">ניהול עובדים</h1>
          <p className="text-sm text-muted-foreground">
            צפה וערוך את רשימת העובדים
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 ml-2" />
              הוסף עובד
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הוספת עובד חדש</DialogTitle>
              <DialogDescription>
                מלא את פרטי העובד החדש
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">שם פרטי</Label>
                  <Input
                    id="firstName"
                    value={newEmployee.firstName}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">שם משפחה</Label>
                  <Input
                    id="lastName"
                    value={newEmployee.lastName}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  value={newEmployee.password}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, password: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תפקיד מערכת</Label>
                  <Select
                    value={newEmployee.role}
                    onValueChange={(value) =>
                      setNewEmployee({ ...newEmployee, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">עובד</SelectItem>
                      <SelectItem value="MANAGER">מנהל</SelectItem>
                      {isAdminRole && <SelectItem value="ADMIN">מנהל מערכת</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>סוג העסקה</Label>
                  <Select
                    value={newEmployee.employmentType}
                    onValueChange={(value) =>
                      setNewEmployee({ ...newEmployee, employmentType: value })
                    }
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>קטגוריית תפקיד</Label>
                  <Select
                    value={newEmployee.jobCategoryId}
                    onValueChange={(value) =>
                      setNewEmployee({ ...newEmployee, jobCategoryId: value })
                    }
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
                    value={newEmployee.hourlyWage}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, hourlyWage: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                onClick={() => addMutation.mutate(newEmployee)}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'הוסף'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees?.map((employee) => (
            <Card key={employee.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {employee.jobCategory && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: employee.jobCategory.color }}
                      />
                    )}
                    <CardTitle className="text-base sm:text-lg">
                      {employee.firstName} {employee.lastName}
                    </CardTitle>
                  </div>
                  {!employee.isActive && (
                    <Badge variant="destructive" className="text-xs">לא פעיל</Badge>
                  )}
                </div>
                <CardDescription className="text-xs sm:text-sm">{employee.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge variant="secondary" className="text-xs">{getRoleLabel(employee.role)}</Badge>
                  <Badge variant="outline" className="text-xs">
                    {getEmploymentLabel(employee.employmentType)}
                  </Badge>
                  {employee.jobCategory && (
                    <Badge
                      className="text-xs"
                      style={{ backgroundColor: employee.jobCategory.color }}
                    >
                      {employee.jobCategory.nameHe}
                    </Badge>
                  )}
                </div>
                {employee.hourlyWage > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                    <DollarSign className="h-3 w-3" />
                    <span>₪{employee.hourlyWage.toFixed(2)} לשעה</span>
                  </div>
                )}
                {employee.isActive && employee.role === 'EMPLOYEE' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      if (confirm('האם אתה בטוח שברצונך להשבית עובד זה?')) {
                        deactivateMutation.mutate(employee.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    השבת
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
