'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/lib/auth'
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from 'lucide-react'

const SUPER_ADMIN_EMAIL = 'oser130309@gmail.com'

export default function AdminResetPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { accessToken, user } = useAuthStore()

  const [organizationName, setOrganizationName] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Only allow the super admin email
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">אין גישה</h2>
            <p className="text-muted-foreground">עמוד זה זמין למנהל הראשי בלבד</p>
            <Button className="mt-4" onClick={() => router.push('/dashboard')}>
              חזרה לדשבורד
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isConfirmed = confirmText === 'מחק הכל'

  const handleReset = async () => {
    if (!organizationName || !isConfirmed || !accessToken) return

    setIsLoading(true)
    setResult(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/database-reset/reset-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ organizationName }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'שגיאה באיפוס')
      }

      setResult(data)
      toast({
        title: 'האיפוס הושלם בהצלחה',
        description: `הארגון "${organizationName}" אופס. חשבונות מנהלים נשמרו.`,
      })
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: error.message || 'שגיאה באיפוס הארגון',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-destructive flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          איפוס ארגון
        </h1>
        <p className="text-muted-foreground mt-1">
          מחק את כל הנתונים של ארגון תוך שמירה על חשבונות המנהלים
        </p>
      </div>

      {/* Warning card */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-destructive">פעולה זו בלתי הפיכה!</p>
              <p className="text-muted-foreground mt-1">הפעולה תמחק:</p>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                <li>כל העובדים (לא מנהלים)</li>
                <li>כל המשמרות וההקצאות</li>
                <li>כל הזמינויות</li>
                <li>כל הדוחות, ההכנסות וההוצאות</li>
                <li>כל ההגדרות וקטגוריות התפקידים</li>
                <li>כל ההתראות</li>
              </ul>
              <p className="font-medium mt-2">יישמרו: הארגון עצמו + חשבונות מנהלים/אדמין</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset form */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי האיפוס</CardTitle>
          <CardDescription>מלא את כל השדות כדי לבצע איפוס</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">שם הארגון</Label>
            <Input
              id="orgName"
              placeholder="הכנס את שם הארגון המדויק"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              שם הארגון כפי שמופיע במערכת (כולל רווחים)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">אישור - הקלד &quot;מחק הכל&quot;</Label>
            <Input
              id="confirm"
              placeholder='הקלד "מחק הכל" לאישור'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={isConfirmed ? 'border-destructive' : ''}
            />
          </div>

          <Button
            variant="destructive"
            className="w-full h-12 text-base gap-2"
            disabled={!organizationName || !isConfirmed || isLoading}
            onClick={handleReset}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                מאפס...
              </>
            ) : (
              <>
                <Trash2 className="h-5 w-5" />
                אפס ארגון
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-400">האיפוס הושלם</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">ארגון: {result.preserved?.organization?.name}</p>
            </div>
            <div>
              <p className="font-medium mb-1">חשבונות שנשמרו:</p>
              <ul className="space-y-1">
                {result.preserved?.managers?.map((m: any) => (
                  <li key={m.id} className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {m.name} ({m.email}) - {m.role}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">נמחקו:</p>
              <p className="text-muted-foreground">
                {result.deleted?.employees} עובדים, {result.deleted?.schedules} לוחות, כל ההכנסות, ההוצאות, ההגדרות וההתראות
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
