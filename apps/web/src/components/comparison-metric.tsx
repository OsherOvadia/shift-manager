import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComparisonMetricProps {
  label: string
  current: number
  previous?: number
  format?: 'currency' | 'number' | 'percentage'
  className?: string
}

export function ComparisonMetric({ 
  label, 
  current, 
  previous, 
  format = 'currency',
  className 
}: ComparisonMetricProps) {
  const formatValue = (value: number) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS',
        maximumFractionDigits: 0,
      }).format(value)
    }
    if (format === 'percentage') {
      return `${value.toFixed(1)}%`
    }
    return value.toLocaleString('he-IL')
  }

  let change = 0
  let percentChange = 0
  if (previous && previous !== 0) {
    change = current - previous
    percentChange = ((current - previous) / previous) * 100
  }

  const isIncrease = change > 0
  const isDecrease = change < 0
  const isNeutral = change === 0

  return (
    <div className={cn('p-3 bg-muted/50 rounded-lg', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {previous !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isIncrease && 'text-green-600 dark:text-green-400',
            isDecrease && 'text-red-600 dark:text-red-400',
            isNeutral && 'text-muted-foreground'
          )}>
            {isIncrease && <TrendingUp className="h-3 w-3" />}
            {isDecrease && <TrendingDown className="h-3 w-3" />}
            {isNeutral && <Minus className="h-3 w-3" />}
            <span>{percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-lg font-bold">{formatValue(current)}</div>
        {previous !== undefined && (
          <div className="text-xs text-muted-foreground">
            ({formatValue(previous)} בשבוע שעבר)
          </div>
        )}
      </div>
    </div>
  )
}
