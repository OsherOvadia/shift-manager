'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Pencil, Trash2, Users, Sparkles } from 'lucide-react'
import { 
  PageTransition, 
  StaggerContainer, 
  StaggerItem, 
  ScaleOnTap,
  GridSkeleton,
  motion,
  AnimatePresence
} from '@/components/ui/animations'

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#6b7280', '#f97316',
]

export default function JobCategoriesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    nameHe: '',
    color: '#3b82f6',
  })
  const [justCreated, setJustCreated] = useState<string | null>(null)

  const { data: categories, isLoading } = useQuery<any[]>({
    queryKey: ['job-categories'],
    queryFn: () => api.get('/job-categories'),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/job-categories', data),
    onSuccess: (newCategory: any) => {
      toast({ 
        title: '✨ הקטגוריה נוצרה בהצלחה!',
        description: `${formData.nameHe} נוספה לרשימה`,
      })
      setJustCreated(newCategory.id)
      setTimeout(() => setJustCreated(null), 2000)
      queryClient.invalidateQueries({ queryKey: ['job-categories'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: () => {
      toast({ title: 'שגיאה ביצירת הקטגוריה', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: any }) =>
      api.patch(`/job-categories/${data.id}`, data.body),
    onSuccess: () => {
      toast({ title: 'הקטגוריה עודכנה בהצלחה' })
      queryClient.invalidateQueries({ queryKey: ['job-categories'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: () => {
      toast({ title: 'שגיאה בעדכון הקטגוריה', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/job-categories/${id}`),
    onSuccess: () => {
      toast({ title: 'הקטגוריה נמחקה' })
      queryClient.invalidateQueries({ queryKey: ['job-categories'] })
    },
    onError: () => {
      toast({ title: 'שגיאה במחיקת הקטגוריה', variant: 'destructive' })
    },
  })

  const resetForm = () => {
    setFormData({ name: '', nameHe: '', color: '#3b82f6' })
    setEditingCategory(null)
  }

  const handleOpenDialog = (category?: any) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        nameHe: category.nameHe,
        color: category.color,
      })
    } else {
      resetForm()
    }
    setDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, body: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-xl sm:text-2xl font-bold">קטגוריות תפקידים</h1>
            <p className="text-sm text-muted-foreground">נהל את סוגי התפקידים של העובדים</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <ScaleOnTap>
              <Button onClick={() => handleOpenDialog()} className="group">
                <Sparkles className="h-4 w-4 ml-2 group-hover:animate-spin" />
                קטגוריה חדשה
              </Button>
            </ScaleOnTap>
          </motion.div>
        </div>

        {isLoading ? (
          <GridSkeleton count={6} />
        ) : categories?.length > 0 ? (
          <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {categories.map((category: any) => (
                <StaggerItem key={category.id}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: category.isActive ? 1 : 0.5, 
                      scale: 1,
                      boxShadow: justCreated === category.id 
                        ? '0 0 20px rgba(59, 130, 246, 0.5)' 
                        : '0 0 0 transparent'
                    }}
                    exit={{ opacity: 0, scale: 0.8, y: -20 }}
                    whileHover={{ y: -4, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <Card className="overflow-hidden cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <motion.div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: category.color }}
                              whileHover={{ scale: 1.3 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                            />
                            <div>
                              <h3 className="font-medium">{category.nameHe}</h3>
                              <p className="text-xs text-muted-foreground">{category.name}</p>
                            </div>
                          </div>
                          {!category.isActive && (
                            <Badge variant="secondary" className="text-xs">לא פעיל</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <motion.div 
                            className="flex items-center gap-1 text-sm text-muted-foreground"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Users className="h-4 w-4" />
                            <span>{category._count?.users || 0} עובדים</span>
                          </motion.div>
                          <div className="flex gap-1">
                            <ScaleOnTap>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10"
                                onClick={() => handleOpenDialog(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </ScaleOnTap>
                            <ScaleOnTap>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteMutation.mutate(category.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardContent className="py-12 text-center">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
                </motion.div>
                <h3 className="font-medium text-lg mb-2">אין קטגוריות</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  צור קטגוריית תפקיד ראשונה
                </p>
                <ScaleOnTap>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 ml-2" />
                    קטגוריה חדשה
                  </Button>
                </ScaleOnTap>
              </CardContent>
            </Card>
          </motion.div>
        )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>שם באנגלית</Label>
              <Input
                placeholder="waiter"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>שם בעברית</Label>
              <Input
                placeholder="מלצר"
                value={formData.nameHe}
                onChange={(e) => setFormData({ ...formData, nameHe: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>צבע</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <motion.button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    animate={{ 
                      scale: formData.color === color ? 1.15 : 1,
                      boxShadow: formData.color === color 
                        ? `0 0 15px ${color}` 
                        : '0 0 0 transparent'
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingCategory ? 'עדכן' : 'צור'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </PageTransition>
  )
}
