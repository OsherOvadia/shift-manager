'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { Calendar, Loader2 } from 'lucide-react'

const registerSchema = z.object({
  organizationName: z.string().min(2, 'שם העסק חייב להכיל לפחות 2 תווים'),
  adminFirstName: z.string().min(2, 'שם פרטי חייב להכיל לפחות 2 תווים'),
  adminLastName: z.string().min(2, 'שם משפחה חייב להכיל לפחות 2 תווים'),
  adminEmail: z.string().email('כתובת אימייל לא תקינה'),
  adminPassword: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.adminPassword === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    try {
      await api.post('/organizations', {
        name: data.organizationName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        adminFirstName: data.adminFirstName,
        adminLastName: data.adminLastName,
      })

      toast({
        title: 'הארגון נוצר בהצלחה',
        description: 'כעת תוכל להתחבר עם פרטי המנהל שיצרת',
      })

      router.push('/login')
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאה ביצירת הארגון',
        description: error.message || 'נא לנסות שוב',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Calendar className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">יצירת ארגון חדש</CardTitle>
          <CardDescription>הירשם כדי להתחיל לנהל את המשמרות</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">שם העסק</Label>
              <Input
                id="organizationName"
                placeholder="לדוגמה: קפה הצבי"
                {...register('organizationName')}
                disabled={isLoading}
              />
              {errors.organizationName && (
                <p className="text-sm text-destructive">{errors.organizationName.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFirstName">שם פרטי</Label>
                <Input
                  id="adminFirstName"
                  placeholder="ישראל"
                  {...register('adminFirstName')}
                  disabled={isLoading}
                />
                {errors.adminFirstName && (
                  <p className="text-sm text-destructive">{errors.adminFirstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminLastName">שם משפחה</Label>
                <Input
                  id="adminLastName"
                  placeholder="ישראלי"
                  {...register('adminLastName')}
                  disabled={isLoading}
                />
                {errors.adminLastName && (
                  <p className="text-sm text-destructive">{errors.adminLastName.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">אימייל</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@example.com"
                {...register('adminEmail')}
                disabled={isLoading}
              />
              {errors.adminEmail && (
                <p className="text-sm text-destructive">{errors.adminEmail.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">סיסמה</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="••••••••"
                {...register('adminPassword')}
                disabled={isLoading}
              />
              {errors.adminPassword && (
                <p className="text-sm text-destructive">{errors.adminPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  יוצר...
                </>
              ) : (
                'צור ארגון'
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              כבר יש לך חשבון?{' '}
              <Link href="/login" className="text-primary hover:underline">
                התחבר
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
