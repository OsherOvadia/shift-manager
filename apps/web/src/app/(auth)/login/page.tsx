'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { ThemeToggle } from '@/components/theme-toggle'
import { Logo } from '@/components/logo'
import { Loader2 } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { setAuth, isAuthenticated, _hasHydrated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (_hasHydrated && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [_hasHydrated, isAuthenticated, router])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: true, // Default to true so users stay logged in
    },
  })

  const rememberMe = watch('rememberMe')

  const onSubmit = async (data: LoginFormData) => {
    const startTime = Date.now()
    console.log('🔐 Starting login process...')
    
    setIsLoading(true)
    try {
      const apiStartTime = Date.now()
      const response = await api.public.post<{
        accessToken: string
        refreshToken: string
        user: any
      }>('/auth/login', data)
      console.log(`   ✓ API call took: ${Date.now() - apiStartTime}ms`)

      const authStartTime = Date.now()
      // Store auth data with rememberMe preference
      setAuth(response.user, response.accessToken, response.refreshToken, data.rememberMe)
      console.log(`   ✓ Auth store took: ${Date.now() - authStartTime}ms`)

      toast({
        title: 'התחברת בהצלחה',
        description: `שלום ${response.user.firstName}!`,
      })

      const navStartTime = Date.now()
      router.push('/dashboard')
      console.log(`   ✓ Navigation initiated in: ${Date.now() - navStartTime}ms`)
      console.log(`   ✅ Total frontend login time: ${Date.now() - startTime}ms`)
    } catch (error: any) {
      console.log(`   ❌ Login failed after: ${Date.now() - startTime}ms`)
      toast({
        variant: 'destructive',
        title: 'שגיאת התחברות',
        description: error.message || 'שם משתמש או סיסמה שגויים',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Theme Toggle */}
      <div className="absolute top-4 start-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="flex justify-center mb-2">
            <div className="p-3 sm:p-4 bg-primary rounded-2xl">
              <Logo size="lg" className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl">מנהל משמרות</CardTitle>
          <CardDescription className="text-sm">התחבר למערכת ניהול המשמרות</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="flex items-center gap-3 py-1">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setValue('rememberMe', checked as boolean)}
                disabled={isLoading}
                className="h-5 w-5 min-h-5 min-w-5"
              />
              <Label htmlFor="rememberMe" className="text-sm sm:text-base font-normal cursor-pointer select-none">
                זכור אותי
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מתחבר...
                </>
              ) : (
                'התחבר'
              )}
            </Button>
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>
                עובד חדש?{' '}
                <Link href="/signup" className="text-primary hover:underline">
                  הרשם כאן
                </Link>
              </p>
              <p>
                מנהל?{' '}
                <Link href="/register" className="text-primary hover:underline">
                  צור ארגון חדש
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
