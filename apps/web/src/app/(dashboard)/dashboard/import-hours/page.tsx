'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageTransition, StaggerContainer, StaggerItem, FadeIn, SuccessCheck } from '@/components/ui/animations'
import {
  Upload,
  FileSpreadsheet,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserCheck,
  Calendar,
} from 'lucide-react'

interface WorkerMatch {
  name: string
  category: string
  matchedUserId: string | null
  matchedUserName: string | null
  matchStatus: 'matched' | 'partial' | 'unmatched'
  matchCandidates: { id: string; name: string }[]
  totalHours: number
  hours100: number
  hours125: number
  hours150: number
  workDays: number
  shifts: { day: string; totalHours: number; startTime: string | null; endTime: string | null }[]
}

interface ImportPreview {
  sessionId: string
  fileName: string
  workers: WorkerMatch[]
  summary: {
    totalWorkers: number
    matched: number
    unmatched: number
    totalHours: number
    totalShifts: number
  }
}

interface Employee {
  id: string
  name: string
  firstName: string
  lastName: string
  category: string
}

type Step = 'upload' | 'preview' | 'success'

// Map Hebrew category names to display labels
const CATEGORY_LABELS: { [key: string]: { label: string; color: string } } = {
  'מלצר': { label: 'מלצר', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  'מלצרית': { label: 'מלצרית', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  'אחמשית': { label: 'אחמשית', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' },
  'אח"מ': { label: 'אח"מ', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' },
  'טבח': { label: 'טבח', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
  'טבחית': { label: 'טבחית', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
  'שוטף': { label: 'שוטף כלים', color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' },
  'שוטף כלים': { label: 'שוטף כלים', color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' },
}

/**
 * Get the Sunday (start of week) for a given date.
 * The Israeli work week starts on Sunday.
 */
function getWeekStartDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDay() // 0=Sunday
  d.setDate(d.getDate() - day)
  return d.toISOString().split('T')[0]
}

export default function ImportHoursPage() {
  const { accessToken } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [workerMapping, setWorkerMapping] = useState<{ [name: string]: string }>({})
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set())
  const [applyResult, setApplyResult] = useState<any>(null)
  const [weekStartDate, setWeekStartDate] = useState<string>(getWeekStartDate(new Date()))
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Fetch employees list for manual matching
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['import-employees'],
    queryFn: () => api.get('/hours-import/employees', accessToken!),
    enabled: !!accessToken,
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('weekStartDate', weekStartDate)
      return api.upload<ImportPreview>('/hours-import/upload', formData, accessToken!)
    },
    onSuccess: (data) => {
      setPreview(data)
      // Initialize worker mapping from auto-matched data
      const mapping: { [name: string]: string } = {}
      data.workers.forEach((w) => {
        if (w.matchedUserId) {
          mapping[w.name] = w.matchedUserId
        }
      })
      setWorkerMapping(mapping)
      setStep('preview')
      toast({
        title: 'הקובץ נטען בהצלחה',
        description: `נמצאו ${data.summary.totalWorkers} עובדים, ${data.summary.matched} זוהו אוטומטית`,
      })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה בטעינת הקובץ',
        description: error.message || 'נסה שוב עם קובץ Excel תקין',
      })
    },
  })

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error('No preview data')
      return api.post(
        `/hours-import/apply/${preview.sessionId}`,
        { workerMapping, weekStartDate },
        accessToken!,
      )
    },
    onSuccess: (data: any) => {
      setApplyResult(data)
      setStep('success')
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      const created = data.summary?.created || 0
      const assignments = data.summary?.assignmentsCreated || 0
      toast({
        title: 'העדכון הושלם בהצלחה',
        description: created > 0
          ? `${created} עובדים חדשים נוצרו, ${assignments} משמרות נרשמו`
          : `${assignments} משמרות נרשמו בהצלחה`,
      })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'שגיאה בעדכון השעות',
        description: error.message,
      })
    },
  })

  // File handling
  const handleFile = useCallback((file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validExtensions.includes(ext)) {
      toast({
        variant: 'destructive',
        title: 'סוג קובץ לא נתמך',
        description: 'נא להעלות קובץ Excel (.xlsx, .xls) או CSV',
      })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'הקובץ גדול מדי',
        description: 'גודל מקסימלי: 10MB',
      })
      return
    }
    setSelectedFile(file)
    uploadMutation.mutate(file)
  }, [uploadMutation, toast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }, [handleFile])

  const handleWorkerMappingChange = (workerName: string, userId: string) => {
    setWorkerMapping(prev => ({
      ...prev,
      [workerName]: userId,
    }))
  }

  const toggleWorkerExpand = (name: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const resetImport = () => {
    setStep('upload')
    setPreview(null)
    setWorkerMapping({})
    setExpandedWorkers(new Set())
    setApplyResult(null)
    setSelectedFile(null)
  }

  const mappedCount = Object.keys(workerMapping).filter(k => workerMapping[k]).length
  const totalWorkers = preview?.summary.totalWorkers || 0
  const unmappedCount = totalWorkers - mappedCount

  // Format the week date for display
  const weekDisplayDate = useMemo(() => {
    if (!weekStartDate) return ''
    const start = new Date(weekStartDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
    return `${fmt(start)} - ${fmt(end)}`
  }, [weekStartDate])

  // Hebrew day letter to actual date mapping for display
  const dayToDate = useMemo(() => {
    if (!weekStartDate) return {}
    const map: { [key: string]: string } = {}
    const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
    const start = new Date(weekStartDate)
    days.forEach((day, idx) => {
      const d = new Date(start)
      d.setDate(d.getDate() + idx)
      map[day] = `${d.getDate()}/${d.getMonth() + 1}`
    })
    return map
  }, [weekStartDate])

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">העלאת שעות עובדים</h1>
            <p className="text-sm text-muted-foreground mt-1">
              העלה קובץ Excel עם שעות העבודה של העובדים
            </p>
          </div>
          {step !== 'upload' && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetImport}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">התחל מחדש</span>
            </Button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <div className={`flex items-center gap-1.5 ${step === 'upload' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step === 'upload' ? 'bg-primary text-primary-foreground' : step !== 'upload' ? 'bg-green-500 text-white' : 'bg-muted'}`}>
              {step !== 'upload' ? '✓' : '1'}
            </div>
            <span className="hidden sm:inline">העלאה</span>
          </div>
          <div className="h-px w-6 bg-muted-foreground/30" />
          <div className={`flex items-center gap-1.5 ${step === 'preview' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step === 'preview' ? 'bg-primary text-primary-foreground' : step === 'success' ? 'bg-green-500 text-white' : 'bg-muted'}`}>
              {step === 'success' ? '✓' : '2'}
            </div>
            <span className="hidden sm:inline">תצוגה מקדימה</span>
          </div>
          <div className="h-px w-6 bg-muted-foreground/30" />
          <div className={`flex items-center gap-1.5 ${step === 'success' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step === 'success' ? 'bg-green-500 text-white' : 'bg-muted'}`}>
              {step === 'success' ? '✓' : '3'}
            </div>
            <span className="hidden sm:inline">סיום</span>
          </div>
        </div>

        {/* ==================== STEP 1: UPLOAD ==================== */}
        {step === 'upload' && (
          <FadeIn>
            {/* Week date picker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  לאיזה שבוע מתייחס הקובץ?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Label htmlFor="weekStart" className="whitespace-nowrap text-sm">תחילת שבוע (יום ראשון):</Label>
                    <Input
                      id="weekStart"
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => {
                        // Snap to the nearest Sunday
                        const d = new Date(e.target.value)
                        if (!isNaN(d.getTime())) {
                          setWeekStartDate(getWeekStartDate(d))
                        }
                      }}
                      className="max-w-[200px]"
                    />
                  </div>
                  {weekStartDate && (
                    <Badge variant="secondary" className="text-sm">
                      שבוע: {weekDisplayDate}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  התאריך ישמש להמרת ימים (א&apos;-ש&apos;) לתאריכים בפועל ולשיוך המשמרות ללוח
                </p>
              </CardContent>
            </Card>

            {/* Upload area */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div
                  className={`
                    relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center
                    transition-all duration-200 cursor-pointer
                    ${isDragging
                      ? 'border-primary bg-primary/5 scale-[1.02]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                    }
                    ${uploadMutation.isPending ? 'pointer-events-none opacity-60' : ''}
                  `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  {uploadMutation.isPending ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 text-primary animate-spin" />
                      <div>
                        <p className="text-base font-medium">מעבד את הקובץ...</p>
                        <p className="text-sm text-muted-foreground mt-1">נא להמתין</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                      </div>
                      <div>
                        <p className="text-base sm:text-lg font-medium">
                          {isDragging ? 'שחרר את הקובץ כאן' : 'גרור קובץ Excel לכאן'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          או לחץ כאן לבחירת קובץ
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>XLSX, XLS, CSV - עד 10MB</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Help text */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-2">מה הקובץ צריך להכיל?</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>שמות העובדים</li>
                  <li>שעות כניסה ויציאה לכל משמרת</li>
                  <li>סה&quot;כ שעות עבודה</li>
                  <li>מחלקה (מלצר/טבח/שוטף) - אם קיים</li>
                  <li>חלוקה לפי אחוזים (100%, 125%, 150%) - אם קיים</li>
                </ul>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* ==================== STEP 2: PREVIEW ==================== */}
        {step === 'preview' && preview && (
          <FadeIn>
            {/* Week info banner */}
            {weekStartDate && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">שבוע: {weekDisplayDate}</span>
                  <span className="text-xs text-muted-foreground">
                    (המשמרות יירשמו ללוח בתאריכים אלו)
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Summary cards */}
            <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StaggerItem>
                <Card>
                  <CardContent className="p-3 sm:p-4 text-center">
                    <Users className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-2xl font-bold">{preview.summary.totalWorkers}</p>
                    <p className="text-xs text-muted-foreground">עובדים</p>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card>
                  <CardContent className="p-3 sm:p-4 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                    <p className="text-2xl font-bold">{mappedCount}</p>
                    <p className="text-xs text-muted-foreground">זוהו</p>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card>
                  <CardContent className="p-3 sm:p-4 text-center">
                    <Clock className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                    <p className="text-2xl font-bold">{preview.summary.totalHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">סה&quot;כ שעות</p>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card>
                  <CardContent className="p-3 sm:p-4 text-center">
                    <UserPlus className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-2xl font-bold">{unmappedCount}</p>
                    <p className="text-xs text-muted-foreground">חדשים</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>

            {/* Legend */}
            <Card className="bg-muted/40 border-dashed">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span><strong>זוהה</strong> - עובד קיים במערכת</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4 text-blue-500" />
                    <span><strong>חדש</strong> - ייוצר פרופיל חדש אוטומטית</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  עובדים שלא זוהו יקבלו פרופיל חדש במערכת. תקבל התראה להשלמת הפרטים שלהם (תפקיד, שכר, אימייל).
                </p>
              </CardContent>
            </Card>

            {/* Workers list */}
            <div className="space-y-3">
              <h2 className="font-semibold text-base">עובדים שנמצאו בקובץ ({preview.summary.totalWorkers})</h2>

              {preview.workers.map((worker, idx) => {
                const isExpanded = expandedWorkers.has(worker.name)
                const currentMapping = workerMapping[worker.name]
                const isMatched = !!currentMapping
                const categoryInfo = worker.category ? CATEGORY_LABELS[worker.category] : null
                const statusIcon = isMatched ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-[10px] text-green-600 font-medium">זוהה</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    <UserPlus className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span className="text-[10px] text-blue-600 font-medium">חדש</span>
                  </div>
                )

                return (
                  <Card key={worker.name + idx} className={`overflow-hidden ${!isMatched ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/30 dark:bg-blue-500/5' : ''}`}>
                    <div
                      className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                      onClick={() => toggleWorkerExpand(worker.name)}
                    >
                      <div className="flex items-center gap-3">
                        {statusIcon}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-base">{worker.name}</span>
                            {categoryInfo && (
                              <Badge className={`text-xs ${categoryInfo.color} border-0`}>
                                {categoryInfo.label}
                              </Badge>
                            )}
                            {worker.category && !categoryInfo && (
                              <Badge variant="outline" className="text-xs">
                                {worker.category}
                              </Badge>
                            )}
                            {isMatched && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <UserCheck className="h-3 w-3" />
                                {worker.matchedUserName || employees.find(e => e.id === currentMapping)?.name}
                              </Badge>
                            )}
                            {!isMatched && (
                              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 gap-1">
                                <UserPlus className="h-3 w-3" />
                                ייוצר פרופיל חדש
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                            <span>{worker.totalHours.toFixed(1)} שעות</span>
                            <span>{worker.workDays} ימים</span>
                            {worker.hours125 > 0 && (
                              <span className="text-amber-600">{worker.hours125.toFixed(1)}h @125%</span>
                            )}
                            {worker.hours150 > 0 && (
                              <span className="text-red-500">{worker.hours150.toFixed(1)}h @150%</span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-3 sm:p-4 space-y-3">
                        {/* Worker matching dropdown */}
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">שייך לעובד במערכת:</label>
                          <Select
                            value={currentMapping || 'none'}
                            onValueChange={(val) =>
                              handleWorkerMappingChange(worker.name, val === 'none' ? '' : val)
                            }
                          >
                            <SelectTrigger className="w-full h-11">
                              <SelectValue placeholder="בחר עובד..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-- לא משויך (ייוצר חדש) --</SelectItem>
                              {employees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                  {emp.name} {emp.category && `(${emp.category})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Shift details */}
                        {worker.shifts.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1.5">משמרות:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {worker.shifts.map((shift, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex items-center justify-between bg-background rounded-lg px-3 py-2 text-sm border"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">יום {shift.day}&apos;</span>
                                    {dayToDate[shift.day] && (
                                      <span className="text-xs text-muted-foreground">({dayToDate[shift.day]})</span>
                                    )}
                                    {shift.startTime && shift.endTime && (
                                      <span className="text-muted-foreground">
                                        {shift.startTime}-{shift.endTime}
                                      </span>
                                    )}
                                  </div>
                                  <Badge variant="outline">{shift.totalHours.toFixed(2)}h</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hours breakdown */}
                        {(worker.hours100 > 0 || worker.hours125 > 0 || worker.hours150 > 0) && (
                          <div className="flex gap-3 text-sm">
                            {worker.hours100 > 0 && (
                              <div className="bg-background border rounded-lg px-3 py-1.5">
                                <span className="text-muted-foreground">100%: </span>
                                <span className="font-medium">{worker.hours100.toFixed(1)}</span>
                              </div>
                            )}
                            {worker.hours125 > 0 && (
                              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-1.5">
                                <span className="text-muted-foreground">125%: </span>
                                <span className="font-medium">{worker.hours125.toFixed(1)}</span>
                              </div>
                            )}
                            {worker.hours150 > 0 && (
                              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-1.5">
                                <span className="text-muted-foreground">150%: </span>
                                <span className="font-medium">{worker.hours150.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>

            {/* Info about what will happen */}
            {unmappedCount > 0 && (
              <Card className="border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <UserPlus className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-700 dark:text-blue-400">
                        {unmappedCount} עובדים חדשים ייוצרו אוטומטית
                      </p>
                      <p className="text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                        תקבל התראה להשלמת הפרטים שלהם: תפקיד (מלצר/שוטף/טבח), שכר, אימייל ועוד.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-4">
              <Button
                className="h-12 sm:h-11 text-base sm:text-sm flex-1 gap-2"
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    מעבד...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    אשר ועדכן {totalWorkers} עובדים
                    {unmappedCount > 0 && ` (${unmappedCount} חדשים)`}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="h-12 sm:h-11 text-base sm:text-sm gap-2"
                onClick={resetImport}
                disabled={applyMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4" />
                חזור
              </Button>
            </div>
          </FadeIn>
        )}

        {/* ==================== STEP 3: SUCCESS ==================== */}
        {step === 'success' && (
          <FadeIn>
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <SuccessCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">העדכון הושלם בהצלחה!</h2>
                {applyResult && (
                  <div className="space-y-2 text-muted-foreground">
                    {(applyResult.summary?.updated || 0) > 0 && (
                      <div className="flex items-center justify-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-500" />
                        <span>עודכנו {applyResult.summary.updated} עובדים קיימים</span>
                      </div>
                    )}
                    {(applyResult.summary?.created || 0) > 0 && (
                      <div className="flex items-center justify-center gap-2">
                        <UserPlus className="h-4 w-4 text-blue-500" />
                        <span>נוצרו {applyResult.summary.created} עובדים חדשים</span>
                      </div>
                    )}
                    {(applyResult.summary?.assignmentsCreated || 0) > 0 && (
                      <div className="flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4 text-purple-500" />
                        <span>נרשמו {applyResult.summary.assignmentsCreated} משמרות ללוח</span>
                      </div>
                    )}
                    <p>סה&quot;כ {applyResult.summary?.totalHours?.toFixed(1) || 0} שעות</p>
                  </div>
                )}

                {/* New workers notification */}
                {applyResult?.newlyCreated?.length > 0 && (
                  <Card className="mt-4 border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 text-right">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-blue-700 dark:text-blue-400 mb-2">
                            נשלחה התראה להשלמת פרטי העובדים החדשים:
                          </p>
                          <ul className="space-y-1">
                            {applyResult.newlyCreated.map((w: any) => (
                              <li key={w.id} className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                {w.name}
                              </li>
                            ))}
                          </ul>
                          <p className="text-blue-600/70 dark:text-blue-400/70 mt-2">
                            עבור לעמוד &quot;עובדים&quot; כדי להשלים את הפרטים: תפקיד, שכר, אימייל.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  className="mt-6 h-12 gap-2"
                  onClick={resetImport}
                >
                  <Upload className="h-4 w-4" />
                  העלה קובץ נוסף
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  )
}
