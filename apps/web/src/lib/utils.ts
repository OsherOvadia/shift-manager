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

const HEBREW_DAY_NAMES = [
  'יום ראשון',    // Sunday (0)
  'יום שני',      // Monday (1)
  'יום שלישי',    // Tuesday (2)
  'יום רביעי',    // Wednesday (3)
  'יום חמישי',    // Thursday (4)
  'יום שישי',     // Friday (5)
  'יום שבת',      // Saturday (6)
]

const HEBREW_DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export function getDayName(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dayIndex = d.getDay()
  return HEBREW_DAY_NAMES[dayIndex]
}

export function getDayLetter(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dayIndex = d.getDay()
  return HEBREW_DAY_LETTERS[dayIndex]
}

export function getWeekStartDate(date: Date = new Date()): Date {
  const d = new Date(date)
  // Use UTC to avoid timezone issues
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day
  d.setUTCDate(diff)
  d.setUTCHours(0, 0, 0, 0)
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

// Format date as YYYY-MM-DD WITHOUT timezone conversion
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse date string as local date (not UTC)
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Check if a shift is closed based on business settings
export function isShiftClosed(
  date: Date,
  shiftType: string,
  closedPeriods: Array<{ day: number; shiftTypes: string[] }> = []
): boolean {
  const dayOfWeek = date.getDay() // 0=Sunday, 6=Saturday
  return closedPeriods.some(
    (period) => period.day === dayOfWeek && period.shiftTypes.includes(shiftType)
  )
}
