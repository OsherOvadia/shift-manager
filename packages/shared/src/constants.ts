import { EmploymentType, WorkRules, ShiftType } from './types';

// Work rules per employment type
export const WORK_RULES: Record<EmploymentType, WorkRules> = {
  [EmploymentType.FULL_TIME]: {
    minShifts: 5,
    minWeekendShifts: 2,
  },
  [EmploymentType.PART_TIME]: {
    minShifts: 3,
    minWeekendShifts: 1,
  },
};

// Default weekend days (Friday = 5, Saturday = 6 in JS Date)
export const DEFAULT_WEEKEND_DAYS = [5, 6];

// Default submission deadline (Thursday at 18:00)
export const DEFAULT_SUBMISSION_DEADLINE = {
  day: 4, // Thursday
  hour: 18,
};

// Shift type labels in Hebrew
export const SHIFT_TYPE_LABELS_HE: Record<ShiftType, string> = {
  [ShiftType.MORNING]: 'משמרת בוקר',
  [ShiftType.EVENING]: 'משמרת ערב',
  [ShiftType.EVENING_CLOSE]: 'משמרת ערב + סגירה',
};

// Role labels in Hebrew
export const ROLE_LABELS_HE = {
  ADMIN: 'מנהל מערכת',
  MANAGER: 'מנהל',
  EMPLOYEE: 'עובד',
};

// Employment type labels in Hebrew
export const EMPLOYMENT_TYPE_LABELS_HE = {
  FULL_TIME: 'משרה מלאה',
  PART_TIME: 'משרה חלקית',
};

// Day names in Hebrew
export const DAY_NAMES_HE = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
];

// Month names in Hebrew
export const MONTH_NAMES_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

// API Response messages in Hebrew
export const MESSAGES_HE = {
  LOGIN_SUCCESS: 'התחברת בהצלחה',
  LOGIN_FAILED: 'שם משתמש או סיסמה שגויים',
  LOGOUT_SUCCESS: 'התנתקת בהצלחה',
  REGISTRATION_SUCCESS: 'המשתמש נוצר בהצלחה',
  AVAILABILITY_SUBMITTED: 'הזמינות נשלחה בהצלחה',
  AVAILABILITY_UPDATED: 'הזמינות עודכנה בהצלחה',
  SCHEDULE_PUBLISHED: 'לוח המשמרות פורסם בהצלחה',
  SHIFT_ASSIGNED: 'המשמרת שובצה בהצלחה',
  INSUFFICIENT_SHIFTS: 'לא נבחרו מספיק משמרות',
  INSUFFICIENT_WEEKEND_SHIFTS: 'לא נבחרו מספיק משמרות סוף שבוע',
  CONFLICT_DETECTED: 'קיימת התנגשות בלוח הזמנים',
  UNAUTHORIZED: 'אין לך הרשאה לבצע פעולה זו',
  NOT_FOUND: 'הפריט המבוקש לא נמצא',
  SERVER_ERROR: 'שגיאת שרת, נסה שוב מאוחר יותר',
};

// Validation constants
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 255,
};

// JWT Token expiration times
export const TOKEN_EXPIRATION = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
  REFRESH_TOKEN_REMEMBER_ME: '30d',
};
