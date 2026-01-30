import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, locale = 'he-IL'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatShortDate(date: Date | string, locale = 'he-IL'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}

export function getDayName(date: Date | string, locale = 'he-IL'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, { weekday: 'long' })
}

export function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    dates.push(date)
  }
  return dates
}

// Weekend days: Thursday (4), Friday (5), Saturday (6)
export function isWeekend(date: Date, weekendDays: number[] = [4, 5, 6]): boolean {
  return weekendDays.includes(date.getDay())
}
